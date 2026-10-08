// The labyrinth itself: stone floor, carved walls, the thread, the lamp, the heart chamber, torchlight and fog.
// Everything is drawn in cell units after one transform (1 cell = 1 unit), from a plain view description `V` (see makeView).
// The same renderer draws the game board, the title hero, the Rules figures and the result screen.
import { theme, mix, rgba, rr } from './ui.js';
import { N, E, S, W, step, cellX, cellY, GRADES } from './maze.js';
import { MARGIN, centerOf, spoolOf } from './play.js';

const hash = (i) => ((Math.imul(i + 1, 2654435761) >>> 0) / 4294967296);
const WALL = 0.21;

// Default view description. Callers override what they need.
export function makeView(m, o = {}) {
  return {
    m, cam: { cx: m.cols / 2, cy: m.rows / 2, v: Math.max(m.cols, m.rows) + 2 * MARGIN + 0.3 }, lamp: null, thread: null, off: null, visited: null, seen: null, light: null, torch: 0,
    hint: null, hintA: 1, look: -1, route: null, t: 0, night: 0.45, goalGlow: 1, showSpool: true, pulse: null, dust: true, ...o,
  };
}
export function fitCam(m) { return { cx: m.cols / 2, cy: m.rows / 2, v: Math.max(m.cols, m.rows) + 2 * MARGIN + 0.3 }; }
// Where the camera wants to be: the whole maze, or following the lamp (clamped to the stone frame).
export function camTarget(m, lamp, grade, map) {
  const fit = fitCam(m), G = GRADES[grade];
  if (map || !G.view) return fit;
  const half = G.view / 2, lo = -MARGIN - 0.15 + half, hix = m.cols + MARGIN + 0.15 - half, hiy = m.rows + MARGIN + 0.15 - half;
  return { cx: lo > hix ? m.cols / 2 : Math.max(lo, Math.min(hix, lamp.x)), cy: lo > hiy ? m.rows / 2 : Math.max(lo, Math.min(hiy, lamp.y)), v: G.view };
}
// screen -> cell for pointer input
export function cellAt(m, rect, cam, px, py) {
  const cs = rect.w / cam.v, wx = cam.cx + (px - rect.x - rect.w / 2) / cs, wy = cam.cy + (py - rect.y - rect.h / 2) / cs;
  const x = Math.floor(wx), y = Math.floor(wy);
  if (x < 0 || y < 0 || x >= m.cols || y >= m.rows) return -1;
  return y * m.cols + x;
}

function wallRuns(m, x0, y0, x1, y1, show) {
  const runs = [], { cols, rows, o } = m;
  const doorY = cellY(m, m.start), doorX = cellX(m, m.start);
  for (let y = y0; y <= y1 + 1 && y <= rows; y++) {       // horizontal lines
    let run = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      let closed = false;
      if (x <= x1 && x < cols) {
        const up = y > 0 ? (y - 1) * cols + x : -1, dn = y < rows ? y * cols + x : -1;
        closed = up < 0 ? !(m.door === N && x === doorX && y === 0 && dn === m.start) : dn < 0 ? !(m.door === S && x === doorX && y === rows && up === m.start) : !(o[up] & S);
        if (closed && show && !((up >= 0 && show(up)) || (dn >= 0 && show(dn)))) closed = false;
      }
      if (closed && run < 0) run = x;
      if (!closed && run >= 0) { runs.push([run, y, x, y]); run = -1; }
    }
  }
  for (let x = x0; x <= x1 + 1 && x <= cols; x++) {       // vertical lines
    let run = -1;
    for (let y = y0; y <= y1 + 1; y++) {
      let closed = false;
      if (y <= y1 && y < rows) {
        const lf = x > 0 ? y * cols + x - 1 : -1, rt = x < cols ? y * cols + x : -1;
        closed = lf < 0 ? !(m.door === W && y === doorY && x === 0 && rt === m.start) : rt < 0 ? !(m.door === E && y === doorY && x === cols && lf === m.start) : !(o[lf] & E);
        if (closed && show && !((lf >= 0 && show(lf)) || (rt >= 0 && show(rt)))) closed = false;
      }
      if (closed && run < 0) run = y;
      if (!closed && run >= 0) { runs.push([x, run, x, y]); run = -1; }
    }
  }
  return runs;
}
function strokeRuns(ctx, runs, ox = 0, oy = 0) {
  ctx.beginPath();
  for (const r of runs) { ctx.moveTo(r[0] + ox, r[1] + oy); ctx.lineTo(r[2] + ox, r[3] + oy); }
  ctx.stroke();
}

function meander(ctx, x, y, len, sz, T) {
  // one band of Greek key running right from (x, y), key height sz
  const n = Math.max(1, Math.floor(len / (sz * 1.1)));
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const ox = x + i * sz * 1.1;
    ctx.moveTo(ox, y + sz); ctx.lineTo(ox, y); ctx.lineTo(ox + sz, y); ctx.lineTo(ox + sz, y + sz * 0.7); ctx.lineTo(ox + sz * 0.35, y + sz * 0.7); ctx.lineTo(ox + sz * 0.35, y + sz * 0.35); ctx.lineTo(ox + sz * 0.7, y + sz * 0.35);
  }
  ctx.stroke();
}

function drawFrame(ctx, m, V, T, vis) {
  const M = MARGIN, w = m.cols, h = m.rows;
  const g = ctx.createLinearGradient(0, -M, 0, h + M);
  g.addColorStop(0, T.frame0); g.addColorStop(1, T.frame1);
  ctx.fillStyle = g; ctx.fillRect(-M - 4, -M - 4, w + 2 * M + 8, h + 2 * M + 8);
  // stepped stone rim
  ctx.lineWidth = 0.05; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeRect(-M + 0.05, -M + 0.05, w + 2 * M - 0.1, h + 2 * M - 0.1);
  ctx.strokeStyle = 'rgba(255,240,210,0.18)'; ctx.strokeRect(-M + 0.1, -M + 0.1, w + 2 * M - 0.2, h + 2 * M - 0.2);
  // Greek key bands on the four sides
  const sz = 0.36, band = 0.18;
  ctx.lineWidth = 0.05; ctx.strokeStyle = T.key; ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  meander(ctx, 0.2, -M + band + 0.04, w - 0.4, sz, T); meander(ctx, 0.2, h + M - band - sz - 0.04, w - 0.4, sz, T);
  ctx.save(); ctx.translate(-M + band + sz + 0.04, 0.2); ctx.rotate(Math.PI / 2); meander(ctx, 0, 0, h - 0.4, sz, T); ctx.restore();
  ctx.save(); ctx.translate(w + M - band - 0.04, 0.2); ctx.rotate(Math.PI / 2); meander(ctx, 0, 0, h - 0.4, sz, T); ctx.restore();
  ctx.lineCap = 'butt';
}

function drawFloor(ctx, m, V, T, x0, y0, x1, y1) {
  ctx.fillStyle = T.floorA; ctx.fillRect(0, 0, m.cols, m.rows);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * m.cols + x, h = hash(i);
    if (h > 0.45) { ctx.fillStyle = rgba(T.floorB.length === 7 ? T.floorB : '#b69470', 0.35 + 0.65 * h); ctx.fillRect(x, y, 1, 1); }
  }
  // flagstone joints
  ctx.beginPath(); ctx.lineWidth = 0.025; ctx.strokeStyle = 'rgba(40,24,10,0.20)';
  for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(x, y0); ctx.lineTo(x, y1 + 1); }
  for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(x0, y); ctx.lineTo(x1 + 1, y); }
  ctx.stroke();
  // soft ambient occlusion along the walls: darker floor at the rim of the maze
  ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.strokeRect(0.25, 0.25, m.cols - 0.5, m.rows - 0.5);
  if (V.dust && V.visited) {
    ctx.fillStyle = 'rgba(255,238,205,0.13)';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (V.visited[y * m.cols + x]) ctx.fillRect(x + 0.04, y + 0.04, 0.92, 0.92);
  }
}

function polyline(ctx, pts, off, dx = 0, dy = 0) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const o = off ? off[i] || 0 : 0, x = p.x + nx * o + dx, y = p.y + ny * o + dy;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

function drawSpool(ctx, m, T, t) {
  const p = spoolOf(m);
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0.06, 0.11, 0.3, 0.26, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.arc(0, 0, 0.29, 0, 7); ctx.fill();
  const g = ctx.createRadialGradient(-0.08, -0.08, 0.02, 0, 0, 0.27); g.addColorStop(0, '#d4a066'); g.addColorStop(1, '#7a4f2c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 0.26, 0, 7); ctx.fill();
  ctx.fillStyle = T.thread0; ctx.beginPath(); ctx.arc(0, 0, 0.19, 0, 7); ctx.fill();
  ctx.strokeStyle = T.thread1; ctx.lineWidth = 0.025;
  for (let r = 0.06; r < 0.19; r += 0.04) { ctx.beginPath(); ctx.arc(0, 0, r, 0.4, 5.6); ctx.stroke(); }
  ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.arc(0, 0, 0.045, 0, 7); ctx.fill();
  ctx.restore();
}

function drawRosette(ctx, cx, cy, t, T, glow) {
  ctx.save(); ctx.translate(cx, cy);
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.62);
  bg.addColorStop(0, mix('#1b3a63', '#ffffff', 0.05)); bg.addColorStop(1, '#10223d');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 0.44, 0, 7); ctx.fill();
  ctx.lineWidth = 0.035; ctx.strokeStyle = T.gold; ctx.stroke();
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate((i * Math.PI) / 4);
    ctx.fillStyle = i % 2 ? '#d1693f' : '#f0d58a';
    ctx.beginPath(); ctx.moveTo(0, -0.07); ctx.quadraticCurveTo(0.12, -0.2, 0, -0.38); ctx.quadraticCurveTo(-0.12, -0.2, 0, -0.07); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = mix(T.gold, '#ffffff', 0.35 * pulse * glow); ctx.beginPath(); ctx.arc(0, 0, 0.09, 0, 7); ctx.fill();
  ctx.restore();
}

function drawLamp(ctx, x, y, t, T) {
  const fl = 1 + 0.07 * Math.sin(t * 11) + 0.05 * Math.sin(t * 27.3);
  ctx.save(); ctx.translate(x, y); ctx.scale(1.45, 1.45);
  const hg = ctx.createRadialGradient(0.1, -0.08, 0, 0.1, -0.08, 0.5); hg.addColorStop(0, 'rgba(255,225,150,0.55)'); hg.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = hg; ctx.fillRect(-0.5, -0.6, 1.2, 1.2);
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(0.04, 0.1, 0.19, 0.11, 0, 0, 7); ctx.fill();
  // clay body
  const g = ctx.createLinearGradient(0, -0.1, 0, 0.12); g.addColorStop(0, '#d98f55'); g.addColorStop(1, '#7c3f22');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0.02, 0.17, 0.1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a2413'; ctx.beginPath(); ctx.ellipse(0.12, -0.02, 0.07, 0.035, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.5)'; ctx.beginPath(); ctx.ellipse(-0.05, -0.03, 0.07, 0.025, -0.3, 0, 7); ctx.fill();
  // flame
  const fx = 0.12, fy = -0.04, fh = 0.27 * fl;
  const fg = ctx.createLinearGradient(0, fy, 0, fy - fh); fg.addColorStop(0, '#fff3c4'); fg.addColorStop(0.45, T.lamp); fg.addColorStop(1, 'rgba(255,120,40,0.1)');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.bezierCurveTo(fx + 0.1, fy - fh * 0.4, fx + 0.03, fy - fh * 0.8, fx + 0.01 * Math.sin(t * 13), fy - fh); ctx.bezierCurveTo(fx - 0.04, fy - fh * 0.7, fx - 0.1, fy - fh * 0.4, fx, fy); ctx.fill();
  ctx.restore();
}

// Draw the maze into `rect` (screen units) with view description V.
export function drawMaze(ctx, rect, V) {
  const T = theme(), m = V.m, cam = V.cam, cs = rect.w / cam.v;
  ctx.save();
  rr(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(26, rect.w * 0.035)); ctx.clip();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2); ctx.scale(cs, cs); ctx.translate(-cam.cx, -cam.cy);
  const hv = cam.v / 2 + 1.2, x0 = Math.max(0, Math.floor(cam.cx - hv)), x1 = Math.min(m.cols - 1, Math.ceil(cam.cx + hv)), y0 = Math.max(0, Math.floor(cam.cy - hv)), y1 = Math.min(m.rows - 1, Math.ceil(cam.cy + hv));
  const fog = V.seen && V.torch > 0;
  drawFrame(ctx, m, V, T);
  drawFloor(ctx, m, V, T, x0, y0, x1, y1);

  // route glow (result / Rules figures) and hint thread
  const glowPath = (cells, a, width) => {
    if (!cells || cells.length < 1) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); cells.forEach((c, i) => { const p = centerOf(m, c); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.lineWidth = width * 1.9; ctx.strokeStyle = rgba(T.gold, 0.16 * a); ctx.stroke();
    ctx.lineWidth = width; ctx.strokeStyle = rgba(T.gold, 0.55 * a); ctx.stroke();
    ctx.lineWidth = width * 0.4; ctx.strokeStyle = rgba('#fff4cf', 0.9 * a); ctx.stroke();
    ctx.restore();
  };
  if (V.route) glowPath(V.route, 0.9, 0.2);
  if (V.hint && V.hint.length) glowPath(V.hint, V.hintA * (0.75 + 0.25 * Math.sin(V.t * 5)), 0.2);
  if (V.look >= 0) {
    const p = centerOf(m, V.look), a = 0.5 + 0.5 * Math.sin(V.t * 5);
    const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 0.9); rg.addColorStop(0, rgba(T.gold, 0.55 * a + 0.15)); rg.addColorStop(1, rgba(T.gold, 0));
    ctx.fillStyle = rg; ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  }

  if (V.opts) for (const c of V.opts) {
    const p = centerOf(m, c), a = 0.6 + 0.4 * Math.sin(V.t * 6);
    ctx.lineWidth = 0.07; ctx.strokeStyle = rgba(T.gold, 0.85 * a); ctx.beginPath(); ctx.arc(p.x, p.y, 0.3 + 0.04 * Math.sin(V.t * 6), 0, 7); ctx.stroke();
    const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 0.55); rg.addColorStop(0, rgba(T.gold, 0.35 * a)); rg.addColorStop(1, rgba(T.gold, 0)); ctx.fillStyle = rg; ctx.fillRect(p.x - 0.6, p.y - 0.6, 1.2, 1.2);
  }

  // heart chamber
  const gp = centerOf(m, m.goal);
  { const rg = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, 0.8); rg.addColorStop(0, rgba(T.gold, 0.45)); rg.addColorStop(1, rgba(T.gold, 0)); ctx.fillStyle = rg; ctx.fillRect(gp.x - 1, gp.y - 1, 2, 2); }
  drawRosette(ctx, gp.x, gp.y, V.t, T, V.goalGlow);

  // thread: shadow, strands, highlight
  if (V.thread && V.thread.length > 1) {
    const pts = V.thread, off = V.off;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    polyline(ctx, pts, off, 0.035, 0.05); ctx.lineWidth = 0.15; ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.stroke();
    polyline(ctx, pts, off); ctx.lineWidth = 0.115; ctx.strokeStyle = T.thread0; ctx.stroke();
    ctx.lineCap = 'butt'; ctx.setLineDash([0.07, 0.07]); ctx.lineDashOffset = 0; ctx.lineWidth = 0.105; ctx.strokeStyle = T.thread1; ctx.stroke();
    ctx.setLineDash([]); ctx.lineCap = 'round';
    polyline(ctx, pts, off, -0.018, -0.022); ctx.lineWidth = 0.03; ctx.strokeStyle = 'rgba(255,224,200,0.55)'; ctx.stroke();
    ctx.lineCap = 'butt';
  }

  const fogRgb = T.fog.length === 7 ? T.fog : '#07040a';
  if (fog) {
    ctx.fillStyle = rgba(fogRgb, 0.99);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!V.seen[y * m.cols + x]) ctx.fillRect(x - 0.01, y - 0.01, 1.02, 1.02);
  }

  // walls
  const showEdge = fog ? (i) => !!V.seen[i] : null;
  const runs = wallRuns(m, x0, y0, x1, y1, showEdge);
  ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
  ctx.lineWidth = 0.28; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; strokeRuns(ctx, runs, 0.09, 0.12);
  ctx.lineWidth = 0.21; ctx.strokeStyle = 'rgba(0,0,0,0.26)'; strokeRuns(ctx, runs, 0.07, 0.095);
  ctx.lineWidth = WALL + 0.025; ctx.strokeStyle = T.wallSide; strokeRuns(ctx, runs, 0.012, 0.03);
  ctx.lineWidth = WALL; ctx.strokeStyle = T.seam; strokeRuns(ctx, runs);
  ctx.lineCap = 'butt'; ctx.setLineDash([0.52, 0.03]); ctx.lineWidth = WALL - 0.014; ctx.strokeStyle = T.wallTop; strokeRuns(ctx, runs, -0.004, -0.004);
  ctx.setLineDash([]);
  ctx.lineCap = 'square'; ctx.lineWidth = 0.035; ctx.strokeStyle = T.wallHi; strokeRuns(ctx, runs, -0.045, -0.05);
  ctx.lineWidth = 0.05; ctx.strokeStyle = rgba(T.wallTop2.length === 7 ? T.wallTop2 : '#c7ae86', 0.55); strokeRuns(ctx, runs, 0.04, 0.045);
  ctx.lineCap = 'butt';

  // doorway posts and threshold
  { const c = centerOf(m, m.start), dx = m.door === E ? 0.5 : m.door === W ? -0.5 : 0, dy = m.door === S ? 0.5 : m.door === N ? -0.5 : 0, px = dy ? 0.5 : 0, py = dx ? 0.5 : 0;
    ctx.fillStyle = mix(T.wallTop, '#000000', 0.12); ctx.fillRect(c.x + dx - (dx ? 0.1 : 0.5), c.y + dy - (dy ? 0.1 : 0.5), dx ? 0.2 : 1, dy ? 0.2 : 1);
    for (const sgn of [-1, 1]) {
      const qx = c.x + dx + sgn * px, qy = c.y + dy + sgn * py;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(qx - 0.13 + 0.06, qy - 0.13 + 0.08, 0.26, 0.26);
      ctx.fillStyle = T.wallSide; ctx.fillRect(qx - 0.14, qy - 0.12, 0.28, 0.28);
      ctx.fillStyle = T.wallTop; ctx.fillRect(qx - 0.14, qy - 0.14, 0.27, 0.27);
      ctx.fillStyle = T.wallHi; ctx.fillRect(qx - 0.14, qy - 0.14, 0.27, 0.03);
    }
  }
  if (V.showSpool) drawSpool(ctx, m, T, V.t);

  // lamp
  if (V.lamp) drawLamp(ctx, V.lamp.x, V.lamp.y, V.t, T);

  // fog and torchlight
  const wx0 = cam.cx - hv - 2, wy0 = cam.cy - hv - 2, ww = hv * 2 + 4;
  if (fog) {
    // remembered but not lit, and a soft feather where the light stops at unexplored cells
    const light = V.light;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * m.cols + x;
      if (!V.seen[i]) continue;
      const l = light ? light.get(i) : undefined;
      const a = V.map ? 0.12 : l === undefined ? 0.6 : 0.6 * Math.max(0, Math.min(1, (1 - l) * 1.25 - 0.1));
      if (a > 0.01) { ctx.fillStyle = rgba(fogRgb, a); ctx.fillRect(x - 0.02, y - 0.02, 1.04, 1.04); }
      const f = 0.5;
      for (const [dx, dy, gx0, gy0, gx1, gy1, rx, ry, rw, rh] of [[0, -1, 0, 0, 0, f, 0, 0, 1, f], [0, 1, 0, 1, 0, 1 - f, 0, 1 - f, 1, f], [-1, 0, 0, 0, f, 0, 0, 0, f, 1], [1, 0, 1, 0, 1 - f, 0, 1 - f, 0, f, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.cols || ny >= m.rows || V.seen[ny * m.cols + nx]) continue;
        const g = ctx.createLinearGradient(x + gx0, y + gy0, x + gx1, y + gy1); g.addColorStop(0, rgba(fogRgb, 0.85)); g.addColorStop(1, rgba(fogRgb, 0));
        ctx.fillStyle = g; ctx.fillRect(x + rx, y + ry, rw, rh);
      }
    }
  }
  if (V.lamp && !V.map) {
    const fl = 1 + 0.025 * Math.sin(V.t * 9) + 0.02 * Math.sin(V.t * 23), R = (fog ? V.torch + 0.8 : 8.5) * fl;
    const d = ctx.createRadialGradient(V.lamp.x, V.lamp.y, R * 0.22, V.lamp.x, V.lamp.y, R * 1.15);
    const nc = T.night.slice(T.night.indexOf('(') + 1, T.night.lastIndexOf(',')), na = Number(T.night.slice(T.night.lastIndexOf(',') + 1, -1));
    d.addColorStop(0, `rgba(${nc},0)`); d.addColorStop(1, `rgba(${nc},${(fog ? na * 0.9 : na * V.night / 0.45 * 0.5).toFixed(3)})`);
    ctx.fillStyle = d; ctx.fillRect(wx0, wy0, ww, ww);
    ctx.globalCompositeOperation = 'lighter';
    const w1 = ctx.createRadialGradient(V.lamp.x, V.lamp.y, 0, V.lamp.x, V.lamp.y, R * 0.8);
    w1.addColorStop(0, rgba(T.lamp, T.dark ? 0.30 : 0.16)); w1.addColorStop(1, rgba(T.lamp, 0));
    ctx.fillStyle = w1; ctx.fillRect(wx0, wy0, ww, ww);
    ctx.globalCompositeOperation = 'source-over';
  } else if (!fog) {
    // no lamp (title hero / figures): even, light vignette only
  }
  // heart beacon, visible through the dark
  if (fog) {
    ctx.globalCompositeOperation = 'lighter';
    const b = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, 2.2); b.addColorStop(0, rgba(T.gold, 0.28 + 0.06 * Math.sin(V.t * 2))); b.addColorStop(1, rgba(T.gold, 0));
    ctx.fillStyle = b; ctx.fillRect(gp.x - 2.3, gp.y - 2.3, 4.6, 4.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = V.seen[m.goal] ? 0 : 0.55; if (ctx.globalAlpha > 0) drawRosette(ctx, gp.x, gp.y, V.t, T, V.goalGlow); ctx.globalAlpha = 1;
  }
  ctx.restore();
  // rim of the board
  rr(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(26, rect.w * 0.035)); ctx.lineWidth = 3; ctx.strokeStyle = T.rim; ctx.stroke();
}
