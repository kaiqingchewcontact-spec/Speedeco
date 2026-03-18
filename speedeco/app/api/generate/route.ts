import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const ARC_DEFINITIONS: Record<string, { label: string; description: string; slideRoles: string[] }> = {
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
  'educational': {
    label: 'Educational — Concept → Example → Takeaway',
    description: 'Teaches a concept clearly with explanation, examples, and a takeaway.',
    slideRoles: ['hook', 'concept', 'explanation', 'example', 'takeaway'],
  },
}

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  'minimal': 'Each slide has ONLY a headline — no subtext. Headlines are bold, standalone, and punchy. Max 12 words.',
  'standard': 'Each slide has a headline (max 20 words) and an optional short subtext (max 15 words) that adds depth or contrast.',
  'detailed': 'Each slide has a headline (max 15 words) and a supporting paragraph subtext (max 30 words) that expands the idea.',
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  'sharp': 'Write in a sharp, authoritative tone. Declarative. No fluff. Think: McKinsey meets Twitter.',
  'conversational': 'Write in a warm, conversational tone. Like talking to a smart friend over coffee. Approachable but not dumbed down.',
  'provocative': 'Write in a bold, provocative tone. Challenge assumptions. Be contrarian. Make the reader uncomfortable in a good way.',
  'reflective': 'Write in a reflective, thoughtful tone. Measured. Contemplative. Give the reader space to sit with each idea.',
}

function buildSystemPrompt(arcId: string, slideRoles: string[], format: string, tone: string, slideCount: number): string {
  const formatRule = FORMAT_INSTRUCTIONS[format] || FORMAT_INSTRUCTIONS['standard']
  const toneRule = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS['sharp']

  return `You are Speedeco's slide writer. You write text-first carousel slides for thought leaders.

Arc: ${arcId}
Slide roles in order: ${slideRoles.join(' → ')}
Total slides requested: ${slideCount}

You must return ONLY valid JSON — no markdown, no preamble, no explanation.

Return this exact shape:
{
  "slides": [
    {
      "role": "hook",
      "headline": "The main text of this slide",
      "subtext": "Optional secondary line. Leave empty string if not needed.",
      "slideNumber": 1
    }
  ]
}

Format rules:
${formatRule}

Tone rules:
${toneRule}

Writing rules:
- Generate exactly ${slideCount} slides
- If ${slideCount} is more than the arc roles (${slideRoles.length}), repeat or extend logical roles (e.g. add more proof/point slides)
- If ${slideCount} is fewer than the arc roles, compress by merging or trimming middle slides — always keep hook and final slide
- Each slide must work as a standalone statement — readable without context
- Use the tension/insight/story from the original content — don't make things up
- Write like the best thinkers on Instagram: precise, weighted, memorable
- No bullet points inside slides. Each slide = one clear idea.
- The hook slide must be irresistible — it's what stops the scroll
- The final slide should leave the reader changed`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, content, arcId, format, tone, slideCount } = body

    if (!content) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured. Add ANTHROPIC_API_KEY to your Vercel environment variables.' }, { status: 500 })
    }

    if (action === 'generate') {
      const arc = ARC_DEFINITIONS[arcId]
      if (!arc) {
        return NextResponse.json({ error: 'Invalid arc ID' }, { status: 400 })
      }

      const count = Math.min(Math.max(slideCount || 5, 3), 12)
      const systemPrompt = buildSystemPrompt(
        arcId,
        arc.slideRoles,
        format || 'standard',
        tone || 'sharp',
        count
      )

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Generate ${count} slides for this content using the ${arc.label} arc:\n\n${content.slice(0, 6000)}`,
          }],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown API error' }))
        console.error('Anthropic API error (generate):', err)
        return NextResponse.json({ error: 'Claude API error', detail: err }, { status: 502 })
      }

      const data = await response.json()
      const rawText = data.content?.[0]?.text || ''

      // Strip markdown code fences if present
      const cleanText = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      if (!cleanText) {
        return NextResponse.json({ error: 'Empty response from Claude', debug: rawText.slice(0, 300) }, { status: 500 })
      }

      try {
        const parsed = JSON.parse(cleanText)
        if (!parsed.slides || !Array.isArray(parsed.slides)) {
          return NextResponse.json({ error: 'Response missing slides array', debug: cleanText.slice(0, 300) }, { status: 500 })
        }
        return NextResponse.json({ slides: parsed.slides, arc })
      } catch {
        return NextResponse.json({ error: 'Failed to parse slides JSON', debug: cleanText.slice(0, 300) }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Invalid action. Use "generate".' }, { status: 400 })

  } catch (err) {
    console.error('Unhandled error in /api/generate:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
