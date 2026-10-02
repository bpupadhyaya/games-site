// The 3D presenter: reads the sim (game.getState(): sc.actors, sc.events, sc.phase) and draws it. It never writes back: positions, contact
// times and outcomes belong to the sim; every clip is retimed (playTimed / timeWarp) so its contact frame lands on the sim's contact time.
// Animation time = difference of the sim clock, so a paused match freezes the picture and a headless run is reproducible.
import { buildCourt } from './court.js';
import { addKabaddiClips } from './clips.js';
import { createDirector } from './director.js';
import { makeContacts } from './contacts.js';

const LIB = '../vendor3d/index.js';
import { FINGER_POSES, blendFingerPose } from '../vendor3d/rig.js';
const frac = (n) => ((n * 2654435761) >>> 0) / 4294967296;      // deterministic per-player variation (no randomness, no clock)
const POOL = 11;
const KITS = [{ top: '#2f6fd6', bottoms: '#f2f2f2', socks: '#2f6fd6', shoes: '#f2f2f2', trim: '#cfe0ff' }, { top: '#d8453a', bottoms: '#2a2a2e', socks: '#d8453a', shoes: '#2a2a2e', trim: '#ffd0c8' }];
const SKINS = ['clay', 'wood', 'peach', 'tan', 'brown', 'deep', 'peach'];
const HAIRS = ['black', 'black', 'brown', 'black', 'grey', 'black', 'ginger'];
const COURT = { W: 10, HALF: 6.5, BONUS: 4.75 };
const toWorld = (team, x, u) => (team === 0 ? { x: x - COURT.W / 2, z: u } : { x: COURT.W / 2 - x, z: -u });

// Quality tier: 'high' (DPR 2, 2048 shadows), 'medium' (DPR 1.5, 1024) or 'low' (DPR 1, no shadows, fewer detailed players). ?q=low|medium|high overrides.
function pickQuality(q) {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  if (q) return q;
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}
export async function createPresenter({ kitCanvas, quality }) {
  quality = pickQuality(quality);
  const fallback = { stage: null, wrap: (g) => g };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return fallback; }
  const { createStage, loadHuman, THREE } = V3;

  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', shadowSize: 6 });
  // one shadow-casting person (the raider) on the high tier; the medium and low tiers draw only blob shadows (a whole shadow pass is about 4-7k triangles)
  const shadowMaps = quality === 'high';
  if (!shadowMaps) stage.renderer.shadowMap.enabled = false;
  if (!stage.supported) { canvas.remove(); return fallback; }
  let lost = false;
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; });
  stage.setLighting('indoor');
  stage.setSky(0x0e1a21, 0x0e1a21, { near: 22, far: 60 });
  const court = buildCourt(THREE);
  stage.add(court);
  const camera = stage.camera;
  const director = createDirector(THREE, camera);
  const contacts = makeContacts(THREE);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ---- the pool of players ---------------------------------------------------------------------------------------------------------------
  let blobs = null; try { blobs = stage.enableBlobShadows ? stage.enableBlobShadows(POOL) : null; } catch { blobs = null; }
  const pools = { m: null, f: null };
  const lodCache = {};
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.3, roughness: 1, depthWrite: false });
  const shadowGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.01, 18);
  async function loadPool(kind) {
    if (pools[kind]) return pools[kind];
    const list = [];
    const hs = await Promise.all(Array.from({ length: POOL }, () => loadHuman({ character: kind === 'f' ? 'mannequin_f' : 'mannequin_m', kit: KITS[0], quality })));
    for (const h of hs) {
      addKabaddiClips(h);
      h.addLayer('live', { mask: 'all', additive: true, weight: 1 }); h.addLayer('react', { mask: 'upper', additive: true, weight: 0 });
      h.root.visible = false; h.turnRate = 9; h.groundClamp = 'auto';
      const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.visible = false; sh.renderOrder = 1; stage.scene.add(sh);
      stage.add(h); stage.track(h);
      list.push({ human: h, shadow: sh, g: -1, ctrl: null, react: 0 });
    }
    pools[kind] = list;
    return list;
  }
  let pool = null, poolKind = 'm', ready = false, loading = false;
  const warm = async () => {
    if (loading) return; loading = true;
    try {
      pool = await loadPool('m'); poolKind = 'm'; ready = true;
      try { stage.renderer.compile?.(stage.scene, camera); } catch { /* optional */ }
      stage.invalidate();
    } catch (e) { console.warn('3D players failed to load; keeping the 2D court', e); }
    loading = false;
  };
  warm();

  // ---- per-actor control ------------------------------------------------------------------------------------------------------------------
  const byG = new Map();            // actor g -> pool entry
  const castKey = { v: '' };
  let catching = false, seen = 0, lastT = null, lastPhase = '', matchKey = '', raidDir = 1, shownVisible = false;
  const entry = (g) => byG.get(g);

  function releaseAll() { for (const [g, e] of [...byG]) { e.human.root.visible = false; e.shadow.visible = false; e.g = -1; e.ctrl = null; byG.delete(g); } castKey.v = ''; }
  function assign(sc, wantPool) {
    const shown = sc.actors.filter((a) => a.show);
    const key = `${poolKind}:${shown.map((a) => a.g).join(',')}`;
    if (key === castKey.v) return;
    castKey.v = key;
    const keep = new Set(shown.map((a) => a.g));
    for (const [g, e] of [...byG]) if (!keep.has(g)) { e.human.root.visible = false; e.shadow.visible = false; e.g = -1; e.ctrl = null; byG.delete(g); }
    for (const a of shown) {
      if (byG.has(a.g)) continue;
      const free = wantPool.find((e) => e.g === -1);
      if (!free) continue;
      free.g = a.g; byG.set(a.g, free);
      const h = free.human;
      h.setKit(KITS[a.team]); h.setSkin(SKINS[(a.g * 3 + a.idx) % SKINS.length]); h.setHair(HAIRS[(a.g + a.idx) % HAIRS.length]);
      h.setPosition(a.wx, 0, a.wz); h.setFacing(a.yaw);
      h.root.visible = true; free.shadow.visible = true;
      free.ctrl = { until: -1, mode: '', partner: null, kind: '' };
      h.play('idle', { fade: 0 });
      h.setFingers('both', 'relaxed');
      h.play('k_live', { layer: 'live', fade: 0, loop: true, startTime: frac(a.g * 7 + 3) * 2.8, speed: 0.75 + frac(a.g * 11 + 5) * 0.6 });
      h.play('k_react', { layer: 'react', fade: 0, loop: false });
      free.react = 0;
    }
    stage.invalidate();
  }

  // the loop a player returns to when no action clip is running
  function idleFor(e, a, now) {
    const h = e.human, c = e.ctrl;
    if (now < c.until) return;
    c.kind = ''; c.partner = null;
    const moving = a.speed > 0.45;
    let mode;
    if (moving) mode = 'loco';
    else if (a.role === 'raider') mode = `k_raid_stance_${a.g % 2}`;
    else if (a.role === 'def') mode = `k_def_stance_${(a.g * 5 + a.idx * 3) % 4}`;
    else mode = 'idle_relaxed';
    if (mode === 'loco') { h.locomote(Math.min(7, a.speed)); c.mode = 'loco'; }
    else if (c.mode !== mode) {
      const clip = h.clips[mode];
      h.play(mode, { fade: 0.3, loop: true, startTime: clip && clip.loop ? frac(a.g * 13 + 1) * clip.dur : 0, speed: 0.88 + frac(a.g * 17 + 2) * 0.26 });
      c.mode = mode;
    }
  }
  const playOnce = (e, name, now, o = {}) => {
    const h = e.human;
    if (!h.hasClip(name)) return null;
    h.play(name, { fade: catching ? 0 : (o.fade ?? 0.12), loop: !!o.loop, startTime: o.startTime ?? 0 });
    e.ctrl.mode = name; e.ctrl.until = o.loop ? 1e9 : now + (o.hold ?? (h.clips[name].dur - (o.startTime ?? 0)));
    return h.clips[name];
  };
  const timed = (e, name, eta, now, dt, o = {}) => {
    const h = e.human;
    if (!h.hasClip(name)) return;
    const clip = h.clips[name];
    h.playTimed(name, 'contact', Math.max(0.001, eta), { fade: catching ? 0 : (o.fade ?? 0.12), frameDt: dt });
    e.ctrl.mode = name; e.ctrl.until = now + Math.max(0, eta) + (clip.dur - clip.events.contact) + (o.extra ?? 0);
  };

  const RCLIP = { hand: 'k_hand_touch', toe: 'k_toe_touch', run: 'k_run_touch', bonus: 'k_bonus_reach' };
  const HOLD = { ankle: 'k_def_ankle', thigh: 'k_def_thigh', chain: 'k_def_thigh', dash: 'k_def_thigh', hold: 'k_def_thigh', block: 'k_def_block' };

  function onEvent(e, sc, now, dt) {
    const lag = Math.max(0, now - e.t);
    const A = (team, id) => sc.actors[team * 7 + id];
    const E = (team, id) => entry(team * 7 + id);
    const rt = sc.raid ? sc.raid.team : 0, dtm = sc.raid ? sc.raid.def : 1, raider = sc.raid ? sc.raid.raider : 0;
    if (e.type === 'raidStart') { raidDir = e.team === 0 ? 1 : -1; director.setShot('wide', true); }
    else if (e.type === 'commit') {
      director.setShot('follow');
      const r = E(e.team, e.raider);
      if (r && (e.action === 'feintL' || e.action === 'feintR')) playOnce(r, e.action === 'feintL' ? 'k_feint_l' : 'k_feint_r', now, { startTime: Math.min(lag, 0.6) });
    } else if (e.type === 'respond') {
      const r = E(rt, raider), eta = e.tc - now;
      director.setShot(['hand', 'toe', 'run'].includes(e.action) ? 'pair' : 'follow', ['hand', 'toe', 'run'].includes(e.action));
      if (r && RCLIP[e.action]) { timed(r, RCLIP[e.action], eta, now, dt); r.ctrl.partner = e.lead != null ? A(dtm, e.lead) : null; r.ctrl.kind = e.action; }
      for (const id of e.engaged) {
        const d = E(dtm, id); if (!d) continue;
        const name = e.resp === 'hold' ? 'k_def_back' : e.resp === 'block' ? 'k_def_block_in' : 'k_def_lunge';
        timed(d, name, eta, now, dt);
        d.ctrl.partner = A(rt, raider); d.ctrl.kind = 'lunge';
      }
    } else if (e.type === 'contact') {
      const r = E(rt, raider);
      if (e.caught) {
        director.setShot('hold', true);
        if (r) { r.human.play('k_held', { fade: catching ? 0 : 0.3, loop: true }); r.ctrl.mode = 'k_held'; r.ctrl.until = 1e9; r.ctrl.kind = 'held'; r.ctrl.partner = null; }
        (e.joiners || e.engaged).forEach((id, i) => {
          const d = E(dtm, id); if (!d) return;
          const base = i === 0 ? HOLD[e.resp] : e.resp === 'block' ? 'k_def_block' : 'k_def_side';
          const name = `${base}_in`;
          if (!d.human.hasClip(name)) return;
          d.human.playTimed(name, 'contact', Math.max(0.01, 0.45 - lag), { fade: catching ? 0 : 0.15, frameDt: dt });
          d.ctrl.mode = name; d.ctrl.until = 1e9; d.ctrl.kind = i === 0 ? (e.resp === 'block' ? 'block' : e.resp === 'ankle' ? 'ankle' : 'thigh') : 'side'; d.ctrl.partner = A(rt, raider);
          d.human.on('contact', () => { if (d.ctrl && d.ctrl.mode === name) d.human.play(`${base}_hold`, { fade: 0.05, loop: true }); });
        });
      } else {
        for (const id of e.touched) { const d = E(dtm, id); if (d) playOnce(d, 'k_def_touched', now); }
        if (['ankle', 'thigh', 'chain', 'dash'].includes(e.resp) && e.lead != null) { const d = E(dtm, e.lead); if (d && !e.touched.includes(e.lead)) playOnce(d, 'k_def_miss', now); }
      }
    } else if (e.type === 'raidEnd') {
      director.setShot('wide');
      const s = e.summary, r = E(e.team, e.raider);
      if (s.how === 'safe' && !s.empty && r) playOnce(r, 'celebrate_2', now, { hold: 2.2 });
      if (s.defPts && sc.raid) for (const id of sc.raid.defIds) { const d = E(e.def, id); if (d && !s.defOut.includes(id)) playOnce(d, 'celebrate_2', now, { hold: 2.2 }); }
      if (r && s.raiderOut) { r.ctrl.until = -1; r.ctrl.mode = ''; }
      for (const id of s.defOut) { const d = E(e.def, id); if (d) { d.ctrl.until = -1; d.ctrl.mode = ''; } }
      for (const [, en] of byG) if (en.ctrl && (en.ctrl.kind === 'side' || en.ctrl.kind === 'thigh' || en.ctrl.kind === 'ankle' || en.ctrl.kind === 'block')) { en.ctrl.until = now + 0.01; }
    }
  }

  // ---- IK targets that follow the other body ----------------------------------------------------------------------------------------------------
  function updateTargets(sc) {
    for (const [, e] of byG) {
      const c = e.ctrl, h = e.human;
      if (!c || !c.partner) continue;
      const p = entry(c.partner.g);
      if (!p) continue;
      const P = p.human, kind = c.kind;
      if (kind === 'hand' || kind === 'run') h.setTarget('tA', contacts.touchPoint(P, h));
      else if (kind === 'toe') h.setTarget('tF', contacts.toePoint(P, h));
      else if (kind === 'bonus') {
        const raid = sc.raid;
        if (raid) { const w = toWorld(raid.team, raid.P.x, COURT.BONUS + 0.28); h.setTarget('tF', V(w.x, 0.05, w.z)); }
      } else if (kind === 'thigh' || kind === 'ankle' || kind === 'lunge' || kind === 'side') {
        const fwd = V(Math.sin(P.facing), 0, Math.cos(P.facing)), back = fwd.clone().multiplyScalar(-1);
        const left = V(Math.cos(h.facing), 0, -Math.sin(h.facing));          // this body's left in world
        if (kind === 'side') {
          const hip = P.bonePosition('Spine', V()), toMe = h.root.position.clone().sub(P.root.position); toMe.y = 0; toMe.normalize();
          h.setTarget('tL', hip.clone().addScaledVector(toMe, 0.26).addScaledVector(fwd, 0.06));
          h.setTarget('tR', hip.clone().addScaledVector(toMe, 0.26).addScaledVector(fwd, -0.08));
        } else {
          const pts = kind === 'ankle' ? contacts.anklePoints(P, back) : contacts.thighPoints(P, back);
          const d0 = pts[0].clone().sub(h.root.position).dot(left), d1 = pts[1].clone().sub(h.root.position).dot(left);
          h.setTarget('tL', d0 >= d1 ? pts[0] : pts[1]); h.setTarget('tR', d0 >= d1 ? pts[1] : pts[0]);
        }
      }
    }
  }

  // ---- placing the picture inside the HUD's view region ---------------------------------------------------------------------------------------------------------
  let cssW = 0, cssH = 0, scaleV = 1;
  function layoutCanvas(viewRect) {
    const r = kitCanvas.getBoundingClientRect();
    const cw = r.width || globalThis.innerWidth, ch = r.height || globalThis.innerHeight;
    if (cw !== cssW || ch !== cssH) { cssW = cw; cssH = ch; stage.resize(); }
    scaleV = Math.min(cw / 720, ch / 1280);
    const ox = (cw - 720 * scaleV) / 2, oy = (ch - 1280 * scaleV) / 2;
    // the picture lives inside the virtual screen only: the letterbox bars stay black like every other screen
    canvas.style.clipPath = `inset(${Math.max(0, oy)}px ${Math.max(0, ox)}px ${Math.max(0, oy)}px ${Math.max(0, ox)}px)`;
    const top = oy + viewRect.y * scaleV, h = viewRect.h * scaleV, w = 720 * scaleV;
    return { cw, ch, top, h, w, ox, oy };
  }
  function applyView(L, fovRegion) {
    const c = camera;
    const fullFov = (2 * Math.atan(Math.tan((fovRegion * Math.PI) / 360) * (L.ch / L.h)) * 180) / Math.PI;
    c.fov = Math.min(100, fullFov);
    c.aspect = L.cw / L.ch;
    const centre = L.top + L.h / 2;
    if (c.setViewOffset) c.setViewOffset(L.cw, L.ch, 0, -(centre - L.ch / 2), L.cw, L.ch);
    c.updateProjectionMatrix();
  }

  // ---- per frame ---------------------------------------------------------------------------------------------------------------------------------------------------
  function frame(game, ctx) {
    const s = game.getState();
    const active = s.scene === 'play' && s.sc && ready && !lost;
    if (!active) {
      if (shownVisible) { canvas.style.visibility = 'hidden'; shownVisible = false; game.setView3d?.(false); }
      lastT = null;
      return;
    }
    if (!shownVisible) { canvas.style.visibility = 'visible'; shownVisible = true; game.setView3d?.(true); stage.invalidate(); }
    const sc = s.sc;
    const wantKind = s.settings && s.settings.women ? 'f' : 'm';
    if (wantKind !== poolKind) {
      if (pools[wantKind]) { releaseAll(); pool = pools[wantKind]; poolKind = wantKind; }
      else if (!loading) { loading = true; loadPool(wantKind).then(() => { loading = false; }).catch(() => { loading = false; }); }
    }
    const now = sc.t;
    let dt = lastT === null ? 0 : now - lastT; lastT = now;
    dt = Math.min(Math.max(dt, 0), 0.1);
    const key = `${sc.match.cfg.first}:${s.mode}:${sc.match.cfg.length}`;
    if (key !== matchKey) { matchKey = key; releaseAll(); seen = 0; director.snap(); }
    assign(sc, pool);
    const evs = sc.events;
    if (seen === 0 && evs.length) {                                              // first frame: catch up with the raid that is under way
      let i = evs.length - 1; while (i > 0 && evs[i].type !== 'raidStart') i--;
      seen = Math.max(0, (evs[i] ? evs[i].id : 0) - 1); catching = true;
    }
    if (evs.length && evs[evs.length - 1].id < seen) seen = 0;
    for (const e of evs) { if (e.id <= seen) continue; seen = e.id; onEvent(e, sc, now, dt); }
    catching = false;
    if (sc.phase !== lastPhase) {
      if (sc.phase === 'decide' || (sc.phase === 'after' && sc.afterKind !== 'tackle')) director.setShot('follow');
      if (sc.phase === 'enter' || sc.phase === 'pre' || sc.phase === 'result' || sc.phase === 'half') director.setShot('wide');
      lastPhase = sc.phase;
    }
    for (const [g, e] of byG) {
      const a = sc.actors[g], h = e.human;
      h.setPosition(a.wx, 0, a.wz);
      h.setFacing(a.yaw, { snap: false });
      idleFor(e, a, now);
      e.shadow.position.set(a.wx, 0.012, a.wz);
    }
    // life: the live layer (breathing, weight shift, sway) is strong while a player is idle and almost off during a contact clip;
    // defenders raise their hands and set their weight as the raider comes near, each at his own pace; the fingers flex slowly, out of phase
    const RR = sc.raid ? sc.actors[sc.raid.team * 7 + sc.raid.raider] : null;
    for (const [g, e] of byG) {
      const a = sc.actors[g], h = e.human, c = e.ctrl, idle = now >= c.until;
      h.layers.live.setWeight(idle ? 1 : 0.2, 0);
      let wantR = 0;
      if (RR && a.role === 'def' && idle) { const d = Math.hypot(a.wx - RR.wx, a.wz - RR.wz); wantR = Math.max(0, Math.min(1, (4.2 - d) / 2.2)) * 0.9; }
      e.react += (wantR - e.react) * Math.min(1, dt * (1.6 + frac(g * 3 + 1) * 2.4));
      h.layers.react.setWeight(e.react, 0);
      if (idle) {
        const k1 = 0.2 + 0.1 * Math.sin(now * (0.7 + frac(g) * 0.5) + frac(g * 5) * 6.28), k2 = 0.2 + 0.1 * Math.sin(now * (0.6 + frac(g * 9) * 0.5) + 2.1 + frac(g * 3) * 6.28);
        h.setFingers('L', blendFingerPose(FINGER_POSES.relaxed, FINGER_POSES.fist, Math.max(0, k1 - 0.1)));
        h.setFingers('R', blendFingerPose(FINGER_POSES.open, FINGER_POSES.fist, Math.max(0, k2 - 0.05)));
      } else h.setFingers('both', 'auto');
    }
    updateTargets(sc);
    if (sc.raid) {
      const R = entry(sc.raid.team * 7 + sc.raid.raider);
      for (const [g, e] of byG) {
        const a = sc.actors[g];
        if (R && a.team === sc.raid.def && a.role === 'def') e.human.lookAt(R.human.bonePosition('Head', V()), { weight: 0.7, maxYaw: 1.0 });
        else if (R && e === R && sc.beat && sc.beat.target != null) { const T = entry(sc.raid.def * 7 + sc.beat.target); if (T) e.human.lookAt(T.human.bonePosition('Head', V()), { weight: 0.8, maxYaw: 1.0 }); }
        else e.human.lookAt(null);
      }
    }
    const L = layoutCanvas(s.viewRect || { y: 200, h: 500 });
    const rt = sc.raid ? sc.raid.team : sc.pre ? sc.pre.team : 0, rid = sc.raid ? sc.raid.raider : sc.pre ? sc.pre.raider : 0;
    const dir = rt === 0 ? 1 : -1;
    const Ra = sc.actors[rt * 7 + rid];
    const all = sc.actors.filter((a) => a.show && a.team !== rt).map((a) => ({ x: a.wx, z: a.wz }));
    const near = all.filter((p) => Math.hypot(p.x - Ra.wx, p.z - Ra.wz) < 3.6);
    let lead = null;
    if (sc.beat && sc.raid) { const id = sc.beat.engaged && sc.beat.engaged.length ? sc.beat.engaged[0] : sc.beat.target; if (id != null) { const la = sc.actors[sc.raid.def * 7 + id]; lead = { x: la.wx, z: la.wz }; } }
    director.update(dt, { dir, raider: { x: Ra.wx, z: Ra.wz }, lead, near, all: all.filter((o) => !lead || Math.hypot(o.x - lead.x, o.z - lead.z) > 0.05), regionAspect: L.w / L.h, side: 1, key: `${sc.match.raids}:${sc.beat ? sc.beat.n : 0}` });
    applyView(L, director.fov());
    stage.setShadowTarget(Ra.wx, 0, Ra.wz);
    for (const [g, e] of byG) { const a = sc.actors[g]; const on = shadowMaps && a.role === 'raider'; e.human.model.traverse((o) => { if (o.isSkinnedMesh) o.castShadow = !!on; }); }
    // level of detail: the library's policy (size on screen in css px, thresholds by quality tier): full for the big players, medium (hands included) for the
    // middle ones, light (1 draw call) only for the small ones. Shadow maps only for the raider and the lead defender (set above), a soft blob for everybody else.
    camera.updateMatrixWorld(true); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    // budget: the full level (7.5k triangles) only for the raider on the high tier, never on medium / low (they use the medium level: hands included, 3.6k)
    const fullCap = quality === 'high' ? 1 : 0;
    const fullIds = new Set([Ra.g]);
    if (sc.beat && sc.raid) for (const id of (sc.beat.engaged || []).slice(0, 2)) fullIds.add(sc.raid.def * 7 + id);
    for (const [g, e] of byG) {          // every player is drawn in full (the mannequins are about 1.4k triangles each); the detailed shadow is for the raider and lead only
      const wantFull = fullIds.has(g);
      e.shadow.visible = !blobs && !(wantFull && stage.renderer.shadowMap.enabled);
    }
    stage.update(dt);
    overlay(ctx, sc, s, L);
  }

  // jersey numbers and the target ring above the 3D players, drawn on the 2D canvas the game draws on (flat, crisp, never part of the sim)
  const proj = V();
  function overlay(ctx, sc, s, L) {
    if (!ctx || !sc.raid || s.hint || s.pauseMenu || (s.lesson && s.lesson.phase !== 'play')) return;
    const raid = sc.raid;
    const sx = (v) => (((v.x * 0.5 + 0.5) * L.cw) - L.ox) / scaleV, sy = (v) => (((-v.y * 0.5 + 0.5) * L.ch) - L.oy) / scaleV;
    ctx.save();
    ctx.font = '800 22px "Avenir Next","Segoe UI",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tgt = s.ui ? s.ui.target : null;
    const top = s.viewRect ? s.viewRect.y + 74 : 0, bot = s.viewRect ? s.viewRect.y + s.viewRect.h : 1280;
    for (const [g, e] of byG) {
      const a = sc.actors[g];
      if (a.role !== 'def' && a.role !== 'raider') continue;
      e.human.bonePosition('Head', proj); proj.y += 0.34;
      proj.project(camera);
      if (proj.z > 1 || Math.abs(proj.x) > 1.1) continue;
      const x = sx(proj), y = sy(proj);
      if (y < top + 14 || y > bot - 12) continue;
      const isT = a.team === raid.def && tgt === a.idx && sc.phase === 'decide';
      const label = String(a.num), w = 34 + (label.length > 1 ? 8 : 0);
      ctx.fillStyle = a.team === 0 ? '#1d4590' : '#8c231c';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 16, w, 30, 15); else ctx.rect(x - w / 2, y - 16, w, 30); ctx.fill();
      ctx.lineWidth = isT ? 4 : 2; ctx.strokeStyle = isT ? '#ffd24a' : 'rgba(255,255,255,0.85)'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(label, x, y + 1);
      if (a.role === 'raider') { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x - 7, y + 12); ctx.lineTo(x + 7, y + 12); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  }

  return {
    stage, director, ready: () => ready, pool: () => pool, frame,
    wrap(game) { const r = game.render.bind(game); game.render = (ctx, view) => { r(ctx, view); try { frame(game, ctx); } catch (e) { console.warn('3D frame failed', e); } }; return game; },
  };
}
