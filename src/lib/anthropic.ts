import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "@/lib/env";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (client) return client;
  const env = getEnv();
  client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export function getModel(): string {
  return getEnv().ANTHROPIC_MODEL;
}
