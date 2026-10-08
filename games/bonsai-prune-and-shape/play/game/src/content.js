// Text for About, How to Play, Rules and Lessons. Every rule here is checked against tree.js, judge.js, species.js and game.js.
// Blocks: { h } heading, { p } paragraph, { li: [...] } bullets, { note } callout. `fig` names a picture drawn with the game's real art.
import { COMMISSIONS, SPECIES, STYLES, POTS, YEAR, SEASON, GROW } from './species.js';
import { SET_T, BITE_T, MAX_WIRES, MAX_LIMBS } from './tree.js';

export const STAR_3 = 85, STAR_2 = 66;
const comTable = COMMISSIONS.map((c, i) => `${i + 1}. ${c.name}: ${SPECIES[c.species].name}, ${STYLES[c.style].name}, ${c.years} years.`);
const potTable = POTS.map((p) => `${p.name}: ${p.w} units wide, ${p.d} deep.`);

export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Bonsai',
      fig: 'tree:c2',
      body: [
        { p: 'Bonsai is the Japanese craft of growing a miniature tree and shaping it, over years, into the look of an old tree in nature. The craft is mostly patience: you watch, you decide, you wait.' },
        { p: 'In this game a young tree grows in real time through spring, summer, autumn and winter. You read where each branch is heading, then snip, pinch and wire it toward a named style, and finally choose its pot. A judge scores your tree and explains each score.' },
        { li: ['Eight trees to train, from a straight juniper to a hanging cascade.', 'Real principles: taper, balance, negative space, cutting back to a bud, wiring and timing.', 'Lessons, hints, and Watch and Learn, which trains a whole tree and explains each cut.', 'No timer pressure: pause any time, and speed up when you are only waiting.', 'Works in portrait and landscape on phones and tablets.'] },
      ],
    },
    {
      title: 'Credits and the free preview',
      body: [
        { p: 'You can play a free preview first. Unlocking the full game is a single one-time purchase. There are no ads and no subscriptions. Use Restore Purchase in Settings if you have bought it before.' },
        { p: 'All pictures are painted by the game itself and all sounds are synthesized on your device.' },
        { p: 'Bonsai is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Choose a tree',
      fig: 'styles',
      body: [
        { p: 'Tap Play and pick a tree. Each tree names a species, a style to train it toward, and how many years you have. Read the goals on the card, then tap Begin.' },
        { p: 'Start with the First Juniper: a young tree and a forgiving style.' },
      ],
    },
    {
      title: 'Watch it grow',
      fig: 'seasons',
      body: [
        { p: 'Time runs by itself. Tips lengthen and side buds break open in spring, the tree thickens through summer, colours in autumn and rests in winter. Faint dotted lines show where each growing tip is heading.' },
        { p: 'Use the Speed button to wait faster, and Pause to stop and think.' },
      ],
    },
    {
      title: 'Snip',
      fig: 'cut',
      body: [
        { p: 'Choose Snip. Press a limb and slide to the exact spot; a scissor mark shows the cut and tints what will fall. Let go to cut. Slide off the tree before letting go to cancel.' },
        { p: 'Cutting makes the limb shorter and wakes buds near the cut. Do not remove more than a third of the foliage at once or the tree is shocked.' },
      ],
    },
    {
      title: 'Pinch',
      fig: 'pinch',
      body: [
        { p: 'Choose Pinch and tap a soft growing tip. It stops lengthening, and next spring it breaks into several buds behind the pinch, so the foliage pad grows denser and stays small. Tap a small bud dot instead to rub it off.' },
      ],
    },
    {
      title: 'Wire',
      fig: 'wire',
      body: [
        { p: 'Choose Wire, press a limb and drag in the direction you want it to go. The limb bends and a copper wire is wound on. A ring on the wire fills while the bend is setting: amber, then green when set. Tap a wired limb to take the wire off.' },
        { p: 'Take wire off once the ring is green. Too early and the bend springs back. Too late and the wire bites into the bark and leaves scars. You have four wires.' },
      ],
    },
    {
      title: 'Present and be judged',
      fig: 'judge',
      body: [
        { p: 'When the last season is over (or any time you tap Present), choose a pot. The judge then scores style, balance, taper, negative space, health and pot, explains each score and gives one to three stars. Your best tree of each kind stays on the Shelf.' },
        { p: 'Hint shows the next useful move and why. A second tap does it for you. Watch and Learn plays a whole tree by itself and explains every step.' },
      ],
    },
  ],
};

const LESSON = (title, fig, ...body) => ({ title, fig, body });
export const LESSONS = {
  title: 'Lessons',
  pages: [
    LESSON('Taper', 'taper', { p: 'A tree is thick at the base and thin at the top, smoothly. That taper makes it look old and strong. Branches are thinner than the trunk where they leave it.' }, { li: ['Cut a branch back to a joint or a bud, not in the middle of a long bare stretch.', 'A hard chop of a thick trunk leaves a step in the line; the judge notices.', 'A short, thick trunk looks old. A tall, thin one looks like a sapling, so cut the height back as the trunk thickens.'] }),
    LESSON('Balance', 'balance', { p: 'Imagine the foliage as a weight. For an upright tree its centre should sit over the base of the trunk. For a leaning tree it should lean with the trunk, but not so far that it would topple.' }, { li: ['Upright styles: keep the weight centred.', 'Slanting: one low branch reaching the other way balances the lean.', 'Windswept: most of the weight on one side is the whole point.'] }),
    LESSON('Negative space', 'space', { p: 'The air between foliage clouds matters as much as the leaves. Clouds with gaps let you see the trunk and branches, and give the tree depth.' }, { li: ['Too dense: a solid green ball with no line.', 'Too sparse: not enough tree.', 'About half to two thirds of the crown outline filled is a good target.'] }),
    LESSON('Cutting back', 'cut', { p: 'A cut sends energy to the buds near it. Cut to shorten a long branch, to remove a crossing or crowding one, or to reduce a tall tree. Take away no more than a third of the foliage at one time.' }),
    LESSON('Pinching', 'pinch', { p: 'Pinching a soft new tip, instead of cutting a hard branch, keeps shoots short and makes them fork. Do it in the growing seasons. It is the gentle way to keep a pad small and dense.' }),
    LESSON('Wiring', 'wire', { p: 'Wire holds a bend while the wood sets. Young thin wood bends easily; thick old wood cracks, so shape early. Remove the wire when the bend has set and before it bites into the growing bark.' }),
    LESSON('The seasons', 'seasons', { p: 'Spring is for growth and for pinching. Summer is for steady care. In autumn the colour is at its best, which is why trees are shown then. Winter is when you see the bare structure and plan the next spring.' }),
    LESSON('The five styles', 'styles', { li: Object.values(STYLES).map((s) => `${s.name} (${s.jp}): ${s.blurb}`) }),
    LESSON('Choosing a pot', 'pots', { p: 'The pot is part of the picture. Its width is usually between a third and a half of the tree height. Upright formal trees like a plain rectangle, softer styles like an oval or round bowl, and a cascade needs a deep pot.' }),
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    { title: 'The goal', fig: 'tree:c1', body: [
      { p: 'Train a young tree toward the style named on its card. You have a number of years. When they are over (or when you present early) you choose a pot and the judge scores the tree from 0 to 100.' },
      { p: 'There is no losing: every presented tree earns at least one star. Stars and scores are kept per tree on the Shelf.' },
    ] },
    { title: 'Time and seasons', fig: 'seasons', body: [
      { p: `A year lasts ${YEAR} seconds at normal speed: Spring, Summer, Autumn and Winter, ${SEASON} seconds each. Speed x2 and x4 run the tree faster; Pause stops it.` },
      { li: [`Growth rate by season: Spring x${GROW[0]}, Summer x${GROW[1]}, Autumn x${GROW[2]}, Winter x${GROW[3]} (no growth).`, 'A tree lasts its number of years and ends at the end of autumn of the last year. It is then shown in autumn light.', 'Present can be tapped once the first autumn has passed (any time from year 2, or from the middle of autumn in year 1).'] },
    ] },
    { title: 'How the tree grows', fig: 'tree:c2', body: [
      { li: ['A limb is a chain of segments. Its growing tip lengthens, and when a segment reaches its full length a new one starts.', 'New segments lean back toward the light a little, so a trunk tends to straighten itself: wire it again if you want it to stay curved.', 'Each tip grows more slowly the more tips the tree has in total (the tree shares its energy).', 'A limb stops lengthening when it reaches its species\' maximum length. It still thickens.', `A tree holds at most ${MAX_LIMBS} limbs.`] },
      { p: 'New segments sometimes carry a dormant bud, shown as a small dot beside a joint.' },
    ] },
    { title: 'Buds and spring', fig: 'cut', body: [
      { p: 'When spring begins, every dormant bud may break into a new side limb. The chance depends on the species and falls about 12 percent with each step further from the trunk. New limbs appear on the side the bud was on.' },
      { li: ['In winter the bare structure and the buds are easy to read: that is the time to plan spring.', 'Rub off a bud (Pinch, then tap the bud) and it will not become a limb.', 'A limb you pinched resumes tip growth in spring, with a shorter segment length, and gets two extra buds behind the tip.'] },
    ] },
    { title: 'Thickening', fig: 'taper', body: [
      { p: 'Every segment grows thicker toward a size set by the number of tips beyond it: many tips above a joint means a thick joint (the pipe rule). A segment never thins, so a cut leaves the thick base it had. The girth builds over about four years.' },
      { p: 'This is why taper depends on your cuts: a branch cut hard back is thick at the cut and thin only where new growth starts.' },
    ] },
    { title: 'Snip', fig: 'cut', body: [
      { p: 'With Snip chosen, press near a limb. A marker follows your finger along the nearest limb, with the part that will fall tinted. Release to cut there; release away from the tree to cancel.' },
      { li: ['Everything beyond the cut falls, including the side limbs on it.', 'A cut very near where a limb leaves its parent removes the whole limb.', 'The trunk cannot be cut below its second joint.', 'The cut end has a bud and its tip begins to grow again; the limb\'s next segments are a little shorter.', 'Cutting more than 35 percent of the foliage in one cut shocks the tree: growth runs at a quarter speed for 8 seconds and the Health score falls.'] },
    ] },
    { title: 'Pinch and rub', fig: 'pinch', body: [
      { li: ['Pinch works on the growing tip of a side limb (not the trunk). The tip stops, its last segment is shortened to about half, and the limb\'s foliage pad grows denser.', 'Pinching the same limb again makes the pad a little denser still, up to three times.', 'Rub removes the dormant bud you tap.'] },
    ] },
    { title: 'Wire', fig: 'wire', body: [
      { p: 'Press a limb and drag. The joint at the start of the segment you pressed is the pivot. The wired stretch (that segment and the next two) turns toward your finger and stays bent.' },
      { li: [`At most ${MAX_WIRES} limbs can be wired at once.`, 'Old thick wood cracks, so the bend you can make shrinks as the wood thickens: about 110 degrees on a thin twig, down to about 17 degrees on a thick trunk.', `The wire counts its age in growth time. At ${SET_T} units the bend has set (the ring turns green); until then taking the wire off lets the bend spring back, as far as three quarters of the way.`, `At ${BITE_T} units the wire bites: one scar, and the Health score falls by 7 points.`, 'Tap a wired limb with the Wire tool to take its wire off. Press and drag it to bend it further.'] },
      { note: 'Growth time counts spring in full, summer at about two thirds, autumn at about a sixth, and winter not at all.' },
    ] },
    { title: 'Hint', fig: 'judge', body: [
      { p: 'Hint reads the tree and picks one next move with a reason, such as a wire to straighten the trunk, a branch to cut back, a crowded branch to thin, a tip to pinch, or a wire to take off. It points at the place. Tap Hint again and the game does it for you with a short animation.' },
      { p: 'When nothing needs doing it says so: let it grow.' },
    ] },
    { title: 'Presenting and the pot', fig: 'pots', body: [
      { p: 'Present ends the training. You then see your tree in autumn light with full leaves and choose one of six pots; the judge reads your choice.' },
      { li: potTable },
    ] },
    { title: 'Judging: style fit', fig: 'styles', body: [
      { p: 'Style is worth 28 points of 100. Each style checks the trunk and the crown:' },
      { li: ['Formal upright: trunk leans 0 to 5 degrees and is straight; the crown is a triangle, widest at the bottom; its width is 0.5 to 0.95 of its height.', 'Informal upright: 2 or 3 bends in the trunk; the apex sits within 15 percent of the height of the base line; the crown is wider below than above.', 'Slanting: trunk leans 22 to 48 degrees, at most one bend, and a low branch reaches the other way (25 to 60 percent of the tree height).', 'Windswept: trunk leans 15 to 50 degrees; at least 70 percent of the foliage and of the main branches sweep the same way.', 'Cascade: the apex hangs at least 90 units below the pot rim after the trunk has first risen 50 units; most foliage on the side it falls.'] },
    ] },
    { title: 'Judging: the other five', fig: 'judge', body: [
      { li: ['Balance (14): the centre of the foliage weight against the trunk line. Upright styles want it within 10 percent of the width; leaning styles want it 8 to 40 percent toward the lean; a cascade up to 50 percent. A low centre of weight is a little better.', 'Taper (14): the trunk narrows from base to top; the tree is 5 to 15 trunk widths tall; no abrupt steps or thickening above a thinner part; side limbs thinner than the trunk where they start.', 'Negative space (14): 45 to 66 percent of the crown outline filled with foliage; the lowest branch between 12 and 40 percent of the height; at least 6 foliage clouds.', 'Health (12): starts at 100. Each shock costs 4 to 26 points depending on how much you cut; each wire bite costs 7.', 'Pot (18): the pot suits the style (full for the style\'s pot, partly for a close one), and its width is 30 to 62 percent of the tree height.'] },
    ] },
    { title: 'Stars and the Shelf', fig: 'tree:c4', body: [
      { li: [`${STAR_3} or more: three stars.`, `${STAR_2} or more: two stars.`, 'Lower: one star.'] },
      { p: 'The Shelf keeps your best score, stars and a small picture of your best tree for each of the eight trees.' },
      { p: 'The eight trees:' }, { li: comTable },
    ] },
    { title: 'Pause, saving and Watch and Learn', fig: 'tree:c3', body: [
      { li: ['Pause stops the tree and every animation. Restart gives you the same sapling again. Menu keeps your tree so you can continue it later.', 'One tree per commission is saved: the whole skeleton, wires, buds and the season.', 'Watch and Learn trains a tree by itself using the same hint planner: it thinks (2, 5, 8 or 10 seconds, your choice) while the tree keeps growing, shows what it will do and why, then does it. Pause and Resume freeze everything exactly where it is. It is never saved to your Shelf.'] },
    ] },
    { title: 'Free preview and keyboard', body: [
      { p: 'The free preview counts 90 seconds of real play (training a tree, not paused and not Watch and Learn). Menus, the Shelf, these pages, Lessons, the pot choice and the judging are free. After the preview one purchase unlocks the whole game. In the web demo two trees can be started, then the demo ends.' },
      { li: ['Mouse or touch: everything.', '1, 2, 3: choose Snip, Pinch, Wire. H: hint. F: change speed. P or Escape: pause. Enter: present.', 'Arrow keys scroll long pages.'] },
    ] },
  ],
};
export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES, lessons: LESSONS };
