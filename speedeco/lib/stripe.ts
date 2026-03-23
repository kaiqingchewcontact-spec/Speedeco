import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const PLANS = {
  free: {
    name: 'Free',
    maxDecksPerMonth: 3,
    features: ['3 decks per month', 'Basic layouts', 'PDF export', '7 themes'],
  },
  pro: {
    name: 'Pro',
    price: 1500,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    maxDecksPerMonth: 999,
    features: [
      'Unlimited decks',
      'All premium themes',
      'PowerPoint export',
      'Priority processing',
      'Edit history',
      'No watermark',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS

export function getPlanFromPriceId(priceId: string): PlanKey {
  if (priceId === PLANS.pro.priceId) return 'pro'
  return 'free'
}
