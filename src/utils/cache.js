/**
 * A simple TTL-based memory cache utility.
 */
class Cache {
  constructor(options = {}) {
    this.ttl = options.ttl || 10 * 60 * 1000; // Default 10 minutes
    this.storage = new Map();
  }

  set(key, value, ttl = this.ttl) {
    const expires = Date.now() + ttl;
    this.storage.set(key, { value, expires });
  }

  get(key) {
    const entry = this.storage.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.storage.delete(key);
      return null;
    }

    return entry.value;
  }

  delete(key) {
    this.storage.delete(key);
  }

  clear() {
    this.storage.clear();
  }

  /**
   * Clears expired entries from the cache.
   */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (now > entry.expires) {
        this.storage.delete(key);
      }
    }
  }
}

module.exports = Cache;
