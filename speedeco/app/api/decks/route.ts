import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('decks')
    .select('id, title, arc_id, format, tone, slide_count, slides, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Supabase fetch error:', error)
    return NextResponse.json({ error: 'Failed to load decks' }, { status: 500 })
  }

  return NextResponse.json({ decks: data })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { title, source_content, source_url, arc_id, format, tone, slides, slide_count } = body

  if (!slides || !arc_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('decks')
    .insert({
      user_id: userId,
      title: title || `Deck — ${new Date().toLocaleDateString()}`,
      source_content: source_content?.slice(0, 10000),
      source_url,
      arc_id,
      format: format || 'standard',
      tone: tone || 'sharp',
      slides,
      slide_count: slide_count || slides.length,
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase insert error:', error)
    return NextResponse.json({ error: 'Failed to save deck' }, { status: 500 })
  }

  return NextResponse.json({ deck: data })
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const deckId = searchParams.get('id')

  if (!deckId) {
    return NextResponse.json({ error: 'Missing deck ID' }, { status: 400 })
  }

  const { error } = await supabase
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId)

  if (error) {
    console.error('Supabase delete error:', error)
    return NextResponse.json({ error: 'Failed to delete deck' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
