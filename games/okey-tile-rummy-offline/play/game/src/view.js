// Drawing. Reads the game state (never mutates it, except the cached page counts for the reader) and paints a frame.
import {
  W, H, ZOOM, host, LAY, RACK, slotRect, slotAt, TILE_S, STACK_C, INDICATOR_C, PILE_C, pileRect, stackRect, PLATE, BACKS, HUD_MENU, HUD_OKEY,
  BTN, DISCARD_BTN, STATUS, MELDS_BAR, PAUSE, RESULT, DEMO, THINK_STEPS, titleRows, SET_ROWS, SET_BACK, TEXT_DEC, TEXT_INC,
  REF_BACK, REF_NEXT, TEXT_SCALES, REF_PANEL, LIMIT_BTN, setBtnRect, stepRect, inRect,
} from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import {
  drawTile, drawBack, drawTable, drawTitleBg, button, pill, roundPath, fitFont, fitWrap, wrapLines, drawAvatar, tulip, NUM_FONT, DISPLAY, INK, drawPip, setTextFloor,
} from './art.js';
import * as ART from './art.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { isWild, tileName, keyName, faceKey, keyOf, isFake, solveHand, rackChunks, finishingDiscards, nextSeat, prevSeat } from './rules.js';
import { SEAT_NAMES, SEAT_NAMES_TR, SEAT_TITLES, LEVEL_NAMES } from './ai.js';
import { L, tileLabel } from './text.js';

const TAU = Math.PI * 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function txt(ctx, s, x, y, size, color = '#f7efd8', align = 'center', weight = 700, family = NUM_FONT, maxW = 0) {
  size = Math.max(size, ART.FLOOR);
  ctx.font = `${weight} ${size}px ${family}`;
  if (maxW) { const fs = fitFont(ctx, s, weight, size, maxW, family, 10); ctx.font = `${weight} ${fs}px ${family}`; }
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// ---------------------------------------------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------------------------------------------
const FLOATERS = Array.from({ length: 14 }, (_, i) => ({
  id: [3, 17, 30, 44, 9, 22, 35, 48, 12, 26, 39, 5, 20, 33][i] + (i % 2) * 52,
  x: (((i * 163) % 700) + 10) / 720, y0: ((i * 331) % 1280) / 1280, sp: 14 + ((i * 7) % 11) * 2.5, rot: ((i * 53) % 100) / 100 * 1.2 - 0.6, sz: 0.5 + ((i * 17) % 9) / 14,
}));

function renderTitle(ctx, S) {
  drawTitleBg(ctx);
  const T = LAY.title, k = T.k;
  // drifting tiles in the background
  const cyc = H + 220;
  for (const f of FLOATERS) {
    const y = ((f.y0 * cyc - S.t * f.sp) % cyc + cyc) % cyc - 110;
    const w = 54 * f.sz, h = 76 * f.sz;
    ctx.save(); ctx.globalAlpha = 0.5;
    drawTile(ctx, f.id % 104, null, f.x * W, y, w, h, { rot: f.rot + Math.sin(S.t * 0.4 + f.id) * 0.12 });
    ctx.restore();
  }
  // the title: OKEY spelled in four tiles
  const letters = ['O', 'K', 'E', 'Y'], tw = 124, th = 172, gap = 14, kk = T.tw / 124, total = (tw * 4 + gap * 3) * kk, x0 = T.cx - total / 2;
  letters.forEach((ch, i) => {
    const bob = Math.sin(S.t * 1.6 + i * 0.9) * 5 * kk;
    const x = x0 + i * (tw + gap) * kk, y = T.letterY + bob - Math.max(0, 1 - clamp01((S.t - i * 0.12) / 0.6)) * 400;
    ctx.save();
    ctx.translate(x + tw * kk / 2, y + th * kk / 2); ctx.rotate(Math.sin(S.t * 0.8 + i) * 0.03 + (i % 2 ? 0.02 : -0.02)); ctx.scale(kk, kk); ctx.translate(-tw / 2, -th / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
    roundPath(ctx, 0, 0, tw, th, 20); ctx.fillStyle = '#f6eed6'; ctx.fill();
    ctx.shadowColor = 'transparent';
    const fg = ctx.createLinearGradient(0, 0, tw * 0.4, th); fg.addColorStop(0, '#fffbef'); fg.addColorStop(1, '#e3d6b2');
    roundPath(ctx, 0, 0, tw, th - 10, 20); ctx.fillStyle = fg; ctx.fill();
    roundPath(ctx, 0, th - 14, tw, 14, 8); ctx.fillStyle = '#8c7c52'; ctx.fill();
    roundPath(ctx, 0, 0, tw, th - 10, 20); ctx.fillStyle = fg; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; roundPath(ctx, 6, 6, tw - 12, th - 22, 16); ctx.stroke();
    ctx.font = `900 118px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(ch, tw / 2 + 1, th * 0.44 + 3);
    ctx.fillStyle = INK[i]; ctx.fillText(ch, tw / 2, th * 0.44);
    drawPip(ctx, i, tw / 2, th - 38, 11, INK[i]);
    ctx.restore();
  });
  // golden underline with tulips
  const ux = T.cx;
  tulip(ctx, ux - 150 * k, T.ulY, 24 * k, 'rgba(244,201,106,0.9)', 'rgba(244,201,106,0.7)');
  tulip(ctx, ux + 150 * k, T.ulY, 24 * k, 'rgba(244,201,106,0.9)', 'rgba(244,201,106,0.7)');
  ctx.strokeStyle = 'rgba(244,201,106,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ux - 120 * k, T.ulY); ctx.lineTo(ux + 120 * k, T.ulY); ctx.stroke();
  txt(ctx, L(S, 'tagline'), ux, T.tag1, 30 * k, '#f3e2b0', 'center', 400, DISPLAY, T.tagMax);
  txt(ctx, L(S, 'tagline2'), ux, T.tag2, 22 * k, 'rgba(243,226,176,0.7)', 'center', 400, DISPLAY, T.tagMax);

  const r = titleRows(!!S.save), sc = TEXT_SCALES[S.prefs.textScaleIdx] ?? 1, bk = Math.min(1, k);
  if (r.cont) { button(ctx, r.cont, L(S, 'cont'), { primary: true, size: 34 * bk, scale: Math.min(sc, 1.6) }); button(ctx, r.play, L(S, 'newMatch'), { size: 30 * bk, scale: Math.min(sc, 1.6) }); }
  else button(ctx, r.play, L(S, 'play'), { primary: true, size: 40 * bk, scale: Math.min(sc, 1.6) });
  button(ctx, r.watch, L(S, 'watch'), { size: 30 * bk, scale: Math.min(sc, 1.6) });
  button(ctx, r.howto, L(S, 'howto'), { size: 24 * bk, scale: sc });
  button(ctx, r.rules, L(S, 'rules'), { size: 24 * bk, scale: sc });
  button(ctx, r.about, L(S, 'about'), { size: 24 * bk, scale: sc });
  button(ctx, r.settings, L(S, 'settings'), { size: 26 * bk, scale: sc });
  button(ctx, r.sound, S.prefs.sound ? L(S, 'soundOn') : L(S, 'soundOff'), { size: 24 * bk, scale: sc, active: S.prefs.sound });
  { const q = T.lockup, dn = ART.PRESS.down && inRect(T.lockTap, ART.PRESS.x, ART.PRESS.y);       // the themed Arcforge lockup, under the menu
    ctx.save(); ctx.fillStyle = 'rgba(6,34,30,0.62)'; roundPath(ctx, q.x - 10, q.y - 5, q.w + 20, q.h + 10, (q.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, dn ? { x: q.x + q.w * 0.02, y: q.y + 1, w: q.w * 0.96, h: q.h * 0.96 } : q, dn ? 0.7 : 1); }
  const st = S.stats, sx = LAY.land ? T.cx : LAY.cx, sk = Math.min(1, k);
  txt(ctx, `${L(S, 'dealsWon')} ${st.wins}/${st.deals}   ${L(S, 'matchesWon')} ${st.matchWins}/${st.matches}`, sx, T.stats1, 24 * sk, 'rgba(243,226,176,0.75)', 'center', 600, NUM_FONT, T.tagMax);
  if (T.stats2 + 10 < T.showY || LAY.land) txt(ctx, `${L(S, 'offline')}`, sx, T.stats2, 22 * sk, 'rgba(243,226,176,0.55)', 'center', 400, NUM_FONT, T.tagMax);
  if (S.demoCap) txt(ctx, S.demoCap.text, sx, T.cap, 22 * sk, '#ffd98a', 'center', 600, NUM_FONT, T.tagMax);
  // a little rack at the foot of the menu: a run, a set and the gold okey, gently bobbing
  const showcase = [[0, 4], [0, 5], [0, 6], null, [1, 9], [2, 9], [3, 9], null, [2, 11], [2, 12], 'okey', [2, 13]];
  const stw = 52, sth = 74, pitch = 56, ks = Math.min(T.showH / 120, T.showW / 664);
  let x = -(showcase.reduce((a, e) => a + (e ? pitch : 20), 0) - 4) / 2;
  ctx.save(); ctx.translate(T.showX + T.showW / 2, T.showY); ctx.scale(ks, ks);
  const pw = T.showW / ks;
  roundPath(ctx, -pw / 2, 0, pw, 120, 26); ctx.fillStyle = 'rgba(74,43,23,0.85)'; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#d6aa4f'; ctx.stroke();
  roundPath(ctx, -pw / 2 + 10, 86, pw - 20, 12, 6); ctx.fillStyle = '#8e5a33'; ctx.fill();
  showcase.forEach((e, i) => {
    if (!e) { x += 20; return; }
    const bob = Math.sin(S.t * 2 + i * 0.7) * 2.5;
    if (e === 'okey') drawTile(ctx, 2 * 13 + 9, { key: 2 * 13 + 9 }, x, 12 + bob, stw, sth);
    else drawTile(ctx, e[0] * 13 + e[1] - 1, null, x, 12 + bob, stw, sth);
    x += pitch;
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------------------------
function renderSettings(ctx, S) {
  drawTitleBg(ctx);
  const sc = TEXT_SCALES[S.prefs.textScaleIdx] ?? 1;
  txt(ctx, L(S, 'settings'), LAY.cx, LAY.settingsTitleY, 54, '#f7efd8', 'center', 700, DISPLAY);
  const P = S.prefs;
  const rows = [
    [L(S, 'sound'), P.sound ? L(S, 'on') : L(S, 'off')],
    [L(S, 'opponents'), LEVEL_NAMES[P.level]],
    [L(S, 'matchLen'), `${P.matchLen} ${P.matchLen === 1 ? L(S, 'deal1') : L(S, 'deals')}`],
    [L(S, 'assist'), P.assist ? L(S, 'on') : L(S, 'off')],
    [L(S, 'labels'), P.terms === 'tr' ? 'Türkçe' : 'English'],
    [L(S, 'textSize'), null],
    [L(S, 'thinkTime'), null],
  ];
  rows.forEach(([label, val], i) => {
    const r = SET_ROWS[i];
    roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(233,196,106,0.35)'; ctx.stroke();
    const fw = fitWrap(ctx, label, 700, 26 * Math.min(sc, 1.6), r.lw - 35, r.h - 10);
    ctx.font = `700 ${fw.fs}px ${NUM_FONT}`; ctx.fillStyle = '#f7efd8'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    fw.lines.forEach((l, i) => ctx.fillText(l, r.x + 22, r.y + r.h / 2 + (i - (fw.lines.length - 1) / 2) * fw.fs * 1.15));
    if (val !== null) button(ctx, setBtnRect(i), val, { size: 26, scale: Math.min(sc, 1.5), active: true });
  });
  // text size stepper row (5) and think time stepper row (6)
  const stepper = (i, label, dimL, dimR) => {
    const r = SET_ROWS[i], a = stepRect(i, false), b = stepRect(i, true);
    button(ctx, a, '−', { size: 34, dim: dimL });
    button(ctx, b, '+', { size: 34, dim: dimR });
    txt(ctx, label, (a.x + a.w + b.x) / 2, r.y + r.h / 2, 28 * Math.min(sc, 1.5), '#ffe9a8', 'center', 700, NUM_FONT, b.x - a.x - a.w - 8);
  };
  stepper(5, `${Math.round(sc * 100)}%`, P.textScaleIdx === 0, P.textScaleIdx === TEXT_SCALES.length - 1);
  stepper(6, `${THINK_STEPS[P.thinkIdx]} s`, P.thinkIdx === 0, P.thinkIdx === THINK_STEPS.length - 1);
  button(ctx, SET_BACK, L(S, 'back'), { primary: true, size: 32, scale: Math.min(sc, 1.5) });
  if (LAY.statsY) {
    const st = S.stats, z = Math.min(sc, LAY.land ? 1 : 1.5);
    const lines = [`${L(S, 'dealsWon')}: ${st.wins} / ${st.deals}`, `${L(S, 'matchesWon')}: ${st.matchWins} / ${st.matches}`, `${L(S, 'bestMatch')}: ${st.best}`];
    const step = (LAY.land ? 28 : 40) * z;
    lines.forEach((l, i) => txt(ctx, l, LAY.statsX, LAY.statsY + i * step, LAY.statsSz * z, 'rgba(243,226,176,0.8)', 'center', 600, NUM_FONT, SET_ROWS[0].w));
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Reader pages (About / How to Play / Rules) with reflowing pagination
// ---------------------------------------------------------------------------------------------------------------
const pageCache = new Map();
const TILE_ILL = { w: 50, h: 70 };
const specId = (sp) => (sp.fake ? 104 : (sp.c * 13 + sp.n - 1));

function paginate(ctx, blocks, scale) {
  // ONE continuous scrolling document: a single unbounded page (pages.total is its height); the reader scrolls it.
  const P = REF_PANEL, innerW = P.w - 70, maxH = Infinity;
  const fs = Math.round(27 * scale), lh = Math.round(fs * 1.32), hfs = Math.round(36 * Math.min(scale, 1.35)), capFs = Math.round(22 * Math.min(scale, 1.6));
  const pages = [];
  let cur = [], y = 0, total = 0;
  const push = () => { total = Math.max(total, y); if (cur.length) pages.push(cur); cur = []; y = 0; };
  const add = (item, h) => { cur.push({ ...item, y }); y += h; };
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    if (b.h) {
      const h = hfs * 1.4 + 6;
      if (y + h + lh * 2 > maxH && cur.length) push();
      ctx.font = `700 ${hfs}px ${DISPLAY}`;
      const hl = wrapLines(ctx, b.h, innerW);
      add({ k: 'h', lines: hl, fs: hfs }, hl.length * hfs * 1.3 + 10);
    } else if (b.p) {
      ctx.font = `400 ${fs}px ${NUM_FONT}`;
      let lines = wrapLines(ctx, b.p, innerW);
      while (lines.length) {
        const room = Math.floor((maxH - y) / lh);
        if (room < 1) { push(); continue; }
        const take = Math.min(room, lines.length);
        add({ k: 'p', lines: lines.slice(0, take), fs, lh }, take * lh + (take === lines.length ? Math.round(fs * 0.55) : 0));
        lines = lines.slice(take);
        if (lines.length) push();
      }
    } else if (b.tiles) {
      const per = Math.max(1, Math.floor(innerW / (TILE_ILL.w + 8)));
      const items = [];
      for (const sp of b.tiles) items.push(sp);
      // split into rows on width
      const rows = []; let row = [], rw = 0;
      for (const sp of items) {
        const sw = sp.gap ? 22 : TILE_ILL.w + 6;
        if (rw + sw > innerW && row.length) { rows.push(row); row = []; rw = 0; }
        row.push(sp); rw += sw;
      }
      if (row.length) rows.push(row);
      ctx.font = `italic 400 ${capFs}px ${NUM_FONT}`;
      const cl = b.cap ? wrapLines(ctx, b.cap, innerW) : [];
      const h = rows.length * (TILE_ILL.h + 14) + cl.length * capFs * 1.3 + 14;
      if (y + h > maxH && cur.length) push();
      add({ k: 'tiles', rows, cap: cl, capFs }, h);
    }
  }
  push();
  pages.total = total;
  return pages;
}

export function readerPages(ctx, S, which) {
  const scale = TEXT_SCALES[S.prefs.textScaleIdx] ?? 1;
  const key = `${which}|${scale}|${Math.round(REF_PANEL.w)}x${Math.round(REF_PANEL.h)}`;
  let pages = pageCache.get(key);
  if (!pages) {
    pages = paginate(ctx, which === 'howto' ? HOWTO : which === 'about' ? ABOUT : RULES, scale);
    pageCache.set(key, pages);
  }
  return pages;
}

function renderReader(ctx, S, which) {
  drawTitleBg(ctx);
  const pages = readerPages(ctx, S, which);
  const scale = TEXT_SCALES[S.prefs.textScaleIdx] ?? 1;
  const page = pages[0] || [];
  const P = REF_PANEL;
  const sk = `${which}|${S.prefs.textScaleIdx}|${Math.round(P.w)}x${Math.round(P.h)}`;
  if (S.scrollKey !== sk) { S.scrollKey = sk; S.scroll = 0; }
  const clipTop = P.y + 100, clipBot = P.y + P.h - 46, viewH = clipBot - clipTop;
  S.scrollMax = Math.max(0, Math.round((pages.total || 0) + 20 - viewH));
  S.scroll = Math.max(0, Math.min(S.scroll || 0, S.scrollMax));
  roundPath(ctx, P.x, P.y, P.w, P.h, 30);
  const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); pg.addColorStop(0, 'rgba(8,38,36,0.82)'); pg.addColorStop(1, 'rgba(4,22,21,0.9)');
  ctx.fillStyle = pg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(233,196,106,0.5)'; ctx.stroke();
  roundPath(ctx, P.x + 7, P.y + 7, P.w - 14, P.h - 14, 24); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(233,196,106,0.18)'; ctx.stroke();
  const title = which === 'howto' ? L(S, 'howto') : which === 'about' ? L(S, 'about') : L(S, 'rules');
  const pcx = P.x + P.w / 2;
  txt(ctx, title, pcx, P.y + 52, 44 * Math.min(scale, 1.15), '#ffe9a8', 'center', 700, DISPLAY, P.w - 80);
  ctx.strokeStyle = 'rgba(233,196,106,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 50, P.y + 88); ctx.lineTo(P.x + P.w - 50, P.y + 88); ctx.stroke();
  const x0 = P.x + 35, top = clipTop + 6 - S.scroll;
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 8, clipTop, P.w - 16, viewH); ctx.clip();
  for (const it of page) {
    let y = top + it.y;
    if (y > clipBot + 10 || y + 1500 < clipTop) continue;
    if (it.k === 'h') {
      ctx.font = `700 ${it.fs}px ${DISPLAY}`; ctx.fillStyle = '#ffd97a'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      it.lines.forEach((l, i) => ctx.fillText(l, x0, y + i * it.fs * 1.3));
    } else if (it.k === 'p') {
      ctx.font = `400 ${it.fs}px ${NUM_FONT}`; ctx.fillStyle = '#f7efd8'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      it.lines.forEach((l, i) => ctx.fillText(l, x0, y + i * it.lh));
    } else if (it.k === 'tiles') {
      for (const row of it.rows) {
        const rw = row.reduce((a, sp) => a + (sp.gap ? 22 : TILE_ILL.w + 6), -6);
        let x = pcx - rw / 2;
        for (const sp of row) {
          if (sp.gap) { x += 22; continue; }
          const id = specId(sp);
          drawTile(ctx, id, sp.okey ? { key: id } : null, x, y, TILE_ILL.w, TILE_ILL.h);
          x += TILE_ILL.w + 6;
        }
        y += TILE_ILL.h + 14;
      }
      ctx.font = `italic 400 ${it.capFs}px ${NUM_FONT}`; ctx.fillStyle = 'rgba(247,239,216,0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      it.cap.forEach((l, i) => ctx.fillText(l, pcx, y + i * it.capFs * 1.3));
    }
  }
  ctx.restore();
  if (S.scrollMax > 0) { const trackH = viewH - 8, th = Math.max(36, trackH * viewH / (viewH + S.scrollMax)); ctx.fillStyle = 'rgba(247,239,216,0.12)'; roundPath(ctx, P.x + P.w - 18, clipTop + 4, 5, trackH, 3); ctx.fill(); ctx.fillStyle = 'rgba(233,196,106,0.7)'; roundPath(ctx, P.x + P.w - 18, clipTop + 4 + (trackH - th) * (S.scroll / S.scrollMax), 5, th, 3); ctx.fill(); }
  txt(ctx, S.scrollMax > 0 ? (S.scroll >= S.scrollMax - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', pcx, P.y + P.h - 26, 20, 'rgba(243,226,176,0.7)', 'center', 600);
  txt(ctx, `${Math.round(scale * 100)}%`, P.x + 34, P.y + P.h - 26, 22, '#ffe9a8', 'left', 700);
  button(ctx, TEXT_DEC, 'A−', { size: 32, dim: S.prefs.textScaleIdx === 0 });
  button(ctx, TEXT_INC, 'A+', { size: 32, dim: S.prefs.textScaleIdx === TEXT_SCALES.length - 1 });
  button(ctx, REF_BACK, L(S, 'back'), { size: 34 });
  button(ctx, REF_NEXT, 'More', { primary: true, size: 34, dim: S.scroll >= S.scrollMax - 2 });
}

// ---------------------------------------------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------------------------------------------
const jitter = (id, k) => (((id * 2654435761 + k * 40503) >>> 0) % 1000) / 1000 - 0.5;

function seatName(S, seat) { return (S.prefs.terms === 'tr' ? SEAT_NAMES_TR : SEAT_NAMES)[seat] + (S.scene === 'demo' && seat === 0 ? ' (AI)' : ''); }

function drawPlate(ctx, S, seat) {
  const r = PLATE[seat], d = S.d;
  const active = d && d.turn === seat && d.phase !== 'over' && !S.over;
  ctx.save();
  if (active) { ctx.shadowColor = '#ffe28a'; ctx.shadowBlur = 20 + Math.sin(S.t * 6) * 5; }
  roundPath(ctx, r.x, r.y, r.w, r.h, 18);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, active ? '#2c8a7a' : '#1b4a46'); g.addColorStop(1, active ? '#17594f' : '#0e2e2c');
  ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = active ? 3 : 1.5; ctx.strokeStyle = active ? '#ffe28a' : 'rgba(233,196,106,0.4)'; ctx.stroke();
  ctx.restore();
  drawAvatar(ctx, seat, r.x + 26, r.y + r.h / 2, 18);
  txt(ctx, seatName(S, seat).slice(0, 1), r.x + 26, r.y + r.h / 2 + 1, 20, '#3a2406', 'center', 800);
  const score = S.match.scores[seat];
  const nameSz = r.h > 56 ? 21 : 20;
  txt(ctx, seatName(S, seat), r.x + 52, r.y + r.h * 0.34, nameSz, '#f7efd8', 'left', 700, NUM_FONT, r.w - 60);
  txt(ctx, `${L(S, 'score')} ${score > 0 ? '+' : ''}${score}`, r.x + 52, r.y + r.h * 0.72, 19, score >= 0 ? '#ffe9a8' : '#ffb4a0', 'left', 600, NUM_FONT, r.w - 60);
}

function rackFrame(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  roundPath(ctx, x, y, w, h, 12);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#6b4126'); g.addColorStop(1, '#3b2112');
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(214,170,79,0.7)'; roundPath(ctx, x + 1, y + 1, w - 2, h - 2, 11); ctx.stroke();
}
function drawBacksRow(ctx, n, B) {
  const w = 34 * B.s, h = 48 * B.s, step = B.step;
  const total = Math.max(0, (n - 1) * step + w);
  rackFrame(ctx, B.x - B.fw / 2, B.y - 8, B.fw, h + 16);
  for (let i = 0; i < n; i++) drawBack(ctx, B.x - total / 2 + i * step, B.y, w, h);
}
function drawBacksCol(ctx, n, B) {
  // rotated tiles stacked top to bottom, standing in a small rack
  const w = 34 * B.s, h = 48 * B.s, step = B.step;
  rackFrame(ctx, B.x - 29 * B.s, B.y - 8, 58 * B.s, B.colH);
  for (let i = 0; i < n; i++) drawBack(ctx, B.x - w / 2 + 3 * B.s, B.y + i * step, w, h, { rot: Math.PI / 2 });
}

function drawStack(ctx, S, hot) {
  const d = S.d, n = d ? d.stack.length : 0;
  const c = STACK_C;
  const layers = Math.min(7, Math.ceil(n / 7));
  for (let i = layers; i >= 0; i--) drawBack(ctx, c.x - TILE_S.w / 2 - i * 1.4, c.y - TILE_S.h / 2 - i * 1.6, TILE_S.w, TILE_S.h);
  if (hot) {
    ctx.save();
    ctx.shadowColor = '#ffe28a'; ctx.shadowBlur = 22; ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,226,138,${0.6 + 0.4 * Math.sin(S.t * 7)})`;
    roundPath(ctx, c.x - TILE_S.w / 2 - 5, c.y - TILE_S.h / 2 - 5, TILE_S.w + 10, TILE_S.h + 10, 12); ctx.stroke();
    ctx.restore();
  }
  pill(ctx, c.x - 22, c.y + TILE_S.h / 2 + 8, 44, 24, 'rgba(0,0,0,0.5)', null);
  txt(ctx, String(n), c.x, c.y + TILE_S.h / 2 + 20, 18, '#f7efd8', 'center', 700);
}

function drawPiles(ctx, S, hotTake, hotDiscard) {
  const d = S.d, okey = d.okey;
  const hide = new Set(S.flyHide);
  for (let seat = 0; seat < 4; seat++) {
    const pile = d.piles[seat], c = PILE_C[seat];
    const shown = pile.filter((id) => !hide.has(id));
    const from = Math.max(0, shown.length - 3);
    for (let i = from; i < shown.length; i++) {
      const id = shown[i];
      const top = i === shown.length - 1;
      drawTile(ctx, id, okey, c.x - TILE_S.w / 2 + jitter(id, 1) * 6, c.y - TILE_S.h / 2 + jitter(id, 2) * 6, TILE_S.w, TILE_S.h, { rot: jitter(id, 3) * 0.14, dim: top ? 0 : 0.18 });
    }
    if (shown.length > 1) { pill(ctx, c.x + 14, c.y + TILE_S.h / 2 - 4, 30, 22, 'rgba(0,0,0,0.55)', null); txt(ctx, String(pile.length), c.x + 29, c.y + TILE_S.h / 2 + 7, 15, '#f7efd8', 'center', 700); }
  }
  const glow = (seat, label, tint) => {
    const r = pileRect(seat);
    ctx.save();
    ctx.shadowColor = tint; ctx.shadowBlur = 24; ctx.lineWidth = 3.5; ctx.strokeStyle = tint;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(S.t * 7);
    roundPath(ctx, r.x, r.y, r.w, r.h, 14); ctx.stroke();
    ctx.restore();
    txt(ctx, label, r.x + r.w / 2, r.y - 14 + (seat === 2 ? -4 : 0), 20, tint, 'center', 800);
  };
  if (hotTake) glow(prevSeat(0), L(S, 'take'), '#ffe28a');
  if (hotDiscard) glow(0, L(S, 'discard'), '#9ff0c9');
}

function drawIndicator(ctx, S) {
  const d = S.d, c = INDICATOR_C;
  const flip = clamp01((S.t - (S.dealT0 ?? 0) - 0.9) / 0.5);
  ctx.save();
  ctx.translate(c.x, c.y); ctx.rotate(-0.1);
  const sx = Math.abs(Math.cos(flip * Math.PI));
  ctx.scale(Math.max(0.04, flip < 1 ? sx : 1), 1);
  if (flip < 0.5) drawBack(ctx, -TILE_S.w / 2, -TILE_S.h / 2, TILE_S.w, TILE_S.h);
  else drawTile(ctx, d.indicator, d.okey, -TILE_S.w / 2, -TILE_S.h / 2, TILE_S.w, TILE_S.h);
  ctx.restore();
  txt(ctx, L(S, 'indicator'), c.x, c.y + TILE_S.h / 2 + 20, 17, 'rgba(247,239,216,0.85)', 'center', 700, NUM_FONT, 100);
}

function drawHud(ctx, S) {
  const d = S.d;
  button(ctx, HUD_MENU, S.scene === 'demo' ? L(S, 'exit') : L(S, 'menu'), { size: 22 });
  const dl = LAY.dealLbl;
  txt(ctx, `${L(S, 'deal')} ${S.match.deal} / ${S.match.total}`, dl.x, dl.y1, 24, '#ffe9a8', 'left', 800, NUM_FONT, dl.maxW);
  if (S.scene === 'demo') txt(ctx, L(S, 'watching'), dl.x, dl.y2, 17, 'rgba(247,239,216,0.7)', 'left', 600, NUM_FONT, dl.maxW);
  else txt(ctx, `${L(S, 'stack')} ${d.stack.length}`, dl.x, dl.y2, 17, 'rgba(247,239,216,0.7)', 'left', 600, NUM_FONT, dl.maxW);
  // the okey chip
  const r = HUD_OKEY;
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#e3b44c'; ctx.stroke();
  drawTile(ctx, d.indicator === undefined ? 0 : (d.okey.c * 13 + d.okey.n - 1), d.okey, r.x + 10, r.y + 6, 34, 48);
  txt(ctx, L(S, 'okeyIs'), r.x + 54, r.y + 19, 16, '#e3b44c', 'left', 800);
  txt(ctx, tileLabel(S, d.okey.c * 13 + d.okey.n - 1), r.x + 54, r.y + 41, 22, '#fff2c8', 'left', 700, NUM_FONT, r.w - 64);
}

function drawSeats(ctx, S) {
  const d = S.d;
  for (let s = 0; s < 4; s++) drawPlate(ctx, S, s);
  const cnt = (s) => Math.min(d.hands[s].length, S.dealShow ? S.dealShow[s] : 99) - (S.flyHideSeat?.[s] ?? 0);
  drawBacksRow(ctx, Math.max(0, cnt(2)), BACKS.top);
  drawBacksCol(ctx, Math.max(0, cnt(3)), BACKS.left);
  drawBacksCol(ctx, Math.max(0, cnt(1)), BACKS.right);
}

// ---- the rack ----------------------------------------------------------------------------------------------------
function drawRack(ctx, S, V) {
  const d = S.d, okey = d.okey;
  const hide = new Set(S.flyHide);
  const drag = S.drag && S.drag.moved ? S.drag : null;
  const chunks = V.chunks;
  // brackets under valid melds
  for (const ch of chunks) {
    if (!ch.valid) continue;
    const a = slotRect(ch.slots[0]), b = slotRect(ch.slots[ch.slots.length - 1]);
    ctx.save();
    ctx.shadowColor = '#7dffb0'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#6ff0a0';
    roundPath(ctx, a.x + 2, a.y + RACK.th - 3, b.x + b.w - a.x - 4, 6, 3); ctx.fill();
    ctx.restore();
  }
  const slotOfDrop = drag ? slotAt(drag.x, drag.y) : -1;
  if (slotOfDrop >= 0) {
    const q = slotRect(slotOfDrop);
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,226,138,0.9)'; ctx.setLineDash([8, 6]);
    roundPath(ctx, q.x - 2, q.y - 2, q.w + 4, q.h + 4, 10); ctx.stroke(); ctx.restore();
  }
  const fin = V.finishIds;
  for (let s = 0; s < S.rack.length; s++) {
    const id = S.rack[s];
    if (id < 0 || hide.has(id) || (drag && drag.id === id)) continue;
    const q = V.disp[id] ?? slotRect(s);
    const sel = S.sel === id;
    const isNew = S.newTile === id;
    let glow = null;
    if (S.hint && S.hint.phase === 'discard' && S.hint.id === id) glow = '#ffe28a';
    else if (S.demoReveal && S.demoReveal.discard === id) glow = '#ffe28a';
    else if (fin && fin.has(id)) glow = '#7dffb0';
    else if (isNew) glow = `rgba(255,226,138,${0.55 + 0.35 * Math.sin(S.t * 6)})`;
    const lift = sel ? -16 : 0;
    drawTile(ctx, id, okey, q.x, q.y + lift, RACK.tw, RACK.th, { glow });
    if (S.demoReveal && S.demoReveal.phase === 'discard' && S.demoReveal.discard !== id) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; roundPath(ctx, q.x + 1, q.y + 1, RACK.tw - 2, RACK.th - 6, 10); ctx.stroke(); ctx.restore(); }
  }
  if (drag) {
    drawTile(ctx, drag.id, okey, drag.x - RACK.tw / 2 * 1.08, drag.y - RACK.th / 2 * 1.08 - 10, RACK.tw * 1.08, RACK.th * 1.08, { glow: 'rgba(255,255,255,0.5)' });
  }
}

function drawFlights(ctx, S) {
  const okey = S.d.okey;
  for (const f of S.fly) {
    if (f.t < 0) continue;
    const k = ease(clamp01(f.t / f.dur));
    const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 36;
    const w = f.w0 + (f.w1 - f.w0) * k, h = f.h0 + (f.h1 - f.h0) * k;
    const rot = f.r0 + (f.r1 - f.r0) * k;
    if (f.flip) {
      // a dealt tile turns face up in mid-air: squeeze the back away, then open the face
      const sq = Math.max(0.04, Math.abs(Math.cos(k * Math.PI)));
      const ww = w * sq;
      if (k < 0.5) drawBack(ctx, x - ww / 2, y - h / 2, ww, h, { rot });
      else drawTile(ctx, f.id, okey, x - ww / 2, y - h / 2, ww, h, { rot });
    } else if (f.face) drawTile(ctx, f.id, okey, x - w / 2, y - h / 2, w, h, { rot });
    else drawBack(ctx, x - w / 2, y - h / 2, w, h, { rot });
  }
}

function drawParticles(ctx, S) {
  for (const p of S.parts) {
    const a = 1 - p.t / p.max;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.c;
    if (p.shape === 'spark') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 4); ctx.fillRect(-p.s / 2, -p.s * 1.5, p.s, p.s * 3); ctx.fillRect(-p.s * 1.5, -p.s / 2, p.s * 3, p.s); ctx.restore(); }
    else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * p.spin); ctx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
}

function drawControls(ctx, S, V) {
  const d = S.d;
  const mine = S.scene === 'play' && d.turn === 0 && d.phase !== 'over' && !S.over;
  if (S.scene === 'play') {
    button(ctx, BTN.runs, L(S, 'sortRuns'), { size: 24 });
    button(ctx, BTN.sets, L(S, 'sortSets'), { size: 24 });
    button(ctx, BTN.smart, L(S, 'smart'), { size: 24 });
    button(ctx, BTN.hint, L(S, 'hint'), { size: 24, hot: !!S.hint });
    // meld counter
    const inSets = V.chunks.filter((c) => c.valid).reduce((a, c) => a + c.ids.length, 0);
    const r = MELDS_BAR;
    roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = inSets >= 14 ? '#7dffb0' : 'rgba(233,196,106,0.4)'; ctx.stroke();
    txt(ctx, `${L(S, 'inSets')} ${Math.min(inSets, 14)}/14`, r.x + r.w / 2, r.y + r.h / 2, 24, inSets >= 14 ? '#9dffc2' : '#f7efd8', 'center', 700, NUM_FONT, r.w - 16);
    if (S.sel >= 0 && mine && d.phase === 'discard') button(ctx, DISCARD_BTN, `${L(S, 'discard')}  ${tileLabel(S, S.sel)}`, { primary: true, size: 24 });
  } else if (S.scene === 'demo') {
    const dm = S.demo;
    button(ctx, DEMO.dec, '−', { size: 40, dim: S.prefs.thinkIdx === 0 });
    button(ctx, DEMO.inc, '+', { size: 40, dim: S.prefs.thinkIdx === THINK_STEPS.length - 1 });
    button(ctx, DEMO.pause, dm.paused ? `▶  ${L(S, 'resume')}` : `❚❚  ${L(S, 'pause')}`, { size: 30, primary: dm.paused });
    const tl = DEMO.thinkLbl;
    txt(ctx, `${L(S, 'think')} ${THINK_STEPS[S.prefs.thinkIdx]}s`, tl.x, tl.y, tl.size, '#ffe9a8', 'center', 700, NUM_FONT, 120);
    button(ctx, DEMO.speed, `${L(S, 'speed')} ×${dm.speed}`, { size: 22 });
  }
  // the status line
  const r = STATUS;
  roundPath(ctx, r.x, r.y, r.w, r.h, Math.min(20, r.h / 2)); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(233,196,106,0.3)'; ctx.stroke();
  const msg = S.status;
  const fw = fitWrap(ctx, msg.text, 600, 24, r.w - 28, r.h - 8, NUM_FONT, 12);
  ctx.font = `600 ${fw.fs}px ${NUM_FONT}`;
  ctx.fillStyle = msg.kind === 'warn' ? '#ffb4a0' : msg.kind === 'good' ? '#9dffc2' : '#f7efd8';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  fw.lines.slice(0, 3).forEach((l, i, a) => ctx.fillText(l, r.x + 16, r.y + r.h / 2 + (i - (a.length - 1) / 2) * fw.fs * 1.18));
}

function drawDemoBanner(ctx, S) {
  const dm = S.demo;
  const ph = dm.phase;
  const col = ph === 'think' ? '#8fd0ff' : ph === 'reveal' ? '#ffe28a' : '#9dffc2';
  const total = ph === 'think' ? THINK_STEPS[S.prefs.thinkIdx] : ph === 'reveal' ? 2 : 0.8;
  const frac = ph === 'act' ? 1 : clamp01(1 - dm.timer / total);
  const r = LAY.demoBanner, fw = Math.max(20, r.w * frac);
  roundPath(ctx, r.x, r.y, r.w, r.h, Math.min(20, r.h / 2)); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const label = ph === 'think' ? L(S, 'phThink') : ph === 'reveal' ? L(S, 'phReveal') : L(S, 'phAct');
  // the label is light on the empty track and dark on the filled part, so it reads everywhere
  const bx = r.x + r.w / 2, lsz = r.h >= 40 ? 21 : 18;
  txt(ctx, label, bx, r.y + r.h / 2 + 1, lsz, '#fff6dc', 'center', 800, NUM_FONT, r.w - 24);
  ctx.save();
  roundPath(ctx, r.x, r.y, fw, r.h, Math.min(20, r.h / 2)); ctx.fillStyle = col; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1; ctx.clip();
  txt(ctx, label, bx, r.y + r.h / 2 + 1, lsz, '#10231f', 'center', 800, NUM_FONT, r.w - 24);
  ctx.restore();
}

function drawDemoReveal(ctx, S) {
  const dm = S.demo, rv = S.demoReveal;
  if (!rv || dm.phase !== 'reveal') return;
  if (rv.phase === 'draw') {
    // outline both legal sources, the chosen one strongly
    const src = (rect, chosen, label) => {
      ctx.save();
      ctx.lineWidth = chosen ? 5 : 2.5; ctx.strokeStyle = chosen ? '#ffe28a' : 'rgba(255,255,255,0.65)';
      if (chosen) { ctx.shadowColor = '#ffe28a'; ctx.shadowBlur = 26; }
      roundPath(ctx, rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8, 14); ctx.stroke();
      ctx.restore();
      txt(ctx, label, rect.x + rect.w / 2, rect.y - 18, 19, chosen ? '#ffe28a' : 'rgba(255,255,255,0.8)', 'center', 800);
    };
    src(stackRect(), rv.src === 'stack', L(S, 'draw'));
    if (rv.hasPile) src(pileRect(prevSeat(0)), rv.src === 'pile', L(S, 'take'));
  }
}

function drawOverlayDim(ctx, a = 0.55) { ctx.fillStyle = `rgba(2,16,15,${a})`; ctx.fillRect(0, 0, W, H); }

function drawPause(ctx, S) {
  drawOverlayDim(ctx, 0.62);
  const P = PAUSE.panel;
  roundPath(ctx, P.x, P.y, P.w, P.h, 30); ctx.fillStyle = '#0d3a36'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#e3b44c'; ctx.stroke();
  txt(ctx, L(S, 'paused'), P.x + P.w / 2, P.y + 58, 44, '#ffe9a8', 'center', 700, DISPLAY);
  button(ctx, PAUSE.resume, L(S, 'resume'), { primary: true, size: 30 });
  button(ctx, PAUSE.sound, S.prefs.sound ? L(S, 'soundOn') : L(S, 'soundOff'), { size: 28 });
  button(ctx, PAUSE.rules, L(S, 'rules'), { size: 28 });
  button(ctx, PAUSE.quit, L(S, 'quit'), { size: 28 });
}

// ---- result overlays --------------------------------------------------------------------------------------------------
function miniTiles(ctx, ids, okey, cx, y, tw, th, gap) {
  const total = ids.length * (tw + 2) - 2;
  ids.forEach((id, i) => drawTile(ctx, id, okey, cx - total / 2 + i * (tw + 2), y, tw, th));
}

function drawResult(ctx, S) {
  const R = S.over;
  drawOverlayDim(ctx, 0.7);
  const P = RESULT.panel, sc = TEXT_SCALES[S.prefs.textScaleIdx] ?? 1;
  const z = Math.min(sc, 2);
  roundPath(ctx, P.x, P.y, P.w, P.h, 32);
  const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, '#13524a'); g.addColorStop(1, '#0a2c29');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#e3b44c'; ctx.stroke();
  // portrait: one column; landscape: the title and the winning rack on the left, the scores and buttons on the right
  const two = RESULT.cols === 2;
  const A = two ? { cx: P.x + (P.w - RESULT.colW) / 2, w: P.w - RESULT.colW - 30 } : { cx: P.x + P.w / 2, w: P.w - 60 };
  const B = two ? { cx: P.x + P.w - RESULT.colW / 2, w: RESULT.colW - 40 } : { cx: P.x + P.w / 2, w: P.w - 80 };
  let y = P.y + (two ? 70 : 62);
  txt(ctx, R.title, A.cx, y, 44 * Math.min(sc, 1.4), '#ffe9a8', 'center', 700, DISPLAY, A.w);
  y += 50 * Math.min(sc, 1.4);
  if (R.sub) { txt(ctx, R.sub, A.cx, y, 24 * z, '#f7efd8', 'center', 600, NUM_FONT, A.w); y += 40 * z; }
  if (R.melds) {
    // the winning rack, grouped
    let rows = [[]];
    let rw = 0;
    for (const m of R.melds) {
      const w = m.length * 36;
      if (rw + w > A.w - 10 && rows[rows.length - 1].length) { rows.push([]); rw = 0; }
      rows[rows.length - 1].push(m); rw += w + 16;
    }
    for (const row of rows) {
      const tot = row.reduce((a, m) => a + m.length * 36 + 16, -16);
      let x = A.cx - tot / 2;
      for (const m of row) { m.forEach((id, i) => drawTile(ctx, id, S.d.okey, x + i * 36, y, 34, 48)); x += m.length * 36 + 16; }
      y += 62;
    }
    y += 6;
  }
  if (two) {
    // the left column keeps the winning rack and note; the score table starts at the top of the right column
    if (R.mine && z <= 1.2) {
      txt(ctx, `${S.prefs.terms === 'tr' ? 'Senin ıstakan' : 'Your rack'}: ${R.mine.inSets} / ${R.mine.total}`, A.cx, y + 16, 19, 'rgba(247,239,216,0.75)', 'center', 700, NUM_FONT, A.w);
      const groups = [...R.mine.melds, ...(R.mine.lone.length ? [R.mine.lone] : [])];
      const tw = 28, th = 40, gp = 10;
      let rows = [[]], rw = 0;
      for (const m of groups) { const w = m.length * (tw + 1) + gp; if (rw + w > A.w && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(m); rw += w; }
      let yy = y + 32;
      for (const row of rows) {
        const tot = row.reduce((a, m) => a + m.length * (tw + 1) + gp, -gp);
        let x = A.cx - tot / 2;
        for (const m of row) { m.forEach((id, i) => drawTile(ctx, id, S.d.okey, x + i * (tw + 1), yy, tw, th)); x += m.length * (tw + 1) + gp; }
        yy += th + 6;
      }
      y = yy + 8;
    }
    if (R.note) {
      ctx.font = `500 ${Math.round(22 * z)}px ${NUM_FONT}`;
      const ls = wrapLines(ctx, R.note, A.w).slice(0, Math.max(0, Math.min(4, Math.floor((P.y + P.h - 40 - (y + 14)) / (28 * z)))));
      ls.forEach((l, i) => txt(ctx, l, A.cx, y + 14 + i * 28 * z, 22 * z, 'rgba(247,239,216,0.85)', 'center', 500, NUM_FONT, A.w));
    }
    y = P.y + 50;
    // a thin divider between the columns
    ctx.strokeStyle = 'rgba(233,196,106,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(P.x + P.w - RESULT.colW, P.y + 40); ctx.lineTo(P.x + P.w - RESULT.colW, P.y + P.h - 40); ctx.stroke();
  }
  // score table
  const rowH = (two ? 50 : 54) * Math.min(z, 1.2);
  if (R.delta) {
    txt(ctx, S.prefs.terms === 'tr' ? 'El' : 'Deal', B.cx - B.w / 2 + B.w * 0.62, y + 8, 17, 'rgba(247,239,216,0.6)', 'center', 700);
    txt(ctx, S.prefs.terms === 'tr' ? 'Toplam' : 'Total', B.cx + B.w / 2 - 18, y + 8, 17, 'rgba(247,239,216,0.6)', 'right', 700);
    y += 22;
  }
  for (let s = 0; s < 4; s++) {
    const rr = { x: B.cx - B.w / 2, y: y + s * (rowH + 6), w: B.w, h: rowH };
    roundPath(ctx, rr.x, rr.y, rr.w, rr.h, 14); ctx.fillStyle = s === R.highlight ? 'rgba(255,226,138,0.2)' : 'rgba(0,0,0,0.25)'; ctx.fill();
    if (s === R.highlight) { ctx.lineWidth = 2; ctx.strokeStyle = '#ffe28a'; ctx.stroke(); }
    const fsz = Math.min(26 * z, rr.h * 0.6);
    txt(ctx, `${R.ranks ? `${R.ranks[s]}. ` : ''}${seatName(S, s)}`, rr.x + 16, rr.y + rr.h / 2, fsz, '#f7efd8', 'left', 700, NUM_FONT, rr.w * 0.42);
    if (R.delta) txt(ctx, `${R.delta[s] > 0 ? '+' : ''}${R.delta[s]}`, rr.x + rr.w * 0.62, rr.y + rr.h / 2, fsz, R.delta[s] >= 0 ? '#9dffc2' : '#ffb4a0', 'center', 800, NUM_FONT, rr.w * 0.2);
    txt(ctx, `${S.match.scores[s]}`, rr.x + rr.w - 18, rr.y + rr.h / 2, fsz * 1.05, '#ffe9a8', 'right', 800, NUM_FONT, rr.w * 0.2);
  }
  y += 4 * (rowH + 6);
  if (!two) {
    if (R.mine && z <= 1.2) {
      txt(ctx, `${S.prefs.terms === 'tr' ? 'Senin ıstakan' : 'Your rack'}: ${R.mine.inSets} / ${R.mine.total}`, B.cx, y + 16, 19, 'rgba(247,239,216,0.75)', 'center', 700, NUM_FONT, P.w - 80);
      const groups = [...R.mine.melds, ...(R.mine.lone.length ? [R.mine.lone] : [])];
      const tw = 28, th = 40, g = 10;
      const tot = groups.reduce((a, m) => a + m.length * (tw + 1) + g, -g);
      let x = B.cx - tot / 2;
      for (const m of groups) { m.forEach((id, i) => drawTile(ctx, id, S.d.okey, x + i * (tw + 1), y + 32, tw, th)); x += m.length * (tw + 1) + g; }
      y += 84;
    }
    if (R.note) {
      ctx.font = `500 ${Math.round(22 * z)}px ${NUM_FONT}`;
      // the note only shows where it has room above the buttons (it never runs over them)
      const room = Math.max(0, Math.floor((RESULT.secondary.y - 8 - (y + 8)) / (28 * z)));
      const ls = wrapLines(ctx, R.note, P.w - 80).slice(0, Math.min(4, room));
      ls.forEach((l, i) => txt(ctx, l, B.cx, y + 22 + i * 28 * z, 22 * z, 'rgba(247,239,216,0.85)', 'center', 500, NUM_FONT, P.w - 70));
    }
  }
  button(ctx, RESULT.primary, R.primary, { primary: true, size: 32, scale: Math.min(sc, 1.5) });
  button(ctx, RESULT.secondary, R.secondary, { size: 28, scale: Math.min(sc, 1.5) });
  // a quiet pointer to the rest of the collection, never in the way of the buttons
  drawMoreLine(ctx, two ? B.cx : P.x + P.w / 2, P.y + P.h - 14, 15);
}

function renderLimit(ctx, S) {
  drawTitleBg(ctx);
  const P = LAY.LIMIT.panel, cx = P.x + P.w / 2;
  roundPath(ctx, P.x, P.y, P.w, P.h, 30); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#e3b44c'; ctx.stroke();
  txt(ctx, L(S, 'limitTitle'), cx, P.y + 80, 40, '#ffe9a8', 'center', 700, DISPLAY, 520);
  ctx.font = `500 28px ${NUM_FONT}`;
  wrapLines(ctx, L(S, 'limitBody'), 500).forEach((l, i) => txt(ctx, l, cx, P.y + 160 + i * 40, 28, '#f7efd8', 'center', 500, NUM_FONT, 520));
  button(ctx, LIMIT_BTN, L(S, 'menu'), { primary: true, size: 32 });
}

// ---------------------------------------------------------------------------------------------------------------
export function render(ctx, S, V) {
  setTextFloor(Math.min(24, 11 / Math.max(0.25, host.px * ZOOM)));
  switch (S.scene) {
    case 'title': renderTitle(ctx, S); break;
    case 'settings': renderSettings(ctx, S); break;
    case 'howto': renderReader(ctx, S, 'howto'); break;
    case 'about': renderReader(ctx, S, 'about'); break;
    case 'rules': renderReader(ctx, S, 'rules'); break;
    case 'limit': renderLimit(ctx, S); break;
    case 'play': case 'demo': {
      const d = S.d;
      drawTable(ctx);
      drawHud(ctx, S);
      drawSeats(ctx, S);
      const myDraw = S.scene === 'play' && d.turn === 0 && d.phase === 'draw' && !S.over && S.ui === 'ready';
      const hintDraw = S.hint && S.hint.phase === 'draw';
      const hotStack = (myDraw && (!S.hint || S.hint.src === 'stack')) || (hintDraw && S.hint.src === 'stack');
      const hotTake = myDraw && d.piles[prevSeat(0)].length > 0 && (!S.hint || S.hint.src === 'pile');
      drawStack(ctx, S, myDraw && (!S.hint || S.hint.src === 'stack'));
      drawPiles(ctx, S, myDraw && d.piles[prevSeat(0)].length > 0 && (!S.hint || S.hint.src === 'pile'), !!(S.drag && S.drag.moved && d.phase === 'discard' && d.turn === 0) || !!(S.sel >= 0 && d.phase === 'discard' && d.turn === 0 && S.scene === 'play'));
      drawIndicator(ctx, S);
      drawRack(ctx, S, V);
      drawFlights(ctx, S);
      drawControls(ctx, S, V);
      if (S.scene === 'demo') { drawDemoBanner(ctx, S); drawDemoReveal(ctx, S); }
      if (S.toast) {
        const a = clamp01(Math.min(S.toast.t / 0.15, (S.toast.max - S.toast.t) / 0.3));
        ctx.save(); ctx.globalAlpha = a;
        ctx.font = `700 26px ${NUM_FONT}`;
        const w = Math.min(LAY.U.w - 40, 640, ctx.measureText(S.toast.text).width + 56);
        const ty = LAY.toastY - (1 - a) * 10;
        pill(ctx, LAY.cx - w / 2, ty, w, 48, 'rgba(0,0,0,0.74)', '#e3b44c');
        txt(ctx, S.toast.text, LAY.cx, ty + 25, 26, '#fff2c8', 'center', 700, NUM_FONT, w - 30);
        ctx.restore();
      }
      drawParticles(ctx, S);
      if (S.banner) {
        const b = S.banner, a = clamp01(Math.min(b.t / 0.2, (b.max - b.t) / 0.4));
        ctx.save(); ctx.globalAlpha = a; ctx.translate(LAY.cx, LAY.bannerY); ctx.scale(0.8 + 0.25 * ease(clamp01(b.t / 0.3)), 0.8 + 0.25 * ease(clamp01(b.t / 0.3)));
        ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 20;
        txt(ctx, b.text, 0, 0, 64, '#ffe9a8', 'center', 800, DISPLAY, Math.min(640, LAY.U.w - 60));
        ctx.restore();
      }
      if (S.over) drawResult(ctx, S);
      if (S.paused && S.scene === 'play') drawPause(ctx, S);
      if (S.scene === 'demo' && S.demo.finished && !S.over) { /* result handled via S.over */ }
      break;
    }
    default: renderTitle(ctx, S);
  }
}
