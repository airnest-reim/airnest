import type { OutboxHandler, OutboxEvent } from "../outbox/worker.js";
import type { OutboxEventTopic } from "../outbox/schema.js";
import type { DomainRepository } from "../domain/repository.js";
import { AirtableClient } from "./client.js";
import type { AirtableConfig } from "./schema.js";

interface AirtableSyncHandlersOptions {
  repository: DomainRepository;
  airtableConfig: AirtableConfig;
  logger?: { log: (msg: string) => void; error: (msg: string) => void };
}

/**
 * Creates Airtable sync handlers for domain events
 */
export function createAirtableSyncHandlers(
  options: AirtableSyncHandlersOptions
): Partial<Record<OutboxEventTopic, OutboxHandler>> {
  const defaultLogger = {
    log: () => {},
    error: () => {}
  };

  const logger = options.logger || defaultLogger;

  const client = new AirtableClient({
    config: options.airtableConfig,
    logger
  });

  const repository = options.repository;
  const config = options.airtableConfig;

  return {
    "property.created": async (event: OutboxEvent) => {
      await syncPropertyToAirtable(event, repository, client, logger, config, "created");
    },
    "property.updated": async (event: OutboxEvent) => {
      await syncPropertyToAirtable(event, repository, client, logger, config, "updated");
    },
    "property.deleted": async (event: OutboxEvent) => {
      await deletePropertyFromAirtable(event, repository, client, logger, config);
    },
    "booking.created": async (event: OutboxEvent) => {
      await syncBookingToAirtable(event, repository, client, logger, config, "created");
    },
    "booking.updated": async (event: OutboxEvent) => {
      await syncBookingToAirtable(event, repository, client, logger, config, "updated");
    },
    "booking.deleted": async (event: OutboxEvent) => {
      await deleteBookingFromAirtable(event, repository, client, logger, config);
    },
    "occupant.created": async (event: OutboxEvent) => {
      await syncOccupantToAirtable(event, repository, client, logger, config, "created");
    },
    "occupant.updated": async (event: OutboxEvent) => {
      await syncOccupantToAirtable(event, repository, client, logger, config, "updated");
    },
    "occupant.deleted": async (event: OutboxEvent) => {
      await deleteOccupantFromAirtable(event, repository, client, logger, config);
    },
    "service_request.created": async (event: OutboxEvent) => {
      if (config.serviceRequestTableId) {
        await syncServiceRequestToAirtable(event, repository, client, logger, config, "created");
      }
    },
    "service_request.updated": async (event: OutboxEvent) => {
      if (config.serviceRequestTableId) {
        await syncServiceRequestToAirtable(event, repository, client, logger, config, "updated");
      }
    },
    "service_request.deleted": async (event: OutboxEvent) => {
      if (config.serviceRequestTableId) {
        await deleteServiceRequestFromAirtable(event, repository, client, logger, config);
      }
    },
    "maintenance_task.created": async (event: OutboxEvent) => {
      if (config.maintenanceTaskTableId) {
        await syncMaintenanceTaskToAirtable(event, repository, client, logger, config, "created");
      }
    },
    "maintenance_task.updated": async (event: OutboxEvent) => {
      if (config.maintenanceTaskTableId) {
        await syncMaintenanceTaskToAirtable(event, repository, client, logger, config, "updated");
      }
    },
    "maintenance_task.deleted": async (event: OutboxEvent) => {
      if (config.maintenanceTaskTableId) {
        await deleteMaintenanceTaskFromAirtable(event, repository, client, logger, config);
      }
    },
    "alert.created": async (event: OutboxEvent) => {
      if (config.alertTableId) {
        await syncAlertToAirtable(event, repository, client, logger, config);
      }
    }
  };
}

/**
 * Syncs a property to Airtable (create or update)
 */
async function syncPropertyToAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig,
  action: "created" | "updated"
): Promise<void> {
  try {
    const property = await repository.getProperty(event.aggregateId);

    if (!property) {
      logger?.log(`Property ${event.aggregateId} not found, skipping sync`);
      return;
    }

    const fields = {
      "Property ID": property.id,
      "Property Name": property.name,
      Address: `${property.addressLine1}${property.addressLine2 ? ", " + property.addressLine2 : ""}`,
      City: property.city,
      "Postal Code": property.postalCode,
      Country: property.countryCode,
      Status: property.status,
      "Last Synced": new Date().toISOString()
    };

    await client.upsertRecord(config.propertyTableId, fields, property.id);

    logger?.log(`Property ${property.id} synced to Airtable (${action})`);
  } catch (error) {
    logger?.error(
      `Failed to sync property ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Deletes a property from Airtable
 */
async function deletePropertyFromAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig
): Promise<void> {
  try {
    // Find the record by Internal ID and delete it
    const records = await client.listRecords(config.propertyTableId, {
      filterByFormula: `{Internal ID} = "${event.aggregateId}"`
    });

    if (records.length > 0) {
      const record = records[0];
      if (record) {
        await client.deleteRecord(config.propertyTableId, record.id);
        logger?.log(`Property ${event.aggregateId} deleted from Airtable`);
      }
    }
  } catch (error) {
    logger?.error(
      `Failed to delete property ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Syncs a booking to Airtable (create or update)
 */
async function syncBookingToAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig,
  action: "created" | "updated"
): Promise<void> {
  try {
    const booking = await repository.getBookingReservation(event.aggregateId);

    if (!booking) {
      logger?.log(`Booking ${event.aggregateId} not found, skipping sync`);
      return;
    }

    const fields = {
      "Booking ID": booking.id,
      Property: [booking.propertyId],
      Guest: `${booking.guestName} (${booking.guestEmail})`,
      "Check-in Date": booking.startDate,
      "Check-out Date": booking.endDate,
      Status: booking.status,
      "Last Synced": new Date().toISOString()
    };

    await client.upsertRecord(config.bookingTableId, fields, booking.id);

    logger?.log(`Booking ${booking.id} synced to Airtable (${action})`);
  } catch (error) {
    logger?.error(
      `Failed to sync booking ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Deletes a booking from Airtable
 */
async function deleteBookingFromAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig
): Promise<void> {
  try {
    const records = await client.listRecords(config.bookingTableId, {
      filterByFormula: `{Internal ID} = "${event.aggregateId}"`
    });

    if (records.length > 0) {
      const record = records[0];
      if (record) {
        await client.deleteRecord(config.bookingTableId, record.id);
        logger?.log(`Booking ${event.aggregateId} deleted from Airtable`);
      }
    }
  } catch (error) {
    logger?.error(
      `Failed to delete booking ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Syncs an occupant (guest) to Airtable (create or update)
 */
async function syncOccupantToAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig,
  action: "created" | "updated"
): Promise<void> {
  try {
    const occupant = await repository.getOccupant(event.aggregateId);

    if (!occupant) {
      logger?.log(`Occupant ${event.aggregateId} not found, skipping sync`);
      return;
    }

    const fields = {
      "Guest ID": occupant.id,
      "Guest Name": occupant.fullName,
      Email: occupant.email,
      Phone: occupant.phone,
      "Lease Status": occupant.leaseStatus,
      "Move In Date": occupant.moveInDate,
      "Move Out Date": occupant.moveOutDate || "",
      "Last Synced": new Date().toISOString()
    };

    await client.upsertRecord(config.guestTableId, fields, occupant.id);

    logger?.log(`Occupant ${occupant.id} synced to Airtable (${action})`);
  } catch (error) {
    logger?.error(
      `Failed to sync occupant ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Deletes an occupant from Airtable
 */
async function deleteOccupantFromAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig
): Promise<void> {
  try {
    const records = await client.listRecords(config.guestTableId, {
      filterByFormula: `{Internal ID} = "${event.aggregateId}"`
    });

    if (records.length > 0) {
      const record = records[0];
      if (record) {
        await client.deleteRecord(config.guestTableId, record.id);
        logger?.log(`Occupant ${event.aggregateId} deleted from Airtable`);
      }
    }
  } catch (error) {
    logger?.error(
      `Failed to delete occupant ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Syncs a service request to Airtable (create or update)
 */
async function syncServiceRequestToAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig,
  action: "created" | "updated"
): Promise<void> {
  try {
    if (!config.serviceRequestTableId) {
      logger?.log(`Service request table not configured, skipping sync for ${event.aggregateId}`);
      return;
    }

    // TODO: Implement service request retrieval from repository
    // For now, this is a placeholder that will be implemented once the domain model is available
    logger?.log(`Service request ${event.aggregateId} sync placeholder (${action})`);
  } catch (error) {
    logger?.error(
      `Failed to sync service request ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Deletes a service request from Airtable
 */
async function deleteServiceRequestFromAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig
): Promise<void> {
  try {
    if (!config.serviceRequestTableId) {
      return;
    }

    const records = await client.listRecords(config.serviceRequestTableId, {
      filterByFormula: `{Internal ID} = "${event.aggregateId}"`
    });

    if (records.length > 0) {
      const record = records[0];
      if (record) {
        await client.deleteRecord(config.serviceRequestTableId, record.id);
        logger?.log(`Service request ${event.aggregateId} deleted from Airtable`);
      }
    }
  } catch (error) {
    logger?.error(
      `Failed to delete service request ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Syncs a maintenance task to Airtable (create or update)
 */
async function syncMaintenanceTaskToAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig,
  action: "created" | "updated"
): Promise<void> {
  try {
    if (!config.maintenanceTaskTableId) {
      logger?.log(`Maintenance task table not configured, skipping sync for ${event.aggregateId}`);
      return;
    }

    // TODO: Implement maintenance task retrieval from repository
    // For now, this is a placeholder that will be implemented once the domain model is available
    logger?.log(`Maintenance task ${event.aggregateId} sync placeholder (${action})`);
  } catch (error) {
    logger?.error(
      `Failed to sync maintenance task ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Deletes a maintenance task from Airtable
 */
async function deleteMaintenanceTaskFromAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig
): Promise<void> {
  try {
    if (!config.maintenanceTaskTableId) {
      return;
    }

    const records = await client.listRecords(config.maintenanceTaskTableId, {
      filterByFormula: `{Internal ID} = "${event.aggregateId}"`
    });

    if (records.length > 0) {
      const record = records[0];
      if (record) {
        await client.deleteRecord(config.maintenanceTaskTableId, record.id);
        logger?.log(`Maintenance task ${event.aggregateId} deleted from Airtable`);
      }
    }
  } catch (error) {
    logger?.error(
      `Failed to delete maintenance task ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}

/**
 * Syncs an alert to Airtable
 */
async function syncAlertToAirtable(
  event: OutboxEvent,
  repository: DomainRepository,
  client: AirtableClient,
  logger: { log: (msg: string) => void; error: (msg: string) => void },
  config: AirtableConfig
): Promise<void> {
  try {
    if (!config.alertTableId) {
      logger?.log(`Alert table not configured, skipping sync for ${event.aggregateId}`);
      return;
    }

    // TODO: Implement alert retrieval from repository
    // For now, this is a placeholder that will be implemented once the domain model is available
    logger?.log(`Alert ${event.aggregateId} sync placeholder`);
  } catch (error) {
    logger?.error(
      `Failed to sync alert ${event.aggregateId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    throw error;
  }
}
