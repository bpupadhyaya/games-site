// Code-drawn pictures for the picture-word questions (no image files). Each drawer paints inside a box of size s centred at (0,0).
const TAU = Math.PI * 2;
const circ = (c, x, y, r, f) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = f; c.fill(); };
const rect = (c, x, y, w, h, f, r = 0) => { c.beginPath(); if (r) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); c.fillStyle = f; c.fill(); };
const poly = (c, pts, f) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = f; c.fill(); };
const line = (c, pts, col, w) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); };
const star = (c, x, y, R, r, f) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; p.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); } poly(c, p, f); };

const D = {
  sun: (c) => { for (let i = 0; i < 12; i++) { const a = i * TAU / 12; line(c, [[Math.cos(a) * 0.34, Math.sin(a) * 0.34], [Math.cos(a) * 0.48, Math.sin(a) * 0.48]], '#ffb703', 0.06); } circ(c, 0, 0, 0.28, '#ffd60a'); },
  moon: (c) => { circ(c, 0, 0, 0.4, '#f4e9a8'); circ(c, 0.17, -0.08, 0.34, '#0d2a3a'); },
  star: (c) => star(c, 0, 0.03, 0.46, 0.2, '#ffd166'),
  cloud: (c) => { for (const [x, y, r] of [[-0.2, 0.05, 0.2], [0, -0.1, 0.26], [0.2, 0.05, 0.2]]) circ(c, x, y, r, '#eaf6ff'); rect(c, -0.4, 0.05, 0.8, 0.2, '#eaf6ff', 0.1); },
  tree: (c) => { rect(c, -0.07, 0.1, 0.14, 0.36, '#8d5a2b'); circ(c, 0, -0.14, 0.3, '#2e9e4f'); circ(c, -0.18, 0.02, 0.2, '#37b35c'); circ(c, 0.18, 0.02, 0.2, '#37b35c'); },
  flower: (c) => { line(c, [[0, 0], [0, 0.46]], '#2e9e4f', 0.07); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; circ(c, Math.cos(a) * 0.18, Math.sin(a) * 0.18 - 0.1, 0.13, '#ff6fa5'); } circ(c, 0, -0.1, 0.1, '#ffd166'); },
  house: (c) => { rect(c, -0.34, -0.05, 0.68, 0.48, '#f2c48d'); poly(c, [[-0.42, -0.04], [0, -0.42], [0.42, -0.04]], '#d1495b'); rect(c, -0.07, 0.17, 0.16, 0.26, '#7a4a21'); rect(c, -0.26, 0.02, 0.14, 0.14, '#9be7ff'); },
  car: (c) => { rect(c, -0.44, 0, 0.88, 0.22, '#ef476f', 0.06); rect(c, -0.24, -0.2, 0.46, 0.24, '#ef476f', 0.08); rect(c, -0.18, -0.15, 0.16, 0.15, '#bfeaff'); rect(c, 0.02, -0.15, 0.16, 0.15, '#bfeaff'); circ(c, -0.24, 0.24, 0.1, '#222'); circ(c, 0.26, 0.24, 0.1, '#222'); },
  ball: (c) => { circ(c, 0, 0, 0.4, '#ff5d5d'); c.save(); c.beginPath(); c.arc(0, 0, 0.4, 0, TAU); c.clip(); rect(c, -0.5, -0.07, 1, 0.14, '#fff'); c.restore(); },
  fish: (c) => { poly(c, [[0.22, 0], [0.46, -0.2], [0.46, 0.2]], '#ff9f1c'); c.beginPath(); c.ellipse(-0.05, 0, 0.34, 0.2, 0, 0, TAU); c.fillStyle = '#ffb84d'; c.fill(); circ(c, -0.2, -0.04, 0.04, '#222'); },
  bird: (c) => { c.beginPath(); c.ellipse(0, 0.04, 0.3, 0.22, 0, 0, TAU); c.fillStyle = '#4cc9f0'; c.fill(); circ(c, 0.24, -0.12, 0.14, '#4cc9f0'); poly(c, [[0.36, -0.14], [0.5, -0.1], [0.36, -0.06]], '#ffb703'); circ(c, 0.27, -0.15, 0.025, '#111'); poly(c, [[-0.28, 0.02], [-0.5, -0.1], [-0.4, 0.12]], '#3a86ff'); line(c, [[-0.05, 0.26], [-0.05, 0.4]], '#ffb703', 0.04); },
  apple: (c) => { circ(c, -0.12, 0.04, 0.26, '#e63946'); circ(c, 0.12, 0.04, 0.26, '#e63946'); line(c, [[0, -0.2], [0.04, -0.38]], '#6b4423', 0.05); poly(c, [[0.04, -0.3], [0.24, -0.4], [0.18, -0.22]], '#43aa8b'); },
  banana: (c) => { c.beginPath(); c.arc(0, -0.15, 0.5, 0.35, Math.PI - 0.35); c.lineWidth = 0.17; c.strokeStyle = '#ffd60a'; c.lineCap = 'round'; c.stroke(); },
  heart: (c) => { c.beginPath(); c.moveTo(0, 0.4); c.bezierCurveTo(-0.6, 0, -0.35, -0.4, 0, -0.14); c.bezierCurveTo(0.35, -0.4, 0.6, 0, 0, 0.4); c.fillStyle = '#ef476f'; c.fill(); },
  cup: (c) => { rect(c, -0.26, -0.22, 0.46, 0.5, '#f1f1f1', 0.08); c.beginPath(); c.arc(0.22, 0.02, 0.14, -Math.PI / 2, Math.PI / 2); c.lineWidth = 0.06; c.strokeStyle = '#f1f1f1'; c.stroke(); rect(c, -0.26, -0.22, 0.46, 0.1, '#8d6e63', 0.04); },
  hat: (c) => { c.beginPath(); c.ellipse(0, 0.2, 0.46, 0.1, 0, 0, TAU); c.fillStyle = '#6a4c93'; c.fill(); rect(c, -0.26, -0.28, 0.52, 0.5, '#8a5cc2', 0.1); rect(c, -0.26, 0.04, 0.52, 0.09, '#ffd166'); },
  shoe: (c) => { poly(c, [[-0.4, 0.2], [-0.4, -0.05], [-0.1, -0.05], [-0.05, -0.28], [0.14, -0.28], [0.12, 0.0], [0.42, 0.1], [0.44, 0.2]], '#3a86ff'); rect(c, -0.42, 0.18, 0.88, 0.08, '#fff', 0.03); },
  book: (c) => { rect(c, -0.34, -0.36, 0.68, 0.74, '#3a86ff', 0.05); rect(c, -0.26, -0.3, 0.55, 0.62, '#fff', 0.03); line(c, [[-0.16, -0.14], [0.2, -0.14]], '#3a86ff', 0.04); line(c, [[-0.16, 0.02], [0.2, 0.02]], '#3a86ff', 0.04); line(c, [[-0.16, 0.18], [0.1, 0.18]], '#3a86ff', 0.04); },
  key: (c) => { circ(c, -0.24, 0, 0.18, '#ffd166'); circ(c, -0.24, 0, 0.07, '#0d2a3a'); rect(c, -0.08, -0.04, 0.54, 0.08, '#ffd166'); rect(c, 0.3, 0.02, 0.07, 0.16, '#ffd166'); rect(c, 0.42, 0.02, 0.06, 0.12, '#ffd166'); },
  bell: (c) => { c.beginPath(); c.moveTo(-0.34, 0.2); c.bezierCurveTo(-0.3, -0.2, -0.2, -0.4, 0, -0.4); c.bezierCurveTo(0.2, -0.4, 0.3, -0.2, 0.34, 0.2); c.closePath(); c.fillStyle = '#ffb703'; c.fill(); rect(c, -0.4, 0.18, 0.8, 0.08, '#ffb703', 0.04); circ(c, 0, 0.32, 0.07, '#8d5a2b'); },
  egg: (c) => { c.beginPath(); c.ellipse(0, 0.04, 0.28, 0.38, 0, 0, TAU); c.fillStyle = '#fff7e6'; c.fill(); c.strokeStyle = '#e8d8b5'; c.lineWidth = 0.03; c.stroke(); },
  boat: (c) => { poly(c, [[-0.46, 0.12], [0.46, 0.12], [0.3, 0.34], [-0.3, 0.34]], '#8d5a2b'); rect(c, -0.02, -0.38, 0.04, 0.5, '#6b4423'); poly(c, [[0.04, -0.36], [0.38, 0.06], [0.04, 0.06]], '#fff'); poly(c, [[-0.04, -0.2], [-0.34, 0.06], [-0.04, 0.06]], '#ffd166'); },
  clock: (c) => { circ(c, 0, 0, 0.42, '#fff'); circ(c, 0, 0, 0.36, '#e8f4ff'); line(c, [[0, 0], [0, -0.24]], '#222', 0.05); line(c, [[0, 0], [0.18, 0.08]], '#222', 0.05); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; circ(c, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.02, '#555'); } },
  cake: (c) => { rect(c, -0.4, 0, 0.8, 0.36, '#f4a261', 0.06); rect(c, -0.4, -0.12, 0.8, 0.16, '#ff8fab', 0.06); for (const x of [-0.2, 0, 0.2]) { rect(c, x - 0.025, -0.34, 0.05, 0.22, '#4cc9f0'); circ(c, x, -0.38, 0.04, '#ffd60a'); } },
  door: (c) => { rect(c, -0.26, -0.42, 0.52, 0.84, '#8d5a2b', 0.05); rect(c, -0.18, -0.34, 0.36, 0.3, '#a7714a'); rect(c, -0.18, 0.04, 0.36, 0.3, '#a7714a'); circ(c, 0.16, 0.0, 0.035, '#ffd166'); },
  chair: (c) => { rect(c, -0.26, -0.4, 0.1, 0.5, '#a7714a'); rect(c, -0.26, 0.05, 0.54, 0.1, '#c68b59'); rect(c, -0.26, 0.15, 0.08, 0.28, '#a7714a'); rect(c, 0.2, 0.15, 0.08, 0.28, '#a7714a'); },
  bed: (c) => { rect(c, -0.44, 0.0, 0.88, 0.22, '#3a86ff', 0.04); rect(c, -0.44, -0.3, 0.08, 0.66, '#8d5a2b'); rect(c, 0.36, -0.1, 0.08, 0.46, '#8d5a2b'); rect(c, -0.34, -0.1, 0.28, 0.12, '#fff', 0.05); },
  umbrella: (c) => { c.beginPath(); c.arc(0, 0, 0.44, Math.PI, 0); c.closePath(); c.fillStyle = '#ef476f'; c.fill(); line(c, [[0, 0], [0, 0.4], [0.1, 0.46]], '#444', 0.05); },
  balloon: (c) => { c.beginPath(); c.ellipse(0, -0.08, 0.26, 0.32, 0, 0, TAU); c.fillStyle = '#ff6fa5'; c.fill(); poly(c, [[-0.04, 0.24], [0.04, 0.24], [0, 0.3]], '#ff6fa5'); line(c, [[0, 0.3], [-0.06, 0.42], [0.06, 0.5]], '#ddd', 0.02); },
  cat: (c) => { circ(c, 0, 0.05, 0.3, '#f4a261'); poly(c, [[-0.28, -0.08], [-0.26, -0.4], [-0.06, -0.2]], '#f4a261'); poly(c, [[0.28, -0.08], [0.26, -0.4], [0.06, -0.2]], '#f4a261'); circ(c, -0.11, 0, 0.04, '#222'); circ(c, 0.11, 0, 0.04, '#222'); poly(c, [[-0.03, 0.08], [0.03, 0.08], [0, 0.13]], '#e63946'); line(c, [[-0.34, 0.1], [-0.12, 0.12]], '#fff', 0.015); line(c, [[0.34, 0.1], [0.12, 0.12]], '#fff', 0.015); },
  dog: (c) => { circ(c, 0, 0.04, 0.28, '#d4a373'); c.beginPath(); c.ellipse(-0.3, 0.0, 0.1, 0.22, 0.2, 0, TAU); c.fillStyle = '#8d5a2b'; c.fill(); c.beginPath(); c.ellipse(0.3, 0.0, 0.1, 0.22, -0.2, 0, TAU); c.fill(); circ(c, -0.1, -0.03, 0.04, '#222'); circ(c, 0.1, -0.03, 0.04, '#222'); circ(c, 0, 0.1, 0.06, '#222'); },
  milk: (c) => { rect(c, -0.2, -0.3, 0.4, 0.7, '#fff', 0.05); poly(c, [[-0.2, -0.3], [0, -0.45], [0.2, -0.3]], '#bfeaff'); rect(c, -0.2, -0.05, 0.4, 0.22, '#4cc9f0'); },
  bread: (c) => { c.beginPath(); c.ellipse(0, 0.05, 0.42, 0.26, 0, 0, TAU); c.fillStyle = '#d99a4e'; c.fill(); for (const x of [-0.18, 0, 0.18]) line(c, [[x - 0.05, -0.06], [x + 0.05, 0.12]], '#b57a32', 0.04); },
  water: (c) => { c.beginPath(); c.moveTo(0, -0.42); c.bezierCurveTo(0.4, 0.1, 0.34, 0.4, 0, 0.4); c.bezierCurveTo(-0.34, 0.4, -0.4, 0.1, 0, -0.42); c.fillStyle = '#4cc9f0'; c.fill(); },
  fire: (c) => { c.beginPath(); c.moveTo(0, -0.44); c.bezierCurveTo(0.5, 0.1, 0.3, 0.42, 0, 0.42); c.bezierCurveTo(-0.3, 0.42, -0.5, 0.1, 0, -0.44); c.fillStyle = '#ff6b35'; c.fill(); c.beginPath(); c.moveTo(0, -0.1); c.bezierCurveTo(0.22, 0.14, 0.15, 0.36, 0, 0.36); c.bezierCurveTo(-0.15, 0.36, -0.22, 0.14, 0, -0.1); c.fillStyle = '#ffd60a'; c.fill(); },
};
export const ART_WORDS = Object.keys(D);
export function drawArt(ctx, key, x, y, s) {
  const f = D[key]; if (!f) return false;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); f(ctx); ctx.restore(); return true;
}
