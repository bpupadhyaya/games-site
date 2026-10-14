// Every screen that is not the play screen: title, setup, garage, settings, result, pause, demo limit and the scrolling
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state. Every position comes from
// the live layout L (layout.js).
import { drawScene } from './scene.js';
import { drawCartSide, drawWheelIcon, drawCartBack, shade } from './art.js';
import { TEXT_SCALES, THINK_STEPS, ASSIST_NAMES, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawLockup, drawMoreLine } from './brand.js';
import {
  ALL_COURSE_IDS, getCourse, medalTimes, MEDAL_NAMES, SURF, DIFFS, SKILLS, WHEELS, FRAMES, STEERS, BRAKES, BALANCE_NAMES, statsFor, estimateTime,
  DEMO_COURSES, PLAYER_COLOR,
} from './sim.js';

const TAU = Math.PI * 2;
const GOLD = '#ffd36a';
const CREAM = '#fff1d2';
export const fmtTime = (t) => { if (!(t >= 0) || t > 900) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const medalStr = (m) => (m ? MEDAL_NAMES[m] : '');
const ORD = ['1st', '2nd', '3rd', '4th'];
export const DEMO_WHEELS = ['pram', 'spoke'], DEMO_FRAMES = ['plank', 'box'], DEMO_STEERS = ['rope', 'pivot'];
export const starsOf = (rec) => Object.keys(rec.hills ?? {}).reduce((a, id) => (id === 'daily' ? a : a + ((rec.hills[id] && rec.hills[id].medal) | 0)), 0);

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

const heroArt = (state, h = 400) => ({
  t: 'art', h,
  draw(ctx, w, hh) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    const tight = hh / s < 340, d = tight ? 14 : 0;      // tight: no cart in the hero (the attract race behind it is the picture)
    ctx.font = `italic 700 108px ${DISPLAY}`; textShadow(ctx, 'Billycart', cx, 112 - d, '#ffffff', 22);
    ctx.font = `italic 700 108px ${DISPLAY}`; textShadow(ctx, 'Derby', cx, 214 - d * 2, GOLD, 22);
    ctx.font = `600 23px ${FONT}`; textShadow(ctx, 'BUILD  ·  STEER  ·  ROLL DOWN THE HILL', cx, 262 - d * 2.2, CREAM, 6);
    const ppm = Math.max(36, Math.min(80, (hh / s - 300) / 1.5));
    if (hh / s >= 340) drawCartSide(ctx, cx, hh / s - 12, ppm, { color: state.att ? PLAYER_COLOR : PLAYER_COLOR, build: state.build, spin: state.t * 2 });
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false, sb = 2000) {
  const sound = state.settings.sound;
  // short tall screens (iPad / 10 in tablet portrait): shrink the hero so all ten buttons fit without scrolling
  const hero = compact ? Math.max(235, Math.min(400, 400 - (1110 - sb) * 1.1)) : 470;
  return [
    heroArt(state, hero),
    { t: 'btn', id: 'race', label: 'Derby', sub: 'You and three rivals', primary: true, h: compact ? (sb < 1100 ? 72 : 84) : 96 },
    { t: 'btn', id: 'trial', label: 'Time Trial', row: 1 },
    { t: 'btn', id: 'cup', label: 'Cup', row: 1 },
    { t: 'btn', id: 'garage', label: 'Garage', sub: 'Build your cart', row: 2 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 3 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 3 },
    { t: 'btn', id: 'about', label: 'About', row: 4 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 4 },
    { t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', dark: true },
  ];
}

export function buildSummary(b) { return `${WHEELS[b.wheels].name} · ${FRAMES[b.frame].name} · ${STEERS[b.steer].name} · ${BRAKES[b.brake].name}`; }

export function setupParts(state, wide) {
  const s = state.setup, demo = state.demo, rec = state.record.hills ?? {};
  const title = s.mode === 'trial' ? 'Time Trial' : s.mode === 'cup' ? 'Cup' : 'Derby';
  const head = wide ? [] : [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 48 }];
  const hills = [];
  if (s.mode !== 'cup') {
    hills.push({ t: 'p', label: 'Choose the hill', bold: true, color: CREAM, size: 26 });
    ALL_COURSE_IDS.forEach((id) => {
      const locked = demo && !DEMO_COURSES.includes(id);
      const c = getCourse(id, state.day), r = rec[id];
      hills.push({
        t: 'btn', id: `crs${id}`, label: c.name,
        sub: locked ? 'In the full game' : `${Math.round(c.len)} m${r && r.best ? ` · best ${fmtTime(r.best)}${r.medal ? ` · ${medalStr(r.medal)}` : ''}` : ''}`,
        active: s.course === id && !locked, disabled: locked, hitDisabled: true, h: wide ? 84 : 92,
      });
    });
  } else {
    hills.push({ t: 'p', label: 'The cup runs Main Street Hill, Gravel Ridge, Cobble Lane and Creek Run in order: 10, 6, 3 and 1 points for the first four places.', size: 26 });
  }
  const rest = [];
  if (s.mode !== 'trial') {
    rest.push({ t: 'p', label: 'Choose the rivals', bold: true, color: CREAM, size: 26 });
    DIFFS.forEach((d, i) => {
      const locked = demo && i > 0;
      rest.push({ t: 'btn', id: `dif${i}`, label: SKILLS[d].name, sub: locked ? 'In the full game' : SKILLS[d].note, active: s.diff === i && !locked, disabled: locked, hitDisabled: true, ...(wide ? { h: 88 } : {}) });
    });
  }
  const est = s.mode === 'cup' ? null : estimateTime(s.course, state.day, state.build);
  rest.push({ t: 'p', label: 'Your cart', bold: true, color: CREAM, size: 26 });
  rest.push({ t: 'btn', id: 'garage', label: 'Open the garage', sub: `${buildSummary(state.build)}${est ? ` · estimate ${fmtTime(est)}` : ''}`, dark: true, h: 96 });
  return { head, hills, rest };
}
export function setupWidgets(state) {
  const p = setupParts(state, false);
  return [...p.head, ...p.hills, ...p.rest, { t: 'gap', h: 24 }];
}

// ---- garage ---------------------------------------------------------------------------------------
const rate = (v, lo, hi) => Math.max(0.04, Math.min(1, (v - lo) / (hi - lo)));
export function gauges(b) {
  const st = statsFor(b), rough = (st.crr.pave + st.crr.gravel) / 2;
  return [
    ['Smooth road', rate(0.028 - st.crr.tar, 0, 0.019)],
    ['Rough road', rate(0.07 - rough, 0, 0.045)],
    ['Momentum', rate(0.0034 - st.kd, 0, 0.0015)],
    ['Grip', rate(st.grip, 0.75, 1.2)],
    ['Steering', rate(st.steer, 0.12, 0.4)],
    ['Stability', rate(st.stab, 0.6, 1.5)],
  ];
}
const previewArt = (state, h) => ({
  t: 'art', h,
  draw(ctx, w, hh) {
    const b = state.build;
    ctx.save();
    roundPath(ctx, 0, 0, w, hh, 22); ctx.fillStyle = 'rgba(40,22,8,0.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    // floor
    ctx.save(); roundPath(ctx, 0, 0, w, hh, 22); ctx.clip();
    const g = ctx.createLinearGradient(0, hh * 0.55, 0, hh); g.addColorStop(0, '#6e4d2c'); g.addColorStop(1, '#3d2a16'); ctx.fillStyle = g; ctx.fillRect(0, hh * 0.62, w, hh * 0.4);
    ctx.restore();
    const ppm = Math.min(92, w / 6.2);
    drawCartSide(ctx, w / 2, Math.min(hh * 0.52, 190), ppm, { color: PLAYER_COLOR, build: b, spin: state.t * 0.6 });
    // gauges
    const gs = gauges(b), cols = w > 520 ? 3 : 2, rows = Math.ceil(gs.length / cols), top = Math.min(hh * 0.52, 190) + 26, cw = (w - 40) / cols, rh = Math.max(34, (hh - top - 12) / rows);
    gs.forEach(([nm, v], i) => {
      const cx0 = 20 + (i % cols) * cw, cy0 = top + Math.floor(i / cols) * rh;
      ctx.fillStyle = CREAM; ctx.font = `600 ${rh > 40 ? 18 : 16}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(nm, cx0, cy0 + 14);
      roundPath(ctx, cx0, cy0 + 20, cw - 20, 11, 5.5); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
      const gg = ctx.createLinearGradient(cx0, 0, cx0 + cw - 20, 0); gg.addColorStop(0, '#e8b23a'); gg.addColorStop(1, '#6fe0a4');
      roundPath(ctx, cx0, cy0 + 20, Math.max(11, (cw - 20) * v), 11, 5.5); ctx.fillStyle = gg; ctx.fill();
    });
    ctx.restore();
  },
});

export function garageParts(state, wide) {
  const b = state.build, stars = starsOf(state.record), demo = state.demo;
  const lock = (group, id, list) => {
    const need = group[id].unlock;
    if (demo && !list.includes(id)) return 'In the full game';
    if (stars < need) return `Unlocks at ${need} stars (you have ${stars})`;
    return '';
  };
  const opt = (key, group, id, list) => {
    const lk = lock(group, id, list), p = group[id];
    return { t: 'btn', id: `${key}-${id}`, label: p.name, sub: lk || p.blurb, active: b[key] === id && !lk, disabled: !!lk, hitDisabled: true, h: 96 };
  };
  const est = estimateTime(state.setup.course, state.day, b);
  const head = [{ t: 'gap', h: 8 }, { t: 'h', label: 'Garage', size: 46 }];
  const prev = [previewArt(state, wide ? 420 : 400)];
  const c = getCourse(state.setup.course, state.day);
  const info = [{ t: 'p', label: `Estimate on ${c.name}: ${fmtTime(est)}`, bold: true, color: GOLD, size: 26 }, { t: 'p', label: 'A flawless pilot with this cart. Your own time will be a little slower.', size: 22, cap: 2 }];
  const opts = [
    { t: 'p', label: 'Wheels', bold: true, color: CREAM, size: 28 },
    ...Object.keys(WHEELS).map((id) => opt('wheels', WHEELS, id, DEMO_WHEELS)),
    { t: 'p', label: 'Frame', bold: true, color: CREAM, size: 28 },
    ...Object.keys(FRAMES).map((id) => opt('frame', FRAMES, id, DEMO_FRAMES)),
    { t: 'p', label: 'Steering', bold: true, color: CREAM, size: 28 },
    ...Object.keys(STEERS).map((id) => opt('steer', STEERS, id, DEMO_STEERS)),
    { t: 'p', label: 'Brake', bold: true, color: CREAM, size: 28 },
    ...Object.keys(BRAKES).map((id) => opt('brake', BRAKES, id, ['heel', 'lever'])),
    { t: 'p', label: `Ballast: ${BALANCE_NAMES[b.bal + 2]}`, bold: true, color: CREAM, size: 28 },
    { t: 'btn', id: 'bal-dec', label: '◀ Forward', row: 20, disabled: b.bal <= -2 },
    { t: 'btn', id: 'bal-inc', label: 'Rearward ▶', row: 20, disabled: b.bal >= 2 },
    { t: 'p', label: 'Forward ballast steers sharper; rearward is calmer and more stable.', size: 22, cap: 2 },
  ];
  const done = [];
  return { head, prev, info, opts, done };
}
export function garageWidgets(state) { const p = garageParts(state, false); return [...p.head, ...p.prev, ...p.info, ...p.opts, ...p.done]; }

export function settingsParts(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const a = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-names', label: st.names ? 'Rival names: On' : 'Rival names: Off', sub: 'Show names above the rivals' },
    { t: 'p', label: `Steering assist: ${ASSIST_NAMES[st.assistIdx]}`, bold: true, color: CREAM, size: 26 },
    { t: 'btn', id: 'as-dec', label: 'Less', row: 3, disabled: st.assistIdx === 0 },
    { t: 'btn', id: 'as-inc', label: 'More', row: 3, disabled: st.assistIdx === ASSIST_NAMES.length - 1 },
    { t: 'p', label: 'Assist helps the cart follow the road. It never brakes for you.', size: 22, cap: 2 },
  ];
  const b = [
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: CREAM, size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: CREAM, size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: state.owned ? 'Full game unlocked' : 'Restore purchase', dark: true, disabled: !!state.owned }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: CREAM }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

// a small podium of carts for the result screen
const resultTable = (res, h) => ({
  t: 'art', h,
  draw(ctx, w, hh) {
    const rows = res.standings, n = rows.length, rh = hh / n;
    ctx.save(); ctx.textBaseline = 'middle';
    rows.forEach((row, i) => {
      const y = i * rh + rh / 2, bw = Math.min(w, 640), bx = (w - bw) / 2, bh = rh * 0.84;
      roundPath(ctx, bx, y - bh / 2, bw, bh, 14);
      ctx.fillStyle = row.human ? 'rgba(255,211,106,0.96)' : 'rgba(60,32,12,0.84)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = row.color; ctx.beginPath(); ctx.arc(bx + 48, y, Math.min(16, bh * 0.28), 0, TAU); ctx.fill();
      ctx.fillStyle = row.human ? '#2a1606' : '#fff8e6'; ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(Math.min(30, bh * 0.42))}px ${FONT}`; ctx.fillText(ORD[i] ?? `${i + 1}th`, bx + 14 + 56, y);
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
  if (res.launch > 0.7) bits.push('great launch');
  if (res.crashes) bits.push(`${res.crashes} knock${res.crashes > 1 ? 's' : ''}`);
  else bits.push('clean run');
  words.push({ t: 'p', label: `${res.courseName}. ${bits.join(' · ')}.`, size: 26, cap: big ? 2 : 3 });
  if (res.starsGained > 0) words.push({ t: 'p', label: `+${res.starsGained} star${res.starsGained > 1 ? 's' : ''}${res.unlocked ? `. New part: ${res.unlocked}` : ''}`, bold: true, color: GOLD, size: 26, cap: 2 });
  else if (res.unlocked) words.push({ t: 'p', label: `New part: ${res.unlocked}`, bold: true, color: GOLD, size: 26, cap: 2 });
  if (res.standings.length > 1 && !(big && res.standings.length > 3)) words.push(resultTable(res, Math.min(res.standings.length * (big ? 78 : 66), 300)));
  if (res.cup) {
    const c = res.cup;
    words.push({ t: 'p', label: c.done ? `Cup finished: ${ORD[c.place] ?? c.place + 1} with ${c.total} points.` : `Cup: hill ${c.race + 1} of 4 done, ${c.total} points so far.`, bold: true, color: GOLD, size: 26, cap: 2 });
  }
  const btns = [{ t: 'gap', h: wide ? 0 : 20 }];
  if (res.cup) {
    if (res.cup.done) btns.push({ t: 'btn', id: 'new', label: 'New cup', primary: true, h: 92 });
    else btns.push({ t: 'btn', id: 'next', label: `Next: ${res.cup.nextName}`, primary: true, h: 92 });
    btns.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else {
    btns.push({ t: 'btn', id: 'again', label: res.mode === 'trial' ? 'Run again' : 'Race again', primary: true, h: 92 }, { t: 'btn', id: 'garage', label: 'Tune the cart', row: 6 }, { t: 'btn', id: 'new', label: 'Change hill', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', dark: true });
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
    { t: 'p', label: 'You have driven the free derbies of the web demo. The full game on iPhone and Android has every hill, the Daily hill, the cup, all the parts and all the rivals.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const wd = titleWidgets(state, !L.wide && L.sb < 1280, L.sb);
    const strip = lockSize(L).strip;
    if (!L.wide) { const off = Math.round(Math.max(0, L.sb - 1280) * 0.3); return one(wd, 640, Math.max(off, I.t), L.sb - strip); }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1).map((q) => (q.t === 'btn' ? { ...q, h: q.primary ? 76 : 62 } : q)), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), cols = L.setup.cols;
    return [{ widgets: [...p.head, ...p.hills], ...cols[0] }, { widgets: p.rest, ...cols[1] }, { widgets: [], ...cols[2] }];
  }
  if (key === 'garage') {
    const p = garageParts(state, L.wide);
    if (!L.wide) return one([...p.head, ...p.prev, ...p.info, ...p.opts, { t: 'gap', h: 24 }]).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const cols = L.setup.cols;
    return [{ widgets: [...p.head, ...p.prev, ...p.info], ...cols[0], center: true }, { widgets: [{ t: 'gap', h: 12 }, ...p.opts, { t: 'gap', h: 24 }], ...cols[1] }, { widgets: [], ...cols[2] }];
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
  if (!['title', 'setup', 'garage', 'settings', 'result', 'demolimit'].includes(key)) return;
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
  if (!a) { ctx.fillStyle = '#2b170a'; ctx.fillRect(0, 0, L.w, L.h); return; }
  drawScene(ctx, { x: 0, y: 0, w: L.w, h: L.h }, { race: a.race, t: state.t, parts: a.parts, names: false, cheer: 1, shake: false });
}

function scrim(ctx, L, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(30,14,4,${a * 0.7})`); g.addColorStop(0.5, `rgba(30,14,4,${a})`); g.addColorStop(1, `rgba(30,14,4,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(30,14,4,0)'); g.addColorStop(1, 'rgba(30,14,4,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,248,232,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,248,232,0.92)'; ctx.fill();
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
      roundPath(ctx, c.x + c.w + 6, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,248,232,0.5)'; ctx.fill();
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
    gx.addColorStop(0, 'rgba(30,14,4,0)'); gx.addColorStop(0.25, 'rgba(30,14,4,0.45)'); gx.addColorStop(1, 'rgba(30,14,4,0.55)');
    ctx.fillStyle = gx; ctx.fillRect(c.x - 60, 0, L.w - c.x + 60, L.h);
  }
  drawFlowScreen(ctx, state, 'title', L);
  if (LAID.lock) {
    const k = LAID.lock, dn = !!(state.ui.drag && state.ui.drag.x0 >= k.tap.x && state.ui.drag.x0 <= k.tap.x + k.tap.w && state.ui.drag.y0 >= k.tap.y && state.ui.drag.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(30,14,4,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,244,220,0.6)';
  if (state.demo) ctx.fillText('Web demo', L.wide ? (3 * L.w) / 4 : L.w / 2, L.sb - 4);
}

export function renderSetup(ctx, state, L) {
  backdrop(ctx, L, state);
  scrim(ctx, L, 0.66);
  drawFlowScreen(ctx, state, 'setup', L);
  if (!L.wide) {
    const y0 = L.pins.start.y - 56, g = ctx.createLinearGradient(0, y0, 0, L.h);
    g.addColorStop(0, 'rgba(30,14,4,0)'); g.addColorStop(0.2, 'rgba(30,14,4,0.85)'); g.addColorStop(1, 'rgba(30,14,4,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, L.w, L.h - y0);
  }
  drawButton(ctx, L.pins.start, state.setup.mode === 'cup' ? 'Start the cup' : 'To the start', { primary: true, size: L.wide ? 28 : 32 });
  drawButton(ctx, L.pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) {
    ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0';
    const mx = L.wide ? L.pins.start.x + (L.pins.back.x + L.pins.back.w - L.pins.start.x) / 2 : L.w / 2;
    ctx.fillText(state.setupMsg, mx, L.pins.start.y - (L.wide ? 20 : 16));
  }
}
export function renderGarage(ctx, state, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.74); drawFlowScreen(ctx, state, 'garage', L);
  const P = L.pins;
  if (!L.wide) {
    const y0 = P.start.y - 56, g = ctx.createLinearGradient(0, y0, 0, L.h);
    g.addColorStop(0, 'rgba(30,14,4,0)'); g.addColorStop(0.2, 'rgba(30,14,4,0.85)'); g.addColorStop(1, 'rgba(30,14,4,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, L.w, L.h - y0);
  }
  drawButton(ctx, L.wide ? P.start : { x: P.start.x, y: P.start.y, w: P.back.x + P.back.w - P.start.x, h: P.start.h }, 'Done', { primary: true, size: 32 });
  if (state.garageMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.garageMsg, L.wide ? P.start.x + P.start.w / 2 : L.w / 2, P.start.y - (L.wide ? 20 : 16)); }
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
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 28, fill: 'rgba(60,32,12,0.96)', stroke: 'rgba(255,211,106,0.55)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 28, fill: 'rgba(255,249,234,0.97)', stroke: 'rgba(90,50,20,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#4a2a14'; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(90,50,20,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(90,50,20,0.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = '#a24a12'; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(90,50,20,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(90,50,20,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(90,50,20,0.7)';
  ctx.fillText(`text ${Math.round(sc * 100)}%`, pcx, PANEL.y + PANEL.h - 28);
  drawButton(ctx, L.ref.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, L.ref.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  drawButton(ctx, L.ref.back, 'Back', { size: 32 });
  drawButton(ctx, L.ref.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own cart and symbols) ---------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function card(ctx, x, y, w, h) {
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9fd0f0'); g.addColorStop(0.62, '#d6e8f2'); g.addColorStop(0.62, '#78ae4a'); g.addColorStop(1, '#5f9a38');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = '#8a5a2a'; roundPath(ctx, x, y, w, h, 16); ctx.stroke();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    cart() {
      card(ctx, 0, 0, w, h);
      ctx.fillStyle = '#6b6f78'; ctx.fillRect(0, h * 0.74, w, h * 0.26);
      drawCartSide(ctx, w * 0.5, h * 0.9, Math.min(70, h * 0.36), { color: PLAYER_COLOR, build: { wheels: 'spoke', frame: 'box', steer: 'pivot', brake: 'heel', bal: 0 } });
      label(ctx, 'rider and seat', w * 0.3, h * 0.2, 18, '#2a1a0e'); label(ctx, 'steering rope', w * 0.78, h * 0.3, 18, '#2a1a0e'); label(ctx, 'wheels', w * 0.5, h * 0.16 + 14, 1, '#0000'); label(ctx, 'heel brake', w * 0.2, h * 0.7, 17, '#2a1a0e');
    },
    wheels() {
      card(ctx, 0, 0, w, h);
      const ids = ['pram', 'spoke', 'pneu', 'racer'], names = ['Pram', 'Spokes', 'Air', 'Racer'], tag = ['smooth', 'all-round', 'rough', 'tarmac'];
      ids.forEach((id, i) => {
        const cx = w * (0.14 + 0.24 * i);
        drawWheelIcon(ctx, cx, h * 0.44, 36, id);
        label(ctx, names[i], cx, h * 0.8, 20, C.ink); label(ctx, tag[i], cx, h * 0.93, 16, '#6a3a12');
      });
    },
    steer() {
      card(ctx, 0, 0, w, h);
      roundPath(ctx, w * 0.1, h * 0.55, w * 0.8, 40, 20); ctx.fillStyle = 'rgba(60,32,12,0.35)'; ctx.fill();
      roundPath(ctx, w * 0.5 + w * 0.18, h * 0.55 + 4, 64, 32, 16); ctx.fillStyle = '#f2b53f'; ctx.fill();
      label(ctx, 'slide your thumb: the further, the more you steer', w / 2, h * 0.28, 21, '#4a2a14');
      ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.42); ctx.lineTo(w * 0.7, h * 0.42); ctx.moveTo(w * 0.66, h * 0.37); ctx.lineTo(w * 0.7, h * 0.42); ctx.lineTo(w * 0.66, h * 0.47); ctx.stroke();
      label(ctx, 'let go: the cart straightens', w / 2, h * 0.9, 19, '#4a2a14');
    },
    bend() {
      card(ctx, 0, 0, w, h);
      ctx.fillStyle = '#ffcb2f'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3; roundPath(ctx, w * 0.12, 22, 70, 70, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.font = '800 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('R', w * 0.12 + 35, 70);
      label(ctx, 'safe speed = √(grip × radius)', w * 0.55, 46, 22, '#4a2a14'); label(ctx, 'tarmac, 30 m bend: 40 km/h', w * 0.55, 76, 19, '#4a2a14');
      drawCartBack(ctx, w * 0.3, h * 0.9, 56, { color: PLAYER_COLOR, wheels: 'spoke', frame: 'box', brake: true, u: -0.4, t: 0 });
      label(ctx, 'brake first, then steer in', w * 0.72, h * 0.8, 20, '#4a2a14');
    },
    line() {
      card(ctx, 0, 0, w, h);
      ctx.strokeStyle = '#6b6f78'; ctx.lineWidth = 62; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.9); ctx.lineTo(w * 0.15, h * 0.4); ctx.quadraticCurveTo(w * 0.15, h * 0.1, w * 0.45, h * 0.1); ctx.lineTo(w * 0.85, h * 0.1); ctx.stroke();
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 5; ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.9); ctx.lineTo(w * 0.1, h * 0.5); ctx.quadraticCurveTo(w * 0.15, h * 0.2, w * 0.4, h * 0.16); ctx.lineTo(w * 0.85, h * 0.13); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'wide in, inside at the middle, wide out', w * 0.6, h * 0.62, 20, '#4a2a14');
    },
    surfaces() {
      card(ctx, 0, 0, w, h);
      const items = [['tar', 'Tarmac'], ['pave', 'Cobbles'], ['gravel', 'Gravel'], ['verge', 'Grass']];
      items.forEach(([k, nm], i) => {
        const bx = 12 + i * (w - 24) / 4, bw = (w - 24) / 4 - 8;
        roundPath(ctx, bx, 24, bw, h - 48, 12); ctx.fillStyle = SURF[k].road; ctx.fill(); ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 2; ctx.stroke();
        label(ctx, nm, bx + bw / 2, 60, 20, '#fff'); label(ctx, `grip ${SURF[k].grip}`, bx + bw / 2, 100, 18, '#fff'); label(ctx, `roll ${SURF[k].crr}`, bx + bw / 2, 128, 18, '#fff');
      });
    },
  };
  (A[key] ?? A.cart)();
  ctx.restore();
}
