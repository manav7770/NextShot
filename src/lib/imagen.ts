import { GoogleAuth } from "google-auth-library";
import { getEnv, validateImagenSetup } from "@/lib/env";

const TIMEOUT_MS = 180000;

// Text-to-image only. imagen-3.0-generate-001 returns 500 when handed an `image` field;
// editing requires imagen-3.0-capability-001 (allowlisted) with referenceImages.
const IMAGEN_MODEL = "imagen-3.0-generate-002";

/**
 * Download image from URL and convert to base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error(`Failed to download image: ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return base64;
  } catch (err) {
    console.error("Image download error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Build Imagen prompt for the HERO slot.
 * Pure product photography. Zero text/typography of any kind.
 */
function buildImagenPrompt(productTitle: string): string {
  return `Photorealistic Amazon product hero image of the EXACT product (${productTitle}). Clean studio product photography. Product centered and fills most of the frame. Pure white or light neutral background. Soft, realistic lighting and shadows. High detail, sharp focus, premium ecommerce listing style. No clutter, no props unless necessary. Do not add any text, labels, or typography.

Absolutely no text, no typography, no letters, no numbers anywhere in the image.

photorealistic, studio product photography, ecommerce listing, clean white background, natural shadow, high detail, sharp focus, realistic lighting`;
}

/**
 * Get an access token for Vertex AI using service account credentials
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath) {
      console.error("GOOGLE_APPLICATION_CREDENTIALS not set");
      return null;
    }

    const auth = new GoogleAuth({
      keyFile: credPath,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      console.error("Failed to get access token");
      return null;
    }

    return accessToken.token;
  } catch (err) {
    console.error("Failed to get access token:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Call Imagen with retry logic for 429 rate limit errors
 * Retries once after 10 second delay if rate limited
 */
async function callImagenWithRetry(
  productImageUrl: string,
  visualDescription: string,
  onImageText: string,
  productTitle: string,
  retryCount: number = 0,
): Promise<string | null> {
  try {
    return await editProductImageInternal(
      productImageUrl,
      visualDescription,
      onImageText,
      productTitle,
    );
  } catch (err) {
    const isRateLimited = err instanceof Error && err.message.includes("429");
    if (isRateLimited && retryCount < 1) {
      console.log("Rate limited (429), waiting 10 seconds before retry...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return callImagenWithRetry(
        productImageUrl,
        visualDescription,
        onImageText,
        productTitle,
        retryCount + 1,
      );
    }
    throw err;
  }
}

/**
 * Edit product image using Google Vertex AI Imagen 3.0
 * Uses REST API with explicit credential-based authentication
 * Public wrapper that uses retry logic
 */
export async function editProductImage(
  productImageUrl: string | null,
  visualDescription: string,
  onImageText: string,
  productTitle: string,
): Promise<string | null> {
  if (!productImageUrl) {
    return null;
  }

  const setup = validateImagenSetup();
  if (!setup.available) {
    console.log("Imagen not available:", setup.message);
    return null;
  }

  try {
    return await callImagenWithRetry(
      productImageUrl,
      visualDescription,
      onImageText,
      productTitle,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Imagen generation failed:", message);
    return null;
  }
}

/**
 * Internal Imagen call without retry wrapper
 */
async function editProductImageInternal(
  productImageUrl: string,
  _visualDescription: string,
  _onImageText: string,
  productTitle: string,
): Promise<string | null> {
  try {
    const env = getEnv();
    const projectId = env.GOOGLE_CLOUD_PROJECT;
    const location = env.GOOGLE_CLOUD_LOCATION || "us-central1";

    if (!projectId) {
      console.error("GOOGLE_CLOUD_PROJECT not set");
      return null;
    }

    // Get access token with explicit credentials
    console.log("Getting access token with service account credentials...");
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error("Failed to get access token");
      return null;
    }

    // Download the product image (still useful to verify the source URL works,
    // but we do NOT send it to imagen-3.0-generate-002 — that model is text-to-image only.
    // Sending an `image` field caused 500 INTERNAL on the prior generate-001 call.)
    console.log("Downloading product image (for validation only)...");
    const imageBase64 = await downloadImageAsBase64(productImageUrl);
    if (!imageBase64) {
      console.warn("Could not download product image");
      return null;
    }
    const imageBytes = Math.floor((imageBase64.length * 3) / 4);

    // Build the prompt — pure product photography, zero text injected.
    const prompt = buildImagenPrompt(productTitle);
    const wordCount = prompt.split(/\s+/).filter(Boolean).length;

    // Vertex AI Imagen API endpoint
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${IMAGEN_MODEL}:predict`;

    const requestBody = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        negativePrompt:
          "text, typography, letters, numbers, words, captions, labels, headlines, watermark, logo, badge, sticker, sign, writing, font, subtitle",
      },
    };

    // Detailed pre-call diagnostics (sanitized — no base64 payload, no token)
    console.log(
      `Imagen request: model=${IMAGEN_MODEL} project=${projectId} location=${location} ` +
        `endpoint=${endpoint} promptChars=${prompt.length} promptWords=${wordCount} ` +
        `sourceImageBytes=${imageBytes} payloadKeys=${Object.keys(requestBody.instances[0]).join(",")} ` +
        `paramKeys=${Object.keys(requestBody.parameters).join(",")}`,
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`Imagen API response: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429) {
        throw new Error("429 Rate limit exceeded");
      }
      console.error(`Imagen API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      console.error("Imagen error:", data.error);
      return null;
    }

    // Extract image from predictions
    const predictions = data.predictions;
    if (!Array.isArray(predictions) || predictions.length === 0) {
      console.warn("No predictions in Imagen response");
      return null;
    }

    const imageData = predictions[0];
    if (!imageData?.bytesBase64Encoded) {
      console.warn("No image data in prediction");
      return null;
    }

    console.log("✓ Image generated successfully");
    const mimeType = imageData.mimeType || "image/jpeg";
    return `data:${mimeType};base64,${imageData.bytesBase64Encoded}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("429")) {
      throw err;
    }
    console.error("Imagen generation error:", message);
    return null;
  }
}
