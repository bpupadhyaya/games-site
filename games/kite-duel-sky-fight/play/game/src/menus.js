// Every screen that is not the play screen: title, setup, settings, result, pause, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own kites and
// strings). Pure drawing; game.js owns state.
import { W, H, K, SKIES, SKY_IDS, windAt } from './sim.js';
import { drawKite, KITE_PAL, SKY_PAL, stringColor } from './art.js';
import { drawScene } from './view.js';
import { TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
// A layout for the scene being updated right now, before anything has been drawn (first frame after a
// scene change, or headless runs): same widgets, text widths estimated instead of measured.
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H],
    result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H],
  };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => ({
  t: 'art', h: 610,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
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
  },
});

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const sv = state.saved;
  return [
    heroArt(),
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
export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'New Duel', size: 48 }];
  wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9a0', size: 26 });
  PROFILES.forEach((pf, i) => {
    const locked = demo && i > 1;
    wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: rivalSub(pf, (rec.wins ?? [])[i] ?? 0, locked), active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
  });
  wd.push({ t: 'p', label: 'Choose the sky', bold: true, color: '#ffe9a0', size: 26 });
  SKY_IDS.forEach((id) => {
    const locked = demo && (id === 'dusk' || id === 'storm');
    wd.push({ t: 'btn', id: `sky${id}`, label: SKIES[id].name, sub: locked ? 'In the full game' : SKIES[id].blurb, active: s.sky === id && !locked, disabled: locked, hitDisabled: true });
  });
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'len3', label: 'Best of 3', row: 9, active: s.rounds === 3 });
  wd.push({ t: 'btn', id: 'len1', label: 'Quick Duel', row: 9, active: s.rounds === 1 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm effects: On' : 'Calm effects: Off', sub: 'No flashes', active: st.calm },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.match, o = m.over, mode = m.cfg.mode;
  const winner = o.win;
  const nm = (s) => (mode === 'watch' ? PROFILES[s === 0 ? m.cfg.watchA : m.cfg.opp].name : s === 0 ? 'You' : PROFILES[m.cfg.opp].name);
  const title = mode === 'watch' ? `${nm(winner)} wins` : winner === 0 ? 'You win the duel!' : `${nm(1)} wins`;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 200 }, { t: 'h', label: title, size: 60, cap: big ? 1.15 : 1.4 }, { t: 'h', label: `${m.wins[0]} – ${m.wins[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  if (mode === 'ai') {
    const best = Math.round(m.stats.worst);
    const l1 = `Strings cut: ${m.stats.cuts}. Your string at its thinnest: ${best} of 100.`;
    const l2 = `Against ${PROFILES[m.cfg.opp].name}, you have won ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0}.`;
    wd.push({ t: 'p', label: big ? `${l1} ${l2}` : l1, size: 26, cap: big ? 2 : 3 });
    if (!big) wd.push({ t: 'p', label: l2, size: 26 });
  }
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New duel', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-calm', label: st.calm ? 'Calm: On' : 'Calm: Off', row: 8, active: st.calm },
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have flown the free rounds of the web demo. The full game on iPhone and Android has every rival, every sky and unlimited duels.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(10,14,50,${a * 0.7})`); g.addColorStop(0.5, `rgba(10,14,50,${a})`); g.addColorStop(1, `rgba(10,14,50,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(10,14,50,0)'); g.addColorStop(1, 'rgba(10,14,50,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

const attScene = (ctx, state) => {
  const a = state.att;
  drawScene(ctx, a, a.w, a.sky, a.pals, { noFlyers: true });
};

export function renderTitle(ctx, state) {
  attScene(ctx, state);
  scrim(ctx, 0.2);
  const g = ctx.createRadialGradient(W / 2, 250, 40, W / 2, 250, 460);
  g.addColorStop(0, 'rgba(10,14,50,0.42)'); g.addColorStop(1, 'rgba(10,14,50,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 720);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); }
}
export function renderSetup(ctx, state) {
  attScene(ctx, state);
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(10,14,50,0)'); g.addColorStop(0.2, 'rgba(10,14,50,0.88)'); g.addColorStop(1, 'rgba(10,14,50,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the duel', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) {
  attScene(ctx, state);
  scrim(ctx, 0.66);
  drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H);
}
export function renderResult(ctx, state) {
  drawScene(ctx, state, state.w, state.match.cfg.sky, state.pals);
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H);
}
export function renderDemoLimit(ctx, state) {
  attScene(ctx, state);
  scrim(ctx, 0.7);
  drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H);
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(24,30,84,0.93)', stroke: 'rgba(255,246,228,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}

// ---- reference pages --------------------------------------------------------------------------
let PAGE_COUNT = 1;
export const pageCount = () => PAGE_COUNT;
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };

function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PANEL.y + 120, limit = PANEL.y + PANEL.h - 70;
  const pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => {
      const wl = wrapLines(ctx, para, tw);
      wl.forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 }));
    });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art && scale < 2 ? 210 : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    const minNeed = titleH + artH + 26 + lh * 3;
    if (!cur || (used + full > limit - top && used + minNeed > limit - top)) newPage();
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
  return pages;
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  attScene(ctx, state);
  scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(28,37,82,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(28,37,82,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(28,37,82,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(28,37,82,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff6e4', align = 'center') {
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
      [['THINK', 'weigh the options', '#ffe9a0'], ['REVEAL', 'show the plan', '#7fe8d6'], ['ACT', 'fly the plan', '#ff9a86']].forEach(([nm, sub, col], i) => {
        const cx = i * (cw + 20);
        roundPath(ctx, cx, 20, cw, h - 40, 18); ctx.fillStyle = 'rgba(28,37,82,0.9)'; ctx.fill();
        label(ctx, nm, cx + cw / 2, h / 2 - 2, 26, col); label(ctx, sub, cx + cw / 2, h / 2 + 30, 17, '#fff6e4');
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
