// Everything drawn each frame. Reads state, changes nothing.
import {
  W, H, UI, DISPLAY, PIECE_COLORS, GOLD, PAPER, text, rr, panel, button, background, star, drawPiece, drawCutout, outlinePath,
  icon, drawParticles, polyPath, alpha, light, dark, mix,
} from './art.js';
import { polyFree, KINDS, centroidOfPose, polyOfPose, decodeSolution, bbox } from './geom.js';
import { SCALE, BOARD_C, displayPolyPx, handlePos, snapPreview, levelGeo, pxPoly, openSlots, logicalPolyPx } from './puzzle.js';
import { LEVELS } from './levels.js';
import { tr, RULES, PIECE_SHORT } from './content.js';
import { TEXT_SCALES } from './ui.js';
import {
  BACK_BTN, PAUSE_BTN, BOARD, TRAY_PANEL, TOOLBAR_IDS, toolRect, AUTO_BTNS, DOC_PANEL, NAV_PREV, NAV_NEXT,
} from './layout.js';
import { levelName, pieceName, THINK_STEPS, chapterUnlocked } from './screens.js';

const SQUARE_DISSECTION = [
  [0, [[0, 0], [4, 0], [2, 2]]], [1, [[4, 0], [4, 4], [2, 2]]], [2, [[0, 2], [0, 4], [2, 4]]], [5, [[0, 2], [1, 1], [2, 2], [1, 3]]],
  [4, [[0, 0], [0, 2], [1, 1]]], [3, [[2, 2], [1, 3], [3, 3]]], [6, [[1, 3], [3, 3], [4, 4], [2, 4]]],
];

const ease = (t) => 1 - (1 - t) ** 3;
const backOut = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const pxOf = (kind, rot, f, cx, cy, s) => polyFree(kind, f, rot, 0, 0).map(([x, y]) => [cx + x * s, cy + y * s]);
const hash = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
  const { region, layout } = ui;
  ctx.save();
  rr(ctx, region.x - 6, region.y - 4, region.w + 12, region.h + 8, 18);
  ctx.clip();
  const ox = region.x, oy = region.y - scroll + (ui.offY || 0);
  for (const it of layout.items) {
    const b = it.b;
    const top = oy + it.y;
    if (top > region.y + region.h + 20 || top + it.h < region.y - 20) continue;
    if (b.t === 'h') {
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], ox + it.w / 2, top + i * it.line + it.size, it.size, GOLD, { font: DISPLAY, weight: 800 });
    } else if (b.t === 'p') {
      const center = b.center || b.align === 'center';
      for (let i = 0; i < it.lines.length; i++) {
        text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(244,234,211,0.93)', { weight: 500, align: center ? 'center' : 'left' });
      }
    } else if (b.t === 'img') {
      drawArt(ctx, b.name, ox, top, it.w, b.h, S, b);
    } else if (b.t === 'btn') {
      const bt = it.btns[0];
      button(ctx, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) {
          text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, PAPER, { weight: 700 });
        } else {
          button(ctx, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
        }
      }
    } else if (b.t === 'grid') {
      for (const bt of it.btns) drawLevelCell(ctx, S, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.cell, S.press && S.press.id === bt.id && S.press.active);
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, th = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - th);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(ctx, region.x + region.w + 8, region.y + 4, 6, track, 3); ctx.fill();
    ctx.fillStyle = 'rgba(232,196,106,0.75)';
    rr(ctx, region.x + region.w + 8, ty, 6, th, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, 'rgba(244,234,211,0.8)', { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 3 : 0), 30);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 3 : 0), f.size, PAPER, { weight: 700 });
    } else button(ctx, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

function drawLevelCell(ctx, S, r, c, pressed) {
  const y = r.y + (pressed ? 3 : 0);
  const z = TEXT_SCALES[S.textIdx] ?? 1; // labels follow the text-size setting
  ctx.save();
  if (c.state === 'locked') ctx.globalAlpha = 0.55;
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(0, y, 0, y + r.h);
  if (c.state === 'solved') { g.addColorStop(0, '#3a3270'); g.addColorStop(1, '#241f4e'); } else { g.addColorStop(0, '#2c2860'); g.addColorStop(1, '#1b1840'); }
  ctx.fillStyle = g; rr(ctx, r.x, y, r.w, r.h, 16); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = c.state === 'solved' ? 'rgba(232,196,106,0.8)' : 'rgba(232,196,106,0.38)'; ctx.lineWidth = 2;
  rr(ctx, r.x, y, r.w, r.h, 16); ctx.stroke();
  if (c.state === 'solved') {
    const gg = levelGeo(c.lvl);
    const bb = gg.box, sc = Math.min((r.w - 26) / bb.w, (r.h - 58) / bb.h);
    const ox = r.x + r.w / 2 - ((bb.x0 + bb.x1) / 2) * sc, oy = y + 14 + (r.h - 58) / 2 - ((bb.y0 + bb.y1) / 2) * sc;
    const loops = gg.loops.map((l) => l.map(([px, py]) => [ox + px * sc, oy + py * sc]));
    outlinePath(ctx, loops);
    ctx.fillStyle = GOLD; ctx.fill();
    for (let i = 0; i < 3; i++) star(ctx, r.x + r.w / 2 + (i - 1) * Math.min(26, r.w / 4.6), y + r.h - 20, Math.min(11, r.w / 12), i < c.stars ? '#ffd45a' : 'rgba(255,255,255,0.14)');
    text(ctx, c.label, r.x + 12, y + 14 + Math.min(22 * (1 + (z - 1) * 0.5), r.w / 5) * 0.8, Math.min(22 * (1 + (z - 1) * 0.5), r.w / 5), 'rgba(244,234,211,0.75)', { weight: 700, align: 'left' });
  } else if (c.state === 'locked') {
    icon(ctx, 'lock', r.x + r.w / 2, y + r.h / 2 - 6, Math.min(44, r.w * 0.34), 'rgba(244,234,211,0.7)');
    text(ctx, c.label, r.x + r.w / 2, y + r.h - 16, Math.min(22, r.w / 6), 'rgba(244,234,211,0.5)', { weight: 700 });
  } else {
    text(ctx, c.label, r.x + r.w / 2, y + r.h / 2 + Math.min(18, r.w / 7), Math.min(54 * (1 + (z - 1) * 0.3), r.w * 0.38), PAPER, { weight: 800, font: DISPLAY });
    for (let i = 0; i < 3; i++) star(ctx, r.x + r.w / 2 + (i - 1) * Math.min(26, r.w / 4.6), y + r.h - 20, Math.min(10, r.w / 13), 'rgba(255,255,255,0.12)');
  }
  ctx.restore();
}

// ----------------------------------------------------------------------------------- illustrations
function drawArt(ctx, name, x, y, w, h, S, b) {
  const cx = x + w / 2, cy = y + h / 2;
  const T = (k) => tr(S.lang, k);
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,28,0.55)';
  rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(232,196,106,0.25)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const t = S.t;
  if (name === 'logo') {
    const s = h * 0.42 / 4;
    SQUARE_DISSECTION.forEach(([k, poly], i) => {
      const off = Math.sin(t * 1.4 + i) * 2;
      drawPiece(ctx, poly.map(([px, py]) => [cx - 2 * s * 4 / 4 + (px - 2) * s * 1.5 + off * 0, cy + (py - 2) * s * 1.5 + off]), k, { lift: 0.1 });
    });
  } else if (name === 'pieces') {
    const s = 46;
    const pos = [[-200, -46, 0], [-52, -46, 0], [118, -40, 0], [-212, 62, 0], [-120, 62, 0], [-36, 56, 0], [100, 66, 0]];
    for (let k = 0; k < 7; k++) {
      const [dx, dy] = pos[k];
      const poly = pxOf(k, k === 1 ? 4 : 0, 0, 0, 0, s);
      const bb = bbox([poly]);
      const mx = (bb.x0 + bb.x1) / 2, my = (bb.y0 + bb.y1) / 2;
      drawPiece(ctx, poly.map(([px, py]) => [cx + dx + (px - mx) + 14, cy + dy + (py - my) - 8]), k, { lift: 0.15 });
      text(ctx, PIECE_SHORT[S.lang][k], cx + dx + 14, cy + dy + (bb.y1 - bb.y0) / 2 + 12, 17, 'rgba(244,234,211,0.75)', { weight: 600 });
    }
  } else if (name === 'target') {
    const lv = LEVELS[0];
    const g = levelGeo(lv);
    const s = 40;
    const bb = g.box;
    const mk = (cxx) => (p) => [cxx + (p[0] - (bb.x0 + bb.x1) / 2) * s, cy + (p[1] - (bb.y0 + bb.y1) / 2) * s];
    const left = mk(cx - w * 0.24), right = mk(cx + w * 0.24);
    drawCutout(ctx, g.loops.map((l) => l.map(left)), { top: y, bottom: y + h, halo: 0.2 });
    g.slots.forEach((poly, i) => drawPiece(ctx, poly.map(right), g.poses[i].kind, { lift: 0.1, noShadow: false }));
    text(ctx, '→', cx, cy + 12, 44, GOLD, { weight: 700 });
  } else if (name === 'drag') {
    const p0 = pxOf(0, 0, 0, x + w * 0.2, cy + 40, 56);
    const p1 = pxOf(0, 2, 0, x + w * 0.68, cy - 20, 56);
    drawCutout(ctx, [pxOf(0, 2, 0, x + w * 0.76, cy - 6, 56)], { top: y, bottom: y + h, halo: 0.2 });
    drawPiece(ctx, p0, 0, {});
    ctx.setLineDash([8, 9]); ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + w * 0.3, cy + 20); ctx.quadraticCurveTo(cx, cy - 70, x + w * 0.58, cy - 20); ctx.stroke(); ctx.setLineDash([]);
    drawPiece(ctx, p1, 0, { lift: 1 });
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x + w * 0.62, cy + 6, 16, 0, Math.PI * 2); ctx.fill();
  } else if (name === 'snap') {
    const tri = pxOf(2, 0, 0, cx, cy + 10, 76);
    drawCutout(ctx, [pxOf(2, 0, 0, cx + 40, cy + 40, 76)], { top: y, bottom: y + h, halo: 0.2 });
    drawPiece(ctx, tri, 2, { lift: 0.8 });
    const tgt = pxOf(2, 0, 0, cx + 40, cy + 40, 76);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(tgt[0][0], tgt[0][1], 26, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(tri[0][0], tri[0][1]); ctx.lineTo(tgt[0][0] - 8, tgt[0][1] - 4); ctx.stroke();
  } else if (name === 'rotate') {
    const base = pxOf(1, 0, 0, cx - 150, cy, 54);
    drawPiece(ctx, base, 1, {});
    drawPiece(ctx, pxOf(1, 1, 0, cx + 10, cy, 54), 1, {});
    drawPiece(ctx, pxOf(1, 2, 0, cx + 160, cy, 54), 1, {});
    text(ctx, '+45°', cx - 70, cy - 70, 28, GOLD, { weight: 700 });
    text(ctx, '+90°', cx + 85, cy - 70, 28, GOLD, { weight: 700 });
    icon(ctx, 'rotR', cx - 70, cy + 10, 44, GOLD); icon(ctx, 'rotR', cx + 85, cy + 10, 44, GOLD);
  } else if (name === 'flip') {
    drawPiece(ctx, pxOf(6, 0, 0, cx - 120, cy, 62), 6, {});
    drawPiece(ctx, pxOf(6, 0, 1, cx + 120, cy, 62), 6, {});
    ctx.strokeStyle = GOLD; ctx.setLineDash([5, 6]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, y + 24); ctx.lineTo(cx, y + h - 24); ctx.stroke(); ctx.setLineDash([]);
    icon(ctx, 'flip', cx, cy, 40, GOLD);
  } else if (name === 'glow') {
    drawCutout(ctx, [pxOf(2, 0, 0, cx - 110, cy + 10, 70)], { top: y, bottom: y + h, halo: 0.2 });
    drawPiece(ctx, pxOf(2, 0, 0, cx - 110, cy + 10, 70), 2, { glow: 0.9 + 0.1 * Math.sin(t * 4) });
    drawPiece(ctx, pxOf(2, 0, 0, cx + 100, cy + 10, 70), 2, {});
    text(ctx, '✓', cx - 110, y + 40, 34, GOLD, { weight: 800 });
  } else if (name === 'hint') {
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const slot = pxOf(0, 0, 0, cx + 120, cy + 10, 64);
    polyPath(ctx, slot); ctx.fillStyle = alpha(PIECE_COLORS[0], 0.25 + 0.25 * pulse); ctx.fill();
    ctx.setLineDash([8, 7]); ctx.strokeStyle = PIECE_COLORS[0]; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
    const pc = pxOf(0, 2, 0, cx - 130, cy + 10, 64);
    drawPiece(ctx, pc, 0, { glow: pulse });
    icon(ctx, 'hint', cx, cy, 52, GOLD);
  } else if (name === 'stars') {
    [3, 2, 1].forEach((n, r) => {
      for (let i = 0; i < 3; i++) star(ctx, cx - 70 + i * 52, y + 52 + r * 66, 20, i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)');
      text(ctx, ['0', '1-2', '3+'][r], cx + 130, y + 62 + r * 66, 26, PAPER, { weight: 700 });
    });
    icon(ctx, 'hint', cx + 190, y + 114, 38, GOLD);
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 100, cy, 76, GOLD); icon(ctx, 'reset', cx + 100, cy, 76, GOLD);
  } else if (name === 'chapters') {
    for (let i = 0; i < 7; i++) {
      const bw = 60 + i * 6;
      ctx.fillStyle = alpha(PIECE_COLORS[i], 0.8); rr(ctx, cx - bw / 2 - 150 + i * 0, y + 20 + i * 30, bw * 2.5, 22, 8); ctx.fill();
    }
    icon(ctx, 'lock', cx + 170, y + h - 50, 40, 'rgba(244,234,211,0.7)');
  } else if (name === 'masters') {
    const shapes = [[[0, 0], [4, 0], [2, 2]], [[0, 0], [4, 0], [4, 4], [0, 4]], [[0, 0], [4, 0], [3, 2], [1, 2]]];
    shapes.forEach((poly, i) => {
      const sc = 24, ox = cx - 200 + i * 140;
      polyPath(ctx, poly.map(([px, py]) => [ox + px * sc, cy - 40 + py * sc])); ctx.fillStyle = GOLD; ctx.fill();
    });
    text(ctx, '13', cx, y + h - 24, 36, PAPER, { weight: 800, font: DISPLAY });
  } else if (name === 'daily') {
    rr(ctx, cx - 70, cy - 60, 140, 120, 14); ctx.fillStyle = 'rgba(244,234,211,0.9)'; ctx.fill();
    ctx.fillStyle = PIECE_COLORS[0]; rr(ctx, cx - 70, cy - 60, 140, 34, 14); ctx.fill();
    text(ctx, '☀', cx, cy + 36, 56, '#a16b1a', { weight: 700 });
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 110, cy, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(cx - 110, cy, 44, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawPiece(ctx, pxOf(5, 0, 0, cx + 20, cy, 56), 5, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 140, cy, 52, GOLD);
  } else if (name === 'demo' || name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, GOLD);
  } else if (name === 'winstars') {
    const n = b.data ?? 1;
    for (let i = 0; i < 3; i++) {
      const k = clamp01((S.ovT - 0.25 - i * 0.28) / 0.45);
      const sc = k > 0 ? backOut(k) : 0;
      ctx.save(); ctx.translate(cx + (i - 1) * 110, cy + (i === 1 ? -12 : 4)); ctx.scale(sc, sc);
      star(ctx, 0, 0, 46, i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)', i < n ? '#fff3b0' : null);
      ctx.restore();
    }
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
const ATTRACT = ['cat2', 'trapezoidhouse', 'arrow', 'fish', 'lantern', 'canoe', 'duck', 'crown'];
function attractLevels() {
  const found = ATTRACT.map((id) => LEVELS.find((l) => l.id === id)).filter(Boolean);
  return found.length ? found : [LEVELS[0]];
}

function drawAttract(ctx, S) {
  const list = attractLevels();
  const PERIOD = 10;
  const cyc = Math.floor(S.t / PERIOD);
  const ph = (S.t % PERIOD);
  const lv = list[cyc % list.length];
  const g = levelGeo(lv);
  const s = 66;
  const cx = 360, cy = 650;
  const bb = g.box;
  const mid = [(bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2];
  // halo
  const hg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 300);
  hg.addColorStop(0, 'rgba(232,196,106,0.16)'); hg.addColorStop(1, 'rgba(232,196,106,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, 380, W, 560);
  const pieces = g.poses.map((pose, i) => {
    const c = centroidOfPose(pose);
    const fx = cx + (c[0] - mid[0]) * s, fy = cy + (c[1] - mid[1]) * s;
    const a = hash(cyc * 31 + i) * Math.PI * 2;
    const rad = 330 + hash(cyc * 17 + i) * 90;
    const sx = cx + Math.cos(a) * rad, sy = cy + Math.sin(a) * rad * 0.8;
    const stag = i * 0.13;
    let k = clamp01((ph - 0.3 - stag) / 1.6);
    let out = clamp01((ph - 7.6 - stag * 0.6) / 1.5);
    const pos = backOut(k) * (1 - ease(out));
    return { pose, fx, fy, sx, sy, pos, spin: (hash(cyc * 7 + i) < 0.5 ? -1 : 1) * (2 + i % 3), i };
  });
  for (const p of pieces) {
    const x = p.sx + (p.fx - p.sx) * p.pos, y = p.sy + (p.fy - p.sy) * p.pos;
    const rot = p.pose.r + p.spin * (1 - p.pos);
    drawPiece(ctx, pxOf(p.pose.kind, rot, p.pose.f, 0, 0, s).map(([qx, qy]) => [qx + x, qy + y]), p.pose.kind, { lift: 0.25 * (1 - Math.abs(p.pos - 0.5) * 2) + 0.12 });
  }
  if (ph > 2.2 && ph < 7.8) {
    // shimmer sweep
    const k = ((ph - 2.2) / 1.4) % 3;
    if (k < 1) {
      ctx.save();
      const loops = g.loops.map((l) => l.map(([px, py]) => [cx + (px - mid[0]) * s, cy + (py - mid[1]) * s]));
      outlinePath(ctx, loops); ctx.clip();
      const sx = cx - 250 + k * 500;
      const sg = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.45)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - 80, 400, 160, 520);
      ctx.restore();
    }
  }
}

function drawTitle(ctx, S, ui) {
  background(ctx, S.t, 0, [128, 168]);
  drawAttract(ctx, S);
  const zh = S.lang === 'zh';
  const g = ctx.createLinearGradient(0, 190, 0, 330);
  g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#e8c46a'); g.addColorStop(1, '#b8842c');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 ${zh ? 168 : 128}px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = g;
  ctx.fillText(zh ? '七巧板' : 'Tangram', 360, zh ? 312 : 300);
  ctx.restore();
  if (zh) text(ctx, 'Tangram', 360, 372, 44, 'rgba(244,234,211,0.8)', { font: DISPLAY, weight: 600 });
  else text(ctx, '七巧板 · SEVEN PIECES', 360, 362, 36, 'rgba(244,234,211,0.82)', { weight: 600 });
  text(ctx, tr(S.lang, 'tagline'), 360, 416, 26, 'rgba(244,234,211,0.6)', { weight: 500 });
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawDocScreen(ctx, S, ui) {
  background(ctx, S.t);
  if (ui.panel) panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    text(ctx, ui.nav.label, 360, 1500, 26, 'rgba(244,234,211,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  ctx.fillStyle = `rgba(5,6,18,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, W, H);
  const k = ease(clamp01(S.ovT / 0.3));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = k;
  panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play
function drawBoardPanel(ctx) {
  const r = BOARD;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#272357'); g.addColorStop(1, '#171640');
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.clip();
  // cutting-mat dots
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let y = r.y + 14; y < r.y + r.h; y += 56) for (let x = r.x + 14; x < r.x + r.w; x += 56) ctx.fillRect(x, y, 3, 3);
  const sg = ctx.createRadialGradient(360, 470, 40, 360, 470, 460);
  sg.addColorStop(0, 'rgba(120,110,200,0.18)'); sg.addColorStop(1, 'rgba(120,110,200,0)');
  ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(232,196,106,0.6)'; ctx.lineWidth = 2.5; rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.stroke();
  ctx.strokeStyle = 'rgba(232,196,106,0.18)'; ctx.lineWidth = 1; rr(ctx, r.x + 8, r.y + 8, r.w - 16, r.h - 16, 24); ctx.stroke();
}

function drawTrayPanel(ctx) {
  const r = TRAY_PANEL;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#6e4630'); g.addColorStop(0.5, '#5a3624'); g.addColorStop(1, '#3f2418');
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.clip();
  // wood grain
  for (let i = 0; i < 34; i++) {
    const yy = r.y + 8 + i * 15 + (hash(i) * 6);
    ctx.strokeStyle = `rgba(${i % 2 ? '255,214,170' : '30,12,6'},${0.05 + hash(i + 40) * 0.05})`;
    ctx.lineWidth = 1 + hash(i + 9) * 1.4;
    ctx.beginPath(); ctx.moveTo(r.x, yy);
    for (let x = r.x; x <= r.x + r.w; x += 40) ctx.lineTo(x, yy + Math.sin(x * 0.02 + i) * 3);
    ctx.stroke();
  }
  // inset
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 16;
  rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 34); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(232,196,106,0.55)'; ctx.lineWidth = 2.5; rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,160,0.22)'; ctx.lineWidth = 1.5; rr(ctx, r.x + 12, r.y + 12, r.w - 24, r.h - 24, 22); ctx.stroke();
}

function drawHud(ctx, S, T, title, sub) {
  button(ctx, BACK_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:back' && S.press.active });
  icon(ctx, 'back', BACK_BTN.x + BACK_BTN.w / 2, BACK_BTN.y + BACK_BTN.h / 2, 34);
  if (S.scene === 'play') {
    button(ctx, PAUSE_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
    icon(ctx, 'pause', PAUSE_BTN.x + PAUSE_BTN.w / 2, PAUSE_BTN.y + PAUSE_BTN.h / 2, 34);
  }
  const zh = S.lang === 'zh';
  text(ctx, title, 360, 62, zh ? 38 : 40, PAPER, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  text(ctx, sub, 360, 98, 24, 'rgba(244,234,211,0.65)', { weight: 500 });
}

function banner(ctx, str, y = 138) {
  if (!str) return;
  ctx.font = `700 26px ${UI}`;
  const w = Math.min(640, ctx.measureText(str).width + 56);
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,28,0.78)';
  rr(ctx, 360 - w / 2, y - 24, w, 46, 23); ctx.fill();
  ctx.strokeStyle = 'rgba(232,196,106,0.55)'; ctx.lineWidth = 1.6; rr(ctx, 360 - w / 2, y - 24, w, 46, 23); ctx.stroke();
  ctx.restore();
  text(ctx, str, 360, y + 8, 26, GOLD, { weight: 700 });
}

function drawGuides(ctx, puz) {
  ctx.save();
  ctx.setLineDash([7, 7]);
  ctx.strokeStyle = 'rgba(232,196,106,0.38)'; ctx.lineWidth = 2;
  for (const s of puz.g.slots) { polyPath(ctx, pxPoly(puz.g, s)); ctx.stroke(); }
  ctx.restore();
}

function drawGhost(ctx, puz, slotIdx, color, a, strong) {
  const poly = pxPoly(puz.g, puz.g.slots[slotIdx]);
  polyPath(ctx, poly);
  ctx.fillStyle = alpha(color, a);
  ctx.fill();
  ctx.save();
  ctx.setLineDash(strong ? [10, 7] : [5, 8]);
  ctx.strokeStyle = alpha(color, strong ? 1 : 0.55); ctx.lineWidth = strong ? 4 : 2;
  if (strong) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
  polyPath(ctx, poly); ctx.stroke();
  ctx.restore();
}

function drawPuzzle(ctx, S, T, auto) {
  const puz = S.puz;
  drawBoardPanel(ctx);
  drawCutout(ctx, puz.g.loops.map((l) => l.map(puz.g.toPx)), { top: BOARD.y, bottom: BOARD.y + BOARD.h });
  if (S.guides) drawGuides(ctx, puz);
  // hint / auto-play ghosts
  const pulse = 0.5 + 0.5 * Math.sin(S.t * 5);
  if (auto && auto.phase === 'reveal') {
    for (const si of openSlots(puz)) drawGhost(ctx, puz, si, PIECE_COLORS[puz.g.poses[si].kind], 0.1, false);
  }
  if (puz.hint) {
    const si = puz.hint.slot;
    drawGhost(ctx, puz, si, PIECE_COLORS[puz.g.poses[si].kind], 0.2 + 0.22 * pulse, true);
  }
  if (auto && auto.phase === 'think' && auto.scan != null) {
    drawGhost(ctx, puz, auto.scan, '#ffffff', 0.05 + 0.1 * pulse, false);
  }
  drawTrayPanel(ctx);
  // snap preview ring
  const prev = snapPreview(puz);
  if (prev) {
    polyPath(ctx, prev);
    ctx.fillStyle = 'rgba(255,236,160,0.2)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,160,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
  }
  // pieces in draw order
  for (const idx of puz.order) {
    const p = puz.pieces[idx];
    const poly = displayPolyPx(puz, p);
    const sel = puz.selected === idx;
    let sc = 1 + 0.06 * p.lift;
    if (p.pop > 0) sc *= 1 + 0.07 * Math.sin(p.pop * Math.PI);
    const flip = p.flipT > 0 ? Math.cos((1 - p.flipT) * Math.PI) : 1;
    const hintPiece = puz.hint && puz.hint.piece === idx;
    const autoPiece = auto && (auto.phase === 'reveal') && auto.target && auto.target.piece === idx;
    drawPiece(ctx, poly, p.kind, { lift: p.lift, sx: sc * (p.flipT > 0 ? -flip : 1) * (p.flipT > 0 ? 1 : 1), sy: sc, glow: Math.max(p.glow * 0.8, hintPiece || autoPiece ? 0.55 + 0.45 * pulse : 0), alpha: 1 });
    if (sel && !puz.done && !auto) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.25 * Math.sin(S.t * 6)})`; ctx.lineWidth = 2.5; ctx.setLineDash([9, 6]);
      polyPath(ctx, poly); ctx.stroke(); ctx.restore();
    }
  }
  // rotation handle
  const h = handlePos(puz);
  if (h && !puz.done && !auto) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(h.cx, h.cy); ctx.lineTo(h.x, h.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    const g = ctx.createRadialGradient(h.x - 6, h.y - 8, 2, h.x, h.y, h.r);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#c9953a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, h.r - 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    icon(ctx, 'handle', h.x, h.y, 40, '#3a2410');
    ctx.restore();
  }
  // win sweep
  if (puz.done) {
    ctx.save();
    outlinePath(ctx, puz.g.loops.map((l) => l.map(puz.g.toPx))); ctx.clip();
    const k = (puz.doneT * 0.8) % 2.2;
    const sx = 20 + k / 1.2 * 680;
    const sg = ctx.createLinearGradient(sx - 90, 0, sx + 90, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.5)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(sx - 100, BOARD.y, 200, BOARD.h);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(255,224,130,0.9)'; ctx.shadowBlur = 24 + 10 * Math.sin(puz.doneT * 5);
    ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    outlinePath(ctx, puz.g.loops.map((l) => l.map(puz.g.toPx))); ctx.stroke();
    ctx.restore();
  }
  drawParticles(ctx, puz.parts);
}

function drawToolbar(ctx, S, T) {
  const puz = S.puz;
  const defs = {
    rotL: { icon: 'rotL', label: T('rotL'), off: puz.selected < 0 || puz.done },
    flip: { icon: 'flip', label: T('flip'), off: puz.selected < 0 || puz.done },
    rotR: { icon: 'rotR', label: T('rotR'), off: puz.selected < 0 || puz.done },
    undo: { icon: 'undo', label: T('undo'), off: !puz.history.length || puz.done },
    hint: { icon: 'hint', label: T('hint'), off: puz.done },
    reset: { icon: 'reset', label: T('reset'), off: puz.done },
  };
  TOOLBAR_IDS.forEach((id, i) => {
    const r = toolRect(i), d = defs[id];
    const pressed = S.press && S.press.id === `tool:${id}` && S.press.active;
    button(ctx, r, [], id === 'hint' ? 'primary' : 'normal', { disabled: d.off, pressed, radius: 20 });
    const yy = r.y + (pressed ? 3 : 0);
    ctx.save();
    if (d.off) ctx.globalAlpha = 0.4;
    icon(ctx, d.icon, r.x + r.w / 2, yy + 46, 44, id === 'hint' ? '#3a2410' : PAPER);
    text(ctx, d.label, r.x + r.w / 2, yy + 94, S.lang === 'zh' ? 24 : 20, id === 'hint' ? '#3a2410' : 'rgba(244,234,211,0.85)', { weight: 700 });
    ctx.restore();
  });
}

function drawAutoBar(ctx, S, T, auto) {
  const b = AUTO_BTNS;
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  button(ctx, b.slower, [], 'normal', { disabled: S.thinkIdx === 0, pressed: pr('auto:slower'), radius: 20 });
  icon(ctx, 'minus', b.slower.x + b.slower.w / 2, b.slower.y + 42, 40);
  text(ctx, T('autoSlower'), b.slower.x + b.slower.w / 2, b.slower.y + 92, 22, 'rgba(244,234,211,0.85)', { weight: 700 });
  button(ctx, b.faster, [], 'normal', { disabled: S.thinkIdx === THINK_STEPS.length - 1, pressed: pr('auto:faster'), radius: 20 });
  icon(ctx, 'plus', b.faster.x + b.faster.w / 2, b.faster.y + 42, 40);
  text(ctx, T('autoFaster'), b.faster.x + b.faster.w / 2, b.faster.y + 92, 22, 'rgba(244,234,211,0.85)', { weight: 700 });
  button(ctx, b.pause, [], 'primary', { pressed: pr('auto:pause'), radius: 20 });
  icon(ctx, auto.paused ? 'play' : 'pause', b.pause.x + b.pause.w / 2 - 70, b.pause.y + b.pause.h / 2, 44, '#3a2410');
  text(ctx, auto.paused ? T('autoPlay') : T('autoPause'), b.pause.x + b.pause.w / 2 + 28, b.pause.y + b.pause.h / 2 + 11, 32, '#3a2410', { weight: 800 });
  text(ctx, `${THINK_STEPS[S.thinkIdx]}${T('seconds')}`, 360, 1400, 24, 'rgba(244,234,211,0.7)', { weight: 600 });
}

function drawPlay(ctx, S, ui) {
  const T = (k, v) => tr(S.lang, k, v);
  background(ctx, S.t);
  const puz = S.puz;
  const auto = S.scene === 'auto' ? S.auto : null;
  const lv = puz.level;
  const title = S.daily ? T('dailyTitle') : levelName(S, lv);
  const chap = S.daily ? '' : S.lang === 'zh' ? `第 ${S.levelIdx + 1} 关` : `${T('levelWord')} ${S.levelIdx + 1}`;
  drawHud(ctx, S, T, title, auto ? T('autoSession') : chap);
  drawPuzzle(ctx, S, T, auto);
  if (auto) {
    drawAutoBar(ctx, S, T, auto);
    // status banner
    let msg = '';
    if (auto.phase === 'think') msg = `${T('autoThink')} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t))}`;
    else if (auto.phase === 'reveal') msg = T('autoReveal');
    else if (auto.phase === 'act') msg = T('autoAct');
    else if (auto.phase === 'celebrate') msg = T('autoDone');
    banner(ctx, auto.paused ? T('paused') : msg);
    if (auto.phase === 'think' && !auto.paused) {
      const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, 120, 168, 480, 8, 4); ctx.fill();
      ctx.fillStyle = GOLD; rr(ctx, 120, 168, 480 * frac, 8, 4); ctx.fill();
    }
  } else {
    drawToolbar(ctx, S, T);
    let msg = S.toast ?? '';
    if (!msg && puz.hint) msg = puz.hint.stage === 1 ? T('hintMsg', { p: pieceName(S, KINDS[puz.pieces[puz.hint.piece].kind].type) }) : '';
    if (!msg && !S.daily && S.levelIdx < 2 && !puz.done) {
      if (puz.moves === 0 && puz.selected < 0) msg = T('tipDrag');
      else if (puz.moves < 4 && puz.selected >= 0 && !puz.drag) msg = T('tapRotate');
    }
    banner(ctx, msg);
  }
}

export function render(ctx, S, ui) {
  ctx.textBaseline = 'alphabetic';
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'levels': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'demo-limit':
      background(ctx, S.t);
      panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': case 'auto':
      if (!S.puz) { background(ctx, S.t); break; }
      drawPlay(ctx, S, ui);
      break;
    default: background(ctx, S.t);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { TEXT_SCALES, bbox, decodeSolution, polyOfPose, light, dark, mix, chapterUnlocked, logicalPolyPx, RULES, DOC_PANEL, NAV_PREV, NAV_NEXT };
