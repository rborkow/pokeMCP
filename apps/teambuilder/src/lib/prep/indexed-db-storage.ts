import type { StateStorage } from "zustand/middleware";

const DATABASE_NAME = "pokemcp-prep";
const STORE_NAME = "workspace";

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
    const database = await openDatabase();
    return new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = action(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => reject(transaction.error);
    });
}

const localFallback: StateStorage = {
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => localStorage.setItem(name, value),
    removeItem: (name) => localStorage.removeItem(name),
};

export const prepIndexedDbStorage: StateStorage = {
    async getItem(name) {
        if (typeof indexedDB === "undefined") return localFallback.getItem(name);
        return (await run("readonly", (store) => store.get(name))) ?? null;
    },
    async setItem(name, value) {
        if (typeof indexedDB === "undefined") return localFallback.setItem(name, value);
        await run("readwrite", (store) => store.put(value, name));
    },
    async removeItem(name) {
        if (typeof indexedDB === "undefined") return localFallback.removeItem(name);
        await run("readwrite", (store) => store.delete(name));
    },
};
