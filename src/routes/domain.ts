import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import {
  type DomainStore,
  DomainStoreError
} from "../domain/store.js";
import {
  bookingAvailabilityInputSchema,
  createBookingReservationInputSchema,
  createMaintenanceTaskInputSchema,
  createOccupantInputSchema,
  createOwnerInputSchema,
  createPropertyInputSchema,
  createServiceRequestInputSchema,
  createUnitInputSchema,
  updateMaintenanceTaskInputSchema,
  updateOccupantInputSchema,
  updateOwnerInputSchema,
  updatePropertyInputSchema,
  updateServiceRequestInputSchema,
  updateUnitInputSchema
} from "../domain/schema.js";

const entityParamsSchema = z.object({
  id: z.string().min(1)
});

type CrudConfig<TCreate, TUpdate, TEntity> = {
  basePath: string;
  list: () => TEntity[];
  get: (id: string) => TEntity;
  create: (input: TCreate) => TEntity;
  update: (id: string, input: TUpdate) => TEntity;
  remove: (id: string) => void;
  createSchema: z.ZodType<TCreate>;
  updateSchema: z.ZodType<TUpdate>;
};

export function registerDomainRoutes(
  app: FastifyInstance,
  store: DomainStore
): void {
  app.get("/api/domain/meta", () => {
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

  app.post("/api/properties/:id/archive", (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return store.archiveProperty(id);
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

  app.post("/api/bookings/availability", (request) => {
    return store.checkBookingAvailability(
      bookingAvailabilityInputSchema.parse(request.body)
    );
  });

  app.post("/api/bookings/reservations", (request, reply) => {
    const reservation = store.createBookingReservation(
      createBookingReservationInputSchema.parse(request.body)
    );
    return reply.status(201).send(reservation);
  });

  app.post("/api/bookings/reservations/:id/cancel", (request) => {
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
  app.get(config.basePath, () => {
    return {
      items: config.list()
    };
  });

  app.get(`${config.basePath}/:id`, (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return config.get(id);
  });

  app.post(config.basePath, (request, reply) => {
    const created = config.create(config.createSchema.parse(request.body));
    return reply.status(201).send(created);
  });

  app.patch(`${config.basePath}/:id`, (request) => {
    const { id } = entityParamsSchema.parse(request.params);
    return config.update(id, config.updateSchema.parse(request.body));
  });

  app.delete(`${config.basePath}/:id`, (request, reply) => {
    const { id } = entityParamsSchema.parse(request.params);
    config.remove(id);
    return sendNoContent(reply);
  });
}

function sendNoContent(reply: FastifyReply): FastifyReply {
  return reply.status(204).send();
}
