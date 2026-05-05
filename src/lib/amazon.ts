import type {
  CompetitorListing,
  ListingData,
  ReviewSample,
} from "@/types/creative";

const DEFAULT_MARKETPLACE = "amazon.com";

const MARKETPLACE_LANGUAGES: Record<string, string> = {
  "amazon.com": "en-US,en;q=0.9",
  "amazon.in": "en-IN,en;q=0.9",
  "amazon.co.uk": "en-GB,en;q=0.9",
  "amazon.ca": "en-CA,en;q=0.9",
  "amazon.com.au": "en-AU,en;q=0.9",
  "amazon.de": "de-DE,de;q=0.9,en;q=0.8",
  "amazon.fr": "fr-FR,fr;q=0.9,en;q=0.8",
  "amazon.it": "it-IT,it;q=0.9,en;q=0.8",
  "amazon.es": "es-ES,es;q=0.9,en;q=0.8",
  "amazon.co.jp": "ja-JP,ja;q=0.9,en;q=0.8",
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ASIN_REGEX = /^[A-Z0-9]{10}$/;

export interface ParsedInput {
  asin: string;
  marketplace: string;
  url: string;
}

export function parseAmazonInput(input: string): ParsedInput | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (ASIN_REGEX.test(trimmed.toUpperCase())) {
    const asin = trimmed.toUpperCase();
    return {
      asin,
      marketplace: DEFAULT_MARKETPLACE,
      url: `https://www.${DEFAULT_MARKETPLACE}/dp/${asin}`,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!host.includes("amazon")) return null;

  const marketplace = host.startsWith("amazon.") ? host : DEFAULT_MARKETPLACE;

  const dpMatch = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  if (!dpMatch) return null;
  const asin = dpMatch[1].toUpperCase();

  return {
    asin,
    marketplace,
    url: `https://www.${marketplace}/dp/${asin}`,
  };
}

function acceptLanguage(marketplace: string): string {
  return MARKETPLACE_LANGUAGES[marketplace] ?? "en-US,en;q=0.9";
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchHtml(url: string, marketplace: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": acceptLanguage(marketplace),
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("Robot Check") || text.includes("captcha")) return null;
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

function extractTitle(html: string): string | null {
  const candidates = [
    /<span[^>]*id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i,
    /<title>([\s\S]*?)<\/title>/i,
  ];
  for (const re of candidates) {
    const v = firstMatch(html, re);
    if (v) return stripTags(v).replace(/\s*-\s*Amazon.*$/i, "").trim();
  }
  return null;
}

function extractHeroImage(html: string): string | null {
  const dynamic = firstMatch(
    html,
    /id=["']landingImage["'][^>]*data-a-dynamic-image=["']([^"']+)["']/i,
  );
  if (dynamic) {
    try {
      const decoded = decodeEntities(dynamic);
      const obj = JSON.parse(decoded.replace(/&quot;/g, '"'));
      const urls = Object.keys(obj);
      if (urls.length) return urls[0];
    } catch {
      // fall through
    }
  }
  const direct = firstMatch(
    html,
    /id=["']landingImage["'][^>]*src=["']([^"']+)["']/i,
  );
  if (direct) return direct;
  const og = firstMatch(html, /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  return og;
}

function extractBullets(html: string): string[] {
  const blockMatch = html.match(
    /id=["']feature-bullets["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
  );
  if (!blockMatch) return [];
  const items = blockMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
  return items
    .map((li) => stripTags(li))
    .filter((t) => t && !/^Make sure this fits/i.test(t))
    .slice(0, 8);
}

function extractDescription(html: string): string {
  const blocks = [
    firstMatch(html, /id=["']productDescription["']>([\s\S]*?)<\/div>/i),
    firstMatch(
      html,
      /id=["']aplus["'][\s\S]*?<div[^>]*class=["'][^"']*aplus-v2[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    ),
  ];
  return blocks
    .filter((b): b is string => Boolean(b))
    .map(stripTags)
    .join(" ")
    .slice(0, 1200);
}

function extractBrand(html: string): string | null {
  const byline = firstMatch(html, /id=["']bylineInfo["'][^>]*>([\s\S]*?)<\/a>/i);
  if (byline) {
    return stripTags(byline)
      .replace(/^Visit the\s*/i, "")
      .replace(/\s*Store$/i, "")
      .replace(/^Brand:\s*/i, "")
      .trim();
  }
  return null;
}

function extractPrice(html: string): string | null {
  const offscreen = firstMatch(
    html,
    /<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/i,
  );
  if (offscreen) return stripTags(offscreen);
  return null;
}

function extractCategory(html: string): string | null {
  const breadcrumb = firstMatch(
    html,
    /id=["']wayfinding-breadcrumbs_feature_div["'][\s\S]*?<\/div>/i,
  );
  if (breadcrumb) {
    const text = stripTags(breadcrumb);
    if (text) return text.split(/\s*›\s*|\s*>\s*/).slice(-3).join(" / ");
  }
  return null;
}

export async function fetchListing(
  parsed: ParsedInput,
): Promise<{ listing: ListingData; warning?: string }> {
  const html = await fetchHtml(parsed.url, parsed.marketplace);
  if (!html) {
    return {
      listing: {
        asin: parsed.asin,
        marketplace: parsed.marketplace,
        url: parsed.url,
        title: `Amazon listing ${parsed.asin}`,
        heroImage: null,
        bullets: [],
        description: "",
        brand: null,
        price: null,
        category: null,
      },
      warning: "listing fetch blocked or failed; using minimal context",
    };
  }

  return {
    listing: {
      asin: parsed.asin,
      marketplace: parsed.marketplace,
      url: parsed.url,
      title: extractTitle(html) ?? `Amazon listing ${parsed.asin}`,
      heroImage: extractHeroImage(html),
      bullets: extractBullets(html),
      description: extractDescription(html),
      brand: extractBrand(html),
      price: extractPrice(html),
      category: extractCategory(html),
    },
  };
}

export async function fetchReviews(
  parsed: ParsedInput,
  limit = 12,
): Promise<ReviewSample[]> {
  const url = `https://www.${parsed.marketplace}/product-reviews/${parsed.asin}/?reviewerType=all_reviews&sortBy=helpful`;
  const html = await fetchHtml(url, parsed.marketplace);
  if (!html) return [];

  const reviews: ReviewSample[] = [];
  const reviewBlocks = html.match(
    /<div[^>]*data-hook=["']review["'][\s\S]*?(?=<div[^>]*data-hook=["']review["']|<\/div>\s*<\/div>\s*<\/div>)/gi,
  );
  if (!reviewBlocks) return [];

  for (const block of reviewBlocks) {
    if (reviews.length >= limit) break;
    const ratingRaw = firstMatch(
      block,
      /data-hook=["']review-star-rating["'][^>]*>([\s\S]*?)<\/i>/i,
    );
    const rating = ratingRaw
      ? parseFloat(stripTags(ratingRaw).match(/[\d.]+/)?.[0] ?? "")
      : null;
    const titleRaw = firstMatch(
      block,
      /data-hook=["'](?:review-title|review-title-content)["'][\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
    );
    const bodyRaw = firstMatch(
      block,
      /data-hook=["']review-body["'][\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i,
    );

    const title = titleRaw ? stripTags(titleRaw) : "";
    const body = bodyRaw ? stripTags(bodyRaw) : "";
    if (!title && !body) continue;

    reviews.push({
      rating: Number.isFinite(rating) ? (rating as number) : null,
      title,
      body: body.slice(0, 800),
    });
  }
  return reviews;
}

export async function fetchCompetitorAsins(
  query: string,
  marketplace: string,
  limit = 3,
): Promise<string[]> {
  if (!query) return [];
  const url = `https://www.${marketplace}/s?k=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url, marketplace);
  if (!html) return [];
  const asins = new Set<string>();
  const re = /data-asin=["']([A-Z0-9]{10})["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    asins.add(m[1]);
    if (asins.size >= limit + 4) break;
  }
  return Array.from(asins).slice(0, limit + 4);
}

export async function fetchCompetitorListing(
  asin: string,
  marketplace: string,
): Promise<CompetitorListing | null> {
  const url = `https://www.${marketplace}/dp/${asin}`;
  const html = await fetchHtml(url, marketplace);
  if (!html) return null;
  return {
    asin,
    title: extractTitle(html) ?? "",
    bullets: extractBullets(html),
    heroImage: extractHeroImage(html),
  };
}
