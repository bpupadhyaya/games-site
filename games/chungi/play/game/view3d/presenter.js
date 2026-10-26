// 3D presenter for Chungi (game-owned). It only READS what the 2D art hands over each frame (src/glhook.js): the alley camera, where the
// kid stands, what he is doing and where the band ball is. WebGL draws a real 3D kid (view3d Human) on a transparent canvas ABOVE the kit
// canvas (it never takes input). An orthographic projection reproduces the 2D alley camera exactly, so the feet stand on the painted
// floor and the kicking foot meets the painted ball at any size and in both orientations. The ball, hoops, effects and HUD stay 2D.
// Without WebGL2, with ?nogl, on context loss, or while assets are slow (main.js waits 1.6 s) the illustrated 2D kid plays instead.
import { gl } from '../src/glhook.js';
import { ABOUT } from '../src/content.js';
import { meta } from '../src/layout.js';
import { createAlley3d } from './alley3d.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const SCALE = 0.97;                       // 1.75 m: the 2D kid is about 1.75 world units tall
const KIT = { top: '#f4c030', bottoms: '#2a3d8f', socks: '#f2f2f2', shoes: '#fafafa' };

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

// The About page lists the 3D layer's licences once they are loaded (long tokens broken so they wrap at 300 percent text).
function addCredits(text) {
  if (!text || ABOUT.some((p) => p.title === '3D player')) return;
  const brk = (s) => s.replace(/\S{13,}/g, (m) => m.replace(/([/._-])/g, '$1 ').split(' ').map((w) => w.replace(/(.{12})(?=.)/g, '$1 ')).join(' '));
  const paras = String(text).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/^Credits and licences for the Arcforge/.test(x) && !/^Games that ship the 3D layer/.test(x));
  if (!paras.length) return;
  ABOUT.push({ title: '3D player', p: paras.map(brk) });
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:2';
  kitCanvas.parentElement.appendChild(canvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'evening', mode: 'continuous', shadows: false, transparent: true, preserveDrawingBuffer: /[?&](shot|pdb)=/.test(globalThis.location.search) }); } catch { canvas.remove(); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const cam = stage.camera;
  // the 3D alley: its own canvas UNDER the kit canvas (the kit canvas stays transparent over it), separate GL context
  let alley = null, bgCanvas = null;
  try {
    bgCanvas = globalThis.document.createElement('canvas');
    bgCanvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
    kitCanvas.parentElement.insertBefore(bgCanvas, kitCanvas);
    alley = createAlley3d({ THREE: V3.THREE, canvas: bgCanvas, quality });
    bgCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl.bgReady = false; bgCanvas.style.visibility = 'hidden'; });
    bgCanvas.addEventListener('webglcontextrestored', () => { bgDirty = true; });
  } catch (e) { console.warn('3D alley unavailable; the painted alley stays', e); alley = null; try { bgCanvas && bgCanvas.remove(); } catch { /* ignore */ } bgCanvas = null; }
  let bgDirty = true, bgW = 0, bgH = 0;
  stage.scene.fog = null; stage.scene.background = null;
  cam.updateProjectionMatrix = () => {};          // the projection below is ours (the 2D alley camera as an orthographic view)
  stage.setLighting('evening', { exposure: 1.0, hemi: 1.0, hemiSky: 0xffe3cf, hemiGround: 0x7a5a6a, key: 0xffd9b0, keyI: 1.9, rim: 0xb9a4ff, rimI: 0.7 });
  stage.setSky(null, null);
  stage.setShadowTarget(0, 0, 0);
  canvas.style.visibility = 'hidden';
  try { stage.renderer.setClearColor(0x000000, 0); } catch { /* ignore */ }

  const P = { stage, THREE, ready: false, lost: false, locked: false };
  stage.onContextLost(() => { P.lost = true; gl.active = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); gl.active = P.ready; });
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { gl.licenses = t || ''; addCredits(t); }).catch(() => {}); } catch { /* ignore */ }

  let kid = null;
  async function build() {
    const h = await loadHuman({ character: 'athlete_m', kit: KIT, skin: 'tan', hair: 'black', scale: SCALE, lod: quality === 'low' ? 2 : 1, quality });
    h.groundClamp = 'auto'; h.turnRate = 0; h.footPlanting = true;
    h.setFacing(Math.PI); h.play('ready_stance', { fade: 0 });
    stage.add(h); stage.track(h);
    kid = { h, yaw: Math.PI, face: 1, sp: 0, lastX: null, mode: 'ready', ballLast: null, ballV: { x: 0, y: 0 }, kick: null, reachW: 0 };
    P.ready = true; gl.active = !P.lost; stage.invalidate();
  }
  P.ready_p = build().then(() => true).catch((e) => { console.warn('view3d build failed', e); return false; });

  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  const perfTick = (now) => {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) { const avg = perfSum / perfN; perfN = 0; perfSum = 0; if (avg > 24 && perfLevel < 2) { perfLevel++; stage.renderer.setPixelRatio(perfLevel === 1 ? Math.min(1.25, stage.renderer.getPixelRatio()) : 1); stage.invalidate(); } }
  };

  // world metres <-> the 2D alley camera: px = cx + X s, py = floorY - Y s (floorY = where the kid's feet are). Z is depth (alley goes to -Z).
  function setCamera(c) {
    const W = meta.width, H = meta.height, s = c.s;
    cam.position.set(0, 0, 0); cam.quaternion.identity(); cam.updateMatrixWorld(true);
    cam.projectionMatrix.set(
      2 * s / W, 0, 0, 2 * c.cx / W - 1,
      0, 2 * s / H, 0, 1 - 2 * c.floorY / H,
      0, 0, -1 / 20, 0,
      0, 0, 0, 1,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const FOOT_UP = 0.07;                    // ankle sits this far below the ball centre when it strikes (instep)
  function placeKid(F, dt) {
    const K = kid, h = K.h, k = F.kid, c = F.cam, s = c.s;
    // where the 2D ball is, in metres in the alley plane
    const bx = (F.ball.px - c.cx) / s, by = (c.floorY - F.ball.py) / s;
    if (K.ballLast) { const q = Math.min(1, dt * 20); K.ballV.x += (((bx - K.ballLast.x) / Math.max(dt, 1e-3)) - K.ballV.x) * q; K.ballV.y += (((by - K.ballLast.y) / Math.max(dt, 1e-3)) - K.ballV.y) * q; }
    K.ballLast = { x: bx, y: by };
    // ground speed from the sim's own position, eased
    const vx = K.lastX === null || dt <= 0 ? 0 : (k.x - K.lastX) / dt; K.lastX = k.x;
    K.sp += (Math.abs(vx) - K.sp) * (1 - Math.exp(-dt * 14));
    const moving = K.sp > 0.7 && !k.anim;
    if (Math.abs(vx) > 0.5) K.face = vx > 0 ? 1 : -1;
    if (k.anim) K.face = k.anim.side;
    // body: runs side-on while sliding under the ball, otherwise stands 3/4 from behind turned a little to his kicking side
    const target = moving ? (vx >= 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI - 0.5 * K.face;
    K.yaw += wrapPi(target - K.yaw) * (1 - Math.exp(-dt * (moving ? 12 : 7)));
    h.setFacing(K.yaw);
    h.setPosition(k.x, 0, 0);
    if (moving) { h.locomote(Math.max(1.2, K.sp * 0.9)); K.mode = 'run'; }
    else if (K.mode !== 'ready') { h.play('ready_stance', { fade: 0.2, loop: true }); K.mode = 'ready'; }
    // the kicking foot goes to the ball: anticipation while it comes down, contact at anim.t = 0, follow-through up and out
    const a = k.anim;
    const comingDown = by < 1.5 && K.ballV.y < 0.4 && Math.abs(bx - k.x) < 1.15;
    let w = 0, side = K.face > 0 ? 'R' : 'L', tx = bx, ty = by, tz = -0.18;
    if (a) {
      side = a.side > 0 ? 'R' : 'L';
      if (!K.kick || K.kick.n !== a) K.kick = { n: a, x: bx, y: by };      // the strike point: where the ball was at the launch
      const u = clamp(a.t / 0.34, 0, 1);
      const k0 = K.kick;
      tx = k0.x + (K.ballV.x * 0.05) * u; ty = k0.y + 0.1 + 0.45 * u * u;
      w = u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55;
    } else {
      K.kick = null;
      if (comingDown) { w = clamp((1.5 - by) / 1.1, 0, 1) * 0.75; side = bx >= k.x ? 'R' : 'L'; tx = bx; ty = by; }
    }
    K.reachW += (w - K.reachW) * (1 - Math.exp(-dt * (a ? 40 : 12)));
    const other = side === 'R' ? 'L' : 'R';
    h.setReachFoot(other, null);
    if (K.reachW > 0.02) {
      const ankleY = clamp(ty - FOOT_UP, 0.08, 1.15);
      const sx = side === 'R' ? -1 : 1;
      h.setReachFoot(side, V(tx + (side === 'R' ? -0.06 : 0.06), ankleY, tz), clamp(K.reachW, 0, 1));
    } else { h.setReachFoot('L', null); h.setReachFoot('R', null); }
    // eyes follow the ball
    h.lookAt(V(bx, by, 0.5), { weight: 0.85, maxYaw: 1.1, maxPitch: 0.8 });
    return { bx, by };
  }

  const D = { lastT: null };
  function frame(game) {
    if (!P.ready || P.lost) return;
    const F = gl.frame;
    if (!F || !gl.allow) { canvas.style.visibility = 'hidden'; stage.setVisible(false); D.lastT = null; if (bgCanvas) bgCanvas.style.visibility = 'hidden'; gl.bgReady = false; return; }
    canvas.style.visibility = P.locked ? 'hidden' : 'visible';
    P.locked = false;
    const rc = kitCanvas.getBoundingClientRect(), st = canvas.style, w = Math.round(rc.width), hh = Math.round(rc.height);
    if (w > 0 && hh > 0 && (st.width !== w + 'px' || st.height !== hh + 'px' || st.left !== Math.round(rc.left) + 'px' || st.top !== Math.round(rc.top) + 'px')) {
      st.left = Math.round(rc.left) + 'px'; st.top = Math.round(rc.top) + 'px'; st.width = w + 'px'; st.height = hh + 'px'; stage.resize();
    }
    stage.setVisible(true);
    const now = globalThis.performance.now();
    let dt = D.lastT === null ? 0 : F.t - D.lastT; D.lastT = F.t;
    if (dt < 0) dt = 0;
    if (P.manualDt != null) dt = P.manualDt;
    dt = clamp(dt, 0, 0.1);
    void game;
    setCamera(F.cam);
    if (alley && gl.bgFrame && !P.locked) {
      const dprBg = Math.min(quality === 'low' ? 1 : 1.5, globalThis.devicePixelRatio || 1);
      if (bgDirty || bgW !== w || bgH !== hh) { bgW = w; bgH = hh; bgDirty = false; bgCanvas.style.left = st.left; bgCanvas.style.top = st.top; bgCanvas.style.width = w + 'px'; bgCanvas.style.height = hh + 'px'; alley.resize(w, hh, dprBg); }
      alley.render({ cam: gl.bgFrame.cam, kid: F.kid }, gl.bgFrame);
      bgCanvas.style.visibility = 'visible'; gl.bgReady = true;
    }
    placeKid(F, dt);
    stage.update(dt, { renderNow: false });
    stage.render();
    perfTick(now);
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    let warned = false, patched = false;
    game.render = (ctx, view) => {
      if (!patched) {
        // the kit's "demo finished" card is drawn over the game after this render: hide the 3D kid when it appears
        patched = true;
        const fr = ctx.fillRect.bind(ctx);
        ctx.fillRect = (x, y, w, h) => { if (ctx.fillStyle === 'rgba(8, 8, 16, 0.88)') { P.locked = true; canvas.style.visibility = 'hidden'; } return fr(x, y, w, h); };
      }
      r(ctx, view);
      try { frame(game); } catch (e) { if (!warned) { warned = true; console.error('3D frame failed', e && e.stack); } }
    };
    return game;
  };
  return P;
}
