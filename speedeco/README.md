# Speedeco — Arc Intelligence for Carousel Decks

Turn long-form writing, brain dumps, transcripts, and URLs into sharp, copyable slide decks using narrative arc intelligence.

## How it works

1. **Paste content** — essays, notes, transcripts, or a URL
2. **Speedeco detects arcs** — AI reads the structure and suggests 2-3 narrative frameworks that fit
3. **You pick the arc** — Problem→Insight→Reframe→CTA, Narrative, Concept→Proof, or Listicle
4. **Get copyable slides** — text-first cards, ready to paste into Canva or post directly

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial Speedeco"
git remote add origin https://github.com/YOUR_USERNAME/speedeco.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Add environment variable:
   - `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
4. Deploy

### Local development

```bash
cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Roadmap

- [ ] Clerk authentication
- [ ] Supabase — save decks, history
- [ ] Stripe — usage-based billing
- [ ] Export slides as images
- [ ] Visual layout modes (beyond text-first)
- [ ] Custom tone settings
- [ ] Slide count control

## Tech stack

- Next.js 14 (App Router)
- Tailwind CSS
- Claude claude-sonnet-4-20250514 (Arc Engine)
- Vercel deployment
