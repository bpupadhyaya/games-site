// The life around the trail: other porters and a mule train on the ledge track above the main trail, a herder, and the villagers who
// come out to meet the porter at the end. All of it is presentation: positions are a pure function of the clock and the camera focus.
import { createFigure } from './porter3d.js';
import { hash } from './art.js';

export const LEDGE_Z = -10.4;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export async function createWalkers({ stage, V3, world, quality }) {
  const { THREE, loadHuman, loadHorse } = V3;
  const low = quality === 'low';
  const list = [];
  const SKINS = ['tan', 'brown', 'peach', 'clay'];
  const KITS = [
    { top: '#8a4a2a', bottoms: '#5a4a38', socks: '#3a2c20' }, { top: '#4a6a5a', bottoms: '#6a5a46', socks: '#3a2c20' },
    { top: '#a8883a', bottoms: '#4a4a56', socks: '#3a2c20' }, { top: '#7a3a4a', bottoms: '#5a5040', socks: '#3a2c20' },
  ];
  // ---- porters on the ledge: some going with the player, some against -------------------------------------------------------------------
  const kinds = ['veg', 'sacks', 'oranges', 'millet', 'blankets'];
  const nP = low ? 1 : 3;
  for (let i = 0; i < nP; i++) {
    const fig = await createFigure(stage, {
      character: i % 2 ? 'athlete_f' : 'athlete_m', scale: 0.9 + hash(i) * 0.06, kit: KITS[i % KITS.length], skin: SKINS[i % SKINS.length],
      hair: 'black', loadKind: kinds[i % kinds.length], items: 4 + (i % 3), lod: 'auto', trouser: ['#6a5a46', '#4a4a56', '#5a5040'][i % 3], topiBand: ['#26324a', '#4a2a2a', '#2a4a3a'][i % 3],
      strapColor: ['#7a2a20', '#2a4a6a', '#5a3a20'][i % 3],
    });
    const dir = i % 2 ? -1 : 1;
    list.push({ kind: 'porter', fig, dir, speed: 0.95 + hash(i + 3) * 0.3, x: 12 + i * 22, z: LEDGE_Z + (i % 2 ? 0.28 : -0.28), id: i });
  }
  // ---- the mule train ---------------------------------------------------------------------------------------------------------------------
  const mules = [];
  if (!low && loadHorse) {
    try {
      for (let i = 0; i < 3; i++) {
        const hs = await loadHorse({ coat: ['liver', 'grey', 'darkbay'][i], mane: 'roached', tack: 'none', quality: 'medium' });
        hs.root.scale.setScalar(0.86);
        // pack saddle: a wooden frame with two bundles and a bell
        const pack = new THREE.Group();
        const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.8), wood); frame.position.y = 1.43; pack.add(frame);
        for (const sx of [-0.33, 0.33]) {
          const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 5, 10), new THREE.MeshStandardMaterial({ color: ['#c99a52', '#a8453a', '#4a6a8a'][(i + (sx > 0 ? 1 : 0)) % 3], roughness: 0.95 }));
          bag.rotation.x = Math.PI / 2; bag.position.set(sx, 1.36, 0); bag.castShadow = true; pack.add(bag);
        }
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.7, roughness: 0.35 }));
        bell.position.set(0, 1.18, 0.78); pack.add(bell);
        hs.root.add(pack);
        stage.add(hs); stage.track(hs);
        mules.push(hs);
      }
    } catch (e) { console.warn('mules unavailable', e); }
  }
  let herder = null;
  if (!low) {
    herder = await createFigure(stage, { character: 'athlete_m', scale: 0.95, kit: { top: '#6a3a2a', bottoms: '#4a4a3a', socks: '#2a2018' }, skin: 'brown', hair: 'black', carry: false, lod: 'auto', trouser: '#4a4a3a', topiBand: '#3a2a4a' });
  }
  // ---- villagers (created when a trail with a village is shown) ---------------------------------------------------------------------------
  const villagers = [];
  async function ensureVillagers() {
    if (villagers.length || ensureVillagers.busy) return; ensureVillagers.busy = true;
    const n = low ? 3 : 6;
    const OUT = [{ top: '#c9473a', bottoms: '#4a4a56' }, { top: '#e8dcc0', bottoms: '#6a5a46' }, { top: '#4a6a8a', bottoms: '#5a5040' }, { top: '#d9a63a', bottoms: '#4a3a3a' }, { top: '#7a8a4a', bottoms: '#5a4a38' }, { top: '#b8587a', bottoms: '#3a3a4a' }];
    for (let i = 0; i < n; i++) {
      const h = await loadHuman({ character: i % 2 ? 'athlete_f' : 'athlete_m', scale: i === 3 ? 0.7 : 0.92 + hash(i) * 0.05, kit: { ...OUT[i], socks: '#3a2c20' }, skin: SKINS[(i + 1) % 4], hair: 'black', lod: 'auto' });
      h.groundClamp = 'off'; h.footPlanting = false; stage.add(h); stage.track(h); h.play(i % 3 ? 'idle_relaxed' : 'idle', { fade: 0 });
      h.root.visible = false;
      villagers.push({ h, i, clip: '', t0: hash(i * 9) * 2 });
    }
  }
  const api = { list, mules, herder, villagers };
  const setV = (o, x, z, world2) => { o.root.position.set(x, world2.heightAt(x, z), z); };

  api.update = (dt, v) => {
    const { x: fx, trail, t, snap, arrived } = v;
    // ledge walkers: wrap them around the focus so there is always someone on the hill, never popping in view
    for (const w of list) {
      if (!w.init || snap) { w.x = fx + (w.dir > 0 ? -8 : 36) + w.id * 18; w.init = true; w.fig.st.lastX = null; }
      w.x += w.dir * w.speed * dt;
      if (w.x < fx - 22 || w.x > fx + 62) { w.x = w.dir > 0 ? fx - 14 + hash(w.id + Math.floor(t)) * 4 - 12 : fx + 52; w.fig.st.lastX = null; w.snap = true; }
      const y = world.heightAt(w.x, w.z);
      w.fig.update(dt, { x: w.x, y, z: w.z, rest: 0, breath: 0.7, lean: 0.2, load: Math.sin(t * 1.9 + w.id) * 0.04, t, snap: !!w.snap, fd: w.dir });
      w.snap = false;
    }
    // mule train: three mules in a line with the herder, going against the player along the ledge
    if (mules.length) {
      const sp = 1.15;
      if (api.mx === undefined || snap) api.mx = fx + 40;
      api.mx -= sp * dt;
      if (api.mx < fx - 30) api.mx = fx + 60;
      mules.forEach((m, i) => {
        const x = api.mx + i * 3.2, z = LEDGE_Z + 0.3, y = world.heightAt(x, z);
        m.setPosition(x, y, z); m.setFacing(-Math.PI / 2); m.drive(sp, 0);
      });
      if (herder) {
        const hx = api.mx - 3.0, y = world.heightAt(hx, LEDGE_Z - 0.2);
        herder.update(dt, { x: hx, y, z: LEDGE_Z - 0.2, rest: 0, breath: 1, lean: 0.05, load: 0, t, snap: !!snap, fd: -1 });
      }
    }
    // villagers near the end of a trail
    if (trail && !trail.endless && trail.goal !== undefined && fx > trail.goal - 80) {
      ensureVillagers();
      const gx = trail.goal;
      villagers.forEach((vl) => {
        const slots = [[3.2, 1.0], [5.2, 1.6], [6.4, -1.4], [8.6, 1.1], [4.2, -1.6], [10, -0.4]];
        const [dx, z] = slots[vl.i % slots.length];
        const x = gx + dx;
        vl.h.root.visible = true;
        vl.h.root.position.set(x, world.heightAt(x, z), z);
        const toward = fx < x ? -Math.PI / 2 : Math.PI / 2;
        vl.h.setFacing(toward);
        const near = Math.abs(fx - x) < 16;
        const want = arrived ? (vl.i % 3 === 0 ? 'cheer' : vl.i % 3 === 1 ? 'clap' : 'wave') : near ? (vl.i % 2 ? 'wave' : 'idle_relaxed') : (vl.i % 3 ? 'idle_relaxed' : 'idle');
        if (want !== vl.clip) { vl.clip = want; vl.h.play(want, { fade: 0.35, loop: true }); }
      });
    }
  };
  void setV; void clamp;
  return api;
}
