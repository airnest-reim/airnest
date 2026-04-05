import { Pool } from "pg";

import type { AppEnv } from "../config/env.js";
import { initialDomainSeed } from "../domain/seed.js";
import type { DomainRepository } from "../domain/repository.js";
import { ConciergeDomainService } from "../domain/service.js";
import type { DomainStore } from "../domain/store.js";
import { InMemoryDomainRepository } from "./in-memory-repository.js";
import { PostgresDomainRepository } from "./postgres-repository.js";

export type DomainPlatform = {
  store: DomainStore;
  repository: DomainRepository;
  initialize?: () => Promise<void>;
  dispose?: () => Promise<void>;
};

export function createDefaultDomainStore(env: AppEnv): DomainStore {
  return createDefaultDomainPlatform(env).store;
}

export function createPostgresDomainStore(options: {
  databaseUrl?: string;
  pool?: Pool;
  seededAt?: string;
}): DomainStore {
  return createPostgresDomainPlatform(options).store;
}

export function createDefaultDomainPlatform(env: AppEnv): DomainPlatform {
  if (!env.DATABASE_URL) {
    const repository = new InMemoryDomainRepository(initialDomainSeed);
    return {
      repository,
      store: new ConciergeDomainService({
        repository,
        schemaVersion: initialDomainSeed.schemaVersion
      })
    };
  }

  return createPostgresDomainPlatform({
    databaseUrl: env.DATABASE_URL
  });
}

export function createPostgresDomainPlatform(options: {
  databaseUrl?: string;
  pool?: Pool;
  seededAt?: string;
}): DomainPlatform {
  const pool =
    options.pool ??
    new Pool({
      connectionString: options.databaseUrl
    });
  const repository = new PostgresDomainRepository(pool);
  const serviceOptions =
    options.seededAt === undefined
      ? {
          repository,
          schemaVersion: initialDomainSeed.schemaVersion
        }
      : {
          repository,
          schemaVersion: initialDomainSeed.schemaVersion,
          seededAt: options.seededAt
        };
  const service = new ConciergeDomainService(serviceOptions);

  return withLifecycle(service, repository);
}

function withLifecycle(
  service: ConciergeDomainService,
  repository: PostgresDomainRepository
): DomainPlatform {
  const initialize = async (): Promise<void> => {
    await repository.migrate();
    await repository.seed(initialDomainSeed);
  };

  const dispose = async (): Promise<void> => {
    await repository.dispose();
  };

  const store: DomainStore = {
    initialize,
    dispose,
    getMeta: () => service.getMeta(),
    listProperties: () => service.listProperties(),
    getProperty: (id) => service.getProperty(id),
    createProperty: (input) => service.createProperty(input),
    updateProperty: (id, input) => service.updateProperty(id, input),
    archiveProperty: (id) => service.archiveProperty(id),
    deleteProperty: (id) => service.deleteProperty(id),
    listOwners: () => service.listOwners(),
    getOwner: (id) => service.getOwner(id),
    createOwner: (input) => service.createOwner(input),
    updateOwner: (id, input) => service.updateOwner(id, input),
    deleteOwner: (id) => service.deleteOwner(id),
    listUnits: () => service.listUnits(),
    getUnit: (id) => service.getUnit(id),
    createUnit: (input) => service.createUnit(input),
    updateUnit: (id, input) => service.updateUnit(id, input),
    deleteUnit: (id) => service.deleteUnit(id),
    listOccupants: () => service.listOccupants(),
    getOccupant: (id) => service.getOccupant(id),
    createOccupant: (input) => service.createOccupant(input),
    updateOccupant: (id, input) => service.updateOccupant(id, input),
    deleteOccupant: (id) => service.deleteOccupant(id),
    listServiceRequests: () => service.listServiceRequests(),
    getServiceRequest: (id) => service.getServiceRequest(id),
    createServiceRequest: (input) => service.createServiceRequest(input),
    triageServiceRequest: (id, input) =>
      service.triageServiceRequest(id, input),
    resolveServiceRequest: (id) => service.resolveServiceRequest(id),
    cancelServiceRequest: (id) => service.cancelServiceRequest(id),
    updateServiceRequest: (id, input) =>
      service.updateServiceRequest(id, input),
    deleteServiceRequest: (id) => service.deleteServiceRequest(id),
    listMaintenanceTasks: () => service.listMaintenanceTasks(),
    getMaintenanceTask: (id) => service.getMaintenanceTask(id),
    createMaintenanceTask: (input) => service.createMaintenanceTask(input),
    scheduleMaintenanceTask: (id, input) =>
      service.scheduleMaintenanceTask(id, input),
    startMaintenanceTask: (id) => service.startMaintenanceTask(id),
    completeMaintenanceTask: (id, input) =>
      service.completeMaintenanceTask(id, input),
    cancelMaintenanceTask: (id) => service.cancelMaintenanceTask(id),
    updateMaintenanceTask: (id, input) =>
      service.updateMaintenanceTask(id, input),
    deleteMaintenanceTask: (id) => service.deleteMaintenanceTask(id),
    checkBookingAvailability: (input) =>
      service.checkBookingAvailability(input),
    getPropertyAvailability: (propertyId, query) =>
      service.getPropertyAvailability(propertyId, query),
    getBookingReservation: (id) => service.getBookingReservation(id),
    createBookingReservation: (input) =>
      service.createBookingReservation(input),
    updateBookingReservationStatus: (id, input) =>
      service.updateBookingReservationStatus(id, input),
    cancelBookingReservation: (id) => service.cancelBookingReservation(id),
    createInspection: (propertyId, input) =>
      service.createInspection(propertyId, input),
    listPropertyInspections: (propertyId) =>
      service.listPropertyInspections(propertyId),
    getPropertyQualityScore: (propertyId) =>
      service.getPropertyQualityScore(propertyId),
    listInspectionAlerts: () => service.listInspectionAlerts()
  };

  return {
    store,
    repository,
    initialize,
    dispose
  };
}
