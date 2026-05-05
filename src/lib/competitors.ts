import {
  fetchCompetitorAsins,
  fetchCompetitorListing,
} from "@/lib/amazon";
import type { CompetitorListing, ListingData } from "@/types/creative";

function buildSearchQuery(listing: ListingData): string {
  const tokens: string[] = [];
  if (listing.brand) tokens.push(listing.brand);
  if (listing.title) {
    const cleaned = listing.title
      .replace(/[–—]/g, " ")
      .replace(/[(){}\[\]"',]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6)
      .join(" ");
    tokens.push(cleaned);
  }
  return tokens.join(" ").trim().slice(0, 120);
}

export async function fetchCompetitors(
  listing: ListingData,
  max = 3,
): Promise<CompetitorListing[]> {
  const query = buildSearchQuery(listing);
  if (!query) return [];

  const candidates = await fetchCompetitorAsins(query, listing.marketplace, max);
  const filtered = candidates.filter((a) => a !== listing.asin).slice(0, max + 2);

  const results: CompetitorListing[] = [];
  for (const asin of filtered) {
    if (results.length >= max) break;
    const c = await fetchCompetitorListing(asin, listing.marketplace);
    if (c && c.title) results.push(c);
  }
  return results;
}
