// Oyun -> UI olay kanalı
const handlers = {};
export function on(name, fn) { (handlers[name] || (handlers[name] = [])).push(fn); }
export function emit(name, data) { const h = handlers[name]; if (h) for (const fn of h) fn(data); }
