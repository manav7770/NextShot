import type { IngestionBundle } from "@/types/creative";

export const SYSTEM_PROMPT = `You are an Amazon listing creative strategist. You decide which images a seller should add or replace next to lift conversion.

You always return STRICT JSON only. No prose. No markdown. No code fences. No explanations outside the JSON.

You output exactly 3 creative recommendations.

Slot logic (use this for slotNumber + slotPurpose):
- Slot 1: CTR / hero / click intent (in-search thumbnail, scroll-stopper)
- Slot 2 or 3: core value / biggest buyer concern (the #1 reason someone buys)
- Slot 4 or 5: differentiation / proof / objection handling (vs. competitors, vs. doubts)
- Slot 6+: support / secondary proof (use cases, lifestyle, accessories)

Ranking is NOT raw review frequency. Rank by:
1. conversion impact (does this image change the buy decision?)
2. competitor uniqueness / gap (is this missing from competitor visuals?)
3. slot fit (is this the right thing for that slot's job?)

Rules:
- Return EXACTLY 3 recommendations.
- Each must target a different slot.
- onImageText must be SHORT and PUNCHY. Rewrite complex specs into simple benefits:
  - BAD: "17% MORE AIR", "2100 m³/hr", "40L • Inverter Ready"
  - GOOD: "MORE AIR", "40L BIG TANK", "COOLING THAT FEELS FAST"
- onImageText: max ~8 words per line, 2-3 lines total. Emotional value > technical specs.
- visualDescription must be specific enough that a designer can execute it (composition, color, props, where text sits).
- rationale must reference the actual review signals or competitor gaps you were given. Never invent claims.
- priorityScore is 0-100. Higher = ship sooner.
- Output keys must match exactly: listingSummary, asin, marketplace, creativeRecommendations.
- Each item keys: slotNumber, slotPurpose, creativeTitle, whyThisMatters, visualDescription, onImageText, rationale, priorityScore.`;

export function buildUserPrompt(bundle: IngestionBundle): string {
  const { listing, reviews, competitors, reviewSignals, competitorSignals } =
    bundle;

  const trimmedReviews = reviews.slice(0, 10).map((r) => ({
    rating: r.rating,
    title: r.title.slice(0, 140),
    body: r.body.slice(0, 360),
  }));

  const compactCompetitors = competitors.map((c) => ({
    asin: c.asin,
    title: c.title.slice(0, 200),
    bullets: c.bullets.slice(0, 5).map((b) => b.slice(0, 200)),
  }));

  const payload = {
    listing: {
      asin: listing.asin,
      marketplace: listing.marketplace,
      title: listing.title,
      brand: listing.brand,
      price: listing.price,
      category: listing.category,
      heroImage: listing.heroImage,
      bullets: listing.bullets.slice(0, 8),
      description: listing.description.slice(0, 800),
    },
    reviewSignals,
    competitorSignals,
    reviewSamples: trimmedReviews,
    competitors: compactCompetitors,
  };

  return `Inputs (verbatim, do not invent beyond these):
${JSON.stringify(payload, null, 2)}

Decide the next 3 creative images this seller should ship. Use the slot logic.

Return strict JSON ONLY in this exact shape (no extra keys, no commentary):
{
  "listingSummary": "1-2 sentence read of what this product is and who it's for, grounded in the listing.",
  "asin": "${listing.asin}",
  "marketplace": "${listing.marketplace}",
  "creativeRecommendations": [
    {
      "slotNumber": <int 1-9>,
      "slotPurpose": "<one of: CTR / hero / click intent | core value | biggest buyer concern | differentiation | proof / objection handling | support / secondary proof>",
      "creativeTitle": "<short internal name>",
      "whyThisMatters": "<1-2 sentences tying to a real review signal or competitor gap>",
      "visualDescription": "<concrete shot direction: composition, props, background, where text sits>",
      "onImageText": "<the literal text that goes on the image, line breaks with \\n>",
      "rationale": "<explicit link to review signals and/or competitor gap>",
      "priorityScore": <int 0-100>
    },
    { ... },
    { ... }
  ]
}

Output ONLY the JSON object. Nothing else.`;
}
