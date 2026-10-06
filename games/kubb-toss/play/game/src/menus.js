// Every screen that is not the play screen: title, setup, settings, learn list, result, pause, the set-up sheet, and the paginated About /
// How to Play / Rules reader with its illustrations (drawn with the game's own pitch layout). Pure drawing.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, G, host, PANEL, READER, menuView, BAKE } from './layout.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, FLOOR } from './ui.js';
import { drawLockup, drawMoreLine } from './brand.js';
export { readerMeta } from './layout.js';
import { PROFILES, ASSIST } from './ai.js';
import { SIZES } from './engine.js';
import { LOFTS, SPINS, FIELD, KUBB, KING } from './phys.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { drawScene, sideName } from './view.js';
import { TEAM, TAU } from './scene.js';

// ---- flow screens ------------------------------------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Where each flow screen lives on THIS screen: viewport rows, columns, button scale. One function for hit-testing (estimated text widths) and drawing.
function modal(wide) {   // a centred panel for the pause menu, the Why card and the set-up sheet
  const U = G.U, pw = wide ? Math.min(U.w - 60, 700) : W - 40, px = (U.x0 + U.x1) / 2 - pw / 2;
  const top = wide ? U.y0 + 14 : Math.max(90, U.y0 + 70), bottom = H - Math.max(wide ? 14 : 20, host.b + 10);
  return { pw, px, top, bottom };
}
function geomFor(key, state) {
  const F = G.flow, wide = G.land;
  const g = { top: F.top, bottom: F.bottom, opts: { bk: F.bk, x: F.x1, w: F.w1 } };
  if (key === 'setup') g.bottom = F.setupBottom;
  if (key === 'setup' || key === 'settings' || key === 'result') { if (F.cols === 2) g.opts = { bk: F.bk, cols: 2, x2: F.x2, w2: F.w2, gut: F.gut }; }
  if (key === 'sheet' || key === 'why') { const m = modal(wide); g.top = m.top + 20; g.bottom = m.bottom - 6; g.opts = { bk: F.bk, x: m.px + 30, w: m.pw - 60 }; g.panel = m; }
  if (key === 'title') {
    const P = titleParams(state);
    if (P.wide) g.top = F.top0;
    g.opts = { bk: F.bk, x: P.x, w: P.w, avail: g.bottom - g.top, fill: P.wide ? 0.5 : 0.35 };
  }
  if (key === 'result' || key === 'demolimit' || key === 'learn' || key === 'settings') { g.opts.avail = g.bottom - g.top; g.opts.fill = key === 'settings' ? 0 : 0.3; }
  return g;
}
function widgetsFor(key, state) {
  switch (key) {
    case 'title': return titleWidgets(state);
    case 'setup': return setupWidgets(state);
    case 'settings': return settingsWidgets(state);
    case 'learn': return learnWidgets(state);
    case 'result': return state.m.cfg.mode === 'learn' ? lessonResultWidgets(state) : resultWidgets(state);
    case 'demolimit': return demoLimitWidgets();
    case 'sheet': return sheetWidgets(state);
    case 'why': return whyWidgets(state);
    default: return null;
  }
}
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;   // drawing refreshes it every frame with real text widths
  const wd = widgetsFor(key, state);
  if (!wd) return;
  const g = geomFor(key, state);
  const lay = flowLayout(estCtx, wd, TEXT_SCALES[state.settings.textIdx], g.opts);
  LAID = { key, lay, top: g.top, bottom: g.bottom, h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// The title block. k scales it (the landscape panel uses a smaller one), oy shifts it up, `lock` adds the themed Arcforge lockup under the rule.
function heroArt(h, k = 1, oy = 0, lock = false) {
  return {
    t: 'art', h,
    draw(ctx, w) {
      const cx = w / k / 2;
      ctx.save(); ctx.scale(k, k); ctx.translate(0, oy);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${Math.max(22, Math.ceil(FLOOR.v / k))}px ${FONT}`; ctx.fillStyle = 'rgba(255,232,150,0.95)';
      spaced(ctx, 'THE NORDIC LAWN GAME', cx, 84, 6);
      ctx.font = `800 128px ${NUM}`;
      textShadow(ctx, 'KUBB', cx, 192, '#fff6dc', 18);
      ctx.strokeStyle = 'rgba(255,232,150,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 220, 216); ctx.lineTo(cx - 36, 216); ctx.moveTo(cx + 36, 216); ctx.lineTo(cx + 220, 216); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, 216, 9, 0, TAU); ctx.fillStyle = '#ffe08a'; ctx.fill();
      ctx.restore();
    },
  };
}
// The landscape title: the live lawn in a window on the left, the title and the buttons in a panel on the right.
export function titleParams(state) {
  const F = G.flow, U = G.U, wide = G.land;
  if (wide) {
    const cut = Math.round(U.x0 + U.w * 0.44), w = clamp(U.x1 - cut - 56, 360, 540), x = (cut + U.x1) / 2 - w / 2;
    const B = flowLayout(estCtx, titleWidgets(state, { bare: true }), TEXT_SCALES[state.settings.textIdx], { x, w, bk: F.bk }).contentH;
    const heroH = clamp(F.bottom - F.top0 - B - 12, 90, 150);
    return { wide: true, cut, x, w, heroH, gapH: 0, k: clamp(0.8 * heroH / 150, 0.5, 0.8) };
  }
  const buttons = flowLayout(estCtx, titleWidgets(state, { bare: true }), TEXT_SCALES[state.settings.textIdx], { x: F.x1, w: F.w1, bk: F.bk }).contentH;
  const avail = F.bottom - F.top;
  let gapH = 200, heroH = 330, over = heroH + gapH + buttons + 40 - avail;
  if (over > 0) { const g = Math.min(over, gapH - 20); gapH -= g; over -= g; }
  if (over > 0) heroH = Math.max(240, heroH - over);
  return { wide: false, x: F.x1, w: F.w1, heroH, gapH, k: 1 };
}
export function titleWidgets(state, o = {}) {
  const sound = state.settings.sound;
  const P = o.bare ? null : titleParams(state);
  const wd = o.bare ? [] : P.wide ? [heroArt(P.heroH, P.k, -44)] : [heroArt(P.heroH, 1, 0, P.heroH >= 300), { t: 'gap', h: P.gapH }];
  if (state.resume) {
    const r = state.resume, who = r.cfg.mode === 'two' ? 'Two players' : PROFILES[r.cfg.opp]?.name ?? 'Opponent';
    const a = r.blocks.filter((b) => b.team === 0 && b.role !== 'cleared').length, b = r.blocks.filter((x) => x.team === 1 && x.role !== 'cleared').length;
    wd.push({ t: 'btn', id: 'continue', label: 'Continue match', sub: `${who}, ${a} kubbs to ${b}`, primary: true, h: 92 });
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
  wd.push({ t: 'gap', h: 2 }, lockupWidget(250));
  return wd;
}
// The themed Arcforge lockup, directly under the last row of buttons; a tap opens the Arcforge home.
function lockupWidget(width) {
  const lh = Math.round(width * 327 / 1200);
  return { t: 'art', id: 'arcforge', hitW: width, h: lh + 16, draw(ctx, w, h) { drawLockup(ctx, w / 2, h / 2 - lh / 2, Math.min(width, w), 0.95); } };
}
export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }, { t: 'split' }];
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#ffe9a8', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  if (s.mode !== 'two') wd.push({ t: 'col' });
  wd.push({ t: 'p', label: 'Game size', bold: true, color: '#ffe9a8', size: 26 });
  SIZES.forEach((l) => {
    const locked = demo && l.id > 0;
    wd.push({ t: 'btn', id: `size${l.id}`, label: l.name, sub: locked ? 'In the full game' : l.note, active: s.size === l.id && !locked, disabled: locked, hitDisabled: true, h: 84 });
  });
  wd.push({ t: 'p', label: 'Opening turns', bold: true, color: '#ffe9a8', size: 26 });
  wd.push({ t: 'btn', id: 'open1', label: 'Official: 2 batons, then 4', sub: 'The usual way to start', row: 9, active: s.opening !== false });
  wd.push({ t: 'btn', id: 'open0', label: 'Six batons every turn', sub: 'A faster game', row: 9, active: s.opening === false });
  if (s.mode === 'two') wd.push({ t: 'col' });
  wd.push({ t: 'p', label: 'Aim steadiness', bold: true, color: '#ffe9a8', size: 26 });
  ASSIST.forEach((a, i) => wd.push({ t: 'btn', id: `as${i}`, label: a.name, row: 11, active: state.settings.assist === i }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}
export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 }, { t: 'split' },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Aim steadiness: ${ASSIST[st.assist].name}`, bold: true, color: '#ffe9a8', size: 26 },
    ...ASSIST.map((a, i) => ({ t: 'btn', id: `as${i}`, label: a.name, row: 12, active: st.assist === i })),
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'col' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Language: Play in English. The Swedish word kubb (a block of wood) is explained in About and Rules.', size: 22, color: 'rgba(255,233,168,0.85)' },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a8' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}
export function learnWidgets(state) {
  const done = state.record.learn ?? 0;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: 'Four short lessons with a goal each: throwing, field kubbs, the baseline and the king. They are free, always.', size: 24, color: '#ffe9a8' }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}`, sub: i < done ? 'Done' : i === done ? 'Next up' : 'Open', active: i < done, primary: i === done, h: 92 }));
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function resultWidgets(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = (s) => sideName(state, s);
  const title = winner < 0 ? 'A draw' : mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${nm(winner)} wins` : winner === 0 ? 'You win!' : 'You lose';
  const left = (t) => m.blocks.filter((b) => b.team === t && b.role !== 'cleared').length;
  const wd = [{ t: 'gap', h: big ? 20 : G.land ? 16 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 },
    { t: 'p', label: o.why, size: 26, cap: 2.2, color: '#ffe9a8' },
    { t: 'split' },
    { t: 'p', label: `${nm(0)} (${TEAM[0].name})  vs  ${nm(1)} (${TEAM[1].name})`, bold: true, color: '#ffe9a8', size: 24, cap: 2 }];
  [['Turns played', `${m.turnNo + 1}`], ['Baseline kubbs knocked down', `${m.knocked[0]}  –  ${m.knocked[1]}`], ['Field kubbs cleared', `${m.cleared[0]}  –  ${m.cleared[1]}`], ['Kubbs still on the lawn', `${left(0)}  –  ${left(1)}`]]
    .forEach(([k, v]) => wd.push({ t: 'p', label: `${k}:  ${v}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') wd.push({ t: 'p', label: `Matches won against ${PROFILES[m.cfg.opp].name}: ${(state.record.wins ?? [])[m.cfg.opp] ?? 0}`, size: 22, cap: 2, color: '#ffe9a8' });
  wd.push({ t: 'col' }, { t: 'gap', h: 16 });
  wd.push({ t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreLine());
  return wd;
}
// Quiet brand line on a result screen: "More heritage games in Arcforge" (text only).
const moreLine = () => ({ t: 'art', h: 40, draw(ctx, w) { drawMoreLine(ctx, w / 2, 28, Math.max(20, Math.ceil(FLOOR.v))); } });
export function lessonResultWidgets(state) {
  const L = state.m.lesson, won = L.passed, last = L.idx >= LESSONS.length - 1;
  const wd = [{ t: 'gap', h: 60 }, { t: 'h', label: won ? 'Lesson passed' : 'Not this time', size: 56 },
    { t: 'p', label: won ? `${L.title}: goal reached with ${L.used} ${L.used === 1 ? 'baton' : 'batons'}.` : `${L.title}: ${L.failMsg ?? 'the goal was not reached'}. Try the Think button.`, size: 26 }, { t: 'gap', h: 16 }];
  if (won && !last) wd.push({ t: 'btn', id: 'lnext', label: 'Next lesson', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'lagain', label: won ? 'Play it again' : 'Try again', primary: !(won && !last), h: 84 });
  wd.push({ t: 'btn', id: 'lmenu', label: 'Lessons', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}
export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    ...(state.m && state.m.cfg.mode === 'learn' ? [{ t: 'p', label: state.m.lesson.text, size: 22, color: '#ffe9a8' }] : []),
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Back to the lessons' : 'Your match is kept', dark: true },
  ];
}
// The set-up sheet used at the larger text sizes instead of the inline controls.
export function sheetWidgets(state) {
  const p = state.plan, sx = Math.round(p.sx * 100);
  const side = (v) => (v === 0 ? 'centre' : v < 0 ? `${-v} cm left` : `${v} cm right`);
  return [
    { t: 'h', label: 'Set up your throw', size: 40 },
    { t: 'p', label: `Loft: ${LOFTS[p.loft].name}`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'loft-', label: 'Flatter', row: 1, disabled: p.loft <= 0 },
    { t: 'btn', id: 'loft+', label: 'Higher', row: 1, disabled: p.loft >= 2 },
    { t: 'p', label: `Spin: ${SPINS[p.spin].name}`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'spin-', label: 'Slower', row: 2, disabled: p.spin <= 0 },
    { t: 'btn', id: 'spin+', label: 'Faster', row: 2, disabled: p.spin >= 2 },
    { t: 'p', label: `Where you stand: ${side(sx)}`, bold: true, color: '#ffe9a8', size: 26 },
    { t: 'btn', id: 'st-', label: '◄ Left', row: 3 },
    { t: 'btn', id: 'st+', label: 'Right ►', row: 3 },
    { t: 'p', label: 'To aim and throw, drag back on the pitch like a slingshot and let go.', size: 22, color: 'rgba(255,233,168,0.85)' },
    { t: 'btn', id: 'think', label: state.hint && state.hint.busy ? 'Testing...' : 'Think', dark: true },
    ...(state.hint && !state.hint.busy ? [{ t: 'p', label: state.hint.text, size: 22, color: '#bff3ff' }, { t: 'btn', id: 'use', label: 'Use this throw', primary: true }] : []),
    { t: 'btn', id: 'close', label: 'Done', primary: true, h: 88 },
    { t: 'btn', id: 'smenu', label: 'Menu', sub: state.m && state.m.cfg.mode === 'learn' ? 'Pause, rules, quit to the lessons' : 'Pause, rules, quit (your match is kept)', dark: true, h: 84 },
    { t: 'gap', h: 20 },
  ];
}
export function whyWidgets(state) {
  return [
    { t: 'h', label: state.why.title, size: 40 },
    { t: 'p', label: state.why.text, size: 26, color: '#e8fbff', align: 'left' },
    { t: 'btn', id: 'wclose', label: 'Close', primary: true, h: 88 },
    { t: 'gap', h: 20 },
  ];
}
export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the two short matches of the web demo. The full game on iPhone and Android has all five opponents, the full-size game, Two Players and your saved records.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(4,12,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,12,6,${a})`); g.addColorStop(1, `rgba(4,12,6,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2, fs = Math.max(22, Math.ceil(FLOOR.v));
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,12,6,0)'); g.addColorStop(1, 'rgba(4,12,6,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,190,0.92)'; ctx.fill();
    ctx.fillStyle = '#1b2417'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u25bc more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,190,0.92)'; ctx.fill();
    ctx.fillStyle = '#1b2417'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u25b2 up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom, opts) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const g = geomFor(key, state);
  const lay = flowLayout(ctx, widgets, sc, opts ?? g.opts);
  top = g.top; bottom = g.bottom;
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll, 0, W);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, G.U.x1 - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,244,210,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, G.U.x0, G.U.w);
  }
  return { scroll, maxScroll, lay };
}
// The live lawn behind the title and the menus: a baton knocks kubbs over now and then.
// Portrait: the picture bottom aligned. Landscape: fitted to the height and centred at cx; it fades into the dark at its sides.
export function drawAttract(ctx, state, cx = null) {
  const mv = menuView(cx);
  ctx.save(); ctx.translate(mv.tx, mv.ty); ctx.scale(mv.s, mv.s);
  drawScene(ctx, state.att.scene);
  ctx.restore();
  fadeSides(ctx, mv);
}
function fadeSides(ctx, mv) {
  const x0 = mv.tx + BAKE.x * mv.s, x1 = mv.tx + (BAKE.x + BAKE.w) * mv.s, y0 = mv.ty + BAKE.y * mv.s, y1 = mv.ty + (BAKE.y + BAKE.h) * mv.s;
  ctx.save();
  ctx.fillStyle = '#0a120a';
  if (x0 > 0) ctx.fillRect(0, 0, x0, H);
  if (x1 < W) ctx.fillRect(x1, 0, W - x1, H);
  if (y0 > 0) ctx.fillRect(0, 0, W, y0);
  if (y1 < H) ctx.fillRect(0, y1, W, H - y1);
  const fw = 140 * mv.s;
  for (const [ex, dir] of [[x0, 1], [x1, -1]]) {
    if (ex < -fw || ex > W + fw) continue;
    const g = ctx.createLinearGradient(ex, 0, ex + dir * fw, 0);
    g.addColorStop(0, 'rgba(10,18,10,1)'); g.addColorStop(1, 'rgba(10,18,10,0)');
    ctx.fillStyle = g; ctx.fillRect(dir > 0 ? ex : ex - fw, 0, fw, H);
  }
  ctx.restore();
}
function backdrop(ctx, state, a) { drawAttract(ctx, state); scrim(ctx, a); }

export function renderTitle(ctx, state) {
  const P = titleParams(state), g = geomFor('title', state);
  if (P.wide) {
    // left: the lawn in a window; right: a quiet panel with the title and the buttons
    ctx.fillStyle = '#0a120a'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, P.cut, H); ctx.clip();
    drawAttract(ctx, state, P.cut / 2);
    const sg = ctx.createLinearGradient(0, H - 160, 0, H); sg.addColorStop(0, 'rgba(4,12,6,0)'); sg.addColorStop(1, 'rgba(4,12,6,0.7)'); ctx.fillStyle = sg; ctx.fillRect(0, H - 160, P.cut, 160);
    ctx.restore();
    const pg = ctx.createLinearGradient(P.cut, 0, W, 0); pg.addColorStop(0, 'rgba(7,18,10,0.97)'); pg.addColorStop(1, 'rgba(10,26,14,0.97)'); ctx.fillStyle = pg; ctx.fillRect(P.cut, 0, W - P.cut, H);
    ctx.strokeStyle = 'rgba(255,232,150,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.cut, 0); ctx.lineTo(P.cut, H); ctx.stroke();
  } else {
    drawAttract(ctx, state);
    const gg = ctx.createLinearGradient(0, H * 0.4, 0, H); gg.addColorStop(0, 'rgba(4,12,6,0)'); gg.addColorStop(0.35, 'rgba(4,12,6,0.82)'); gg.addColorStop(1, 'rgba(4,12,6,0.95)');
    ctx.fillStyle = gg; ctx.fillRect(0, H * 0.4, W, H * 0.6);
    const t = ctx.createLinearGradient(0, 0, 0, 330 + g.top); t.addColorStop(0, 'rgba(4,12,6,0.82)'); t.addColorStop(1, 'rgba(4,12,6,0)'); ctx.fillStyle = t; ctx.fillRect(0, 0, W, 330 + g.top);
  }
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, 0);
  ctx.textAlign = 'center'; ctx.font = `400 ${Math.max(18, Math.ceil(FLOOR.v))}px ${FONT}`; ctx.fillStyle = 'rgba(255,240,200,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText('Web demo', P.wide ? (P.cut + W) / 2 : W / 2, H - Math.max(14, host.b + 6));
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.74);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 0);
  const py = SETUP_PINS.start.y, g = ctx.createLinearGradient(0, py - 40, 0, H);
  g.addColorStop(0, 'rgba(4,12,6,0)'); g.addColorStop(0.2, 'rgba(4,12,6,0.88)'); g.addColorStop(1, 'rgba(4,12,6,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, py - 40, W, H - py + 40);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, Math.ceil(FLOOR.v))}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, (SETUP_PINS.start.x + SETUP_PINS.back.x + SETUP_PINS.back.w) / 2, py - 10); }
}
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.78); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, 0); }
export function renderLearn(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, 0); }
export function renderResult(ctx, state) { backdrop(ctx, state, 0.84); drawFlowScreen(ctx, state, 'result', widgetsFor('result', state), 0, 0); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, 0); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.6);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx], wide = G.land, m = modal(wide);
  const pw = wide ? Math.min(G.U.w - 60, 620) : W - 60, px = (G.U.x0 + G.U.x1) / 2 - pw / 2;
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60, bk: G.flow.bk });
  const top = Math.max(70, m.top), bottom = Math.min(H - 70, m.bottom);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(8,22,12,0.95)', stroke: 'rgba(255,232,150,0.55)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, 0, W);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px, pw);
}
export function renderWhy(ctx, state) {
  scrim(ctx, 0.78);
  const g = geomFor('why', state), m = g.panel;
  panel(ctx, m.px, m.top, m.pw, m.bottom - m.top + 10, { r: 28, fill: 'rgba(8,22,12,0.97)', stroke: 'rgba(125,232,255,0.55)' });
  drawFlowScreen(ctx, state, 'why', whyWidgets(state), 0, 0);
}
export function renderSheet(ctx, state) {
  scrim(ctx, 0.7);
  const g = geomFor('sheet', state), m = g.panel;
  panel(ctx, m.px, m.top, m.pw, m.bottom - m.top + 10, { r: 28, fill: 'rgba(8,22,12,0.96)', stroke: 'rgba(255,232,150,0.55)' });
  drawFlowScreen(ctx, state, 'sheet', sheetWidgets(state), 0, 0);
}

// ---- reference pages: one continuous, scrollable document (About / How to Play / Rules) -------------------------------------------------------------
// The text is laid out once per text size as a tall column and drawn through a window (drag, wheel, keys, Next/Back scroll it), so any text size fits.
const ART_H = 250;
function buildDoc(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = Math.round(fs * 1.24), tw = PANEL.w - 64;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 14;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y + 6 }); y += 30; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), th = tl.length * secFs * 1.2 + 14;
    items.push({ k: 'title', y, lines: tl, h: th }); y += th;
    if (sec.art) { items.push({ k: 'art', y, key: sec.art }); y += ART_H; }
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gap: k === 0 && pi > 0 })); });
    lines.forEach((l, k) => { if (l.gap && k > 0) y += lh * 0.4; items.push({ k: 'line', y, text: l.text }); y += lh; });
    y += 14;
  });
  return { items, contentH: y + 8, fs, lh, secFs };
}
const docCache = new Map();
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.72);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}`;
  let doc = docCache.get(pkey);
  if (!doc) { doc = buildDoc(ctx, list, sc); docCache.set(pkey, doc); }
  const R = READER;
  R.max = Math.max(0, doc.contentH - R.h);
  if (state.ui.keepFrac != null) { state.ui.scroll = state.ui.keepFrac * R.max; state.ui.keepFrac = null; }
  state.ui.scroll = Math.max(0, Math.min(R.max, state.ui.scroll));
  const scroll = state.ui.scroll;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,243,224,0.97)', stroke: 'rgba(120,92,36,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const pcx = PANEL.x + PANEL.w / 2;
  ctx.fillStyle = '#9a3a14'; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(90,70,30,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 50, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 50, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  for (const it of doc.items) {
    const y = R.y + it.y - scroll;
    if (it.k === 'line') {
      if (y > R.y + R.h || y + doc.lh < R.y) continue;
      ctx.fillStyle = C.ink; ctx.font = `400 ${doc.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 32, y + doc.fs * 0.85);
    } else if (it.k === 'title') {
      if (y > R.y + R.h || y + it.h < R.y) continue;
      ctx.textAlign = 'center'; ctx.fillStyle = '#b8431c'; ctx.font = `700 ${doc.secFs}px ${FONT}`;
      it.lines.forEach((l, k) => ctx.fillText(l, pcx, y + doc.secFs * (0.9 + k * 1.2) - 4));
    } else if (it.k === 'rule') {
      ctx.strokeStyle = 'rgba(90,70,30,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, y); ctx.lineTo(PANEL.x + PANEL.w - 60, y); ctx.stroke();
    } else if (it.k === 'art') {
      if (y > R.y + R.h || y + ART_H < R.y) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, ART_H - 6); ctx.clip(); drawArt(it.key, ctx, PANEL.x + 34, y, PANEL.w - 68, ART_H - 12, state); ctx.restore();
    }
  }
  ctx.restore();
  if (R.max > 0) {
    // scroll bar, a fade and a "more" / "up" pill so it is obvious that the text goes on
    const th = Math.max(60, R.h * (R.h / doc.contentH)), ty = R.y + (scroll / R.max) * (R.h - th);
    roundPath(ctx, PANEL.x + PANEL.w - 12, ty, 6, th, 3); ctx.fillStyle = 'rgba(90,70,30,0.55)'; ctx.fill();
    const cx = PANEL.x + PANEL.w / 2;
    if (scroll < R.max - 4) {
      const g = ctx.createLinearGradient(0, R.y + R.h - 80, 0, R.y + R.h); g.addColorStop(0, 'rgba(248,243,224,0)'); g.addColorStop(1, 'rgba(248,243,224,0.95)');
      ctx.fillStyle = g; ctx.fillRect(R.x + 4, R.y + R.h - 80, R.w - 24, 78);
      roundPath(ctx, cx - 56, R.y + R.h - 44, 112, 34, 17); ctx.fillStyle = 'rgba(40,30,12,0.88)'; ctx.fill();
      ctx.fillStyle = '#fff3cf'; ctx.font = `700 ${Math.max(22, Math.ceil(FLOOR.v))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u25bc more', cx, R.y + R.h - 26);
    }
    if (scroll > 4) {
      const g2 = ctx.createLinearGradient(0, R.y, 0, R.y + 56); g2.addColorStop(0, 'rgba(248,243,224,0.96)'); g2.addColorStop(1, 'rgba(248,243,224,0)');
      ctx.fillStyle = g2; ctx.fillRect(R.x + 4, R.y, R.w - 24, 56);
      roundPath(ctx, cx - 44, R.y + 6, 88, 34, 17); ctx.fillStyle = 'rgba(40,30,12,0.88)'; ctx.fill();
      ctx.fillStyle = '#fff3cf'; ctx.font = `700 ${Math.max(22, Math.ceil(FLOOR.v))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u25b2 up', cx, R.y + 23);
    }
  }
  drawButton(ctx, TEXT_DEC, 'A\u2212', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff6dc'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, G.zoomLabel.x, G.zoomLabel.y);
  const atEnd = R.max <= 0 || scroll >= R.max - 4, bsz = G.land ? 28 : 32;
  drawButton(ctx, REF_BACK, 'Back', { size: bsz });
  drawButton(ctx, REF_NEXT, atEnd ? 'Done' : 'Next page', { primary: true, size: bsz });
}

// ---- illustrations: top-down diagrams drawn with the game's own pitch numbers -----------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff2cf', align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${Math.max(size, Math.ceil(FLOOR.v))}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
const stage = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2f7a3d'); g.addColorStop(1, '#3f9448');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,230,0.5)'; ctx.lineWidth = 2; ctx.stroke();
};
// A pitch from above: (ox, oy) top-left, k = pixels per metre. y runs from team 1's baseline (top) to team 0's baseline (bottom).
function pitch(ctx, ox, oy, k) {
  const w = FIELD.W * k, h = FIELD.L * k;
  ctx.strokeStyle = 'rgba(255,255,248,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, w, h);
  ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,248,0.45)'; ctx.beginPath(); ctx.moveTo(ox, oy + h / 2); ctx.lineTo(ox + w, oy + h / 2); ctx.stroke(); ctx.setLineDash([]);
}
const px = (ox, oy, k, x, y) => ({ x: ox + (x + FIELD.W / 2) * k, y: oy + (FIELD.L - y) * k });
function kubbDot(ctx, p, team, k, o = {}) {
  const s = Math.max(11, KUBB.w * k * 1.75);
  ctx.save();
  if (o.ghost) { ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,230,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s); ctx.restore(); return; }
  ctx.translate(p.x, p.y); if (o.down) ctx.rotate(0.6);
  ctx.fillStyle = TEAM[team].main; ctx.fillRect(-s / 2, -s / 2, s, o.down ? s * 1.5 : s);
  ctx.lineWidth = o.hot ? 3 : 1.5; ctx.strokeStyle = o.hot ? '#fff3a0' : 'rgba(30,18,6,0.8)'; ctx.strokeRect(-s / 2, -s / 2, s, o.down ? s * 1.5 : s);
  ctx.restore();
}
function kingDot(ctx, p, k, o = {}) {
  const s = Math.max(14, KING.w * k * 1.8);
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = o.down ? '#b88a4a' : '#e0a84a'; ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.lineWidth = 2; ctx.strokeStyle = '#6a3f10'; ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = '#fff1b0'; ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.2); ctx.lineTo(-s * 0.3, -s * 0.25); ctx.lineTo(-s * 0.12, 0); ctx.lineTo(0, -s * 0.3); ctx.lineTo(s * 0.12, 0); ctx.lineTo(s * 0.3, -s * 0.25); ctx.lineTo(s * 0.3, s * 0.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const K = (h - 16) / FIELD.L * 0.99, OX = 12, OY = 6;
  const base = (team, n = 5) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 0.64).map((xx) => ({ x: xx, y: team === 0 ? 0 : FIELD.L }));
  const P = (xx, yy) => px(OX, OY, K, xx, yy);
  const A = {
    layout() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(0).forEach((b) => kubbDot(ctx, P(b.x, b.y), 0, K)); base(1).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K));
      kingDot(ctx, P(0, FIELD.MID), K);
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'Five kubbs on each baseline,', tx, 60, 19, '#fff2cf', 'left'); label(ctx, 'the king in the middle.', tx, 84, 19, '#fff2cf', 'left');
      label(ctx, 'You throw from the bottom,', tx, 130, 19, '#fff2cf', 'left'); label(ctx, 'your opponent from the top.', tx, 154, 19, '#fff2cf', 'left');
      label(ctx, 'Blue', tx, 204, 20, TEAM[0].hi, 'left'); label(ctx, 'Orange', tx + 70, 204, 20, TEAM[1].hi, 'left');
    },
    batons() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(1, 3).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K, { hot: true })); kingDot(ctx, P(0, FIELD.MID), K);
      const a = P(-0.3, 0), b = P(0.64, FIELD.L - 0.2);
      ctx.setLineDash([2, 8]); arrow(ctx, a.x, a.y, b.x, b.y, '#ffe08a', 5); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, TAU); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4; ctx.stroke();
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'Drag back, let go:', tx, 70, 19, '#fff2cf', 'left'); label(ctx, 'the baton flies to the ring', tx, 94, 19, '#fff2cf', 'left'); label(ctx, 'and spins end over end.', tx, 118, 19, '#fff2cf', 'left');
    },
    throwin() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(1, 3).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K)); kingDot(ctx, P(0, FIELD.MID), K);
      [[-0.6, 2.1], [0.7, 1.7]].forEach(([xx, yy]) => { kubbDot(ctx, P(xx, yy), 0, K, { down: true }); });
      [[-0.7, 4.3], [0.6, 4.7]].forEach(([xx, yy]) => { const a = P(0, 0.35), b = P(xx, yy); arrow(ctx, a.x, a.y, b.x, b.y + 14, '#ffe08a', 3); kubbDot(ctx, b, 0, K, { hot: true }); });
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'Knocked-down kubbs', tx, 70, 19, '#fff2cf', 'left'); label(ctx, 'are thrown back into', tx, 94, 19, '#fff2cf', 'left'); label(ctx, 'the other half. They', tx, 118, 19, '#fff2cf', 'left'); label(ctx, 'stand where they land.', tx, 142, 19, '#fff2cf', 'left');
    },
    field() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(1, 3).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K, { ghost: false })); kingDot(ctx, P(0, FIELD.MID), K);
      [[-0.8, 4.3], [0.2, 4.7]].forEach(([xx, yy]) => kubbDot(ctx, P(xx, yy), 0, K, { hot: true }));
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'Order: field kubbs', tx, 70, 19, '#fff2cf', 'left'); label(ctx, 'first (bright), then', tx, 94, 19, '#fff2cf', 'left'); label(ctx, 'the baseline, then', tx, 118, 19, '#fff2cf', 'left'); label(ctx, 'the king.', tx, 142, 19, '#fff2cf', 'left');
    },
    advantage() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      base(1, 3).forEach((b) => kubbDot(ctx, P(b.x, b.y), 1, K)); kingDot(ctx, P(0, FIELD.MID), K);
      const f = P(0.5, 1.5); kubbDot(ctx, f, 1, K, { hot: true });
      ctx.setLineDash([8, 6]); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(OX, f.y); ctx.lineTo(OX + FIELD.W * K, f.y); ctx.stroke(); ctx.setLineDash([]);
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'An orange kubb was left', tx, 60, 19, '#fff2cf', 'left'); label(ctx, 'standing in your half.', tx, 84, 19, '#fff2cf', 'left'); label(ctx, 'You may throw from', tx, 124, 19, '#ffe08a', 'left'); label(ctx, 'the gold line through it.', tx, 148, 19, '#ffe08a', 'left');
    },
    king() {
      stage(ctx, 0, 0, w, h); pitch(ctx, OX, OY, K);
      kingDot(ctx, P(0, FIELD.MID), K, {});
      const a = P(0, 0), b = P(0, FIELD.MID);
      arrow(ctx, a.x, a.y - 8, b.x, b.y + 20, '#ffe08a', 4);
      const tx = OX + FIELD.W * K + 24;
      label(ctx, 'All the kubbs down?', tx, 60, 19, '#fff2cf', 'left'); label(ctx, 'Topple the king: you win.', tx, 84, 19, '#9fe8b4', 'left');
      label(ctx, 'King down too early?', tx, 134, 19, '#fff2cf', 'left'); label(ctx, 'You lose at once.', tx, 158, 19, '#ffb4a0', 'left');
    },
    controls() {
      stage(ctx, 0, 0, w, h);
      const cx = w * 0.3;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundPath(ctx, 14, 14, w * 0.55, h - 28, 14); ctx.fill();
      LOFTS.forEach((l, i) => { const bx = 24 + i * 112, by = 40; roundPath(ctx, bx, by, 104, 40, 10); ctx.fillStyle = i === 0 ? '#2f8f55' : '#1f2c1c'; ctx.fill(); label(ctx, `${l.name} loft`, bx + 52, by + 27, 16, '#fff7e6'); });
      SPINS.forEach((l, i) => { const bx = 24 + i * 112, by = 92; roundPath(ctx, bx, by, 104, 40, 10); ctx.fillStyle = i === 1 ? '#2f8f55' : '#1f2c1c'; ctx.fill(); label(ctx, `${l.name} spin`, bx + 52, by + 27, 16, '#fff7e6'); });
      label(ctx, 'Flat throws hit hard and', w * 0.62, 70, 18, '#fff2cf', 'left'); label(ctx, 'skid; lobs are steadier.', w * 0.62, 94, 18, '#fff2cf', 'left'); label(ctx, 'Spin decides how the', w * 0.62, 130, 18, '#fff2cf', 'left'); label(ctx, 'baton arrives.', w * 0.62, 154, 18, '#fff2cf', 'left');
      void cx;
    },
  };
  (A[key] ?? A.layout)();
  ctx.restore();
}
