// Every screen that is not the play screen: title, setup, settings, result, pause, demo limit, and the paginated About /
// How to Play / Rules reader with illustrations drawn with the game's own figures, paddle and ball. Pure drawing; game.js owns state.
import { W, H } from './cam.js';
import { lightAt } from './art.js';
import { drawFigure, drawPaddle, LOOKS } from './figure.js';
import { renderScene, drawBall, outlineText, tierOf, TIER_AT, TIER_NAMES } from './view.js';
import { TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;
export const OPP_TAGS = PROFILES.map((p) => p.tag);
const WIND_NAMES = ['None', 'Breeze', 'Gusty'];
const LIGHT_NAMES = ['Morning', 'Afternoon', 'Golden hour'];

// ---- flow screens ------------------------------------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.55 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = { title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H], result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

function bgScene(ctx, state, src, pos = 1.6) {
  const L = lightAt(pos);
  renderScene(ctx, state, { w: src.w, L, parts: src.parts ?? [], trail: src.trail ?? [], looks: src.looks ?? ['dana', 'maya'], t: state.t, cue: false, guides: null });
}
function scrim(ctx, a = 0.5) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(8,28,44,${a * 0.6})`); g.addColorStop(0.5, `rgba(8,28,44,${a})`); g.addColorStop(1, `rgba(8,28,44,${Math.min(0.94, a + 0.28)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// Two crossed paddles and a ball, the game's mark.
export function drawMark(ctx, cx, cy, u) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.save(); ctx.rotate(-0.5); drawPaddle(ctx, 0, u * 0.9, Math.PI / 2, u * 1.9, 1); ctx.restore();
  ctx.save(); ctx.rotate(0.5); drawPaddle(ctx, 0, u * 0.9, Math.PI / 2, u * 1.9, 1); ctx.restore();
  drawBall(ctx, 0, -u * 0.7, u * 0.34);
  ctx.restore();
}

const heroArt = () => ({
  t: 'art', h: 400,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    drawMark(ctx, cx, 120, 70);
    ctx.font = `900 124px ${FONT}`;
    const word = 'MATKOT';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(8,28,44,0.55)'; ctx.strokeText(word, cx, 300 + 5);
    ctx.lineWidth = 10; ctx.strokeStyle = '#d9472b'; ctx.strokeText(word, cx, 300);
    const g = ctx.createLinearGradient(0, 210, 0, 310); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffe9b8');
    ctx.fillStyle = g; ctx.fillText(word, cx, 300);
    ctx.font = `900 46px ${FONT}`; ctx.fillStyle = '#ffc24b';
    textShadow(ctx, 'B E A C H   R A L L Y', cx, 358, '#ffd36a', 6);
    ctx.font = `700 34px ${FONT}`; textShadow(ctx, 'מטקות', cx, 396, 'rgba(255,255,255,0.92)', 6);
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sound = state.settings.sound, rec = state.record;
  const wd = [heroArt()];
  wd.push({ t: 'btn', id: 'coop', label: 'Beach Rally', sub: rec.bestRally ? `Keep it going with Dana · best ${rec.bestRally}` : 'Keep it going with Dana', primary: true, h: 100 });
  wd.push({ t: 'btn', id: 'match', label: 'Match', sub: 'Play a rival to 7 or 11', h: 90 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'See why every shot is chosen', h: 90 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 2 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record;
  const wd = [{ t: 'gap', h: 14 }, { t: 'h', label: 'Match', size: 52 }];
  wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9bf', size: 26 });
  PROFILES.forEach((pf, i) => {
    const won = rec.wins[i] | 0, locked = demo && i > 1;
    wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
  });
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
  wd.push({ t: 'btn', id: 'to7', label: 'To 7 points', row: 8, active: s.to === 7 });
  wd.push({ t: 'btn', id: 'to11', label: 'To 11 points', row: 8, active: s.to === 11 });
  wd.push({ t: 'p', label: 'Light', bold: true, color: '#ffe9bf', size: 26 });
  LIGHT_NAMES.forEach((n, i) => wd.push({ t: 'btn', id: `lt${i}`, label: n, row: 9, active: s.light === i && !(demo && i !== 1), disabled: demo && i !== 1, hitDisabled: true }));
  wd.push({ t: 'p', label: 'Wind', bold: true, color: '#ffe9bf', size: 26 });
  WIND_NAMES.forEach((n, i) => wd.push({ t: 'btn', id: `wd${i}`, label: n, row: 10, active: s.wind === i && !(demo && i !== 0), disabled: demo && i !== 0, hitDisabled: true }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 14 }, { t: 'h', label: 'Settings', size: 52 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm mode: On' : 'Calm mode: Off', sub: 'Wider paddle reach, slower ball, no wind', active: st.calm },
    { t: 'btn', id: 'set-guides', label: st.guides ? 'Aim guide: On' : 'Aim guide: Off', sub: 'The gold ring where a swing would land', active: st.guides },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchase', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const r = state.run, o = r.over;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 80 }];
  if (r.mode === 'coop') {
    wd.push({ t: 'h', label: o.newBest ? 'New best rally!' : 'Rally over', size: 56, cap: big ? 1.1 : 1.4, color: o.newBest ? '#ffd36a' : '#ffffff' });
    wd.push({ t: 'h', label: String(o.rally), size: 150, cap: big ? 1 : 1.2, color: '#ffffff' });
    wd.push({ t: 'p', label: `${TIER_NAMES[o.tier]} · score ${o.points}`, bold: true, color: '#ffe9bf', size: 30, cap: 2 });
    wd.push({ t: 'p', label: `Best rally ${state.record.bestRally} · best score ${state.record.bestScore}`, size: 26, cap: 2.2 });
    wd.push({ t: 'p', label: `${r.stats.sweet} sweet hits${r.stats.hints ? ` · ${r.stats.hints} hint${r.stats.hints > 1 ? 's' : ''}` : ''}`, size: 24, cap: 2.2 });
    wd.push({ t: 'gap', h: 24 });
    wd.push({ t: 'btn', id: 'again', label: 'Rally again', primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else {
    const winner = o.win;
    const title = r.mode === 'watch' ? `${r.names[winner]} wins` : winner === 0 ? 'You win!' : `${r.names[1]} wins`;
    wd.push({ t: 'h', label: title, size: 64, cap: big ? 1.2 : 1.5 });
    wd.push({ t: 'h', label: `${o.score[0]} – ${o.score[1]}`, size: 96, cap: big ? 1.1 : 1.3, color: '#ffd36a' });
    const rec = r.mode === 'match' ? ` · your wins against ${r.names[1]}: ${state.record.wins[r.cfg.opp] | 0}` : '';
    wd.push({ t: 'p', label: `Longest rally ${r.stats.longest} · ${r.stats.sweet} sweet hits${r.stats.hints ? ` · ${r.stats.hints} hint${r.stats.hints > 1 ? 's' : ''}` : ''}${rec}`, size: 26, cap: big ? 2 : 3 });
    wd.push({ t: 'gap', h: 24 });
    wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Rematch', primary: true, h: 92 });
    if (r.mode === 'match') wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
    wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: r.mode === 'match' ? 6 : undefined, dark: true });
  }
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52, color: '#ffffff' },
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
    { t: 'gap', h: 220 }, { t: 'h', label: 'That is the free web preview', size: 48 },
    { t: 'p', label: 'You have played the free rallies of the web demo. The full game on iPhone and Android has every rival, every light, wind, and unlimited rallies.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// An obvious "there is more below / above" cue for any list that scrolls.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,28,44,0)'); g.addColorStop(1, 'rgba(8,28,44,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,249,234,0.95)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `800 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,249,234,0.95)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `800 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
}

export function renderTitle(ctx, state) {
  bgScene(ctx, state, state.att, 1.7);
  scrim(ctx, 0.3);
  const g = ctx.createRadialGradient(W / 2, 250, 40, W / 2, 250, 460);
  g.addColorStop(0, 'rgba(8,28,44,0.45)'); g.addColorStop(1, 'rgba(8,28,44,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 760);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `600 18px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 14);
}
export function renderSetup(ctx, state) {
  bgScene(ctx, state, state.att, 1.7);
  scrim(ctx, 0.66);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(8,28,44,0)'); g.addColorStop(0.2, 'rgba(8,28,44,0.88)'); g.addColorStop(1, 'rgba(8,28,44,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `800 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1142); }
}
export function renderSettings(ctx, state) {
  bgScene(ctx, state, state.att, 1.7);
  scrim(ctx, 0.7);
  drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H);
}
export function renderResult(ctx, state) {
  const r = state.run;
  const L = lightAt(r.light);
  renderScene(ctx, state, { w: r.w, L, parts: [], trail: [], looks: r.looks, t: state.t, cue: false, guides: null });
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H);
}
export function renderDemoLimit(ctx, state) {
  bgScene(ctx, state, state.att, 1.7);
  scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H);
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.5);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(11,34,54,0.94)', stroke: 'rgba(255,255,255,0.3)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}

// ---- reference pages --------------------------------------------------------------------------------------------------------------
let PAGE_COUNT = 1;
export const pageCount = () => PAGE_COUNT;
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
const ART_H = 230;
const artH = (scale) => (scale > 2 ? 160 : ART_H);

function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PANEL.y + 120, limit = PANEL.y + PANEL.h - 70;
  const pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `800 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `500 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })));
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artHt = sec.art ? artH(scale) : 0;
    let full = titleH + artHt + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    if (!cur || used + full > limit - top) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, art: part === 0 ? sec.art : null, artH: part === 0 ? artHt : 0, lines: [], part };
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
  bgScene(ctx, state, state.att, 1.7);
  scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,249,234,0.97)', stroke: 'rgba(16,50,74,0.4)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.coralDark; ctx.font = `900 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(16,50,74,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(16,50,74,0.15)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.seaDark; ctx.font = `800 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `500 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `500 22px ${FONT}`; ctx.fillStyle = 'rgba(16,50,74,0.65)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#ffffff'; ctx.font = `800 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations ------------------------------------------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 19, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function sandStrip(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#f6e4b8'); g.addColorStop(1, '#ecd29a');
  roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, 18); ctx.clip();
  let s = 11;
  for (let i = 0; i < 160; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const px = x + (s % 10000) / 10000 * w; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const py = y + (s % 10000) / 10000 * h; ctx.fillStyle = i % 3 ? 'rgba(255,250,236,0.7)' : 'rgba(140,104,56,0.35)'; ctx.fillRect(px, py, 1.6, 1.6); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(16,50,74,0.25)'; ctx.lineWidth = 2; roundPath(ctx, x, y, w, h, 18); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.coral, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function miniCourt(ctx, x, y, w, h) {
  // top-down court in a box: far end at the top
  sandStrip(ctx, x, y, w, h);
  ctx.strokeStyle = 'rgba(112,80,40,0.7)'; ctx.lineWidth = 3;
  const cx0 = x + w * 0.2, cx1 = x + w * 0.8, cy0 = y + 14, cy1 = y + h - 14;
  ctx.strokeRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
  ctx.beginPath(); ctx.moveTo(cx0, (cy0 + cy1) / 2); ctx.lineTo(cx1, (cy0 + cy1) / 2); ctx.stroke();
  return { cx0, cx1, cy0, cy1 };
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    figures() {
      sandStrip(ctx, 0, 0, w, h);
      const ks = ['you', 'dana', 'noa', 'eli', 'maya', 'gal', 'shira'], names = ['You', 'Dana', 'Noa', 'Eli', 'Maya', 'Gal', 'Shira'];
      const u = Math.min(50, (w / ks.length) / 1.35);
      ks.forEach((k, i) => {
        const fx = (w / ks.length) * (i + 0.42);
        drawFigure(ctx, { x: fx, y: h - 56, s: u, back: i % 2 === 0, look: k, run: 0, speed: 0, swingT: -1, shade: [0.3, 0.3] });
        label(ctx, names[i], fx, h - 20, 15);
      });
    },
    court() {
      const c = miniCourt(ctx, 0, 0, w, h - 4);
      const cx = (c.cx0 + c.cx1) / 2, my = (c.cy0 + c.cy1) / 2;
      label(ctx, 'far half', cx, c.cy0 + 30, 18); label(ctx, 'your half', cx, c.cy1 - 14, 18, C.coralDark);
      label(ctx, 'the line in the middle: no net', cx, my + 20, 15, C.seaDark);
      ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(cx - 40, c.cy1 - 52, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = C.sea; ctx.beginPath(); ctx.arc(cx + 40, c.cy0 + 52, 12, 0, TAU); ctx.fill();
      label(ctx, '8.4 m wide', c.cx1 - 8, c.cy1 - 8, 15, C.ink, 'right'); label(ctx, '12 m long', c.cx0 + 8, c.cy1 - 8, 15, C.ink, 'left');
    },
    reach() {
      sandStrip(ctx, 0, 0, w, h);
      const cx = w * 0.3, gy = h - 44, u = 74;
      drawFigure(ctx, { x: cx, y: gy, s: u, back: true, look: 'you', run: 0, speed: 0, swingT: -1, shade: [0.3, 0.3] });
      ctx.strokeStyle = 'rgba(16,50,74,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([8, 7]);
      ctx.beginPath(); ctx.ellipse(cx, gy - 4, 1.15 * u, 0.45 * u, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'paddle reach 1.15 m', cx, h - 12, 17);
      const bx = w * 0.72;
      drawFigure(ctx, { x: bx, y: gy, s: u, back: true, look: 'you', run: 1.3, speed: 4, swingT: 0.14, lean: 1, shade: [0.3, 0.3] });
      arrow(ctx, bx - 100, gy - 40, bx - 150, gy - 40, C.seaDark, 5);
      label(ctx, 'drag to run, lift to swing', bx, 32, 17);
    },
    drop() {
      sandStrip(ctx, 0, 0, w, h);
      const cx = w * 0.5, gy = h * 0.72;
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(cx, gy, 52, 24, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(16,50,74,0.4)'; ctx.setLineDash([3, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, gy - 20); ctx.lineTo(cx, h * 0.3); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(60,40,20,0.3)'; ctx.beginPath(); ctx.ellipse(cx, gy, 20, 8, 0, 0, TAU); ctx.fill();
      drawBall(ctx, cx, h * 0.3, 14, 1);
      label(ctx, 'ball', cx + 52, h * 0.3 + 6, 17, C.ink, 'left'); label(ctx, 'drop ring', cx, gy + 48, 18, C.ink);
      label(ctx, 'glows green when a swing is sweet', cx, 28, 16, C.seaDark);
    },
    angle() {
      const c = miniCourt(ctx, 0, 0, w, h - 4);
      const px = (c.cx0 + c.cx1) / 2, py = c.cy1 - 34;
      const tg = [[c.cx0 + 40, c.cy0 + 54, 'left side', '#14a3b4'], [px, c.cy0 + 36, 'centre', '#ffc24b'], [c.cx1 - 40, c.cy0 + 54, 'right side', '#ff6a4a']];
      tg.forEach(([tx, ty, nm, col]) => {
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash([3, 9]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(tx, ty, 18, 10, 0, 0, TAU); ctx.stroke();
        label(ctx, nm, tx, ty + 30, 16, col === '#ffc24b' ? '#a87400' : col);
      });
      drawFigure(ctx, { x: px, y: py + 18, s: 46, back: true, look: 'you', run: 0, speed: 0, swingT: -1, shade: [0.3, 0.3] });
    },
    height() {
      sandStrip(ctx, 0, 0, w, h);
      const gy = h - 36, x0 = 44;
      ctx.strokeStyle = 'rgba(16,50,74,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, gy); ctx.lineTo(w - 14, gy); ctx.stroke();
      const rows = [['Smash', 0.62, 0, '#ff6a4a', 0.38], ['Drive', 1.05, 52, '#ffc24b', 0.6], ['Lob', 1.55, 120, '#14a3b4', 0.8]];
      rows.forEach(([nm, tt, hgt, col, fx]) => {
        const x1 = w * fx + 40;
        ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.setLineDash([2, 8]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, gy - 90 + (nm === 'Lob' ? 60 : nm === 'Drive' ? 30 : 0)); ctx.quadraticCurveTo((x0 + x1) / 2, gy - 90 - hgt * 1.1, x1, gy - 6); ctx.stroke(); ctx.setLineDash([]);
        drawBall(ctx, x1, gy - 10, 8);
        label(ctx, `${nm} ${tt.toFixed(2)} s`, x1, gy + 22, 15, col === '#ffc24b' ? '#a87400' : col);
      });
      drawFigure(ctx, { x: 26, y: gy, s: 54, back: false, look: 'you', run: 0, speed: 0, swingT: -1, shade: [0.3, 0.3] });
      label(ctx, 'higher contact: faster and shorter', w * 0.55, 26, 16, C.ink);
    },
    swing() {
      sandStrip(ctx, 0, 0, w, h);
      const fx = [0.16, 0.5, 0.84], ts = [0.0, 0.12, 0.42], nm = ['wind-up 0.05 s', 'impact 0.26 s', 'recovery'];
      fx.forEach((f, i) => { drawFigure(ctx, { x: w * f, y: 142, s: 54, back: true, look: 'you', run: 0, speed: 0, swingT: ts[i], shade: [0.3, 0.3] }); label(ctx, nm[i], w * f, 156, 16); });
      const bx = 20, bw = w - 40, by = 176;
      const seg = [[0.05, '#ffc24b'], [0.26, '#ff6a4a'], [0.24, '#14a3b4']];
      let x0 = bx;
      seg.forEach(([d, col]) => { const ww = (d / 0.55) * bw; ctx.fillStyle = col; roundPath(ctx, x0, by, ww - 3, 20, 8); ctx.fill(); x0 += ww; });
      label(ctx, '0.55 s in all', w / 2, h - 2, 15, C.ink);
    },
    sweet() {
      sandStrip(ctx, 0, 0, w, h);
      const gx = 120, top = 20, bot = h - 20, scale = (bot - top) / 1.65;
      const yh = (hh) => bot - (hh - 0.35) * scale;
      ctx.fillStyle = 'rgba(255,106,74,0.35)'; ctx.fillRect(gx, yh(2.0), 70, yh(1.55) - yh(2.0));
      ctx.fillStyle = 'rgba(47,191,138,0.55)'; ctx.fillRect(gx, yh(1.4), 70, yh(0.95) - yh(1.4));
      ctx.fillStyle = 'rgba(20,163,180,0.35)'; ctx.fillRect(gx, yh(0.8), 70, yh(0.35) - yh(0.8));
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(gx, yh(2.0), 70, yh(0.35) - yh(2.0));
      [[2.0, '2.0 m'], [1.4, '1.4'], [0.95, '0.95'], [0.35, '0.35 m']].forEach(([v, t]) => label(ctx, t, gx - 8, yh(v) + 5, 15, C.ink, 'right'));
      label(ctx, 'smash, above 1.55 m: wobbles', gx + 86, yh(1.78) + 5, 16, '#d9472b', 'left');
      label(ctx, 'sweet: lands where the ring says', gx + 86, yh(1.175) + 5, 16, '#1b8a64', 'left');
      label(ctx, 'lob, below 0.8 m: wobbles', gx + 86, yh(0.55) + 5, 16, '#0e7d92', 'left');
    },
    land() {
      const c = miniCourt(ctx, 0, 0, w, h - 4);
      const my = (c.cy0 + c.cy1) / 2, cx = (c.cx0 + c.cx1) / 2;
      const mark = (px, py, ok, t) => { ctx.strokeStyle = ok ? '#1b8a64' : '#d9472b'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); if (ok) { ctx.moveTo(px - 8, py); ctx.lineTo(px - 2, py + 7); ctx.lineTo(px + 9, py - 8); } else { ctx.moveTo(px - 8, py - 8); ctx.lineTo(px + 8, py + 8); ctx.moveTo(px + 8, py - 8); ctx.lineTo(px - 8, py + 8); } ctx.stroke(); label(ctx, t, px, py + 26, 14, ok ? '#1b8a64' : '#d9472b'); };
      mark(cx - 30, c.cy0 + 44, true, 'unreturned: hitter scores'); mark(cx + 30, my + 40, false, 'own side: hitter loses'); mark(c.cx1 + 28, c.cy0 + 70, false, 'out');
    },
    serve() {
      sandStrip(ctx, 0, 0, w, h);
      drawFigure(ctx, { x: w * 0.3, y: h - 40, s: 80, back: true, look: 'you', run: 0, speed: 0, swingT: -1, shade: [0.3, 0.3] });
      drawBall(ctx, w * 0.3 + 20, 34, 13);
      arrow(ctx, w * 0.3 + 20, 52, w * 0.3 + 20, 100, C.seaDark, 4);
      label(ctx, 'tossed from about 2 m', w * 0.3 + 44, 40, 17, C.ink, 'left');
      label(ctx, 'early: fast', w * 0.55, h - 80, 17, C.ink, 'left'); label(ctx, 'late: high', w * 0.55, h - 52, 17, C.ink, 'left');
    },
    wind() {
      sandStrip(ctx, 0, 0, w, h);
      ctx.strokeStyle = C.coral; ctx.lineWidth = 5; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(60, h * 0.78); ctx.quadraticCurveTo(w * 0.5, h * 0.05, w * 0.82, h * 0.7); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(16,50,74,0.4)'; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(60, h * 0.78); ctx.quadraticCurveTo(w * 0.45, h * 0.05, w * 0.6, h * 0.7); ctx.stroke(); ctx.setLineDash([]);
      drawBall(ctx, 60, h * 0.78, 10);
      arrow(ctx, w * 0.62, 36, w * 0.9, 36, C.seaDark, 6); label(ctx, 'wind', w * 0.76, 66, 18, C.seaDark);
      label(ctx, 'the ring already allows for it', w * 0.5, h - 16, 16, C.ink);
    },
    tiers() {
      sandStrip(ctx, 0, 0, w, h);
      const n = TIER_NAMES.length, cw = (w - 40) / n;
      TIER_NAMES.forEach((nm, i) => {
        const cx = 20 + cw * i;
        roundPath(ctx, cx + 4, h * 0.36 + (n - i) * -4, cw - 8, h * 0.4 + i * 8, 14); ctx.fillStyle = i % 2 ? C.coral : C.sea; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `900 24px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(String(TIER_AT[i]), cx + cw / 2, h * 0.36 + 40 + (n - i) * -4);
        label(ctx, nm, cx + cw / 2, h - 14, 13, C.ink);
      });
      label(ctx, 'tiers by rally length · Rhythm x1 to x5', w / 2, 24, 16, C.coralDark);
    },
    score() {
      sandStrip(ctx, 0, 0, w, h);
      roundPath(ctx, w * 0.12, h * 0.22, w * 0.76, h * 0.52, 26); ctx.fillStyle = 'rgba(8,28,44,0.85)'; ctx.fill();
      ctx.textAlign = 'center'; ctx.font = `800 20px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText('YOU', w * 0.27, h * 0.4); ctx.fillText('MAYA', w * 0.73, h * 0.4); ctx.fillText('TO 7', w / 2, h * 0.4);
      outlineText(ctx, '5', w * 0.27, h * 0.65, 54, '#ffe9a8'); outlineText(ctx, '3', w * 0.73, h * 0.65, 54, '#fff');
      ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(w * 0.37, h * 0.62, 8, 0, TAU); ctx.fill();
      label(ctx, 'first side to 7 (or 11) wins; the server changes every two points', w / 2, h - 12, 15, C.ink);
    },
    think() {
      sandStrip(ctx, 0, 0, w, h);
      const bw = (w - 60) / 3, steps = [['THINK', '2 / 5 / 8 / 10 s', '#14a3b4'], ['REVEAL', '2 s', '#2fbf8a'], ['ACT', 'play on', '#ff6a4a']];
      steps.forEach(([a, b, col], i) => {
        const x0 = 10 + i * (bw + 20);
        roundPath(ctx, x0, h * 0.2, bw, h * 0.52, 20); ctx.fillStyle = col; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `900 28px ${FONT}`; ctx.fillText(a, x0 + bw / 2, h * 0.2 + 54); ctx.font = `700 18px ${FONT}`; ctx.fillText(b, x0 + bw / 2, h * 0.2 + 88);
        if (i < 2) arrow(ctx, x0 + bw + 2, h * 0.46, x0 + bw + 18, h * 0.46, C.ink, 4);
      });
      label(ctx, 'Pause freezes the whole loop, including the timer', w / 2, h - 12, 16, C.ink);
    },
  };
  (A[key] ?? A.court)();
  ctx.restore();
}
void LOOKS; void tierOf;
