// Every screen that is not the play screen: title, settings, collection (rotors, landscapes, Sky Diary), result, pause, the
// demo limit card and the About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawCopter, PALS } from './art.js';
import { drawWorldState } from './view.js';
import { v3 } from './v3.js';
import { ROTORS, SCENES, SESSION_FLIGHTS, rankFor, LAND_PTS } from './sim.js';

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
export const bestOf = (rec) => Math.max(rec.bestFlight, rec.bestDaily);
export const rotorOwned = (rec, i) => bestOf(rec) >= ROTORS[i].need;
export const sceneOwned = (rec, i) => bestOf(rec) >= SCENES[i].need;
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const fit = (t) => { let s = 124; ctx.font = `italic 800 ${s}px ${DISPLAY}`; while (ctx.measureText(t).width > w - 40 && s > 50) { s -= 4; ctx.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
    const s1 = fit('Bamboo');
    ctx.font = `italic 800 ${s1}px ${DISPLAY}`;
    const lines = [['Bamboo', 124], ['Copter', 124 + s1 * 0.86]];
    // an extruded, bevelled bamboo-gold lettering: layered depth, a dark outline, a lit face and a gloss band
    const depth = Math.max(6, Math.round(s1 * 0.085));
    for (const [t, y] of lines) {
      ctx.save(); ctx.shadowColor = 'rgba(0,20,6,0.55)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = depth + 10;
      ctx.fillStyle = '#04200c'; ctx.fillText(t, cx, y + depth); ctx.restore();
      for (let d = depth; d >= 1; d--) {
        ctx.fillStyle = d > depth * 0.6 ? '#0a3c1a' : d > depth * 0.3 ? '#12602a' : '#1d8a3a';
        ctx.fillText(t, cx + d * 0.25, y + d);
      }
      ctx.lineWidth = Math.max(8, s1 * 0.1); ctx.strokeStyle = '#06260f'; ctx.strokeText(t, cx, y);
      const g = ctx.createLinearGradient(0, y - s1 * 0.78, 0, y + s1 * 0.08);
      g.addColorStop(0, '#fffde8'); g.addColorStop(0.28, '#f2f6b8'); g.addColorStop(0.55, '#a8dc6a'); g.addColorStop(0.9, '#3f9e44'); g.addColorStop(1, '#2d8138');
      ctx.fillStyle = g; ctx.fillText(t, cx, y);
      ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,230,0.9)'; ctx.strokeText(t, cx, y); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, y - s1 * 0.8, w, s1 * 0.36); ctx.clip();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.restore();
    }
    ctx.font = `700 26px ${FONT}`;
    // tagline on a small bamboo-green ribbon
    const ty = 130 + s1 * 0.86 + 54, tw = ctx.measureText('Rub it, let go, watch it fly').width + 44;
    roundPath(ctx, cx - tw / 2, ty - 28, tw, 40, 20);
    const rg = ctx.createLinearGradient(0, ty - 28, 0, ty + 12); rg.addColorStop(0, 'rgba(34,92,56,0.92)'); rg.addColorStop(1, 'rgba(8,36,20,0.92)'); ctx.fillStyle = rg; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(232,196,104,0.8)'; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff6d6'; ctx.fillText('Rub it, let go, watch it fly', cx, ty - 7);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state), sn = SCENES[rec.sceneSel].name;
  wd.push({ t: 'btn', id: 'session', label: 'Meadow Session', sub: rec.bestSession[rec.sceneSel] ? `${sn} · best ${rec.bestSession[rec.sceneSel]}` : `${sn} · five flights`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Sky', sub: dk >= 0 ? `Today ${dk}` : 'New weather today', row: 1 });
  wd.push({ t: 'btn', id: 'free', label: 'Free Flight', sub: 'No score, just fly', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'collection', label: 'Collection', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#d6f0cf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#d6f0cf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#d6f0cf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

const LAND_WORD = ['no ring', 'outer ring', 'inner ring', 'bullseye'];
export function collectionWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 3, gap = 16, cell = Math.min(190, Math.floor((w - gap * (cols - 1)) / cols)), shH = 2 * (cell + gap) - gap;
  const rotors = {
    t: 'art', h: shH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'r');
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      ROTORS.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (cell + gap), has = rotorOwned(rec, i);
        roundPath(ctx, x, y, cell, cell, 20); ctx.fillStyle = sel && sel.kind === 'r' && sel.i === i ? 'rgba(255,214,120,0.35)' : 'rgba(10,40,24,0.62)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();
        ctx.save(); ctx.globalAlpha = has ? 1 : 0.3;
        drawCopter(ctx, x + cell / 2, y + cell * 0.3, cell * 0.62, i, 0.4 + i, 0, 0, { view: 0.05 });
        ctx.restore();
        if (!has) { ctx.fillStyle = '#f6fbf0'; ctx.font = `700 ${Math.round(cell * 0.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + cell * 0.4); }
        ctx.fillStyle = '#f6fbf0'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.096))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name, x + cell / 2, y + cell - 18);
        COLL.rects.push({ kind: 'r', i, x: at.x + x, y: at.y + y, w: cell, h: cell });
      });
    },
  };
  const yc = Math.round(cell * 0.62), yw = Math.floor((w - gap) / 2), yh = 2 * (yc + gap) - gap;
  const scenes = {
    t: 'art', h: yh,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 's');
      SCENES.forEach((sd, i) => {
        const r = Math.floor(i / 2), c = i % 2, x = c * (yw + gap), y = r * (yc + gap), has = sceneOwned(rec, i), pal = PALS[i];
        ctx.save(); roundPath(ctx, x, y, yw, yc, 18); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + yc); g.addColorStop(0, pal.sky[0]); g.addColorStop(0.5, pal.sky[1]); g.addColorStop(0.72, pal.sky[2]); ctx.fillStyle = g; ctx.fillRect(x, y, yw, yc);
        ctx.fillStyle = pal.ridge[1]; ctx.beginPath(); ctx.moveTo(x, y + yc * 0.7); ctx.quadraticCurveTo(x + yw * 0.3, y + yc * 0.46, x + yw * 0.55, y + yc * 0.62); ctx.quadraticCurveTo(x + yw * 0.8, y + yc * 0.74, x + yw, y + yc * 0.56); ctx.lineTo(x + yw, y + yc); ctx.lineTo(x, y + yc); ctx.fill();
        ctx.fillStyle = pal.ground[1]; ctx.fillRect(x, y + yc * 0.82, yw, yc * 0.2);
        ctx.fillStyle = `rgb(${pal.sun.c})`; ctx.beginPath(); ctx.arc(x + yw * pal.sun.x, y + yc * Math.min(0.36, pal.sun.y * 0.4), 8, 0, TAU); ctx.fill();
        if (!has) { ctx.fillStyle = 'rgba(8,20,16,0.6)'; ctx.fillRect(x, y, yw, yc); }
        ctx.restore();
        const cur = rec.sceneSel === i;
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#ffd870' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, yw, yc, 18); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(yw * 0.075))}px ${FONT}`;
        textShadow(ctx, has ? sd.name : `🔒 ${sd.name}`, x + yw / 2, y + yc - 18, '#f6fbf0', 6);
        COLL.rects.push({ kind: 's', i, x: at.x + x, y: at.y + y, w: yw, h: yc });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 'r') { const d = ROTORS[sel.i]; info = rotorOwned(rec, sel.i) ? `${d.name}: ${d.how}` : `${d.name}: score ${d.need} points in one flight to unlock.`; }
    else { const d = SCENES[sel.i]; info = sceneOwned(rec, sel.i) ? (rec.sceneSel === sel.i ? `${d.name} is your landscape. ${d.blurb}` : `${d.name}. ${d.blurb} Tap again to fly here.`) : `${d.name}: score ${d.need} points in one flight to unlock.`; }
  }
  const dia = rec.diary.slice(-6).reverse();
  const rowH = 46;
  const diary = {
    t: 'art', h: Math.max(rowH, dia.length * rowH + 6),
    draw(ctx, ww) {
      if (!dia.length) { ctx.fillStyle = '#d6f0cf'; ctx.font = `400 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Your flights will be written here.', ww / 2, rowH / 2); return; }
      dia.forEach((e, i) => {
        const y = i * rowH;
        roundPath(ctx, 0, y, ww, rowH - 6, 14); ctx.fillStyle = 'rgba(10,40,24,0.62)'; ctx.fill();
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffd870'; ctx.font = `800 20px ${FONT}`; ctx.fillText(`#${e.n}`, 14, y + (rowH - 6) / 2);
        ctx.fillStyle = '#f6fbf0'; ctx.font = `600 ${Math.max(14, Math.min(20, Math.round(ww * 0.03)))}px ${FONT}`;
        const t = `${SCENES[e.s].name} · ${ROTORS[e.r].name} · ${e.h} m · ${LAND_WORD[e.l]}`;
        let px = 20; ctx.font = `600 ${px}px ${FONT}`; while (ctx.measureText(t).width > ww - 130 && px > 12) { px--; ctx.font = `600 ${px}px ${FONT}`; }
        ctx.fillText(t, 62, y + (rowH - 6) / 2);
        ctx.textAlign = 'right'; ctx.font = `800 22px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(e.sc), ww - 14, y + (rowH - 6) / 2);
      });
    },
  };
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Collection', size: 48 },
    { t: 'p', label: 'Rotors', bold: true, color: '#d6f0cf', size: 26 },
    rotors,
    { t: 'p', label: 'Landscapes', bold: true, color: '#d6f0cf', size: 26 },
    scenes,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'p', label: `Sky Diary · ${rec.flights} flights · best height ${Math.round(rec.bestHeight)} m · ${rec.lanterns} lanterns`, bold: true, color: '#d6f0cf', size: 24 },
    diary,
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const label = r.mode === 'free' ? 'Calm skies' : r.newBest ? 'New best session!' : rankFor(r.total);
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 50 }, { t: 'h', label, size: wide ? 46 : 54, cap: big ? 1.2 : 1.5 }];
  if (r.mode !== 'free') {
    wd.push({ t: 'h', label: `${r.total}`, size: wide ? 80 : 104, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `points in ${r.flights.length} flights · best flight ${r.bestFlight} · highest ${r.highest} m · ${r.lanterns} lanterns`, size: 26, cap: big ? 2 : 3 });
    if (!big) wd.push({ t: 'art', h: wide ? 120 : 190, draw: (ctx, w, h) => drawFlightBars(ctx, w, h, r) });
  } else {
    wd.push({ t: 'p', label: `${r.flights.length} flights · highest ${r.highest} m · ${r.lanterns} lanterns`, size: 26, cap: big ? 2 : 3 });
  }
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice session and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'collection', label: 'Open the Collection', active: true });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Fly again', primary: true, h: 92 });
  if (r.mode !== 'watch' && r.mode !== 'free') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
function drawFlightBars(ctx, w, h, r) {
  const n = r.flights.length, mx = Math.max(60, ...r.flights.map((t) => t.score));
  const bw = Math.min(70, (w - 20) / n - 10), x0 = (w - n * (bw + 10) + 10) / 2;
  r.flights.forEach((t, i) => {
    const x = x0 + i * (bw + 10), bh = Math.max(6, ((h - 46) * t.score) / mx), y = h - 26 - bh;
    roundPath(ctx, x, y, bw, bh, 10);
    const g = ctx.createLinearGradient(0, y, 0, y + bh), top = t.score === r.bestFlight;
    g.addColorStop(0, top ? '#ffd36a' : '#7fd088'); g.addColorStop(1, top ? '#e09a2a' : '#2c8a4c'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `800 ${Math.round(Math.min(26, bw * 0.4))}px ${FONT}`; ctx.fillText(String(t.score), x + bw / 2, y - 6);
    ctx.font = `600 ${Math.round(Math.min(15, bw * 0.24))}px ${FONT}`; ctx.fillStyle = '#d6f0cf'; ctx.fillText(ROTORS[t.rotor].name.split(' ')[1] || ROTORS[t.rotor].name, x + bw / 2, h - 6);
  });
}
export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', row: 8, dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have flown the free sessions of the web demo. The full game on iPhone and Android has every rotor and landscape, the daily sky and unlimited play.', size: 28 },
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
  g.addColorStop(0, `rgba(8,26,16,${a * 0.7})`); g.addColorStop(0.5, `rgba(8,26,16,${a})`); g.addColorStop(1, `rgba(8,26,16,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,26,16,0)'); g.addColorStop(1, 'rgba(8,26,16,0.7)');
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

// The living background of the menus: a rotor flying over the landscape on its own.
function attract(ctx, state, rect, dim = 0.2, hero = null) {
  const ws = state.att;
  drawWorldState(ctx, rect, ws, hero ? { cradle: hero } : {});
  // 3D: the demo opens with two hands rubbing the shaft at `hero`, then the rotor leaves them and flies
  if (v3.on && hero && !ws.f && ws.plan) v3.toy = { x: hero.x, y: hero.y, size: hero.size, rotor: ws.plan.rotor, rev: ws.rubRev, s: ws.charge, tilt: 0, roll: 0, blend: 1, hands: 1, rub: ws.rubDir, press: 1, charge: ws.charge, hot: 0, landed: false };
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(8,30,18,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    const hs = Math.min(W * 0.36, 300);
    attract(ctx, state, { x: 0, y: 0, w: W, h: Math.max(420, fr.cols[0].top) }, 0.06, { x: W / 2, y: Math.max(top + 330, Math.max(420, fr.cols[0].top) - 1.24 * hs - 6), size: hs });
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(6,30,16,0.6)'); g.addColorStop(1, 'rgba(6,30,16,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(8,30,18,0)'); g2.addColorStop(1, 'rgba(8,30,18,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(230,248,225,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  const hs = Math.min(hw * 0.36, 260);
  attract(ctx, state, { x: fr.hero.x0, y: 0, w: hw, h: H }, 0.1, { x: hx, y: Math.max(Math.max(host.t, 0) + 6 + 300 * Math.min(1, hw / 640) + 30, H - host.b - 1.24 * hs - 6), size: hs });
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(6,30,16,0.6)'); g.addColorStop(1, 'rgba(6,30,16,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(230,248,225,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.68); drawFlowScreen(ctx, state, 'settings'); }
export function renderCollection(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'collection'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.62 : 0.56); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(16,48,30,0.95)', stroke: 'rgba(255,224,160,0.5)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,247,232,0.97)', stroke: 'rgba(30,70,40,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(30,70,40,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(30,70,40,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(30,70,40,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(30,70,40,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own rotors) --------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#f6fbf0', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(10,40,24,0.86)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#f0b44c', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, pi = 0) {
  const p = PALS[pi];
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, p.sky[0]); g.addColorStop(0.6, p.sky[1]); g.addColorStop(0.85, p.sky[2]); g.addColorStop(0.851, p.ground[0]); g.addColorStop(1, p.ground[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(30,60,40,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h, key === 'wind' ? 1 : key === 'target' ? 2 : 0);
  const gy = h * 0.85;
  const A = {
    copter() {
      drawCopter(ctx, w * 0.5, h * 0.36, Math.min(w * 0.36, 190), 0, 0.5, 0, 0, { view: 0.05 });
      tag(ctx, 'a rotor on a stick', w * 0.5, h * 0.93, '#f6fbf0', 19);
    },
    overview() {
      ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(w * 0.15, gy - 8); ctx.bezierCurveTo(w * 0.2, h * 0.05, w * 0.55, h * 0.0, w * 0.62, h * 0.32); ctx.bezierCurveTo(w * 0.66, h * 0.5, w * 0.7, h * 0.6, w * 0.78, gy - 8); ctx.stroke(); ctx.setLineDash([]);
      drawCopter(ctx, w * 0.45, h * 0.12, 70, 0, 1.1, 1, 0.1, {});
      ctx.fillStyle = '#e04b3a'; ctx.beginPath(); ctx.ellipse(w * 0.78, gy, 46, 10, 0, 0, TAU); ctx.fill();
      tag(ctx, 'up, across, down to the ring', w * 0.5, h * 0.62, '#f6fbf0', 18);
    },
    tray() {
      [0, 3, 2].forEach((ri, i) => {
        const px = w * (0.06 + i * 0.32), pw = w * 0.28;
        roundPath(ctx, px, h * 0.1, pw, h * 0.78, 14); ctx.fillStyle = i === 1 ? 'rgba(232,248,226,0.97)' : 'rgba(246,244,232,0.92)'; ctx.fill();
        ctx.lineWidth = i === 1 ? 4 : 2; ctx.strokeStyle = i === 1 ? '#2c8a4c' : 'rgba(50,60,40,0.5)'; ctx.stroke();
        drawCopter(ctx, px + pw / 2, h * 0.34, pw * 0.7, ri, 0.6 + ri, 0, 0, { view: 0.04 });
        label(ctx, ROTORS[ri].name, px + pw / 2, h * 0.76, Math.max(13, Math.round(h * 0.085)), C.ink);
      });
    },
    lean() {
      const cx = w * 0.42, cy = h * 0.5;
      drawCopter(ctx, cx, cy, 120, 0, 0.7, 0, 0.5, {});
      ctx.setLineDash([7, 7]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx, cy + 130); ctx.stroke(); ctx.setLineDash([]);
      arrow(ctx, cx + 60, cy - 10, cx + 150, cy - 28, '#ffd36a', 5);
      tag(ctx, 'the lean sets the sideways push', w * 0.62, h * 0.9, '#ffd36a', 18);
    },
    rub() {
      const c = { x: w * 0.5, y: h * 0.4 };
      drawCopter(ctx, c.x, c.y, 130, 0, 0.9, 0.5, 0, {});
      ctx.fillStyle = '#e0aa86'; roundPath(ctx, c.x - 54, c.y + 56, 34, 100, 14); ctx.fill(); roundPath(ctx, c.x + 20, c.y + 56, 34, 100, 14); ctx.fill();
      arrow(ctx, c.x - 80, c.y + 90, c.x - 120, c.y + 70, '#ffd36a', 4); arrow(ctx, c.x + 80, c.y + 70, c.x + 120, c.y + 90, '#ffd36a', 4);
      tag(ctx, 'rub the shaft side to side', w * 0.5, h * 0.13, '#f6fbf0', 19);
    },
    meter() {
      const mx = w * 0.3, mw = 44, my = h * 0.08, mh = h * 0.84;
      roundPath(ctx, mx, my, mw, mh, 22); ctx.fillStyle = 'rgba(8,36,20,0.7)'; ctx.fill();
      ctx.fillStyle = 'rgba(230,70,50,0.5)'; ctx.fillRect(mx + 4, my + 6, mw - 8, mh * 0.12);
      ctx.fillStyle = 'rgba(255,205,70,0.75)'; ctx.fillRect(mx + 4, my + mh * 0.2, mw - 8, mh * 0.16);
      ctx.fillStyle = '#39c1a8'; roundPath(ctx, mx + 4, my + mh * 0.55, mw - 8, mh * 0.43, 18); ctx.fill();
      tag(ctx, 'too hot: the grip slips', w * 0.66, my + mh * 0.1, '#ff9a8a', 18);
      tag(ctx, 'gold band: perfect release', w * 0.66, my + mh * 0.28, '#ffd36a', 18);
      tag(ctx, 'below: less spin', w * 0.66, my + mh * 0.7, '#9fe8c0', 18);
    },
    fly() {
      const pts = [[0.1, 0.8], [0.22, 0.4], [0.34, 0.14], [0.5, 0.2], [0.62, 0.42], [0.76, 0.6], [0.88, 0.82]];
      ctx.setLineDash([6, 8]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath();
      pts.forEach((p, i) => { if (i) ctx.lineTo(p[0] * w, p[1] * h); else ctx.moveTo(p[0] * w, p[1] * h); }); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, 'climb while it spins fast', w * 0.3, h * 0.08, '#ffd36a', 17);
      tag(ctx, 'then it settles slowly', w * 0.72, h * 0.5, '#f6fbf0', 17);
      drawCopter(ctx, w * 0.5, h * 0.2, 60, 0, 2, 0.6, 0, {});
    },
    steer() {
      drawCopter(ctx, w * 0.5, h * 0.4, 120, 3, 1.4, 0.7, 0.4, {});
      arrow(ctx, w * 0.2, h * 0.4, w * 0.36, h * 0.4, '#ffd36a', 5); arrow(ctx, w * 0.8, h * 0.4, w * 0.64, h * 0.4, '#ffd36a', 5);
      tag(ctx, 'hold a side: it leans that way, and spends spin', w * 0.5, h * 0.9, '#f6fbf0', 17);
    },
    wind() {
      for (let i = 0; i < 4; i++) { const yy = h * (0.2 + i * 0.16), L = w * (0.22 + 0.08 * i); arrow(ctx, w * 0.1, yy, w * 0.1 + L, yy, 'rgba(255,255,255,0.9)', 3 + i); }
      tag(ctx, 'stronger higher up', w * 0.64, h * 0.26, '#f6fbf0', 18);
      tag(ctx, 'gentler near the ground', w * 0.64, h * 0.7, '#cfe8ff', 18);
    },
    thermal() {
      for (let k = -1; k <= 1; k++) { ctx.strokeStyle = 'rgba(255,255,230,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); for (let j = 0; j <= 12; j++) { const yy = gy - j * (h * 0.06), xx = w * 0.5 + k * 40 + Math.sin(j * 0.9 + k) * 10; if (j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); }
      drawCopter(ctx, w * 0.5, h * 0.4, 70, 1, 0.8, 0.2, 0, {});
      tag(ctx, 'a warm column lifts it', w * 0.5, h * 0.93, '#ffe9a8', 18);
    },
    target() {
      [[1, '#fff6e0'], [0.5, '#e04b3a'], [0.2, '#ffd23c']].forEach(([k, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(w * 0.5, gy - 6, w * 0.3 * k, h * 0.07 * k + 3, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,20,10,0.5)'; ctx.stroke(); });
      tag(ctx, `${LAND_PTS[3]}`, w * 0.5, gy - 40, '#ffd23c', 20); tag(ctx, `${LAND_PTS[2]}`, w * 0.5 + w * 0.2, gy - 40, '#e8503c', 18); tag(ctx, `${LAND_PTS[1]}`, w * 0.5 + w * 0.34, gy - 40, '#fff6e0', 18);
      drawCopter(ctx, w * 0.5, h * 0.3, 70, 0, 1.0, 0.1, 0, {});
    },
    rotors() {
      ROTORS.forEach((ro, i) => { const c = i % 3, r = Math.floor(i / 3); drawCopter(ctx, w * (0.2 + c * 0.3), h * (0.26 + r * 0.46), Math.min(h * 0.3, w * 0.2), i, 0.5 + i, 0, 0, { view: 0.05 }); });
    },
    scenes() {
      SCENES.forEach((sd, i) => {
        const px = w * (0.04 + i * 0.24), pw = w * 0.22, pal = PALS[i];
        const g = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.8); g.addColorStop(0, pal.sky[0]); g.addColorStop(0.7, pal.sky[1]); g.addColorStop(0.7, pal.ground[1]); g.addColorStop(1, pal.ground[2]);
        roundPath(ctx, px, h * 0.1, pw, h * 0.7, 10); ctx.fillStyle = g; ctx.fill();
        label(ctx, sd.name.split(' ')[1], px + pw / 2, h * 0.93, Math.max(12, Math.round(h * 0.075)), '#f6fbf0');
      });
    },
  };
  (A[key] ?? A.copter)();
  ctx.restore();
  void state;
}
