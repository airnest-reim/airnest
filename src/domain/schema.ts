import { z } from "zod";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const propertyStatusSchema = z.enum(["draft", "active", "offboarded"]);
export const ownerStatusSchema = z.enum(["lead", "active", "inactive"]);
export const occupancyStatusSchema = z.enum(["vacant", "occupied", "turnover"]);
export const leaseStatusSchema = z.enum(["prospect", "active", "ending", "former"]);
export const requestCategorySchema = z.enum([
  "maintenance",
  "cleaning",
  "access",
  "billing",
  "general"
]);
export const taskStatusSchema = z.enum([
  "queued",
  "scheduled",
  "in_progress",
  "done",
  "cancelled"
]);
export const reservationStatusSchema = z.enum(["confirmed", "cancelled"]);
export const requestStatusSchema = z.enum([
  "new",
  "triaged",
  "scheduled",
  "resolved",
  "cancelled"
]);
export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const idSchema = z.string().min(1);

export const propertySchema = z.object({
  id: idSchema,
  code: z.string().min(2),
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().length(2),
  status: propertyStatusSchema,
  ownerIds: z.array(idSchema),
  unitIds: z.array(idSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const ownerSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  status: ownerStatusSchema,
  propertyIds: z.array(idSchema),
  notes: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const unitSchema = z.object({
  id: idSchema,
  propertyId: idSchema,
  label: z.string().min(1),
  floor: z.number().int().nonnegative(),
  bedroomCount: z.number().int().nonnegative(),
  bathroomCount: z.number().nonnegative(),
  occupancyStatus: occupancyStatusSchema,
  occupantIds: z.array(idSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const occupantSchema = z.object({
  id: idSchema,
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  unitId: idSchema,
  leaseStatus: leaseStatusSchema,
  moveInDate: z.string().date(),
  moveOutDate: z.string().date().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const serviceRequestSchema = z.object({
  id: idSchema,
  propertyId: idSchema,
  unitId: idSchema.optional(),
  occupantId: idSchema.optional(),
  category: requestCategorySchema,
  priority: prioritySchema,
  status: requestStatusSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  reportedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const maintenanceTaskSchema = z.object({
  id: idSchema,
  serviceRequestId: idSchema.optional(),
  propertyId: idSchema,
  unitId: idSchema.optional(),
  summary: z.string().min(1),
  assignee: z.string().min(1),
  priority: prioritySchema,
  status: taskStatusSchema,
  scheduledFor: isoDateTimeSchema.optional(),
  completedAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const bookingReservationSchema = z.object({
  id: idSchema,
  propertyId: idSchema,
  unitId: idSchema,
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  status: reservationStatusSchema,
  externalReference: z.string().min(1).optional(),
  cancelledAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const bookingAvailabilityInputSchema = z
  .object({
    propertyId: idSchema,
    unitId: idSchema.optional(),
    startDate: z.string().date(),
    endDate: z.string().date()
  })
  .refine((input) => input.startDate < input.endDate, {
    message: "endDate must be after startDate.",
    path: ["endDate"]
  });

export const domainSeedSchema = z.object({
  schemaVersion: z.string().min(1),
  properties: z.array(propertySchema),
  owners: z.array(ownerSchema),
  units: z.array(unitSchema),
  occupants: z.array(occupantSchema),
  serviceRequests: z.array(serviceRequestSchema),
  maintenanceTasks: z.array(maintenanceTaskSchema)
});

export const createPropertyInputSchema = propertySchema.omit({
  id: true,
  ownerIds: true,
  unitIds: true,
  createdAt: true,
  updatedAt: true
});
export const updatePropertyInputSchema = createPropertyInputSchema.partial();

export const createOwnerInputSchema = ownerSchema.omit({
  id: true,
  propertyIds: true,
  createdAt: true,
  updatedAt: true
});
export const updateOwnerInputSchema = createOwnerInputSchema
  .partial()
  .extend({
    propertyIds: z.array(idSchema).optional()
  });

export const createUnitInputSchema = unitSchema.omit({
  id: true,
  occupantIds: true,
  createdAt: true,
  updatedAt: true
});
export const updateUnitInputSchema = createUnitInputSchema.partial();

export const createOccupantInputSchema = occupantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const updateOccupantInputSchema = createOccupantInputSchema.partial();

export const createServiceRequestInputSchema = serviceRequestSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const updateServiceRequestInputSchema =
  createServiceRequestInputSchema.partial();

export const createMaintenanceTaskInputSchema = maintenanceTaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
export const updateMaintenanceTaskInputSchema =
  createMaintenanceTaskInputSchema.partial();

export const createBookingReservationInputSchema = bookingReservationSchema
  .omit({
    id: true,
    status: true,
    cancelledAt: true,
    createdAt: true,
    updatedAt: true
  })
  .refine((input) => input.startDate < input.endDate, {
    message: "endDate must be after startDate.",
    path: ["endDate"]
  });

export type Property = z.infer<typeof propertySchema>;
export type Owner = z.infer<typeof ownerSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Occupant = z.infer<typeof occupantSchema>;
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
export type MaintenanceTask = z.infer<typeof maintenanceTaskSchema>;
export type BookingReservation = z.infer<typeof bookingReservationSchema>;
export type DomainSeed = z.infer<typeof domainSeedSchema>;

export type CreatePropertyInput = z.infer<typeof createPropertyInputSchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertyInputSchema>;
export type CreateOwnerInput = z.infer<typeof createOwnerInputSchema>;
export type UpdateOwnerInput = z.infer<typeof updateOwnerInputSchema>;
export type CreateUnitInput = z.infer<typeof createUnitInputSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitInputSchema>;
export type CreateOccupantInput = z.infer<typeof createOccupantInputSchema>;
export type UpdateOccupantInput = z.infer<typeof updateOccupantInputSchema>;
export type CreateServiceRequestInput = z.infer<
  typeof createServiceRequestInputSchema
>;
export type UpdateServiceRequestInput = z.infer<
  typeof updateServiceRequestInputSchema
>;
export type CreateMaintenanceTaskInput = z.infer<
  typeof createMaintenanceTaskInputSchema
>;
export type UpdateMaintenanceTaskInput = z.infer<
  typeof updateMaintenanceTaskInputSchema
>;
export type BookingAvailabilityInput = z.infer<
  typeof bookingAvailabilityInputSchema
>;
export type CreateBookingReservationInput = z.infer<
  typeof createBookingReservationInputSchema
>;
