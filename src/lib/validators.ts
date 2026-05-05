import { z } from "zod";

export const requestSchema = z.object({
  input: z
    .string()
    .trim()
    .min(3, "Provide an Amazon URL or ASIN")
    .max(2000, "Input too long"),
});

export type CreativeUpgradeRequest = z.infer<typeof requestSchema>;

export const creativeRecommendationSchema = z.object({
  slotNumber: z.number().int().min(1).max(9),
  slotPurpose: z.string().min(1),
  creativeTitle: z.string().min(1),
  whyThisMatters: z.string().min(1),
  visualDescription: z.string().min(1),
  onImageText: z.string().min(1),
  rationale: z.string().min(1),
  priorityScore: z.number().min(0).max(100),
  generatedImageUrl: z.string().url().optional().nullable(),
});

export const creativeUpgradeResultSchema = z.object({
  listingSummary: z.string().min(1),
  asin: z.string().min(1),
  marketplace: z.string().min(1),
  creativeRecommendations: z
    .array(creativeRecommendationSchema)
    .length(3, "Exactly 3 recommendations required"),
});

export type CreativeUpgradeResultParsed = z.infer<typeof creativeUpgradeResultSchema>;
