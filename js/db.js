"use strict";

const DB_NAME = "mi-entrenamiento";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("comidas")) {
        db.createObjectStore("comidas", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("entrenos")) {
        db.createObjectStore("entrenos", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const DB = {
  _db: null,
  async init() {
    if (!this._db) this._db = await openDB();
    return this._db;
  },

  async add(store, item) {
    const db = await this.init();
    return tx(db, store, "readwrite", (s) => s.put(item));
  },

  async getAll(store) {
    const db = await this.init();
    return tx(db, store, "readonly", (s) => s.getAll());
  },

  async get(store, id) {
    const db = await this.init();
    return tx(db, store, "readonly", (s) => s.get(id));
  },

  async remove(store, id) {
    const db = await this.init();
    return tx(db, store, "readwrite", (s) => s.delete(id));
  },

  async clear(store) {
    const db = await this.init();
    return tx(db, store, "readwrite", (s) => s.clear());
  },

  async putAll(store, items) {
    const db = await this.init();
    return tx(db, store, "readwrite", (s) => {
      items.forEach((it) => s.put(it));
    });
  },

  async counts() {
    const db = await this.init();
    return Promise.all([
      tx(db, "comidas", "readonly", (s) => s.count()),
      tx(db, "entrenos", "readonly", (s) => s.count()),
    ]).then(([comidas, entrenos]) => ({ comidas, entrenos }));
  },
};

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

window.DB = DB;
