// The playing pieces. Two sets: pressed-metal bottle caps (the pieces of the street game) and turned wood.
// One light, from the upper left. A piece is painted once per (set, side, king) into a sprite and drawn scaled;
// a king is a second piece stacked under the first (the usual way to crown a piece in street play) with a crown stamped on it.
export const SETS = ['caps', 'wood'];
export const SET_NAMES = { caps: 'Bottle caps', wood: 'Carved wood' };
export const SIDE_NAMES = { caps: { 1: 'Gold', '-1': 'Red' }, wood: { 1: 'Light', '-1': 'Dark' } };
const TAU = Math.PI * 2;

const PAL = {
  caps: {
    1: { rim0: '#fbe08a', rim1: '#a9741a', face0: '#ffe9a0', face1: '#e3a830', face2: '#b97c14', motif: 'rgba(122,72,8,0.55)', ink: '#7a4808', edge: '#6d4508' },
    '-1': { rim0: '#ff9a84', rim1: '#7d1810', face0: '#ff8a70', face1: '#d63a28', face2: '#9c1d12', motif: 'rgba(255,226,214,0.6)', ink: '#ffe3d6', edge: '#4d0d08' },
  },
  wood: {
    1: { rim0: '#f8ebc8', rim1: '#a98650', face0: '#f6e6bd', face1: '#dcbc82', face2: '#bb975c', motif: 'rgba(120,88,44,0.5)', ink: '#6b4c22', edge: '#6b4c22' },
    '-1': { rim0: '#a58565', rim1: '#2a1a10', face0: '#74543f', face1: '#3b261a', face2: '#1d1109', motif: 'rgba(0,0,0,0.5)', ink: '#e0b27a', edge: '#caa070' },
  },
};

function crimp(ctx, r, teeth, depth) {
  ctx.beginPath();
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU, k = 1 - depth + depth * (0.5 + 0.5 * Math.cos(a * teeth));
    const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function crown(ctx, r, color) {
  ctx.save(); ctx.fillStyle = color;
  const w = r * 0.62, h = r * 0.46, y0 = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(-w, y0); ctx.lineTo(-w, y0 - h * 0.55); ctx.lineTo(-w * 0.5, y0 - h * 0.25); ctx.lineTo(0, y0 - h);
  ctx.lineTo(w * 0.5, y0 - h * 0.25); ctx.lineTo(w, y0 - h * 0.55); ctx.lineTo(w, y0); ctx.closePath(); ctx.fill();
  ctx.fillRect(-w, y0 + r * 0.05, w * 2, r * 0.1);
  for (const [px, py] of [[-w, y0 - h * 0.55], [0, y0 - h], [w, y0 - h * 0.55]]) { ctx.beginPath(); ctx.arc(px, py, r * 0.06, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Paints one cap-like disc of radius r centred on (0,0) (the caller translates).
function disc(ctx, set, side, r, king) {
  const p = PAL[set][side], thick = r * 0.14;
  // the side wall of the piece (a darker copy lowered by its thickness), so it reads as a solid disc seen from slightly above
  ctx.save(); ctx.translate(0, thick);
  if (set === 'caps') crimp(ctx, r, 21, 0.045); else { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); }
  const eg = ctx.createLinearGradient(0, -r, 0, r); eg.addColorStop(0, p.rim1); eg.addColorStop(1, p.edge);
  ctx.fillStyle = eg; ctx.fill(); ctx.lineWidth = r * 0.04; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
  ctx.restore();
  if (set === 'caps') {
    // body edge (the cap's skirt seen from above), then the crimped rim, then the printed face
    crimp(ctx, r, 21, 0.045);
    const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, p.rim0); g.addColorStop(1, p.rim1);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = r * 0.04; ctx.strokeStyle = p.edge; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU);
    const f = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 0.9); f.addColorStop(0, p.face0); f.addColorStop(0.55, p.face1); f.addColorStop(1, p.face2);
    ctx.fillStyle = f; ctx.fill();
    ctx.lineWidth = r * 0.035; ctx.strokeStyle = p.edge; ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
    // printed ring + eight petals
    ctx.strokeStyle = p.motif; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, TAU); ctx.stroke();
    ctx.fillStyle = p.motif;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8; ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 0.55, r * 0.075); ctx.lineTo(r * 0.55, -r * 0.075); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, TAU); ctx.fill();
  } else {
    // turned wood: a bevelled disc with lathe rings
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, p.rim0); g.addColorStop(1, p.rim1);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = r * 0.04; ctx.strokeStyle = p.edge; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU);
    const f = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r * 0.9); f.addColorStop(0, p.face0); f.addColorStop(0.6, p.face1); f.addColorStop(1, p.face2);
    ctx.fillStyle = f; ctx.fill();
    ctx.strokeStyle = p.motif; ctx.lineWidth = r * 0.04;
    for (const k of [0.68, 0.5]) { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 0.18; ctx.lineWidth = r * 0.03;                                  // a little grain
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.7, i * r * 0.2 + r * 0.03); ctx.quadraticCurveTo(0, i * r * 0.2 - r * 0.05, r * 0.7, i * r * 0.2 + r * 0.04); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU); ctx.clip();
  if (set === 'caps') {                                      // pressed metal: a bright reflection band, a dark one, and a warm bounce light low right
    const b = ctx.createLinearGradient(-r, -r, r, r);
    b.addColorStop(0, 'rgba(255,255,255,0)'); b.addColorStop(0.3, 'rgba(255,255,255,0)'); b.addColorStop(0.4, 'rgba(255,255,255,0.42)'); b.addColorStop(0.5, 'rgba(255,255,255,0)');
    b.addColorStop(0.72, 'rgba(0,0,0,0)'); b.addColorStop(0.82, 'rgba(0,0,0,0.22)'); b.addColorStop(0.93, 'rgba(255,230,180,0.2)'); b.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = b; ctx.fillRect(-r, -r, r * 2, r * 2);
  } else {                                                   // turned wood: the sheen of a lathe, light bands around the centre
    const cg = ctx.createConicGradient?.(-0.9, 0, 0);
    if (cg && cg.addColorStop) {
      for (let i = 0; i <= 8; i++) { cg.addColorStop(i / 8, i % 2 ? 'rgba(255,255,255,0.0)' : (side === 1 ? 'rgba(255,255,255,0.22)' : 'rgba(255,230,190,0.2)')); }
      ctx.fillStyle = cg; ctx.fillRect(-r, -r, r * 2, r * 2);
    }
  }
  ctx.restore();
  // bevel: a bright line along the upper-left edge of the face and a dark line along the lower right
  ctx.save(); ctx.lineWidth = r * 0.05; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, Math.PI * 0.95, Math.PI * 1.65); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, -Math.PI * 0.1, Math.PI * 0.6); ctx.stroke();
  ctx.restore();
  // specular: a soft glint on the upper left of the face
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, TAU); ctx.clip();
  const s = ctx.createRadialGradient(-r * 0.38, -r * 0.45, 0, -r * 0.38, -r * 0.45, r * 0.7);
  s.addColorStop(0, set === 'caps' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  if (king) crown(ctx, r, p.ink);
}

// The whole piece: a king is two discs, the lower one peeking out below the upper one.
const SPR = 64, PAD = 14, SC = 2;
const sprites = new Map();
function paint(ctx, set, side, king) {
  ctx.save();
  if (king) { ctx.translate(0, SPR * 0.18); disc(ctx, set, side, SPR * 0.92, false); ctx.translate(0, -SPR * 0.3); }
  disc(ctx, set, side, SPR * 0.92, king);
  ctx.restore();
}
function sprite(set, side, king) {
  const k = `${set}|${side}|${king ? 1 : 0}`;
  if (sprites.has(k)) return sprites.get(k);
  let c = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const w = (SPR + PAD) * 2 * SC, h = (SPR + PAD) * 2 * SC;
      c = new OffscreenCanvas(w, h); const x = c.getContext('2d'); x.scale(SC, SC); x.translate(SPR + PAD, SPR + PAD); paint(x, set, side, king);
    }
  } catch { c = null; }
  sprites.set(k, c);
  return c;
}

// soft contact shadow under a piece (light from the upper left, so the shadow falls to the lower right)
export function pieceShadow(ctx, x, y, r, lift = 0, king = false) {
  const off = r * (0.16 + lift * 0.45), a = 0.4 - lift * 0.14, base = y + r * 0.14 + (king ? r * 0.12 : 0);
  // long soft cast shadow (light from the upper left)
  ctx.save(); ctx.translate(x + off * 1.1, base + off * 0.9); ctx.scale(1.08, 0.9);
  const g = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * (1.25 + lift * 0.25));
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * (1.3 + lift * 0.25), 0, TAU); ctx.fill(); ctx.restore();
  // tight contact shadow right under the rim: darkest where the piece touches the board, fading as it lifts
  if (lift < 0.9) {
    ctx.save(); ctx.translate(x + r * 0.04, base + r * 0.06); ctx.scale(1, 0.86);
    const c = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.08);
    c.addColorStop(0, `rgba(0,0,0,${0.55 * (1 - lift)})`); c.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, TAU); ctx.fill(); ctx.restore();
  }
}

// o: { lift 0..1 (raised off the board), alpha, glow (rgb string), shadow (default true) }
export function drawPiece(ctx, x, y, r, side, king, set, o = {}) {
  const lift = o.lift || 0, ry = y - lift * r * 0.34;
  if (o.shadow !== false) pieceShadow(ctx, x, y, r, lift, king);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.glow) {
    const g = ctx.createRadialGradient(x, ry, r * 0.6, x, ry, r * 1.55); g.addColorStop(0, `rgba(${o.glow},0.7)`); g.addColorStop(1, `rgba(${o.glow},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, ry, r * 1.55, 0, TAU); ctx.fill();
  }
  const sp = sprite(set, side, king), k = r / (SPR * 0.92);
  if (sp) ctx.drawImage(sp, x - (SPR + PAD) * k, ry - (SPR + PAD) * k, (SPR + PAD) * 2 * k, (SPR + PAD) * 2 * k);
  else { ctx.translate(x, ry); ctx.scale(k, k); paint(ctx, set, side, king); }
  ctx.restore();
}
