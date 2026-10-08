// Shared numbers and small helpers: festival layout, competition levels, scoring, the clock face, rivals.
import { CABERS, STONES, BAR_HEIGHTS } from './physics.js';

export const EVENTS = ['caber', 'stone', 'weight'];
export const EVENT_NAME = { caber: 'Caber Toss', stone: 'Stone Put', weight: 'Weight Over the Bar' };
export const EVENT_SHORT = { caber: 'Caber', stone: 'Stone', weight: 'Weight' };
export const ATTEMPTS = { caber: 3, stone: 3, weight: 5 };

// Competition levels: how forgiving the balance, the sweep and the timing windows are.
export const LEVELS = [
  { id: 1, name: 'Village green', blurb: 'Gentle balance, wide timing windows', noise: 0.55, sweep: 1.35, beat: 0.5, win: 1.25, zone: true },
  { id: 2, name: 'County games', blurb: 'The real thing', noise: 1.0, sweep: 1.1, beat: 0.46, win: 1.0, zone: true },
  { id: 3, name: 'Games champion', blurb: 'Lively caber, quick sweep, tight windows', noise: 1.45, sweep: 0.9, beat: 0.42, win: 0.8, zone: false },
];

// Caber toss scoring. A turn is worth 40; the other 60 come from the clock (direction the pole points) and the line (where the heavy end landed).
export const CABER_MULT = { glen: 0.72, braemar: 1.0, champion: 1.28 };
export function clockOf(psiDeg) {
  // psi: degrees clockwise from 12 o'clock (negative = anticlockwise, i.e. towards 11).
  const mins = Math.round(((psiDeg / 30) * 60 + 12 * 60 + 720 * 4) % 720);   // minutes on a 12 hour dial
  let h = Math.floor(mins / 60) % 12; if (h === 0) h = 12;
  return `${h}:${String(mins % 60).padStart(2, '0')}`;
}
export function scoreCaber(res, caberId) {
  if (!res.turned) return { quality: 0, pts: 0, clockPts: 0, linePts: 0 };
  const a = Math.abs(res.psi);
  const clockAcc = a <= 3 ? 1 : Math.pow(Math.max(0, 1 - (a - 3) / 57), 1.3);
  const lineAcc = Math.max(0, 1 - Math.pow(Math.abs(res.line) / 2.4, 1.1));
  const clockPts = Math.round(60 * 0.65 * clockAcc), linePts = Math.round(60 * 0.35 * lineAcc);
  const quality = 40 + clockPts + linePts;
  return { quality, pts: Math.min(100, Math.round(quality * CABER_MULT[caberId])), clockPts, linePts };
}
export const stonePts = (d, stone) => Math.max(0, Math.min(100, Math.round(((d * (stone.k ? 1 : 1) - 3) / (stone.id === 'light' ? 6.2 : 7.2)) * 100 * (stone.k === 1 ? 1 : 0.85))));
export const barPts = (h) => (h == null ? 0 : Math.max(0, Math.min(100, Math.round(((h - 3.3) / (5.7 - 3.3)) * 100))));

export const fmtM = (d) => `${d.toFixed(2)} m`;
export const fmtH = (h) => `${h.toFixed(2)} m`;

// The five other competitors. Names are plain first names; ratings 0..100 are their typical event points.
export const RIVALS = [
  { name: 'Hamish', rate: { caber: 74, stone: 70, weight: 66 } },
  { name: 'Isla', rate: { caber: 62, stone: 68, weight: 74 } },
  { name: 'Callum', rate: { caber: 56, stone: 60, weight: 58 } },
  { name: 'Morag', rate: { caber: 48, stone: 54, weight: 62 } },
  { name: 'Fergus', rate: { caber: 40, stone: 46, weight: 38 } },
];
export const MEDALS = ['Gold', 'Silver', 'Bronze'];

export { CABERS, STONES, BAR_HEIGHTS };
