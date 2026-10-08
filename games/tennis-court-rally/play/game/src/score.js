// Tennis scoring: points (0-15-30-40, deuce, advantage or no-ad), games, a set with a tiebreak. Pure, no randomness.
import { FORMATS } from './consts.js';

export function newScore(fmtId = 'quick', firstServer = 0) {
  const f = FORMATS[fmtId] || FORMATS.quick;
  return { fmt: f.id, pts: [0, 0], games: [0, 0], tb: false, tbN: 0, server: firstServer, tbServer: firstServer, over: false, winner: -1, gamesPlayed: 0, log: [] };
}

// The player who serves the next point.
export function serverOf(sc) {
  if (!sc.tb) return sc.server;
  const i = sc.pts[0] + sc.pts[1];
  return sc.tbServer ^ (((i + 1) >> 1) & 1);
}
// 0 = the deuce (right) court, 1 = the advantage (left) court.
export const courtOf = (sc) => ((sc.pts[0] + sc.pts[1]) & 1);
export const isBreakPoint = (sc) => { if (sc.tb || sc.over) return false; const r = 1 - sc.server; return sc.pts[r] >= 3 && sc.pts[r] > sc.pts[sc.server] - (FORMATS[sc.fmt].noAd ? 1 : 0) && (sc.pts[r] > sc.pts[sc.server] || FORMATS[sc.fmt].noAd); };

const LABEL = ['0', '15', '30', '40'];
export function pointText(sc) {
  const [a, b] = sc.pts;
  if (sc.tb) return [String(a), String(b)];
  if (a >= 3 && b >= 3) {
    if (FORMATS[sc.fmt].noAd) return ['40', '40'];
    if (a === b) return ['40', '40'];
    return a > b ? ['Ad', '40'] : ['40', 'Ad'];
  }
  return [LABEL[Math.min(a, 3)], LABEL[Math.min(b, 3)]];
}
export function callText(sc) {                      // "Love-15", "Deuce", "Advantage you" style call for the scoreboard
  const [a, b] = sc.pts;
  if (sc.tb) return `${a}-${b}`;
  if (a >= 3 && b >= 3 && !FORMATS[sc.fmt].noAd) return a === b ? 'Deuce' : a > b ? 'Advantage player 1' : 'Advantage player 2';
  const t = pointText(sc);
  return a === b ? `${t[0] === '0' ? 'Love' : t[0]} all` : `${t[0] === '0' ? 'Love' : t[0]}-${t[1] === '0' ? 'Love' : t[1]}`;
}

// Award a point to `w`. Returns { game: bool, set: bool } (set: the match is over).
export function awardPoint(sc, w) {
  const f = FORMATS[sc.fmt];
  sc.pts[w]++;
  const [a, b] = sc.pts, mine = sc.pts[w], theirs = sc.pts[1 - w];
  let gameWon = false;
  if (sc.tb) gameWon = mine >= 7 && mine - theirs >= 2;
  else if (f.noAd) gameWon = mine >= 4;
  else gameWon = mine >= 4 && mine - theirs >= 2;
  void a; void b;
  if (!gameWon) return { game: false, set: false };
  sc.games[w]++; sc.gamesPlayed++;
  sc.log.push({ w, tb: sc.tb, games: [...sc.games] });
  const g = sc.games[w], o = sc.games[1 - w];
  let setWon;
  if (sc.tb) setWon = true;
  else if (f.id === 'quick') setWon = g >= f.games;
  else if (f.id === 'short') setWon = g >= f.games;
  else setWon = g >= f.games && g - o >= 2;
  sc.pts = [0, 0];
  const wasTb = sc.tb;
  sc.tb = false;
  if (setWon) { sc.over = true; sc.winner = w; return { game: true, set: true, tb: wasTb }; }
  // next server: alternates every game (after a tiebreak the match is over, so nothing to do)
  sc.server = 1 - sc.server;
  if (f.tb && sc.games[0] === (f.tbAt ?? f.games) && sc.games[1] === (f.tbAt ?? f.games)) { sc.tb = true; sc.tbServer = sc.server; }
  return { game: true, set: false, tb: wasTb };
}
