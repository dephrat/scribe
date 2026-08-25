# Scribe

Scribe drafts replies to incoming business email, grounded in the content of the
business's own website. It connects to a Gmail inbox, crawls the website once to
build a context document, and drafts a reply to each new email from a whitelisted
sender. Nothing is sent automatically. Every draft lands in a dashboard where a
human edits, regenerates, sends, or dismisses it.

This is the v1 prototype that proved the idea. The production version I built later
for a client is an n8n pipeline with escalation over WhatsApp, so treat this repo as
a working demo rather than a deployed service.

![The review dashboard: an incoming question, the drafted reply, and the actions a
human can take on it](docs/dashboard.png)

The draft above is the behaviour worth looking at. The sender asks three things. The
crawled site answers two of them, so the reply answers those, and on the third it says
it does not have enough detail rather than inventing an integration that may not exist.

## How it works

```
Gmail (OAuth, gmail.modify)
  |
  |  new mail from whitelisted senders
  v
Flask backend  <---- crawled website content (crawler.py -> SQLite)
  |
  |  draft_reply()  ->  Claude
  v
SQLite: email + draft, status = pending / ready / sent / dismissed
  |
  v
React dashboard: edit | regenerate | send | dismiss
  |
  v
Gmail: threaded reply, label, archive
```

Files:

- `crawler.py` walks the site, sitemap first, falling back to link discovery from the
  homepage. Strips nav, footer and scripts, caps per-page and total content.
- `ai.py` builds the prompt and calls Claude. Retries with backoff on rate limits.
- `gmail.py` OAuth, message fetch and body extraction, threaded send, labeling.
- `db.py` SQLite for email/draft rows and per-account settings.
- `app.py` Flask API, plus a server-sent-events stream so the dashboard updates as
  drafts finish.
- `client/` React + Vite dashboard.

## Grounding and guardrails

The hard part of this product is not generating text, it is not generating confident
wrong text on someone else's behalf. Two layers address it.

Mechanical, in `crawler.py`: any URL that does not belong to the business's own domain
is stripped from the crawled content before the model ever sees it. The model cannot
repeat a link it was never shown.

In the prompt, in `ai.py`, each rule targets a failure I actually hit while testing:

- Never invent a URL. Only include one if it appears verbatim in the crawled content,
  otherwise refer people to the website generally.
- Say when information is missing and suggest contacting the business directly, rather
  than guessing a price, a date, or a policy.
- Verify claims the sender makes about the business against the crawled content, and
  trust the website over the sender.
- Plain text only, no markdown. These drafts go into real emails, where `**bold**`
  shows up as asterisks.

Drafts run at `temperature=0` so the same email produces the same draft, which makes
prompt changes possible to evaluate.

The mechanical half of that is tested rather than asserted. `tests/test_grounding.py`
covers what survives a crawl: external URLs stripped, own-domain URLs kept, the
surrounding prose intact, sitemap indexes never returning their own `.xml` URLs as
pages, and the page and crawl budgets holding. The tests stub every HTTP call, so
they need no network and no API key.

The other guardrail is structural. Human review is the architecture, not a disclaimer.
There is no path in the code that sends a reply without someone pressing send, and
edit, regenerate and dismiss are first-class states rather than escape hatches. A
sender whitelist limits processing to configured addresses, which also keeps demos
from touching unrelated mail.

## Setup

Requires Python 3.10+, Node 18+, an Anthropic API key, and a Google Cloud OAuth client
with the Gmail API enabled.

```bash
pip install -r requirements.txt
cd client && npm install && cd ..
```

Put the OAuth client JSON at `credentials/credentials.json`, or point
`GOOGLE_CLIENT_SECRETS` somewhere else. Then copy the environment template and fill
in your keys:

```bash
cp .env.example .env
```

Run both processes:

```bash
python app.py          # Flask on :5001
cd client && npm run dev   # Vite on :5174
```

Open http://localhost:5174, connect the inbox, then set the website URL and the sender
whitelist in settings and run a crawl before fetching mail.

## Tests

```bash
python -m unittest discover -s tests
```

Standard library only, no test dependencies to install.

## Notes

- OAuth runs over plain HTTP for local development (`OAUTHLIB_INSECURE_TRANSPORT`).
  That is fine on localhost and not fine anywhere else.
- Credentials live in the Flask session and the crawled content in SQLite, which suits
  a single-user demo and would need real storage for anything more.
- The requested Gmail scope is `gmail.modify`, because sending, labeling and archiving
  all need it. It is broader than I would want in production.

## License

MIT. See [LICENSE](LICENSE).
