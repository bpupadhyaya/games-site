// Half-body painted portraits in an arched, latticed window: the storyteller's picture of each hero for
// story cards and the chapter road. They reuse the character part art (./paint/) at high resolution.
// Roles, not names (names live in text.js).
import { TAU, GOLD, light } from './stage.js';
import { blit, lin, rad } from './paint/kit.js';
import { partsFor } from './paint/rig.js';
import { tenBust } from './paint/ravan.js';
import { eagleBust } from './paint/creatures.js';

export const LOOKS = {
  prince:   { kind: 'prince',   sky: '86,44,30',  tint: '238,140,44', expr: 'calm' },
  princess: { kind: 'princess', sky: '70,30,60',  tint: '232,96,140', expr: 'calm' },
  brother:  { kind: 'brother',  sky: '20,56,60',  tint: '64,170,132', expr: 'determined' },
  regent:   { kind: 'bharat',   sky: '52,40,34',  tint: '200,150,70', expr: 'sorrowful' },
  swift:    { kind: 'leaper_c',   sky: '80,32,24',  tint: '236,104,46', expr: 'joyful', mace: true },
  vking:    { kind: 'vking',    sky: '74,46,20',  tint: '226,170,60', expr: 'calm' },
  tenking:  { kind: 'ravan',    sky: '60,20,40',  tint: '120,84,196', fan: true },
  eagle:    { kind: null,       sky: '32,42,74',  tint: '176,110,70', eagle: true },
};

function window_(ctx, w, top, bottom) {
  ctx.beginPath(); ctx.moveTo(-w, bottom); ctx.lineTo(-w, top + 70);
  ctx.quadraticCurveTo(-w, top + 30, -w * 0.55, top + 22); ctx.quadraticCurveTo(-w * 0.2, top + 16, 0, top);
  ctx.quadraticCurveTo(w * 0.2, top + 16, w * 0.55, top + 22); ctx.quadraticCurveTo(w, top + 30, w, top + 70);
  ctx.lineTo(w, bottom); ctx.closePath();
}

// who: a key of LOOKS. Centre (x, y) is the middle of the window; width = 2r. expr overrides the mood.
export function portrait(ctx, { who, x, y, r = 90, t = 0, frame = true, expr = null }) {
  const L = LOOKS[who] ?? LOOKS.prince;
  const k = r / 90, W = 90, TOP = -135, BOT = 112;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  window_(ctx, W, TOP, BOT);
  const g = ctx.createLinearGradient(0, TOP, 0, BOT); g.addColorStop(0, `rgba(${L.sky},1)`); g.addColorStop(0.55, `rgba(${L.tint},0.62)`); g.addColorStop(1, 'rgba(24,8,14,1)');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); window_(ctx, W, TOP, BOT); ctx.clip();
  ctx.strokeStyle = 'rgba(255,205,130,0.14)'; ctx.lineWidth = 1.2;
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * 22, TOP); ctx.lineTo(i * 22 + 130, BOT); ctx.moveTo(i * 22, TOP); ctx.lineTo(i * 22 - 130, BOT); ctx.stroke(); }
  light(ctx, 0, 10, 150, L.tint, 0.34 + 0.04 * Math.sin(t * 2));
  if (L.eagle) eagleBust(ctx, t);
  else if (L.fan) tenBust(ctx);
  else bust(ctx, L, expr ?? L.expr);
  // warm floor light rising from below, soft vignette
  const v = ctx.createRadialGradient(0, -10, 60, 0, -10, 170); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,3,8,0.5)'); ctx.fillStyle = v; ctx.fillRect(-W, TOP, W * 2, BOT - TOP);
  ctx.restore();

  if (frame) {
    // carved gold arch: dark outer bevel, bright gold body, inner lit rule, a ruby at the crown
    ctx.save(); ctx.scale(1.06, 1.04); ctx.translate(0, -3); window_(ctx, W, TOP, BOT); ctx.strokeStyle = '#5a3208'; ctx.lineWidth = 9; ctx.stroke(); ctx.restore();
    const gg = ctx.createLinearGradient(-W, TOP, W, BOT); gg.addColorStop(0, '#fff2b8'); gg.addColorStop(0.35, '#f2c04e'); gg.addColorStop(0.7, '#b57a1c'); gg.addColorStop(1, '#f8d97e');
    window_(ctx, W, TOP, BOT); ctx.strokeStyle = gg; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,214,0.7)'; ctx.lineWidth = 1.2; ctx.save(); ctx.scale(1.012, 1.01); ctx.translate(0, -1); window_(ctx, W, TOP, BOT); ctx.stroke(); ctx.restore();
    const rg = ctx.createRadialGradient(-2, TOP - 8, 1, 0, TOP - 6, 9); rg.addColorStop(0, '#ffb0a0'); rg.addColorStop(0.5, '#c81e3a'); rg.addColorStop(1, '#5a0a1a');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, TOP - 6, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = gg; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = gg; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 10, TOP - 4); ctx.quadraticCurveTo(d * 26, TOP - 16, d * 34, TOP - 2); ctx.quadraticCurveTo(d * 24, TOP - 6, d * 12, TOP + 2); ctx.fill(); }
    ctx.save(); ctx.scale(0.93, 0.95); ctx.translate(0, 4); window_(ctx, W, TOP, BOT); ctx.strokeStyle = 'rgba(255,205,130,0.55)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    ctx.fillStyle = GOLD;
    for (const [dx, dy] of [[-W, BOT], [W, BOT], [-W, TOP + 70], [W, TOP + 70], [0, TOP]]) { ctx.beginPath(); ctx.moveTo(dx, dy - 8); ctx.lineTo(dx + 6, dy); ctx.lineTo(dx, dy + 8); ctx.lineTo(dx - 6, dy); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,205,130,0.85)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-W + 18 + i * ((W * 2 - 36) / 8), BOT + 1, 1.8, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function bust(ctx, L, expr) {
  const { K, S } = partsFor(L.kind, 0, 'p'), sc = K.fur ? 2.2 : 2.75, hs = (K.headS ?? 1) * sc;
  const neckY = K.fur ? 34 : 44, hipY = neckY + (K.T + 1) * sc, sock = (d) => [d * K.sw * 0.72 * sc, hipY + (-K.T + 9) * sc];
  const part = (sp, x, y, k, rot = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k); blit(ctx, sp); ctx.restore(); };
  if (S.hair) part(S.hair, 2 * sc, neckY, hs);
  if (S.veil) part(S.veil, 2 * sc, neckY, sc);
  part(S.armU, ...sock(-1), sc, 0.16);                       // far arm behind the torso
  part(S.torso, 0, hipY, sc);
  part(S.head(expr), 2 * sc, neckY, hs);
  part(S.armU, ...sock(1), sc, L.mace ? -0.5 : -0.12);        // near arm in front
}

// PERF: bust() above only ever touches torso/armU/head(+hair/veil) - never thigh/shin/foot/wrap - at
// the 'p' (1.6x) portrait resolution, a separate cache tier from gameplay figures (see rig.js build()
// and warmFigureParts). Returns one task per such part so game.js can warm a chapter's story-card
// portrait across frames instead of the card paying for it in full the moment it's first shown.
// `eagle`/`fan` looks paint their own art (eagleBust/tenBust's own body reuses the gameplay tier
// already, via warmFigureParts) so there is nothing extra to warm for them here.
export function warmBustParts(who) {
  const L = LOOKS[who] ?? LOOKS.prince;
  if (L.eagle || L.fan) return [];
  const { S } = partsFor(L.kind, 0, 'p');
  const tasks = [() => void S.torso, () => void S.armU, () => void S.head(L.expr ?? 'calm')];
  if ('hair' in S) tasks.push(() => void S.hair);
  if ('veil' in S) tasks.push(() => void S.veil);
  return tasks;
}
