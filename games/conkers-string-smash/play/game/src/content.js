// The words: About, How to Play, Rules and the conker lore. Every number here is one the engine (engine.js), the physics (sim.js) and the computer
// players (ai.js) really use; the figures are read from those files so the text cannot drift from the game.
// Language: the game is played in English.
import { GOES, KINDS, RIVALS, DAMAGE_BASE, WEAK_FLOOR, WEAK_BONUS, CUP_ROUNDS, countName } from './engine.js';
import { PULL_MIN, PULL_MAX, HAND_RANGE, WOBBLE_PERIOD } from './sim.js';
import { STEADY } from './ai.js';

const deg = (r) => Math.round((r * 180) / Math.PI);
const cm = (m) => Math.round(m * 100);
const pct = (v) => `${Math.round(v * 100)}%`;
const heavyK = KINDS.find((k) => k.id === 'heavy'), seasonedK = KINDS.find((k) => k.id === 'seasoned'), freshK = KINDS.find((k) => k.id === 'fresh');

// Gentle trivia, shown on result screens and in the About reader. Folklore is told as folklore; nothing here is advice or a health claim.
export const LORE = [
  'Conkers are the shiny brown seeds of the horse chestnut tree. They drop in autumn from spiky green cases, and the game is as old as most grandparents can remember.',
  'Conkers are for playing, not for eating. Collect them, admire them, and ask a grown-up to make the hole for the string.',
  'Many players swear a conker kept in a dry cupboard over the winter plays harder the next autumn. This game calls that a Seasoned conker.',
  'Folk tales of soaking or baking conkers to make them tougher are not fair play. Every conker in this game plays by the same honest rules.',
  'A conker that wins its first match is a oner. Win again and it becomes a twoer. One that beats a fifer is a sixer at least.',
  'The pale patch on a conker is where it was joined to its case. Players know it as the soft spot.',
  'A good swing is a pull back, a pause and a smooth let go. The best players wait for the other conker to swing into place.',
  'Horse chestnut leaves spread like an open hand, five to seven leaflets on one stalk. Spot one on your next autumn walk.',
  'Yearly conker championships are held in village fields, with referees, brackets and a winner who goes home with whichever conker is still in one piece.',
  'Never throw conkers. They belong on a string, in a clear space, with a friend who is ready to take their turn.',
  'A conker loses its mahogany shine in a few weeks as it dries. In this game the shine lasts all autumn.',
];

export const ABOUT = [
  { title: 'Conkers String Smash', p: [
    'England\'s autumn playground game, polished up for your phone: hold a horse-chestnut conker on a string, take turns to swing at your opponent\'s conker, and carry on until one of them shatters.',
    'Conkers has been played in playgrounds, lanes and gardens for generations, wherever horse chestnut trees stand. The rules vary from one school to the next. This game follows the common playground way: three goes in a turn, the winner inherits the loser\'s wins, and the old count names (oner, twoer, fifer, sixer).',
  ], art: 'duel' },
  { title: 'What is in the game', p: [
    `A Conker Cup with ${CUP_ROUNDS} rivals in turn and a tin of three conkers that keep their cracks from duel to duel, a quick Duel against any rival, Two Players on one phone, and Watch & Learn, where two computer players show you a whole duel and explain each swing.`,
    'You pull the conker back, choose the height of your hand, and let go at the right moment while the other hand sways. The physics is real: a string, a swinging weight, and a collision with a bounce.',
  ] },
  { title: 'Conker lore', p: LORE.slice(0, 6) },
  { title: 'More lore', p: LORE.slice(6) },
  { title: 'Friendly and fair', p: [
    'All opponents are invented characters. There are no real players, schools, leagues or brands in this game.',
    'It is a game of skill for fun: no betting, no stakes, no coins. Scores and records stay on your device.',
  ] },
  { title: 'Made to be comfortable', p: [
    `Every text screen can be enlarged up to 300%. A Steadiness setting (${STEADY.map((s) => s.name).join(', ')}) forgives a shaky hand. The Think button tests swings with the real physics and tells you what it found; Watch & Learn lets two computer players play a whole duel with a real Pause.`,
    'The game is free to try for 90 seconds of real play. Menus, the rules, Think and Watch & Learn are always free; one purchase unlocks everything for good.',
  ] },
];

export const HOWTO = [
  { title: 'The goal', p: [
    'Two conkers hang on strings. You take turns to swing yours at the other. Every touch cracks both conkers; the first conker to shatter loses.',
    `Win a duel and your conker carries the loser's wins plus one. In the Conker Cup, win all ${CUP_ROUNDS} duels to be champion.`,
  ], art: 'duel' },
  { title: 'Swing: pull back and let go', p: [
    `Put a finger anywhere on the scene and drag it back and down: the conker follows, and the further you pull (from about ${deg(PULL_MIN)} to ${deg(PULL_MAX)} degrees) the faster it will arrive. Let go to swing. A very short pull cancels.`,
    'Flick your finger forward as you let go for extra speed. A slow, gentle lift is a plain release.',
  ], art: 'swing' },
  { title: 'Hand height', p: [
    'Drag the fist up or down, or tap the Hand buttons. Raising or lowering your hand changes where on their conker yours lands, and how squarely.',
    'Aim for the pale patch: a touch on the soft spot does far more damage. A touch on the far side does less.',
  ], art: 'patch' },
  { title: 'Timing: the sway', p: [
    `The other hand is never quite still, so their conker sways to and fro once every ${WOBBLE_PERIOD.toFixed(1)} seconds. A conker that is in the wrong place when yours arrives is missed.`,
    'The guide under the scene says what a release right now would do (miss, glance, solid, crushing). The timing strip shows the next moments: tall green bars are good moments to let go.',
  ] },
  { title: 'Goes and turns', p: [
    `A turn gives you up to ${GOES} goes. A miss uses one up. A touch ends your turn and the other player takes the string. When a conker shatters the duel is over.`,
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think tests many swings with the real physics and suggests one, with the reason: how often it touched, how much it cost each conker, and whether it found the pale patch.',
    'Watch & Learn lets two computer players play a whole duel. You see them think, the swing they chose, and then the swing itself. Pause stops everything, and the thinking time can be changed.',
  ] },
  { title: 'Counts and names', p: [
    'A conker new from the tree is a none-er. When one wins it takes the loser\'s count and adds one: beat a none-er and you are a oner; beat a oner and you are a twoer; beat a fifer and you are at least a sixer.',
  ], art: 'counts' },
];

export const RULES = [
  { title: 'The duel', p: [
    'Two players each have one conker on a string, about the length of a forearm. One player is the striker and swings; the other is the defender and holds their conker out. The striker swings at the defender\'s conker.',
    'The first conker to shatter loses the duel. The winner\'s conker is then counted as described in Counts.',
  ], art: 'duel' },
  { title: 'The conkers', p: [
    `Each conker has a kind. ${KINDS.map((k) => `${k.name}: ${k.short}`).join(' ')}`,
    `Kinds differ in three numbers. Weight (fresh ${freshK.mass}, seasoned ${seasonedK.mass}, big heavy ${heavyK.mass}) makes a harder swing. Toughness (${freshK.tough}, ${seasonedK.tough}, ${heavyK.tough}) is how much damage a conker takes before it breaks. Hardness (${freshK.hard}, ${seasonedK.hard}, ${heavyK.hard}) is how much it hurts the other conker. All of this is shown on the conker cards.`,
  ] },
  { title: 'Goes and turns', p: [
    `The striker has up to ${GOES} goes in a turn. A go that touches the other conker ends the turn at once: the players swap roles and the old defender swings next. A go that misses uses up one of the ${GOES}; after the third miss the turn passes anyway.`,
    'In the Conker Cup the first swing alternates from round to round (and passes to the rival after a lost duel); in a Quick Duel or Two Players it is drawn at random. The banner at the start names who swings first. A shattered conker ends the duel at once, in the middle of a turn.',
  ] },
  { title: 'The swing', p: [
    `Pull back from ${deg(PULL_MIN)} to ${deg(PULL_MAX)} degrees behind the hanging position. The conker then swings down on its string like a pendulum, passes the bottom, and rises toward the other conker. The harder you pull, the faster it goes.`,
    `Hand height moves your hand up or down by up to ${cm(HAND_RANGE)} cm. A flick as you let go adds extra speed. The release moment is yours: the conker is held until you lift your finger (or tap Swing).`,
    'There is no wind and no hidden dice in the swing itself. What happens depends only on the pull, the hand height, the flick, the release moment and the position of the other conker.',
  ], art: 'swing' },
  { title: 'The sway', p: [
    `The defender\'s hand wobbles a little to and fro, once every ${WOBBLE_PERIOD.toFixed(1)} seconds, so their conker sways. The sway is steady and never random: the same swing at the same moment always gives the same result.`,
    'The guide uses the same physics, so it tells the truth: if it says Solid, a release at that moment is a solid touch.',
  ] },
  { title: 'A touch and its damage', p: [
    'A touch is the two conkers meeting. How hard it was depends on how fast they closed on each other along the line between their centres: a square hit is hard, a glancing hit is light. Hard hits are labelled Crushing, medium hits Solid, and light ones Glancing.',
    `Both conkers are damaged by every touch, not only the one that was struck. Damage is the strength of the touch times the pale-patch factor (below), divided by the conker's toughness times ${DAMAGE_BASE}, and a little more for a hard opponent. A small random factor (about 8% either way) is added so no two duels are quite the same.`,
  ] },
  { title: 'The pale patch', p: [
    `Every conker has a pale patch where it was joined to its case. It is the soft spot. A touch that lands on the patch does up to ${WEAK_FLOOR + WEAK_BONUS} times the plain damage; a touch on the opposite side does ${WEAK_FLOOR} times.`,
    'The patch also matters for your own conker: if yours faces the other conker when it touches, you take the extra damage yourself. Both patches are drawn on the conkers. They turn between turns, so look before you swing.',
  ], art: 'patch' },
  { title: 'Cracks and shattering', p: [
    'A conker shows how much damage it has taken: sound, then a hairline crack, then cracked, then splitting. When the damage reaches the end the conker shatters and the duel is over.',
    'If one touch would break both conkers, the one that was struck breaks and the swinger\'s conker survives with a split. No duel ends in a draw.',
  ], art: 'cracks' },
  { title: 'Counts', p: [
    'Every conker carries a count of its wins. When a conker wins, its count becomes its own count plus the loser\'s count plus one. A none-er that beats a none-er is a oner; a oner that beats a twoer is a fourer.',
    `The names run none-er, ${[1, 2, 3, 4, 5, 6, 7].map(countName).join(', ')}, and on from there. The count is shown on the card of each conker.`,
  ], art: 'counts' },
  { title: 'The Conker Cup', p: [
    `The Cup is a tournament of ${CUP_ROUNDS} duels against ${RIVALS.map((r) => r.name).join(', ')} in that order. You start with a tin of three conkers: ${KINDS.map((k) => k.name).join(', ')}. Before each duel you choose one conker from the tin.`,
    'Damage stays on a conker from one duel to the next, and so does its count. A shattered conker is lost for good. If your conker shatters you lose that duel and may try the same rival again with another conker from the tin. If the tin is empty the Cup is over.',
    'Win all the duels to become champion. Your best count is kept in your records.',
  ] },
  { title: 'Quick Duel and Two Players', p: [
    'A Quick Duel is one duel against a rival of your choice with a conker of your choice; nothing is kept afterwards.',
    'Two Players is one duel on a shared phone: each player picks a kind of conker, and the phone is handed over when the turn passes. There is no Think button for the player whose turn it is not.',
  ] },
  { title: 'The rivals', p: RIVALS.map((r, i) => `${r.name} (${'★'.repeat(r.stars)}): ${r.tag}. Plays a ${KINDS.find((k) => k.id === r.kind).name.toLowerCase()} conker that is already ${countName(r.count)}${i === 0 ? '' : ''}.`) },
  { title: 'Watch & Learn', p: [
    'Two computer players play a whole duel. Each one thinks (the thinking time can be 2, 5, 8 or 10 seconds), shows the swing it chose with a short reason, and then swings. Pause freezes everything exactly where it is and Resume carries on.',
  ] },
  { title: 'Settings and comfort', p: [
    `Steadiness changes how far off your hand lands: ${STEADY.map((s) => s.name).join(', ')}. The aim guide can be switched off for a harder game. Text size goes from 100% to 300% on every text screen. Sound can be turned off.`,
    'Menus, the rules, Think and Watch & Learn never use up the free preview. Only real swinging does.',
  ] },
  { title: 'What this game leaves out', p: [
    'Some playgrounds have extra rules: calling "snags" when strings tangle, "stamps" when a conker falls, "no-strikes" and so on. This game leaves them out, so a duel is always about the swing. Cheating tricks such as baked or soaked conkers have no place here.',
  ] },
];
