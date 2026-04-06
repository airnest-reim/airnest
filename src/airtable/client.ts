import type {
  AirtableConfig,
  AirtableRecord,
  AirtableListRecordsResponse
} from "./schema.js";

/**
 * Rate limiting configuration for Airtable API
 * - Free plan: 5 requests per second
 * - We use 2 requests per second for safety margin
 */
const RATE_LIMIT_DELAY_MS = 500; // 2 requests per second

/**
 * Retry configuration for transient errors
 */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

interface AirtableClientOptions {
  config: AirtableConfig;
  logger?: { log: (msg: string) => void; error: (msg: string) => void } | null | undefined;
}

/**
 * Airtable API Client with built-in rate limiting and retry logic
 */
export class AirtableClient {
  private readonly config: AirtableConfig;
  private readonly baseUrl = "https://api.airtable.com/v0";
  private lastRequestTime = 0;
  private readonly logger: { log: (msg: string) => void; error: (msg: string) => void };

  constructor(options: AirtableClientOptions) {
    this.config = options.config;
    this.logger = options.logger || {
      log: () => {},
      error: () => {}
    };
  }

  /**
   * Enforces rate limiting by delaying requests as needed
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
      const delayMs = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Executes a request with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("429") || // Rate limited
          error.message.includes("503") || // Service unavailable
          error.message.includes("timeout")); // Timeout

      if (isRetryable && attempt < MAX_RETRIES) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        this.logger.log(
          `Airtable request failed (attempt ${attempt}), retrying in ${backoffMs}ms: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return this.executeWithRetry(fn, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Creates or updates a record in an Airtable table
   */
  async upsertRecord(
    tableId: string,
    fields: Record<string, unknown>,
    internalId: string
  ): Promise<AirtableRecord> {
    await this.enforceRateLimit();

    return this.executeWithRetry(async () => {
      const url = `${this.baseUrl}/${this.config.baseId}/${tableId}`;

      // First, try to find existing record by Internal ID
      const existingRecords = await this.listRecords(tableId, {
        filterByFormula: `{Internal ID} = "${internalId}"`
      });

      if (existingRecords.length > 0) {
        // Update existing record
        const firstRecord = existingRecords[0];
        if (!firstRecord) {
          throw new Error("No record found despite checking length");
        }
        const recordId = firstRecord.id;
        const response = await fetch(`${url}/${recordId}`, {
          method: "PATCH",
          headers: this.getHeaders(),
          body: JSON.stringify({ fields })
        });

        if (!response.ok) {
          throw new Error(`Airtable PATCH failed: ${response.status} ${response.statusText}`);
        }

        return (await response.json()) as AirtableRecord;
      } else {
        // Create new record
        const createResponse = await fetch(url, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({
            records: [
              {
                fields: {
                  ...fields,
                  "Internal ID": internalId
                }
              }
            ]
          })
        });

        if (!createResponse.ok) {
          throw new Error(`Airtable POST failed: ${createResponse.status} ${createResponse.statusText}`);
        }

        const result = (await createResponse.json()) as { records: AirtableRecord[] };
        const firstRecord = result.records[0];
        if (!firstRecord) {
          throw new Error("Airtable POST returned no records");
        }
        return firstRecord;
      }
    });
  }

  /**
   * Lists records from an Airtable table
   */
  async listRecords(
    tableId: string,
    options?: {
      filterByFormula?: string;
      maxRecords?: number;
      pageSize?: number;
      offset?: string;
    }
  ): Promise<AirtableRecord[]> {
    await this.enforceRateLimit();

    return this.executeWithRetry(async () => {
      const url = new URL(`${this.baseUrl}/${this.config.baseId}/${tableId}`);

      if (options?.filterByFormula) {
        url.searchParams.append("filterByFormula", options.filterByFormula);
      }
      if (options?.maxRecords) {
        url.searchParams.append("maxRecords", options.maxRecords.toString());
      }
      if (options?.pageSize) {
        url.searchParams.append("pageSize", options.pageSize.toString());
      }
      if (options?.offset) {
        url.searchParams.append("offset", options.offset);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Airtable GET failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as AirtableListRecordsResponse;
      return data.records;
    });
  }

  /**
   * Deletes a record from an Airtable table
   */
  async deleteRecord(tableId: string, recordId: string): Promise<void> {
    await this.enforceRateLimit();

    return this.executeWithRetry(async () => {
      const url = `${this.baseUrl}/${this.config.baseId}/${tableId}/${recordId}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Airtable DELETE failed: ${response.status} ${response.statusText}`);
      }
    });
  }

  /**
   * Gets authorization headers for Airtable API
   */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json"
    };
  }
}
