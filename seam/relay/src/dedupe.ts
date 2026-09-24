// Idempotency (same id+event is sent once) and per-ticker rate limit (spec §8.2, §8.3).
// In-memory: a restart forgets history. Run a single instance.

export class TtlSet {
  private readonly seen = new Map<string, number>(); // key → expiresAt (insertion ordered)
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries = 20000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  has(key: string, now = Date.now()): boolean {
    const exp = this.seen.get(key);
    if (exp === undefined) return false;
    if (exp <= now) {
      this.seen.delete(key);
      return false;
    }
    return true;
  }

  // Returns true if the key was not present (and is now claimed).
  claim(key: string, now = Date.now()): boolean {
    if (this.has(key, now)) return false;
    this.seen.set(key, now + this.ttlMs);
    this.prune(now);
    return true;
  }

  get size(): number {
    return this.seen.size;
  }

  private prune(now: number): void {
    for (const [k, exp] of this.seen) {
      if (this.seen.size <= this.maxEntries && exp > now) break;
      this.seen.delete(k);
    }
  }
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  // Records a hit and returns true if under the limit; returns false (no record) otherwise.
  allow(key: string, now = Date.now()): boolean {
    const from = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > from);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5000) this.sweep(from);
    return true;
  }

  private sweep(from: number): void {
    for (const [k, list] of this.hits) {
      if (list.every((t) => t <= from)) this.hits.delete(k);
    }
  }
}
