// Every screen that is not the play screen: title, match setup, settings, collection, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { COURTS, PETECAS, makeCam, drawPeteca, drawBackdrop, FX } from './art.js';
import { drawScene } from './view.js';
import { drawPerson } from './figure.js';
import { SHOTS, RIVALS, TO_CHOICES, NET, COURT } from './sim.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;
let PAGE_COUNT = 1;
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
const COLL = { rects: [] };
export function resetMenus() { LAID = blankLaid(); PAGE_COUNT = 1; COLL.rects = []; }
export const collectionHit = (x, y) => { for (const r of COLL.rects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r; return null; };
const land = () => W > H;
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.rev}`;
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

export const courtOwned = (rec, i) => (i === 0 ? true : i === 1 ? rec.wins >= 1 : rec.bestStreak >= 15);
export const petecaOwned = (rec, i) => (i === 0 ? true : i === 1 ? rec.wins >= 1 : i === 2 ? rec.perfects >= 50 : rec.bestStreak >= 20);
export const setupLine = (m) => `${m.format === 'doubles' ? 'Doubles' : 'Singles'} · level ${m.level} · to ${m.to}`;

// ---- widgets ---------------------------------------------------------------------------------------------------------------
const heroArt = (h = 330) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `italic 800 170px ${DISPLAY}`;
    // an extruded, lacquered title: thick dark outline, a stack of depth layers, then the lit face with a bright top edge
    ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(4,22,40,0.94)'; ctx.strokeText('Peteca', cx, 176);
    for (let i = 12; i >= 1; i--) { ctx.fillStyle = i > 8 ? '#7a2a08' : i > 4 ? '#a63c0c' : '#cc5412'; ctx.fillText('Peteca', cx, 170 + i * 0.9); }
    const g = ctx.createLinearGradient(0, 60, 0, 190); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, '#ffd653'); g.addColorStop(0.7, '#ff9a2e'); g.addColorStop(1, '#ff6a1f');
    ctx.fillStyle = g; ctx.fillText('Peteca', cx, 170);
    ctx.save(); ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.globalCompositeOperation = 'source-over'; ctx.strokeText('Peteca', cx - 1, 168); ctx.restore();
    // a feather flourish under the word
    ctx.save(); ctx.translate(cx, 196); ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-170, 0); ctx.quadraticCurveTo(0, 14, 170, 0); ctx.stroke(); ctx.restore();
    ctx.font = `700 29px ${FONT}`; textShadow(ctx, 'Strike it high. Keep it flying.', cx, 236, '#ffeec2', 6);
    ctx.font = `600 22px ${FONT}`; textShadow(ctx, 'The hand shuttlecock game of Brazil', cx, 270, '#d9f4ff', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, m = state.settings.match;
  wd.push({ t: 'btn', id: 'match', ico: 'play', label: 'Play Match', sub: setupLine(m), primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'rally', ico: 'rally', label: 'Beach Rally', sub: rec.bestStreak ? `Best ${rec.bestStreak}` : 'Keep it up together', row: 1 });
  wd.push({ t: 'btn', id: 'watch', ico: 'learn', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'setup', ico: 'setup', label: 'Match setup', row: 2 });
  wd.push({ t: 'btn', id: 'collection', ico: 'collection', label: 'Collection', row: 2 });
  wd.push({ t: 'btn', id: 'howto', ico: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', ico: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', ico: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', ico: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', ico: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function setupWidgets(state) {
  const m = state.settings.match, rec = state.record;
  const rv = RIVALS[m.level - 1];
  const dbl = m.format === 'doubles';
  const wd = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Match setup', size: 48 },
    { t: 'p', label: 'Format', bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'fmt-singles', label: 'Singles', sub: 'You against one rival', row: 1, active: !dbl },
    { t: 'btn', id: 'fmt-doubles', label: 'Doubles', sub: 'You and Lia, three touches', row: 1, active: dbl },
    { t: 'p', label: `Rival: level ${m.level}, ${rv.name}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'p', label: rv.blurb, size: 23 },
    { t: 'btn', id: 'lvl-dec', label: 'Easier', row: 2, disabled: m.level <= 1 },
    { t: 'btn', id: 'lvl-inc', label: 'Harder', row: 2, disabled: m.level >= (state.demo ? 3 : 5) },
    { t: 'p', label: 'Game length', bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'to-7', label: `To ${TO_CHOICES[0]}`, sub: 'Quick game', row: 3, active: m.to === TO_CHOICES[0] },
    { t: 'btn', id: 'to-11', label: `To ${TO_CHOICES[1]}`, sub: 'Full game', row: 3, active: m.to === TO_CHOICES[1] },
    { t: 'p', label: `Court: ${COURTS[rec.courtSel].name}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'court-prev', label: 'Previous court', row: 4 },
    { t: 'btn', id: 'court-next', label: 'Next court', row: 4 },
    { t: 'gap', h: 8 },
    { t: 'btn', id: 'start', label: 'Start match', primary: true, h: 88 },
    { t: 'btn', id: 'back', label: 'Back', dark: true },
    { t: 'gap', h: 30 },
  ];
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-gauge', label: st.gauge ? 'Strike gauge: On' : 'Strike gauge: Off', sub: 'The height ruler beside the court', active: st.gauge },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked', bold: true, size: 26, color: '#ffe9bf' }]
      : [{ t: 'btn', id: 'restore', label: state.restoreBusy ? 'Checking…' : 'Restore purchase', dark: true, disabled: !!state.restoreBusy }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function collectionWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const gap = 18, cw = Math.floor((w - gap) / 2), ch = Math.round(cw * 0.58);
  const courts = {
    t: 'art', h: 2 * (ch + gap) - gap + 10,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'c');
      COURTS.forEach((c, i) => {
        const r = Math.floor(i / 2), col = i % 2, x = col * (cw + gap), y = r * (ch + gap), has = courtOwned(rec, i);
        ctx.save(); roundPath(ctx, x, y, cw, ch, 18); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + ch); g.addColorStop(0, c.sky[0]); g.addColorStop(0.5, c.sky[1]); g.addColorStop(0.58, c.sea[0]); g.addColorStop(0.7, c.sand[0]); g.addColorStop(1, c.sand[1]);
        ctx.fillStyle = g; ctx.fillRect(x, y, cw, ch);
        ctx.fillStyle = c.far; ctx.beginPath(); ctx.moveTo(x, y + ch * 0.56); ctx.quadraticCurveTo(x + cw * 0.3, y + ch * 0.28, x + cw * 0.55, y + ch * 0.5); ctx.quadraticCurveTo(x + cw * 0.8, y + ch * 0.6, x + cw, y + ch * 0.4); ctx.lineTo(x + cw, y + ch * 0.58); ctx.lineTo(x, y + ch * 0.58); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x + cw * 0.5 - 2, y + ch * 0.46, 4, ch * 0.34);
        ctx.fillStyle = c.accent; ctx.fillRect(x + cw * 0.5 - 2, y + ch * 0.46, 4, 4);
        if (!has) { ctx.fillStyle = 'rgba(6,22,40,0.58)'; ctx.fillRect(x, y, cw, ch); }
        ctx.restore();
        ctx.lineWidth = rec.courtSel === i ? 4 : 2; ctx.strokeStyle = rec.courtSel === i ? '#7fe0c8' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, cw, ch, 18); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(cw * 0.075))}px ${FONT}`;
        textShadow(ctx, has ? c.name : `🔒 ${c.name}`, x + cw / 2, y + ch - 18, '#fff6e0', 6);
        COLL.rects.push({ kind: 'c', i, x: at.x + x, y: at.y + y, w: cw, h: ch });
      });
    },
  };
  const cell = Math.min(180, Math.floor((w - gap * 3) / 4)), pH = cell + 10;
  const petecas = {
    t: 'art', h: pH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'p');
      const total = 4 * cell + 3 * gap, x0 = (ww - total) / 2;
      PETECAS.forEach((d, i) => {
        const x = x0 + i * (cell + gap), y = 0, has = petecaOwned(rec, i);
        roundPath(ctx, x, y, cell, cell, 20); ctx.fillStyle = sel && sel.kind === 'p' && sel.i === i ? 'rgba(255,224,138,0.35)' : 'rgba(8,28,48,0.6)'; ctx.fill();
        ctx.lineWidth = rec.petecaSel === i ? 4 : 2; ctx.strokeStyle = rec.petecaSel === i ? '#7fe0c8' : 'rgba(255,255,255,0.3)'; ctx.stroke();
        drawPeteca(ctx, x + cell * 0.5, y + cell * 0.46, cell * 0.8, 0.9, i, 0.5 + i, has ? 1 : 0.28);
        if (!has) { ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${Math.round(cell * 0.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + cell * 0.46); }
        ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${Math.max(12, Math.round(cell * 0.11))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name, x + cell / 2, y + cell - 14);
        COLL.rects.push({ kind: 'p', i, x: at.x + x, y: at.y + y, w: cell, h: cell });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 'p') { const d = PETECAS[sel.i]; info = petecaOwned(rec, sel.i) ? (rec.petecaSel === sel.i ? `${d.name} is in use.` : `${d.name}. Tap again to use it.`) : `${d.name}: ${d.how}.`; }
    else { const d = COURTS[sel.i]; const has = courtOwned(rec, sel.i); info = has ? (rec.courtSel === sel.i ? `${d.name} is in use.` : `${d.name}. Tap again to play there.`) : `${d.name}: ${sel.i === 1 ? 'win a match' : 'reach a Beach Rally streak of 15'}.`; }
  }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Collection', size: 48 },
    { t: 'p', label: 'Courts', bold: true, color: '#ffe9bf', size: 26 },
    courts,
    { t: 'p', label: 'Petecas', bold: true, color: '#ffe9bf', size: 26 },
    petecas,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 70 }];
  if (r.mode === 'rally') {
    wd.push({ t: 'h', label: r.newBest ? 'New best streak!' : 'Rally over', size: wide ? 50 : 58, cap: big ? 1.2 : 1.5 });
    wd.push({ t: 'h', label: `${r.streak}`, size: wide ? 84 : 100, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `strikes in a row · ${r.points.toLocaleString('en-US')} points · ${r.perfects} perfect`, size: 26, cap: big ? 2 : 3 });
    wd.push({ t: 'p', label: r.why, size: 24, color: '#ffe9bf', cap: big ? 2 : 3 });
  } else {
    const label = r.mode === 'watch' ? 'Session complete' : r.win ? 'You win!' : 'Rival wins';
    wd.push({ t: 'h', label, size: wide ? 52 : 60, cap: big ? 1.2 : 1.5, color: r.win ? '#9ff0c0' : '#fff6e0' });
    wd.push({ t: 'h', label: `${r.score[0]} – ${r.score[1]}`, size: wide ? 80 : 96, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `${r.strikes} strikes · ${r.perfects} perfect · longest rally ${r.longest}`, size: 26, cap: big ? 2 : 3 });
    if (r.winners) wd.push({ t: 'p', label: `${r.winners} winners · ${r.aces} aces`, size: 24, cap: big ? 2 : 3 });
  }
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice game and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'collection', label: 'Open the Collection', active: true });
  wd.push({ t: 'gap', h: wide ? 8 : 20 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Play again', primary: true, h: 92 });
  if (r.mode !== 'watch') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
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
    { t: 'btn', id: 'p-gauge', label: st.gauge ? 'Gauge: On' : 'Gauge: Off', row: 8, active: st.gauge },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free games of the web demo. The full game on iPhone and Android has every court and peteca, all five rivals, doubles, Beach Rally and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- frames --------------------------------------------------------------------------------------------------------------
export function frameFor(state, key) {
  const sc = TEXT_SCALES[state.settings.textIdx], L = land();
  if (key === 'title') {
    if (!L) {
      const bottom = H - host.b - lockSize(600).strip, btnH = flowLayout(estCtx, titleWidgets(state), sc, { x: 40, w: 640 }).contentH;
      const colTop = Math.max(bottom - btnH, host.t + 380), heroTop = host.t + 14 + Math.max(0, Math.min(60, (colTop - 700) / 4));
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop } };
    }
    const cw = clamp(Math.round(W * 0.36), 420, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'setup') return { cols: [{ widgets: setupWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'collection') return { cols: [{ widgets: collectionWidgets(state, w), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'result') return { cols: [{ widgets: resultWidgets(state, L), x, w, top: Math.max(host.t, oy), bottom: H - host.b, center: L }] };
  if (key === 'demolimit') return { cols: [{ widgets: demoLimitWidgets(state, L), x, w, top: Math.max(host.t, oy), bottom: H - host.b, center: L }] };
  return null;
}
function layColumns(ctx, state, key, fr) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cols = fr.cols.map((c) => {
    const lay = flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w });
    const avail = c.bottom - c.top;
    const top = c.center && lay.contentH < avail ? c.top + (avail - lay.contentH) / 2 : c.top;
    return { lay, top, bottom: c.bottom, x: c.x, w: c.w };
  });
  LAID = { key, sig: sigOf(state), lay: cols[0].lay, top: cols[0].top, bottom: cols[0].bottom, h: cols[0].lay.contentH, cols };
  if (key === 'title') {
    const c = cols[cols.length - 1], ls = lockSize(c.w), used = c.top + c.lay.contentH, cx = c.x + c.w / 2;
    const pinned = H - host.b - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    LAID.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return cols;
}
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay && LAID.sig === sigOf(state)) return;
  const fr = frameFor(state, key);
  if (!fr) return;
  layColumns(estCtx, state, key, fr);
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function hitScreen(x, y, scroll) {
  { const t = LAID.key === 'title' && LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  for (let i = 0; i < LAID.cols.length; i++) {
    const c = LAID.cols[i], id = flowHit(c.lay, c.top, i === 0 ? scroll : 0, x, y);
    if (id) return id;
  }
  return null;
}

// ---- drawing ---------------------------------------------------------------------------------------------------------------
function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,22,40,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,22,40,${a})`); g.addColorStop(1, `rgba(6,22,40,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,22,40,0)'); g.addColorStop(1, 'rgba(6,22,40,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#1c2536'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#1c2536'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key) {
  const fr = frameFor(state, key);
  const cols = layColumns(ctx, state, key, fr);
  const c0 = cols[0], maxScroll = Math.max(0, c0.lay.contentH - (c0.bottom - c0.top));
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  const scroll = state.ui.scroll;
  cols.forEach((c, i) => {
    const mx = Math.max(0, c.lay.contentH - (c.bottom - c.top)), sc = i === 0 ? scroll : 0;
    drawFlow(ctx, c.lay, c.top, c.bottom, sc, { clipX: c.x - 40, clipW: c.w + 80 });
    if (mx > 0) {
      const top = c.top, bottom = c.bottom, th = Math.max(60, (bottom - top) * ((bottom - top) / c.lay.contentH)), ty = top + (sc / mx) * (bottom - top - th);
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// The living background of the menus: the beach court with two pairs of friends rallying on their own.
const HERO_ZOOM = 0.86;
function attract(ctx, state, rect, dim = 0.2) {
  const run = state.att;
  if (!run) { scrim(ctx, dim); return; }
  const cam0 = makeCam(rect, state.attCam ?? 6);
  const hx = run.ball.alive ? run.ball.x : 6;
  state.attCamTarget = hx;
  const cam = cam0;
  if (FX.gl && FX.gl.active) {
    // the live 3D rally behind the menu: the camera drifts slowly; the 2D layer only adds the scrim
    const t = state.t || 0;
    if (state.scene === 'title' && run.players.length >= 2) FX.gl.solve(cam0, { yaw: -16 + 5 * Math.sin(t * 0.3), pitch: 6 + 1.5 * Math.sin(t * 0.21), fov: 30, camX: 6.15, zoom: HERO_ZOOM });
    else FX.gl.solve(cam0, { yaw: -12 + 7 * Math.sin(t * 0.17), pitch: 8 + 2 * Math.sin(t * 0.11), fov: 30, zoom: 1.0 });
    scrim(ctx, dim);
    return;
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  // fill the whole screen with sky first so tall screens have no bars
  ctx.fillStyle = COURTS[state.record.courtSel].sky[0]; ctx.fillRect(0, 0, W, H);
  const fake = { t: state.t, fx: state.attFx, pops: [], trail: null, record: state.record, think: null, land: null, paused: true };
  drawScene(ctx, fake, run, cam);
  ctx.restore();
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(6,22,40,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: top + 120, w: W, h: Math.max(300, fr.cols[0].top - top - 120 + 40) }, 0.08);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(6,24,44,0.62)'); g.addColorStop(1, 'rgba(6,24,44,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(6,22,40,0)'); g2.addColorStop(1, 'rgba(6,22,40,0.88)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: 0, y: H * 0.18, w: fr.hero.x1 + 20, h: H * 0.82 }, 0.1);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(6,24,44,0.6)'); g.addColorStop(1, 'rgba(6,24,44,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSetup(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'setup'); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.68); drawFlowScreen(ctx, state, 'settings'); }
export function renderCollection(ctx, state) { backdrop(ctx, state, 0.72); drawFlowScreen(ctx, state, 'collection'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.62 : 0.54); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(12,36,60,0.96)', stroke: 'rgba(255,224,160,0.5)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: lay.contentH, cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }] };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, state.ui.scroll, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, state.ui.scroll, maxScroll, px, pw);
}

// ---- reference pages -----------------------------------------------------------------------------------------------------------
export const REF = { max: 0, view: 400 };
export const pageCount = () => PAGE_COUNT;
function buildFlow(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80, secFs = Math.round(34 * Math.min(scale, 1.3)), items = [];
  let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ t: 'rule', y }); y += 20; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ t: 'title', tl, y }); y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale <= 2) { items.push({ t: 'art', art: sec.art, y }); y += 210; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => { if (pi > 0) y += lh * 0.45; wrapLines(ctx, para, tw).forEach((l) => { items.push({ t: 'line', text: l, y }); y += lh; }); });
    y += 26;
  });
  return { items, fs, lh, secFs, total: y + 10 };
}
const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.72);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,249,234,0.97)', stroke: 'rgba(40,50,90,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(40,50,90,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(40,50,90,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(40,50,90,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(40,50,90,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}


// ---- illustrations (drawn with the game's own figures and peteca) --------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(10,36,60,0.84)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, court = 0) {
  const c = COURTS[court];
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c.sky[0]); g.addColorStop(0.5, c.sky[1]); g.addColorStop(0.66, c.sea[0]); g.addColorStop(0.7, c.sand[0]); g.addColorStop(1, c.sand[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(30,50,80,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
// a mini court in an illustration: gx = ground y, s = pixels per metre, x0 = pixel of world x 0
const mini = (w, h) => { const s = Math.min(w / 13, h / 4.4); return { s, gy: h * 0.84, x0: (w - 12 * s) / 2 }; };
function miniNet(ctx, m) {
  const x = m.x0 + NET * m.s;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, m.s * 0.08); ctx.beginPath(); ctx.moveTo(x, m.gy); ctx.lineTo(x, m.gy - 2.15 * m.s); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x - 3, m.gy - (2.15 * m.s * i) / 8); ctx.lineTo(x + 5, m.gy - (2.15 * m.s * i) / 8 - 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(m.x0, m.gy + 4); ctx.lineTo(m.x0 + 12 * m.s, m.gy + 4); ctx.stroke();
}
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h, 0);
  const dsg = state.record.petecaSel ?? 0, m = mini(w, h);
  const person = (px, look, f, o = {}) => drawPerson(ctx, { x: m.x0 + px * m.s, gy: m.gy, s: m.s * 1.0, f, look, run: 0, v: 0, ready: 0, anim: null, jump: 0, t: 0, wx: px, ...o });
  const A = {
    peteca() {
      drawPeteca(ctx, w * 0.5, h * 0.55, Math.min(h * 0.9, 160), 0.9, dsg, state.t);
      tag(ctx, 'feathers', w * 0.5 + 90, h * 0.2, '#fff6e2', 18); arrow(ctx, w * 0.5 + 60, h * 0.27, w * 0.5 + 12, h * 0.44, '#7d2a12', 3);
      tag(ctx, 'leather base', w * 0.5 - 100, h * 0.86, '#fff6e2', 18); arrow(ctx, w * 0.5 - 70, h * 0.8, w * 0.5 - 8, h * 0.66, '#7d2a12', 3);
    },
    court() {
      miniNet(ctx, m);
      person(2.9, 5, 1); person(9.1, 0, -1);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(m.x0 + 3.5 * m.s, m.gy - 1.3 * m.s); ctx.quadraticCurveTo(m.x0 + 6 * m.s, m.gy - 4.7 * m.s, m.x0 + 8.8 * m.s, m.gy - 0.4 * m.s); ctx.stroke(); ctx.setLineDash([]);
      drawPeteca(ctx, m.x0 + 5.6 * m.s, m.gy - 3.35 * m.s, m.s, 0.2, dsg, state.t);
      tag(ctx, `net ${NET_H_TEXT}`, m.x0 + NET * m.s + 62, m.gy - 2.3 * m.s, '#fff6e2', 17);
      label(ctx, `court ${COURT} m`, w / 2, h * 0.97, 17, C.deep);
    },
    strokes() {
      const c = ['#ffb54a', '#38d6b9', '#a98cff', '#ff6a5a'], names = ['Lob', 'Drive', 'Drop', 'Smash'];
      const lines = [
        (X, Y) => { ctx.moveTo(X(2.4), Y(0.75)); ctx.quadraticCurveTo(X(5.2), Y(5.2), X(9.2), Y(0.0)); },
        (X, Y) => { ctx.moveTo(X(3.2), Y(1.3)); ctx.quadraticCurveTo(X(6.2), Y(2.9), X(9.6), Y(0.0)); },
        (X, Y) => { ctx.moveTo(X(4.0), Y(1.5)); ctx.quadraticCurveTo(X(5.6), Y(3.2), X(7.0), Y(0.0)); },
        (X, Y) => { ctx.moveTo(X(4.4), Y(2.2)); ctx.quadraticCurveTo(X(6.0), Y(2.4), X(8.4), Y(0.0)); },
      ];
      miniNet(ctx, m);
      lines.forEach((f, i) => { ctx.strokeStyle = c[i]; ctx.lineWidth = 4; ctx.beginPath(); f((u) => m.x0 + u * m.s, (z) => m.gy - z * m.s); ctx.stroke(); tag(ctx, names[i], m.x0 + (i < 2 ? 8.6 + 0.2 * i : 10.2) * m.s - (i === 2 ? 0 : 0), m.gy - (0.35 + i * 0.5) * m.s - 6, c[i], 15); });
      person(3.1, 5, 1);
    },
    gauge() {
      const gx = w * 0.18, y0 = h * 0.88, sc = h * 0.26;
      ctx.strokeStyle = C.deep; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 - 2.8 * sc); ctx.stroke();
      const zs = [['Lob', SHOTS.lob.zi, '#ffb54a'], ['Drive', SHOTS.drive.zi, '#38d6b9'], ['Drop', SHOTS.drop.zi, '#a98cff'], ['Smash', SHOTS.smash.zi, '#ff6a5a']];
      zs.forEach(([nm, z, col]) => { ctx.fillStyle = col; ctx.fillRect(gx - 12, y0 - z * sc - 8, 24, 16); label(ctx, `${nm}  ${z.toFixed(2).replace(/0$/, '')} m`, gx + 26, y0 - z * sc + 6, 17, C.deep, 'left'); });
      drawPeteca(ctx, gx + 150, y0 - 2.3 * sc, 20, -1.2, dsg, state.t); arrow(ctx, gx + 150, y0 - 2.0 * sc, gx + 150, y0 - 1.4 * sc, '#7d2a12', 3);
      label(ctx, 'tap as it falls to the stroke\'s height', w * 0.72, h * 0.92, 16, C.deep);
    },
    depth() {
      for (let i = 0; i < 4; i++) {
        const px = w * (0.05 + i * 0.235), pw = w * 0.21;
        roundPath(ctx, px, h * 0.16, pw, h * 0.68, 14); ctx.fillStyle = i === 1 ? '#e8572a' : '#1f4a66'; ctx.fill();
        ctx.fillStyle = '#fffaf0'; ctx.font = `800 ${Math.round(h * 0.13)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(['Lob', 'Drive', 'Drop', 'Smash'][i], px + pw / 2, h * 0.36);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + pw * 0.12, h * 0.64); ctx.lineTo(px + pw * 0.88, h * 0.64); ctx.stroke();
        ctx.font = `700 ${Math.round(h * 0.075)}px ${FONT}`; ctx.fillText('short', px + pw * 0.28, h * 0.74); ctx.fillText('deep', px + pw * 0.74, h * 0.74);
      }
      label(ctx, 'where you tap in the pad sets the depth', w / 2, h * 0.94, 16, C.deep);
    },
    flow() {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#ffc83c'; ctx.beginPath(); ctx.arc(w * (0.3 + i * 0.14), h * 0.36, h * 0.1, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7d4a00'; ctx.lineWidth = 2; ctx.stroke(); }
      tag(ctx, 'POWER PALM', w * 0.72, h * 0.36, '#ffd23c', 20);
      label(ctx, 'three Perfects in a row', w * 0.3 + 0.14 * w, h * 0.62, 18, C.deep);
      label(ctx, 'next Smash or Drive: flatter and faster', w / 2, h * 0.84, 17, C.deep);
    },
    doubles() {
      miniNet(ctx, m);
      person(2.0, 6, 1); person(4.6, 5, 1); person(8.6, 2, -1); person(10.0, 3, -1);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.moveTo(m.x0 + 2.1 * m.s, m.gy - 1.9 * m.s); ctx.quadraticCurveTo(m.x0 + 3.2 * m.s, m.gy - 3.4 * m.s, m.x0 + 4.4 * m.s, m.gy - 2.0 * m.s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.x0 + 4.8 * m.s, m.gy - 2.2 * m.s); ctx.quadraticCurveTo(m.x0 + 6.6 * m.s, m.gy - 2.5 * m.s, m.x0 + 8.6 * m.s, m.gy - 0.3 * m.s); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, '1 receive', m.x0 + 1.9 * m.s, m.gy - 3.4 * m.s, '#fff6e2', 15); tag(ctx, '2 set', m.x0 + 3.9 * m.s, m.gy - 3.9 * m.s, '#fff6e2', 15); tag(ctx, '3 attack', m.x0 + 5.9 * m.s, m.gy - 3.0 * m.s, '#fff6e2', 15);
    },
  };
  (A[key] ?? A.peteca)();
  ctx.restore();
}
const NET_H_TEXT = '2.15 m';
