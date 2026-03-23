import { supabaseAdmin } from './supabase-admin'
import { PLANS, PlanKey } from './stripe'

export async function getUserPlan(userId: string): Promise<{
  plan: PlanKey
  maxDecksPerMonth: number
}> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  const plan: PlanKey =
    data && data.status === 'active' && data.plan === 'pro'
      ? 'pro'
      : 'free'

  return {
    plan,
    maxDecksPerMonth: PLANS[plan].maxDecksPerMonth,
  }
}
