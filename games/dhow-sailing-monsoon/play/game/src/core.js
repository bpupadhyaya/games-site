// Shared constants and pure helpers. No DOM, no clock, no Math.random.
export const W = 720, H = 1280;
export const DT = 1 / 60;
export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const wrap180 = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return a; };
export const wrap360 = (a) => ((a % 360) + 360) % 360;
export const sinD = (a) => Math.sin(a * DEG);
export const cosD = (a) => Math.cos(a * DEG);
// compass bearing (deg clockwise from north) of vector (x east, y north)
export const bearingOf = (x, y) => wrap360(Math.atan2(x, y) / DEG);
export const hash01 = (n) => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const pad2 = (n) => String(n).padStart(2, '0');
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MON3 = MONTHS.map((m) => m.slice(0, 3));
export const compassName = (b) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(wrap360(b) / 45) % 8];
export const money = (n) => `${Math.round(n).toLocaleString('en-US')}`;
export const DAYLEN = 70;            // seconds of play for one sky day
