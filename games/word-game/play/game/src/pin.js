// Parent PIN (K12): four digits kept as a scrambled value with its own random salt, never the digits themselves. This keeps a young child out of
// settings; it is a lock for the game, not a security system, and it is stored only on this device.
const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
export const hashPin = (pin, salt) => { let h = fnv(`${salt}:${pin}`); for (let i = 0; i < 4000; i += 1) h = fnv(`${h}:${salt}:${pin}:${i}`); return h.toString(16).padStart(8, '0'); };
export const validPin = (p) => typeof p === 'string' && /^\d{4}$/.test(p);
export const makePin = (pin, salt) => ({ s: String(salt), h: hashPin(pin, salt) });
export const checkPin = (rec, pin) => Boolean(rec && validPin(pin) && hashPin(pin, rec.s) === rec.h);
