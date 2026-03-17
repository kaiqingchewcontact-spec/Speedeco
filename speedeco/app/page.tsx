'use client'

import { useState, useRef } from 'react'

type InputMode = 'text' | 'url'
type AppState = 'input' | 'detecting' | 'arc-select' | 'generating' | 'output'

interface ArcSuggestion {
  arcId: string
  label: string
  description: string
  reason: string
  confidence: 'high' | 'medium'
}

interface Slide {
  role: string
  headline: string
  subtext: string
  slideNumber: number
}

const ROLE_LABELS: Record<string, string> = {
  hook: 'Hook', problem: 'Problem', insight: 'Insight', reframe: 'Reframe', cta: 'CTA',
  opening: 'Opening', context: 'Context', tension: 'Tension', climax: 'Climax', resolution: 'Resolution',
  claim: 'Claim', concept: 'Concept', proof1: 'Proof', proof2: 'Evidence', sowhat: 'So What',
  point1: 'Point 1', point2: 'Point 2', point3: 'Point 3', point4: 'Point 4', takeaway: 'Takeaway',
}

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [appState, setAppState] = useState<AppState>('input')
  const [suggestions, setSuggestions] = useState<ArcSuggestion[]>([])
  const [selectedArc, setSelectedArc] = useState<string | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  async function handleFetchUrl() {
    if (!url.trim()) return
    setAppState('detecting')
    setError(null)
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setContent(data.text)
      await detectArcs(data.text)
    } catch {
      setError('Could not fetch that URL. Try pasting the text directly.')
      setAppState('input')
    }
  }

  async function detectArcs(rawContent?: string) {
    const c = rawContent || content
    if (!c.trim()) return
    setAppState('detecting')
    setError(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detect', content: c }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuggestions(data.suggestions)
      setAppState('arc-select')
    } catch {
      setError('Something went wrong. Try again.')
      setAppState('input')
    }
  }

  async function generateSlides(arcId: string) {
    setSelectedArc(arcId)
    setAppState('generating')
    setError(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', content, arcId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSlides(data.slides)
      setAppState('output')
    } catch {
      setError('Generation failed. Try again.')
      setAppState('arc-select')
    }
  }

  function copySlide(slide: Slide, index: number) {
    const text = slide.subtext ? `${slide.headline}\n\n${slide.subtext}` : slide.headline
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  function copyAll() {
    const text = slides.map((s, i) =>
      `— Slide ${i + 1} (${ROLE_LABELS[s.role] || s.role}) —\n${s.headline}${s.subtext ? '\n' + s.subtext : ''}`
    ).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  function reset() {
    setAppState('input')
    setContent('')
    setUrl('')
    setSuggestions([])
    setSelectedArc(null)
    setSlides([])
    setError(null)
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '1.25rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'var(--paper)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
            Speedeco
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            arc intelligence
          </span>
        </div>
        {appState !== 'input' && (
          <button onClick={reset} style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            color: 'var(--muted)',
            background: 'none',
            border: '1px solid var(--border)',
            padding: '0.4rem 1rem',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}>
            Start over
          </button>
        )}
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '3rem 2rem' }}>

        {/* INPUT STATE */}
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
              <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Drop an article, brain dump, conversation, or URL. Speedeco reads the structure and builds slides that carry the weight of your original thinking.
              </p>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', width: 'fit-content' }}>
              {(['text', 'url'] as InputMode[]).map(mode => (
                <button key={mode} onClick={() => setInputMode(mode)} style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  background: inputMode === mode ? 'var(--ink)' : 'transparent',
                  color: inputMode === mode ? 'var(--paper)' : 'var(--muted)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}>
                  {mode}
                </button>
              ))}
            </div>

            {inputMode === 'text' ? (
              <div>
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Paste your essay, rough notes, conversation transcript, or just describe a concept..."
                  rows={10}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.95rem',
                    lineHeight: 1.7,
                    color: 'var(--ink)',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    {wordCount} words
                  </span>
                  <button
                    onClick={() => detectArcs()}
                    disabled={wordCount < 20}
                    style={{
                      background: wordCount >= 20 ? 'var(--ink)' : 'var(--border)',
                      color: wordCount >= 20 ? 'var(--paper)' : 'var(--muted)',
                      border: 'none',
                      padding: '0.75rem 2rem',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.9rem',
                      letterSpacing: '0.02em',
                      cursor: wordCount >= 20 ? 'pointer' : 'not-allowed',
                      borderRadius: '6px',
                      transition: 'all 0.15s ease',
                    }}>
                    Analyse arc →
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
                    fontSize: '0.9rem',
                    color: 'var(--ink)',
                    outline: 'none',
                    marginBottom: '0.75rem',
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleFetchUrl}
                    disabled={!url.trim()}
                    style={{
                      background: url.trim() ? 'var(--ink)' : 'var(--border)',
                      color: url.trim() ? 'var(--paper)' : 'var(--muted)',
                      border: 'none',
                      padding: '0.75rem 2rem',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.9rem',
                      cursor: url.trim() ? 'pointer' : 'not-allowed',
                      borderRadius: '6px',
                    }}>
                    Fetch & analyse →
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                ⚠ {error}
              </p>
            )}

            {/* Input type hints */}
            <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { label: 'Long-form essays', hint: 'Articles, blog posts, LinkedIn posts' },
                { label: 'Brain dumps', hint: 'Rough notes, voice-to-text, rambling drafts' },
                { label: 'Conversations', hint: 'Interview transcripts, chat exports' },
                { label: 'Saved URLs', hint: 'Articles, threads, newsletters' },
              ].map(item => (
                <div key={item.label} style={{
                  padding: '0.875rem 1rem',
                  background: 'var(--surface)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.4 }}>{item.hint}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETECTING STATE */}
        {appState === 'detecting' && (
          <div className="fade-up" style={{ textAlign: 'center', padding: '6rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '1.5rem' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="thinking-dot" style={{
                  width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ink)',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--muted)', fontStyle: 'italic' }}>
              Reading your content...
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>
              Detecting narrative structure
            </p>
          </div>
        )}

        {/* ARC SELECT STATE */}
        {appState === 'arc-select' && (
          <div className="fade-up">
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                Arc detected
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
                Which story should this tell?
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Speedeco found {suggestions.length} arcs that fit your content. Pick one.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {suggestions.map((s, i) => (
                <button
                  key={s.arcId}
                  onClick={() => generateSlides(s.arcId)}
                  className="fade-up"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1.25rem 1.5rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--paper)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ink)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.3rem' }}>{s.label}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.5rem', lineHeight: 1.5 }}>{s.description}</div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>
                      ↳ {s.reason}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.65rem',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '0.2rem 0.5rem',
                    background: s.confidence === 'high' ? 'var(--accent)' : 'var(--border)',
                    color: s.confidence === 'high' ? 'white' : 'var(--muted)',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}>
                    {s.confidence}
                  </div>
                </button>
              ))}
            </div>

            <button onClick={() => setAppState('input')} style={{
              marginTop: '1.5rem',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              textDecoration: 'underline',
            }}>
              ← Edit content
            </button>
          </div>
        )}

        {/* GENERATING STATE */}
        {appState === 'generating' && (
          <div className="fade-up" style={{ textAlign: 'center', padding: '6rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '1.5rem' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="thinking-dot" style={{
                  width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ink)',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--muted)', fontStyle: 'italic' }}>
              Writing your slides...
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>
              Structuring arc: {suggestions.find(s => s.arcId === selectedArc)?.label}
            </p>
          </div>
        )}

        {/* OUTPUT STATE */}
        {appState === 'output' && (
          <div className="fade-up">
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
                  {slides.length} slides ready
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
                  {suggestions.find(s => s.arcId === selectedArc)?.label}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={copyAll} style={{
                  background: copiedAll ? 'var(--accent)' : 'var(--ink)',
                  color: 'var(--paper)',
                  border: 'none',
                  padding: '0.6rem 1.25rem',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  transition: 'background 0.2s ease',
                }}>
                  {copiedAll ? 'Copied all ✓' : 'Copy all slides'}
                </button>
                <button onClick={() => { setAppState('arc-select'); setSlides([]) }} style={{
                  background: 'none',
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                  padding: '0.6rem 1.25rem',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  borderRadius: '6px',
                }}>
                  Try different arc
                </button>
              </div>
            </div>

            {/* Slides grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {slides.map((slide, i) => (
                <div
                  key={i}
                  className={`slide-card fade-up ${copiedIndex === i ? 'copied' : ''}`}
                  style={{ animationDelay: `${i * 0.07}s` }}
                  onClick={() => copySlide(slide, i)}
                  title="Click to copy"
                >
                  {/* Slide meta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      opacity: 0.4,
                    }}>
                      {ROLE_LABELS[slide.role] || slide.role}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      opacity: 0.3,
                    }}>
                      {copiedIndex === i ? '✓ copied' : `${i + 1}/${slides.length}`}
                    </span>
                  </div>

                  {/* Headline */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
                      lineHeight: 1.25,
                      letterSpacing: '-0.01em',
                      marginBottom: slide.subtext ? '0.75rem' : 0,
                    }}>
                      {slide.headline}
                    </p>
                    {slide.subtext && (
                      <p style={{
                        fontSize: '0.8rem',
                        lineHeight: 1.5,
                        opacity: 0.55,
                        fontFamily: 'var(--font-body)',
                      }}>
                        {slide.subtext}
                      </p>
                    )}
                  </div>

                  {/* Copy hint */}
                  <div style={{ marginTop: '1rem', fontSize: '0.65rem', opacity: 0.25, fontFamily: 'var(--font-mono)' }}>
                    click to copy
                  </div>
                </div>
              ))}
            </div>

            {/* Regenerate */}
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button onClick={() => generateSlides(selectedArc!)} style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                padding: '0.6rem 1.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                borderRadius: '6px',
                letterSpacing: '0.04em',
              }}>
                ↺ Regenerate slides
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
