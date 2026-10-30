// Bentengan chrome: HUD plaques and keys are lacquered village wood (bamboo-brown grain) with a brass edge, so the buttons and score boards
// belong to the same world as the field. Pure 2D drawing, one cached grain pattern per context, no assets.
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); } catch { /* fall through */ } const c = globalThis.document?.createElement('canvas'); if (c) { c.width = w; c.height = h; } return c; };
const cache = new Map();

function grain(ctx, key) {
  let e = cache.get(key);
  if (!e || e.ctx !== ctx) {
    const c = mk(256, 128); if (!c) return null;
    const g = c.getContext('2d'), r = lcg(key === 'lit' ? 5 : 23);
    const [a, b] = key === 'lit' ? ['#5a4020', '#3d2a14'] : ['#33250f', '#22190a'];
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 64; i++) {
      const y = r() * 128, amp = 0.8 + r() * 2, ph = r() * 6;
      g.strokeStyle = r() > 0.5 ? `rgba(12,6,0,${0.12 + r() * 0.16})` : `rgba(255,200,130,${0.05 + r() * 0.08})`; g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath(); for (let x = 0; x <= 256; x += 8) { const yy = y + Math.sin(x * 0.03 + ph) * amp; x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke();
    }
    e = { ctx, pat: ctx.createPattern(c, 'repeat') }; cache.set(key, e);
  }
  return e.pat;
}

/** A wooden plaque with a brass edge. active = lit brass (the side to move); a = overall opacity of the wood. */
export function plank(ctx, r, rad, { a = 1, active = false, lit = false, press = 0, dim = false } = {}) {
  const x = r.x, y = r.y + press, w = r.w, h = r.h;
  ctx.save();
  if (dim) ctx.globalAlpha *= 0.5;
  ctx.fillStyle = 'rgba(0,12,4,0.5)'; ctx.beginPath(); ctx.roundRect(x + 1, r.y + 6 - press * 0.5, w, h, rad); ctx.fill();
  if (active) { ctx.shadowColor = 'rgba(255,214,110,0.75)'; ctx.shadowBlur = 16; }
  ctx.globalAlpha *= a; ctx.fillStyle = grain(ctx, lit ? 'lit' : 'dark') || '#2a1d0c'; ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.fill();
  ctx.shadowBlur = 0; ctx.globalAlpha = dim ? 0.5 : 1;
  const sh = ctx.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,220,160,0.18)'); sh.addColorStop(0.45, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.fill();
  const bz = ctx.createLinearGradient(0, y, 0, y + h);
  if (active) { bz.addColorStop(0, '#fff0b0'); bz.addColorStop(0.5, '#ffd34a'); bz.addColorStop(1, '#b8801a'); } else { bz.addColorStop(0, '#f0d28a'); bz.addColorStop(0.5, '#b88a34'); bz.addColorStop(1, '#6b4a14'); }
  ctx.strokeStyle = bz; ctx.lineWidth = active ? 3.5 : 2.5; ctx.beginPath(); ctx.roundRect(x + 1.2, y + 1.2, w - 2.4, h - 2.4, Math.max(2, rad - 1)); ctx.stroke();
  if (h >= 60 && w >= 120) {   // brass rivets in the corners
    const k = Math.min(rad * 0.62, 14); ctx.fillStyle = '#e6c46a';
    for (const [px, py] of [[x + k, y + k], [x + w - k, y + k], [x + k, y + h - k], [x + w - k, y + h - k]]) { ctx.beginPath(); ctx.arc(px, py, 2.4, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(70,40,0,0.5)'; ctx.beginPath(); ctx.arc(px + 0.7, py + 0.9, 1.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#e6c46a'; }
  }
  ctx.restore();
}
