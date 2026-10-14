// Real 3D horses and riders for the broadcast picture (presentation only: reads the per-rider presentation state, never writes to the sim).
//
// Every rider is a Group (horse + man + ball) at the origin of one off-screen WebGL canvas. Once per frame each rider is posed, rendered
// into its own slot of an atlas with a near-orthographic side camera, and the 2D scene blits the slot where the rider stands (in depth order
// with the dust, the ball and the other riders). Falls back to the 2D rig when WebGL2 is missing, the modules fail to load, the context is
// lost, or the page is opened with ?fig=2d.
import { createStage, THREE } from '../vendor3d/index.js';
import { createRider } from './rider.js';

const { Vector3, PerspectiveCamera } = THREE;

// the region of the world that one slot covers (metres, horse space; the model faces +Z, the camera looks along +X)
export const SLOT = { w: 4.8, h: 3.5, groundFrac: 0.945 };      // groundFrac: where the ground point (y = 0) sits, from the top of the slot
const CAM = { dist: 60, elev: 5 * Math.PI / 180, aimY: 1.55 };

export async function createRiders({ quality = 'medium', base, looks, max = 8 } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day', fov: 12 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const renderer = stage.renderer, scene = stage.scene;
  renderer.autoClear = false;
  const cam = new PerspectiveCamera(10, SLOT.w / SLOT.h, 1, 200);

  const riders = await Promise.all(Array.from({ length: max }, (_, i) => createRider({ base, variant: i, ...looks[i % looks.length] })));
  for (const r of riders) { r.group.visible = false; scene.add(r.group); r.setDetail(quality !== 'low'); }
  const api = {
    ok: true, lost: false, quality, riders, canvas, stage,
    slotPx: { w: 0, h: 0 }, cols: 4, rows: 2, ready: false, shown: new Set(),
  };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { try { const sc = stage.scene, old = sc.environment; if (old) { const pm = new THREE.PMREMGenerator(stage.renderer); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); if (old.dispose) old.dispose(); } } catch { /* keep the old light */ } // the image-based light dies with the context: rebuild it
    api.lost = false; api.slotPx.w = 0; });

  // camera aimed so that the origin lands on the ground anchor; returns where (fraction of the slot) the origin projects
  const o = new Vector3();
  function frameCamera() {
    const D = CAM.dist;
    const vfov = 2 * Math.atan(SLOT.h / 2 / D) * 180 / Math.PI;
    cam.fov = vfov; cam.aspect = SLOT.w / SLOT.h; cam.near = 1; cam.far = 200;
    cam.position.set(-D * Math.cos(CAM.elev), CAM.aimY + D * Math.sin(CAM.elev), 0);
    cam.lookAt(0, CAM.aimY, 0);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // shift so that the ground point lands on groundFrac (and the horizontal centre)
    o.set(0, 0, 0).project(cam);
    const wantY = 1 - 2 * SLOT.groundFrac;
    const e = cam.projectionMatrix.elements;
    e[9] -= (wantY - o.y);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  frameCamera();

  /** Make the atlas big enough for `pxPerM` device pixels per metre; returns false when nothing can be drawn. */
  function fit(pxPerM, n) {
    const w = Math.max(96, Math.round(SLOT.w * pxPerM)), h = Math.round(w * SLOT.h / SLOT.w);
    const cols = Math.min(4, Math.max(1, n)), rows = Math.ceil(n / cols);
    // the stage resizes its renderer to the window on every window resize: put the atlas size back whenever that happened
    if (api.slotPx.w === w && api.cols === cols && api.rows === rows && canvas.width === w * cols && canvas.height === h * rows) return;
    api.slotPx.w = w; api.slotPx.h = h; api.cols = cols; api.rows = rows;
    renderer.setPixelRatio(1);
    renderer.setSize(w * cols, h * rows, false);
  }

  const cost = { ema: 0, n: 0, low: false };
  /**
   * Pose and render the riders for this frame.
   * list: [{ id, look, ...pose state }]  (id in 0..max-1; every state field of Rider3D.pose)
   * pxPerM: device pixels per metre of the largest rider on screen.
   */
  api.render = (list, pxPerM) => {
    if (api.lost || !list.length) return false;
    const t0 = globalThis.performance ? performance.now() : 0;
    const cap = api.quality === 'low' ? 78 : 118;
    fit(clamp(pxPerM, 40, cap), Math.min(list.length, max));
    const { w, h } = api.slotPx;
    api.shown.clear();
    renderer.setScissorTest(true);
    renderer.setClearColor(0x000000, 0);
    for (const r of riders) r.group.visible = false;
    let k = 0;
    for (const s of list) {
      const r = riders[s.id % max];
      if (!r || k >= api.cols * api.rows) continue;
      const col = k % api.cols, row = Math.floor(k / api.cols);
      if (s.look) r.setLook(s.look);
      r.pose(s);
      r.group.visible = true;
      const x = col * w, yTop = row * h, yGL = api.rows * h - yTop - h;
      renderer.setViewport(x, yGL, w, h);
      renderer.setScissor(x, yGL, w, h);
      renderer.clear(true, true, true);
      renderer.render(scene, cam);
      r.group.visible = false;
      s.slot = { x, y: yTop, w, h };
      api.shown.add(s.id);
      k++;
    }
    renderer.setScissorTest(false);
    api.ready = true;
    if (t0) {
      const ms = performance.now() - t0;
      cost.ema = cost.n ? cost.ema * 0.93 + ms * 0.07 : ms; cost.n++;
      if (!cost.low && cost.n > 90 && cost.ema > 12 && api.quality !== 'low') { cost.low = true; api.quality = 'low'; stage.setQuality('low'); for (const r of riders) r.setDetail(false); }
    }
    return true;
  };
  api.slotFor = (id) => {
    if (!api.shown.has(id)) return null;
    return api.slotRects[id] || null;
  };
  api.slotRects = {};
  /** Blit rider `id`'s slot so that its ground point lands on (gx, gy) with `s` ctx units per metre. */
  api.blit = (ctx, slot, gx, gy, s) => {
    const k = s / (slot.w / SLOT.w);        // ctx units per atlas pixel
    ctx.drawImage(canvas, slot.x, slot.y, slot.w, slot.h, gx - slot.w * k / 2, gy - SLOT.groundFrac * slot.h * k, slot.w * k, slot.h * k);
  };
  return api;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
