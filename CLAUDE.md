# Amazon Creative Upgrade Engine

A decision engine, not a dashboard. User pastes an Amazon URL or ASIN and gets the **next 3 creative images** to ship — each with a slot assignment, on-image text, and a rationale tied to reviews and competitor gaps.

## Hard rules

- This is **not** an analytics tool, a report, or a generic creative generator.
- Output is always **3** creative recommendations. Never more, never fewer.
- Each recommendation is bound to an Amazon image slot.
- Ranking is **not** raw review frequency. Rank by:
  1. conversion impact
  2. competitor uniqueness / gap
  3. slot role
- Claude calls return **strict JSON** only. No markdown, no commentary.
- One model call per endpoint. Low temperature.

## Slot logic

| Slot | Purpose |
| ---- | ------- |
| 1    | CTR / hero / click intent |
| 2–3  | core value / biggest buyer concern |
| 4–5  | differentiation / proof / objections |
| 6+   | support / secondary proof |

## Repo layout

```
src/
  app/
    page.tsx              # single-page UI
    layout.tsx
    globals.css
    api/
      creative-upgrade/route.ts   # ingest + engine + JSON out
  components/
    input-panel.tsx
    creative-card.tsx
  lib/
    anthropic.ts          # Claude client
    amazon.ts             # URL/ASIN parsing + listing fetch
    competitors.ts        # competitor discovery
    review-signals.ts     # extract signals from reviews
    creative-engine.ts    # orchestrate Claude call
    prompts.ts            # system + user prompts
    validators.ts         # Zod schemas
    env.ts                # env validation
  types/
    creative.ts           # shared types
```

## Engineering rules

- Strict TypeScript, Zod validation on every boundary (input, AI output).
- Minimal dependencies. No state libraries, no UI kits, no chart libs.
- Graceful fallbacks for scraping. The engine must still produce 3 creatives even if competitor data is sparse.
- No analytics UI. No charts. No reading-heavy reports.
- Deployable on Vercel with `ANTHROPIC_API_KEY` set.

## What "done" means

User pastes a URL/ASIN, clicks one button, and sees 3 ranked creative cards. Each card shows: slot number, slot purpose, title, why-it-matters, visual description, on-image text, rationale, priority score. Build passes. Deploys.
