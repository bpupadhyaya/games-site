// What the lower panel of the play screen holds in each moment (pure: reads the state, returns widgets for the flow layout and the
// one-line coach text). game.js hit-tests these ids, view.js draws them.
import {
  COURT, ACTIONS, RESPONSES, ACTION_NAME, RESPONSE_NAME, FORMATIONS, FORMATION_NAME, available, validTargets, defenderPositions, nearestTarget,
  raiderOf, defenderOf, describePlayer, pips, bonusLive, BONUS_MIN_DEFENDERS, SUPER_TACKLE_MAX, TOUCH_ACTIONS,
} from './rules.js';
import { LEVELS, explainFormation } from './ai.js';

const SHORT = { step: 'Step in', feintL: 'Feint ◀', feintR: 'Feint ▶', hand: 'Hand touch', toe: 'Toe touch', run: 'Running touch', bonus: 'Bonus line', retreat: 'Retreat' };
const SUB_OFF = { step: 'Past the baulk line', bonus: '', retreat: 'Cross the baulk line first' };

export const humanRaids = (state) => { const sc = state.sc; if (!sc || sc.ctl.watch || !sc.raid) return false; return !!sc.ctl.human[sc.raid.team]; };
export const humanDefends = (state) => { const sc = state.sc; if (!sc || sc.ctl.watch || !sc.raid) return false; return !!sc.ctl.human[sc.raid.def]; };

export const teamName = (state, t) => {
  const c = state.sc?.ctl; const nm = t === 0 ? 'Blue' : 'Red';
  if (!c) return nm;
  if (c.watch) return `${nm} · ${LEVELS[c.levels[t]].name}`;
  if (c.twoHumans) return `${nm} · Player ${t + 1}`;
  return c.human[t] ? `${nm} · You` : `${nm} · ${LEVELS[c.levels[t]].name}`;
};

export function targetsSorted(raid, pos) { return validTargets(raid).sort((a, b) => pos[b].x - pos[a].x); }   // screen left to right

export function panelKind(state) {
  const sc = state.sc;
  if (!sc) return 'none';
  if (state.lesson && state.lesson.phase === 'intro') return 'none';
  if (sc.phase === 'pre') return sc.pre && (sc.pre.humanR || sc.pre.humanD) ? 'pre' : 'none';
  if (sc.ctl.watch) return 'watch';
  const hr = humanRaids(state), hd = humanDefends(state);
  if (sc.phase === 'decide' && hr && sc.need) return 'raid';
  if (sc.phase === 'commit' && hd && sc.need && sc.need.kind === 'response') return 'resp';
  if (hr) return 'raidDim';
  if (hd) return 'respDim';
  return 'none';
}

const mini = (v) => `${'●'.repeat(pips(v))}${'○'.repeat(5 - pips(v))}`;

export function raiderInfo(state, team, id) {
  const p = state.sc.match.teams[team].players[id];
  return { p, line1: `#${p.num}  ${p.role === 'raider' ? 'Raider' : p.role === 'defender' ? 'Defender' : 'All-rounder'}: ${describePlayer(p)}`, line2: `Speed ${pips(p.spd)}  Agility ${pips(p.agi)}  Reach ${pips(p.rch)}` };
}

export function panelWidgets(state) {
  const sc = state.sc;
  let kind = panelKind(state);
  const wd = [];
  const watching = kind === 'watch';
  const pick = watching && sc.need && sc.need.ai ? sc.need.pick : null;
  if (watching) kind = !sc.need ? 'none' : sc.need.kind === 'action' ? 'raid' : sc.need.kind === 'response' ? 'resp' : 'none';
  const lesson = state.lesson && state.lesson.phase === 'play' ? state.lesson.def : null;
  const allowed = (id) => !lesson || lesson.allow.includes(id);
  if (kind === 'pre') {
    const p = sc.pre, m = sc.match;
    if (p.humanR) {
      const info = raiderInfo(state, p.team, p.raider);
      wd.push({ t: 'p', label: 'Your raider', bold: true, color: '#ffe9bf', size: 22 });
      wd.push({ t: 'btn', id: 'rprev', label: '◀', row: 1, h: 70 });
      wd.push({ t: 'btn', id: 'rinfo', label: `#${info.p.num}`, sub: info.line2, row: 1, active: true, hitDisabled: false, h: 70 });
      wd.push({ t: 'btn', id: 'rnext', label: '▶', row: 1, h: 70 });
      wd.push({ t: 'p', label: info.line1, size: 20, color: 'rgba(255,243,214,0.9)' });
    }
    if (p.humanD) {
      wd.push({ t: 'p', label: 'Your formation', bold: true, color: '#ffe9bf', size: 22 });
      FORMATIONS.forEach((f, i) => wd.push({ t: 'btn', id: `form-${f}`, label: FORMATION_NAME[f], row: 2 + (i >> 1), active: p.formation === f, h: 70 }));
      wd.push({ t: 'p', label: explainFormation(m, null, p.formation), size: 20, color: 'rgba(255,243,214,0.9)' });
    }
    wd.push({ t: 'btn', id: 'start', label: p.humanR && !p.humanD ? 'Start the raid' : 'Ready', primary: true, h: 84 });
    return wd;
  }
  if (kind === 'raid' || kind === 'raidDim') {
    const raid = sc.raid, av = available(raid), dim = kind === 'raidDim' || !!state.paused || watching;
    const st = stepperWidgets(state, true);
    if (st) {
      wd.push({ t: 'btn', id: 'tprev', label: '◀', row: 19, h: 64, disabled: dim, hitDisabled: false });
      wd.push({ t: 'btn', id: 'tinfo', label: st.label, sub: st.sub, row: 19, h: 64, active: !dim, disabled: dim });
      wd.push({ t: 'btn', id: 'tnext', label: '▶', row: 19, h: 64, disabled: dim });
    }
    const row = (ids, r) => ids.forEach((id) => {
      const off = av[id], ok = !off && (watching || !dim) && allowed(id);
      const chosen = watching && pick && pick.action === id && state.watch && state.watch.phase !== 'think';
      wd.push({ t: 'btn', id: `act-${id}`, label: SHORT[id], sub: off ? SUB_OFF[id] || 'Not available' : (!allowed(id) ? 'Not in this lesson' : undefined), row: r, disabled: !ok, hitDisabled: true, active: chosen, primary: !watching && ok && id === 'retreat' && raid.banked.length > 0, h: 76 });
    });
    row(['step', 'feintL', 'feintR'], 20); row(['hand', 'toe', 'run'], 21); row(['bonus', 'retreat'], 22);
    return wd;
  }
  if (kind === 'resp' || kind === 'respDim') {
    const dim = kind === 'respDim' || !!state.paused || watching;
    const row = (ids, r) => ids.forEach((id) => {
      const ok = (watching || !dim) && allowed(id);
      const chosen = watching && pick && pick === id && state.watch && state.watch.phase !== 'think';
      wd.push({ t: 'btn', id: `resp-${id}`, label: RESPONSE_NAME[id], row: r, disabled: !ok, hitDisabled: true, active: chosen, h: 76 });
    });
    row(['ankle', 'thigh', 'chain'], 30); row(['block', 'dash', 'hold'], 31);
    return wd;
  }
  return wd;
}

// Target stepper (raider only): shown above the buttons as its own row.
export function stepperWidgets(state, any = false) {
  const sc = state.sc;
  if (!sc || !sc.raid || !(any ? ['raid', 'raidDim', 'watch'].includes(panelKind(state)) : panelKind(state) === 'raid')) return null;
  const raid = sc.raid, pos = defenderPositions(raid);
  const list = targetsSorted(raid, pos);
  if (!list.length) return { label: 'No defender left to touch', none: true };
  const tgt = list.includes(state.ui.target) ? state.ui.target : nearestTarget(raid, pos);
  const d = defenderOf(sc.match, raid, tgt);
  return { label: `Target  #${d.num}`, sub: `${describePlayer(d)}`, id: tgt, count: list.length };
}

export function coachText(state) {
  const sc = state.sc;
  if (!sc) return '';
  const m = sc.match, raid = sc.raid;
  if (state.lesson && state.lesson.phase === 'play' && state.lesson.def) return `Goal: ${state.lesson.def.goal}`;
  if (state.hintLine) return state.hintLine;
  if (sc.ctl.watch && state.watch && state.watch.text) return state.watch.text;
  switch (sc.phase) {
    case 'pre': return sc.pre ? `${sc.pre.team === 0 ? 'Blue' : 'Red'} to raid. ${sc.pre.humanD ? 'Pick your formation.' : sc.pre.humanR ? 'Check your raider, then start.' : ''}` : '';
    case 'enter': return raid.dod ? 'Do-or-die raid: the raider must score.' : `Raider #${raiderOf(m, raid).num} walks to the midline.`;
    case 'decide': {
      if (!humanRaids(state)) return `Raider #${raiderOf(m, raid).num} is choosing...`;
      if (!raid.crossed) return 'Cross the baulk line before you can go home.';
      if (raid.banked.length) return `${raid.banked.length} touch${raid.banked.length > 1 ? 'es' : ''} banked: they only count if you get home.`;
      return raid.dod ? 'Do-or-die: you must score before you go home.' : 'Tag a defender, or take the bonus line.';
    }
    case 'commit': {
      const b = sc.beat;
      if (!b) return '';
      const tgt = b.seen.target != null ? `#${defenderOf(m, raid, b.seen.target).num}` : 'the line';
      const what = b.seen.action === 'retreat' ? 'is running for home' : `eyes ${tgt}: ${ACTION_NAME[b.seen.action].toLowerCase()}`;
      return humanDefends(state) && sc.need ? `Raider #${raiderOf(m, raid).num} ${what}. Choose your answer.` : `Raider #${raiderOf(m, raid).num} ${what}.`;
    }
    case 'contact': return (sc.ctl.human[sc.raid.team] || sc.ctl.human[sc.raid.def]) && !sc.ctl.twoHumans && !sc.ctl.watch ? 'Tap when the ring closes.' : 'Contact...';
    case 'after': return sc.afterKind === 'tackle' ? 'Held!' : sc.afterKind === 'escape' ? 'Back across the midline.' : '';
    case 'result': return sc.summary ? sc.summary.label : '';
    default: return '';
  }
}
