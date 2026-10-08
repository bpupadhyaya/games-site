// Text for the About, How to Play and Rules screens. Every rule here is checked against grid.js / play.js / game.js
// (see design/GDD.md "Rules reference"). Blocks: { h } heading, { p } paragraph, { li: [...] } bullets.
// `fig` names a picture drawn by figures.js with the game's own grid drawing.

export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Crossword Grid Clues',
      fig: 'grid',
      body: [
        { p: 'Fill the white squares with letters so that every answer, across and down, fits its clue. Every white square belongs to at least one answer, and most belong to two, so each word you find helps with the words that cross it.' },
        { p: 'The crossword began in newspapers in Britain and America and is now one of the most loved word puzzles in the world. This version is made for calm, focused play: a clean printed grid, a proper keyboard, no ads and no pressure.' },
        { li: ['Five sizes, from a five-by-five Mini to a thirteen-by-thirteen Giant.', 'Every clue is written for this game. British and American spellings both appear, and the clue tells you which.', 'A new Daily Crossword every day, the same for everyone.', 'Pencil letters, undo and redo, checks, reveals and hints that teach.', 'Watch and Learn solves a whole puzzle step by step and explains how it thinks.'] },
      ],
    },
    {
      title: 'Credits and the free preview',
      body: [
        { p: 'You can play for a free preview first. Unlocking the full game is a single one-time purchase; there are no ads and no subscriptions.' },
        { p: 'Letters and titles are set in Cormorant Garamond, and the interface and clues in Barlow. Both fonts are used under the SIL Open Font License 1.1. All sounds are synthesized on your device.' },
        { p: 'Crossword Grid Clues is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Choose a puzzle',
      fig: 'grid',
      body: [
        { p: 'Tap New Game and pick a size: Mini, Quick, Classic, Grand or Giant. The Daily Crossword is a fresh puzzle every day. Continue picks up the puzzle you left.' },
        { p: 'New to crosswords? Start with a Mini. It teaches everything the bigger grids use.' },
        { p: 'On small screens the big grids zoom in to keep every square easy to tap. Drag the grid to look around, or tap the magnifier in its corner to see the whole grid.' },
      ],
    },
    {
      title: 'Read a clue, write an answer',
      fig: 'cross',
      body: [
        { p: 'The clue for the selected answer is shown under the grid, with its number, direction and length. Tap a square, then type on the keyboard. Each letter moves you on to the next square.' },
        { li: ['Tap the same square again to switch between its Across and Down answer.', 'The arrows beside the clue move to the previous or next clue.', 'Tap any clue in the clue list to jump straight to it.'] },
      ],
    },
    {
      title: 'Use the crossings',
      fig: 'crossings',
      body: [
        { p: 'Where an Across answer meets a Down answer, the square is shared. If you are sure of one word, its letters give you a start on every word that crosses it.' },
        { li: ['Begin with the clues you can answer at once.', 'Short words are a good way in: they cross the long ones.', 'If a crossing letter does not fit, one of the two words is wrong.'] },
      ],
    },
    {
      title: 'Pencil, Check and Reveal',
      fig: 'pencil',
      body: [
        { p: 'Turn on Pencil to write a letter you are not sure about. Pencil letters are grey and are never counted as a mistake. Writing over one in ink makes it final.' },
        { p: 'Check marks wrong letters red, for one square, the selected word or the whole puzzle. Reveal writes in the right letters for you.' },
      ],
    },
    {
      title: 'Hints that teach',
      fig: 'hint',
      body: [
        { p: 'Tap the bulb for a hint in three steps. First it shows where to look. Then it explains how to think about the clue. Then it can fill the word in for you.' },
        { p: 'If a letter on the grid is wrong, the hint points to it first.' },
      ],
    },
    {
      title: 'Watch and Learn',
      fig: 'hint',
      body: [
        { p: 'Watch and Learn solves a puzzle by itself, one answer at a time. It picks the answer a careful solver would try next, shows the clue and the letters it already has, explains its thinking, and then writes the word in.' },
        { p: 'Use Pause to stop and look at the grid. Use the minus and plus buttons to give it more or less time to think.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The grid',
      fig: 'grid',
      body: [
        { p: 'A crossword is a square grid of white squares and black blocks. This game has five sizes: 5, 7, 9, 11 and 13 squares on a side.' },
        { p: 'Every white square belongs to at least one answer. Answers run left to right (Across) or top to bottom (Down), and every answer is at least three letters long. Black blocks separate the answers.' },
        { p: 'Each grid is built so that the pattern of blocks looks the same when the grid is turned half way round.' },
      ],
    },
    {
      title: 'Numbers and clues',
      fig: 'numbers',
      body: [
        { p: 'A small number sits in the corner of every square where an answer starts. Numbers run left to right along each row, from the top row down. One square can start both an Across and a Down answer, and then they share the number.' },
        { p: 'The clue list has two groups: all the Across clues in number order, then all the Down clues. A clue never contains its own answer. The answer must fit the number of squares exactly.' },
        { p: 'Answers are ordinary English words: nouns, verbs, adjectives, places and names of things. Some clues are fill-in-the-blank, shown with ___ where the missing word goes.' },
      ],
    },
    {
      title: 'Crossings',
      fig: 'crossings',
      body: [
        { p: 'A square that belongs to both an Across and a Down answer is a crossing. It holds one letter that must work in both words.' },
        { p: 'Because of this, every puzzle can be solved by reasoning: a correct word always agrees with the words that cross it.' },
      ],
    },
    {
      title: 'Selecting and typing',
      fig: 'cross',
      body: [
        { p: 'Tap a white square to select it. The selected square turns gold and the rest of its answer turns light blue. Tap the selected square again to switch between Across and Down; a square that belongs to only one answer always uses that one.' },
        { li: ['Typing a letter writes it and moves to the next square of the answer. With "Skip filled squares" on, filled squares are jumped over.', 'When an answer is full, the selection moves on to the next clue that still has an empty square, if "Next clue when done" is on.', 'Delete removes the letter in the selected square. On an empty square it steps back and removes the previous letter.', 'The arrow keys on a keyboard move square by square; Tab moves to the next clue.'] },
      ],
    },
    {
      title: 'Pencil letters',
      fig: 'pencil',
      body: [
        { p: 'With Pencil on, letters are written in grey. A pencil letter is a guess: it is never counted as a mistake and it is never marked red by "Check as I type".' },
        { p: 'A pencil letter still counts when you finish. The puzzle is solved when every white square holds the right letter, written in pencil or in ink. Typing a letter in ink over a pencil letter replaces it.' },
      ],
    },
    {
      title: 'Mistakes and Check',
      fig: 'check',
      body: [
        { p: 'A letter written in ink that is not the answer letter counts as a mistake. Mistakes only matter for your record: they do not take stars away.' },
        { li: ['Check as I type (in Settings) shows wrong ink letters in red immediately.', 'Check Letter, Check Word and Check Puzzle mark the wrong ink and pencil letters in that part of the grid in red. The red mark goes away as soon as you change that square.', 'Checking never changes the grid and never costs stars.'] },
      ],
    },
    {
      title: 'Reveal',
      fig: 'reveal',
      body: [
        { p: 'Reveal Letter, Reveal Word and Reveal Puzzle write the right letters into the grid. A revealed square shows a small red corner and is locked, so it cannot be changed or erased.' },
        { p: 'Every revealed square counts against your stars. Revealing the whole puzzle finishes it straight away.' },
      ],
    },
    {
      title: 'Hints',
      fig: 'hint',
      body: [
        { p: 'The bulb asks for a hint. If a wrong letter is on the grid, the hint points to it first and offers to clear it.' },
        { li: ['Step 1, where to look: the answer a careful solver would try next is highlighted, with its clue and the letters you already have.', 'Step 2, why: the topic of the answer, its first letter and a tip about how the clue is written.', 'Step 3, apply: the word is written in and locked.'] },
        { p: 'Each hint asked for counts once against your stars.' },
      ],
    },
    {
      title: 'Winning and stars',
      fig: 'stars',
      body: [
        { p: 'You win when every white square holds its correct letter. The game shows your time, mistakes and help used.' },
        { li: ['Three stars: no hints and no reveals, finished within one and a half times the par time.', 'Two stars: a few helps (hints plus revealed squares, up to a fixed allowance for that grid size) or finished within two and a half times par.', 'One star: everything else.'] },
        { p: 'Par times are 2 minutes for Mini, 5 for Quick, 10 for Classic, 16 for Grand and 25 for Giant. The timer stops while the game is paused.' },
      ],
    },
    {
      title: 'Sizes',
      fig: 'sizes',
      body: [
        { li: ['Mini: 5 by 5. Short answers, a handful of clues.', 'Quick: 7 by 7. Everyday words, a few longer answers.', 'Classic: 9 by 9. Longer answers crossing in many places.', 'Grand: 11 by 11. An open grid with long answers.', 'Giant: 13 by 13. The largest grid.'] },
        { p: 'On a small screen the Grand and Giant grids zoom in and follow your cursor. Drag to look around, and tap the magnifier in the corner of the grid to switch between zoomed and whole grid.' },
        { p: 'Every puzzle is chosen from a built-in library and may be turned on its side, so across clues become down clues. The game remembers which puzzles you finished and offers a fresh one first.' },
      ],
    },
    {
      title: 'The Daily Crossword',
      fig: 'daily',
      body: [
        { p: 'There is one Daily Crossword for everyone each day. The size follows the day of the week: Monday Mini, Tuesday Quick, Wednesday and Thursday Classic, Friday and Saturday Grand, Sunday Giant.' },
        { p: 'Finishing the daily puzzle adds a day to your streak. Finish it on consecutive days to keep the streak going; missing a whole day starts it over.' },
      ],
    },
    {
      title: 'Watch and Learn',
      fig: 'hint',
      body: [
        { p: 'Watch and Learn plays a whole puzzle with its own method. It repeats three steps: think, reveal, write.' },
        { li: ['Think: it chooses the unfinished answer that looks easiest (most letters already in place, favouring fill-in-the-blank and short clues), shows the clue and the letters it has, and waits for the think time you chose (2, 5, 8 or 10 seconds).', 'Reveal: it explains the topic, the first letter and any tip about the clue, then shows the answer.', 'Write: it types the word into the grid.'] },
        { p: 'Pause stops everything where it is. Exit returns to the menu. Watching never uses the free preview.' },
      ],
    },
    {
      title: 'Saving and settings',
      fig: 'sizes',
      body: [
        { p: 'Your puzzle is saved as you play and offered again as Continue. Leaving the app, pausing or opening Settings keeps it.' },
        { li: ['Look changes the colours of the page and the paper.', 'Check as I type, Skip filled squares, Next clue when done, Highlight answer, Show timer, Sound and Calm motion are on or off in Settings.', 'The A- and A+ buttons make text on every reading screen up to three times larger.'] },
      ],
    },
  ],
};

export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
