// Lessons as data. Coins are { k: 'W'|'B'|'Q', x, y } in board units (740 x 740, y grows downward, you play from the bottom).
// Fields: solve (verified shots for the Hint button: at = the coin it pockets or hits, x = striker position), title, text (what to do, with the exact controls), coins, sx (striker start x), goal, done (text on completion).
// goal: touch | pocket | bounce | run (pocket two coins in a row, keeping the turn) | queen (pocket and cover) | foul | combo (one coin drives another into a pocket)
export const LESSONS = [
  { title: 'Place and aim', goal: 'touch', solve: [{at: [370, 380], x: 310, angle: -1.3608, power: 1}], sx: 370, coins: [{ k: 'W', x: 370, y: 380 }],
    text: 'DRAG the striker sideways along the baseline to place it. Then DRAG BACK from the striker and RELEASE to flick. Hit the white coin.',
    done: 'You place the striker on the baseline, pull back to aim and release. The dotted line always shows where it will go.' },
  { title: 'Power', goal: 'pocket', solve: [{at: [640, 120], x: 330, angle: -1.0468, power: 1}], sx: 370, coins: [{ k: 'W', x: 640, y: 120 }],
    text: 'Send the white coin into the top-right pocket. Slide the striker along the baseline until the dotted line runs through the coin toward the pocket. A longer DRAG BACK is a harder flick.',
    done: 'A short pull is a soft flick and a long pull is a hard one. Enough power to reach the pocket, not more than you need.' },
  { title: 'Pocketing', goal: 'pocket', solve: [{at: [150, 300], x: 330, angle: -2.0688, power: 0.7}], sx: 370, coins: [{ k: 'W', x: 150, y: 300 }],
    text: 'The coin travels along the line from where the striker touches it through its centre. Aim so that line points at the top-left pocket. The ring shows where the striker touches.',
    done: 'You aim at the spot behind the coin, so the coin leaves toward the pocket. This is the basis of every pocketing shot.' },
  { title: 'Off the cushion', goal: 'bounce', solve: [{at: [200, 260], x: 128, angle: -2.3048, power: 1}], sx: 370, coins: [{ k: 'W', x: 200, y: 260 }, { k: 'B', x: 300, y: 430 }, { k: 'B', x: 250, y: 470 }],
    text: 'Black coins guard the straight way to the white coin. Aim at a cushion so the striker bounces off it and comes back to hit the white coin. The dotted line bends where it bounces.',
    done: 'The striker rebounds off a cushion like a ball off a wall, so an angle can reach a coin the straight way cannot.' },
  { title: 'Keep the turn', goal: 'run', solve: [{at: [640, 180], x: 471, angle: -1.2288, power: 1}, {at: [100, 200], x: 128, angle: -2.0928, power: 1}], sx: 370, coins: [{ k: 'W', x: 640, y: 180 }, { k: 'W', x: 100, y: 200 }],
    text: 'Pocket both white coins, one stroke at a time. Each time you pocket your own colour you shoot again.',
    done: 'Pocketing your own colour keeps the turn. Miss, and it passes to your opponent.' },
  { title: 'The queen', goal: 'queen', solve: [{at: [640, 120], x: 330, angle: -1.0468, power: 1}, {at: [100, 180], x: 269, angle: -1.9088, power: 1}], sx: 370, coins: [{ k: 'Q', x: 640, y: 120 }, { k: 'W', x: 100, y: 180 }],
    text: 'Pocket the red queen. Then you must cover it: pocket one of your white coins with your very next stroke.',
    done: 'The queen is covered when you pocket one of your own coins right after it. Otherwise it goes back to the centre.' },
  { title: 'Fouls', goal: 'foul', solve: [{at: [640, 120], x: 592, angle: -1.3948, power: 1}], sx: 370, coins: [{ k: 'W', x: 640, y: 120 }],
    text: 'A foul happens when the striker itself goes into a pocket. Try it: hit the white coin hard, toward the top-right pocket, and let the striker follow it in.',
    done: 'The striker fell into a pocket: that is a foul. One of your pocketed coins would go back to the centre, and the turn passes.' },
  { title: 'Combinations', goal: 'combo', solve: [{at: [629, 162], x: 390, angle: -1.1088, power: 1}], sx: 370, coins: [{ k: 'W', x: 629, y: 162 }, { k: 'W', x: 650, y: 130 }],
    text: 'Two white coins sit in a line toward the top-right pocket. Hit the nearer one so that it knocks the other one into the pocket. The dotted line shows where the first coin goes.',
    done: 'A coin can send another coin on its way. Lining coins up toward a pocket lets one stroke pocket more than one.' },
];

// Did the stroke just played meet the lesson's goal? c = { g, sum, ev, count } (game after the rules, stroke summary,
// physics events, coins pocketed so far in a "run"). Returns { ok, partial, why, count }.
export function judge(goal, c) {
  const { g, sum, ev } = c; let count = c.count ?? 0, ok = false, partial = false, why = 'Not this time. The board is set up again: try once more.';
  if (goal === 'touch') { ok = ev.some((e) => e.t === 'hit' && (e.a === 99 || e.b === 99)); why = 'The striker missed the coin. Aim the dotted line at it and try again.'; }
  else if (goal === 'pocket') { ok = sum.own >= 1; why = sum.foul ? 'The striker fell in too. Use a little less power and try again.' : 'The coin did not go in. Line the dotted path up with the pocket and try again.'; }
  else if (goal === 'bounce') { const h = ev.findIndex((e) => e.t === 'hit' && (e.a === 99 || e.b === 99)), w = ev.findIndex((e) => e.t === 'wall' && e.id === 99); ok = h >= 0 && w >= 0 && w < h; why = h >= 0 && (w < 0 || w > h) ? 'That went straight. Aim at a cushion first, so the striker bounces before it reaches the white coin.' : 'Missed. Aim at a cushion; the dotted line shows the bounce.'; }
  else if (goal === 'run') { count += sum.own; ok = count >= 2; partial = !ok && sum.own >= 1; why = 'Missed. Both coins must go in, one stroke at a time. Setting up again.'; }
  else if (goal === 'queen') { ok = g.queen.state === 'W'; partial = !ok && g.queen.state === 'pending'; why = 'The queen must be pocketed, then covered with a white coin on the next stroke. Setting up again.'; }
  else if (goal === 'foul') { ok = sum.foul; why = 'No foul yet. Hit the coin hard toward the top-right pocket so the striker follows it in.'; }
  else if (goal === 'combo') { const first = ev.findIndex((e) => e.t === 'pocket'); ok = sum.own >= 1 && ev.slice(0, first < 0 ? 0 : first).some((e) => e.t === 'hit' && e.a !== 99 && e.b !== 99); why = 'Hit the nearer white coin so that it knocks the far one into the top-right pocket.'; }
  return { ok, partial, why, count };
}
