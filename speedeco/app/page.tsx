'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type InputMode = 'text' | 'url'
type AppState = 'input' | 'configure' | 'detecting' | 'generating' | 'output'
type ViewMode = 'carousel' | 'grid'

interface Slide {
  role: string
  headline: string
  subtext: string
  slideNumber: number
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
            arc intelligence
          </span>
        </div>
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
                Paste your thinking.<br />
                <em>Walk away with a deck.</em>
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                Drop an article, brain dump, conversation, or URL. Speedeco reads the structure and
                builds slides that carry the weight of your original thinking.
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
                { label: 'Long-form essays', hint: 'Articles, blog posts, LinkedIn' },
                { label: 'Brain dumps', hint: 'Rough notes, voice-to-text' },
                { label: 'Conversations', hint: 'Transcripts, chat exports' },
                { label: 'Saved URLs', hint: 'Articles, threads, newsletters' },
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

        {/* ═══════════ OUTPUT STATE ═══════════ */}
        {appState === 'output' && (
          <div className="fade-up">
            {/* Header */}
            <div style={{
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '1rem',
            }}>
              <div>
                <p style={{
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '0.2rem',
                }}>
                  {slides.length} slides ready
                </p>
                <h2 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  letterSpacing: '-0.02em',
                }}>
                  {arcLabel}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button onClick={copyAll} className="btn" style={{
                  background: copiedAll ? 'var(--accent)' : 'var(--ink)',
                  color: 'var(--paper)',
                  border: 'none',
                  padding: '0.55rem 1.1rem',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}>
                  {copiedAll ? 'Copied ✓' : 'Copy all'}
                </button>
                <button
                  onClick={() => setViewMode(v => v === 'carousel' ? 'grid' : 'carousel')}
                  className="btn"
                  style={{
                    background: 'none',
                    color: 'var(--muted)',
                    border: '1px solid var(--border)',
                    padding: '0.55rem 1rem',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    borderRadius: '6px',
                  }}
                >
                  {viewMode === 'carousel' ? 'Grid view' : 'Carousel'}
                </button>
              </div>
            </div>

            {/* ── Carousel View ── */}
            {viewMode === 'carousel' && (
              <div>
                <div
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    overflow: 'hidden',
                    borderRadius: '12px',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    className="carousel-track"
                    style={{
                      display: 'flex',
                      transform: `translateX(-${currentSlide * 100}%)`,
                    }}
                  >
                    {slides.map((slide, i) => (
                      <div
                        key={i}
                        onClick={() => copySlide(slide, i)}
                        style={{
                          minWidth: '100%',
                          aspectRatio: '1 / 1',
                          background: copiedIndex === i ? 'var(--accent)' : 'var(--ink)',
                          color: 'var(--paper)',
                          padding: 'clamp(1.5rem, 5vw, 3rem)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'background 0.3s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.6rem', fontFamily: 'var(--font-mono)',
                            textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4,
                          }}>
                            {ROLE_LABELS[slide.role] || slide.role}
                          </span>
                          <span style={{
                            fontSize: '0.6rem', fontFamily: 'var(--font-mono)', opacity: 0.3,
                          }}>
                            {copiedIndex === i ? '✓ copied' : `${i + 1}/${slides.length}`}
                          </span>
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <p style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(1.3rem, 4vw, 2rem)',
                            lineHeight: 1.2,
                            letterSpacing: '-0.02em',
                            marginBottom: slide.subtext ? '0.75rem' : 0,
                          }}>
                            {slide.headline}
                          </p>
                          {slide.subtext && (
                            <p style={{
                              fontSize: 'clamp(0.8rem, 2vw, 0.95rem)',
                              lineHeight: 1.5,
                              opacity: 0.5,
                            }}>
                              {slide.subtext}
                            </p>
                          )}
                        </div>

                        <div style={{
                          fontSize: '0.6rem', opacity: 0.2,
                          fontFamily: 'var(--font-mono)',
                        }}>
                          tap to copy
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dots + arrows */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => setCurrentSlide(c => Math.max(0, c - 1))}
                    disabled={currentSlide === 0}
                    className="btn"
                    style={{
                      background: 'none', border: 'none',
                      fontSize: '1.2rem',
                      color: currentSlide === 0 ? 'var(--border)' : 'var(--ink)',
                      cursor: currentSlide === 0 ? 'default' : 'pointer',
                      padding: '0.25rem 0.5rem',
                    }}
                  >
                    ‹
                  </button>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {slides.map((_, i) => (
                      <div
                        key={i}
                        onClick={() => setCurrentSlide(i)}
                        style={{
                          width: currentSlide === i ? '20px' : '6px',
                          height: '6px',
                          borderRadius: '3px',
                          background: currentSlide === i ? 'var(--ink)' : 'var(--border)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentSlide(c => Math.min(slides.length - 1, c + 1))}
                    disabled={currentSlide === slides.length - 1}
                    className="btn"
                    style={{
                      background: 'none', border: 'none',
                      fontSize: '1.2rem',
                      color: currentSlide === slides.length - 1 ? 'var(--border)' : 'var(--ink)',
                      cursor: currentSlide === slides.length - 1 ? 'default' : 'pointer',
                      padding: '0.25rem 0.5rem',
                    }}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}

            {/* ── Grid View ── */}
            {viewMode === 'grid' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '0.75rem',
              }}>
                {slides.map((slide, i) => (
                  <div
                    key={i}
                    className={`slide-card fade-up`}
                    style={{
                      animationDelay: `${i * 0.06}s`,
                      opacity: 0,
                      background: copiedIndex === i ? 'var(--accent)' : 'var(--ink)',
                      position: 'relative',
                    }}
                    onClick={() => copySlide(slide, i)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: '0.6rem', fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4,
                      }}>
                        {ROLE_LABELS[slide.role] || slide.role}
                      </span>
                      <span style={{
                        fontSize: '0.6rem', fontFamily: 'var(--font-mono)', opacity: 0.3,
                      }}>
                        {copiedIndex === i ? '✓ copied' : `${i + 1}/${slides.length}`}
                      </span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <p style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
                        lineHeight: 1.25,
                        letterSpacing: '-0.01em',
                        marginBottom: slide.subtext ? '0.5rem' : 0,
                      }}>
                        {slide.headline}
                      </p>
                      {slide.subtext && (
                        <p style={{ fontSize: '0.75rem', lineHeight: 1.5, opacity: 0.5 }}>
                          {slide.subtext}
                        </p>
                      )}
                    </div>
                    <div className="copy-hint" style={{
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ opacity: copiedIndex === i ? 1 : 0.2 }}>
                        {copiedIndex === i ? '✓ copied to clipboard' : 'click to copy'}
                      </span>
                      <span style={{
                        background: 'var(--paper)',
                        color: 'var(--ink)',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        opacity: 0,
                        transition: 'opacity 0.15s ease',
                      }} className="copy-btn-hover">
                        COPY
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action row */}
            <div style={{
              marginTop: '1.5rem',
              display: 'flex',
              justifyContent: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}>
              <button onClick={handleGenerate} className="btn" style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                padding: '0.55rem 1.25rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                borderRadius: '6px',
                letterSpacing: '0.04em',
              }}>
                ↺ Regenerate
              </button>
              <button onClick={() => { setAppState('configure'); setSlides([]) }} className="btn" style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                padding: '0.55rem 1.25rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                borderRadius: '6px',
                letterSpacing: '0.04em',
              }}>
                ← Reconfigure
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
