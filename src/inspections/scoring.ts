import type {
  Inspection,
  InspectionCategory,
  InspectionCategoryScore,
  InspectionChecklistItem
} from "./schema.js";

export const QUALITY_ALERT_THRESHOLD = 80;

export const CATEGORY_WEIGHTS: Record<InspectionCategory, number> = {
  cleanliness: 0.35,
  maintenance: 0.3,
  safety: 0.2,
  guest_readiness: 0.15
};

export type InspectionScoreSummary = {
  categoryScores: InspectionCategoryScore[];
  overallScore: number;
  benchmarkScore: number;
  alertTriggered: boolean;
};

export type PropertyQualityScore = {
  propertyId: string;
  score: number;
  benchmarkScore: number;
  alertTriggered: boolean;
  basedOnInspectionId: string;
  performedAt: string;
  inspectionCount: number;
  categoryScores: InspectionCategoryScore[];
};

export function scoreInspection(
  items: InspectionChecklistItem[],
  benchmarkScore = QUALITY_ALERT_THRESHOLD
): InspectionScoreSummary {
  const grouped = new Map<InspectionCategory, InspectionChecklistItem[]>();

  for (const item of items) {
    const bucket = grouped.get(item.category) ?? [];
    bucket.push(item);
    grouped.set(item.category, bucket);
  }

  const categoryScores = [...grouped.entries()].map(([category, bucket]) => {
    const totalWeight = bucket.reduce((sum, item) => sum + item.weight, 0);
    const weightedScore = bucket.reduce(
      (sum, item) => sum + item.score * item.weight,
      0
    );

    return {
      category,
      weight: CATEGORY_WEIGHTS[category],
      score: roundToTwoDecimals((weightedScore / totalWeight / 5) * 100)
    };
  });

  const totalCategoryWeight = categoryScores.reduce(
    (sum, category) => sum + category.weight,
    0
  );
  const weightedOverall = categoryScores.reduce(
    (sum, category) => sum + category.score * category.weight,
    0
  );
  const overallScore =
    totalCategoryWeight === 0
      ? 0
      : roundToTwoDecimals(weightedOverall / totalCategoryWeight);

  return {
    categoryScores,
    overallScore,
    benchmarkScore,
    alertTriggered: overallScore < benchmarkScore
  };
}

export function getPropertyQualityScore(
  propertyId: string,
  inspections: Inspection[]
): PropertyQualityScore | null {
  const propertyInspections = inspections
    .filter((inspection) => inspection.propertyId === propertyId)
    .sort((left, right) => right.performedAt.localeCompare(left.performedAt));

  const latest = propertyInspections[0];
  if (!latest) {
    return null;
  }

  return {
    propertyId,
    score: latest.overallScore,
    benchmarkScore: latest.benchmarkScore,
    alertTriggered: latest.alertTriggered,
    basedOnInspectionId: latest.id,
    performedAt: latest.performedAt,
    inspectionCount: propertyInspections.length,
    categoryScores: latest.categoryScores
  };
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
