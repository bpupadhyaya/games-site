// Every screen that is not the play screen: title, setup, settings, result, pause, demo limit and the scrolling
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state. Every position comes from
// the live layout L (layout.js).
import { drawScene } from './scene.js';
import { drawRider, drawRing, shade } from './art.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, embossText, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { ALL_COURSE_IDS, getCourse, medalTimes, MEDAL_NAMES, SURF, DIFFS, SKILLS } from './sim.js';

const TAU = Math.PI * 2;
const GOLD = '#ffd36a';
const ICE = '#e6f3fb';
export const fmtTime = (t) => { if (!(t >= 0)) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const medalStr = (m) => (m ? `${['', 'Bronze', 'Silver', 'Gold'][m]}` : '');
const ORD = ['1st', '2nd', '3rd', '4th'];

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

const heroArt = (h = 400) => ({
  t: 'art', h,
  draw(ctx, w, h) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    ctx.font = `italic 700 112px ${DISPLAY}`; embossText(ctx, 'Kicksled', cx, 114, { size: 112, top: '#ffffff', mid: '#e3eefb', bot: '#8fb0d4', side: '#2b4d73', depth: 8 });
    ctx.font = `italic 700 112px ${DISPLAY}`; embossText(ctx, 'Race', cx, 220, { size: 112, top: '#fff3c0', mid: '#ffcb4a', bot: '#c9780a', side: '#7a430a', depth: 8, glow: 'rgba(255,200,80,0.45)' });
    ctx.font = `600 24px ${FONT}`; textShadow(ctx, 'KICK  ·  GLIDE  ·  RACE THE SNOW', cx, 270, ICE, 6);
    drawRider(ctx, { x: cx - 30, y: h - 14, s: Math.max(36, Math.min(96, (h - 14 - 290) / 1.95)), ang: 0, p: 0.7, push: 0, side: 0, tuck: false, wobble: 0, hop: 0, v: 7, t: 1.2, jacket: '#2a8fd6', hat: '#d33b2f' });
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false, heroH = 0) {
  const sound = state.settings.sound;
  return [
    heroArt(heroH || (compact ? 400 : 480)),
    { t: 'btn', id: 'race', label: 'Race', sub: 'You and three rivals', primary: true, h: compact ? 84 : 96 },
    { t: 'btn', id: 'trial', label: 'Time Trial', row: 1 },
    { t: 'btn', id: 'cup', label: 'Cup', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 3 },
    { t: 'btn', id: 'about', label: 'About', row: 3 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 4 },
    { t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 },
  ];
}

export function setupParts(state, wide) {
  const s = state.setup, demo = state.demo, rec = state.record.courses ?? {};
  const title = s.mode === 'trial' ? 'Time Trial' : s.mode === 'cup' ? 'Cup' : 'Race';
  const head = wide ? [] : [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 48 }];
  const courses = [];
  if (s.mode !== 'cup') {
    courses.push({ t: 'p', label: 'Choose the course', bold: true, color: ICE, size: 26 });
    ALL_COURSE_IDS.forEach((id) => {
      const locked = demo && id !== 'town' && id !== 'lake';
      const c = getCourse(id, state.day);
      const r = rec[id];
      courses.push({ t: 'btn', id: `crs${id}`, label: c.name, sub: locked ? 'In the full game' : `${Math.round(c.len)} m${r && r.best ? ` · best ${fmtTime(r.best)}${r.medal ? ` · ${medalStr(r.medal)}` : ''}` : ''}`, active: s.course === id && !locked, disabled: locked, hitDisabled: true, h: wide ? 84 : 92 });
    });
  } else {
    courses.push({ t: 'p', label: 'The cup runs all four courses in order: 10, 6, 3 and 1 points for the first four places.', size: 26 });
  }
  const diffs = [];
  if (s.mode !== 'trial') {
    diffs.push({ t: 'p', label: 'Choose the rivals', bold: true, color: ICE, size: 26 });
    DIFFS.forEach((d, i) => {
      const locked = demo && i > 0;
      diffs.push({ t: 'btn', id: `dif${i}`, label: SKILLS[d].name, sub: locked ? 'In the full game' : ['Easy-going, a few slips', 'Good rhythm, rests well', 'Sharp timing, few mistakes'][i], active: s.diff === i && !locked, disabled: locked, hitDisabled: true, ...(wide ? { h: 88 } : {}) });
    });
  }
  return { head, courses, diffs };
}
export function setupWidgets(state) {
  const p = setupParts(state, false);
  return [...p.head, ...p.courses, ...p.diffs, { t: 'gap', h: 24 }];
}

export function settingsParts(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const a = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-names', label: st.names ? 'Rival names: On' : 'Rival names: Off', sub: 'Show names above the rivals' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: ICE, size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: ICE, size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: ICE }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

// a small podium of sleds for the result screen
const resultTable = (res, h) => ({
  t: 'art', h,
  draw(ctx, w, hh) {
    const rows = res.standings, n = rows.length, rh = hh / n;
    ctx.save(); ctx.textBaseline = 'middle';
    rows.forEach((row, i) => {
      const y = i * rh + rh / 2, bw = Math.min(w, 640), bx = (w - bw) / 2, bh = rh * 0.84;
      roundPath(ctx, bx, y - bh / 2, bw, bh, 14);
      ctx.fillStyle = row.human ? 'rgba(255,211,106,0.96)' : 'rgba(20,48,79,0.82)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = row.color; ctx.beginPath(); ctx.arc(bx + 48, y, Math.min(16, bh * 0.28), 0, TAU); ctx.fill();
      ctx.fillStyle = row.human ? '#241606' : '#f4fbff'; ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(Math.min(30, bh * 0.42))}px ${FONT}`; ctx.fillText(ORD[i] ?? `${i + 1}th`, bx + 14 + 56, y - 0);
      ctx.font = `700 ${Math.round(Math.min(28, bh * 0.4))}px ${FONT}`; ctx.fillText(row.name, bx + 14 + 56 + 76, y);
      ctx.textAlign = 'right'; ctx.font = `700 ${Math.round(Math.min(28, bh * 0.4))}px ${FONT}`;
      ctx.fillText(row.time != null ? fmtTime(row.time) : 'DNF', bx + bw - 16 - (res.cup ? 70 : 0), y);
      if (res.cup && row.pts != null) { ctx.fillStyle = row.human ? '#6b3d00' : GOLD; ctx.fillText(`+${row.pts}`, bx + bw - 16, y); }
    });
    ctx.restore();
  },
});

export function resultParts(state, wide) {
  const res = state.res, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const title = res.mode === 'trial' ? (res.newBest ? 'New best time!' : 'Run finished') : res.place === 0 ? 'You win!' : `You finish ${ORD[res.place]}`;
  const words = [{ t: 'gap', h: wide ? 6 : big ? 14 : 24 }, { t: 'h', label: title, size: 58, cap: big ? 1.15 : 1.5 }, { t: 'h', label: fmtTime(res.time), size: 78, cap: big ? 1.05 : 1.25, color: GOLD }];
  const bits = [];
  if (res.medal) bits.push(`${MEDAL_NAMES[res.medal]} medal`);
  if (res.newBest && res.mode !== 'trial') bits.push('new best time');
  bits.push(`${res.perfects} of ${res.kicks} kicks perfect`);
  words.push({ t: 'p', label: `${res.courseName}. ${bits.join(' · ')}.`, size: 26, cap: big ? 2 : 3 });
  if (res.standings.length > 1 && !(big && res.standings.length > 3)) words.push(resultTable(res, Math.min(res.standings.length * (big ? 78 : 66), 300)));
  if (res.cup) {
    const c = res.cup;
    words.push({ t: 'p', label: c.done ? `Cup finished: ${ORD[c.place] ?? c.place + 1} with ${c.total} points.` : `Cup: race ${c.race + 1} of 4 done, ${c.total} points so far.`, bold: true, color: GOLD, size: 26, cap: 2 });
  }
  const btns = [{ t: 'gap', h: wide ? 0 : 20 }];
  if (res.cup) {
    if (res.cup.done) btns.push({ t: 'btn', id: 'new', label: 'New cup', primary: true, h: 92 });
    else btns.push({ t: 'btn', id: 'next', label: `Next: ${res.cup.nextName}`, primary: true, h: 92 });
    btns.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else {
    btns.push({ t: 'btn', id: 'again', label: res.mode === 'trial' ? 'Run again' : 'Race again', primary: true, h: 92 }, { t: 'btn', id: 'new', label: 'Change course', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  }
  return { words, btns };
}
export function resultWidgets(state) {
  const p = resultParts(state, false);
  return [...p.words, ...p.btns, { t: 'gap', h: 30 }];
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-restart', label: 'Restart', row: 8 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets(wide) {
  return [
    { t: 'gap', h: wide ? 40 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have raced the free races of the web demo. The full game on iPhone and Android has every course, the Daily course, the cup and all the rivals.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const strip = lockSize(L).strip, compact = !L.wide && L.sb < 1100;
    let wd = titleWidgets(state, compact);
    if (!L.wide) {
      const off = Math.round(Math.max(0, L.sb - 1280) * 0.3), top = Math.max(off, I.t), cwi = Math.min(640, w - 80);
      // a short tall screen (a tablet in portrait at 1032x1376, a 5-inch phone): shrink the hero until every button is in view
      const need = flowLayout(estCtx, titleWidgets(state, compact), TEXT_SCALES[state.settings.textIdx], { x: 40, w: cwi }).contentH - (L.sb - strip - top);
      if (need > 0 && TEXT_SCALES[state.settings.textIdx] === 1) wd = titleWidgets(state, compact, Math.max(350, (compact ? 400 : 480) - need));
      return one(wd, 640, top, L.sb - strip);
    }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), cols = L.setup.cols;
    return [{ widgets: [...p.head, ...p.courses], ...cols[0] }, { widgets: p.diffs, ...cols[1] }, { widgets: [], ...cols[2] }];
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

// ---- backdrop: the attract race behind every menu ----------------------------------------------------
export function backdrop(ctx, L, state) {
  const a = state.att;
  if (!a) { ctx.fillStyle = '#0c2236'; ctx.fillRect(0, 0, L.w, L.h); return; }
  const R = { x: 0, y: 0, w: L.w, h: L.h };
  const s = Math.max(30, Math.min(64, L.wide ? L.w / 24 : L.w / 11));
  drawScene(ctx, R, { race: a.race, camX: a.camX, camE: a.camE, s, anchor: L.wide ? 0.25 : 0.4, gyF: L.wide ? 0.78 : 0.86, t: state.t, parts: a.parts, ghost: null, noNames: true });
}

function scrim(ctx, L, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(8,20,36,${a * 0.7})`); g.addColorStop(0.5, `rgba(8,20,36,${a})`); g.addColorStop(1, `rgba(8,20,36,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,20,36,0)'); g.addColorStop(1, 'rgba(8,20,36,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(240,248,255,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(240,248,255,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
      roundPath(ctx, c.x + c.w + 6, ty, 5, th, 3); ctx.fillStyle = 'rgba(240,248,255,0.5)'; ctx.fill();
      scrollHint(ctx, c.top, c.bottom, sc, range, c.x, c.w);
    }
  }
  return { scroll, max: LAID.max };
}

export function renderTitle(ctx, state, L) {
  backdrop(ctx, L, state);
  scrim(ctx, L, 0.28);
  if (L.wide) {
    const c = screenCols(state, 'title', L)[1], gx = ctx.createLinearGradient(c.x - 60, 0, c.x + c.w + 60, 0);
    gx.addColorStop(0, 'rgba(8,20,36,0)'); gx.addColorStop(0.25, 'rgba(8,20,36,0.42)'); gx.addColorStop(1, 'rgba(8,20,36,0.5)');
    ctx.fillStyle = gx; ctx.fillRect(c.x - 60, 0, L.w - c.x + 60, L.h);
  }
  drawFlowScreen(ctx, state, 'title', L);
  if (LAID.lock) {
    const k = LAID.lock, dn = !!(state.ui.drag && state.ui.drag.x0 >= k.tap.x && state.ui.drag.x0 <= k.tap.x + k.tap.w && state.ui.drag.y0 >= k.tap.y && state.ui.drag.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(8,20,36,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(230,243,251,0.6)';
  if (state.demo) ctx.fillText('Web demo', L.wide ? (3 * L.w) / 4 : L.w / 2, L.sb - 4);
}

export function renderSetup(ctx, state, L) {
  backdrop(ctx, L, state);
  scrim(ctx, L, 0.66);
  drawFlowScreen(ctx, state, 'setup', L);
  if (!L.wide) {
    const y0 = L.pins.start.y - 56, g = ctx.createLinearGradient(0, y0, 0, L.h);
    g.addColorStop(0, 'rgba(8,20,36,0)'); g.addColorStop(0.2, 'rgba(8,20,36,0.85)'); g.addColorStop(1, 'rgba(8,20,36,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, L.w, L.h - y0);
  }
  drawButton(ctx, L.pins.start, state.setup.mode === 'cup' ? 'Start the cup' : 'Start the race', { primary: true, size: L.wide ? 28 : 32 });
  drawButton(ctx, L.pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) {
    ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0';
    const mx = L.wide ? L.pins.start.x + (L.pins.back.x + L.pins.back.w - L.pins.start.x) / 2 : L.w / 2;
    ctx.fillText(state.setupMsg, mx, L.pins.start.y - (L.wide ? 20 : 16));
  }
}
export function renderSettings(ctx, state, L) { backdrop(ctx, L, state); scrim(ctx, L, 0.7); drawFlowScreen(ctx, state, 'settings', L); }
export function renderResult(ctx, state, L) {
  backdrop(ctx, L, state);
  scrim(ctx, L, 0.66);
  drawFlowScreen(ctx, state, 'result', L);
  const cols = LAID.cols, bcol = cols[cols.length - 1];
  const maxScroll = Math.max(0, bcol.lay.contentH - (bcol.bottom - bcol.top));
  const y = L.wide ? Math.min(L.sb - 12, bcol.top + bcol.off + bcol.lay.contentH + 44) : L.sb - 22;
  if (maxScroll === 0 || L.wide) drawMoreLine(ctx, L.wide ? bcol.x + bcol.w / 2 : L.w / 2, y, 18);
}
export function renderDemoLimit(ctx, state, L) { backdrop(ctx, L, state); scrim(ctx, L, 0.72); drawFlowScreen(ctx, state, 'demolimit', L); }
export function renderPause(ctx, state, L) {
  scrim(ctx, L, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cardW = Math.min(660, L.w - 60 - 2 * Math.max(L.ins.l, L.ins.r)), cw = cardW - 60, cx = L.w / 2;
  const lay = flowLayout(ctx, wd, sc, { x: cx - cw / 2, w: cw });
  const top = Math.max(L.ins.t, 0) + (L.wide ? 20 : 70), bottom = L.sb - (L.wide ? 20 : 70);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (L.h - ch) / 2);
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 28, fill: 'rgba(18,40,64,0.96)', stroke: 'rgba(255,211,106,0.55)' });
  LAID = { key: 'pause', size: L.key, cols: [{ lay, x: cx - cw / 2, w: cw, top: y0, bottom: y0 + ch, off: 0 }], max: Math.max(0, lay.contentH - ch), est: false };
  const sc0 = Math.min(state.ui.scroll, LAID.max);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: cx - cardW / 2, clipW: cardW });
  scrollHint(ctx, y0, y0 + ch, sc0, LAID.max, cx - cardW / 2, cardW);
}

// ---- reference pages (one continuous scrolling reader) -----------------------------------------
export const REF = { max: 0, view: 400 };

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
  backdrop(ctx, L, state);
  scrim(ctx, L, 0.7);
  const PANEL = L.ref.panel;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 28, fill: 'rgba(246,251,254,0.97)', stroke: 'rgba(20,48,79,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#12304f'; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(20,48,79,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(20,48,79,0.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = '#1b5f93'; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(20,48,79,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(20,48,79,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(20,48,79,0.7)';
  ctx.fillText(`text ${Math.round(sc * 100)}%`, pcx, PANEL.y + PANEL.h - 28);
  drawButton(ctx, L.ref.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, L.ref.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  drawButton(ctx, L.ref.back, 'Back', { size: 32 });
  drawButton(ctx, L.ref.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own sled and symbols) ---------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function card(ctx, x, y, w, h) {
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9fcdf2'); g.addColorStop(0.6, '#e4f1fb'); g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d6e7f6'; ctx.beginPath(); ctx.moveTo(x, y + h * 0.55); ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.38, x + w * 0.6, y + h * 0.52); ctx.quadraticCurveTo(x + w * 0.85, y + h * 0.6, x + w, y + h * 0.5); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#4f86b0'; roundPath(ctx, x, y, w, h, 16); ctx.stroke();
}
const rider = (ctx, x, y, s, o = {}) => drawRider(ctx, { x, y, s, ang: 0, p: 0.8, push: 0, side: 0, tuck: false, wobble: 0, hop: 0, v: 6, t: 1, jacket: '#2a8fd6', hat: '#d33b2f', ...o });

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const gy = h * 0.78;
  const A = {
    sled() {
      card(ctx, 0, 0, w, h);
      rider(ctx, w * 0.45, gy, Math.min(100, gy / 2.0), { p: 0.45 });
      label(ctx, 'chair', w * 0.45 + 62, gy - 52, 19, C.ink, 'left');
      label(ctx, 'kicking foot', w * 0.45 - 90, gy - 6, 19, C.ink, 'right');
      label(ctx, 'steel runners', w * 0.45, h - 12, 19, C.ink);
    },
    ring() {
      card(ctx, 0, 0, w, h);
      const cx = [0.2, 0.5, 0.8];
      [[0.3, 'Too early', '#a8483a'], [0.86, 'Good', '#2f7d3a'], [1, 'Perfect', '#c98b12']].forEach(([p, nm, col], i) => {
        drawRing(ctx, w * cx[i], h * 0.45, 40, p, 0, '');
        label(ctx, nm, w * cx[i], h * 0.45 + 74, 21, col);
      });
      label(ctx, 'tap when the ring is full', w / 2, 30, 21, '#12304f');
    },
    terrain() {
      card(ctx, 0, 0, w, h);
      ctx.strokeStyle = '#12304f'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(14, gy - 10); ctx.lineTo(w * 0.25, gy - 10); ctx.lineTo(w * 0.45, gy - 70); ctx.lineTo(w * 0.62, gy - 70); ctx.lineTo(w * 0.85, gy - 8); ctx.lineTo(w - 14, gy - 8); ctx.stroke();
      rider(ctx, w * 0.3, gy - 22, 42, { ang: 0.35 });
      label(ctx, 'climb: kick', w * 0.35, gy - 90, 19, '#a8483a'); label(ctx, 'descent: glide', w * 0.76, gy - 52, 19, '#1b6a9a');
      ctx.fillStyle = '#e8b23a'; ctx.beginPath(); ctx.moveTo(w - 40, 22); ctx.lineTo(w - 22, 22); ctx.lineTo(w - 22, 40); ctx.lineTo(w - 40, 40); ctx.fill();
    },
    surfaces() {
      card(ctx, 0, 0, w, h);
      const items = [['pack', 'Packed', '#dfeaf4'], ['fresh', 'Fresh', '#ffffff'], ['ice', 'Ice', '#a9dbf6'], ['slush', 'Slush', '#a6adb6']];
      items.forEach(([k, nm, col], i) => {
        const bx = 12 + i * (w - 24) / 4, bw = (w - 24) / 4 - 8;
        roundPath(ctx, bx, 40, bw, h - 80, 12); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#4f86b0'; ctx.lineWidth = 2; ctx.stroke();
        label(ctx, nm, bx + bw / 2, 76, 20, '#12304f');
        label(ctx, `roll ${SURF[k].roll}`, bx + bw / 2, 112, 17, '#12304f'); label(ctx, `push ${Math.round(SURF[k].kick * 100)}%`, bx + bw / 2, 138, 17, '#12304f');
      });
    },
    stamina() {
      card(ctx, 0, 0, w, h);
      const bx = w * 0.1, bw = w * 0.8, by = h * 0.4, bh = 34;
      roundPath(ctx, bx, by, bw, bh, 17); ctx.fillStyle = 'rgba(18,48,79,0.25)'; ctx.fill();
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#d9503a'); g.addColorStop(0.3, '#e8b23a'); g.addColorStop(1, '#3cc78f');
      roundPath(ctx, bx, by, bw * 0.7, bh, 17); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#12304f'; ctx.lineWidth = 3; roundPath(ctx, bx, by, bw, bh, 17); ctx.stroke();
      label(ctx, 'kicks drain it; gliding refills it twice as fast', w / 2, by - 22, 21, '#12304f');
      label(ctx, 'below 20% the push weakens', bx + bw * 0.2, by + bh + 36, 19, '#a8483a');
    },
    bend() {
      card(ctx, 0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#4f86b0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w * 0.35, gy - 8); ctx.quadraticCurveTo(w * 0.5, gy - 44, w * 0.7, gy - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffcb2f'; ctx.strokeStyle = '#222'; roundPath(ctx, w * 0.2, 20, 62, 62, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.font = `800 26px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('27', w * 0.2 + 31, 60);
      rider(ctx, w * 0.52, gy - 10, 50, { tuck: true });
      label(ctx, 'safe speed in km/h', w * 0.2 + 31, 108, 17, C.ink); label(ctx, 'glide: +22%', w * 0.52, 36, 22, '#1b6a9a');
    },
    bump() {
      card(ctx, 0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#4f86b0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(w * 0.4, gy); ctx.quadraticCurveTo(w * 0.5, gy - 40, w * 0.6, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
      rider(ctx, w * 0.22, gy, 46); rider(ctx, w * 0.8, gy, 46, { tuck: true, wobble: 0.6 });
      label(ctx, 'standing: clean', w * 0.22, 36, 20, '#2f7d3a'); label(ctx, 'gliding: thrown', w * 0.8, 36, 20, '#a8483a');
    },
  };
  (A[key] ?? A.sled)();
  ctx.restore();
}
