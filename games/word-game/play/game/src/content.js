// Exhaustive Rules reference. Every claim here is cross-checked against `game.js` (the single
// source of truth for the mechanic) so this page can never contradict the shipped build.
// `demo` tags a small illustration renderer draws for that page, reusing the game's own
// slip()/plaque() drawing (never a separate simplified icon) — see render.js's 'rules' scene.
//
// 2026-09-22 (300% text-size pass): every page below is sized to one short sentence (sometimes a
// clause) so it still fits comfortably at the new top text-size step (TEXT_SCALES top = 3.0, see
// web/src/layout.js). The illustration on a page never scales with text size (only body/title
// font does), so a page with a demo has meaningfully less usable panel height than one without -
// pages were sized against whichever budget applies to them. Page count grew a lot from the
// original 9 (now much higher) as a direct, unavoidable consequence of the top font size roughly
// tripling from the original 1.3x ceiling - not padding or a redesign of the content itself.
export const RULES = [
  {
    title: 'Objective',
    demo: 'objective',
    lines: ['A target word appears at the top of the screen.'],
  },
  {
    title: 'The candidate lanes',
    demo: 'objective',
    lines: ['Three candidate words drift in from the right, one in each of three lanes.'],
  },
  {
    title: 'Matching the target',
    demo: 'objective',
    lines: ['Tap the one that means the same as the target (Synonym mode).'],
  },
  {
    title: 'Or the opposite',
    demo: 'objective',
    lines: ['Or the opposite of it (Antonym mode), before it drifts past you.'],
  },
  {
    title: 'Choosing a mode',
    demo: 'mode',
    lines: ['Before you start, pick Synonym - find the word with the same meaning.'],
  },
  {
    title: 'Or pick Antonym',
    lines: ['Or Antonym - find the word with the opposite meaning - on the title screen.'],
  },
  {
    title: 'Locking your mode',
    lines: ['The mode you pick is locked for the whole 90-second session.'],
  },
  {
    title: 'Switching modes',
    lines: ['To switch modes, finish or stop the session, and choose again on the title screen.'],
  },
  {
    title: 'Words without antonyms',
    lines: [
      'A few words in the bank have no listed antonym - those only ever appear in Synonym mode.',
    ],
  },
  {
    title: 'The candidate words',
    demo: 'slips',
    lines: ['All three word slips look exactly the same - same paper, same size, same colour.'],
  },
  {
    title: 'No visual clues',
    lines: ['So nothing but the printed word gives the answer away.'],
  },
  {
    title: 'How the slips move',
    lines: ['Each slip drifts right to left along its own lane, bobbing gently up and down.'],
  },
  {
    title: 'Only one is right',
    lines: ['Exactly one of the three is correct; the other two are unrelated distractor words.'],
  },
  {
    title: 'Drift speed',
    lines: ['Drift speed starts steady and increases as your score rises during the session.'],
  },
  {
    title: 'Getting faster',
    lines: [
      'Up to a fixed maximum speed - later rounds move noticeably faster than early ones.',
    ],
  },
  {
    // Split from a single longer "Answering" page (2026-09-22 text-size pass) so every page
    // still fits comfortably at the top text-size step - see web/src/layout.js TEXT_SCALES.
    title: 'Answering',
    demo: 'answer',
    lines: ['TAP a word slip to answer with it.'],
  },
  {
    title: 'A correct answer',
    demo: 'answer',
    lines: ['Correct: your score goes up by one, and a new target word appears immediately.'],
  },
  {
    title: 'A wrong answer',
    demo: 'answer',
    lines: ['Wrong: no point is scored, and a new target word appears immediately.'],
  },
  {
    title: 'Same as a miss',
    lines: ['That is the same outcome as letting the correct word drift past unanswered.'],
  },
  {
    title: 'Misses',
    demo: 'answer',
    lines: ['Letting the correct word drift off the left edge also counts as a miss.'],
  },
  {
    title: 'No point either way',
    lines: ['No point is scored for a miss, same as for tapping the wrong word.'],
  },
  {
    title: 'Keyboard shortcuts',
    lines: ['On a keyboard, the number keys 1, 2 and 3 answer with a lane for you.'],
  },
  {
    title: 'Which key is which',
    lines: ['They match whichever word currently sits in the top, middle and bottom lane.'],
  },
  {
    title: 'The session clock',
    demo: 'clock',
    lines: ['Each session runs for a fixed 90 seconds, shown as a countdown and a draining bar.'],
  },
  {
    title: 'Stopping early',
    lines: ['Tap Stop at any time to end the session early.'],
  },
  {
    title: 'Same as running out',
    lines: ['This has exactly the same effect as the clock reaching zero.'],
  },
  {
    title: 'Your score is kept',
    lines: ['It also keeps whatever score you already have.'],
  },
  {
    title: 'The clock never changes',
    lines: ['Nothing in the game adds to or shortens a session\'s 90 seconds once it has started.'],
  },
  {
    title: 'When a session ends',
    lines: [
      'The clock reaching 0, or tapping Stop, ends the session and shows the Session Review ' +
        'screen.',
    ],
  },
  {
    title: 'New best scores',
    lines: ['If your score beats your saved best for that mode, it is saved right away.'],
  },
  {
    title: 'Tracked separately',
    lines: ['Best scores for Synonym mode and Antonym mode are tracked and saved separately.'],
  },
  {
    title: 'Session review',
    demo: 'review',
    lines: ['Every word from the session is listed - mistakes first, then correct answers.'],
  },
  {
    title: 'Several rows per page',
    lines: ['Several rows are shown per page.'],
  },
  {
    title: 'Reading a review row',
    demo: 'review',
    lines: ['Each row shows the target word, its meaning, and the correct answer.'],
  },
  {
    title: 'For a mistake',
    lines: ['For a mistake, it also shows the word you tapped instead.'],
  },
  {
    title: 'Or a miss',
    lines: ['Or "drifted past" if you missed it without answering.'],
  },
  {
    title: 'After the review',
    lines: ['From here, Play Again starts a fresh session in the same mode.'],
  },
  {
    title: 'Changing mode',
    lines: ['Or Change Mode returns to the title screen to pick again.'],
  },
  {
    title: 'Playing for free',
    lines: [
      'Playing in a web browser is a free preview - it is limited to a small number of full ' +
        'sessions.',
    ],
  },
  {
    title: 'Getting the full game',
    lines: ['After that, a screen invites you to get the full game for unlimited play.'],
  },
  {
    title: 'Only the web preview',
    lines: [
      'This limit only applies to the free web preview - it does not affect the full app.',
    ],
  },
  {
    title: 'Watch & Learn',
    lines: ['Tap "Watch & Learn" for a free demo: a full session plays itself, no time limit.'],
  },
  {
    title: "Auto Play's rhythm",
    lines: ['Before every answer it pauses so you can guess, then highlights the correct word.'],
  },
  {
    title: 'Setting the pause length',
    lines: ['Use − / + on the Auto Play screen to set the pause, from 2 to 10 seconds.'],
  },
  {
    title: 'Auto Play never counts',
    lines: ['It never affects your best score, session count, or free-preview time.'],
  },
];
