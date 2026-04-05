import type {
  ServiceRequest,
  TriageServiceRequestInput
} from "./schema.js";
import type { DomainRepository } from "./repository.js";
import { DomainStoreError } from "./store.js";

type WorkflowOptions = {
  repository: DomainRepository;
  now: () => string;
};

export class ServiceRequestWorkflowService {
  constructor(private readonly options: WorkflowOptions) {}

  async triage(
    id: string,
    input: TriageServiceRequestInput
  ): Promise<ServiceRequest> {
    const request = await this.requireRequest(id);

    if (request.status !== "new") {
      throw new DomainStoreError(
        "Only new service requests can be triaged."
      );
    }

    const updated: ServiceRequest = {
      ...request,
      status: "triaged",
      priority: input.priority ?? request.priority,
      updatedAt: this.options.now()
    };

    await this.options.repository.updateServiceRequest(updated);
    return this.requireRequest(id);
  }

  async markScheduled(serviceRequestId: string): Promise<void> {
    const request = await this.requireRequest(serviceRequestId);

    if (request.status === "resolved" || request.status === "cancelled") {
      throw new DomainStoreError(
        "Closed service requests cannot be scheduled."
      );
    }

    if (request.status === "scheduled") {
      return;
    }

    if (request.status !== "new" && request.status !== "triaged") {
      throw new DomainStoreError(
        "Only new or triaged service requests can be scheduled."
      );
    }

    await this.options.repository.updateServiceRequest({
      ...request,
      status: "scheduled",
      updatedAt: this.options.now()
    });
  }

  async resolve(id: string): Promise<ServiceRequest> {
    const request = await this.requireRequest(id);

    if (request.status === "resolved") {
      return request;
    }

    if (request.status === "cancelled") {
      throw new DomainStoreError(
        "Cancelled service requests cannot be resolved."
      );
    }

    if (request.status === "new") {
      throw new DomainStoreError(
        "Service requests must be triaged before resolution."
      );
    }

    await this.options.repository.updateServiceRequest({
      ...request,
      status: "resolved",
      updatedAt: this.options.now()
    });

    return this.requireRequest(id);
  }

  async cancel(id: string): Promise<ServiceRequest> {
    const request = await this.requireRequest(id);

    if (request.status === "cancelled") {
      return request;
    }

    if (request.status === "resolved") {
      throw new DomainStoreError(
        "Resolved service requests cannot be cancelled."
      );
    }

    await this.options.repository.updateServiceRequest({
      ...request,
      status: "cancelled",
      updatedAt: this.options.now()
    });

    return this.requireRequest(id);
  }

  private async requireRequest(id: string): Promise<ServiceRequest> {
    const request = await this.options.repository.getServiceRequest(id);
    if (!request) {
      throw new DomainStoreError("Service request not found.", 404);
    }

    return request;
  }
}
