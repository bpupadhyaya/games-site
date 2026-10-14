// Every screen that is not the play screen: title, settings, collection, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp, tankRect } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, lacquer } from './ui.js';
import { THEMES, drawFishShape, drawFishIcon, drawPoi, drawStall } from './art.js';
import { drawWorld } from './view.js';
import { FISH, TANKS, GRADES, SHEETS, TW, TH, rankFor, fishOwned, tankOwned, TUNE, POI_R } from './sim.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { v3 } from './v3.js';

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
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);
export const bestOf = (rec) => Math.max(rec.bestSession | 0, rec.bestDaily | 0);

// ---- widgets ---------------------------------------------------------------------------------------------------------
let HERO_CV = null, HERO_T = 0;
const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2, S = 2;
    if (!v3.makeCanvas) {   // headless / no DOM: plain lettering
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `italic 800 110px ${DISPLAY}`;
      ctx.fillStyle = '#ffb04a'; ctx.fillText('Kingyo', cx, 128); ctx.fillText('Sukui', cx, 220);
      return;
    }
    // the lettering is drawn once per width into its own canvas (extruded, outlined, lit), then shined every frame
    if (!HERO_CV || HERO_CV.w !== w) {
      const c = v3.makeCanvas(w * S, 320 * S);
      const g = c.getContext('2d'); g.scale(S, S);
      g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
      const fit = (t, s0) => { let s = s0; g.font = `italic 800 ${s}px ${DISPLAY}`; while (g.measureText(t).width > w - 40 && s > 50) { s -= 4; g.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
      const s1 = fit('Kingyo', 128), y1 = 128, y2 = 128 + s1 * 0.84;
      for (const [t, y] of [['Kingyo', y1], ['Sukui', y2]]) {
        g.font = `italic 800 ${s1}px ${DISPLAY}`;
        for (let d = 16; d >= 1; d--) { g.fillStyle = d > 8 ? '#2a0603' : '#5c1209'; g.fillText(t, cx + d * 0.55, y + d); }
        g.lineWidth = 22; g.strokeStyle = '#2a0603'; g.strokeText(t, cx, y);
        g.lineWidth = 14; g.strokeStyle = '#a3200f'; g.strokeText(t, cx, y);
        g.lineWidth = 6; g.strokeStyle = '#ffd98a'; g.strokeText(t, cx, y);
        const gr = g.createLinearGradient(0, y - s1 * 0.8, 0, y + 6); gr.addColorStop(0, '#fffbe6'); gr.addColorStop(0.35, '#ffd25a'); gr.addColorStop(0.62, '#ff9a2a'); gr.addColorStop(1, '#e04a1c');
        g.fillStyle = gr; g.fillText(t, cx, y);
      }
      HERO_CV = { w, c, s1, y1, y2 };
    }
    const H0 = HERO_CV, tt = HERO_T % 5;
    // shine sweep: a white diagonal band that crosses the letters every few seconds (source-atop on a copy)
    ctx.drawImage(H0.c, 0, 0, w, 320);
    const sw = (tt / 1.2) - 0.2;
    if (sw > 0 && sw < 1.2) {
      const sc = v3.makeCanvas(w, 320); const g = sc.getContext('2d');
      g.drawImage(H0.c, 0, 0, w, 320); g.globalCompositeOperation = 'source-atop';
      const bx = -120 + sw * (w + 240), gr = g.createLinearGradient(bx - 60, 0, bx + 60, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.save(); g.translate(bx, 160); g.transform(1, 0, -0.3, 1, 0, 0); g.translate(-bx, -160); g.fillStyle = gr; g.fillRect(bx - 80, 0, 160, 320); g.restore();
      ctx.drawImage(sc, 0, 0);
    }
    // the subtitle on a small lacquered ribbon
    const label = 'Goldfish scooping', y3 = H0.y2 + 54;
    ctx.font = `700 26px ${FONT}`; const tw = ctx.measureText(label).width + 56;
    lacquer(ctx, { x: cx - tw / 2, y: y3 - 30, w: tw, h: 44 }, 'primary', { r: 22, edge: 2.5 });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff6e2';
    ctx.shadowColor = 'rgba(40,6,2,0.6)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5; ctx.fillText(label, cx, y3 - 7); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state), tk = TANKS[rec.tankSel].name, gr = GRADES[rec.grade];
  wd.push({ t: 'btn', id: 'session', label: 'Stall Session', sub: rec.bestByTank[rec.tankSel] ? `${tk} · best ${rec.bestByTank[rec.tankSel]}` : `${tk} · three sheets of paper`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'tank', label: tk, sub: 'Tap to change tank', row: 9 });
  wd.push({ t: 'btn', id: 'grade', label: gr.name, sub: `x${gr.mult} points`, row: 9 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Tank', sub: dk >= 0 ? `Today ${dk}` : 'Same water for all', row: 1 });
  wd.push({ t: 'btn', id: 'free', label: 'Free Scoop', sub: 'No score, endless paper', row: 1 });
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
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe3b8', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: '#ffe3b8', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked. Thank you!', size: 26, bold: true, color: '#ffe3b8' }]
      : [{ t: 'btn', id: 'restore', label: state.restoreBusy ? 'Checking…' : 'Restore purchase', dark: true, disabled: !!state.restoreBusy }]),
    ...(state.restoreMsg && !state.owned ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe3b8' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function collectionWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 3, gap = 16, cell = Math.min(190, Math.floor((w - gap * (cols - 1)) / cols)), shH = 3 * (cell + gap) - gap;
  const fish = {
    t: 'art', h: shH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'f');
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      FISH.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (cell + gap), has = fishOwned(rec, i);
        roundPath(ctx, x, y, cell, cell, 20); ctx.fillStyle = sel && sel.kind === 'f' && sel.i === i ? 'rgba(255,214,120,0.35)' : 'rgba(22,16,60,0.62)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,190,0.3)'; ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 4, cell - 8, cell - 8); ctx.clip();
        drawFishIcon(ctx, i, x + cell / 2, y + cell * 0.42, cell * 0.62, 0, !has);
        ctx.restore();
        if (!has) { ctx.fillStyle = '#fff6e6'; ctx.font = `700 ${Math.round(cell * 0.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + cell * 0.4); }
        ctx.fillStyle = '#fff6e6'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.108))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(has ? d.name : '???', x + cell / 2, y + cell - 30);
        ctx.font = `600 ${Math.max(11, Math.round(cell * 0.085))}px ${FONT}`; ctx.fillStyle = 'rgba(255,230,190,0.8)';
        ctx.fillText(has ? `${rec.caughtBy[i] | 0} caught` : `${d.need} scoops`, x + cell / 2, y + cell - 12);
        COLL.rects.push({ kind: 'f', i, x: at.x + x, y: at.y + y, w: cell, h: cell });
      });
    },
  };
  const yc = Math.round(cell * 0.62), yw = Math.floor((w - gap) / 2), yh = 2 * (yc + gap) - gap;
  const tanks = {
    t: 'art', h: yh,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 't');
      TANKS.forEach((tk, i) => {
        const r = Math.floor(i / 2), c = i % 2, x = c * (yw + gap), y = r * (yc + gap), has = tankOwned(rec, i), th = THEMES[i];
        ctx.save(); roundPath(ctx, x, y, yw, yc, 18); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + yc); g.addColorStop(0, th.water[0]); g.addColorStop(1, th.water[1]); ctx.fillStyle = g; ctx.fillRect(x, y, yw, yc);
        ctx.save(); ctx.translate(x + yw * 0.5, y + yc * 0.42);
        [[-0.22, -0.1, 3, 0.3], [0.2, 0.08, 0, -0.5], [0.0, 0.18, 1, 2.2]].forEach(([fx, fy, k, a], j) => { ctx.save(); ctx.translate(fx * yw, fy * yc); ctx.rotate(a); drawFishShape(ctx, k, yw * 0.17, j * 2, 0.2); ctx.restore(); });
        ctx.restore();
        if (!has) { ctx.fillStyle = 'rgba(8,6,30,0.6)'; ctx.fillRect(x, y, yw, yc); }
        ctx.restore();
        const cur = rec.tankSel === i;
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#ffd36a' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, yw, yc, 18); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(yw * 0.075))}px ${FONT}`;
        textShadow(ctx, has ? tk.name : `🔒 ${tk.name}`, x + yw / 2, y + yc - 18, '#fff6e6', 6);
        COLL.rects.push({ kind: 't', i, x: at.x + x, y: at.y + y, w: yw, h: yc });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 'f') { const d = FISH[sel.i]; info = fishOwned(rec, sel.i) ? `${d.name}: ${d.note} Worth ${d.pts}, weight ${d.w}.` : `${d.name}: scoop ${d.need} fish in total to meet it.`; }
    else { const d = TANKS[sel.i]; info = tankOwned(rec, sel.i) ? (rec.tankSel === sel.i ? `${d.name} is your tank. ${d.blurb}` : `${d.name}. ${d.blurb} Tap again to use it.`) : `${d.name}: reach ${d.need} points in a Stall Session to open it.`; }
  }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Collection', size: 48 },
    { t: 'p', label: 'Goldfish', bold: true, color: '#ffe3b8', size: 26 },
    fish,
    { t: 'p', label: 'Tanks', bold: true, color: '#ffe3b8', size: 26 },
    tanks,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const label = r.mode === 'free' ? 'Calm water' : r.newBest ? 'New best!' : r.cleared ? 'Tank cleared!' : rankFor(r.total);
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 50 }, { t: 'h', label, size: wide ? 46 : 54, cap: big ? 1.2 : 1.5 }];
  if (r.mode !== 'free') {
    wd.push({ t: 'h', label: `${r.total}`, size: wide ? 80 : 104, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `${r.fish.length} fish in ${r.sheets} sheet${r.sheets === 1 ? '' : 's'} · best scoop ${r.bestScoop} · ${r.torn} torn`, size: 26, cap: big ? 2 : 3 });
  } else {
    wd.push({ t: 'p', label: `${r.fish.length} fish scooped, every one put back`, size: 26, cap: big ? 2 : 3 });
  }
  if (!big && r.fish.length) wd.push({ t: 'art', h: wide ? 120 : 170, draw: (ctx, w, h) => drawReleased(ctx, w, h, r, state.t) });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice run and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'collection', label: 'Open the Collection', active: true });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Play again', primary: true, h: 92 });
  if (r.mode !== 'watch' && r.mode !== 'free') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
// The catch swimming back into the water: the catch-and-release note of the tradition.
function drawReleased(ctx, w, h, r, t) {
  roundPath(ctx, 0, 0, w, h, 18); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7fd8e8'); g.addColorStop(1, '#2a8fb6'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 8;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let x = 0; x <= w; x += 30) { const y = h * (0.25 + i * 0.25) + Math.sin(x * 0.03 + t + i) * 6; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  const n = Math.min(12, r.fish.length);
  for (let i = 0; i < n; i++) {
    const k = r.fish[i], fx = ((i + 0.5) / n) * w + Math.sin(t * 0.8 + i) * 8, fy = h * (0.3 + ((i * 37) % 50) / 100) + Math.cos(t * 0.7 + i * 2) * 6;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(t * 0.5 + i) * 0.35); drawFishShape(ctx, k, Math.min(70, w / n * 1.4), t * 4 + i, 0.2); ctx.restore();
  }
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; roundPath(ctx, 0, 0, w, h, 18); ctx.stroke();
  ctx.fillStyle = '#fff6e6'; ctx.font = `700 ${Math.round(Math.max(13, h * 0.12))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  textShadow(ctx, 'All released back into the tank', w / 2, h - 10, '#fff6e6', 5);
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
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free runs of the web demo. The full game on iPhone and Android has every tank, every goldfish, the daily tank and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- frames --------------------------------------------------------------------------------------------------------------
// Short portrait screens (tablets, 4:3): the title buttons shrink a little so the whole menu fits without scrolling.
const flowScale = (state, key) => TEXT_SCALES[state.settings.textIdx] * (key === 'title' && !land() && H < 1150 && state.settings.textIdx === 0 ? Math.max(0.78, (H - 380) / 800) : 1);
export function frameFor(state, key) {
  const sc = flowScale(state, key), L = land();
  if (key === 'title') {
    if (!L) {
      const bottom = H - host.b - lockSize(600).strip, btnH = flowLayout(estCtx, titleWidgets(state), sc, { x: 40, w: 640 }).contentH;
      const short = H < 1150, colTop = Math.max(bottom - btnH, host.t + (short ? 275 : 380)), heroTop = host.t + (short ? 8 : 14 + Math.max(0, Math.min(60, (colTop - 700) / 4)));
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop, k: short ? 0.7 : 1 } };
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
  const sc = flowScale(state, key);
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
  g.addColorStop(0, `rgba(16,10,44,${a * 0.7})`); g.addColorStop(0.5, `rgba(16,10,44,${a})`); g.addColorStop(1, `rgba(16,10,44,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w - 60;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(16,10,44,0)'); g.addColorStop(1, 'rgba(16,10,44,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1a24'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1a24'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

// The living background of the menus: the stall and a tank where goldfish drift on their own.
function attract(ctx, state, rect, dim = 0.2) {
  if (v3.on) { scrim(ctx, Math.max(0, dim - 0.06)); return; }   // the 3D stall is already behind the canvas
  const th = state.att.tank;
  drawStall(ctx, 0, 0, W, H, THEMES[th], state.t);
  if (rect.w >= W && rect.h >= H) {
    // full-screen backdrop: the water simply fills the screen, no rim
    const s = Math.max(W / TW, H / TH), tr = { x: (W - TW * s) / 2, y: (H - TH * s) / 2, w: TW * s, h: TH * s, s, rot: false };
    drawWorld(ctx, tr, state.att, th, state.t, null, { noPoi: true, bare: true });
  } else drawWorld(ctx, tankRect(rect, 40), state.att, th, state.t, null, { noPoi: true });
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(18,10,40,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  HERO_T = state.t;
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    v3.hero = { x: 20, y: top + 150, w: W - 40, h: Math.max(240, fr.cols[0].top - (top + 150) - 6) };
    attract(ctx, state, { x: 0, y: 0, w: W, h: Math.max(420, fr.cols[0].top) }, 0.1);
    if (!v3.on) { const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(24,8,30,0.62)'); g.addColorStop(1, 'rgba(24,8,30,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560); }
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(18,10,40,0)'); g2.addColorStop(1, v3.on ? 'rgba(14,10,36,0.72)' : 'rgba(18,10,40,0.88)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    { const hk = fr.hero.k || 1; ctx.save(); ctx.translate(W / 2 - 320 * hk, top); ctx.scale(hk, hk); heroArt().draw(ctx, 640); ctx.restore(); }
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  v3.hero = { x: fr.hero.x0 + 16, y: 150, w: hw - 32, h: Math.max(240, H - 170 - host.b) };
  attract(ctx, state, { x: fr.hero.x0, y: 0, w: hw, h: H }, 0.14);
  if (!v3.on) { const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(24,8,30,0.62)'); g.addColorStop(1, 'rgba(24,8,30,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560); }
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { v3.hero = null; attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'settings'); }
export function renderCollection(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'collection'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.64 : 0.58); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(30,22,64,0.95)', stroke: 'rgba(255,224,160,0.5)' });
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
  backdrop(ctx, state, 0.74);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(252,244,226,0.97)', stroke: 'rgba(60,30,50,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,30,50,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(60,30,50,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(60,30,50,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(60,30,50,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own fish and poi) --------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e6', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(24,14,50,0.84)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, th = 0) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, THEMES[th].water[0]); g.addColorStop(1, THEMES[th].water[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(30,50,80,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function poiAt(ctx, x, y, s, o = {}) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawPoi(ctx, 0, 0, o); ctx.restore(); }
function fishAt(ctx, k, x, y, len, ang = 0, ph = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); drawFishShape(ctx, k, len, ph, 0.1); ctx.restore(); }
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h, key === 'night' ? 3 : key === 'grade' ? 1 : 0);
  const A = {
    poi() {
      poiAt(ctx, w * 0.36, h * 0.5, Math.min(h, w * 0.45) / 190, { paper: 1, wet: 0 });
      tag(ctx, 'paper', w * 0.36, h * 0.2, '#fff6e6', 18);
      tag(ctx, 'red ring', w * 0.12, h * 0.52, '#ffb09a', 17);
      tag(ctx, 'handle', w * 0.8, h * 0.6, '#ffe3b8', 17);
    },
    tank() {
      [[0, 0.2, 0.3, 0.4], [1, 0.45, 0.62, 2.4], [3, 0.7, 0.3, 3.6], [5, 0.82, 0.62, 0.5], [7, 0.3, 0.7, 5], [2, 0.58, 0.28, 1]].forEach(([k, fx, fy, a], i) => fishAt(ctx, k, w * fx, h * fy, 56, a, i * 2));
      tag(ctx, 'a tank of goldfish', w * 0.5, h * 0.9, '#fff6e6', 19);
    },
    dip() {
      fishAt(ctx, 3, w * 0.62, h * 0.42, 70, 0.2, 1);
      poiAt(ctx, w * 0.26, h * 0.62, 0.55, { paper: 1, wet: 0.5 });
      arrow(ctx, w * 0.32, h * 0.6, w * 0.52, h * 0.46, '#ffd36a', 5);
      tag(ctx, 'drag in slowly', w * 0.3, h * 0.2, '#ffd36a', 19);
      tag(ctx, 'quick moves scare fish', w * 0.7, h * 0.82, '#fff6e6', 17);
    },
    lift() {
      poiAt(ctx, w * 0.4, h * 0.52, 0.8, { paper: 0.9, wet: 0.7 });
      fishAt(ctx, 4, w * 0.4, h * 0.52, 66, 0.5, 2);
      arrow(ctx, w * 0.62, h * 0.7, w * 0.62, h * 0.25, '#ffd36a', 6);
      tag(ctx, 'let go with the fish inside the ring', w * 0.5, h * 0.9, '#fff6e6', 17);
      tag(ctx, 'lift', w * 0.76, h * 0.45, '#ffd36a', 20);
    },
    paper() {
      const bw = w * 0.74, bx = w * 0.13, by = h * 0.42, bh = 28;
      roundPath(ctx, bx, by, bw, bh, 14); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#ff6a4a'); g.addColorStop(0.35, '#ffd36a'); g.addColorStop(1, '#6fe0a0');
      roundPath(ctx, bx, by, bw * 0.74, bh, 14); ctx.fillStyle = g; ctx.fill();
      roundPath(ctx, bx, by + bh * 0.62, bw * 0.4, bh * 0.3, 5); ctx.fillStyle = 'rgba(150,220,255,0.8)'; ctx.fill();
      tag(ctx, 'paper wear', w * 0.5, h * 0.2, '#fff6e6', 19);
      tag(ctx, 'time in the water and speed use it up', w * 0.5, h * 0.72, '#ffe3b8', 16);
      tag(ctx, 'wet paper is weaker', w * 0.3, h * 0.9, '#bfe9ff', 16);
    },
    fish() {
      FISH.forEach((f, i) => {
        const c = i % 4, r = Math.floor(i / 4), px = w * (0.14 + c * 0.24), py = h * (0.27 + r * 0.45);
        fishAt(ctx, i, px, py, Math.min(60, w * 0.12), 0, i);
        label(ctx, f.name, px, py + h * 0.17, Math.max(12, Math.round(h * 0.075)), '#fff6e6');
      });
    },
    grade() {
      GRADES.forEach((g, i) => {
        const px = w * (0.18 + i * 0.32);
        poiAt(ctx, px, h * 0.42, 0.5 + i * 0.0, { paper: 1 - i * 0.18, wet: 0.2 });
        label(ctx, g.name.split(' ')[0], px, h * 0.76, 18, '#fff6e6');
        label(ctx, `x${g.mult}`, px, h * 0.92, 18, '#ffd36a');
      });
    },
    night() {
      fishAt(ctx, 7, w * 0.4, h * 0.45, 80, 0.3, 2); fishAt(ctx, 6, w * 0.7, h * 0.6, 70, 3, 5);
      tag(ctx, 'valuable fish are heavy or fast', w * 0.5, h * 0.88, '#fff6e6', 17);
    },
  };
  (A[key] ?? A.tank)();
  ctx.restore();
}
void TUNE; void POI_R; void SHEETS; void TAU;
