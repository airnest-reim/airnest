import type {
  BookingReservation,
  MaintenanceTask,
  Occupant,
  Owner,
  Property,
  ServiceRequest,
  Unit
} from "./schema.js";
import type { Inspection } from "../inspections/schema.js";
import type { DomainCounts } from "./store.js";
import type {
  ClaimOutboxEventsInput,
  CompleteOutboxEventInput,
  EnqueueOutboxEventInput,
  OutboxEvent,
  OutboxEventStatus,
  ReleaseOutboxEventInput
} from "../outbox/schema.js";

export interface DomainRepository {
  getCounts(): Promise<DomainCounts>;
  listProperties(): Promise<Property[]>;
  getProperty(id: string): Promise<Property | null>;
  createProperty(property: Property): Promise<void>;
  updateProperty(property: Property): Promise<void>;
  deleteProperty(id: string): Promise<void>;
  listOwners(): Promise<Owner[]>;
  getOwner(id: string): Promise<Owner | null>;
  createOwner(owner: Owner): Promise<void>;
  updateOwner(owner: Owner): Promise<void>;
  deleteOwner(id: string): Promise<void>;
  listUnits(): Promise<Unit[]>;
  getUnit(id: string): Promise<Unit | null>;
  createUnit(unit: Unit): Promise<void>;
  updateUnit(unit: Unit): Promise<void>;
  deleteUnit(id: string): Promise<void>;
  listOccupants(): Promise<Occupant[]>;
  getOccupant(id: string): Promise<Occupant | null>;
  createOccupant(occupant: Occupant): Promise<void>;
  updateOccupant(occupant: Occupant): Promise<void>;
  deleteOccupant(id: string): Promise<void>;
  listServiceRequests(): Promise<ServiceRequest[]>;
  getServiceRequest(id: string): Promise<ServiceRequest | null>;
  createServiceRequest(request: ServiceRequest): Promise<void>;
  updateServiceRequest(request: ServiceRequest): Promise<void>;
  deleteServiceRequest(id: string): Promise<void>;
  listMaintenanceTasks(): Promise<MaintenanceTask[]>;
  getMaintenanceTask(id: string): Promise<MaintenanceTask | null>;
  createMaintenanceTask(task: MaintenanceTask): Promise<void>;
  updateMaintenanceTask(task: MaintenanceTask): Promise<void>;
  deleteMaintenanceTask(id: string): Promise<void>;
  listBookingReservations(): Promise<BookingReservation[]>;
  getBookingReservation(id: string): Promise<BookingReservation | null>;
  createBookingReservation(reservation: BookingReservation): Promise<void>;
  updateBookingReservation(reservation: BookingReservation): Promise<void>;
  listInspections(): Promise<Inspection[]>;
  getInspection(id: string): Promise<Inspection | null>;
  createInspection(inspection: Inspection): Promise<void>;
  enqueueOutboxEvent(event: EnqueueOutboxEventInput): Promise<void>;
  listOutboxEvents(status?: OutboxEventStatus): Promise<OutboxEvent[]>;
  claimOutboxEvents(input: ClaimOutboxEventsInput): Promise<OutboxEvent[]>;
  completeOutboxEvent(input: CompleteOutboxEventInput): Promise<void>;
  releaseOutboxEvent(input: ReleaseOutboxEventInput): Promise<void>;
}
