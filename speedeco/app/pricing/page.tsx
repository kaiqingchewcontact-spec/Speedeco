'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

export default function Pricing() {
  const { isSignedIn } = useUser()
  const [currentPlan, setCurrentPlan] = useState('free')
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return }
    fetch('/api/billing/plan')
      .then(r => r.json())
      .then(json => { if (json.data) setCurrentPlan(json.data.plan) })
      .finally(() => setLoading(false))
  }, [isSignedIn])

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const json = await res.json()
      if (json.url) window.location.href = json.url
    } finally { setCheckoutLoading(false) }
  }

  const handleManage = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (json.url) window.location.href = json.url
    } finally { setPortalLoading(false) }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Nav */}
      <header style={{ padding: '1rem 1.5rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontStyle: 'italic' }}>Speedeco</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>narrative ai</span>
        </Link>
        <Link href="/" style={{
          fontSize: '0.8rem', fontFamily: 'var(--font-body)', padding: '0.5rem 1rem',
          background: 'var(--ink)', color: 'var(--paper)', borderRadius: '6px', textDecoration: 'none',
        }}>
          Try Speedeco →
        </Link>
      </header>

      {/* Header */}
      <section style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 1.5rem 2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
          Simple pricing
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          Start free. Upgrade when you need unlimited decks and premium features.
        </p>
      </section>

      {/* Pricing cards */}
      <section style={{ maxWidth: '650px', margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Free */}
          <div style={{
            border: currentPlan === 'free' ? '2px solid var(--ink)' : '1px solid var(--border)',
            borderRadius: '12px', padding: '1.5rem', background: 'var(--paper)', position: 'relative',
          }}>
            {currentPlan === 'free' && isSignedIn && (
              <div style={{
                position: 'absolute', top: '-0.6rem', left: '50%', transform: 'translateX(-50%)',
                background: 'var(--ink)', color: 'var(--paper)', fontSize: '0.55rem', fontFamily: 'var(--font-mono)',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '0.2rem 0.6rem', borderRadius: '9999px',
              }}>Current plan</div>
            )}
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontStyle: 'italic', marginBottom: '0.2rem' }}>Free</h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '1rem' }}>Get started with Speedeco.</p>
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>$0</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>/mo</span>
            </div>
            {!isSignedIn ? (
              <Link href="/sign-up" style={{
                display: 'block', textAlign: 'center', padding: '0.6rem', fontSize: '0.75rem',
                border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--ink)',
                textDecoration: 'none', fontFamily: 'var(--font-body)', fontWeight: 500,
              }}>Get started</Link>
            ) : (
              <div style={{ padding: '0.6rem', textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                {currentPlan === 'free' ? 'Your current plan' : 'Downgrade via manage'}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '0.75rem' }}>
              {['3 decks per month', 'All 7 themes', 'Basic layouts', 'PDF export'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>✓</span>
                  <span style={{ fontSize: '0.75rem' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro */}
          <div style={{
            border: currentPlan === 'pro' ? '2px solid var(--accent)' : '2px solid var(--accent)',
            borderRadius: '12px', padding: '1.5rem', background: 'var(--paper)', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: '-0.6rem', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--accent)', color: 'var(--paper)', fontSize: '0.55rem', fontFamily: 'var(--font-mono)',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
              padding: '0.2rem 0.6rem', borderRadius: '9999px',
            }}>{currentPlan === 'pro' ? 'Current plan' : 'Recommended'}</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontStyle: 'italic', marginBottom: '0.2rem' }}>Pro</h3>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '1rem' }}>For serious presenters.</p>
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem' }}>$15</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>/mo</span>
            </div>
            {!isSignedIn ? (
              <Link href="/sign-up" style={{
                display: 'block', textAlign: 'center', padding: '0.6rem', fontSize: '0.75rem',
                background: 'var(--accent)', color: 'var(--paper)', borderRadius: '8px',
                textDecoration: 'none', fontFamily: 'var(--font-body)', fontWeight: 600,
              }}>Start Pro</Link>
            ) : currentPlan === 'pro' ? (
              <button onClick={handleManage} disabled={portalLoading} style={{
                width: '100%', padding: '0.6rem', fontSize: '0.75rem',
                border: '1px solid var(--border)', borderRadius: '8px', background: 'transparent',
                color: 'var(--ink)', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}>{portalLoading ? 'Loading...' : 'Manage subscription'}</button>
            ) : (
              <button onClick={handleUpgrade} disabled={checkoutLoading} style={{
                width: '100%', padding: '0.6rem', fontSize: '0.75rem',
                background: 'var(--accent)', color: 'var(--paper)', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600,
              }}>{checkoutLoading ? 'Loading...' : 'Upgrade to Pro'}</button>
            )}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '0.75rem' }}>
              {['Unlimited decks', 'All premium themes', 'PowerPoint export', 'Priority processing', 'Edit history', 'No watermark'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>✓</span>
                  <span style={{ fontSize: '0.75rem' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '1.5rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>© 2026 Speedeco</span>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/" style={{ fontSize: '0.7rem', color: 'var(--muted)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Home</Link>
            <Link href="/blog" style={{ fontSize: '0.7rem', color: 'var(--muted)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Blog</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
