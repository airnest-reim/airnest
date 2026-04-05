import type {
  CompleteMaintenanceTaskInput,
  MaintenanceTask,
  ScheduleMaintenanceTaskInput
} from "./schema.js";
import type { DomainRepository } from "./repository.js";
import { DomainStoreError } from "./store.js";
import type { ServiceRequestWorkflowService } from "./service-request-workflows.js";

type WorkflowOptions = {
  repository: DomainRepository;
  now: () => string;
  serviceRequests: ServiceRequestWorkflowService;
};

export class MaintenanceTaskWorkflowService {
  constructor(private readonly options: WorkflowOptions) {}

  async schedule(
    id: string,
    input: ScheduleMaintenanceTaskInput
  ): Promise<MaintenanceTask> {
    const task = await this.requireTask(id);

    if (task.status === "done" || task.status === "cancelled") {
      throw new DomainStoreError(
        "Closed maintenance tasks cannot be scheduled."
      );
    }

    const updated: MaintenanceTask = {
      ...task,
      assignee: input.assignee ?? task.assignee,
      status: "scheduled",
      scheduledFor: input.scheduledFor,
      updatedAt: this.options.now()
    };

    await this.options.repository.updateMaintenanceTask(updated);

    if (task.serviceRequestId) {
      await this.options.serviceRequests.markScheduled(task.serviceRequestId);
    }

    return this.requireTask(id);
  }

  async start(id: string): Promise<MaintenanceTask> {
    const task = await this.requireTask(id);

    if (task.status !== "scheduled") {
      throw new DomainStoreError(
        "Only scheduled maintenance tasks can be started."
      );
    }

    await this.options.repository.updateMaintenanceTask({
      ...task,
      status: "in_progress",
      updatedAt: this.options.now()
    });

    return this.requireTask(id);
  }

  async complete(
    id: string,
    input: CompleteMaintenanceTaskInput
  ): Promise<MaintenanceTask> {
    const task = await this.requireTask(id);

    if (task.status === "done") {
      return task;
    }

    if (task.status === "cancelled") {
      throw new DomainStoreError(
        "Cancelled maintenance tasks cannot be completed."
      );
    }

    if (task.status !== "scheduled" && task.status !== "in_progress") {
      throw new DomainStoreError(
        "Maintenance tasks must be scheduled before completion."
      );
    }

    await this.options.repository.updateMaintenanceTask({
      ...task,
      status: "done",
      completedAt: this.options.now(),
      updatedAt: this.options.now()
    });

    if (input.resolveServiceRequest && task.serviceRequestId) {
      await this.options.serviceRequests.resolve(task.serviceRequestId);
    }

    return this.requireTask(id);
  }

  async cancel(id: string): Promise<MaintenanceTask> {
    const task = await this.requireTask(id);

    if (task.status === "cancelled") {
      return task;
    }

    if (task.status === "done") {
      throw new DomainStoreError(
        "Completed maintenance tasks cannot be cancelled."
      );
    }

    await this.options.repository.updateMaintenanceTask({
      ...task,
      status: "cancelled",
      updatedAt: this.options.now()
    });

    return this.requireTask(id);
  }

  private async requireTask(id: string): Promise<MaintenanceTask> {
    const task = await this.options.repository.getMaintenanceTask(id);
    if (!task) {
      throw new DomainStoreError("Maintenance task not found.", 404);
    }

    return task;
  }
}
