import { describe, expect, it } from "vitest";

import {
  getPropertyQualityScore,
  scoreInspection
} from "../src/inspections/scoring.js";
import type { Inspection } from "../src/inspections/schema.js";

describe("inspection scoring", () => {
  it("computes weighted category scores and overall score", () => {
    const scored = scoreInspection([
      {
        itemId: "clean-1",
        label: "Kitchen sanitized",
        category: "cleanliness",
        weight: 2,
        score: 5,
        photos: []
      },
      {
        itemId: "clean-2",
        label: "Bathroom restocked",
        category: "cleanliness",
        weight: 1,
        score: 4,
        photos: []
      },
      {
        itemId: "safety-1",
        label: "Extinguisher available",
        category: "safety",
        weight: 1,
        score: 3,
        photos: []
      }
    ]);

    expect(scored.categoryScores).toEqual([
      {
        category: "cleanliness",
        weight: 0.35,
        score: 93.33
      },
      {
        category: "safety",
        weight: 0.2,
        score: 60
      }
    ]);
    expect(scored.overallScore).toBe(81.21);
    expect(scored.alertTriggered).toBe(false);
  });

  it("uses the latest inspection as the current property quality score", () => {
    const inspections: Inspection[] = [
      {
        id: "inspection-old",
        propertyId: "property-1",
        inspector: "Ana",
        performedAt: "2026-04-04T10:00:00.000Z",
        items: [],
        categoryScores: [],
        overallScore: 78,
        benchmarkScore: 80,
        alertTriggered: true,
        createdAt: "2026-04-04T10:00:00.000Z",
        updatedAt: "2026-04-04T10:00:00.000Z"
      },
      {
        id: "inspection-new",
        propertyId: "property-1",
        inspector: "Miguel",
        performedAt: "2026-04-05T10:00:00.000Z",
        items: [],
        categoryScores: [],
        overallScore: 84,
        benchmarkScore: 80,
        alertTriggered: false,
        createdAt: "2026-04-05T10:00:00.000Z",
        updatedAt: "2026-04-05T10:00:00.000Z"
      }
    ];

    expect(getPropertyQualityScore("property-1", inspections)).toEqual({
      propertyId: "property-1",
      score: 84,
      benchmarkScore: 80,
      alertTriggered: false,
      basedOnInspectionId: "inspection-new",
      performedAt: "2026-04-05T10:00:00.000Z",
      inspectionCount: 2,
      categoryScores: []
    });
  });
});
