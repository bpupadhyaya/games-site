// Kho-Kho chrome: the buttons, plaques and title lettering are part of the same world as the court: teak with a visible grain and brass
// edges, lacquered marigold and teal for the main actions, a slate chalkboard for the score card. Pure 2D drawing, cached patterns, no assets.
const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const mkCanvas = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); } catch { /* fall through */ } const c = globalThis.document?.createElement('canvas'); if (c) { c.width = w; c.height = h; } return c; };

const patterns = new Map();
function teak(ctx, kind) {
  let e = patterns.get(kind);
  if (!e || e.ctx !== ctx) {
    const c = mkCanvas(256, 128); if (!c) return null;
    const g = c.getContext('2d'), r = lcg(kind === 'light' ? 3 : 17);
    const [a, b] = kind === 'light' ? ['#8a5a30', '#6c421f'] : kind === 'slate' ? ['#1e2e2a', '#16231f'] : ['#4b2c16', '#331d0e'];
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    if (kind === 'slate') {
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.03})`; g.beginPath(); g.ellipse(r() * 256, r() * 128, 4 + r() * 24, 1 + r() * 4, r() * 3, 0, TAU); g.fill(); }
      for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${0.03 + r() * 0.04})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const x = r() * 256, y = r() * 128; g.moveTo(x, y); g.quadraticCurveTo(x + 20, y + (r() - 0.5) * 12, x + 40 + r() * 40, y + (r() - 0.5) * 8); g.stroke(); }
    } else {
      for (let i = 0; i < 70; i++) {
        const y = r() * 128, amp = 1 + r() * 2.2, ph = r() * 6;
        g.strokeStyle = r() > 0.5 ? `rgba(20,8,0,${0.10 + r() * 0.16})` : `rgba(255,190,120,${0.05 + r() * 0.08})`; g.lineWidth = 0.6 + r() * 1.5;
        g.beginPath(); for (let x = 0; x <= 256; x += 8) { const yy = y + Math.sin(x * 0.03 + ph) * amp; x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke();
      }
      for (let i = 0; i < 5; i++) { const x = r() * 256, y = r() * 128; g.strokeStyle = 'rgba(15,5,0,0.28)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(x, y, k * 5, k * 2.2, 0, 0, TAU); g.stroke(); } }
    }
    const pat = ctx.createPattern(c, 'repeat');
    e = { ctx, pat }; patterns.set(kind, e);
  }
  return e.pat;
}

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

/** A wooden plaque / lacquered key. tone: 'teak' | 'gold' | 'teal' | 'coral'. */
export function plaque(ctx, r, { tone = 'teak', press = 0, dim = false, rad } = {}) {
  const radius = rad ?? Math.min(r.h * 0.3, 26), x = r.x, y = r.y + press, w = r.w, h = r.h;
  ctx.save();
  if (dim) ctx.globalAlpha *= 0.5;
  // contact shadow
  ctx.fillStyle = 'rgba(0,0,10,0.5)'; rr(ctx, x + 1, r.y + 7 - press * 0.5, w, h, radius); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,10,0.32)'; rr(ctx, x - 1, r.y + 3, w + 2, h + 2, radius + 1); ctx.fill();
  // body
  if (tone === 'teak') {
    const p = teak(ctx, 'dark'); ctx.fillStyle = p || '#3a2210'; rr(ctx, x, y, w, h, radius); ctx.fill();
    const sh = ctx.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,214,150,0.16)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = sh; rr(ctx, x, y, w, h, radius); ctx.fill();
  } else {
    const c = tone === 'gold' ? ['#ffe58a', '#ffbe2e', '#d9780a'] : tone === 'teal' ? ['#86f7e8', '#27c9b6', '#0a7a74'] : ['#ffb08a', '#ff7a45', '#c9421a'];
    const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c[0]); gr.addColorStop(0.5, c[1]); gr.addColorStop(1, c[2]);
    ctx.fillStyle = gr; rr(ctx, x, y, w, h, radius); ctx.fill();
    // lacquer: darker lower rim and a soft light band along the top edge (a reflection, not a glossy blob)
    const rim = ctx.createLinearGradient(0, y + h * 0.62, 0, y + h); rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(60,20,0,0.35)');
    ctx.fillStyle = rim; rr(ctx, x, y, w, h, radius); ctx.fill();
    ctx.save(); rr(ctx, x, y, w, h, radius); ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + h * 0.42); band.addColorStop(0, 'rgba(255,255,255,0.42)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band; ctx.fillRect(x, y, w, h * 0.42); ctx.restore();
  }
  // brass bezel: bright top edge, dark bottom edge, a hairline of shadow inside
  const bz = ctx.createLinearGradient(0, y, 0, y + h);
  if (tone === 'teak') { bz.addColorStop(0, '#ffe29a'); bz.addColorStop(0.5, '#c9962e'); bz.addColorStop(1, '#6b4710'); } else { bz.addColorStop(0, 'rgba(255,255,255,0.95)'); bz.addColorStop(0.5, 'rgba(255,255,255,0.45)'); bz.addColorStop(1, 'rgba(90,40,0,0.7)'); }
  ctx.strokeStyle = bz; ctx.lineWidth = tone === 'teak' ? 3 : 2.5; rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(2, radius - 1.5)); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; rr(ctx, x + 4.5, y + 4.5, w - 9, h - 9, Math.max(2, radius - 4)); ctx.stroke();
  // brass screws at the ends of a wide plaque
  if (tone === 'teak' && w > 120 && h > 44) {
    for (const sx of [x + 15, x + w - 15]) {
      const gr = ctx.createRadialGradient(sx - 1.5, y + h / 2 - 1.5, 0.5, sx, y + h / 2, 5.5); gr.addColorStop(0, '#fff1c2'); gr.addColorStop(1, '#8a5f12');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, y + h / 2, 4.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(40,20,0,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx - 2.6, y + h / 2 + 1.4); ctx.lineTo(sx + 2.6, y + h / 2 - 1.4); ctx.stroke();
    }
  }
  ctx.restore();
}

/** The slate chalkboard card in a teak frame. */
export function chalkboard(ctx, r, rad = 22) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,10,0.5)'; rr(ctx, r.x + 1, r.y + 7, r.w, r.h, rad); ctx.fill();
  const p = teak(ctx, 'light'); ctx.fillStyle = p || '#5a3818'; rr(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill();
  const F = Math.min(10, r.h * 0.1);
  ctx.save(); rr(ctx, r.x + F, r.y + F, r.w - 2 * F, r.h - 2 * F, Math.max(4, rad - F * 0.8)); ctx.clip();
  const s = teak(ctx, 'slate'); ctx.fillStyle = s || '#1b2a26'; ctx.fillRect(r.x, r.y, r.w, r.h);
  const inner = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); inner.addColorStop(0, 'rgba(0,0,0,0.38)'); inner.addColorStop(0.12, 'rgba(0,0,0,0)'); inner.addColorStop(0.9, 'rgba(0,0,0,0)'); inner.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = inner; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore();
  const bz = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); bz.addColorStop(0, '#ffe29a'); bz.addColorStop(0.5, '#b8862a'); bz.addColorStop(1, '#5e3f0c');
  ctx.strokeStyle = bz; ctx.lineWidth = 2.5; rr(ctx, r.x + 1.2, r.y + 1.2, r.w - 2.4, r.h - 2.4, rad - 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; rr(ctx, r.x + F - 0.5, r.y + F - 0.5, r.w - 2 * F + 1, r.h - 2 * F + 1, Math.max(4, rad - F * 0.8)); ctx.stroke();
  ctx.restore();
}

/** Embossed gold lettering: an extrusion down and to the right, a lit face, a hairline outline and a top highlight. */
export function title3d(ctx, str, x, y, size, font) {
  ctx.save();
  ctx.font = font; ctx.textAlign = 'center';
  const depth = Math.max(5, size * 0.1);
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,12,0.45)'; ctx.fillText(str, x + depth * 0.9, y + depth * 1.9);
  for (let i = depth; i >= 1; i--) {
    const k = i / depth;
    ctx.fillStyle = `rgb(${Math.round(120 + 70 * (1 - k))},${Math.round(58 + 40 * (1 - k))},${Math.round(6)})`;
    ctx.fillText(str, x + i * 0.55, y + i * 0.95);
  }
  const m = ctx.measureText(str), asc = size * 0.82;
  const fg = ctx.createLinearGradient(0, y - asc, 0, y + size * 0.06);
  fg.addColorStop(0, '#fff7c8'); fg.addColorStop(0.38, '#ffd552'); fg.addColorStop(0.62, '#ffb21c'); fg.addColorStop(1, '#e27a05');
  ctx.fillStyle = fg; ctx.fillText(str, x, y);
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, size * 0.022); ctx.strokeStyle = 'rgba(110,50,0,0.85)'; ctx.strokeText(str, x, y);
  // specular band across the upper third (clipped to the letter shapes by drawing it with source-atop on a scratch layer)
  const w = Math.ceil(m.width + depth * 4), h = Math.ceil(size * 1.3);
  const c = mkCanvas(w, h);
  if (c) {
    const g = c.getContext('2d'); g.font = font; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(str, w / 2, h * 0.82);
    g.globalCompositeOperation = 'source-in';
    const hl = g.createLinearGradient(0, h * 0.82 - asc, 0, h * 0.82 - asc * 0.45); hl.addColorStop(0, 'rgba(255,255,255,0.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.fillRect(0, 0, w, h);
    ctx.drawImage(c, x - w / 2, y - h * 0.82);
  }
  ctx.restore();
}

// Small glyphs for the secondary buttons (cream line icons, drawn in a 24 x 24 box).
export function icon(ctx, name, cx, cy, s, color = '#fbe9b5') {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const P = (fn) => { ctx.beginPath(); fn(); };
  if (name === 'auto') { P(() => { ctx.arc(12, 12, 9.5, 0, TAU); }); ctx.stroke(); P(() => { ctx.moveTo(10, 7.5); ctx.lineTo(16.5, 12); ctx.lineTo(10, 16.5); ctx.closePath(); }); ctx.fill(); }
  else if (name === 'book') { P(() => { ctx.moveTo(3, 5); ctx.quadraticCurveTo(8, 3.5, 12, 6); ctx.quadraticCurveTo(16, 3.5, 21, 5); ctx.lineTo(21, 19); ctx.quadraticCurveTo(16, 17.5, 12, 20); ctx.quadraticCurveTo(8, 17.5, 3, 19); ctx.closePath(); }); ctx.stroke(); P(() => { ctx.moveTo(12, 6); ctx.lineTo(12, 20); }); ctx.stroke(); }
  else if (name === 'info') { P(() => { ctx.arc(12, 12, 9.5, 0, TAU); }); ctx.stroke(); P(() => { ctx.moveTo(12, 11); ctx.lineTo(12, 17); }); ctx.stroke(); P(() => { ctx.arc(12, 7.4, 1.3, 0, TAU); }); ctx.fill(); }
  else if (name === 'rules') { P(() => { ctx.roundRect(5, 3, 14, 18, 2.5); }); ctx.stroke(); for (const yy of [8, 12, 16]) { P(() => { ctx.moveTo(8.5, yy); ctx.lineTo(15.5, yy); }); ctx.stroke(); } }
  else if (name === 'gear') { P(() => { ctx.arc(12, 12, 3.2, 0, TAU); }); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P(() => { ctx.moveTo(12 + Math.cos(a) * 6.6, 12 + Math.sin(a) * 6.6); ctx.lineTo(12 + Math.cos(a) * 9.6, 12 + Math.sin(a) * 9.6); }); ctx.lineWidth = 3.4; ctx.stroke(); } ctx.lineWidth = 2.4; P(() => { ctx.arc(12, 12, 6.6, 0, TAU); }); ctx.stroke(); }
  else if (name === 'level') { P(() => { ctx.moveTo(4, 20); ctx.lineTo(4, 14); ctx.lineTo(9, 14); ctx.lineTo(9, 9); ctx.lineTo(14, 9); ctx.lineTo(14, 4); ctx.lineTo(20, 4); ctx.lineTo(20, 20); ctx.closePath(); }); ctx.stroke(); }
  else if (name === 'play') { P(() => { ctx.moveTo(7, 4); ctx.lineTo(19, 12); ctx.lineTo(7, 20); ctx.closePath(); }); ctx.fill(); }
  ctx.restore();
}
