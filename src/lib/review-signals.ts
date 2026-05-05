import type {
  CompetitorListing,
  CompetitorSignals,
  ListingData,
  ReviewSample,
  ReviewSignals,
} from "@/types/creative";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "have",
  "has",
  "but",
  "are",
  "was",
  "you",
  "your",
  "from",
  "very",
  "just",
  "they",
  "them",
  "then",
  "than",
  "into",
  "over",
  "also",
  "been",
  "being",
  "would",
  "could",
  "about",
  "really",
  "didn't",
  "don't",
  "doesn't",
  "isn't",
  "wasn't",
  "won't",
  "much",
  "more",
  "less",
  "what",
  "when",
  "where",
  "which",
  "while",
  "some",
  "any",
  "every",
  "each",
  "amazon",
  "product",
  "item",
  "got",
  "get",
  "use",
  "used",
  "using",
  "one",
  "two",
  "three",
  "after",
  "before",
  "now",
  "still",
  "only",
  "even",
  "good",
  "bad",
  "great",
  "well",
  "make",
  "made",
]);

const NEGATIVE_CUES = [
  "broke",
  "broken",
  "stopped",
  "stops",
  "doesn't work",
  "didn't work",
  "not working",
  "leak",
  "leaks",
  "leaked",
  "uncomfortable",
  "smell",
  "smells",
  "smelly",
  "rust",
  "rusted",
  "cheap",
  "flimsy",
  "weak",
  "tear",
  "torn",
  "ripped",
  "stain",
  "stained",
  "noisy",
  "loud",
  "small",
  "tiny",
  "short",
  "thin",
  "hard to",
  "difficult",
  "won't",
  "wont",
  "missing",
  "wrong",
  "fake",
  "defect",
  "defective",
  "return",
  "refund",
  "disappointed",
  "waste",
  "useless",
  "burn",
  "burnt",
  "melt",
  "melted",
];

const POSITIVE_CUES = [
  "love",
  "loved",
  "perfect",
  "amazing",
  "excellent",
  "best",
  "fantastic",
  "comfortable",
  "soft",
  "sturdy",
  "solid",
  "durable",
  "fast",
  "quick",
  "easy to",
  "lightweight",
  "quiet",
  "powerful",
  "long lasting",
  "long-lasting",
  "value for money",
  "worth",
  "premium",
  "reliable",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9'\-\s]/g, " ").replace(/\s+/g, " ").trim();
}

function topPhrases(texts: string[], cues: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const raw of texts) {
    const text = normalize(raw);
    for (const cue of cues) {
      let idx = text.indexOf(cue);
      while (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(text.length, idx + cue.length + 40);
        const snippet = text.slice(start, end).trim();
        const phrase = snippet.length > 12 ? snippet : cue;
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
        idx = text.indexOf(cue, idx + cue.length);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([p]) => p);
}

function topNgrams(texts: string[], n: number, limit: number): string[] {
  const counts = new Map<string, number>();
  for (const raw of texts) {
    const tokens = normalize(raw)
      .split(" ")
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
    for (let i = 0; i <= tokens.length - n; i++) {
      const gram = tokens.slice(i, i + n).join(" ");
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([g]) => g);
}

export function buildReviewSignals(reviews: ReviewSample[]): ReviewSignals {
  if (reviews.length === 0) {
    return { painPoints: [], positiveClaims: [], novelFeatures: [] };
  }
  const negativeBodies = reviews
    .filter((r) => (r.rating ?? 5) <= 3)
    .map((r) => `${r.title}. ${r.body}`);
  const positiveBodies = reviews
    .filter((r) => (r.rating ?? 0) >= 4)
    .map((r) => `${r.title}. ${r.body}`);

  const allBodies = reviews.map((r) => `${r.title}. ${r.body}`);
  const negativeFallback = negativeBodies.length ? negativeBodies : allBodies;
  const positiveFallback = positiveBodies.length ? positiveBodies : allBodies;

  return {
    painPoints: topPhrases(negativeFallback, NEGATIVE_CUES, 8),
    positiveClaims: topPhrases(positiveFallback, POSITIVE_CUES, 8),
    novelFeatures: topNgrams(positiveFallback, 2, 8),
  };
}

export function buildCompetitorSignals(
  listing: ListingData,
  competitors: CompetitorListing[],
): CompetitorSignals {
  if (competitors.length === 0) {
    return { commonVisualThemes: [], competitorGaps: [] };
  }
  const competitorTexts = competitors.flatMap((c) => [c.title, ...c.bullets]);
  const ownText = [listing.title, ...listing.bullets].join(" ");

  const competitorThemes = topNgrams(competitorTexts, 2, 10);
  const ownNorm = normalize(ownText);
  const gaps = competitorThemes.filter((theme) => !ownNorm.includes(theme));

  return {
    commonVisualThemes: competitorThemes.slice(0, 6),
    competitorGaps: gaps.slice(0, 6),
  };
}
