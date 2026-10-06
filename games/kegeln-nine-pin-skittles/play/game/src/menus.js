// Every screen that is not the play screen: title, setup, settings, learn list, result, pause, the set-up sheet, and the
// paginated About / How to Play / Rules reader with its illustrations (drawn with the game's own pin layout). Pure drawing.
import { W, SW, SH, syncSize, isWide, host, minUnits, tapUnits, backBox, TEXT_SCALES, THINK_STEPS, refGeom, setupGeom, sceneLayout, SCENE_Y0 } from './layout.js';
import { drawLockup, lockupAlpha, hasLockup, drawCredit, drawMoreLine } from './brand.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawRoom, drawLane, drawActors, drawParts, interpSim, TAU } from './scene.js';
import { PROFILES, ASSIST } from './ai.js';
import { LENGTHS, totals, countOf } from './engine.js';
import { PIN_POS, PIN_NAMES, KING, POWERS, pathPoints, LANE_HALF, PIN_Z0 } from './phys.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { HOOK_NAMES, sideName } from './view.js';

// ---- flow screens ------------------------------------------------------------------------------
// A flow screen is one or two COLUMNS of widgets (portrait and most screens: one centred 640 wide column; landscape title / result: art or
// stats on the left, buttons on the right). Columns scroll together. LAID is what was last laid out; game.js hit-tests against it.
let LAID = { key: '', lay: null, top: 0, bottom: SH, cols: [], sig: '' };
export const flowMeta = () => LAID;
export const flowMax = () => LAID.cols.reduce((m, c) => Math.max(m, c.lay.contentH - (c.bottom - c.top0)), 0);   // how far the columns can scroll (<= 0: they fit)
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const sigOf = (state) => `${SW}x${SH}:${state.settings.textIdx}:${Math.round(host.t)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.r)},${Math.round(host.back)}`;
const colBase = () => { const w = Math.min(640, SW - 40); return { x: Math.round((SW - w) / 2), w }; };
const topPad = () => { const bb = backBox(); return bb ? bb.y + bb.h + 4 : Math.max(0, host.t); };   // keeps the host's back button clear of the first widget
const botPad = () => Math.max(0, host.b);

function specsFor(state, key) {
  const wide = isWide(), base = colBase(), tp = topPad(), bot = SH - botPad();
  const modal = (n) => ({ x: Math.round((SW - 620) / 2), w: 620, top: Math.max(n, tp + 6) });
  switch (key) {
    case 'title': {
      if (!wide) {
        const tall = SH >= 1280, artH = tall ? 400 : 300, top = tall ? (SH - 1280) / 2 : 0;
        // a short screen trades the gap between the title and the buttons (where the lane shows through) for fitting without scrolling
        let gap = 150;
        if (!tall) { const h = flowLayout(estCtx, titleWidgets(state, { artH, gap }), TEXT_SCALES[state.settings.textIdx], base).contentH; gap = clamp(gap - (h - (bot - top)) - 6, 8, 150); }
        return [{ wd: titleWidgets(state, { artH, gap }), o: base, top, bottom: bot }];
      }
      const ux0 = host.l, ux1 = SW - host.r, mid = (ux0 + ux1) / 2, bw = Math.min(560, ux1 - mid - 40);
      return [
        { wd: [heroArt(state)], o: { x: ux0 + 10, w: mid - ux0 - 20 }, top: 0, bottom: bot, center: true },
        { wd: [...titleButtons(state), { t: 'gap', h: 4 }, brandWidget(250)], o: { x: Math.round(mid + (ux1 - mid - bw) / 2), w: bw }, top: tp, bottom: bot, center: true },
      ];
    }
    case 'setup': return [{ wd: setupWidgets(state), o: base, top: tp, bottom: setupGeom().listBottom }];
    case 'settings': return [{ wd: settingsWidgets(state), o: base, top: tp, bottom: bot }];
    case 'learn': return [{ wd: learnWidgets(state), o: base, top: tp, bottom: bot }];
    case 'demolimit': return [{ wd: demoLimitWidgets(), o: base, top: tp, bottom: bot, center: wide }];
    case 'result': {
      const parts = state.m.cfg.mode === 'learn' ? lessonResultParts(state) : resultParts(state);
      if (!wide) return [{ wd: [...parts.head, ...parts.actions], o: base, top: tp, bottom: bot }];
      const ux0 = host.l, ux1 = SW - host.r, mid = (ux0 + ux1) / 2, bw = Math.min(520, ux1 - mid - 40);
      return [
        { wd: parts.head, o: { x: ux0 + 20, w: mid - ux0 - 40 }, top: tp, bottom: bot, center: true },
        { wd: parts.actions, o: { x: Math.round(mid + (ux1 - mid - bw) / 2), w: bw }, top: tp, bottom: bot, center: true },
      ];
    }
    case 'sheet': { const m = modal(90); return [{ wd: sheetWidgets(state), o: { x: m.x, w: m.w }, top: m.top, bottom: SH - 20 }]; }
    case 'why': { const m = modal(90); return [{ wd: whyWidgets(state), o: { x: m.x, w: m.w }, top: m.top, bottom: SH - 20 }]; }
    default: return null;
  }
}
// Lays the columns out with the given context: each column's items, and where it starts (centred when it fits and `center` is set).
function layoutCols(ctx, state, specs) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  return specs.map((sp) => {
    const lay = flowLayout(ctx, sp.wd, sc, sp.o);
    const room = sp.bottom - sp.top, top = sp.center && lay.contentH < room ? sp.top + (room - lay.contentH) / 2 : sp.top;
    return { lay, top, top0: sp.top, bottom: sp.bottom };
  });
}
function setLaid(key, cols, state) { LAID = { key, cols, lay: cols[0].lay, top: cols[0].top, bottom: cols[0].bottom, sig: sigOf(state) }; }
export function ensureLayout(state, key) {
  syncSize();
  if (LAID.key === key && LAID.lay && LAID.sig === sigOf(state)) return;
  const sp = specsFor(state, key);
  if (!sp) return;
  setLaid(key, layoutCols(estCtx, state, sp), state);
}
export function hitScreen(x, y, scroll) {
  for (const c of LAID.cols) { if (y < c.top0 || y > c.bottom) continue; const id = flowHit(c.lay, c.top, scroll, x, y); if (id) return id; }
  return null;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// ---- the live lane behind the title and menus --------------------------------------------------------------------------
// The same picture as the play screen, placed like it (so the room fills any screen).
export function bgXf() { return isWide() ? sceneLayout(1, 0, 0, { cx: SW / 2 }) : sceneLayout(1, 190, SH - 956, null); }
export function drawAttract(ctx, state) {
  syncSize();
  const a = state.att, cam = a.cam, xf = bgXf();
  ctx.save();
  ctx.translate(xf.vx, xf.vy - SCENE_Y0 * xf.s); ctx.scale(xf.s, xf.s);
  drawRoom(ctx, cam, state.t); drawLane(ctx, cam, state.t);
  const iv = interpSim(a.sim, a.alpha);
  drawActors(ctx, cam, iv.pins, iv.ball.on ? iv.ball : null, {});
  drawParts(ctx, cam, a.parts);
  ctx.restore();
}

function heroArt(state) {
  return {
    t: 'art', h: 400,
    draw(ctx, w, h) {
      const cx = w / 2, k = Math.min(1, w / 620);
      ctx.save();
      ctx.translate(cx, 0); ctx.scale(k, k); ctx.translate(-cx, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(233,193,95,0.95)';
      spaced(ctx, 'NINE-PIN SKITTLES', cx, 88, 8);
      ctx.font = `800 142px ${NUM}`;
      textShadow(ctx, 'KEGELN', cx, 214, '#fff4d6', 18);
      ctx.strokeStyle = 'rgba(233,193,95,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 250, 246); ctx.lineTo(cx - 40, 246); ctx.moveTo(cx + 40, 246); ctx.lineTo(cx + 250, 246); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, 246, 9, 0, TAU); ctx.fillStyle = '#e9c15f'; ctx.fill();
      ctx.restore();
    },
  };
}
// The small, quiet Arcforge credit: the themed lockup when its picture is loaded, else the plain credit line.
function brandWidget(width) {
  return {
    t: 'art', id: 'arcforge', hitW: width, h: Math.round(width * 327 / 1200) + 16,
    draw(ctx, w, h) {
      const bw = Math.min(width, w);
      if (!drawLockup(ctx, w / 2, h / 2, bw, lockupAlpha())) drawCredit(ctx, w / 2, h / 2 + 8, Math.max(15, minUnits(10)), { dim: 0.8 });
    },
  };
}

export function titleButtons(state) {
  const sound = state.settings.sound, wd = [];
  if (state.resume) {
    const r = state.resume, who = r.cfg.mode === 'two' ? 'Two players' : PROFILES[r.cfg.opp]?.name ?? 'Opponent';
    const a = totals(r, 0).total, b = totals(r, 1).total;
    wd.push({ t: 'btn', id: 'continue', label: 'Continue match', sub: `${who}, ${a} to ${b}`, primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'play', label: 'New match vs Computer', h: 80 });
  } else wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'learn', label: 'Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}
export function titleWidgets(state, o = {}) {
  const hero = heroArt(state); hero.h = o.artH ?? 400;
  return [hero, { t: 'gap', h: o.gap ?? 150 }, ...titleButtons(state), { t: 'gap', h: 6 }, brandWidget(260)];
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }];
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
  LENGTHS.forEach((l) => {
    const locked = demo && l.id > 0;
    wd.push({ t: 'btn', id: `len${l.id}`, label: l.name, sub: locked ? 'In the full game' : l.note, row: undefined, active: s.len === l.id && !locked, disabled: locked, hitDisabled: true, h: 84 });
  });
  wd.push({ t: 'p', label: 'Aim steadiness', bold: true, color: '#ffe9bf', size: 26 });
  ASSIST.forEach((a, i) => wd.push({ t: 'btn', id: `as${i}`, label: a.name, row: 11, active: state.settings.assist === i }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-replay', label: st.replay ? 'Crash replays: On' : 'Crash replays: Off', sub: 'A small replay of the pin deck after big throws', active: st.replay },
    { t: 'p', label: `Aim steadiness: ${ASSIST[st.assist].name}`, bold: true, color: '#ffe9bf', size: 26 },
    ...ASSIST.map((a, i) => ({ t: 'btn', id: `as${i}`, label: a.name, row: 12, active: st.assist === i })),
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Language: Play in English. The German words stay and are explained in About and Rules.', size: 22, color: 'rgba(255,233,191,0.8)' },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function learnWidgets(state) {
  const done = state.record.learn ?? 0;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: 'Four short lessons with a goal each. They are free, always.', size: 24, color: '#ffe9bf' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}`, sub: i < done ? 'Done' : i === done ? 'Next up' : 'Open', active: i < done, primary: i === done, h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

// What the throws of a match add up to, for the result screen.
export function matchStats(m, side) {
  const t = m.throws[side];
  const best = t.reduce((a, x) => Math.max(a, x.pins), 0);
  return { ...totals(m, side), alle: t.filter((x) => x.alle).length, kranz: t.filter((x) => x.kranz).length, pudel: t.filter((x) => x.pudel).length, best, throws: t.length };
}
const moreWidget = () => ({ t: 'art', h: 54, draw(ctx, w, h) { drawMoreLine(ctx, w / 2, h / 2 + 8, Math.max(22, Math.round(minUnits(11)))); } });
export function resultParts(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = (s) => sideName(state, s);
  const title = winner < 0 ? 'A draw' : mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${nm(winner)} wins` : winner === 0 ? 'You win!' : 'You lose';
  const a = matchStats(m, 0), b = matchStats(m, 1);
  const head = [{ t: 'gap', h: big ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${a.total} – ${b.total}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' },
    { t: 'p', label: `${nm(0)}  vs  ${nm(1)}`, bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const rows = [['Volle', a.volle, b.volle], ['Abräumen', a.abr, b.abr], ['Best throw', a.best, b.best], ['Alle Neune', a.alle, b.alle], ['Kranz', a.kranz, b.kranz], ['Pudel', a.pudel, b.pudel]];
  rows.forEach(([k, x, y]) => head.push({ t: 'p', label: `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') head.push({ t: 'p', label: `Matches won against ${PROFILES[m.cfg.opp].name}: ${(state.record.wins ?? [])[m.cfg.opp] ?? 0}`, size: 22, cap: 2, color: '#ffe9bf' });
  head.push({ t: 'gap', h: 16 });
  const actions = [{ t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 },
    { t: 'btn', id: 'new', label: 'New match', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true }, { t: 'gap', h: 14 }, moreWidget(), { t: 'gap', h: 20 }];
  return { head, actions };
}
export function lessonResultParts(state) {
  const L = state.m.lesson, won = L.passed, last = L.idx >= LESSONS.length - 1;
  const head = [{ t: 'gap', h: 60 }, { t: 'h', label: won ? 'Lesson passed' : 'Not this time', size: 56 },
    { t: 'p', label: won ? `${L.title}: goal reached in ${L.used} ${L.used === 1 ? 'throw' : 'throws'}.` : `${L.title}: the goal was not reached in ${L.tries} throws. Try the Think button.`, size: 26 }, { t: 'gap', h: 16 }];
  const actions = [];
  if (won && !last) actions.push({ t: 'btn', id: 'lnext', label: 'Next lesson', primary: true, h: 92 });
  actions.push({ t: 'btn', id: 'lagain', label: won ? 'Play it again' : 'Try again', primary: !(won && !last), h: 84 });
  actions.push({ t: 'btn', id: 'lmenu', label: 'Lessons', dark: true, h: 84 }, { t: 'gap', h: 14 }, moreWidget(), { t: 'gap', h: 20 });
  return { head, actions };
}
export const resultWidgets = (state) => { const p = resultParts(state); return [...p.head, ...p.actions]; };
export const lessonResultWidgets = (state) => { const p = lessonResultParts(state); return [...p.head, ...p.actions]; };

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    ...(state.m && state.m.cfg.mode === 'learn' ? [{ t: 'p', label: state.m.lesson.text, size: 22, color: '#ffe9bf' }] : []),
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Back to the lessons' : 'Your match is kept', dark: true },
  ];
}

// The set-up sheet used at the larger text sizes instead of the inline controls.
export function sheetWidgets(state) {
  const p = state.plan, a = Math.round(p.aimX * 100), s0 = Math.round(p.x0 * 100);
  const side = (v) => (v === 0 ? 'centre' : v < 0 ? `${-v} cm left` : `${v} cm right`);
  return [
    { t: 'h', label: 'Set up your throw', size: 40 },
    { t: 'p', label: `Hook: ${HOOK_NAMES[p.hook + 3]}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'hook-', label: '◄ Hook left', row: 1, disabled: p.hook <= -3 },
    { t: 'btn', id: 'hook+', label: 'Hook right ►', row: 1, disabled: p.hook >= 3 },
    { t: 'p', label: `Weight: ${POWERS[p.power].name}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'pow-', label: 'Softer', row: 2, disabled: p.power <= 0 },
    { t: 'btn', id: 'pow+', label: 'Firmer', row: 2, disabled: p.power >= 2 },
    { t: 'p', label: `Aim ring: ${side(a)}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'aim-', label: '◄ Aim left', row: 3 },
    { t: 'btn', id: 'aim+', label: 'Aim right ►', row: 3 },
    { t: 'p', label: `Start from: ${side(s0)}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'st-', label: '◄ Start left', row: 4 },
    { t: 'btn', id: 'st+', label: 'Start right ►', row: 4 },
    { t: 'btn', id: 'think', label: state.hint && state.hint.busy ? 'Thinking...' : 'Think', dark: true },
    ...(state.hint && !state.hint.busy ? [{ t: 'p', label: state.hint.text, size: 22, color: '#bff3ff' }, { t: 'btn', id: 'use', label: 'Use this line', primary: true }] : []),
    { t: 'btn', id: 'close', label: 'Done', primary: true, h: 88 },
    { t: 'btn', id: 'smenu', label: 'Menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Pause, rules, quit to the lessons' : 'Pause, rules, quit (your match is kept)', dark: true, h: 84 },
    { t: 'gap', h: 20 },
  ];
}

// The full-screen reader for a status text that was too long for its box at the current text size (Watch & Learn reasons, the Think line).
export function whyWidgets(state) {
  return [
    { t: 'h', label: state.why.title, size: 40 },
    { t: 'p', label: state.why.text, size: 26, color: '#e8fbff', align: 'left' },
    { t: 'btn', id: 'wclose', label: state.why.wasPaused === false && state.m.cfg.mode === 'watch' ? 'Close' : 'Close', primary: true, h: 88 },
    { t: 'gap', h: 20 },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the two short matches of the web demo. The full game on iPhone and Android has all five opponents, three match lengths, Two Players and your saved records.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, `rgba(6,10,8,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,10,8,${a})`); g.addColorStop(1, `rgba(6,10,8,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = SW) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2, fs = Math.max(22, Math.round(minUnits(11)));
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,10,8,0)'); g.addColorStop(1, 'rgba(6,10,8,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 50, bottom - 40, 100, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 50, top + 8, 100, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

// Lays the screen's columns out with the real canvas, draws them with the shared scroll, and remembers the layout for hit-testing.
function drawFlowScreen(ctx, state, key, specs) {
  const cols = layoutCols(ctx, state, specs);
  setLaid(key, cols, state);
  const maxScroll = Math.max(0, flowMax());
  const scroll = Math.min(state.ui.scroll, maxScroll);
  const top = Math.min(...cols.map((c) => c.top0)), bottom = Math.max(...cols.map((c) => c.bottom));
  for (const c of cols) drawFlow(ctx, c.lay, c.top, c.bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / (bottom - top + maxScroll))), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, SW - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay: cols[0].lay };
}

// A calm backdrop for menus: the room and lane, dimmed.
function backdrop(ctx, state, a) {
  syncSize();
  drawAttract(ctx, state);
  scrim(ctx, a);
}
const specsOrDie = (state, key) => specsFor(state, key);
export function renderTitle(ctx, state) {
  syncSize();
  drawAttract(ctx, state);
  if (isWide()) scrim(ctx, 0.5);
  else {
    const y1 = Math.round(SH * 0.4375);
    const g = ctx.createLinearGradient(0, y1, 0, SH); g.addColorStop(0, 'rgba(8,5,3,0)'); g.addColorStop(0.35, 'rgba(8,5,3,0.82)'); g.addColorStop(1, 'rgba(8,5,3,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y1, SW, SH - y1);
    const t = ctx.createLinearGradient(0, 0, 0, 330); t.addColorStop(0, 'rgba(8,5,3,0.85)'); t.addColorStop(1, 'rgba(8,5,3,0)'); ctx.fillStyle = t; ctx.fillRect(0, 0, SW, 330);
  }
  drawFlowScreen(ctx, state, 'title', specsOrDie(state, 'title'));
  ctx.textAlign = 'center'; ctx.font = `400 ${Math.max(18, Math.round(minUnits(10)))}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText('Web demo', SW / 2, SH - 14);
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.7);
  drawFlowScreen(ctx, state, 'setup', specsOrDie(state, 'setup'));
  const sg = setupGeom(), y0 = sg.start.y - 36;
  const g = ctx.createLinearGradient(0, y0, 0, SH);
  g.addColorStop(0, 'rgba(6,10,8,0)'); g.addColorStop(0.2, 'rgba(6,10,8,0.88)'); g.addColorStop(1, 'rgba(6,10,8,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, SW, SH - y0);
  drawButton(ctx, sg.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, sg.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, Math.round(minUnits(11)))}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, SW / 2, sg.start.y - 8); }
}
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'settings', specsOrDie(state, 'settings')); }
export function renderLearn(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'learn', specsOrDie(state, 'learn')); }
export function renderResult(ctx, state) { backdrop(ctx, state, 0.84); drawFlowScreen(ctx, state, 'result', specsOrDie(state, 'result')); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit', specsOrDie(state, 'demolimit')); }
export function renderPause(ctx, state) {
  syncSize();
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(600, SW - 60), px = Math.round((SW - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px, w: pw });
  const top = Math.max(70, topPad() + 6), bottom = SH - Math.max(70, botPad() + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (SH - ch) / 2);
  panel(ctx, px - 30, y0 - 20, pw + 60, ch + 40, { r: 30, fill: 'rgba(24,18,12,0.94)', stroke: 'rgba(233,193,95,0.55)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, cols: [{ lay, top: y0, top0: y0, bottom: y0 + ch }], sig: sigOf(state) };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px - 30, pw + 60);
}
function modalPanel(ctx, state, key, stroke, scr) {
  syncSize();
  scrim(ctx, scr);
  const sp = specsFor(state, key)[0], pw = sp.o.w + 60, px = sp.o.x - 30;
  panel(ctx, px, sp.top - 20, pw, sp.bottom - sp.top + 30, { r: 28, fill: 'rgba(24,18,12,0.97)', stroke });
  drawFlowScreen(ctx, state, key, [sp]);
}
export function renderWhy(ctx, state) { modalPanel(ctx, state, 'why', 'rgba(125,232,255,0.55)', 0.78); }
export function renderSheet(ctx, state) { modalPanel(ctx, state, 'sheet', 'rgba(233,193,95,0.55)', 0.7); }

// ---- reference pages --------------------------------------------------------------------------
// One continuous SCROLLING reader (drag, wheel, keys, scroll bar): READER is refreshed on every draw for the input code.
export const READER = { max: 0, view: 0, y0: 0, y1: 0 };
export const refCloseRect = () => { const G = refGeom(); return { x: G.back.x, y: G.back.y, w: G.next.x + G.next.w - G.back.x, h: G.back.h }; };

function buildPages(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PANEL.wide ? 92 : 120, limit = Infinity;   // inside the panel: below the header, above the page number
  const pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art ? (PANEL.wide ? 222 : 250) : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    if (!cur || used + full > limit - top) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, art: part === 0 ? sec.art : null, artH: part === 0 ? artH : 0, lines: [], part };
      let h = titleH + blk.artH + 26;
      while (i < lines.length) {
        const add = lineH(lines[i], blk.lines.length);
        if (used + h + add > limit - top && (blk.lines.length > 0 || used > 0)) break;
        blk.lines.push({ ...lines[i] }); h += add; i++;
      }
      cur.blocks.push(blk); used += h;
      part++;
      if (i >= lines.length) break;
      newPage();
    }
  });
  pages.forEach((pg) => { pg.total = used; });
  return pages;
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.72);
  const G = refGeom(), PANEL = { ...G.panel, wide: G.wide };
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}:${PANEL.wide}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc, PANEL); pageCache.set(pkey, pages); if (pageCache.size > 60) pageCache.delete(pageCache.keys().next().value); }
  const pg = pages[0], pcx = PANEL.x + PANEL.w / 2;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(247,238,214,0.97)', stroke: 'rgba(154,116,36,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.redDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  const hy = PANEL.wide ? 46 : 58, ly = PANEL.wide ? 60 : 78;
  ctx.fillText(header, pcx, PANEL.y + hy);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + ly); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + ly); ctx.stroke();
  const top0 = PANEL.wide ? 92 : 120, cy0 = PANEL.y + top0 - 8, cy1 = PANEL.y + PANEL.h - (PANEL.wide ? 40 : 62);
  READER.max = Math.max(0, Math.ceil(pg.total - (cy1 - cy0 - 8))); READER.view = cy1 - cy0; READER.y0 = cy0; READER.y1 = cy1;
  state.ui.scroll = Math.max(0, Math.min(READER.max, state.ui.scroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 4, cy0, PANEL.w - 8, cy1 - cy0); ctx.clip();
  let y = PANEL.y + top0 - state.ui.scroll;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.red; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), pcx, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) {
      const aw = Math.min(PANEL.w - 80, 640), ax = pcx - aw / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, ax, y, aw, blk.artH - 12, state); ctx.restore(); y += blk.artH;
    }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.restore();
  if (READER.max > 0) {
    const th = Math.max(50, (cy1 - cy0) * ((cy1 - cy0) / pg.total)), ty = cy0 + (state.ui.scroll / READER.max) * (cy1 - cy0 - th);
    roundPath(ctx, PANEL.x + PANEL.w - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(110,76,40,0.55)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `400 ${Math.max(22, Math.round(minUnits(11)))}px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.7)';
    ctx.fillText(state.ui.scroll < READER.max - 4 ? '▼' : '▲', pcx, PANEL.y + PANEL.h - (PANEL.wide ? 16 : 24));
  }
  drawButton(ctx, G.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, G.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${Math.max(24, Math.round(minUnits(11)))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textShadow(ctx, `${Math.round(sc * 100)}%`, G.pct.x, G.pct.y, '#fff3d6', 4);
  drawButton(ctx, refCloseRect(), 'Close', { primary: true, size: 32 });
}

// ---- illustrations: top-down diagrams drawn with the game's own pin layout -----------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${Math.max(size, 20)}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
const stage = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2a1a0f'); g.addColorStop(1, '#4a2f1a');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(154,116,36,0.7)'; ctx.lineWidth = 2; ctx.stroke();
};
// A pin seen from above: a disc with a lit edge. `m` is the scale in pixels per metre.
function topPin(ctx, cx, cy, r, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  if (o.ghost) { ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,235,200,0.5)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); return; }
  ctx.fillStyle = o.king ? '#e0b24a' : o.fallen ? '#8d7658' : '#f1e6c8'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = o.hot ? '#7dffa0' : 'rgba(70,40,15,0.8)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.fillStyle = o.king ? '#b98a22' : o.fallen ? '#6f5b42' : '#c0392b'; ctx.fill();
  ctx.restore();
}
function diamond(ctx, ox, top, m, standing, o = {}) {
  // top is the y of the back pin; the front pin is at the bottom, the ball comes from below
  const depth = PIN_POS[8].z - PIN_Z0;
  PIN_POS.forEach((p, i) => {
    const x = ox + p.x * m, y = top + (depth - (p.z - PIN_Z0)) * m;
    const st = !standing || standing[i];
    topPin(ctx, x, y, 0.06 * m * (o.rk ?? 1), { king: i === KING, ghost: !st, hot: o.hot && o.hot.includes(i) });
  });
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    layout() {
      stage(ctx, 0, 0, w, h);
      const m = 170, ox = w * 0.24;
      diamond(ctx, ox, 24, m, null, { hot: [4] });
      ctx.strokeStyle = 'rgba(255,235,200,0.4)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ox, 10); ctx.lineTo(ox, h - 6); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'Nine pins in a diamond.', w * 0.5, h * 0.3, 19, '#fff2cf', 'left');
      label(ctx, 'The gold pin in the middle', w * 0.5, h * 0.3 + 32, 18, '#ffe08a', 'left');
      label(ctx, 'is the King (der König).', w * 0.5, h * 0.3 + 56, 18, '#ffe08a', 'left');
      label(ctx, 'The ball comes from below.', w * 0.5, h * 0.3 + 96, 18, '#fff2cf', 'left');
    },
    plan() {
      stage(ctx, 0, 0, w, h);
      const m = 150, ox = w * 0.35, base = h - 18;
      // lane strip
      ctx.fillStyle = 'rgba(230,170,90,0.18)'; ctx.fillRect(ox - LANE_HALF * m, 8, 2 * LANE_HALF * m, h - 16);
      diamond(ctx, ox, 30, m * 0.8, null, { rk: 1 });
      const fy = 30 + 1.004 * m * 0.8;
      const pts = pathPoints(0.2, -0.1, 1, 1);
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.setLineDash([8, 7]); ctx.beginPath();
      pts.forEach((p, i) => { const px = ox + p.x * m, py = base - (p.z / PIN_Z0) * (base - 52); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(ox - 0.1 * m, fy, 14, 0, TAU); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(ox + 0.2 * m, base, 12, 0, TAU); ctx.fillStyle = '#4c1c18'; ctx.fill(); ctx.strokeStyle = '#e6c27a'; ctx.stroke();
      label(ctx, 'aim ring', ox - 0.1 * m - 20, fy + 34, 19, '#ffe08a', 'right');
      label(ctx, 'ball start', ox + 0.2 * m + 22, base - 10, 19, '#fff2cf', 'left');
      label(ctx, 'dashed path', w * 0.68, h * 0.55, 19, '#fff2cf', 'left');
      label(ctx, 'includes the hook', w * 0.68, h * 0.55 + 24, 19, '#fff2cf', 'left');
    },
    hooks() {
      stage(ctx, 0, 0, w, h);
      const m = 120, ox = w * 0.32, base = h - 18;
      ctx.fillStyle = 'rgba(230,170,90,0.18)'; ctx.fillRect(ox - LANE_HALF * m, 8, 2 * LANE_HALF * m, h - 16);
      const cols = ['#ff9a7a', '#ffc27a', '#ffe08a', '#ffffff', '#bfe8ff', '#8fd0ff', '#6ab4ff'];
      for (let hk = -3; hk <= 3; hk++) {
        const pts = pathPoints(0, 0, 1, hk, 24);
        ctx.strokeStyle = cols[hk + 3]; ctx.lineWidth = hk === 0 ? 4 : 3; ctx.beginPath();
        pts.forEach((p, i) => { const px = ox + p.x * m, py = base - (p.z / PIN_Z0) * (base - 40); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.stroke();
      }
      label(ctx, 'Seven hooks, all aimed', w * 0.5, h * 0.28, 18, '#fff2cf', 'left');
      label(ctx, 'at the same ring (Medium).', w * 0.5, h * 0.28 + 24, 18, '#fff2cf', 'left');
      label(ctx, 'Big hooks start wide and', w * 0.5, h * 0.28 + 62, 18, '#fff2cf', 'left');
      label(ctx, 'curve in near the end.', w * 0.5, h * 0.28 + 86, 18, '#fff2cf', 'left');
    },
    abr() {
      stage(ctx, 0, 0, w, h);
      const m = 150, left = [false, true, false, true, false, false, true, false, false];
      const t = [false, false, false, false, false, false, false, false, false];
      diamond(ctx, w * 0.2, 30, m * 0.9, left);
      arrow(ctx, w * 0.38, h * 0.45, w * 0.5, h * 0.45);
      diamond(ctx, w * 0.67, 30, m * 0.9, t);
      label(ctx, 'your leftovers', w * 0.2, h - 14, 18, '#fff2cf');
      label(ctx, 'all down: a fresh set', w * 0.74, h - 14, 18, '#ffe08a');
    },
    calls() {
      stage(ctx, 0, 0, w, h);
      const m = 140, d = (cx, standing, text, col) => { diamond(ctx, cx, 24, m, standing); label(ctx, text, cx, h - 14, 18, col); };
      d(w * 0.16, new Array(9).fill(false), 'Alle Neune', '#9fe8b4');
      d(w * 0.5, [false, false, false, false, true, false, false, false, false], 'Kranz', '#ffe08a');
      ctx.strokeStyle = '#ffb4a0'; ctx.lineWidth = 5; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(w * 0.84, h - 40); ctx.quadraticCurveTo(w * 0.86, 120, w * 0.95, 50); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,235,200,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.8, 10); ctx.lineTo(w * 0.8, h - 10); ctx.stroke();
      label(ctx, 'Pudel', w * 0.88, h - 14, 18, '#ffb4a0');
    },
  };
  (A[key] ?? A.layout)();
  ctx.restore();
}
export { countOf, PIN_NAMES };
