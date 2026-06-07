import { useState, useEffect, useRef } from 'react'

const API = 'http://localhost:5001'

function Settings({ onBack }) {
  const [form, setForm] = useState({
    owner_name: '', business_brief: '', whitelist: '',
    website_url: '', additional_urls: '', max_crawl_pages: '10',
    max_emails: '100', timezone: 'America/Toronto'
  })
  const [message, setMessage] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [activeSection, setActiveSection] = useState('business')

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

  const sections = [
    { id: 'business', label: 'Business Info' },
    { id: 'fetching', label: 'Fetching' },
    { id: 'display', label: 'Email Display' },
    { id: 'crawling', label: 'Web Crawling' },
  ]

  return (
    <div style={styles.settingsContainer}>
      <div style={styles.topBar}>
        <span style={styles.logo}>Scribe</span>
        <button 
          onClick={() => {
            if (crawling) {
              if (window.confirm('Crawl is in progress. Leave anyway?')) onBack()
            } else {
              onBack()
            }
          }}
          style={styles.linkBtn}
        >
          ← Back to Dashboard
        </button>
      </div>

      <div style={styles.settingsLayout}>
        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>Settings</h3>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                ...styles.sidebarItem,
                ...(activeSection === s.id ? styles.sidebarItemActive : {})
              }}
            >
              {s.label}
            </button>
          ))}
          <button onClick={save} style={{...styles.fetchBtn, marginTop: 24, width: '100%'}}>Save</button>
          {message === '✓ Settings saved!' && <div style={{...styles.successMsg, marginTop: 8}}>{message}</div>}
        </div>

        <div style={styles.settingsContent}>
          {message === '✓ Website crawled!' && <div style={styles.successMsg}>{message}</div>}

          {activeSection === 'business' && (
            <>
              <h3 style={styles.sectionHeader}>Business Info</h3>
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
            </>
          )}

          {activeSection === 'crawling' && (
            <>
              <h3 style={styles.sectionHeader}>Web Crawling</h3>
              <p style={{color: '#555', fontSize: 14, marginBottom: 24, lineHeight: 1.6}}>
                Scribe reads your website so it knows what your business does. This helps it write better, more accurate replies.
              </p>
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
                <p style={styles.hint}>Total pages to crawl across all URLs.</p>
                <input style={styles.input} value={form.max_crawl_pages} onChange={e => setForm({...form, max_crawl_pages: e.target.value})} />
              </div>
              <button onClick={crawl} style={styles.approveBtn} disabled={crawling}>
                {crawling ? 'Crawling...' : 'Crawl Now'}
              </button>
            </>
          )}

          {activeSection === 'fetching' && (
            <>
              <h3 style={styles.sectionHeader}>Fetching</h3>
              <div style={styles.field}>
                <label style={styles.label}>Whitelist</label>
                <p style={styles.hint}>Comma-separated email addresses to watch. Leave empty to fetch all inbox emails.</p>
                <input style={styles.input} value={form.whitelist} onChange={e => setForm({...form, whitelist: e.target.value})} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Blacklist</label>
                <p style={styles.hint}>Comma-separated email addresses to never fetch. Useful for blocking newsletters and spam.</p>
                <input style={styles.input} value={form.blacklist} onChange={e => setForm({...form, blacklist: e.target.value})} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Max Emails to Fetch</label>
                <p style={styles.hint}>Maximum number of emails to fetch at once. Defaults to 100 if left blank.</p>
                <input style={styles.input} value={form.max_emails} onChange={e => setForm({...form, max_emails: e.target.value})} />
              </div>
            </>
          )}

          {activeSection === 'display' && (
            <>
              <h3 style={styles.sectionHeader}>Email Display</h3>
              <div style={styles.field}>
                <label style={styles.label}>Timezone</label>
                <p style={styles.hint}>Timezone for displaying email dates.</p>
                <select style={styles.input} value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})}>
                  <option value="America/Toronto">Eastern (Toronto)</option>
                  <option value="America/Chicago">Central (Chicago)</option>
                  <option value="America/Denver">Mountain (Denver)</option>
                  <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                  <option value="America/Vancouver">Pacific (Vancouver)</option>
                  <option value="America/Halifax">Atlantic (Halifax)</option>
                  <option value="America/St_Johns">Newfoundland</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Jerusalem">Jerusalem</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </>
          )}
        </div>
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
  const [timezone, setTimezone] = useState('America/Toronto')
  const [regenerating, setRegenerating] = useState(new Set())
  const [confirmAction, setConfirmAction] = useState(null) // 'send' | 'dismiss' | 'regen'
  const eventSourceRef = useRef(null)
  const email = emails[currentIndex]
  const isGenerating = email && (!email.draft_reply || email.status === 'pending' || email.status === 'generating')

  function formatDate(dateStr, tz) {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      return date.toLocaleString('en-CA', {
        timeZone: tz,
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  function displayBody(text) {
    if (!text) return ''
    return text.replace(/https?:\/\/\S+/g, '[link]')
  }

  useEffect(() => {
    checkStatus()
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
    }
  }, [])

  useEffect(() => {
    function handleKey(e) {
      if (!email) return
      if (editMode) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (confirmAction) {
        if (e.key === 'Enter') {
          executeAction(confirmAction)
          setConfirmAction(null)
        } else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
          setConfirmAction(null)
        }
        return
      }

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setEditMode(false); setEditedBody(''); setCurrentIndex(currentIndex - 1)
      } else if (e.key === 'ArrowRight' && currentIndex < emails.length - 1) {
        setEditMode(false); setEditedBody(''); setCurrentIndex(currentIndex + 1)
      } else if (e.key === 'e' || e.key === 'E') {
        if (!isGenerating) {
          e.preventDefault()
          startEdit()
        }
      } else if (e.key === 'a' || e.key === 'A') {
        if (!isGenerating) setConfirmAction('send')
      } else if (e.key === 'd' || e.key === 'D') {
        setConfirmAction('dismiss')
      } else if (e.key === 'r' || e.key === 'R') {
        if (!isGenerating && !regenerating.has(email.gmail_id)) setConfirmAction('regen')
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [email, editMode, confirmAction, currentIndex, emails, isGenerating, regenerating])

  async function checkStatus() {
    try {
      const res = await fetch(`${API}/api/status`, { credentials: 'include' })
      const data = await res.json()
      setConnected(data.connected)
      setOwnerName(data.owner_name)
      setEmails(data.emails)

      const settingsRes = await fetch(`${API}/api/settings`, { credentials: 'include' })
      const settingsData = await settingsRes.json()
      setTimezone(settingsData.timezone || 'America/Toronto')
    } catch (e) {
      console.error('checkStatus failed:', e)
    } finally {
      setLoading(false)
    }
  }

  function connectSSE(gmailIds) {
    if (eventSourceRef.current) eventSourceRef.current.close()

    const es = new EventSource(`${API}/api/stream`, { withCredentials: true })
    eventSourceRef.current = es

    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.done) {
        es.close()
        return
      }
      setEmails(prev => prev.map(e =>
        e.gmail_id === data.gmail_id ? { ...e, draft_reply: data.draft_reply, status: data.status } : e
      ))
    }

    es.onerror = () => es.close()

    // kick off generation
    fetch(`${API}/api/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail_ids: gmailIds })
    })
  }

  async function fetchEmails() {
    setFetching(true)
    try {
      const res = await fetch(`${API}/api/fetch`, { credentials: 'include' })
      const data = await res.json()
      setEmails(data.emails)
      setCurrentIndex(0)
      setEditMode(false)

      const pendingIds = data.emails
        .filter(e => !e.draft_reply || e.status === 'pending')
        .map(e => e.gmail_id)

      if (pendingIds.length > 0) {
        connectSSE(pendingIds)
      }
    } finally {
      setFetching(false)
    }
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
    const updated = emails.filter((_, i) => i !== currentIndex)
    setEmails(updated)
    setEditMode(false)
    setEditedBody('')
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1))
    }
  }

  async function dismissEmail() {
    const email = emails[currentIndex]
    await fetch(`${API}/api/dismiss`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail_id: email.gmail_id })
    })
    const updated = emails.filter((_, i) => i !== currentIndex)
    setEmails(updated)
    setEditMode(false)
    setEditedBody('')
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1))
    }
  }

  async function regenerate() {
    const email = emails[currentIndex]
    setRegenerating(prev => new Set(prev).add(email.gmail_id))
    const res = await fetch(`${API}/api/regenerate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail_id: email.gmail_id })
    })
    const data = await res.json()
    setEmails(prev => prev.map((e, i) =>
      i === currentIndex ? { ...e, draft_reply: data.email.draft_reply, status: data.email.status } : e
    ))
    setRegenerating(prev => {
      const next = new Set(prev)
      next.delete(email.gmail_id)
      return next
    })
    setEditMode(false)
  }

  function executeAction(action) {
    if (action === 'send') sendEmail()
    else if (action === 'dismiss') dismissEmail()
    else if (action === 'regen') regenerate()
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
      <button 
        onClick={() => window.location.href = `${API}/connect`}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        style={styles.connectBtn}
      >
        Connect Gmail
      </button>
    </div>
  )

  if (fetching) return <div style={styles.center}>Fetching emails...</div>

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
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
            <button
              onClick={() => { setEditMode(false); setEditedBody(''); setCurrentIndex(currentIndex - 1) }}
              disabled={currentIndex === 0}
              style={{...styles.navBtn, opacity: currentIndex === 0 ? 0.3 : 1}}
            >←</button>
            <div style={styles.progress}>{currentIndex + 1} of {emails.length}</div>
            <button
              onClick={() => { setEditMode(false); setEditedBody(''); setCurrentIndex(currentIndex + 1) }}
              disabled={currentIndex === emails.length - 1}
              style={{...styles.navBtn, opacity: currentIndex === emails.length - 1 ? 0.3 : 1}}
            >→</button>
          </div>

          <h2 style={styles.subject}>{email.subject}</h2>
          <div style={styles.meta}>From: {email.sender}</div>
          <div style={styles.meta}>{formatDate(email.date, timezone)}</div>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>Original</div>
            <div style={styles.original}>{displayBody(email.body)}</div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>Draft Reply</div>
            {isGenerating ? (
              <div style={{...styles.draft, color: '#999', fontStyle: 'italic'}}>Generating...</div>
            ) : editMode ? (
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
            <button onClick={sendEmail} disabled={isGenerating} style={{...styles.approveBtn, opacity: isGenerating ? 0.4 : 1}}>Approve & Send</button>
            <button onClick={dismissEmail} style={styles.dismissBtn}>Dismiss</button>
            <button 
              onClick={regenerate} 
              disabled={isGenerating || regenerating.has(email.gmail_id)} 
              style={{...styles.regenBtn, opacity: (isGenerating || regenerating.has(email.gmail_id)) ? 0.4 : 1}}
            >
              {regenerating.has(email.gmail_id) ? 'Regenerating...' : 'Regenerate'}
            </button>
            
            {editMode ? (
              <button onClick={async () => {
                const updated = emails.map((e, i) => i === currentIndex ? { ...e, draft_reply: editedBody } : e)
                setEmails(updated)
                setEditMode(false)
                await fetch(`${API}/api/save_draft`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gmail_id: email.gmail_id, body: editedBody })
                })
              }} style={styles.editBtn}>Done</button>
            ) : (
              <button onClick={startEdit} disabled={isGenerating} style={{...styles.editBtn, opacity: isGenerating ? 0.4 : 1}}>Edit</button>
            )}
          </div>
          
          {confirmAction && (
            <div style={styles.confirmBar}>
              <span style={{fontSize: 14}}>
                {confirmAction === 'send' ? 'Approve & send this email?' :
                confirmAction === 'dismiss' ? 'Dismiss this email?' :
                'Regenerate draft?'}
              </span>
              <button onClick={() => { executeAction(confirmAction); setConfirmAction(null) }} style={styles.approveBtn}>
                Yes (Enter)
              </button>
              <button onClick={() => setConfirmAction(null)} style={styles.dismissBtn}>
                No (N)
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

const styles = {
  container: { fontFamily: 'Arial, sans-serif', width: 900, margin: '0 auto', padding: '20px', boxSizing: 'border-box' },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, borderBottom: '1px solid #eee', paddingBottom: 16, width: '100%', boxSizing: 'border-box' },
  logo: { fontWeight: 'bold', fontSize: 20, marginRight: 'auto' },
  greeting: { color: '#666', fontSize: 14 },
  topActions: { display: 'flex', gap: 12, alignItems: 'center' },
  fetchBtn: { background: '#007bff', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: 14, padding: 0 },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 16 },
  connectBtn: { background: '#28a745', color: 'white', padding: '12px 24px', borderRadius: 6, fontSize: 16, cursor: 'pointer', border: 'none', outline: 'none' },
  card: { background: 'white', border: '1px solid #ddd', borderRadius: 12, padding: 32 },
  progress: { color: '#999', fontSize: 13, marginBottom: 8 },
  subject: { margin: '0 0 4px 0' },
  meta: { color: '#666', fontSize: 13, marginBottom: 4 },
  section: { marginTop: 20 },
  sectionLabel: { fontSize: 12, fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: 8 },
  original: { background: '#fff', border: '1px solid #eee', borderRadius: 6, padding: 16, whiteSpace: 'pre-wrap', fontSize: 14, wordBreak: 'break-all', textAlign: 'left' },
  draft: { background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 6, padding: 16, whiteSpace: 'pre-wrap', fontSize: 14, wordBreak: 'break-all', textAlign: 'left' },
  textarea: { width: '100%', minHeight: 150, padding: 16, background: '#f9f9f9', border: '1px solid #ddd', borderRadius: 6, fontFamily: 'Arial, sans-serif', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' },
  textarea2: { width: '100%', minHeight: 120, padding: 10, border: '1px solid #ddd', borderRadius: 4, fontFamily: 'Arial, sans-serif', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' },
  actions: { display: 'flex', gap: 10, marginTop: 20 },
  approveBtn: { background: '#28a745', color: 'white', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 15 },
  dismissBtn: { background: '#dc3545', color: 'white', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 15 },
  regenBtn: { background: '#ffc107', color: 'black', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 15 },
  editBtn: { background: '#6c757d', color: 'white', border: 'none', borderRadius: 4, padding: '10px 20px', cursor: 'pointer', fontSize: 15 },
  navBtn: { background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 18 },
  field: { marginBottom: 24 },
  label: { fontWeight: 'bold', display: 'block', marginBottom: 4 },
  hint: { color: '#666', fontSize: 13, margin: '0 0 8px 0' },
  input: { width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' },
  successMsg: { color: 'green', fontWeight: 'bold', marginBottom: 16 },
  settingsSection: { borderTop: '1px solid #eee', paddingTop: 24, marginTop: 24 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  inlineSuccess: { marginLeft: 12, color: 'green', fontSize: 14 },
  sidebarTitle: { fontSize: 13, fontWeight: 'bold', color: '#999', textTransform: 'uppercase', marginBottom: 12 },
  sidebarItem: { background: 'none', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#333', width: '100%', textAlign: 'left' },
  sidebarItemActive: { background: '#e8f0fe', fontWeight: 'bold', color: '#1a56db' },
  settingsContainer: { fontFamily: 'Arial, sans-serif', width: 900, margin: '0 auto', padding: '20px', boxSizing: 'border-box' },
  settingsLayout: { display: 'grid', gridTemplateColumns: '180px 1fr', gap: 32, marginTop: 16 },
  sidebar: { width: 180 },
  settingsContent: { minWidth: 0 },
  confirmBar: { marginTop: 20, padding: 16, background: '#f0f4ff', border: '1px solid #c7d7ff', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 },
}

export default App