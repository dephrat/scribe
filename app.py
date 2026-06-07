import os
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from flask import Flask, jsonify, request, redirect, url_for, session, Response, stream_with_context
from google.auth.exceptions import RefreshError
from crawler import crawl_website
from db import init_db, get_setting, save_setting, delete_draft, get_draft, get_website_content, save_website_content, save_email_pending, update_draft_status, get_db
from gmail import get_oauth_flow, credentials_to_dict
from flask_cors import CORS

load_dotenv()
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret")
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False

# SSE client queues per account
sse_queues = {}
sse_lock = threading.Lock()

def current_account():
    return session.get("account_email")

def get_emails_from_db(gmail_ids):
    return [get_draft(gid) for gid in gmail_ids if get_draft(gid)]

@app.errorhandler(RefreshError)
def handle_refresh_error(e):
    session.clear()
    return jsonify({"error": "session_expired"}), 401

@app.route("/api/status")
def status():
    connected = session.get("credentials") is not None
    owner_name = get_setting("owner_name", "", current_account())
    emails = []
    if connected:
        ids = session.get("drafted_email_ids", [])
        emails = get_emails_from_db(ids)
    return jsonify({
        "connected": connected,
        "owner_name": owner_name,
        "emails": emails
    })

@app.route("/connect")
def connect():
    flow = get_oauth_flow(url_for("oauth_callback", _external=True))
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
    )
    session["state"] = state
    session["code_verifier"] = flow.code_verifier
    return redirect(auth_url)

@app.route("/oauth/callback")
def oauth_callback():
    flow = get_oauth_flow(url_for("oauth_callback", _external=True))
    flow.code_verifier = session.get("code_verifier")
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    session["credentials"] = credentials_to_dict(credentials)

    from gmail import get_gmail_service, get_account_email
    service = get_gmail_service(session["credentials"])
    session["account_email"] = get_account_email(service)

    return redirect("http://localhost:5173")

@app.route("/api/fetch")
def fetch():
    if not session.get("credentials"):
        return jsonify({"error": "not_connected"}), 401

    from gmail import get_gmail_service, get_new_emails

    service = get_gmail_service(session["credentials"])
    whitelist = [e.strip() for e in get_setting("whitelist", "", current_account()).split(",") if e.strip()]
    max_emails = int(get_setting("max_emails", "100", current_account()) or "100")

    emails = get_new_emails(service, whitelist, max_emails)

    blacklist = [e.strip().lower() for e in get_setting("blacklist", "", current_account()).split(",") if e.strip()]
    if blacklist:
        emails = [e for e in emails if not any(b in e["sender"].lower() for b in blacklist)]

    gmail_ids = []
    for email in emails:
        existing = get_draft(email["gmail_id"])
        if existing:
            gmail_ids.append(email["gmail_id"])
        else:
            save_email_pending(
                email["gmail_id"], email["sender"], email["subject"],
                email["body"], email["thread_id"], email["message_id"], email.get("date", "")
            )
            gmail_ids.append(email["gmail_id"])

    session["drafted_email_ids"] = gmail_ids
    results = get_emails_from_db(gmail_ids)
    return jsonify({"emails": results})

@app.route("/api/generate", methods=["POST"])
def generate():
    if not session.get("credentials"):
        return jsonify({"error": "not_connected"}), 401

    from ai import draft_reply

    data = request.get_json()
    gmail_ids = data.get("gmail_ids", [])
    account = current_account()

    business_brief = get_setting("business_brief", "", account)
    content = get_website_content(account)
    if content:
        business_brief = business_brief + "\n\nWebsite content:\n" + content

    def process_one(gmail_id):
        existing = get_draft(gmail_id)
        if not existing:
            return
        if existing.get("status") == "ready" and existing.get("draft_reply"):
            return  # already has a draft, skip
        update_draft_status(gmail_id, "generating")
        try:
            reply = draft_reply(existing["body"], existing["sender"], existing["subject"], business_brief)
            update_draft_status(gmail_id, "ready", reply)
        except Exception as e:
            update_draft_status(gmail_id, "error")
        # push SSE event
        with sse_lock:
            queue = sse_queues.get(account)
        if queue is not None:
            updated = get_draft(gmail_id)
            queue.append(updated)

    def run_generation():
        with ThreadPoolExecutor(max_workers=3) as executor:
            executor.map(process_one, gmail_ids)
        # signal done
        with sse_lock:
            queue = sse_queues.get(account)
        if queue is not None:
            queue.append({"done": True})

    thread = threading.Thread(target=run_generation)
    thread.daemon = True
    thread.start()

    return jsonify({"started": True})

@app.route("/api/stream")
def stream():
    if not session.get("credentials"):
        return jsonify({"error": "not_connected"}), 401

    account = current_account()

    with sse_lock:
        sse_queues[account] = []

    @stream_with_context
    def event_stream():
        while True:
            with sse_lock:
                queue = sse_queues.get(account, [])
                if queue:
                    item = queue.pop(0)
                    sse_queues[account] = queue
                else:
                    item = None
            if item is not None:
                yield f"data: {json.dumps(item)}\n\n"
                if item.get("done"):
                    break
            else:
                import time
                time.sleep(0.5)

    return Response(event_stream(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.route("/api/send", methods=["POST"])
def send():
    if not session.get("credentials"):
        return jsonify({"error": "not_connected"}), 401

    from gmail import get_gmail_service, send_reply, archive_email

    service = get_gmail_service(session["credentials"])
    data = request.get_json()

    try:
        send_reply(service, data["to"], data["subject"], data["body"], data["thread_id"], data["message_id"])
        archive_email(service, data["gmail_id"])
    except Exception as e:
        if "404" in str(e) or "invalid" in str(e).lower():
            delete_draft(data["gmail_id"])
            ids = session.get("drafted_email_ids", [])
            ids = [i for i in ids if i != data["gmail_id"]]
            session["drafted_email_ids"] = ids
            return jsonify({"error": "email_not_found"}), 404
        raise

    delete_draft(data["gmail_id"])
    ids = session.get("drafted_email_ids", [])
    ids = [i for i in ids if i != data["gmail_id"]]
    session["drafted_email_ids"] = ids
    emails = get_emails_from_db(ids)
    return jsonify({"emails": emails})

@app.route("/api/dismiss", methods=["POST"])
def dismiss():
    if not session.get("credentials"):
        return jsonify({"error": "not_connected"}), 401

    from gmail import get_gmail_service, label_email, archive_email

    service = get_gmail_service(session["credentials"])
    data = request.get_json()
    gmail_id = data.get("gmail_id")

    if gmail_id:
        try:
            label_email(service, gmail_id, "needs-manual-review")
            archive_email(service, gmail_id)
        except Exception as e:
            if "404" in str(e) or "invalid" in str(e).lower():
                delete_draft(gmail_id)
                ids = session.get("drafted_email_ids", [])
                ids = [i for i in ids if i != gmail_id]
                session["drafted_email_ids"] = ids
                return jsonify({"error": "email_not_found"}), 404
            raise
        delete_draft(gmail_id)

    ids = session.get("drafted_email_ids", [])
    ids = [i for i in ids if i != gmail_id]
    session["drafted_email_ids"] = ids
    emails = get_emails_from_db(ids)
    return jsonify({"emails": emails})

@app.route("/api/regenerate", methods=["POST"])
def regenerate():
    if not session.get("credentials"):
        return jsonify({"error": "not_connected"}), 401

    from ai import draft_reply
    from db import save_draft

    data = request.get_json()
    gmail_id = data.get("gmail_id")
    business_brief = get_setting("business_brief", "", current_account())

    content = get_website_content(current_account())
    if content:
        business_brief = business_brief + "\n\nWebsite content:\n" + content

    existing = get_draft(gmail_id)
    if existing:
        update_draft_status(gmail_id, "generating")
        try:
            new_reply = draft_reply(existing["body"], existing["sender"], existing["subject"], business_brief)
            update_draft_status(gmail_id, "ready", new_reply)
            updated = get_draft(gmail_id)
            return jsonify({"email": updated})
        except Exception as e:
            update_draft_status(gmail_id, "error")
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "not_found"}), 404

@app.route("/api/settings", methods=["GET", "POST"])
def settings():
    account = current_account()
    if request.method == "POST":
        data = request.get_json()
        save_setting("owner_name", data.get("owner_name"), account)
        save_setting("business_brief", data.get("business_brief"), account)
        save_setting("whitelist", data.get("whitelist"), account)
        save_setting("website_url", data.get("website_url"), account)
        save_setting("max_crawl_pages", data.get("max_crawl_pages"), account)
        save_setting("additional_urls", data.get("additional_urls"), account)
        save_setting("max_emails", data.get("max_emails"), account)
        save_setting("timezone", data.get("timezone"), account)
        save_setting("blacklist", data.get("blacklist"), account)
        return jsonify({"saved": True})

    return jsonify({
        "owner_name": get_setting("owner_name", "", account),
        "business_brief": get_setting("business_brief", "", account),
        "whitelist": get_setting("whitelist", "", account),
        "website_url": get_setting("website_url", "", account),
        "max_crawl_pages": get_setting("max_crawl_pages", "10", account),
        "additional_urls": get_setting("additional_urls", "", account),
        "max_emails": get_setting("max_emails", "100", account),
        "timezone": get_setting("timezone", "America/Toronto", account),
        "blacklist": get_setting("blacklist", "", account),
    })

@app.route("/api/crawl", methods=["POST"])
def crawl():
    account = current_account()
    website_url = get_setting("website_url", "", account)
    max_pages = int(get_setting("max_crawl_pages", "10", account) or "10")
    additional_urls = [u.strip() for u in get_setting("additional_urls", "", account).split(",") if u.strip()]
    if website_url:
        content = crawl_website(website_url, max_pages, additional_urls)
        save_website_content(account, content)
    return jsonify({"crawled": True})

@app.route("/api/save_draft", methods=["POST"])
def save_draft_edit():
    from db import save_draft, get_draft
    data = request.get_json()
    gmail_id = data.get("gmail_id")
    new_body = data.get("body")
    existing = get_draft(gmail_id)
    if existing and new_body:
        save_draft(gmail_id, existing["sender"], existing["subject"], existing["body"], new_body, existing.get("thread_id", ""), existing.get("message_id", ""), existing.get("date", ""), "ready")
    return jsonify({"saved": True})

@app.route("/api/logout")
def logout():
    session.clear()
    return jsonify({"logged_out": True})

@app.route("/api/regenerate_all", methods=["POST"])
def regenerate_all():
    if not session.get("credentials"):
        return jsonify({"error": "not_connected"}), 401

    account = current_account()
    ids = session.get("drafted_email_ids", [])

    conn = get_db()
    for gmail_id in ids:
        conn.execute("UPDATE emails SET draft_reply = '', status = 'pending' WHERE gmail_id = ?", (gmail_id,))
    conn.commit()
    conn.close()

    emails = get_emails_from_db(ids)
    return jsonify({"emails": emails})

@app.route("/crawled-content")
def crawled_content():
    content = get_website_content(current_account())
    return f"<pre>{content}</pre>"

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5001)