// Customer busts: three real 3D people (view3d Rocketbox athlete_m / athlete_f, recoloured skin, hair and clothes per customer) standing at the
// ticket rail. Each ticket card shows its customer's head and shoulders, rendered in its own viewport over the lit paper slab: breathing idle,
// weight shifts, an impatient head-shake when the patience runs low, a happy bounce when served, a turn-away when they leave.
const SKINS = ['original', 'tan', 'brown', 'deep', '#e6b894', '#d29b6e'];
const HAIRS = ['#141210', '#2b1c12', '#4a2f1a', '#8d8b88', '#d6b56a', '#a8501f'];
const TOPS = ['#b3282a', '#2b4a8f', '#2e7d5b', '#c98a2b', '#6a3d8a', '#d9d4c4', '#1f6f78', '#8a3a4a'];
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const ease = (f) => f * f * (3 - 2 * f);

export async function createBusts({ THREE }) {
  const V3 = await import('../vendor3d/index.js');
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(21, 1, 0.3, 20);
  const key = new THREE.DirectionalLight(0xffe2bc, 2.6); key.position.set(-1.5, 2.6, 3);
  const fill = new THREE.DirectionalLight(0xaec4ff, 0.7); fill.position.set(2, 1.2, 2);
  const rim = new THREE.DirectionalLight(0xffb070, 1.4); rim.position.set(1.5, 2, -2);
  scene.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a10, 0.9), key, fill, rim);
  const chars = ['athlete_m', 'athlete_f', 'athlete_m'];
  const slots = [];
  for (let i = 0; i < chars.length; i++) {
    const human = await V3.loadHuman({ character: chars[i], skin: 'original', clips: 'base' });
    human.root.visible = false; scene.add(human.root);
    human.play('idle_relaxed', { fade: 0 });
    slots.push({ human, id: -1, t0: 0, react: null, yaw: 0, phase: 0, active: false, rect: null, st: 'wait', seed: i });
  }
  const look = new THREE.Vector3();
  function dress(slot, id) {
    const h = slot.human, r = (k) => hash(id * 3.7 + k * 11.3 + slot.seed);
    h.setSkin(SKINS[Math.floor(r(1) * SKINS.length)]);
    h.setHair(HAIRS[Math.floor(r(2) * HAIRS.length)]);
    h.setKit({ top: TOPS[Math.floor(r(3) * TOPS.length)] });
    slot.id = id; slot.t0 = 0; slot.react = null; slot.yaw = (r(4) - 0.5) * 0.5; slot.phase = r(5) * 6;
  }
  return {
    react(id, kind) { const s = slots.find((x) => x.id === id); if (s) s.react = { kind, t: 0 }; },
    update(dt, state, clock, custs) {
      for (const s of slots) s.active = false;
      const used = new Set();
      for (const c of custs) {
        let s = slots.find((x) => x.id === c.id);
        if (!s) { s = slots.find((x) => !custs.some((q) => q.id === x.id) && !used.has(x)); if (!s) continue; dress(s, c.id); }
        used.add(s); s.active = true; s.rect = c.r; s.st = c.st; s.f = c.f; s.urgent = c.urgent; s.alpha = c.alpha;
      }
      const frozen = !!(state && (state.paused || (state.auto && state.auto.paused)));
      for (const s of slots) {
        const h = s.human;
        h.root.visible = s.active;
        if (!s.active) continue;
        s.t0 += frozen ? 0 : dt;
        const st = s.react ? s.react.kind : s.st === 'happy' ? 'happy' : s.st === 'gone' ? 'leave' : 'wait';
        if (s.react) s.react.t += frozen ? 0 : dt;
        const T = s.react ? s.react.t : s.t0;
        let yaw = s.yaw, bob = 0, lx = 0;
        if (st === 'happy' || st === 'thanks') { const u = Math.min(1, T / 0.9); bob = Math.abs(Math.sin(u * Math.PI * 2)) * 0.05 * (1 - u * 0.6); lx = 0.4 * Math.sin(T * 7) * (1 - u); }
        else if (st === 'leave') { const u = ease(Math.min(1, T / 0.9)); yaw = s.yaw + u * 2.5; bob = -u * 0.06; }
        else if (s.urgent) lx = Math.sin(clock * 9 + s.phase) * 0.35;
        else lx = Math.sin(clock * 0.7 + s.phase) * 0.18;
        h.root.position.set(0, bob, 0); h.root.rotation.y = yaw;
        look.set(lx, 1.55, 3); h.lookAt(look, { weight: 0.9 });
        h.update(frozen ? 0 : dt);
      }
    },
    render(renderer, k, H) {
      const act = slots.filter((s) => s.active && s.rect);
      if (!act.length) return;
      renderer.setScissorTest(true);
      for (const s of act) {
        const r = s.rect, x = r.x * k, w = r.w * k, hh = r.h * k, y = H - (r.y + r.h) * k;
        renderer.setViewport(x, y, w, hh); renderer.setScissor(x, y, w, hh);
        renderer.clear(false, true, false);
        for (const o of slots) o.human.root.visible = o === s;
        cam.aspect = w / Math.max(1, hh); cam.position.set(0, 1.5, 2.15); cam.lookAt(0, 1.46, 0); cam.updateProjectionMatrix();
        renderer.render(scene, cam);
      }
      renderer.setScissorTest(false);
      renderer.getSize(look2);
      renderer.setViewport(0, 0, look2.x, look2.y);
      for (const o of slots) o.human.root.visible = o.active;
    },
  };
}
const look2 = { x: 0, y: 0, set(a, b) { this.x = a; this.y = b; return this; } };
