import { NextResponse } from "next/server";
import fs from "fs";
import {
  fetchListing,
  fetchReviews,
  parseAmazonInput,
} from "@/lib/amazon";
import { fetchCompetitors } from "@/lib/competitors";
import {
  buildCompetitorSignals,
  buildReviewSignals,
} from "@/lib/review-signals";
import { runCreativeEngine } from "@/lib/creative-engine";
import { generateCreativeImage } from "@/lib/image-generator";
import { requestSchema } from "@/lib/validators";
import type { IngestionBundle } from "@/types/creative";

export const runtime = "nodejs";
export const maxDuration = 300;

// Diagnostic function to log env setup
function logEnvironmentSetup() {
  console.log("\n=== Environment Setup Diagnostic ===");
  console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log("GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT);
  console.log("GOOGLE_CLOUD_LOCATION:", process.env.GOOGLE_CLOUD_LOCATION);

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const exists = fs.existsSync(credPath);
    console.log(`File exists (${credPath}):`, exists);
  }
  console.log("====================================\n");
}

export async function POST(req: Request) {
  // Log environment on first call (remove later after debugging)
  logEnvironmentSetup();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedReq = requestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json(
      { error: parsedReq.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const parsed = parseAmazonInput(parsedReq.data.input);
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not detect a valid Amazon URL or ASIN" },
      { status: 400 },
    );
  }

  const warnings: string[] = [];

  const { listing, warning: listingWarn } = await fetchListing(parsed);
  if (listingWarn) warnings.push(listingWarn);

  const [reviews, competitors] = await Promise.all([
    fetchReviews(parsed).catch(() => []),
    fetchCompetitors(listing).catch(() => []),
  ]);
  if (reviews.length === 0) warnings.push("no public reviews could be read");
  if (competitors.length === 0)
    warnings.push("no competitor listings could be read");

  const reviewSignals = buildReviewSignals(reviews);
  const competitorSignals = buildCompetitorSignals(listing, competitors);

  const bundle: IngestionBundle = {
    listing,
    reviews,
    competitors,
    reviewSignals,
    competitorSignals,
    warnings,
  };

  try {
    const result = await runCreativeEngine(bundle);

    // Generate image for top creative only
    const topCreative = result.creativeRecommendations[0];
    if (!topCreative) {
      return NextResponse.json(
        { error: "No creative recommendations generated", warnings },
        { status: 502 },
      );
    }

    console.log("Generating image for top creative (Imagen call count: 1)");
    const generatedImageUrl = await generateCreativeImage(
      topCreative.visualDescription,
      topCreative.onImageText,
      listing.title,
      listing.heroImage,
    );

    const creativeWithImage = {
      ...topCreative,
      generatedImageUrl: generatedImageUrl || listing.heroImage,
    };

    return NextResponse.json({
      ...result,
      creativeRecommendations: [creativeWithImage],
      heroImage: listing.heroImage,
      sourceUrl: listing.url,
      warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Engine failed";
    return NextResponse.json(
      { error: message, warnings },
      { status: 502 },
    );
  }
}
