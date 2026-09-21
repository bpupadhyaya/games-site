// The campaign: twelve hand-checked positions, alternating sides. Every position was proven by the solver (engine.js):
//   hounds levels: the hounds can trap the hare in exactly `par` moves;  hare levels: the hare can force its way past in exactly `par` moves.
// side: the human's side; board: 11 characters ('.', 'H', 'D') in point order; turn: who moves first; opp: the computer's level (0-3);
// limit: the hunt clock (hound moves). Stars: hounds  1 win, 2 within par + 2 moves, 3 within par;  hare  1 win, 2 by slipping past, 3 by slipping past within par.
export const CAMPAIGN = [
  { name: "First hunt", note: "The hare is nearly cornered. Trap it in two moves.", side: 'D', board: '....D..DHD.', turn: 'D', par: 2, opp: 0, limit: 6 },
  { name: "Through the gap", note: "The hounds are stretched. Slip past them.", side: 'H', board: '..D..HD.D..', turn: 'H', par: 2, opp: 0, limit: 5 },
  { name: "Closing in", note: "Three moves to trap the hare. Find the first.", side: 'D', board: '..D.....DDH', turn: 'D', par: 3, opp: 0, limit: 7 },
  { name: "Hare on the run", note: "Watch the gaps and slip through.", side: 'H', board: '..D.D...HD.', turn: 'H', par: 3, opp: 1, limit: 6 },
  { name: "Herding", note: "Keep the hare boxed in and close the net.", side: 'D', board: '...D.D.D.H.', turn: 'D', par: 4, opp: 1, limit: 8 },
  { name: "The narrow escape", note: "A narrow way out: find it before the clock runs down.", side: 'H', board: '..D....DD.H', turn: 'H', par: 4, opp: 1, limit: 7 },
  { name: "Patient hounds", note: "Take your time: six moves to trap it.", side: 'D', board: '..DD...H.D.', turn: 'D', par: 6, opp: 2, limit: 10 },
  { name: "Thin line", note: "The hounds are good. Find the one gap.", side: 'H', board: 'D...D...H.D', turn: 'H', par: 5, opp: 2, limit: 8 },
  { name: "The long net", note: "Eight moves. Do not open a door.", side: 'D', board: '.D..D..HD..', turn: 'D', par: 8, opp: 2, limit: 12 },
  { name: "Against the best", note: "The best hounds never slip. Only a perfect run gets through.", side: 'H', board: 'D...H....DD', turn: 'H', par: 6, opp: 3, limit: 9 },
  { name: "Last corner", note: "Ten moves. Every step counts.", side: 'D', board: 'D..D....HD.', turn: 'D', par: 10, opp: 3, limit: 14 },
  { name: "The full hunt", note: "The whole hunt, from the start. The hare plays perfectly.", side: 'D', board: 'DD.D......H', turn: 'D', par: 12, opp: 3, limit: 20 },
];
