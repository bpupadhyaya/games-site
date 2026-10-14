// Every screen that is not the play screen: title, setup, settings, result, pause, and the scrolling About / How to play /
// Rules reader with its illustrations (drawn with the game's own riders). Pure drawing; game.js owns state. Every position
// comes from the live layout L (layout.js).
import { STAGES, buildCourse } from './course.js';
import { TEAMS, FIELDS, TYPES, SLOTS } from './sim.js';
import { drawBackdrop, drawHillside, SKINS, TONES } from './art.js';
import { drawPack } from './pack3d.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawLockup, drawMoreLine } from './brand.js';

const stars = (n, of = 3) => '★'.repeat(n) + '☆'.repeat(of - n);

// menu animation clock (set from the screen backdrop each frame; the 3D riders in the how-to pictures pedal with it)
const ART = { t: 0 };

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

// ---- the animated backdrop behind menus: a small peloton on a highland road --------------------------------------
export function drawAttract(ctx, L, t, tone = 'morning', bright = 1) {
  const w = L.w, h = L.h, unit = Math.max(0.8, Math.min(1.4, Math.min(w, h) / 720));
  const rc = { x: 0, y: 0, w, h };
  const f3 = globalThis.__riders3d;
  if (f3 && f3.drawWorld && !f3.lost && !f3.stage.contextLost) {
    // the same 3D road world as the race: a small peloton rolling through the highlands behind the menu
    ctx.save(); drawBackdrop(ctx, rc, tone, 0, 0, unit, true); ctx.restore();
    const LN = [0, 2, 1, 3, 2, 0, 1, 3, 2], XR = [-2.2, -0.4, 1.7, -4.6, 3.8, 5.6, 0.9, -6.9, 2.9];
    const riders = LN.map((ln, i) => { const tm = TEAMS[i % 6]; return { id: i, s: 0, xr: XR[i] + Math.sin(t * 0.5 + i) * 0.15, v: 10.5 + (i % 3) * 0.2, lane: [-1.7, -0.85, 0, 0.85, 1.7][ln], pose: i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0,
      effort: 0.35, sweat: i % 4 === 0 ? 0.8 : 0, jersey: tm.jersey, trim: tm.trim, helmet: tm.helmet, skin: SKINS[i % 4], num: 11 + i * 7, frame: tm.jersey, lookKey: `a${i}`, mine: false }; });
    const course = { index: 7, L: 12000, hairpins: [], landAt: (s) => (s % 3000 < 1500 ? 'farm' : 'valley') };
    const k = Math.min(w / 5.2, h * 0.22);
    const res = f3.drawWorld(ctx, rc, { k, fx: w * 0.5, yG: h * 0.86, camS: 2000 + t * 100, sw: 0.1, simRate: 10, tilt: 0.04, tone, t, course, riders, specs: [] });
    if (res) { if (bright < 1) { ctx.fillStyle = `rgba(4,8,26,${1 - bright})`; ctx.fillRect(0, 0, w, h); } return; }
  }
  const hor = h * 0.42, camS = t * 24;
  drawBackdrop(ctx, rc, tone, camS, hor, unit);
  drawHillside(ctx, rc, tone, camS, hor + 36 * unit, unit, 0.18, 0.9);
  const T = TONES[tone];
  const gg = ctx.createLinearGradient(0, h * 0.55, 0, h); gg.addColorStop(0, T.ground[0]); gg.addColorStop(1, T.ground[1]);
  const y0 = h * 0.8, tilt = 0.12, tt = Math.tan(tilt), fx = w * 0.5;
  const yR = (x) => y0 - (x - fx) * tt;
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, yR(0) + 20 * unit); ctx.lineTo(w, yR(w) + 20 * unit); ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = gg; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, yR(0)); ctx.lineTo(w, yR(w)); ctx.lineTo(w, yR(w) + 44 * unit); ctx.lineTo(0, yR(0) + 44 * unit); ctx.closePath(); ctx.fillStyle = T.road; ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,140,0.7)'; ctx.lineWidth = 3 * unit; ctx.setLineDash([24 * unit, 28 * unit]); ctx.lineDashOffset = (camS * 2.6 * unit) % (52 * unit);
  ctx.beginPath(); ctx.moveTo(0, yR(0) + 22 * unit); ctx.lineTo(w, yR(w) + 22 * unit); ctx.stroke(); ctx.setLineDash([]);
  const k = 74 * unit, pack = [];
  for (let i = 0; i < 9; i++) {
    const row = i % 3, x = fx + (-190 + i * 78 + Math.sin(t * 0.7 + i) * 8) * unit - ((i % 2) * 18) * unit;
    const tm = TEAMS[i % 6];
    pack.push({ x, y: yR(x) + (14 + row * 11) * unit, row, tilt: tilt * 0.9, phase: t * 7 + i, spin: t * 9 + i, pose: i % 4 === 0 ? 2 : 1, jersey: tm.jersey, trim: tm.trim, helmet: tm.helmet, skin: SKINS[i % 4] });
  }
  drawPack(ctx, rc, pack, k, t, tone);
  if (bright < 1) { ctx.fillStyle = `rgba(4,8,26,${1 - bright})`; ctx.fillRect(0, 0, w, h); }
}

const heroArt = (h = 500) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    const word = (t, y, size, fill, lw = 14) => { ctx.font = `900 ${size}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(8,12,34,0.92)'; ctx.strokeText(t, cx, y); ctx.fillStyle = fill; ctx.fillText(t, cx, y); };
    word('Asmara', 118, 108, '#fff2cf');
    word('HIGHLAND ROAD RACE', 188, 46, '#ffb53a', 12);
    ctx.font = `600 22px ${FONT}`; textShadow(ctx, 'PACE  ·  DRAFT  ·  ATTACK', cx, 232, '#f6ecd0', 6);
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false) {
  const sound = state.settings.sound;
  const wd = [heroArt(compact ? 250 : 270)];
  wd.push({ t: 'btn', id: 'race', label: 'Race a stage', primary: true, h: compact ? 80 : 92 });
  wd.push({ t: 'btn', id: 'tt', label: 'Time Trial', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', dark: true });
  return wd;
}

// setup widget groups: head, stages, fields, note
export function setupParts(state, wide) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const title = s.mode === 'tt' ? 'Time Trial' : s.mode === 'watch' ? 'Watch & Learn' : 'Race a stage';
  const head = wide ? [] : [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 48 }];
  const stagesW = [{ t: 'p', label: 'Choose the stage', bold: true, color: '#f4ecd0', size: 26 }];
  STAGES.forEach((st, i) => {
    const c = buildCourse(i), locked = demo && i > 0;
    const sc = s.mode === 'tt' ? (rec.tt ?? {})[i] ?? 0 : (rec.stars ?? {})[i] ?? 0;
    const up = Math.round(c.altAt(c.L) - c.altAt(0));
    stagesW.push({ t: 'btn', id: `stg${i}`, label: st.name, sub: locked ? 'In the full game' : `${(c.L / 1000).toFixed(1)} km · ${up >= 0 ? '+' : ''}${up} m  ${sc ? stars(sc) : ''}`.trim(), active: s.stage === i && !locked, disabled: locked, hitDisabled: true, h: wide ? 84 : 92 });
  });
  const fields = [];
  if (s.mode !== 'tt') {
    fields.push({ t: 'p', label: 'Choose the field', bold: true, color: '#f4ecd0', size: 26 });
    FIELDS.forEach((f, i) => {
      const locked = demo && i > 1;
      fields.push({ t: 'btn', id: `fld${i}`, label: f.name, sub: locked ? 'In the full game' : f.sub, active: s.field === i && !locked, disabled: locked, hitDisabled: true, ...(wide ? { h: 84 } : {}) });
    });
  } else {
    fields.push({ t: 'p', label: 'Choose your rider', bold: true, color: '#f4ecd0', size: 26 });
    SLOTS.forEach((sl, i) => fields.push({ t: 'btn', id: `rd${i}`, label: TYPES[sl].label, sub: TYPES[sl].blurb, active: s.rider === i, ...(wide ? { h: 84 } : {}) }));
    fields.push({ t: 'p', label: 'You against a ghost that spends its reserve evenly. Gold beats its time; silver is within 2%, bronze within 5%.', size: 22, color: 'rgba(244,236,208,0.85)' });
  }
  const note = [{ t: 'p', label: STAGES[s.stage].blurb, size: 22, color: 'rgba(244,236,208,0.85)' }];
  return { head, stages: stagesW, fields, note };
}
export function setupWidgets(state) {
  const p = setupParts(state, false);
  return [...p.head, ...p.stages, { t: 'gap', h: 6 }, ...p.fields, { t: 'gap', h: 6 }, ...p.note, { t: 'gap', h: 24 }];
}

export function settingsParts(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const a = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#f4ecd0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

const trophyArt = (good, h) => ({
  t: 'art', h,
  draw(ctx, w, hh) {
    const cx = w / 2, cy = hh * 0.52;
    const hr = Math.min(180, hh * 0.5), halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, hr); halo.addColorStop(0, good ? 'rgba(255,214,90,0.5)' : 'rgba(255,255,255,0.14)'); halo.addColorStop(1, good ? 'rgba(255,214,90,0)' : 'rgba(255,255,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(cx - 220, 0, 440, hh);
    const k = Math.min(70, hh * 0.3);
    drawPack(ctx, { x: 0, y: 0, w, h: hh }, [{ x: cx, y: hh - 20, tilt: 0, phase: 0.4 + ART.t * (good ? 6 : 3), spin: ART.t * 3, pose: good ? 2 : 0, jersey: TEAMS[0].jersey, trim: TEAMS[0].trim, helmet: TEAMS[0].helmet, skin: SKINS[0] }], k * 1.3, ART.t);
  },
});

export function resultParts(state, wide) {
  const rs = state.result, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const words = [{ t: 'gap', h: wide ? 6 : big ? 24 : 30 }, ...(wide || big ? [] : [trophyArt(rs.stars > 0, 230)])];
  words.push({ t: 'h', label: rs.title, size: 58, cap: big ? 1.2 : 1.5 });
  words.push({ t: 'h', label: rs.mode === 'tt' ? ['No medal', 'Bronze', 'Silver', 'Gold'][rs.stars] : stars(rs.stars), size: 74, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  words.push({ t: 'p', label: rs.line1, size: 26, cap: big ? 2 : 3 });
  if (rs.line2 && !big) words.push({ t: 'p', label: rs.line2, size: 24, cap: 2, color: '#f4ecd0' });
  const btns = [{ t: 'gap', h: wide ? 0 : 20 }];
  if (rs.next) btns.push({ t: 'btn', id: 'next', label: 'Next stage', primary: true, h: 92 }, { t: 'btn', id: 'again', label: 'Race again', row: 6 }, { t: 'btn', id: 'sheet', label: 'Race order', row: 6 });
  else btns.push({ t: 'btn', id: 'again', label: 'Race again', primary: true, h: 92 }, { t: 'btn', id: 'sheet', label: 'Race order', row: 6 }, { t: 'btn', id: 'new', label: 'Other stage', row: 6 });
  btns.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  return { words, btns };
}
export function resultWidgets(state) { const p = resultParts(state, false); return [...p.words, ...p.btns, { t: 'gap', h: 30 }]; }

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-order', label: 'Race order' },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets(wide) {
  return [
    { t: 'gap', h: wide ? 40 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have raced the free stage of the web demo. The full game on iPhone and Android has all six stages, every field strength, the time trial and unlimited races.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const wd = titleWidgets(state, !L.wide && L.sb < 1100);
    const strip = lockSize(L).strip;
    if (!L.wide) { const off = Math.round(Math.max(0, L.sb - 1280) * 0.35); return one(wd, 640, Math.max(off, I.t), L.sb - strip); }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), cols = L.setup.cols;
    return [{ widgets: p.stages, ...cols[0] }, { widgets: [...p.fields, { t: 'gap', h: 8 }, ...p.note], ...cols[1] }];
  }
  if (key === 'settings') {
    if (!L.wide) return one(settingsWidgets(state));
    const p = settingsParts(state), cw = Math.min(520, w / 2 - 30 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: p.a, x: w / 2 - cw - 14, w: cw, top, bottom: bot, center: true }, { widgets: [{ t: 'gap', h: 58 }, ...p.b], x: w / 2 + 14, w: cw, top, bottom: bot, center: true }];
  }
  if (key === 'demolimit') return one(demoLimitWidgets(L.wide));
  if (key === 'result') {
    if (!L.wide) return one(resultWidgets(state));
    const p = resultParts(state, true), cw = Math.min(480, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 40;
    return [{ widgets: p.words, x: w / 4 - cw / 2, w: cw, top, bottom: bot, center: true }, { widgets: p.btns, x: (3 * w) / 4 - Math.min(440, cw) / 2, w: Math.min(440, cw), top, bottom: bot, center: true }];
  }
  return [];
}

function layColumns(ctx, state, key, L) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cols = screenCols(state, key, L).map((c) => ({ ...c, lay: flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w }) }));
  let max = 0;
  for (const c of cols) { c.off = c.center ? Math.max(0, (c.bottom - c.top - c.lay.contentH) / 2) + (c.shift ?? 0) : 0; max = Math.max(max, c.lay.contentH - (c.bottom - c.top)); }
  const out = { key, size: L.key, cols, max: Math.max(0, max) };
  if (key === 'title') {
    const ls = lockSize(L), bc = cols[cols.length - 1], used = bc.top + bc.off + bc.lay.contentH, cx = L.wide ? (3 * L.w) / 4 : L.w / 2;
    const pinned = L.sb - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    out.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return out;
}
export function ensureLayout(state, key, L) {
  if (LAID.key === key && LAID.size === L.key && LAID.cols.length) return;
  if (!['title', 'setup', 'settings', 'result', 'demolimit'].includes(key)) return;
  LAID = { ...layColumns(estCtx, state, key, L), est: true };
}
export function hitScreen(x, y, scroll) {
  { const t = LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  for (const c of LAID.cols) {
    const id = flowHit(c.lay, c.top + c.off, Math.min(scroll, Math.max(0, c.lay.contentH - (c.bottom - c.top))), x, y);
    if (id && y >= c.top && y <= c.bottom) return id;
  }
  return null;
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function flowRects(scroll) {
  const out = [];
  for (const c of LAID.cols) {
    const sc = Math.min(scroll, Math.max(0, c.lay.contentH - (c.bottom - c.top)));
    for (const it of c.lay.items) if (it.w.t === 'btn') out.push({ id: it.w.id, x: it.x, y: c.top + c.off + it.y - sc, w: it.wd, h: it.h, clip: { top: c.top, bottom: c.bottom } });
  }
  return out;
}

function scrim(ctx, L, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(4,8,26,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,8,26,${a})`); g.addColorStop(1, `rgba(4,8,26,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,8,26,0)'); g.addColorStop(1, 'rgba(4,8,26,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(244,236,208,0.9)'; ctx.fill();
    ctx.fillStyle = '#16213a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(244,236,208,0.9)'; ctx.fill();
    ctx.fillStyle = '#16213a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key, L) {
  LAID = layColumns(ctx, state, key, L);
  const scroll = Math.min(state.ui.scroll, LAID.max);
  for (const c of LAID.cols) {
    const range = Math.max(0, c.lay.contentH - (c.bottom - c.top)), sc = Math.min(scroll, range), top = c.top + c.off;
    drawFlow(ctx, c.lay, top, c.bottom, sc, { clipX: c.x - 24, clipW: c.w + 48 });
    if (range > 0) {
      const th = Math.max(60, (c.bottom - c.top) * ((c.bottom - c.top) / c.lay.contentH)), ty = c.top + (sc / range) * (c.bottom - c.top - th);
      roundPath(ctx, c.x + c.w + 6, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,248,224,0.5)'; ctx.fill();
      scrollHint(ctx, c.top, c.bottom, sc, range, c.x, c.w);
    }
  }
  return { scroll, max: LAID.max };
}

const backdrop = (ctx, state, L, bright = 1) => (ART.t = state.t, drawAttract(ctx, L, state.t, ['morning', 'dawn', 'noon'][Math.floor(state.t / 40) % 3], bright));

export function renderTitle(ctx, state, L) {
  backdrop(ctx, state, L);
  scrim(ctx, L, 0.3);
  const vx = L.wide ? L.w / 4 : L.w / 2, vy = L.wide ? L.h / 2 : 190 + Math.round(Math.max(0, L.sb - 1280) * 0.35);
  const g = ctx.createRadialGradient(vx, vy, 40, vx, vy, 440);
  g.addColorStop(0, 'rgba(4,8,26,0.55)'); g.addColorStop(1, 'rgba(4,8,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  if (L.wide) {
    const c = screenCols(state, 'title', L)[1], gx = ctx.createLinearGradient(c.x - 60, 0, c.x + c.w + 60, 0);
    gx.addColorStop(0, 'rgba(4,8,26,0)'); gx.addColorStop(0.25, 'rgba(4,8,26,0.45)'); gx.addColorStop(1, 'rgba(4,8,26,0.5)');
    ctx.fillStyle = gx; ctx.fillRect(c.x - 60, 0, L.w - c.x + 60, L.h);
  }
  drawFlowScreen(ctx, state, 'title', L);
  if (LAID.lock) {
    const k = LAID.lock, dn = !!(state.ui.drag && state.ui.drag.x0 >= k.tap.x && state.ui.drag.x0 <= k.tap.x + k.tap.w && state.ui.drag.y0 >= k.tap.y && state.ui.drag.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(4,8,26,0.66)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(244,236,208,0.6)';
  if (state.demo) ctx.fillText('Web demo', L.wide ? (3 * L.w) / 4 : L.w / 2, L.sb - 4);
}

export function renderSetup(ctx, state, L) {
  backdrop(ctx, state, L, 0.6);
  scrim(ctx, L, 0.62);
  drawFlowScreen(ctx, state, 'setup', L);
  if (!L.wide) {
    const y0 = L.pins.start.y - 56, g = ctx.createLinearGradient(0, y0, 0, L.h);
    g.addColorStop(0, 'rgba(4,8,26,0)'); g.addColorStop(0.2, 'rgba(4,8,26,0.85)'); g.addColorStop(1, 'rgba(4,8,26,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, L.w, L.h - y0);
  }
  drawButton(ctx, L.pins.start, 'Start the race', { primary: true, size: L.wide ? 28 : 32 });
  drawButton(ctx, L.pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) {
    ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0';
    const mx = L.wide ? L.pins.start.x + (L.pins.back.x + L.pins.back.w - L.pins.start.x) / 2 : L.w / 2;
    ctx.fillText(state.setupMsg, mx, L.pins.start.y - (L.wide ? 20 : 16));
  }
}
export function renderSettings(ctx, state, L) { backdrop(ctx, state, L, 0.5); scrim(ctx, L, 0.7); drawFlowScreen(ctx, state, 'settings', L); }
export function renderDemoLimit(ctx, state, L) { backdrop(ctx, state, L, 0.5); scrim(ctx, L, 0.72); drawFlowScreen(ctx, state, 'demolimit', L); }
export function renderResult(ctx, state, L) {
  backdrop(ctx, state, L, 0.6);
  scrim(ctx, L, 0.62);
  drawFlowScreen(ctx, state, 'result', L);
  const cols = LAID.cols, bcol = cols[cols.length - 1];
  const maxScroll = Math.max(0, bcol.lay.contentH - (bcol.bottom - bcol.top));
  const y = L.wide ? Math.min(L.sb - 12, bcol.top + bcol.off + bcol.lay.contentH + 44) : L.sb - 22;
  if (maxScroll === 0 || L.wide) drawMoreLine(ctx, L.wide ? bcol.x + bcol.w / 2 : L.w / 2, y, 18);
}
export function renderPause(ctx, state, L) {
  scrim(ctx, L, 0.58);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cardW = Math.min(660, L.w - 60 - 2 * Math.max(L.ins.l, L.ins.r)), cw = cardW - 60, cx = L.w / 2;
  const lay = flowLayout(ctx, wd, sc, { x: cx - cw / 2, w: cw });
  const top = Math.max(L.ins.t, 0) + (L.wide ? 20 : 70), bottom = L.sb - (L.wide ? 20 : 70);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (L.h - ch) / 2);
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 30, fill: 'rgba(12,20,48,0.95)', stroke: 'rgba(255,181,58,0.55)' });
  LAID = { key: 'pause', size: L.key, cols: [{ lay, x: cx - cw / 2, w: cw, top: y0, bottom: y0 + ch, off: 0 }], max: Math.max(0, lay.contentH - ch), est: false };
  const sc0 = Math.min(state.ui.scroll, LAID.max);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: cx - cardW / 2, clipW: cardW });
  scrollHint(ctx, y0, y0 + ch, sc0, LAID.max, cx - cardW / 2, cardW);
}

// ---- reference pages (one continuous scrolling reader) -----------------------------------------
export const REF = { max: 0, view: 400 };
export const pageCount = () => 1;

function buildFlow(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ t: 'rule', y }); y += 20; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ t: 'title', tl, y });
    y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale <= 2) { items.push({ t: 'art', art: sec.art, y }); y += 210; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ t: 'line', text: l, y }); y += lh; });
    });
    y += 26;
  });
  return { items, fs, lh, secFs, total: y + 10 };
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header, L) {
  backdrop(ctx, state, L, 0.5);
  scrim(ctx, L, 0.66);
  const PANEL = L.ref.panel;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,244,226,0.97)', stroke: 'rgba(40,50,90,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(40,50,90,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(40,50,90,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(40,50,90,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(40,50,90,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(40,50,90,0.7)';
  ctx.fillText(`text ${Math.round(sc * 100)}%`, pcx, PANEL.y + PANEL.h - 28);
  drawButton(ctx, L.ref.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, L.ref.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  drawButton(ctx, L.ref.back, 'Back', { size: 32 });
  drawButton(ctx, L.ref.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations: drawn with the real riders ----------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function sky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe0f4'); g.addColorStop(1, '#f6eed2');
  roundPath(ctx, 0, 0, w, h, 14); ctx.fillStyle = g; ctx.fill();
}
const PACK = [];
const rider = (ctx, x, y, k, i, o = {}) => { const tm = TEAMS[o.team ?? 0]; PACK.push({ x: x + 0.5 * k, y, tilt: o.ang ?? 0, phase: o.phase ?? i * 1.3 + ART.t * 4, spin: i + ART.t * 4, pose: o.pose ?? 0, jersey: tm.jersey, trim: tm.trim, helmet: tm.helmet, skin: SKINS[i % 4], row: 0, k }); };
const flushRiders = (ctx, w, h) => { if (!PACK.length) return; const k = PACK[0].k; drawPack(ctx, { x: 0, y: 0, w, h }, PACK.splice(0), k, ART.t); };

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    profile() {
      const c = buildCourse(1);
      sky(ctx, w, h);
      const n = 60, gy = 20, gh = h - 60;
      let lo = 1e9, hi = -1e9; const a = [];
      for (let i = 0; i <= n; i++) { const v = c.altAt((i / n) * c.L); a.push(v); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      for (let i = 0; i < n; i++) {
        const g = c.gradeAt(((i + 0.5) / n) * c.L), col = g > 0.065 ? '#e8503a' : g > 0.04 ? '#f0903a' : g > 0.015 ? '#e8c444' : g < -0.02 ? '#4d8fd8' : '#7fbf6a';
        const x0 = 16 + (i / n) * (w - 32), x1 = 16 + ((i + 1) / n) * (w - 32) + 0.6, y0 = gy + gh - ((a[i] - lo) / (hi - lo)) * (gh - 20), y1 = gy + gh - ((a[i + 1] - lo) / (hi - lo)) * (gh - 20);
        ctx.beginPath(); ctx.moveTo(x0, gy + gh); ctx.lineTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1, gy + gh); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      }
      label(ctx, 'flat', w * 0.14, h - 10, 17, '#2b6a1e'); label(ctx, 'climb', w * 0.4, h - 10, 17, '#a55a10'); label(ctx, 'steep', w * 0.67, h - 10, 17, '#a02a18'); label(ctx, 'descent', w * 0.9, h - 10, 17, '#235f9e');
    },
    effort() {
      sky(ctx, w, h);
      const names = ['EASE', 'SIT IN', 'PUSH', 'ATTACK'], poses = [0, 1, 1, 2], cols = ['#2fb5a8', '#4a8fe0', '#d98a1a', '#d63a2a'];
      names.forEach((nm, i) => {
        const cx = (w / 4) * (i + 0.5);
        ctx.fillStyle = '#6b6f78'; ctx.fillRect(cx - w * 0.11, h - 56, w * 0.22, 6);
        rider(ctx, cx - 36, h - 50, 46, i, { pose: poses[i] });
        label(ctx, nm, cx, h - 14, 20, cols[i]);
        ctx.fillStyle = cols[i]; ctx.fillRect(cx - 28, 20, 56 * (0.35 + 0.22 * i), 10);
      });
    },
    draft() {
      sky(ctx, w, h);
      ctx.fillStyle = '#5a5f6c'; ctx.fillRect(0, h - 60, w, 24);
      rider(ctx, w * 0.5, h - 64, 46, 2, { pose: 1, team: 1 });
      rider(ctx, w * 0.5 - 84, h - 64, 46, 0, { pose: 1 });
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(w * 0.5 + 40, h - 150 + i * 22); ctx.bezierCurveTo(w * 0.5 + 10, h - 150 + i * 22, w * 0.5 - 40, h - 100 + i * 14, w * 0.5 - 100, h - 110 + i * 14); ctx.stroke(); }
      ctx.setLineDash([]);
      label(ctx, 'wind', w * 0.5 + 60, h - 150, 18, '#38526e', 'left'); label(ctx, 'about a third less effort', w * 0.5 - 84, 34, 22, C.terra, 'center');
    },
    reserve() {
      sky(ctx, w, h);
      const bars = [['full', 1, '#46c46a'], ['spent', 0.45, '#f5b82e'], ['cracked', 0.0, '#ff4d4d']];
      bars.forEach(([nm, f, col], i) => {
        const yy = 28 + i * 54;
        roundPath(ctx, 24, yy, w - 48, 22, 11); ctx.fillStyle = 'rgba(20,30,50,0.2)'; ctx.fill();
        if (f > 0) { roundPath(ctx, 24, yy, Math.max(22, (w - 48) * f), 22, 11); ctx.fillStyle = col; ctx.fill(); }
        label(ctx, nm, 34, yy + 44, 18, C.ink, 'left');
      });
      label(ctx, 'below zero: only 80% power until it recovers', w - 24, h - 14, 17, C.terra, 'right');
    },
  };
  (A[key] ?? A.profile)();
  flushRiders(ctx, w, h);
  ctx.restore();
}
