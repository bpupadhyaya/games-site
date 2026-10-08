// Every screen that is not the play screen: title, set-up, settings, the tin (pick a conker for the next Cup duel), result, pause, the hint card, and the
// paginated About / How to Play / Rules reader with its illustrations (drawn with the game's own conkers). Pure drawing.
import { W, H, FR, RG, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, setupBottom, titleCol, flowOrigin } from './layout.js';
import { drawLockupImg, drawMoreLine } from './brand.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { makeCam, drawBackdrop, drawDuel, drawParts, drawConker, drawString, patchArgs, TAU } from './scene.js';
import { STEADY } from './ai.js';
import { KINDS, RIVALS, rivalConker, kindOf, countName, countLabel, stageOf, STAGE_NAMES, CUP_ROUNDS, tinLeft, weakFactor, WEAK_FLOOR, WEAK_BONUS } from './engine.js';
import { newSim, bobPos, PS, PD, L, R, PULL_MAX } from './sim.js';
import { ABOUT, HOWTO, RULES, LORE } from './content.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const topSafe = () => Math.max(0, FR.ins.t - 14);
const botSafe = () => Math.max(0, FR.ins.b - 14);
const sc_ = (state) => TEXT_SCALES[state.settings.textIdx];
export function flowSpec(state, key) {
  const land = FR.land, ins = FR.ins;
  switch (key) {
    case 'title':
      if (land) return { wd: titleWidgets(state, true), top: Math.max(16, ins.t + 10), bottom: H - Math.max(14, ins.b + 6), opts: { x: 0, w: titleCol().colW }, center: true };
      return { wd: titleWidgets(state, false), top: titleTop(), bottom: H };
    case 'setup': return { wd: setupWidgets(state), top: topSafe(), bottom: setupBottom() };
    case 'settings': return { wd: settingsWidgets(state), top: topSafe(), bottom: H - botSafe() };
    case 'pick': return { wd: pickWidgets(state), top: topSafe(), bottom: H - botSafe() };
    case 'result': return { wd: resultWidgets(state), top: topSafe(), bottom: H - botSafe() };
    case 'demolimit': return { wd: demoLimitWidgets(), top: topSafe(), bottom: H - botSafe() };
    case 'why': return { wd: whyWidgets(state), top: 90, bottom: H - 20, opts: { x: 50, w: 620 } };
    default: return null;
  }
}
const placeTop = (sp, contentH) => (sp.center && contentH < sp.bottom - sp.top ? sp.top + (sp.bottom - sp.top - contentH) / 2 : sp.top);
export function ensureLayout(state, key) {
  const sp = flowSpec(state, key);
  if (!sp) return;
  const lay = flowLayout(estCtx, sp.wd, TEXT_SCALES[state.settings.textIdx], sp.opts);
  LAID = { key, lay, top: placeTop(sp, lay.contentH), bottom: sp.bottom, h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// ---- the title: a living scene (a duel of friendly swings) and the name plate ---------------------------------------------------
export function drawAttractScene(ctx, state, x, y, w, h) {
  const a = state.att;
  if (!a || !a.sim) return;
  const cam = makeCam(x, y, w, h, false);
  drawDuel(ctx, cam, a.sim, a.c, 0, { flash: a.flash > 0 ? a.flash : 0 });
  drawParts(ctx, cam, a.parts);
}
function drawHero(ctx, cx, top, k = 1) {
  ctx.save(); ctx.translate(cx, top); ctx.scale(k, k);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(255,232,170,0.95)';
  spaced(ctx, "ENGLAND'S AUTUMN GAME", 0, 38, 6);
  const fs = 138; ctx.font = `800 italic ${fs}px ${NUM}`;
  const wC = ctx.measureText('C').width, wR = ctx.measureText('NKERS').width, r = fs * 0.31, gap = 4, total = wC + gap + r * 2 + gap + wR, x0 = -total / 2;
  const base = 168;
  ctx.lineJoin = 'round';
  const word = (s, x) => { ctx.textAlign = 'left'; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(40,16,4,0.9)'; ctx.strokeText(s, x, base); const g = ctx.createLinearGradient(0, base - fs * 0.75, 0, base); g.addColorStop(0, '#fff6d8'); g.addColorStop(1, '#f1c977'); ctx.fillStyle = g; ctx.fillText(s, x, base); };
  word('C', x0); word('NKERS', x0 + wC + gap + r * 2 + gap);
  drawConker(ctx, x0 + wC + gap + r, base - fs * 0.3, r, { psi: 1.4, rot: 0.4, seed: 5, dmg: 0 });
  // the name plate pill
  const pw = 330, ph = 46, py = 192;
  const pg = ctx.createLinearGradient(-pw / 2, 0, pw / 2, 0); pg.addColorStop(0, '#6a3b1a'); pg.addColorStop(1, '#a14d1f');
  roundPath(ctx, -pw / 2, py, pw, ph, ph / 2); ctx.fillStyle = pg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f0c25a'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.font = `800 26px ${FONT}`; ctx.fillStyle = '#ffe6a8'; spaced(ctx, 'STRING SMASH', 0, py + 32, 7);
  ctx.restore();
}
const HERO_H = 262;
const titleRowsH = (state) => (state.cup ? 200 : 106) + 360 + LOCK_H + 18;
function titleTop() { return Math.max(0, (H - 1280) * 0.25) + Math.max(0, FR.ins.t - 30); }
function titleGap(state) { return Math.max(250, Math.min(520, H - Math.max(0, FR.ins.b - 10) - 84 - (titleTop() + HERO_H + 20 + titleRowsH(state)))); }
const LOCK_H = 68;
const lockupWidget = () => ({ t: 'art', id: 'arcforge', hitW: 250, h: LOCK_H + 18, draw(ctx, w) { drawLockupImg(ctx, w / 2, 9, LOCK_H, { align: 'center' }); } });
export function titleWidgets(state, land = false) {
  const sound = state.settings.sound;
  const wd = [];
  if (!land) {
    wd.push({ t: 'art', h: HERO_H, draw(ctx, w) { drawHero(ctx, w / 2, 0, 1); } });
    const gh = titleGap(state);
    wd.push({ t: 'art', h: gh, draw(ctx, w, h) { drawAttractScene(ctx, state, -(FR.fox + 40), 0, FR.sw, h); } });
  }
  if (state.cup && !state.cup.done) {
    wd.push({ t: 'btn', id: 'continue', label: 'Continue the Cup', sub: `Round ${state.cup.round + 1} of ${CUP_ROUNDS}, ${tinLeft(state.cup)} conkers in the tin`, primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'cup', label: 'New Conker Cup', h: 80 });
  } else wd.push({ t: 'btn', id: 'cup', label: 'Conker Cup', sub: `${CUP_ROUNDS} rivals, one tin of conkers`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'duel', label: 'Quick Duel', row: 1 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  wd.push(lockupWidget());
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const two = s.mode === 'two';
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: two ? 'Two Players' : 'Quick Duel', size: 48 }];
  if (!two) {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9bf', size: 26 });
    RIVALS.forEach((r, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: r.name, sub: locked ? 'In the full game' : `${r.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : r.stars, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: two ? "Player 1's conker" : 'Your conker', bold: true, color: '#ffe9bf', size: 26 });
  KINDS.forEach((k, i) => wd.push({ t: 'btn', id: `k0${i}`, label: k.name, sub: k.short, active: s.kind[0] === i, h: 84 }));
  if (two) {
    wd.push({ t: 'p', label: "Player 2's conker", bold: true, color: '#ffe9bf', size: 26 });
    KINDS.forEach((k, i) => wd.push({ t: 'btn', id: `k1${i}`, label: k.name, sub: k.short, active: s.kind[1] === i, h: 84 }));
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-guide', label: st.guide ? 'Aim guide: On' : 'Aim guide: Off', sub: 'Says what a release right now would do, and shows the best moments', active: st.guide },
    { t: 'p', label: `Steadiness: ${STEADY[st.steady].name}`, bold: true, color: '#ffe9bf', size: 26 },
    ...STEADY.map((a, i) => ({ t: 'btn', id: `st${i}`, label: a.name, row: 12, active: st.steady === i })),
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Language: Play in English.', size: 22, color: 'rgba(255,233,191,0.8)' },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

// A card for one conker (rival or tin): picture on the left, name and numbers on the right. Drawn inside a flow widget, so (0,0) is its top left.
function conkerCard(ctx, w, h, c, o = {}) {
  const sc = o.sc ?? 1;
  panel(ctx, 0, 0, w, h - 6, { r: 20, fill: o.off ? 'rgba(60,36,20,0.7)' : 'rgba(239,226,189,0.96)', stroke: o.active ? '#2f8f55' : 'rgba(150,110,40,0.7)', lw: o.active ? 4 : 2.5 });
  const pr = Math.min((h - 6) * 0.34, 44);
  drawConker(ctx, 20 + pr, (h - 6) / 2, pr, { psi: c.psi, dmg: c.dmg, seed: o.seed ?? 3, alpha: c.dmg >= 1 ? 0.28 : 1 });
  const tx = 20 + pr * 2 + 18, tw = w - tx - 16;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const k = kindOf(c.kind);
  let fs = Math.round(32 * sc); ctx.font = `700 ${fs}px ${FONT}`; ctx.fillStyle = o.off ? '#e8d6b0' : C.ink;
  const title = o.title ?? k.name; while (ctx.measureText(title).width > tw && fs > 14) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillText(title, tx, 14 + fs * 0.9);
  let f2 = Math.round(24 * sc); ctx.font = `400 ${f2}px ${FONT}`; ctx.fillStyle = o.off ? '#d8c59c' : '#5a3a1a';
  const sub = o.sub ?? `${countName(c.count)}${c.count ? ` (${c.count} wins)` : ''} · ${STAGE_NAMES[stageOf(c)]}`;
  wrapLines(ctx, sub, tw).slice(0, 2).forEach((l, i) => ctx.fillText(l, tx, 14 + fs * 0.9 + f2 * 1.3 * (i + 1)));
  const bh = 10, by = h - 6 - 18 - bh; roundPath(ctx, tx, by, tw, bh, bh / 2); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
  if (c.dmg > 0) { roundPath(ctx, tx, by, Math.max(bh, tw * clamp(c.dmg, 0, 1)), bh, bh / 2); ctx.fillStyle = c.dmg >= 0.72 ? '#d8452a' : c.dmg >= 0.42 ? '#e8892a' : '#d8b13c'; ctx.fill(); }
}
export function pickWidgets(state) {
  const cup = state.cup, rv = RIVALS[cup.round], rc = rivalConker(cup.round), s = Math.min(1.5, sc_(state));
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: `Round ${cup.round + 1} of ${CUP_ROUNDS}`, size: 46 },
    { t: 'p', label: `Your rival: ${rv.name}`, bold: true, color: '#ffe9bf', size: 28 },
    { t: 'art', h: Math.round(150 * s), draw(ctx, w, h) { conkerCard(ctx, w, h, rc, { title: `${rv.name} · ${kindOf(rc.kind).name}`, sub: `${rv.tag}. ${countLabel(rc.count)}.`, sc: s * 0.9, seed: 9 }); } },
    { t: 'p', label: 'Choose a conker from your tin', bold: true, color: '#ffe9bf', size: 28 }];
  cup.tin.forEach((c, i) => {
    const gone = c.dmg >= 1;
    wd.push({ t: 'art', id: gone ? null : `tin${i}`, h: Math.round(150 * s), draw(ctx, w, h) { conkerCard(ctx, w, h, c, { off: gone, sub: gone ? 'Shattered: gone for good' : undefined, sc: s * 0.9, seed: 3 + i, active: cup.picked === i }); } });
  });
  wd.push({ t: 'gap', h: 6 }, { t: 'btn', id: 'cupquit', label: 'Leave the Cup', sub: 'It is kept; Continue is on the main menu', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

export function resultWidgets(state) {
  const r = state.res;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big || FR.land ? 8 : 40 }, { t: 'h', label: r.title, size: FR.land ? 50 : 60, cap: big ? 1.2 : 1.5, color: r.win ? '#ffd97a' : '#ffe9d0' }];
  if (r.big) wd.push({ t: 'h', label: r.big, size: FR.land ? 40 : 50, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  r.lines.forEach((l) => wd.push({ t: 'p', label: l, size: 25, cap: 2.2, color: l.startsWith('Lore') ? '#bff3ff' : 'rgba(255,243,214,0.95)' }));
  if (r.conker) wd.push({ t: 'art', h: 130, draw(ctx, w, h) { ctx.save(); drawConker(ctx, w / 2, h / 2, 52, { psi: 0.7, dmg: r.conker.dmg, seed: 3 }); ctx.restore(); } });
  wd.push({ t: 'gap', h: 12 });
  r.buttons.forEach((b, i) => wd.push({ t: 'btn', id: b.id, label: b.label, sub: b.sub, primary: i === 0, dark: i > 0, h: i === 0 ? 92 : 84 }));
  wd.push({ t: 'art', h: 56, draw(ctx, w) { drawMoreLine(ctx, w / 2, 30, 22); } });
  wd.push({ t: 'gap', h: 20 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.m && state.m.cfg.mode === 'cup' ? 'The Cup is kept' : 'This duel is ended', dark: true },
  ];
}
export function whyWidgets(state) {
  return [
    { t: 'h', label: state.why.title, size: 40 },
    { t: 'p', label: state.why.text, size: 26, color: '#e8fbff', align: 'left' },
    ...(state.m && state.m.cfg.mode === 'watch' ? [
      { t: 'p', label: `Thinking time: ${THINK_STEPS[state.settings.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
      { t: 'btn', id: 'wdec', label: 'Shorter', row: 5, disabled: state.settings.thinkIdx === 0 },
      { t: 'btn', id: 'winc', label: 'Longer', row: 5, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 },
    ] : []),
    ...(state.why.useHint ? [{ t: 'btn', id: 'wuse', label: 'Use this swing', primary: true, h: 88 }] : []),
    { t: 'btn', id: 'wclose', label: 'Close', primary: !state.why.useHint, dark: !!state.why.useHint, h: 88 },
    { t: 'gap', h: 20 },
  ];
}
export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the two short duels of the web demo. The full game on iPhone and Android has the whole Conker Cup, all four rivals, Two Players and your saved records.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}


// Everything below draws in FRAME coordinates (the whole design screen); a flow screen is drawn inside its column (flowOrigin).
export function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(28,15,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(28,15,6,${a})`); g.addColorStop(1, `rgba(28,15,6,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, FR.sw, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(28,15,6,0)'); g.addColorStop(1, 'rgba(28,15,6,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
const inColumn = (ctx, key, fn) => { ctx.save(); ctx.translate(flowOrigin(key), 0); const r = fn(); ctx.restore(); return r; };
// Draws one flow screen inside its column (the caller has NOT translated); registers its layout for hit-testing.
function drawFlowScreen(ctx, state, key) {
  const sp = flowSpec(state, key), sc = TEXT_SCALES[state.settings.textIdx];
  return inColumn(ctx, key, () => {
    const lay = flowLayout(ctx, sp.wd, sc, sp.opts);
    const top = placeTop(sp, lay.contentH), bottom = sp.bottom;
    LAID = { key, lay, top, bottom, h: lay.contentH };
    const maxScroll = Math.max(0, lay.contentH - (bottom - top));
    const scroll = Math.min(state.ui.scroll, maxScroll);
    drawFlow(ctx, lay, top, bottom, scroll);
    if (maxScroll > 0) {
      const o = sp.opts ?? { x: 40, w: 640 }, bx = o.x + o.w + (o.x >= 40 ? 30 : 12), cx0 = o.x - 30, cw0 = o.w + 60;
      const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
      roundPath(ctx, bx - 2, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, scroll, maxScroll, o.x >= 40 ? 0 : cx0, o.x >= 40 ? W : cw0);
    }
    return { scroll, maxScroll, lay };
  });
}

export function renderWhy(ctx, state) {
  scrim(ctx, 0.78);
  inColumn(ctx, 'why', () => {
    const top = 90, bottom = H - 20;
    panel(ctx, 20, top - 20, 680, bottom - top + 30, { r: 28, fill: 'rgba(44,24,10,0.97)', stroke: 'rgba(125,232,255,0.55)' });
    drawFlowScreenIn(ctx, state, 'why');
  });
}
// A flow screen whose column translation the caller already did (sheets and the why card sit on a panel).
function drawFlowScreenIn(ctx, state, key) {
  const sp = flowSpec(state, key), sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, sp.wd, sc, sp.opts), top = sp.top, bottom = sp.bottom;
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top)), scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
}


// ---- reference pages --------------------------------------------------------------------------
let PAGE_COUNT = 1;
export const pageCount = () => PAGE_COUNT;
// The reader is one continuous column: the pages are laid end to end, each one SLOT tall, and the window shows a part of it. The player can drag
// (or use the wheel, the arrow keys, Page Up / Down) to scroll to any line; Back / Next jump a whole page. The scroll bar on the right shows where
// the window is in the whole text. Its geometry (RG, layout.js) follows the live screen: in landscape the panel is wide and fills the height.
export const READER = { slot: 1, view: 1, max: 0 };

function buildPages(ctx, list, scale, pageH, tw) {
  const fs = Math.round(28 * scale), lh = fs * 1.28;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const avail = pageH;
  const pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, `${sec.title} (cont.)`, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art ? Math.min(270, Math.max(150, avail * 0.6)) : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    if (!cur || used + full > avail) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, art: part === 0 ? sec.art : null, artH: part === 0 ? artH : 0, lines: [], part };
      let h = titleH + blk.artH + 26;
      while (i < lines.length) {
        const add = lineH(lines[i], blk.lines.length);
        if (used + h + add > avail && (blk.lines.length > 0 || used > 0)) break;
        blk.lines.push({ ...lines[i] }); h += add; i++;
      }
      cur.blocks.push(blk); used += h;
      part++;
      if (i >= lines.length) break;
      newPage();
    }
  });
  return pages;
}
const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.72);
  inColumn(ctx, 'reader', () => drawReader(ctx, state, list, header));
}
function drawReader(ctx, state, list, header) {
  const sc = TEXT_SCALES[state.settings.textIdx], P = RG.panel;
  const tw = P.w - 80, pkey = `${header}:${sc}:${Math.round(RG.pageH)}:${Math.round(tw)}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc, RG.pageH, tw); pageCache.set(pkey, pages); if (pageCache.size > 30) pageCache.delete(pageCache.keys().next().value); }
  PAGE_COUNT = pages.length;
  const top = RG.vt, bottom = RG.vb, slot = RG.pageH + 24;
  READER.slot = slot; READER.view = bottom - top; READER.max = Math.max(0, pages.length * slot - READER.view);
  if (state.ui.rsKey !== pkey) { state.ui.rsKey = pkey; state.ui.rsPage = -1; }
  if (state.ui.rsPage !== state.page) { state.ui.rs = Math.min(READER.max, Math.max(0, Math.min(state.page, pages.length - 1) * slot)); state.ui.rsPage = state.page; }
  state.ui.rs = Math.min(READER.max, Math.max(0, state.ui.rs ?? 0));
  const rs = state.ui.rs;
  const idx = Math.min(pages.length - 1, Math.max(0, Math.round(rs / slot)));
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(250,244,224,0.97)', stroke: 'rgba(120,86,40,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.redDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, RG.hdr.x, RG.hdr.y);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, RG.hdr.line); ctx.lineTo(P.x + P.w - 60, RG.hdr.line); ctx.stroke();
  // the window on the text
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 10, top, P.w - 20, bottom - top); ctx.clip();
  pages.forEach((pg, pi) => {
    const y0 = RG.y0 + pi * slot - rs;
    if (y0 > bottom || y0 + slot < top) return;
    drawReaderPage(ctx, pg, state, y0);
  });
  ctx.restore();
  // fade at the top and the bottom edge of the window when there is more text beyond it
  if (rs > 2) { const g = ctx.createLinearGradient(0, top, 0, top + 26); g.addColorStop(0, 'rgba(250,244,224,0.95)'); g.addColorStop(1, 'rgba(250,244,224,0)'); ctx.fillStyle = g; ctx.fillRect(P.x + 10, top, P.w - 20, 26); }
  if (rs < READER.max - 2) { const g = ctx.createLinearGradient(0, bottom - 26, 0, bottom); g.addColorStop(0, 'rgba(250,244,224,0)'); g.addColorStop(1, 'rgba(250,244,224,0.95)'); ctx.fillStyle = g; ctx.fillRect(P.x + 10, bottom - 26, P.w - 20, 26); }
  // the scroll bar
  if (READER.max > 0) {
    const th = Math.max(54, (bottom - top) * ((bottom - top) / (pages.length * slot))), ty = top + (rs / READER.max) * (bottom - top - th);
    roundPath(ctx, P.x + P.w - 18, top, 8, bottom - top, 4); ctx.fillStyle = 'rgba(110,76,40,0.16)'; ctx.fill();
    roundPath(ctx, P.x + P.w - 18, ty, 8, th, 4); ctx.fillStyle = 'rgba(140,31,27,0.7)'; ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}${READER.max > 0 ? '  ·  drag to scroll' : ''}`, RG.counter.x, RG.counter.y);
  const sz = RG.land ? 28 : 30;
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: sz });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: sz });
  const pc = `${Math.round(sc * 100)}%`;
  ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  if (RG.land) { ctx.fillStyle = C.redDark; ctx.fillText(pc, RG.pct.x, RG.pct.y); } else { ctx.fillStyle = '#fff3d6'; textShadow(ctx, pc, RG.pct.x, RG.pct.y, '#fff3d6', 4); }
  drawButton(ctx, REF_BACK, idx === 0 && rs < 4 ? 'Close' : 'Back', { size: RG.land ? 28 : 32 });
  drawButton(ctx, REF_NEXT, rs >= READER.max - 4 ? 'Done' : 'Next', { primary: true, size: RG.land ? 28 : 32 });
}
function drawReaderPage(ctx, pg, state, y0) {
  const P = RG.panel, cx = P.x + P.w / 2;
  let y = y0;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 80, y - 8); ctx.lineTo(P.x + P.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.red; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(blk.part > 0 || k < blk.tl.length - 1 ? l : l.replace(/ ?\(cont\.\)$/, ''), cx, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(P.x + 20, y, P.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, P.x + 40, y, P.w - 80, blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, P.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
}


function backdrop(ctx, state, a) {
  drawBackdrop(ctx, FR.sw, H, state.t, H * 0.74);
  scrim(ctx, a);
}
export function renderTitle(ctx, state) {
  drawBackdrop(ctx, FR.sw, H, state.t, FR.land ? H * 0.78 : H * 0.66);
  const sw = FR.sw, ins = FR.ins;
  if (!FR.land) {
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H); g.addColorStop(0, 'rgba(28,15,6,0)'); g.addColorStop(0.3, 'rgba(28,15,6,0.78)'); g.addColorStop(1, 'rgba(28,15,6,0.94)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, sw, H * 0.5);
    const t = ctx.createLinearGradient(0, 0, 0, 300); t.addColorStop(0, 'rgba(28,15,6,0.62)'); t.addColorStop(1, 'rgba(28,15,6,0)'); ctx.fillStyle = t; ctx.fillRect(0, 0, sw, 300);
    drawFlowScreen(ctx, state, 'title');
  } else {
    const { colX } = titleCol();
    const g = ctx.createLinearGradient(colX - 90, 0, colX - 10, 0); g.addColorStop(0, 'rgba(28,15,6,0)'); g.addColorStop(1, 'rgba(28,15,6,0.84)');
    ctx.fillStyle = g; ctx.fillRect(colX - 90, 0, 80, H); ctx.fillStyle = 'rgba(28,15,6,0.84)'; ctx.fillRect(colX - 10, 0, sw - colX + 10, H);
    const cxL = (colX + ins.l) / 2, k = Math.min(1, (colX - 40 - ins.l) / 560, (H - 80) / 520);
    const heroTop = Math.max(ins.t + 8, 14);
    drawHero(ctx, cxL, heroTop, k);
    const sy = heroTop + 252 * k, sx = ins.l + 10;
    drawAttractScene(ctx, state, sx, sy, colX - 40 - ins.l, Math.max(120, H - sy - 20 - Math.max(0, ins.b - 8)));
    drawFlowScreen(ctx, state, 'title');
  }
  ctx.textAlign = 'center'; ctx.font = `400 20px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText('Web demo', FR.land ? titleCol().colX / 2 : sw / 2, H - 6 - Math.max(0, ins.b - 10));
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.68);
  drawFlowScreen(ctx, state, 'setup');
  const y0 = SETUP_PINS.start.y - 34;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(28,15,6,0)'); g.addColorStop(0.2, 'rgba(28,15,6,0.88)'); g.addColorStop(1, 'rgba(28,15,6,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, FR.sw, H - y0);
  inColumn(ctx, 'setup', () => {
    const zz = TEXT_SCALES[state.settings.textIdx];
    drawButton(ctx, SETUP_PINS.start, 'Start the duel', { primary: true, size: Math.round(32 * Math.min(zz, 1.7)) });
    drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: Math.round(28 * Math.min(zz, 2)) });
    if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, SETUP_PINS.start.y - 12 + (FR.land ? -4 : 0)); }
  });
}
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'settings'); }
export function renderPick(ctx, state) { backdrop(ctx, state, 0.72); drawFlowScreen(ctx, state, 'pick'); }
export function renderResult(ctx, state) { backdrop(ctx, state, 0.8); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.58);
  inColumn(ctx, 'pause', () => {
    const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
    const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
    const top = FR.land ? 16 : 70, bottom = H - (FR.land ? 16 : 70);
    const ch = Math.min(lay.contentH + 20, bottom - top);
    const y0 = Math.max(top, (H - ch) / 2);
    panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(44,24,10,0.95)', stroke: 'rgba(255,220,130,0.55)' });
    LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
    const maxScroll = Math.max(0, lay.contentH - ch);
    const sc0 = Math.min(state.ui.scroll, maxScroll);
    drawFlow(ctx, lay, y0, y0 + ch, sc0);
    scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
  });
}

// ---- illustrations: drawn with the game's own conkers ---------------------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 21, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${Math.max(size, 21)}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
const stage = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#cfd9b8'); g.addColorStop(0.6, '#efd9a0'); g.addColorStop(0.62, '#7a6430'); g.addColorStop(1, '#4a3a1c');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(120,86,40,0.8)'; ctx.lineWidth = 2; ctx.stroke();
};
function arrow(ctx, x0, y0, x1, y1, col = '#c5322c', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
const miniSim = (pull, dphi = 0.04) => newSim({ pull, hand: 0, delay: 1e9, flick: 0 }, { phi: dphi, om: 0 }, 1, 1, { A: 0.03, c: 0 });
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    duel() {
      stage(ctx, 0, 0, w, h);
      ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
      const cam = makeCam(0, 0, w, h, false), sim = miniSim(0.95);
      drawDuel(ctx, cam, sim, [{ psi: -0.6, dmg: 0, seed: 3 }, { psi: 0.9, dmg: 0.2, seed: 7 }], 0, {});
      ctx.restore();
      label(ctx, 'striker', w * 0.12, h - 14, 21, '#fff2cf'); label(ctx, 'defender', w * 0.86, h - 14, 21, '#fff2cf');
    },
    swing() {
      stage(ctx, 0, 0, w, h);
      ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
      const ch = h * 0.8, cam = makeCam(0, 0, w, ch, false), sim = miniSim(1.0);
      const ps = sim.ps, P = { x: cam.X(ps.x), y: cam.Y(ps.y) };
      drawDuel(ctx, cam, sim, [{ psi: -0.6, dmg: 0, seed: 3 }, { psi: 0.9, dmg: 0, seed: 7 }], 0, {});
      ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(60,30,10,0.75)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const p = bobPos(ps, -1.0 + (i / 30) * 1.6); i ? ctx.lineTo(cam.X(p.x), cam.Y(p.y)) : ctx.moveTo(cam.X(p.x), cam.Y(p.y)); }
      ctx.stroke(); ctx.setLineDash([]);
      const bp = bobPos(ps, -1.0);
      arrow(ctx, cam.X(bp.x) + 6, cam.Y(bp.y) + 34, cam.X(bp.x) + 6 + cam.k * 0.16, cam.Y(bp.y) + 62, '#c5322c', 4);
      arrow(ctx, P.x - 62, P.y + 22, P.x - 62, P.y - 22, '#1d5e37', 3);
      ctx.restore();
      label(ctx, '1 pull back', w * 0.17, h - 14, 21, '#fff2cf'); label(ctx, '2 hand up or down', w * 0.5, h - 14, 21, '#fff2cf'); label(ctx, '3 let go', w * 0.85, h - 14, 21, '#fff2cf');
    },
    patch() {
      stage(ctx, 0, 0, w, h);
      const r = Math.min(h * 0.2, w * 0.085), cy = h * 0.4, xs = [w * 0.2, w * 0.5, w * 0.8], psis = [Math.PI / 2, 0, -Math.PI / 2], mult = [WEAK_FLOOR + WEAK_BONUS, 1, WEAK_FLOOR];
      const txt = ['soft spot hit', 'a glance', 'far side hit'];
      xs.forEach((cx, i) => {
        // the hit comes from the left in every picture; the patch faces the hit when psi is +pi/2 for the defender (its own frame is mirrored)
        const pa = patchArgs(i === 1 ? -0.9 : psis[i], 0, true);
        drawConker(ctx, cx, cy, r, { psi: pa.psi, pdir: pa.pdir, dmg: 0, seed: 3 });
        arrow(ctx, cx - r * 2.3, cy, cx - r * 1.25, cy, '#c5322c', 5);
        label(ctx, `×${mult[i].toFixed(1)}`, cx, cy + r * 1.8, 26, '#fff2cf');
        label(ctx, txt[i], cx, cy + r * 1.8 + 28, 21, '#fff2cf');
      });
      label(ctx, 'The pale patch is the weak spot.', w / 2, 30, 22, '#4a2a10');
    },
    cracks() {
      stage(ctx, 0, 0, w, h);
      const n = 4, r = Math.min(h * 0.22, w / (n * 2.8)), cy = h * 0.4;
      [0, 0.25, 0.5, 0.8].forEach((d, i) => {
        const cx = w * (0.14 + i * 0.24);
        drawConker(ctx, cx, cy, r, { psi: 0.3, dmg: d, seed: 4 });
        label(ctx, STAGE_NAMES[stageOf({ dmg: d })], cx, cy + r * 1.9, 19, C.ink);
      });
      label(ctx, 'Then it shatters.', w / 2, h - 14, 22, '#fff2cf');
    },
    counts() {
      stage(ctx, 0, 0, w, h);
      const r = Math.min(h * 0.18, w / 14), cy = h * 0.34;
      const xs = [0.12, 0.34, 0.66, 0.88];
      const cs = [{ c: 1, n: 'a oner' }, { c: 2, n: 'a twoer' }, null, { c: 4, n: 'a fourer' }];
      cs.forEach((o, i) => { if (!o) return; drawConker(ctx, w * xs[i], cy, r, { psi: 0.4, dmg: 0, seed: 2 + i }); label(ctx, o.n, w * xs[i], cy + r * 1.9, 21, C.ink); });
      label(ctx, '+', w * 0.23, cy + 8, 34, '#7d1a16'); label(ctx, '+ 1  =', w * 0.5, cy + 8, 30, '#7d1a16');
      label(ctx, 'The winner takes the loser\'s count and one more.', w / 2, h - 18, 21, '#fff2cf');
    },
  };
  (A[key] ?? A.duel)();
  ctx.restore();
}
