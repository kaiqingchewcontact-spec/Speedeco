import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Speedeco/1.0)',
      },
    })
    
    const html = await response.text()
    
    // Strip HTML tags and extract meaningful text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)

    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 500 })
  }
}
