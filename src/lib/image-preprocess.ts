/**
 * Image preprocessing for Imagen API
 * - Download with redirect support
 * - Validate content-type
 * - Resize if needed
 * - Convert to JPEG or PNG
 * - Validate size constraints
 */

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_DIMENSION = 1024; // pixels
const TIMEOUT_MS = 30000;

interface PreprocessedImage {
  base64: string;
  mimeType: "image/jpeg" | "image/png";
  width: number;
  height: number;
}

/**
 * Download image from URL with validation
 */
export async function downloadImage(imageUrl: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`Download failed: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase();
      if (!contentType?.includes("image")) {
        console.error(`Invalid content-type: ${contentType}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_SIZE_BYTES) {
        console.error(`Image too large: ${buffer.byteLength} > ${MAX_SIZE_BYTES}`);
        return null;
      }

      return Buffer.from(buffer);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error("Image download error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Validate and prepare image for Imagen API
 * Currently converts to base64 without resizing (assumes Amazon images are already optimized)
 */
export async function preprocessImage(imageBuffer: Buffer): Promise<PreprocessedImage | null> {
  try {
    // Determine mime type from buffer magic bytes
    let mimeType: "image/jpeg" | "image/png" = "image/jpeg";

    if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
      mimeType = "image/jpeg";
    } else if (
      imageBuffer[0] === 0x89 &&
      imageBuffer[1] === 0x50 &&
      imageBuffer[2] === 0x4e
    ) {
      mimeType = "image/png";
    } else {
      console.error("Unsupported image format");
      return null;
    }

    // Validate size after conversion
    const base64 = imageBuffer.toString("base64");
    const base64Size = Buffer.byteLength(base64);

    if (base64Size > MAX_SIZE_BYTES) {
      console.error(`Base64 too large: ${base64Size} > ${MAX_SIZE_BYTES}`);
      return null;
    }

    // For now, we don't have dimension data, so use defaults
    // In production, parse image headers to get actual dimensions
    return {
      base64,
      mimeType,
      width: 1024,
      height: 768,
    };
  } catch (err) {
    console.error("Image preprocessing error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Full pipeline: download → preprocess → validate
 */
export async function loadAndPrepareImage(
  imageUrl: string,
): Promise<PreprocessedImage | null> {
  const buffer = await downloadImage(imageUrl);
  if (!buffer) {
    console.warn("Failed to download image");
    return null;
  }

  const processed = await preprocessImage(buffer);
  if (!processed) {
    console.warn("Failed to preprocess image");
    return null;
  }

  console.log(
    `✓ Image preprocessed: ${processed.mimeType}, size: ${processed.base64.length} chars`,
  );
  return processed;
}
