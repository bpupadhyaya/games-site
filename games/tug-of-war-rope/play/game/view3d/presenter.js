// 3D presenter: READS the simulation (game.getState().pull) and shows the festival ground, the two teams on the rope, the flag and the crowd. It never writes back.
// The simulation owns the flag position and every timing; the figures' poses are scrubbed to agree with the effort / brace / stamina numbers it publishes.
// Portrait looks down the rope from behind your anchor, landscape sees the whole rope side-on. Two-player split screen renders the scene twice, once from behind each team.
import { buildWorld, LOOKS } from './world.js';
import { loadPerson, scrub, setBase } from './team.js';

const LIB = '../vendor3d/index.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const SPACING = 1.05, GAP = 1.5;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  // touch devices (phones, tablets) default to the medium tier: 1.5 pixel ratio, 1024 shadow map, cheaper hands; desktops with plenty of cores get high
  const touch = (nav.maxTouchPoints || 0) > 0 && !(globalThis.matchMedia && globalThis.matchMedia('(hover: hover) and (pointer: fine)').matches);
  if (nav.deviceMemory && nav.deviceMemory <= 2) return 'low';
  const weak = touch || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 9 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.2; stage.camera.far = 400; stage.camera.fov = 50; stage.camera.updateProjectionMatrix();
  const P = { stage, THREE, ready: false, lost: false, lab: null, noRender: false };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let sizeKey = '';
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });
  stage._shadowOffset.set(-7, 12, 6);
  const world = buildWorld(V3, stage); stage.add(world.root);
  P.world = world;

  // ---- the twelve figures: two teams of four, a coach and a judge (loaded in the background; the HUD works without them) ----------------------
  const GENDER = { a: ['athlete_f', 'athlete_m', 'athlete_f', 'athlete_m'], b: ['athlete_m', 'athlete_m', 'athlete_f', 'athlete_m'] };
  const HAIR = { a: ['brown', 'black', 'black', 'ginger'], b: ['black', 'grey', 'brown', 'black'] };
  const SCALE = { a: [0.97, 1.0, 0.98, 1.03], b: [1.0, 1.02, 0.96, 1.04] };
  const team = { a: [], b: [], judge: null, coach: null };
  const lodN = quality === 'high' ? 0 : 1;
  const dress = (person, top, accent, skin, hair) => {
    const h = person.h;
    h.setKit({ top, bottoms: '#262b3a', socks: accent }); h.setSkin(skin); h.setHair(hair);
    if (person.gear.band) person.gear.band.children[0].material.color.set(accent);
  };
  const look = { a: { top: '#c8352b', accent: '#ffd5cf', skins: ['tan', 'light', 'brown', 'tan'] }, b: { top: '#b5651d', accent: '#f2d28b', skins: ['tan', 'light', 'brown', 'tan'] } };
  P.loading = (async () => {
    for (const k of ['a', 'b']) {
      for (let i = 0; i < 4; i++) {
        const p = await loadPerson(V3, { character: GENDER[k][i], kit: { top: look[k].top }, accent: look[k].accent, skin: look[k].skins[i], hair: HAIR[k][i], lod: lodN, scale: SCALE[k][i], anchor: i === 3 });
        stage.add(p.h); stage.track(p.h); team[k].push({ ...p, e: 0, b: 0, pp: 0.2, dly: i * 0.035, k, i });
        dress(p, look[k].top, look[k].accent, look[k].skins[i % 4], HAIR[k][i]);
        if (!P.firstLoaded) P.firstLoaded = true;
      }
    }
    try {
      const j = await loadPerson(V3, { character: 'athlete_f', kit: { top: '#f4f1e6' }, accent: '#d62828', skin: 'tan', hair: 'black', lod: lodN, scale: 1.0 });
      stage.add(j.h); stage.track(j.h); j.h.play('tug_stand', { fade: 0 }); team.judge = j;
      const c = await loadPerson(V3, { character: 'athlete_m', kit: { top: '#f4f1e6' }, accent: '#ffffff', skin: 'brown', hair: 'grey', lod: lodN, scale: 1.0 });
      stage.add(c.h); stage.track(c.h); c.h.play('tug_stand', { fade: 0 }); team.coach = c;
    } catch (e) { console.warn('extras', e); }
    P.ready = true; stage.invalidate();
  })().catch((e) => { console.warn('figures failed to load', e); P.ready = true; });

  // ---- budget: the canvas fills the whole screen; on big screens the pixel ratio is lowered so the buffer stays about phone-sized
  const PIXELS = 2.4e6;
  let budgetR = 1, perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function sizeBudget(w, h) {
    const k = `${w}x${h}|${perfLevel}`;
    if (k !== sizeKey) {
      sizeKey = k; stage.resize();
      const dpr = Math.min(globalThis.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1, perfLevel ? 1.25 : 2);
      budgetR = Math.max(1, Math.min(dpr, Math.sqrt(PIXELS / Math.max(1, w * h))));
    }
    if (Math.abs(stage.renderer.getPixelRatio() - budgetR) > 0.01) { stage.renderer.setPixelRatio(budgetR); stage.invalidate(); }
  }
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) { const avg = perfSum / perfN; perfN = 0; perfSum = 0; if (avg > 24 && perfLevel < 1) { perfLevel++; sizeKey = ''; stage.invalidate(); } }
  }

  // ---- dust puffs where the heels dig in: a small pool of sprites
  const puffTex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(235,220,190,0.9)'); gr.addColorStop(1, 'rgba(235,220,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c; })());
  puffTex.colorSpace = THREE.SRGBColorSpace;
  const puffs = [];
  for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; stage.add(s); puffs.push({ s, v: V(), life: 0, max: 1, size: 1 }); }
  let puffN = 0;
  function emitPuff(x, z, dir, n = 3, size = 0.6) {
    for (let i = 0; i < n; i++) {
      const sp = puffs[puffN++ % puffs.length];
      sp.s.position.set(x + (Math.sin(puffN * 12.9) * 0.2), 0.08, z + Math.cos(puffN * 7.7) * 0.2);
      sp.v.set(-dir * (0.5 + Math.abs(Math.sin(puffN * 3.1)) * 0.8), 0.5 + Math.abs(Math.cos(puffN * 1.7)) * 0.6, (Math.sin(puffN * 5.3)) * 0.4);
      sp.life = sp.max = 0.6 + Math.abs(Math.sin(puffN * 1.9)) * 0.4; sp.size = size * (0.7 + Math.abs(Math.cos(puffN * 2.3)) * 0.8); sp.s.visible = true;
    }
  }
  function stepPuffs(dt) {
    for (const sp of puffs) {
      if (sp.life <= 0) { sp.s.visible = false; continue; }
      sp.life -= dt; sp.v.y -= 0.8 * dt; sp.s.position.addScaledVector(sp.v, dt);
      const u = clamp(sp.life / sp.max, 0, 1); sp.s.material.opacity = u * 0.6; const sz = sp.size * (1.6 - u * 0.7); sp.s.scale.set(sz, sz, 1);
    }
  }

  // ---- cameras. The director returns where the camera wants to be for this moment; the frame smooths towards it.
  function director(d, aspect, view) {
    const flagX = d.flagX, land = aspect > 1.15 && !view.split;
    let pos, look2, fov = 50, k = 0.3, shift = 0;
    const me = d.mode === 'versusB' ? 'b' : 'a';
    const dir = me === 'a' ? 1 : -1;                         // the way the rope runs away from the camera
    const back = (dist, h, off, ahead) => V(flagX - dir * (GAP + SPACING * 3 + dist), h, off * dir * (me === 'a' ? 1 : -1));
    if (d.mode === 'title') {
      const a = -0.55 + Math.sin(d.t * 0.13) * 0.3;
      if (aspect > 1.15) { pos = V(flagX + Math.sin(a) * 3.0 - 2, 1.5 + Math.sin(d.t * 0.17) * 0.25, 9.8); look2 = V(flagX + 0.5, 1.0, 0); fov = 40; shift = -2.6; }
      else { pos = V(flagX - 10.5 + Math.sin(a) * 0.8, 3.0, 4.2); look2 = V(flagX + 0.5, 3.1, 0); fov = 52; }
      k = 0.6;
    } else if (d.mode === 'end') {
      const w = d.winner === 'a' ? -1 : 1;                 // world side of the winners
      const a = d.since * 0.18;
      if (aspect > 1.15) { pos = V(flagX + w * (-2.5) + Math.sin(a) * 2.0, 1.4, 8.8 - d.since * 0.1); look2 = V(flagX + w * 2.0, 1.1, 0); fov = 38; shift = 0; }
      else { pos = V(flagX + w * 1.0 + Math.sin(a) * 1.4, 1.9, 7.4); look2 = V(flagX + w * 3.2, 1.05, 0); fov = 56; }
      k = 0.45;
    } else if (land) {
      const vfov = 37, tf = Math.tan(vfov * Math.PI / 360);
      const half = 6.5;
      const dist = clamp(half / (tf * aspect), 8.4, 22);
      pos = V(flagX * 0.4, 1.75 + dist * 0.06, dist); look2 = V(flagX * 0.4, 0.78, 0); fov = vfov; k = 0.2;
      if (d.mode === 'ready') { pos.z += 1.4; k = 0.4; }
    } else {
      // behind the anchor, looking down the rope, a little to the camera side
      const dist = d.mode === 'ready' ? 4.3 : 3.4;
      pos = back(dist, 3.0 + (d.mode === 'ready' ? 0.4 : 0), 1.25, 0); look2 = V(flagX + dir * 3.0, 0.35, 0.15 * dir * dir); fov = 54; k = 0.22;
      pos.x -= 0; if (d.zoom) fov -= d.zoom * 3;
    }
    return { pos, look: look2, fov, k, shift };
  }
  const cams = { main: { pos: V(-8, 2, 1.7), look: V(0, 1, 0), fov: 52, init: false }, b: { pos: V(8, 2, -1.7), look: V(0, 1, 0), fov: 52, init: false } };
  const smoothCam = (c, dr, dt, snap) => {
    const kk = dt > 0 ? 1 - Math.exp(-dt / Math.max(0.04, dr.k)) : 0;
    if (!c.init || snap) { c.pos.copy(dr.pos); c.look.copy(dr.look); c.fov = dr.fov; c.init = true; } else { c.pos.lerp(dr.pos, kk); c.look.lerp(dr.look, kk); c.fov = lerp(c.fov, dr.fov, kk); }
  };

  // ---- the frame ----------------------------------------------------------------------------------------------------------------------
  let tReal = 0, lastNow = 0, lastEvId = 0, camSnap = 2, flagSm = 0, shake = 0, kick = 0, cheerBoost = 0, titleT = 0, setSeen = '', lastScene = '';
  const feetFx = { a: 0, b: 0 };
  function handleEvents(s, flagX) {
    for (const e of s.events) {
      if (e.id <= lastEvId) continue;
      lastEvId = e.id;
      if (e.type === 'heave') {
        const k = e.side, dir = k === 'a' ? 1 : -1;
        const on = e.g === 'perfect' || e.surge;
        if (on || e.g === 'good') for (let i = 0; i < 4; i++) emitPuff(flagX - dir * (GAP + SPACING * i) - dir * 0.3, k === 'a' ? 0.3 : -0.3, dir, e.surge ? 2 : 1, e.surge ? 0.8 : 0.5);
        if (k === 'a') kick = Math.max(kick, e.g === 'perfect' ? 1 : e.g === 'good' ? 0.7 : 0.3);
        if (e.surge) shake = Math.max(shake, 0.5);
        if (e.g === 'perfect') cheerBoost = Math.min(1, cheerBoost + 0.25);
      } else if (e.type === 'hit') { shake = Math.max(shake, 0.9); } else if (e.type === 'end') cheerBoost = 1;
    }
  }
  function setLook(G) {
    const L = G.look; if (!L) return;
    const key = `${L.setting}|${L.a.top}|${L.b.top}|${L.a.skins.join()}|${L.b.skins.join()}`;
    if (key === setSeen) return;
    setSeen = key;
    world.setSetting(L.setting);
    look.a = L.a; look.b = L.b;
    world.setLineColors(L.a.top, L.b.top);
    for (const k of ['a', 'b']) team[k].forEach((p, i) => dress(p, L[k].top, L[k].accent, L[k].skins[i % 4], HAIR[k][i]));
    if (team.judge) { /* judge keeps her white shirt */ }
    stage.invalidate();
  }

  function poseTeams(G, s, dt, flagX, mood) {
    const t = tReal;
    for (const k of ['a', 'b']) {
      const dir = k === 'a' ? 1 : -1;
      for (const p of team[k]) {
        const h = p.h, i = p.i;
        const xT = flagX - dir * (GAP + SPACING * i), z = k === 'a' ? 0.3 : -0.3;
        // planted feet: the body stays where the feet are and only steps (a quick shuffle with a small lift) when the rope has moved a stride away, so the soles do not skate
        if (p.px === undefined || Math.abs(xT - p.px) > 1.2 || !s || s.ph !== 'pull') { p.px = xT; p.step = 0; }
        const lag = xT - p.px;
        if (p.step || Math.abs(lag) > 0.16 + i * 0.015) { p.step = 1; const mv = Math.min(Math.abs(lag), (1.9 + Math.abs(lag) * 6) * dt); p.px += Math.sign(lag) * mv; if (Math.abs(lag) < 0.03) p.step = 0; }
        const x = p.px, lift = p.step ? 0.035 : 0;
        h.setPosition(x, lift, z); h.setFacing(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        let eT = 0, bT = 0;
        if (s) { eT = s[k].effort; bT = s[k].brace * (s[k].braceHold < 2.5 ? 1 : 0.8); }
        // each puller follows the heave a moment after the one nearer the flag
        p.e += (eT - p.e) * Math.min(1, dt * (eT > p.e ? 22 - i * 3 : 7)); p.b += (bT - p.b) * Math.min(1, dt * (bT > p.b ? 9 : 14));
        if (s && s.ph === 'end') {
          const won = s.winner === k;
          const nm = won ? (s.pt > 1.0 ? 'tug_cheer' : 'tug_win') : 'tug_lose';
          const cur = h.layers.base.current;
          if (!cur || cur.clip.name !== nm) { const lagT = i * 0.08; if (s.pt > lagT) h.play(nm, { fade: 0.12, loop: nm === 'tug_cheer' }); }
        } else if (!s || s.ph === 'ready') {
          const u = s ? clamp((s.t + 3) / 2.4, 0, 1) : 1;
          scrub(h, 'tug_ready', u * u * (3 - 2 * u));
        } else {
          const pT = Math.max(0.5 * p.e, p.b) + 0.025 * Math.sin(t * 1.9 + i * 1.3 + (k === 'a' ? 0 : 2));
          scrub(h, 'tug_main', clamp(pT, 0, 1));
        }
        // both hands on the rope: the left (rope side) hand forward, the right hand just behind it
        const gripW = s && s.ph === 'end' ? 0 : s && s.ph === 'ready' ? ss(-2.2, -0.4, s.t) : 1;
        const ry = G.ropeY || 0.9;
        h.setReach('L', gripW > 0.01 ? V(x + dir * 0.30, ry, 0.0) : null, { weight: gripW });
        h.setReach('R', gripW > 0.01 ? V(x + dir * 0.06, ry - 0.01, 0.0) : null, { weight: gripW });
        // the anchor's waist loop shows while the anchor call lasts
        if (p.gear.loop) p.gear.loop.visible = !!(s && s[k].anchorT > 0 && i === 3);
        h.update(dt);
      }
    }
    void mood;
  }

  function frame(G, view) {
    if (!P.ready || P.lost) return;
    const nowMs = performance.now(); let dt = lastNow ? Math.min(0.05, (nowMs - lastNow) / 1000) : 0; lastNow = nowMs;
    const frozen = !!(G.pauseMenu || (G.watch && G.watch.paused && G.mode === 'watch') || G.think);
    if (frozen) dt = 0;
    tReal += dt;
    const scene = G.scene;
    const s = G.pull && (scene === 'play' || scene === 'result') ? G.pull.s : null;
    stage.setVisible(true);
    const w = canvas.clientWidth || 720, h = canvas.clientHeight || 1280, aspect = w / h;
    sizeBudget(w, h);
    setLook(G);
    const lab = P.lab;
    // the flag follows the sim; in the menus it drifts on its own so the picture lives
    let sx = 0;
    if (lab) sx = lab.x || 0;
    else if (s) sx = s.x; else { titleT += dt; sx = Math.sin(titleT * 0.7) * 0.5; }
    if (!lab && !s) { const k = (Math.sin(titleT * 0.7 * 2) > 0.4 ? 1 : 0); void k; }
    flagSm = lerp(flagSm, -sx, dt > 0 ? 1 - Math.exp(-dt / 0.06) : 1);
    const flagX = lab ? -(lab.x || 0) : flagSm;
    if (s) handleEvents(s, flagX);
    if (!s && !lab) {
      // menu life: a slow pretend pull with soft heaves
      const ph = (titleT % 1.2) / 1.2;
      const fake = { a: { effort: Math.max(0, 1 - ph * 3) * 0.7 + 0.1, brace: 0.1, braceHold: 0, anchorT: 0 }, b: { effort: Math.max(0, 1 - ((ph + 0.5) % 1) * 3) * 0.7 + 0.1, brace: 0.1, braceHold: 0, anchorT: 0 }, ph: 'pull', t: titleT, winner: null };
      poseTeams(G, fake, dt, flagX, 0.1);
    } else if (lab) {
      const fake = { a: { effort: lab.eff || 0, brace: lab.brace || 0, braceHold: 0, anchorT: 0 }, b: { effort: lab.eff || 0, brace: lab.brace || 0, braceHold: 0, anchorT: 0 }, ph: lab.ph || 'pull', t: lab.t === undefined ? 1 : lab.t, pt: lab.pt || 0, winner: lab.winner || null };
      poseTeams(G, fake, 0.0001, flagX, 0);
      if (lab.clip) for (const k of ['a', 'b']) for (const p of team[k]) { const tr = setBase(p.h, lab.clip, { fade: 0, loop: false }); if (tr) { tr.speed = 0; tr.time = lab.time || 0; } p.h.update(0.0001); }
    } else poseTeams(G, s, dt, flagX, 0);
    // rope + flag: hands at the rope; tension follows the rope's speed and both teams' efforts
    const eff = s ? Math.max(s.a.effort, s.b.effort) : 0.3;
    const ropeY = (G.ropeY = 0.92 - (s ? 0.07 * Math.max(s.a.brace, s.b.brace) : 0));
    world.updateRope(flagX, ropeY, clamp(0.55 + 0.4 * eff + (s ? Math.min(0.2, Math.abs(s.v) * 0.3) : 0), 0, 1), tReal, GAP + SPACING * 3 + 0.4, GAP + SPACING * 3 + 0.4);
    // judge, coach
    if (team.judge) { team.judge.h.setPosition(-0.1 * 0, 0, -2.1); team.judge.h.setFacing(0); team.judge.h.update(dt); }
    if (team.coach) { team.coach.h.setPosition(flagX - (GAP + SPACING * 3 + 1.2), 0, -2.0); team.coach.h.setFacing(Math.PI / 2 + 0.5); team.coach.h.update(dt); }
    cheerBoost = Math.max(0, cheerBoost - dt * 0.35);
    const close = s ? 1 - clamp(Math.abs(s.x) / 1.6, 0, 1) : 0;
    const mood = s ? (s.ph === 'end' ? 1 : 0.1 + cheerBoost * 0.8 + (s.ph === 'pull' ? 0.15 : 0)) : 0.12;
    void close;
    world.update(dt, mood, tReal);
    stepPuffs(dt);
    kick = Math.max(0, kick - dt * 3); shake = Math.max(0, shake - dt * 1.8);

    // cameras
    const split = !!(G.split && s);
    const lookState = { split };
    const dBase = { flagX, t: tReal, winner: s ? s.winner : null, since: s ? s.pt : 0, zoom: kick };
    let mode = 'play';
    if (lab) mode = lab.mode || 'play';
    else if (!s) mode = 'title';
    else if (s.ph === 'end') mode = 'end';
    else if (s.ph === 'ready') mode = 'ready';
    const c = stage.camera;
    const apply = (cam, asp) => {
      c.aspect = asp; c.fov = cam.fov; c.position.copy(cam.pos); c.lookAt(cam.look);
      if (cam.shift) { const r = V(1, 0, 0).applyQuaternion(c.quaternion); c.position.addScaledVector(r, cam.shift); c.lookAt(cam.look.clone().addScaledVector(r, cam.shift)); }
      if (shake > 0.01) { c.position.x += Math.sin(tReal * 70) * 0.02 * shake; c.position.y += Math.cos(tReal * 63) * 0.02 * shake; }
      c.updateProjectionMatrix(); c.updateMatrixWorld();
    };
    stage.setShadowTarget(flagX, 0, 0);
    stage.update(0, { renderNow: false });
    if (P.noRender) return;
    const r = stage.renderer;
    if (split) {
      // two views: the bottom (or left) half behind team A, the other half behind team B; face to face in portrait (the second view is rolled 180 degrees)
      const portrait = aspect < 1;
      const hw = portrait ? w : w / 2, hh = portrait ? h / 2 : h;
      const ra = director({ ...dBase, mode: 'play' }, hw / hh, lookState), rb = director({ ...dBase, mode: s.ph === 'end' ? 'end' : 'versusB' }, hw / hh, lookState);
      const da = s.ph === 'end' ? director({ ...dBase, mode: 'end' }, hw / hh, lookState) : ra;
      smoothCam(cams.main, da, dt, camSnap > 0); smoothCam(cams.b, s.ph === 'end' ? da : rb, dt, camSnap > 0);
      r.setScissorTest(true);
      const vp = (x, y, ww, hh2) => { r.setViewport(x, y, ww, hh2); r.setScissor(x, y, ww, hh2); };
      // viewport y is measured from the bottom
      c.up.set(0, 1, 0);
      vp(portrait ? 0 : 0, 0, hw, hh); apply(cams.main, hw / hh); r.render(stage.scene, c);
      if (portrait) { c.up.set(0, -1, 0); vp(0, hh, hw, hh); } else vp(hw, 0, hw, hh);
      apply(cams.b, hw / hh); r.render(stage.scene, c);
      c.up.set(0, 1, 0);
      r.setScissorTest(false); r.setViewport(0, 0, w, h);
    } else {
      let dr = director({ ...dBase, mode }, aspect, lookState);
      if (lab && lab.cam) dr = { pos: V(...lab.cam), look: V(...lab.look), fov: lab.fov || 40, k: 0.1, shift: 0 };
      smoothCam(cams.main, dr, dt, camSnap > 0 || !!lab);
      apply(cams.main, aspect);
      r.render(stage.scene, c);
    }
    if (camSnap > 0) camSnap--;
    perfTick();
    if (G.scene !== lastScene) { lastScene = G.scene; }
  }

  P.setLab = (o) => { P.lab = o ? { ...o } : null; camSnap = 2; if (o && o.cam) { /* explicit camera */ } };
  P.frame = frame; P.team = team; P.world = world; P.cams = cams; P.camSnap = () => { camSnap = 2; };
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      frame(game.getState(), view);
    };
    return game;
  };
  return P;
}
