// Kurash 3D presenter. It READS the bout (game.getState()) and draws the hall, the mat and the two wrestlers in a WebGL canvas behind the kit's 2D
// canvas, which keeps the HUD, the pull pad and every menu. It never writes back: the sim decides every balance point, throw and score.
// The camera is a pure function of the stage rectangle and the canvas size, so the 2D overlays (balance rings, arrows, pops, dust) are placed
// with the same projection (`view.p3.proj`). Without WebGL2 the game keeps its flat top-down art.
import { Wrestler, M, HOME } from './wrestler.js';
import { buildMat, buildVenues } from './venue.js';
import { lookFor } from '../src/view.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SHOT = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const VENUE_IDS = ['courtyard', 'hall', 'arena'];
// store screenshots: how far into the throw the frozen picture is (seconds), ?ft=0.34
const SHOT_FT = (() => { try { const m = /[?&]ft=([0-9.]+)/.exec(globalThis.location.search); return m ? Number(m[1]) : 0.34; } catch { return 0.34; } })();

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const mid = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'low' : mid ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', mode: 'continuous', shadows: quality !== 'low', shadowSize: 3.2 });
  if (!stage.supported) { canvas.remove(); return none; }
  stage.camera.near = 1; stage.camera.far = 90;

  const P = { stage, THREE, quality, ready: false, lost: false, T: 0, p3: null };
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; stage.invalidate(); });

  // the hall and the mat
  const matGroup = buildMat(THREE, quality); stage.add(matGroup);
  const venues = buildVenues(THREE, quality);
  for (const k of VENUE_IDS) { venues[k].grp.visible = false; stage.add(venues[k].grp); }
  // a soft contact shadow under each wrestler (always: reads on every quality tier)
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const blobs = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.008; stage.add(m); return m;
  });

  const W = [new Wrestler(V3, stage, 0), new Wrestler(V3, stage, 1)];
  P.W = W;
  const L0 = [lookFor(0, 0), lookFor(1, 1)];
  P.loading = Promise.all([W[0].load(L0[0], quality), W[1].load(L0[1], quality)]).then(() => { P.ready = true; stage.invalidate(); }).catch((e) => { console.warn('3D wrestlers failed to load', e); P.failed = true; });
  P.ready_p = P.loading;
  // the first frame already shows the wrestlers: wait for them (a failed or very slow load keeps the flat 2D art)
  await Promise.race([P.loading, new Promise((r) => setTimeout(r, 9000))]);

  // ---- camera ---------------------------------------------------------------------------------------------------
  const cam = stage.camera;
  const CAM = { elev: 12 * Math.PI / 180, az: 17 * Math.PI / 180, dist: 9.5, look: new THREE.Vector3(0, 0.98, 0), fw: 2.5, fh: 2.15 };
  let view = { cw: 1, ch: 1, s: 1, mw: 720, mh: 1280, k: 1, ppm: 100 };
  function setCamera(rect, focus, mw, mh) {
    const cw = canvas.clientWidth || 720, ch = canvas.clientHeight || 1280;
    const s = Math.min(cw / mw, ch / mh);
    const offX = (cw - mw * s) / 2, offY = (ch - mh * s) / 2;
    const rx = offX + rect.x * s, ry = offY + rect.y * s, rw = rect.w * s, rh = rect.h * s;
    const ppm = Math.min(rw / CAM.fw, rh / CAM.fh);                 // css px per metre at the mat
    const cx = rx + rw / 2, cy = ry + rh * focus;
    const D = CAM.dist;
    const fov = 2 * Math.atan(ch / (ppm * 2 * D)) * 180 / Math.PI;
    cam.fov = fov; cam.aspect = cw / ch;
    cam.position.set(D * Math.cos(CAM.elev) * Math.sin(CAM.az), CAM.look.y + D * Math.sin(CAM.elev), D * Math.cos(CAM.elev) * Math.cos(CAM.az));
    cam.up.set(0, 1, 0); cam.lookAt(CAM.look);
    cam.setViewOffset(cw, ch, cw / 2 - cx, ch / 2 - cy, cw, ch);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    view = { cw, ch, s, mw, mh, offX, offY, ppm, k: (ppm * M) / s };
  }
  const tmp = new THREE.Vector3();
  const proj = (x, y, h = 0) => {
    tmp.set((x - 500) * M, h, (y - 500) * M).project(cam);
    return { x: ((tmp.x * 0.5 + 0.5) * view.cw - view.offX) / view.s, y: ((-tmp.y * 0.5 + 0.5) * view.ch - view.offY) / view.s };
  };
  P.proj = proj;

  // ---- per-bout bookkeeping -------------------------------------------------------------------------------------
  const S = { B: null, key: -2, venue: '', looks: '' };
  let lastGT = null;
  const showVenue = (id) => {
    if (S.venue === id) return;
    S.venue = id;
    for (const k of VENUE_IDS) venues[k].grp.visible = k === id;
    const v = venues[id];
    stage.setLighting(v.light, { hemi: id === 'arena' ? 0.95 : 0.85, keyI: id === 'arena' ? 3.2 : 3.0 });
    stage.setSky(v.sky[0], v.sky[1], { near: v.fog[0], far: v.fog[1] });
    stage.invalidate();
  };

  function frame(game, vw) {
    if (!P.ready || P.lost) return;
    const G = game.getState();
    let B = null, pose = null, venueId = 'courtyard', looks = [0, 1], rect = null, focus = 0.5, playing = false;
    if (G.scene === 'play' && G.m && G.B) { B = G.B; pose = G.pose; venueId = G.venue; looks = G.looks; rect = G.lay && G.lay.stage; focus = 0.5; playing = true; }
    else if (G.att && G.att.B) { B = G.att.B; pose = G.att.pose; venueId = VENUE_IDS[G.att.venue % 3]; looks = G.att.looks; rect = { x: 0, y: 0, w: vw.w, h: vw.h }; focus = vw.w > vw.h ? 0.5 : 0.62; }
    if (!B || !rect) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    let dt = lastGT === null ? 0 : G.t - lastGT; lastGT = G.t;
    if (G.shotMode || SHOT) { P.shotFrames = (P.shotFrames || 0) + 1; dt = P.shotFrames <= 150 ? 1 / 60 : 0; }   // store screenshots: the picture's clock is the frame count, then it holds
    dt = clamp(dt, 0, 0.1);
    P.T += dt;
    showVenue(venueId);
    const lk = `${looks[0]}|${looks[1]}`;
    if (S.looks !== lk) { S.looks = lk; W[0].setLook(lookFor(0, looks[0])); W[1].setLook(lookFor(1, looks[1])); }
    if (S.B !== B) { S.B = B; S.key = -2; W[0].reset(); W[1].reset(); }
    // a scoring throw: the loser flies over the hip and lands on the back
    if (pose.lastKey !== S.key) {
      S.key = pose.lastKey;
      if (B.last && B.last.how === 'throw' && pose.lastKey >= 0) {
        const loser = 1 - B.last.side;
        const t0 = G.shotMode || SHOT ? 150 / 60 - SHOT_FT : P.T - pose.since;
        W[loser].startFall(t0, { x: B.last.dx, y: B.last.dy }, B.last.kind);
      }
    }
    const over = !!B.over;
    for (let i = 0; i < 2; i++) {
      const w = W[i], r = W[1 - i], s = B.side[i];
      w.update({
        T: P.T, dt, b: s.b, wind: pose.thr[i] > 0.02 ? pose.thr[i] : 0, tdir: pose.tdir[i], rival: r, over,
        celebrate: over && B.over.win === i && B.over.how !== 'decision' && B.over.how !== 'points' ? true : (over && B.over.win === i && r.mode !== 'stand'),
        releaseGrip: r.mode !== 'stand' || (over && B.over.win !== i && r.mode === 'stand' && false) || (G.phase === 'end' && B.over && B.over.win !== i && w.mode !== 'stand'),
      });
      // soft shadow
      const pw = w.mode === 'stand' ? w.pos : w.pelvisWorld();
      blobs[i].position.set(pw.x, 0.008, pw.z);
      const lying = w.mode !== 'stand';
      blobs[i].scale.set(lying ? 1.7 : 0.95, lying ? 0.8 : 0.7, 1);
      blobs[i].rotation.z = 0;
    }
    stage.setShadowTarget(0, 0, 0);
    stage.update(dt);
    P.drawCalls = stage.renderer.info.render.calls; P.tris = stage.renderer.info.render.triangles;
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, vw) => {
      const mw = vw?.width || 720, mh = vw?.height || 1280;
      const G = game.getState();
      let rect = null, focus = 0.5;
      if (G.scene === 'play' && G.m && G.lay && G.lay.stage) rect = G.lay.stage;
      else if (G.att) { rect = { x: 0, y: 0, w: mw, h: mh }; focus = mw > mh ? 0.5 : 0.62; }
      const ok = P.ready && !P.lost && rect;
      if (ok) setCamera(rect, focus, mw, mh);
      const v2 = { ...vw, p3: ok ? { proj, k: view.k, scale: view.ppm } : null };
      r(ctx, v2);
      frame(game, { w: mw, h: mh });
    };
    return game;
  };
  void HOME;
  return P;
}
