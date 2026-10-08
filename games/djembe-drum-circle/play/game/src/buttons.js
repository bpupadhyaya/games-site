// Every button on every screen, as data: { id, r, label, style, ... }. update() hit-tests this list and render() draws it,
// so a button is always exactly where it is drawn. Built from the state and the live layout each time (cheap).
import { RHYTHMS, DIFFICULTY } from './rhythm.js';
import { THINK_STEPS, TEXT_SCALES, R, clamp } from './layout.js';

export const TITLE_CARDS = [
  { id: 'echo', label: 'Echo', sub: 'Call and response' },
  { id: 'circle', label: 'Circle', sub: 'Build the ensemble' },
  { id: 'learn', label: 'Learn', sub: 'Real rhythms' },
  { id: 'free', label: 'Free Drum', sub: 'Play and loop' },
];
export const TITLE_PILLS = [
  { id: 'auto', label: 'Auto Play' }, { id: 'how', label: 'How to Play' }, { id: 'rules', label: 'Rules' },
  { id: 'about', label: 'About' }, { id: 'settings', label: 'Settings' },
];
export const RULES_CHAPTERS = 9;
export const SETTINGS_ROWS = ['diff', 'calibrate', 'offset', 'guide', 'calm', 'sound', 'text'];

// The Pick screen (Learn / Circle): a list of rhythms and a details panel.
export function pickLayout(L, scale = 1) {
  const G = L.page, top = G.body.y;
  const rows = RHYTHMS.length;
  if (!L.land) {
    const listH = Math.min(G.body.h * 0.52, rows * 104), rh = listH / rows;
    const list = R(G.col.x, top, G.col.w, listH);
    const det = R(G.col.x, top + listH + 12, G.col.w, G.body.h - listH - 12 - 92);
    return { list, rowH: rh, det, start: R(G.col.x + G.col.w - 330, G.nav.y, 330, 84), rows: Array.from({ length: rows }, (_, i) => R(list.x, list.y + i * rh, list.w, rh - 8)) };
  }
  const lw = G.col.w * 0.46, listH = Math.min(G.body.h, rows * 100), rh = listH / rows;
  const list = R(G.col.x, top, lw, listH);
  const det = R(G.col.x + lw + 20, top, G.col.w - lw - 20, G.body.h - 96);
  return { list, rowH: rh, det, start: R(G.col.x + G.col.w - 330, G.nav.y, 330, 84), rows: Array.from({ length: rows }, (_, i) => R(list.x, list.y + i * rh, list.w, rh - 8)) };
}

export function settingsLayout(L, scale) {
  const G = L.page, rowH = Math.round(96 * Math.max(1, scale * 0.85));
  const rows = SETTINGS_ROWS.map((id, i) => ({ id, r: R(G.body.x, G.body.y + i * (rowH + 10), G.body.w - 16, rowH) }));
  return { rows, rowH, total: SETTINGS_ROWS.length * (rowH + 10) };
}

// The result card: a fixed header (title, stars, accuracy), a scrolling middle (counts and notes, which follows the text zoom) and fixed buttons.
export function resultLayout(st, L) {
  const res = st.result, M = L.modal(L.land ? 760 : 660, L.land ? 640 : 900), k = resultScale(M), z = TEXT_SCALES[st.prefs.textScaleIdx];
  const bh = Math.round(70 * k), gap = Math.round(12 * k), rowH = 40, buttons = [];
  let y = M.y + M.h - 18 - rowH;
  buttons.push({ id: 'home', r: R(M.x + M.w / 2 - 190, y, 380, rowH), label: '', invisible: true });
  y -= gap + bh; buttons.push({ id: 'menu', r: R(M.x + 36, y, M.w - 72, bh), label: 'Menu', size: 28 });
  if (res?.mode === 'learn' && res.nextOk) { y -= gap + bh; buttons.push({ id: 'next', r: R(M.x + 36, y, M.w - 72, bh), label: 'Next rhythm', size: 30 }); }
  y -= gap + Math.round(76 * k); buttons.push({ id: 'again', r: R(M.x + 36, y, M.w - 72, Math.round(76 * k)), label: 'Play again', style: 'primary', size: 34 });
  const top = M.y + 236 * k - 16 * k, region = R(M.x + 28, top, M.w - 56, Math.max(60, y - 10 - top));
  return { M, k, z, region, buttons, headH: 236 * k };
}
export const resultScale = (M) => clamp(M.h / 880, 0.62, 1);
export function buttonsFor(st, L) {
  const B = [], sc = TEXT_SCALES[st.prefs.textScaleIdx], G = L.page;
  const add = (id, r, label, o = {}) => B.push({ id, r, label, ...o });
  const zoom = () => { add('zoomDec', G.zoomDec, 'A−', { disabled: st.prefs.textScaleIdx === 0, size: 32 }); add('zoomInc', G.zoomInc, 'A+', { disabled: st.prefs.textScaleIdx === TEXT_SCALES.length - 1, size: 32 }); };
  switch (st.scene) {
    case 'title': {
      const T = L.title;
      const z = Math.min(sc, 3);
      TITLE_CARDS.forEach((c, i) => add(c.id, T.cards[i], c.label, { style: 'card', sub: c.sub, size: Math.round((L.land ? 34 : 40) * T.sc * z), card: true }));
      TITLE_PILLS.forEach((c, i) => add(c.id, T.pills[i], c.label, { size: Math.round(30 * Math.max(0.85, T.sc) * z) }));
      add('home', T.credit, '', { invisible: true });
      break;
    }
    case 'pick': {
      const P = pickLayout(L);
      RHYTHMS.forEach((r, i) => add(`rh:${i}`, P.rows[i], r.name, { row: true, locked: !st.unlocked(i), active: st.pick.sel === i }));
      add('start', P.start, st.pick.mode === 'learn' ? 'Start lesson' : 'Join the circle', { style: 'primary', size: 34, disabled: !st.unlocked(st.pick.sel) });
      add('back', G.back, 'Back', { size: 32 }); zoom();
      break;
    }
    case 'play': {
      const P = L.play;
      if (st.paused && !st.auto.on) {
        const M = L.modal(560, 520);
        add('resume', R(M.x + 40, M.y + 150, M.w - 80, 84), 'Resume', { style: 'primary', size: 36 });
        add('restart', R(M.x + 40, M.y + 250, M.w - 80, 76), 'Restart', { size: 32 });
        add('quit', R(M.x + 40, M.y + 342, M.w - 80, 76), 'Leave to menu', { size: 32 });
        add('pauseModal', M, '', { invisible: true, modal: true });
        break;
      }
      add('pause', P.pause, st.auto.on ? 'Exit' : 'Pause', { size: 30, topbar: true });
      if (st.auto.on) {
        const b = P.btn(4);
        add('autoPause', b[0], st.paused ? 'Resume' : 'Pause', { style: 'primary', size: 30 });
        add('thinkDec', b[1], 'Think −', { size: 26, disabled: st.prefs.autoThinkIdx === 0 });
        add('thinkInc', b[2], 'Think +', { size: 26, disabled: st.prefs.autoThinkIdx === THINK_STEPS.length - 1 });
        add('autoSkip', b[3], 'Next', { size: 28 });
      } else if (st.mode === 'free') {
        const F = st.free, b = P.btn(5);
        add('rec', b[0], F.phase === 'rec' ? 'Recording' : F.phase === 'count' ? 'Counting' : F.phase === 'wait' ? 'Armed' : 'Record', { style: F.phase === 'rec' ? 'danger' : 'primary', size: 28, disabled: F.layers.length >= 3 && F.phase === 'loop' });
        add('undo', b[1], 'Undo', { size: 28, disabled: !F.layers.length });
        add('clear', b[2], 'Clear', { size: 28, disabled: !F.layers.length && F.phase === 'idle' });
        add('click', b[3], 'Click', { size: 28, active: F.click });
        add('quant', b[4], 'Snap', { size: 28, active: F.quant });
        const lane = P.lane;
        add('bpmDec', R(lane.x + lane.w - 270, lane.y + 2, 76, 40), '−', { size: 30, disabled: F.layers.length > 0 || F.phase !== 'idle' });
        add('bpmInc', R(lane.x + lane.w - 86, lane.y + 2, 76, 40), '+', { size: 30, disabled: F.layers.length > 0 || F.phase !== 'idle' });
      } else {
        const b = P.btn(st.mode === 'learn' ? 2 : 1);
        add('guide', b[0], 'Guide', { size: 30, active: st.prefs.guide });
        if (st.mode === 'learn') add('skip', b[1], 'Skip ahead', { size: 28 });
      }
      break;
    }
    case 'result': {
      const RL = resultLayout(st, L);
      for (const x of RL.buttons) B.push(x);
      break;
    }
    case 'rules': {
      add('back', G.back, 'Back', { size: 32 });
      add('chPrev', R(G.back.x + G.back.w + 12, G.nav.y, G.next.x - G.back.x - G.back.w - 24, 84), '‹ Prev', { size: 30, disabled: st.page.chapter === 0 });
      add('chNext', G.next, st.page.chapter === RULES_CHAPTERS - 1 ? 'Done' : 'Next ›', { size: 32, style: 'primary' });
      zoom();
      break;
    }
    case 'about': case 'how': add('back', G.back, 'Back', { size: 32 }); zoom(); break;
    case 'settings': {
      add('back', G.back, 'Back', { size: 32 }); zoom();
      const S = settingsLayout(L, sc), off = st.page.scroll;
      for (const row of S.rows) {
        const r = { ...row.r, y: row.r.y - off };
        if (row.id === 'diff') add('s:diff', r, 'Difficulty', { row: true, value: DIFFICULTY[st.prefs.diff].name });
        if (row.id === 'calibrate') add('s:calibrate', r, 'Calibrate timing', { row: true, value: 'Tap along' });
        if (row.id === 'offset') { const oy = sc > 1.4 ? r.y + r.h * 0.5 : r.y + r.h / 2 - 32; add('s:offDec', R(r.x + r.w - 220, oy, 100, 64), '−', { size: 32, scrolled: true }); add('s:offInc', R(r.x + r.w - 110, oy, 100, 64), '+', { size: 32, scrolled: true }); B.push({ id: 's:offsetLabel', r, label: 'Timing offset', row: true, value: `${st.prefs.latency} ms`, passive: true }); }
        if (row.id === 'guide') add('s:guide', r, 'Guide lights', { row: true, value: st.prefs.guide ? 'On' : 'Off' });
        if (row.id === 'calm') add('s:calm', r, 'Calm motion', { row: true, value: st.prefs.calm ? 'On' : 'Off' });
        if (row.id === 'sound') add('s:sound', r, 'Sound', { row: true, value: st.prefs.sound ? 'On' : 'Off' });
        if (row.id === 'text') B.push({ id: 's:text', r, label: 'Text size', row: true, value: `${Math.round(sc * 100)}%`, passive: true });
      }
      break;
    }
    case 'calibrate': {
      add('back', G.back, st.calib.phase === 'done' ? 'Close' : 'Cancel', { size: 32 });
      if (st.calib.phase === 'done') {
        add('cal:retry', R(G.col.x + G.col.w / 2 - 260, G.nav.y - 120, 250, 76), 'Try again', { size: 30 });
        add('cal:apply', R(G.col.x + G.col.w / 2 + 10, G.nav.y - 120, 250, 76), 'Use this', { size: 30, style: 'primary', disabled: st.calib.offset === null });
      }
      break;
    }
    case 'demo-limit': add('back', G.back, 'Back', { size: 32 }); break;
    default: break;
  }
  return B;
}
export { clamp };
