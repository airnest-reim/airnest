import { z } from "zod";

const idSchema = z.string().min(1);
const isoDateTimeSchema = z.string().datetime({ offset: true });

export const inspectionCategorySchema = z.enum([
  "cleanliness",
  "maintenance",
  "safety",
  "guest_readiness"
]);

export const inspectionChecklistItemSchema = z.object({
  itemId: idSchema,
  label: z.string().min(1),
  category: inspectionCategorySchema,
  weight: z.number().positive(),
  score: z.number().min(0).max(5),
  notes: z.string().min(1).optional(),
  photos: z.array(z.string().url()).default([])
});

export const inspectionCategoryScoreSchema = z.object({
  category: inspectionCategorySchema,
  weight: z.number().positive(),
  score: z.number().min(0).max(100)
});

export const inspectionSchema = z.object({
  id: idSchema,
  propertyId: idSchema,
  inspector: z.string().min(1),
  performedAt: isoDateTimeSchema,
  notes: z.string().min(1).optional(),
  items: z.array(inspectionChecklistItemSchema).min(1),
  categoryScores: z.array(inspectionCategoryScoreSchema).min(1),
  overallScore: z.number().min(0).max(100),
  benchmarkScore: z.number().min(0).max(100),
  alertTriggered: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const createInspectionInputSchema = inspectionSchema.omit({
  id: true,
  propertyId: true,
  categoryScores: true,
  overallScore: true,
  benchmarkScore: true,
  alertTriggered: true,
  createdAt: true,
  updatedAt: true
});

export type InspectionCategory = z.infer<typeof inspectionCategorySchema>;
export type InspectionChecklistItem = z.infer<
  typeof inspectionChecklistItemSchema
>;
export type InspectionCategoryScore = z.infer<
  typeof inspectionCategoryScoreSchema
>;
export type Inspection = z.infer<typeof inspectionSchema>;
export type CreateInspectionInput = z.infer<typeof createInspectionInputSchema>;
