import Link from 'next/link';
import { blogPosts } from '@/lib/blog';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — Speedeco',
  description: 'Tips, guides, and strategies for turning your best thinking into polished slide decks.',
};

export default function BlogIndex() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Nav */}
      <header style={{
        padding: '16px 24px', maxWidth: '1200px', margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontStyle: 'italic' }}>Speedeco</span>
          <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>arc intelligence</span>
        </Link>
        <Link href="/" style={{
          fontSize: '13px', fontFamily: 'var(--font-body)', padding: '8px 16px',
          background: 'var(--ink)', color: 'var(--paper)', borderRadius: '6px', textDecoration: 'none',
        }}>
          Try Speedeco →
        </Link>
      </header>

      {/* Blog header */}
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 24px 40px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 48px)', lineHeight: '1.1', marginBottom: '12px', fontStyle: 'italic' }}>
          Blog
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--muted)', maxWidth: '480px', margin: '0 auto', lineHeight: '1.6', fontFamily: 'var(--font-body)' }}>
          Ideas and strategies for turning your thinking into presentations that land.
        </p>
      </section>

      {/* Posts list */}
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{
                display: 'block', padding: '24px', backgroundColor: 'var(--paper)',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <span style={{
                fontSize: '9px', fontWeight: '600', textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--accent)', display: 'block', marginBottom: '6px',
                fontFamily: 'var(--font-mono)',
              }}>
                {post.stage}
              </span>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: '20px', lineHeight: '1.3', marginBottom: '6px', fontStyle: 'italic',
              }}>
                {post.title}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5', fontFamily: 'var(--font-body)' }}>
                {post.meta}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>&copy; 2026 Speedeco · Arc Intelligence</span>
          <Link href="/" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Home</Link>
        </div>
      </footer>
    </div>
  );
}
