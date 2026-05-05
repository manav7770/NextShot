import { z } from "zod";
import { existsSync } from "fs";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-7"),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().optional(),
});

let cached: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Validate Vertex AI Imagen configuration at startup.
 * Call this in server code to ensure proper setup before using Imagen.
 */
export function validateImagenSetup(): {
  available: boolean;
  projectId?: string;
  location?: string;
  message: string;
} {
  const env = getEnv();

  const hasCredentials = env.GOOGLE_APPLICATION_CREDENTIALS
    ? existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)
    : false;

  const hasProject = !!env.GOOGLE_CLOUD_PROJECT;
  const hasLocation = !!env.GOOGLE_CLOUD_LOCATION;

  if (!hasCredentials || !hasProject || !hasLocation) {
    return {
      available: false,
      message: `Imagen not fully configured. Missing: ${[
        !hasCredentials && "GOOGLE_APPLICATION_CREDENTIALS",
        !hasProject && "GOOGLE_CLOUD_PROJECT",
        !hasLocation && "GOOGLE_CLOUD_LOCATION",
      ]
        .filter(Boolean)
        .join(", ")}`,
    };
  }

  return {
    available: true,
    projectId: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
    message: "Imagen configured and ready",
  };
}
