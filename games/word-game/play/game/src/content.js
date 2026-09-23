// Exhaustive Rules reference. Every claim here is cross-checked against `game.js` (the single
// source of truth for the mechanic) so this page can never contradict the shipped build.
// `demo` tags a small illustration renderer draws for that page, reusing the game's own
// slip()/plaque() drawing (never a separate simplified icon) — see render.js's 'rules' scene.
export const RULES = [
  {
    title: 'Objective',
    demo: 'objective',
    lines: [
      'A target word appears at the top of the screen.',
      'Three candidate words drift in from the right, one in each of three lanes.',
      'Tap the one that means the same as the target (Synonym mode) or the opposite of it',
      '(Antonym mode) before it drifts past you.',
    ],
  },
  {
    title: 'Choosing a mode',
    demo: 'mode',
    lines: [
      'Before you start, pick Synonym (find the word with the same meaning) or Antonym (find',
      'the word with the opposite meaning) on the title screen.',
      'The mode you pick is locked for the whole 90-second session. To switch modes, finish or',
      'stop the session and choose again on the title screen.',
      'A few words in the bank have no listed antonym - those only ever appear in Synonym mode.',
    ],
  },
  {
    title: 'The candidate words',
    demo: 'slips',
    lines: [
      'All three word slips look exactly the same - same paper, same size, same colour - so',
      'nothing but the printed word gives the answer away.',
      'Each slip drifts right to left along its own lane, bobbing gently up and down within it.',
      'Exactly one of the three is correct; the other two are unrelated distractor words.',
      'Drift speed starts steady and increases as your score rises during the session, up to a',
      'fixed maximum speed - later rounds move noticeably faster than early ones.',
    ],
  },
  {
    title: 'Answering',
    demo: 'answer',
    lines: [
      'TAP a word slip to answer with it.',
      'Correct: your score goes up by one, and a new target word appears immediately.',
      'Wrong: no point is scored, and a new target word appears immediately - the same outcome',
      'as letting the correct word drift past unanswered.',
      'Letting the correct word drift completely off the left edge without tapping it also',
      'counts as a miss, with no point scored.',
      'On a keyboard, the number keys 1, 2 and 3 answer with whichever word currently sits in',
      'the top, middle and bottom lane.',
    ],
  },
  {
    title: 'The session clock',
    demo: 'clock',
    lines: [
      'Each session runs for a fixed 90 seconds, shown as a countdown clock and a draining bar.',
      'Tap Stop at any time to end the session early - this has exactly the same effect as the',
      'clock reaching zero, and keeps whatever score you already have.',
      'Nothing in the game adds to or shortens a session\'s 90 seconds once it has started.',
    ],
  },
  {
    title: 'When a session ends',
    lines: [
      'The moment the clock reaches 0, or you tap Stop, the session ends at once and the Session',
      'Review screen appears.',
      'If your score for that session beats your saved best for that mode, it is saved as your',
      'new best straight away.',
      'Best scores for Synonym mode and Antonym mode are tracked and saved separately.',
    ],
  },
  {
    title: 'Session review',
    demo: 'review',
    lines: [
      'Every word from the session is listed, mistakes first, then correct answers, several rows',
      'to a page.',
      'Each row shows the target word, its meaning, and the correct answer - and for a mistake,',
      'either the word you tapped instead or "drifted past" if you missed it without answering.',
      'From here, Play Again starts a fresh session in the same mode, or Change Mode returns to',
      'the title screen to pick again.',
    ],
  },
  {
    title: 'Playing for free',
    lines: [
      'Playing in a web browser is a free preview: it is limited to a small number of full',
      'sessions, after which a screen invites you to get the full game for unlimited play.',
      'This limit applies only to the free web preview - it does not affect the full app.',
    ],
  },
];
