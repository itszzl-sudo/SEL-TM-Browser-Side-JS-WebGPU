/**
 * 浏览器环境模拟器
 * 为 Node.js 环境提供浏览器 API 模拟
 */

// 模拟浏览器全局对象
globalThis.window = globalThis;
globalThis.document = {
  createElement: (tag) => createHTMLElement(tag),
  getElementById: (id) => null,
  getElementsByTagName: () => [],
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  body: { appendChild: () => {} },
  head: { appendChild: () => {} },
  location: { href: 'http://localhost:8000' },
  readyState: 'complete'
};

// 模拟 Navigator (使用 try-catch 避免只读属性错误)
try {
  globalThis.navigator = {
    userAgent: 'Mozilla/5.0 (Node.js) SEL-TM Engine',
    hardwareConcurrency: 4,
    devicePixelRatio: 1
  };
} catch (e) {
  // navigator 是只读属性，跳过
}

// 模拟 Canvas
class MockCanvas {
  constructor() {
    this.width = 800;
    this.height = 600;
    this._context = null;
  }
  
  getContext(type) {
    if (type === 'webgpu') {
      return {
        getCurrentTexture: () => ({ createView: () => ({}) }),
        configure: () => {}
      };
    }
    return this._context;
  }
  
  addEventListener() {}
  removeEventListener() {}
}

// 模拟 HTMLElement
function createHTMLElement(tag) {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    className: '',
    id: '',
    innerHTML: '',
    textContent: '',
    offsetWidth: 0,
    offsetHeight: 0,
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: 0, bottom: 0,
      width: 0, height: 0, x: 0, y: 0
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    classList: { add: () => {}, remove: () => {}, contains: () => false }
  };
}

// 模拟 WebGPU 相关 API
globalThis.GPUBufferUsage = {
  VERTEX: 1,
  COPY_DST: 2,
  INDEX: 4,
  UNIFORM: 8,
  STORAGE: 16,
  COPY_SRC: 32
};

globalThis.GPUTextureUsage = {
  COPY_SRC: 1,
  COPY_DST: 2,
  TEXTURE_BINDING: 4,
  STORAGE_BINDING: 8,
  RENDER_ATTACHMENT: 16
};

globalThis.GPUMapMode = {
  READ: 1,
  WRITE: 2
};

globalThis.GPULoadOp = {
  CLEAR: 'clear',
  LOAD: 'load'
};

globalThis.GPUStoreOp = {
  STORE: 'store',
  CLEAR: 'clear'
};

// 模拟性能 API
globalThis.performance = {
  now: () => Date.now(),
  mark: () => {},
  measure: () => {}
};

// 模拟 requestAnimationFrame
globalThis.requestAnimationFrame = (callback) => {
  setTimeout(callback, 16);
  return 1;
};

globalThis.cancelAnimationFrame = () => {};

// 模拟 fetch
globalThis.fetch = async (url) => {
  const fs = await import('fs');
  const path = await import('path');
  
  try {
    const fullPath = path.resolve(url);
    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return {
      text: () => Promise.resolve(content),
      json: () => Promise.resolve(JSON.parse(content)),
      ok: true,
      status: 200
    };
  } catch (error) {
    return {
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
      ok: false,
      status: 404
    };
  }
};

// 模拟 URL
globalThis.URL = class {
  constructor(url) {
    this.href = url;
    this.pathname = url;
  }
};

// 模拟 EventTarget
class EventTarget {
  constructor() {
    this._listeners = {};
  }
  
  addEventListener(type, callback) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(callback);
  }
  
  removeEventListener(type, callback) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter(cb => cb !== callback);
  }
  
  dispatchEvent(event) {
    if (!this._listeners[event.type]) return;
    this._listeners[event.type].forEach(callback => callback(event));
  }
}

// 模拟 Event
class Event {
  constructor(type) {
    this.type = type;
    this.target = null;
    this.currentTarget = null;
    this.bubbles = false;
    this.cancelable = false;
    this.defaultPrevented = false;
  }
  
  preventDefault() {
    this.defaultPrevented = true;
  }
  
  stopPropagation() {
    this.bubbles = false;
  }
}

globalThis.Event = Event;
globalThis.EventTarget = EventTarget;

// 模拟 ResizeObserver
globalThis.ResizeObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  
  observe() {}
  unobserve() {}
  disconnect() {}
};

// 模拟 IntersectionObserver
globalThis.IntersectionObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  
  observe() {}
  unobserve() {}
  disconnect() {}
};

// 模拟 IndexedDB
const indexedDB = {
  open: (name, version) => {
    return {
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: {
        transaction: () => ({
          objectStore: () => ({
            get: () => ({
              onsuccess: null,
              result: null
            }),
            put: () => ({
              onsuccess: null
            }),
            delete: () => ({
              onsuccess: null
            })
          })
        }),
        close: () => {}
      }
    };
  }
};

globalThis.indexedDB = indexedDB;

console.log('✅ 浏览器环境模拟初始化完成');

// 导出模拟工具
export { MockCanvas, createHTMLElement };