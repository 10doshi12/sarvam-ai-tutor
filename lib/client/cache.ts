import { CACHE } from "@/lib/config";

// Device cache of slow Sarvam results in IndexedDB, addressed by a hash of what produced them.
// Every failure counts as a miss, so a blocked or full cache only costs the speed-up.
const DB_NAME = "doubtless-cache";
const STORE = "results";
const BY_AGE = "at";

type Part = string | ArrayBuffer;

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (opening) return opening;
  const attempt = new Promise<IDBDatabase>((resolve, reject) => {
    // Some browsers can leave an open request unanswered, and preparation must not wait on it.
    setTimeout(() => reject(new Error("Cache did not open")), CACHE.openTimeoutMs);
    const req = indexedDB.open(DB_NAME, CACHE.version);
    // A new version starts empty, because old results came from older prompts or voices.
    req.onupgradeneeded = () => {
      if (req.result.objectStoreNames.contains(STORE)) req.result.deleteObjectStore(STORE);
      req.result.createObjectStore(STORE).createIndex(BY_AGE, BY_AGE);
    };
    req.onsuccess = () => {
      // Step aside when another tab upgrades; the next call reopens.
      req.result.onversionchange = () => {
        req.result.close();
        opening = null;
      };
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  opening = attempt;
  attempt.catch(() => {
    opening = null;
  });
  return attempt;
}

// Resolves only once the transaction has committed, and rejects on any abort, such as a full disk.
function inStore<T>(db: IDBDatabase, mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = act(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function keyFor(kind: string, parts: Part[]): Promise<string> {
  const joined = await new Blob(parts.flatMap((p) => [p, "\0"])).arrayBuffer();
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", joined));
  return `${kind}:${Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function cached<T>(kind: string, parts: Part[], make: () => Promise<T>): Promise<T> {
  const key = await keyFor(kind, parts).catch(() => null);
  const db = key ? await openDb().catch(() => null) : null;
  if (db && key) {
    const hit = await inStore<{ value: T } | undefined>(db, "readonly", (s) => s.get(key)).catch(() => undefined);
    if (hit) return hit.value;
  }
  const value = await make();
  if (db && key) await inStore(db, "readwrite", (s) => s.put({ value, [BY_AGE]: Date.now() }, key)).catch(() => undefined);
  return value;
}

// Removes the oldest entries beyond the cap.
export async function pruneCache(): Promise<void> {
  try {
    const db = await openDb();
    let excess = (await inStore(db, "readonly", (s) => s.count())) - CACHE.maxEntries;
    if (excess <= 0) return;
    await inStore(db, "readwrite", (s) => {
      const walk = s.index(BY_AGE).openCursor();
      walk.onsuccess = () => {
        if (!walk.result || excess-- <= 0) return;
        walk.result.delete();
        walk.result.continue();
      };
      return walk;
    });
  } catch {
    // The browser evicts on its own if this cannot run.
  }
}
