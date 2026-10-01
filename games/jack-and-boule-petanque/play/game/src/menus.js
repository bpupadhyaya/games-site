// Every screen that is not the play screen: title, setup, settings, result, pause, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own boule, jack
// and slingshot art). Pure drawing; game.js owns state.
import { W, H } from './cam.js';
import { LANE, JACK_ZONE, LOFTS } from './sim.js';
import { drawBoule, drawJack, palOf, PAL, TEAM } from './art.js';
import { drawWorldLayer, drawLoading } from './view.js';
import { TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PRESET_IDS, presetName } from './sim.js';

const TAU = Math.PI * 2;
const NZ = [0.35, 0.25, 0.9];

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
  t: 'art', h: 520,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `700 96px ${FONT}`; const w1 = ctx.measureText('Jack ').width, w3 = ctx.measureText(' Boule').width;
    ctx.font = `italic 400 70px ${FONT}`; const w2 = ctx.measureText('&').width;
    const tot = w1 + w2 + w3, x0 = cx - tot / 2;
    ctx.font = `700 96px ${FONT}`; textShadow(ctx, 'Jack ', x0, 150, '#fff3d6', 14);
    ctx.font = `italic 400 70px ${FONT}`; textShadow(ctx, '&', x0 + w1, 146, '#ffcf7a', 10);
    ctx.font = `700 96px ${FONT}`; textShadow(ctx, ' Boule', x0 + w1 + w2, 150, '#fff3d6', 14);
    ctx.textAlign = 'center';
    ctx.font = `400 28px ${FONT}`; textShadow(ctx, 'Pétanque de Provence', cx, 206, '#ffe9bf', 6);
    ctx.strokeStyle = 'rgba(255,233,191,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 170, 232); ctx.lineTo(cx - 24, 232); ctx.moveTo(cx + 24, 232); ctx.lineTo(cx + 170, 232); ctx.stroke();
    drawJack(ctx, cx, 232, 8);
    ctx.restore();
  },
});

export function titleWidgets(state, demo) {
  const sound = state.settings.sound;
  const wd = [heroArt()];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 2 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }];
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: 'Choose the pitch', bold: true, color: '#ffe9bf', size: 26 });
  PRESET_IDS.forEach((id, i) => {
    const locked = demo && id !== 'village';
    const sub = { village: 'Flat, packed gravel under plane trees', port: 'Loose sand and a cross slope', oliviers: 'Rolling bumps and stones', colline: 'Fast clay, slopes and stones', daily: 'A new pitch every day' }[id];
    wd.push({ t: 'btn', id: `pit${id}`, label: presetName(id), sub: locked ? 'In the full game' : sub, active: s.pitch === id && !locked, disabled: locked, hitDisabled: true });
  });
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
  wd.push({ t: 'btn', id: 'len13', label: 'To 13 points', row: 9, active: s.target === 13 });
  wd.push({ t: 'btn', id: 'len7', label: 'Quick: to 7', row: 9, active: s.target === 7 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm mode: On' : 'Calm mode: Off', sub: 'Bigger jack ring and a full path preview', active: st.calm },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode;
  const winner = o.win;
  const title = mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${PROFILES[winner === 0 ? (m.cfg.watchA ?? 3) : m.cfg.opp].name} wins` : winner === 0 ? 'You win!' : 'You lose';
  // At big text sizes the result is kept to one screen: tighter top gap, capped heading/paragraph growth, one merged summary line.
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 70 }, { t: 'h', label: title, size: 64, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  if (o.fanny) wd.push({ t: 'p', label: winner === 0 || mode !== 'ai' ? 'Fanny! A 13 to 0 win.' : 'Fanny: a 13 to 0 loss.', bold: true, color: '#ffe9bf', size: 28, cap: big ? 2 : 3 });
  const ends = `${m.log.length} ends played on ${presetName(m.cfg.pitch)}.`;
  const rec = mode === 'ai' ? `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.` : '';
  wd.push({ t: 'p', label: big ? `${ends} ${rec}`.trim() : ends, size: 26, cap: big ? 2 : 3 });
  if (rec && !big) wd.push({ t: 'p', label: rec, size: 26 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
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
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free ends of the web demo. The full game on iPhone and Android has every pitch, every rival and unlimited matches.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(20,10,4,${a * 0.7})`); g.addColorStop(0.5, `rgba(20,10,4,${a})`); g.addColorStop(1, `rgba(20,10,4,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(1, 'rgba(20,10,4,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key, widgets, top, bottom, opts = {}) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  // scroll cue
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

export function renderTitle(ctx, state) {
  const ok = drawWorldLayer(ctx, state, state.att.w, state.att.parts, { noRing: true });
  if (!ok) return;
  scrim(ctx, 0.28);
  // soft vignette behind the logo
  const g = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 420);
  g.addColorStop(0, 'rgba(20,10,4,0.5)'); g.addColorStop(1, 'rgba(20,10,4,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 14);
}

export function renderSetup(ctx, state) {
  const ok = drawWorldLayer(ctx, state, state.att.w, state.att.parts, { noRing: true });
  if (!ok) return;
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(0.2, 'rgba(20,10,4,0.85)'); g.addColorStop(1, 'rgba(20,10,4,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) {
  const ok = drawWorldLayer(ctx, state, state.att.w, state.att.parts, { noRing: true });
  if (!ok) return;
  scrim(ctx, 0.66);
  drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H);
}
export function renderResult(ctx, state) {
  const ok = drawWorldLayer(ctx, state, state.w, [], {});
  if (!ok) return;
  scrim(ctx, 0.6);
  drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H);
}
export function renderDemoLimit(ctx, state) {
  const ok = drawWorldLayer(ctx, state, state.att.w, state.att.parts, { noRing: true });
  if (!ok) return;
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
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(40,26,14,0.9)', stroke: 'rgba(255,214,140,0.5)' });
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
    const artH = sec.art ? 210 : 0;
    // does the whole section fit on the current page?
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
  return pages;
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  const ok = drawWorldLayer(ctx, state, state.att.w, [], { noRing: true });
  if (!ok) return;
  scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,238,214,0.96)', stroke: 'rgba(110,76,40,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${pg.secFs}px ${FONT}`;
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
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function groundStrip(ctx, x, y, w, h, pal = 'village') {
  const P = PAL[pal];
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgb(${P.base.map((v) => Math.min(255, v + 20)).join(',')})`); g.addColorStop(1, `rgb(${P.base.map((v) => v - 18).join(',')})`);
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip();
  let s = 7;
  for (let i = 0; i < 260; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const px = x + (s % 10000) / 10000 * w; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const py = y + (s % 10000) / 10000 * h; ctx.fillStyle = i % 3 ? 'rgba(255,244,222,0.5)' : 'rgba(70,50,32,0.4)'; ctx.beginPath(); ctx.arc(px, py, 1 + (i % 3) * 0.7, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(110,76,40,0.5)'; ctx.lineWidth = 2; roundPath(ctx, x, y, w, h, 16); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    equipment() {
      groundStrip(ctx, 0, 0, w, h);
      drawBoule(ctx, 0, w * 0.2, h * 0.5, 40, NZ); drawBoule(ctx, 1, w * 0.5, h * 0.5, 40, [0.5, 0.2, 0.8]); drawJack(ctx, w * 0.8, h * 0.5, 15);
      label(ctx, 'Your boules', w * 0.2, h - 22, 20); label(ctx, 'Rival boules', w * 0.5, h - 22, 20); label(ctx, 'Jack', w * 0.8, h - 22, 20);
    },
    sling() {
      groundStrip(ctx, 0, 0, w, h);
      const cx = w * 0.4, by = h * 0.62;
      ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 70, h * 0.78); ctx.lineTo(cx - 70, h * 0.22); ctx.moveTo(cx + 70, h * 0.78); ctx.lineTo(cx + 70, h * 0.22); ctx.stroke();
      ctx.strokeStyle = '#b8431c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx - 70, h * 0.22); ctx.lineTo(cx, by); ctx.lineTo(cx + 70, h * 0.22); ctx.stroke();
      drawBoule(ctx, 0, cx, by, 34, NZ);
      arrow(ctx, cx + 70, h * 0.42, cx + 150, h * 0.14, C.olive, 5); label(ctx, 'throws', cx + 180, h * 0.14 + 30, 18, C.olive);
      arrow(ctx, cx + 70, h * 0.58, cx + 22, by + 8, C.terra, 5); label(ctx, 'pull back', cx + 112, h * 0.62 + 24, 18, C.terra);
    },
    lofts() {
      groundStrip(ctx, 0, 0, w, h);
      const gy = h * 0.82, x0 = 20;
      ctx.strokeStyle = 'rgba(70,50,30,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, gy); ctx.lineTo(w - 10, gy); ctx.stroke();
      const rows = [['Roll', 0, 0], ['Half-lob', 62, 1], ['Lob', 118, 2], ['Shoot', 14, 3]];
      const cols = ['#6b7a3a', '#3f78ad', '#7c5aa0', '#c4552a'];
      rows.forEach(([nm, hgt, i]) => {
        const x1 = w * (0.26 + i * 0.22);
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 4; ctx.setLineDash([2, 8]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, gy - 8); ctx.quadraticCurveTo((x0 + x1) / 2, gy - 8 - hgt * 2, x1, gy - 8); ctx.stroke(); ctx.setLineDash([]);
        drawBoule(ctx, 0, x1, gy - 13, 13, NZ);
        label(ctx, nm, x1, gy + 30 - 4, 17, cols[i]);
      });
    },
    spins() {
      groundStrip(ctx, 0, 0, w, h);
      const cy = h * 0.5;
      [['Neutral', 0.18, 90, '#3f78ad'], ['Retro', 0.5, 36, '#7c5aa0'], ['Forward', 0.82, 130, '#6b7a3a']].forEach(([nm, fx, len, col]) => {
        const cx = w * fx - 20;
        drawBoule(ctx, 0, cx, cy - 6, 28, [0.2 + fx * 0.3, 0.3, 0.9]);
        arrow(ctx, cx + 34, cy - 6, cx + 34 + Math.min(len, w * 0.17), cy - 6, col, 5);
        label(ctx, nm, cx + 20, cy + 52, 20, col);
      });
    },
    surfaces() {
      const sw = (w - 40) / 3;
      [['Gravel', 'village', 1], ['Loose sand', 'port', 2], ['Packed clay', 'colline', 3]].forEach(([nm, pal, k], i) => {
        const sx = i * (sw + 20);
        groundStrip(ctx, sx, 0, sw, h - 44, pal);
        if (k === 2) { ctx.fillStyle = 'rgba(244,232,200,0.55)'; roundPath(ctx, sx, 0, sw, h - 44, 16); ctx.fill(); }
        if (k === 3) { ctx.fillStyle = 'rgba(120,80,50,0.4)'; roundPath(ctx, sx, 0, sw, h - 44, 16); ctx.fill(); }
        drawBoule(ctx, 0, sx + sw / 2, (h - 44) / 2, 24, NZ);
        label(ctx, nm, sx + sw / 2, h - 14, 20);
      });
    },
    score() {
      groundStrip(ctx, 0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.5;
      ctx.strokeStyle = 'rgba(255,246,226,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      [[-120, -10, 0], [90, 14, 0], [-30, 50, 1]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke(); });
      ctx.setLineDash([]);
      drawBoule(ctx, 0, cx - 120, cy - 10, 26, NZ); drawBoule(ctx, 0, cx + 90, cy + 14, 26, [0.4, 0.4, 0.8]); drawBoule(ctx, 1, cx - 30, cy + 50, 26, [0.2, 0.5, 0.8]);
      drawJack(ctx, cx, cy, 13);
      label(ctx, '1', cx - 120, cy - 44, 22, '#fff6e2'); label(ctx, '3', cx + 90, cy - 20, 22, '#fff6e2'); label(ctx, '2', cx - 30, cy + 98, 22, '#fff6e2');
    },
    zone() {
      groundStrip(ctx, 0, 0, w, h);
      const cx = w / 2;
      ctx.strokeStyle = 'rgba(250,244,226,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, h - 26, 36, 12, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([8, 7]);
      [[0.6, '5 m'], [0.2, '8 m']].forEach(([f, t]) => { ctx.beginPath(); ctx.moveTo(30, h * f + 6); ctx.quadraticCurveTo(cx, h * f - 20, w - 30, h * f + 6); ctx.stroke(); label(ctx, t, 54, h * f + 30, 19, '#fff6e2'); });
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,232,130,0.28)'; ctx.beginPath(); ctx.moveTo(30, h * 0.6 + 6); ctx.quadraticCurveTo(cx, h * 0.6 - 20, w - 30, h * 0.6 + 6); ctx.lineTo(w - 30, h * 0.2 + 6); ctx.quadraticCurveTo(cx, h * 0.2 - 20, 30, h * 0.2 + 6); ctx.closePath(); ctx.fill();
      drawJack(ctx, cx + 30, h * 0.4, 11);
      label(ctx, 'circle', cx, h - 50, 18, '#fff6e2');
    },
    border() {
      groundStrip(ctx, 0, 0, w, h);
      ctx.fillStyle = '#7a5a3e'; ctx.fillRect(0, h * 0.5 - 8, w, 16);
      ctx.fillStyle = 'rgba(90,110,50,0.5)'; ctx.fillRect(0, h * 0.5 + 8, w, h * 0.5 - 8);
      drawBoule(ctx, 0, w * 0.3, h * 0.28, 24, NZ); drawBoule(ctx, 1, w * 0.62, h * 0.74, 24, [0.5, 0.3, 0.8]);
      label(ctx, 'in play', w * 0.3, h * 0.28 + 46, 19, '#fff6e2'); label(ctx, 'dead: out', w * 0.62, h * 0.74 + 46, 19, '#ffd0b8');
    },
  };
  (A[key] ?? A.equipment)();
  ctx.restore();
}
