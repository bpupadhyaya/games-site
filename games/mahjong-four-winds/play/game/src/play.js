// A hand at the table: the turn machine that drives rules.js with pacing, animation and the human's input.
// Owns nothing global: it works on `S` (the game state) and the helpers passed in by game.js.
import { newHand, drawTile, discard, claim, passAll, declareWin, selfWin, makeKong, ownKongs, hasClaim, kindOf, kindName, kindCounts, shanten, wallLeft, seatWind, sortTiles } from './rules.js';
import { settleClaims, applyClaim, aiTurn } from './flow.js';
import { chooseClaim, discardHint, stepsText } from './ai.js';
import { tileTargets, wallPos, handMetrics, handTileX, HAND_Y, inRect, BTN, RING, ROT } from './layout.js';
import { claimList, ownList, claimRects, NAMES, RESULT_BTN } from './view.js';

const CLAIM_TIME = 9;

export function createPlay(ctx) {
  const { S, rng, sfx, say, storage, vis, rs } = ctx;
  let T = new Map();
  const pace = () => (S.prefs.pace === 'fast' ? 0.32 : 0.85);

  // ----------------------------------------------------------------------------------------------- start / finish
  function startHand() {
    const m = S.match;
    const h = newHand(rng, { dealer: m.dealer, wind: 0, minFan: S.prefs.minFan });
    S.h = h; vis.clear(); T = new Map();
    S.ui = { ph: 'dealing', wait: 0, sel: -1, selId: -1, msg: null, hint: null, claim: null, own: null, lastDisc: -1, pause: false, drag: null, resT: 0, call: null, resultLast: false, name: '' };
    const calm = S.prefs.calm;
    // every tile starts outside the table and slides into its slot in the wall ring; dealt tiles then fly out to the hands
    const dealIdx = new Map(); h.dealOrder.forEach(([t], i) => dealIdx.set(t, i));
    for (let t = 0; t < 144; t++) {
      const slot = h.slot[t], p = wallPos(slot), ang = Math.atan2(p.y - RING.cy, p.x - RING.cx);
      const out = { x: RING.cx + Math.cos(ang) * 620, y: RING.cy + Math.sin(ang) * 760 };
      vis.set(t, { id: t, x: calm ? p.x : out.x, y: calm ? p.y : out.y, rot: p.rot, w: p.w, f: 0, z: 0, lift: 0, wall: true, build: calm ? 0 : slot * 0.0055, hold: dealIdx.has(t) ? (calm ? 0.2 : 0.95) + dealIdx.get(t) * (calm ? 0.004 : 0.02) : 0 });
    }
    S.ui.wait = calm ? 0.6 : 0.95 + h.dealOrder.length * 0.02 + 0.5;
    sfx('shuffle');
    say(S.match.mode === 'round' ? `${NAMES[m.dealer] === 'You' ? 'You are' : NAMES[m.dealer] + ' is'} the dealer (East). ${m.dealer === 0 ? 'You play first.' : ''}` : 'A single hand. Dealer plays first.', 4);
    S.stats.hands = (S.stats.hands ?? 0) + 1;
    S.demoHands += 1; if (ctx.config.demo) storage.set('demoHands', S.demoHands);
    ctx.monetization.track('hand_start', { dealer: m.dealer });
  }

  function finishHand() {
    const h = S.h, ui = S.ui, r = h.result, m = S.match;
    ui.ph = 'result'; ui.resT = 0; ui.sel = -1; ui.selId = -1; ui.hint = null; ui.claim = null; ui.own = null; ui.msg = null;
    if (r.type === 'win') {
      r.pay.forEach((d, p) => { m.scores[p] += d; });
      if (r.winner === 0) { S.stats.wins = (S.stats.wins ?? 0) + 1; S.matchWins += 1; S.stats.bestFan = Math.max(S.stats.bestFan ?? 0, r.info.fan); }
      sfx(r.winner === 0 ? 'win' : 'lose');
    } else sfx('draw');
    S.stats.played = (S.stats.played ?? 0) + 1;
    storage.set('progress', { played: S.stats.played, wins: S.stats.wins ?? 0 });
    storage.set('stats', S.stats);
    storage.remove('save');
    S.saved = null;
    // dealer stays after a win by the dealer or an exhausted wall; otherwise the deal passes on
    const stay = r.type === 'draw' || r.winner === m.dealer;
    m.next = { stay, dealer: stay ? m.dealer : (m.dealer + 1) % 4, rot: m.rot + (stay ? 0 : 1) };
    ui.resultLast = m.mode === 'hand' || m.next.rot >= 4 || m.hand >= 8;
    ctx.monetization.track('hand_end', { result: r.type, winner: r.winner ?? -1 });
  }

  function nextHand() {
    const m = S.match, n = m.next;
    if (S.ui.resultLast) { if (S.lessonPlay) { ctx.lessonPlayDone(); return; } S.scene = 'matchend'; return; }
    m.repeats = n.stay ? m.repeats + 1 : 0; m.dealer = n.dealer; m.rot = n.rot; m.hand += 1;
    if (ctx.config.demo && S.demoHands >= ctx.demoHands) { S.scene = 'demo-limit'; return; }
    startHand();
  }

  // ----------------------------------------------------------------------------------------------- the turn machine
  function saveNow() {
    if (S.ui.ph !== 'human') return;
    S.saved = { match: JSON.parse(JSON.stringify(S.match)), h: JSON.parse(JSON.stringify(S.h)), matchWins: S.matchWins };
    storage.set('save', S.saved);
  }

  function afterDraw(res) {
    const h = S.h, ui = S.ui;
    for (const e of res.ev) if (e.type === 'bonus') { sfx('draw'); if (e.p === 0) say(`Bonus tile: ${kindName(kindOf(e.tile))}. Set aside; you drew a replacement.`, 3.2); }
    if (res.ended) { finishHand(); return; }
    if (h.turn === 0) enterHuman(); else { ui.ph = 'ai'; ui.wait = pace() * (0.75 + 0.5 * ((h.moves * 37) % 10) / 10); }
    sfx('draw');
  }

  function enterHuman() {
    const h = S.h, ui = S.ui, w = h.drawn >= 0 ? selfWin(h, 0) : null;
    ui.ph = 'human'; ui.sel = -1; ui.selId = -1; ui.hint = null; ui.claim = null;
    ui.own = { win: !!w && w.fan >= h.minFan, lowWin: !!w && w.fan < h.minFan, kongs: ownKongs(h, 0), info: w };
    if (ui.own.win) say('You can win! Tap Win!.', 6);
    else if (ui.own.lowWin) say(`Your hand is complete, but it needs ${h.minFan} fan and this scores ${w.fan}. Keep playing for a pattern.`, 6);
    saveNow();
  }

  function stepTurn() {
    const h = S.h;
    const res = drawTile(h);
    afterDraw(res);
  }

  function doDiscard(tile) {
    const h = S.h, ui = S.ui, from = h.turn;
    const opts = discard(h, tile);
    ui.lastDisc = tile; ui.sel = -1; ui.selId = -1; ui.hint = null; ui.own = null; ui.drag = null;
    sfx('clack');
    beginClaim(opts, from);
  }

  function beginClaim(opts, from) {
    const h = S.h, ui = S.ui, choices = [null, null, null, null];
    ui.ph = 'claim';
    for (let q = 1; q < 4; q++) if (q !== from && hasClaim(opts[q])) choices[q] = chooseClaim(h, q, opts[q], S.match.levels[q], rng);
    const human = from !== 0 && hasClaim(opts[0]);
    ui.claim = { from, opts, choices, human, tile: h.last.tile, t: S.prefs.timer ? CLAIM_TIME : 0, timer: S.prefs.timer ? CLAIM_TIME : 0, chowPick: null };
    ui.wait = 0.5;
    if (human) {
      const o = opts[0], bits = [o.win && 'win', o.kong && 'kong', o.pung && 'pung', o.chows.length && 'chow'].filter(Boolean);
      say(`${NAMES[from]} discarded the ${kindName(kindOf(h.last.tile))}. You can ${bits.join(', ')}, or pass.`, 8);
    } else if (from !== 0 && opts[0]?.lowWin) say(`That tile would complete your hand, but with too few fan (${opts[0].info.fan}; you need ${h.minFan}). You cannot win on it.`, 6);
  }

  function resolveClaims() {
    const h = S.h, ui = S.ui, c = ui.claim;
    const win = settleClaims(h, c.from, c.choices);
    ui.claim = null;
    if (!win) { passAll(h); ui.ph = 'turn'; ui.wait = 0.12; return; }
    const who = NAMES[win.q];
    if (win.type !== 'win') { sfx('claim'); ui.call = { seat: win.q, text: win.type === 'chow' ? 'CHOW' : win.type === 'pung' ? 'PUNG' : 'KONG', t: 0 }; }
    const res = applyClaim(h, win);
    if (win.type === 'win') { ui.call = { seat: win.q, text: 'MAHJONG!', t: 0 }; finishHand(); return; }
    if (res && res.ev) for (const e of res.ev) if (e.type === 'bonus') sfx('draw');
    if (res && res.ended) { finishHand(); return; }
    if (h.turn === 0) enterHuman();
    else { ui.ph = 'ai'; ui.wait = pace(); }
    say(`${who} took it: ${win.type}.`, 2.6);
  }

  // human decision on a claim
  function humanClaim(id) {
    const ui = S.ui, c = ui.claim, o = c.opts[0];
    if (id === 'pass') { c.choices[0] = null; sfx('click'); resolveClaims(); return; }
    if (id === 'win') { c.choices[0] = { type: 'win' }; resolveClaims(); return; }
    if (id === 'kong') { c.choices[0] = { type: 'kong' }; resolveClaims(); return; }
    if (id === 'pung') { c.choices[0] = { type: 'pung' }; resolveClaims(); return; }
    if (id === 'chow') {
      if (o.chows.length === 1) { c.choices[0] = { type: 'chow', pair: o.chows[0] }; resolveClaims(); }
      else { c.chowPick = o.chows; sfx('click'); }
    }
  }

  function humanOwn(id) {
    const h = S.h, ui = S.ui;
    if (id === 'win') { declareWin(h, 0, 'self'); ui.call = { seat: 0, text: 'MAHJONG!', t: 0 }; finishHand(); return; }
    if (id.startsWith('kong')) {
      const kg = ui.own.kongs[Number(id.slice(4))];
      sfx('claim'); ui.call = { seat: 0, text: 'KONG', t: 0 };
      afterDraw2(makeKong(h, 0, kg));
    }
  }
  function afterDraw2(res) { for (const e of res.ev) if (e.type === 'bonus') sfx('draw'); if (res.ended) return finishHand(); enterHuman(); }

  // ----------------------------------------------------------------------------------------------- input
  const hitHand = (x, y) => {
    let best = null, bd = 1e9;
    for (const [id, tg] of T) {
      if (!tg.hand) continue;
      const v = vis.get(id); if (!v) continue;
      const hh = tg.w * 1.333;
      if (Math.abs(x - tg.x) <= tg.w / 2 + 0.75 && y >= tg.y - hh / 2 - 6 && y <= tg.y + hh / 2 + 22) { const d = Math.abs(x - tg.x); if (d < bd) { bd = d; best = id; } }
    }
    return best;
  };
  function tapTile(id) {
    const ui = S.ui, h = S.h;
    if (ui.ph === 'human') {
      if (ui.selId === id) { doDiscard(id); return; }
      ui.selId = id; ui.sel = id; sfx('click'); ui.hint = ui.hint && ui.hint.tile === id ? ui.hint : ui.hint;
      say(`${kindName(kindOf(id))}. Tap it again, or drag it up, to discard.`, 2.6);
    } else if (ui.ph === 'claim' || ui.ph === 'ai' || ui.ph === 'turn') {
      if (ui.selId === id) { say(ui.claim?.human ? 'First choose: claim the tile, or Pass.' : `Not your turn yet: ${NAMES[h.turn]} is playing.`, 3, true); sfx('bad'); }
      else { ui.selId = id; ui.sel = id; sfx('click'); }
    }
  }
  function showHint() {
    const ui = S.ui, h = S.h;
    if (!S.prefs.hints) { say('Hints are switched off in Settings.', 3); return; }
    if (ui.ph === 'human') {
      const hint = discardHint(h, 0);
      if (ui.own.win) { say('You can win right now: tap Win!.', 5); return; }
      ui.hint = { tile: hint.tile, text: hint.text }; say(hint.text, 9); ui.selId = -1;
    } else if (ui.ph === 'claim' && ui.claim.human) {
      const c = ui.claim, o = c.opts[0], now = shanten(kindCounts(h.hands[0]), h.melds[0].length);
      const pick = chooseClaim(h, 0, o, 2, { chance: () => true, pick: (a) => a[0], range: () => 0 });
      if (pick && pick.type === 'win') say('That completes your hand: tap Win!.', 7);
      else if (pick) say(`Take it: a ${pick.type} moves you closer (now ${stepsText(now)}).`, 8);
      else say(`Pass: it would not bring you closer (you are ${stepsText(now)}).`, 8);
    } else say('Wait for your turn, then tap Why? for advice.', 3);
  }

  function keyInput(keys) {
    const ui = S.ui;
    if (ui.pause || ui.ph === 'dealing' || ui.ph === 'result') { if (ui.ph === 'result' && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) nextHand(); return; }
    const p = (c) => keys.pressed.has(c);
    if (p('KeyH')) showHint();
    if (ui.ph === 'claim' && ui.claim?.human) {
      const o = ui.claim.opts[0];
      if (p('KeyW') && o.win) humanClaim('win'); else if (p('KeyK') && o.kong) humanClaim('kong'); else if (p('KeyP') && o.pung) humanClaim('pung');
      else if (p('KeyC') && o.chows.length) humanClaim('chow'); else if (p('KeyX') || p('Escape')) humanClaim('pass');
    }
    if (ui.ph === 'human') {
      if (p('KeyW') && ui.own?.win) humanOwn('win');
      if (p('KeyK') && ui.own?.kongs.length) humanOwn('kong0');
      const ids = [...T].filter(([, g]) => g.hand).sort((a, b) => a[1].x - b[1].x).map(([id]) => id);
      if (ids.length) {
        if (p('ArrowLeft') || p('ArrowRight')) {
          S.kb = true; let i = ids.indexOf(S.cursorId); if (i < 0) i = ids.length - 1; i = (i + (p('ArrowRight') ? 1 : -1) + ids.length) % ids.length; S.cursorId = ids[i]; sfx('click');
        }
        if (p('Enter') || p('Space') || p('ArrowUp')) { if (S.cursorId >= 0 && ids.includes(S.cursorId)) { if (p('ArrowUp')) { ui.selId = S.cursorId; ui.sel = S.cursorId; } else tapTile(S.cursorId); } S.kb = true; }
        if (p('ArrowDown')) { ui.selId = -1; ui.sel = -1; }
      }
    }
  }

  // ----------------------------------------------------------------------------------------------- per-tick
  function update(dt, input) {
    const h = S.h, ui = S.ui, ptr = input.pointer;
    if (ui.msg) { ui.msg.t += dt; if (ui.msg.t > ui.msg.hold) ui.msg = null; }
    if (ui.call) { ui.call.t += dt; if (ui.call.t > 1.4) ui.call = null; }
    // pointer
    if (ptr.pressed) {
      ui.down = { x: ptr.x, y: ptr.y, id: ui.ph === 'human' || ui.ph === 'claim' || ui.ph === 'ai' || ui.ph === 'turn' ? hitHand(ptr.x, ptr.y) : null };
      if (ui.down.id !== null && ui.ph === 'human') ui.drag = { id: ui.down.id, x: ptr.x, y: ptr.y };
    }
    if (ptr.down && ui.drag) { ui.drag.x = ptr.x; ui.drag.y = ptr.y; }
    if (keyPress(input)) keyInput(input.keys);

    if (ui.pause) { if (ptr.released) pauseTap(ptr.x, ptr.y); tween(dt); return; }

    if (ptr.released && ui.down) {
      const d = ui.down, dragged = ui.drag; ui.drag = null; ui.down = null;
      buttonTap(ptr.x, ptr.y, d, dragged);
    }
    if (ui.ph === 'dealing') {
      ui.wait -= dt;
      if (ui.wait <= 0) { ui.ph = 'turn'; ui.wait = 0.1; }
    } else if (ui.ph === 'turn') { ui.wait -= dt; if (ui.wait <= 0) stepTurn(); }
    else if (ui.ph === 'ai') {
      ui.wait -= dt;
      if (ui.wait <= 0) {
        const p = h.turn, a = aiTurn(h, p, S.match.levels[p], rng);
        if (a.kind === 'win') { declareWin(h, p, 'self'); ui.call = { seat: p, text: 'MAHJONG!', t: 0 }; finishHand(); }
        else if (a.kind === 'kong') { sfx('claim'); ui.call = { seat: p, text: 'KONG', t: 0 }; const r = makeKong(h, p, a.kong); if (r.ended) finishHand(); else ui.wait = pace(); }
        else doDiscard(a.tile);
      }
    } else if (ui.ph === 'claim') {
      const c = ui.claim;
      if (c.human) {
        if (c.timer > 0 && !c.chowPick) { c.t -= dt; if (c.t <= 0) { say('Time is up: passed.', 2); c.choices[0] = null; resolveClaims(); } }
      } else { ui.wait -= dt; if (ui.wait <= 0) resolveClaims(); }
    } else if (ui.ph === 'result') { ui.resT += dt; }
    tween(dt);
  }
  const keyPress = (input) => input.keys && input.keys.pressed && input.keys.pressed.size > 0;

  function buttonTap(x, y, down, dragged) {
    const ui = S.ui;
    if (ui.ph === 'result') { if (ui.resT > 0.5 && inRect(RESULT_BTN, x, y)) nextHand(); return; }
    if (ui.ph === 'dealing') { ui.wait = Math.min(ui.wait, 0.05); for (const v of vis.values()) { v.hold = 0; v.build = 0; } return; }
    if (inRect(BTN.menu, x, y) || inRect(BTN.pause, x, y)) { ui.pause = true; return; }
    if (inRect(BTN.hint, x, y)) { showHint(); return; }
    // claim buttons
    if (ui.ph === 'claim' && ui.claim.human) {
      const c = ui.claim;
      if (c.chowPick) {
        const n = c.chowPick.length, w = 200;
        c.chowPick.forEach((pair, i) => { const r = { x: 360 - (n * w + (n - 1) * 12) / 2 + i * (w + 12), y: 1164, w, h: 78 }; if (inRect(r, x, y)) { c.choices[0] = { type: 'chow', pair }; resolveClaims(); } });
        if (inRect({ x: 258, y: 1256, w: 204, h: 62 }, x, y)) c.chowPick = null;
        return;
      }
      for (const o of claimRects(claimList(c))) if (inRect(o.r, x, y)) { humanClaim(o.id); return; }
    }
    if (ui.ph === 'human' && ui.own) for (const o of claimRects(ownList(ui.own))) if (inRect(o.r, x, y)) { humanOwn(o.id); return; }
    // tiles
    if (down.id !== null && down.id !== undefined) {
      if (dragged && ui.ph === 'human' && y - down.y < -70) { doDiscard(down.id); return; }
      const up = hitHand(x, y);
      if (up === down.id) tapTile(down.id);
      return;
    }
    if (ui.selId >= 0 && y > 1100) { ui.selId = -1; ui.sel = -1; }
  }

  function pauseTap(x, y) {
    const ui = S.ui;
    if (inRect({ x: 130, y: 640, w: 460, h: 88 }, x, y)) ui.pause = false;
    else if (inRect({ x: 130, y: 750, w: 460, h: 88 }, x, y)) { S.prefs.sound = !S.prefs.sound; ctx.audio.setMuted?.(!S.prefs.sound); ctx.savePrefs(); }
    else if (inRect({ x: 130, y: 860, w: 460, h: 88 }, x, y)) { ui.pause = false; ctx.toTitle(); }
  }

  // ----------------------------------------------------------------------------------------------- tiles fly
  function tween(dt) {
    const h = S.h; if (!h) return;
    const ui = S.ui, calm = S.prefs.calm;
    T = tileTargets(h, { reveal: ui.ph === 'result', selected: ui.selId, big: S.prefs.big });
    rs.T = T;
    const k = calm ? 60 : 15, a = 1 - Math.exp(-k * dt), af = 1 - Math.exp(-(calm ? 60 : 11) * dt);
    for (const [id, tg] of T) {
      let v = vis.get(id);
      if (!v) { const p = wallPos(h.slot[id]); v = { id, x: p.x, y: p.y, rot: p.rot, w: p.w, f: 0, z: 0, lift: 0, hold: 0, build: 0 }; vis.set(id, v); }
      if (v.build > 0) { v.build -= dt; if (v.build > 0) continue; }
      if (v.hold > 0) v.hold -= dt;
      let g = tg;
      if (v.hold > 0) { const p = wallPos(h.slot[id]); g = { ...p, f: 0, z: 0, wall: true }; }
      if (ui.drag && ui.drag.id === id && ui.ph === 'human') { v.x = ui.drag.x; v.y = ui.drag.y - 40; v.w += (tg.w * 1.12 - v.w) * a; v.z = 30; v.lift = 1; v.f = 1; v.rot = 0; v.wall = false; continue; }
      const dx = g.x - v.x, dy = g.y - v.y, dist = Math.hypot(dx, dy);
      v.x += dx * a; v.y += dy * a; v.w += (g.w - v.w) * a;
      let dr = g.rot - v.rot; dr = ((dr + Math.PI * 3) % (Math.PI * 2)) - Math.PI; v.rot += dr * a;
      v.f += (g.f - v.f) * af; if (Math.abs(g.f - v.f) < 0.01) v.f = g.f;
      const moving = dist > 9;
      v.z = (g.z ?? 0) + (moving ? 12 : 0); v.lift = moving ? Math.min(1, dist / 160) : Math.max(0, v.lift - dt * 4);
      v.wall = !!g.wall; v.river = !!g.river;
      if (!g.wall && v.hold > 0) v.wall = true;
      if (dist < 0.3) { v.x = g.x; v.y = g.y; }
    }
    // keyboard cursor position
    if (S.cursorId >= 0 && T.get(S.cursorId)?.hand) rs.cursorPos = T.get(S.cursorId); else { rs.cursorPos = null; if (S.kb) { const first = [...T].filter(([, g]) => g.hand).sort((p, q) => p[1].x - q[1].x); if (first.length) S.cursorId = first[first.length - 1][0]; } }
  }

  function resume(saved) {
    S.match = saved.match; S.matchWins = saved.matchWins ?? 0; S.h = saved.h; vis.clear(); T = new Map();
    S.ui = { ph: 'human', wait: 0, sel: -1, selId: -1, msg: null, hint: null, claim: null, own: null, lastDisc: -1, pause: false, drag: null, resT: 0, call: null, resultLast: false, name: '' };
    enterHuman(); say('Hand restored. Your turn.', 3);
  }

  return { startHand, update, nextHand, resume, tween, hitHand, finishHand };
}
