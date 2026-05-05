export type SlotPurpose =
  | "CTR / hero / click intent"
  | "core value"
  | "biggest buyer concern"
  | "differentiation"
  | "proof / objection handling"
  | "support / secondary proof";

export interface CreativeRecommendation {
  slotNumber: number;
  slotPurpose: SlotPurpose | string;
  creativeTitle: string;
  whyThisMatters: string;
  visualDescription: string;
  onImageText: string;
  rationale: string;
  priorityScore: number;
  generatedImageUrl?: string | null;
}

export interface CreativeUpgradeResult {
  listingSummary: string;
  asin: string;
  marketplace: string;
  creativeRecommendations: CreativeRecommendation[];
}

export interface ListingData {
  asin: string;
  marketplace: string;
  url: string;
  title: string;
  heroImage: string | null;
  bullets: string[];
  description: string;
  brand: string | null;
  price: string | null;
  category: string | null;
}

export interface ReviewSample {
  rating: number | null;
  title: string;
  body: string;
}

export interface CompetitorListing {
  asin: string;
  title: string;
  bullets: string[];
  heroImage: string | null;
}

export interface ReviewSignals {
  painPoints: string[];
  positiveClaims: string[];
  novelFeatures: string[];
}

export interface CompetitorSignals {
  commonVisualThemes: string[];
  competitorGaps: string[];
}

export interface IngestionBundle {
  listing: ListingData;
  reviews: ReviewSample[];
  competitors: CompetitorListing[];
  reviewSignals: ReviewSignals;
  competitorSignals: CompetitorSignals;
  warnings: string[];
}
