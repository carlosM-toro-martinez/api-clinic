import { PrismaClient as PrismaTenantClient } from '../../node_modules/.prisma/tenant-client';
import { LRUCache } from 'lru-cache';

// ------------------------------
// TYPES
// ------------------------------
interface CacheValue {
  client: PrismaTenantClient;
  lastUsed: number;
}

// ------------------------------
// CONSTANTS
// ------------------------------
const MAX_CLIENTS = Number(process.env.PRISMA_CLIENTS_CACHE_MAX ?? 50);
const IDLE_TIMEOUT_MS = Number(process.env.PRISMA_CLIENT_IDLE_TIMEOUT_MS ?? 10 * 60 * 1000); // 10 min

// ------------------------------
// CACHE
// ------------------------------
const cache = new LRUCache<string, CacheValue>({
  max: MAX_CLIENTS,
  // En LRU v11 el orden de dispose es (value, key)
  dispose: (value, key) => {
    if (value?.client) {
      void value.client.$disconnect().catch((err) => {
        console.error(`[PrismaManager] Error disconnecting ${key}`, err);
      });
      console.log(`[PrismaManager] Disconnected PrismaClient for ${key}`);
    }
  },
});

// ------------------------------
// FUNCTIONS
// ------------------------------
export function getPrismaClientForDatabase(databaseUrl: string): PrismaTenantClient {
  const cached = cache.get(databaseUrl);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.client;
  }

  const client = new PrismaTenantClient({
    datasources: { dbTenant: { url: databaseUrl } },
  });

  void client.$connect().catch((error) => {
    console.error(`[PrismaManager] Error connecting to ${databaseUrl}`, error);
  });

  cache.set(databaseUrl, { client, lastUsed: Date.now() });
  console.log(`[PrismaManager] Created new PrismaClient for ${databaseUrl}`);
  return client;
}

export function cleanIdleClients(): void {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.lastUsed > IDLE_TIMEOUT_MS) {
      cache.delete(key);
      console.log(`[PrismaManager] Removed idle PrismaClient for ${key}`);
    }
  }
}

export async function disconnectAllClients(): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  for (const value of cache.values()) {
    tasks.push(value.client.$disconnect());
  }
  await Promise.allSettled(tasks);
  cache.clear();
  console.log('[PrismaManager] All PrismaClients disconnected.');
}
