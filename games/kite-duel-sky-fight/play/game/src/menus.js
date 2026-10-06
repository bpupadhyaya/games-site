// Every screen that is not the play screen: title, setup, settings, result, pause, and the scrolling About / How to
// play / Rules reader with its illustrations (drawn with the game's own kites and strings). Pure drawing; game.js owns
// state. Everything is laid out from the live screen (FL = layoutFor(width, height, textIdx)): portrait uses one
// centred 720-unit column, landscape puts the art on one side and the buttons on the other. The backdrop (the attract
// duel, or the round that just ended) is the real sky drawn to fill the whole screen.
import { K, SKIES, SKY_IDS, windAt } from './sim.js';
import { drawKite, KITE_PAL, SKY_PAL, stringColor } from './art.js';
import { drawScene } from './view.js';
import { TEXT_SCALES, THINK_STEPS, visibleWorld, MIN_TXT, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';
import { drawLockupImage, lockupHeight, drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------
// LAID is the screen being shown right now: parts (each a flow layout in its own region), pinned buttons, the scroll limit.
let LAID = { key: '', fkey: '', parts: [], pins: [], top: 0, bottom: 0, maxScroll: 0 };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

const heroArt = (hs, h) => ({
  t: 'art', h: Math.round(610 * hs),
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.scale(hs, hs);
    const cx = w / hs / 2;
    // dark backing panel: the title and tagline never sit directly over the moving attract-scene kites
    const pw = Math.min(w / hs - 8, 500);
    ctx.fillStyle = 'rgba(10,14,50,0.74)'; roundPath(ctx, cx - pw / 2, 28, pw, 358, 36); ctx.fill();
    ctx.font = `italic 700 150px ${DISPLAY}`;
    const g = ctx.createLinearGradient(0, 70, 0, 200); g.addColorStop(0, '#fffdf2'); g.addColorStop(1, '#ffd77a');
    ctx.save(); ctx.shadowColor = 'rgba(10,14,50,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    ctx.fillStyle = g; ctx.fillText('Kite', cx, 190); ctx.restore();
    ctx.font = `700 78px ${DISPLAY}`;
    const t = 'DUEL';
    ctx.save(); ctx.shadowColor = 'rgba(10,14,50,0.65)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ff6a4d';
    let x = cx - (ctx.measureText(t).width + 3 * 14) / 2;
    for (const ch of t) { ctx.textAlign = 'left'; ctx.fillText(ch, x, 276); x += ctx.measureText(ch).width + 14; }
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = `500 28px ${FONT}`; textShadow(ctx, 'The art of the cutting string', cx, 330, '#fff6e4', 8);
    ctx.strokeStyle = 'rgba(255,246,228,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 190, 360); ctx.lineTo(cx - 20, 360); ctx.moveTo(cx + 20, 360); ctx.lineTo(cx + 190, 360); ctx.stroke();
    ctx.fillStyle = '#fff6e4'; ctx.beginPath(); ctx.moveTo(cx, 348); ctx.lineTo(cx + 9, 360); ctx.lineTo(cx, 372); ctx.lineTo(cx - 9, 360); ctx.closePath(); ctx.fill();
    ctx.restore();
    void h;
  },
});

export function titleWidgets(state, hero = null) {
  const sound = state.settings.sound;
  const sv = state.saved;
  return [
    ...(hero ? [hero] : []),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue Duel', sub: `${sv.opp} · Round ${sv.round}${sv.rounds === 3 ? ` · ${sv.wins[0]}–${sv.wins[1]}` : ''}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a Duel', primary: !sv, h: 88 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two rivals duel while you learn why' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 },
  ];
}

const rivalSub = (pf, won, locked) => (locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`);
const LBL = { t: 'p', bold: true, color: '#ffe9a0', size: 26 };
function setupParts(state, land) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const rivals = [{ ...LBL, label: 'Choose your rival' }];
  PROFILES.forEach((pf, i) => {
    const locked = demo && i > 1;
    rivals.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: rivalSub(pf, (rec.wins ?? [])[i] ?? 0, locked), active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
  });
  const skies = [{ ...LBL, label: 'Choose the sky' }];
  SKY_IDS.forEach((id, k) => {
    const locked = demo && (id === 'dusk' || id === 'storm');
    skies.push({ t: 'btn', id: `sky${id}`, label: SKIES[id].name, sub: locked ? 'In the full game' : SKIES[id].blurb, active: s.sky === id && !locked, disabled: locked, hitDisabled: true, ...(land ? { row: 11 + (k >> 1) } : {}) });
  });
  const len = [{ ...LBL, label: 'Match length' }, { t: 'btn', id: 'len3', label: 'Best of 3', row: 9, active: s.rounds === 3 }, { t: 'btn', id: 'len1', label: 'Quick Duel', row: 9, active: s.rounds === 1 }];
  const head = [{ t: 'gap', h: 10 }, { t: 'h', label: 'New Duel', size: 48 }];
  return land ? [[...head, ...rivals, { t: 'gap', h: 14 }], [{ t: 'gap', h: 10 }, ...skies, ...len, { t: 'gap', h: 14 }]] : [[...head, ...rivals, ...skies, ...len, { t: 'gap', h: 24 }]];
}
export const setupWidgets = (state) => setupParts(state, false)[0];

function settingsParts(state, land) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const a = [
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm effects: On' : 'Calm effects: Off', sub: 'No flashes', active: st.calm },
    { ...LBL, label: `Text size: ${Math.round(sc * 100)}%` },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
  ];
  const b = [
    { ...LBL, label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s` },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  const head = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 }];
  return land ? [[...head, ...a], [{ t: 'gap', h: 10 }, ...b]] : [[...head, ...a, ...b]];
}
export const settingsWidgets = (state) => settingsParts(state, false)[0];

function resultParts(state, land) {
  const m = state.match, o = m.over, mode = m.cfg.mode;
  const winner = o.win;
  const nm = (s) => (mode === 'watch' ? PROFILES[s === 0 ? m.cfg.watchA : m.cfg.opp].name : s === 0 ? 'You' : PROFILES[m.cfg.opp].name);
  const title = mode === 'watch' ? `${nm(winner)} wins` : winner === 0 ? 'You win the duel!' : `${nm(1)} wins`;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const head = [{ t: 'h', label: title, size: 60, cap: big ? 1.15 : 1.4 }, { t: 'h', label: `${m.wins[0]} – ${m.wins[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  if (mode === 'ai') {
    const best = Math.round(m.stats.worst);
    const l1 = `Strings cut: ${m.stats.cuts}. Your string at its thinnest: ${best} of 100.`;
    const l2 = `Against ${PROFILES[m.cfg.opp].name}, you have won ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0}.`;
    head.push({ t: 'p', label: big ? `${l1} ${l2}` : l1, size: 26, cap: big ? 2 : 3 });
    if (!big) head.push({ t: 'p', label: l2, size: 26 });
  }
  const btns = [
    { t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 },
    { t: 'btn', id: 'new', label: 'New duel', row: 6 },
    { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true },
    { t: 'gap', h: 30 },
  ];
  if (land) return [head, btns];
  return [[{ t: 'gap', h: big ? 24 : 200 }, ...head, { t: 'gap', h: 24 }, ...btns]];
}
export const resultWidgets = (state) => resultParts(state, false)[0];

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have flown the free rounds of the web demo. The full game on iPhone and Android has every rival, every sky and unlimited duels.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// Builds the layout of the flow screen `key` for the live screen FL. Returns the LAID record (not yet stored).
function compose(ctx, state, key, FL) {
  const M = FL.menu, sc = TEXT_SCALES[state.settings.textIdx], land = FL.land;
  const parts = [], pins = [];
  let top = M.top + 6, bottom = FL.h - FL.ins.b - 8;
  const col = (widgets, o = {}) => parts.push({ widgets, x: M.colX, w: 720, o: { x: 40, w: 640 }, ...o });
  const regions = (n, weights = null) => {   // n side-by-side regions inside the margins, with a 24 unit gutter
    const gut = 24, tot = M.regionW - gut * (n - 1), ws = weights ?? Array(n).fill(1 / n);
    let x = M.regionX0;
    return ws.map((wt) => { const r = { x, w: Math.round(tot * wt) }; x += r.w + gut; return r; });
  };
  if (key === 'title') {
    const strip = lockupHeight(LOCKUP_W) + 30;
    if (!land) {
      bottom = FL.h - FL.ins.b - strip;
      const btnH = flowLayout(ctx, titleWidgets(state), sc).contentH;
      const hs = Math.max(0.3, Math.min(1, (bottom - top - btnH - 70) / 610));
      col(titleWidgets(state, heroArt(hs)));
    } else {
      const rw = Math.max(340, Math.min(480, Math.round(M.regionW * 0.4)));
      const lw = M.regionW - rw - 24;
      const hs = Math.max(0.5, Math.min(1, (FL.h - FL.ins.t - FL.ins.b - strip - 20) / 610));
      parts.push({ widgets: [heroArt(hs)], x: M.regionX0, w: lw, o: { x: 0, w: lw }, center: true, top: M.top + 6, bottom: FL.h - FL.ins.b - strip });
      parts.push({ widgets: titleWidgets(state), x: M.regionX0 + lw + 24, w: rw, o: { x: 0, w: rw }, center: true, top: M.top + 6, bottom: FL.h - FL.ins.b - strip });
    }
  } else if (key === 'setup') {
    top = M.listTop; bottom = FL.pins.top - 10;
    const ps = setupParts(state, land);
    if (!land) col(ps[0]);
    else regions(2).forEach((r, i) => parts.push({ widgets: ps[i], x: r.x, w: r.w, o: { x: 0, w: r.w }, top: M.top + 6 }));
  } else if (key === 'settings') {
    top = M.listTop;
    const ps = settingsParts(state, land);
    if (!land) col(ps[0]);
    else regions(2).forEach((r, i) => parts.push({ widgets: ps[i], x: r.x, w: r.w, o: { x: 0, w: r.w }, center: true }));
  } else if (key === 'result') {
    bottom = FL.h - FL.ins.b - 48;
    const ps = resultParts(state, land);
    if (!land) col(ps[0]);
    else regions(2).forEach((r, i) => parts.push({ widgets: ps[i], x: r.x, w: r.w, o: { x: 0, w: r.w }, center: true }));
  } else if (key === 'demolimit') {
    top = M.listTop; col(demoLimitWidgets(), { center: true });
  } else if (key === 'pause') {
    const sc2 = sc, pw = Math.min(660, FL.w - 2 * Math.max(20, FL.ins.l, FL.ins.r));
    const px = Math.round((FL.w - pw) / 2);
    const st = state.settings;
    const wd = [
      { t: 'h', label: 'Paused', size: 52 },
      { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
      { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
      { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
      { t: 'btn', id: 'p-calm', label: st.calm ? 'Calm: On' : 'Calm: Off', row: 8, active: st.calm },
      { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
      { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 10, disabled: st.textIdx === 0 },
      { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    ];
    const lay = flowLayout(ctx, wd, sc2, { x: 0, w: pw - 60 });
    const footH = 88 + 22, maxPanel = FL.h - FL.ins.t - FL.ins.b - 40;
    const bodyH = Math.min(lay.contentH, maxPanel - footH - 40);
    const panelH = bodyH + footH + 40;
    const py = Math.round((FL.h - panelH) / 2);
    const fy = py + panelH - 20 - 88, rw = Math.round((pw - 60) * 0.58);
    pins.push({ id: 'resume', label: 'Resume', primary: true, rect: { x: px + 30, y: fy, w: rw, h: 88 } }, { id: 'quit', label: 'Quit to menu', dark: true, rect: { x: px + 30 + rw + 12, y: fy, w: pw - 60 - rw - 12, h: 88 } });
    parts.push({ widgets: wd, lay, x: px + 30, w: pw - 60, o: { x: 0, w: pw - 60 }, top: py + 20, bottom: py + 20 + bodyH });
    return finish(ctx, key, FL, parts, pins, sc, { panel: { x: px, y: py, w: pw, h: panelH } });
  }
  return finish(ctx, key, FL, parts, pins, sc, { top, bottom });
}

function finish(ctx, key, FL, parts, pins, sc, o) {
  let maxScroll = 0;
  for (const p of parts) {
    p.top = p.top ?? o.top; p.bottom = p.bottom ?? o.bottom;
    if (!p.lay) p.lay = flowLayout(ctx, p.widgets, sc, p.o);
    const avail = p.bottom - p.top;
    p.yoff = p.center ? Math.max(0, Math.round((avail - p.lay.contentH) / 2)) : 0;
    p.max = Math.max(0, p.lay.contentH - avail);
    maxScroll = Math.max(maxScroll, p.max);
  }
  return { key, fkey: FL.key, parts, pins, panel: o.panel ?? null, top: o.top ?? 0, bottom: o.bottom ?? 0, maxScroll };
}

export function ensureLayout(state, key, FL) {
  if (LAID.key === key && LAID.fkey === FL.key && LAID.parts.length) return;
  LAID = compose(estCtx, state, key, FL);
}
export function hitScreen(x, y, scroll) {
  for (const p of LAID.pins) if (x >= p.rect.x && x <= p.rect.x + p.rect.w && y >= p.rect.y && y <= p.rect.y + p.rect.h) return p.id;
  for (const p of LAID.parts) {
    const id = flowHit(p.lay, p.top + p.yoff, Math.min(scroll, p.max), x - p.x, y);
    if (id) return id;
  }
  return null;
}
// Every tappable rectangle of the screen being shown, in screen units (used by the layout checks).
export function screenRects(scroll) {
  const out = [];
  for (const p of LAID.pins) out.push({ id: p.id, ...p.rect });
  for (const p of LAID.parts) {
    const s = Math.min(scroll, p.max);
    for (const it of p.lay.items) if (it.w.t === 'btn') out.push({ id: it.w.id, x: p.x + it.x, y: p.top + p.yoff + it.y - s, w: it.wd, h: it.h, clip: { top: p.top + p.yoff, bottom: p.bottom } });
  }
  return out;
}

function scrim(ctx, FL, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, FL.h);
  g.addColorStop(0, `rgba(10,14,50,${a * 0.7})`); g.addColorStop(0.5, `rgba(10,14,50,${a})`); g.addColorStop(1, `rgba(10,14,50,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, FL.w, FL.h);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(10,14,50,0)'); g.addColorStop(1, 'rgba(10,14,50,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 56, bottom - 44, 112, 36, 18); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${MIN_TXT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 25);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 56, top + 8, 112, 36, 18); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${MIN_TXT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 26);
  }
}

function drawFlowScreen(ctx, state, key, FL) {
  const L = compose(ctx, state, key, FL);
  LAID = L;
  const scroll = Math.min(state.ui.scroll, L.maxScroll);
  for (const p of L.parts) {
    const s = Math.min(scroll, p.max);
    ctx.save(); ctx.translate(p.x, 0);
    drawFlow(ctx, p.lay, p.top + p.yoff, p.bottom, s, { w: p.w });
    ctx.restore();
    if (p.max > 0) {
      const th = Math.max(60, (p.bottom - p.top) * ((p.bottom - p.top) / p.lay.contentH)), ty = p.top + (s / p.max) * (p.bottom - p.top - th);
      roundPath(ctx, p.x + p.w - 8, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
      scrollHint(ctx, p.top, p.bottom, s, p.max, p.x, p.w);
    }
  }
  return L;
}

// The backdrop: the real sky (attract duel, or the round that just ended) filling the screen, with the world centred in
// `cx` (default: the screen centre). Portrait draws it at the original scale from the top.
function backdrop(ctx, FL, st, w, sky, pals, cx = FL.w / 2) {
  const z = FL.land ? Math.max(0.5, Math.min(1, (FL.h - FL.ins.t - FL.ins.b) / 1000)) : 1;
  const ox = cx - 360 * z, oy = FL.land ? FL.h / 2 - 640 * z : 0;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(z, z);
  drawScene(ctx, st, w, sky, pals, { noFlyers: true, vw: visibleWorld(FL.w, FL.h, ox, oy, z) });
  ctx.restore();
}
const attScene = (ctx, state, FL, cx) => { const a = state.att; backdrop(ctx, FL, a, a.w, a.sky, a.pals, cx); };

const LOCKUP_W = 300;
export function renderTitle(ctx, state, FL) {
  const M = FL.menu;
  attScene(ctx, state, FL, FL.land ? M.regionX0 + (M.regionW - Math.max(340, Math.min(480, Math.round(M.regionW * 0.4))) - 24) / 2 : undefined);
  scrim(ctx, FL, 0.2);
  const g = ctx.createRadialGradient(FL.w / 2, 250, 40, FL.w / 2, 250, 460);
  g.addColorStop(0, 'rgba(10,14,50,0.42)'); g.addColorStop(1, 'rgba(10,14,50,0)');
  if (!FL.land) { ctx.fillStyle = g; ctx.fillRect(0, 0, FL.w, 720); }
  const L = drawFlowScreen(ctx, state, 'title', FL);
  // the themed Arcforge lockup: bottom centre, directly under the last row of menu buttons (never over them)
  const bp = L.parts[L.parts.length - 1], lw = LOCKUP_W, lh = lockupHeight(lw);
  const cb = Math.min(bp.bottom, bp.top + bp.yoff + bp.lay.contentH), lcx = bp.x + bp.w / 2, ly = Math.min(FL.h - FL.ins.b - lh - 10, cb + 16);
  const lm = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(lw + 24, lm), th = Math.max(lh + 12, lm);
  state.lockTap = { x: lcx - tw / 2, y: ly + lh + 6 - th, w: tw, h: th };
  ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(10,14,50,0.5)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockupImage(ctx, lcx, ly, lw, 1);
  if (state.demo) { ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 ${MIN_TXT}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', FL.w - FL.ins.r - 16, FL.ins.t + 30); }
}
export function renderSetup(ctx, state, FL) {
  attScene(ctx, state, FL);
  scrim(ctx, FL, 0.62);
  drawFlowScreen(ctx, state, 'setup', FL);
  const P = FL.pins, y0 = P.top - 30;
  const g = ctx.createLinearGradient(0, y0, 0, FL.h);
  g.addColorStop(0, 'rgba(10,14,50,0)'); g.addColorStop(0.2, 'rgba(10,14,50,0.88)'); g.addColorStop(1, 'rgba(10,14,50,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, FL.w, FL.h - y0);
  drawButton(ctx, P.start, 'Start the duel', { primary: true, size: 32 });
  drawButton(ctx, P.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 ${MIN_TXT + 1}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, FL.w / 2, P.top - 10); }
}
export function renderSettings(ctx, state, FL) {
  attScene(ctx, state, FL);
  scrim(ctx, FL, 0.66);
  drawFlowScreen(ctx, state, 'settings', FL);
}
export function renderResult(ctx, state, FL) {
  backdrop(ctx, FL, state, state.w, state.match.cfg.sky, state.pals);
  scrim(ctx, FL, 0.62);
  drawFlowScreen(ctx, state, 'result', FL);
  drawMoreLine(ctx, FL.w / 2, FL.h - FL.ins.b - 24, 22);   // quiet, text only
}
export function renderDemoLimit(ctx, state, FL) {
  attScene(ctx, state, FL);
  scrim(ctx, FL, 0.7);
  drawFlowScreen(ctx, state, 'demolimit', FL);
}
export function renderPause(ctx, state, FL) {
  scrim(ctx, FL, 0.55);
  const L = compose(ctx, state, 'pause', FL);
  LAID = L;
  const P = L.panel;
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(24,30,84,0.93)', stroke: 'rgba(255,246,228,0.45)' });
  const p = L.parts[0], s = Math.min(state.ui.scroll, p.max);
  ctx.save(); ctx.translate(p.x, 0); drawFlow(ctx, p.lay, p.top, p.bottom, s, { w: p.w }); ctx.restore();
  scrollHint(ctx, p.top, p.bottom, s, p.max, P.x, P.w);
  for (const b of L.pins) drawButton(ctx, b.rect, b.label, { primary: !!b.primary, dark: !!b.dark, size: 30 * Math.min(TEXT_SCALES[state.settings.textIdx], 1.6) });
}

// ---- reading pages: About / How to play / Rules, one scrolling panel -------------------------------------------
export const READER = { maxScroll: 0, panel: null, track: null, thumb: null };
const readerCache = new Map();
function buildRead(ctx, list, scale, pw) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = pw - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 24;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 14 }); y += 8; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, fs: secFs }); y += tl.length * secFs * 1.2 + 14;
    if (sec.art && scale < 2) { items.push({ k: 'art', y, art: sec.art, h: 210 }); y += 222; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      const wl = wrapLines(ctx, para, tw);
      items.push({ k: 'text', y, lines: wl, fs, lh }); y += wl.length * lh;
    });
    y += 30;
  });
  return { items, total: y };
}

export function renderPages(ctx, state, list, header, FL) {
  attScene(ctx, state, FL);
  scrim(ctx, FL, 0.66);
  const Rd = FL.reader, P = Rd.panel, sc = TEXT_SCALES[state.settings.textIdx];
  const key = `${header}:${sc}:${P.w}`;
  let book = readerCache.get(key);
  if (!book) { book = buildRead(ctx, list, sc, P.w); readerCache.set(key, book); if (readerCache.size > 30) readerCache.delete(readerCache.keys().next().value); }
  const viewH = P.h - 20;
  const max = Math.max(0, book.total - viewH);
  READER.maxScroll = max; READER.panel = P;
  const scroll = Math.max(0, Math.min(state.ui.scroll, max));
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(28,37,82,0.6)' });
  ctx.save(); roundPath(ctx, P.x + 2, P.y + 10, P.w - 4, viewH, 20); ctx.clip();
  ctx.translate(P.x, P.y + 10 - scroll);
  const top = scroll - 40, bot = scroll + viewH + 40;
  for (const it of book.items) {
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(28,37,82,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, it.y); ctx.lineTo(P.w - 60, it.y); ctx.stroke(); continue; }
    const h = it.k === 'art' ? it.h : it.lines.length * (it.k === 'title' ? it.fs * 1.2 : it.lh);
    if (it.y > bot || it.y + h < top) continue;
    if (it.k === 'title') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.fs}px ${FONT}`;
      it.lines.forEach((l, i) => ctx.fillText(l, P.w / 2, it.y + it.fs * (0.9 + i * 1.2)));
    } else if (it.k === 'art') {
      ctx.save(); ctx.beginPath(); ctx.rect(20, it.y, P.w - 40, it.h); ctx.clip(); drawArt(it.art, ctx, 40, it.y, P.w - 80, it.h - 12, state); ctx.restore();
    } else {
      ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      it.lines.forEach((l, i) => ctx.fillText(l, 40, it.y + it.fs * 0.85 + i * it.lh));
    }
  }
  ctx.restore();
  // scroll bar (drag the thumb) and the up / down cue
  if (max > 0) {
    const tr = { x: P.x + P.w - 22, y: P.y + 24, w: 14, h: P.h - 48 };
    const th = Math.max(48, tr.h * (viewH / book.total)), ty = tr.y + (scroll / max) * (tr.h - th);
    roundPath(ctx, tr.x + 4, tr.y, 6, tr.h, 3); ctx.fillStyle = 'rgba(28,37,82,0.14)'; ctx.fill();
    roundPath(ctx, tr.x + 2, ty, 10, th, 5); ctx.fillStyle = 'rgba(28,37,82,0.55)'; ctx.fill();
    READER.track = tr; READER.thumb = { x: tr.x - 8, y: ty, w: tr.w + 16, h: th, travel: tr.h - th };
  } else { READER.track = null; READER.thumb = null; }
  // header: title, text size
  // header: the title sits between the panel's left edge and the zoom % label (which stands left of A-); it shrinks to fit that gap
  const pctTxt = `${Math.round(sc * 100)}%`;
  ctx.font = `700 ${MIN_TXT + 2}px ${FONT}`;
  const pctW = ctx.measureText(pctTxt).width;
  const gapL = P.x + 8, gapR = Rd.pct.x - pctW - 14;
  let tSize = Math.round(46 * Math.min(sc, 1.15));
  ctx.font = `italic 700 ${tSize}px ${DISPLAY}`;
  const tW = ctx.measureText(header).width;
  if (tW > gapR - gapL) { tSize = Math.max(22, Math.floor(tSize * (gapR - gapL) / tW)); ctx.font = `italic 700 ${tSize}px ${DISPLAY}`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff6e4';
  textShadow(ctx, header, Math.min(Rd.title.x, (gapL + gapR) / 2), Rd.title.y, '#fff6e4', 8);
  drawButton(ctx, Rd.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, Rd.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${MIN_TXT + 2}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(pctTxt, Rd.pct.x, Rd.pct.y);
  ctx.textBaseline = 'alphabetic';
  drawButton(ctx, Rd.close, 'Close', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff6e4', align = 'center') {
  size = Math.max(MIN_TXT, size);
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(8,10,40,0.6)'; ctx.shadowBlur = 4; ctx.fillText(t, x, y); ctx.restore();
}
function miniSky(ctx, w, h, id = 'noon') {
  const P = SKY_PAL[id];
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P.top); g.addColorStop(0.6, P.mid); g.addColorStop(1, P.low);
  roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  ctx.fillStyle = P.hill[0]; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h - 20); for (let x = 0; x <= w; x += 30) ctx.lineTo(x, h - 22 + Math.sin(x * 0.05) * 7); ctx.lineTo(w, h); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(28,37,82,0.4)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
const fk = (x, y, style = 'patang', ang = 0, extra = {}) => ({ x, y, ang, ph: 1, style, T: 0.6, integ: 100, ...extra });
function curve(ctx, x0, y0, x1, y1, sag, col = '#fff6e4', wd = 2.4) {
  ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + sag * 0.3, (y0 + y1) / 2 + sag, x1, y1); ctx.stroke();
}
function person(ctx, x, y, col) {
  ctx.fillStyle = '#12112c'; ctx.beginPath(); ctx.roundRect(x - 9, y - 30, 18, 30, 6); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - 38, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y - 44, 8, 4, 0, Math.PI, TAU); ctx.fill();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffc94d', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function kiteAt(ctx, x, y, style, pal, s, ang = 0) { drawKite(ctx, { x, y, ang, ph: 1, style }, pal, 0, { scale: s }); }

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const P0 = KITE_PAL[0], P1 = KITE_PAL[2];
  const A = {
    sky() {
      miniSky(ctx, w, h, 'dawn');
      const ax = w * 0.2, bx = w * 0.8, gy = h - 14;
      const k1 = [w * 0.42, h * 0.3], k2 = [w * 0.6, h * 0.26];
      curve(ctx, ax, gy - 40, k1[0], k1[1], 10); curve(ctx, bx, gy - 40, k2[0], k2[1], 10);
      person(ctx, ax, gy, P0.a); person(ctx, bx, gy, P1.a);
      kiteAt(ctx, k1[0], k1[1], 'patang', P0, 0.42, 0.2); kiteAt(ctx, k2[0], k2[1], 'rokkaku', P1, 0.42, -0.2);
      label(ctx, 'You', ax, gy - 56, 20); label(ctx, 'Rival', bx, gy - 56, 20);
    },
    kites() {
      miniSky(ctx, w, h, 'noon');
      kiteAt(ctx, w * 0.2, h * 0.5, 'patang', KITE_PAL[0], 0.62); kiteAt(ctx, w * 0.5, h * 0.5, 'rokkaku', KITE_PAL[2], 0.62); kiteAt(ctx, w * 0.8, h * 0.4, 'tailed', KITE_PAL[3], 0.5);
      label(ctx, 'Diamond fighter', w * 0.2, h - 12, 18); label(ctx, 'Rokkaku', w * 0.5, h - 12, 18); label(ctx, 'Tailed', w * 0.8, h - 12, 18);
    },
    steer() {
      miniSky(ctx, w, h, 'dusk');
      const kx = w * 0.3, ky = h * 0.62, tx = w * 0.72, ty = h * 0.3;
      curve(ctx, w * 0.12, h - 14, kx, ky, 8);
      kiteAt(ctx, kx, ky, 'patang', P0, 0.4, 0.25);
      ctx.setLineDash([4, 9]); ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tx, ty, 18, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(tx + 10, ty + 14, 22, 0, TAU); ctx.fill();
      label(ctx, 'touch here', tx, ty - 28, 20, '#ffe9a0'); label(ctx, 'the kite flies to it', kx + 20, h - 34, 19);
    },
    modes() {
      const cw = (w - 24) / 3;
      [['Slack', 56, 0.3], ['Steady', 14, 0.7], ['Pull', 4, 1.1]].forEach(([nm, sag, T], i) => {
        const cx = i * (cw + 12);
        ctx.save(); ctx.translate(cx, 0); miniSky(ctx, cw, h - 6, 'noon');
        const kx = cw * 0.62, ky = h * (i === 0 ? 0.5 : i === 1 ? 0.36 : 0.28);
        ctx.strokeStyle = stringColor(T, 100); ctx.lineWidth = 2 + T; ctx.beginPath(); ctx.moveTo(cw * 0.2, h - 24); ctx.quadraticCurveTo((cw * 0.2 + kx) / 2 + sag * 0.6, (h - 24 + ky) / 2 + sag, kx, ky); ctx.stroke();
        kiteAt(ctx, kx, ky, 'patang', P0, 0.32, 0.2);
        label(ctx, nm, cw / 2, h - 34, 21, '#fff6e4');
        ctx.restore();
      });
    },
    wind() {
      miniSky(ctx, w, h, 'dawn');
      const wd = { base: 0.5, swirl: 0, ph: [0, 0], gusts: [{ t0: 1.2, dur: 2.6, amp: 0.55 }, { t0: 4.6, dur: 2.4, amp: -0.3 }] };
      const x0 = 30, x1 = w - 30, y0 = h - 40, y1 = 32;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const v = windAt(wd, (i / 40) * 7.5), px = x0 + (x1 - x0) * i / 40, py = y0 - (y0 - y1) * clampv(v / 1.2); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 4; ctx.stroke();
      ctx.lineTo(x1, y0); ctx.lineTo(x0, y0); ctx.fillStyle = 'rgba(255,246,228,0.22)'; ctx.fill();
      label(ctx, 'gust', x0 + (x1 - x0) * 0.33, y1 + 4, 22, '#ffe9a0'); label(ctx, 'lull', x0 + (x1 - x0) * 0.74, y0 - 34, 22, '#9fd0ff');
      label(ctx, 'now', x0, h - 14, 18, '#fff6e4', 'left'); label(ctx, '+6 s', x1, h - 14, 18, '#fff6e4', 'right');
    },
    cross() {
      miniSky(ctx, w, h, 'dusk');
      const ax = w * 0.18, bx = w * 0.82, gy = h - 14;
      const ka = [w * 0.62, h * 0.26], kb = [w * 0.38, h * 0.3];
      curve(ctx, ax, gy - 20, ka[0], ka[1], 6, '#fff0c0', 3); curve(ctx, bx, gy - 20, kb[0], kb[1], 6, '#fff6e4', 2);
      kiteAt(ctx, ka[0], ka[1], 'patang', P0, 0.38, 0.2); kiteAt(ctx, kb[0], kb[1], 'rokkaku', P1, 0.38, -0.2);
      const cx = w * 0.5, cy = h * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34); g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.fill();
      label(ctx, 'strings saw here', cx, cy + 52, 20, '#ffe9a0');
    },
    think() {
      const cw = (w - 40) / 3;
      [['THINK', ['weigh the', 'options'], '#ffe9a0'], ['REVEAL', ['show the', 'plan'], '#7fe8d6'], ['ACT', ['fly the', 'plan'], '#ff9a86']].forEach(([nm, sub, col], i) => {
        const cx = i * (cw + 20);
        roundPath(ctx, cx, 20, cw, h - 40, 18); ctx.fillStyle = 'rgba(28,37,82,0.9)'; ctx.fill();
        label(ctx, nm, cx + cw / 2, h / 2 - 6, 26, col); sub.forEach((ln, k) => label(ctx, ln, cx + cw / 2, h / 2 + 24 + k * 28, 17, '#fff6e4'));
        if (i < 2) arrow(ctx, cx + cw + 3, h / 2, cx + cw + 17, h / 2, '#1c2552', 4);
      });
    },
    grip() {
      miniSky(ctx, w, h, 'noon');
      [['Full', 1, '#ffc94d'], ['Pulling', 0.45, '#ffc94d'], ['Spent', 0.08, '#ff5a44']].forEach(([nm, f, col], i) => {
        const by = 34 + i * 54;
        roundPath(ctx, 130, by, w - 170, 20, 10); ctx.fillStyle = 'rgba(8,10,40,0.55)'; ctx.fill();
        roundPath(ctx, 130, by, Math.max(10, (w - 170) * f), 20, 10); ctx.fillStyle = col; ctx.fill();
        label(ctx, nm, 112, by + 17, 20, '#fff6e4', 'right');
      });
    },
    tension() {
      miniSky(ctx, w, h, 'dawn');
      const bands = [['slack', 0.35, '#9fd0ff'], ['taut', 0.4, '#fff0c0'], ['hard', K.STRAIN_AT - 0.75, '#ffb347'], ['strain', 0.35, '#ff5a44']];
      const tot = bands.reduce((s, b) => s + b[1], 0);
      let bx = 24;
      bands.forEach(([nm, v, col]) => {
        const bw = (w - 48) * v / tot;
        ctx.fillStyle = col; ctx.fillRect(bx, h * 0.38, bw, 34);
        label(ctx, nm, bx + bw / 2, h * 0.38 + 62, 20, '#fff6e4'); bx += bw;
      });
      ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 2; ctx.strokeRect(24, h * 0.38, w - 48, 34);
      label(ctx, 'tension: how hard the kite pulls', w / 2, 36, 22, '#fff6e4');
    },
    cut() {
      miniSky(ctx, w, h, 'dusk');
      const cx = w * 0.4, cy = h * 0.52;
      curve(ctx, w * 0.12, h - 14, cx, cy, 14, '#fff6e4', 2.4);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r1 = 12, r2 = 34 + (i % 3) * 8; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke(); }
      kiteAt(ctx, w * 0.74, h * 0.34, 'rokkaku', P1, 0.36, 0.9);
      arrow(ctx, w * 0.62, h * 0.5, w * 0.84, h * 0.7, '#ffc94d', 3);
      label(ctx, 'string parts, the kite tumbles away', w / 2, 30, 20, '#fff6e4');
    },
  };
  (A[key] ?? A.sky)();
  ctx.restore();
}
const clampv = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
