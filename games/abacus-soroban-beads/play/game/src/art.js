// The soroban's art: wooden frame, steel rods, a reckoning beam with unit dots and bi-cone beads with lit and shaded facets.
// Used by the play screen, the title hero and the Rules illustrations (so a player sees the same beads everywhere).
import { theme, rr, mix, rgba } from './ui.js';
import { abacusGeo } from './layout.js';
import { digitsOf, heavenOf, earthOf } from './soroban.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const posOf = (d) => ({ hp: heavenOf(d), ep: [0, 1, 2, 3].map((i) => (i < earthOf(d) ? 1 : 0)) });

// A static abacus state for a value (figures, hero).
export function staticAbacus(value, rods) {
  const d = digitsOf(value, rods), A = { rods, d, hp: [], ep: [], glow: [], sel: -1, hl: null };
  d.forEach((v) => { const p = posOf(v); A.hp.push(p.hp); A.ep.push(p.ep); A.glow.push(0); });
  return A;
}

export function drawBead(ctx, cx, cy, bw, bh, T, { glow = 0, alpha = 1, lit = 0 } = {}) {
  const fw = bw * 0.17, hx = bw / 2, hy = bh / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  // soft contact shadow
  ctx.beginPath(); ctx.ellipse(cx + bw * 0.05, cy + bh * 0.2, bw * 0.46, bh * 0.38, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill();
  const path = () => { ctx.beginPath(); ctx.moveTo(cx - fw, cy - hy); ctx.lineTo(cx + fw, cy - hy); ctx.lineTo(cx + hx, cy); ctx.lineTo(cx + fw, cy + hy); ctx.lineTo(cx - fw, cy + hy); ctx.lineTo(cx - hx, cy); ctx.closePath(); };
  path();
  const g = ctx.createLinearGradient(cx - hx, 0, cx + hx, 0);
  g.addColorStop(0, T.beadLo); g.addColorStop(0.32, T.bead); g.addColorStop(0.5, mix(T.bead, T.beadHi, 0.55 + lit * 0.3)); g.addColorStop(0.7, T.bead); g.addColorStop(1, T.beadLo);
  ctx.fillStyle = g; ctx.fill();
  // upper cone catches light, lower cone is in shade
  ctx.save(); path(); ctx.clip();
  const u = ctx.createLinearGradient(0, cy - hy, 0, cy); u.addColorStop(0, 'rgba(255,255,255,0.34)'); u.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = u; ctx.fillRect(cx - hx, cy - hy, bw, hy);
  const l = ctx.createLinearGradient(0, cy, 0, cy + hy); l.addColorStop(0, 'rgba(0,0,0,0.04)'); l.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = l; ctx.fillRect(cx - hx, cy, bw, hy);
  ctx.restore();
  // the ridge where the two cones meet, then a glint
  ctx.beginPath(); ctx.moveTo(cx - hx * 0.96, cy); ctx.lineTo(cx + hx * 0.96, cy); ctx.lineWidth = Math.max(1, bh * 0.035); ctx.strokeStyle = rgba(T.beadEdge, 0.55); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx - bw * 0.16, cy - bh * 0.2, bw * 0.12, bh * 0.07, -0.5, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  path(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.2, bh * 0.045); ctx.strokeStyle = T.beadEdge; ctx.stroke();
  if (glow > 0) { path(); ctx.lineWidth = Math.max(3, bh * 0.1); ctx.strokeStyle = rgba(T.hl, 0.25 + 0.6 * glow); ctx.stroke(); path(); ctx.lineWidth = Math.max(1.5, bh * 0.045); ctx.strokeStyle = T.hl; ctx.stroke(); }
  ctx.restore();
}

function frameArt(ctx, g, T) {
  const { x, y, w, h, slot, fr } = g, r = slot * 0.5;
  // drop shadow
  rr(ctx, x + slot * 0.08, y + slot * 0.28, w, h, r); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  rr(ctx, x - slot * 0.04, y + slot * 0.12, w + slot * 0.08, h, r); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
  // wood
  const wg = ctx.createLinearGradient(x, y, x + w * 0.2, y + h); wg.addColorStop(0, T.wood0); wg.addColorStop(1, T.wood1);
  rr(ctx, x, y, w, h, r); ctx.fillStyle = wg; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.lineWidth = Math.max(1, slot * 0.03); ctx.strokeStyle = T.grain;
  for (let k = 0; k < 16; k++) {
    const yy = y + (k + 0.5) * h / 16 + Math.sin(k * 2.3) * slot * 0.12;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.bezierCurveTo(x + w * 0.3, yy + Math.sin(k * 1.7) * slot * 0.2, x + w * 0.65, yy - Math.cos(k * 1.3) * slot * 0.2, x + w, yy + Math.sin(k) * slot * 0.1); ctx.stroke();
  }
  const sh = ctx.createLinearGradient(0, y, 0, y + h * 0.4); sh.addColorStop(0, 'rgba(255,255,255,0.20)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h * 0.4);
  ctx.restore();
  rr(ctx, x + 1, y + 1, w - 2, h - 2, r - 1); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
  // recess the beads live in
  const ix = x + fr * 0.78, iy = y + fr * 0.78, iw = w - fr * 1.56, ih = h - fr * 1.56;
  const rg = ctx.createLinearGradient(0, iy, 0, iy + ih); rg.addColorStop(0, mix(T.wood1, '#000000', 0.62)); rg.addColorStop(1, mix(T.wood1, '#000000', 0.8));
  rr(ctx, ix, iy, iw, ih, r * 0.55); ctx.fillStyle = rg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
  // beam
  const bg = ctx.createLinearGradient(0, g.beamTop, 0, g.beamBot); bg.addColorStop(0, T.beam0); bg.addColorStop(0.55, mix(T.beam0, T.beam1, 0.55)); bg.addColorStop(1, T.beam1);
  ctx.fillStyle = bg; ctx.fillRect(ix - 1, g.beamTop, iw + 2, g.beamH);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(ix - 1, g.beamTop, iw + 2, Math.max(1, slot * 0.04));
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(ix - 1, g.beamBot - Math.max(1, slot * 0.05), iw + 2, Math.max(1, slot * 0.05));
  // unit dots every third rod, starting at the ones rod
  for (let r2 = 0; r2 < g.rods; r2 += 3) { ctx.beginPath(); ctx.arc(g.rodX(r2), g.beamTop + g.beamH / 2, slot * 0.1, 0, 7); ctx.fillStyle = 'rgba(40,20,10,0.8)'; ctx.fill(); }
}

function rodArt(ctx, g, T, r) {
  const rx = g.rodX(r), w = Math.max(2, g.slot * 0.075), y0 = g.top - g.fr * 0.15, y1 = g.bottom + g.fr * 0.15;
  const gr = ctx.createLinearGradient(rx - w, 0, rx + w, 0); gr.addColorStop(0, mix(T.rod, '#000000', 0.45)); gr.addColorStop(0.45, T.rod); gr.addColorStop(1, mix(T.rod, '#000000', 0.55));
  ctx.fillStyle = gr; ctx.fillRect(rx - w / 2, y0, w, y1 - y0);
}

// A = { rods, d[], hp[], ep[][], glow[], sel, hl:{rod, part:'h'|'e'|'rod', pulse} }
export function drawAbacus(ctx, g, A, T, o = {}) {
  frameArt(ctx, g, T);
  const sp = g.sp, rods = g.rods, t = o.t ?? 0;
  for (let r = 0; r < rods; r++) {
    const rx = g.rodX(r);
    if (o.hl && o.hl.rod === r) {
      const p = 0.5 + 0.5 * Math.sin(t * 6);
      const gl = ctx.createLinearGradient(rx - sp / 2, 0, rx + sp / 2, 0); gl.addColorStop(0, rgba(T.hl, 0)); gl.addColorStop(0.5, rgba(T.hl, 0.16 + 0.12 * p)); gl.addColorStop(1, rgba(T.hl, 0));
      ctx.fillStyle = gl; ctx.fillRect(rx - sp / 2, g.top - g.fr * 0.4, sp, g.bottom - g.top + g.fr * 0.8);
    }
    rodArt(ctx, g, T, r);
  }
  for (let r = 0; r < rods; r++) {
    const rx = g.rodX(r), gl = A.glow?.[r] ?? 0, hlr = o.hl && o.hl.rod === r, pulse = hlr ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
    const hpos = A.hp[r];
    drawBead(ctx, rx, g.heavenY(hpos), g.bw, g.bh, T, { glow: hlr && (o.hl.part === 'h' || o.hl.part === 'rod') ? pulse : 0, lit: gl });
    for (let i = 0; i < 4; i++) drawBead(ctx, rx, g.earthY(i, A.ep[r][i]), g.bw, g.bh, T, { glow: hlr && (o.hl.part === 'e' || o.hl.part === 'rod') ? pulse : 0, lit: gl });
  }
  if (o.labels) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let hi = 0; for (let r = 0; r < rods; r++) if (A.d[r] > 0) hi = r;
    for (let r = 0; r < rods; r++) {
      const show = o.zeros || r <= hi;
      ctx.font = `600 ${Math.max(12, g.slot * 0.62)}px Fredoka, system-ui, sans-serif`;
      ctx.fillStyle = show ? T.text : T.dim; ctx.globalAlpha = show ? 1 : 0.35;
      ctx.fillText(String(A.d[r]), g.rodX(r), g.labelY);
    }
    ctx.restore();
  }
}

// Rules / How to play illustration: the real beads in a static abacus, an optional highlighted rod and a caption of the value.
export function drawFigure(ctx, rect, fig, t) {
  const T = theme(), A = staticAbacus(fig.value, fig.rods), g = abacusGeo({ x: rect.x, y: rect.y, w: rect.w, h: rect.h }, fig.rods, true);
  drawAbacus(ctx, g, A, T, { labels: true, zeros: true, hl: fig.hl != null ? { rod: fig.hl, part: 'rod' } : null, t });
}
export { clamp };
