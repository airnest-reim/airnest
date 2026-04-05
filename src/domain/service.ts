import { randomUUID } from "node:crypto";

import type {
  BookingAvailabilityInput,
  BookingPricing,
  BookingReservation,
  BookingStatusUpdateInput,
  CompleteMaintenanceTaskInput,
  CreateBookingReservationInput,
  CreateMaintenanceTaskInput,
  CreateOccupantInput,
  CreateOwnerInput,
  CreatePropertyInput,
  CreateServiceRequestInput,
  CreateUnitInput,
  MaintenanceTask,
  Occupant,
  Owner,
  Property,
  PropertyAvailabilityQuery,
  ScheduleMaintenanceTaskInput,
  ServiceRequest,
  TriageServiceRequestInput,
  Unit,
  UpdateMaintenanceTaskInput,
  UpdateOccupantInput,
  UpdateOwnerInput,
  UpdatePropertyInput,
  UpdateServiceRequestInput,
  UpdateUnitInput
} from "./schema.js";
import { MaintenanceTaskWorkflowService } from "./maintenance-task-workflows.js";
import { ServiceRequestWorkflowService } from "./service-request-workflows.js";
import type {
  CreateInspectionInput,
  Inspection
} from "../inspections/schema.js";
import {
  getPropertyQualityScore,
  scoreInspection,
  type PropertyQualityScore
} from "../inspections/scoring.js";
import type { DomainRepository } from "./repository.js";
import { serviceRequestCreatedEventPayloadSchema } from "../outbox/schema.js";
import {
  DomainStoreError,
  type BookingAvailabilityResult,
  type DomainMeta,
  type DomainStore
} from "./store.js";

type ServiceOptions = {
  repository: DomainRepository;
  schemaVersion: string;
  seededAt?: string;
};

export class ConciergeDomainService implements DomainStore {
  readonly assumptions: string[] = [
    "Each occupant belongs to exactly one unit.",
    "Service requests can reference a property, and optionally a unit and occupant.",
    "Maintenance tasks can exist independently or be linked to a service request."
  ];

  readonly openQuestions: string[] = [
    "Should one owner be allowed to manage multiple legal entities under a single account record?",
    "Do maintenance tasks need vendor cost tracking and approval state before execution?",
    "Should service requests support photo attachments and resident-visible timelines in the first dashboard release?"
  ];

  private readonly repository: DomainRepository;
  private readonly schemaVersion: string;
  private readonly seededAt: string;
  private readonly serviceRequestWorkflows: ServiceRequestWorkflowService;
  private readonly maintenanceTaskWorkflows: MaintenanceTaskWorkflowService;

  constructor(options: ServiceOptions) {
    this.repository = options.repository;
    this.schemaVersion = options.schemaVersion;
    this.seededAt = options.seededAt ?? new Date().toISOString();
    this.serviceRequestWorkflows = new ServiceRequestWorkflowService({
      repository: this.repository,
      now: () => this.now()
    });
    this.maintenanceTaskWorkflows = new MaintenanceTaskWorkflowService({
      repository: this.repository,
      now: () => this.now(),
      serviceRequests: this.serviceRequestWorkflows
    });
  }

  async getMeta(): Promise<DomainMeta> {
    return {
      schemaVersion: this.schemaVersion,
      seededAt: this.seededAt,
      counts: await this.repository.getCounts(),
      assumptions: this.assumptions,
      openQuestions: this.openQuestions
    };
  }

  listProperties(): Promise<Property[]> {
    return this.repository.listProperties();
  }

  async getProperty(id: string): Promise<Property> {
    return this.requireProperty(id);
  }

  async createProperty(input: CreatePropertyInput): Promise<Property> {
    const now = this.now();
    const property: Property = {
      id: this.createId("property"),
      ownerIds: [],
      unitIds: [],
      createdAt: now,
      updatedAt: now,
      ...input
    };

    await this.repository.createProperty(property);
    return this.getProperty(property.id);
  }

  async updateProperty(
    id: string,
    input: UpdatePropertyInput
  ): Promise<Property> {
    const property = await this.requireProperty(id);
    const updated: Property = {
      ...property,
      code: input.code ?? property.code,
      name: input.name ?? property.name,
      addressLine1: input.addressLine1 ?? property.addressLine1,
      addressLine2: input.addressLine2 ?? property.addressLine2,
      city: input.city ?? property.city,
      postalCode: input.postalCode ?? property.postalCode,
      countryCode: input.countryCode ?? property.countryCode,
      status: input.status ?? property.status,
      updatedAt: this.now()
    };

    await this.repository.updateProperty(updated);
    return this.getProperty(id);
  }

  async archiveProperty(id: string): Promise<Property> {
    const property = await this.requireProperty(id);
    await this.repository.updateProperty({
      ...property,
      status: "offboarded",
      updatedAt: this.now()
    });
    return this.getProperty(id);
  }

  async deleteProperty(id: string): Promise<void> {
    this.ensureNoDependents(
      (await this.listUnits()).some((unit) => unit.propertyId === id) ||
        (await this.listServiceRequests()).some(
          (request) => request.propertyId === id
        ) ||
        (await this.listMaintenanceTasks()).some(
          (task) => task.propertyId === id
        ),
      "Property has linked units, service requests, or maintenance tasks."
    );
    await this.repository.deleteProperty(id);
  }

  listOwners(): Promise<Owner[]> {
    return this.repository.listOwners();
  }

  async getOwner(id: string): Promise<Owner> {
    return this.requireOwner(id);
  }

  async createOwner(input: CreateOwnerInput): Promise<Owner> {
    const now = this.now();
    const owner: Owner = {
      id: this.createId("owner"),
      propertyIds: [],
      createdAt: now,
      updatedAt: now,
      ...input
    };

    await this.repository.createOwner(owner);
    return this.getOwner(owner.id);
  }

  async updateOwner(id: string, input: UpdateOwnerInput): Promise<Owner> {
    const owner = await this.requireOwner(id);

    if (input.propertyIds) {
      for (const propertyId of input.propertyIds) {
        await this.requireProperty(propertyId);
      }
    }

    const updated: Owner = {
      ...owner,
      fullName: input.fullName ?? owner.fullName,
      email: input.email ?? owner.email,
      phone: input.phone ?? owner.phone,
      status: input.status ?? owner.status,
      notes: input.notes ?? owner.notes,
      propertyIds: input.propertyIds ?? owner.propertyIds,
      updatedAt: this.now()
    };

    await this.repository.updateOwner(updated);
    return this.getOwner(id);
  }

  async deleteOwner(id: string): Promise<void> {
    this.ensureNoDependents(
      (await this.listProperties()).some((property) =>
        property.ownerIds.includes(id)
      ),
      "Owner is still linked to one or more properties."
    );
    await this.repository.deleteOwner(id);
  }

  listUnits(): Promise<Unit[]> {
    return this.repository.listUnits();
  }

  async getUnit(id: string): Promise<Unit> {
    return this.requireUnit(id);
  }

  async createUnit(input: CreateUnitInput): Promise<Unit> {
    await this.requireProperty(input.propertyId);
    const now = this.now();
    const unit: Unit = {
      id: this.createId("unit"),
      occupantIds: [],
      createdAt: now,
      updatedAt: now,
      ...input
    };

    await this.repository.createUnit(unit);
    return this.getUnit(unit.id);
  }

  async updateUnit(id: string, input: UpdateUnitInput): Promise<Unit> {
    const current = await this.requireUnit(id);
    const propertyId = input.propertyId ?? current.propertyId;
    await this.requireProperty(propertyId);

    await this.repository.updateUnit({
      ...current,
      propertyId,
      label: input.label ?? current.label,
      floor: input.floor ?? current.floor,
      bedroomCount: input.bedroomCount ?? current.bedroomCount,
      bathroomCount: input.bathroomCount ?? current.bathroomCount,
      occupancyStatus: input.occupancyStatus ?? current.occupancyStatus,
      updatedAt: this.now()
    });

    return this.getUnit(id);
  }

  async deleteUnit(id: string): Promise<void> {
    this.ensureNoDependents(
      (await this.listOccupants()).some((occupant) => occupant.unitId === id) ||
        (await this.listServiceRequests()).some(
          (request) => request.unitId === id
        ) ||
        (await this.listMaintenanceTasks()).some((task) => task.unitId === id),
      "Unit has linked occupants, service requests, or maintenance tasks."
    );
    await this.repository.deleteUnit(id);
  }

  listOccupants(): Promise<Occupant[]> {
    return this.repository.listOccupants();
  }

  async getOccupant(id: string): Promise<Occupant> {
    return this.requireOccupant(id);
  }

  async createOccupant(input: CreateOccupantInput): Promise<Occupant> {
    await this.requireUnit(input.unitId);
    const now = this.now();
    const occupant: Occupant = {
      id: this.createId("occupant"),
      createdAt: now,
      updatedAt: now,
      ...input
    };

    await this.repository.createOccupant(occupant);
    return this.getOccupant(occupant.id);
  }

  async updateOccupant(
    id: string,
    input: UpdateOccupantInput
  ): Promise<Occupant> {
    const current = await this.requireOccupant(id);
    const unitId = input.unitId ?? current.unitId;
    await this.requireUnit(unitId);

    const updated: Occupant = {
      ...current,
      fullName: input.fullName ?? current.fullName,
      email: input.email ?? current.email,
      phone: input.phone ?? current.phone,
      unitId,
      leaseStatus: input.leaseStatus ?? current.leaseStatus,
      moveInDate: input.moveInDate ?? current.moveInDate,
      moveOutDate: input.moveOutDate ?? current.moveOutDate,
      updatedAt: this.now()
    };

    await this.repository.updateOccupant(updated);
    return this.getOccupant(id);
  }

  async deleteOccupant(id: string): Promise<void> {
    this.ensureNoDependents(
      (await this.listServiceRequests()).some(
        (request) => request.occupantId === id
      ),
      "Occupant has linked service requests."
    );
    await this.repository.deleteOccupant(id);
  }

  listServiceRequests(): Promise<ServiceRequest[]> {
    return this.repository.listServiceRequests();
  }

  async getServiceRequest(id: string): Promise<ServiceRequest> {
    const request = await this.repository.getServiceRequest(id);
    if (!request) {
      throw new DomainStoreError("Service request not found.", 404);
    }

    return request;
  }

  async createServiceRequest(
    input: CreateServiceRequestInput
  ): Promise<ServiceRequest> {
    await this.assertRequestReferences(
      input.propertyId,
      input.unitId,
      input.occupantId
    );

    const now = this.now();
    const request: ServiceRequest = {
      id: this.createId("service-request"),
      createdAt: now,
      updatedAt: now,
      ...input
    };

    await this.repository.createServiceRequest(request);
    await this.repository.enqueueOutboxEvent({
      id: this.createId("outbox"),
      topic: "service_request.created",
      aggregateType: "service_request",
      aggregateId: request.id,
      payload: serviceRequestCreatedEventPayloadSchema.parse({
        serviceRequestId: request.id,
        propertyId: request.propertyId,
        unitId: request.unitId,
        occupantId: request.occupantId,
        category: request.category,
        priority: request.priority,
        title: request.title,
        reportedAt: request.reportedAt,
        occurredAt: now
      }),
      availableAt: now,
      createdAt: now,
      updatedAt: now
    });
    return this.getServiceRequest(request.id);
  }

  triageServiceRequest(
    id: string,
    input: TriageServiceRequestInput
  ): Promise<ServiceRequest> {
    return this.serviceRequestWorkflows.triage(id, input);
  }

  resolveServiceRequest(id: string): Promise<ServiceRequest> {
    return this.serviceRequestWorkflows.resolve(id);
  }

  cancelServiceRequest(id: string): Promise<ServiceRequest> {
    return this.serviceRequestWorkflows.cancel(id);
  }

  async updateServiceRequest(
    id: string,
    input: UpdateServiceRequestInput
  ): Promise<ServiceRequest> {
    const current = await this.getServiceRequest(id);
    const propertyId = input.propertyId ?? current.propertyId;
    const unitId = input.unitId ?? current.unitId;
    const occupantId = input.occupantId ?? current.occupantId;

    await this.assertRequestReferences(propertyId, unitId, occupantId);

    await this.repository.updateServiceRequest({
      ...current,
      propertyId,
      unitId,
      occupantId,
      category: input.category ?? current.category,
      priority: input.priority ?? current.priority,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      reportedAt: input.reportedAt ?? current.reportedAt,
      updatedAt: this.now()
    });

    return this.getServiceRequest(id);
  }

  async deleteServiceRequest(id: string): Promise<void> {
    this.ensureNoDependents(
      (await this.listMaintenanceTasks()).some(
        (task) => task.serviceRequestId === id
      ),
      "Service request has linked maintenance tasks."
    );
    await this.repository.deleteServiceRequest(id);
  }

  listMaintenanceTasks(): Promise<MaintenanceTask[]> {
    return this.repository.listMaintenanceTasks();
  }

  async getMaintenanceTask(id: string): Promise<MaintenanceTask> {
    const task = await this.repository.getMaintenanceTask(id);
    if (!task) {
      throw new DomainStoreError("Maintenance task not found.", 404);
    }

    return task;
  }

  async createMaintenanceTask(
    input: CreateMaintenanceTaskInput
  ): Promise<MaintenanceTask> {
    await this.assertMaintenanceReferences(
      input.propertyId,
      input.unitId,
      input.serviceRequestId
    );

    const now = this.now();
    const task: MaintenanceTask = {
      id: this.createId("maintenance-task"),
      createdAt: now,
      updatedAt: now,
      ...input
    };

    await this.repository.createMaintenanceTask(task);
    return this.getMaintenanceTask(task.id);
  }

  scheduleMaintenanceTask(
    id: string,
    input: ScheduleMaintenanceTaskInput
  ): Promise<MaintenanceTask> {
    return this.maintenanceTaskWorkflows.schedule(id, input);
  }

  startMaintenanceTask(id: string): Promise<MaintenanceTask> {
    return this.maintenanceTaskWorkflows.start(id);
  }

  completeMaintenanceTask(
    id: string,
    input: CompleteMaintenanceTaskInput
  ): Promise<MaintenanceTask> {
    return this.maintenanceTaskWorkflows.complete(id, input);
  }

  cancelMaintenanceTask(id: string): Promise<MaintenanceTask> {
    return this.maintenanceTaskWorkflows.cancel(id);
  }

  async updateMaintenanceTask(
    id: string,
    input: UpdateMaintenanceTaskInput
  ): Promise<MaintenanceTask> {
    const current = await this.getMaintenanceTask(id);
    const propertyId = input.propertyId ?? current.propertyId;
    const unitId = input.unitId ?? current.unitId;
    const serviceRequestId = input.serviceRequestId ?? current.serviceRequestId;

    await this.assertMaintenanceReferences(
      propertyId,
      unitId,
      serviceRequestId
    );

    await this.repository.updateMaintenanceTask({
      ...current,
      propertyId,
      unitId,
      serviceRequestId,
      summary: input.summary ?? current.summary,
      assignee: input.assignee ?? current.assignee,
      priority: input.priority ?? current.priority,
      updatedAt: this.now()
    });

    return this.getMaintenanceTask(id);
  }

  deleteMaintenanceTask(id: string): Promise<void> {
    return this.repository.deleteMaintenanceTask(id);
  }

  async checkBookingAvailability(
    input: BookingAvailabilityInput
  ): Promise<BookingAvailabilityResult> {
    return this.buildBookingAvailability(input.propertyId, {
      unitId: input.unitId,
      startDate: input.startDate,
      endDate: input.endDate
    });
  }

  getPropertyAvailability(
    propertyId: string,
    query: PropertyAvailabilityQuery
  ): Promise<BookingAvailabilityResult> {
    return this.buildBookingAvailability(propertyId, query);
  }

  getBookingReservation(id: string): Promise<BookingReservation> {
    return this.requireBookingReservation(id);
  }

  async createBookingReservation(
    input: CreateBookingReservationInput
  ): Promise<BookingReservation> {
    const availability = await this.buildBookingAvailability(input.propertyId, {
      unitId: input.unitId,
      startDate: input.startDate,
      endDate: input.endDate
    });

    if (!availability.meetsMinimumStay) {
      throw new DomainStoreError(
        `Booking must satisfy the ${availability.minimumStayNights}-night minimum stay.`
      );
    }

    if (availability.blockedRanges.length > 0) {
      throw new DomainStoreError(
        "Booking dates overlap a blocked availability window."
      );
    }

    if (availability.conflicts.length > 0) {
      throw new DomainStoreError(
        "Booking reservation conflicts with an existing reservation.",
        409
      );
    }

    const now = this.now();
    const reservation: BookingReservation = {
      id: this.createId("reservation"),
      status: "created",
      pricing: availability.pricing,
      createdAt: now,
      updatedAt: now,
      ...input
    };

    try {
      await this.repository.createBookingReservation(reservation);
    } catch (error) {
      if (error instanceof DomainStoreError) {
        throw error;
      }

      throw error;
    }

    return this.requireBookingReservation(reservation.id);
  }

  async updateBookingReservationStatus(
    id: string,
    input: BookingStatusUpdateInput
  ): Promise<BookingReservation> {
    const reservation = await this.requireBookingReservation(id);

    if (input.status === "cancelled") {
      return this.cancelBookingReservation(id);
    }

    if (reservation.status === input.status) {
      return reservation;
    }

    this.assertBookingStatusTransition(reservation.status, input.status);

    const now = this.now();
    const updated: BookingReservation = {
      ...reservation,
      status: input.status,
      updatedAt: now
    };

    if (input.status === "confirmed") {
      updated.confirmedAt = updated.confirmedAt ?? now;
    }
    if (input.status === "checked_in") {
      updated.checkedInAt = updated.checkedInAt ?? now;
    }
    if (input.status === "checked_out") {
      updated.checkedOutAt = updated.checkedOutAt ?? now;
    }
    if (input.status === "reviewed") {
      updated.reviewedAt = updated.reviewedAt ?? now;
    }

    await this.repository.updateBookingReservation(updated);
    return this.requireBookingReservation(id);
  }

  async cancelBookingReservation(id: string): Promise<BookingReservation> {
    const reservation = await this.requireBookingReservation(id);

    if (reservation.status === "cancelled") {
      return reservation;
    }

    this.assertBookingStatusTransition(reservation.status, "cancelled");

    await this.repository.updateBookingReservation({
      ...reservation,
      status: "cancelled",
      cancelledAt: this.now(),
      updatedAt: this.now()
    });

    return this.requireBookingReservation(id);
  }

  async createInspection(
    propertyId: string,
    input: CreateInspectionInput
  ): Promise<Inspection> {
    await this.requireProperty(propertyId);

    const now = this.now();
    const scoreSummary = scoreInspection(input.items);
    const inspection: Inspection = {
      id: this.createId("inspection"),
      propertyId,
      inspector: input.inspector,
      performedAt: input.performedAt,
      items: input.items,
      categoryScores: scoreSummary.categoryScores,
      overallScore: scoreSummary.overallScore,
      benchmarkScore: scoreSummary.benchmarkScore,
      alertTriggered: scoreSummary.alertTriggered,
      createdAt: now,
      updatedAt: now
    };

    if (input.notes) {
      inspection.notes = input.notes;
    }

    await this.repository.createInspection(inspection);
    return this.getInspection(inspection.id);
  }

  async listPropertyInspections(propertyId: string): Promise<Inspection[]> {
    await this.requireProperty(propertyId);
    return (await this.repository.listInspections()).filter(
      (inspection) => inspection.propertyId === propertyId
    );
  }

  async getPropertyQualityScore(
    propertyId: string
  ): Promise<PropertyQualityScore> {
    await this.requireProperty(propertyId);
    const qualityScore = getPropertyQualityScore(
      propertyId,
      await this.repository.listInspections()
    );

    if (!qualityScore) {
      throw new DomainStoreError("No inspections found for property.", 404);
    }

    return qualityScore;
  }

  async listInspectionAlerts(): Promise<
    Array<
      PropertyQualityScore & {
        propertyName: string;
      }
    >
  > {
    const properties = await this.listProperties();
    const inspections = await this.repository.listInspections();

    return properties
      .map((property) => {
        const qualityScore = getPropertyQualityScore(property.id, inspections);
        if (!qualityScore || !qualityScore.alertTriggered) {
          return null;
        }

        return {
          ...qualityScore,
          propertyName: property.name
        };
      })
      .filter((item) => item !== null);
  }

  private async requireBookingReservation(
    id: string
  ): Promise<BookingReservation> {
    const reservation = await this.repository.getBookingReservation(id);
    if (!reservation) {
      throw new DomainStoreError("Booking reservation not found.", 404);
    }

    return reservation;
  }

  private async requireProperty(id: string): Promise<Property> {
    const property = await this.repository.getProperty(id);
    if (!property) {
      throw new DomainStoreError("Property not found.", 404);
    }

    return property;
  }

  private async requireOwner(id: string): Promise<Owner> {
    const owner = await this.repository.getOwner(id);
    if (!owner) {
      throw new DomainStoreError("Owner not found.", 404);
    }

    return owner;
  }

  private async requireUnit(id: string): Promise<Unit> {
    const unit = await this.repository.getUnit(id);
    if (!unit) {
      throw new DomainStoreError("Unit not found.", 404);
    }

    return unit;
  }

  private async requireOccupant(id: string): Promise<Occupant> {
    const occupant = await this.repository.getOccupant(id);
    if (!occupant) {
      throw new DomainStoreError("Occupant not found.", 404);
    }

    return occupant;
  }

  private async getInspection(id: string): Promise<Inspection> {
    const inspection = await this.repository.getInspection(id);
    if (!inspection) {
      throw new DomainStoreError("Inspection not found.", 404);
    }

    return inspection;
  }

  private async assertRequestReferences(
    propertyId: string,
    unitId?: string,
    occupantId?: string
  ): Promise<void> {
    await this.requireProperty(propertyId);

    if (unitId) {
      const unit = await this.requireUnit(unitId);
      if (unit.propertyId !== propertyId) {
        throw new DomainStoreError(
          "Unit does not belong to the provided property."
        );
      }
    }

    if (occupantId) {
      const occupant = await this.requireOccupant(occupantId);
      if (unitId && occupant.unitId !== unitId) {
        throw new DomainStoreError(
          "Occupant does not belong to the provided unit."
        );
      }
      if (!unitId) {
        const occupantUnit = await this.requireUnit(occupant.unitId);
        if (occupantUnit.propertyId !== propertyId) {
          throw new DomainStoreError(
            "Occupant does not belong to the provided property."
          );
        }
      }
    }
  }

  private async assertMaintenanceReferences(
    propertyId: string,
    unitId?: string,
    serviceRequestId?: string
  ): Promise<void> {
    await this.requireProperty(propertyId);

    if (unitId) {
      const unit = await this.requireUnit(unitId);
      if (unit.propertyId !== propertyId) {
        throw new DomainStoreError(
          "Unit does not belong to the provided property."
        );
      }
    }

    if (serviceRequestId) {
      const request = await this.getServiceRequest(serviceRequestId);
      if (request.propertyId !== propertyId) {
        throw new DomainStoreError(
          "Service request does not belong to the provided property."
        );
      }
      if (unitId && request.unitId && request.unitId !== unitId) {
        throw new DomainStoreError(
          "Service request does not belong to the provided unit."
        );
      }
    }
  }

  private async assertBookingWindow(
    propertyId: string,
    unitId: string
  ): Promise<Property> {
    const property = await this.requireProperty(propertyId);
    if (property.status === "offboarded") {
      throw new DomainStoreError(
        "Cannot create bookings for archived properties."
      );
    }

    const unit = await this.requireUnit(unitId);
    if (unit.propertyId !== propertyId) {
      throw new DomainStoreError(
        "Unit does not belong to the provided property."
      );
    }

    return property;
  }

  private async findReservationConflicts(
    propertyId: string,
    unitId: string,
    startDate: string,
    endDate: string
  ): Promise<BookingReservation[]> {
    return (await this.repository.listBookingReservations()).filter(
      (reservation) => {
        if (reservation.status === "cancelled") {
          return false;
        }
        if (reservation.propertyId !== propertyId) {
          return false;
        }
        if (reservation.unitId !== unitId) {
          return false;
        }

        return (
          startDate < reservation.endDate && reservation.startDate < endDate
        );
      }
    );
  }

  private async buildBookingAvailability(
    propertyId: string,
    query: PropertyAvailabilityQuery
  ): Promise<BookingAvailabilityResult> {
    const property = await this.assertBookingWindow(propertyId, query.unitId);
    const nights = this.calculateNightCount(query.startDate, query.endDate);
    const blockedRanges = property.bookingPolicy.blockedRanges.filter((range) =>
      this.dateRangesOverlap(
        query.startDate,
        query.endDate,
        range.startDate,
        range.endDate
      )
    );
    const conflicts = await this.findReservationConflicts(
      propertyId,
      query.unitId,
      query.startDate,
      query.endDate
    );
    const meetsMinimumStay = nights >= property.bookingPolicy.minimumStayNights;

    return {
      propertyId,
      unitId: query.unitId,
      startDate: query.startDate,
      endDate: query.endDate,
      nights,
      meetsMinimumStay,
      minimumStayNights: property.bookingPolicy.minimumStayNights,
      blockedRanges,
      available:
        meetsMinimumStay && blockedRanges.length === 0 && conflicts.length === 0,
      conflicts,
      pricing: this.calculateBookingPricing(
        property.bookingPolicy,
        query.startDate,
        query.endDate
      )
    };
  }

  private calculateBookingPricing(
    policy: Property["bookingPolicy"],
    startDate: string,
    endDate: string
  ): BookingPricing {
    const nights = this.calculateNightCount(startDate, endDate);
    let baseRateTotal = 0;
    let seasonalAdjustmentTotal = 0;

    for (const night of this.enumerateStayDates(startDate, endDate)) {
      baseRateTotal += policy.baseNightlyRate;
      const multiplier =
        policy.seasonalPricing.find(
          (rule) => night >= rule.startDate && night < rule.endDate
        )?.multiplier ?? 1;
      seasonalAdjustmentTotal += policy.baseNightlyRate * (multiplier - 1);
    }

    const eligibleDiscount = policy.lengthOfStayDiscounts
      .filter((rule) => nights >= rule.minimumNights)
      .sort((left, right) => right.minimumNights - left.minimumNights)[0];
    const subtotalBeforeDiscount = baseRateTotal + seasonalAdjustmentTotal;
    const lengthOfStayDiscountTotal = eligibleDiscount
      ? subtotalBeforeDiscount * eligibleDiscount.percentage
      : 0;
    const total =
      subtotalBeforeDiscount - lengthOfStayDiscountTotal + policy.cleaningFee;

    return {
      currency: policy.currency,
      nights,
      baseRateTotal: this.roundCurrency(baseRateTotal),
      seasonalAdjustmentTotal: this.roundCurrency(seasonalAdjustmentTotal),
      lengthOfStayDiscountTotal: this.roundCurrency(
        lengthOfStayDiscountTotal
      ),
      cleaningFee: this.roundCurrency(policy.cleaningFee),
      total: this.roundCurrency(total)
    };
  }

  private assertBookingStatusTransition(
    currentStatus: BookingReservation["status"],
    nextStatus: BookingReservation["status"]
  ): void {
    const allowedTransitions: Record<
      BookingReservation["status"],
      BookingReservation["status"][]
    > = {
      created: ["confirmed", "cancelled"],
      confirmed: ["checked_in", "cancelled"],
      checked_in: ["checked_out"],
      checked_out: ["reviewed"],
      reviewed: [],
      cancelled: []
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new DomainStoreError(
        `Cannot transition booking from ${currentStatus} to ${nextStatus}.`
      );
    }
  }

  private calculateNightCount(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    return Math.round((end.getTime() - start.getTime()) / 86_400_000);
  }

  private enumerateStayDates(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    while (current < end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }

  private dateRangesOverlap(
    leftStart: string,
    leftEnd: string,
    rightStart: string,
    rightEnd: string
  ): boolean {
    return leftStart < rightEnd && rightStart < leftEnd;
  }

  private roundCurrency(value: number): number {
    return Number(value.toFixed(2));
  }

  private ensureNoDependents(condition: boolean, message: string): void {
    if (condition) {
      throw new DomainStoreError(message, 409);
    }
  }

  private createId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }

  private now(): string {
    return new Date().toISOString();
  }
}
