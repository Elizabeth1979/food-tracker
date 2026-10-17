// localStorage as JSON. Never throws: a full, blocked or corrupt store reads as the default.
export const store = {
  get<T>(k: string, d: T): T { try { return JSON.parse(localStorage.getItem(k) ?? '') ?? d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
