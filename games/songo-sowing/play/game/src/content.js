// Text content for the Rules reference page. Kept factual and cross-checked against the actual rule book in rules.js so this
// page can never contradict the engine. The page is one continuous scrolling reader (view.js): each entry is a titled section of
// short paragraphs. `role` tells view.js which real in-game board snapshot (drawn with the game's own drawBoard/drawSeed/pitPos/
// slot) to show under the title, if any - never a separate invented icon set.
export const RULES = [
  { title: 'Which Songo is this?', lines: [
    'Songo is played with small differences from town to town and club to club. This game follows the rules taught by Songo clubs in Cameroon and Gabon, as published in French by Club Awalé, together with the Ekang (Ewondo) rule summaries found in mancala reference works.',
    'The rules below describe exactly what this game does. Where sources differ, the choice is listed under “About this rule set” at the end.',
  ] },
  { title: 'The board', role: 'setup', lines: [
    'Songo is played on a long carved board of fourteen houses: seven on each side.',
    'Each side also has a store, a long trough at its end of the board, which holds the seeds that side has captured.',
    'The bottom row is yours; the top row belongs to your opponent.',
  ] },
  { title: 'The seeds', lines: [
    'Every house starts with five seeds, seventy in all. Both stores start empty.',
    'You sow first, from the bottom row. In a two-player game, Player one (the bottom row) goes first.',
  ] },
  { title: 'Your houses', role: 'mine', lines: [
    'Your seven houses are the bottom row. Tap any one that holds a seed to sow it.',
    'You may never sow from an empty house, and never from one of your opponent’s houses.',
  ] },
  { title: 'The opponent’s houses', role: 'theirs', lines: [
    'The seven houses of the top row belong to your opponent. They sow from these houses on their turn, exactly as you sow from yours.',
    'Your sowing can drop seeds into their houses, and that is how you capture.',
  ] },
  { title: 'The way round', lines: [
    'Seeds travel clockwise as you look at the board: along your row from right to left, up into your opponent’s row at the top left, along it from left to right, and back down to your row at the bottom right.',
    'The fourteen houses form one loop. The small arrows carved between the rows show the way.',
  ] },
  { title: 'How you sow', lines: [
    'Sowing lifts every seed from the house you chose and drops them one at a time into the houses that follow, going round the loop.',
    'Up to thirteen seeds travel once round and never reach the house they started from.',
  ] },
  { title: 'The leftmost house', role: 'leftmost', lines: [
    'The last house of each row in the sowing order is its leftmost house, as you face your own row. It is ringed with carved ivory dots on the board.',
    'It may be sown only if it holds three or more seeds, or exactly two seeds when that sowing captures something.',
    'If it is the only house you can play, you may sow it whatever it holds. It may also be sown thin when it is the only way to feed an opponent with no seeds (see “Feeding a hungry opponent”).',
  ] },
  { title: 'The first house', role: 'first', lines: [
    'The first house of each row is the one the sowing enters first, at the bottom right for you and at the top left for your opponent. It is marked with four carved ivory diamonds.',
    'If your last seed lands in your opponent’s first house, that house is not captured, whatever it holds.',
    'It can still be taken as part of a chain (see “Chain captures”).',
  ] },
  { title: 'Long sowings', lines: [
    'A house with fourteen seeds or more makes a long sowing.',
    'The first lap visits the other thirteen houses one by one, yours included, and skips the house you started from.',
    'Every seed after that goes only into your opponent’s seven houses, starting again from their first house and going round as often as needed. Your own houses are skipped.',
    'If a long sowing of 14, 21, 28 or more seeds ends on your opponent’s first house, you take just that last seed and nothing else.',
  ] },
  { title: 'Capturing', role: 'capture', lines: [
    'Look at the house that receives your last seed. If it is on your opponent’s side, is not their first house, and now holds two, three or four seeds, you capture all of them.',
    'In other words, you capture a house that held one, two or three seeds before your last seed landed.',
    'Captured seeds go into your store and are out of play.',
  ] },
  { title: 'Chain captures', lines: [
    'After a capture, look at the house before it in the sowing order. If that house is also on your opponent’s side and now holds two, three or four seeds, capture it as well. Then look at the house before that, and so on. This can include their first house.',
    'The chain stops at the first house that holds fewer than two or more than four seeds, or when it reaches your own row.',
    'Only the counts after the whole sowing matter.',
  ] },
  { title: 'Grand slam', lines: [
    'You may not empty your opponent’s side by capturing. If a move would capture every seed they have, it is still played, but nothing is captured.',
  ] },
  { title: 'When nothing is captured', lines: [
    'If your last seed lands in your own row, nothing is captured.',
    'If it lands in your opponent’s first house, nothing is captured (except after a long sowing, as above).',
    'If the house it lands in ends with one seed, or with five or more, nothing is captured.',
  ] },
  { title: 'Feeding a hungry opponent', lines: [
    'If your opponent has no seeds on their side, you must play a move that puts at least seven seeds on their side.',
    'If no move can put seven, you must play the move that puts as many as possible. A leftmost house with fewer than three seeds can be used for this only when nothing else can reach them.',
    'If no move at all can reach their side, the game ends (see “How the game ends”).',
  ] },
  { title: 'A lone seed', lines: [
    'If your whole side has a single seed left and it is in your leftmost house, you have no move. You keep that seed, and the game ends.',
  ] },
  { title: 'Winning the game', lines: [
    'The first player to capture forty seeds wins at once: forty is more than half of the seventy seeds.',
  ] },
  { title: 'How the game ends', lines: [
    'The game also ends when fewer than ten seeds are left on the board, or when the player to move has no legal move because nothing can be fed to an empty side.',
    'Then each player adds the seeds on their own side to their store. A player with forty or more wins. If nobody reaches forty, the game is a draw.',
    'This game also ends the same way if the same position comes round three times, or if one hundred moves pass with no capture. That is a safety rule of this game, not a traditional one.',
  ] },
  { title: 'About this rule set', lines: [
    'Where the published descriptions differ, this game chooses as follows. Capture counts of two to four, the protected first house, the 14-seed long sowing that continues only on the opponent’s side, solidarity feeding of seven seeds, forty seeds to win, and a draw when nobody has forty follow the Club Awalé rules.',
    'The leftmost-house restriction follows the Ekang rule summary that allows two seeds to be sown when they capture. Capturing every seed of the opponent’s side is not forbidden in the Ekang summary; here, as in the club rules, such a move takes nothing.',
  ] },
];

// ---- one continuous reader: consecutive short pages with the same title are joined into one section (same text, same order) ----
export function docOf(items) {
  const out = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.title === it.title && !it.role) { last.lines[last.lines.length - 1] += ' ' + it.lines[0]; for (const l of it.lines.slice(1)) last.lines.push(l); }
    else out.push({ title: it.title, role: it.role, lines: it.lines.slice() });
  }
  return out;
}
export const RULES_DOC = docOf(RULES);
