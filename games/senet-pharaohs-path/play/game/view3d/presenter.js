// Senet 3D presenter: a lit Egyptian chamber behind the kit's (then transparent) 2D canvas. The sim never sees it: view.js records what it
// would have painted (src/v3.js `rec`), this file draws that record with WebGL2 and maps taps back to squares (v3.pick / v3.proj).
// Board: ebony case with ivory inlay and a drawer, 30 bone tiles (carved, numbered, ornamented), a live House of Water.
// Pieces: lathe-turned faience cones and reels with gilt bands. Sticks: half-round staves that toss, spin on their long axis, land and rock.
// Light: warm key from the upper left with soft shadows, a cool rim, and four oil lamps whose flames flicker and move the light.
import { m4, clamp, lerp, smooth } from './math.js';
import { createRenderer } from './gl.js';
import * as G from './geo.js';
import * as TX from './tex.js';
import { v3 } from '../src/v3.js';
import { BX, BY, CW, CH, TRAYS, SIZEBOX, squareAtCanon } from '../src/layout.js';
import { paintWall, setSprites, PBOX, lcg } from '../src/art.js';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
// ---- world scale: one square = 1.64 x 1.10 world units; the tile tops are at y = TILE_H; the floor (reed mat) at y = FLOOR ----------
const CWW = 1.64, CDW = 1.1, FR = 0.38, TILE_H = 0.075, BASE_H = 0.62, FLOOR = -BASE_H;
const BW = 3 * CWW + 2 * FR, BD = 10 * CDW + 2 * FR;
const cx0 = BX + 1.5 * CW, cy0 = BY + 5 * CH;
const toW = (x, y) => [(x - cx0) / CW * CWW, (y - cy0) / CH * CDW];
const toC = (wx, wz) => [wx / CWW * CW + cx0, wz / CDW * CH + cy0];
const cellW = (i) => { const c = Math.floor(i / 10), k = i % 10, r = c === 1 ? 9 - k : k; return [(c - 1) * CWW, (r - 4.5) * CDW]; };
const DRAWER = { x: CWW, z: 6.12, w: 1.34, d: 0.86, top: -0.1 };
const PS = 1.3, PIECE_H = { 1: 0.8 * PS, 2: 0.72 * PS }, PIECE_R = 0.33 * PS;
const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2)); };

// ---------------------------------------------------------------------------------------------------------------------------------
// Sticks: deterministic toss from the sim's roll (faces, seeds, t). Returns per-stick pose in the stick set's local frame.
// ---------------------------------------------------------------------------------------------------------------------------------
export function stickPoses(roll, calm, L0, wS, tS, rows) {
  const faces = roll ? roll.faces : [true, false, true, false], out = [];
  for (let k = 0; k < 4; k++) {
    const rest = rows[k], light = faces[k];
    let x = rest[0], z = rest[1], yaw = rest[2], phi = light ? 0 : Math.PI, y = 0, roll2 = 0, air = 0;
    if (roll && roll.tumbling && roll.seeds && roll.seeds[k]) {
      const sd = roll.seeds[k], f0 = clamp((roll.t - sd.delay) / Math.max(0.05, roll.dur - sd.delay), 0, 1);
      const A = 0.15, f = (f0 < A ? f0 * f0 / (2 * A) : f0 - A / 2) / (1 - A / 2);   // the hand lets go smoothly (no velocity step at release)
      const LAND = 0.58;
      if (f < LAND) {
        const g = f / LAND; air = 1;
        y = (1 - g) * L0 * 0.16 + 4 * g * (1 - g) * (0.5 + sd.b * 0.35) * L0 * 0.24;
        phi += Math.PI * sd.flips * Math.pow(1 - g, 1.25) * 2;
      } else {
        const h = (f - LAND) / (1 - LAND);
        const sb = Math.sin(Math.min(1, h / 0.34) * Math.PI); y = sb * sb * 0.01 * L0 * (1 - h);   // a real hop: same gravity as the toss, so only a few millimetres   // one small bounce, settling softly
        // a stick that lands on its rounded back (light face up) rocks; on its flat face it only knocks once
        const amp = light ? 0.3 : 0, w = 11;   // flat face down: it stops dead (the knock is the bounce above)
        phi += amp * Math.exp(-h * 4.6) * Math.sin(h * w) * (sd.spin >= 0 ? 1 : -1);
      }
      x += (sd.dx / 100) * (1 - smooth(f)) * L0 * 0.5;
      yaw += sd.spin * Math.pow(1 - f, 2) * 1.4;
      roll2 = (1 - smooth(f / LAND)) * Math.sin(f * 9 + k) * 0.25;
      if (calm) { y *= 0.5; }
    }
    // resting height: on the rounded back when light is up, on the flat face when dark is up
    // in the air the stave turns about its own centre; on the tray it rests on (and rolls over) its lowest point
    const c = Math.cos(phi), sn = Math.abs(Math.sin(phi));
    const contact = Math.max(tS * Math.max(0, c), (wS / 2) * sn * 0.9, 0.002), lift = lerp(contact, light ? tS : 0.002, air);
    out.push({ x, y: y + lift, z: z + (1 - air) * (light ? tS * 0.6 * Math.sin(phi) : 0), yaw, phi, roll2, light });
  }
  return out;
}
export async function createPresenter({ kitCanvas, icon = false }) {
  const canvas = document.createElement('canvas');
  canvas.id = 'senet3d';
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;opacity:0;transition:opacity 420ms ease-out;pointer-events:none;';
  kitCanvas.parentNode.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let R;
  const P = { ok: false, canvas };
  try { R = createRenderer(canvas, { onLost: () => { v3.on = false; }, onRestored: () => { if (P.adopted) v3.on = true; } }); } catch (e) { console.warn('Senet 3D unavailable', e); }
  if (!R) { canvas.remove(); return P; }
  const gl = R.gl;

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Materials and textures
  // ---------------------------------------------------------------------------------------------------------------------------------
  const T = {
    atlas: R.texture(TX.tileAtlas(!icon)), iconBack: icon ? R.texture(TX.iconBackTex()) : null, ebony: R.texture(TX.woodTex(5, '#1c120c', 'rgba(120,84,54,0.7)'), { repeat: true }),
    frame: R.texture(frameTex()), mat: R.texture(TX.matTex(), { repeat: true }), linen: R.texture(TX.linenTex(), { repeat: true }),
    fai1: R.texture(TX.faienceTex(5), { repeat: true }), fai2: R.texture(TX.faienceTex(9), { repeat: true }),
    face: R.texture(TX.stickFaceTex()), back: R.texture(TX.stickBackTex()), blob: R.texture(TX.blobTex()), glow: R.texture(TX.glowTex()),
    inlay: R.texture(TX.inlayTex()), vig: R.texture(TX.vignetteTex()), flame: R.texture(TX.flameTex()), water: R.texture(TX.waterTex(), { repeat: true }),
  };
  const M = {
    frame: { color: [0.5, 0.42, 0.36], map: T.frame, rough: 0.45, spec: 0.3, glaze: 0.06, bump: 0.6 },
    ebony: { color: [0.55, 0.45, 0.38], map: T.ebony, rough: 0.45, spec: 0.3, glaze: 0.06, uvXf: [2, 2, 0, 0] },
    groove: { color: lin('#140c07'), rough: 0.8, spec: 0.05 },
    tile: { color: [0.8, 0.71, 0.56], map: T.atlas, rough: 0.42, spec: 0.3, glaze: 0.1, bump: 2.2 },
    mat: { color: [0.62, 0.5, 0.4], map: T.mat, rough: 0.9, spec: 0.05, bump: 1.6 },
    cone: { color: lin('#2bb3a0'), map: T.fai1, rough: 0.12, spec: 0.7, glaze: 0.8, bump: 0.5, uvXf: [3, 1, 0, 0] },
    reel: { color: lin('#2d55c9'), map: T.fai2, rough: 0.12, spec: 0.7, glaze: 0.8, bump: 0.5, uvXf: [3, 1, 0, 0] },
    gold: { color: lin('#c8963a'), rough: 0.22, spec: 1.2, glaze: 1.3 },
    ivory: { color: lin('#eadcb8'), rough: 0.4, spec: 0.3, glaze: 0.15 },
    face: { color: [1, 1, 1], map: T.face, rough: 0.5, spec: 0.25, glaze: 0.1 },
    back: { color: [1, 1, 1], map: T.back, rough: 0.35, spec: 0.5, glaze: 0.3 },
    linen: { color: [1, 1, 1], map: T.linen, rough: 0.95, spec: 0.03, uvXf: [3, 3, 0, 0], bump: 1.2 },
    clay: { color: lin('#74442a'), rough: 0.85, spec: 0.08 },
    oil: { color: lin('#2a1606'), rough: 0.1, spec: 1, glaze: 0.6 },
    water: { color: [0.75, 0.9, 1.1], map: T.water, rough: 0.05, spec: 1.6, glaze: 1.2, alpha: 0.82, uvXf: [1.5, 1, 0, 0] },
  };

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------------------------------------------------------------------------
  const tf = (x, y, z, rx, ry, rz, sx, sy, sz) => m4.compose(x, y, z, rx, ry, rz, sx, sy, sz);
  const mesh = (g) => R.mesh(g);
  const base = mesh(G.slab(BW, BD, BASE_H, 0.12, 0.06, { bevelSteps: 5 }));
  const groove = mesh(G.slab(3 * CWW + 0.06, 10 * CDW + 0.06, 0.02, 0.03, 0.005));
  const tileGeo = G.slab(CWW - 0.085, CDW - 0.085, TILE_H, 0.045, 0.028, { bevelSteps: 4, sideUv: [0.04, 0.5] });
  const tile = mesh(tileGeo);
  const drawerParts = mesh(G.merge([
    { geo: G.slab(DRAWER.w, DRAWER.d, 0.05, 0.03, 0.01), m: tf(0, -0.4, 0) },
    { geo: G.slab(DRAWER.w, 0.08, 0.4, 0.02, 0.015), m: tf(0, -0.4, DRAWER.d / 2 - 0.04) },
    { geo: G.slab(DRAWER.w, 0.08, 0.4, 0.02, 0.015), m: tf(0, -0.4, -DRAWER.d / 2 + 0.04) },
    { geo: G.slab(0.08, DRAWER.d, 0.4, 0.02, 0.015), m: tf(DRAWER.w / 2 - 0.04, -0.4, 0) },
    { geo: G.slab(0.08, DRAWER.d, 0.4, 0.02, 0.015), m: tf(-DRAWER.w / 2 + 0.04, -0.4, 0) },
  ]));
  const knob = mesh(G.lathe([[0, 0], [0.07, 0], [0.09, 0.04], [0.07, 0.09], [0, 0.1]], 16));
  const floor = mesh(G.plane(90, 90, [90 / 1.1, 90 / 1.1]));
  const conePro = [[0, 0], [0.31, 0], [0.31, 0], [0.325, 0.03], [0.315, 0.07], [0.3, 0.11], [0.275, 0.19], [0.262, 0.205], [0.268, 0.215], [0.245, 0.28], [0.21, 0.37],
    [0.196, 0.385], [0.202, 0.395], [0.17, 0.46], [0.13, 0.56], [0.09, 0.65], [0.058, 0.715], [0.03, 0.76], [0.012, 0.79], [0, 0.8]];
  const reelPro = [[0, 0], [0.31, 0], [0.31, 0], [0.325, 0.025], [0.325, 0.12], [0.3, 0.15], [0.21, 0.19], [0.175, 0.24], [0.162, 0.3], [0.162, 0.42], [0.175, 0.48],
    [0.21, 0.53], [0.3, 0.57], [0.325, 0.6], [0.325, 0.69], [0.3, 0.715], [0.24, 0.72], [0.22, 0.71], [0.12, 0.7], [0, 0.705]];
  const ring = (Rr, y0, rr, seg = 10) => { const pro = []; for (let k = 0; k <= seg; k++) { const a = -Math.PI / 2 + (k / seg) * Math.PI; pro.push([Rr + rr * Math.cos(a), y0 + rr * Math.sin(a)]); } return G.lathe(pro, 40); };
  const cone = mesh(G.lathe(conePro, 48)), reel = mesh(G.lathe(reelPro, 48));
  const coneGold = mesh(G.merge([{ geo: ring(0.322, 0.03, 0.022) }, { geo: ring(0.265, 0.205, 0.013) }, { geo: ring(0.2, 0.39, 0.012) }]));
  const reelGold = mesh(G.merge([{ geo: ring(0.168, 0.36, 0.022) }, { geo: ring(0.326, 0.07, 0.016) }, { geo: ring(0.326, 0.645, 0.016) }, { geo: ring(0.235, 0.718, 0.012) }]));
  const stickBig = G.stave(1, 1, 1);
  const sFace = mesh(stickBig.face), sBack = mesh(stickBig.back);
  const lampBody = mesh(G.lathe([[0, 0], [0.22, 0], [0.22, 0], [0.3, 0.06], [0.36, 0.15], [0.33, 0.2], [0.3, 0.2], [0.26, 0.16], [0, 0.15]], 28));
  const lampOil = mesh(G.lathe([[0, 0.16], [0.27, 0.16]], 24));
  const lampStand = mesh(G.lathe([[0, 0], [0.32, 0], [0.32, 0], [0.3, 0.05], [0.14, 0.12], [0.1, 0.5], [0.13, 0.58], [0.26, 0.62], [0.26, 0.62], [0, 0.62]], 28));
  const trayCache = new Map();
  const quadM = mesh(G.quad(1, 1, -0.5)), flameM = mesh(G.quad(1, 1, 0));

  // ---- static board items -----------------------------------------------------------------------------------------------------------
  const boardItems = [];
  boardItems.push({ mesh: base, model: tf(0, FLOOR, 0), mat: M.frame, cast: true });
  boardItems.push({ mesh: groove, model: tf(0, -0.02, 0), mat: M.groove, cast: false });
  const tileMats = [];
  for (let i = 0; i < 30; i++) {
    const [x, z] = cellW(i); const uv = TX.atlasUv(i);
    const mt = { ...M.tile, uvXf: [uv[0] * 0.97, uv[1] * 0.97, uv[2] + uv[0] * 0.015, uv[3] + uv[1] * 0.015] };
    tileMats.push(mt);
    boardItems.push({ mesh: tile, model: tf(x, 0, z), mat: mt, cast: true });
  }
  boardItems.push({ mesh: drawerParts, model: tf(DRAWER.x, DRAWER.top + 0.4 - 0.4, DRAWER.z), mat: M.ebony, cast: true });
  boardItems.push({ mesh: knob, model: tf(DRAWER.x, DRAWER.top - 0.2, DRAWER.z + DRAWER.d / 2 + 0.01, Math.PI / 2, 0, 0), mat: M.gold, cast: false });
  const waterItem = { mesh: mesh(G.slab(CWW - 0.36, CDW - 0.34, 0.012, 0.08, 0.004)), model: tf(...[cellW(26)[0]], TILE_H - 0.004, cellW(26)[1]), mat: M.water };
  const waterModel = (() => { const [x, z] = cellW(26); return tf(x, TILE_H - 0.004, z); })(); waterItem.model = waterModel;
  const floorItem = { mesh: floor, model: tf(0, FLOOR, 0), mat: M.mat, cast: false };

  // ---- lamps: four clay oil lamps on stands, fixed in the room ------------------------------------------------------------------------
  const LAMPS = [[-(BW / 2 + 1.05), -2.4], [BW / 2 + 1.05, -2.4], [-(BW / 2 + 1.05), 3.2], [BW / 2 + 1.05, 3.2]];
  const lampItems = [];
  for (const [x, z] of LAMPS) {
    lampItems.push({ mesh: lampStand, model: tf(x, FLOOR, z, 0, 0, 0, 1.2), mat: M.clay, cast: true });
    lampItems.push({ mesh: lampBody, model: tf(x, FLOOR + 0.74, z, 0, 0, 0, 1.2), mat: M.clay, cast: true });
    lampItems.push({ mesh: lampOil, model: tf(x, FLOOR + 0.74, z, 0, 0, 0, 1.2), mat: M.oil, cast: false });
  }
  const flameY = FLOOR + 0.74 + 0.27;

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Textures that depend on the screen: the painted wall (screen space, above the floor line)
  // ---------------------------------------------------------------------------------------------------------------------------------
  let wall = { key: '', tex: null, h: 0 };
  function wallFor(L) {
    const key = `${L.w}x${L.h}|${Math.round(L.wallH)}`;
    if (wall.key === key) return wall;
    const sc = Math.min(2, 2048 / L.w), cv = TX.mk(Math.ceil(L.w * sc), Math.ceil(L.wallH * sc + 40 * sc)), c = cv.getContext('2d');
    c.scale(sc, sc); paintWall(c, L.w, Math.round(L.wallH));
    // the wall's foot: a soft shadow strip where it meets the mat
    const g = c.createLinearGradient(0, L.wallH, 0, L.wallH + 40); g.addColorStop(0, 'rgba(15,6,1,0.75)'); g.addColorStop(1, 'rgba(15,6,1,0)'); c.fillStyle = g; c.fillRect(0, L.wallH, L.w, 40);
    if (wall.tex) { wall.tex.src = cv; R.updateTexture(wall.tex); } else wall.tex = R.texture(cv);
    wall.key = key; wall.h = L.wallH + 40;
    return wall;
  }

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Cameras: an eye looking at a target, fitted so a set of world points fills a screen rectangle (virtual units)
  // ---------------------------------------------------------------------------------------------------------------------------------
  function solveCam(target, elev, azim, dist, pts, rect) {
    const eye = [target[0] + dist * Math.cos(elev) * Math.sin(azim), target[1] + dist * Math.sin(elev), target[2] + dist * Math.cos(elev) * Math.cos(azim)];
    const view = m4.lookAt(eye, target);
    let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
    for (const p of pts) { const c = m4.xform(view, p[0], p[1], p[2]); const u = c[0] / -c[2], w = c[1] / -c[2]; u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
    const f = Math.min(rect.w / (u1 - u0), rect.h / (w1 - w0));
    return { eye, target, f, ox: rect.x + rect.w / 2 - f * (u0 + u1) / 2, oy: rect.y + rect.h / 2 + f * (w0 + w1) / 2 };
  }
  function camMats(c, W, H) {
    const view = m4.lookAt(c.eye, c.target);
    return { view, proj: m4.screenPersp(c.f, c.ox, c.oy, W, H, 0.3, 140), eye: c.eye, c, W, H };
  }
  const projPt = (cam, x, y, z) => { const c = m4.xform(cam.view, x, y, z); const d = -c[2]; return { x: cam.c.ox + cam.c.f * c[0] / d, y: cam.c.oy - cam.c.f * c[1] / d, d }; };
  function rayPlane(cam, sx, sy, py) {
    const v = cam.view;   // camera basis vectors are the rows of the view rotation
    const dx = (sx - cam.c.ox) / cam.c.f, dy = -(sy - cam.c.oy) / cam.c.f;
    const right = [v[0], v[4], v[8]], up = [v[1], v[5], v[9]], back = [v[2], v[6], v[10]];
    const d = [right[0] * dx + up[0] * dy - back[0], right[1] * dx + up[1] * dy - back[1], right[2] * dx + up[2] * dy - back[2]];
    const e = cam.eye; if (Math.abs(d[1]) < 1e-6) return null;
    const t = (py - e[1]) / d[1]; if (t < 0) return null;
    return [e[0] + d[0] * t, e[2] + d[2] * t];
  }
  const boardPts = (() => { const p = []; for (const x of [-BW / 2, BW / 2]) for (const z of [-BD / 2, BD / 2 - 0.1]) for (const y of [TILE_H, FLOOR + 0.25]) p.push([x, y, z]); p.push([DRAWER.x, DRAWER.top, DRAWER.z + DRAWER.d / 2]); return p; })();

  function stickItems(list, poses, L0, wS, tS, Mbase) {
    for (const p of poses) {
      // stave geometry is unit-sized (L = 1, w = 1, t = 1): scale x = length, y = back depth, z = width
      const mm = m4.mul(Mbase, m4.mul(m4.compose(p.x, p.y, p.z, 0, p.yaw, p.roll2), m4.mul(m4.compose(0, 0, 0, p.phi, 0, 0), m4.compose(0, 0, 0, 0, 0, 0, L0, tS, wS))));
      list.push({ mesh: sFace, model: mm, mat: M.face, cast: true, dyn: true }, { mesh: sBack, model: mm, mat: M.back, cast: true, dyn: true });
    }
  }

  // ---------------------------------------------------------------------------------------------------------------------------------
  // The tray: a lidless box of ebony with a dyed linen bed (row or card shape), drawn with its own camera into the tray rectangle
  // ---------------------------------------------------------------------------------------------------------------------------------
  const TRAY_ELEV = 58 * DEG;
  function trayModel(v) {
    if (trayCache.has(v)) return trayCache.get(v);
    const Gt = TRAYS[v], w = Gt.w / 100, d = Gt.h / 100 / Math.sin(TRAY_ELEV);
    const box = mesh(G.merge([
      { geo: G.slab(w, d, 0.16, 0.22, 0.05, { bevelSteps: 4 }), m: tf(0, 0, 0) },
    ]));
    const bed = mesh(G.slab(w - 0.22, d - 0.22, 0.04, 0.16, 0.02));
    // sticks: four parallel staves to the left of the result bubble (row) or above it (card)
    const left = v === 'row' ? 0.3 : 0.18, right = v === 'row' ? (Gt.bx - 56) / 100 : w - 0.18;
    const L0 = Math.min(3.7, right - left), cxs = (left + right) / 2 - w / 2;
    const zc = ((v === 'row' ? Gt.sy : Gt.sy) - Gt.h / 2) / 100 / Math.sin(TRAY_ELEV), span = (v === 'row' ? Gt.h - 34 : 118) / 100 / Math.sin(TRAY_ELEV);
    const rows = [0, 1, 2, 3].map((k) => [cxs + [0.04, -0.06, 0.07, -0.03][k], zc + (k - 1.5) * span / 4, [-0.025, 0.02, 0.015, -0.02][k]]);
    const pts = [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [-w / 2, 0, d / 2], [w / 2, 0, d / 2], [-w / 2, 0.16, -d / 2], [w / 2, 0.16, -d / 2]];
    const t = { v, w, d, box, bed, L0, wS: Math.min(0.3, span / 4 * 0.78), rows, pts };
    t.tS = t.wS * 0.42;
    trayCache.set(v, t);
    return t;
  }

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Sprites for the 2D layers (HUD chips, result card, Rules): rendered once from the same lit models
  // ---------------------------------------------------------------------------------------------------------------------------------
  function renderSprites() {
    const SS = 4, mkFbo = (w, h) => {
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
      const db = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, db); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, db);
      return { fb, del: () => { gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb); gl.deleteRenderbuffer(db); } };
    };
    const grab = (w, h, items, cam, env) => {
      const pw = w * SS, ph = h * SS, F = mkFbo(pw, ph);
      gl.viewport(0, 0, pw, ph); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      R.litPass(items, cam, env);
      const px = new Uint8Array(pw * ph * 4); gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); F.del();
      const big = TX.mk(pw, ph), bc = big.getContext('2d'), id = bc.createImageData(pw, ph);
      for (let y = 0; y < ph; y++) id.data.set(px.subarray((ph - 1 - y) * pw * 4, (ph - y) * pw * 4), y * pw * 4);
      bc.putImageData(id, 0, 0);
      const out = TX.mk(w * 2, h * 2), oc = out.getContext('2d'); oc.imageSmoothingQuality = 'high'; oc.drawImage(big, 0, 0, w * 2, h * 2);
      return out;
    };
    const env = lights(0, false);
    // pieces: the sprite box is PBOX (70 x 92 units, foot centre at 35, 74); 25 units = the piece radius
    const k = 25 / 0.33, el = 20 * DEG;
    const eye = [0, 10 * Math.sin(el), 10 * Math.cos(el)], view = m4.lookAt(eye, [0, 0, 0]);
    const proj = m4.ortho(-PBOX.bx / k, (PBOX.w - PBOX.bx) / k, -(PBOX.h - PBOX.by) / k, PBOX.by / k, 0.1, 40);
    const cam = { proj, view, eye };
    const pieceSet = (kind) => [{ mesh: kind === 1 ? cone : reel, model: tf(0, 0, 0, 0, 0.6, 0, 1, 1.0, 1), mat: kind === 1 ? M.cone : M.reel }, { mesh: kind === 1 ? coneGold : reelGold, model: tf(0, 0, 0, 0, 0.6, 0), mat: M.gold }];
    const s1 = grab(PBOX.w, PBOX.h, pieceSet(1), cam, env), s2 = grab(PBOX.w, PBOX.h, pieceSet(2), cam, env);
    // sticks: SBOX 150 x 34, seen from above at a slight tilt, lying along x
    const sw = 150, sh = 34, kk = 140 / 3.0, el2 = 62 * DEG, eye2 = [0, 10 * Math.sin(el2), 10 * Math.cos(el2)];
    const cam2 = { proj: m4.ortho(-sw / 2 / kk, sw / 2 / kk, -sh / 2 / kk, sh / 2 / kk, 0.1, 40), view: m4.lookAt(eye2, [0, 0, 0]), eye: eye2 };
    const stickSet = (light) => { const it = []; stickItems(it, [{ x: 0, y: light ? 0.12 : 0.0, z: 0, yaw: 0, phi: light ? 0 : Math.PI, roll2: 0 }], 3.0, 0.62, 0.26, m4.ident()); return it; };
    const st0 = grab(sw, sh, stickSet(false), cam2, env), st1 = grab(sw, sh, stickSet(true), cam2, env);
    setSprites({ 1: s1, 2: s2, stick: [st0, st1] });
  }

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Lights
  // ---------------------------------------------------------------------------------------------------------------------------------
  const keyDir = (() => { const d = [0.42, -1, 0.34], l = Math.hypot(...d); return d.map((v) => v / l); })();
  const lightView = m4.lookAt([-keyDir[0] * 25, -keyDir[1] * 25, -keyDir[2] * 25], [0, 0, 0.5]);
  const lightVP = m4.mul(m4.ortho(-9.5, 9.5, -9.5, 9.5, 2, 60), lightView);
  const lampPos = new Float32Array(16), lampCol = new Float32Array(12);
  function lights(t, calm) {
    for (let i = 0; i < 4; i++) {
      const fl = calm ? 1 : 1 + 0.1 * Math.sin(t * 9.3 + i * 2.1) + 0.06 * Math.sin(t * 17.7 + i) + 0.04 * Math.sin(t * 3.1 + i * 5);
      lampPos.set([LAMPS[i][0], flameY + 0.25, LAMPS[i][1], 2.3 * fl], i * 4);
      lampCol.set([1.0, 0.56, 0.22], i * 3);
    }
    return {
      lightVP, keyDir, keyCol: [2.35, 1.86, 1.32], sky: [0.3, 0.22, 0.16], ground: [0.09, 0.05, 0.03], rimDir: [-0.2, -0.35, 1], rimCol: [0.55, 0.62, 0.8],
      lamps: LAMPS, lampPos, lampCol, shadowOn: tier > 0, exposure: 0.88, sat: 1.06,
    };
  }

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Per-frame
  // ---------------------------------------------------------------------------------------------------------------------------------
  const liftOf = new Map();
  let tier = 2, ema = 16, last = 0, slow = 0, camCur = null, camFrom = null, blend = 1, lastMode = '', mainCam = null, lastT = 0, pickPieces = [];
  const motes = (() => { const R0 = lcg(77); return Array.from({ length: 34 }, () => ({ x: (R0() - 0.5) * 9, y: R0() * 3.2, z: (R0() - 0.5) * 11, s: 0.02 + R0() * 0.03, p: R0() * TAU, v: 0.04 + R0() * 0.08 })); })();
  const START = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];

  function sizeCanvas() {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, tier === 2 ? 2 : tier === 1 ? 1.5 : 1);
    const w = Math.round((canvas.clientWidth || innerWidth) * dpr), h = Math.round((canvas.clientHeight || innerHeight) * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h };
  }

  function pieceItems(list, fx, p, wx, wz, alpha = 1, extraY = 0, sq = 0, scale = 1) {
    const h = PIECE_H[p.kind] || 0.75, y = TILE_H + extraY;
    const sx = PS * scale * (1 + sq), sy = PS * scale * (1 - sq * 1.4);
    const m = tf(wx, y, wz, 0, 0.6 + p.kind, 0, sx, sy, sx);
    const mat = p.kind === 1 ? M.cone : M.reel;
    const glowE = p.glow === 1 ? [0.16 * (0.6 + 0.4 * (p.pulse ?? 0.5)), 0.11 * (0.6 + 0.4 * (p.pulse ?? 0.5)), 0.02] : p.glow === 2 ? [0.03, 0.16, 0.07] : null;
    const mt = glowE || alpha < 1 ? { ...mat, emis: glowE || [0, 0, 0] } : mat;
    list.push({ mesh: p.kind === 1 ? cone : reel, model: m, mat: mt, cast: true, alpha, dyn: true }, { mesh: p.kind === 1 ? coneGold : reelGold, model: m, mat: M.gold, cast: true, alpha, dyn: true });
    // soft contact shadow (darker when the piece is down, wider and fainter as it lifts)
    const k = clamp(extraY / 0.9, 0, 1), r = PIECE_R * 2.3 * (1 + k * 0.6) * scale;
    fx.push({ mesh: quadM, model: tf(wx + 0.05, TILE_H + 0.003, wz + 0.05, -Math.PI / 2, 0, 0, r, r, 1), map: T.blob, blend: 'mul', tint: [1, 1, 1, 1] , fade: (1 - k * 0.75) * alpha });
    if (p.glow) fx.push({ mesh: quadM, model: tf(wx, TILE_H + 0.006, wz, -Math.PI / 2, 0, 0, 1.25, 1.0, 1), map: T.glow, blend: 'add', tint: p.glow === 1 ? [1, 0.8, 0.35, 0.55 + 0.3 * (p.pulse ?? 0.5)] : [0.45, 1, 0.65, 0.75] });
    void h;
  }

  function draw() {
    const rec = v3.rec;
    if (!rec || R.lost) return;
    const now = performance.now(), frameDt = last ? now - last : 16; last = now;
    ema = ema * 0.95 + frameDt * 0.05;
    if (ema > 30 && tier > 0) { if (++slow > 120) { tier--; slow = 0; R.setShadowSize(tier === 2 ? 2048 : 1024); } } else slow = Math.max(0, slow - 1);
    // the reference pages cover the board almost completely: keep the last frame instead of drawing again
    if (rec.dim >= 0.94 && mainCam) return;
    const L = rec.L, C = rec.C, W = L.w, H = L.h, t = rec.t, calm = rec.calm;
    const dt = clamp(t - lastT, 0, 0.1); lastT = t;
    const { w: cw, h: ch } = sizeCanvas();
    // kit fluid mapping (short side 720; letterbox past 2.4:1)
    let sc = Math.min(cw, ch) / Math.min(W, H); if (Math.max(cw, ch) / Math.min(cw, ch) > 2.4) sc = Math.min(cw / W, ch / H);
    const vx = (cw - W * sc) / 2, vy = (ch - H * sc) / 2;
    gl.viewport(0, 0, cw, ch); gl.clearColor(0.06, 0.03, 0.015, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(Math.round(vx), Math.round(vy), Math.round(W * sc), Math.round(H * sc));

    // ---- camera: the board in its layout box (play), or the hero shot of the starting row (title) ----
    const title = !!rec.title;
    let want;
    if (rec.cam) {
      const k = rec.cam; want = solveCam(k.target, k.elev, k.azim, k.dist, k.pts, k.rect);
    } else if (title) {
      const hr = rec.title.hero, drift = calm ? 0 : Math.sin(t * 0.13) * 7 * DEG, el = (22 + (calm ? 0 : Math.sin(t * 0.09) * 2)) * DEG;
      const pts = []; for (let i = 0; i < 7; i++) { const [x, z] = cellW(i); pts.push([x - 0.3, TILE_H, z], [x + 0.3, TILE_H + 0.8, z]); }
      want = solveCam([-CWW, 0.3, -1.8], el, -40 * DEG + drift, 11, pts, { x: hr.x + hr.w * 0.06, y: hr.y + hr.h * 0.08, w: hr.w * 0.88, h: hr.h * 0.8 });
    } else {
      const B = C.board, rect = C.camRect || { x: B.ox + SIZEBOX.x * B.s, y: B.oy + SIZEBOX.y * B.s, w: SIZEBOX.w * B.s, h: SIZEBOX.h * B.s };
      want = solveCam([0, 0, 0.35], (C.camRect ? 60 : 57) * DEG, 0, C.camRect ? 38 : 21, boardPts, rect);
    }
    const mode = (title ? 't' : 'p') + L.key;
    if (!camCur) camCur = want;
    if (mode !== lastMode) { if (lastMode && lastMode[0] !== mode[0]) { camFrom = { ...camCur }; blend = 0; } else blend = 1; lastMode = mode; }
    if (blend < 1) {
      blend = Math.min(1, blend + (calm ? 1 : frameDt / 750)); const e = smooth(blend);
      camCur = { eye: camFrom.eye.map((v, i) => lerp(v, want.eye[i], e)), target: camFrom.target.map((v, i) => lerp(v, want.target[i], e)), f: lerp(camFrom.f, want.f, e), ox: lerp(camFrom.ox, want.ox, e), oy: lerp(camFrom.oy, want.oy, e) };
    } else camCur = want;
    const cam = camMats(camCur, W, H);
    if (!title) mainCam = cam; else if (!mainCam) mainCam = cam;
    if (!title) mainCam = cam;
    const env = lights(t, calm);

    // ---- items ----
    const items = [], fx = [], trans = [];
    for (const it of boardItems) items.push(it);
    for (const it of lampItems) items.push(it);
    pickPieces = [];
    if (title) {
      const set = rec.startPieces || START.map((k, i) => ({ kind: k, i }));
      for (const p of set) { const [x, z] = cellW(p.i); pieceItems(items, fx, { kind: p.kind }, x, z); }
    } else {
      const seen = new Set();
      for (const p of rec.pieces) {
        const [wx, wz] = toW(p.x, p.y);
        // resting pieces ease into a selection lift (no pop); moving ones follow the tween exactly
        let lift = p.lift || 0;
        if (!p.anim && p.i >= 0) { const cur = liftOf.get(p.i) ?? 0, nx = cur + (lift - cur) * Math.min(1, frameDt / 1000 * 16); liftOf.set(p.i, nx); lift = nx; seen.add(p.i); }
        let extra = lift * (p.moving ? 0.024 : 0.012), sq = 0, alpha = p.alpha ?? 1, scale = p.scale ?? 1;
        if (p.moving && rec.anim) {
          const a = rec.anim;
          if (a.type === 'move' || a.type === 'off') { if (a.f > 0.82 && a.type === 'move') sq = Math.sin((a.f - 0.82) / 0.18 * Math.PI) * 0.07; }
          if (a.type === 'off' && a.f > 0.55) extra -= (a.f - 0.55) / 0.45 * 0.55;
          if (p.sink) extra -= p.sink * 0.55;
        }
        pieceItems(alpha < 1 ? trans : items, fx, p, wx, wz, alpha, extra, sq, scale);
        if (p.i >= 0) pickPieces.push({ i: p.i, x: wx, z: wz, h: PIECE_H[p.kind] });
      }
      for (const i of [...liftOf.keys()]) if (!seen.has(i)) liftOf.delete(i);
    }
    // the House of Water: slow ripples
    const wm = { ...M.water, uvXf: [1.5, 1, (calm ? 0 : t * 0.025) % 1, (calm ? 0 : t * 0.04) % 1] };
    trans.push({ mesh: waterItem.mesh, model: waterModel, mat: wm });
    // glowing inlays for legal moves, hints, the keyboard cursor and the drawer (home)
    for (const mk of rec.marks) {
      const rgb = mk.rgb.split(',').map((v) => Number(v) / 255), pulse = calm ? 0.7 : 0.6 + 0.4 * Math.sin(t * 6);
      let x, z, w = CWW - 0.1, d = CDW - 0.1, y = TILE_H + 0.008;
      if (mk.i === 30) { x = DRAWER.x; z = DRAWER.z; w = DRAWER.w + 0.1; d = DRAWER.d + 0.1; y = DRAWER.top + 0.01; } else [x, z] = cellW(mk.i);
      fx.push({ mesh: quadM, model: tf(x, y, z, -Math.PI / 2, 0, 0, w, d, 1), map: T.inlay, blend: 'add', tint: [rgb[0], rgb[1], rgb[2], mk.cursor ? 0.9 : 0.32 + 0.3 * pulse] });
    }
    // effects of the move animation
    const a = rec.anim;
    if (a) {
      if (a.type === 'water' && a.ring !== undefined) { const [x, z] = cellW(a.dest); for (let r = 0; r < 3; r++) { const k = clamp(a.ring * 1.1 - r * 0.18, 0, 1); if (k <= 0) continue; const s = 0.3 + k * 1.1; fx.push({ mesh: quadM, model: tf(x, TILE_H + 0.012, z, -Math.PI / 2, 0, 0, s * 1.2, s, 1), map: T.inlay, blend: 'add', tint: [0.6, 0.85, 1, 0.7 * (1 - k)] }); } }
      if (a.type === 'off' && a.f > 0.5 && !calm) { const k = (a.f - 0.5) * 2; for (let j = 0; j < 10; j++) { const ang = j * TAU / 10 + j, r = 0.15 + 0.7 * k; fx.push({ mesh: quadM, model: tf(DRAWER.x + Math.cos(ang) * r, DRAWER.top + 0.15 + k * 0.6 + (j % 3) * 0.1, DRAWER.z + Math.sin(ang) * r * 0.6, 0, 0, 0, 0.16 * (1 - k) + 0.04), map: T.glow, blend: 'add', tint: [1, 0.85, 0.45, 1 - k], bill: true }); } }
      if (a.swap && a.f > 0.55 && !calm) { const k = (a.f - 0.55) / 0.45, [x, z] = cellW(a.dest); fx.push({ mesh: quadM, model: tf(x, TILE_H + 0.01, z, -Math.PI / 2, 0, 0, 0.5 + k * 1.4, 0.4 + k * 1.1, 1), map: T.inlay, blend: 'add', tint: [1, 0.9, 0.6, 0.8 * (1 - k)] }); }
      if (a.type === 'move' && a.f > 0.8 && !calm) { const k = (a.f - 0.8) / 0.2, [x, z] = cellW(a.to); for (let j = 0; j < 8; j++) { const ang = j * TAU / 8; fx.push({ mesh: quadM, model: tf(x + Math.cos(ang) * (0.2 + k * 0.35), TILE_H + 0.03 + k * 0.08, z + Math.sin(ang) * (0.18 + k * 0.3), 0, 0, 0, 0.09), map: T.glow, blend: 'add', tint: [1, 0.92, 0.75, 0.35 * (1 - k)], bill: true }); } }
    }
    // title: the sticks tumble on the middle column beside the starting row
    if (rec.sticks && rec.sticks.where === 'hero') {
      // real scale: a stick is about 12 cm against 3.5 cm squares (1 world unit ~ 2.1 cm), so it lies across the whole board
      const SL = 5.2, SW = 0.5, ST = 0.2, rows = [0, 1, 2, 3].map((k) => [0, (k - 1.5) * 0.66, [-0.05, 0.04, 0.03, -0.04][k]]);
      const poses = stickPoses(rec.sticks.roll, calm, SL, SW, ST, rows);
      const before = items.length;
      const sa = rec.stickAt || [1.0, -1.7, Math.PI / 2 + 0.1]; stickItems(items, poses, SL, SW, ST, tf(sa[0], TILE_H, sa[1], 0, sa[2], 0));
      for (let i = before; i < items.length; i += 2) { const p = poses[(i - before) / 2], mm = items[i].model; fx.push({ mesh: quadM, model: tf(mm[12] + 0.06, TILE_H + 0.004, mm[14] + 0.05, -Math.PI / 2, -p.yaw, 0, SL * 1.1, SW * 2, 1), map: T.blob, blend: 'mul', tint: [1, 1, 1, 1], fade: clamp(1 - (p.y - 0.1) / 1.0, 0.2, 1) * 0.8 }); }
    }
    // flames, their glow and dust motes in the light
    for (let i = 0; i < 4; i++) {
      const [x, z] = LAMPS[i], fl = calm ? 1 : 1 + 0.12 * Math.sin(t * 11 + i * 2) + 0.07 * Math.sin(t * 23 + i), sway = calm ? 0 : Math.sin(t * 5.3 + i) * 0.04;
      fx.push({ mesh: quadM, model: tf(x, flameY + 0.25, z, 0, 0, 0, 1.6 * fl, 1.6 * fl), map: T.glow, blend: 'add', tint: [1, 0.6, 0.25, 0.42], bill: true, top: true });
      fx.push({ mesh: flameM, model: tf(x + sway, flameY, z, 0, 0, 0, 0.17, 0.36 * fl), map: T.flame, blend: 'add', tint: [1, 1, 1, 1], bill: true, top: true });
    }
    if (!calm) for (const m of motes) {
      const y = ((m.y + t * m.v) % 3.4) - 0.1, x = m.x + Math.sin(t * 0.3 + m.p) * 0.3, a0 = Math.sin(((y + 0.1) / 3.4) * Math.PI);
      fx.push({ mesh: quadM, model: tf(x, y + 0.2, m.z, 0, 0, 0, m.s, m.s), map: T.glow, blend: 'add', tint: [1, 0.86, 0.6, 0.35 * a0], bill: true, top: true });
    }

    // ---- shadow pass: board, pieces, sticks, lamps ----
    if (tier > 0) R.shadowPass(items.concat(trans), lightVP);
    gl.viewport(Math.round(vx), Math.round(vy), Math.round(W * sc), Math.round(H * sc));
    // ---- floor, then the painted wall over everything above the floor line, then the room ----
    if (rec.iconBg) R.fxPass([{ mesh: quadM, model: tf(W / 2, H / 2, 0, Math.PI, 0, 0, W, H, 1), map: T.iconBack, blend: 'alpha', tint: [1, 1, 1, 1] }], { proj: m4.ortho(0, W, H, 0, -1, 1), view: m4.ident() }, { depthTest: false });
    else R.litPass([floorItem], cam, env);
    const wl = wallFor(L), ortho = { proj: m4.ortho(0, W, H, 0, -1, 1), view: m4.ident() };
    const flick = calm ? 1 : 0.94 + 0.04 * Math.sin(t * 7.1) + 0.02 * Math.sin(t * 13);
    if (!rec.noWall) R.fxPass([{ mesh: quadM, model: tf(W / 2, wl.h / 2, 0, Math.PI, 0, 0, W, wl.h, 1), map: wl.tex, blend: 'alpha', tint: [flick, flick * 0.97, flick * 0.92, 1] }], ortho, { depthTest: false });
    R.litPass(items, cam, env);
    R.fxPass(fx.filter((f) => f.blend === 'mul').map(fadeMul), cam);
    R.litPass(trans, cam, env, { transparent: true });
    R.fxPass(fx.filter((f) => f.blend !== 'mul' && !f.top), cam);

    // ---- the tray, with its own camera, into its layout rectangle ----
    if (rec.sticks && rec.sticks.where === 'tray') {
      const Tt = rec.sticks.T, tm = trayModel(Tt.v), Gt = TRAYS[Tt.v];
      const rect = { x: Tt.x, y: Tt.y, w: Gt.w * Tt.s, h: Gt.h * Tt.s };
      const tc = camMats(solveCam([0, 0.08, 0], TRAY_ELEV, 0, 16, tm.pts, rect), W, H);
      const titems = [{ mesh: tm.box, model: tf(0, 0, 0), mat: M.ebony }, { mesh: tm.bed, model: tf(0, 0.135, 0), mat: M.linen }];
      const poses = stickPoses(rec.sticks.roll, calm, tm.L0, tm.wS, tm.tS, tm.rows);
      const before = titems.length;
      stickItems(titems, poses, tm.L0, tm.wS, tm.tS, tf(0, 0.175, 0));
      const tfx = [];
      for (let i = before; i < titems.length; i += 2) { const p = poses[(i - before) / 2], mm = titems[i].model; tfx.push(fadeMul({ mesh: quadM, model: tf(mm[12] + 0.05, 0.18, mm[14] + 0.04, -Math.PI / 2, -p.yaw, 0, tm.L0 * 1.08, tm.wS * 2.2, 1), map: T.blob, blend: 'mul', fadeTo: clamp(1 - (p.y - 0.1) / 1.2, 0.15, 1) * 0.85 })); }
      if (rec.sticks.invite >= 0) tfx.push({ mesh: quadM, model: tf(0, 0.2, 0, -Math.PI / 2, 0, 0, tm.w * 0.98, tm.d * 0.96, 1), map: T.inlay, blend: 'add', tint: [1, 0.85, 0.45, 0.25 + 0.4 * rec.sticks.invite] });
      R.clearDepth();
      R.litPass(titems, tc, { ...env, shadowOn: false });
      R.fxPass(tfx, tc);
    }
    R.fxPass(fx.filter((f) => f.top), cam);
    R.fxPass([{ mesh: quadM, model: tf(W / 2, H / 2, 0, Math.PI, 0, 0, W * 1.02, H * 1.02, 1), map: T.vig, blend: 'mul', tint: [1, 1, 1, 1] }], ortho, { depthTest: false });
    if (!P.adopted) return;
    if (canvas.style.opacity !== '1') canvas.style.opacity = '1';
  }
  // multiply-blend quads cannot use alpha: fade them toward white instead
  function fadeMul(f) { return { ...f, blend: 'mul', tint: [1, 1, 1, f.fadeTo ?? f.fade ?? 1] }; }

  // ---------------------------------------------------------------------------------------------------------------------------------
  // Hand-off to the game: projection of canonical board points, and tap -> square
  // ---------------------------------------------------------------------------------------------------------------------------------
  v3.proj = (x, y) => { if (!mainCam) return { x, y }; const [wx, wz] = toW(x, y); const p = projPt(mainCam, wx, TILE_H, wz); return { x: p.x, y: p.y }; };
  v3.pick = (sx, sy) => {
    if (!mainCam) return -1;
    let best = -1, bd = 1e9;
    for (const p of pickPieces) {
      const b = projPt(mainCam, p.x, TILE_H, p.z), tp = projPt(mainCam, p.x, TILE_H + p.h, p.z), r = Math.abs(projPt(mainCam, p.x + PIECE_R, TILE_H, p.z).x - b.x) * 1.15;
      if (Math.abs(sx - b.x) <= r && sy >= tp.y - r * 0.3 && sy <= b.y + r * 0.45) { const d = Math.abs(sx - b.x) + Math.abs(sy - (b.y + tp.y) / 2); if (d < bd) { bd = d; best = p.i; } }
    }
    if (best >= 0) return best;
    const hit = rayPlane(mainCam, sx, sy, TILE_H);
    if (!hit) return -1;
    if (Math.abs(hit[0] - DRAWER.x) <= DRAWER.w / 2 + 0.1 && hit[1] >= DRAWER.z - DRAWER.d / 2 - 0.25 && hit[1] <= DRAWER.z + DRAWER.d / 2 + 0.25) return 30;
    const [cx, cy] = toC(hit[0], hit[1]);
    return squareAtCanon(cx, cy);
  };

  // Offline icon render (web/icon.html): the hero corner of the board at a fixed moment, full-bleed square.
  P.renderIcon = (o = {}) => {
    const pts = (o.cells || [0, 1, 2]).flatMap((i) => { const [x, z] = cellW(i); return [[x - 0.45, TILE_H, z - 0.3], [x + 0.45, TILE_H + 1.05, z + 0.3]]; });
    const roll = { faces: [true, false, true, true], n: 3, t: o.stickT ?? 0.55, dur: 1.2, tumbling: true, seeds: [0, 1, 2, 3].map((k) => ({ delay: k * 0.05, flips: 3 + k, b: k * 0.2, dx: (k - 1.5) * 24, spin: (k % 2 ? 1 : -1) * 0.5 })) };
    v3.rec = {
      scene: 'icon', L: { w: 720, h: 720, wallH: 0, key: 'icon' }, C: null, pieces: [], marks: [], anim: null, off: [0, 0], calm: true, t: o.t ?? 2.2, dim: 0, noWall: true, iconBg: true,
      title: { hero: { x: 0, y: 0, w: 720, h: 720 } }, startPieces: o.pieces, stickAt: o.stickAt, sticks: o.sticks === false ? null : { roll, where: 'hero' },
      cam: { target: o.target || [-CWW, 0.4, -3.4], elev: (o.elev ?? 18) * DEG, azim: (o.azim ?? -32) * DEG, dist: o.dist ?? 7, pts, rect: o.rect || { x: 60, y: 90, w: 600, h: 560 } },
    };
    P.adopted = true; draw();
  };
  renderSprites();
  P.ok = true;
  P.draw = draw;
  P.adopt = () => { P.adopted = true; v3.on = true; };
  P.drop = () => { v3.on = false; canvas.style.opacity = '0'; };
  P.tier = () => tier;
  canvas.dataset.ready = '1';
  return P;

  // The ebony case top: grain, an ivory dash inlay round the edge, a gilt line and four gilt rosettes; the playing field is dark (tiles cover it).
  function frameTex() {
    const w = 640, h = Math.round(640 * BD / BW), cv = TX.mk(w, h), c = cv.getContext('2d');
    c.drawImage(TX.woodTex(3, '#1d130c', 'rgba(130,92,60,0.75)', 512, 512, 70), 0, 0, w, h);
    const k = w / BW, fr = FR * k;
    c.fillStyle = '#120a06'; c.fillRect(fr - 4, fr - 4, w - 2 * fr + 8, h - 2 * fr + 8);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, '#e0b04a'); g.addColorStop(1, '#a8761c');
    c.strokeStyle = g; c.lineWidth = 3; c.strokeRect(fr - 12, fr - 12, w - 2 * fr + 24, h - 2 * fr + 24);
    c.fillStyle = '#efe0bd';
    const m = fr * 0.42, dw = 16, dh = 7;
    for (let x = fr; x < w - fr - dw; x += dw * 1.8) { c.fillRect(x, m - dh / 2, dw, dh); c.fillRect(x, h - m - dh / 2, dw, dh); }
    for (let y = fr; y < h - fr - dw; y += dw * 1.8) { c.fillRect(m - dh / 2, y, dh, dw); c.fillRect(w - m - dh / 2, y, dh, dw); }
    c.strokeStyle = 'rgba(239,224,189,0.8)'; c.lineWidth = 2; c.strokeRect(5, 5, w - 10, h - 10);
    return cv;
  }
}
