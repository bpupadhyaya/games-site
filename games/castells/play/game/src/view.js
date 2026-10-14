// Castells: drawing of the play screen (the square, the pinya, the tower, the panel with the tray and the steadying controls).
// Pure drawing: game.js owns state; this file only reads it.
import { W, H, TEXT_SCALES, playLayout, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, paintButton, drawButton, wrapLines, textShadow, plaque } from './ui.js';
import { drawBackdrop, drawPerson, pinyaSpecs, drawBadge, drawFx, COLLAS } from './art.js';
import { trayFor, tierCheck, loadFor, minLoad, isCrown, CROWN, ALETA_SECS, climberAt, advice, FALL } from './sim.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
const fit = (ctx, text, maxW, size, weight = 700) => {
  let px = size;
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (px > 11 && ctx.measureText(text).width > maxW) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return px;
};

export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], !!(state.play && state.play.mode === 'watch'));
export const collaOf = (state) => COLLAS[state.record.collaSel] ?? COLLAS[0];

// The 3D layer (view3d/castells3d.js, installed by main.js as globalThis.__castells3d) draws real people packed shoulder to shoulder:
// tighter columns than the 2D fallback figures.
const COL_W = () => (globalThis.__castells3d ? 0.27 : 0.5);

// ---- stage geometry ---------------------------------------------------------------------------------------------------------
export function stageCam(L, tower) {
  const R = L.stage, N = tower.n, M = tower.m;
  const col = COL_W();
  const hUnits = 0.82 * (M - 1) + 1.18, wUnits = N * col + 1.9;
  const s = clamp(Math.min((R.h * 0.95) / (hUnits + 0.3), (R.w * 0.94) / wUnits), 40, 150);
  const gy = R.y + R.h * 0.93 - s * 0.38;
  return { cx: R.x + R.w / 2, gy, s, pitch: 0.82 * s, colW: col * s, N, M, T: tower.T, R };
}
const slotX = (cam, tier, j) => {
  const n = tier.n;
  const sp = tier.kind === 'trunk' ? cam.colW : cam.colW * 0.88;
  return cam.cx + (j - (n - 1) / 2) * sp;
};
// sway: horizontal offset of tier height h (in tiers) for lean x in [-1,1]
const swayAt = (cam, lean, h) => lean * cam.s * (cam.N * 0.5 + 1.0) * 0.62 * Math.pow(h / Math.max(1, cam.M), 1.5) * 1.6;
const swayRot = (cam, lean, h) => Math.atan2(swayAt(cam, lean, h + 0.5) - swayAt(cam, lean, h - 0.5), cam.pitch);

// ---- the tray ---------------------------------------------------------------------------------------------------------------
export function trayList(state) {
  const p = state.play;
  const ids = trayFor(p.tower, p.cur);
  const key = state.settings.sortW ? 'w' : 's';
  const pe = p.tower.people;
  return ids.slice().sort((a, b) => pe[b][key] - pe[a][key] || pe[b].s - pe[a].s || a - b);
}
export function gridMetrics(state, L) {
  const hz = L.hz, g = 10, G = L.grid;
  const minW = Math.round(176 * Math.min(1.25, hz)), cols = Math.max(1, Math.floor((G.w + g) / (minW + g)));
  const cw = (G.w - g * (cols - 1)) / cols, ch = Math.round(Math.max(96, L.fs.card * 4.3));
  const list = trayList(state);
  const rows = Math.ceil(list.length / cols), total = rows * (ch + g) - g;
  return { cols, cw, ch, g, list, total, view: G.h, max: Math.max(0, total - G.h), rect: G };
}
export function cardRects(state, L, scroll) {
  const m = gridMetrics(state, L), out = [];
  m.list.forEach((id, i) => {
    const r = Math.floor(i / m.cols), c = i % m.cols;
    out.push({ id, x: L.grid.x + c * (m.cw + m.g), y: L.grid.y + r * (m.ch + m.g) - scroll, w: m.cw, h: m.ch });
  });
  return { ...m, cards: out };
}
export function slotRects(L, tier) {
  const S = L.slots, n = tier.n, g = 10, w = Math.min(190, (S.w - g * (n - 1)) / n), tw = w * n + g * (n - 1), x0 = S.x + (S.w - tw) / 2;
  return Array.from({ length: n }, (_, j) => ({ x: x0 + j * (w + g), y: S.y, w, h: S.h }));
}

// ---- the whole play screen -------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const p = state.play, L = layoutOf(state), tower = p.tower, cam = stageCam(L, tower);
  const colla = collaOf(state);
  // the 3D square fills everything above the panel, including the strip behind the HUD buttons
  L.envRect = { x: 0, y: 0, w: W, h: Math.min(H, L.stage.y + L.stage.h + 6) }; L.playEnv = true;
  const shake = state.shake > 0 ? state.shake : 0;
  ctx.save();
  if (shake > 0) ctx.translate(Math.sin(state.t * 90) * shake * 7, Math.cos(state.t * 77) * shake * 5);
  if (has3dSet()) { ctx.fillStyle = '#10121f'; ctx.fillRect(0, 0, W, H); } else drawBackdrop(ctx, W, H, L.stage, state.record.plazaSel);
  drawTowerScene(ctx, state, L, cam, colla);
  drawFx(ctx, state.fx);
  ctx.restore();
  drawPops(ctx, state);
  drawHud(ctx, state, L);
  drawPanel(ctx, state, L, cam, colla);
  if (state.banner) drawBannerText(ctx, state, L);
  if (state.toastT > 0 && state.toast) drawToast(ctx, state, L);
}

function drawTowerScene(ctx, state, L, cam, colla, noLadder = false) {
  const p = state.play, tower = p.tower, t = state.t;
  const lean = p.climb ? p.climb.x : 0;
  const push = p.climb && !p.climb.done ? p.climb.push : 0;
  // street shadow
  const sg = ctx.createRadialGradient(cam.cx, cam.gy + cam.s * 0.12, 4, cam.cx, cam.gy + cam.s * 0.12, cam.s * (cam.N * 0.5 + 1.6));
  sg.addColorStop(0, 'rgba(10,8,20,0.5)'); sg.addColorStop(1, 'rgba(10,8,20,0)');
  ctx.save(); ctx.translate(cam.cx, cam.gy + cam.s * 0.12); ctx.scale(1, 0.22); ctx.translate(-cam.cx, -(cam.gy + cam.s * 0.12));
  ctx.fillStyle = sg; ctx.fillRect(cam.cx - cam.s * 4, cam.gy - cam.s * 3, cam.s * 8, cam.s * 6); ctx.restore();
  const post = [];         // ghosts and hint rings: drawn over the people
  const S = [];            // every person of the scene, back to front: painted in 3D by the layer, else as 2D figures
  const crowd = pinyaSpecs(cam, t, lean, push);
  const pin = (it) => S.push({ kind: 'pinya', key: 'y' + it.i, person: it.look, x: it.x, y: it.y + cam.s * 0.52, s: cam.s * 0.9, front: it.front, i: it.i, count: it.count, shove: it.shove, side: it.side, wob: it.wob, o: { shirt: colla, pose: it.shove ? 'push' : 'up', t, bust: true, alpha: 1 } });
  for (const it of crowd) if (!it.front) pin(it);
  // tier labels and loads on the sides
  if (!noLadder) drawLadder(ctx, state, L, cam);
  // committed and current tier
  const T = tower.T;
  const crownNow = isCrown(tower.tiers[Math.min(p.cur, tower.tiers.length - 1)]);
  const lastTrunkDone = p.cur >= T;
  for (let k = 0; k < T; k++) {
    const tier = tower.tiers[k];
    const ids = k < p.cur ? tier.slots : k === p.cur && p.phase === 'build' ? p.sel : null;
    if (!ids) continue;
    const rise = p.phase === 'rise' && p.riseTier === k ? ease(p.riseT / 0.7) : 1;
    const y0 = cam.gy - k * cam.pitch;
    const full = k === p.cur && p.phase === 'build' && p.check && p.check.full;
    for (let j = 0; j < tier.n; j++) {
      const id = ids[j];
      const f = fallAmt(p), dir = Math.sign(lean || 1);
      const x = slotX(cam, tier, j) + swayAt(cam, lean, k) + dir * f * cam.s * (0.15 + 0.12 * k) * (1 + 0.3 * Math.sin(j * 2.1 + k));
      const rot = swayRot(cam, lean, k) + dir * f * (0.5 + 0.22 * k) * (1 + 0.25 * Math.sin(j * 1.7));
      if (id === undefined || id < 0) {
        if (k === p.cur && p.phase === 'build') post.push(() => drawGhost(ctx, x, y0, cam, t, j));
        continue;
      }
      const person = tower.people[id];
      const weak = full && p.check.weak.includes(id);
      const lift = (1 - rise) * cam.pitch * 0.95 + f * f * cam.s * (0.25 + 0.06 * k) * (k + 1) * 0.35;
      S.push({ kind: 'tier', key: 't' + id, person, x, y: y0 + lift, s: cam.s, k, j, n: tier.n, fall: f, rise,
        o: { shirt: colla, pose: rise < 1 ? 'climb' : weak ? 'brace' : 'hold', t, ph: t * 5 + j, rot, alpha: 0.55 + 0.45 * rise, strain: weak ? 1 : (p.climb && p.climb.wobble ? 0.6 : 0) } });
      if (p.hintIds && p.hintIds.includes(id)) post.push(() => ring(ctx, x, y0 - cam.s * 0.5, cam.s * 0.5, '#ffd86a', t));
    }
  }
  // the crown: children waiting in front of the pinya during the build, then climbing
  drawKids(ctx, state, L, cam, colla, lean, S);
  for (const it of crowd) if (it.front) pin(it);
  flushPeople(ctx, state, L, cam, colla, S, lean, push);
  for (const fn of post) fn();
  void crownNow; void lastTrunkDone;
}

// Paint a list of people: the 3D layer when it is there (nothing while it loads: no flash of the flat figures), else the 2D figures.
// cam = { s, cx, gy, N, colW } (the foot of the tower sits at (cx, gy)); group keeps several lists in one frame apart.
// true while the 3D layer is up and owns the whole square (facades, floor, crowd): the 2D backdrop is then not painted
export const has3dSet = () => { const g = globalThis.__castells3d; return !!(g && !g.pending && !g.lost && g.ok); };
export function paintPeople(ctx, state, S, cam, rect, o = {}) {
  const g = globalThis.__castells3d;
  if (g) {
    if (g.pending) return;
    if (g.draw(ctx, { items: S, cam, rect, lean: o.lean || 0, push: o.push || 0, plaza: o.plaza ?? state.record.plazaSel, t: state.t, M: o.M || 7, T: o.T || 3, group: o.group || 'play', env: !!o.env, cheer: !!o.cheer, falling: !!o.falling, shadowX: o.shadowX || 0, bandX: o.bandX || 0 })) return;
  }
  for (const it of S) drawPerson(ctx, it.x, it.y, it.s, it.person, it.o);
}
export const colWidth = COL_W;
function flushPeople(ctx, state, L, cam, colla, S, lean, push) {
  const tw = state.play.tower, c = state.play.climb;
  const cheer = !!(c && c.aleta);
  const falling = !!(c && c.phase === 'fell');
  paintPeople(ctx, state, S, cam, L.envRect || cam.R, { lean, push, M: tw.m, T: tw.T, group: L.playEnv ? 'play' : 'attract', env: true, cheer, falling });
}

function ring(ctx, x, y, r, col, t) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 6);
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.62, r * 1.05, 0, 0, TAU); ctx.stroke(); ctx.restore();
}
function drawGhost(ctx, x, y, cam, t, j) {
  ctx.save();
  const w = Math.min(cam.s * 0.34, cam.colW * 0.46), h = cam.s * 0.92;
  ctx.setLineDash([8, 7]); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,248,220,${0.55 + 0.25 * Math.sin(t * 3 + j)})`;
  roundPath(ctx, x - w, y - h, w * 2, h, w * 0.7); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,248,220,0.14)'; ctx.fill();
  ctx.fillStyle = 'rgba(255,248,220,0.75)'; ctx.font = `700 ${Math.round(cam.s * 0.4)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+', x, y - h * 0.5);
  ctx.restore();
}

const fallAmt = (p) => (p.climb && p.climb.phase === 'fell' ? clamp(p.fallT / 1.1, 0, 1) : 0);

// The children: waiting in front (build), climbing (climb), standing on their tier (crowned).
function drawKids(ctx, state, L, cam, colla, lean, S) {
  const p = state.play, tower = p.tower, T = tower.T, c = p.climb, t = state.t;
  const kids = tower.kids;
  // who is which: from the tiers' slots once committed, else the current selection, else free children
  const role = [null, null, null, null];     // dosos a, dosos b, acotxador, enxaneta
  const set = (idx, id) => { if (id !== undefined && id >= 0) role[idx] = id; };
  const dos = tower.tiers[T].slots, ac = tower.tiers[T + 1].slots, en = tower.tiers[T + 2].slots;
  const take = (arr, base) => arr.forEach((id, j) => set(base + j, id));
  if (p.cur > T) take(dos, 0); else if (p.cur === T) take(p.sel, 0);
  if (p.cur > T + 1) take(ac, 2); else if (p.cur === T + 1) take(p.sel, 2);
  if (p.cur > T + 2) take(en, 3); else if (p.cur === T + 2) take(p.sel, 3);
  if (p.phase !== 'build' && p.phase !== 'rise') { take(dos, 0); take(ac, 2); take(en, 3); }
  const placed = new Set(role.filter((x) => x !== null));
  const free = kids.filter((id) => !placed.has(id));
  const waitX = (i) => cam.cx + (i - 1.5) * cam.s * 0.46;
  const waitY = cam.gy + cam.s * 0.2;
  const drawKid = (id, x, y, o, info = {}) => S.push({ kind: 'kid', key: 't' + id, person: tower.people[id], x, y, s: cam.s * 0.98, fall: fallAmt(p), ...info, o: { shirt: colla, t, ...o } });
  const crowned = c && (c.phase === 'aleta' || c.phase === 'unload' || c.phase === 'done');
  if (!c) {
    // build phase: free children and chosen children wait together, in front of the crowd
    const order = [...free, ...role.filter((x) => x !== null)];
    order.forEach((id, i) => drawKid(id, waitX(i), waitY, { pose: 'hold', ph: 0, alpha: placed.has(id) ? 1 : 0.8 }, { wait: true }));
    return;
  }
  const g = c.g, cl = climberAt(T, Math.min(g, c.total - 1e-6));
  const tierY = (k) => cam.gy - k * cam.pitch;
  // climbers: the ones who have not climbed yet wait; the one climbing is on its way; finished ones stand on their tier
  const doneC = crowned ? 3 : cl.c;               // climbers finished: 0 none, 1 pair, 2 + acotxador, 3 all
  const finalPos = (idx) => {
    if (idx < 2) return { x: slotX(cam, tower.tiers[T], idx), k: T };
    if (idx === 2) return { x: slotX(cam, tower.tiers[T + 1], 0), k: T + 1 };
    return { x: slotX(cam, tower.tiers[T + 2], 0), k: T + 2 };
  };
  const F = fallAmt(p), dirF = Math.sign(lean || 1);
  const sw = (k) => swayAt(cam, lean, k) + dirF * F * cam.s * (0.15 + 0.12 * k);
  const rt = (k) => swayRot(cam, lean, k) + dirF * F * (0.5 + 0.22 * k);
  const fy = (k) => F * F * cam.s * (0.25 + 0.06 * k) * (k + 1) * 0.35;
  role.forEach((id, idx) => {
    if (id === null) return;
    const group = idx < 2 ? 0 : idx === 2 ? 1 : 2;
    const fp = finalPos(idx);
    if (group < cl.c || crowned) {
      const pose = idx === 3 && c.phase !== 'climb' ? (c.aleta ? 'cheer' : 'hold') : 'hold';
      let h = fp.k;
      if (c.phase === 'unload' || c.phase === 'done') h = Math.min(fp.k, c.height);
      const climbingDown = (c.phase === 'unload') && c.height < fp.k;
      drawKid(id, fp.x + sw(h), tierY(h) + fy(h), { pose: climbingDown ? 'climb' : pose, ph: t * 6, rot: rt(h), smile: !!c.aleta && idx === 3 }, { k: fp.k, j: idx < 2 ? idx : 0, n: idx < 2 ? 2 : 1, role: idx, climbing: climbingDown, up: h });
    } else if (group === cl.c && c.phase !== 'fell') {
      // climbing now: from the side of the pinya up the tower to its place
      const k = Math.min(fp.k, cl.h);
      const from = group === 0 ? (idx === 0 ? -1 : 1) * (cam.N * cam.colW * 0.5 + cam.s * 0.18) : cam.N * cam.colW * 0.5 + cam.s * 0.18;
      const m = clamp(k / Math.max(1, fp.k), 0, 1), blend = m * m * (3 - 2 * m);
      const x = cam.cx + from * (1 - blend) + (fp.x - cam.cx) * blend + sw(k);
      drawKid(id, x, tierY(k) + cam.s * 0.1 * (1 - blend) + fy(k), { pose: 'climb', ph: g * 7, rot: rt(k) }, { k: fp.k, j: idx < 2 ? idx : 0, n: idx < 2 ? 2 : 1, role: idx, climbing: true, up: k, side: idx === 1 ? 1 : idx === 0 ? -1 : 1, blend });
    } else {
      // waiting their turn in front
      const i = idx;
      drawKid(id, waitX(i), waitY, { pose: 'hold' }, { wait: true });
    }
  });
  // unplaced free children (never happens once the crown is chosen) are not drawn
  void free; void doneC;
  // the aleta flourish
  if (c.aleta && (c.phase === 'unload' || c.phase === 'done') && c.t) {
    const k = T + 2, x = slotX(cam, tower.tiers[T + 2], 0) + sw(k), y = tierY(k) - cam.s * 1.3;
    ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff3b0'; ctx.font = `800 ${Math.round(cam.s * 0.32)}px ${DISPLAY}`; ctx.textAlign = 'center';
    if (c.phase === 'unload' && c.height > T + 1.6) ctx.fillText(c.aleta === 'perfect' ? 'Aleta!' : '', x, y);
    ctx.restore();
  }
}

// Tier names on the left and the load each casteller carries on the right.
function drawLadder(ctx, state, L, cam) {
  const p = state.play, tower = p.tower, mf = minF();
  const size = Math.max(Math.round(17 * L.hz), mf);
  const half = (cam.N * cam.colW) / 2;
  const showR = cam.cx + half + cam.s * 0.45 + size * 5.4 < L.stage.x + L.stage.w;
  ctx.save();
  ctx.textBaseline = 'middle';
  for (let k = 0; k < tower.T; k++) {
    const tier = tower.tiers[k];
    const y = cam.gy - k * cam.pitch - cam.s * 0.42;
    const cur = k === p.cur && p.phase === 'build';
    const done = k < p.cur;
    if (!cur && !done && k > p.cur + 1) continue;
    const label = tier.name;
    ctx.font = `700 ${size}px ${FONT}`;
    const lw = ctx.measureText(label).width + 16;
    const lx = Math.max(L.stage.x + 6, cam.cx - half - cam.s * 0.5 - lw);
    roundPath(ctx, lx, y - size * 0.8, lw, size * 1.6, size * 0.8);
    ctx.fillStyle = cur ? 'rgba(255,226,140,0.95)' : 'rgba(18,24,48,0.62)'; ctx.fill();
    ctx.fillStyle = cur ? '#2a2210' : done ? '#e8e2cf' : 'rgba(232,226,207,0.6)'; ctx.textAlign = 'center';
    ctx.fillText(label, lx + lw / 2, y);
    if (done && showR) {
      const load = loadFor(tower, k, tier.slots);
      const txt = `${Math.ceil(load)} kg each`;
      ctx.font = `600 ${size}px ${FONT}`;
      const tw = ctx.measureText(txt).width + 14, tx = cam.cx + half + cam.s * 0.4;
      roundPath(ctx, tx, y - size * 0.8, tw, size * 1.6, size * 0.8); ctx.fillStyle = 'rgba(18,24,48,0.55)'; ctx.fill();
      ctx.fillStyle = '#d8f0e0'; ctx.textAlign = 'left'; ctx.fillText(txt, tx + 7, y);
    }
  }
  ctx.restore();
}

function drawPops(ctx, state) {
  for (const q of state.pops) {
    const k = q.t / q.max, a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.font = `800 ${q.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,12,30,0.8)'; ctx.lineJoin = 'round';
    const y = q.y - k * 60;
    ctx.strokeText(q.text, q.x, y); ctx.fillStyle = q.col; ctx.fillText(q.text, q.x, y);
    ctx.restore();
  }
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------------
function drawHud(ctx, state, L) {
  const p = state.play, watch = p.mode === 'watch';
  const tower = p.tower;
  if (!watch) drawButton(ctx, L.pause, 'II', { dark: true, size: Math.round(L.fs.btn * 1.1) });
  else drawButton(ctx, L.pause, 'Exit', { dark: true, size: Math.round(L.fs.btn * 0.85) });
  if (!watch) drawButton(ctx, L.think, 'Think', { active: true, size: Math.round(L.fs.btn * 0.82), disabled: p.phase === 'rise' || (p.climb && p.climb.done) });
  else drawButton(ctx, L.think, state.paused ? 'Resume' : 'Pause', { active: true, size: Math.round(L.fs.btn * 0.8) });
  const I = L.info;
  ctx.save();
  plaque(ctx, I.x, I.y, I.w, I.h, { r: 22, kind: 'wood', rim: true });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const t1 = `${p.recipe.name}`, big = L.fs.big;
  const px = fit(ctx, t1, I.w - 24, big, 800);
  ctx.fillStyle = '#fff6e0'; ctx.font = `800 ${px}px ${DISPLAY}`; ctx.fillText(t1, I.x + I.w / 2, I.y + I.h * 0.38);
  const sub = hudSub(state);
  const sp = fit(ctx, sub, I.w - 20, L.fs.tiny + 2, 600);
  ctx.fillStyle = '#ffe9b8'; ctx.font = `600 ${sp}px ${FONT}`; ctx.fillText(sub, I.x + I.w / 2, I.y + I.h * 0.76);
  ctx.restore();
  void tower;
}
function hudSub(state) {
  const p = state.play, tw = p.tower;
  if (p.mode === 'watch' && p.phase === 'build') return `Watch & Learn · tier ${Math.min(p.cur + 1, tw.m)} of ${tw.m}`;
  if (p.phase === 'build' || p.phase === 'rise') return `Tier ${Math.min(p.cur + 1, tw.m)} of ${tw.m}`;
  const c = p.climb;
  if (!c) return '';
  if (c.phase === 'climb') return ['The dosos climb', 'The acotxador climbs', 'The enxaneta climbs'][c.climber] ?? 'Climbing';
  if (c.phase === 'aleta') return 'Make the aleta';
  if (c.phase === 'unload') return 'Taking it down';
  if (c.phase === 'done') return 'Descarregat';
  return 'It fell';
}

// ---- the panel ----------------------------------------------------------------------------------------------------------------
function drawPanel(ctx, state, L, cam, colla) {
  const p = state.play, P = L.panel;
  plaque(ctx, P.x, P.y, P.w, P.h, { r: 26, kind: 'paper', rim: true });
  if (p.phase === 'build' || p.phase === 'rise') drawBuildPanel(ctx, state, L, colla);
  else drawClimbPanel(ctx, state, L);
}

function drawBuildPanel(ctx, state, L, colla) {
  const p = state.play, tower = p.tower, tier = tower.tiers[p.cur], watch = p.mode === 'watch';
  const chk = p.check;
  // header
  const H0 = L.hdr;
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const sortW = L.sort.w + 10;
  const crown = isCrown(tier);
  const title = crown ? `${tier.name}, ${tier.gloss}` : `${tier.name}, ${tier.gloss === 'the base' ? 'the base' : tier.gloss + ' tier'}`;
  let px = fit(ctx, title, H0.w - sortW, L.fs.mid + 3, 800);
  ctx.fillStyle = C.deep; ctx.font = `800 ${px}px ${FONT}`; ctx.fillText(title, H0.x, H0.y + L.sort.h * 0.5 + px * 0.34);
  let line;
  let bad = false;
  const dd = p.dec;
  if (watch && dd) line = `${dd.phase === 'think' ? `Thinking… ${Math.max(0, Math.ceil(dd.dur - dd.t))} s` : dd.phase === 'reveal' ? 'It chooses these people' : 'Placing them'}  ·  each must hold at least ${Math.ceil(chk.load)} kg`;
  else if (p.dead && p.sel.length === 0) { line = 'Cannot be finished from here: lower a tier'; bad = true; }
  else if (p.phase === 'rise') line = 'Raising the tier…';
  else if (chk.full) {
    bad = chk.weak.length > 0;
    line = bad ? `Each holds ${Math.ceil(chk.load)} kg: ${tower.people[chk.weak[0]].name} is not strong enough` : `Each must hold ${Math.ceil(chk.load)} kg and all can`;
  } else line = `Each must hold at least ${Math.ceil(chk.load)} kg`;
  const lw2 = H0.w;
  const lp = fit(ctx, line, lw2, L.fs.small + 1, 600);
  ctx.font = `600 ${lp}px ${FONT}`; ctx.fillStyle = bad ? '#a8281c' : chk.full ? '#1b6a3c' : '#4a4030';
  ctx.fillText(line, H0.x, H0.y + H0.h - lp * 0.35 - 2);
  ctx.restore();
  // sort button
  if (!watch) drawButton(ctx, L.sort, state.settings.sortW ? 'By weight' : 'By strength', { size: Math.round(L.fs.small * 0.95) });
  // slots
  const rects = slotRects(L, tier);
  rects.forEach((r, j) => {
    const id = p.sel[j];
    roundPath(ctx, r.x, r.y, r.w, r.h, 18);
    if (id !== undefined && id >= 0) {
      const weak = chk.full && chk.weak.includes(id);
      ctx.fillStyle = weak ? 'rgba(235,120,100,0.35)' : 'rgba(120,200,150,0.3)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = weak ? '#c2412e' : '#2d8a56'; ctx.stroke();
      const person = tower.people[id];
      const br = Math.min(r.h * 0.34, r.w * 0.3);
      drawBadge(ctx, r.x + br + 10, r.y + r.h / 2, br, person, colla);
      const tx = r.x + br * 2 + 18, mw = r.w - br * 2 - 24;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.deep;
      const f1 = fit(ctx, person.name, mw, L.fs.card, 800); ctx.font = `800 ${f1}px ${FONT}`; ctx.fillText(person.name, tx, r.y + r.h * 0.3);
      const t2 = `▲ ${person.s} kg`; const f2 = fit(ctx, t2, mw, L.fs.cardSub + 2, 700); ctx.font = `700 ${f2}px ${FONT}`; ctx.fillStyle = weak ? '#a8281c' : '#1b6a3c'; ctx.fillText(t2, tx, r.y + r.h * 0.58);
      const t3 = `▼ ${person.w} kg`; const f3 = fit(ctx, t3, mw, L.fs.cardSub + 2, 700); ctx.font = `700 ${f3}px ${FONT}`; ctx.fillStyle = '#5a4a30'; ctx.fillText(t3, tx, r.y + r.h * 0.82);
    } else {
      ctx.fillStyle = 'rgba(70,56,36,0.08)'; ctx.fill();
      ctx.setLineDash([9, 7]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(70,56,36,0.5)'; ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(70,56,36,0.55)'; ctx.font = `700 ${Math.round(L.fs.mid * 1.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', r.x + r.w / 2, r.y + r.h / 2);
    }
  });
  // the tray
  const cr = cardRects(state, L, state.gridScroll);
  const G = L.grid;
  ctx.save();
  ctx.beginPath(); ctx.rect(G.x - 2, G.y, G.w + 4, G.h); ctx.clip();
  const minLd = chk.full ? 0 : minLoad(tower, p.cur, p.sel.filter((i) => i >= 0));
  for (const c of cr.cards) {
    if (c.y + c.h < G.y - 2 || c.y > G.y + G.h + 2) continue;
    const person = tower.people[c.id];
    const inTier = p.sel.includes(c.id);
    const hinted = p.hintIds && p.hintIds.includes(c.id);
    const dec = p.dec && p.dec.ids && p.dec.phase !== 'think' && p.dec.ids.includes(c.id);
    const weakAlways = !chk.full && !inTier && person.s < minLd;
    roundPath(ctx, c.x, c.y, c.w, c.h, 16);
    ctx.fillStyle = inTier ? 'rgba(130,205,160,0.55)' : weakAlways ? 'rgba(200,190,170,0.5)' : 'rgba(255,252,242,0.95)'; ctx.fill();
    ctx.lineWidth = inTier || hinted || dec ? 4 : 2; ctx.strokeStyle = inTier ? '#2d8a56' : hinted || dec ? '#e0a21a' : 'rgba(70,56,36,0.4)'; ctx.stroke();
    const br = Math.min(c.h * 0.3, c.w * 0.22);
    ctx.globalAlpha = weakAlways ? 0.6 : 1;
    drawBadge(ctx, c.x + br + 10, c.y + c.h / 2, br, person, colla);
    const tx = c.x + br * 2 + 18, mw = c.w - br * 2 - 24;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.deep;
    const f1 = fit(ctx, person.name, mw, L.fs.card, 800); ctx.font = `800 ${f1}px ${FONT}`; ctx.fillText(person.name, tx, c.y + c.h * 0.26);
    const t2 = `▲ ${person.s} kg`; const f2 = fit(ctx, t2, mw, L.fs.card, 700); ctx.font = `700 ${f2}px ${FONT}`;
    ctx.fillStyle = weakAlways ? '#a8281c' : '#1b6a3c'; ctx.fillText(t2, tx, c.y + c.h * 0.54);
    const t3 = `▼ ${person.w} kg`; const f3 = fit(ctx, t3, mw, L.fs.card, 700); ctx.font = `700 ${f3}px ${FONT}`;
    ctx.fillStyle = '#5a4a30'; ctx.fillText(t3, tx, c.y + c.h * 0.8);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // scroll hints
  if (cr.max > 0) {
    const th = Math.max(36, G.h * (G.h / cr.total)), ty = G.y + (state.gridScroll / cr.max) * (G.h - th);
    roundPath(ctx, G.x + G.w - 6, ty, 5, th, 3); ctx.fillStyle = 'rgba(70,56,36,0.5)'; ctx.fill();
    if (state.gridScroll < cr.max - 4) {
      const mp = Math.max(minF(), 18), pw = mp * 8.4;
      roundPath(ctx, G.x + G.w / 2 - pw / 2, G.y + G.h - mp * 1.9, pw, mp * 1.6, mp * 0.8); ctx.fillStyle = 'rgba(40,30,16,0.82)'; ctx.fill();
      ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${mp}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more people', G.x + G.w / 2, G.y + G.h - mp * 1.1);
    }
  }
  // controls
  if (watch) {
    const D = L.demo;
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { dark: true, size: Math.round(L.fs.btn * 0.9) });
    drawButton(ctx, D.exit, 'Exit', { size: Math.round(L.fs.btn * 0.9) });
    drawButton(ctx, D.dec, 'Think −', { disabled: state.settings.thinkIdx === 0, size: Math.round(L.fs.btn * 0.82) });
    drawButton(ctx, D.inc, 'Think +', { disabled: state.settings.thinkIdx >= 3, size: Math.round(L.fs.btn * 0.82) });
  } else {
    const lastCrown = p.cur === tower.tiers.length - 1;
    let label, disabled = false;
    if (p.phase === 'rise') { label = 'Raising…'; disabled = true; }
    else if (!chk.full) { label = `Pick ${tier.n - p.sel.filter((i) => i >= 0).length} more`; disabled = true; }
    else if (!chk.ok) { label = 'Someone is too weak'; disabled = true; }
    else label = lastCrown ? 'Start the climb' : isCrown(tier) ? `Send up the ${tier.name.toLowerCase()}` : `Raise the ${tier.name.toLowerCase()}`;
    drawButton(ctx, L.raise, label, { primary: true, disabled, size: Math.round(L.fs.btn * 0.92) });
    drawButton(ctx, L.lower, p.cur > 0 ? 'Lower a tier' : 'Clear', { size: Math.round(L.fs.btn * 0.78), disabled: p.phase === 'rise' || (p.cur === 0 && p.sel.every((i) => i < 0)) });
  }
}

function drawClimbPanel(ctx, state, L) {
  const p = state.play, c = p.climb, watch = p.mode === 'watch';
  if (!c) return;
  // status line
  const S = L.status;
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const names = ['Dosos', 'Acotxador', 'Enxaneta'];
  let head, sub;
  if (c.phase === 'climb') { head = `${names[c.climber]} climbing`; sub = c.wobble ? 'It is wobbling. Steady it!' : 'Keep the tower still'; }
  else if (c.phase === 'aleta') { head = 'The enxaneta is on top'; sub = c.aleta ? '' : 'Tap Aleta when it is calm'; }
  else if (c.phase === 'unload') { head = c.aleta === 'perfect' ? 'Perfect aleta' : c.aleta === 'late' ? 'Aleta made' : `Aleta: ${c.aleta}`; sub = 'Now take it down gently'; }
  else if (c.phase === 'done') { head = 'Castell descarregat'; sub = 'Crowned and taken down'; }
  else { head = 'The tower fell'; sub = c.fall; }
  ctx.fillStyle = C.deep; let px = fit(ctx, head, S.w, L.fs.mid + 3, 800); ctx.font = `800 ${px}px ${FONT}`; ctx.fillText(head, S.x, S.y + S.h * 0.32);
  ctx.fillStyle = c.wobble ? '#a8281c' : '#4a4030'; px = fit(ctx, sub, S.w, L.fs.small, 600); ctx.font = `600 ${px}px ${FONT}`; ctx.fillText(sub, S.x, S.y + S.h * 0.76);
  ctx.restore();
  // lean gauge
  const G = L.gauge;
  ctx.save();
  roundPath(ctx, G.x, G.y, G.w, G.h, G.h / 2); ctx.clip();
  const gg = ctx.createLinearGradient(G.x, 0, G.x + G.w, 0);
  const z = (v) => G.x + G.w * (0.5 + v / 2);
  gg.addColorStop(0, '#c2412e'); gg.addColorStop(0.5 - 0.62 / 2 - 0.01, '#e8a23a'); gg.addColorStop(0.5 - 0.38 / 2, '#5fbf7a'); gg.addColorStop(0.5 + 0.38 / 2, '#5fbf7a'); gg.addColorStop(0.5 + 0.62 / 2 + 0.01, '#e8a23a'); gg.addColorStop(1, '#c2412e');
  ctx.fillStyle = gg; ctx.fillRect(G.x, G.y, G.w, G.h);
  ctx.restore();
  roundPath(ctx, G.x, G.y, G.w, G.h, G.h / 2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.stroke();
  // the marker
  const mx = z(clamp(c.x, -FALL, FALL));
  ctx.fillStyle = '#1b1830'; ctx.beginPath(); ctx.moveTo(mx, G.y - 4); ctx.lineTo(mx - 11, G.y - 18); ctx.lineTo(mx + 11, G.y - 18); ctx.closePath(); ctx.fill();
  roundPath(ctx, mx - 5, G.y - 2, 10, G.h + 4, 5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1b1830'; ctx.stroke();
  // the thin advice tick (Think)
  if (p.thinkT > 0) {
    const adv = advice(c);
    if (adv !== 0) { ctx.fillStyle = '#7a4fd0'; ctx.font = `800 ${L.fs.small}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(adv < 0 ? '◄ push left' : 'push right ►', G.x + G.w / 2, G.y + G.h / 2); }
  }
  // tension
  const Tn = L.tens;
  roundPath(ctx, Tn.x, Tn.y, Tn.w, Tn.h, 6); ctx.fillStyle = 'rgba(70,56,36,0.2)'; ctx.fill();
  if (c.tension > 0.01) { roundPath(ctx, Tn.x, Tn.y, Tn.w * clamp(c.tension, 0, 1), Tn.h, 6); ctx.fillStyle = c.tension > 0.6 ? '#c2412e' : '#e8a23a'; ctx.fill(); }
  // pads or the aleta button
  const live = !watch && !c.done && c.phase !== 'fell';
  const adv = p.thinkT > 0 ? advice(c) : 0;
  const pad = (r, dir, label, glyph) => {
    const on = p.pushHeld === dir && live;
    const o = { dark: !on && adv !== dir, primary: on, active: adv === dir && !on, disabled: !live && !watch };
    paintButton(ctx, r, o);
    ctx.save();
    ctx.fillStyle = o.active ? C.ink : '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(Math.min(r.h * 0.34, 74))}px ${FONT}`; ctx.fillText(glyph, r.x + r.w / 2, r.y + r.h * 0.4 + (on ? 3 : 0));
    const fp = fit(ctx, label, r.w - 16, L.fs.btn * 0.85, 700); ctx.font = `700 ${fp}px ${FONT}`; ctx.fillText(label, r.x + r.w / 2, r.y + r.h * 0.74 + (on ? 3 : 0));
    ctx.restore();
  };
  pad(L.padL, -1, watch ? 'Crowd pushes' : 'Push left', '◄'); pad(L.padR, 1, watch ? 'Crowd pushes' : 'Push right', '►');
  // the aleta button: always there, lit only while the enxaneta is on top
  {
    const A = L.aleta, ready = c.phase === 'aleta' && !c.aleta, k = c.aletaT / ALETA_SECS;
    const calm = ready && Math.abs(c.x) + Math.abs(c.v) * 0.25 < 0.14;
    paintButton(ctx, A, { primary: calm, active: ready && !calm, disabled: !ready });
    ctx.save();
    ctx.fillStyle = !ready ? 'rgba(40,46,64,0.55)' : calm ? '#fffaf0' : C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = ready ? 'ALETA!' : c.aleta ? 'Aleta made' : 'Aleta (when crowned)';
    const fp = fit(ctx, label, A.w - 24, L.fs.btn * 1.25, 800); ctx.font = `800 ${fp}px ${DISPLAY}`;
    ctx.fillText(label, A.x + A.w / 2, A.y + A.h * (ready ? 0.42 : 0.5));
    if (ready) {
      roundPath(ctx, A.x + 24, A.y + A.h * 0.74, A.w - 48, 9, 4.5); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      roundPath(ctx, A.x + 24, A.y + A.h * 0.74, (A.w - 48) * (1 - clamp(k, 0, 1)), 9, 4.5); ctx.fillStyle = calm ? '#d6f5df' : '#6a4a10'; ctx.fill();
    }
    ctx.restore();
  }
}

function drawBannerText(ctx, state, L) {
  const b = state.banner, k = b.t / b.max;
  const a = k < 0.12 ? k / 0.12 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
  const R = L.stage;
  ctx.save();
  ctx.globalAlpha = clamp(a, 0, 1);
  const cx = R.x + R.w / 2, cy = R.y + R.h * 0.3 - (1 - ease(k * 3)) * 20;
  const px = Math.round(Math.min(R.w * 0.14, 76 * Math.min(L.hz, 1.3)));
  ctx.font = `italic 800 ${px}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = px * 0.2; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,16,40,0.9)'; ctx.strokeText(b.text, cx, cy);
  const gr = ctx.createLinearGradient(0, cy - px * 0.5, 0, cy + px * 0.5); gr.addColorStop(0, '#fff6cf'); gr.addColorStop(1, b.col || '#f0b43c');
  ctx.fillStyle = gr; ctx.fillText(b.text, cx, cy);
  if (b.sub) { const sp = Math.max(minF(), Math.round(px * 0.34)); ctx.font = `700 ${sp}px ${FONT}`; ctx.lineWidth = sp * 0.3; ctx.strokeText(b.sub, cx, cy + px * 0.78); ctx.fillStyle = '#fff6e0'; ctx.fillText(b.sub, cx, cy + px * 0.78); }
  ctx.restore();
}

function drawToast(ctx, state, L) {
  const R = L.stage, a = clamp(state.toastT / 0.4, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  const maxW = Math.min(R.w - 40, 620);
  const px = Math.max(minF(), L.fs.toast);
  ctx.font = `700 ${px}px ${FONT}`;
  const lines = wrapLines(ctx, state.toast, maxW - 36);
  const h = lines.length * px * 1.3 + 22, w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36);
  const x = R.x + R.w / 2 - w / 2, y = R.y + 44;
  roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(16,22,46,0.88)'; ctx.fill();
  ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 11 + px * 0.65 + i * px * 1.3));
  ctx.restore();
}

// The living background of the menus: a finished tower swaying gently in the square. rect = where the tower stands.
export function drawAttract(ctx, state, rect, own = null, envRect = null) {
  const p = own || state.att;
  if (!p) return;
  const st = { play: p, t: state.t, record: state.record, fx: [], pops: [] };
  const L = { stage: rect, hz: 1, envRect };
  const cam = stageCam(L, p.tower), colla = collaOf(state);
  if (has3dSet()) { ctx.fillStyle = '#10121f'; ctx.fillRect(0, 0, W, H); } else drawBackdrop(ctx, W, H, envRect || rect, state.record.plazaSel);
  if (!own) { p.climb.x = Math.sin(state.t * 0.7) * 0.07 + Math.sin(state.t * 1.9) * 0.025; p.climb.push = 0; }
  drawTowerScene(ctx, st, L, cam, colla, true);
}

export { textShadow, CROWN, tierCheck };
