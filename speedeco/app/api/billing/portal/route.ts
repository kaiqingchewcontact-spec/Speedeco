import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 400 })
  }

  const origin = req.headers.get('origin') || 'https://speedeco.vercel.app'

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/pricing`,
  })

  return NextResponse.json({ url: session.url })
}
