import { editProductImage } from "@/lib/imagen";
import { getEnv } from "@/lib/env";

const TIMEOUT_MS = 120000;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message: string;
  };
}

/**
 * Generate an upgraded creative image.
 *
 * Strategy:
 * 1. Try to edit the original product image using Imagen (preferred)
 * 2. Fall back to SVG placeholder if Imagen not available or fails
 */
export async function generateCreativeImage(
  visualDescription: string,
  onImageText: string,
  productTitle: string,
  productImageUrl?: string | null,
): Promise<string | null> {
  const env = getEnv();

  // First: Try Imagen-based image editing if we have the product image and credentials
  if (productImageUrl && env.GOOGLE_APPLICATION_CREDENTIALS) {
    const editedImage = await editProductImage(
      productImageUrl,
      visualDescription,
      onImageText,
      productTitle,
    );

    if (editedImage) {
      return editedImage;
    }
  }

  // Fallback: Use Gemini + SVG if Imagen not available
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const enhancedBrief = await getEnhancedBrief(
      productTitle,
      visualDescription,
      onImageText,
      env.GEMINI_API_KEY,
    );

    const svgImage = createCreativeSVG(
      productTitle,
      onImageText,
      enhancedBrief,
    );

    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgImage).toString("base64")}`;
    return svgDataUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("abort")) {
      console.error("Creative generation error:", message);
    }
    return null;
  }
}

async function getEnhancedBrief(
  productTitle: string,
  visualDescription: string,
  onImageText: string,
  apiKey: string,
): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Summarize this creative brief for a product image in 1-2 sentences max:
Product: ${productTitle}
Visual: ${visualDescription}
Text: ${onImageText}

Be very concise.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 150,
            },
          }),
          signal: controller.signal,
        },
      );

      if (response.ok) {
        const data = (await response.json()) as GeminiResponse;
        const summary =
          data.candidates?.[0]?.content?.parts?.[0]?.text || visualDescription;
        return summary.slice(0, 200);
      }

      return visualDescription;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return visualDescription;
  }
}

function createCreativeSVG(
  productTitle: string,
  onImageText: string,
  brief: string,
): string {
  const colors = [
    "#FF7A1A", // accent orange
    "#0B0C0E", // dark ink
    "#1A1C20", // soft ink
    "#F5F5F5", // light text
  ];

  const bgColor = colors[1];
  const accentColor = colors[0];
  const textColor = colors[3];

  const wrapText = (text: string, maxWidth: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + word).length > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const titleLines = wrapText(productTitle, 40);
  const textLines = wrapText(onImageText, 35);
  const briefLines = wrapText(brief, 50);

  let yPos = 40;
  let svgContent = "";

  titleLines.forEach((line, idx) => {
    svgContent += `<text x="20" y="${yPos + idx * 28}" font-size="24" font-weight="bold" fill="${textColor}" font-family="Arial, sans-serif">${escapeXml(line)}</text>`;
  });

  yPos += titleLines.length * 28 + 30;

  svgContent += `<rect x="10" y="${yPos - 15}" width="980" height="${textLines.length * 24 + 10}" fill="${accentColor}" opacity="0.15" rx="4"/>`;
  textLines.forEach((line, idx) => {
    svgContent += `<text x="20" y="${yPos + idx * 24}" font-size="18" font-weight="600" fill="${accentColor}" font-family="Arial, sans-serif">${escapeXml(line)}</text>`;
  });

  yPos += textLines.length * 24 + 25;

  svgContent += `<text x="20" y="${yPos}" font-size="13" fill="${textColor}" opacity="0.8" font-family="Arial, sans-serif" font-style="italic">Creative Brief:</text>`;
  yPos += 18;
  briefLines.forEach((line, idx) => {
    svgContent += `<text x="20" y="${yPos + idx * 16}" font-size="12" fill="${textColor}" opacity="0.7" font-family="Arial, sans-serif">${escapeXml(line)}</text>`;
  });

  const totalHeight = Math.max(yPos + briefLines.length * 16 + 30, 400);

  return `<svg width="1024" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:#1a1c20;stop-opacity:1" />
    <stop offset="100%" style="stop-color:#0b0c0e;stop-opacity:1" />
  </linearGradient>
</defs>
<rect width="1024" height="${totalHeight}" fill="url(#grad)"/>
<rect x="0" y="0" width="1024" height="8" fill="${accentColor}"/>
${svgContent}
</svg>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
