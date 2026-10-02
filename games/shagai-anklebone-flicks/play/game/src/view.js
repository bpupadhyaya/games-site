// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The heavy art is cached (art.js).
import { W, H, TRAY, BONE_SPOTS, CHIP_Y, stationXY, pathPoint, STEP, slotOffset } from './layout.js';
import { FINISH, TILES, TILE_NAMES, FACE_NAMES, FACE_VALUE, FACE_WEIGHT, previewGallop, scoreOf, comboLabel, ranking } from './rules.js';
import { drawBackdrop, drawBoard, drawPanel, drawBone, drawToken, drawTileIcon, RIDER, RIDER_LIGHT, RIDER_DARK, FACE_COL, INK, ACC, lcg } from './art.js';
import { screenButtons, screenLayout, readerPages, readerIndex, PANEL, BODY, zoomOf } from './ui.js';
import { ART_H } from './text.js';

export const DISPLAY = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TITLE_G = { riders: [{ pos: 14, name: 'You' }, { pos: 23, name: 'Naran' }, { pos: 31, name: 'Saran' }, { pos: 8, name: 'Tuya' }], turn: 0, winner: -1 };

export function render(ctx, state) {
  const sc = state.scene, z = zoomOf(state);
  const panelScene = ['setup', 'settings', 'how', 'about', 'rules', 'demo-limit'].includes(sc);
  PRESSED = state.press && !state.press.moved ? state.press.b : null;
  const R = makeText(ctx);

  if (panelScene) { drawBackdrop(ctx); scrim(ctx, 0.28); drawPanelScene(ctx, state, R, z); return; }
  drawBoard(ctx);
  if (sc === 'title') { drawTitle(ctx, state, R); return; }

  const g = state.g, auto = sc === 'autoplay' || sc === 'autoplay-over';
  R.glowText(auto ? 'Auto Play · Watch & Learn' : 'Shagai', 360, auto ? 76 : 84, auto ? 38 : 64, '#fff4d6');
  drawTrailOverlay(ctx, state, R);
  drawTokens(ctx, state, g, true);
  plaque(ctx, 36, 216, 648, 82);
  R.fit(state.msg || '', 360, 218, 600, 78, 27 * Math.min(z, 1.4), 15, '#fff4d6');
  drawChips(ctx, state, R);
  drawBones(ctx, state, R);
  drawParticles(ctx, state);
  drawPops(ctx, state, R);

  if (sc === 'play' || sc === 'autoplay') {
    if (!state.menuOpen) { for (const b of screenButtons(state)) R.button(b); }
    if (sc === 'autoplay' && state.ap.paused && !state.menuOpen) drawPausedBanner(ctx, R);
  }
  if (state.menuOpen && (sc === 'play' || sc === 'autoplay')) { scrim(ctx, 0.62); drawStack(ctx, state, R, z); }
  if (sc === 'over' || sc === 'autoplay-over') drawOver(ctx, state, R, z);
}

// ---- text helpers ---------------------------------------------------------------------------------------------
function makeText(ctx) {
  const text = (str, x, y, size, color = '#fff4d6', font = DISPLAY, weight = 600, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const glowText = (str, x, y, size, color) => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; text(str, x, y, size, color, DISPLAY, 700); ctx.restore(); };
  const fit = (str, x, y, maxW, maxH, sMax, sMin, color) => {
    sMax = Math.round(sMax);
    const key = str + '|' + sMax + '|' + maxW + '|' + maxH;
    let hit = R_FIT.get(key);
    if (!hit) {
      for (let s = sMax; s >= sMin; s -= 1) {
        ctx.font = `600 ${s}px ${DISPLAY}`; const lines = []; let cur = '';
        for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
        lines.push(cur);
        if (lines.length * s * 1.22 <= maxH || s === sMin) { hit = { s, lines }; break; }
      }
      if (R_FIT.size > 400) R_FIT.clear();
      R_FIT.set(key, hit);
    }
    const lh = hit.s * 1.22, top = y + (maxH - hit.lines.length * lh) / 2 + hit.s * 0.88;
    hit.lines.forEach((ln, i) => text(ln, x, top + i * lh, hit.s, color, DISPLAY, 600));
  };
  // flat, clean buttons: one solid fill, a thin edge, a soft drop shadow (no inner shapes)
  const button = (n) => {
    ctx.save(); if (n.dim) ctx.globalAlpha = 0.42;
    const down = !!n.id && n.id === PRESSED && !n.dim; if (down) ctx.translate(0, 3);
    const prim = n.primary, sel = n.sel, hot = prim || (sel && n.chip);
    ctx.fillStyle = 'rgba(0,0,0,0.36)'; ctx.beginPath(); ctx.roundRect(n.x + 1, n.y + 5, n.w, n.h, 18); ctx.fill();
    ctx.fillStyle = hot ? '#f0b429' : sel ? '#2f8f5a' : '#244f93'; ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, n.h, 18); ctx.fill();
    ctx.strokeStyle = hot ? '#ffe9a6' : 'rgba(170,200,245,0.75)'; ctx.lineWidth = 2; ctx.stroke();
    if (down) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, n.h, 18); ctx.fill(); }
    const col = hot ? '#2a1b12' : '#fff4d6', lines = n.lines || [n.label];
    let size = n.size; const need = lines.length * size * 1.22;
    if (need > n.h - 12) size = Math.max(14, Math.floor((n.h - 12) / (lines.length * 1.22)));
    const lh = size * 1.22, top = n.y + n.h / 2 - (lines.length * lh) / 2 + size * 0.88;
    lines.forEach((ln, i) => text(ln, n.x + n.w / 2, top + i * lh, size, col, DISPLAY, 600));
    ctx.restore();
  };
  return { text, glowText, fit, button };
}
const R_FIT = new Map();
let PRESSED = null; // id of the button under the finger (set once per frame in render)

function plaque(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(16,34,72,0.94)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#f0c24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.stroke();
}
const scrim = (ctx, a = 0.62) => { ctx.fillStyle = `rgba(10,5,3,${a})`; ctx.fillRect(0, 0, W, H); };

// ---- the trail's live overlay: labels, the landing preview ----------------------------------------------------------------
function drawTrailOverlay(ctx, state, R) {
  const T0 = state.t;
  const lab = (str, x, y, size, color = '#fff8e6', align = 'center') => { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(60,35,10,0.8)'; ctx.font = `700 ${size}px ${DISPLAY}`; ctx.textAlign = align; ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore(); };
  for (let i = 10; i < FINISH; i += 10) { if (TILES[i]) continue; const p = stationXY(i); lab(String(i), p.x, p.y + 5, 14, '#6b4a22'.replace('#6b4a22', '#fff8e6')); }
  const s0 = stationXY(0), f = stationXY(FINISH);
  lab('START', s0.x - 34, s0.y + 66, 17, '#fff8e6', 'left'); lab('FINISH', f.x - 24, f.y + 52, 18, '#ffe27a');
  // the landing preview: where the bones as they lie would take the current rider
  const ph = state.phase, rd = state.ride;
  if (!['decide', 'aithink', 'aiact', 'apthink', 'apreveal', 'show'].includes(ph) || !rd.tossed || rd.anim) return;
  const g = state.g, me = g.riders[g.turn], res = previewGallop(g, g.turn, scoreOf(rd.faces).total);
  const a = stationXY(me.pos), pulse = 0.5 + 0.5 * Math.sin(T0 * 5);
  ctx.save(); ctx.strokeStyle = 'rgba(255,248,214,0.85)'; ctx.lineWidth = 4; ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  for (let s = me.pos * STEP; s <= res.landed * STEP; s += 10) { const p = pathPoint(s); ctx.lineTo(p.x, p.y); }
  const e = stationXY(Math.min(res.landed, FINISH)); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore();
  const d = stationXY(res.finished ? FINISH : res.landed);
  ctx.save(); ctx.strokeStyle = res.bumped.length ? `rgba(255,100,80,${0.7 + 0.3 * pulse})` : `rgba(255,236,150,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 5; ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(d.x, d.y, 24 + pulse * 3, 0, TAU); ctx.stroke(); ctx.restore();
  let tag = res.finished ? 'Finish!' : `Station ${res.final}`;
  if (!res.finished) {
    if (res.effect?.kind === 'wind') tag = `Tailwind: to ${res.final}`; else if (res.effect?.kind === 'burrow') tag = `Burrow: back to ${res.final}`;
    else if (res.effect?.kind === 'stream') tag = 'Stream: -1 toss'; else if (res.effect?.kind === 'camp') tag = 'Camp: +1 toss';
    if (res.bumped.length) tag = `Flick ${g.riders[res.bumped[0].pl].name} back!`;
  }
  ctx.save(); ctx.font = `600 21px ${DISPLAY}`; const w = ctx.measureText(tag).width + 26, tx = clamp(d.x, w / 2 + 8, W - w / 2 - 8), ty = d.y < 480 ? d.y + 40 : d.y - 66;
  ctx.fillStyle = res.bumped.length ? '#c42a30' : res.effect?.kind === 'burrow' ? '#8a4a1a' : '#1d6a4a'; ctx.beginPath(); ctx.roundRect(tx - w / 2, ty, w, 32, 16); ctx.fill(); ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(tag, tx, ty + 23); ctx.restore();
}

// ---- riders on the trail ---------------------------------------------------------------------------------------------------------
export function drawTokens(ctx, state, g, live) {
  const T0 = state.t, G = state.gal, list = [];
  const flying = new Set(state.fly.map((f) => f.pl));
  const groups = new Map();
  g.riders.forEach((r, i) => {
    if (flying.has(i) || (G && G.res.pl === i)) return;
    const k = String(r.pos); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i);
  });
  for (const ids of groups.values()) ids.forEach((i, k) => { const p = stationXY(g.riders[i].pos), o = slotOffset(k, ids.length); list.push({ i, x: p.x + o.dx, y: p.y + o.dy + 8, lift: 0, kk: 1.12 }); });
  if (G) {
    const p = stationXY(G.u), hop = G.stage === 'run' ? Math.abs(Math.sin(Math.PI * (G.u % 1))) * 14 : G.stage === 'wind' ? 10 : G.stage === 'burrow' ? -6 : 4;
    list.push({ i: G.res.pl, x: p.x, y: p.y + 8, lift: Math.max(0, hop), kk: 1.22, moving: true });
  }
  for (const f of state.fly) { const u = ease(clamp(f.t / f.dur, 0, 1)); list.push({ i: f.pl, x: f.from.x + (f.to.x - f.from.x) * u, y: f.from.y + (f.to.y - f.from.y) * u + 8, lift: Math.sin(Math.PI * u) * 46, kk: 1.05, fly: true }); }
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    let { x, y, lift } = it;
    if (live && !it.moving && !it.fly && g.turn === it.i && g.winner < 0 && state.scene !== 'over' && state.scene !== 'autoplay-over') {
      const pulse = 0.5 + 0.5 * Math.sin(T0 * 4);
      ctx.save(); ctx.strokeStyle = `rgba(255,236,150,${0.55 + 0.4 * pulse})`; ctx.lineWidth = 4; ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.ellipse(x, y + 2, 29 + pulse * 2, 15 + pulse, 0, 0, TAU); ctx.stroke(); ctx.restore();
      lift = state.prefs.calm ? 2 : 3 + Math.abs(Math.sin(T0 * 3)) * 3;
    }
    if (g.winner === it.i) lift = 4 + Math.abs(Math.sin(T0 * 6)) * 10;
    drawToken(ctx, it.i, x, y, it.kk, lift);
  }
}

// ---- the rider strip -------------------------------------------------------------------------------------------------------------------
function drawChips(ctx, state, R) {
  const g = state.g, n = g.riders.length, gap = 10, w = (648 - gap * (n - 1)) / n, y = CHIP_Y, h = 74;
  g.riders.forEach((r, i) => {
    const x = 36 + i * (w + gap), turn = g.turn === i && g.winner < 0 && (state.scene === 'play' || state.scene === 'autoplay');
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(16,34,72,0.92)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.restore();
    ctx.strokeStyle = turn ? '#ffe27a' : 'rgba(240,194,74,0.45)'; ctx.lineWidth = turn ? 4 : 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.stroke();
    ctx.fillStyle = RIDER[i]; ctx.beginPath(); ctx.arc(x + 26, y + 30, 18, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    R.text(String(i + 1), x + 26, y + 37, 22, '#fff', DISPLAY, 700);
    const nm = r.name, small = n >= 4;
    R.text(nm, x + 52, y + 28, small ? 20 : 24, '#fff4d6', DISPLAY, 600, 'left');
    R.text(`${r.pos} / ${FINISH}`, x + 52, y + 52, small ? 17 : 20, '#ffe27a', DISPLAY, 500, 'left');
    if (r.status) { const c = r.status === 'camp' ? '#ffe27a' : '#9fd8ff'; ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x + w - (small ? 44 : 56), y + 6, small ? 38 : 50, 22, 11); ctx.fill(); R.text(r.status === 'camp' ? '+1' : '−1', x + w - (small ? 25 : 31), y + 23, 17, '#2a1b12', DISPLAY, 700); }
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.roundRect(x + 12, y + h - 12, w - 24, 6, 3); ctx.fill();
    ctx.fillStyle = RIDER_LIGHT[i]; ctx.beginPath(); ctx.roundRect(x + 12, y + h - 12, Math.max(6, (w - 24) * r.pos / FINISH), 6, 3); ctx.fill();
  });
}

// ---- bones and the mat -------------------------------------------------------------------------------------------------------------------
function drawBones(ctx, state, R) {
  const rd = state.ride, T0 = state.t, ph = state.phase, g = state.g;
  const yours = ph === 'throw' && g.riders[g.turn].human && state.scene === 'play';
  const calm = state.prefs.calm;
  if (yours) {
    ctx.save(); const pulse = 0.5 + 0.5 * Math.sin(T0 * 4), gr = ctx.createRadialGradient(360, 1168, 20, 360, 1168, 300);
    gr.addColorStop(0, `rgba(255,224,120,${0.28 + 0.2 * pulse})`); gr.addColorStop(1, 'rgba(255,190,60,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(360, 1168, 300, 110, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  const resting = !rd.tossed;
  BONE_SPOTS.forEach((sp, i) => {
    const pose = rd.pose[i] || { dx: 0, dy: 0, rot: 0 };
    if (resting) { drawBone(ctx, [0, 1, 2, 3][i], sp.x + (i % 2 ? 4 : -4), sp.y + Math.sin(T0 * 2 + i * 1.7) * 3, (i % 2 ? 0.25 : -0.2), 1, 0, { alpha: yours ? 1 : 0.8 }); return; }
    const a = rd.anim, it = a?.items[i];
    if (a && it) {
      const D = a.dur - 0.12, u = clamp((a.t - it.dl) / D, 0, 1);
      const e1 = ease(clamp(u / 0.72, 0, 1)), x = it.x0 + (it.tx - it.x0) * e1, y = it.y0 + (it.ty - it.y0) * e1;
      const bounce = (s, t, hh) => (u > s && u < t ? hh * 4 * ((u - s) / (t - s)) * (1 - (u - s) / (t - s)) : 0);
      let zz = u < 0.72 ? 230 * 4 * (u / 0.72) * (1 - u / 0.72) : bounce(0.72, 0.88, 26) + bounce(0.88, 1, 8);
      if (calm) zz = 0;
      const rotA = it.r0 + (it.r1 - it.r0) * (1 - (1 - u) * (1 - u)), face = u < 0.85 ? (Math.floor(a.t * 16) + it.face0 + i) % 4 : rd.faces[i];
      drawBone(ctx, face, x, y, rotA, 0.7 + 0.3 * (u < 0.72 ? 0.7 + 0.3 * Math.sin(Math.PI * u / 0.72) : 1) * 1, zz);
      return;
    }
    // resting on the mat (a held bone during a re-toss simply stays where it is)
    const held = rd.hold[i] && (ph === 'decide' || ph === 'aithink' || ph === 'aiact' || ph === 'apreveal' || ph === 'toss');
    const lift = held && !a ? (calm ? 14 : 14 + Math.sin(T0 * 4 + i) * 2) : 0;
    drawBone(ctx, rd.faces[i], sp.x + pose.dx, sp.y + pose.dy, pose.rot, 1, lift, { hold: held && !a });
    if (!a) {
      const lx = sp.x + pose.dx, ly = sp.y + 66;
      ctx.save(); ctx.font = `600 21px ${DISPLAY}`; const t = `${FACE_NAMES[rd.faces[i]]} ${FACE_VALUE[rd.faces[i]]}`, tw = ctx.measureText(t).width + 18;
      ctx.fillStyle = 'rgba(8,20,48,0.78)'; ctx.beginPath(); ctx.roundRect(lx - tw / 2, ly - 18, tw, 28, 14); ctx.fill(); ctx.restore();
      R.text(t, lx, ly + 3, 21, '#fff4d6', DISPLAY, 600);
      if (held) { ctx.fillStyle = rd.hint ? '#7fd6a8' : '#ffd45a'; ctx.beginPath(); ctx.roundRect(sp.x + pose.dx - 34, sp.y - 76, 68, 26, 13); ctx.fill(); R.text(rd.hint ? 'KEEP' : 'HOLD', sp.x + pose.dx, sp.y - 57, 18, '#2a1b12', DISPLAY, 700); }
    }
  });
  // read-out above the bones
  if (rd.tossed && !rd.anim && ph !== 'gallop' && ph !== 'after' && ph !== 'won') {
    const sc = scoreOf(rd.faces), t = `${sc.total} strides${sc.bonus ? ' · ' + comboLabel(rd.faces) : ''}`;
    R.fit(t, 360, 1056, 560, 40, 30, 16, sc.bonus ? '#ffe27a' : '#fff4d6');
  } else if (yours) {
    const a = 0.5 + 0.5 * Math.sin(T0 * 5);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(16,34,72,0.94)'; ctx.beginPath(); ctx.roundRect(110, 1228, 500, 52, 26); ctx.fill(); ctx.restore();
    ctx.strokeStyle = `rgba(255,224,130,${0.6 + 0.4 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(110, 1228, 500, 52, 26); ctx.stroke();
    R.text('TAP or SWIPE UP to toss', 360, 1263, 26, '#fff4d6', DISPLAY, 600);
    ctx.strokeStyle = `rgba(255,236,170,${0.4 + 0.5 * a})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cy = 1098 - a * 8; ctx.beginPath(); ctx.moveTo(340, cy + 9); ctx.lineTo(360, cy - 3); ctx.lineTo(380, cy + 9); ctx.stroke();
  }
  void TRAY;
}

function drawParticles(ctx, state) {
  for (const p of state.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.col;
    if (p.rect) { ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillRect(-p.sz, -p.sz * 0.6, p.sz * 2, p.sz * 1.2); } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (0.4 + 0.6 * a), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}
function drawPops(ctx, state, R) {
  for (const p of state.pops) {
    const a = clamp(1 - Math.max(0, p.t - 0.9) / 0.6, 0, 1), up = ease(clamp(p.t / 0.5, 0, 1)) * 22;
    ctx.save(); ctx.globalAlpha = a; ctx.font = `700 26px ${DISPLAY}`; const w = ctx.measureText(p.text).width + 28, x = clamp(p.x, w / 2 + 8, W - w / 2 - 8), y = p.y - up;
    ctx.fillStyle = 'rgba(16,34,72,0.92)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 26, w, 38, 19); ctx.fill(); ctx.strokeStyle = '#f0c24a'; ctx.lineWidth = 2.5; ctx.stroke();
    R.text(p.text, x, y + 2, 26, p.color, DISPLAY, 700); ctx.restore();
  }
}

function drawPausedBanner(ctx, R) {
  scrim(ctx, 0.35);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.fillStyle = 'rgba(16,34,72,0.96)'; ctx.beginPath(); ctx.roundRect(150, 560, 420, 170, 28); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#f0c24a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(150, 560, 420, 170, 28); ctx.stroke();
  R.text('Paused', 360, 650, 72, '#ffe27a', DISPLAY, 700);
  R.text('Everything is frozen. TAP Resume.', 360, 700, 24, '#fff4d6', DISPLAY, 500);
}

// ---- panels and stacks ------------------------------------------------------------------------------------------------------
function fitTitle(ctx, R, str, y, size) {
  let s = size; ctx.font = `700 ${s}px ${DISPLAY}`;
  while (s > 28 && ctx.measureText(str).width > PANEL.w - 140) { s -= 2; ctx.font = `700 ${s}px ${DISPLAY}`; }
  R.text(str, 360, y, s, ACC, DISPLAY, 700);
}
function drawPanelScene(ctx, state, R, z) {
  const sc = state.scene;
  drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  if (sc === 'how' || sc === 'about' || sc === 'rules') { drawReader(ctx, state, R, z); return; }
  const lay = screenLayout(state);
  fitTitle(ctx, R, lay.st.title, 206, 62);
  drawStackBody(ctx, state, R, lay, z);
}
function drawStack(ctx, state, R, z) {
  const lay = screenLayout(state), c = lay.st.card;
  if (c) { drawPanel(ctx, c.x, c.y, c.w, c.h); if (c.title) R.text(c.title, 360, c.y + 98, 52, ACC, DISPLAY, 700); }
  drawStackBody(ctx, state, R, lay, z);
}
function drawStackBody(ctx, state, R, lay) {
  const reg = lay.region;
  ctx.save(); ctx.beginPath(); ctx.rect(reg.x - 14, reg.y - 4, reg.w + 28, reg.h + 8); ctx.clip();
  for (const n of lay.nodes) {
    if (n.y + n.h < reg.y - 4 || n.y > reg.y + reg.h + 4) continue;
    if (n.k === 'text') {
      const x = n.align === 'left' ? n.x : n.x + n.w / 2;
      n.lines.forEach((ln, i) => R.text(ln, x, n.y + i * n.lh + n.size * 0.95, n.size, n.color, DISPLAY, n.weight ?? 600, n.align === 'left' ? 'left' : 'center'));
    } else if (n.k === 'btn') R.button(n);
    else if (n.k === 'art') drawStackArt(ctx, state, R, n);
  }
  ctx.restore();
  if (lay.maxScroll > 0) { // a slim scroll thumb
    const th = Math.max(40, reg.h * reg.h / lay.total), ty = reg.y + (reg.h - th) * (lay.scroll / lay.maxScroll);
    ctx.fillStyle = 'rgba(40,30,60,0.35)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 6, reg.y, 6, reg.h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(214,150,30,0.95)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 6, ty, 6, th, 3); ctx.fill();
    if (lay.scroll < lay.maxScroll - 4) R.text('drag to scroll', reg.x + reg.w / 2, reg.y + reg.h - 4, 18, 'rgba(60,40,30,0.7)', DISPLAY, 500);
  }
  for (const f of lay.footer) R.button(f);
}
function drawStackArt(ctx, state, R, n) {
  const g = state.g, T0 = state.t;
  if (n.name === 'winner') { const w = state.over.winner; drawToken(ctx, w % 4, n.x + n.w / 2, n.y + n.h - 14, 2.4, Math.abs(Math.sin(T0 * 3)) * 22); }
  else if (n.name === 'rank') {
    const r = n.r, p = g.riders[r.pl], cy = n.y + n.h / 2;
    ctx.fillStyle = RIDER[r.pl]; ctx.beginPath(); ctx.arc(n.x + 24, cy, Math.min(20, n.h * 0.38), 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    R.text(String(r.pl + 1), n.x + 24, cy + 7, Math.min(22, Math.round(n.h * 0.4)), '#fff', DISPLAY, 700);
    R.text(`${n.rank + 1}.  ${p.name}`, n.x + 56, cy + 9, Math.min(32, Math.round(n.h * 0.5)), INK, DISPLAY, 600, 'left');
    R.text(r.pos >= FINISH ? 'Finished' : `Station ${r.pos}`, n.x + n.w - 8, cy + 9, Math.min(26, Math.round(n.h * 0.42)), ACC, DISPLAY, 500, 'right');
  } else if (n.name === 'bones4') { for (let i = 0; i < 4; i++) drawBone(ctx, i, n.x + n.w / 2 - 195 + i * 130, n.y + n.h * 0.5, (i % 2 ? 0.2 : -0.18), 0.8, 0); }
}

// ---- reader pages ---------------------------------------------------------------------------------------------------------------
function drawReader(ctx, state, R, z) {
  const sc = state.scene, pages = readerPages(sc, z), idx = clamp(readerIndex(state), 0, pages.length - 1), pg = pages[idx];
  const head = pg.parts > 1 ? `${pg.h} (${pg.part}/${pg.parts})` : pg.h;
  fitTitle(ctx, R, head, 206, Math.round(58 * Math.min(1.25, z)));
  let y = BODY.y;
  if (pg.art) { drawRulesArt(ctx, pg.art, 360, BODY.y + ART_H / 2 - 4, state.t); y += ART_H + Math.round(pg.size * 0.3); }
  pg.lines.forEach((ln) => { y += ln.gap; R.text(ln.str, BODY.x, y + pg.size * 0.95, pg.size, '#2a1b12', DISPLAY, 500, 'left'); y += pg.lh; });
  R.text(`Page ${idx + 1} of ${pages.length}`, 360, 1236, 22, ACC, DISPLAY, 600);
  R.text(`Text ${Math.round(z * 100)}%`, 360, 1297, 28, '#2a1b12', DISPLAY, 600);
  for (const b of screenButtons(state)) R.button(b);
}

function cap(ctx, str, x, y, size = 20, col = ACC) { ctx.textAlign = 'center'; ctx.font = `500 ${size}px ${DISPLAY}`; ctx.fillStyle = col; ctx.fillText(str, x, y); }
// the game's own bones, tokens and trail, in isolation, for the Rules and How to Play pages
function drawRulesArt(ctx, kind, cx, cy, T0) {
  const row = (faces, k, opts = {}) => faces.forEach((f, i) => { const x = cx + (i - (faces.length - 1) / 2) * 128; drawBone(ctx, f, x, cy - 6 - (opts.hold?.[i] ? 14 : 0), (i % 2 ? 0.16 : -0.14), k, 0, { hold: !!opts.hold?.[i] }); if (opts.caps) cap(ctx, opts.caps[i], x, cy + 56, 19); });
  if (kind === 'faces') row([0, 1, 2, 3], 0.7, { caps: FACE_NAMES.map((n, f) => `${n} ${FACE_VALUE[f]} · ${FACE_WEIGHT[f]}%`) });
  else if (kind === 'hold') { row([0, 0, 2, 3], 0.7, { hold: [true, true, false, false], caps: ['hold', 'hold', 'toss again', 'toss again'] }); }
  else if (kind === 'pair') { row([2, 2], 0.8); cap(ctx, 'Two of a kind: a bonus on top of the strides', cx, cy + 66, 20); }
  else if (kind === 'tiles') {
    ['wind', 'burrow', 'stream', 'camp'].forEach((k, i) => { const x = cx + (i - 1.5) * 128; drawTileIcon(ctx, k, x, cy - 14, 1.5); cap(ctx, TILE_NAMES[k], x, cy + 48, 18); });
  } else if (kind === 'bump') {
    const x1 = cx - 130, x2 = cx + 70, y = cy - 6;
    ctx.strokeStyle = 'rgba(140,100,50,0.9)'; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 230, y + 10); ctx.lineTo(cx + 230, y + 10); ctx.stroke();
    ctx.strokeStyle = '#dcc58c'; ctx.lineWidth = 28; ctx.beginPath(); ctx.moveTo(cx - 230, y + 10); ctx.lineTo(cx + 230, y + 10); ctx.stroke();
    drawToken(ctx, 0, x1, y + 16, 1.3, 0); drawToken(ctx, 1, x2, y + 16, 1.3, 0);
    ctx.strokeStyle = ACC; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x1 + 36, y - 34); ctx.lineTo(x2 - 40, y - 34); ctx.moveTo(x2 - 58, y - 48); ctx.lineTo(x2 - 38, y - 34); ctx.lineTo(x2 - 58, y - 20); ctx.stroke();
    cap(ctx, 'End on a rival: it is flicked back 2', cx, cy + 66, 20);
  } else if (kind === 'trail') {
    ctx.strokeStyle = 'rgba(140,100,50,0.9)'; ctx.lineWidth = 40; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 240, cy); ctx.lineTo(cx + 240, cy); ctx.stroke();
    ctx.strokeStyle = '#dcc58c'; ctx.lineWidth = 32; ctx.beginPath(); ctx.moveTo(cx - 240, cy); ctx.lineTo(cx + 240, cy); ctx.stroke();
    ctx.fillStyle = '#fff8e6'; ctx.fillRect(cx - 238, cy - 24, 8, 48);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#1c1410' : '#fff8e6'; ctx.fillRect(cx + 222 + c * 9, cy - 26 + r * 10.4, 9, 10.4); }
    for (let i = 0; i < 4; i++) drawToken(ctx, i, cx - 170 + i * 74 + (i % 2) * 18, cy + 14 + (i % 2) * 6, 1, 0);
    cap(ctx, 'Start', cx - 234, cy + 58, 19); cap(ctx, `Finish: station ${FINISH}`, cx + 190, cy + 58, 19);
  }
  void T0;
}

// ---- title ---------------------------------------------------------------------------------------------------------------------
function drawTitle(ctx, state, R) {
  const T0 = state.t;
  drawTokens(ctx, { ...state, gal: null, fly: [] }, TITLE_G, false);
  const lab = (str, x, y, size) => { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(60,35,10,0.8)'; ctx.font = `700 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.strokeText(str, x, y); ctx.fillStyle = '#fff8e6'; ctx.fillText(str, x, y); ctx.restore(); };
  lab('START', stationXY(0).x - 34 + 24, stationXY(0).y + 66, 17); lab('FINISH', stationXY(FINISH).x - 24, stationXY(FINISH).y + 52, 18);
  // title on the sky
  ctx.save(); ctx.shadowColor = 'rgba(255,200,80,0.7)'; ctx.shadowBlur = 30 + 8 * Math.sin(T0 * 2);
  R.text('Shagai', 360, 150, 128, '#fff4d6', DISPLAY, 700); ctx.restore();
  R.glowText('The ankle-bone race', 360, 252, 38, '#fff4d6');
  // the four sides, floating over the menu plate
  [0, 1, 2, 3].forEach((f, i) => drawBone(ctx, f, 360 + (i - 1.5) * 128, 944 + Math.sin(T0 * 2 + i * 1.3) * 4, (i % 2 ? 0.2 : -0.16), 0.62, 6));
  // menu plate
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6; ctx.fillStyle = 'rgba(14,30,66,0.95)'; ctx.beginPath(); ctx.roundRect(36, 1004, 648, 400, 24); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#f0c24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(36, 1004, 648, 400, 24); ctx.stroke();
  const lay = screenLayout(state), reg = lay.region;
  ctx.save(); ctx.beginPath(); ctx.rect(reg.x - 14, reg.y - 4, reg.w + 28, reg.h + 8); ctx.clip();
  for (const n of lay.nodes) if (n.k === 'btn') R.button(n);
  ctx.restore();
  if (lay.maxScroll > 0) { const th = Math.max(40, reg.h * reg.h / lay.total), ty = reg.y + (reg.h - th) * (lay.scroll / lay.maxScroll); ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 8, ty, 6, th, 3); ctx.fill(); }
  const s = state.stats; R.text(s.played ? `${s.played} races · ${s.wins} won` : (state.demo ? 'Free web preview' : 'Free preview: 90 seconds of play'), 360, 1448, 22, '#f1d79a', DISPLAY, 500);
}

// ---- end screen --------------------------------------------------------------------------------------------------------------
function drawOver(ctx, state, R, z) {
  const o = state.over; if (!o) return;
  const T0 = state.t;
  scrim(ctx, 0.66);
  for (let i = 0; i < 46; i++) {
    const r = lcg(i * 7919 + 3), x = r() * W, sp = 60 + r() * 120, y = ((T0 * sp + r() * H) % (H + 40)) - 20, rotA = T0 * (1 + r() * 2) + i;
    ctx.save(); ctx.translate(x + Math.sin(T0 + i) * 20, y); ctx.rotate(rotA); ctx.fillStyle = RIDER[i % 4]; ctx.globalAlpha = 0.85; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  }
  drawStack(ctx, state, R, z);
}
void RIDER_DARK; void FACE_COL; void ranking;
