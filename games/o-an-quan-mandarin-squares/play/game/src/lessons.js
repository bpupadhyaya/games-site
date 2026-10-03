// The Learn path: six lessons. Five are real positions where one idea decides the move; the sixth is a whole game.
// Positions were found by search (dev/find-lessons.mjs) so that the right answer is unique, then fixed here.
import { outcome, legalMoves, play } from './engine.js';
import { bestReply, moveWords } from './explain.js';
import { tr, getLang } from './content.js';

const mk = (cells, q) => ({ cells, q, pd: [0, 0], pq: [0, 0], mc: [0, 0], turn: 1, qv: 10, young: true, plies: 0, over: null });

export const LESSONS = [
  { id: 'capture', type: 'task', judge: 'best', state: mk([8, 2, 0, 0, 7, 1, 12, 4, 0, 3, 2, 0], [1, 1]) },
  { id: 'relay', type: 'task', judge: 'best', state: mk([6, 1, 1, 5, 1, 6, 8, 5, 2, 0, 0, 2], [1, 1]) },
  { id: 'chain', type: 'task', judge: 'best', state: mk([1, 7, 7, 7, 1, 1, 2, 0, 6, 6, 6, 0], [1, 1]) },
  { id: 'quan', type: 'task', judge: 'best', state: mk([7, 0, 1, 1, 1, 6, 6, 1, 11, 0, 12, 1], [1, 1]) },
  { id: 'defend', type: 'task', judge: 'defend', state: mk([6, 1, 1, 1, 2, 1, 6, 1, 3, 0, 0, 12], [1, 1]) },
  { id: 'game', type: 'game', level: 'novice', human: 1 },
];

const TEXT = {
  en: {
    capture: { title: 'Jump an empty square', task: 'Find the move that captures. The last stone must be followed by an empty square with stones behind it.', done: 'Right: the last stone fell short of an empty square, and the full square beyond it was captured. Leaping one empty square is the heart of the game.' },
    relay: { title: 'Keep sowing', task: 'Find the move that captures the most. Remember: when the last stone lands before a full square, you pick that square up and sow on.', done: 'Right: the sowing carried on through a full square and ended in a capture. Always follow the relay to its end before you choose.' },
    chain: { title: 'Chain captures', task: 'One move here captures twice in a row. Find it.', done: 'Right: after the first capture the next square was empty and the one beyond it full, so you took that as well.' },
    quan: { title: 'Take the mandarin', task: 'Find the move that captures a mandarin. It is worth 10 points, plus every stone in its square.', done: 'Right: the mandarin is the biggest prize on the board. The game ends when both are taken, so watch how many you and your opponent hold.' },
    defend: { title: 'Defend', task: 'Nothing can be captured this turn. Find a move that leaves the opponent no big capture in reply.', done: 'Right: your move left the opponent no good capture. Before every move, look at what the other side could take in answer.' },
    game: { title: 'A whole game', task: 'Play a whole game against the Novice opponent.', done: 'Well played: you finished a whole game.' },
  },
  vi: {
    capture: { title: 'Nhảy qua ô trống', task: 'Tìm nước đi ăn được dân. Sau viên cuối cùng phải là một ô trống, và phía sau ô trống đó có dân.', done: 'Đúng rồi: viên cuối cùng rơi trước một ô trống, và ô đầy ở phía sau bị ăn. Nhảy qua một ô trống là cốt lõi của trò chơi.' },
    relay: { title: 'Rải tiếp', task: 'Tìm nước đi ăn được nhiều nhất. Nhớ rằng khi viên cuối rơi trước một ô đầy, bạn nhấc ô đó lên và rải tiếp.', done: 'Đúng rồi: việc rải đi tiếp qua một ô đầy và kết thúc bằng một lần ăn. Hãy luôn theo chuỗi rải đến cùng trước khi chọn.' },
    chain: { title: 'Ăn liên tiếp', task: 'Có một nước ở đây ăn hai lần liên tiếp. Hãy tìm nó.', done: 'Đúng rồi: sau lần ăn đầu, ô kế tiếp trống và ô sau đó đầy, nên bạn ăn luôn cả ô đó.' },
    quan: { title: 'Ăn quan', task: 'Tìm nước đi ăn được một quan. Quan được 10 điểm, cộng thêm mọi dân trong ô.', done: 'Đúng rồi: quan là phần thưởng lớn nhất trên bàn. Ván kết thúc khi cả hai quan bị ăn, nên hãy để ý mỗi bên có bao nhiêu.' },
    defend: { title: 'Phòng thủ', task: 'Lượt này không ăn được gì. Tìm nước đi không để đối thủ có miếng ăn lớn khi đáp trả.', done: 'Đúng rồi: nước đi của bạn không để đối thủ ăn được nhiều. Trước mỗi nước, hãy nhìn xem bên kia có thể ăn gì để đáp trả.' },
    game: { title: 'Một ván đầy đủ', task: 'Chơi trọn một ván với đối thủ Người mới.', done: 'Chơi tốt lắm: bạn đã hoàn thành một ván đầy đủ.' },
  },
};
export const lessonText = (id) => TEXT[getLang()][id];

export function lessonStart(L) { return L.state; }

// Is the move right? Returns { ok, text } (text: why not, or why yes).
export function judge(L, st, mv) {
  const outs = legalMoves(st).map((m) => ({ m, o: outcome(st, m) }));
  const mine = outs.find((x) => x.m.cell === mv.cell && x.m.dir === mv.dir).o;
  if (L.judge === 'best') {
    const best = Math.max(...outs.map((x) => x.o.gain));
    if (mine.gain >= best) return { ok: true, text: lessonText(L.id).done };
    return { ok: false, text: mine.gain === 0 ? tr('lessonWrongNone') : tr('lessonWrongLess', { a: mine.gain, b: best }) };
  }
  const reps = outs.map((x) => bestReply(x.o.after));
  const min = Math.min(...reps), my = bestReply(mine.after);
  if (my <= min) return { ok: true, text: lessonText(L.id).done };
  return { ok: false, text: tr('lessonWrongDef', { a: my }) };
}
export { moveWords, play };
