import { getAnthropic, getModel } from "@/lib/anthropic";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/prompts";
import { creativeUpgradeResultSchema } from "@/lib/validators";
import { simplifyOnImageText } from "@/lib/text-simplifier";
import type { CreativeUpgradeResult, IngestionBundle } from "@/types/creative";

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export async function runCreativeEngine(
  bundle: IngestionBundle,
): Promise<CreativeUpgradeResult> {
  const client = getAnthropic();
  const model = getModel();
  const userPrompt = buildUserPrompt(bundle);

  const response = await client.messages.create({
    model,
    max_tokens: 1800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Engine returned no text content");
  }

  const json = extractJsonObject(textBlock.text);
  if (!json) {
    throw new Error("Engine response did not contain JSON");
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(json);
  } catch {
    throw new Error("Engine response was not valid JSON");
  }

  const validated = creativeUpgradeResultSchema.safeParse(parsedRaw);
  if (!validated.success) {
    const issues = validated.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Engine output failed validation: ${issues}`);
  }

  const simplified = validated.data.creativeRecommendations.map((rec) => ({
    ...rec,
    onImageText: simplifyOnImageText(rec.onImageText),
  }));

  const sorted = [...simplified].sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    ...validated.data,
    creativeRecommendations: sorted,
  };
}
