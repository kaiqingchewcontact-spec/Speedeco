import Link from 'next/link';
import { blogPosts, BlogPost } from '@/lib/blog';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return {};
  return {
    title: `${post.title} — Speedeco Blog`,
    description: post.meta,
    keywords: post.keyword,
    openGraph: { title: post.title, description: post.meta, type: 'article' },
  };
}

function RenderBody({ body }: { body: string }) {
  const paragraphs = body.split('\n\n').filter((p) => p.trim());

  return (
    <>
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();

        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          const text = trimmed.replace(/\*\*/g, '');
          return (
            <h2 key={i} style={{
              fontFamily: 'var(--font-display)', fontSize: '22px', lineHeight: '1.3',
              marginTop: '40px', marginBottom: '8px', fontStyle: 'italic',
            }}>
              {text}
            </h2>
          );
        }

        const parts = trimmed.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} style={{
            fontSize: '16px', lineHeight: '1.8', color: 'var(--ink)',
            marginBottom: '16px', fontFamily: 'var(--font-body)',
          }}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j}>{part.replace(/\*\*/g, '')}</strong>;
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </>
  );
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

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

      {/* Article */}
      <article style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <Link href="/blog" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '13px', color: 'var(--muted)', textDecoration: 'none', marginBottom: '32px',
          fontFamily: 'var(--font-mono)',
        }}>
          ← All posts
        </Link>

        <span style={{
          display: 'block', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '12px',
          fontFamily: 'var(--font-mono)',
        }}>
          {post.stage}
        </span>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)',
          lineHeight: '1.15', marginBottom: '16px', fontStyle: 'italic',
        }}>
          {post.title}
        </h1>

        <p style={{
          fontSize: '16px', color: 'var(--muted)', lineHeight: '1.6', marginBottom: '40px',
          borderBottom: '1px solid var(--border)', paddingBottom: '32px',
          fontFamily: 'var(--font-body)',
        }}>
          {post.meta}
        </p>

        <RenderBody body={post.body} />

        {/* CTA */}
        <div style={{
          marginTop: '48px', padding: '32px', backgroundColor: 'var(--surface)',
          borderRadius: '12px', textAlign: 'center',
        }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', marginBottom: '8px', fontStyle: 'italic' }}>
            Ready to turn your thinking into slides?
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px', fontFamily: 'var(--font-body)' }}>
            Paste anything. Get a deck in seconds.
          </p>
          <Link href="/" style={{
            display: 'inline-block', padding: '12px 32px', fontSize: '14px',
            background: 'var(--accent)', color: 'var(--paper)', borderRadius: '8px',
            textDecoration: 'none', fontFamily: 'var(--font-body)', fontWeight: '500',
          }}>
            Try Speedeco →
          </Link>
        </div>
      </article>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 24px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>&copy; 2026 Speedeco · Arc Intelligence</span>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link href="/" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Home</Link>
            <Link href="/blog" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Blog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
