import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // Vercel Pro, or 10s on free — still helps

const ARC_DEFINITIONS = {
  'problem-insight-reframe': {
    label: 'Problem → Insight → Reframe → CTA',
    description: 'Surfaces tension, delivers a sharp insight, reframes the reader\'s worldview, then moves them to action.',
    slideRoles: ['hook', 'problem', 'insight', 'reframe', 'cta'],
  },
  'narrative-arc': {
    label: 'Beginning → Tension → Climax → Resolution',
    description: 'Story-driven. Pulls the reader through an experience with emotional momentum.',
    slideRoles: ['opening', 'context', 'tension', 'climax', 'resolution'],
  },
  'concept-proof': {
    label: 'Concept → Proof → So What',
    description: 'Stakes a bold claim, proves it with evidence, then lands the implication.',
    slideRoles: ['claim', 'concept', 'proof1', 'proof2', 'sowhat'],
  },
  'listicle': {
    label: 'Listicle — Ranked Tips',
    description: 'Crisp numbered points with a strong opener and a closing takeaway.',
    slideRoles: ['hook', 'point1', 'point2', 'point3', 'point4', 'takeaway'],
  },
}

const DETECT_SYSTEM = `You are Speedeco's Arc Intelligence engine. Your job is to read raw content and recommend which narrative arcs best fit the material.

You must return ONLY valid JSON — no markdown, no explanation, no preamble.

Return this exact shape:
{
  "suggestions": [
    { "arcId": "problem-insight-reframe", "reason": "one sentence why this fits", "confidence": "high" | "medium" },
    { "arcId": "concept-proof", "reason": "one sentence why this fits", "confidence": "medium" }
  ]
}

Arc IDs to choose from: problem-insight-reframe, narrative-arc, concept-proof, listicle

Rules:
- Suggest 2-3 arcs max, ranked by fit
- "high" confidence means the content strongly signals this structure
- Keep reasons under 15 words, sharp and specific
- Read for: tensions, contrasts, claims, stories, enumerable points`

const GENERATE_SYSTEM = (arcId: string, slideRoles: string[]) => `You are Speedeco's slide writer. You write text-first carousel slides for thought leaders.

Arc: ${arcId}
Slide roles in order: ${slideRoles.join(' → ')}

You must return ONLY valid JSON — no markdown, no preamble, no explanation.

Return this exact shape:
{
  "slides": [
    {
      "role": "hook",
      "headline": "The main text of this slide — bold, standalone, copyable",
      "subtext": "Optional secondary line. Leave empty string if not needed.",
      "slideNumber": 1
    }
  ]
}

Rules for writing:
- Each slide must work as a standalone statement — readable without context
- Headlines: punchy, declarative, no fluff. Max 20 words.
- Subtext: adds depth or contrast. Max 15 words. Often empty.
- Use the tension/insight/story from the original content — don't make things up
- Write like the best thinkers on Instagram: FounderUnbound, thecareerarchetypes — precise, weighted, memorable
- No bullet points inside slides. Each slide = one clear idea.
- The hook slide must be irresistible — it's what stops the scroll
- The final slide (CTA/takeaway/resolution/sowhat) should leave the reader changed`

export async function POST(req: NextRequest) {
  try {
    const { action, content, arcId } = await req.json()

    if (!content) return NextResponse.json({ error: 'No content provided' }, { status: 400 })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return
