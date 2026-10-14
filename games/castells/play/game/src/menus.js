// Every screen that is not the play screen: title, campaign list, settings, colla (collection), result, pause, the demo limit card and
// the About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, plaque, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { COLLAS, PLAZAS, drawPerson, drawBadge, drawBackdrop } from './art.js';
import { RECIPES, ZONE } from './sim.js';
import { drawAttract, collaOf, paintPeople, colWidth } from './view.js';

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

export const totalStars = (rec) => Object.values(rec.stars || {}).reduce((a, b) => a + (b | 0), 0) + (rec.bonus | 0);
export const towerUnlocked = (rec, i) => i === 0 || ((rec.stars || {})[RECIPES[i - 1].id] | 0) >= 1;

// ---- widgets ---------------------------------------------------------------------------------------------------------------
const heroArt = (h = 270) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `italic 800 150px ${DISPLAY}`;
    // the lettering is a cast-metal sign: a dark outline, an extruded gold body, a lit face with a bevel line
    ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(12,10,30,0.94)'; ctx.strokeText('Castells', cx, 150);
    for (let d = 11; d >= 1; d--) { ctx.fillStyle = d > 6 ? '#5a3208' : '#8a5410'; ctx.fillText('Castells', cx + d * 0.55, 150 + d * 0.95); }
    const g = ctx.createLinearGradient(0, 40, 0, 170); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, '#ffe07a'); g.addColorStop(0.62, '#e8a22c'); g.addColorStop(1, '#b8651a');
    ctx.fillStyle = g; ctx.fillText('Castells', cx, 150);
    ctx.save(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.strokeText('Castells', cx - 1, 149); ctx.restore();
    // a band of light across the upper third of the letters
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
    // the strapline sits on a small walnut ribbon with a brass rim
    const sub = 'Catalan human towers';
    ctx.font = `700 29px ${FONT}`;
    const tw = ctx.measureText(sub).width + 54;
    plaque(ctx, cx - tw / 2, 178, tw, 46, { r: 23, kind: 'wood', rim: true, shadow: true });
    ctx.fillStyle = '#fff1cf'; ctx.textBaseline = 'middle'; textShadow(ctx, sub, cx, 202, '#fff1cf', 4);
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 24px ${FONT}`; textShadow(ctx, 'Build it. Steady it. Crown it.', cx, 256, '#ffe9bf', 8);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });
const starsArt = (n, h = 90) => ({
  t: 'art', h,
  draw(ctx, w) {
    for (let i = 0; i < 3; i++) {
      const x = w / 2 + (i - 1) * 96, y = h / 2 + (i === 1 ? -4 : 6), on = i < n;
      ctx.save(); ctx.translate(x, y); ctx.rotate(i === 0 ? -0.15 : i === 2 ? 0.15 : 0);
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 17 : 40, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
      ctx.fillStyle = on ? '#ffd24a' : 'rgba(20,24,50,0.55)'; ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = on ? '#8a5a10' : 'rgba(255,255,255,0.25)'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
  },
});

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  const rec = state.record, n = totalStars(rec);
  const daily = rec.daily && rec.daily.day === state.day ? rec.daily.stars : -1;
  wd.push({ t: 'btn', id: 'campaign', label: 'Campaign', sub: n ? `${n} star${n === 1 ? '' : 's'} so far` : 'Build your first tower', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Castell', sub: daily >= 0 ? `Today: ${daily} star${daily === 1 ? '' : 's'}` : 'A new puzzle today', row: 1 });
  wd.push({ t: 'btn', id: 'free', label: 'Free Build', sub: 'A new puzzle each time', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'colla', label: 'Colla', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function campaignWidgets(state) {
  const rec = state.record;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Campaign', size: 48 }, { t: 'p', label: 'Eight towers, from small to grand. One star unlocks the next.', size: 24 }];
  RECIPES.forEach((r, i) => {
    const ok = towerUnlocked(rec, i), st = (rec.stars || {})[r.id] | 0;
    wd.push({ t: 'btn', id: `tower:${i}`, label: r.name, sub: ok ? r.blurb : 'Earn a star on the tower before', stars: ok ? st : undefined, disabled: !ok, primary: ok && st === 0 && (i === 0 || ((rec.stars || {})[RECIPES[i - 1].id] | 0) >= 1), h: 88 });
  });
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function collaWidgets(state, w) {
  const rec = state.record, sel = state.collSel, n = totalStars(rec);
  const cols = 3, gap = 18, cell = Math.min(180, Math.floor((w - gap * (cols - 1)) / cols)), shH = 2 * (cell + gap) - 6;
  const cm = collaOf(state);
  const shirts = {
    t: 'art', h: shH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 's');
      const people = [];
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      COLLAS.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (cell + gap), has = n >= d.need;
        roundPath(ctx, x, y, cell, cell, 20); ctx.fillStyle = sel && sel.kind === 's' && sel.i === i ? 'rgba(255,224,138,0.35)' : 'rgba(14,18,40,0.55)'; ctx.fill();
        ctx.lineWidth = rec.collaSel === i ? 4 : 2; ctx.strokeStyle = rec.collaSel === i ? '#7fe0c8' : 'rgba(255,255,255,0.3)'; ctx.stroke();
        ctx.save(); ctx.globalAlpha = has ? 1 : 0.35;
        people.push({ kind: 'tier', key: 'c' + i, person: { id: i, kid: false, h: 1, skin: i % 5, hair: i % 5, hairCol: i % 6, name: i % 2 ? 'Marta' : 'Pau' }, x: x + cell / 2, y: y + cell * 0.8, s: cell * 0.78, k: 0, j: 0, n: 1, o: { shirt: d, pose: 'hold', t: 0, alpha: has ? 1 : 0.35 } });
        ctx.restore();
        if (!has) { ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${Math.round(cell * 0.14)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${d.need} stars`, x + cell / 2, y + cell * 0.5); }
        ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.115))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name, x + cell / 2, y + cell - 12);
        COLL.rects.push({ kind: 's', i, x: at.x + x, y: at.y + y, w: cell, h: cell });
      });
      paintPeople(ctx, state, people, { s: cell * 0.78, cx: ww / 2, gy: cell * 0.8, N: 1, colW: cell * 0.3 }, { x: 0, y: 0, w: ww, h: hh }, { group: 'colla', M: 7, T: 3, plaza: 0 });
    },
  };
  const yc = Math.round(cell * 0.62), yw = Math.floor((w - gap) / 2), yh = 2 * (yc + gap) - 6;
  const squares = {
    t: 'art', h: yh,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'y');
      PLAZAS.forEach((pz, i) => {
        const r = Math.floor(i / 2), c = i % 2, x = c * (yw + gap), y = r * (yc + gap), has = n >= pz.need;
        ctx.save(); roundPath(ctx, x, y, yw, yc, 18); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + yc * 0.62); g.addColorStop(0, pz.sky[0]); g.addColorStop(0.6, pz.sky[1]); g.addColorStop(1, pz.sky[2]); ctx.fillStyle = g; ctx.fillRect(x, y, yw, yc * 0.62);
        ctx.fillStyle = pz.walls[0]; ctx.fillRect(x + yw * 0.05, y + yc * 0.22, yw * 0.3, yc * 0.4); ctx.fillStyle = pz.walls[2]; ctx.fillRect(x + yw * 0.38, y + yc * 0.15, yw * 0.26, yc * 0.47); ctx.fillStyle = pz.walls[1]; ctx.fillRect(x + yw * 0.66, y + yc * 0.26, yw * 0.3, yc * 0.36);
        ctx.fillStyle = pz.dark; for (const wx of [0.12, 0.45, 0.74]) ctx.fillRect(x + yw * wx, y + yc * 0.32, yw * 0.06, yc * 0.12);
        const fg = ctx.createLinearGradient(0, y + yc * 0.62, 0, y + yc); fg.addColorStop(0, pz.floor[0]); fg.addColorStop(1, pz.floor[1]); ctx.fillStyle = fg; ctx.fillRect(x, y + yc * 0.62, yw, yc * 0.38);
        if (!has) { ctx.fillStyle = 'rgba(10,14,34,0.55)'; ctx.fillRect(x, y, yw, yc); }
        ctx.restore();
        ctx.lineWidth = rec.plazaSel === i ? 4 : 2; ctx.strokeStyle = rec.plazaSel === i ? '#7fe0c8' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, yw, yc, 18); ctx.stroke();
        ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(yw * 0.07))}px ${FONT}`;
        textShadow(ctx, has ? pz.name : `${pz.name}: ${pz.need} stars`, x + yw / 2, y + yc - 16, '#fff6e0', 6);
        COLL.rects.push({ kind: 'y', i, x: at.x + x, y: at.y + y, w: yw, h: yc });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 's') { const d = COLLAS[sel.i]; info = n >= d.need ? (rec.collaSel === sel.i ? `${d.name} is the colla shirt.` : `${d.name}. Tap again to wear it.`) : `${d.name}: collect ${d.need} stars (you have ${n}).`; }
    else { const d = PLAZAS[sel.i]; info = n >= d.need ? (rec.plazaSel === sel.i ? `${d.name} is in use.` : `${d.name}. Tap again to build there.`) : `${d.name}: collect ${d.need} stars (you have ${n}).`; }
  }
  void cm;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Colla', size: 48 },
    { t: 'p', label: `Stars collected: ${n}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'p', label: 'Shirts', bold: true, color: '#ffe9bf', size: 26 },
    shirts,
    { t: 'p', label: 'Squares', bold: true, color: '#ffe9bf', size: 26 },
    squares,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 60 }, { t: 'h', label: r.word, size: wide ? 46 : 52, cap: big ? 1.15 : 1.4 }];
  if (r.watch) wd.push({ t: 'p', label: 'Built by Watch & Learn.', size: 26, cap: big ? 2 : 3 });
  else wd.push(starsArt(r.stars, wide ? 80 : 96));
  wd.push({ t: 'p', label: r.gloss, size: 26, cap: big ? 2 : 3 });
  if (!r.watch) {
    const bits = [`${r.towerName}`, r.aleta ? `aleta ${r.aleta}` : 'no aleta', `peak lean ${Math.round(r.peak * 100)}%`];
    wd.push({ t: 'p', label: bits.join(' · '), size: 24, bold: true, color: '#ffe9bf', cap: big ? 2 : 3 });
    if (r.hints) wd.push({ t: 'p', label: 'Think was used: three stars need a tower without it.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
    for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
    if (r.unlocks.length) wd.push({ t: 'btn', id: 'colla', label: 'Open the Colla', active: true });
  }
  wd.push({ t: 'gap', h: wide ? 6 : 16 });
  if (r.next) wd.push({ t: 'btn', id: 'next', label: `Next tower: ${r.next}`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'again', label: r.watch ? 'Watch again' : r.next ? 'Try again' : 'Play again', primary: !r.next, h: r.next ? 76 : 92 });
  if (!r.watch) wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 24 });
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
    { t: 'btn', id: 'p-retry', label: 'Restart tower', row: 8 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free towers of the web demo. The full game on iPhone and Android has the whole campaign, the daily castell, free builds, every shirt and square, and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- frames --------------------------------------------------------------------------------------------------------------------
export function frameFor(state, key) {
  const sc = TEXT_SCALES[state.settings.textIdx], L = land();
  if (key === 'title') {
    if (!L) {
      const bottom = H - host.b - lockSize(600).strip, btnH = flowLayout(estCtx, titleWidgets(state), sc, { x: 40, w: 640 }).contentH;
      const colTop = Math.max(bottom - btnH, host.t + 330), heroTop = host.t + 10;
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop } };
    }
    const cw = clamp(Math.round(W * 0.36), 420, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'campaign') return { cols: [{ widgets: campaignWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'colla') return { cols: [{ widgets: collaWidgets(state, w), x, w, top: host.t, bottom: H - host.b }] };
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

// ---- drawing -----------------------------------------------------------------------------------------------------------------------
function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(10,14,34,${a * 0.7})`); g.addColorStop(0.5, `rgba(10,14,34,${a})`); g.addColorStop(1, `rgba(10,14,34,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(10,14,34,0)'); g.addColorStop(1, 'rgba(10,14,34,0.7)');
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
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(10,14,36,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
function backdrop(ctx, state, dim, own = null) { drawAttract(ctx, state, { x: 0, y: H * 0.16, w: W, h: H * 0.84 }, own, { x: 0, y: 0, w: W, h: H }); scrim(ctx, dim); }
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top, colTop = fr.cols[0].top;
    drawAttract(ctx, state, { x: 0, y: top + 150, w: W, h: Math.max(320, colTop - top - 130) }, null, { x: 0, y: 0, w: W, h: Math.min(H, colTop + 70) });
    const g = ctx.createRadialGradient(W / 2, top + 130, 40, W / 2, top + 130, 400); g.addColorStop(0, 'rgba(10,12,34,0.62)'); g.addColorStop(1, 'rgba(10,12,34,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 520);
    plaque(ctx, 12, colTop - 24, W - 24, H - colTop + 80, { r: 34, kind: 'wood', rim: true });
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  drawAttract(ctx, state, { x: fr.hero.x0, y: H * 0.33, w: hw, h: H * 0.67 }, null, { x: 0, y: 0, w: W, h: H });
  const g = ctx.createRadialGradient(hx, 140, 30, hx, 140, 340); g.addColorStop(0, 'rgba(10,12,34,0.6)'); g.addColorStop(1, 'rgba(10,12,34,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 520);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
export function renderCampaign(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'campaign'); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.68); drawFlowScreen(ctx, state, 'settings'); }
export function renderColla(ctx, state) { backdrop(ctx, state, 0.72); drawFlowScreen(ctx, state, 'colla'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.6 : 0.5, state.play && state.play.climb && state.play.phase === 'over' ? state.play : null); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(24,32,58,0.95)', stroke: 'rgba(255,224,160,0.5)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: lay.contentH, cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }] };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, state.ui.scroll, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, state.ui.scroll, maxScroll, px, pw);
}

// ---- reference pages ----------------------------------------------------------------------------------------------------------------
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
    if (sec.art && scale <= 2) { items.push({ t: 'art', art: sec.art, y }); y += 230; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => { if (pi > 0) y += lh * 0.45; wrapLines(ctx, para, tw).forEach((l) => { items.push({ t: 'line', text: l, y }); y += lh; }); });
    y += 26;
  });
  return { items, fs, lh, secFs, total: y + 10 };
}
const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.74);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,242,226,0.97)', stroke: 'rgba(40,50,90,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(40,50,90,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 280 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(40,50,90,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 220); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 214, state); ctx.restore(); }
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

// ---- illustrations (drawn with the game's own people) ----------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(20,28,54,0.82)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function sceneBg(ctx, w, h) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f6c98a'); g.addColorStop(0.62, '#f3a87a'); g.addColorStop(0.63, '#9a8470'); g.addColorStop(1, '#6a5a4c'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(40,50,90,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
const P = (i, kid = false) => ({ id: i * 3 + 1, kid, h: kid ? 0.72 : 1, skin: (i * 2) % 5, hair: i % 5, hairCol: (i * 3) % 6 });
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  sceneBg(ctx, w, h);
  const col = collaOf(state), t = state.t;
  const A = {
    tower() {
      const s = h * 0.208, gy = h * 0.94, cx = w * 0.5, pitch = s * 0.82, cw = colWidth() * s; // 6 tiers: s 0.42 clipped the crowned children at the top of the box
      const S = [];
      const add = (k, j, n, i, kid, pose, x, y, ex = {}) => S.push({ kind: kid ? 'kid' : 'tier', key: 'a' + i, person: { ...P(i, kid), name: i % 2 ? 'Marta' : 'Pau' }, x, y, s, k, j, n, ...ex, o: { shirt: col, pose, t, smile: pose === 'cheer' } });
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) add(k, j, 3, k * 3 + j, false, 'hold', cx + (j - 1) * cw, gy - k * pitch);
      add(3, 0, 2, 10, false, 'hold', cx - cw * 0.45, gy - 3 * pitch, { kind: 'kid', role: 0 });
      add(3, 1, 2, 11, false, 'hold', cx + cw * 0.45, gy - 3 * pitch, { kind: 'kid', role: 1 });
      add(4, 0, 1, 12, true, 'hold', cx, gy - 4 * pitch, { role: 2 });
      add(5, 0, 1, 13, true, 'cheer', cx, gy - 5 * pitch + s * 0.02, { role: 3 });
      paintPeople(ctx, state, S, { s, cx, gy, N: 3, colW: cw }, { x: 0, y: 0, w, h }, { group: 'art', T: 3, plaza: 0 });
      tag(ctx, 'enxaneta', cx + s * 1.5, gy - 5 * pitch - s * 0.3, '#fff6e2', 17);
      tag(ctx, 'tronc', cx - s * 1.7, gy - 1 * pitch - s * 0.4, '#fff6e2', 17);
      tag(ctx, 'pinya', cx + s * 1.6, gy - s * 0.1, '#fff6e2', 17);
    },
    tray() {
      const cw = w * 0.4, ch = h * 0.62;
      [0, 1].forEach((i) => {
        const cx0 = w * (0.07 + i * 0.5), cy0 = h * 0.14, p = P(i + 2);
        roundPath(ctx, cx0, cy0, cw, ch, 16); ctx.fillStyle = i ? 'rgba(130,205,160,0.6)' : 'rgba(255,252,242,0.95)'; ctx.fill(); ctx.lineWidth = i ? 4 : 2; ctx.strokeStyle = i ? '#2d8a56' : 'rgba(70,56,36,0.45)'; ctx.stroke();
        drawBadge(ctx, cx0 + ch * 0.36, cy0 + ch / 2, ch * 0.28, p, col);
        label(ctx, i ? 'Marta' : 'Pau', cx0 + ch * 0.72, cy0 + ch * 0.32, 21, C.deep, 'left');
        label(ctx, i ? '▲ 190 kg' : '▲ 240 kg', cx0 + ch * 0.72, cy0 + ch * 0.58, 20, '#1b6a3c', 'left');
        label(ctx, i ? '▼ 58 kg' : '▼ 84 kg', cx0 + ch * 0.72, cy0 + ch * 0.82, 20, '#5a4a30', 'left');
      });
      label(ctx, '▲ can hold   ▼ weighs', w / 2, h * 0.93, 19, C.deep);
    },
    load() {
      const s = h * 0.3, gy = h * 0.84, cx = w * 0.3, pitch = s * 0.82, cw = colWidth() * s;
      const S = [];
      for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) { const i = k * 2 + j + 3; S.push({ kind: 'tier', key: 'l' + i, person: { ...P(i), name: i % 2 ? 'Marta' : 'Pau' }, x: cx + (j - 0.5) * cw, y: gy - k * pitch, s, k, j, n: 2, o: { shirt: col, pose: 'hold', t } }); }
      paintPeople(ctx, state, S, { s, cx, gy, N: 2, colW: cw }, { x: 0, y: 0, w, h }, { group: 'art', T: 3, plaza: 0 });
      ctx.strokeStyle = '#7a2a12'; ctx.fillStyle = '#7a2a12'; ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) { const yy = gy - k * pitch - s * 0.5; ctx.beginPath(); ctx.moveTo(cx + s * 0.62, yy); ctx.lineTo(cx + s * 0.62 + 24, yy); ctx.stroke(); }
      label(ctx, 'load = weight above', w * 0.62, h * 0.28, 22, C.deep, 'left');
      label(ctx, '÷ people in the tier', w * 0.62, h * 0.28 + 32, 22, C.deep, 'left');
      label(ctx, 'strength ≥ load', w * 0.62, h * 0.28 + 80, 24, '#1b6a3c', 'left');
    },
    climb() {
      const gx = w * 0.08, gw = w * 0.84, gy = h * 0.4, gh = 38;
      const gr = ctx.createLinearGradient(gx, 0, gx + gw, 0);
      gr.addColorStop(0, '#c2412e'); gr.addColorStop(0.5 - ZONE.slow / 2, '#e8a23a'); gr.addColorStop(0.5 - ZONE.go / 2, '#5fbf7a'); gr.addColorStop(0.5 + ZONE.go / 2, '#5fbf7a'); gr.addColorStop(0.5 + ZONE.slow / 2, '#e8a23a'); gr.addColorStop(1, '#c2412e');
      roundPath(ctx, gx, gy, gw, gh, 19); ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.stroke();
      const mx = gx + gw * (0.5 + 0.12 * Math.sin(t * 1.2));
      roundPath(ctx, mx - 5, gy - 3, 10, gh + 6, 5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#1b1830'; ctx.stroke();
      label(ctx, 'safe', gx + gw / 2, gy + gh + 28, 20, '#1b6a3c');
      label(ctx, 'falls', gx + 30, gy + gh + 28, 20, '#a8281c'); label(ctx, 'falls', gx + gw - 30, gy + gh + 28, 20, '#a8281c');
      tag(ctx, '◄ hold left', w * 0.25, h * 0.14, '#fff6e2', 20); tag(ctx, 'hold right ►', w * 0.75, h * 0.14, '#fff6e2', 20);
    },
    aleta() {
      const s = h * 0.55;
      paintPeople(ctx, state, [{ kind: 'kid', key: 'al', person: { ...P(5, true), name: 'Mia' }, x: w * 0.5, y: h * 0.88, s, k: 0, j: 0, n: 1, role: 3, o: { shirt: col, pose: 'cheer', t, smile: true } }], { s, cx: w * 0.5, gy: h * 0.88, N: 1, colW: s * 0.3 }, { x: 0, y: 0, w, h }, { group: 'art', T: 3, plaza: 0 });
      tag(ctx, 'tap ALETA! when it is calm', w * 0.5, h * 0.1, '#fff6e2', 20);
    },
  };
  (A[key] ?? A.tower)();
  ctx.restore();
}
void TAU; void drawBackdrop;
