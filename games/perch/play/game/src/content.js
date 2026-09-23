// Text for the in-app Rules reference page. Every claim here is cross-checked against the actual
// implementation (rules.js is the single source of truth for the simulation, tuning.js for every
// number) so this page can never contradict the shipped game. Where design/GDD.md's plain-English
// summary and the real tuning constants disagree (a few of the difficulty floors do), this page
// describes the real, shipped numbers.
//
// `art` tells rulesView.js which of the game's own drawing functions to reuse for that page's
// illustration - never a separate simplified icon. See rulesView.js for what each `art.kind` does.
//
// Every page here is deliberately short: at most one paragraph when it carries an illustration
// (the art leaves little room below it), or two-three when it does not. That is not an editorial
// choice but a hard constraint - at the Rules page's biggest text-size step, a page that ran longer
// than this would spill past the reader card. Where an original topic needed more room than that,
// it is split across two or three consecutive pages rather than shrunk to fit.
export const RULES = [
  {
    title: 'Read the stone. Choose your moment.',
    art: { kind: 'hero' },
    lines: [
      'You are a small bird on a perch. Hunters ring the field with catapults (and later, bows), and ' +
        'every so often one of them lets fly at wherever you are sitting.',
    ],
  },
  {
    title: 'Your only job: nerve and timing',
    lines: [
      'You never aim anything. The only thing you control is WHEN to flit to another perch - your ' +
        'nerve and your timing are the whole game.',
      'Survive until the sun sets and you clear the level. Lose all three feathers first and the run ' +
        'ends there.',
      'Cartoon rules: a hit only ruffles your feathers in a puff. Nothing is ever shown hurt.',
    ],
  },
  {
    title: 'The field and your perches',
    art: { kind: 'field' },
    lines: [
      'Level 1, Lone Oak, is one tree with 5 perches. Level 2, The Grove, is 5 small trees with 3 ' +
        'perches each. Level 3, The Orchard, and every level after it, is a 9-tree orchard, 3 perches ' +
        'each - 27 perches across the whole field.',
    ],
  },
  {
    title: 'How a level unfolds',
    lines: [
      'A level lasts until sunset: 60 seconds on most levels, 70 on the two Master Hunter levels. The ' +
        'golden bar under your score fills as the day runs out.',
      'Every 20 seconds you survive, the level gets one notch harder: hunters pull back faster, stones ' +
        'and arrows fly faster, hunters fire in tighter bursts, and more of them join the field (up to ' +
        'that level\'s own limit, and 14 across the whole game).',
      '8 levels are hand-built; every level after that is a harder version of the orchard, forever, ' +
        'with the Master Hunter returning roughly every fourth one of them.',
    ],
  },
  {
    title: 'Controls: when and where to flit',
    lines: [
      'Tap anywhere (or press Space, Enter, or click) to flit right now.',
      'On level 1, the game always sends you to the safest perch itself - your only decision is when ' +
        'to go.',
      'From level 2 on, tapping a specific perch sends you there instead (as long as it is close ' +
        'enough to reach - a little more forgiving than the automatic choice). Tapping the perch you ' +
        'are already on does nothing. A keyboard press always uses the automatic safest-perch choice, ' +
        'even on level 2+.',
    ],
  },
  {
    title: 'Flit timing',
    lines: [
      'A flit takes a little over a quarter of a second, longer for a farther hop, and is followed by ' +
        '0.55 s of rest before you can flit again. A tap that arrives in the last 0.15 s of that rest ' +
        'is remembered and used the instant you can move; any later than that, it is just ignored.',
    ],
  },
  {
    title: 'Feathers: your three lives',
    lines: [
      'You start each run with 3 feathers. A stone, arrow, or net that lands within reach of where you ' +
        'actually are costs one feather - the bigger and nearer the perch, the more forgiving that ' +
        'reach is.',
      'A hit stuns you for half a second (no flitting) and then leaves you briefly untouchable for ' +
        '1.2 seconds while you recover.',
    ],
  },
  {
    title: 'Losing a run, and healing',
    lines: [
      'Lose all 3 feathers before the timer runs out and the run ends immediately - "Ruffled!" - with ' +
        'no stars and no level unlocked. There is no partial credit and no draw: you either reach ' +
        'sunset or you do not.',
      'Collecting golden seeds is the only way to win a feather back mid-run (see the seeds page).',
    ],
  },
  {
    title: 'Reading the HUD',
    art: { kind: 'hud' },
    lines: [
      'Score sits top-centre; the tilted feather icons top-left show your remaining lives; the ×N in ' +
        'gold, top-right, is your current combo multiplier.',
      'The gold bar is the day running out - it fills as sunset approaches, alongside the level number ' +
        'and name.',
    ],
  },
  {
    title: 'More HUD icons',
    lines: [
      'A ◆ counter (top-left, once seeds are in play) tracks golden seeds collected. Acorn icons below ' +
        'the feathers (once hit back is in play) show how many you are holding, up to 3. A WIND ' +
        'readout (top-right, once wind is in play) shows its direction and strength.',
    ],
  },
  {
    title: 'The telegraph: reading a hunter\'s aim',
    art: { kind: 'telegraph' },
    lines: [
      'Before any hunter shoots, he pulls back - as long as 1.4 seconds early in a level, down to as ' +
        'little as about 0.45 seconds once things get hard (archers draw faster still, down to about ' +
        '0.42 s).',
    ],
  },
  {
    title: 'What the telegraph tells you',
    lines: [
      'While he draws, a dotted arc and a pulsing ring mark exactly which perch is the target. That ' +
        'ring is the entire game: read it, judge the moment, and go.',
      'Which threat types can even appear depends on this level\'s own difficulty rating plus how long ' +
        'you have survived in this run - so a later level can throw variety at you from the very first ' +
        'shot, not just once you have been playing a while.',
      'Hunters in the same burst do not all draw at once - each one starts about a quarter of a second ' +
        'after the last, so a "volley" reads as a ripple, not a single instant.',
    ],
  },
  {
    title: 'Lob and flat stones',
    art: { kind: 'pair', left: 'lob', right: 'flat', leftLabel: 'LOB', rightLabel: 'FLAT' },
    lines: [
      'Lob: a slow stone on a high, looping arc, roughly 1.6 seconds in the air early on, down to 0.7 ' +
        's at worst. It is on the field from your very first hunter.',
    ],
  },
  {
    title: 'Flat stones, and bursts',
    lines: [
      'Flat: a faster, flatter throw - about 1.0 second in the air, down to the same 0.7 s floor. It ' +
        'joins the mix once a level\'s difficulty rating passes 1 (every level but the very start of ' +
        'Lone Oak).',
      'A burst can be 1 to 5 stones at once, more of them the harder the level has become - the exact ' +
        'cap is 5, driven by the level\'s overall difficulty, not simply how long you have survived it.',
    ],
  },
  {
    title: 'Trickier catapult tricks',
    art: { kind: 'trick' },
    lines: [
      'Double: two hunters, from different spots, pull back and release in sync, both aimed at the ' +
        'perch you are on right now. Nothing marks it as special - one good flit still clears both.',
    ],
  },
  {
    title: 'The fake',
    lines: [
      'Fake: the full pull-back and ring, then nothing - no stone ever leaves the sling. Its ring glows ' +
        'amber instead of red, so a sharp eye can tell it apart while it happens - but the automatic ' +
        'safest-perch logic (level 1, or any keyboard flit) cannot tell, and may dodge it anyway.',
    ],
  },
  {
    title: 'Skipper and leader',
    lines: [
      'Skipper: lands normally, then bounces to a perch next to it on the same tree 0.4 s later, with ' +
        'no separate warning ring of its own.',
      'Leader: aimed not at your current perch, but at whichever perch the safest-perch rule would ' +
        'send you to right now. Leaving too early can fly you straight into it.',
    ],
  },
  {
    title: 'Archers',
    art: { kind: 'hunter-arrow' },
    lines: [
      'From The Orchard (level 3) on, some hunters carry a bow instead of a sling - drawn in the game ' +
        'as a bow and nocked arrow, not a catapult.',
    ],
  },
  {
    title: 'An arrow\'s warning',
    lines: [
      'An arrow gives the shortest warning of anything in the game: a pull-back as brief as about 0.42 ' +
        's, and a flight as fast as half a second. Wind still carries an arrow sideways exactly like a ' +
        'stone - only a net is immune to wind.',
    ],
  },
  {
    title: 'Nets',
    art: { kind: 'net' },
    lines: [
      'From Net Season (level 6) on, a hunter can throw a net over an ENTIRE tree at once, telegraphed ' +
        'as one large dashed ring around the whole canopy rather than a small ring on one perch.',
    ],
  },
  {
    title: 'Escaping a net',
    lines: [
      'If you are anywhere on that tree - any of its perches - when the net lands, that is a hit. The ' +
        'only answer is to leave the tree completely.',
      'Nets only ever appear on multi-tree levels; Lone Oak, with its single tree, never sees one.',
    ],
  },
  {
    title: 'Golden seeds',
    art: { kind: 'seeds' },
    lines: [
      'From The Grove (level 2) on, a golden seed occasionally appears on a nearby perch that has ' +
        'nothing currently threatening it, and fades away after about 7 seconds if you never collect ' +
        'it.',
    ],
  },
  {
    title: 'Collecting a seed',
    lines: [
      'Tap while nothing threatens your own perch (rather than fleeing something) and, if a safe seed ' +
        'is within reach, the bird heads for it instead of just hopping in place.',
      'Landing on a seed is worth 10 points outright. Every 3rd seed you collect heals back one lost ' +
        'feather, up to your full 3.',
    ],
  },
  {
    title: 'Hit back: acorns',
    art: { kind: 'acorn' },
    lines: [
      'From The Orchard (level 3) on, a close call (see Scoring) earns you an acorn, and so does every ' +
        '5th dodge in an unbroken streak - up to 3 held at once.',
    ],
  },
  {
    title: 'Throwing an acorn',
    lines: [
      'While you are holding one, tapping directly on a hunter throws the acorn at him instead of ' +
        'flitting. Dashed rings mark every hunter you can currently reach this way.',
      'The acorn takes 0.3 s to arrive. It knocks that hunter down for 2.6 seconds, cancelling ' +
        'whatever shot he was drawing, and scores 5 points times your combo - 15 times your combo if ' +
        'it is the Master Hunter.',
    ],
  },
  {
    title: 'Wind',
    art: { kind: 'wind' },
    lines: [
      'From Windy Grove (level 4) on, a shifting wind carries every stone and arrow sideways as it ' +
        'flies (nets are unaffected). A pennant on top of each tree, and the WIND readout on the HUD, ' +
        'show which way and how hard it is blowing.',
    ],
  },
  {
    title: 'Trust the ring',
    lines: [
      'The target ring already accounts for the drift: it always marks exactly where the shot will ' +
        'really land, not simply the perch you happen to be on. Trust the ring.',
    ],
  },
  {
    title: 'Beaters',
    art: { kind: 'beater' },
    lines: [
      'From The Beaters (level 7) on, a beater dog periodically picks the perch you are currently on ' +
        'and rattles it for about 1.1 seconds, with a blinking "!" that speeds up as time runs out.',
    ],
  },
  {
    title: 'Stay, or leave early',
    lines: [
      'Stay put when time is up and you are automatically flushed to a safe perch for free - no ' +
        'feather lost, just moved without being asked.',
      'Leave that perch before the deadline instead, and you outsmart the beater: +3 points times your ' +
        'combo.',
    ],
  },
  {
    title: 'The Master Hunter',
    art: { kind: 'boss' },
    lines: [
      'Level 5, level 8, and roughly every fourth level after that bring the Master Hunter, a 15th ' +
        'figure who joins the regular field.',
    ],
  },
  {
    title: 'A learnable pattern',
    lines: [
      'His entire volley pattern - which hunters fire, in what order, at what moment - is generated ' +
        'once from a fixed seed for that level, so it is EXACTLY the same on every attempt. Learn it ' +
        'once and you can repeat it.',
      'Knocking him down with an acorn is worth triple the usual points: 15 times your combo instead ' +
        'of 5.',
    ],
  },
  {
    title: 'Scoring, and how a level ends',
    art: { kind: 'stone' },
    lines: [
      'Dodging a stone is worth 1 point times your combo; a close call - flitting away within a ' +
        'quarter-second of a real threat landing on you - is worth 5 times your combo instead.',
    ],
  },
  {
    title: 'Combo, stars, and the end',
    lines: [
      'Your combo climbs by 1 for every 5 dodges in a row, up to ×5, and resets to ×1 the moment you ' +
        'are hit. Survival time and a seed pickup are the two rewards NOT multiplied by your combo.',
      'You win by surviving until sunset. Your stars are 3 minus the feathers you lost that run - a ' +
        'flawless run earns all 3 and unlocks the next level.',
      'You lose the instant your 3rd feather is gone, whatever the clock says. There is no draw or ' +
        'stalemate in Perch: every run ends in exactly one of those two ways.',
    ],
  },
];
