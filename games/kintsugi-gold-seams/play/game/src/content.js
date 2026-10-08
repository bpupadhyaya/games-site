// Text for About, How to Play and the Rules reference. Every rule is checked against play.js / game.js (design/GDD.md "Rules reference").
// Blocks: { h } heading, { p } paragraph, { li: [...] } bullets, { note } callout. `fig` names a picture drawn with the game's real art.
import { VESSELS } from './vessels.js';

export const STAR_3 = 0.8, STAR_2 = 0.6;
export const ROT_STEP = 15, KEY_STEP = 5, KEY_FINE = 1;

const table = VESSELS.map((v, i) => `${i + 1}. ${v.name} (${v.jp}): ${v.N} shards, shards start turned up to ${v.rot >= 180 ? 'any angle' : v.rot === 0 ? '0 degrees (not turned)' : v.rot + ' degrees either way'}, snaps within ${v.snap} units and ${v.snapA} degrees.`);

export const ABOUT = {
  title: 'About',
  pages: [
    {
      title: 'Kintsugi',
      fig: 'vessel:moonjar',
      body: [
        { p: 'Kintsugi is the Japanese craft of mending broken pottery with gold. The cracks are not hidden. They become the most beautiful part of the vessel.' },
        { p: 'In this game twelve broken vessels wait on a dark lacquer bench. First you turn and fit every shard back into place. Then you trace each crack with liquid gold, slowly and steadily, until the vessel shines.' },
        { li: ['No timer, no lives and no fail screen. Take as long as you like.', 'Twelve vessels with their own glazes, patterns and breaks.', 'Hints that show you where a shard belongs, and Watch and Learn to see a whole mend.', 'Works in portrait and landscape on phones and tablets.'] },
      ],
    },
    {
      title: 'Credits and the free preview',
      body: [
        { p: 'You can play a free preview first. Unlocking the full game is a single one-time purchase. There are no ads and no subscriptions. Use Restore Purchase in Settings if you have bought it before.' },
        { p: 'All pictures are painted by the game itself and all sounds are synthesized on your device.' },
        { p: 'Kintsugi is part of Arcforge, a collection of world heritage games.' },
      ],
    },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  pages: [
    {
      title: 'Pick a vessel',
      fig: 'shelf',
      body: [
        { p: 'Tap Play and choose a vessel from the shelf. Each one is broken into shards that lie scattered around the bench. A faint ghost of the whole vessel shows where it belongs.' },
        { p: 'Start with the Tea Bowl: its shards are not turned, so you only have to slide them into place.' },
      ],
    },
    {
      title: 'Fit the shards',
      fig: 'shard',
      body: [
        { p: 'Drag a shard to move it. Tap a shard to select it: a ring with a gold knob appears. Drag the knob around the shard to turn it, or use the two turn buttons.' },
        { p: 'Match the glaze and the painted pattern to the ghost. When a shard is close and turned the right way it glows warm. Let go and it clicks into place and locks.' },
      ],
    },
    {
      title: 'Trace the gold',
      fig: 'gold',
      body: [
        { p: 'When the last shard clicks in, the cracks appear. Press on a crack and slide your finger along it. Liquid gold follows your finger, but only at a gentle pace.' },
        { p: 'Stay close to the line and move slowly: the gold comes out thick and bright. Rush or wander and it runs thin. You can trace a thin place again to thicken it.' },
      ],
    },
    {
      title: 'Hints and Watch and Learn',
      fig: 'hint',
      body: [
        { p: 'Tap Hint. The first tap picks out the next shard to place, the second shows where it goes, and the third moves it there for you. While gilding, Hint points to the next crack.' },
        { p: 'Watch and Learn on the menu plays a whole vessel by itself, thinking out loud on screen. Pause it any time.' },
      ],
    },
    {
      title: 'Finish and keep going',
      fig: 'quality',
      body: [
        { p: 'When every crack is gold the vessel is mended. You earn one to three stars from the quality of your gold, and the vessel joins your shelf with its new seams.' },
        { p: 'Your progress is saved. Leave at any time and pick up from Continue on the menu.' },
      ],
    },
  ],
};

export const RULES = {
  title: 'Rules',
  pages: [
    {
      title: 'The goal',
      fig: 'vessel:chawan',
      body: [
        { p: 'Mend a broken vessel in two steps. First, put every shard back where it belongs. Second, fill every crack with gold. When all cracks are gold the vessel is mended and the game scores your work.' },
        { p: 'There is no timer, no limit on moves and no way to lose. The only things that change your result are the quality of the gold and how you play with hints.' },
      ],
    },
    {
      title: 'The bench and the shards',
      fig: 'shelf',
      body: [
        { p: 'The vessel is centred on the bench and its shards are scattered around, each at a random position and, on most vessels, turned to a random angle (see the vessel list).' },
        { li: ['Shards may overlap each other and may lie over the ghost.', 'A shard cannot be dragged off the visible bench: its centre stays inside it. If you turn the device, shards stay reachable.', 'A shard that clicks into place is locked and cannot be picked up again.', 'Shards come from one fixed break per vessel, so every player gets the same pieces.'] },
      ],
    },
    {
      title: 'Moving a shard',
      fig: 'shard',
      body: [
        { p: 'Press on a shard and drag to move it. The shard you touch comes to the top and becomes the selected shard. Press on empty bench to unselect.' },
        { p: 'You only pick up a shard by its painted surface, not by the empty space around its jagged edge.' },
      ],
    },
    {
      title: 'Turning a shard',
      fig: 'rotate',
      body: [
        { p: 'The selected shard shows a ring with a gold knob. Drag the knob around the shard and the shard turns with it. The two turn buttons turn the selected shard by 15 degrees each tap.' },
        { li: ['Keyboard: Q turns left and E turns right by 5 degrees; hold Shift for 1 degree.', 'Mouse wheel over the bench turns the selected shard by 5 degrees per notch.', 'On the Tea Bowl no shard starts turned, so turning is optional there.'] },
      ],
    },
    {
      title: 'Fitting a shard',
      fig: 'snap',
      body: [
        { p: 'A shard fits when you let go with its centre within the vessel\'s position limit of its true place and its angle within the vessel\'s angle limit of upright. It then clicks into place, straightens, and locks. If it is not close enough it simply stays where you dropped it.' },
        { p: 'A shard that is nearly right glows warm gold around its edge. The warmer the glow, the nearer you are.' },
        { note: 'Position limits are in bench units; a vessel is about 450 units across. The vessel list shows the limits for each vessel; they get tighter along the shelf.' },
      ],
    },
    {
      title: 'Guides',
      fig: 'guides',
      body: [
        { p: 'The Guide button (and Settings) chooses what the bench shows of the finished vessel:' },
        { li: ['Picture: a faint painted ghost of the whole vessel.', 'Outline: only a gold outline of the vessel.', 'Slots: dark outlines of the empty places, one for each shard that is not yet placed.', 'Off: nothing at all, for a harder mend.'] },
        { p: 'In Settings the guide is on Auto, which uses each vessel\'s suggested guide: Slots for the Tea Bowl and Picture for the rest. The Guide button cycles Picture, Outline, Slots and Off, and your choice is then kept for every vessel.' },
      ],
    },
    {
      title: 'Hints',
      fig: 'hint',
      body: [
        { p: 'Hint works in three steps and you may stop at any one of them. First it rings the shard that is easiest to place next (the one with the most neighbours already in place, largest first). Second it shows the exact place. Third it carries the shard there and fits it.' },
        { p: 'Hints are only counted for your information. They never change your stars.' },
        { p: 'In the gilding stage Hint pulses the start of the next crack that is not yet gold.' },
      ],
    },
    {
      title: 'Gilding the cracks',
      fig: 'gold',
      body: [
        { p: 'After the last shard is placed every join between shards becomes a crack. Press close to a crack and slide along it. The gold follows your finger along the crack.' },
        { li: ['The gold moves along the crack at a fixed gentle speed at most. If your finger gets ahead, the gold catches up.', 'If your finger drifts too far from the crack the gold stops. Slide back near the crack to carry on.', 'You can start a crack anywhere along it, and go on from one crack into the next where they meet.', 'A crack counts as done when 93 percent of its length carries gold; the last tiny gaps then flow shut by themselves.', 'If you lift your finger the gold keeps flowing for a moment to where your finger last was.'] },
      ],
    },
    {
      title: 'Quality of the gold',
      fig: 'quality',
      body: [
        { p: 'Every point of every crack remembers the best gold laid on it. Quality is higher when your finger was close to the line and when the stroke was slow.' },
        { li: ['Close: within about a third of the vessel\'s tolerance gives full quality; quality falls to nothing at the full tolerance.', 'Slow: a stroke at the top allowed speed loses more than half of its quality; a gentle stroke loses none.', 'Retracing a thin place with a better stroke thickens it. Thick gold is wider and brighter.'] },
        { note: 'The Brush setting makes the tolerance more relaxed or finer.' },
      ],
    },
    {
      title: 'Stars and the mend score',
      fig: 'vessel:tokkuri',
      body: [
        { p: 'When every crack is done, the mend score is the average quality over the whole length of all cracks, shown as a percentage.' },
        { li: [`${Math.round(STAR_3 * 100)} percent or more: three stars.`, `${Math.round(STAR_2 * 100)} percent or more: two stars.`, 'Anything lower: one star. Every mended vessel earns at least one.'] },
        { p: 'Your best stars and best mend score for each vessel are kept on the shelf.' },
      ],
    },
    {
      title: 'The twelve vessels',
      fig: 'shelf',
      body: [{ p: 'Shard counts, starting turns and fitting limits for each vessel, in shelf order:' }, { li: table }],
    },
    {
      title: 'Pause, saving and Watch and Learn',
      fig: 'vessel:hachi',
      body: [
        { li: ['Pause stops everything. Restart gives you the same vessel with the shards scattered again. Menu keeps your work so you can continue it later.', 'One vessel at a time is saved: placed shards, the gold and the count of hints.', 'Watch and Learn plays a vessel by itself: it thinks (2, 5, 8 or 10 seconds, your choice), shows where the shard goes, then moves it. It then gilds the cracks in turn. Pause and Resume freeze everything exactly where it is. It is never saved to your shelf.'] },
      ],
    },
    {
      title: 'Free preview and keyboard',
      body: [
        { p: 'The free preview counts 90 seconds of real play (fitting or gilding, not paused and not Watch and Learn). Menus, the shelf, these pages and Watch and Learn are free. After the preview, one purchase unlocks the whole game. In the web demo three vessels can be started, then the demo ends.' },
        { li: ['Mouse or touch: everything.', 'Q / E: turn the selected shard. Shift for fine turns.', 'Arrow keys: nudge the selected shard. Tab: select the next shard. Enter: try to fit it.', 'H: hint. G: change guide. P or Escape: pause.'] },
      ],
    },
  ],
};
export const DOCS = { about: ABOUT, howto: HOWTO, rules: RULES };
