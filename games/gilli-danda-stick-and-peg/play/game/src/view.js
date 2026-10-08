// All drawing for screens and the in-play HUD. Reads `state`; the only thing it writes is state._ui (hit rectangles for the update step),
// which is non-enumerable so it never enters getState().
import { FIELDS, FIELD_KEYS, LEVELS, TEAMS, clamp, lerp, DEG, smooth, AIM_MAX, DANDA, HS, STRIKER_Z } from './core.js';
import { PAL, FONT, SANS, rr, textFill, wrapLines, glow, drawParticles } from './art.js';
import { TEXT_SCALES, drawButton, drawPill, panel, layoutColumn, drawColumn, maxScroll, scrollbar, inRect } from './ui.js';
import { LY, host } from './layout.js';
import { drawLockup, edgeStroke, drawMoreLine } from './brand.js';
import { ABOUT, HOWTO, RULES, CREDITS_FALLBACK } from './content.js';
import { penPos, tapScale, TAP_ZONES, idealPress, idealTime, gilliAt, gilliNow, strikeHeight } from './engine.js';
import { cameraFor, titleCam, project } from './cam.js';
import { drawGround } from './scene2d.js';

const hidden = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); };
function setUi(state, ui) { if (!('_ui' in state)) hidden(state, '_ui', ui); else state._ui = ui; }
export const scaleOf = (state) => TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)];
const txt = (n) => Math.max(n, LY.minText);
function fitFont(ctx, text, size, maxW, weight = 600, family = SANS, minSize = null) {
  const lo = minSize ?? Math.min(size, LY.minText);
  let sz = size; ctx.font = `${weight} ${sz}px ${family}`;
  while (sz > lo && ctx.measureText(text).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${family}`; }
  return sz;
}
const gradTitle = [[0, '#fff1b8'], [0.6, '#ffc83d'], [1, '#f08a1c']];

// ---- backgrounds ---------------------------------------------------------------------------------------------------------------
// When the 3D layer is live it paints the village behind the (transparent) canvas; otherwise the same ground is drawn in 2D here.
const live3d = (state) => !!(state.env && state.env.view3d && state.env.view3d.active);
export const wants3d = (scene) => ['play', 'auto', 'title', 'modes', 'setup', 'lineup', 'recap', 'results', 'demolimit'].includes(scene);

export function drawMenuBackdrop(ctx, state, t) {
  const VW = LY.w, VH = LY.h, sc = state.scene;
  const dim = sc === 'title' ? 0.05 : ['modes', 'setup', 'lineup', 'recap', 'results', 'demolimit'].includes(sc) ? 0.58 : 1;
  if (dim < 1 && live3d(state)) ctx.clearRect(0, 0, VW, VH);
  else {
    ctx.fillStyle = '#2a1812'; ctx.fillRect(0, 0, VW, VH);
    if (dim < 1) drawGround(ctx, VW, VH, titleCam(t, VW / VH), null, state.prefs.field, t);
  }
  if (dim > 0) { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, `rgba(30,14,8,${0.68 * dim + 0.12})`); g.addColorStop(1, `rgba(30,14,8,${0.8 * dim + 0.1})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
}

function drawGilli(ctx, x, y, len, ang, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, -len * 0.14, 0, len * 0.14); g.addColorStop(0, '#f4d89a'); g.addColorStop(1, '#b8823c');
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(60,30,8,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.quadraticCurveTo(-len * 0.24, -len * 0.15, 0, -len * 0.16); ctx.quadraticCurveTo(len * 0.24, -len * 0.15, len / 2, 0); ctx.quadraticCurveTo(len * 0.24, len * 0.15, 0, len * 0.16); ctx.quadraticCurveTo(-len * 0.24, len * 0.15, -len / 2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawDandaGlyph(ctx, x, y, len, ang, lw = 9) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(40,20,6,0.8)'; ctx.lineWidth = lw + 4; ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
  const g = ctx.createLinearGradient(0, -lw, 0, lw); g.addColorStop(0, '#e9c58a'); g.addColorStop(1, '#a9742f');
  ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
  ctx.restore();
}

function drawHero(ctx, w, h, state) {
  const t = state.t, cx = w / 2, th = Math.max(60, h - 34);
  let s1 = Math.min(w * 0.17, th * 0.3), s2 = Math.min(w * 0.095, th * 0.17);
  ctx.font = `700 ${s1}px ${FONT}`; const mw = ctx.measureText('GILLI-DANDA').width; if (mw > w - 20) { const k = (w - 20) / mw; s1 *= k; s2 *= Math.min(1, k * 1.1); }
  const base = Math.max(th * 0.3, s1 * 1.0);
  textFill(ctx, 'GILLI-DANDA', cx, base, s1, { grad: [[0, '#fff6cc'], [0.55, '#ffc83d'], [1, '#e8791a']], stroke: 'rgba(60,20,4,0.75)' });
  textFill(ctx, 'STICK AND PEG', cx, base + s2 * 1.45, s2, { grad: [[0, '#d9f6ee'], [0.6, '#6fd8bf'], [1, '#2fae8c']], stroke: 'rgba(4,40,30,0.7)' });
  if (state.env && state.env.view3d && state.env.view3d.active) { ctx.fillStyle = 'rgba(255,248,230,0.92)'; ctx.textAlign = 'center'; const tag0 = 'Tap it. Flip it. Strike it far.'; fitFont(ctx, tag0, Math.min(24, w * 0.036) * Math.min(scaleOf(state), 2.2), w - 40, 600, SANS, LY.minText); ctx.fillText(tag0, cx, h - 12); return; }
  // a peg flipping up and the stick coming round
  const u = (t * 0.5) % 1, gx = cx + Math.sin(u * 3.2) * w * 0.12, gy = h * 0.92 - Math.sin(Math.min(1, u * 1.15) * Math.PI) * h * 0.5;
  for (let i = 1; i < 8; i++) { const uu = Math.max(0, u - i * 0.015); glow(ctx, cx + Math.sin(uu * 3.2) * w * 0.12, h * 0.92 - Math.sin(Math.min(1, uu * 1.15) * Math.PI) * h * 0.5, 14 - i, 'rgba(255,230,160,A)', 0.4 - i * 0.04); }
  drawDandaGlyph(ctx, cx - w * 0.22, h * 0.9, w * 0.34, -0.12 - Math.max(0, Math.sin(u * 3.1)) * 0.5, Math.max(8, w * 0.016));
  drawGilli(ctx, gx, gy, Math.max(30, w * 0.085), t * 9);
  ctx.fillStyle = 'rgba(255,248,230,0.9)'; ctx.textAlign = 'center';
  const tag = 'Tap it. Flip it. Strike it far.', ts = scaleOf(state);
  fitFont(ctx, tag, Math.min(24, w * 0.036) * Math.min(ts, 2.2), w - 40, 600, SANS, LY.minText);
  ctx.fillText(tag, cx, h - 12);
}

function zoomPills(ctx, state) {
  const s = state.prefs.textIdx, z = LY.zoom;
  drawPill(ctx, z.dec, 'A−', { disabled: s === 0 });
  drawPill(ctx, z.inc, 'A+', { disabled: s === TEXT_SCALES.length - 1 });
  ctx.font = `600 ${Math.max(22, LY.minText)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,220,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(TEXT_SCALES[s] * 100)}%`, z.label.x, z.label.y);
}

function columnScreen(ctx, state, spec) {
  const s = scaleOf(state);
  drawMenuBackdrop(ctx, state, state.t);
  zoomPills(ctx, state);
  const col = spec.col ?? LY.col;
  if (spec.hero) { ctx.save(); ctx.translate(spec.hero.x, spec.hero.y); drawHero(ctx, spec.hero.w, spec.hero.h, state); ctx.restore(); }
  const fy = footerLayout(ctx, spec.footer ?? [], s, col);
  const lk = spec.lockup ? lockupBox(col) : null;
  const top = col.top, bottom = fy.top - 10 - (lk ? lk.h + 24 : 0);
  const view = { x: col.x, y: top, w: col.w, h: Math.max(80, bottom - top) };
  const gutter = 26, contentW = view.w - gutter;
  const lay = layoutColumn(ctx, spec.items, contentW, s, { cols: spec.cols ?? 1 });
  const maxS = maxScroll(lay, view.h);
  const sc = clamp(state.ui.scroll, 0, maxS);
  state.ui.scroll = sc;
  const hits = drawColumn(ctx, lay, { x: view.x, y: view.y, w: contentW, h: view.h }, sc, s, state, null);
  const bar = { x: view.x + view.w - 14, y: view.y, w: 10, h: view.h };
  const thumb = scrollbar(ctx, bar, sc, lay.total, view.h);
  for (const b of fy.buttons) drawButton(ctx, b.rect, b.label, { primary: b.primary, disabled: b.disabled, size: b.size, sub: b.sub, active: b.active });
  let lockTap = null;
  if (lk) {
    const ly = Math.min(view.y + Math.min(lay.total, view.h) + 12, bottom + 10);
    const lx = col.x + col.w / 2, m = 44 / Math.max(0.2, host.px || 0.54);
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(30,12,6,0.55)'; rr(ctx, lx - lk.w / 2 - 12, ly - 6, lk.w + 24, lk.h + 12, (lk.h + 12) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, lx, ly, lk.w, 1);
    const tw = Math.max(lk.w + 24, m), th = Math.max(lk.h + 12, m);
    lockTap = { x: lx - tw / 2, y: ly + lk.h + 6 - th, w: tw, h: th };
  }
  setUi(state, { lockTap, hits, footer: fy.buttons.filter((b) => !b.disabled).map((b) => ({ id: b.id, rect: b.rect })), view, lay, maxS, bar, thumb });
}
function lockupBox(col) { const w = clamp(col.w * 0.5, 240, LY.land || LY.h < 1200 ? 260 : 340); return { w, h: Math.round(w * 327 / 1200) }; }
function footerLayout(ctx, btns, s, col) {
  if (!btns.length) return { top: col.bottom + 6, buttons: [] };
  const gapx = 14, fx = col.x - 10, fw = col.w + 20;
  const stack = s >= 2 && btns.length > 1 && !LY.land;
  const size = 30 * (LY.land ? Math.min(s, 1.5) : Math.min(s, 2.2));
  const out = []; let top;
  ctx.font = `700 ${size}px ${FONT}`;
  if (stack) {
    const hs = btns.map((b) => Math.max(88, wrapLines(ctx, b.label, fw - 28).length * size * 1.2 + 44));
    const total = hs.reduce((a, b) => a + b + gapx, 0); top = col.bottom - total + gapx; let y = top;
    btns.forEach((b, i) => { out.push({ ...b, size, rect: { x: fx, y, w: fw, h: hs[i] } }); y += hs[i] + gapx; });
  } else {
    const n = btns.length, bw = (fw - gapx * (n - 1)) / n;
    const hs = btns.map((b) => Math.max(92, wrapLines(ctx, b.label, bw - 28).length * size * 1.2 + 44)); const hh = Math.max(...hs); top = col.bottom - hh;
    btns.forEach((b, i) => out.push({ ...b, size, rect: { x: fx + i * (bw + gapx), y: top, w: bw, h: hh } }));
  }
  return { top, buttons: out };
}
const readerCol = () => (LY.land ? { x: LY.readerX, w: LY.readerW, top: LY.col.top, bottom: LY.col.bottom } : LY.col);

// ---- scene specs ----------------------------------------------------------------------------------------------------------------
export function sceneSpec(state) {
  const s = scaleOf(state), pf = state.prefs, demo = state.env.config.demo;
  switch (state.scene) {
    case 'title': {
      const tight = !LY.land && LY.h < 1200 && s < 2, hf = {};
      let bh = LY.land ? 66 : LY.h < 1200 ? 60 : 84, heroH = s >= 2 ? 340 : tight ? 250 : LY.title.heroH;
      if (!LY.land && s < 2) {
        const c = LY.title.col, avail = c.bottom - c.top - lockupBox(c).h - 40;
        const need = (hh, fs) => hh + 4 * Math.max(bh, fs * 1.18 + 36) + 2 * Math.max(bh, fs * 1.18 + fs * 0.62 * 1.25 + 44) + 6 * 14;
        let fs = 31; if (need(heroH, fs) > avail) fs = 26;
        const ex = need(heroH, fs) - avail; if (ex > 0) heroH = Math.max(140, heroH - ex);
        if (fs < 31) hf.size = fs;
      }
      const items = [];
      if (!LY.land) items.push({ t: 'fig', h: Math.round(heroH), draw: (ctx, w, h) => drawHero(ctx, w, h, state) });
      items.push(
        { t: 'btn', id: 'play', label: 'Play', sub: 'Team match, distance challenge, daily', primary: true, h: bh, ...hf },
        { t: 'btn', id: 'auto', label: 'Auto Play', sub: 'Watch the computer play and learn', h: bh, ...hf },
        { t: 'btn', id: 'howto', label: 'How to Play', h: bh, ...hf },
        { t: 'btn', id: 'rules', label: 'Rules', h: bh, ...hf },
        { t: 'btn', id: 'about', label: 'About', h: bh, ...hf },
        { t: 'btn', id: 'settings', label: 'Settings', h: bh, ...hf });
      return { lockup: true, items, footer: [], col: LY.title.col, hero: LY.land ? LY.title.hero : null };
    }
    case 'modes': {
      const rec = state.records;
      const items = [
        { t: 'title', text: 'Choose a game', size: 40 },
        { t: 'card', id: 'mode:match', title: demo ? 'Team Match (app only)' : 'Team Match', text: 'Your village XI against a rival village. Three strikers each; a catch puts a striker out.', tag: `Wins ${rec.wins ?? 0}  |  Played ${rec.matches ?? 0}`, accent: PAL.gold },
        { t: 'card', id: 'mode:solo', title: 'Distance Challenge', text: 'One striker, six chances. Hit it as far as you can without being caught.', tag: `Best ${rec.bestTotal ?? 0} dandas  |  Longest hit ${rec.bestDl ?? 0}`, accent: PAL.teal },
        { t: 'card', id: 'mode:daily', title: demo ? 'Daily Challenge (app only)' : 'Daily Challenge', text: 'The same field and the same flips for everyone, today.', tag: rec.dailyDay === state.env.config.day ? `Today: ${rec.dailyScore ?? 0} dandas` : 'Not played today', accent: PAL.coral },
      ];
      return { items, footer: [{ id: 'back', label: 'Back' }], cols: 1, col: readerCol() };
    }
    case 'setup': {
      const su = state.setup, L = LEVELS[su.level];
      const items = [{ t: 'title', text: su.title, size: 38, sub: su.blurb }];
      items.push({ t: 'chips', id: 'level', label: 'Fielders', value: su.level, options: LEVELS.map((l, i) => ({ v: i, label: l.name })) });
      items.push({ t: 'para', text: L.blurb, color: PAL.peach });
      items.push({ t: 'chips', id: 'field', label: 'Ground', value: su.field, options: FIELD_KEYS.map((k) => ({ v: k, label: FIELDS[k].short, disabled: demo && k !== 'lamp' })) });
      items.push({ t: 'para', text: FIELDS[su.field].blurb });
      items.push({ t: 'para', text: `${['Relaxed', 'Standard', 'Sharp'][pf.assist]} timing (change it in Settings).` });
      return { items, footer: [{ id: 'back', label: 'Back' }, { id: 'start', label: su.mode === 'match' ? 'Choose teams' : 'Play', primary: true }] };
    }
    case 'lineup': {
      const m = state.match;
      const items = [
        { t: 'title', text: 'Team Match', size: 40, sub: `${m.teams[0].name} against ${m.teams[1].name}` },
        { t: 'fig', h: LY.land ? 250 : 330, draw: (ctx, w, h) => drawLineup(ctx, w, h, state) },
        { t: 'para', text: `${LEVELS[m.level].name} fielders on ${FIELDS[m.field].name}. Each side bats three strikers in turn; a striker gets up to three chances and is out when a fielder catches the gilli. The higher total of dandas wins.` },
        { t: 'para', text: m.inn === 0 ? `${m.teams[0].name} bat first. You play every chance for your side.` : `${m.teams[1].name} are in.`, color: PAL.peach },
      ];
      return { items, footer: [{ id: 'back', label: 'Menu' }, { id: 'next', label: 'Play ball', primary: true }], col: readerCol() };
    }
    case 'settings': {
      const items = [
        { t: 'title', text: 'Settings', size: 42 },
        { t: 'row', id: 'set:sound', label: 'Sound', value: pf.sound ? 'On' : 'Off' },
        { t: 'row', id: 'set:assist', label: 'Timing window', value: ['Relaxed', 'Standard', 'Sharp'][pf.assist] },
        { t: 'row', id: 'set:guide', label: 'Guide rings', value: pf.guide ? 'On' : 'Off' },
        { t: 'row', id: 'set:hand', label: 'Striker hand', value: pf.lefty ? 'Left-handed' : 'Right-handed' },
        { t: 'row', id: 'set:pad', label: 'Pad side (landscape)', value: pf.padLeft ? 'Left' : 'Right' },
        { t: 'row', id: 'set:think', label: 'Auto Play thinking time', value: `${[2, 5, 8, 10][pf.thinkIdx]} s` },
        { t: 'para', text: 'Tap a row to change it. Use A− and A+ at the top of any screen to change the text size from 100% to 300%.' },
        { t: 'btn', id: 'set:restore', label: 'Restore purchase' },
      ];
      if (state.env.config.dev) items.push({ t: 'btn', id: 'set:dev', label: 'Developer: unlock all' });
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }] };
    }
    case 'howto': case 'about': case 'rules': {
      const doc = state.scene === 'howto' ? HOWTO : state.scene === 'about' ? ABOUT : RULES;
      let items = doc.map((it) => (it.t === 'fig' ? { ...it, draw: (ctx, w, h) => drawFigure(ctx, it.key, w, h, state) } : it));
      if (state.scene === 'about') items = items.concat((state.env?.view3d?.credits ?? CREDITS_FALLBACK).map((text) => (text.startsWith('# ') ? { t: 'h', text: text.slice(2) } : { t: 'para', text })));
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }], col: readerCol() };
    }
    case 'recap': {
      const rc = state.recap;
      const items = [{ t: 'title', text: rc.headline, size: 44, sub: rc.sub }];
      for (const row of rc.rows) items.push({ t: 'stat', wide: true, label: row.label, value: row.value, color: row.color });
      if (rc.note) items.push({ t: 'para', text: rc.note, color: PAL.peach });
      return { items, footer: [{ id: 'next', label: rc.cta ?? 'Continue', primary: true }], col: readerCol() };
    }
    case 'results': {
      const rs = state.results;
      const items = [{ t: 'title', text: rs.headline, size: 46, sub: rs.sub }];
      for (const row of rs.rows) items.push({ t: 'stat', label: row.label, value: row.value, color: row.color });
      items.push({ t: 'gap', h: 10 }, { t: 'more' });
      const footer = [{ id: 'again', label: 'Play again', primary: true }, { id: 'menu', label: 'Menu' }];
      return { items, footer, col: readerCol() };
    }
    case 'demolimit': {
      const items = [
        { t: 'title', text: 'That was the free taste', size: 40 },
        { t: 'para', text: 'You have played the free challenges in this web preview. The full game, with Team Match, the daily challenge, all three grounds and unlimited play, is on iPhone and Android.' },
        { t: 'para', text: 'Auto Play is still free to watch.' },
      ];
      return { items, footer: [{ id: 'auto', label: 'Watch Auto Play' }, { id: 'menu', label: 'Menu', primary: true }] };
    }
    default: return { items: [], footer: [] };
  }
}

// ---- figures ----------------------------------------------------------------------------------------------------------------------
function person(ctx, x, y, hgt, top, cap) {
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, hgt * 0.22, hgt * 0.06, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#d9cfba'; rr(ctx, x - hgt * 0.1, y - hgt * 0.45, hgt * 0.2, hgt * 0.45, hgt * 0.06); ctx.fill();
  ctx.fillStyle = top; rr(ctx, x - hgt * 0.16, y - hgt * 0.8, hgt * 0.32, hgt * 0.42, hgt * 0.1); ctx.fill();
  ctx.fillStyle = '#9a6a48'; ctx.beginPath(); ctx.arc(x, y - hgt * 0.9, hgt * 0.1, 0, 7); ctx.fill();
  ctx.fillStyle = cap; ctx.beginPath(); ctx.arc(x, y - hgt * 0.93, hgt * 0.1, Math.PI, 0); ctx.fill();
  ctx.restore();
}

function drawLineup(ctx, w, h, state) {
  const m = state.match; ctx.save();
  const colW = (w - 16) / 2;
  m.teams.forEach((tm, ti) => {
    const x = ti * (colW + 16), tmDef = TEAMS.find((t) => t.key === tm.key) ?? TEAMS[0];
    ctx.fillStyle = 'rgba(64,36,28,0.88)'; rr(ctx, x, 0, colW, h, 20); ctx.fill();
    ctx.strokeStyle = ti === 0 ? PAL.gold : 'rgba(255,205,125,0.3)'; ctx.lineWidth = 2; rr(ctx, x, 0, colW, h, 20); ctx.stroke();
    ctx.fillStyle = tmDef.top; rr(ctx, x + 14, 14, 16, 36, 6); ctx.fill();
    const fs = fitFont(ctx, tm.name, txt(24), colW - 70, 700, FONT);
    ctx.font = `700 ${fs}px ${FONT}`; ctx.fillStyle = PAL.gold; ctx.textAlign = 'left'; ctx.fillText(tm.name, x + 42, 40);
    tm.strikers.forEach((st, i) => {
      const y = 62 + (h - 80) * (i + 0.5) / tm.strikers.length;
      person(ctx, x + 40, y + 24, Math.min(64, (h - 80) / 3.4), tmDef.top, tmDef.cap);
      const f2 = fitFont(ctx, st.name, txt(22), colW - 120, 600);
      ctx.font = `600 ${f2}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.fillText(st.name, x + 86, y + 8);
      if (m.lines[ti][i] != null) { ctx.fillStyle = PAL.teal; ctx.fillText(`${m.lines[ti][i]} dandas`, x + 86, y + 8 + f2 * 1.3); }
    });
  });
  ctx.restore();
}

function drawFigure(ctx, key, w, h, state) {
  ctx.save();
  if (key === 'field') {
    ctx.fillStyle = '#6e4f30'; rr(ctx, 0, 0, w, h, 18); ctx.fill();
    const cx = w / 2, by = h - 20, sc = (h - 40) / 40;
    ctx.fillStyle = 'rgba(255,220,160,0.12)'; ctx.beginPath(); ctx.moveTo(cx, by); for (let a = -AIM_MAX; a <= AIM_MAX; a += 4) ctx.lineTo(cx + Math.sin(a * DEG) * 42 * sc, by - Math.cos(a * DEG) * 42 * sc); ctx.closePath(); ctx.fill();
    const fl = [[-26, 16], [10, 26], [32, 38]];
    for (const [a, d] of fl) person(ctx, cx + Math.sin(a * DEG) * d * sc, by - Math.cos(a * DEG) * d * sc + 12, 34, '#2f78c8', '#e9eef6');
    ctx.setLineDash([8, 9]); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx + Math.sin(-8 * DEG) * 38 * sc, by - Math.cos(-8 * DEG) * 38 * sc); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#1f0f08'; ctx.beginPath(); ctx.ellipse(cx, by, 12, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = `600 ${txt(20)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('aim for the gap between fielders', cx, 30);
  } else if (key === 'tap') {
    const y = h / 2, x0 = 30, x1 = w - 30, z = 1; const mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x0, y - 20, x1 - x0, 40, 20); ctx.fill();
    for (const [k, col] of [['ok', '#e58a3a'], ['good', '#9ad06a'], ['perfect', '#ffd34d']]) { const d = TAP_ZONES[k] * z * half; ctx.fillStyle = col; rr(ctx, mid - d, y - 20, d * 2, 40, 14); ctx.fill(); }
    drawDandaGlyph(ctx, mid + half * 0.55, y, 70, Math.PI / 2 + 0.2, 10);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${txt(20)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('press at the gold', mid, y - 36); ctx.fillText('ok', mid - half * 0.4, y + 56); ctx.fillText('good', mid - half * 0.2, y + 56); ctx.fillText('perfect', mid, y + 56);
  } else if (key === 'swing') {
    const cx = w / 2, cy = h / 2, R0 = Math.min(h * 0.22, 50);
    ctx.fillStyle = 'rgba(64,36,28,0.7)'; rr(ctx, 0, 0, w, h, 18); ctx.fill();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 4; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.arc(cx, cy, R0 * 1.9, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${txt(20)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('press when the ring closes', cx, 28);
  }
  void state; ctx.restore();
}

// ---- in-play HUD ---------------------------------------------------------------------------------------------------------------------
function drawHud(ctx, state) {
  const r = state.r, hud = LY.hud, zs = Math.min(scaleOf(state), 2);
  panel(ctx, { x: hud.x, y: hud.y, w: hud.w, h: hud.h }, { radius: 22, top: 'rgba(50,26,20,0.86)', bottom: 'rgba(30,15,12,0.86)' });
  edgeStroke(ctx, { x: hud.x, y: hud.y, w: hud.w, h: hud.h }, 22, 0.5);
  const pad = 18, mw = hud.textMaxW, compact = hud.h < 100;
  ctx.textBaseline = 'alphabetic';
  const lab = `${r.label} · ${r.striker.name}`;
  const f1 = fitFont(ctx, lab, txt(20) * zs, compact ? mw * 0.62 : mw, 600); ctx.font = `600 ${f1}px ${SANS}`; ctx.fillStyle = 'rgba(255,230,180,0.92)'; ctx.textAlign = 'left'; ctx.fillText(lab, hud.x + pad, hud.y + 8 + f1);
  const big = Math.min(58, hud.h * (compact ? 0.42 : 0.44)) * Math.min(zs, 1.3);
  const by = compact ? hud.y + hud.h - 12 : hud.y + 18 + f1 + big * 0.82;
  textFill(ctx, String(r.score), hud.x + pad, by, big, { align: 'left', grad: gradTitle, stroke: 'rgba(60,20,4,0.5)' });
  ctx.font = `700 ${big}px ${FONT}`; const sw = ctx.measureText(String(r.score)).width;
  const shown = Math.min(r.n + (['ready', 'tap'].includes(r.phase) ? 1 : 0), r.chances);
  const info = `dandas   chance ${Math.max(1, shown)} of ${r.chances}`;
  const f2 = fitFont(ctx, info, txt(20) * zs, mw - sw - 20, 600); ctx.font = `600 ${f2}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.fillText(info, hud.x + pad + sw + 10, by);
  if (!compact) {
    const sub = state.match ? `${state.match.teams[0].name} ${state.match.totals[0]}  |  ${state.match.teams[1].name} ${state.match.totals[1]}` : `Best hit ${r.best} dandas`;
    const f3 = fitFont(ctx, sub, txt(18) * zs, mw, 500); ctx.font = `500 ${f3}px ${SANS}`; ctx.fillStyle = 'rgba(255,230,180,0.78)'; ctx.fillText(sub, hud.x + pad, hud.y + hud.h - 12);
  }
  drawPill(ctx, LY.pause, state.paused ? '▶' : 'II', { size: 28 });
  drawPill(ctx, LY.think, '?', { size: 32, disabled: r.hints <= 0 || !['ready', 'tap'].includes(r.phase) || state.scene === 'auto' || !!r.bot });
  ctx.font = `700 ${txt(14)}px ${SANS}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center'; ctx.fillText(String(r.hints), LY.think.x + LY.think.w - 8, LY.think.y + LY.think.h + 14);
  ctx.textBaseline = 'alphabetic';
}

const AIMTOP = 1;
function groundPts(cam, az, d0, d1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const d = lerp(d0, d1, i / n), a = az * AIM_MAX * DEG; const p = project(cam, LY.w, LY.h, [Math.sin(a) * d, 0.06, Math.cos(a) * d], {}); if (p.ok) out.push(p); }
  return out;
}
function drawAim(ctx, state, cam) {
  const r = state.r;
  if (!['ready', 'tap', 'flip', 'swing'].includes(r.phase) || r.bot || state.scene === 'result') return;
  const pts = groundPts(cam, r.az, 0.6, 18, 24);
  if (pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 9; ctx.setLineDash([2, 18]); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x + 2, p.y + 3) : ctx.moveTo(p.x + 2, p.y + 3))); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 7; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.setLineDash([]);
  const e = pts[pts.length - 1], q = pts[pts.length - 3] ?? pts[0];
  const ang = Math.atan2(e.y - q.y, e.x - q.x);
  ctx.translate(e.x, e.y); ctx.rotate(ang); ctx.fillStyle = 'rgba(255,214,90,0.97)'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill();
  ctx.restore();
  // the hint's suggested direction
  const hz = state.think.az;
  if (hz != null && ['ready', 'tap'].includes(r.phase)) {
    const hp = groundPts(cam, hz, 20, 20.1, 1)[0];
    if (hp) { ctx.save(); ctx.translate(hp.x, hp.y); const pulse = 1 + 0.12 * Math.sin(state.t * 6); ctx.scale(pulse, pulse); ctx.fillStyle = 'rgba(80,230,190,0.95)'; ctx.strokeStyle = 'rgba(0,50,40,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? 11 : 24; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  void AIMTOP;
}

// the ring in the air where the danda meets the gilli
function drawStrikeRing(ctx, state, cam) {
  const r = state.r;
  if (!state.prefs.guide || r.phase !== 'flip' || !r.flip || r.sw) return;
  const fl = r.flip, t = idealTime(fl), g = gilliAt(fl, t), hs = strikeHeight(fl);
  const p = project(cam, LY.w, LY.h, [g.x, hs, g.z], {});
  if (!p.ok) return;
  const R = Math.max(18, 0.2 * p.k), pulse = 1 + 0.06 * Math.sin(state.t * 10);
  ctx.save(); ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(p.x, p.y, R * pulse, R * 0.9 * pulse, 0, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, R * 1.3, R * 1.17, 0, 0, 7); ctx.stroke();
  ctx.restore();
}

// the action pad: pendulum while tapping, closing ring while the gilli falls
function drawPad(ctx, state) {
  const r = state.r, P = LY.pad, zs = Math.min(scaleOf(state), 1.6);
  const live = state.scene === 'play' && !r.bot;
  const pressed = state.touch.pad;
  const on = live && (r.phase === 'tap' || r.phase === 'flip');
  ctx.save();
  ctx.shadowColor = 'rgba(20,8,4,0.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  rr(ctx, P.x, P.y + (pressed ? 2 : 0), P.w, P.h, 30);
  const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h);
  g.addColorStop(0, on ? 'rgba(122,70,40,0.95)' : 'rgba(70,40,30,0.88)'); g.addColorStop(1, on ? 'rgba(80,42,26,0.96)' : 'rgba(40,22,18,0.9)');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 3; ctx.strokeStyle = on ? 'rgba(255,214,110,0.95)' : 'rgba(255,205,125,0.3)'; ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = P.x + P.w / 2, ty = P.y + Math.min(40, P.h * 0.17);
  const head = r.phase === 'tap' ? 'TAP' : r.phase === 'flip' ? 'SWING' : r.phase === 'ready' ? 'GET READY' : r.phase === 'swing' ? 'SWING' : r.phase === 'fly' ? 'WATCH' : r.phase === 'result' ? 'NEXT' : 'DONE';
  textFill(ctx, head, cx, ty + 8, Math.min(40, P.h * 0.17) * Math.min(zs, 1.2), { color: on ? '#ffe9a8' : 'rgba(255,240,210,0.6)', stroke: 'rgba(40,16,4,0.6)', shadow: false });
  if (r.phase === 'tap' || (r.phase === 'ready' && state.prefs.guide)) {
    const bw = P.w - 64, bx = P.x + 32, by = P.y + P.h * 0.5, bh = Math.min(46, P.h * 0.2), z = tapScale(r);
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; rr(ctx, bx, by - bh / 2, bw, bh, bh / 2); ctx.fill();
    for (const [k, col] of [['ok', '#e58a3a'], ['good', '#9ad06a'], ['perfect', '#ffd34d']]) { const d = Math.min(1, TAP_ZONES[k] * z) * bw / 2; ctx.fillStyle = col; ctx.globalAlpha = r.phase === 'tap' ? 1 : 0.55; rr(ctx, bx + bw / 2 - d, by - bh / 2, d * 2, bh, bh / 2.4); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(40,16,4,0.5)'; ctx.fillRect(bx + bw / 2 - 1.5, by - bh / 2 - 6, 3, bh + 12);
    if (r.phase === 'tap') {
      const pos = penPos(r), kx = bx + bw / 2 + pos * (bw / 2 - 6), a = pos * 0.5;
      drawDandaGlyph(ctx, kx, by, bh * 2.2, Math.PI / 2 + a, Math.max(8, bh * 0.28));
    } else drawDandaGlyph(ctx, bx + bw / 2 + bw * 0.4, by, bh * 2.2, Math.PI / 2 + 0.2, Math.max(8, bh * 0.28));
    ctx.font = `600 ${txt(18)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.fillText(r.phase === 'tap' ? 'press when the danda is in the gold' : 'the danda swings over the peg', cx, P.y + P.h - Math.min(26, P.h * 0.12));
  } else if (r.phase === 'flip' || r.phase === 'swing') {
    const cy = P.y + P.h * 0.57, R0 = Math.min(P.h * 0.17, 52), maxR = Math.min(P.h * 0.4, 112);
    const tp = idealPress(r.flip), K = (maxR - R0) / 1.0, left = tp - r.fp;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 11; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 7); ctx.stroke();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, 7); ctx.stroke();
    if (state.prefs.guide || r.phase === 'swing') {
      const rad = R0 + Math.max(-0.35, left) * K, a = left < -0.1 ? clamp(1 + (left + 0.1) / 0.25, 0, 1) : 1;
      ctx.globalAlpha = a; ctx.strokeStyle = Math.abs(left) < 0.05 ? '#fff6c0' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, Math.min(rad, maxR * 1.05)), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.font = `600 ${txt(18)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.fillText(r.phase === 'swing' ? 'swinging...' : 'press as the ring closes', cx, P.y + P.h - Math.min(22, P.h * 0.1));
  } else if (r.phase === 'result' && r.res) {
    ctx.font = `600 ${txt(20)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.75)'; ctx.fillText('tap to continue', cx, P.y + P.h * 0.62);
  } else if (r.phase === 'fly') {
    ctx.font = `600 ${txt(20)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.7)'; ctx.fillText('the fielders are running...', cx, P.y + P.h * 0.62);
  }
  ctx.restore();
}

// the field map: a fan seen from above with the striker at its point: fielders, your aim, earlier hits, the gilli while it flies
function drawFan(ctx, state) {
  const r = state.r, F = LY.fan;
  const ax = F.x + F.w / 2, ay = F.y + F.h - 10, SPAN = 52 * DEG, MAXM = 34;
  const R = Math.min(F.h - 22, (F.w - 18) / (2 * Math.sin(SPAN)));
  const px = (x, z) => [ax + (x / MAXM) * R, ay - (z / MAXM) * R];
  ctx.save();
  // the sector
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, R, -Math.PI / 2 - SPAN, -Math.PI / 2 + SPAN); ctx.closePath();
  const g = ctx.createRadialGradient(ax, ay, 4, ax, ay, R); g.addColorStop(0, 'rgba(30,14,8,0.72)'); g.addColorStop(1, 'rgba(60,34,22,0.5)');
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,205,125,0.45)'; ctx.lineWidth = 2; ctx.stroke(); ctx.clip();
  // the aim wedge
  const aimA = r.az * AIM_MAX * DEG;
  if (!r.bot && ['ready', 'tap', 'flip'].includes(r.phase)) {
    ctx.fillStyle = 'rgba(255,214,90,0.13)'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, R, -Math.PI / 2 + aimA - 0.12, -Math.PI / 2 + aimA + 0.12); ctx.closePath(); ctx.fill();
  }
  // range rings
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,230,190,0.22)'; ctx.font = `600 ${Math.max(LY.minText * 0.8, 12)}px ${SANS}`; ctx.fillStyle = 'rgba(255,230,190,0.55)'; ctx.textAlign = 'center';
  for (const m of [10, 20, 30]) { ctx.beginPath(); ctx.arc(ax, ay, (m / MAXM) * R, -Math.PI / 2 - SPAN, -Math.PI / 2 + SPAN); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.font = `600 ${Math.max(LY.minText * 0.8, 12)}px ${SANS}`; ctx.fillStyle = 'rgba(255,230,190,0.6)'; ctx.textAlign = 'left';
  for (const m of [10, 30]) { const [tx, ty] = px(Math.sin(-SPAN * 0.9) * m, Math.cos(-SPAN * 0.9) * m); ctx.fillText(`${m} m`, tx + 3, ty + 4); }
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, R, -Math.PI / 2 - SPAN, -Math.PI / 2 + SPAN); ctx.closePath(); ctx.clip();
  // earlier hits
  for (const h of r.hits.slice(-6)) { if (h.x == null) continue; const [hx, hy] = px(h.x, h.z); ctx.strokeStyle = h.caught ? 'rgba(255,120,100,0.9)' : 'rgba(255,214,90,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - 5, hy - 5); ctx.lineTo(hx + 5, hy + 5); ctx.moveTo(hx + 5, hy - 5); ctx.lineTo(hx - 5, hy + 5); ctx.stroke(); }
  // aim line
  if (!r.bot && ['ready', 'tap', 'flip', 'swing'].includes(r.phase)) {
    const a = r.sw ? r.sw.az * AIM_MAX * DEG : aimA;
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4; ctx.setLineDash([2, 8]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.sin(a) * R, ay - Math.cos(a) * R); ctx.stroke(); ctx.setLineDash([]);
  }
  if (state.think.az != null && ['ready', 'tap'].includes(r.phase)) {
    const a = state.think.az * AIM_MAX * DEG, sx = ax + Math.sin(a) * R * 0.72, sy = ay - Math.cos(a) * R * 0.72, pulse = 1 + 0.12 * Math.sin(state.t * 6);
    ctx.fillStyle = 'rgba(80,230,190,0.95)'; ctx.strokeStyle = 'rgba(0,50,40,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 10; i++) { const q = -Math.PI / 2 + i * Math.PI / 5, rad = (i % 2 ? 6 : 13) * pulse; ctx.lineTo(sx + Math.cos(q) * rad, sy + Math.sin(q) * rad); } ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // fielders
  const fa = r.fly && r.fly.caught ? r.fly.caught.i : -1;
  r.fielders.forEach((f, i) => {
    const [fx, fy] = px(f.x, f.z);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(fx + 1, fy + 2, 8, 0, 7); ctx.fill();
    ctx.fillStyle = i === fa ? '#ff8a6a' : '#7fb8ff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 7.5, 0, 7); ctx.fill(); ctx.stroke();
  });
  // the gilli on the map
  const gl = gilliNow(r);
  if (gl && (r.phase === 'fly' || r.phase === 'result')) { const [gx, gy] = px(gl.x, gl.z); ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(gx, gy, 5, 0, 7); ctx.fill(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
  // the striker at the point
  ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(40,16,4,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  void lerp; void FIELDS;
}

function drawBanner(ctx, state) {
  const r = state.r, res = r.res;
  if (r.phase === 'flip' && r.tap && r.fp < 0.9 && r.tap.kind) {
    const a = clamp(1 - r.fp / 0.9, 0, 1), col = { perfect: '#ffd34d', good: '#9ad06a', ok: '#e58a3a' }[r.tap.kind] ?? '#fff';
    ctx.save(); ctx.globalAlpha = a; textFill(ctx, r.tap.kind.toUpperCase(), LY.cx, LY.callY, 54, { color: col, stroke: 'rgba(40,16,4,0.75)' }); ctx.restore();
  }
  if (!res || r.phase !== 'result') return;
  const k = smooth(r.pt / 0.22), y = LY.callY;
  const size = (res.kind === 'hit' ? 84 : 58) * Math.min(1, LY.w / 520) * (0.7 + 0.3 * k);
  const bad = res.kind !== 'hit';
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5);
  let text = res.text;
  if (res.kind === 'hit') { const c = clamp(r.pt / 1.1, 0, 1); text = `${Math.floor(res.dl * smooth(c))} dandas`; }
  textFill(ctx, text, LY.cx, y, size, { grad: bad ? [[0, '#ffe9e0'], [1, '#e8806a']] : [[0, '#fff3a8'], [1, '#ff9d2b']], stroke: 'rgba(40,16,10,0.75)' });
  textFill(ctx, res.sub, LY.cx, y + size * 0.5, Math.max(txt(26), size * 0.34), { color: bad ? '#ffd9cf' : '#fff4dc' });
  ctx.restore();
}

function drawLandMark(ctx, state, cam) {
  const r = state.r;
  if (!['result'].includes(r.phase) || !r.fly || r.fly.caught || r.pt > 2) return;
  const a = project(cam, LY.w, LY.h, [0, 0.05, 0], {}), b = project(cam, LY.w, LY.h, [r.fly.land.x, 0.05, r.fly.land.z], {});
  if (!a.ok || !b.ok) return;
  const k = smooth(r.pt / 0.5);
  ctx.save(); ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 4; ctx.setLineDash([3, 10]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(lerp(a.x, b.x, k), lerp(a.y, b.y, k)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(b.x, b.y, 11 * k, 0, 7); ctx.fill();
  ctx.restore();
}

function drawHints(ctx, state) {
  const r = state.r; if (state.scene !== 'play' || r.bot) return;
  let msg = null;
  if (r.phase === 'ready' || r.phase === 'tap') msg = state.prefs.coach < 4 ? (r.phase === 'tap' ? 'Press the pad when the danda is in the gold!' : 'Drag to aim. Then press the pad.') : null;
  else if (r.phase === 'flip' && !r.sw && state.prefs.coach < 3) msg = 'Press as the ring closes!';
  if (msg) { ctx.font = `600 ${txt(22)}px ${SANS}`; const w = ctx.measureText(msg).width + 36; ctx.fillStyle = 'rgba(30,14,8,0.66)'; rr(ctx, LY.cx - w / 2, LY.hintY - 50, w, 44, 22); ctx.fill(); ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, LY.cx, LY.hintY - 28); ctx.textBaseline = 'alphabetic'; }
}

function drawThink(ctx, state) {
  const th = state.think, TC = LY.thinkCard, zs = Math.min(scaleOf(state), 2);
  const maxH = TC.bottom - (LY.U.y0 + LY.hud.h + 30);
  let fs = 25 * zs, wrapped; const textW = TC.w - 52;
  for (;;) { ctx.font = `500 ${fs}px ${SANS}`; wrapped = th.lines.map((l) => wrapLines(ctx, l, textW)); const n = wrapped.reduce((a, w) => a + w.length, 0); const need = 96 + n * fs * 1.32 + wrapped.length * 8; if (need <= maxH || fs <= LY.minText) { wrapped.need = need; break; } fs -= 1; }
  const r = { x: TC.x, y: Math.min(TC.bottom - (LY.land ? 250 : 330), TC.bottom - wrapped.need - 10), w: TC.w, h: 0 };
  r.h = TC.btn.y + TC.btn.h + 20 - r.y;
  ctx.fillStyle = 'rgba(20,8,4,0.45)'; ctx.fillRect(0, 0, LY.w, LY.h);
  panel(ctx, r, { radius: 30 });
  textFill(ctx, 'THINK', LY.cx, r.y + 52, 38, { grad: [[0, '#d4fff2'], [1, '#35c4a4']], stroke: 'rgba(0,40,40,0.5)' });
  ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = r.y + 100 + fs * 0.2; for (const ws of wrapped) { for (const l of ws) { ctx.fillText(l, r.x + 24, y); y += fs * 1.32; } y += 8; }
  drawButton(ctx, TC.btn, 'Got it', { primary: true, size: 30 });
}

function drawPauseMenu(ctx, state) {
  const P = LY.pauseMenu; ctx.fillStyle = 'rgba(20,8,4,0.74)'; ctx.fillRect(0, 0, LY.w, LY.h);
  textFill(ctx, 'Paused', LY.cx, P.titleY, 66, { grad: gradTitle, stroke: 'rgba(60,20,4,0.5)' });
  const fs = 30 * Math.min(Math.min(scaleOf(state), 2), 1.5);
  drawButton(ctx, P.resume, 'Resume', { primary: true, size: fs });
  drawButton(ctx, P.sound, state.prefs.sound ? 'Sound: On' : 'Sound: Off', { size: fs });
  drawButton(ctx, P.quit, 'Quit to menu', { danger: true, size: fs });
}

function drawAutoPanel(ctx, state) {
  const a = state.auto, A = LY.auto;
  drawButton(ctx, A.pause, state.paused ? 'RESUME' : 'PAUSE', { primary: state.paused, size: 28 });
  drawButton(ctx, A.speed, `Speed x${a.speed}`, { size: 24 });
  drawButton(ctx, A.exit, 'Exit', { size: 24 });
  drawButton(ctx, A.dec, '−', { size: 32 }); drawButton(ctx, A.inc, '+', { size: 32 });
  ctx.font = `600 ${txt(18)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`think ${[2, 5, 8, 10][state.prefs.thinkIdx]} s`, A.thinkLbl.x, A.thinkLbl.y);
  const lines = a.lines; let cardTop = null;
  if (lines.length) {
    const phaseName = a.revealing ? 'REVEAL' : a.phase === 'think' ? 'THINK' : 'ACT';
    const phaseCol = a.revealing ? PAL.gold : a.phase === 'think' ? PAL.teal : '#fff';
    const C = A.card, r = { x: C.x, y: 0, w: C.w, h: 0 }, zs = Math.min(scaleOf(state), 2);
    let fs = 21 * zs, wrapped; const maxH = C.bottom - (LY.hud.y + LY.hud.h + 20);
    for (;;) { ctx.font = `500 ${fs}px ${SANS}`; wrapped = []; for (const l of lines) wrapped.push(...wrapLines(ctx, l, C.w - 44)); if (58 + wrapped.length * fs * 1.33 + 14 <= maxH || fs <= LY.minText) break; fs -= 1; }
    r.h = 58 + wrapped.length * fs * 1.33 + 14; r.y = C.bottom - r.h; cardTop = r.y;
    panel(ctx, r, { radius: 22, top: 'rgba(40,18,14,0.88)', bottom: 'rgba(30,14,10,0.84)' });
    textFill(ctx, phaseName, r.x + 22, r.y + 42, 28, { align: 'left', color: phaseCol, weight: 700 });
    const frac = a.total > 0 ? clamp(1 - a.timer / a.total, 0, 1) : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, r.x + 150, r.y + 28, r.w - 180, 10, 5); ctx.fill();
    ctx.fillStyle = phaseCol; rr(ctx, r.x + 150, r.y + 28, (r.w - 180) * frac, 10, 5); ctx.fill();
    ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; let y = r.y + 58 + fs * 1.05;
    for (const l of wrapped) { ctx.fillText(l, r.x + 22, y); y += fs * 1.33; }
  }
  if (state.paused) textFill(ctx, 'PAUSED', LY.cx, cardTop != null ? Math.max(LY.hud.y + LY.hud.h + 110, Math.min(A.pausedY, cardTop - 24)) : A.pausedY, 56, { color: '#fff', stroke: 'rgba(40,10,10,0.7)' });
}

function drawBotPanel(ctx, state) {
  const P = LY.pad, r = state.r;
  panel(ctx, P, { radius: 30, top: 'rgba(50,26,20,0.86)', bottom: 'rgba(30,15,12,0.88)' });
  textFill(ctx, r.striker.name.toUpperCase(), P.x + P.w / 2, P.y + 52, Math.min(40, P.h * 0.17), { color: '#ffe9a8', stroke: 'rgba(40,16,4,0.6)', shadow: false });
  ctx.font = `500 ${txt(20)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${state.match ? state.match.teams[1].name : 'Rival'} are batting`, P.x + P.w / 2, P.y + 52 + 34);
  drawButton(ctx, LY.skip, state.fast ? 'Normal speed' : 'Fast forward', { size: 26 });
}

function drawEnd(ctx, state) {
  const r = state.r; if (r.phase !== 'end') return;
  ctx.fillStyle = `rgba(30,14,8,${0.55 * smooth(r.pt / 0.4)})`; ctx.fillRect(0, 0, LY.w, LY.h);
  textFill(ctx, 'INNINGS OVER', LY.cx, LY.h * 0.42, 64 * Math.min(1, LY.w / 600), { grad: gradTitle, stroke: 'rgba(60,20,4,0.6)' });
  textFill(ctx, `${r.score} dandas`, LY.cx, LY.h * 0.42 + 60, txt(34), { color: '#fff4dc' });
}

export function renderPlay(ctx, state) {
  const r = state.r, v = state.v, aspect = LY.w / LY.h;
  const cam = (state.env && state.env.view3d && state.env.view3d.active && state.env.view3d.cam) || cameraFor(r, aspect);
  if (live3d(state)) ctx.clearRect(0, 0, LY.w, LY.h);
  else { ctx.fillStyle = '#2a1812'; ctx.fillRect(0, 0, LY.w, LY.h); drawGround(ctx, LY.w, LY.h, cam, r, r.field, state.t); }
  if (v.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${v.flash * 0.3})`; ctx.fillRect(0, 0, LY.w, LY.h); }
  if (v.cut > 0.01) { ctx.fillStyle = `rgba(30,14,8,${clamp(v.cut, 0, 1)})`; ctx.fillRect(0, 0, LY.w, LY.h); }
  drawAim(ctx, state, cam); drawStrikeRing(ctx, state, cam); drawLandMark(ctx, state, cam);
  drawParticles(ctx, v.parts);
  drawBanner(ctx, state);
  drawHud(ctx, state); drawHints(ctx, state);
  if (state.scene === 'auto') { drawFan(ctx, state); drawAutoPanel(ctx, state); }
  else if (r.bot) { drawFan(ctx, state); drawBotPanel(ctx, state); }
  else { drawFan(ctx, state); drawPad(ctx, state); }
  if (r.phase === 'end') drawEnd(ctx, state);
  if (state.think.open) drawThink(ctx, state);
  if (state.paused && state.scene === 'play') drawPauseMenu(ctx, state);
}

export function renderScene(ctx, state) {
  const sc = state.scene;
  if (sc === 'play' || sc === 'auto') { renderPlay(ctx, state); return; }
  columnScreen(ctx, state, sceneSpec(state));
}
export { gilliNow, HS, STRIKER_Z, DANDA, drawMoreLine };
