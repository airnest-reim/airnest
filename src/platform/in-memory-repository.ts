import type {
  BookingReservation,
  DomainSeed,
  MaintenanceTask,
  Occupant,
  Owner,
  Property,
  ServiceRequest,
  Unit
} from "../domain/schema.js";
import type { Inspection } from "../inspections/schema.js";
import { domainSeedSchema } from "../domain/schema.js";
import type { DomainRepository } from "../domain/repository.js";
import type { DomainCounts } from "../domain/store.js";
import type {
  ClaimOutboxEventsInput,
  CompleteOutboxEventInput,
  EnqueueOutboxEventInput,
  OutboxEvent,
  OutboxEventStatus,
  ReleaseOutboxEventInput
} from "../outbox/schema.js";

type Collections = {
  properties: Map<string, Property>;
  owners: Map<string, Owner>;
  units: Map<string, Unit>;
  occupants: Map<string, Occupant>;
  serviceRequests: Map<string, ServiceRequest>;
  maintenanceTasks: Map<string, MaintenanceTask>;
  bookingReservations: Map<string, BookingReservation>;
  inspections: Map<string, Inspection>;
  outboxEvents: Map<string, OutboxEvent>;
};

export class InMemoryDomainRepository implements DomainRepository {
  private readonly collections: Collections;

  constructor(seed: DomainSeed) {
    const parsedSeed = domainSeedSchema.parse(structuredClone(seed));
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
      bookingReservations: new Map(),
      inspections: new Map(
        parsedSeed.inspections.map((item) => [item.id, item])
      ),
      outboxEvents: new Map()
    };
    this.rebuildRelationships();
  }

  getCounts(): Promise<DomainCounts> {
    return Promise.resolve({
      properties: this.collections.properties.size,
      owners: this.collections.owners.size,
      units: this.collections.units.size,
      occupants: this.collections.occupants.size,
      serviceRequests: this.collections.serviceRequests.size,
      maintenanceTasks: this.collections.maintenanceTasks.size,
      bookingReservations: this.collections.bookingReservations.size,
      inspections: this.collections.inspections.size
    });
  }

  listProperties(): Promise<Property[]> {
    return Promise.resolve(this.list(this.collections.properties));
  }

  getProperty(id: string): Promise<Property | null> {
    return Promise.resolve(this.collections.properties.get(id) ?? null);
  }

  createProperty(property: Property): Promise<void> {
    this.collections.properties.set(property.id, property);
    return Promise.resolve();
  }

  updateProperty(property: Property): Promise<void> {
    this.collections.properties.set(property.id, property);
    return Promise.resolve();
  }

  deleteProperty(id: string): Promise<void> {
    this.collections.properties.delete(id);
    for (const owner of this.collections.owners.values()) {
      if (!owner.propertyIds.includes(id)) {
        continue;
      }

      this.collections.owners.set(owner.id, {
        ...owner,
        propertyIds: owner.propertyIds.filter((propertyId) => propertyId !== id)
      });
    }
    this.rebuildRelationships();
    return Promise.resolve();
  }

  listOwners(): Promise<Owner[]> {
    return Promise.resolve(this.list(this.collections.owners));
  }

  getOwner(id: string): Promise<Owner | null> {
    return Promise.resolve(this.collections.owners.get(id) ?? null);
  }

  createOwner(owner: Owner): Promise<void> {
    this.collections.owners.set(owner.id, owner);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  updateOwner(owner: Owner): Promise<void> {
    this.collections.owners.set(owner.id, owner);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  deleteOwner(id: string): Promise<void> {
    this.collections.owners.delete(id);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  listUnits(): Promise<Unit[]> {
    return Promise.resolve(this.list(this.collections.units));
  }

  getUnit(id: string): Promise<Unit | null> {
    return Promise.resolve(this.collections.units.get(id) ?? null);
  }

  createUnit(unit: Unit): Promise<void> {
    this.collections.units.set(unit.id, unit);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  updateUnit(unit: Unit): Promise<void> {
    this.collections.units.set(unit.id, unit);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  deleteUnit(id: string): Promise<void> {
    this.collections.units.delete(id);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  listOccupants(): Promise<Occupant[]> {
    return Promise.resolve(this.list(this.collections.occupants));
  }

  getOccupant(id: string): Promise<Occupant | null> {
    return Promise.resolve(this.collections.occupants.get(id) ?? null);
  }

  createOccupant(occupant: Occupant): Promise<void> {
    this.collections.occupants.set(occupant.id, occupant);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  updateOccupant(occupant: Occupant): Promise<void> {
    this.collections.occupants.set(occupant.id, occupant);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  deleteOccupant(id: string): Promise<void> {
    this.collections.occupants.delete(id);
    this.rebuildRelationships();
    return Promise.resolve();
  }

  listServiceRequests(): Promise<ServiceRequest[]> {
    return Promise.resolve(this.list(this.collections.serviceRequests));
  }

  getServiceRequest(id: string): Promise<ServiceRequest | null> {
    return Promise.resolve(this.collections.serviceRequests.get(id) ?? null);
  }

  createServiceRequest(request: ServiceRequest): Promise<void> {
    this.collections.serviceRequests.set(request.id, request);
    return Promise.resolve();
  }

  updateServiceRequest(request: ServiceRequest): Promise<void> {
    this.collections.serviceRequests.set(request.id, request);
    return Promise.resolve();
  }

  deleteServiceRequest(id: string): Promise<void> {
    this.collections.serviceRequests.delete(id);
    return Promise.resolve();
  }

  listMaintenanceTasks(): Promise<MaintenanceTask[]> {
    return Promise.resolve(this.list(this.collections.maintenanceTasks));
  }

  getMaintenanceTask(id: string): Promise<MaintenanceTask | null> {
    return Promise.resolve(this.collections.maintenanceTasks.get(id) ?? null);
  }

  createMaintenanceTask(task: MaintenanceTask): Promise<void> {
    this.collections.maintenanceTasks.set(task.id, task);
    return Promise.resolve();
  }

  updateMaintenanceTask(task: MaintenanceTask): Promise<void> {
    this.collections.maintenanceTasks.set(task.id, task);
    return Promise.resolve();
  }

  deleteMaintenanceTask(id: string): Promise<void> {
    this.collections.maintenanceTasks.delete(id);
    return Promise.resolve();
  }

  listBookingReservations(): Promise<BookingReservation[]> {
    return Promise.resolve(this.list(this.collections.bookingReservations));
  }

  getBookingReservation(id: string): Promise<BookingReservation | null> {
    return Promise.resolve(
      this.collections.bookingReservations.get(id) ?? null
    );
  }

  createBookingReservation(reservation: BookingReservation): Promise<void> {
    this.collections.bookingReservations.set(reservation.id, reservation);
    return Promise.resolve();
  }

  updateBookingReservation(reservation: BookingReservation): Promise<void> {
    this.collections.bookingReservations.set(reservation.id, reservation);
    return Promise.resolve();
  }

  listInspections(): Promise<Inspection[]> {
    return Promise.resolve(
      this.list(this.collections.inspections).sort((left, right) =>
        right.performedAt.localeCompare(left.performedAt)
      )
    );
  }

  getInspection(id: string): Promise<Inspection | null> {
    return Promise.resolve(this.collections.inspections.get(id) ?? null);
  }

  createInspection(inspection: Inspection): Promise<void> {
    this.collections.inspections.set(inspection.id, inspection);
    return Promise.resolve();
  }

  enqueueOutboxEvent(event: EnqueueOutboxEventInput): Promise<void> {
    this.collections.outboxEvents.set(event.id, {
      ...event,
      status: "pending",
      attempts: 0
    });
    return Promise.resolve();
  }

  listOutboxEvents(status?: OutboxEventStatus): Promise<OutboxEvent[]> {
    const items = this.list(this.collections.outboxEvents).sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );

    return Promise.resolve(
      status ? items.filter((item) => item.status === status) : items
    );
  }

  claimOutboxEvents(input: ClaimOutboxEventsInput): Promise<OutboxEvent[]> {
    const claimed: OutboxEvent[] = [];

    for (const event of this.collections.outboxEvents.values()) {
      if (claimed.length >= input.limit) {
        break;
      }

      if (event.status !== "pending" || event.availableAt > input.now) {
        continue;
      }

      const updated: OutboxEvent = {
        ...event,
        status: "processing",
        attempts: event.attempts + 1,
        claimedAt: input.now,
        claimedBy: input.workerId,
        updatedAt: input.now
      };

      this.collections.outboxEvents.set(event.id, updated);
      claimed.push(structuredClone(updated));
    }

    return Promise.resolve(claimed);
  }

  completeOutboxEvent(input: CompleteOutboxEventInput): Promise<void> {
    const current = this.collections.outboxEvents.get(input.eventId);
    if (!current || current.claimedBy !== input.workerId) {
      return Promise.resolve();
    }

    this.collections.outboxEvents.set(input.eventId, {
      ...current,
      status: "processed",
      processedAt: input.processedAt,
      updatedAt: input.processedAt
    });
    return Promise.resolve();
  }

  releaseOutboxEvent(input: ReleaseOutboxEventInput): Promise<void> {
    const current = this.collections.outboxEvents.get(input.eventId);
    if (!current || current.claimedBy !== input.workerId) {
      return Promise.resolve();
    }

    this.collections.outboxEvents.set(input.eventId, {
      ...current,
      status: "pending",
      availableAt: input.nextAvailableAt,
      updatedAt: input.now,
      lastError: input.lastError
    });
    return Promise.resolve();
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
        const property = this.collections.properties.get(propertyId);
        if (!property) {
          continue;
        }
        property.ownerIds = this.unique([...property.ownerIds, owner.id]);
      }
    }

    for (const unit of this.collections.units.values()) {
      const property = this.collections.properties.get(unit.propertyId);
      if (!property) {
        continue;
      }
      property.unitIds = this.unique([...property.unitIds, unit.id]);
      unit.occupantIds = [];
    }

    for (const occupant of this.collections.occupants.values()) {
      const unit = this.collections.units.get(occupant.unitId);
      if (!unit) {
        continue;
      }
      unit.occupantIds = this.unique([...unit.occupantIds, occupant.id]);
    }
  }

  private list<T>(collection: Map<string, T>): T[] {
    return [...collection.values()].map((item) => structuredClone(item));
  }

  private unique(values: string[]): string[] {
    return [...new Set(values)];
  }
}
