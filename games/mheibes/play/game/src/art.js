// Art: the majlis room (cached), the seated players (drawn people with expressions) and the fists. One warm lamp, upper centre.
// Everything is drawn with canvas paths; the room is painted once into an OffscreenCanvas where it exists (headless runs draw it directly).
import { host } from './layout.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(Math.max(2, Math.ceil(w)), Math.max(2, Math.ceil(h))); const x = c.getContext('2d'); if (x) return { c, x }; } } catch { /* no canvas */ } return null; };
const px = () => clamp((host.px || 0.6) * (host.dpr || 2), 0.5, 3);

// ------------------------------------------------------------------------------------------------ the room
export const CARPETS = {
  garnet: { name: 'Garnet', a: '#8c1f2b', b: '#5a1019', line: '#e8c27a', dot: '#f4e2b0' },
  indigo: { name: 'Indigo', a: '#27407f', b: '#162550', line: '#e8c27a', dot: '#d9ecff' },
  jade: { name: 'Jade', a: '#1f6b5c', b: '#0f3d36', line: '#f0d38a', dot: '#d9fff0' },
};
export const CARPET_KEYS = ['garnet', 'indigo', 'jade'];

function paintRoom(ctx, w, h, horizon, pal) {
  // wall: warm plaster in lamp light fading to deep indigo at the corners, with a tiled dado and an arched niche
  const wall = ctx.createLinearGradient(0, 0, 0, horizon);
  wall.addColorStop(0, '#1a1840'); wall.addColorStop(1, '#3a2a4a');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, w, horizon + 4);
  const rnd = lcg(912);
  const tile = Math.max(26, Math.min(w, h) / 14);
  ctx.strokeStyle = 'rgba(255,214,150,0.07)'; ctx.lineWidth = 1;
  for (let y = 0; y < horizon; y += tile) for (let x = ((y / tile) % 2) * tile / 2; x < w; x += tile) {            // plaster blocks
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, tile - 2, tile - 2, 4); ctx.stroke();
  }
  // arched niche behind the middle of the row
  const nx = w / 2, nw = Math.min(w * 0.46, 420), ny = Math.max(6, horizon * 0.1), nh = horizon * 0.8;
  ctx.beginPath(); ctx.moveTo(nx - nw / 2, ny + nh); ctx.lineTo(nx - nw / 2, ny + nw / 2); ctx.arc(nx, ny + nw / 2, nw / 2, Math.PI, 0); ctx.lineTo(nx + nw / 2, ny + nh); ctx.closePath();
  const ng = ctx.createLinearGradient(0, ny, 0, ny + nh); ng.addColorStop(0, '#0a0a22'); ng.addColorStop(1, '#2a1a3a');
  ctx.fillStyle = ng; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(232,194,122,0.55)'; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(232,194,122,0.25)'; ctx.beginPath(); ctx.moveTo(nx - nw / 2 + 12, ny + nh); ctx.lineTo(nx - nw / 2 + 12, ny + nw / 2); ctx.arc(nx, ny + nw / 2, nw / 2 - 12, Math.PI, 0); ctx.lineTo(nx + nw / 2 - 12, ny + nh); ctx.stroke();
  for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(255,236,190,${0.2 + rnd() * 0.5})`; ctx.beginPath(); ctx.arc(nx + (rnd() - 0.5) * nw * 0.8, ny + nw * 0.12 + rnd() * nh * 0.6, 0.8 + rnd() * 1.6, 0, TAU); ctx.fill(); }   // stars in the night window
  // floor skirting
  ctx.fillStyle = '#120f26'; ctx.fillRect(0, horizon - 4, w, 10);
  ctx.fillStyle = 'rgba(232,194,122,0.5)'; ctx.fillRect(0, horizon - 4, w, 2);
  // carpet: the whole floor, with a border and a lattice of diamonds
  const cg = ctx.createLinearGradient(0, horizon, 0, h); cg.addColorStop(0, pal.b); cg.addColorStop(1, pal.a);
  ctx.fillStyle = cg; ctx.fillRect(0, horizon + 6, w, h - horizon);
  const step = Math.max(54, Math.min(w, h) / 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.0)';
  for (let r = 0, y = horizon + 6; y < h + step; r++, y += step * 0.62) for (let x = (r % 2) * step / 2 - step; x < w + step; x += step) {
    const sc = 0.55 + 0.45 * ((y - horizon) / Math.max(1, h - horizon));
    const dw = step * 0.42 * sc, dh = step * 0.30 * sc;
    ctx.beginPath(); ctx.moveTo(x, y - dh); ctx.lineTo(x + dw, y); ctx.lineTo(x, y + dh); ctx.lineTo(x - dw, y); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = pal.line; ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = pal.dot; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, dw * 0.1), 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // lamp pool of light and vignette
  const rad = Math.max(w, h) * 0.7, lamp = ctx.createRadialGradient(w / 2, horizon * 0.5, 4, w / 2, horizon * 0.9, rad);
  lamp.addColorStop(0, 'rgba(255,210,130,0.34)'); lamp.addColorStop(0.5, 'rgba(255,160,80,0.08)'); lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.hypot(w, h) * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(4,2,14,0.78)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}
const roomCache = new Map();
export function drawRoom(ctx, L, carpet = 'garnet') {
  const { w, h } = L;
  if (v3.on) { ctx.clearRect(0, 0, w, h); return Math.round(h * (L.land ? 0.3 : 0.2)); }   // the 3D majlis is behind this transparent canvas
  const horizon = Math.round(h * (L.land ? 0.3 : 0.2)), pal = CARPETS[carpet] || CARPETS.garnet;
  const key = `${w}x${h}|${carpet}|${horizon}`;
  let layer = roomCache.get(key);
  if (layer === undefined) {
    layer = null; const q = clamp(1000 / Math.max(w, h), 0.35, 1), m = mk(w * q, h * q);
    if (m) { m.x.save(); m.x.scale(q, q); paintRoom(m.x, w, h, horizon, pal); m.x.restore(); layer = { c: m.c }; }
    roomCache.set(key, layer); if (roomCache.size > 6) roomCache.delete(roomCache.keys().next().value);
  }
  if (layer) ctx.drawImage(layer.c, 0, 0, w, h); else paintRoom(ctx, w, h, horizon, pal);
  return horizon;
}

// ------------------------------------------------------------------------------------------------ people
export const SKINS = [['#f6d2ae', '#d9a47c', '#a4714f'], ['#e8b88c', '#c78c5e', '#8d5e3b'], ['#cf9560', '#a76d3d', '#6f4425'], ['#a46f43', '#7b4d2a', '#4c2c15'], ['#744a2c', '#533019', '#31190b']];
const HAIR = ['#14100e', '#2b1c14', '#3c2a1c', '#1a1612', '#51402e'];
const ROBES = [['#f3ede0', '#c9c0aa'], ['#3e5f8f', '#243a5e'], ['#7a3a3a', '#4a1f26'], ['#35695c', '#1d3f38'], ['#b88a3a', '#7a5520']];
const sx = (v, s) => v * s;

function headwear(ctx, look, s, hair, t) {
  // drawn around a head centred at (0,0), radius 46*s
  const R = 46 * s;
  if (look === 0 || look === 1) {                                  // draped head cloth with a black cord ring
    const a = look === 0 ? ['#ffffff', '#d9d4c4'] : ['#fdf6f2', '#e6d6d2'];
    ctx.beginPath(); ctx.moveTo(-R * 1.08, R * 0.62); ctx.quadraticCurveTo(-R * 1.3, -R * 0.5, -R * 0.2, -R * 1.18); ctx.quadraticCurveTo(R * 0.9, -R * 1.25, R * 1.12, -R * 0.1); ctx.quadraticCurveTo(R * 1.34, R * 0.55, R * 1.02, R * 0.95); ctx.lineTo(R * 0.72, R * 0.42); ctx.quadraticCurveTo(0, -R * 1.78, -R * 0.72, R * 0.42); ctx.lineTo(-R * 1.0, R * 0.98); ctx.closePath();
    const g = ctx.createLinearGradient(-R, -R, R, R); g.addColorStop(0, a[0]); g.addColorStop(1, a[1]); ctx.fillStyle = g; ctx.fill();
    if (look === 1) {                                              // red check
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(196,40,52,0.75)'; ctx.lineWidth = Math.max(1, 3.4 * s);
      for (let i = -8; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 11 * s, -R * 1.4); ctx.lineTo(i * 11 * s, R * 1.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-R * 1.5, i * 9 * s); ctx.lineTo(R * 1.5, i * 9 * s); ctx.stroke(); }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(-R * 0.9, R * 0.2); ctx.quadraticCurveTo(-R * 1.05, R * 0.6, -R * 0.95, R * 0.9); ctx.moveTo(R * 0.9, R * 0.2); ctx.quadraticCurveTo(R * 1.05, R * 0.6, R * 0.95, R * 0.9); ctx.stroke();
    ctx.strokeStyle = '#17141a'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.ellipse(0, -R * 0.82, R * 0.86, R * 0.22, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
    ctx.lineWidth = 3.2 * s; ctx.beginPath(); ctx.ellipse(0, -R * 0.98, R * 0.8, R * 0.2, 0, Math.PI * 0.08, Math.PI * 0.92); ctx.stroke();
  } else if (look === 2) {                                         // flat cap
    const g = ctx.createLinearGradient(-R, -R, R, 0); g.addColorStop(0, '#8a8f94'); g.addColorStop(1, '#4d5258');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-R * 1.0, -R * 0.35); ctx.quadraticCurveTo(-R * 0.9, -R * 1.2, 0, -R * 1.1); ctx.quadraticCurveTo(R * 1.05, -R * 1.15, R * 1.05, -R * 0.35); ctx.quadraticCurveTo(0, -R * 0.55, -R * 1.0, -R * 0.35); ctx.fill();
    ctx.fillStyle = '#34383d'; ctx.beginPath(); ctx.ellipse(R * 0.1, -R * 0.38, R * 1.0, R * 0.16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = s; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-R * 0.8 + i * R * 0.3, -R * 0.45); ctx.lineTo(-R * 0.7 + i * R * 0.26, -R * 1.05); ctx.stroke(); }
  } else if (look === 3) {                                         // short hair, side parting
    ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-R * 1.0, -R * 0.1); ctx.quadraticCurveTo(-R * 1.1, -R * 1.2, 0, -R * 1.12); ctx.quadraticCurveTo(R * 1.1, -R * 1.2, R * 1.0, -R * 0.1); ctx.quadraticCurveTo(R * 0.7, -R * 0.55, R * 0.1, -R * 0.62); ctx.quadraticCurveTo(-R * 0.6, -R * 0.5, -R * 1.0, -R * 0.1); ctx.fill();
  } else {                                                         // long hair with a clip
    ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-R * 1.1, R * 1.1); ctx.quadraticCurveTo(-R * 1.35, -R * 0.6, 0, -R * 1.18); ctx.quadraticCurveTo(R * 1.35, -R * 0.6, R * 1.1, R * 1.1); ctx.lineTo(R * 0.86, R * 0.5); ctx.quadraticCurveTo(R * 0.6, -R * 0.5, 0, -R * 0.62); ctx.quadraticCurveTo(-R * 0.6, -R * 0.5, -R * 0.86, R * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0c15a'; ctx.beginPath(); ctx.arc(R * 0.55, -R * 0.7, R * 0.11, 0, TAU); ctx.fill();
  }
}

// One person, upper body, centred where the face is. member = { look, skin, beard, pers }, expr = { kind, side } , o = { t, id, dim, lean, name }
export function drawPerson(ctx, x, y, s, member, expr, o = {}) {
  const t = o.t || 0, id = o.id || 0, skin = SKINS[member.skin % SKINS.length], hair = HAIR[(member.skin + id) % HAIR.length], robe = ROBES[(member.look + id) % ROBES.length];
  // idle manner: what a watching player can read before any stare
  let ox = 0, oy = 0, brow = 0, blink = 0;
  const ph = id * 1.7;
  const cal = o.calm;
  if (!cal) {
    if (member.pers === 'jittery') { ox = Math.sin(t * 9 + ph) * 1.6 + Math.sin(t * 15.3 + ph) * 0.8; oy = Math.sin(t * 11 + ph) * 1.1; }
    else if (member.pers === 'showman') { ox = Math.sin(t * 1.5 + ph) * 3.4; oy = Math.sin(t * 3 + ph) * 1.8; brow = Math.max(0, Math.sin(t * 2.4 + ph)) * 4; }
    else if (member.pers === 'open') { oy = Math.sin(t * 1.1 + ph) * 1.2; }
  }
  const bl = (member.pers === 'jittery' ? 1.6 : 0.5), cyc = ((t * bl + id * 0.37) % 1);
  blink = cyc > 0.94 ? 1 : 0;
  ctx.save(); ctx.translate(x + ox * s, y + oy * s); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  // shadow on the carpet
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(0, 100 * s, 66 * s, 15 * s, 0, 0, TAU); ctx.fill();
  // body: shoulders and robe
  const bg = ctx.createLinearGradient(0, 40 * s, 0, 105 * s); bg.addColorStop(0, robe[0]); bg.addColorStop(1, robe[1]);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-62 * s, 104 * s); ctx.quadraticCurveTo(-64 * s, 52 * s, -28 * s, 40 * s); ctx.lineTo(28 * s, 40 * s); ctx.quadraticCurveTo(64 * s, 52 * s, 62 * s, 104 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2 * s; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(-40 * s, 48 * s); ctx.quadraticCurveTo(-52 * s, 70 * s, -50 * s, 100 * s); ctx.lineTo(-38 * s, 100 * s); ctx.quadraticCurveTo(-40 * s, 70 * s, -30 * s, 46 * s); ctx.fill();
  // robe detail: shoulder seam shading, collar opening and a placket line
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(-28 * s, 41 * s); ctx.quadraticCurveTo(-46 * s, 52 * s, -56 * s, 78 * s); ctx.moveTo(28 * s, 41 * s); ctx.quadraticCurveTo(46 * s, 52 * s, 56 * s, 78 * s); ctx.stroke();
  const sh = ctx.createLinearGradient(-62 * s, 0, 62 * s, 0); sh.addColorStop(0, 'rgba(0,0,0,0.28)'); sh.addColorStop(0.25, 'rgba(0,0,0,0)'); sh.addColorStop(0.75, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(-62 * s, 104 * s); ctx.quadraticCurveTo(-64 * s, 52 * s, -28 * s, 40 * s); ctx.lineTo(28 * s, 40 * s); ctx.quadraticCurveTo(64 * s, 52 * s, 62 * s, 104 * s); ctx.closePath(); ctx.fill();
  // neck (shadowed under the jaw) and the open collar
  const ng = ctx.createLinearGradient(0, 22 * s, 0, 56 * s); ng.addColorStop(0, skin[2]); ng.addColorStop(1, skin[1]);
  ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(-15 * s, 26 * s); ctx.lineTo(15 * s, 26 * s); ctx.lineTo(17 * s, 44 * s); ctx.quadraticCurveTo(0, 62 * s, -17 * s, 44 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.8 * s; ctx.beginPath(); ctx.moveTo(-17 * s, 42 * s); ctx.quadraticCurveTo(0, 63 * s, 17 * s, 42 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 60 * s); ctx.lineTo(0, 92 * s); ctx.stroke();
  // long hair sits behind the face
  if (member.look === 4) { ctx.save(); headwear(ctx, 4, s, hair, t); ctx.restore(); }
  // ears
  for (const sg of [-1, 1]) { ctx.fillStyle = skin[1]; ctx.beginPath(); ctx.ellipse(sg * 41 * s, 4 * s, 6.5 * s, 11 * s, sg * 0.12, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(120,40,30,0.25)'; ctx.beginPath(); ctx.ellipse(sg * 42 * s, 5 * s, 3 * s, 6.5 * s, 0, 0, TAU); ctx.fill(); }
  // head: egg with a tapered jaw, lit from upper left
  const face = () => { ctx.beginPath(); ctx.moveTo(0, -47 * s); ctx.bezierCurveTo(26 * s, -47 * s, 42 * s, -30 * s, 42 * s, -6 * s); ctx.bezierCurveTo(42 * s, 14 * s, 34 * s, 38 * s, 14 * s, 46 * s); ctx.quadraticCurveTo(0, 51 * s, -14 * s, 46 * s); ctx.bezierCurveTo(-34 * s, 38 * s, -42 * s, 14 * s, -42 * s, -6 * s); ctx.bezierCurveTo(-42 * s, -30 * s, -26 * s, -47 * s, 0, -47 * s); ctx.closePath(); };
  const hg = ctx.createRadialGradient(-14 * s, -18 * s, 4 * s, 0, 0, 56 * s); hg.addColorStop(0, skin[0]); hg.addColorStop(0.6, skin[1]); hg.addColorStop(1, skin[2]);
  face(); ctx.fillStyle = hg; ctx.fill();
  ctx.save(); face(); ctx.clip();
  const sd = ctx.createLinearGradient(-42 * s, 0, 42 * s, 0); sd.addColorStop(0, 'rgba(0,0,0,0.0)'); sd.addColorStop(0.7, 'rgba(0,0,0,0.0)'); sd.addColorStop(1, 'rgba(40,10,0,0.28)');
  ctx.fillStyle = sd; ctx.fillRect(-45 * s, -50 * s, 90 * s, 105 * s);
  const jw = ctx.createLinearGradient(0, 20 * s, 0, 50 * s); jw.addColorStop(0, 'rgba(60,20,0,0)'); jw.addColorStop(1, 'rgba(60,20,0,0.3)'); ctx.fillStyle = jw; ctx.fillRect(-45 * s, 20 * s, 90 * s, 32 * s);
  for (const sg of [-1, 1]) { const ch = ctx.createRadialGradient(sg * 24 * s, 12 * s, 1, sg * 24 * s, 12 * s, 15 * s); ch.addColorStop(0, 'rgba(220,90,70,0.22)'); ch.addColorStop(1, 'rgba(220,90,70,0)'); ctx.fillStyle = ch; ctx.fillRect(sg * 24 * s - 16 * s, -4 * s, 32 * s, 32 * s); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.4 * s; face(); ctx.stroke();
  // beard / moustache
  if (member.beard) {
    ctx.fillStyle = hair; ctx.globalAlpha *= 0.92;
    if (member.beard === 2) { ctx.beginPath(); ctx.moveTo(-38 * s, 6 * s); ctx.quadraticCurveTo(-40 * s, 54 * s, 0, 52 * s); ctx.quadraticCurveTo(40 * s, 54 * s, 38 * s, 6 * s); ctx.quadraticCurveTo(26 * s, 28 * s, 0, 24 * s); ctx.quadraticCurveTo(-26 * s, 28 * s, -38 * s, 6 * s); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-18 * s, 20 * s); ctx.quadraticCurveTo(0, 12 * s, 18 * s, 20 * s); ctx.quadraticCurveTo(0, 25 * s, -18 * s, 20 * s); ctx.fill();
    ctx.globalAlpha /= 0.92;
  }
  // face features from the expression
  const kind = expr?.kind || 'calm', side = expr?.side || 0, look = o.lookTo;
  const ex = 15.5 * s, ey = -5 * s;
  const lid = kind === 'smirk' ? 0.62 : kind === 'tense' ? 0.7 : kind === 'bright' ? 1.25 : 1;
  const eyeW = 9.2 * s, eyeH = 4.6 * s * lid * (blink ? 0.1 : 1);
  let gx = 0, gy = 0;
  if (kind === 'glance') { gx = (side ? 1 : -1) * 3.8 * s; gy = 1.2 * s; }
  if (look) { gx += clamp(look.x, -1, 1) * 2.6 * s; gy += clamp(look.y, -1, 1) * 1.2 * s; }
  for (const sg of [-1, 1]) {
    const cx = sg * ex, up = Math.max(0.7 * s, eyeH), dn = Math.max(0.5 * s, eyeH * 0.62), lift = kind === 'tense' ? 1.6 * s : 0;
    const almond = () => { ctx.beginPath(); ctx.moveTo(cx - eyeW, ey + 1.2 * s); ctx.quadraticCurveTo(cx - eyeW * 0.1, ey - up * 1.9, cx + eyeW, ey + 0.2 * s - lift * 0.3); ctx.quadraticCurveTo(cx + eyeW * 0.1, ey + dn * 1.5, cx - eyeW, ey + 1.2 * s); ctx.closePath(); };
    ctx.fillStyle = 'rgba(70,30,20,0.18)'; ctx.beginPath(); ctx.ellipse(cx, ey - up * 0.4, eyeW * 1.15, up * 1.7 + 2 * s, 0, 0, TAU); ctx.fill();      // socket shade
    almond(); ctx.fillStyle = '#f3ece0'; ctx.fill();
    if (!blink) {
      ctx.save(); almond(); ctx.clip();
      const ix = cx + gx, iy = ey + 0.2 * s + gy, ir = 4.1 * s;
      const ig = ctx.createRadialGradient(ix - ir * 0.3, iy - ir * 0.3, 0.5, ix, iy, ir); ig.addColorStop(0, '#8a5a34'); ig.addColorStop(0.7, '#4a2c16'); ig.addColorStop(1, '#1d120a');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fill();
      ctx.fillStyle = '#080504'; ctx.beginPath(); ctx.arc(ix, iy, ir * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(ix - ir * 0.35, iy - ir * 0.4, ir * 0.22, 0, TAU); ctx.fill();
      const lg = ctx.createLinearGradient(0, ey - up * 1.9, 0, ey); lg.addColorStop(0, 'rgba(0,0,0,0.35)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(cx - eyeW, ey - up * 2, eyeW * 2, up * 2);   // lid shadow on the eyeball
      ctx.restore();
    }
    ctx.strokeStyle = '#1a100c'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - eyeW, ey + 1.2 * s); ctx.quadraticCurveTo(cx - eyeW * 0.1, ey - up * 1.9, cx + eyeW, ey + 0.2 * s - lift * 0.3); ctx.stroke();   // upper lid / lashes
    ctx.strokeStyle = 'rgba(60,20,10,0.4)'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(cx - eyeW * 0.8, ey + 1.6 * s); ctx.quadraticCurveTo(cx, ey + dn * 1.5 + 0.6 * s, cx + eyeW * 0.9, ey + 0.6 * s); ctx.stroke();
    if (!blink) { ctx.strokeStyle = 'rgba(40,15,5,0.3)'; ctx.beginPath(); ctx.moveTo(cx - eyeW * 0.8, ey - up * 1.6 - 1.8 * s); ctx.quadraticCurveTo(cx, ey - up * 2.5 - 2.4 * s, cx + eyeW * 0.9, ey - up * 1.1 - 1.4 * s); ctx.stroke(); }   // lid crease
    // brows: tapered, heavier at the inner end
    ctx.fillStyle = hair;
    const bUp = ((kind === 'bright' ? 6 : kind === 'smirk' ? 1.5 : 0) + brow) * s, by = ey - 13 * s - bUp, ii = sg * (ex - 11 * s), oo = sg * (ex + 11 * s);
    ctx.beginPath();
    if (kind === 'tense') { const iy2 = by + 2 * s, oy2 = by - 6.5 * s; ctx.moveTo(ii, iy2 + 3.4 * s); ctx.quadraticCurveTo(sg * ex, (iy2 + oy2) / 2 - 1 * s, oo, oy2 + 1 * s); ctx.quadraticCurveTo(sg * ex, (iy2 + oy2) / 2 - 5 * s, ii, iy2 - 0.4 * s); }
    else { const hi = (kind === 'smirk' && sg === (side ? 1 : -1)) ? 4 * s : 0; ctx.moveTo(ii, by + 3 * s); ctx.quadraticCurveTo(sg * ex, by - 5.6 * s - hi, oo, by + 1.6 * s); ctx.quadraticCurveTo(sg * ex, by - 2.2 * s - hi, ii, by - 0.4 * s); }
    ctx.closePath(); ctx.fill();
  }
  // nose: bridge shade, tip highlight and nostrils
  ctx.fillStyle = 'rgba(70,25,10,0.16)'; ctx.beginPath(); ctx.moveTo(2 * s, -6 * s); ctx.quadraticCurveTo(7 * s, 8 * s, 8 * s, 15 * s); ctx.quadraticCurveTo(0, 20 * s, -8 * s, 15 * s); ctx.quadraticCurveTo(-3 * s, 8 * s, -2 * s, -6 * s); ctx.fill();
  ctx.strokeStyle = 'rgba(60,20,10,0.4)'; ctx.lineWidth = 1.6 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8 * s, 16 * s); ctx.quadraticCurveTo(-5 * s, 19 * s, -2.5 * s, 17 * s); ctx.moveTo(8 * s, 16 * s); ctx.quadraticCurveTo(5 * s, 19 * s, 2.5 * s, 17 * s); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(-1.5 * s, 10 * s, 2.2 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
  // mouth: lips with a seam, corners move with the expression
  const my = 29 * s;
  let cL = 0, cR = 0, deep = 3.2, w = 9.5;
  if (kind === 'smirk') { if (side) { cR = -5.5; cL = 0.5; } else { cL = -5.5; cR = 0.5; } deep = 3; }
  else if (kind === 'tense') { cL = cR = 0.6; deep = 0.4; w = 9; }
  else if (kind === 'bright') { cL = cR = -4.2; deep = 5.2; w = 11; }
  else if (kind === 'glance') { cL = cR = 0.4; deep = 2.2; w = 8.5; }
  const lipc = member.skin >= 3 ? '#6e342c' : '#b8665a';
  ctx.fillStyle = lipc; ctx.beginPath(); ctx.moveTo(-w * s, my + cL * s); ctx.quadraticCurveTo(-w * 0.35 * s, my - 3 * s + cL * 0.3 * s, 0, my - 1.6 * s); ctx.quadraticCurveTo(w * 0.35 * s, my - 3 * s + cR * 0.3 * s, w * s, my + cR * s);
  ctx.quadraticCurveTo(0, my + (deep + 5) * s + (cL + cR) * 0.2 * s, -w * s, my + cL * s); ctx.fill();
  ctx.strokeStyle = 'rgba(30,8,6,0.75)'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.moveTo(-w * s, my + cL * s); ctx.quadraticCurveTo(0, my + deep * s * 0.9 + (cL + cR) * 0.25 * s, w * s, my + cR * s); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(0, my + (deep + 2.8) * s, 3.4 * s, 1.1 * s, 0, 0, TAU); ctx.fill();
  ctx.lineCap = 'butt';
  if (kind === 'tense') { ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(-26 * s, 20 * s); ctx.lineTo(-22 * s, 30 * s); ctx.moveTo(26 * s, 20 * s); ctx.lineTo(22 * s, 30 * s); ctx.stroke(); }   // jaw
  if (kind === 'glance' || kind === 'tense') {                      // a bead of sweat on the temple
    const sw = (t * 0.8 + id * 0.2) % 1; ctx.fillStyle = `rgba(190,225,255,${0.8 - sw * 0.5})`; ctx.beginPath(); ctx.ellipse(33 * s, (-18 + sw * 18) * s, 2.4 * s, 3.4 * s, 0, 0, TAU); ctx.fill();
  }
  if (member.look !== 4) headwear(ctx, member.look, s, hair, t);
  else { ctx.save(); const R = 46 * s; ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(-R * 1.0, -R * 0.1); ctx.quadraticCurveTo(-R * 0.9, -R * 1.1, 0, -R * 1.08); ctx.quadraticCurveTo(R * 0.9, -R * 1.1, R * 1.0, -R * 0.1); ctx.quadraticCurveTo(R * 0.5, -R * 0.55, 0, -R * 0.5); ctx.quadraticCurveTo(-R * 0.5, -R * 0.55, -R, -R * 0.1); ctx.fill(); ctx.fillStyle = '#f0c15a'; ctx.beginPath(); ctx.arc(R * 0.55, -R * 0.7, R * 0.11, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------------ rings and fists
export function drawRing(ctx, x, y, r, t = 0, glow = 1) {
  ctx.save();
  if (v3.hands.ready) {                                           // the modelled gold ring with its faceted gem
    const rg = v3.hands.img.ring, w = r * 2.5, h = w * rg.naturalHeight / rg.naturalWidth;
    if (glow) { const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4); g.addColorStop(0, `rgba(255,226,140,${0.5 * glow})`); g.addColorStop(1, 'rgba(255,226,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill(); }
    ctx.drawImage(rg, x - w / 2, y - h / 2, w, h);
    const sp = 0.5 + 0.5 * Math.sin(t * 4); ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * sp})`; ctx.beginPath(); ctx.arc(x + w * 0.1, y - h * 0.32, r * 0.1, 0, TAU); ctx.fill();
    ctx.restore(); return;
  }
  if (glow) { const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.2); g.addColorStop(0, `rgba(255,226,140,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,226,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, TAU); ctx.fill(); }
  ctx.lineWidth = r * 0.46;
  const g2 = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g2.addColorStop(0, '#fff3b8'); g2.addColorStop(0.5, '#e8b43a'); g2.addColorStop(1, '#a8701a');
  ctx.strokeStyle = g2; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#9fe8ff'; ctx.beginPath(); ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 0.34, y - r * 0.78); ctx.lineTo(x, y - r * 0.5); ctx.lineTo(x - r * 0.34, y - r * 0.78); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
  const sp = 0.5 + 0.5 * Math.sin(t * 4); ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.5 * sp})`; ctx.beginPath(); ctx.arc(x - r * 0.5, y - r * 0.35, r * 0.12, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- baked 3D hands (web/hands/{f,o}_<skin 0-4>.webp, rendered offline from the view3d athlete hand mesh; ring.webp is a modelled gold ring)
// Sprite space: 220 x 400 px. f_* = closed fist seen from the front, back of the hand to the viewer, wrist fading out at the bottom;
// o_* = open empty palm, fingers up. The fist centre is (100, 225) and the palm centre (98, 235); 177 px = one palm width.
export function loadHands(base = './hands/') {
  const H = v3.hands, names = [];
  for (let k = 0; k < 5; k++) names.push('f_' + k, 'o_' + k);
  names.push('ring'); let left = names.length;
  for (const n of names) {
    const im = new Image();
    im.onload = () => { H.img[n] = im; if (--left === 0) H.ready = true; };
    im.onerror = () => { /* 2D hands stay */ };
    im.src = `${base}${n}.webp`;
  }
}
function handSprite(ctx, img, x, y, k, ax, ay, mirror) {
  ctx.save(); ctx.translate(x, y); if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, -ax * k, -ay * k, img.naturalWidth * k, img.naturalHeight * k); ctx.restore();
}

// A fist at (x, y) of radius r. state: 'closed' | 'open' (empty palm) | 'ring' (open, ring in it). o: { skin, side, sel, hl, dim, squeeze, ring (peek: draw ring on a closed fist), t }
export function drawFist(ctx, x, y, r, state, o = {}) {
  const skin = SKINS[(o.skin || 0) % SKINS.length], t = o.t || 0, HS = v3.hands, sk = (o.skin || 0) % 5;
  ctx.save(); ctx.translate(x, y);
  if (o.dim) ctx.globalAlpha *= HS.ready ? 0.86 : 0.55;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.95, r * 0.28, 0, 0, TAU); ctx.fill();
  if (o.sel || o.hl) {
    const c = o.sel ? '255,226,120' : '160,225,255', a = 0.5 + 0.25 * Math.sin(t * 6);
    const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TAU); ctx.fill();
  }
  const sq = o.squeeze || 0;
  const mir = !!o.side;
  if (HS.ready && state === 'closed') {
    const k = (1.9 * r / 177) * (1 - sq * 0.05), im = HS.img['f_' + sk];
    handSprite(ctx, im, 0, 0, k, 100, 225, mir);
    if (o.ring) {                                              // the hider's own peek: the ring is tucked under the fingers
      const rg = HS.img.ring, rk = (0.62 * r) / rg.naturalWidth;
      ctx.globalAlpha *= 0.92; ctx.drawImage(rg, -rg.naturalWidth * rk / 2, -r * 0.62, rg.naturalWidth * rk, rg.naturalHeight * rk); ctx.globalAlpha = 1;
    }
    ctx.restore(); return;
  }
  if (HS.ready && state !== 'closed') {
    const k = (1.3 * r / 150), im = HS.img['o_' + sk];
    handSprite(ctx, im, 0, 0, k, 98, 235, mir);
    if (state === 'ring') {
      const rg = HS.img.ring, rk = (1.02 * r) / rg.naturalWidth, bob = Math.sin(t * 2.4) * r * 0.02;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(r * 0.03, r * 0.42 + bob, r * 0.36, r * 0.1, 0, 0, TAU); ctx.fill();
      const gl = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.5); gl.addColorStop(0, 'rgba(255,226,140,0.45)'); gl.addColorStop(1, 'rgba(255,226,140,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, TAU); ctx.fill();
      ctx.drawImage(rg, -rg.naturalWidth * rk / 2, -rg.naturalHeight * rk * 0.62 + bob, rg.naturalWidth * rk, rg.naturalHeight * rk);
    }
    ctx.restore(); return;
  }
  if (state === 'closed') {
    const k = 1 - sq * 0.06;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.2); g.addColorStop(0, skin[0]); g.addColorStop(0.6, skin[1]); g.addColorStop(1, skin[2]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-r * k, -r * 0.82 * k, 2 * r * k, 1.64 * r * k, r * 0.62); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(1, r * 0.07); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = Math.max(1, r * 0.08);
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.5, -r * 0.7 * k); ctx.lineTo(i * r * 0.5, -r * 0.1 * k); ctx.stroke(); }   // finger creases
    ctx.fillStyle = skin[1]; ctx.beginPath(); ctx.ellipse(-r * 0.78 * (o.side ? -1 : 1), r * 0.12, r * 0.28, r * 0.5, (o.side ? -1 : 1) * 0.3, 0, TAU); ctx.fill(); ctx.stroke();   // thumb
    if (o.ring) { ctx.strokeStyle = 'rgba(255,226,140,0.95)'; ctx.lineWidth = r * 0.18; ctx.beginPath(); ctx.ellipse(0, -r * 0.05, r * 0.38, r * 0.3, 0, 0, TAU); ctx.stroke(); }
  } else {
    const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.2); g.addColorStop(0, skin[0]); g.addColorStop(1, skin[1]);
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = Math.max(1, r * 0.07);
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.roundRect(i * r * 0.36 - r * 0.15, -r * 1.12 + Math.abs(i) * r * 0.13, r * 0.3, r * 0.78, r * 0.15); ctx.fill(); ctx.stroke(); }   // fingers
    ctx.beginPath(); ctx.ellipse(0, r * 0.08, r * 0.92, r * 0.78, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.1); ctx.quadraticCurveTo(0, r * 0.5, r * 0.5, r * 0.0); ctx.stroke();
    if (state === 'ring') drawRing(ctx, 0, r * 0.1, r * 0.55, t, 1);
  }
  ctx.restore();
}
