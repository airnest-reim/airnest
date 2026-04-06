import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { type DomainStore, DomainStoreError } from "../domain/store.js";
import {
  bookingAvailabilityInputSchema,
  bookingStatusUpdateInputSchema,
  completeMaintenanceTaskInputSchema,
  createBookingReservationInputSchema,
  createMaintenanceTaskInputSchema,
  createOccupantInputSchema,
  createOwnerInputSchema,
  createPropertyInputSchema,
  createServiceRequestInputSchema,
  createUnitInputSchema,
  propertyAvailabilityQuerySchema,
  scheduleMaintenanceTaskInputSchema,
  triageServiceRequestInputSchema,
  updateMaintenanceTaskInputSchema,
  updateOccupantInputSchema,
  updateOwnerInputSchema,
  updatePropertyInputSchema,
  updateServiceRequestInputSchema,
  updateUnitInputSchema
} from "../domain/schema.js";
import { createInspectionInputSchema } from "../inspections/schema.js";

const entityParamsSchema = z.object({
  id: z.string().min(1)
});

type CrudConfig<TCreate, TUpdate, TEntity> = {
  basePath: string;
  list: () => Promise<TEntity[]>;
  get: (id: string) => Promise<TEntity>;
  create: (input: TCreate) => Promise<TEntity>;
  update: (id: string, input: TUpdate) => Promise<TEntity>;
  remove: (id: string) => Promise<void>;
  createSchema: z.ZodType<TCreate>;
  updateSchema: z.ZodType<TUpdate>;
};

export function registerDomainRoutes(
  app: FastifyInstance,
  store: DomainStore
): void {
  app.get("/api/domain/meta", async () => {
    return store.getMeta();
  });

  registerCrudRoutes(app, {
    basePath: "/api/properties",
    list: () => store.listProperties(),
    get: (id) => store.getProperty(id),
    create: (input) => store.createProperty(input),
    update: (id, input) => store.updateProperty(id, input),
    remove: (id) => store.deleteProperty(id),
    createSchema: createPropertyInputSchema,
    updateSchema: updatePropertyInputSchema
  });

  app.post("/api/properties/:id/archive", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.archiveProperty(id);
  });

  app.post("/api/properties/:id/inspections", async (request, reply) => {
    const { id } = entityParamsSchema.parse(request.params);
    const inspection = await store.createInspection(
      id,
      createInspectionInputSchema.parse(request.body)
    );
    return reply.status(201).send(inspection);
  });

  app.get("/api/properties/:id/inspections", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return {
      items: await store.listPropertyInspections(id)
    };
  });

  app.get("/api/properties/:id/quality-score", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.getPropertyQualityScore(id);
  });

  app.get("/api/properties/:id/availability", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.getPropertyAvailability(
      id,
      propertyAvailabilityQuerySchema.parse(request.query)
    );
  });

  app.get("/api/inspections/alerts", async () => {
    return {
      items: await store.listInspectionAlerts()
    };
  });

  registerCrudRoutes(app, {
    basePath: "/api/owners",
    list: () => store.listOwners(),
    get: (id) => store.getOwner(id),
    create: (input) => store.createOwner(input),
    update: (id, input) => store.updateOwner(id, input),
    remove: (id) => store.deleteOwner(id),
    createSchema: createOwnerInputSchema,
    updateSchema: updateOwnerInputSchema
  });

  registerCrudRoutes(app, {
    basePath: "/api/units",
    list: () => store.listUnits(),
    get: (id) => store.getUnit(id),
    create: (input) => store.createUnit(input),
    update: (id, input) => store.updateUnit(id, input),
    remove: (id) => store.deleteUnit(id),
    createSchema: createUnitInputSchema,
    updateSchema: updateUnitInputSchema
  });

  registerCrudRoutes(app, {
    basePath: "/api/occupants",
    list: () => store.listOccupants(),
    get: (id) => store.getOccupant(id),
    create: (input) => store.createOccupant(input),
    update: (id, input) => store.updateOccupant(id, input),
    remove: (id) => store.deleteOccupant(id),
    createSchema: createOccupantInputSchema,
    updateSchema: updateOccupantInputSchema
  });

  registerCrudRoutes(app, {
    basePath: "/api/service-requests",
    list: () => store.listServiceRequests(),
    get: (id) => store.getServiceRequest(id),
    create: (input) => store.createServiceRequest(input),
    update: (id, input) => store.updateServiceRequest(id, input),
    remove: (id) => store.deleteServiceRequest(id),
    createSchema: createServiceRequestInputSchema,
    updateSchema: updateServiceRequestInputSchema
  });

  app.post("/api/service-requests/:id/triage", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.triageServiceRequest(
      id,
      triageServiceRequestInputSchema.parse(request.body ?? {})
    );
  });

  app.post("/api/service-requests/:id/resolve", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.resolveServiceRequest(id);
  });

  app.post("/api/service-requests/:id/cancel", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.cancelServiceRequest(id);
  });

  registerCrudRoutes(app, {
    basePath: "/api/maintenance-tasks",
    list: () => store.listMaintenanceTasks(),
    get: (id) => store.getMaintenanceTask(id),
    create: (input) => store.createMaintenanceTask(input),
    update: (id, input) => store.updateMaintenanceTask(id, input),
    remove: (id) => store.deleteMaintenanceTask(id),
    createSchema: createMaintenanceTaskInputSchema,
    updateSchema: updateMaintenanceTaskInputSchema
  });

  app.post("/api/maintenance-tasks/:id/schedule", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.scheduleMaintenanceTask(
      id,
      scheduleMaintenanceTaskInputSchema.parse(request.body)
    );
  });

  app.post("/api/maintenance-tasks/:id/start", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.startMaintenanceTask(id);
  });

  app.post("/api/maintenance-tasks/:id/complete", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.completeMaintenanceTask(
      id,
      completeMaintenanceTaskInputSchema.parse(request.body ?? {})
    );
  });

  app.post("/api/maintenance-tasks/:id/cancel", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.cancelMaintenanceTask(id);
  });

  app.post("/api/bookings/availability", async (request) => {
    const input = bookingAvailabilityInputSchema.parse(request.body);
    return store.getPropertyAvailability(input.propertyId, {
      unitId: input.unitId,
      startDate: input.startDate,
      endDate: input.endDate
    });
  });

  app.post("/api/bookings", async (request, reply) => {
    const reservation = await store.createBookingReservation(
      createBookingReservationInputSchema.parse(request.body)
    );
    return reply.status(201).send(reservation);
  });

  app.get("/api/bookings/:id", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.getBookingReservation(id);
  });

  app.patch("/api/bookings/:id/status", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.updateBookingReservationStatus(
      id,
      bookingStatusUpdateInputSchema.parse(request.body)
    );
  });

  app.post("/api/bookings/reservations", async (request, reply) => {
    const reservation = await store.createBookingReservation(
      createBookingReservationInputSchema.parse(request.body)
    );
    return reply.status(201).send(reservation);
  });

  app.post("/api/bookings/reservations/:id/cancel", async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.cancelBookingReservation(id);
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainStoreError) {
      void reply.status(error.statusCode).send({
        error: error.message
      });
      return;
    }

    if (error instanceof z.ZodError) {
      void reply.status(400).send({
        error: "Validation failed.",
        details: z.flattenError(error)
      });
      return;
    }

    void reply.status(500).send({
      error: "Internal server error."
    });
  });
}

function registerCrudRoutes<TCreate, TUpdate, TEntity>(
  app: FastifyInstance,
  config: CrudConfig<TCreate, TUpdate, TEntity>
): void {
  app.get(config.basePath, async () => {
    return {
      items: await config.list()
    };
  });

  app.get(`${config.basePath}/:id`, async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return config.get(id);
  });

  app.post(config.basePath, async (request, reply) => {
    const created = await config.create(
      config.createSchema.parse(request.body)
    );
    return reply.status(201).send(created);
  });

  app.patch(`${config.basePath}/:id`, async (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return config.update(id, config.updateSchema.parse(request.body));
  });

  app.delete(`${config.basePath}/:id`, async (request, reply) => {
    const { id } = entityParamsSchema.parse(request.params);
    await config.remove(id);
    return sendNoContent(reply);
  });
}

function sendNoContent(reply: FastifyReply): FastifyReply {
  return reply.status(204).send();
}
