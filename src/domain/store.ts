import {
  type BookingAvailabilityInput,
  type BookingReservation,
  type CreateBookingReservationInput,
  type CreateMaintenanceTaskInput,
  type CreateOccupantInput,
  type CreateOwnerInput,
  type CreatePropertyInput,
  type CreateServiceRequestInput,
  type CreateUnitInput,
  type DomainSeed,
  type MaintenanceTask,
  type Occupant,
  type Owner,
  type Property,
  type ServiceRequest,
  type Unit,
  type UpdateMaintenanceTaskInput,
  type UpdateOccupantInput,
  type UpdateOwnerInput,
  type UpdatePropertyInput,
  type UpdateServiceRequestInput,
  type UpdateUnitInput,
  domainSeedSchema
} from "./schema.js";

type Collections = {
  properties: Map<string, Property>;
  owners: Map<string, Owner>;
  units: Map<string, Unit>;
  occupants: Map<string, Occupant>;
  serviceRequests: Map<string, ServiceRequest>;
  maintenanceTasks: Map<string, MaintenanceTask>;
  bookingReservations: Map<string, BookingReservation>;
};

export class DomainStoreError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
  }
}

export class DomainStore {
  readonly schemaVersion: string;
  readonly seededAt: string;
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

  private readonly collections: Collections;
  private idSequence = 0;

  constructor(seed: DomainSeed) {
    const parsedSeed = domainSeedSchema.parse(structuredClone(seed));
    this.schemaVersion = parsedSeed.schemaVersion;
    this.seededAt = new Date().toISOString();
    this.collections = {
      properties: new Map(parsedSeed.properties.map((item) => [item.id, item])),
      owners: new Map(parsedSeed.owners.map((item) => [item.id, item])),
      units: new Map(parsedSeed.units.map((item) => [item.id, item])),
      occupants: new Map(parsedSeed.occupants.map((item) => [item.id, item])),
      serviceRequests: new Map(
        parsedSeed.serviceRequests.map((item) => [item.id, item])
      ),
      maintenanceTasks: new Map(
        parsedSeed.maintenanceTasks.map((item) => [item.id, item])
      ),
      bookingReservations: new Map()
    };
    this.rebuildRelationships();
  }

  getMeta(): {
    schemaVersion: string;
    seededAt: string;
    counts: Record<string, number>;
    assumptions: string[];
    openQuestions: string[];
  } {
    return {
      schemaVersion: this.schemaVersion,
      seededAt: this.seededAt,
      counts: {
        properties: this.collections.properties.size,
        owners: this.collections.owners.size,
        units: this.collections.units.size,
        occupants: this.collections.occupants.size,
        serviceRequests: this.collections.serviceRequests.size,
        maintenanceTasks: this.collections.maintenanceTasks.size,
        bookingReservations: this.collections.bookingReservations.size
      },
      assumptions: this.assumptions,
      openQuestions: this.openQuestions
    };
  }

  listProperties(): Property[] {
    return this.list(this.collections.properties);
  }

  getProperty(id: string): Property {
    return this.get(this.collections.properties, id, "Property");
  }

  createProperty(input: CreatePropertyInput): Property {
    const now = this.now();
    const property: Property = {
      id: this.createId("property"),
      ownerIds: [],
      unitIds: [],
      createdAt: now,
      updatedAt: now,
      ...input
    };

    this.collections.properties.set(property.id, property);
    return property;
  }

  updateProperty(id: string, input: UpdatePropertyInput): Property {
    const property = this.getProperty(id);
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

    this.collections.properties.set(id, updated);
    return updated;
  }

  archiveProperty(id: string): Property {
    const property = this.getProperty(id);
    const archived: Property = {
      ...property,
      status: "offboarded",
      updatedAt: this.now()
    };

    this.collections.properties.set(id, archived);
    return archived;
  }

  deleteProperty(id: string): void {
    this.ensureNoDependents(
      this.listUnits().some((unit) => unit.propertyId === id) ||
        this.listServiceRequests().some((request) => request.propertyId === id) ||
        this.listMaintenanceTasks().some((task) => task.propertyId === id),
      "Property has linked units, service requests, or maintenance tasks."
    );
    this.collections.properties.delete(id);
    for (const owner of this.collections.owners.values()) {
      if (!owner.propertyIds.includes(id)) {
        continue;
      }

      this.collections.owners.set(owner.id, {
        ...owner,
        propertyIds: owner.propertyIds.filter((propertyId) => propertyId !== id),
        updatedAt: this.now()
      });
    }
  }

  listOwners(): Owner[] {
    return this.list(this.collections.owners);
  }

  getOwner(id: string): Owner {
    return this.get(this.collections.owners, id, "Owner");
  }

  createOwner(input: CreateOwnerInput): Owner {
    const now = this.now();
    const owner: Owner = {
      id: this.createId("owner"),
      propertyIds: [],
      createdAt: now,
      updatedAt: now,
      ...input
    };

    this.collections.owners.set(owner.id, owner);
    return owner;
  }

  updateOwner(id: string, input: UpdateOwnerInput): Owner {
    const owner = this.getOwner(id);
    if (input.propertyIds) {
      for (const propertyId of input.propertyIds) {
        this.requireProperty(propertyId);
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

    this.collections.owners.set(id, updated);
    this.rebuildRelationships();
    return this.getOwner(id);
  }

  deleteOwner(id: string): void {
    this.ensureNoDependents(
      this.listProperties().some((property) => property.ownerIds.includes(id)),
      "Owner is still linked to one or more properties."
    );
    this.collections.owners.delete(id);
  }

  listUnits(): Unit[] {
    return this.list(this.collections.units);
  }

  getUnit(id: string): Unit {
    return this.get(this.collections.units, id, "Unit");
  }

  createUnit(input: CreateUnitInput): Unit {
    this.requireProperty(input.propertyId);
    const now = this.now();
    const unit: Unit = {
      id: this.createId("unit"),
      occupantIds: [],
      createdAt: now,
      updatedAt: now,
      ...input
    };

    this.collections.units.set(unit.id, unit);
    this.rebuildRelationships();
    return this.getUnit(unit.id);
  }

  updateUnit(id: string, input: UpdateUnitInput): Unit {
    const current = this.getUnit(id);
    const nextPropertyId = input.propertyId ?? current.propertyId;
    this.requireProperty(nextPropertyId);
    const updated: Unit = {
      ...current,
      propertyId: nextPropertyId,
      label: input.label ?? current.label,
      floor: input.floor ?? current.floor,
      bedroomCount: input.bedroomCount ?? current.bedroomCount,
      bathroomCount: input.bathroomCount ?? current.bathroomCount,
      occupancyStatus: input.occupancyStatus ?? current.occupancyStatus,
      updatedAt: this.now()
    };

    this.collections.units.set(id, updated);
    this.rebuildRelationships();
    return this.getUnit(id);
  }

  deleteUnit(id: string): void {
    this.ensureNoDependents(
      this.listOccupants().some((occupant) => occupant.unitId === id) ||
        this.listServiceRequests().some((request) => request.unitId === id) ||
        this.listMaintenanceTasks().some((task) => task.unitId === id),
      "Unit has linked occupants, service requests, or maintenance tasks."
    );
    this.collections.units.delete(id);
    this.rebuildRelationships();
  }

  listOccupants(): Occupant[] {
    return this.list(this.collections.occupants);
  }

  getOccupant(id: string): Occupant {
    return this.get(this.collections.occupants, id, "Occupant");
  }

  createOccupant(input: CreateOccupantInput): Occupant {
    this.requireUnit(input.unitId);
    const now = this.now();
    const occupant: Occupant = {
      id: this.createId("occupant"),
      createdAt: now,
      updatedAt: now,
      ...input
    };

    this.collections.occupants.set(occupant.id, occupant);
    this.rebuildRelationships();
    return this.getOccupant(occupant.id);
  }

  updateOccupant(id: string, input: UpdateOccupantInput): Occupant {
    const current = this.getOccupant(id);
    const nextUnitId = input.unitId ?? current.unitId;
    this.requireUnit(nextUnitId);
    const updated: Occupant = {
      ...current,
      fullName: input.fullName ?? current.fullName,
      email: input.email ?? current.email,
      phone: input.phone ?? current.phone,
      unitId: nextUnitId,
      leaseStatus: input.leaseStatus ?? current.leaseStatus,
      moveInDate: input.moveInDate ?? current.moveInDate,
      moveOutDate: input.moveOutDate ?? current.moveOutDate,
      updatedAt: this.now()
    };

    this.collections.occupants.set(id, updated);
    this.rebuildRelationships();
    return this.getOccupant(id);
  }

  deleteOccupant(id: string): void {
    this.ensureNoDependents(
      this.listServiceRequests().some((request) => request.occupantId === id),
      "Occupant has linked service requests."
    );
    this.collections.occupants.delete(id);
    this.rebuildRelationships();
  }

  listServiceRequests(): ServiceRequest[] {
    return this.list(this.collections.serviceRequests);
  }

  getServiceRequest(id: string): ServiceRequest {
    return this.get(this.collections.serviceRequests, id, "Service request");
  }

  createServiceRequest(input: CreateServiceRequestInput): ServiceRequest {
    this.assertRequestReferences(input.propertyId, input.unitId, input.occupantId);
    const now = this.now();
    const request: ServiceRequest = {
      id: this.createId("service-request"),
      createdAt: now,
      updatedAt: now,
      ...input
    };

    this.collections.serviceRequests.set(request.id, request);
    return request;
  }

  updateServiceRequest(
    id: string,
    input: UpdateServiceRequestInput
  ): ServiceRequest {
    const current = this.getServiceRequest(id);
    const propertyId = input.propertyId ?? current.propertyId;
    const unitId = input.unitId ?? current.unitId;
    const occupantId = input.occupantId ?? current.occupantId;
    this.assertRequestReferences(propertyId, unitId, occupantId);

    const updated: ServiceRequest = {
      ...current,
      propertyId,
      unitId,
      occupantId,
      category: input.category ?? current.category,
      priority: input.priority ?? current.priority,
      status: input.status ?? current.status,
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      reportedAt: input.reportedAt ?? current.reportedAt,
      updatedAt: this.now()
    };

    this.collections.serviceRequests.set(id, updated);
    return updated;
  }

  deleteServiceRequest(id: string): void {
    this.ensureNoDependents(
      this.listMaintenanceTasks().some((task) => task.serviceRequestId === id),
      "Service request has linked maintenance tasks."
    );
    this.collections.serviceRequests.delete(id);
  }

  listMaintenanceTasks(): MaintenanceTask[] {
    return this.list(this.collections.maintenanceTasks);
  }

  getMaintenanceTask(id: string): MaintenanceTask {
    return this.get(this.collections.maintenanceTasks, id, "Maintenance task");
  }

  createMaintenanceTask(input: CreateMaintenanceTaskInput): MaintenanceTask {
    this.assertMaintenanceReferences(
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

    this.collections.maintenanceTasks.set(task.id, task);
    return task;
  }

  updateMaintenanceTask(
    id: string,
    input: UpdateMaintenanceTaskInput
  ): MaintenanceTask {
    const current = this.getMaintenanceTask(id);
    const propertyId = input.propertyId ?? current.propertyId;
    const unitId = input.unitId ?? current.unitId;
    const serviceRequestId = input.serviceRequestId ?? current.serviceRequestId;
    this.assertMaintenanceReferences(propertyId, unitId, serviceRequestId);

    const updated: MaintenanceTask = {
      ...current,
      propertyId,
      unitId,
      serviceRequestId,
      summary: input.summary ?? current.summary,
      assignee: input.assignee ?? current.assignee,
      priority: input.priority ?? current.priority,
      status: input.status ?? current.status,
      scheduledFor: input.scheduledFor ?? current.scheduledFor,
      completedAt: input.completedAt ?? current.completedAt,
      updatedAt: this.now()
    };

    this.collections.maintenanceTasks.set(id, updated);
    return updated;
  }

  deleteMaintenanceTask(id: string): void {
    this.collections.maintenanceTasks.delete(id);
  }

  listBookingReservations(): BookingReservation[] {
    return this.list(this.collections.bookingReservations);
  }

  getBookingReservation(id: string): BookingReservation {
    return this.get(
      this.collections.bookingReservations,
      id,
      "Booking reservation"
    );
  }

  checkBookingAvailability(input: BookingAvailabilityInput): {
    available: boolean;
    conflicts: BookingReservation[];
  } {
    this.assertBookingWindow(input.propertyId, input.unitId);

    const conflicts = this.findReservationConflicts(
      input.propertyId,
      input.unitId,
      input.startDate,
      input.endDate
    );

    return {
      available: conflicts.length === 0,
      conflicts
    };
  }

  createBookingReservation(
    input: CreateBookingReservationInput
  ): BookingReservation {
    this.assertBookingWindow(input.propertyId, input.unitId);
    const conflicts = this.findReservationConflicts(
      input.propertyId,
      input.unitId,
      input.startDate,
      input.endDate
    );
    if (conflicts.length > 0) {
      throw new DomainStoreError(
        "Booking reservation conflicts with an existing reservation.",
        409
      );
    }

    const now = this.now();
    const reservation: BookingReservation = {
      id: this.createId("reservation"),
      status: "confirmed",
      createdAt: now,
      updatedAt: now,
      ...input
    };

    this.collections.bookingReservations.set(reservation.id, reservation);
    return reservation;
  }

  cancelBookingReservation(id: string): BookingReservation {
    const reservation = this.getBookingReservation(id);
    if (reservation.status === "cancelled") {
      return reservation;
    }

    const cancelled: BookingReservation = {
      ...reservation,
      status: "cancelled",
      cancelledAt: this.now(),
      updatedAt: this.now()
    };

    this.collections.bookingReservations.set(id, cancelled);
    return cancelled;
  }

  private requireProperty(id: string): Property {
    return this.getProperty(id);
  }

  private requireUnit(id: string): Unit {
    return this.getUnit(id);
  }

  private requireOccupant(id: string): Occupant {
    return this.getOccupant(id);
  }

  private assertRequestReferences(
    propertyId: string,
    unitId?: string,
    occupantId?: string
  ): void {
    this.requireProperty(propertyId);

    if (unitId) {
      const unit = this.requireUnit(unitId);
      if (unit.propertyId !== propertyId) {
        throw new DomainStoreError(
          "Unit does not belong to the provided property."
        );
      }
    }

    if (occupantId) {
      const occupant = this.requireOccupant(occupantId);
      if (unitId && occupant.unitId !== unitId) {
        throw new DomainStoreError(
          "Occupant does not belong to the provided unit."
        );
      }
      if (!unitId) {
        const occupantUnit = this.requireUnit(occupant.unitId);
        if (occupantUnit.propertyId !== propertyId) {
          throw new DomainStoreError(
            "Occupant does not belong to the provided property."
          );
        }
      }
    }
  }

  private assertMaintenanceReferences(
    propertyId: string,
    unitId?: string,
    serviceRequestId?: string
  ): void {
    this.requireProperty(propertyId);

    if (unitId) {
      const unit = this.requireUnit(unitId);
      if (unit.propertyId !== propertyId) {
        throw new DomainStoreError(
          "Unit does not belong to the provided property."
        );
      }
    }

    if (serviceRequestId) {
      const request = this.getServiceRequest(serviceRequestId);
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

  private assertBookingWindow(propertyId: string, unitId?: string): void {
    const property = this.requireProperty(propertyId);
    if (property.status === "offboarded") {
      throw new DomainStoreError("Cannot create bookings for archived properties.");
    }

    if (!unitId) {
      throw new DomainStoreError("Booking availability requires a unit.");
    }

    const unit = this.requireUnit(unitId);
    if (unit.propertyId !== propertyId) {
      throw new DomainStoreError("Unit does not belong to the provided property.");
    }
  }

  private findReservationConflicts(
    propertyId: string,
    unitId: string | undefined,
    startDate: string,
    endDate: string
  ): BookingReservation[] {
    return this.listBookingReservations().filter((reservation) => {
      if (reservation.status !== "confirmed") {
        return false;
      }
      if (reservation.propertyId !== propertyId) {
        return false;
      }
      if (unitId && reservation.unitId !== unitId) {
        return false;
      }

      return startDate < reservation.endDate && reservation.startDate < endDate;
    });
  }

  private rebuildRelationships(): void {
    for (const property of this.collections.properties.values()) {
      property.ownerIds = [];
      property.unitIds = [];
    }

    for (const owner of this.collections.owners.values()) {
      owner.propertyIds = owner.propertyIds.filter((propertyId) =>
        this.collections.properties.has(propertyId)
      );
      for (const propertyId of owner.propertyIds) {
        const property = this.getProperty(propertyId);
        property.ownerIds = this.unique([...property.ownerIds, owner.id]);
      }
    }

    for (const unit of this.collections.units.values()) {
      const property = this.getProperty(unit.propertyId);
      property.unitIds = this.unique([...property.unitIds, unit.id]);
      unit.occupantIds = [];
    }

    for (const occupant of this.collections.occupants.values()) {
      const unit = this.getUnit(occupant.unitId);
      unit.occupantIds = this.unique([...unit.occupantIds, occupant.id]);
    }
  }

  private list<T>(collection: Map<string, T>): T[] {
    return [...collection.values()];
  }

  private get<T>(collection: Map<string, T>, id: string, label: string): T {
    const item = collection.get(id);
    if (!item) {
      throw new DomainStoreError(`${label} not found.`, 404);
    }

    return item;
  }

  private ensureNoDependents(condition: boolean, message: string): void {
    if (condition) {
      throw new DomainStoreError(message, 409);
    }
  }

  private createId(prefix: string): string {
    this.idSequence += 1;
    return `${prefix}_${this.idSequence}`;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private unique(values: string[]): string[] {
    return [...new Set(values)];
  }
}
