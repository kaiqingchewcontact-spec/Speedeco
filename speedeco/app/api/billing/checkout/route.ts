import { auth } from '@clerk/nextjs/server'
import { stripe, PLANS } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const priceId = PLANS.pro.priceId
  if (!priceId) return NextResponse.json({ error: 'Price not configured' }, { status: 500 })

  // Check if user already has a Stripe customer ID
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  let customerId = sub?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { user_id: userId },
    })
    customerId = customer.id

    await supabaseAdmin.from('subscriptions').upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      plan: 'free',
      status: 'active',
    }, { onConflict: 'user_id' })
  }

  const origin = req.headers.get('origin') || 'https://speedeco.vercel.app'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?upgraded=true`,
    cancel_url: `${origin}/pricing`,
    metadata: { user_id: userId, plan: 'pro' },
  })

  return NextResponse.json({ url: session.url })
}
