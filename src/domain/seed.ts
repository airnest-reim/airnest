import type { DomainSeed } from "./schema.js";

export const initialDomainSeed: DomainSeed = {
  schemaVersion: "2026-04-05-initial-concierge-domain",
  properties: [
    {
      id: "prop_lisboa_alfama",
      code: "ALF-01",
      name: "Alfama Courtyard Residences",
      addressLine1: "Rua dos Remedios 120",
      city: "Lisbon",
      postalCode: "1100-453",
      countryCode: "PT",
      status: "active",
      ownerIds: ["owner_sofia_martins"],
      unitIds: ["unit_alfama_1a", "unit_alfama_2b"],
      createdAt: "2026-04-05T08:00:00.000Z",
      updatedAt: "2026-04-05T08:00:00.000Z"
    }
  ],
  owners: [
    {
      id: "owner_sofia_martins",
      fullName: "Sofia Martins",
      email: "sofia.martins@example.com",
      phone: "+351910000001",
      status: "active",
      propertyIds: ["prop_lisboa_alfama"],
      notes: "Prefers WhatsApp updates for maintenance incidents.",
      createdAt: "2026-04-05T08:00:00.000Z",
      updatedAt: "2026-04-05T08:00:00.000Z"
    }
  ],
  units: [
    {
      id: "unit_alfama_1a",
      propertyId: "prop_lisboa_alfama",
      label: "1A",
      floor: 1,
      bedroomCount: 2,
      bathroomCount: 1,
      occupancyStatus: "occupied",
      occupantIds: ["occupant_ines_rocha"],
      createdAt: "2026-04-05T08:00:00.000Z",
      updatedAt: "2026-04-05T08:00:00.000Z"
    },
    {
      id: "unit_alfama_2b",
      propertyId: "prop_lisboa_alfama",
      label: "2B",
      floor: 2,
      bedroomCount: 1,
      bathroomCount: 1,
      occupancyStatus: "vacant",
      occupantIds: [],
      createdAt: "2026-04-05T08:00:00.000Z",
      updatedAt: "2026-04-05T08:00:00.000Z"
    }
  ],
  occupants: [
    {
      id: "occupant_ines_rocha",
      fullName: "Ines Rocha",
      email: "ines.rocha@example.com",
      phone: "+351910000002",
      unitId: "unit_alfama_1a",
      leaseStatus: "active",
      moveInDate: "2026-03-01",
      createdAt: "2026-04-05T08:00:00.000Z",
      updatedAt: "2026-04-05T08:00:00.000Z"
    }
  ],
  serviceRequests: [
    {
      id: "request_leak_1a",
      propertyId: "prop_lisboa_alfama",
      unitId: "unit_alfama_1a",
      occupantId: "occupant_ines_rocha",
      category: "maintenance",
      priority: "high",
      status: "triaged",
      title: "Kitchen sink leak",
      description: "Water is dripping under the sink cabinet after each use.",
      reportedAt: "2026-04-05T08:15:00.000Z",
      createdAt: "2026-04-05T08:15:00.000Z",
      updatedAt: "2026-04-05T08:20:00.000Z"
    }
  ],
  maintenanceTasks: [
    {
      id: "task_plumber_1a",
      serviceRequestId: "request_leak_1a",
      propertyId: "prop_lisboa_alfama",
      unitId: "unit_alfama_1a",
      summary: "Inspect and repair sink trap leak in unit 1A",
      assignee: "Joao Plumbing",
      priority: "high",
      status: "scheduled",
      scheduledFor: "2026-04-06T09:00:00.000Z",
      createdAt: "2026-04-05T08:25:00.000Z",
      updatedAt: "2026-04-05T08:25:00.000Z"
    }
  ],
  inspections: []
};
