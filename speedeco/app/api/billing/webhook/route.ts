import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const buf = await req.text()
  const sig = req.headers.get('stripe-signature') as string

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.metadata?.user_id) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any
        const priceId = subscription.items.data[0]?.price.id
        const plan = getPlanFromPriceId(priceId)

        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null

        await supabaseAdmin.from('subscriptions').upsert({
          user_id: session.metadata.user_id,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan,
          status: 'active',
          current_period_end: periodEnd,
        }, { onConflict: 'user_id' })
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as any
      const priceId = subscription.items.data[0]?.price.id
      const plan = getPlanFromPriceId(priceId)

      const status = subscription.cancel_at_period_end ? 'canceled' :
        subscription.status === 'active' ? 'active' :
        subscription.status === 'past_due' ? 'past_due' : 'incomplete'

      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null

      await supabaseAdmin
        .from('subscriptions')
        .update({ plan, status, current_period_end: periodEnd })
        .eq('stripe_subscription_id', subscription.id)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any
      await supabaseAdmin
        .from('subscriptions')
        .update({ plan: 'free', status: 'canceled', stripe_subscription_id: null })
        .eq('stripe_subscription_id', subscription.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
