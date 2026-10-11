/* Persistência local via IndexedDB; fallback para memória se indisponível. */
const Store = (() => {
  const DB_NAME = "acerto-samba-nigth";
  const DB_VERSION = 1;
  let db;
  const memory = { products: [], history: [] };
  function open() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const d = request.result;
        if (!d.objectStoreNames.contains("products")) d.createObjectStore("products", { keyPath: "id" });
        if (!d.objectStoreNames.contains("history")) d.createObjectStore("history", { keyPath: "id" });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => { db = request.result; resolve(db); };
      request.onerror = () => resolve(null);
    });
  }
  function tx(store, mode, action) {
    return new Promise((resolve, reject) => {
      if (!db) {
        try { resolve(action(null, memory[store])); } catch (e) { reject(e); }
        return;
      }
      const transaction = db.transaction(store, mode);
      const objectStore = transaction.objectStore(store);
      let result;
      try { result = action(objectStore); } catch (e) { reject(e); return; }
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  async function all(store) {
    if (!db) return [...memory[store]];
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, "readonly").objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
  async function put(store, value) {
    if (!db) {
      const arr = memory[store], idx = arr.findIndex(x => x.id === value.id);
      if (idx >= 0) arr[idx] = structuredClone(value); else arr.push(structuredClone(value));
      return value;
    }
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, "readwrite").objectStore(store).put(value);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  }
  async function remove(store, id) {
    if (!db) { const i=memory[store].findIndex(x=>x.id===id); if(i>=0) memory[store].splice(i,1); return; }
    return new Promise((resolve,reject)=>{const r=db.transaction(store,"readwrite").objectStore(store).delete(id);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
  }
  async function getMeta(key) {
    if (!db) return localStorage.getItem("acerto-meta-"+key);
    return new Promise((resolve) => {
      const r=db.transaction("meta","readonly").objectStore("meta").get(key);
      r.onsuccess=()=>resolve(r.result?.value ?? null);r.onerror=()=>resolve(null);
    });
  }
  async function setMeta(key,value) {
    if (!db) { localStorage.setItem("acerto-meta-"+key,value); return; }
    return new Promise((resolve,reject)=>{const r=db.transaction("meta","readwrite").objectStore("meta").put({key,value});r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
  }
  return { open, all, put, remove, getMeta, setMeta };
})();