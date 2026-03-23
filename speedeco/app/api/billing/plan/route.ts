import { auth } from '@clerk/nextjs/server'
import { getUserPlan } from '@/lib/plans'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const planInfo = await getUserPlan(userId)
  return NextResponse.json({ data: planInfo })
}
