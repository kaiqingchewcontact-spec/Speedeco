'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUser, useClerk, SignInButton, UserButton } from '@clerk/nextjs'

type InputMode = 'text' | 'url'
type AppState = 'input' | 'configure' | 'detecting' | 'generating' | 'output' | 'history'
type ViewMode = 'carousel' | 'grid'

interface Slide {
  role: string
  headline: string
  subtext: string
  slideNumber: number
}

interface SavedDeck {
  id: string
  title: string
  arc_id: string
  format: string
  tone: string
  slide_count: number
  slides: Slide[]
  created_at: string
}

const ARCS = [
  { id: 'problem-insight-reframe', label: 'Problem → Insight → Reframe', desc: 'Surfaces tension, delivers a sharp insight, reframes worldview', roles: ['hook', 'problem', 'insight', 'reframe', 'cta'] },
  { id: 'narrative-arc', label: 'Narrative Arc', desc: 'Story-driven with emotional momentum', roles: ['opening', 'context', 'tension', 'climax', 'resolution'] },
  { id: 'concept-proof', label: 'Concept → Proof → So What', desc: 'Stakes a bold claim, proves it, lands the implication', roles: ['claim', 'concept', 'proof1', 'proof2', 'sowhat'] },
  { id: 'listicle', label: 'Listicle Flow', desc: 'Numbered tips with strong opener and closer', roles: ['hook', 'point1', 'point2', 'point3', 'point4', 'takeaway'] },
  { id: 'educational', label: 'Educational', desc: 'Concept → Explanation → Example → Takeaway', roles: ['hook', 'concept', 'explanation', 'example', 'takeaway'] },
] as const

const FORMATS = [
  { id: 'minimal', label: 'Minimal', desc: 'Headline only — bold and clean' },
  { id: 'standard', label: 'Standard', desc: 'Headline + supporting line' },
  { id: 'detailed', label: 'Detailed', desc: 'Headline + paragraph' },
] as const

const TONES = [
  { id: 'sharp', label: 'Sharp & Authoritative' },
  { id: 'conversational', label: 'Warm & Conversational' },
  { id: 'provocative', label: 'Provocative & Bold' },
  { id: 'reflective', label: 'Reflective & Thoughtful' },
] as const

const ROLE_LABELS: Record<string, string> = {
  hook: 'Hook', problem: 'Problem', insight: 'Insight', reframe: 'Reframe', cta: 'CTA',
  opening: 'Opening', context: 'Context', tension: 'Tension', climax: 'Climax', resolution: 'Resolution',
  claim: 'Claim', concept: 'Concept', proof1: 'Proof', proof2: 'Evidence', sowhat: 'So What',
  point1: 'Point 1', point2: 'Point 2', point3: 'Point 3', point4: 'Point 4', takeaway: 'Takeaway',
  explanation: 'Explanation', example: 'Example',
}

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [appState, setAppState] = useState<AppState>('input')
  const [selectedArc, setSelectedArc] = useState('problem-insight-reframe')
  const [selectedFormat, setSelectedFormat] = useState('standard')
  const [selectedTone, setSelectedTone] = useState('sharp')
  const [slideCount, setSlideCount] = useState(5)
  const [slides, setSlides] = useState<Slide[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('carousel')

  const { user, isSignedIn } = useUser()
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadingDecks, setLoadingDecks] = useState(false)

  // Editor theme state
  const [editorTheme, setEditorTheme] = useState('editorial')
  const [headlineSize, setHeadlineSize] = useState(3) // 1-5 scale
  const [subtextSize, setSubtextSize] = useState(2) // 1-5 scale

  const touchStartRef = useRef<number | null>(null)

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  // Keyboard navigation for carousel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (appState !== 'output' || viewMode !== 'carousel') return
      if (e.key === 'ArrowRight' && currentSlide < slides.length - 1) setCurrentSlide(c => c + 1)
      if (e.key === 'ArrowLeft' && currentSlide > 0) setCurrentSlide(c => c - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentSlide, slides.length, appState, viewMode])

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return
    const diff = touchStartRef.current - e.changedTouches[0].clientX
    if (diff > 50 && currentSlide < slides.length - 1) setCurrentSlide(c => c + 1)
    if (diff < -50 && currentSlide > 0) setCurrentSlide(c => c - 1)
    touchStartRef.current = null
  }

  // ── Step: Fetch URL content ──
  async function handleFetchUrl(): Promise<string | null> {
    if (!url.trim()) return null
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setContent(data.text)
      return data.text
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError('Could not fetch URL: ' + msg)
      return null
    }
  }

  // ── Step: Proceed to configure ──
  function proceedToConfigure() {
    if (inputMode === 'text' && wordCount < 20) return
    if (inputMode === 'url' && !url.trim()) return
    setError(null)
    setAppState('configure')
  }

  // ── Step: Generate slides ──
  async function handleGenerate() {
    setAppState('generating')
    setError(null)

    try {
      // If URL mode and no content yet, fetch first
      let finalContent = content
      if (inputMode === 'url' && !content) {
        const fetched = await handleFetchUrl()
        if (!fetched) {
          setAppState('configure')
          return
        }
        finalContent = fetched
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          content: finalContent,
          arcId: selectedArc,
          format: selectedFormat,
          tone: selectedTone,
          slideCount,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error + (data.detail ? ' — ' + JSON.stringify(data.detail) : '') + (data.debug ? ' | Debug: ' + data.debug : ''))
      if (!data.slides || !Array.isArray(data.slides)) throw new Error('No slides returned. Response: ' + JSON.stringify(data).slice(0, 200))
      setSlides(data.slides)
      setCurrentSlide(0)
      setAppState('output')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError('Generation failed: ' + msg)
      setAppState('configure')
    }
  }

  function copySlide(slide: Slide, index: number) {
    const text = slide.subtext ? `${slide.headline}\n\n${slide.subtext}` : slide.headline
    // Try modern clipboard API first, fallback to execCommand
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
    } else {
      fallbackCopy(text)
    }
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  function fallbackCopy(text: string) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }

  function copyAll() {
    const text = slides.map((s, i) =>
      `— Slide ${i + 1} (${ROLE_LABELS[s.role] || s.role}) —\n${s.headline}${s.subtext ? '\n' + s.subtext : ''}`
    ).join('\n\n')
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
    } else {
      fallbackCopy(text)
    }
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  // ── Save deck to Supabase ──
  async function handleSaveDeck() {
    if (!isSignedIn) return
    setSaving(true)
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: slides[0]?.headline?.slice(0, 60) || 'Untitled Deck',
          source_content: content,
          source_url: url || undefined,
          arc_id: selectedArc,
          format: selectedFormat,
          tone: selectedTone,
          slides,
          slide_count: slides.length,
        }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Load saved decks ──
  async function loadDecks() {
    if (!isSignedIn) return
    setLoadingDecks(true)
    try {
      const res = await fetch('/api/decks')
      const data = await res.json()
      if (data.decks) setSavedDecks(data.decks)
    } catch (err) {
      console.error('Load failed:', err)
    } finally {
      setLoadingDecks(false)
    }
  }

  // ── Delete a deck ──
  async function handleDeleteDeck(deckId: string) {
    try {
      await fetch(`/api/decks?id=${deckId}`, { method: 'DELETE' })
      setSavedDecks(prev => prev.filter(d => d.id !== deckId))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // ── Open a saved deck ──
  function openDeck(deck: SavedDeck) {
    setSlides(deck.slides)
    setSelectedArc(deck.arc_id)
    setSelectedFormat(deck.format)
    setSelectedTone(deck.tone)
    setSlideCount(deck.slide_count)
    setCurrentSlide(0)
    setAppState('output')
  }

  // ── Show history ──
  function showHistory() {
    loadDecks()
    setAppState('history')
  }

  function reset() {
    setAppState('input')
    setContent('')
    setUrl('')
    setSlides([])
    setSelectedArc('problem-insight-reframe')
    setSelectedFormat('standard')
    setSelectedTone('sharp')
    setSlideCount(5)
    setCurrentSlide(0)
    setError(null)
  }

  const arcLabel = ARCS.find(a => a.id === selectedArc)?.label || ''
  const toneLabel = TONES.find(t => t.id === selectedTone)?.label || ''

  // Editor themes
  const THEMES: Record<string, { name: string; bg: string; fg: string; muted: string; headlineFont: string; bodyFont: string; accent: string }> = {
    editorial: { name: 'Editorial', bg: '#0f0e0c', fg: '#f5f2ed', muted: 'rgba(245,242,237,0.4)', headlineFont: "'Instrument Serif', serif", bodyFont: "'Syne', sans-serif", accent: '#c8522a' },
    mono: { name: 'Monospace', bg: '#1a1a2e', fg: '#e0e0e0', muted: 'rgba(224,224,224,0.4)', headlineFont: "'DM Mono', monospace", bodyFont: "'DM Mono', monospace", accent: '#4ecca3' },
    bold: { name: 'Bold', bg: '#ffffff', fg: '#111111', muted: 'rgba(17,17,17,0.4)', headlineFont: "'Syne', sans-serif", bodyFont: "'Syne', sans-serif", accent: '#ff4444' },
    warm: { name: 'Warm', bg: '#2c1810', fg: '#f0d9c0', muted: 'rgba(240,217,192,0.4)', headlineFont: "'Instrument Serif', serif", bodyFont: "'Syne', sans-serif", accent: '#d4956a' },
    clean: { name: 'Clean', bg: '#f8f8f8', fg: '#222222', muted: 'rgba(34,34,34,0.35)', headlineFont: "'Syne', sans-serif", bodyFont: "'DM Mono', monospace", accent: '#2563eb' },
    noir: { name: 'Noir', bg: '#000000', fg: '#ffffff', muted: 'rgba(255,255,255,0.3)', headlineFont: "'Instrument Serif', serif", bodyFont: "'DM Mono', monospace", accent: '#ffffff' },
    paper: { name: 'Paper', bg: '#f5f0e8', fg: '#1a1612', muted: 'rgba(26,22,18,0.4)', headlineFont: "'Instrument Serif', serif", bodyFont: "'Syne', sans-serif", accent: '#8b5e3c' },
  }
  const theme = THEMES[editorTheme] || THEMES.editorial

  const HSIZES = ['clamp(1rem, 3vw, 1.3rem)', 'clamp(1.2rem, 3.5vw, 1.6rem)', 'clamp(1.4rem, 4vw, 2rem)', 'clamp(1.7rem, 5vw, 2.5rem)', 'clamp(2rem, 6vw, 3rem)']
  const SSIZES = ['0.7rem', '0.8rem', '0.9rem', '1rem', '1.1rem']

  function updateSlideText(index: number, field: 'headline' | 'subtext', value: string) {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* ─── HEADER ─── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '1.1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'var(--paper)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
          <span
            onClick={reset}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              letterSpacing: '-0.02em',
              cursor: 'pointer',
            }}
          >
            Speedeco
          </span>
          <span style={{
            fontSize: '0.65rem',
            color: 'var(--muted)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            narrative ai
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a href="/blog" style={{
            fontSize: '0.75rem',
            color: 'var(--muted)',
            textDecoration: 'none',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}>
            Blog
          </a>
          <a href="/pricing" style={{
            fontSize: '0.75rem',
            color: 'var(--muted)',
            textDecoration: 'none',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}>
            Pricing
          </a>
          {appState !== 'input' && (
            <button onClick={reset} className="btn" style={{
              fontSize: '0.75rem',
              color: 'var(--muted)',
              background: 'none',
              border: '1px solid var(--border)',
              padding: '0.4rem 1rem',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
            }}>
              Start over
            </button>
          )}
          {isSignedIn && (
            <button onClick={showHistory} className="btn" style={{
              fontSize: '0.75rem',
              color: 'var(--muted)',
              background: 'none',
              border: '1px solid var(--border)',
              padding: '0.4rem 1rem',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.04em',
            }}>
              My Decks
            </button>
          )}
          {isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button className="btn" style={{
                fontSize: '0.75rem',
                color: 'var(--paper)',
                background: 'var(--ink)',
                border: 'none',
                padding: '0.4rem 1rem',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.04em',
                borderRadius: '6px',
                cursor: 'pointer',
              }}>
                Sign in
              </button>
            </SignInButton>
          )}
        </div>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>

        {/* ═══════════ INPUT STATE ═══════════ */}
        {appState === 'input' && (
          <div className="fade-up">
            <div style={{ marginBottom: '2.5rem' }}>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                marginBottom: '0.75rem',
              }}>
                Turn any text into a presentation<br />
                <em>worth sharing.</em>
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Articles, transcripts, or messy notes — our Narrative AI preserves your thinking while handling the design. Paste anything. Get a deck in seconds.
              </p>
              {/* Trust line */}
              <p style={{ color: 'var(--muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginTop: '0.75rem', letterSpacing: '0.04em' }}>
                No signup required · Takes 30 seconds · Export to PPT / PDF
              </p>
            </div>

            {/* Mode Toggle */}
            <div style={{
              display: 'flex',
              marginBottom: '1rem',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              overflow: 'hidden',
              width: 'fit-content',
            }}>
              {(['text', 'url'] as InputMode[]).map(mode => (
                <button key={mode} onClick={() => setInputMode(mode)} className="btn" style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.75rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  background: inputMode === mode ? 'var(--ink)' : 'transparent',
                  color: inputMode === mode ? 'var(--paper)' : 'var(--muted)',
                  border: 'none',
                }}>
                  {mode}
                </button>
              ))}
            </div>

            {inputMode === 'text' ? (
              <div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Paste your essay, rough notes, conversation transcript, or just describe a concept..."
                  rows={8}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.92rem',
                    lineHeight: 1.7,
                    color: 'var(--ink)',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    {wordCount} words {wordCount < 20 && wordCount > 0 ? '· need 20+' : ''}
                  </span>
                  <button
                    onClick={proceedToConfigure}
                    disabled={wordCount < 20}
                    className="btn"
                    style={{
                      background: wordCount >= 20 ? 'var(--ink)' : 'var(--border)',
                      color: wordCount >= 20 ? 'var(--paper)' : 'var(--muted)',
                      border: 'none',
                      padding: '0.75rem 2rem',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      borderRadius: '6px',
                      cursor: wordCount >= 20 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Configure slides →
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://..."
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1rem 1.25rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    color: 'var(--ink)',
                    outline: 'none',
                    marginBottom: '0.75rem',
                  }}
                  onKeyDown={e => e.key === 'Enter' && proceedToConfigure()}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={proceedToConfigure}
                    disabled={!url.trim()}
                    className="btn"
                    style={{
                      background: url.trim() ? 'var(--ink)' : 'var(--border)',
                      color: url.trim() ? 'var(--paper)' : 'var(--muted)',
                      border: 'none',
                      padding: '0.75rem 2rem',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      cursor: url.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Configure slides →
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                ⚠ {error}
              </p>
            )}

            {/* Hints grid */}
            <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {[
                { label: 'Essays → Key insight slides', hint: 'Articles, blog posts, LinkedIn' },
                { label: 'Messy notes → Clear takeaways', hint: 'Brain dumps, voice-to-text' },
                { label: 'Transcripts → Action items', hint: 'Meeting recordings, chat exports' },
                { label: 'URLs → Executive summaries', hint: 'Articles, threads, newsletters' },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '0.8rem 1rem',
                  background: 'var(--surface)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.15rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.4 }}>{item.hint}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ CONFIGURE STATE ═══════════ */}
        {appState === 'configure' && (
          <div className="fade-up">
            <div style={{ marginBottom: '2rem' }}>
              <p style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '0.4rem',
              }}>
                Step 2
              </p>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.75rem',
                letterSpacing: '-0.02em',
              }}>
                Configure your deck
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: '0.4rem' }}>
                Shape the structure before we write.
              </p>
            </div>

            {/* Story Arc */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                marginBottom: '0.75rem',
              }}>
                Story Arc
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ARCS.map((arc, i) => (
                  <div
                    key={arc.id}
                    className={`option-card fade-up stagger-${Math.min(i + 1, 5)}`}
                    onClick={() => setSelectedArc(arc.id)}
                    style={{
                      padding: '1rem 1.15rem',
                      background: selectedArc === arc.id ? 'var(--ink)' : 'var(--surface)',
                      color: selectedArc === arc.id ? 'var(--paper)' : 'var(--ink)',
                      border: `1px solid ${selectedArc === arc.id ? 'var(--ink)' : 'var(--border)'}`,
                      borderRadius: '8px',
                      opacity: 0,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.15rem' }}>{arc.label}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.6, lineHeight: 1.4 }}>{arc.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Slide Format */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                marginBottom: '0.75rem',
              }}>
                Slide Format
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {FORMATS.map(fmt => (
                  <div
                    key={fmt.id}
                    className="option-card"
                    onClick={() => setSelectedFormat(fmt.id)}
                    style={{
                      padding: '0.8rem 1.1rem',
                      background: selectedFormat === fmt.id ? 'var(--ink)' : 'var(--surface)',
                      color: selectedFormat === fmt.id ? 'var(--paper)' : 'var(--ink)',
                      border: `1px solid ${selectedFormat === fmt.id ? 'var(--ink)' : 'var(--border)'}`,
                      borderRadius: '8px',
                      flex: '1 1 140px',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.1rem' }}>{fmt.label}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{fmt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Number of Slides */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                marginBottom: '0.75rem',
              }}>
                Number of Slides
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>3</span>
                <input
                  type="range"
                  min={3}
                  max={12}
                  value={slideCount}
                  onChange={e => setSlideCount(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>12</span>
              </div>
              <div style={{
                textAlign: 'center',
                marginTop: '0.4rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--accent)',
              }}>
                {slideCount} slides
              </div>
            </div>

            {/* Tone of Voice */}
            <div style={{ marginBottom: '2.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                marginBottom: '0.75rem',
              }}>
                Tone of Voice
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {TONES.map(tone => (
                  <div
                    key={tone.id}
                    className="option-card"
                    onClick={() => setSelectedTone(tone.id)}
                    style={{
                      padding: '0.65rem 1rem',
                      background: selectedTone === tone.id ? 'var(--ink)' : 'transparent',
                      color: selectedTone === tone.id ? 'var(--paper)' : 'var(--ink)',
                      border: `1px solid ${selectedTone === tone.id ? 'var(--ink)' : 'var(--border)'}`,
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                    }}
                  >
                    {tone.label}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p style={{ marginBottom: '1rem', color: 'var(--accent)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                ⚠ {error}
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setAppState('input')} className="btn" style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}>
                ← Edit content
              </button>
              <button onClick={handleGenerate} className="btn" style={{
                background: 'var(--ink)',
                color: 'var(--paper)',
                border: 'none',
                padding: '0.85rem 2.5rem',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                borderRadius: '6px',
                letterSpacing: '0.02em',
              }}>
                Generate deck →
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ GENERATING STATE ═══════════ */}
        {(appState === 'detecting' || appState === 'generating') && (
          <div className="fade-up" style={{ textAlign: 'center', padding: '6rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '1.5rem' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="thinking-dot" style={{
                  width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ink)',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              color: 'var(--muted)',
              fontStyle: 'italic',
            }}>
              {appState === 'detecting' ? 'Reading your content...' : 'Writing your slides...'}
            </p>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--muted)',
              marginTop: '0.5rem',
              fontFamily: 'var(--font-mono)',
            }}>
              {arcLabel} · {slideCount} slides · {toneLabel}
            </p>
          </div>
        )}

        {/* ═══════════ OUTPUT STATE — SLIDE EDITOR ═══════════ */}
        {appState === 'output' && (
          <div className="fade-up">
            {/* Editor toolbar */}
            <div style={{
              marginBottom: '1rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              flexWrap: 'wrap', gap: '0.75rem',
            }}>
              <div>
                <p style={{
                  fontSize: '0.6rem', fontFamily: 'var(--font-mono)',
                  color: 'var(--accent)', textTransform: 'uppercase',
                  letterSpacing: '0.1em', marginBottom: '0.15rem',
                }}>
                  {slides.length} slides · {THEMES[editorTheme].name} theme
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '-0.02em' }}>
                  {arcLabel}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button onClick={copyAll} className="btn" style={{
                  background: copiedAll ? 'var(--accent)' : 'var(--ink)',
                  color: 'var(--paper)', border: 'none',
                  padding: '0.5rem 1rem', fontSize: '0.7rem',
                  fontFamily: 'var(--font-body)', fontWeight: 600, borderRadius: '6px',
                }}>
                  {copiedAll ? 'Copied ✓' : 'Copy all'}
                </button>
                <button onClick={() => setViewMode(v => v === 'carousel' ? 'grid' : 'carousel')}
                  className="btn" style={{
                    background: 'none', color: 'var(--muted)', border: '1px solid var(--border)',
                    padding: '0.5rem 0.85rem', fontSize: '0.7rem',
                    fontFamily: 'var(--font-mono)', borderRadius: '6px',
                  }}>
                  {viewMode === 'carousel' ? 'Grid' : 'Carousel'}
                </button>
              </div>
            </div>

            {/* Theme + Font Controls */}
            <div style={{
              padding: '0.75rem', marginBottom: '1rem',
              border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)',
            }}>
              <div style={{ marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Theme</span>
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {Object.entries(THEMES).map(([key, t]) => (
                    <button key={key} onClick={() => setEditorTheme(key)} className="btn" style={{
                      padding: '0.3rem 0.6rem', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', borderRadius: '5px',
                      border: editorTheme === key ? `2px solid ${t.accent}` : '1px solid var(--border)',
                      background: t.bg, color: t.fg, cursor: 'pointer', letterSpacing: '0.02em',
                    }}>{t.name}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Headline size</span>
                  <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.25rem' }}>
                    {[1,2,3,4,5].map((s) => (
                      <button key={s} onClick={() => setHeadlineSize(s)} className="btn" style={{
                        width: '28px', height: '24px', fontSize: '0.6rem', fontFamily: 'var(--font-mono)', borderRadius: '4px',
                        border: headlineSize === s ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: headlineSize === s ? 'var(--ink)' : 'transparent',
                        color: headlineSize === s ? 'var(--paper)' : 'var(--muted)', cursor: 'pointer',
                      }}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subtext size</span>
                  <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.25rem' }}>
                    {[1,2,3,4,5].map((s) => (
                      <button key={s} onClick={() => setSubtextSize(s)} className="btn" style={{
                        width: '28px', height: '24px', fontSize: '0.6rem', fontFamily: 'var(--font-mono)', borderRadius: '4px',
                        border: subtextSize === s ? '2px solid var(--accent)' : '1px solid var(--border)',
                        background: subtextSize === s ? 'var(--ink)' : 'transparent',
                        color: subtextSize === s ? 'var(--paper)' : 'var(--muted)', cursor: 'pointer',
                      }}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel View */}
            {viewMode === 'carousel' && (
              <div>
                <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
                  style={{ overflow: 'hidden', borderRadius: '12px', marginBottom: '1rem' }}>
                  <div className="carousel-track" style={{ display: 'flex', transform: `translateX(-${currentSlide * 100}%)` }}>
                    {slides.map((slide, i) => (
                      <div key={i} style={{
                        minWidth: '100%', aspectRatio: '1 / 1', background: theme.bg, color: theme.fg,
                        padding: 'clamp(1.5rem, 5vw, 3rem)', display: 'flex', flexDirection: 'column',
                        justifyContent: 'space-between', transition: 'background 0.3s ease',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.55rem', fontFamily: theme.bodyFont, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.muted }}>
                            {ROLE_LABELS[slide.role] || slide.role}
                          </span>
                          <span style={{ fontSize: '0.55rem', fontFamily: theme.bodyFont, color: theme.muted }}>
                            {i + 1}/{slides.length}
                          </span>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div contentEditable suppressContentEditableWarning
                            onBlur={(e) => updateSlideText(i, 'headline', e.currentTarget.textContent || '')}
                            style={{
                              fontFamily: theme.headlineFont, fontSize: HSIZES[headlineSize - 1],
                              lineHeight: 1.2, letterSpacing: '-0.02em',
                              marginBottom: slide.subtext ? '0.75rem' : 0,
                              outline: 'none', cursor: 'text',
                              borderBottom: '1px solid transparent', transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = theme.accent }}
                            onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'transparent' }}>
                            {slide.headline}
                          </div>
                          {slide.subtext && (
                            <div contentEditable suppressContentEditableWarning
                              onBlur={(e) => updateSlideText(i, 'subtext', e.currentTarget.textContent || '')}
                              style={{
                                fontSize: SSIZES[subtextSize - 1], lineHeight: 1.5, color: theme.muted,
                                fontFamily: theme.bodyFont, outline: 'none', cursor: 'text',
                                borderBottom: '1px solid transparent', transition: 'border-color 0.2s',
                              }}
                              onFocus={(e) => { e.currentTarget.style.borderColor = theme.accent }}
                              onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'transparent' }}>
                              {slide.subtext}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.5rem', color: theme.muted, fontFamily: theme.bodyFont }}>click text to edit</span>
                          <button onClick={() => copySlide(slide, i)} className="btn" style={{
                            fontSize: '0.55rem', fontFamily: theme.bodyFont, color: theme.muted,
                            background: 'none', border: `1px solid ${theme.muted}`,
                            padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer',
                          }}>{copiedIndex === i ? '✓ copied' : 'copy'}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Dots + arrows */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => setCurrentSlide(c => Math.max(0, c - 1))} disabled={currentSlide === 0}
                    className="btn" style={{ background: 'none', border: 'none', fontSize: '1.2rem',
                      color: currentSlide === 0 ? 'var(--border)' : 'var(--ink)',
                      cursor: currentSlide === 0 ? 'default' : 'pointer', padding: '0.25rem 0.5rem' }}>‹</button>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {slides.map((_, i) => (
                      <div key={i} onClick={() => setCurrentSlide(i)} style={{
                        width: currentSlide === i ? '20px' : '6px', height: '6px', borderRadius: '3px',
                        background: currentSlide === i ? 'var(--ink)' : 'var(--border)',
                        cursor: 'pointer', transition: 'all 0.2s ease',
                      }} />
                    ))}
                  </div>
                  <button onClick={() => setCurrentSlide(c => Math.min(slides.length - 1, c + 1))}
                    disabled={currentSlide === slides.length - 1} className="btn"
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem',
                      color: currentSlide === slides.length - 1 ? 'var(--border)' : 'var(--ink)',
                      cursor: currentSlide === slides.length - 1 ? 'default' : 'pointer', padding: '0.25rem 0.5rem' }}>›</button>
                </div>
              </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {slides.map((slide, i) => (
                  <div key={i} style={{
                    aspectRatio: '1 / 1', background: theme.bg, color: theme.fg,
                    borderRadius: '10px', overflow: 'hidden', padding: 'clamp(1rem, 3vw, 1.5rem)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.5rem', fontFamily: theme.bodyFont, textTransform: 'uppercase', letterSpacing: '0.1em', color: theme.muted }}>
                        {ROLE_LABELS[slide.role] || slide.role}
                      </span>
                      <span style={{ fontSize: '0.5rem', fontFamily: theme.bodyFont, color: theme.muted }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div contentEditable suppressContentEditableWarning
                        onBlur={(e) => updateSlideText(i, 'headline', e.currentTarget.textContent || '')}
                        style={{
                          fontFamily: theme.headlineFont, fontSize: `calc(${HSIZES[headlineSize - 1]} * 0.75)`,
                          lineHeight: 1.2, letterSpacing: '-0.02em',
                          marginBottom: slide.subtext ? '0.5rem' : 0, outline: 'none', cursor: 'text',
                        }}>{slide.headline}</div>
                      {slide.subtext && (
                        <div contentEditable suppressContentEditableWarning
                          onBlur={(e) => updateSlideText(i, 'subtext', e.currentTarget.textContent || '')}
                          style={{
                            fontSize: `calc(${SSIZES[subtextSize - 1]} * 0.85)`, lineHeight: 1.4,
                            color: theme.muted, fontFamily: theme.bodyFont, outline: 'none', cursor: 'text',
                          }}>{slide.subtext}</div>
                      )}
                    </div>
                    <button onClick={() => copySlide(slide, i)} className="btn" style={{
                      alignSelf: 'flex-end', fontSize: '0.5rem', fontFamily: theme.bodyFont,
                      color: copiedIndex === i ? theme.accent : theme.muted,
                      background: 'none', border: `1px solid ${theme.muted}`,
                      padding: '0.15rem 0.4rem', borderRadius: '3px', cursor: 'pointer',
                    }}>{copiedIndex === i ? '✓ copied' : 'copy'}</button>
                  </div>
                ))}
              </div>
            )}

            {/* Action row */}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {isSignedIn && (
                <button onClick={handleSaveDeck} disabled={saving || saved} className="btn" style={{
                  background: saved ? 'var(--accent)' : 'var(--ink)', border: 'none', color: 'var(--paper)',
                  padding: '0.55rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                  borderRadius: '6px', letterSpacing: '0.04em', cursor: saving ? 'wait' : 'pointer',
                }}>{saved ? '✓ Saved' : saving ? 'Saving...' : '♡ Save deck'}</button>
              )}
              {!isSignedIn && (
                <SignInButton mode="modal">
                  <button className="btn" style={{
                    background: 'var(--ink)', border: 'none', color: 'var(--paper)',
                    padding: '0.55rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                    borderRadius: '6px', letterSpacing: '0.04em', cursor: 'pointer',
                  }}>Sign in to save</button>
                </SignInButton>
              )}
              <button onClick={handleGenerate} className="btn" style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
                padding: '0.55rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                borderRadius: '6px', letterSpacing: '0.04em',
              }}>↺ Regenerate</button>
              <button onClick={() => { setAppState('configure'); setSlides([]) }} className="btn" style={{
                background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
                padding: '0.55rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                borderRadius: '6px', letterSpacing: '0.04em',
              }}>← Reconfigure</button>
            </div>
          </div>
        )}

        {/* ═══════════ HISTORY STATE ═══════════ */}
        {appState === 'history' && (
          <div className="fade-up">
            <div style={{ marginBottom: '2rem' }}>
              <p style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '0.4rem',
              }}>
                Library
              </p>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.75rem',
                letterSpacing: '-0.02em',
              }}>
                My Decks
              </h2>
            </div>

            {loadingDecks ? (
              <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '1rem' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="thinking-dot" style={{
                      width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ink)',
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading your decks...</p>
              </div>
            ) : savedDecks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <p style={{ color: 'var(--muted)', fontSize: '0.92rem', marginBottom: '1rem' }}>
                  No saved decks yet.
                </p>
                <button onClick={reset} className="btn" style={{
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  border: 'none',
                  padding: '0.75rem 2rem',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}>
                  Create your first deck →
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {savedDecks.map((deck, i) => (
                  <div
                    key={deck.id}
                    className="fade-up"
                    style={{
                      animationDelay: `${i * 0.04}s`,
                      opacity: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '1rem 1.15rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div
                      onClick={() => openDeck(deck)}
                      style={{ flex: 1, cursor: 'pointer' }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.2rem' }}>
                        {deck.title}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {ARCS.find(a => a.id === deck.arc_id)?.label || deck.arc_id} · {deck.slide_count} slides · {new Date(deck.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id) }}
                      className="btn"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        color: 'var(--muted)',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.65rem',
                        fontFamily: 'var(--font-mono)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BELOW FOLD — ONLY ON INPUT STATE ═══ */}
      {appState === 'input' && (
        <>
          {/* ── Output Gallery ── */}
          <section style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                See what Speedeco creates
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', maxWidth: '420px', margin: '0 auto' }}>
                Real examples from real content. No templates — just your thinking, structured into slides.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {[
                { input: '2,000-word blog post', output: '6-slide narrative deck', title: 'The Essay', detail: '"Why Remote Work Needs Async Communication" → Problem statement, 3 frameworks, conclusion with CTA' },
                { input: '45-min Zoom transcript', output: 'Executive summary deck', title: 'The Transcript', detail: 'Client meeting recording → Decisions made, action items, owners assigned' },
                { input: 'Voice-to-text brain dump', output: 'Prioritized roadmap', title: 'The Brain Dump', detail: 'Q3 strategy ramble → Timeline, resource allocation, key milestones' },
              ].map((ex) => (
                <div key={ex.title} style={{
                  background: 'var(--ink)', color: 'var(--paper)', borderRadius: '10px',
                  padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                }}>
                  <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{ex.title}</span>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(245,242,237,0.4)', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>Input: {ex.input}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>Output: {ex.output}</p>
                  </div>
                  <p style={{ fontSize: '0.8rem', lineHeight: 1.5, color: 'rgba(245,242,237,0.7)' }}>{ex.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── How it works ── */}
          <section style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 1.5rem 3rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontStyle: 'italic', textAlign: 'center', marginBottom: '2rem' }}>
              From chaos to clarity in three steps
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              {[
                { num: '01', label: 'Dump', desc: 'Paste a URL, upload a document, or drop in rough notes. We accept text, PDFs, even chat transcripts.' },
                { num: '02', label: 'Structure', desc: 'Our AI identifies your narrative arc — key arguments, supporting points, conclusions — then maps them to slide logic.' },
                { num: '03', label: 'Polish', desc: 'Get presentation-ready slides with smart layouts and consistent typography. Edit in-browser or export to PowerPoint.' },
              ].map((step) => (
                <div key={step.num} style={{ background: 'var(--paper)', padding: '1.25rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--accent)', letterSpacing: '0.06em' }}>{step.num}</span>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontStyle: 'italic', margin: '0.3rem 0 0.2rem' }}>{step.label}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Use cases ── */}
          <section style={{ background: 'var(--surface)', padding: '3rem 1.5rem' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontStyle: 'italic', textAlign: 'center', marginBottom: '2rem' }}>
                Built for how modern teams actually work
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { title: 'For Founders', desc: 'Turn investor updates and pivot narratives into board-ready presentations without losing the plot.' },
                  { title: 'For Consultants', desc: 'Transform client discovery transcripts into structured recommendations in minutes, not hours.' },
                  { title: 'For Marketers', desc: 'Repurpose long-form content into slide decks for LinkedIn, SlideShare, and sales enablement.' },
                  { title: 'For Educators', desc: 'Convert lecture notes or research papers into digestible lesson decks for students.' },
                ].map((uc) => (
                  <div key={uc.title} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--paper)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontStyle: 'italic', marginBottom: '0.3rem' }}>{uc.title}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>{uc.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Comparison ── */}
          <section style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontStyle: 'italic', textAlign: 'center', marginBottom: '0.5rem' }}>
              Presentation tools design slides. We design narratives.
            </h2>
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
              Gamma helps you make slides. Speedeco helps you make your case.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '0.7rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Others</div>
              <div style={{ padding: '0.7rem 1rem', background: 'var(--ink)', borderBottom: '1px solid var(--border)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--paper)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Speedeco</div>
              {[
                ['Start from templates', 'Start from your existing content'],
                ['AI generates generic text', 'AI extracts your key points'],
                ['Focus on visual polish', 'Focus on argument structure'],
                ['Best for blank-page starts', 'Best for content-heavy topics'],
              ].map(([left, right], i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <div style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--muted)', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', borderRight: '1px solid var(--border)' }}>{left}</div>
                  <div style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', fontWeight: 500 }}>{right}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FAQ ── */}
          <section style={{ background: 'var(--surface)', padding: '3rem 1.5rem' }}>
            <div style={{ maxWidth: '580px', margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontStyle: 'italic', textAlign: 'center', marginBottom: '1.5rem' }}>
                Frequently asked questions
              </h2>
              {[
                { q: 'What can I upload to Speedeco?', a: 'URLs (articles, blog posts), text files, Word documents, PDFs, or paste raw text directly. Max 50,000 words per upload.' },
                { q: 'How is this different from Gamma or Beautiful.ai?', a: 'Gamma excels at visual storytelling from scratch. Beautiful.ai masters template-based design. Speedeco specializes in content transformation — taking your existing long-form thinking and distilling it into slide format without losing nuance.' },
                { q: 'Can I edit the slides after generation?', a: 'Fully. Edit text directly on each slide, reorder slides, change themes and font sizes, or regenerate specific sections. Export to PowerPoint or PDF.' },
                { q: 'How long does it take?', a: 'Most decks generate in under 60 seconds. A 10,000-word whitepaper might take 90 seconds.' },
                { q: 'Is my content secure?', a: 'We never train models on your data. Uploads are encrypted, processed, then deleted from our servers after generation.' },
                { q: 'What\'s the pricing?', a: 'Free during beta — generate unlimited decks. Paid plans coming soon with premium themes, team collaboration, and PowerPoint export.' },
              ].map((faq, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '0.8rem 0' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontStyle: 'italic', cursor: 'default' }}>{faq.q}</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6, marginTop: '0.4rem' }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Final CTA ── */}
          <section style={{ maxWidth: '500px', margin: '0 auto', padding: '4rem 1.5rem', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
              Stop building decks from scratch.
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Your best thinking already exists. Speedeco turns it into a presentation worth sharing.
            </p>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="btn" style={{
              background: 'var(--ink)', color: 'var(--paper)', border: 'none',
              padding: '0.75rem 2rem', fontSize: '0.85rem', fontFamily: 'var(--font-body)',
              fontWeight: 600, borderRadius: '8px', cursor: 'pointer',
            }}>
              Paste your first text ↑
            </button>
          </section>

          {/* ── Footer ── */}
          <footer style={{ borderTop: '1px solid var(--border)', padding: '1.5rem' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>&copy; 2026 Speedeco · Arc Intelligence</span>
              <div style={{ display: 'flex', gap: '1.25rem' }}>
                <a href="/blog" style={{ fontSize: '0.7rem', color: 'var(--muted)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Blog</a>
              </div>
            </div>
          </footer>
        </>
      )}
    </main>
  )
}
