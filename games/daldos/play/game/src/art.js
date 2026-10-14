// Everything that is painted by hand: the fjord backdrop, the boat board, the spatulas, the throwing stick. Pure canvas, no assets.
// All drawing is a function of its arguments (and the time `t` handed in), so a frame is reproducible.
import { v3, sprites } from './v3.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const SIDE = [
  { name: 'Red', hi: '#ff8a62', mid: '#d6402a', lo: '#7a1a10', ink: '#3a0c07', band: '#f2c35a' },
  { name: 'Blue', hi: '#74b4f2', mid: '#2f74c4', lo: '#123a73', ink: '#071b3a', band: '#f4efe0' },
];

// Boards open with wins against the computer. `need` is wins.
export const WOODS = {
  pine: { name: 'Pine', need: 0, hull: '#3b2314', deck: ['#d8b27a', '#b98b52'], grain: 'rgba(110,70,30,0.22)', lane: ['#5b8f9a', '#3f6f7c'], hole: 'rgba(60,34,14,0.55)' },
  birch: { name: 'Birch', need: 2, hull: '#4a3a2c', deck: ['#eadcc0', '#cdb98f'], grain: 'rgba(120,96,60,0.2)', lane: ['#7aa9a0', '#5a8a86'], hole: 'rgba(70,52,30,0.5)' },
  tar: { name: 'Tarred oak', need: 5, hull: '#0f0a07', deck: ['#7d5a3a', '#523720'], grain: 'rgba(20,10,4,0.3)', lane: ['#2f5560', '#1d3a46'], hole: 'rgba(10,5,2,0.6)' },
};
export const WOOD_KEYS = Object.keys(WOODS);
export const STYLES = { painted: { name: 'Painted', need: 0 }, carved: { name: 'Carved', need: 3 } };
export const STYLE_KEYS = Object.keys(STYLES);

// ------------------------------------------------------------------ backdrop: a fjord at first light
export function drawBackdrop(ctx, L, t, calm) {
  if (v3.on) return;                               // the 3D scene is the backdrop
  const { w, h } = L;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0c2230'); g.addColorStop(0.42, '#1c4a58'); g.addColorStop(0.62, '#3a7a80'); g.addColorStop(0.63, '#1f5663'); g.addColorStop(1, '#0a2430');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // a pale sun low on the water line
  const sx = w * 0.72, sy = h * 0.6, sr = Math.min(w, h) * 0.42;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr); sg.addColorStop(0, 'rgba(255,226,170,0.42)'); sg.addColorStop(1, 'rgba(255,226,170,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
  // far and near mountains (static, by a fixed profile)
  const ridge = (base, amp, seed, fill) => {
    ctx.beginPath(); ctx.moveTo(0, h * 0.63);
    for (let i = 0; i <= 60; i++) { const x = (i / 60) * w, k = 0.5 + 0.28 * Math.sin(i * 0.21 + seed) + 0.22 * Math.sin(i * 0.57 + seed * 2.1); ctx.lineTo(x, h * base - k * amp * h); }
    ctx.lineTo(w, h * 0.63); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  };
  ridge(0.56, 0.1, 1.3, 'rgba(18,56,70,0.85)'); ridge(0.6, 0.07, 4.1, 'rgba(10,36,48,0.95)');
  // water: soft bands drifting sideways
  const drift = calm ? 0 : t;
  for (let k = 0; k < 9; k++) {
    const y = h * (0.66 + k * 0.045), amp = 3 + k * 1.4, ph = drift * (0.25 + k * 0.05) + k * 1.9;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.012 + ph) * amp);
    ctx.strokeStyle = `rgba(190,235,230,${0.05 + k * 0.012})`; ctx.lineWidth = 2 + k * 0.35; ctx.stroke();
  }
  // dim the lower area a little so the board and plates read first
  const v = ctx.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0.25)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------ the boat board
// B: { x, y, w, h (hull box), gx, gy (grid origin), cw, ch (cell size), pt(row, col) } with the screen flip already applied in pt().
export function hullPath(ctx, B) {
  const { x, y, w, h } = B, tip = B.cw * 1.55;
  ctx.beginPath();
  ctx.moveTo(x + tip, y);
  ctx.lineTo(x + w - tip, y);
  ctx.quadraticCurveTo(x + w - tip * 0.42, y + h * 0.0, x + w, y + h * 0.5);
  ctx.quadraticCurveTo(x + w - tip * 0.42, y + h * 1.0, x + w - tip, y + h);
  ctx.lineTo(x + tip, y + h);
  ctx.quadraticCurveTo(x + tip * 0.42, y + h * 1.0, x, y + h * 0.5);
  ctx.quadraticCurveTo(x + tip * 0.42, y + h * 0.0, x + tip, y);
  ctx.closePath();
}

export function drawBoard(ctx, B, woodKey = 'pine', opts = {}) {
  const W = WOODS[woodKey] || WOODS.pine, { x, y, w, h, cw, ch } = B;
  if (sprites.ready && sprites.board) {            // a picture of the 3D boat board (diagrams on the Rules and How to Play pages)
    const k = w / 11, cx = x + w / 2, cy = y + h / 2;
    ctx.drawImage(sprites.board, cx - 5.7 * k, cy - 2.0 * k, 11.4 * k, 4.0 * k);
    return;
  }
  ctx.save();
  // shadow on the water
  ctx.save(); ctx.translate(0, ch * 0.14); hullPath(ctx, B); ctx.fillStyle = 'rgba(0,10,16,0.5)'; ctx.fill(); ctx.restore();
  // hull: dark planking with a lit rim
  hullPath(ctx, B);
  const hg = ctx.createLinearGradient(0, y, 0, y + h); hg.addColorStop(0, W.hull); hg.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = W.hull; ctx.fill(); ctx.fillStyle = hg; ctx.fill();
  ctx.lineWidth = Math.max(2, cw * 0.05); ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.stroke();
  // deck: an inset hull in light wood
  const inset = Math.max(4, cw * 0.1);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2); ctx.scale((w - 2 * inset) / w, (h - 2 * inset) / h); ctx.translate(-(x + w / 2), -(y + h / 2));
  hullPath(ctx, B);
  const dg = ctx.createLinearGradient(0, y, 0, y + h); dg.addColorStop(0, W.deck[0]); dg.addColorStop(1, W.deck[1]);
  ctx.fillStyle = dg; ctx.fill(); ctx.clip();
  // planks and grain
  ctx.strokeStyle = W.grain; ctx.lineWidth = 1.2;
  for (let r = 0; r <= 3; r++) { const py = B.gy + r * ch; ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke(); }
  for (let k = 0; k < 26; k++) { const py = y + ((k * 37) % 100) / 100 * h, x0 = x + ((k * 53) % 70) / 100 * w; ctx.beginPath(); ctx.moveTo(x0, py); ctx.bezierCurveTo(x0 + cw, py - 3, x0 + cw * 2, py + 3, x0 + cw * 3.2, py - 1); ctx.stroke(); }
  // the shared middle lane, painted like water
  const mid = B.gy + ch, lg = ctx.createLinearGradient(0, mid, 0, mid + ch); lg.addColorStop(0, W.lane[0]); lg.addColorStop(1, W.lane[1]);
  ctx.fillStyle = lg; ctx.globalAlpha = 0.9; ctx.fillRect(x, mid + ch * 0.06, w, ch * 0.88); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(235,250,245,0.35)'; ctx.lineWidth = Math.max(1.5, cw * 0.03);
  for (const yy of [mid + ch * 0.2, mid + ch * 0.8]) { ctx.beginPath(); for (let i = 0; i <= 8 * 4; i++) { const px = B.gx + (i / 4) * cw, py = yy + Math.sin(i * 1.3) * ch * 0.025; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); }
  // each side's own row, edged in its colour
  for (const [row, s] of [[B.rowOf(0), 0], [B.rowOf(1), 1]]) {
    const py = B.gy + row * ch, sg = ctx.createLinearGradient(0, py, 0, py + ch);
    sg.addColorStop(0, `${SIDE[s].mid}00`); sg.addColorStop(1, `${SIDE[s].mid}00`);
    ctx.fillStyle = `${SIDE[s].mid}26`; ctx.fillRect(x, py, w, ch);
    ctx.fillStyle = SIDE[s].mid; const edgeY = row === 0 ? py + ch * 0.03 : py + ch * 0.97 - Math.max(3, ch * 0.05);
    ctx.fillRect(x, edgeY, w, Math.max(3, ch * 0.05));
  }
  ctx.restore();
  // holes (the points)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    const p = B.pt(r, c), rx = cw * 0.34, ry = Math.min(ch * 0.36, cw * 0.4);
    ctx.fillStyle = W.hole; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,205,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y + 1.5, rx, ry, 0, 0.15, Math.PI - 0.15); ctx.stroke();
  }
  // launch and turn marks: a small arrow at each side's launch point, a gold ring where the spatula turns over
  if (!opts.noMarks) for (const s of [0, 1]) {
    const lrow = s === 0 ? 2 : 0, a = B.pt(lrow, s === 0 ? 0 : 7), z = B.pt(lrow, s === 0 ? 7 : 0), nx = B.pt(lrow, s === 0 ? 1 : 6);
    const dir = Math.sign(nx.x - a.x) || 1, ax = a.x - dir * cw * 0.48;
    ctx.strokeStyle = `${SIDE[s].band}`; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(2, cw * 0.05);
    ctx.beginPath(); ctx.ellipse(z.x, z.y, cw * 0.4, Math.min(ch * 0.42, cw * 0.46), 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax - dir * cw * 0.05, a.y - cw * 0.12); ctx.lineTo(ax + dir * cw * 0.1, a.y); ctx.lineTo(ax - dir * cw * 0.05, a.y + cw * 0.12); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // carved prow curls at both tips
  ctx.strokeStyle = 'rgba(255,214,150,0.55)'; ctx.lineWidth = Math.max(2, cw * 0.045); ctx.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    const cx = sgn < 0 ? x + cw * 0.22 : x + w - cw * 0.22, cy = y + h / 2;
    ctx.beginPath(); for (let a = 0; a < 9; a += 0.4) { const rr = cw * (0.03 + 0.02 * a), px = cx + Math.cos(a * sgn * 0.9 + 1) * rr, py = cy + Math.sin(a * sgn * 0.9 + 1) * rr; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the spatula
// (x, y) is the centre of its point; `s` is about one cell wide. Options: turned, lift (0..1), glow (0..1), alpha, scale, tilt, flip (0..1 mid-turn), style, flash.
export function drawSpatula(ctx, side, x, y, s, o = {}) {
  const C = SIDE[side], lift = o.lift || 0, sc = (o.scale ?? 1);
  let turned = !!o.turned, sx = 1;
  if (o.flip !== undefined && o.flip > 0 && o.flip < 1) { sx = Math.abs(Math.cos(o.flip * Math.PI)); turned = o.flip > 0.5; sx = Math.max(0.06, sx); }
  const img = sprites.ready ? sprites.spatula[side][turned ? 1 : 0] : null;
  if (img) {                                       // a picture of the lacquered 3D spatula
    ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
    ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(x + s * 0.02, y + s * 0.3, s * (0.34 - lift * 0.06), s * 0.1, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y - lift * s * 0.34); ctx.rotate(o.tilt || 0); ctx.scale(sc * sx, sc);
    if (o.glow) { const gg = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 0.62); gg.addColorStop(0, `rgba(255,236,160,${0.55 * o.glow})`); gg.addColorStop(1, 'rgba(255,236,160,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.fill(); }
    const k = s * 1.9; ctx.drawImage(img, -k / 2, -k / 2 - s * 0.02, k, k);
    if (o.flash) { ctx.fillStyle = `rgba(255,255,255,${o.flash})`; ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.34, s * 0.38, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  // shadow stays on the board while the piece lifts
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(x + s * 0.02, y + s * 0.3, s * (0.3 - lift * 0.05), s * 0.1, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y - lift * s * 0.34); ctx.rotate(o.tilt || 0); ctx.scale(sc * sx, sc);
  if (o.glow) { const gg = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 0.62); gg.addColorStop(0, `rgba(255,236,160,${0.55 * o.glow})`); gg.addColorStop(1, 'rgba(255,236,160,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.fill(); }
  // handle
  const hw = s * 0.15;
  ctx.beginPath(); ctx.roundRect(-hw / 2, -s * 0.02, hw, s * 0.56, hw * 0.45);
  const hg = ctx.createLinearGradient(-hw, 0, hw, 0); hg.addColorStop(0, '#f1d9a8'); hg.addColorStop(1, '#a8794a'); ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,8,0.7)'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.stroke();
  // blade
  const br = s * 0.33, by = -s * 0.12;
  ctx.beginPath(); ctx.ellipse(0, by, br * 0.86, br * 1.04, 0, 0, TAU);
  const bg = ctx.createLinearGradient(-br, by - br, br, by + br);
  if (turned) { bg.addColorStop(0, '#fff2cc'); bg.addColorStop(0.5, C.hi); bg.addColorStop(1, C.mid); } else { bg.addColorStop(0, C.hi); bg.addColorStop(0.5, C.mid); bg.addColorStop(1, C.lo); }
  ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.strokeStyle = C.ink; ctx.stroke();
  // face: unturned = painted band and notch; turned = inlaid gold ring with a star
  if (turned) {
    ctx.strokeStyle = '#f7d98a'; ctx.lineWidth = Math.max(1.5, s * 0.045); ctx.beginPath(); ctx.ellipse(0, by, br * 0.62, br * 0.68, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? br * 0.14 : br * 0.34; ctx.lineTo(Math.cos(a) * r, by + Math.sin(a) * r * 1.05); }
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = C.band; ctx.globalAlpha *= 0.9; ctx.beginPath(); ctx.roundRect(-br * 0.62, by - br * 0.12, br * 1.24, br * 0.24, br * 0.1); ctx.fill(); ctx.globalAlpha = o.alpha ?? 1;
    if (o.style === 'carved') { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.4; for (const q of [-0.45, 0.45]) { ctx.beginPath(); ctx.arc(0, by + q * br, br * 0.2, 0, TAU); ctx.stroke(); } }
  }
  // a soft highlight arc
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, s * 0.035); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, by, br * 0.78, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
  if (o.flash) { ctx.fillStyle = `rgba(255,255,255,${o.flash})`; ctx.beginPath(); ctx.ellipse(0, by, br * 0.92, br, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ------------------------------------------------------------------ the throwing stick
// A long four-sided stick; the face that lies up carries 1 to 4 gold notches. (cx, cy) centre, w its length.
export function drawStick(ctx, value, cx, cy, w, o = {}) {
  const h = Math.max(14, w * 0.2), spin = o.spin || 0;
  ctx.save();
  ctx.translate(cx, cy);
  if (spin > 0 && spin < 1) { ctx.rotate(Math.sin(spin * 9) * 0.35); ctx.translate(0, -Math.sin(spin * Math.PI) * h * 1.5); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(spin * 12))); }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, h * 0.72, w * 0.5, h * 0.2, 0, 0, TAU); ctx.fill();
  if (o.blank) ctx.globalAlpha = 0.55;
  const simg = sprites.ready ? sprites.stick[o.blank || value < 1 ? 1 : value] : null;
  if (simg) { const k = w / 0.867; ctx.drawImage(simg, -k / 2, -k * 0.15, k, k * 0.3); ctx.restore(); return; }
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.28);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#f4dba6'); g.addColorStop(0.55, '#d3a468'); g.addColorStop(1, '#8c5e30');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#3a2210'; ctx.stroke();
  // end caps, like a turned rod
  ctx.fillStyle = 'rgba(60,34,14,0.35)'; for (const sx of [-1, 1]) ctx.fillRect(sx * w * 0.42 - 2, -h / 2 + 2, 4, h - 4);
  if (!o.blank && value >= 1) {
    const n = value, gap = w * 0.74 / 4, x0 = -(n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      const nx = x0 + i * gap;
      ctx.fillStyle = '#4a2a10'; ctx.beginPath(); ctx.roundRect(nx - h * 0.1, -h * 0.34, h * 0.2, h * 0.68, h * 0.08); ctx.fill();
      ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.roundRect(nx - h * 0.055, -h * 0.28, h * 0.11, h * 0.56, h * 0.05); ctx.fill();
    }
    if (o.extra) { ctx.fillStyle = '#e04a2a'; ctx.beginPath(); ctx.arc(w / 2 - h * 0.1, -h / 2 + h * 0.02, h * 0.18, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ small diagram boards for the Rules and How to Play pages
// spec: { pieces: [[side, row, col, turned?]], marks: [[row, col, 'dot'|'cap'|'ring']], arrows: [[row0,col0,row1,col1]], wood, hole: [row,col,...] }
export function miniSize(cw) { return cw * 1.04 * 3.75; }
export function miniBoard(ctx, spec, x, y, cw, woodKey) {
  const ch = cw * 1.04, w = cw * 11, h = ch * 3.75, mx = (w - 8 * cw) / 2, my = (h - 3 * ch) / 2;
  const B = { x, y, w, h, cw, ch, gx: x + mx, gy: y + my, flip: false, rowOf: (s) => (s === 0 ? 2 : 0), pt: (r, c) => ({ x: x + mx + (c + 0.5) * cw, y: y + my + (r + 0.5) * ch }) };
  drawBoard(ctx, B, woodKey);
  for (const [r, c, kind] of spec.marks || []) {
    const p = B.pt(r, c);
    if (kind === 'dot') { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, cw * 0.16, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = kind === 'cap' ? '#e23c24' : '#ffe08a'; ctx.lineWidth = Math.max(2.5, cw * 0.07); ctx.beginPath(); ctx.arc(p.x, p.y, cw * 0.42, 0, TAU); ctx.stroke(); }
  }
  for (const [r0, c0, r1, c1] of spec.arrows || []) {
    const a = B.pt(r0, c0), b = B.pt(r1, c1), ang = Math.atan2(b.y - a.y, b.x - a.x), k = cw * 0.2;
    ctx.strokeStyle = 'rgba(255,248,225,0.9)'; ctx.lineWidth = Math.max(2.5, cw * 0.06); ctx.setLineDash([cw * 0.2, cw * 0.14]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x - Math.cos(ang) * cw * 0.3, b.y - Math.sin(ang) * cw * 0.3); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(b.x - Math.cos(ang) * cw * 0.3, b.y - Math.sin(ang) * cw * 0.3); ctx.lineTo(b.x - Math.cos(ang - 0.5) * (cw * 0.3 + k), b.y - Math.sin(ang - 0.5) * (cw * 0.3 + k)); ctx.moveTo(b.x - Math.cos(ang) * cw * 0.3, b.y - Math.sin(ang) * cw * 0.3); ctx.lineTo(b.x - Math.cos(ang + 0.5) * (cw * 0.3 + k), b.y - Math.sin(ang + 0.5) * (cw * 0.3 + k)); ctx.stroke();
  }
  const seen = {};
  for (const [side, r, c, t] of spec.pieces || []) {
    const p = B.pt(r, c), key = r * 8 + c, k = (seen[key] = (seen[key] || 0) + 1) - 1, n = (spec.pieces || []).filter((q) => q[1] === r && q[2] === c).length;
    const off = n === 2 ? (k === 0 ? -0.2 : 0.2) : 0;
    drawSpatula(ctx, side, p.x + off * cw, p.y + cw * 0.06, cw * (n === 2 ? 0.82 : 0.95), { turned: !!t });
  }
  return h;
}
export { clamp };
