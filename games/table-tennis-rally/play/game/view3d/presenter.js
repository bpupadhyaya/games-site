// The 3D presenter: reads state.v3 (published by the game each frame) and draws it. Never writes back to the game.
import { THREE } from '../vendor3d/index.js';
import { createPlayers } from './players.js';
import { buildArena } from './arena.js';
import { createSfx } from './sfx.js';

const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let renderer;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  try {
    kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  } catch (e) { canvas.remove(); return { ok: false, wrap: (g) => g }; }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const A = buildArena(renderer, quality);
  const camera = new T.PerspectiveCamera(40, 1, 0.1, 80);
  const sfx = createSfx();
  let players = null;
  const win = globalThis;
  let W = 0, H = 0, dprNow = 0;
  const resize = () => {
    const w = win.innerWidth, h = win.innerHeight, dpr = Math.min(win.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5);
    if (w === W && h === H && dpr === dprNow) return;
    W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  };

  const tmpQ = new T.Quaternion(), tmpV = new T.Vector3(), tmpV2 = new T.Vector3(), ax = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
  let seen = 0, lastT = null, shake = 0, shakeT = 0, clock = 0, ringI = 0, partI = 0;
  const spawn = (x, y, z, o) => {
    const p = A.parts[partI++ % A.parts.length];
    p.life = p.max = o.life ?? 0.5; p.size = o.size ?? 0.12; p.grow = o.grow ?? 0; p.drag = o.drag ?? 2; p.g = o.g ?? 0;
    p.v.set(o.vx ?? 0, o.vy ?? 0, o.vz ?? 0); p.s.position.set(x, y, z); p.s.material.color.set(o.color ?? 0xffffff); p.s.visible = true; p.a0 = o.a ?? 0.9;
  };
  const burst = (x, y, z, n, color, spd, size, life) => { for (let i = 0; i < n; i++) { const a = i * 2.399, e = ((i * 37) % 11) / 11; spawn(x, y, z, { vx: Math.cos(a) * spd * (0.4 + e), vy: spd * (0.3 + e * 0.9), vz: Math.sin(a) * spd * (0.4 + e), color, size, life, drag: 3, g: 4 }); } };
  const ring = (x, z, color, big) => { const r = A.rings[ringI++ % A.rings.length]; r.life = r.max = 0.45; r.m.position.set(x, 0.7625, z); r.m.material.color.set(color); r.big = big; r.m.visible = true; };

  function setCamera(c) {
    const f = c.f * c.k, cxp = c.offX + c.cx * c.k, cyp = c.offY + c.cy * c.k;
    camera.position.set(c.eye[0], c.eye[1], c.eye[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(c.at[0], c.at[1], c.at[2]);
    camera.updateMatrixWorld(true);
    const n = 0.1, fa = 80;
    camera.projectionMatrix.set(2 * f / W, 0, 1 - 2 * cxp / W, 0, 0, 2 * f / H, 2 * cyp / H - 1, 0, 0, 0, -(fa + n) / (fa - n), -2 * fa * n / (fa - n), 0, 0, -1, 0);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  function frame(game, view) {
    const st = game.getState();
    const v3 = api.override || st.v3;
    if (!players) players = createPlayers({ A, scene: A.scene, quality });
    resize();
    if (!v3 || !v3.on) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const tNow = v3.t;
    let dt = lastT === null ? 0 : tNow - lastT; lastT = tNow;
    if (dt < 0 || dt > 0.2) dt = 0;
    const dr = Math.min(0.05, v3.dtReal || 0.016);
    clock += dr;
    sfx.setMuted(!!v3.muted);
    for (const e of v3.events) {
      if (e.id <= seen) continue;
      seen = e.id;
      if (v3.silent) continue;
      sfx.event(e, v3);
      if (v3.haptics && e.type === 'hit' && e.side === 'p' && !e.serve) { try { win.navigator.vibrate?.(e.kind === 'smash' ? 28 : e.perfect ? 16 : 9); } catch { /* no vibration */ } }
      if (e.type === 'hit') {
        players.hit(e);
        const col = e.kind === 'smash' ? 0xff6a3a : e.perfect ? 0xffe27a : 0xcfe6ff;
        burst(e.x, e.y, e.z, e.kind === 'smash' ? 22 : e.perfect ? 14 : 8, col, e.kind === 'smash' ? 2.6 : 1.5, e.kind === 'smash' ? 0.2 : 0.12, 0.5);
        if (e.kind === 'smash') { shake = 0.016; shakeT = 0.25; }
      } else if (e.type === 'bounce') {
        ring(e.x, e.z, e.spin > 0.4 ? 0xffb066 : e.spin < -0.4 ? 0x7fd8ff : 0xffffff, e.vIn);
        burst(e.x, 0.77, e.z, 4, 0xffffff, 0.5, 0.05, 0.28);
      } else if (e.type === 'net') burst(0, 0.85, 0, 6, 0xe8f0ff, 0.8, 0.06, 0.4);
      else if (e.type === 'point') burst(0, 1.3, e.winner === 'p' ? 1.2 : -1.2, e.winner === 'p' ? 26 : 10, e.winner === 'p' ? 0xffd25a : 0x8aa0c0, 2.2, 0.14, 1.0);
    }
    const c = v3.cam;
    if (c) {
      const k = view.cssPerUnit || 1;
      setCamera({ ...c, k, offX: (W - view.width * k) / 2, offY: (H - view.height * k) / 2 });
      if (shakeT > 0) { shakeT -= dr; const k = shake * Math.max(0, shakeT / 0.25); camera.position.x += Math.sin(clock * 90) * k; camera.position.y += Math.cos(clock * 77) * k; camera.updateMatrixWorld(true); }
    }
    if (v3.theme) A.boardMat.color.setHSL(v3.theme.hue / 360, 0.3, 0.9);
    const b = v3.ball;
    A.ballMesh.visible = v3.ballVisible !== false;
    A.ballMesh.position.set(b[0], b[1], b[2]);
    if (v3.spinW && dt > 0) {
      const w = v3.spinW, wl = Math.hypot(w[0], w[1], w[2]);
      if (wl > 1) { ax.set(w[0] / wl, w[1] / wl, w[2] / wl); tmpQ.setFromAxisAngle(ax, Math.min(wl * 0.07, 40) * dt); A.ballMesh.quaternion.premultiply(tmpQ); }
    }
    const onTable = Math.abs(b[0]) < 0.78 && Math.abs(b[2]) < 1.4;
    const gy = onTable ? 0.7625 : 0.005;
    const hgt = Math.max(0, b[1] - gy);
    A.blob.visible = v3.ballVisible !== false;
    A.blob.position.set(b[0], gy + 0.002, b[2]);
    A.blob.scale.setScalar(1 + hgt * 0.8);
    A.blob.material.opacity = clamp(0.38 - hgt * 0.22, 0.06, 0.38);
    if (v3.trailOn && dt > 0) {
      const tr = A.trail, last = tr[tr.length - 1];
      for (let i = 0; i < tr.length - 1; i++) { tr[i].x = tr[i + 1].x; tr[i].y = tr[i + 1].y; tr[i].z = tr[i + 1].z; tr[i].a = tr[i + 1].a; }
      last.x = b[0]; last.y = b[1]; last.z = b[2]; last.a = clamp(v3.speed / 12, 0, 1);
    }
    const tc = v3.trailColor ?? 0xffffff;
    A.trail.forEach((t, i) => {
      const u = i / (A.trail.length - 1);
      const on = v3.trailOn && t.a > 0.15 && t.y > -5;
      t.s.visible = on;
      if (on) { t.s.position.set(t.x, t.y, t.z); t.s.scale.setScalar(0.07 * (0.3 + u)); t.s.material.opacity = 0.5 * u * t.a; t.s.material.color.set(tc); }
    });
    if (!v3.trailOn) A.trail.forEach((t) => { t.y = -9; t.a = 0; });
    if (v3.oppHue !== undefined) players.setOpponentKit(v3.oppHue);
    players.update(v3, dr, tNow, clock, { camera, W, H });
    A.machine.visible = !!v3.machine;
    for (const p of A.parts) {
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.life -= dr;
      const k = Math.max(0, p.life / p.max);
      p.v.y -= p.g * dr; p.v.multiplyScalar(Math.max(0, 1 - p.drag * dr));
      p.s.position.addScaledVector(p.v, dr);
      p.s.scale.setScalar(p.size * (1 + p.grow * (1 - k)) * (0.4 + 0.6 * k));
      p.s.material.opacity = p.a0 * k;
    }
    for (const r of A.rings) {
      if (r.life <= 0) { r.m.visible = false; continue; }
      r.life -= dr;
      const k = 1 - Math.max(0, r.life / r.max);
      r.m.scale.setScalar(1 + k * (2.5 + (r.big || 3) * 0.25));
      r.m.material.opacity = 0.7 * (1 - k);
    }
    renderer.render(A.scene, camera);
  }

  const api = {
    ok: true, sfx, canvas, renderer, override: null, get players() { return players; },
    wrap(game) {
      const r = game.render.bind(game);
      game.render = (ctx, view) => { r(ctx, view); try { frame(game, view); } catch (e) { if (!game.__v3err) { game.__v3err = 1; console.warn('3D frame error', e); } } };
      return game;
    },
    mapping(view) {
      const k = view.cssPerUnit || 1;
      return { k, offX: (win.innerWidth - view.width * k) / 2, offY: (win.innerHeight - view.height * k) / 2 };
    },
  };
  return api;
}
