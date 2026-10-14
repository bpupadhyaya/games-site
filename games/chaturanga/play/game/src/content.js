// The reading pages: How to Play, About and Rules. Every entry is a section { title, lines[], diagram? }. Movement diagrams are
// computed with the real move generator (rules.js), so the Rules page can never disagree with the engine.
import { genInto, newGame, parseSq, WHITE, BLACK, PADATI, ASHVA, GAJA, RATHA, MANTRI, RAJA, ANCIENT, MODERN, TYPE_NAME, MODERN_NAME, mFrom, mTo } from './rules.js';
import { LEVELS } from './engine.js';

const sq = parseSq;
// the squares one piece (alone on an empty board) can reach from `at`
function reach(type, era, at, side = WHITE) {
  const b = new Int8Array(64); b[sq(at)] = type * side;
  const list = new Int32Array(256), n = genInto(b, side, list, 0, false, era), out = [];
  for (let i = 0; i < n; i++) if (mFrom(list[i]) === sq(at)) out.push(mTo(list[i]));
  return out;
}
const dots = (squares) => squares.map((s) => [s, '.']);
const moveDiagram = (type, era, at, extra = {}) => ({
  S: 46, f0: 0, f1: 7, r0: 0, r1: 7, pieces: [[sq(at), type], ...(extra.pieces || [])], marks: [...dots(reach(type, era, at)), ...(extra.marks || [])], arrows: extra.arrows || [], rings: extra.rings || [],
});
const win = (f0, f1, r0, r1, pieces, o = {}) => ({ S: 50, f0, f1, r0, r1, pieces: pieces.map(([n, p]) => [sq(n), p]), marks: (o.marks || []).map(([n, m]) => [sq(n), m]), arrows: (o.arrows || []).map(([a, c]) => [sq(a), sq(c)]), rings: (o.rings || []).map(sq) });

const START = (() => { const g = newGame(ANCIENT), out = []; for (let s = 0; s < 64; s++) if (g.board[s]) out.push([s, g.board[s]]); return out; })();

export const HOWTO = [
  { title: 'The aim', lines: ['Chaturanga is a game of two armies on an eight by eight board. Checkmate the other side\'s Raja (king) and you win.', 'Ivory moves first. You can play Ivory or Vermilion against the computer, or share one device in Two Players.'] },
  { title: 'Moving', lines: ['Tap one of your pieces: its legal squares light up. Quiet moves are cream dots and captures are red rings. Tap a lit square to move, or drag the piece there.', 'If you tap a move that is not allowed, the message under the board tells you why.'] },
  { title: 'The six pieces', lines: ['Raja (king): one square any way. Mantri (counsellor): one square diagonally. Gaja (elephant): leaps two squares diagonally. Ashva (horse): the knight\'s L. Ratha (chariot): slides along ranks and files. Padati (foot soldier): steps ahead, takes diagonally.'], diagram: win(2, 5, 3, 6, [['c4', GAJA], ['e6', -ASHVA]], { marks: [['e6', 'x']], arrows: [['c4', 'e6']] }) },
  { title: 'How a game ends', lines: ['Checkmate wins. In the ancient game a side with no legal move that is NOT in check also loses (stalemate), and so does a side left with only its bare Raja. See Rules for the full list and for the draws.'] },
  { title: 'Ancient or modern', lines: ['The Movement button switches between the ancient Chaturanga pieces and today\'s chess movements, so you can feel the difference. The History screen shows both side by side and lets you drop a piece anywhere to compare.'] },
  { title: 'Learn, History, Watch & Learn', lines: ['Learn: short one-move lessons for every piece and the special endings.', 'History: the same piece on an ancient and a modern board, side by side.', 'Watch & Learn: two computers play a whole game. Each move you get time to think, then the options and the choice are shown, then it is played. Pause any time.'] },
  { title: 'Think, Threats, Undo', lines: ['Think shows a strong move and says why. Threats rings your pieces that could be taken next. Undo takes back your last move and the reply.'] },
  { title: 'Reading size', lines: ['Every text screen has A- and A+ buttons: text goes up to 300%. On the web version the arrow keys move a cursor; Space picks and drops, U undoes, H is Think, T shows Threats and Escape goes back.'] },
];

export const ABOUT = [
  { title: 'Chaturanga', lines: ['Chaturanga (the Sanskrit word means "four limbs") is the ancient strategy game of India, usually placed in the Gupta era, around the fifth and sixth centuries. It is the oldest known ancestor of chess, and a cousin of shatranj, xiangqi, shogi and makruk.'] },
  { title: 'The four limbs', lines: ['The name comes from the four divisions of an ancient army: infantry (padati), cavalry (ashva), elephants (gaja) and chariots (ratha), gathered around a raja and his counsellor (mantri).'] },
  { title: 'A reconstruction', lines: ['No complete rule book from the period survives. The rules here are the commonly reconstructed ones, built from later Persian and Arabic descriptions. Where historians disagree (stalemate, bare Raja, promotion) this game states its choice plainly on the Rules page.'] },
  { title: 'The look', lines: ['The board is uncheckered carved sandalwood in a dark frame with a brass inlay and the old cross-marks of the eight-squared ashtapada, standing on a rug in a lamp-lit palace courtyard at sunset. The pieces are sculpted figures: a Raja under his canopy, a turbaned Mantri, an elephant with a howdah, a horse, a chariot with spoked wheels and a foot soldier with spear and shield, in ivory and vermilion lacquer with brass. The colours are taken from Indian miniature painting.'] },
  { title: '3D credits', lines: ['The 3D scene is drawn with three.js (Copyright (c) 2010-2024 three.js authors, MIT License, threejs.org), including its RoomEnvironment lighting helper, and the meshoptimizer decoder (Copyright (c) 2016-2024 Arseny Kapoulkine, MIT License). All models, textures and lettering in this game were made for it.'] },
  { title: 'Part of Arcforge', lines: ['One of the world heritage games in the Arcforge collection. No ads, it works offline, and the free preview lets you try the game before you unlock it once.'] },
];

const pieceRule = (type, era, at, text, extra) => ({ title: era === MODERN ? `${MODERN_NAME[type]} (${TYPE_NAME[type]})` : `${TYPE_NAME[type]} (${MODERN_NAME[type]})`, lines: [text], diagram: moveDiagram(type, era, at, extra) });

export const RULES = [
  { title: 'The board', lines: ['Eight by eight squares (the old ashtapada was uncheckered: all the squares are one colour, marked out only by engraved lines, as on the ancient boards). Files are lettered a to h left to right and ranks are numbered 1 to 8. The cross-marks in the corners and the stars in the middle are decoration from the old boards; they have no effect on play.'] },
  { title: 'The armies', lines: ['Each side has sixteen pieces: a Raja, a Mantri, two Gaja, two Ashva, two Ratha and eight Padati. Ivory starts on ranks 1 and 2 and moves up the board; Vermilion starts on ranks 7 and 8. Raja and Mantri stand on e and d, facing the enemy Raja and Mantri.'], diagram: { S: 40, f0: 0, f1: 7, r0: 0, r1: 7, pieces: START, marks: [], arrows: [], rings: [] } },
  { title: 'Turns and capture', lines: ['Ivory moves first and then the sides alternate. You must move; passing is not allowed. A piece captures by moving onto a square held by an enemy piece, which is removed. No piece may land on a square held by its own side.'] },
  { ...pieceRule(RAJA, ANCIENT, 'd4', 'One square in any direction. The Raja may never move into check, and there is no castling.') },
  { ...pieceRule(MANTRI, ANCIENT, 'd4', 'One square diagonally. The counsellor is the weakest piece and stays on one colour of square.') },
  { ...pieceRule(GAJA, ANCIENT, 'c3', 'Leaps exactly two squares diagonally and may jump over any piece between. It always stays on one colour of square, so it can never attack a square next to it.') },
  { ...pieceRule(ASHVA, ANCIENT, 'd4', 'Two squares along a rank or file and then one at right angles, jumping over anything in the way.') },
  { ...pieceRule(RATHA, ANCIENT, 'd4', 'Slides any distance along a rank or file, stopping before a friendly piece or on an enemy piece it captures. It cannot jump.') },
  { title: 'Padati (pawn)', lines: ['Steps one square straight ahead onto an empty square, and captures one square diagonally ahead. It cannot capture straight ahead and cannot move backwards. In the ancient game it has no two-square first step.'], diagram: win(2, 5, 1, 4, [['d2', PADATI], ['c3', -ASHVA], ['e3', -RATHA], ['d3', -PADATI]], { marks: [['c3', 'x'], ['e3', 'x']] }) },
  { title: 'Promotion', lines: ['A Padati that reaches the far rank becomes a Mantri. It cannot become anything else, so a promoted Padati is a modest gain, not a queen.'], diagram: win(3, 6, 5, 7, [['f7', PADATI]], { marks: [['f8', '.']], arrows: [['f7', 'f8']] }) },
  { title: 'Check', lines: ['A Raja is in check when an enemy piece could capture it next move. You must answer a check at once: move the Raja, capture the attacker, or put a piece in the way of a sliding attacker. You may never make a move that leaves your own Raja in check, and a Raja may never be captured.'], diagram: win(2, 6, 0, 3, [['e1', RAJA], ['e4', -RATHA]], { rings: ['e1'], arrows: [['e4', 'e1']] }) },
  { title: 'Checkmate', lines: ['If your Raja is in check and nothing can answer it, it is checkmate and you lose. This is the normal way to win.'], diagram: win(4, 7, 4, 7, [['h8', -RAJA], ['g7', -PADATI], ['h7', -PADATI], ['c8', RATHA]], { rings: ['h8'], arrows: [['c8', 'h8']] }) },
  { title: 'Stalemate (ancient)', lines: ['Reconstruction: if the side to move has no legal move but its Raja is NOT in check, it is stalemate, and the side that has no move LOSES. This is how the later Persian game of shatranj treated it. In the modern set stalemate is a draw.'] },
  { title: 'Bare Raja (ancient)', lines: ['Reconstruction: if one side is left with only its Raja (all other pieces captured), the other side wins, unless the bare Raja can capture the last enemy piece on its very next move: then the game goes on, and if it does take it both sides are bare and the game is drawn. Two bare Rajas are a draw at once.'] },
  { title: 'Draws', lines: ['The game is drawn when: a position occurs for the third time; one hundred moves in a row (fifty by each side) pass with no capture and no Padati move; both Rajas are bare. In the modern set it is also a draw when neither side can possibly mate (a bare King against a lone Knight or Bishop, or against nothing) and on stalemate.'] },
  { title: 'The modern set', lines: ['Switch Movement to Modern chess to play with today\'s movements on the same board: the Mantri becomes the Queen (slides in every direction), the Gaja the Bishop (slides diagonally), and a Padati may step two squares on its first move and promotes to a Queen. Castling and en passant are left out. A stalemate is a draw.'] },
  { ...pieceRule(MANTRI, MODERN, 'd4', 'Modern set: the Queen slides any distance along a rank, file or diagonal.') },
  { ...pieceRule(GAJA, MODERN, 'c3', 'Modern set: the Bishop slides any distance diagonally.') },
  { title: 'Modern Pawn', lines: ['Modern set: a Pawn steps one square ahead, or two squares from its starting rank when both are empty, and captures diagonally. It promotes to a Queen on the far rank. There is no en passant.'], diagram: win(2, 5, 0, 4, [['d2', PADATI]], { marks: [['d3', '.'], ['d4', '.']] }) },
  { title: 'What changed over time', lines: ['In the ancient game the counsellor and the elephant were short-range pieces, so games were slower and an army was hard to break open. Over about a thousand years the elephant became a long-range bishop, the counsellor became the queen, the pawn gained its double step, and chess became the quicker game we know.'] },
  { title: 'Computer levels', lines: LEVELS.slice(1).map((L, i) => `Level ${i + 1}, ${L.name}: ${L.blurb}`) },
  { title: 'Think, Threats and Undo', lines: ['Think searches for a strong move, marks it with an arrow and explains it. Threats rings every one of your pieces that the enemy could take next move. Undo takes back your move and the computer\'s reply. Resign gives up the game (tap twice to confirm).'] },
  { title: 'Watch & Learn', lines: ['Two computers play a whole game. For each move the game THINKS (you choose 2, 5, 8 or 10 seconds), then REVEALS the pieces that could move and the move chosen, then ACTS. Pause freezes everything exactly where it is.'] },
  { title: 'Previews and unlocking', lines: ['The menus, Settings, Rules, History and Watch & Learn are always free. Real play and the lessons use a short free preview; unlock the full game once to keep playing, with no ads and no subscription.'] },
];

export function page(scene) { return scene === 'howto' ? HOWTO : scene === 'about' ? ABOUT : RULES; }
void BLACK;
