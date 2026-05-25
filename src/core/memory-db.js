/**
 * SEL-TM IndexedDB 持久化层
 * 负责长期记忆（K）和短期记忆（L）的存储与读取
 */
export class SELMemoryDB {
  constructor() {
    this.dbName = 'SEL_TM_MEMORY';
    this.version = 6;
    this.db = null;
  }

  async init() {
    return new Promise((resolve) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('long_term_K')) {
          db.createObjectStore('long_term_K', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('short_term_L')) {
          db.createObjectStore('short_term_L', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = () => {
        console.warn('IndexedDB 不可用，使用内存存储');
        this.db = null;
        resolve();
      };
    });
  }

  async getLongTerm(key) {
    return this._read('long_term_K', key);
  }

  async setLongTerm(key, value) {
    return this._write('long_term_K', { key, value });
  }

  async getShortTerm(key) {
    return this._read('short_term_L', key);
  }

  async setShortTerm(key, value) {
    return this._write('short_term_L', { key, value });
  }

  async clearAllCache() {
    await this._clear('long_term_K');
    await this._clear('short_term_L');
  }

  async _clear(storeName) {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = resolve;
    });
  }

  async _read(storeName, key) {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value || null);
    });
  }

  async _write(storeName, data) {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(data);
      tx.oncomplete = resolve;
    });
  }
}

export const memoryDB = new SELMemoryDB();