// Draws the printed grid: a paper card in a dark frame, ink lines, ink blocks, numbers, letters.
// Used by the play screen, the result screen and the Rules figures, so a player sees the same grid everywhere.
import { theme, rr, txt, mix, rgba } from './ui.js';
import { host } from './layout.js';

// o: { v, pencil, rev, mark, sel, cells:Set (highlighted answer), focus:Set (hint focus), flash:Map cell->0..1,
//      pop, shake, wave (arrays by cell), autoCheck, numbers, win, hideLetters, ink (cell -> colour override) }
export function drawGrid(ctx, geo, pz, o = {}) {
  const T = theme(), b = geo, B = b.size, n = pz.n, cs = b.s;
  // card: soft shadow, frame, inner ink field
  rr(ctx, b.x - 2, b.y + 3, B + 4, B + 8, B * 0.035); ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.fill();
  rr(ctx, b.x, b.y, B, B, B * 0.03); ctx.fillStyle = T.frame; ctx.fill();
  ctx.lineWidth = Math.max(1.5, B * 0.004); ctx.strokeStyle = T.rim; ctx.stroke();
  const inner = { x: b.x + b.pad - 1.5, y: b.y + b.pad - 1.5, w: B - 2 * b.pad + 3, h: B - 2 * b.pad + 3 };
  ctx.fillStyle = T.ink; ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  const gap = Math.max(0.8, Math.min(1.8, cs * 0.04)), numSize = Math.max(cs * 0.27, 9 / (host.px || 0.55));
  const sel = o.sel ?? -1, hl = o.cells, focus = o.focus;
  if (b.zoomed) { ctx.save(); ctx.beginPath(); ctx.rect(b.view.x, b.view.y, b.view.w, b.view.h); ctx.clip(); }
  const drawCell = (i) => {
    const r = b.cells[i];
    if (b.zoomed && (r.x + r.w < b.view.x || r.y + r.h < b.view.y || r.x > b.view.x + b.view.w || r.y > b.view.y + b.view.h)) return;
    const x = r.x + gap, y = r.y + gap, w = r.w - 2 * gap, h = r.h - 2 * gap;
    if (pz.block[i]) {
      ctx.fillStyle = T.block; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = rgba(T.blockHi, 0.55); ctx.fillRect(x, y, w, Math.max(1, cs * 0.05)); ctx.fillRect(x, y, Math.max(1, cs * 0.05), h);
      return;
    }
    const v = o.v ? o.v[i] : '', wrong = !!v && v !== pz.sol[i] && ((o.autoCheck && !(o.pencil && o.pencil[i])) || (o.mark && o.mark[i]));
    let face = T.paper;
    if (hl && hl.has(i)) face = mix(T.paper, T.word, 0.92);
    if (focus && focus.has(i)) face = mix(T.paper, '#5fd6b4', 0.55);
    if (wrong) face = mix(face, T.errTint, 0.75);
    const wv = o.wave ? o.wave[i] : 99, wl = wv > 0 && wv < 0.55 ? Math.sin((Math.PI * wv) / 0.55) : 0;
    if (wl > 0) face = mix(face, o.win ? '#ffd45a' : T.accent, 0.6 * wl);
    if (o.flash && o.flash.has(i)) face = mix(face, T.good, 0.45 * o.flash.get(i));
    if (i === sel) { face = T.sel; const hh = cs * 0.14; ctx.save(); ctx.beginPath(); ctx.rect(inner.x, inner.y, inner.w, inner.h); ctx.clip(); ctx.fillStyle = rgba(T.sel, 0.16); ctx.fillRect(x - hh, y - hh, w + 2 * hh, h + 2 * hh); ctx.fillStyle = rgba(T.sel, 0.16); ctx.fillRect(x - hh * 0.5, y - hh * 0.5, w + hh, h + hh); ctx.restore(); }
    const sk = o.shake ? o.shake[i] : 99, dx = sk < 0.4 ? Math.sin(sk * 70) * cs * 0.05 * (1 - sk / 0.4) : 0;
    ctx.fillStyle = face; ctx.fillRect(x + dx, y, w, h);
    if (i === sel) { ctx.lineWidth = Math.max(2, cs * 0.07); ctx.strokeStyle = mix(T.sel, T.ink, 0.55); ctx.strokeRect(x + dx + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth); }
    if (o.numbers !== false && pz.num[i]) txt(ctx, pz.num[i], x + dx + cs * 0.07, y + cs * 0.06, { size: numSize, weight: 800, color: T.num, align: 'left', base: 'top' });
    if (v && !o.hideLetters) {
      const pp = o.pop ? o.pop[i] : 99, pop = pp < 0.26 ? 1 + 0.3 * Math.sin((Math.PI * pp) / 0.26) : 1;
      const penc = !!(o.pencil && o.pencil[i]);
      ctx.save(); ctx.translate(x + dx + w / 2, y + h * 0.56); ctx.scale(pop, pop);
      txt(ctx, v, 0, 0, { size: cs * (penc ? 0.56 : 0.66), color: wrong ? T.err : penc ? T.pencil : (o.ink && o.ink.get(i)) || T.letter, align: 'center', serif: true });
      ctx.restore();
      if (wrong) { ctx.beginPath(); ctx.moveTo(x + w * 0.12, y + h * 0.88); ctx.lineTo(x + w * 0.88, y + h * 0.12); ctx.lineWidth = Math.max(1.5, cs * 0.05); ctx.strokeStyle = rgba(T.err, 0.8); ctx.stroke(); }
    }
    if (o.rev && o.rev[i]) { ctx.beginPath(); ctx.moveTo(x + w - cs * 0.24, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cs * 0.24); ctx.closePath(); ctx.fillStyle = T.err; ctx.fill(); }
    };
  for (let i = 0; i < n * n; i++) if (i !== sel) drawCell(i);
  if (sel >= 0) drawCell(sel);
  if (b.zoomed) ctx.restore();
  // a soft light across the sheet: brighter top-left, a little shade bottom-right
  const lg = ctx.createLinearGradient(inner.x, inner.y, inner.x + inner.w, inner.y + inner.h);
  lg.addColorStop(0, T.dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.28)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = lg; ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
}
