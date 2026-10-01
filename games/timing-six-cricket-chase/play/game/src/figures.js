// Illustrations for How to Play / Rules, drawn with the game's own art (same ball, stumps, bin, figures).
import { THEMES, DEG, fenceR } from './core.js';
import { PAL, SANS, FONT, drawBall, drawStumps, drawBin, drawTopPerson, KIT, rr, textFill } from './art.js';
import { drawOverheadGround, toScreen, OH, drawFieldFigure } from './scene.js';
import { buildField, PRESETS } from './field.js';
import { LEVELS } from './core.js';

function localRng() { let s = 5; return { next: () => { s = (s * 16807) % 2147483647; return s / 2147483647; } }; }

function label(ctx, text, x, y, size = 19, color = '#fff4dc') {
  ctx.font = `600 ${size}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(14,10,24,0.72)'; rr(ctx, x - w / 2, y - size * 0.8, w, size * 1.6, 7); ctx.fill();
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

function miniFieldTransform(w, h) {
  const th = THEMES.stadium;
  const sc = Math.min(w / (th.baseR * 2.3 * th.scale), h / (th.baseR * 2.3 * th.scale));
  return { sc, map: (sx, sy) => [w / 2 + (sx - OH.cx) * sc, h / 2 + (sy - OH.cy) * sc] };
}

export const FIGURES = {
  field(ctx, w, h) {
    const { sc, map } = miniFieldTransform(w, h);
    ctx.save();
    ctx.beginPath(); rr(ctx, 0, 0, w, h, 22); ctx.clip();
    ctx.translate(w / 2, h / 2); ctx.scale(sc, sc); ctx.translate(-OH.cx, -OH.cy);
    drawOverheadGround(ctx, 'stadium');
    const f = buildField('balanced', 'stadium', LEVELS[1], localRng(), null).fielders;
    for (const fl of f) drawFieldFigure(ctx, 'stadium', fl, {});
    ctx.restore();
    for (const fl of f) {
      const [sx, sy] = toScreen('stadium', fl.x, fl.z); const [x, y] = map(sx, sy);
      if (fl.role !== 'bowler') label(ctx, fl.name, x, y - 22, Math.max(13, 15), '#fff4dc');
    }
    label(ctx, 'Off side', w * 0.82, h * 0.92, 18, '#ffcf6b'); label(ctx, 'Leg side', w * 0.18, h * 0.92, 18, '#ffcf6b');
  },
  wheel(ctx, w, h) {
    ctx.save(); rr(ctx, 0, 0, w, h, 22); ctx.clip();
    ctx.fillStyle = 'rgba(70,140,70,0.95)'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.6, R = Math.min(w * 0.44, h * 0.56);
    ctx.fillStyle = 'rgba(40,100,50,0.95)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (const a of [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a * DEG) * R, cy - Math.cos(a * DEG) * R); ctx.stroke(); }
    ctx.fillStyle = '#d6c28f'; ctx.fillRect(cx - 8, cy - R, 16, R * 2);
    drawTopPerson(ctx, cx - 24, cy + 2, 12, { kit: KIT.home, fx: 0, fz: 1, helmet: true });
    for (const [a, t] of [[0, 'straight'], [-45, 'on-drive'], [45, 'cover'], [-90, 'pull / flick'], [90, 'cut'], [140, 'late cut'], [-140, 'glance']]) {
      const x = cx + Math.sin(a * DEG) * R * 0.74, y = cy - Math.cos(a * DEG) * R * 0.74;
      ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a * DEG) * 44, cy - Math.cos(a * DEG) * 44); ctx.lineTo(cx + Math.sin(a * DEG) * R * 0.6, cy - Math.cos(a * DEG) * R * 0.6); ctx.stroke();
      label(ctx, t, x, y, 16);
    }
    label(ctx, 'Off side', w * 0.86, h * 0.1, 15, '#ffcf6b'); label(ctx, 'Leg side', w * 0.14, h * 0.1, 15, '#ffcf6b');
    ctx.restore();
  },
  timing(ctx, w, h) {
    ctx.save(); rr(ctx, 0, 0, w, h, 20); ctx.clip();
    ctx.fillStyle = 'rgba(30,22,52,0.9)'; ctx.fillRect(0, 0, w, h);
    const y = h * 0.42, bw = w - 40, x0 = 20, mid = x0 + bw / 2, ms = bw / 0.4; // 0.4 s across
    const bands = [[0.165, '#8b3b3b', 'edge'], [0.115, '#c58a3a', 'early / late'], [0.07, '#7ac05a', 'good'], [0.032, '#ffd34d', 'PERFECT']];
    for (const [t, c] of bands) { ctx.fillStyle = c; ctx.fillRect(mid - t * ms, y - 16, t * 2 * ms, 32); }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(mid - 1.5, y - 22, 3, 44);
    ctx.font = `600 15px ${SANS}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff4dc';
    ctx.fillText('EARLY', x0 + 28, y + 42); ctx.fillText('LATE', x0 + bw - 24, y + 42); ctx.fillText('ball reaches the bat', mid, y + 42);
    drawBall(ctx, mid - 0.09 * ms, y - 34, 11, 'leather', 0.6);
    ctx.restore();
  },
  stumps(ctx, w, h) {
    ctx.save(); rr(ctx, 0, 0, w, h, 20); ctx.clip();
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6f9a52'); g.addColorStop(1, '#4a8040'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    drawStumps(ctx, w * 0.3, h * 0.82, 180, 0, true);
    drawBin(ctx, w * 0.72, h * 0.82, 180, 0);
    label(ctx, 'Stumps', w * 0.3, h * 0.94, 18); label(ctx, 'Bin', w * 0.72, h * 0.94, 18);
    ctx.restore();
  },
  ball(ctx, w, h) {
    ctx.save(); rr(ctx, 0, 0, w, h, 20); ctx.clip();
    ctx.fillStyle = 'rgba(30,22,52,0.9)'; ctx.fillRect(0, 0, w, h);
    drawBall(ctx, w * 0.3, h * 0.45, 40, 'leather', 0.5); drawBall(ctx, w * 0.7, h * 0.45, 40, 'tennis', 0.5);
    label(ctx, 'Stadium ball', w * 0.3, h * 0.88, 16); label(ctx, 'Backyard and beach ball', w * 0.7, h * 0.88, 16);
    ctx.restore();
  },
  run(ctx, w, h) {
    ctx.save(); rr(ctx, 0, 0, w, h, 20); ctx.clip();
    ctx.fillStyle = '#4f9a42'; ctx.fillRect(0, 0, w, h);
    const px = w / 2, top = 26, bot = h - 26;
    ctx.fillStyle = '#d6c28f'; ctx.fillRect(px - 22, top, 44, bot - top);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (const y of [top + 20, bot - 20]) { ctx.beginPath(); ctx.moveTo(px - 36, y); ctx.lineTo(px + 36, y); ctx.stroke(); }
    drawStumps(ctx, px, top + 20, 150, 0, false); drawStumps(ctx, px, bot - 20, 150, 0, false);
    drawTopPerson(ctx, px - 12, bot - 30, 11, { kit: KIT.home, fx: 0, fz: 1, helmet: true, run: 1 });
    drawTopPerson(ctx, px + 12, top + 34, 11, { kit: KIT.home, fx: 0, fz: -1, helmet: true, run: 1 });
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px - 12, bot - 54); ctx.lineTo(px - 12, top + 54); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 18, top + 62); ctx.lineTo(px - 12, top + 50); ctx.lineTo(px - 6, top + 62); ctx.stroke();
    drawTopPerson(ctx, w * 0.78, h * 0.35, 11, { kit: KIT.away, fx: -1, fz: 0, run: 0.6 });
    ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.74, h * 0.34); ctx.lineTo(px + 30, top + 22); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'throw', w * 0.7, h * 0.22, 16); label(ctx, 'tap RUN', w * 0.28, h * 0.5, 17, '#ffcf6b');
    ctx.restore();
  },
  lengths(ctx, w, h) {
    ctx.save(); rr(ctx, 0, 0, w, h, 20); ctx.clip();
    ctx.fillStyle = '#4f9a42'; ctx.fillRect(0, 0, w, h);
    const px = w * 0.3, top = 14, bot = h - 20, L = 9.5, sy = (z) => bot - (z / L) * (bot - top);
    ctx.fillStyle = '#d6c28f'; ctx.fillRect(px - 26, top, 52, bot - top);
    drawStumps(ctx, px, bot, 160, 0, false);
    const bands = [[0.5, 1.1, 'Yorker', '#ff6b57'], [1.8, 2.8, 'Full', '#ff9d3d'], [3.3, 4.6, 'Good length', '#ffd34d'], [5, 6.5, 'Short', '#7ac05a'], [6.8, 8.2, 'Bouncer', '#2ec4b6']];
    for (const [a, b, t, c] of bands) { ctx.fillStyle = c; ctx.globalAlpha = 0.55; ctx.fillRect(px - 26, sy(b), 52, sy(a) - sy(b)); ctx.globalAlpha = 1; ctx.font = `600 17px ${SANS}`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff4dc'; ctx.fillText(`${t}  (${a} to ${b} m)`, px + 44, sy((a + b) / 2) + 5); }
    ctx.restore();
  },
};

export function drawFigure(ctx, key, w, h) {
  const f = FIGURES[key];
  if (f) f(ctx, w, h);
}
