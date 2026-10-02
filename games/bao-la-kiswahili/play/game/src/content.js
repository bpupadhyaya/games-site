// Text for the three reference pages (About, How to Play, Rules). Every rule claim below is cross-checked against
// rules.js (the engine the board runs on); where this edition simplifies or chooses between published variants it says so.
// view.js paginates each section to the current text size, so nothing can overflow at 300%.
// `fig` names a board picture drawn with the game's own board and seed art (see FIGS).

const rows = (front, backByColumn) => { const a = new Array(16).fill(0); for (let i = 0; i < 8; i++) { a[i] = front[i] || 0; a[15 - i] = backByColumn[i] || 0; } return a; };
const START = () => rows([0, 0, 0, 0, 6, 2, 2, 0], [0, 0, 0, 0, 0, 0, 0, 0]);

// Board pictures. pits[p] is a ring (index 0-7 front left to right, 8-15 back right to left). tags label pits.
export const FIGS = {
  setup: { crop: [330, 1180], k: 0.52, pits: [START(), START()], stock: [22, 22], hl: [{ p: 0, r: 4, c: 'gold' }, { p: 1, r: 4, c: 'gold' }], tags: [{ p: 0, r: 4, t: 'nyumba' }], caption: 'The start. Each side: 6 seeds in the nyumba, 2 in each of the next two pits, 22 in store.' },
  names: { crop: [730, 910], k: 0.82, noCounts: true, pits: [rows([3, 3, 3, 3, 6, 3, 3, 3], [3, 3, 3, 3, 3, 3, 3, 3]), rows([3, 3, 3, 3, 6, 3, 3, 3], [3, 3, 3, 3, 3, 3, 3, 3])], stock: [0, 0], hl: [{ p: 0, r: 0, c: 'green' }, { p: 0, r: 7, c: 'green' }, { p: 0, r: 1, c: 'amber' }, { p: 0, r: 6, c: 'amber' }, { p: 0, r: 4, c: 'gold' }], tags: [{ p: 0, r: 0, t: 'kichwa' }, { p: 0, r: 7, t: 'kichwa' }, { p: 0, r: 1, t: 'kimbi', below: true }, { p: 0, r: 6, t: 'kimbi', below: true }, { p: 0, r: 4, t: 'nyumba' }], caption: 'Your front row: the two kichwa (ends), the kimbi (the end pits and the pits beside them), the nyumba (square).' },
  rows: { crop: [500, 1040], k: 0.7, pits: [rows([2, 2, 2, 2, 2, 2, 2, 2], [1, 1, 1, 1, 1, 1, 1, 1]), rows([2, 2, 2, 2, 2, 2, 2, 2], [1, 1, 1, 1, 1, 1, 1, 1])], stock: [0, 0], hl: [0, 1, 2, 3, 4, 5, 6, 7].map((r) => ({ p: 0, r, c: 'gold' })), tags: [], caption: 'Your two rows. The front (inner) row is the one nearer the middle.' },
  loop: { crop: [780, 1040], k: 0.82, pits: [rows([0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]), rows([0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0])], stock: [0, 0], hl: [], loop: 0, caption: 'Clockwise for you: along the front row to your right, then back along the back row to your left.' },
  facing: { crop: [610, 905], k: 0.82, pits: [rows([0, 0, 0, 4, 6, 2, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]), rows([0, 3, 0, 0, 0, 3, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0])], stock: [14, 14], hl: [{ p: 0, r: 5, c: 'green' }, { p: 1, r: 2, c: 'red' }, { p: 0, r: 4, c: 'gold' }], tags: [{ p: 0, r: 5, t: 'marker' }], caption: 'Your pit 6 holds seeds and faces an occupied enemy pit: a marker. Your seed goes in and captures.' },
  kichwa: { crop: [610, 905], k: 0.82, pits: [rows([0, 0, 2, 1, 6, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]), rows([0, 0, 0, 0, 0, 3, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0])], stock: [12, 13], hl: [{ p: 0, r: 0, c: 'green' }, { p: 0, r: 7, c: 'green' }, { p: 0, r: 2, c: 'amber' }], tags: [{ p: 0, r: 0, t: 'left kichwa' }, { p: 0, r: 7, t: 'right kichwa' }], caption: 'A capture in the middle pits lets you choose the kichwa the captured seeds start from.' },
  takata: { crop: [730, 910], k: 0.82, pits: [rows([0, 0, 0, 0, 6, 2, 3, 0], [0, 0, 0, 0, 0, 0, 0, 0]), rows([0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0])], stock: [18, 20], hl: [{ p: 0, r: 5, c: 'green' }, { p: 0, r: 6, c: 'green' }], tags: [{ p: 0, r: 4, t: 'house stays shut' }], caption: 'No marker anywhere: a takata. Add a seed to a pit and sow it. The nyumba is not allowed.' },
  mtaji: { crop: [610, 1040], k: 0.82, pits: [rows([0, 2, 0, 0, 0, 5, 0, 0], [0, 0, 0, 0, 0, 0, 3, 0]), rows([0, 0, 0, 0, 4, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0])], stock: [0, 0], hl: [{ p: 0, r: 5, c: 'green' }], tags: [], caption: 'Mtaji: no store left. Pick a pit with 2 or more seeds and sow it either way.' },
  house: { crop: [730, 910], k: 0.82, pits: [rows([0, 0, 0, 0, 6, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0]), rows([0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0])], stock: [0, 0], hl: [{ p: 0, r: 4, c: 'gold' }], tags: [{ p: 0, r: 4, t: 'nyumba' }], caption: 'The nyumba is a protected house until its seeds are sown, or it is captured.' },
};

export const RULES = [
  { title: 'In short', text: [
    'Bao la Kiswahili is a two-player sowing game on a board of four rows of eight pits. Each player owns two rows and starts with 32 seeds.',
    'In the first stage, namua, you bring your 22 store seeds into play one turn at a time. In the second stage, mtaji, you move the seeds already on the board.',
    'You win by leaving your opponent with an empty front row, or with no pit that can be sown.',
  ] },
  { title: 'The board', fig: 'rows', text: [
    'There are four rows of eight pits. You own the two rows nearest you, your opponent owns the other two.',
    'Your front (inner) row is the one nearer the middle. Your back (outer) row is nearest you. Each front pit faces the pit straight across.',
    'Seeds are sown only around your own sixteen pits, never into your opponent’s. Captured seeds come from your opponent’s front row.',
  ] },
  { title: 'Names of the pits', fig: 'names', text: [
    'Nyumba (the house): the square pit, the fifth pit from the left in your front row.',
    'Kichwa (the head): the two end pits of your front row, left and right.',
    'Kimbi: the kichwa and the pit beside each, the first, second, seventh and eighth pits of your front row.',
    'Captures in a kimbi pit decide where the captured seeds start sowing (see Capturing).',
  ] },
  { title: 'The start', fig: 'setup', text: [
    'Each side starts with 6 seeds in the nyumba and 2 seeds in each of the two pits to its right, as you look at your own side. Every other pit is empty.',
    'The remaining 22 seeds of each side are held in your store (the tray at your end of the board).',
    'You, at the bottom, move first.',
  ] },
  { title: 'The loop', fig: 'loop', text: [
    'Your sixteen pits form one loop: along the front row, down to the back row, and back along it.',
    'Sowing drops one seed in each pit in turn. You choose clockwise or anticlockwise when you start a sowing that is yours to aim.',
    'Clockwise for you runs along the front row to your right, then along the back row to your left. Anticlockwise is the reverse.',
  ] },
  { title: 'Namua and mtaji', text: [
    'While you still have seeds in your store you are in namua. Each turn you bring one store seed into play.',
    'When your store is empty you are in mtaji, and each turn you lift and sow a pit on the board.',
    'Each side changes stage when its own store runs out. Both sides start with 22 store seeds and each turn in namua uses one, so the stages end together, apart from one turn.',
  ] },
  { title: 'Namua: markers and capture', fig: 'facing', text: [
    'A marker is a pit in your front row that holds seeds and faces an occupied pit in your opponent’s front row.',
    'In namua you must capture if you can. Put your store seed in one of your markers: the seeds in the pit facing it are captured.',
    'If you have several markers you choose which one to play. A pit that is empty, or faces an empty pit, is not a marker.',
  ] },
  { title: 'Sowing captured seeds', fig: 'kichwa', text: [
    'Captured seeds are sown into your own pits one at a time, starting in a kichwa. The first seed goes into the kichwa itself.',
    'From the left kichwa you sow clockwise (along the front row to the right). From the right kichwa you sow anticlockwise (along the front row to the left).',
    'If your marker was a kimbi, that is your first, second, seventh or eighth front pit, the seeds must start from the kichwa on that same side.',
    'If your marker was one of the middle four pits, you choose which kichwa. The game asks you after the capture.',
  ] },
  { title: 'Relay sowing', text: [
    'When the last seed of a sowing lands in an empty pit, your turn ends.',
    'When it lands in a pit that already held seeds, one of two things happens.',
    'If that pit is a marker, you capture again. The captured seeds start from a kichwa as before: a kimbi capture starts from the nearest kichwa, and any other capture starts from the kichwa that keeps the sowing going the same way (the left kichwa for clockwise, the right for anticlockwise).',
    'If it is not a marker, you pick up all the seeds in that pit, including the one just dropped, and keep sowing the same way round.',
    'This relay continues until a sowing ends in an empty pit. One turn can therefore capture several times and sow a long way.',
  ] },
  { title: 'Namua: takata', fig: 'takata', text: [
    'If you have no marker, you cannot capture. You play a takata: put a store seed in any occupied pit of your front row, pick up all the seeds in it and sow them, clockwise or anticlockwise as you choose.',
    'In a takata, captures never happen. If a sowing ends in an occupied pit you simply pick the seeds up and carry on until a sowing ends in an empty pit.',
    'You may not start a takata in your nyumba while it is still a house, unless it is the only occupied pit in your front row.',
  ] },
  { title: 'The nyumba', fig: 'house', text: [
    'Your nyumba is a house: a safe store of seeds. It stops being a house the first time its seeds are sown (taxing, below, does not count) and when it is captured. Afterwards it is an ordinary pit.',
    'Taxing: if the nyumba is the only occupied pit of your front row in namua, you may play a takata there. Your seed goes in and you sow only two seeds from it. The rest stay.',
    'A takata that ends in your own house stops there: the house seeds are not picked up.',
    'Your opponent can capture your nyumba like any pit when it faces one of their markers. It is then empty and no longer a house.',
  ] },
  { title: 'Mtaji: starting a move', fig: 'mtaji', text: [
    'In mtaji you pick any of your pits with at least 2 seeds, lift all its seeds, and sow them clockwise or anticlockwise. A pit with a single seed cannot be played.',
    'If the last seed of that first sowing lands in an occupied front pit that faces an occupied enemy pit, the move is a capturing move. It then continues exactly like namua: capture, sow from a kichwa, relay.',
    'A pit of 16 or more seeds laps the whole loop. Such a move never captures, even if its last seed lands in a marker.',
    'You must make a capturing move if you have one. You may start it from the front or the back row.',
  ] },
  { title: 'Mtaji: takata', text: [
    'If no capturing move exists, you play a takata: sow any pit of your front row that holds 2 or more seeds, either way. No captures happen during it, but relay sowing carries on until a sowing ends in an empty pit.',
    'You may use a back-row pit only if no front-row pit other than the nyumba has 2 or more seeds.',
    'You may use your nyumba while it is a house only if nothing else can be played.',
  ] },
  { title: 'Safari', text: [
    'In a capturing move, if a sowing ends in your own nyumba (still a house) and it is not a marker, you may stop there or carry on by lifting the house and sowing it. Carrying on is called safari.',
    'The game asks you which you want. After a safari the nyumba is no longer a house.',
    'In a takata there is no safari: a sowing that ends in your house just stops.',
  ] },
  { title: 'Kutakatia', text: [
    'After a takata in mtaji that leaves its player with exactly one marker (a front pit facing an occupied enemy pit), the enemy pit facing that marker is protected for one turn: its owner may not empty it.',
    'That means it may not be the pit you start sowing, and a relay that arrives there stops instead of picking it up.',
    'The protection is lifted if the pit is the owner’s nyumba (while a house), their only occupied front pit, or their only front pit with 2 or more seeds.',
    'If protecting the pit would leave no move at all, the protection is lifted.',
    'Kutakatia only applies when both sides are in mtaji.',
  ] },
  { title: 'Winning', text: [
    'You win when your opponent’s front row is empty after a move, in either stage.',
    'You also win when your opponent cannot move: in mtaji, every pit they own holds 0 or 1 seeds.',
    'If your own move leaves your own front row empty, you lose.',
  ] },
  { title: 'No winner', text: [
    'This edition ends a game after 400 moves in total. The side with more seeds (store and board together) wins; equal counts is a draw.',
    'Real games finish far sooner. The limit only stops an endless chase.',
  ] },
  { title: 'About these rules', text: [
    'This is the Bao la Kiswahili of the Swahili coast, played with a namua stage and a mtaji stage.',
    'Published descriptions differ on a few small points between regions and clubs. Where they differ, this edition follows the common tournament reading described on these pages, so you can check every move against what is written here.',
    'Not included: the beginner form without the namua stage, and regional local variations.',
  ] },
];

export const HOWTO = [
  { title: 'Your turn', text: [
    'You sit at the bottom. The two rows nearest you are yours.',
    'On your turn, the pits you may play glow. Tap one.',
    'The message box under the board always tells you what the rules are asking of you right now.',
  ] },
  { title: 'Namua, the opening', text: [
    'You begin with 22 seeds in your store. Each turn you add one to a pit in your front row.',
    'If a glowing pit faces an enemy pit with seeds, you must capture: tap that pit. The captured seeds are yours to sow.',
    'The game then asks which end of your front row, left or right, to start sowing from. Tap the glowing end you want.',
    'If nothing can capture, pick a glowing pit, then choose clockwise or anticlockwise.',
  ] },
  { title: 'Mtaji, the second stage', text: [
    'Once your store is empty, tap a pit with 2 or more seeds, then pick the direction.',
    'Both directions show where your sowing would end, so you can see if it captures before you commit.',
    'You must capture whenever you can. When you cannot, you play a quiet move that protects your seeds.',
  ] },
  { title: 'Help while you play', text: [
    'Think: asks the computer to look at the board and shows a good move, with the reason.',
    'Undo: takes back your last move and the computer’s reply. Menu: saves your game and returns to the title.',
    'Watch & Learn: two computer players play a whole game. Each move you get time to think, then the options are shown, then the move is played. Pause freezes everything.',
    'Learn to play: short hands-on lessons for the capture, the kichwa, mtaji and the nyumba.',
  ] },
  { title: 'The two-player mode', text: [
    'Two players can share a phone. The bottom player begins and the top player plays the upper rows.',
    'Each player taps pits on their own side. Use Think to coach a friend.',
  ] },
  { title: 'Settings', text: [
    'Computer level: Learner, Mchezaji, Fundi, Bingwa.',
    'Text size goes up to 300%. Reduced motion shortens animation. You can change the seeds and the wood of the board.',
    'The Rules page explains every rule in full, with pictures.',
  ] },
];

export const ABOUT = [
  { title: 'The game', text: [
    'Bao la Kiswahili is the great strategy board game of the Swahili coast: Zanzibar, Tanzania, Kenya and neighbouring shores.',
    '“Bao” is the Swahili word for a board, and also the name of the game. Bao la Kiswahili means the Bao of the Swahili people.',
    'It belongs to the mancala family of sowing games, and it is the deepest of them.',
  ] },
  { title: 'A game of the community', text: [
    'Bao is played in streets, courtyards and shaded corners, often on boards carved from a single piece of wood, and sometimes just on pits scooped in the ground.',
    'Strong players are respected, and fast play and quick counting are admired. Onlookers often gather round the board to follow the play.',
  ] },
  { title: 'What makes it special', text: [
    'Most sowing games keep every seed in play from the first move. In Bao you bring seeds into play from your store, one at a time, in the namua stage.',
    'The nyumba, the house, is a protected store of seeds, and deciding when to open it is one of the great questions of the game.',
    'Captured seeds are sown from a kichwa, an end of your front row, and one turn can chain through many captures.',
  ] },
  { title: 'This edition', text: [
    'This edition follows the Bao la Kiswahili rules as used for play on the coast, with a namua stage and a mtaji stage. The Rules page lists every detail, and says where this edition chooses between published readings.',
    'The board, the cloth beneath it and the seeds are all original art. The board patterns are inspired by the chain carving seen on Swahili coast doors and the printed cloth of the region.',
    'Play the computer at four levels, share the phone with a friend, or watch two computer players and learn.',
  ] },
];
