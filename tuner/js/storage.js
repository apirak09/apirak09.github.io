const DATABASE_NAME = "vocal-trainer-v1";
const STORE_NAME = "takes";
const memoryTakes = new Map();
const cachedTakes = new Map();
const deletedIds = new Set();
const memorySettings = new Map();
let database = null;
let openPromise = null;
let storageStatus = "checking";

/** persistent = IndexedDB; session-only = browser refused storage or a write failed. */
export function getStorageStatus() {
  return storageStatus;
}

function openDatabase() {
  if (database) return Promise.resolve(database);
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve) => {
    if (!globalThis.indexedDB) {
      storageStatus = "session-only";
      resolve(null);
      return;
    }
    let request;
    let settled = false;
    let timer;
    const finish = (db) => {
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      database = db;
      storageStatus = db ? "persistent" : "session-only";
      resolve(db);
    };
    try {
      request = globalThis.indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? request.transaction.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: "id" });
        if (!store.indexNames.contains("songId"))
          store.createIndex("songId", "songId", { unique: false });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          if (database === db) {
            database = null;
            openPromise = null;
            storageStatus = "session-only";
          }
        };
        finish(db);
      };
      request.onerror = () => finish(null);
      // A tab holding an old database must not freeze the trainer.
      request.onblocked = () => finish(null);
      timer = setTimeout(() => finish(null), 5000);
    } catch {
      finish(null);
    }
  });
  return openPromise;
}

function transaction(db, mode, operation) {
  return new Promise((resolve, reject) => {
    let tx;
    let request;
    let result;
    try {
      tx = db.transaction(STORE_NAME, mode);
      request = operation(tx.objectStore(STORE_NAME));
      request.onsuccess = () => {
        result = request.result;
      };
      // Request success does not mean a write committed (quota errors may follow).
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          tx.error ||
            request.error ||
            new Error("Local storage transaction was interrupted."),
        );
      tx.onerror = () =>
        reject(
          tx.error ||
            request.error ||
            new Error("Local storage is unavailable."),
        );
    } catch (error) {
      reject(error);
    }
  });
}

function sorted(takes, songId) {
  return takes
    .filter((take) => !songId || take.songId === songId)
    .sort((a, b) => {
      const first = new Date(a.date).getTime() || 0;
      const second = new Date(b.date).getTime() || 0;
      return second - first;
    });
}

export async function listTakes(songId) {
  const db = await openDatabase();
  let entries = [...cachedTakes.values()];
  if (db) {
    try {
      entries = await transaction(db, "readonly", (store) => store.getAll());
      cachedTakes.clear();
      entries.forEach((take) => cachedTakes.set(take.id, take));
    } catch {
      storageStatus = "session-only";
    }
  }
  const merged = new Map(entries.map((take) => [take.id, take]));
  memoryTakes.forEach((take, id) => merged.set(id, take));
  deletedIds.forEach((id) => merged.delete(id));
  return sorted([...merged.values()], songId);
}

export async function saveTake(take) {
  if (
    !take ||
    typeof take !== "object" ||
    typeof take.songId !== "string" ||
    !take.songId
  ) {
    throw new TypeError("A take must identify its song.");
  }
  const id =
    take.id ||
    globalThis.crypto?.randomUUID?.() ||
    `take-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entry = { ...take, id, date: take.date ?? new Date().toISOString() };
  const db = await openDatabase();
  if (db) {
    try {
      await transaction(db, "readwrite", (store) => store.put(entry));
      cachedTakes.set(id, entry);
      memoryTakes.delete(id);
      deletedIds.delete(id);
      return id;
    } catch {
      storageStatus = "session-only";
    }
  }
  memoryTakes.set(id, entry);
  deletedIds.delete(id);
  storageStatus = "session-only";
  return id;
}

export async function getTake(id) {
  if (!id || deletedIds.has(id)) return null;
  if (memoryTakes.has(id)) return memoryTakes.get(id);
  const db = await openDatabase();
  if (db) {
    try {
      const take = await transaction(db, "readonly", (store) => store.get(id));
      if (take) cachedTakes.set(id, take);
      return take || null;
    } catch {
      storageStatus = "session-only";
    }
  }
  return cachedTakes.get(id) || null;
}

export async function deleteTake(id) {
  if (!id) return;
  const db = await openDatabase();
  if (db) {
    try {
      // Quota fallback takes may exist only in memory. A read distinguishes
      // those from durable takes without requiring another quota-limited write.
      const stored = await transaction(db, "readonly", (store) =>
        store.get(id),
      );
      if (stored)
        await transaction(db, "readwrite", (store) => store.delete(id));
    } catch (error) {
      storageStatus = "session-only";
      throw new Error(
        "This take could not be deleted from browser storage. It has been kept; try again after freeing some storage.",
        { cause: error },
      );
    }
  } else if (cachedTakes.has(id)) {
    // A database that was previously readable may have become unavailable.
    // Do not hide a durable recording and imply that deletion succeeded.
    throw new Error(
      "Browser storage is unavailable. This take has been kept so you can try deleting it again.",
    );
  }
  memoryTakes.delete(id);
  cachedTakes.delete(id);
  deletedIds.delete(id);
}

export function getSetting(name, fallback = null) {
  if (memorySettings.has(name)) return memorySettings.get(name);
  try {
    const value = globalThis.localStorage?.getItem(`vocal-trainer:${name}`);
    return value === null || value === undefined ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Returns false when this preference can only be remembered until the page closes. */
export function setSetting(name, value) {
  memorySettings.set(name, value);
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.setItem(
      `vocal-trainer:${name}`,
      JSON.stringify(value),
    );
    return true;
  } catch {
    return false;
  }
}
