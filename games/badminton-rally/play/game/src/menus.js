// Every screen that is not the play screen: title, setup, tournament, settings, result, pause and the scrolling About / How to Play /
// Rules reader with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size, and every rectangle comes
// from layout.js (the live screen size), so portrait, landscape and tablets all work and a rotation re-lays everything out.
import { W, H, TEXT_SCALES, THINK_STEPS, layoutFor, host } from './layout.js';
import { FONT, DISPLAY, C, UI, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, drawScrollBar } from './ui.js';
import { LEVELS, LENGTHS, RIVALS, STYLES, KITS, ROUND_NAMES, HL, HW, HWD, SHORT } from './consts.js';
import { drawMoreLine, edgeStroke } from './brand.js';
import { names } from './hud.js';

const TAU = Math.PI * 2;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
let lockup = null;
export const setLockup = (img) => { lockup = img; };
const curL = (state) => layoutFor(W, H, state.settings.textIdx);
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

function stack(ctx, parts, sc) {
  const items = []; let y = 0;
  for (const part of parts) {
    let hmax = 0;
    for (const c of part.cols || [part]) {
      const lay = flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w, btn: c.btn, pad: c.pad });
      for (const it of lay.items) items.push({ ...it, y: it.y + y });
      hmax = Math.max(hmax, lay.contentH);
    }
    y += hmax;
  }
  return { items, contentH: y };
}
function flowDef(ctx, key, state) {
  const L = curL(state), U = L.U, wide = L.land;
  const one = (widgets, o = {}) => ({ parts: [{ widgets, x: L.flow.x, w: L.flow.w }], top: U.y0, bottom: U.y1, center: wide, ...o });
  switch (key) {
    case 'title': { const c = L.title.col, tight = H < 1150; return { parts: [{ widgets: titleWidgets(state, c.w, L.title.wide), x: c.x, w: c.w, btn: tight ? 22 : undefined, pad: tight ? 22 : undefined }], top: c.top, bottom: c.bottom, center: true }; }
    case 'setup': {
      const bottom = L.setup.bottom;
      if (!wide) return { parts: [{ widgets: setupWidgets(state), x: L.flow.x, w: L.flow.w }], top: U.y0, bottom };
      const [hd, a, b] = setupWidgets(state, true), [c0, c1] = L.cols;
      return { parts: [{ widgets: hd, x: L.flow.x, w: L.flow.w }, { cols: [{ widgets: a, x: c0.x, w: c0.w }, { widgets: b, x: c1.x, w: c1.w }] }], top: U.y0, bottom, center: true };
    }
    case 'tourney': {
      if (!wide) return one(tourneyWidgets(state, false), { bottom: U.y1 });
      const [hd, a, b] = tourneyWidgets(state, true), [c0, c1] = L.cols;
      return { parts: [{ widgets: hd, x: L.flow.x, w: L.flow.w }, { cols: [{ widgets: a, x: c0.x, w: c0.w }, { widgets: b, x: c1.x, w: c1.w }] }], top: U.y0, bottom: U.y1, center: true };
    }
    case 'settings': {
      if (!wide) return one(settingsWidgets(state));
      const [hd, a, b] = settingsWidgets(state, true), [c0, c1] = L.cols;
      return { parts: [{ widgets: hd, x: L.flow.x, w: L.flow.w }, { cols: [{ widgets: a, x: c0.x, w: c0.w }, { widgets: b, x: c1.x, w: c1.w }] }], top: U.y0, bottom: U.y1, center: true };
    }
    case 'result': return one(resultWidgets(state, wide), { bottom: U.y1 - 56 });
    case 'demolimit': return one(demoLimitWidgets(wide));
    default: return null;
  }
}
function placeFlow(ctx, key, state) {
  const d = flowDef(ctx, key, state);
  if (!d) return null;
  UI.minf = curL(state).minf; UI.minb = curL(state).minb;
  const lay = stack(ctx, d.parts, TEXT_SCALES[state.settings.textIdx]);
  let top = d.top;
  const room = d.bottom - d.top;
  if (d.center && lay.contentH < room) top = d.top + (room - lay.contentH) / 2;
  return { key, lay, top, bottom: d.bottom, win: d.top, h: lay.contentH };
}
export function ensureLayout(state, key) {
  const L = curL(state);
  if (LAID.key === key && LAID.lay && LAID.lkey === L.key + '|' + state.layVer) return;
  const p = placeFlow(estCtx, key, state);
  if (!p) return;
  LAID = { ...p, lkey: L.key + '|' + state.layVer };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

// ---- shuttle drawing (title art, rules art) ----------------------------------------------------------------------------------------
export function drawShuttle(ctx, cx, cy, size, rot = -0.6) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); const k = size / 100;
  // feather skirt (a flared cone), then the cork head
  const g = ctx.createLinearGradient(-40 * k, 0, 40 * k, 0); g.addColorStop(0, '#d9e3ea'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#c7d3dc');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(16,32,47,0.55)'; ctx.lineWidth = 2 * k;
  ctx.beginPath(); ctx.moveTo(-9 * k, -8 * k); ctx.lineTo(-42 * k, -86 * k); ctx.quadraticCurveTo(0, -102 * k, 42 * k, -86 * k); ctx.lineTo(9 * k, -8 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1.6 * k; ctx.strokeStyle = 'rgba(16,32,47,0.35)';
  for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 2.2 * k, -8 * k); ctx.lineTo(i * 9.6 * k, -92 * k + Math.abs(i) * 1.4 * k); ctx.stroke(); }
  ctx.strokeStyle = '#6a7d8a'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(-40 * k, -70 * k); ctx.quadraticCurveTo(0, -60 * k, 40 * k, -70 * k); ctx.stroke();
  const cg = ctx.createRadialGradient(-4 * k, 6 * k, 2, 0, 8 * k, 20 * k); cg.addColorStop(0, '#f3d9a8'); cg.addColorStop(1, '#a8743a');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 6 * k, 18 * k, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(16,32,47,0.5)'; ctx.lineWidth = 2 * k; ctx.stroke();
  ctx.restore();
}
function drawHero(ctx, cx, y0, w) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const k = Math.min(1, w / 640);
  ctx.font = `700 ${Math.round(34 * k)}px ${FONT}`; ctx.fillStyle = '#7fe8d6'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('SWIPE · SMASH · WIN', cx, y0 + 70 * k);
  ctx.font = `700 ${Math.round(98 * k)}px ${DISPLAY}`; ctx.fillStyle = '#fff6e4'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Badminton', cx, y0 + 190 * k);
  ctx.font = `800 ${Math.round(108 * k)}px ${FONT}`; const g = ctx.createLinearGradient(cx - 200 * k, 0, cx + 200 * k, 0); g.addColorStop(0, '#7fe8d6'); g.addColorStop(1, '#ffd97a'); ctx.fillStyle = g;
  ctx.fillText('RALLY', cx, y0 + 318 * k);
  ctx.shadowBlur = 0; drawShuttle(ctx, cx + 210 * k, y0 + 250 * k, 78 * k, 0.9);
  ctx.restore();
}
const heroArt = () => { const hk = H < 1100 ? 0.58 : H < 1200 ? 0.74 : 1; return { t: 'art', h: Math.round(360 * hk), draw(ctx, w) { ctx.save(); ctx.scale(hk, hk); drawHero(ctx, w / hk / 2, 0, w / hk); ctx.restore(); } }; };

export function titleWidgets(state, colW, wide = false) {
  const sv = state.saved, tr = state.tour, tight = H < 1150, bh = tight ? 62 : 84;
  const tsub = tr && !tr.over ? `${ROUND_NAMES[tr.round]} · next: ${RIVALS[tr.rivalIds[tr.round]].name}` : tr && tr.over ? (tr.champion ? 'Champion! Start a new one' : 'Start a new one') : 'Eight rivals, three rounds';
  return [
    ...(wide ? [] : [heroArt()]),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `${sv.oppName} · ${sv.score[0]}-${sv.score[1]}${sv.gamesTotal > 1 ? ` · game ${sv.gameNo}` : ''}`, primary: true, h: tight ? 62 : 88 }] : []),
    { t: 'btn', id: 'play', label: 'Quick match', primary: !sv, h: tight ? 62 : H < 1200 ? 72 : 88, sub: 'Five levels · 11 or 21 points' },
    { t: 'btn', id: 'tour', label: 'Tournament', h: bh, sub: tsub },
    { t: 'btn', id: 'rally', label: 'Rally challenge', h: bh, sub: `Longest run of returns: ${(state.record.rallyBest | 0)}` },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', h: bh, sub: 'Two computer players, with the reasons' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2, h: tight ? 54 : undefined },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2, h: tight ? 54 : undefined },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: tight ? 54 : undefined },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3, h: tight ? 54 : undefined },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3, h: tight ? 54 : undefined },
  ];
}

export function setupWidgets(state, split = false) {
  const s = state.setup, watch = s.watch;
  const head = [{ t: 'gap', h: 10 }, { t: 'h', label: watch ? 'Watch & Learn' : 'Quick match', size: 48 }];
  const wd = split ? [] : head, right = [];
  wd.push({ t: 'p', label: watch ? 'Near player level' : 'Opponent', bold: true, color: '#ffe9a0', size: 26 });
  LEVELS.slice(1).forEach((l, i) => {
    const locked = state.demo && i > 2 && !watch;
    if (watch) wd.push({ t: 'btn', id: `near${i + 1}`, label: l.name, sub: `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.watchA === i + 1, h: 76 });
    else wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 76 });
  });
  const oc = split ? right : wd;
  if (watch) {
    oc.push({ t: 'p', label: 'Far player level', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.slice(1).forEach((l, i) => oc.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i + 1, h: 76 }));
  } else {
    oc.push({ t: 'p', label: 'Length', bold: true, color: '#ffe9a0', size: 26 });
    for (const id of ['to11', 'to21', 'bo3']) oc.push({ t: 'btn', id: `len-${id}`, label: LENGTHS[id].name, active: s.len === id, disabled: state.demo && id !== 'to11', hitDisabled: true, sub: state.demo && id !== 'to11' ? 'In the full game' : '' });
  }
  wd.push({ t: 'gap', h: 24 }); right.push({ t: 'gap', h: 24 });
  return split ? [head, wd, right] : wd;
}

export function tourneyWidgets(state, split = false) {
  const tr = state.tour;
  const head = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Tournament', size: 48 }];
  if (!tr) return split ? [head, [], []] : head;
  const bracket = { t: 'art', h: Math.round(Math.max(300, Math.min(470, H * 0.34))), draw(ctx, w, h) { drawBracket(ctx, state, w, h); } };
  const rv = RIVALS[tr.rivalIds[tr.round] ?? 0], lvl = LEVELS[rv.level];
  const left = [bracket];
  const right = [];
  if (tr.over) {
    right.push({ t: 'h', label: tr.champion ? 'Champion!' : 'Knocked out', size: 46, color: tr.champion ? '#ffd97a' : '#ffb59a' });
    right.push({ t: 'p', label: tr.champion ? 'You won all three rounds and the trophy.' : `You lost the ${ROUND_NAMES[tr.round].toLowerCase()} to ${rv.name}.`, size: 26 });
    right.push({ t: 'btn', id: 'tour-new', label: 'New tournament', primary: true, h: 88 });
  } else {
    right.push({ t: 'h', label: ROUND_NAMES[tr.round], size: 42, color: '#ffd97a' });
    right.push({ t: 'p', label: `${rv.name}, ${rv.country}`, bold: true, size: 30 });
    right.push({ t: 'p', label: `${STYLES[rv.style].name} · ${lvl.name} ${'★'.repeat(lvl.stars)}`, size: 24, color: '#7fe8d6' });
    right.push({ t: 'p', label: STYLES[rv.style].blurb, size: 24 });
    right.push({ t: 'btn', id: 'tour-play', label: tr.round === 0 && !tr.started ? 'Play the first match' : 'Play the match', primary: true, h: 92, sub: `One game to 15` });
    right.push({ t: 'btn', id: 'tour-new', label: 'Draw a new tournament', dark: true, h: 72 });
  }
  right.push({ t: 'btn', id: 'back', label: 'Back', dark: true, h: 76 });
  right.push({ t: 'gap', h: 30 });
  return split ? [head, left, right] : [...head, ...left, ...right];
}
function drawBracket(ctx, state, w, h) {
  const tr = state.tour; if (!tr) return;
  const head = 34, top = head + 6, rowH = (h - top) / 8, colW = w / 4;
  const fs = Math.max(UI.minf, Math.min(30, rowH * 0.56));
  ctx.save();
  const nm = (id) => (id === 'you' ? 'You' : RIVALS.find((r) => r.id === id).name.split(' ')[0]);
  const pos = (round, i) => { const span = Math.pow(2, round); return { x: round * colW, y: top + (i * span + span / 2) * rowH }; };
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ['Quarter', 'Semi', 'Final', 'Winner'].forEach((t, r) => { ctx.font = `700 ${Math.max(UI.minf, 20)}px ${FONT}`; ctx.fillStyle = r === tr.round && !tr.over ? '#ffd97a' : 'rgba(255,246,228,0.6)'; ctx.fillText(t, r * colW + 8, head / 2); });
  ctx.strokeStyle = 'rgba(255,246,228,0.45)'; ctx.lineWidth = 3;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 8 / Math.pow(2, r); i += 2) {
    const a = pos(r, i), b = pos(r, i + 1), n = pos(r + 1, i / 2), xe = a.x + colW - 10;
    ctx.beginPath(); ctx.moveTo(xe - 4, a.y); ctx.lineTo(xe + 4, a.y); ctx.lineTo(xe + 4, b.y); ctx.moveTo(xe - 4, b.y); ctx.lineTo(xe + 4, b.y); ctx.moveTo(xe + 4, n.y); ctx.lineTo(n.x + 4, n.y); ctx.stroke();
  }
  ctx.font = `700 ${fs}px ${FONT}`;
  for (let r = 0; r < 4; r++) for (let i = 0; i < 8 / Math.pow(2, r); i++) {
    const id = tr.bracket[r] ? tr.bracket[r][i] : null; if (!id) continue;
    const p = pos(r, i), you = id === 'you', cur = r === tr.round && you && !tr.over;
    roundPath(ctx, p.x + 4, p.y - rowH * 0.42, colW - 20, rowH * 0.84, 10);
    ctx.fillStyle = you ? 'rgba(31,168,150,0.97)' : 'rgba(20,34,52,0.92)'; ctx.fill();
    ctx.lineWidth = cur ? 3.5 : 1.5; ctx.strokeStyle = cur ? '#ffd97a' : 'rgba(255,246,228,0.25)'; ctx.stroke();
    ctx.fillStyle = '#fff6e4'; let t = nm(id); while (ctx.measureText(t).width > colW - 40 && t.length > 3) t = t.slice(0, -1);
    ctx.fillText(t, p.x + 14, p.y + 1);
  }
  ctx.restore();
}

export function settingsWidgets(state, split = false) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const all = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'btn', id: 'kit-next', label: `Your kit: ${KITS[st.kitIdx | 0].name} (tap to change)` },
    { t: 'btn', id: 'who-next', label: `Your player: ${st.female ? 'Woman' : 'Man'} (tap to change)` },
    { t: 'p', label: 'The level and the length are chosen when a match starts.', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  if (!split) return all;
  const i = all.findIndex((w) => w.id === 'kit-next');
  return [all.slice(0, 2), all.slice(2, i), all.slice(i)];
}

export function resultWidgets(state, wide = false) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const nm = names(state);
  const mode = state.setup.lastMode;
  const youWin = s.winner === 0;
  let title;
  if (state.mode === 'watch') title = `${s.winner === 0 ? 'The near player' : 'The far player'} wins`;
  else if (s.mode === 'rally') title = 'Rally over';
  else title = youWin ? 'You win!' : `${nm[1]} wins`;
  const wd = [{ t: 'gap', h: wide ? 10 : big ? 24 : 90 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  if (s.mode === 'rally') {
    wd.push({ t: 'h', label: String(s.challenge.returns), size: 110, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `shuttles returned in a row. Best ever: ${state.record.rallyBest | 0}.`, size: 28 });
    if (state.newBest) wd.push({ t: 'p', label: 'A new personal best!', size: 28, color: '#7fe8d6', bold: true });
  } else {
    const gl = state.gameLog || [];
    wd.push({ t: 'h', label: s.gamesTotal > 1 ? `${s.games[0]} – ${s.games[1]}` : `${s.score[0]} – ${s.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    if (s.gamesTotal > 1 && gl.length) wd.push({ t: 'p', label: gl.map((g) => `${g[0]}-${g[1]}`).join('   '), size: 26, color: '#fff6e4' });
    const a = s.stats[0], b = s.stats[1];
    wd.push({ t: 'p', label: `Shots ${a.shots}-${b.shots} · smashes ${a.smashes}-${b.smashes} · winners ${a.winners}-${b.winners} · errors ${a.errors}-${b.errors}. Perfect swipes: ${a.perfect}. Longest rally: ${s.bestRally}.`, size: 24, cap: big ? 2 : 3 });
  }
  wd.push({ t: 'gap', h: 20 });
  if (state.tourMatch) {
    const tr = state.tour;
    wd.push({ t: 'btn', id: 'tour-cont', label: tr && tr.over ? (tr.champion ? 'Collect the trophy' : 'Back to the tournament') : 'Next round', primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else {
    wd.push({ t: 'btn', id: 'again', label: s.mode === 'rally' ? 'Try again' : 'Rematch', primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'new', label: mode === 'watch' ? 'Watch another' : 'New match', row: 6 });
    wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  }
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state, split = false) {
  const st = state.settings;
  const all = [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: state.mode === 'ai' ? 'Save and quit to menu' : 'Quit to menu', dark: true },
  ];
  if (!split) return all;
  const i = all.findIndex((w) => w.id === 'p-rules'), q = all.length - 1;
  return [[all[0], all[1], all[q]], all.slice(i, q)];
}

export function demoLimitWidgets(wide = false) {
  return [
    { t: 'gap', h: wide ? 20 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has all five levels, the tournament, longer matches and the full Rally Challenge.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,14,26,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,14,26,${a})`); g.addColorStop(1, `rgba(6,14,26,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2, fs = Math.max(UI.minf, 22), bw = Math.round(fs * 4), bh = Math.round(fs * 1.45);
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(1, 'rgba(6,14,26,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - bw / 2, bottom - bh - 8, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - bh / 2 - 8);
  } else if (scroll > 4) {
    roundPath(ctx, cx - bw / 2, top + 8, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 8 + bh / 2);
  }
}
function drawFlowScreen(ctx, state, key) {
  const L = curL(state), p = placeFlow(ctx, key, state);
  LAID = { ...p, lkey: L.key + '|' + state.layVer };
  const { lay, top, bottom } = p;
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, L.U.x1 - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(0, 0, W, H); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  const L = curL(state);
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(6,14,26,0.2)'); g.addColorStop(0.35, 'rgba(6,14,26,0.5)'); g.addColorStop(1, 'rgba(6,14,26,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (L.title.wide) {
    const c = L.title.col, hr = L.title.hero;
    const gl = ctx.createLinearGradient(c.x - 70, 0, c.x - 10, 0); gl.addColorStop(0, 'rgba(6,14,26,0)'); gl.addColorStop(1, 'rgba(6,14,26,0.55)');
    ctx.fillStyle = gl; ctx.fillRect(c.x - 70, 0, 60, H); ctx.fillStyle = 'rgba(6,14,26,0.55)'; ctx.fillRect(c.x - 10, 0, W - c.x + 10, H);
    drawHero(ctx, hr.cx, hr.cy - 190 * Math.min(1, hr.w / 640), hr.w);
  }
  drawFlowScreen(ctx, state, 'title');
  {
    const c = L.title.col, btns = LAID.lay.items.filter((i) => i.w && i.w.t === 'btn'), lcx = c.x + c.w / 2;
    const lw = Math.min(320, c.w - 40), lh = Math.round(lw * 327 / 1200);
    const ly = Math.min(L.U.y1 - lh - 14, LAID.top + Math.max(0, ...btns.map((i) => i.y + i.h)) + 20);
    const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
    titleLockTap = { x: lcx - tw / 2, y: ly + lh + 6 - th, w: tw, h: th };
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(6,14,26,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
    if (lockup && lockup.width) ctx.drawImage(lockup, lcx - lw / 2, ly, lw, lh);
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${Math.max(UI.minf, 18)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', L.land ? L.title.hero.cx : W / 2, L.lockup.y - 10); }
}
export function renderSetup(ctx, state) {
  const L = curL(state), S = L.setup;
  bg(ctx, 0.78);
  drawFlowScreen(ctx, state, 'setup');
  const y0 = S.bottom - 30;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(6,14,26,0)'); g.addColorStop(0.2, 'rgba(6,14,26,0.88)'); g.addColorStop(1, 'rgba(6,14,26,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  drawButton(ctx, S.start, state.setup.watch ? 'Watch the match' : 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, S.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(UI.minf, 22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, S.msgY); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings'); };
export const renderTourney = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'tourney'); };
export const renderResult = (ctx, state) => {
  ctx.clearRect(0, 0, W, H); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result');
  const L = curL(state); drawMoreLine(ctx, L.more.x, L.more.y, Math.max(UI.minf, 20));
};
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit'); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const L = curL(state), P = L.pause, sc = TEXT_SCALES[state.settings.textIdx];
  UI.minf = L.minf; UI.minb = L.minb;
  const inner = P.w - 60;
  let lay;
  if (P.cols) { const [a, b] = pauseWidgets(state, true), cw = (inner - 30) / 2; lay = stack(ctx, [{ cols: [{ widgets: a, x: P.x + 30, w: cw }, { widgets: b, x: P.x + 30 + cw + 30, w: cw }] }], sc); }
  else lay = stack(ctx, [{ widgets: pauseWidgets(state), x: P.x + 30, w: inner }], sc);
  const top = P.top + 40, bottom = P.bottom - 40;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, P.x, y0 - 20, P.w, ch + 40, { r: 30, fill: 'rgba(14,34,52,0.94)', stroke: 'rgba(255,246,228,0.45)' });
  edgeStroke(ctx, { x: P.x, y: y0 - 20, w: P.w, h: ch + 40 }, 30, 0.45);
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH, lkey: L.key + '|' + state.layVer };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { x0: P.x, w: P.w });
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, P.x, P.w);
}

// ---- reference pages ----------------------------------------------------------------------------------------------------------------
let RMETA = { max: 0, view: 800, key: '', rect: { x: 0, y: 0, w: 0, h: 0 } };
export const readerMeta = () => RMETA;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function buildReader(ctx, list, scale, box) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = box.w - 56;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 14;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y + 4 }); y += 26; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, secFs }); y += tl.length * secFs * 1.2 + 16;
    const artH = sec.art && scale < 2 ? 250 : 0;
    if (artH) { items.push({ k: 'art', y, h: artH - 12, art: sec.art }); y += artH; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l }); y += lh; });
    });
    y += 12;
  });
  return { items, h: y + 10, fs, lh };
}
const readerCache = new Map();
export function renderPages(ctx, state, list, header) {
  const L = curL(state), rd = L.reader, P = rd.panel, READER = rd.box;
  UI.minf = L.minf; UI.minb = L.minb;
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}:${Math.round(READER.w)}`;
  let r = readerCache.get(pkey);
  if (!r) { r = buildReader(ctx, list, sc, READER); readerCache.set(pkey, r); if (readerCache.size > 40) readerCache.delete(readerCache.keys().next().value); }
  const max = Math.max(0, r.h - READER.h);
  if (state.ui.keepFrac != null) { state.ui.scroll = state.ui.keepFrac * max; state.ui.keepFrac = null; }
  const scroll = clamp(state.ui.scroll, 0, max); state.ui.scroll = scroll;
  RMETA = { max, view: READER.h, key: pkey, rect: READER };
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(16,32,47,0.6)' });
  edgeStroke(ctx, P, 30, 0.4);
  const pcx = P.x + P.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, pcx, P.y + 58);
  ctx.strokeStyle = 'rgba(16,32,47,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, P.y + 78); ctx.lineTo(P.x + P.w - 60, P.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(READER.x, READER.y, READER.w, READER.h); ctx.clip();
  const x0 = READER.x + 28;
  for (const it of r.items) {
    const y = READER.y + it.y - scroll;
    const hh = it.k === 'title' ? it.lines.length * it.secFs * 1.2 + 16 : it.k === 'art' ? it.h : r.lh;
    if (y + hh < READER.y - 4 || y > READER.y + READER.h + 4) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(16,32,47,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 80, y); ctx.lineTo(P.x + P.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.secFs}px ${FONT}`; it.lines.forEach((l, k) => ctx.fillText(l, READER.x + (READER.w - 14) / 2, y + it.secFs * (0.9 + k * 1.2))); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(P.x + 20, y, P.w - 40, it.h + 4); ctx.clip(); drawArt(it.art, ctx, P.x + 40, y, P.w - 80, it.h); ctx.restore(); }
    else { ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `400 ${r.fs}px ${FONT}`; ctx.fillText(it.text, x0, y + r.fs * 0.85); }
  }
  ctx.restore();
  drawScrollBar(ctx, READER, scroll, max);
  if (max > 0 && scroll < max - 4) {
    const g = ctx.createLinearGradient(0, READER.y + READER.h - 60, 0, READER.y + READER.h); g.addColorStop(0, 'rgba(255,246,228,0)'); g.addColorStop(1, 'rgba(255,246,228,0.97)');
    ctx.fillStyle = g; ctx.fillRect(READER.x, READER.y + READER.h - 60, READER.w - 14, 60);
  }
  ctx.textAlign = 'center'; ctx.font = `400 ${Math.max(L.minf, 22)}px ${FONT}`; ctx.fillStyle = 'rgba(16,32,47,0.7)';
  const hint = max <= 0 ? 'Everything fits on this page' : scroll >= max - 4 ? 'End. Drag, swipe or use the arrow keys to scroll up.' : `Drag, swipe or use the arrow keys to scroll (${Math.round((scroll / max) * 100)}%)`;
  ctx.fillText(hint.length * 12 > P.w - 40 ? hint.replace(/^Drag, swipe or use the arrow keys to scroll/, 'Drag or use the arrow keys') : hint, pcx, P.y + P.h - 22);
  drawButton(ctx, rd.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, rd.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.max(L.minf, 24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, rd.pct.x, rd.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, rd.back, 'Close', { size: 32 });
  drawButton(ctx, rd.next, max <= 0 || scroll >= max - 4 ? 'Done' : 'Page down', { primary: true, size: 32 });
}

// ---- diagrams: drawn with the game's own geometry ---------------------------------------------------------------------------------------
function arrow(ctx, x0, y0, x1, y1, col = '#ffc94d', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function label(ctx, t, x, y, size = 18, col = '#fff6e4', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.fillText(t, x, y); ctx.restore();
}
function drawCourtTop(ctx, x, y, w, h) {
  // top-down singles court, length horizontal: x = z, y = court x
  const cw = 2 * HL, ch = 2 * HWD, s = Math.min((w - 20) / cw, (h - 64) / ch), cx = x + w / 2, cy = y + h / 2;
  const X = (z) => cx + z * s, Y = (px) => cy + px * s;
  ctx.fillStyle = '#237a6d'; ctx.fillRect(X(-HL), Y(-HWD), cw * s, ch * s);
  ctx.strokeStyle = '#f4f1e8'; ctx.lineWidth = 2;
  ctx.strokeRect(X(-HL), Y(-HWD), cw * s, ch * s); ctx.strokeRect(X(-HL), Y(-HW), cw * s, 2 * HW * s);
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(sg * SHORT), Y(-HW)); ctx.lineTo(X(sg * SHORT), Y(HW)); ctx.moveTo(X(sg * SHORT), Y(0)); ctx.lineTo(X(sg * HL), Y(0)); ctx.stroke(); }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X(0), Y(-HWD - 0.2)); ctx.lineTo(X(0), Y(HWD + 0.2)); ctx.stroke();
  return { X, Y, s };
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(16,32,47,0.94)'; ctx.fill();
  const A = {
    court() {
      const B = drawCourtTop(ctx, x, y, w, h);
      label(ctx, 'net', B.X(0), B.Y(-HWD) - 8, 15, '#fff'); label(ctx, `${(2 * HL).toFixed(1)} m long`, B.X(-HL * 0.5), B.Y(HWD) + 20, 15);
      label(ctx, 'short service line', B.X(SHORT) + 30, B.Y(HWD) + 20, 13, '#ffe9a0'); label(ctx, 'singles 5.18 m wide', B.X(-HL * 0.5), B.Y(-HWD) - 8, 13, '#ffe9a0');
      // service boxes
      ctx.fillStyle = 'rgba(255,226,122,0.28)'; ctx.fillRect(B.X(SHORT), B.Y(0), (HL - SHORT) * B.s, HW * B.s); ctx.fillRect(B.X(-HL), B.Y(-HW), (HL - SHORT) * B.s, HW * B.s);
      arrow(ctx, B.X(SHORT + 0.5), B.Y(HW * 0.5), B.X(-HL + 0.8), B.Y(-HW * 0.5), '#7fe8d6', 3);
      label(ctx, 'serve goes diagonally', B.X(-1), B.Y(0) + 34, 14, '#7fe8d6');
    },
    strokes() {
      const cw = w / 3;
      [['Short', 'drop · net shot', 1], ['Medium', 'clear · lift', 2], ['Long', 'smash · drive', 3]].forEach(([a, b, n], i) => {
        const cx = x + cw * (i + 0.5), by = y + h - 56, ty = by - (30 + n * 42);
        arrow(ctx, cx, by, cx, ty, i === 2 ? '#ff9a86' : i === 1 ? '#ffd97a' : '#7fe8d6', 7);
        ctx.beginPath(); ctx.arc(cx, by, 7, 0, TAU); ctx.fill();
        label(ctx, a, cx, by + 22, 17); label(ctx, b, cx, by + 42, 14, '#ffe9a0');
      });
    },
    ring() {
      const cx = x + w / 2, cy = y + h * 0.55;
      for (const [r, a] of [[78, 0.28], [52, 0.5]]) { ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.5, r * 0.55, 0, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(cx, cy, 30 * 1.5, 30 * 0.55, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 90); ctx.stroke();
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(cx, cy - 90, 8, 0, TAU); ctx.fill();
      label(ctx, 'swipe as the gold ring closes', cx, y + 28, 18, '#ffe27a'); label(ctx, 'EARLY', cx - 120, cy + 60, 14, '#ffd1a0'); label(ctx, 'PERFECT', cx, cy + 62, 14, '#ffe27a'); label(ctx, 'LATE', cx + 120, cy + 60, 14, '#ff9a86');
    },
  };
  (A[key] ?? A.court)();
  ctx.restore();
}
