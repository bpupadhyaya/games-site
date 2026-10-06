// All drawing for every scene. Pure: reads `state`, never mutates game state (the one exception is the
// derived reference-page count, cached on state so game.js can bound the Next button).
import { TEXT_SCALES, THINK_STEPS, SETUP_KEYS, DUO_SETUP_KEYS, tablaGeom, cellRect, host } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import {
  THEMES, ptr, fontFloor, themeOf, THEME_IDS, drawBackdrop, drawCard, drawArt, drawTabla, drawMini, drawPatternThumb, drawParticles, drawBean, drawButton, roundPath, font, fitPx, fitText, wrapLines, easeOutBack, easeOutCubic, clamp01, drawFrame,
} from './art.js';
import { CARDS } from './cards.js';
import { PATTERNS, PACES, SKILLS, STYLES, CPU_NAMES, byId, needed, bestSet, isComplete, impossible, markable, setsOf, patternOf, POOL, CLASSIC_REVEAL_SECS, SCORE, HINTS_PER_ROUND } from './rules.js';
import { t as tr } from './strings.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { INK } from './shapes.js';

const PI2 = Math.PI * 2;

// Everything except the three play screens is a DESIGN screen: drawn at design size inside L.d's translate + scale.
export function render(ctx, state, pointer, L) {
  const th = themeOf(state.theme), sc = state.scene;
  const play = sc === 'play' || sc === 'duo' || sc === 'auto';
  const garland = sc === 'menu' || sc === 'demolimit' ? 'full' : play || sc === 'caller' ? 'none' : 'thin';
  drawBackdrop(ctx, th, state.t, { garland, w: L.w, h: L.h });
  const px = host.px || 0.6;
  if (play) {
    setPtr(pointer, null); fontFloor.u = clamp(11 / px, 10, 26);
    if (sc === 'duo') renderDuo(ctx, state, th, L); else renderPlay(ctx, state, th, L);
  } else {
    withDesign(ctx, L, pointer, (d) => {
      if (sc === 'menu') renderMenu(ctx, state, th, L, d);
      else if (sc === 'setup') renderSetup(ctx, state, th, L, d);
      else if (sc === 'pick') renderPick(ctx, state, th, d);
      else if (sc === 'caller') renderCaller(ctx, state, th, d);
      else if (sc === 'about') renderPage(ctx, state, th, ABOUT[state.lang === 'es' ? 'es' : 'en'], 'about', d);
      else if (sc === 'howto') renderPage(ctx, state, th, HOWTO[state.lang === 'es' ? 'es' : 'en'], 'howto', d);
      else if (sc === 'rules') renderPage(ctx, state, th, RULES[state.lang === 'es' ? 'es' : 'en'], 'rules', d);
      else if (sc === 'settings') renderSettings(ctx, state, th, d);
      else if (sc === 'demolimit') renderDemoLimit(ctx, state, th, d);
    });
  }
  drawParticles(ctx, state.parts);
}
function setPtr(pointer, d) {
  if (!pointer) { ptr.down = false; return; }
  ptr.down = pointer.down;
  if (d) { const q = d.to(pointer.x, pointer.y); ptr.x = q.x; ptr.y = q.y; } else { ptr.x = pointer.x; ptr.y = pointer.y; }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let curPointer = null;
function withDesign(ctx, L, pointer, fn) {
  const d = L.d; curPointer = pointer;
  ctx.save(); ctx.translate(d.dx, d.dy); ctx.scale(d.k, d.k);
  setPtr(pointer, d); fontFloor.u = clamp(11 / ((host.px || 0.6) * d.k), 10, 26);
  fn(d);
  ctx.restore(); setPtr(pointer, null);
}

// ---- small helpers -------------------------------------------------------------------------------------------
const L_ = (s) => s.lang;
const scaleOf = (s) => TEXT_SCALES[s.textIdx] ?? 1;
function text(ctx, str, x, y, px, o = {}) {
  ctx.save();
  ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = o.color ?? '#fff';
  if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; }
  const fl = fontFloor.u; px = Math.max(px, fl);
  const s = o.maxW ? fitPx(ctx, str, o.maxW, px, o.weight ?? 700, o.italic, o.min ?? fl) : px;
  ctx.font = font(s, o.weight ?? 700, o.italic);
  if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillText(str, x, y);
  ctx.restore();
  return s;
}
function panel(ctx, r, th, rad = 22, a = 1) {
  ctx.save(); ctx.globalAlpha = a;
  roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = th.panel; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke(); ctx.restore();
}
function cardBack(ctx, x, y, w, h, th, t = 0) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  roundPath(ctx, x, y, w, h, w * 0.085); ctx.fillStyle = th.paper; ctx.fill(); ctx.shadowColor = 'transparent';
  const p = w * 0.06; roundPath(ctx, x + p, y + p, w - p * 2, h - p * 2, w * 0.06);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, th.frame[0]); g.addColorStop(1, th.frame[1]); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); roundPath(ctx, x + p, y + p, w - p * 2, h - p * 2, w * 0.06); ctx.clip();
  ctx.strokeStyle = th.trim; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
  for (let k = -h; k < w + h; k += w * 0.18) { ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + k + h, y + h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + k + h, y); ctx.lineTo(x + k, y + h); ctx.stroke(); }
  ctx.restore();
  const cx = x + w / 2, cy = y + h / 2, R = w * 0.3;
  ctx.fillStyle = th.paper; ctx.beginPath(); ctx.arc(cx, cy, R * (1 + 0.03 * Math.sin(t * 3)), 0, PI2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = th.accent2; ctx.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8 - Math.PI / 2, rr = i % 2 ? R * 0.42 : R * 0.82; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(cx, cy, R * 0.2, 0, PI2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function toast(ctx, s, th, y = 366, cx = 360, w = 520) {
  const k = s.toast; if (!k) return;
  const a = Math.min(1, k.t / 0.12, (k.max - k.t) / 0.25), h = 38;
  ctx.save(); ctx.globalAlpha = clamp01(a);
  roundPath(ctx, cx - w / 2, y - h / 2 + (1 - clamp01(a)) * 8, w, h, 19);
  ctx.fillStyle = k.kind === 'warn' ? 'rgba(200,40,60,0.92)' : k.kind === 'good' ? 'rgba(30,150,90,0.94)' : 'rgba(20,10,40,0.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke();
  text(ctx, k.text, cx, y + 1 + (1 - clamp01(a)) * 8, 22, { color: '#fff', maxW: w - 30, italic: true });
  ctx.restore();
}
const nameOf = (p, lang) => (p.kind === 'cpu' ? CPU_NAMES[p.name][lang === 'es' ? 'es' : 'en'] : '');
const patName = (id, lang) => patternOf(id)[lang === 'es' ? 'es' : 'en'];
function chip(ctx, x, y, w, h, label, th, o = {}) {
  ctx.save();
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = o.fill ?? 'rgba(0,0,0,0.38)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.stroke ?? 'rgba(255,255,255,0.3)'; ctx.stroke();
  text(ctx, label, x + w / 2, y + h / 2 + 1, o.px ?? h * 0.5, { color: o.color ?? th.text, maxW: w - 20 });
  ctx.restore();
}
function liveScore(s) {
  const r = s.round; if (!r || !r.players[0]) return s.score;
  const p = r.players[0];
  return s.score + p.stats.beans * SCORE.bean + p.stats.wrong * SCORE.wrong + p.stats.falses * SCORE.falseClaim;
}

// ---- menu -------------------------------------------------------------------------------------------------------
const R2 = (x, y, w, h) => ({ x, y, w, h });
function renderMenu(ctx, s, th, L, d) {
  const lang = L_(s), sc = scaleOf(s), m = L.menuRows(sc), big = sc > 1.2;
  // fan of sample cards (left out at large text sizes in portrait so the buttons can grow)
  if (m.fan) {
    const ids = [6, 37, 0, 22, 33], angs = [-0.68, -0.34, 0, 0.34, 0.68], px = m.art.cx, py = m.art.py;
    for (const i of [0, 4, 1, 3, 2]) {
      const a = angs[i] + Math.sin(s.t * 0.9 + i * 1.3) * 0.018, R = 360;
      const cx = px + Math.sin(a) * R, cy = py - Math.cos(a) * R;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      drawCard(ctx, ids[i], -72, -102, 144, 204, { lang, theme: s.theme, shadow: 18 });
      ctx.restore();
    }
  }
  text(ctx, 'Lotería', m.art.cx, m.titleY, 118, { italic: true, color: th.accent, stroke: 9, shadow: true });
  text(ctx, 'C A N T A D A', m.art.cx, m.subY, 38, { color: th.text, stroke: 6, maxW: 520 });
  const label = (k) => tr(lang, k), sr = big ? 0.68 : 0.62;
  drawButton(ctx, m.play, label('play'), th, { primary: true, sub: label('playSub'), scale: sc, subRatio: sr });
  drawButton(ctx, m.duo, label('duo'), th, { sub: label('duoSub'), scale: sc, subRatio: sr });
  drawButton(ctx, m.caller, label('caller'), th, { sub: label('callerSub'), scale: sc, subRatio: sr });
  drawButton(ctx, m.watch, label('watch'), th, { sub: label('watchSub'), scale: sc, subRatio: sr });
  const ss = big ? 0.8 : sc * 0.62;
  drawButton(ctx, m.howto, label('howto'), th, { scale: ss });
  drawButton(ctx, m.rules, label('rules'), th, { scale: ss });
  drawButton(ctx, m.about, label('about'), th, { scale: ss });
  drawButton(ctx, m.es, 'Español', th, { active: lang === 'es', scale: big ? 1.1 : sc * 0.8 });
  drawButton(ctx, m.en, 'English', th, { active: lang === 'en', scale: big ? 1.1 : sc * 0.8 });
  drawButton(ctx, m.settings, label('settings'), th, { scale: big ? 1.1 : sc * 0.7 });
  drawSoundButton(ctx, s, th, d.sound);
  { const q = m.lockup, dn = s.lkDown, pad = 8;      // the themed Arcforge lockup under the menu; a tap opens the Arcforge home
    ctx.save(); ctx.fillStyle = 'rgba(20,6,36,0.62)'; roundPath(ctx, q.x - 10, q.y - 5, q.w + 20, q.h + 10, (q.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, dn ? R2(q.x + q.w * 0.02, q.y + 1, q.w * 0.96, q.h * 0.96) : q, dn ? 0.7 : 1); }
}
function drawSoundButton(ctx, s, th, r) {
  drawButton(ctx, r, '', th, {});
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.save(); ctx.fillStyle = th.text; ctx.strokeStyle = th.text; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - 20, cy - 8); ctx.lineTo(cx - 10, cy - 8); ctx.lineTo(cx + 2, cy - 18); ctx.lineTo(cx + 2, cy + 18); ctx.lineTo(cx - 10, cy + 8); ctx.lineTo(cx - 20, cy + 8); ctx.closePath(); ctx.fill();
  if (s.sound) { ctx.beginPath(); ctx.arc(cx + 2, cy, 12, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 2, cy, 21, -0.9, 0.9); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(cx + 12, cy - 10); ctx.lineTo(cx + 28, cy + 10); ctx.moveTo(cx + 28, cy - 10); ctx.lineTo(cx + 12, cy + 10); ctx.stroke(); }
  ctx.restore();
}
function backButton(ctx, th, r) { drawButton(ctx, r, '‹', th, { scale: 1.3 }); }

// ---- setup --------------------------------------------------------------------------------------------------------
function renderSetup(ctx, s, th, L, d) {
  const lang = L_(s), sc = scaleOf(s), keys = s.mode === 'duo' ? DUO_SETUP_KEYS : SETUP_KEYS, rows = L.setupRows(keys), c = s.cfg;
  backButton(ctx, th, d.back);
  text(ctx, tr(lang, 'setupTitle'), d.W / 2, d.titleY, 44, { italic: true, color: th.accent, stroke: 5, maxW: 460, shadow: true });
  const val = (k) => {
    if (k === 'pattern') return patName(c.pattern, lang);
    if (k === 'pace') return byId(PACES, c.pace)[lang];
    if (k === 'opps') return String(c.opps);
    if (k === 'skill') return byId(SKILLS, c.skill)[lang];
    if (k === 'style') return byId(STYLES, c.style)[lang];
    return THEMES[s.theme].name[lang];
  };
  for (const k of keys) {
    const r = rows[k];
    panel(ctx, r, th, 24);
    const cy = r.y + r.h / 2;
    if (k === 'pattern') {
      const pat = patternOf(c.pattern), sets = pat.sets ?? null;
      drawPatternThumb(ctx, r.x + 150, r.y + 36, 104, c.pattern, sets, th, s.t);
      if (!sets) { text(ctx, '?', r.x + 202, r.y + 88, 80, { color: th.accent, stroke: 5 }); }
      text(ctx, tr(lang, k), r.x + 44, r.y + 26, 22, { align: 'left', color: th.sub, maxW: 120 });
      text(ctx, val(k), r.x + r.w - 40, r.y + 66, 42 * Math.min(sc, 1.4), { align: 'right', italic: true, color: th.accent, maxW: r.w - 330 });
      ctx.save(); ctx.font = font(20, 400, true); const ls = wrapLines(ctx, pat.blurb[lang === 'es' ? 'es' : 'en'], r.w - 330); ctx.restore();
      ls.slice(0, 3).forEach((ln, i) => text(ctx, ln, r.x + r.w - 40, r.y + 108 + i * 24, 20, { align: 'right', weight: 400, italic: true, color: th.sub, maxW: r.w - 330 }));
    } else {
      text(ctx, tr(lang, k), r.x + 40, r.y + 30, 22, { align: 'left', color: th.sub, maxW: r.w - 200 });
      text(ctx, val(k), r.x + r.w / 2, cy + 8, 42 * Math.min(sc, 1.5), { italic: true, color: k === 'theme' ? th.accent : th.text, maxW: r.w - 180 });
      if (k === 'style') text(ctx, byId(STYLES, c.style).sub[lang === 'es' ? 'es' : 'en'], r.x + r.w / 2, r.y + r.h - 16, 18, { weight: 400, color: th.sub, maxW: r.w - 180 });
      if (k === 'pace') text(ctx, `${byId(PACES, c.pace).secs}s · ${byId(PACES, c.pace).window}`, r.x + r.w / 2, r.y + r.h - 16, 18, { weight: 400, color: th.sub });
    }
    const arrowY = k === 'pattern' ? r.y + r.h / 2 : cy;
    chevron(ctx, r.x + 26, arrowY, -1, th, k === 'opps' && c.opps <= 1);
    chevron(ctx, r.x + r.w - 26, arrowY, 1, th, k === 'opps' && c.opps >= 3);
  }
  drawButton(ctx, rows.start, tr(lang, 'start'), th, { primary: true, scale: sc });
}
function chevron(ctx, x, y, dir, th, off) {
  ctx.save(); ctx.globalAlpha = off ? 0.25 : 0.9; ctx.strokeStyle = th.accent; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x + dir * -8, y - 16); ctx.lineTo(x + dir * 8, y); ctx.lineTo(x + dir * -8, y + 16); ctx.stroke(); ctx.restore();
}


// ---- tabla pick ------------------------------------------------------------------------------------------------------
function renderPick(ctx, s, th, d) {
  const lang = L_(s), sc = scaleOf(s), pk = s.pick, P = d.pick;
  backButton(ctx, th, d.back);
  text(ctx, tr(lang, 'pickTitle'), d.W / 2, d.titleY, 44, { italic: true, color: th.accent, stroke: 5, maxW: 460, shadow: true });
  text(ctx, tr(lang, 'pickHint'), d.W / 2, P.hintY, 26, { weight: 400, italic: true, color: th.sub });
  for (let i = 0; i < 3; i++) {
    const g = P.slots[i], k = easeOutBack(clamp01((pk.t - i * 0.08) / 0.4)), sel = pk.sel === i;
    ctx.save();
    const cx = g.x + g.w / 2, cy = g.y + g.h / 2; ctx.translate(cx, cy); ctx.scale(0.4 + 0.6 * k, 0.4 + 0.6 * k); ctx.globalAlpha = clamp01(k * 1.4); ctx.translate(-cx, -cy);
    if (sel) { roundPath(ctx, g.x - 8, g.y - 8, g.w + 16, g.h + 16, 28); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,224,110,${0.7 + 0.3 * Math.sin(s.t * 5)})`; ctx.shadowColor = 'rgba(255,200,60,0.9)'; ctx.shadowBlur = 24; ctx.stroke(); ctx.shadowBlur = 0; }
    drawTabla(ctx, g, pk.tablas[i], Array(16).fill(false), Array(16).fill(false), th, s.t, { lang, theme: s.theme });
    ctx.restore();
  }
  const dl = P.deal, bob = Math.sin(s.t * 2) * 3;
  panel(ctx, dl, th, 28);
  for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(dl.x + dl.w / 2, dl.y + dl.h / 2 - 20 + bob); ctx.rotate((i - 1) * 0.28); cardBack(ctx, -52, -74, 104, 148, th, s.t); ctx.restore(); }
  text(ctx, tr(lang, 'deal'), dl.x + dl.w / 2, dl.y + dl.h - 38, 32 * Math.min(sc, 1.2), { italic: true, color: th.text, maxW: dl.w - 30 });
  drawButton(ctx, P.play, tr(lang, 'letsPlay'), th, { primary: true, disabled: pk.sel < 0, scale: sc, pulse: pk.sel >= 0 ? (s.t % 1) : 0 });
  // the pattern about to be played
  const pat = patternOf(s.cfg.pattern);
  text(ctx, `${tr(lang, 'pattern')}: ${pat[lang === 'es' ? 'es' : 'en']}`, d.W / 2, P.patY, 28, { color: th.sub, italic: true, maxW: 560 });
}

// ---- the caller's card with a flip-in -------------------------------------------------------------------------------------
function callerCard(ctx, s, r, rect, th, showName, lang) {
  const id = r.called[r.called.length - 1];
  if (id == null) { cardBack(ctx, rect.x, rect.y, rect.w, rect.h, th, s.t); return; }
  const p = clamp01(r.callT / 0.5), sx = Math.max(0.03, easeOutBack(p)), cx = rect.x + rect.w / 2;
  ctx.save(); ctx.translate(cx, rect.y + rect.h / 2); ctx.scale(sx, 1); ctx.rotate((1 - p) * 0.08); ctx.translate(-cx, -(rect.y + rect.h / 2));
  if (p < 0.35) cardBack(ctx, rect.x, rect.y, rect.w, rect.h, th, s.t);
  else drawCard(ctx, id, rect.x, rect.y, rect.w, rect.h, { lang, theme: s.theme, shadow: 22, name: showName ? undefined : '?' });
  ctx.restore();
}
function nameVisible(r) {
  const id = r.called[r.called.length - 1];
  if (id == null) return false;
  if (r.status !== 'running') return true;
  if (r.style === 'easy') return true;
  if (r.hintName === id) return true;
  return r.style === 'classic' && r.callT >= CLASSIC_REVEAL_SECS;
}
function riddleBlock(ctx, id, x, y, maxW, maxH, lang, th, px0 = 38) {
  const lines0 = CARDS[id].riddle[lang === 'es' ? 'es' : 'en'];
  for (let px = px0; px >= 18; px -= 2) {
    ctx.font = font(px, 400, true);
    const lines = lines0.flatMap((l) => wrapLines(ctx, l, maxW));
    const noWrap = lines.length === lines0.length;
    if ((noWrap && lines.length * px * 1.22 <= maxH) || (px <= 26 && lines.length * px * 1.22 <= maxH) || px === 18) {
      ctx.save(); ctx.fillStyle = th.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = font(px, 400, true); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      lines.forEach((l, i) => ctx.fillText(l, x, y + i * px * 1.22)); ctx.restore();
      return lines.length * px * 1.22;
    }
  }
  return 0;
}


// ---- solo play and watch & learn --------------------------------------------------------------------------------------------
function renderPlay(ctx, s, th, L) {
  const r = s.round, lang = L_(s), auto = s.scene === 'auto', me = r.players[0], sc = scaleOf(s);
  const P = auto ? L.auto : L.play, hd = P.head;
  const cur = r.called[r.called.length - 1];
  const a = r.auto;
  // header
  chip(ctx, hd.score.x, hd.score.y, hd.score.w, hd.score.h, auto ? tr(lang, 'watch') : `${tr(lang, 'score')} ${liveScore(s)}`, th, { px: auto ? 22 : 26 });
  const pat = patternOf(r.pattern), pr = hd.pat;
  roundPath(ctx, pr.x, pr.y, pr.w, pr.h, 27); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();
  const need = needed(me.marks, me.dead, r.pattern);
  text(ctx, `${tr(lang, 'round')} ${r.num} · ${pat[lang === 'es' ? 'es' : 'en']}`, pr.x + pr.w / 2, pr.y + 19, 23, { maxW: pr.w - 30, color: th.text });
  text(ctx, need === Infinity ? tr(lang, 'lost') : need === 0 ? tr(lang, 'done') : tr(lang, 'needsMore', { n: need }), pr.x + pr.w / 2, pr.y + 41, 17, { maxW: pr.w - 30, color: need === 1 ? th.accent : th.sub, weight: 400, italic: true });
  if (!auto) {
    const pb = hd.pause; drawButton(ctx, pb, '', th, {});
    const pcx = pb.x + pb.w / 2, pcy = pb.y + pb.h / 2;
    ctx.fillStyle = th.text; roundPath(ctx, pcx - 17, pcy - 14, 11, 28, 3); ctx.fill(); roundPath(ctx, pcx + 6, pcy - 14, 11, 28, 3); ctx.fill();
  } else {
    const c = hd.chip;
    chip(ctx, c.x, c.y, c.w, c.h, a.phase === 'think' ? `${tr(lang, 'think')} ${Math.ceil(a.timer)}s` : a.phase === 'reveal' ? tr(lang, 'reveal') : a.phase === 'act' ? tr(lang, 'act') : a.phase === 'claim' ? tr(lang, 'lotto') : '…', th, { px: 26, fill: a.phase === 'reveal' ? 'rgba(255,181,46,0.35)' : undefined });
  }
  // caller card + text
  const showName = auto ? (a.phase === 'reveal' || a.phase === 'act' || a.phase === 'claim' || r.status !== 'running') : nameVisible(r);
  callerCard(ctx, s, r, P.card, th, showName, lang);
  const T = P.text, tx = T.x, tw = T.w;
  if (cur == null) {
    text(ctx, tr(lang, 'ready'), tx + tw / 2, T.y + T.h * 0.4, 46, { italic: true, color: th.accent, stroke: 4, maxW: tw });
  } else {
    text(ctx, tr(lang, 'cardN', { n: r.called.length, m: r.pool.length }), tx, T.y + 20, 22, { align: 'left', color: th.sub, maxW: tw });
    riddleBlock(ctx, cur, tx, T.y + 42, tw, Math.max(50, T.h - (T.h < 250 ? 112 : 120)), lang, th, 36);
    const nm = CARDS[cur][lang === 'es' ? 'es' : 'en'];
    const npx = T.h < 250 ? 36 : 44, ny = T.y + T.h - (T.h < 250 ? 56 : 64);
    if (showName) text(ctx, nm, tx, ny, npx, { align: 'left', italic: true, color: th.accent, stroke: 4, maxW: tw, shadow: true });
    else text(ctx, tr(lang, 'which'), tx, ny, npx * 0.77, { align: 'left', italic: true, color: th.accent, weight: 400, maxW: tw });
  }
  // timer bar
  const tb = { x: tx, y: T.y + T.h - 30, w: tw, h: 12 };
  roundPath(ctx, tb.x, tb.y, tb.w, tb.h, 7); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
  let frac = 0;
  if (auto) frac = a.phase === 'think' ? 1 - a.timer / THINK_STEPS[s.thinkIdx] : a.phase === 'reveal' ? 1 - a.timer / 2 : a.phase === 'act' ? 1 - a.timer / 0.9 : 0;
  else if (!r.deckDone && r.idx >= 0) frac = 1 - clamp01(r.timer / r.secs); else if (r.idx < 0) frac = 1 - clamp01(r.timer / 1.8);
  if (frac > 0) { roundPath(ctx, tb.x, tb.y, Math.max(14, tb.w * clamp01(frac)), tb.h, 7); ctx.fillStyle = auto && a.phase === 'reveal' ? th.accent2 : th.accent; ctx.fill(); }
  // history strip: newest first; the open ones are lit
  drawHistory(ctx, s, r, th, lang, P.hist);
  // the tabla
  const goal = bestSet(me.marks, me.dead, r.pattern);
  const opts = { lang, theme: s.theme, called: r.called, beanT: me.beanT, flash: me.flash, hintCell: me.hintCell, winSet: r.status === 'won' && r.winner === 0 ? r.winSet : null };
  if (auto) {
    if (a.phase === 'reveal' || a.phase === 'act') { opts.hintCell = a.target >= 0 && !me.marks[a.target] ? a.target : -1; opts.outline = goal ? goal.filter((i) => !me.marks[i] && i !== a.target) : null; }
  }
  drawTabla(ctx, P.tabla, me.tabla, me.marks, me.dead, th, s.t, opts);
  // opponents
  drawMinis(ctx, s, r, th, lang, P.minis);
  // caption in watch mode
  if (auto && cur != null && r.status === 'running') {
    const nm = CARDS[cur][lang === 'es' ? 'es' : 'en'];
    let msg = '';
    if (a.phase === 'think') msg = tr(lang, 'thinkIn');
    else if (a.phase === 'reveal' || a.phase === 'act') msg = a.target >= 0 ? `${tr(lang, 'autoIs', { name: nm })} · ${tr(lang, 'onTabla')}` : `${tr(lang, 'autoIs', { name: nm })} · ${tr(lang, 'notOnAuto')}`;
    else if (a.phase === 'claim') msg = tr(lang, 'lotto');
    if (msg) toast(ctx, { toast: { text: msg, kind: a.phase === 'reveal' ? 'good' : 'info', t: 1, max: 9 } }, th, P.toastY, P.toastX, P.toastW);
  } else if (!auto) {
    toast(ctx, s, th, P.toastY, P.toastX, P.toastW);
    if (r.ff && r.status === 'running') toast(ctx, { toast: { text: tr(lang, 'fast'), kind: 'info', t: 1, max: 9 } }, th, P.toastY, P.toastX, P.toastW);
  }
  // bottom bar
  const B = P.bar;
  if (auto) {
    const paused = s.paused, tall = B.exit.h > 70;
    drawButton(ctx, B.exit, tr(lang, 'exit'), th, { scale: sc * 0.7 });
    drawButton(ctx, B.dec, `${tr(lang, 'think')} −`, th, { scale: sc * (tall ? 0.7 : 0.6), disabled: s.thinkIdx <= 0 });
    drawButton(ctx, B.pause, paused ? tr(lang, 'resume') : tr(lang, 'pause'), th, { primary: true, scale: sc * 0.7 });
    drawButton(ctx, B.inc, `${tr(lang, 'think')} +`, th, { scale: sc * (tall ? 0.7 : 0.6), disabled: s.thinkIdx >= THINK_STEPS.length - 1 });
    drawButton(ctx, B.speed, tr(lang, 'skipNext'), th, { scale: sc * 0.7 });
  } else {
    drawButton(ctx, B.hint, tr(lang, 'hint'), th, { disabled: me.hints <= 0, scale: sc * 0.8, sub: `${me.hints}/${HINTS_PER_ROUND}` });
    claimButton(ctx, B.claim, s, r, 0, th, lang);
  }
  if (s.paused) {
    ctx.save(); ctx.fillStyle = 'rgba(8,2,20,0.86)'; ctx.fillRect(0, 0, L.w, auto ? P.barTop - 6 : L.h); ctx.restore();
    if (auto) text(ctx, tr(lang, 'paused'), L.w / 2, (P.barTop - 6) / 2, 80, { italic: true, color: th.accent, stroke: 7, shadow: true, maxW: L.w - 60 });
    else withDesign(ctx, L, curPointer, (d) => pauseOverlay(ctx, s, th, lang, sc, d));
  }
  if (r.status !== 'running' && r.endT > 0.5) resultOverlay(ctx, s, r, th, lang, sc, L);
}
function claimButton(ctx, rect, s, r, pi, th, lang) {
  const p = r.players[pi], complete = isComplete(p.marks, r.pattern), locked = p.lock > 0;
  const label = locked ? tr(lang, 'locked', { n: Math.ceil(p.lock) }) : tr(lang, 'lotto');
  drawButton(ctx, rect, label, th, { primary: complete && !locked, disabled: locked || r.status !== 'running', scale: scaleOf(s) * (complete ? 1.1 : 0.95), pulse: complete && !locked && r.status === 'running' ? (s.t * 1.4) % 1 : 0 });
}
function drawHistory(ctx, s, r, th, lang, hr) {
  const n = Math.min(6, r.called.length);
  text(ctx, tr(lang, 'open'), hr.x + 6, hr.y + 32, 20, { align: 'left', color: th.sub, weight: 400, italic: true, maxW: 90 });
  const sx = hr.x + 100, pitch = Math.min(76, (hr.w - 100 - 60) / 5);
  for (let i = 0; i < n; i++) {
    const id = r.called[r.called.length - 1 - i], isOpen = i < r.window, sz = isOpen ? 60 : 50, x = sx + i * pitch + (60 - sz) / 2, y = hr.y + (64 - sz) / 2;
    ctx.save(); ctx.globalAlpha = isOpen ? 1 : 0.5;
    roundPath(ctx, x, y, sz, sz, 10); ctx.fillStyle = th.paper; ctx.fill(); ctx.lineWidth = isOpen ? 3.5 : 2; ctx.strokeStyle = isOpen ? '#ffd24a' : CARDS[id].hue; ctx.stroke();
    drawArt(ctx, id, x + sz / 2, y + sz / 2, sz * 0.86);
    ctx.restore();
  }
  if (r.window > 0 && n > 0) {
    const len = Math.min(n, r.window);
    ctx.save(); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, hr.y + 66); ctx.lineTo(sx + (len - 1) * pitch + 60, hr.y + 66); ctx.stroke(); ctx.restore();
  }
}
function drawMinis(ctx, s, r, th, lang, m) {
  const cpus = r.players.filter((p) => p.kind === 'cpu');
  if (!cpus.length) return;
  const slot = m.w / cpus.length;
  cpus.forEach((p, i) => {
    const x = m.x + i * slot, won = r.status === 'won' && r.players[r.winner] === p;
    drawMini(ctx, x + 6, m.y + 8, 58, p, bestSet(p.marks, p.dead, r.pattern), th, won);
    text(ctx, nameOf(p, lang), x + 78, m.y + 22, 24, { align: 'left', color: th.text, maxW: slot - 88 });
    const need = needed(p.marks, p.dead, r.pattern);
    const msg = need === Infinity ? tr(lang, 'lost') : need === 0 ? tr(lang, 'done') : tr(lang, 'needs', { n: need });
    text(ctx, msg, x + 78, m.y + 52, 22, { align: 'left', weight: 400, italic: true, color: need === 1 ? th.accent : th.sub, maxW: slot - 88 });
  });
}

// ---- overlays (design screens drawn over the play screens) --------------------------------------------------------------------
function pauseOverlay(ctx, s, th, lang, sc, d) {
  const P = d.pause;
  text(ctx, tr(lang, 'paused'), d.W / 2, P.titleY, 88, { italic: true, color: th.accent, stroke: 8, shadow: true, maxW: 600 });
  drawButton(ctx, P.resume, tr(lang, 'resume'), th, { primary: true, scale: sc });
  drawButton(ctx, P.rules, tr(lang, 'rules'), th, { scale: sc * 0.85 });
  drawButton(ctx, P.menu, tr(lang, 'menu'), th, { scale: sc * 0.85 });
}
function resultOverlay(ctx, s, r, th, lang, sc, L) {
  const k = easeOutCubic(clamp01((r.endT - 0.5) / 0.5));
  ctx.save(); ctx.globalAlpha = k; drawBackdrop(ctx, th, s.t, { garland: 'thin', w: L.w, h: L.h }); ctx.fillStyle = 'rgba(10,3,24,0.35)'; ctx.fillRect(0, 0, L.w, L.h); ctx.restore();
  ctx.save(); ctx.globalAlpha = k;
  withDesign(ctx, L, curPointer, (d) => {
    const RS = d.result;
    const won = r.status === 'won', who = won ? r.players[r.winner] : null;
    let title = tr(lang, 'noWinner'), big = '';
    if (won) {
      big = '¡Lotería!';
      if (r.mode === 'duo') title = tr(lang, r.winner === 0 ? 'p1Win' : 'p2Win');
      else title = who.kind === 'human' ? tr(lang, 'youWin') : tr(lang, 'cpuWin', { name: nameOf(who, lang) });
    }
    if (big) { const pop = easeOutBack(clamp01((r.endT - 0.5) / 0.6)); ctx.save(); ctx.translate(RS.cx, RS.bigY); ctx.scale(pop, pop); text(ctx, big, 0, 0, 110, { italic: true, color: th.accent, stroke: 9, shadow: true, maxW: 640 }); ctx.restore(); }
    text(ctx, title, RS.cx, big ? RS.titleYBig : RS.titleY, 54 * Math.min(sc, 1.3), { italic: true, color: th.text, stroke: 5, maxW: 640 });
    const showP = won ? who : r.players[0];
    drawTabla(ctx, RS.tabla, showP.tabla, showP.marks, showP.dead, th, s.t, { lang, theme: s.theme, called: r.called, winSet: r.winSet, beanT: showP.beanT, labels: false });
    // points
    let y = RS.linesY;
    const lines = [];
    if (r.mode === 'duo') {
      r.result.forEach((rs, i) => lines.push([`${tr(lang, i === 0 ? 'p1' : 'p2')}`, rs.total]));
    } else if (r.result[0]) {
      const rs = r.result[0];
      lines.push([`${tr(lang, 'beans')} × ${rs.beans}`, rs.beans * SCORE.bean]);
      if (rs.wrong) lines.push([`${tr(lang, 'wrongs')} × ${rs.wrong}`, rs.wrong * SCORE.wrong]);
      if (rs.falses) lines.push([`${tr(lang, 'falses')} × ${rs.falses}`, rs.falses * SCORE.falseClaim]);
      if (rs.bonus) lines.push([tr(lang, 'bonus'), rs.bonus]);
    }
    const cap = Math.min(sc, 1.3), lh = Math.round(44 * cap) * 0.9 + 8, lw = RS.x1 - RS.x0;
    for (const [lab, v] of lines) {
      text(ctx, lab, RS.x0, y, 30 * cap, { align: 'left', color: th.text, maxW: lw - 160, weight: 400 });
      text(ctx, `${v >= 0 ? '+' : ''}${v}`, RS.x1, y, 32 * cap, { align: 'right', color: v >= 0 ? '#9af0a8' : '#ff9a9a' });
      y += lh;
    }
    if (r.mode === 'solo') {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(RS.x0, y - lh / 2 + 4); ctx.lineTo(RS.x1, y - lh / 2 + 4); ctx.stroke();
      text(ctx, `${tr(lang, 'total')} ${s.score}`, RS.x0, y + 12, 34, { align: 'left', color: th.accent, maxW: lw * 0.6 });
      text(ctx, `${tr(lang, 'best')} ${s.best}`, RS.x1, y + 12, 24, { align: 'right', color: th.sub, weight: 400, maxW: lw * 0.4 });
    }
    const auto = s.scene === 'auto';
    drawButton(ctx, RS.again, auto ? tr(lang, 'watchAgain') : tr(lang, 'again'), th, { primary: true, scale: sc * 0.85 });
    drawButton(ctx, RS.menu, tr(lang, 'menu'), th, { scale: sc * 0.85 });
    if (!auto) drawButton(ctx, RS.rules, tr(lang, 'rules'), th, { scale: sc * 0.6 });
    moreRect = d.scr(drawMoreLine(ctx, RS.more.x, RS.more.y, 20));
  });
  ctx.restore();
}
// Screen-space tap rect of the quiet "More heritage games" line (set while the result screen is drawn).
let moreRect = null;
export const moreLineRect = () => moreRect;

// ---- face-to-face ------------------------------------------------------------------------------------------------------------
function renderDuo(ctx, s, th, L) {
  const r = s.round, lang = L_(s), D = L.duo;
  drawDuoHalf(ctx, s, r, 0, th, lang, D);
  ctx.save(); ctx.translate(L.w, L.h); ctx.rotate(Math.PI); drawDuoHalf(ctx, s, r, 1, th, lang, D); ctx.restore();
  // centre band
  const band = D.band;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, band.y, L.w, band.h); ctx.restore();
  ctx.save(); ctx.strokeStyle = th.trim; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(0, band.y); ctx.lineTo(L.w, band.y); ctx.moveTo(0, band.y + band.h); ctx.lineTo(L.w, band.y + band.h); ctx.stroke(); ctx.restore();
  const cur = r.called[r.called.length - 1], c = D.card;
  if (cur == null) cardBack(ctx, c.x, c.y, c.w, c.h, th, s.t);
  else {
    const p = clamp01(r.callT / 0.5), sx = Math.max(0.03, easeOutBack(p)), cx = c.x + c.w / 2;
    ctx.save(); ctx.translate(cx, c.y + c.h / 2); ctx.scale(sx, 1); ctx.translate(-cx, -(c.y + c.h / 2));
    drawCard(ctx, cur, c.x, c.y, c.w, c.h, { lang, theme: s.theme, shadow: 16, name: nameVisible(r) ? undefined : '?' });
    ctx.restore();
  }
  const tb = D.timer;
  roundPath(ctx, tb.x, tb.y, tb.w, tb.h, 4); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
  const frac = r.idx < 0 ? 1 - clamp01(r.timer / 1.8) : r.deckDone ? 1 : 1 - clamp01(r.timer / r.secs);
  if (frac > 0) { roundPath(ctx, tb.x, tb.y, Math.max(10, tb.w * frac), tb.h, 4); ctx.fillStyle = th.accent; ctx.fill(); }
  const lines = cur != null ? CARDS[cur].riddle[lang === 'es' ? 'es' : 'en'] : [tr(lang, 'ready')];
  const nm = cur != null && nameVisible(r) ? CARDS[cur][lang === 'es' ? 'es' : 'en'] : '';
  const bandText = () => {
    const rb = D.textBottom;
    if (!D.sides) {
      lines.forEach((l, i) => text(ctx, l, L.w / 2, rb.y + 14 + i * 28, 25, { italic: true, weight: 400, color: th.text, maxW: rb.w }));
      if (nm) text(ctx, nm, D.nameX, c.y + c.h / 2, 30, { italic: true, color: th.accent, stroke: 4, maxW: 190, align: 'center' });
      text(ctx, tr(lang, 'cardN', { n: r.called.length, m: r.pool.length }), D.metaR.x, D.metaR.y, 18, { color: th.sub, weight: 400, maxW: 140, align: 'center' });
      text(ctx, patName(r.pattern, lang), D.metaL.x, D.metaL.y, 20, { color: th.sub, weight: 400, maxW: 220, align: 'center', italic: true });
    } else {
      if (nm) text(ctx, nm, rb.x, rb.y + 20, 30, { align: 'left', italic: true, color: th.accent, stroke: 4, maxW: rb.w });
      lines.forEach((l, i) => text(ctx, l, rb.x, rb.y + 58 + i * 28, 24, { align: 'left', italic: true, weight: 400, color: th.text, maxW: rb.w }));
      text(ctx, `${tr(lang, 'cardN', { n: r.called.length, m: r.pool.length })} · ${patName(r.pattern, lang)}`, rb.x, rb.y + rb.h - 12, 18, { align: 'left', color: th.sub, weight: 400, maxW: rb.w });
    }
  };
  bandText();
  ctx.save(); ctx.translate(L.w, L.h); ctx.rotate(Math.PI); bandText(); ctx.restore();
  const pb = D.pause; drawButton(ctx, pb, '', th, {});
  ctx.fillStyle = th.text; roundPath(ctx, pb.x + pb.w / 2 - 12, pb.y + pb.h / 2 - 14, 10, 28, 3); ctx.fill(); roundPath(ctx, pb.x + pb.w / 2 + 8, pb.y + pb.h / 2 - 14, 10, 28, 3); ctx.fill();
  if (s.paused) { ctx.save(); ctx.fillStyle = 'rgba(8,2,20,0.86)'; ctx.fillRect(0, 0, L.w, L.h); ctx.restore(); withDesign(ctx, L, curPointer, (d) => pauseOverlay(ctx, s, th, lang, scaleOf(s), d)); }
  if (r.status !== 'running' && r.endT > 0.5) resultOverlay(ctx, s, r, th, lang, scaleOf(s), L);
}
function drawDuoHalf(ctx, s, r, pi, th, lang, D) {
  const p = r.players[pi];
  drawTabla(ctx, D.tabla, p.tabla, p.marks, p.dead, th, s.t, { lang, theme: s.theme, called: r.called, beanT: p.beanT, flash: p.flash, hintCell: -1, winSet: r.status === 'won' && r.winner === pi ? r.winSet : null, labels: true });
  claimButton(ctx, D.claim, s, r, pi, th, lang);
  const need = needed(p.marks, p.dead, r.pattern);
  text(ctx, tr(lang, pi === 0 ? 'p1' : 'p2'), D.name.x, D.name.y, 22, { color: th.text, maxW: D.labelW });
  text(ctx, need === Infinity ? tr(lang, 'lost') : need === 0 ? tr(lang, 'done') : tr(lang, 'needs', { n: need }), D.need.x, D.need.y, 18, { color: need === 1 ? th.accent : th.sub, weight: 400, italic: true, maxW: D.labelW });
}

// ---- caller mode -----------------------------------------------------------------------------------------------------------------
function renderCaller(ctx, s, th, d) {
  const c = s.caller, lang = L_(s), sc = scaleOf(s), C = d.caller, cr = C.card;
  backButton(ctx, th, C.menu);
  text(ctx, tr(lang, 'caller'), d.W / 2, C.titleY, 38, { italic: true, color: th.accent, stroke: 4, maxW: 360 });
  text(ctx, `${Math.max(0, c.idx + 1)} / ${c.deck.length}`, C.countX, C.countY, 28, { color: th.sub, maxW: 130 });
  const id = c.idx >= 0 ? c.deck[c.idx] : null;
  if (id == null) { cardBack(ctx, cr.x, cr.y, cr.w, cr.h, th, s.t); text(ctx, tr(lang, 'callerReady'), C.riddleCx, C.readyY, 36, { italic: true, color: th.text, maxW: 600 }); }
  else {
    const p = clamp01(c.flipT / 0.5), sx = Math.max(0.03, easeOutBack(p)), cx = cr.x + cr.w / 2;
    ctx.save(); ctx.translate(cx, cr.y + cr.h / 2); ctx.scale(sx, 1); ctx.translate(-cx, -(cr.y + cr.h / 2));
    if (p < 0.35) cardBack(ctx, cr.x, cr.y, cr.w, cr.h, th, s.t); else drawCard(ctx, id, cr.x, cr.y, cr.w, cr.h, { lang, theme: s.theme, shadow: 26 });
    ctx.restore();
    const lines = CARDS[id].riddle[lang === 'es' ? 'es' : 'en'];
    ctx.save(); ctx.globalAlpha = clamp01((c.flipT - 0.2) / 0.4);
    const rr = C.riddle;
    const px = Math.min(40, 36 * Math.max(1, sc * 0.8));
    lines.forEach((l, i) => text(ctx, l, C.riddleCx, rr.y + 34 + i * 54, px, { italic: true, weight: 400, color: th.text, maxW: rr.w, shadow: true }));
    ctx.restore();
  }
  // history strip: last 10 called
  const hr = C.history, n = Math.min(10, Math.max(0, c.idx));
  for (let i = 0; i < n; i++) {
    const hid = c.deck[c.idx - 1 - i], x = hr.x + i * 66, y = hr.y + 20;
    ctx.save(); ctx.globalAlpha = 1 - i * 0.07; roundPath(ctx, x, y, 58, 58, 10); ctx.fillStyle = th.paper; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = CARDS[hid].hue; ctx.stroke();
    drawArt(ctx, hid, x + 29, y + 29, 50); ctx.restore();
  }
  drawButton(ctx, C.prev, '‹', th, { disabled: c.idx <= 0, scale: 1.6 });
  drawButton(ctx, C.next, tr(lang, 'next'), th, { primary: true, scale: sc * 1.1, disabled: c.idx + 1 >= c.deck.length });
  drawButton(ctx, C.auto, tr(lang, 'auto'), th, { active: c.auto, scale: sc * 0.75 });
  drawButton(ctx, C.reshuffle, tr(lang, 'shuffle'), th, { scale: sc * 0.7 });
  const secs = [5, 8, 12][c.speedIdx];
  drawButton(ctx, C.speed, tr(lang, 'pace2', { n: secs }), th, { scale: sc * 0.7 });
  if (c.auto && c.idx >= 0) { const a = clamp01(1 - c.timer / secs); roundPath(ctx, C.next.x, C.next.y - 10, C.next.w * a, 5, 3); ctx.fillStyle = th.accent; ctx.fill(); }
  toast(ctx, s, th, C.toastY, C.riddleCx === 360 ? 360 : C.riddleCx);
}

// ---- reference pages (About / How to play / Rules) -------------------------------------------------------------------------------
const pageCache = new Map();
// One continuous flow of every section (title, optional art, paragraphs) with y offsets relative to the top of the body, so the
// reader can scroll through all of it. Cached per language, text size and panel width.
function layoutFlow(ctx, list, key, scale, PANEL) {
  const ck = `${key}:${scale}:${PANEL.w}:${Math.round(fontFloor.u)}`;
  if (pageCache.has(ck)) return pageCache.get(ck);
  const textW = PANEL.w - 84;
  let px = Math.round(29 * scale);
  // the longest single word must fit on one line
  let maxWord = 0;
  ctx.font = font(px, 400);
  for (const pg of list) for (const para of pg.paras) for (const w of para.split(' ')) maxWord = Math.max(maxWord, ctx.measureText(w).width);
  if (maxWord > textW) px = Math.max(16, Math.floor(px * (textW / maxWord)));
  const LH = Math.round(px * 1.28), gap = Math.round(px * 0.45);
  const titlePx = Math.round(31 * Math.min(scale, 1.3));
  const items = [];
  let y = 8;
  list.forEach((pg, idx) => {
    if (idx > 0) { y += Math.round(px * 0.5); items.push({ t: 'rule', y }); y += Math.round(px * 0.7); }
    items.push({ t: 'title', text: pg.title, y: y + titlePx * 0.8 });
    y += titlePx + Math.round(px * 0.5) + 14;
    if (pg.art && scale <= 2) { items.push({ t: 'art', art: pg.art, y: y + 85 }); y += 170 + 8; }
    pg.paras.forEach((para, pi) => {
      ctx.font = font(px, 400);
      if (pi > 0) y += gap;
      wrapLines(ctx, para, textW).forEach((ln) => { items.push({ t: 'line', text: ln, y }); y += LH; });
    });
  });
  const res = { items, px, LH, titlePx, total: y + 20 };
  pageCache.set(ck, res);
  return res;
}
function pageArt(ctx, s, th, art, cx, cy, lang) {
  if (!art) return;
  if (art.type === 'cards') {
    const n = art.ids.length, w = 96, h = 134;
    art.ids.forEach((id, i) => { const a = (i - (n - 1) / 2) * 0.16, x = cx + (i - (n - 1) / 2) * 92; ctx.save(); ctx.translate(x, cy); ctx.rotate(a); drawCard(ctx, id, -w / 2, -h / 2, w, h, { lang, theme: s.theme, shadow: 12 }); ctx.restore(); });
  } else if (art.type === 'bean') {
    for (let i = 0; i < 3; i++) drawBean(ctx, cx + (i - 1) * 70, cy, 70, i * 0.8 - 0.8, 1);
  } else if (art.type === 'pattern') {
    drawPatternThumb(ctx, cx - 62, cy - 62, 124, art.id, patternOf(art.id).sets, th, s.t);
    if (!patternOf(art.id).sets) text(ctx, '?', cx, cy + 6, 90, { color: th.accent, stroke: 5 });
  } else if (art.type === 'tabla') {
    const g = tablaGeom(cx - 78, cy - 78, 36, 8);
    const ids = [3, 7, 11, 15, 22, 28, 31, 36, 40, 44, 47, 49, 50, 52, 53, 1];
    const marks = ids.map((_, i) => [1, 6, 11, 12].includes(i));
    drawTabla(ctx, g, ids, marks, Array(16).fill(false), th, s.t, { lang, theme: s.theme, labels: false });
  }
}

function renderPage(ctx, s, th, list, key, d) {
  const lang = L_(s), scale = scaleOf(s), PANEL = d.panel, res = layoutFlow(ctx, list, `${key}:${lang}`, scale, PANEL);
  const heading = tr(lang, key === 'about' ? 'about' : key === 'howto' ? 'howto' : 'rules');
  const P = { x: PANEL.x, y: PANEL.y, w: PANEL.w, h: PANEL.maxH }, W = d.W;
  roundPath(ctx, P.x, P.y, P.w, P.h, 28);
  const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, 'rgba(40,14,50,0.7)'); g.addColorStop(1, 'rgba(14,5,24,0.78)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,243,220,0.3)'; ctx.stroke();
  roundPath(ctx, P.x + 6, P.y + 6, P.w - 12, P.h - 12, 22); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,243,220,0.1)'; ctx.stroke();
  text(ctx, heading, W / 2, P.y + 52, 38 * Math.min(scale, 1.15), { color: th.text, maxW: P.w - 60 });
  ctx.strokeStyle = 'rgba(255,243,220,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 60, P.y + 82); ctx.lineTo(P.x + P.w - 60, P.y + 82); ctx.stroke();
  // the scrolling body
  const top = P.y + 90, viewH = Math.max(40, P.h - 90 - 14);
  s.refMax = Math.max(0, Math.ceil(res.total - viewH)); s.refView = viewH;
  s.refScroll = Math.max(0, Math.min(s.refMax, s.refScroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 10, top, P.w - 20, viewH); ctx.clip();
  ctx.fillStyle = '#fbf2de'; 
  for (const it of res.items) {
    const y = top + it.y - s.refScroll;
    if (y < top - 260 || y > top + viewH + 60) continue;
    if (it.t === 'title') text(ctx, it.text, W / 2, y, res.titlePx, { color: th.accent, italic: true, maxW: P.w - 60 });
    else if (it.t === 'rule') { ctx.strokeStyle = 'rgba(255,243,220,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(P.x + 60, y); ctx.lineTo(P.x + P.w - 60, y); ctx.stroke(); }
    else if (it.t === 'art') pageArt(ctx, s, th, it.art, W / 2, y - 4, lang);
    else { ctx.save(); ctx.fillStyle = '#fbf2de'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = font(res.px, 400); ctx.fillText(it.text, P.x + 42, y); ctx.restore(); }
  }
  ctx.restore();
  if (s.refMax > 0) {   // scroll thumb
    const th2 = Math.max(36, viewH * viewH / (viewH + s.refMax)), ty = top + (viewH - th2) * (s.refScroll / s.refMax);
    ctx.fillStyle = 'rgba(255,243,220,0.14)'; roundPath(ctx, P.x + P.w - 18, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,243,220,0.6)'; roundPath(ctx, P.x + P.w - 18, ty, 6, th2, 3); ctx.fill();
  }
  drawButton(ctx, d.textDec, 'A−', th, { disabled: s.textIdx <= 0, scale: 0.9 });
  drawButton(ctx, d.textInc, 'A+', th, { disabled: s.textIdx >= TEXT_SCALES.length - 1, scale: 0.9 });
  text(ctx, `${Math.round(scale * 100)}%`, W / 2, d.pctY, 26, { color: th.sub, weight: 400 });
  drawButton(ctx, d.refBack, tr(lang, 'back'), th, { scale: 0.85 });
  drawButton(ctx, d.refNext, tr(lang, 'doneBtn'), th, { primary: true, scale: 0.85 });
}

// ---- settings and demo limit ---------------------------------------------------------------------------------------------------------
function renderSettings(ctx, s, th, d) {
  const lang = L_(s), sc = scaleOf(s), R = d.settings;
  backButton(ctx, th, d.back);
  text(ctx, tr(lang, 'settings'), d.W / 2, d.titleY, 46 * Math.min(sc, 1.3), { italic: true, color: th.accent, stroke: 5, maxW: 420, shadow: true });
  const row = (r, key, valueFn) => {
    panel(ctx, r, th, 24);
    text(ctx, tr(lang, key), r.x + 30, r.y + 34, 24 * Math.min(sc, 1.4), { align: 'left', color: th.sub, maxW: r.w - 60 });
    if (valueFn) valueFn(r);
  };
  row(R.lang, 'lang', (r) => {
    const w = (r.w - 80) / 2;
    drawButton(ctx, { x: r.x + 30, y: r.y + 50, w, h: 56 }, 'Español', th, { active: s.lang === 'es', scale: 1 });
    drawButton(ctx, { x: r.x + 50 + w, y: r.y + 50, w, h: 56 }, 'English', th, { active: s.lang === 'en', scale: 1 });
  });
  row(R.sound, 'sound', (r) => text(ctx, s.sound ? tr(lang, 'on') : tr(lang, 'off'), r.x + r.w / 2, r.y + 78, 40 * Math.min(sc, 1.5), { italic: true, color: s.sound ? th.accent : th.sub, maxW: r.w - 80 }));
  row(R.text, 'text', (r) => {
    text(ctx, `${Math.round(scaleOf(s) * 100)}%`, r.x + r.w / 2, r.y + 78, 40 * Math.min(sc, 1.5), { italic: true, color: th.accent, maxW: r.w - 200 });
    chevron(ctx, r.x + 34, r.y + 78, -1, th, s.textIdx <= 0); chevron(ctx, r.x + r.w - 34, r.y + 78, 1, th, s.textIdx >= TEXT_SCALES.length - 1);
  });
  row(R.theme, 'look', (r) => {
    text(ctx, THEMES[s.theme].name[lang], r.x + r.w / 2, r.y + 78, 40 * Math.min(sc, 1.5), { italic: true, color: th.accent, maxW: r.w - 200 });
    chevron(ctx, r.x + 34, r.y + 78, -1, th); chevron(ctx, r.x + r.w - 34, r.y + 78, 1, th);
  });
  row(R.reset, 'reset', (r) => text(ctx, s.resetDone > 0 ? tr(lang, 'resetDone') : `${tr(lang, 'best')}: ${s.best}`, r.x + r.w / 2, r.y + 78, 34 * Math.min(sc, 1.4), { italic: true, color: th.text, maxW: r.w - 80 }));
}
function renderDemoLimit(ctx, s, th, d) {
  const lang = L_(s), sc = scaleOf(s), M = d.demo, P = M.panel;
  panel(ctx, P, th, 30, 1);
  text(ctx, tr(lang, 'demoEnd'), d.W / 2, M.titleY, 54 * Math.min(sc, 1.3), { italic: true, color: th.accent, stroke: 5, maxW: P.w - 40 });
  ctx.font = font(32 * Math.min(sc, 1.5), 400, true);
  wrapLines(ctx, tr(lang, 'demoMsg'), P.w - 70).forEach((l, i) => text(ctx, l, d.W / 2, M.msgY + i * 48 * Math.min(sc, 1.5), 32 * Math.min(sc, 1.5), { weight: 400, italic: true, color: th.text, maxW: P.w - 60 }));
  drawButton(ctx, M.back, tr(lang, 'menu'), th, { primary: true, scale: sc });
}
void cellRect; void tablaGeom; void THEME_IDS; void PATTERNS; void setsOf; void impossible; void POOL; void drawFrame; void fitText; void PI2;
