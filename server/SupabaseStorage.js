class SupabaseStorage {
  constructor() {
    this.url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    this.pendingWrites = new Map();
    this.writeErrors = new Map();

    if (Boolean(this.url) !== Boolean(this.serviceKey)) {
      throw new Error(
        "Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or leave both unset.",
      );
    }
  }

  get enabled() {
    return Boolean(this.url && this.serviceKey);
  }

  headers(extra = {}) {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async loadDocument(id) {
    if (!this.enabled) return null;

    const url = new URL(`${this.url}/rest/v1/game_documents`);
    url.searchParams.set("id", `eq.${id}`);
    url.searchParams.set("select", "payload");

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw new Error(
        `[Supabase] Load ${id} failed (${response.status}): ${await response.text()}`,
      );
    }

    const rows = await response.json();
    return rows.length ? rows[0].payload : null;
  }

  saveDocument(id, payload) {
    if (!this.enabled) return Promise.resolve();

    const previous = this.pendingWrites.get(id) || Promise.resolve();
    const operation = previous
      .catch(() => {})
      .then(() => this.upsertDocument(id, payload));
    const tracked = operation.catch((error) => {
      this.writeErrors.set(id, error);
      console.error(`[Supabase] Save ${id} failed:`, error.message);
      throw error;
    });

    this.pendingWrites.set(id, tracked);
    tracked.then(
      () => {
        this.writeErrors.delete(id);
        if (this.pendingWrites.get(id) === tracked) {
          this.pendingWrites.delete(id);
        }
      },
      () => {
        if (this.pendingWrites.get(id) === tracked) {
          this.pendingWrites.delete(id);
        }
      },
    );

    return tracked;
  }

  async upsertDocument(id, payload) {
    const url = new URL(`${this.url}/rest/v1/game_documents`);
    url.searchParams.set("on_conflict", "id");

    const response = await fetch(url, {
      method: "POST",
      headers: this.headers({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        id,
        payload,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `[Supabase] Upsert ${id} failed (${response.status}): ${await response.text()}`,
      );
    }
  }

  async flush() {
    while (this.pendingWrites.size) {
      await Promise.all(this.pendingWrites.values());
    }

    if (this.writeErrors.size) {
      throw new AggregateError(
        Array.from(this.writeErrors.values()),
        "One or more Supabase documents could not be saved.",
      );
    }
  }
}

module.exports = new SupabaseStorage();