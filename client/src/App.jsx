import { useState, useEffect } from 'react'

const API = 'http://localhost:5001'

function Settings({ onBack }) {
  const [form, setForm] = useState({
    owner_name: '', business_brief: '', whitelist: '',
    website_url: '', additional_urls: '', max_crawl_pages: '10',
    max_emails: '100'
  })
  const [message, setMessage] = useState('')
  const [crawling, setCrawling] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setForm(data))
  }, [])

  async function save() {
    await fetch(`${API}/api/settings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setMessage('✓ Settings saved!')
    setTimeout(() => setMessage(''), 3000)
  }

  async function crawl() {
    setCrawling(true)
    await fetch(`${API}/api/crawl`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    })
    setCrawling(false)
    setMessage('✓ Website crawled!')
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <span style={styles.logo}>Scribe</span>
        <button onClick={onBack} style={styles.linkBtn}>← Back to Dashboard</button>
      </div>

      <h2>Settings</h2>
      {message && <div style={styles.successMsg}>{message}</div>}

      <div style={styles.field}>
        <label style={styles.label}>Your Name</label>
        <p style={styles.hint}>Your full name, shown on the dashboard.</p>
        <input style={styles.input} value={form.owner_name} onChange={e => setForm({...form, owner_name: e.target.value})} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Business Brief</label>
        <p style={styles.hint}>Describe your business, your name, and the tone you want replies to have.</p>
        <textarea style={styles.textarea2} value={form.business_brief} onChange={e => setForm({...form, business_brief: e.target.value})} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Whitelist</label>
        <p style={styles.hint}>Comma-separated email addresses to watch. Leave empty to fetch all inbox emails.</p>
        <input style={styles.input} value={form.whitelist} onChange={e => setForm({...form, whitelist: e.target.value})} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Website URL</label>
        <p style={styles.hint}>Your business website. Click "Crawl Now" to fetch the latest content.</p>
        <input style={styles.input} value={form.website_url} onChange={e => setForm({...form, website_url: e.target.value})} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Additional Pages to Crawl</label>
        <p style={styles.hint}>Comma-separated URLs of specific pages to crawl.</p>
        <input style={styles.input} value={form.additional_urls} onChange={e => setForm({...form, additional_urls: e.target.value})} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Max Pages to Crawl</label>
        <p style={styles.hint}>How many pages of your website to crawl.</p>
        <input style={styles.input} value={form.max_crawl_pages} onChange={e => setForm({...form, max_crawl_pages: e.target.value})} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Max Emails to Fetch</label>
        <p style={styles.hint}>Maximum number of emails to fetch at once. Defaults to 100 if left blank.</p>
        <input style={styles.input} value={form.max_emails} onChange={e => setForm({...form, max_emails: e.target.value})} />
      </div>

      <div style={styles.actions}>
        <button onClick={save} style={styles.fetchBtn}>Save</button>
        <button onClick={crawl} style={styles.approveBtn} disabled={crawling}>
          {crawling ? 'Crawling...' : 'Crawl Now'}
        </button>
      </div>
    </div>
  )
}

function App() {
  const [connected, setConnected] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [emails, setEmails] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedBody, setEditedBody] = useState('')
  const [view, setView] = useState('dashboard')

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    const res = await fetch(`${API}/api/status`, { credentials: 'include' })
    const data = await res.json()
    setConnected(data.connected)
    setOwnerName(data.owner_name)
    setEmails(data.emails)
    setLoading(false)
  }

  async function fetchEmails() {
    setFetching(true)
    const res = await fetch(`${API}/api/fetch`, { credentials: 'include' })
    const data = await res.json()
    setEmails(data.emails)
    setCurrentIndex(0)
    setEditMode(false)
    setFetching(false)
  }

  async function sendEmail() {
    const email = emails[currentIndex]
    const body = editMode ? editedBody : email.draft_reply
    await fetch(`${API}/api/send`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email.sender,
        subject: email.subject,
        body,
        gmail_id: email.gmail_id,
        thread_id: email.thread_id,
        message_id: email.message_id
      })
    })
    nextEmail()
  }

  async function dismissEmail() {
    const email = emails[currentIndex]
    await fetch(`${API}/api/dismiss`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail_id: email.gmail_id })
    })
    nextEmail()
  }

  async function regenerate() {
    const email = emails[currentIndex]
    const res = await fetch(`${API}/api/regenerate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail_id: email.gmail_id })
    })
    const data = await res.json()
    const updated = emails.map((e, i) => i === currentIndex ? { ...e, draft_reply: data.email.draft_reply } : e)
    setEmails(updated)
    setEditMode(false)
  }

  function nextEmail() {
    setEditMode(false)
    setEditedBody('')
    if (currentIndex < emails.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setEmails([])
      setCurrentIndex(0)
    }
  }

  function startEdit() {
    setEditedBody(emails[currentIndex].draft_reply)
    setEditMode(true)
  }

  if (loading) return <div style={styles.center}>Loading...</div>

  if (view === 'settings') return <Settings onBack={() => { setView('dashboard'); checkStatus() }} />

  if (!connected) return (
    <div style={styles.center}>
      <h1>Scribe</h1>
      <a href={`${API}/connect`} style={styles.connectBtn}>Connect Gmail</a>
    </div>
  )

  if (fetching) return <div style={styles.center}>Fetching & generating drafts...</div>

  const email = emails[currentIndex]

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <span style={styles.logo}>Scribe</span>
        {ownerName && <span style={styles.greeting}>Hi, {ownerName}</span>}
        <div style={styles.topActions}>
          <button onClick={fetchEmails} style={styles.fetchBtn}>Fetch Emails</button>
          <button onClick={() => setView('settings')} style={styles.linkBtn}>Settings</button>
          <button onClick={async () => { await fetch(`${API}/api/logout`, { credentials: 'include' }); setConnected(false) }} style={styles.linkBtn}>Logout</button>
        </div>
      </div>

      {!email ? (
        <div style={styles.center}>
          <p>No pending emails. Hit "Fetch Emails" to check.</p>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={styles.progress}>{currentIndex + 1} of {emails.length}</div>
          <h2 style={styles.subject}>{email.subject}</h2>
          <div style={styles.meta}>From: {email.sender}</div>
          <div style={styles.meta}>{email.date}</div>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>Original</div>
            <div style={styles.original}>{email.body}</div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>Draft Reply</div>
            {editMode ? (
              <textarea
                style={styles.textarea}
                value={editedBody}
                onChange={e => setEditedBody(e.target.value)}
                autoFocus
              />
            ) : (
              <div style={styles.draft}>{email.draft_reply}</div>
            )}
          </div>

          <div style={styles.actions}>
            <button onClick={sendEmail} style={styles.approveBtn}>Approve & Send</button>
            <button onClick={dismissEmail} style={styles.dismissBtn}>Dismiss</button>
            <button onClick={regenerate} style={styles.regenBtn}>Regenerate</button>
            {editMode ? (
              <button onClick={() => setEditMode(false)} style={styles.editBtn}>Done</button>
            ) : (
              <button onClick={startEdit} style={styles.editBtn}>Edit</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { fontFamily: 'Arial, sans-serif', maxWidth: 700, margin: '0 auto', padding: '20px' },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, borderBottom: '1px solid #eee', paddingBottom: 16 },
  logo: { fontWeight: 'bold', fontSize: 20, marginRight: 'auto' },
  greeting: { color: '#666', fontSize: 14 },
  topActions: { display: 'flex', gap: 12, alignItems: 'center' },
  fetchBtn: { background: '#007bff', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: 14, padding: 0 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 16 },
  connectBtn: { background: '#28a745', color: 'white', padding: '12px 24px', borderRadius: 6, textDecoration: 'none', fontSize: 16 },
  card: { background: 'white', border: '1px solid #ddd', borderRadius: 12, padding: 32 },
  progress: { color: '#999', fontSize: 13, marginBottom: 8 },
  subject: { margin: '0 0 4px 0' },
  meta: { color: '#666', fontSize: 13, marginBottom: 4 },
  section: { marginTop: 20 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: 8 },
  original: { background: '#fff', border: '1px solid #eee', borderRadius: 6, padding: 16, whiteSpace: 'pre-wrap', fontSize: 14 },
  draft: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 6, padding: 16, whiteSpace: 'pre-wrap', fontSize: 14 },
  textarea: { width: '100%', minHeight: 150, padding: 16, background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 6, fontFamily: 'Arial, sans-serif', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' },
  textarea2: { width: '100%', minHeight: 120, padding: 10, border: '1px solid #ddd', borderRadius: 4, fontFamily: 'Arial, sans-serif', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' },
  actions: { display: 'flex', gap: 10, marginTop: 20 },
  approveBtn: { background: '#28a745', color: 'white', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 15 },
  dismissBtn: { background: '#dc3545', color: 'white', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 15 },
  regenBtn: { background: '#ffc107', color: 'black', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 15 },
  editBtn: { background: '#6c757d', color: 'white', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 15 },
  field: { marginBottom: 24 },
  label: { fontWeight: 'bold', display: 'block', marginBottom: 4 },
  hint: { color: '#666', fontSize: 13, margin: '0 0 8px 0' },
  input: { width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' },
  successMsg: { color: 'green', fontWeight: 'bold', marginBottom: 16 },
}

export default App