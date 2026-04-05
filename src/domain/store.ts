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
  ScheduleMaintenanceTaskInput,
  TriageServiceRequestInput,
  CreateUnitInput,
  MaintenanceTask,
  Occupant,
  Owner,
  Property,
  PropertyAvailabilityQuery,
  ServiceRequest,
  Unit,
  UpdateMaintenanceTaskInput,
  UpdateOccupantInput,
  UpdateOwnerInput,
  UpdatePropertyInput,
  UpdateServiceRequestInput,
  UpdateUnitInput
} from "./schema.js";
import type {
  CreateInspectionInput,
  Inspection
} from "../inspections/schema.js";
import type { PropertyQualityScore } from "../inspections/scoring.js";

export type DomainCounts = {
  properties: number;
  owners: number;
  units: number;
  occupants: number;
  serviceRequests: number;
  maintenanceTasks: number;
  bookingReservations: number;
  inspections: number;
};

export type DomainMeta = {
  schemaVersion: string;
  seededAt: string;
  counts: DomainCounts;
  assumptions: string[];
  openQuestions: string[];
};

export type BookingAvailabilityResult = {
  propertyId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  nights: number;
  meetsMinimumStay: boolean;
  blockedRanges: Array<{
    startDate: string;
    endDate: string;
    reason?: string;
  }>;
  available: boolean;
  conflicts: BookingReservation[];
  pricing: BookingPricing;
};

export class DomainStoreError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
  }
}

export interface DomainStore {
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
  getMeta(): Promise<DomainMeta>;
  listProperties(): Promise<Property[]>;
  getProperty(id: string): Promise<Property>;
  createProperty(input: CreatePropertyInput): Promise<Property>;
  updateProperty(id: string, input: UpdatePropertyInput): Promise<Property>;
  archiveProperty(id: string): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  listOwners(): Promise<Owner[]>;
  getOwner(id: string): Promise<Owner>;
  createOwner(input: CreateOwnerInput): Promise<Owner>;
  updateOwner(id: string, input: UpdateOwnerInput): Promise<Owner>;
  deleteOwner(id: string): Promise<void>;
  listUnits(): Promise<Unit[]>;
  getUnit(id: string): Promise<Unit>;
  createUnit(input: CreateUnitInput): Promise<Unit>;
  updateUnit(id: string, input: UpdateUnitInput): Promise<Unit>;
  deleteUnit(id: string): Promise<void>;
  listOccupants(): Promise<Occupant[]>;
  getOccupant(id: string): Promise<Occupant>;
  createOccupant(input: CreateOccupantInput): Promise<Occupant>;
  updateOccupant(id: string, input: UpdateOccupantInput): Promise<Occupant>;
  deleteOccupant(id: string): Promise<void>;
  listServiceRequests(): Promise<ServiceRequest[]>;
  getServiceRequest(id: string): Promise<ServiceRequest>;
  createServiceRequest(
    input: CreateServiceRequestInput
  ): Promise<ServiceRequest>;
  triageServiceRequest(
    id: string,
    input: TriageServiceRequestInput
  ): Promise<ServiceRequest>;
  resolveServiceRequest(id: string): Promise<ServiceRequest>;
  cancelServiceRequest(id: string): Promise<ServiceRequest>;
  updateServiceRequest(
    id: string,
    input: UpdateServiceRequestInput
  ): Promise<ServiceRequest>;
  deleteServiceRequest(id: string): Promise<void>;
  listMaintenanceTasks(): Promise<MaintenanceTask[]>;
  getMaintenanceTask(id: string): Promise<MaintenanceTask>;
  createMaintenanceTask(
    input: CreateMaintenanceTaskInput
  ): Promise<MaintenanceTask>;
  scheduleMaintenanceTask(
    id: string,
    input: ScheduleMaintenanceTaskInput
  ): Promise<MaintenanceTask>;
  startMaintenanceTask(id: string): Promise<MaintenanceTask>;
  completeMaintenanceTask(
    id: string,
    input: CompleteMaintenanceTaskInput
  ): Promise<MaintenanceTask>;
  cancelMaintenanceTask(id: string): Promise<MaintenanceTask>;
  updateMaintenanceTask(
    id: string,
    input: UpdateMaintenanceTaskInput
  ): Promise<MaintenanceTask>;
  deleteMaintenanceTask(id: string): Promise<void>;
  checkBookingAvailability(
    input: BookingAvailabilityInput
  ): Promise<BookingAvailabilityResult>;
  getPropertyAvailability(
    propertyId: string,
    query: PropertyAvailabilityQuery
  ): Promise<BookingAvailabilityResult>;
  getBookingReservation(id: string): Promise<BookingReservation>;
  createBookingReservation(
    input: CreateBookingReservationInput
  ): Promise<BookingReservation>;
  updateBookingReservationStatus(
    id: string,
    input: BookingStatusUpdateInput
  ): Promise<BookingReservation>;
  cancelBookingReservation(id: string): Promise<BookingReservation>;
  createInspection(
    propertyId: string,
    input: CreateInspectionInput
  ): Promise<Inspection>;
  listPropertyInspections(propertyId: string): Promise<Inspection[]>;
  getPropertyQualityScore(propertyId: string): Promise<PropertyQualityScore>;
  listInspectionAlerts(): Promise<
    Array<
      PropertyQualityScore & {
        propertyName: string;
      }
    >
  >;
}
