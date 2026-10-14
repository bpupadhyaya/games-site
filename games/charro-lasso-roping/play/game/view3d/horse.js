// The target horse: the shared, rigged horse3d (platform/view3d) with a charro saddle and woven blanket, riderless. This wrapper keeps the
// small interface the arena uses (root, update, neckPoint, headPoint, setShadows). Gait phase follows the DISTANCE the horse actually moves
// on screen (horse3d integrates the speed we hand it), so legs never move while the horse stands and never glide while they are still.
import { THREE, loadHorse } from '../vendor3d/index.js';

const { Group, Vector3 } = THREE;

export async function createHorse({ quality = 'medium', base } = {}) {
  const hq = quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low';
  const horse = await loadHorse({ coat: 'bay', blaze: 'blaze', socks: { LF: 0.25, RH: 0.2 }, mane: 'long', tack: 'none', quality: hq, base });
  const root = new Group();                    // outer: yaw 0 = running toward +X, PI = toward -X (the arena sets it)
  horse.root.rotation.y = Math.PI / 2;         // horse3d faces +Z
  root.add(horse.root);
  horse.setTack('western', { blanket: '#1f6a4a', trim: '#e0b43c', leather: '#4a2a14', dark: '#241309' });
  const st = { events: [], caught: false, t: 0 };
  const tmp = new Vector3();
  horse.on('hoof', (e) => {
    const L = horse.legs.find((l) => l.side + (l.front ? 'F' : 'H') === e.leg);
    if (!L) return;
    tmp.set(L.tip.x, 0, L.gz ?? L.z0);
    horse.root.localToWorld(tmp);
    st.events.push({ x: tmp.x, z: tmp.z, fore: e.front, world: true, speed: e.speed });
  });
  function update({ dt, speed, head }) {
    st.events.length = 0;
    st.t += dt;
    const caught = head > 0.01;
    if (caught && !st.caught) { try { horse.play('shake'); } catch { /* optional */ } }
    st.caught = caught;
    horse.drive(speed, 0);
    horse.update(dt);
    return st.events;
  }
  const api = {
    root, update, horse,
    neckPoint(out = new Vector3()) {
      const b = horse.b.Neck2 || horse.b.Neck1;
      root.updateMatrixWorld(true);
      b.getWorldPosition(out); out.y += 0.12;
      return out;
    },
    headPoint(out = new Vector3()) { (horse.b.Head).getWorldPosition(out); return out; },
    setShadows(on) { root.traverse((m) => { if (m.isMesh) m.castShadow = on; }); },
  };
  return api;
}
