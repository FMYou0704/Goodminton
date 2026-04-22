import type { TournamentState } from "../types/tournament";

const DB_NAME = "badminton-doubles-scheduler";
const DB_VERSION = 1;
const STORE_NAME = "kv";
const STATE_KEY = "current-tournament";
const LOCAL_STORAGE_KEY = "badminton-doubles-scheduler:state";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function readFromIndexedDb(): Promise<TournamentState | undefined> {
  return openDb().then(
    (db) =>
      new Promise<TournamentState | undefined>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(STATE_KEY);

        request.onsuccess = () => resolve(request.result as TournamentState | undefined);
        request.onerror = () => reject(request.error ?? new Error("Failed to read state"));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
      })
  );
}

function writeToIndexedDb(state: TournamentState): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(state, STATE_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("Failed to save state"));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
      })
  );
}

function readFromLocalStorage(): TournamentState | undefined {
  if (!hasLocalStorage()) return undefined;
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return undefined;
  return JSON.parse(raw) as TournamentState;
}

function writeToLocalStorage(state: TournamentState): void {
  if (!hasLocalStorage()) return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

export async function loadTournamentState(): Promise<TournamentState | undefined> {
  try {
    const indexedDbState = await readFromIndexedDb();
    return indexedDbState ?? readFromLocalStorage();
  } catch {
    return readFromLocalStorage();
  }
}

export async function saveTournamentState(state: TournamentState): Promise<void> {
  try {
    await writeToIndexedDb(state);
  } catch {
    writeToLocalStorage(state);
  }
}
