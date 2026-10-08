// Turns the sim state into a render snapshot for the 3D world and drives one frame. Reads only.
import { createWorld } from './world.js';
import { clamp, lerp } from './util3.js';
import { PORTS, PORT_IDX, legById } from '../src/data.js';
import { todOf, squallLevel, upcomingSquall, idealAngle, sheetAngle, windAt, frame as simFrame } from '../src/sim.js';
import { DAYLEN } from '../src/core.js';
import { LY } from '../src/layout.js';
const LYH = { portrait: () => LY.h > LY.w };

const GOOD_TINT = { dates: '#7a5234', cloth: '#d8d0c0', pepper: '#3d2f26', timber: '#b9a07a', porcelain: '#cdb68a', rice: '#e2d6b6', coir: '#a58a5a', resin: '#c58b45' };

const PORT_SCENES = ['port', 'market', 'yard', 'crew', 'logbook', 'voyage', 'talk'];
export function createDirector(P) {
  let world = null, menuT = 0, menuPos = { x: 0, y: 0 };
  const menuWind = { from: 205, speed: 7.5 };
  async function init() {
    const V3 = P.V, stage = P.stage;
    world = await createWorld(V3, stage, P.quality);
    P.world = world; P.info.cam = world.camera;
  }
  const lat = (V) => {
    const a = PORTS[PORT_IDX[V.from]], b = PORTS[PORT_IDX[V.to]], f = clamp(simFrame(V, V.ship).u / V.dist, 0, 1);
    return lerp(a.lat, b.lat, f);
  };
  function voyageRS(state, V) {
    const sh = V.ship, ev = V.events;
    let life = null;
    for (let i = ev.length - 1; i >= 0; i--) if (ev[i].type === 'life') { life = ev[i]; break; }
    if (life && V.t - life.t > 9) life = null;
    const sq = upcomingSquall(V), approach = sq ? clamp((V.t - (sq.t0 - 14)) / 14, 0, 1) : 0;
    const lvl = squallLevel(V), cargo = state.cargoView || { frac: 0.6, good: 'timber' };
    return {
      t: V.t, ship: { x: sh.x, y: sh.y, h: sh.h, v: sh.v, heel: sh.heel, side: sh.side, ang: sh.sailAng, flap: sh.flap, stall: sh.stall, eff: sh.eff, dip: sh.dip, dipTot: sh.dipTot, reef: sh.reef, helm: clamp(sh.yaw / 12, -1, 1) },
      wind: V.wind, tod: todOf(V), storm: Math.max(lvl, approach * 0.35), squallWall: sq ? Math.max(approach, lvl) : 0,
      hazards: V.hazards, life: life ? { t0: life.t } : null, cargo: { frac: cargo.frac, tint: GOOD_TINT[cargo.good] || '#c7a56f', poles: cargo.good === 'timber' },
      water: clamp(V.water, 0, 1), lat: lat(V), cam: state.scene === 'arrive' ? 3 : state.prefs.cam ?? 0, sight: !!(V.sight && !V.sight.done) && state.scene !== 'arrive', landNear: !!V.landfall && V.t - V.landfall.t < 7, coasts: true,
      lift: state.scene === 'auto' ? (LYH.portrait() ? 5 : 4) : state.scene === 'arrive' ? 9 : 0,
    };
  }
  const PORT_TOD = { kilwa: 0.36, mombasa: 0.31, aden: 0.58, muscat: 0.66, surat: 0.46, calicut: 0.73, malacca: 0.52 };
  const PORT_WIND = { kilwa: 40, mombasa: 55, aden: 250, muscat: 330, surat: 230, calicut: 260, malacca: 290 };
  // Moored off the harbour of the port you are in: the camera looks at that port's own coast (own sand, hills, palms, houses and light).
  function portRS(state, dt, pid, pi) {
    menuT += dt;
    const wind = { from: PORT_WIND[pid] ?? 200, speed: 3.2 };
    return {
      t: menuT, ship: { x: 0, y: 0, h: 90, v: 0.5, heel: 2, side: 1, ang: 60, flap: 0.3, stall: 0, eff: 0.2, dip: 0, dipTot: 0, reef: 0.6, helm: 0 },
      wind, tod: PORT_TOD[pid] ?? 0.4, storm: 0, squallWall: 0, hazards: [], life: null, cargo: { frac: state.camp ? Math.min(1, (Object.values(state.camp.cargo).reduce((a, b) => a + b, 0)) / 20) : 0.5, tint: '#c7a56f', poles: true }, water: 0.8, lat: 6, cam: 'port', sight: false, landNear: false, coasts: true,
    };
  }
  function menuRS(state, dt, scene) {
    menuT += dt;
    const sp = 4.2, hd = 95;
    menuPos.x += Math.sin(hd * Math.PI / 180) * sp * dt; menuPos.y += Math.cos(hd * Math.PI / 180) * sp * dt;
    if (Math.abs(menuPos.x) > 30000) menuPos.x = 0;
    const beta = Math.abs(((menuWind.from - hd + 540) % 360) - 180), ang = idealAngle(beta);
    const port = ['port', 'market', 'cargo', 'crew', 'yard', 'logbook', 'lore', 'trivia', 'voyage', 'recap', 'arrive', 'results'].includes(scene);
    const tod = port ? 0.72 : scene === 'title' ? 0.29 + menuT / (DAYLEN * 3) : 0.34 + menuT / (DAYLEN * 6);
    void sheetAngle;
    const side = ((menuWind.from - hd + 540) % 360) - 180 > 0 ? -1 : 1;
    return {
      t: menuT, ship: { x: menuPos.x, y: menuPos.y, h: hd, v: sp, heel: 7 * side, side, ang, flap: 0, stall: 0, eff: 0.9, dip: 0, dipTot: 0, reef: 0, helm: 0 },
      wind: menuWind, tod: tod % 1, storm: 0, squallWall: 0, hazards: [], life: null, cargo: { frac: 0.7, tint: '#c7a56f', poles: true }, water: 0.8, lat: 6, cam: 'menu', sight: false, landNear: false, coasts: false,
    };
  }
  function frame(state, scene, dt) {
    if (!world) return;
    let RS;
    const V = state.voy;
    const playing = V && ['play', 'auto', 'sail'].includes(scene) || (V && scene === 'arrive');
    if (playing) { world.setVoyage({ legId: V.legId, seed: V.seed, bearing: V.bearing, D: V.D, hazards: V.hazards, fromStyle: V.from, toStyle: V.to }); RS = voyageRS(state, V); if (state.paused) dt = 0.0001; }
    else if (state.camp && PORT_SCENES.includes(scene)) { const pid = state.camp.port, pi = PORT_IDX[pid]; world.setVoyage({ legId: `port:${pid}`, seed: pi * 7 + 3, bearing: 90, D: { x: 48, y: 0 }, hazards: [], fromStyle: pid, toStyle: pid, noOrig: true }); RS = portRS(state, dt, pid, pi); }
    else { world.setVoyage(null); RS = menuRS(state, dt, scene); }
    world.frame(dt, RS);
    P.stage.update(dt);
    void windAt; void legById;
  }
  return { init, frame, get world() { return world; } };
}
