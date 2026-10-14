// The ten original tales. Each card: sky + ground + props/characters (see art.js), the narrator's line (cap),
// the reason it comes after the card before it (why), and an optional extra suspense pause in seconds (p).
// Element tuple: [kind, x, y, scale, attr, extra]; characters take [kind, x, y, scale, {options}, mood] or [kind, x, y, scale, mood].

const MIMI = { c: '#e2503c' };
const TARO = { c: '#3d7be0', hair: '#2b1d16' };
const HANA = { c: '#f08ab0', topknot: true };
const UME = { c: '#e2a13c' };
const KEN = { c: '#2f8fd0' };
const SORA = { c: '#ff7fa6' };
const YUKI = { c: '#4caf6e' };
const DAI = { c: '#f3b24a' };
const NORI = { c: '#8e6bd9' };
const k = (o, extra = {}) => ({ ...o, ...extra });

export const STORIES = {
  kite: {
    name: 'The Little Kite',
    blurb: 'A paper kite, a gust of wind and a helpful sparrow.',
    cards: [
      { sky: 'day', g: 'grass', e: [['sun', 335, 50, 0.9], ['cloud', 90, 52, 1], ['tree', 330, 205, 1.3, 'green'], ['kid', 150, 258, 1.25, k(MIMI), 'happy'], ['kite', 250, 240, 0.9, 'new']], cap: 'Mimi finished her bright paper kite and carried it up the hill.', why: 'The kite is brand new and still lies on the ground.' },
      { sky: 'day', g: 'grass', e: [['sun', 335, 50, 0.9], ['cloud', 90, 52, 1], ['tree', 330, 205, 1.3, 'green'], ['kid', 110, 258, 1.25, k(MIMI, { arms: 'up' }), 'happy'], ['line', 147, 143, 1, 255, 118], ['kite', 262, 82, 1, 'fly']], cap: 'A strong wind came, and up, up, up it flew.', why: 'The kite is flying high, so it has already been launched.' },
      { sky: 'day', g: 'grass', e: [['sun', 335, 50, 0.9], ['cloud', 90, 52, 1], ['tree', 320, 205, 1.3, 'green'], ['kid', 150, 258, 1.25, k(MIMI, { look: 2 }), 'sad'], ['kite', 318, 88, 0.8, 'fly']], cap: 'Then a sudden gust threw it into the old tree, and there it stuck.', why: 'The kite is stuck in the branches and Mimi is upset.', p: 1.2 },
      { sky: 'dusk', g: 'grass', e: [['sun', 70, 160, 1], ['cloud', 250, 50, 1], ['kid', 130, 258, 1.25, k(MIMI, { arms: 'up' }), 'proud'], ['line', 167, 143, 1, 270, 108], ['kite', 275, 90, 1, 'fly'], ['bird', 350, 140, 1, { fly: true }, 'happy']], cap: 'A little sparrow tugged the string loose, and they flew it home at sunset.', why: 'It is evening now and the kite is free again.' },
    ],
  },
  seed: {
    name: 'A Seed in the Window',
    blurb: 'A seed, a rainy week and a quiet night.',
    cards: [
      { sky: 'room', g: 'floor', e: [['pane', 310, 120, 1.15, 'day'], ['table', 200, 252, 1.1], ['flower', 200, 210, 1, 0], ['kid', 90, 252, 1.2, k(HANA, { arms: 'out' }), 'happy']], cap: 'Hana pressed one tiny seed into a pot of soil on the sunny sill.', why: 'There is only soil in the pot, so the seed has just been planted.' },
      { sky: 'room', g: 'floor', e: [['pane', 310, 120, 1.15, 'rain'], ['table', 200, 252, 1.1], ['flower', 200, 210, 1, 1], ['kid', 90, 252, 1.2, k(HANA, { look: 1 }), 'happy']], cap: 'Rain tapped on the glass all week, and a green sprout pushed up.', why: 'A small sprout has appeared, and the window shows rain.' },
      { sky: 'room', g: 'floor', e: [['pane', 310, 120, 1.15, 'day'], ['sun', 310, 105, 0.4], ['table', 200, 252, 1.1], ['flower', 200, 210, 1, 2], ['kid', 90, 252, 1.2, k(HANA, { arms: 'out' }), 'wow']], cap: 'One sunny morning there was a fat pink bud, waiting to open.', why: 'The plant is taller and has a bud but is not open yet.' },
      { sky: 'room', g: 'floor', e: [['pane', 310, 120, 1.15, 'night'], ['table', 200, 252, 1.1], ['flower', 200, 210, 1, 3], ['cat', 340, 252, 1, { sleep: true }, 'happy'], ['kid', 90, 252, 1.2, k(HANA, { arms: 'out' }), 'proud']], cap: 'Under the moon the flower opened at last, and Hana smiled in the quiet.', why: 'The flower is fully open and it is night.', p: 0.8 },
    ],
  },
  rain: {
    name: 'Rain Day Rescue',
    blurb: 'Dark clouds, a red umbrella and a shivering frog.',
    cards: [
      { sky: 'day', g: 'road', e: [['cloud', 70, 52, 1.1, 'dark'], ['cloud', 200, 38, 1.2, 'dark'], ['cloud', 330, 62, 1, 'dark'], ['house', 320, 210, 1.1], ['kid', 150, 258, 1.25, k(TARO, { look: 2 }), 'worry']], cap: 'Dark clouds rolled over the lane, and Taro looked up with a worried face.', why: 'Clouds gather first, before any rain falls.' },
      { sky: 'rain', g: 'road', e: [['house', 330, 210, 1.1], ['puddle', 70, 266, 1], ['puddle', 290, 272, 1.1], ['kid', 150, 258, 1.25, k(TARO, { arms: 'up', walk: true }), 'happy'], ['umbrella', 150, 150, 1.15, 'red']], cap: 'Rain pattered down, and Taro marched along beneath his red umbrella.', why: 'It is raining and Taro has put up his umbrella.' },
      { sky: 'rain', g: 'road', e: [['house', 340, 210, 1.1], ['puddle', 215, 270, 1.4], ['kid', 100, 258, 1.25, k(TARO, { arms: 'out' }), 'worry'], ['frog', 215, 268, 1.4, 'sad'], ['umbrella', 190, 170, 1.2, 'red']], cap: 'A small frog sat shivering in a puddle, so Taro held his umbrella over it.', why: 'He is still in the rain, but now he shelters the frog.', p: 0.6 },
      { sky: 'day', g: 'road', e: [['sun', 350, 50, 0.8], ['cloud', 70, 52, 1], ['rainbow', 250, 175, 1.5], ['puddle', 70, 266, 1], ['kid', 130, 258, 1.25, k(TARO, { arms: 'up' }), 'happy'], ['frog', 230, 268, 1.3, 'happy']], cap: 'Then the rain stopped, and a rainbow arched across the lane.', why: 'The rain has gone and a rainbow stands in the sky.' },
      { sky: 'dusk', g: 'road', e: [['sun', 60, 165, 1], ['house', 330, 210, 1.1, 'lit'], ['frog', 245, 268, 1.3, 'proud'], ['kid', 140, 258, 1.25, k(TARO, { arms: 'up' }), 'happy']], cap: 'At sunset the frog waved goodbye, and Taro went home for supper.', why: 'The day is ending: sunset and a lit window at home.' },
    ],
  },
  pot: {
    name: 'The Mended Pot',
    blurb: 'A clumsy cat, a broken pot and a thread of gold.',
    cards: [
      { sky: 'day', g: 'road', e: [['sun', 340, 50, 0.9], ['fence', 260, 228, 1.2], ['pot', 250, 190, 0.9, 'whole'], ['cat', 340, 245, 1, { flip: true }, 'happy'], ['kid', 110, 258, 1.25, k(UME), 'happy']], cap: 'Her mother\'s clay pot sat on the fence, and a curious cat crept close.', why: 'The pot is still whole and sits on the fence.' },
      { sky: 'day', g: 'road', e: [['sun', 340, 50, 0.9], ['fence', 260, 228, 1.2], ['pot', 250, 256, 1, 'broken'], ['cat', 345, 245, 1, { flip: true }, 'wow'], ['kid', 110, 258, 1.25, k(UME, { arms: 'out' }), 'sad']], cap: 'Crash! The cat leaped away, and the pot lay in pieces on the ground.', why: 'The pot is smashed on the ground and Ume is sad.', p: 1.0 },
      { sky: 'day', g: 'road', e: [['sun', 340, 50, 0.9], ['stall', 300, 232, 1.3], ['sign', 240, 255, 1], ['kid', 120, 258, 1.25, k(UME, { arms: 'hold' }), 'worry'], ['basket', 180, 256, 1.1, 'pieces']], cap: 'Ume gathered every piece and carried them to the old potter at the market.', why: 'She picked up the pieces and took them to someone who can mend them.' },
      { sky: 'room', g: 'floor', e: [['pane', 90, 110, 1.1, 'day'], ['table', 240, 252, 1.1], ['pot', 240, 210, 1.1, 'mended'], ['kid', 130, 252, 1.2, k(UME, { arms: 'out' }), 'proud']], cap: 'The potter joined the pieces with gold, and the pot was whole again.', why: 'The pot is mended; the golden seams show the repair.' },
      { sky: 'dusk', g: 'road', e: [['sun', 70, 165, 1], ['fence', 260, 228, 1.2], ['pot', 250, 190, 0.9, 'mended'], ['flower', 250, 152, 0.55, 3], ['cat', 340, 250, 1, { sleep: true }, 'happy'], ['kid', 110, 258, 1.25, k(UME), 'proud']], cap: 'Now it holds a flower on the fence, and the cat only watches from afar.', why: 'The mended pot now holds a flower, back where it started.' },
    ],
  },
  lantern: {
    name: 'Lantern Night',
    blurb: 'A string of paper lanterns and a lost little fox.',
    cards: [
      { sky: 'dusk', g: 'road', e: [['house', 70, 212, 1.1], ['house', 345, 212, 1.1], ['line', 40, 92, 1, 370, 92], ['lantern', 110, 104, 1.1, 'off'], ['lantern', 205, 100, 1.1, 'off'], ['lantern', 300, 104, 1.1, 'off'], ['ladder', 200, 262, 1], ['kid', 130, 258, 1.2, k(MIMI, { arms: 'up' }), 'happy']], cap: 'At dusk the street was strung with paper lanterns, but not one was lit.', why: 'The lanterns are dark and the sky is only starting to darken.' },
      { sky: 'night', g: 'road', e: [['house', 70, 212, 1.1, 'lit'], ['house', 345, 212, 1.1, 'lit'], ['line', 40, 92, 1, 370, 92], ['lantern', 110, 104, 1.1], ['lantern', 205, 100, 1.1], ['lantern', 300, 104, 1.1], ['kid', 200, 258, 1.2, k(MIMI, { arms: 'up' }), 'happy']], cap: 'Mimi lit them one by one, and the whole street began to glow.', why: 'The lanterns are lit now that it is night.' },
      { sky: 'night', g: 'road', e: [['house', 70, 212, 1.1, 'lit'], ['stall', 340, 232, 1.2], ['line', 40, 92, 1, 370, 92], ['lantern', 110, 104, 1.1], ['lantern', 205, 100, 1.1], ['lantern', 300, 104, 1.1], ['crowd', 190, 262, 1.2]], cap: 'Neighbours came out with warm buns and songs to see the glowing street.', why: 'People gather to enjoy the lanterns once they are lit.' },
      { sky: 'night', g: 'road', e: [['house', 70, 212, 1.1, 'lit'], ['line', 40, 92, 1, 370, 92], ['lantern', 110, 104, 1.1], ['lantern', 205, 100, 1.1], ['lantern', 300, 104, 1.1, 'off'], ['kid', 120, 258, 1.2, k(MIMI, { arms: 'out' }), 'wow'], ['fox', 310, 256, 1.1, { flip: true }, 'worry']], cap: 'But at the end of the street, a little fox sat shivering beside a dark lantern.', why: 'The crowd has gone home, and Mimi finds someone alone.', p: 1.0 },
      { sky: 'dawn', g: 'road', e: [['house', 70, 212, 1.1], ['line', 40, 92, 1, 370, 92], ['lantern', 110, 104, 1.1], ['lantern', 205, 100, 1.1], ['lantern', 300, 104, 1.1, 'off'], ['kid', 190, 258, 1.2, k(MIMI), 'sleep'], ['fox', 270, 258, 1.1, { flip: true }, 'sleep']], cap: 'By dawn the fox was warm and sleepy, curled up beside his new friend.', why: 'It is early morning and the two are asleep together.' },
    ],
  },
  snow: {
    name: 'The Snow Friend',
    blurb: 'A snowman built in the morning, gone by the spring.',
    cards: [
      { sky: 'snow', g: 'snow', e: [['pine', 335, 205, 1.1, 'snow'], ['snowman', 235, 256, 1.1, 0], ['kid', 130, 258, 1.25, k(KEN, { arms: 'out' }), 'happy']], cap: 'Snow fell all morning, and Ken began to roll a big snowball.', why: 'There is only a heap of snow, so building has just begun.' },
      { sky: 'snow', g: 'snow', e: [['pine', 335, 205, 1.1, 'snow'], ['snowman', 235, 256, 1.1, 1], ['kid', 130, 258, 1.25, k(KEN, { arms: 'up' }), 'happy']], cap: 'Then he lifted a smaller ball and set it on top.', why: 'Two snowballs are stacked, but there is no face yet.' },
      { sky: 'snow', g: 'snow', e: [['pine', 335, 205, 1.1, 'snow'], ['snowman', 235, 256, 1.1, 2], ['kid', 130, 258, 1.25, k(KEN, { arms: 'up' }), 'proud']], cap: 'Coal eyes, a carrot nose and a red scarf: the snow friend was done.', why: 'The snowman has a face and a scarf, so he is finished.' },
      { sky: 'night', g: 'snow', e: [['moon', 320, 52, 1], ['pine', 335, 205, 1.1, 'snow'], ['snowman', 235, 256, 1.1, 2], ['bird', 150, 262, 0.9, 'sleep']], cap: 'That night the moon kept watch while everyone in the village slept.', why: 'It is night and the snowman stands alone.' },
      { sky: 'day', g: 'snow', e: [['sun', 200, 48, 1.2], ['pine', 335, 205, 1.1, 'snow'], ['snowman', 235, 256, 1.1, 3], ['scarf', 195, 258, 1.1], ['kid', 120, 258, 1.25, k(KEN, { look: 1 }), 'sad']], cap: 'The next warm noon the sun was kind, and the snow friend slowly melted away.', why: 'The sun is high and only a puddle and a scarf are left.', p: 0.8 },
      { sky: 'day', g: 'grass', e: [['sun', 330, 48, 0.9], ['tree', 330, 205, 1.3, 'blossom'], ['flower', 235, 258, 1, 3], ['kid', 130, 258, 1.25, k(KEN, { arms: 'up' }), 'happy']], cap: 'In spring a flower grew where he had stood, and Ken wore the red scarf again.', why: 'The grass has come back and a flower stands where the snowman was.' },
    ],
  },
  boat: {
    name: 'The Paper Boat',
    blurb: 'A folded boat travels all the way to the sea.',
    cards: [
      { sky: 'day', g: 'water', e: [['sun', 340, 46, 0.9], ['cloud', 120, 46, 1], ['hill', 60, 300, 1, '#86cc6e'], ['kid', 70, 240, 1.15, k(SORA, { arms: 'out' }), 'happy'], ['boat', 190, 205, 0.9, 'paper']], cap: 'Sora folded a paper boat and set it gently on the river.', why: 'The boat is close to the bank, just launched.' },
      { sky: 'day', g: 'water', e: [['sun', 340, 46, 0.9], ['cloud', 120, 46, 1], ['hill', 60, 300, 1, '#86cc6e'], ['kid', 60, 240, 1.15, k(SORA, { arms: 'up' }), 'wow'], ['bridge', 270, 160, 1.3], ['boat', 270, 185, 0.8, 'paper']], cap: 'The current carried it away, right under the red bridge.', why: 'The boat is now at the bridge, further from Sora.' },
      { sky: 'day', g: 'water', e: [['sun', 340, 46, 0.9], ['hill', 60, 300, 1, '#86cc6e'], ['kid', 60, 240, 1.15, k(SORA), 'worry'], ['reed', 310, 190, 1.2], ['reed', 365, 190, 1.2], ['boat', 338, 192, 0.8, 'paper']], cap: 'But it snagged among the reeds, and Sora could only watch.', why: 'The boat is stuck in the reeds near the far bank.', p: 1.0 },
      { sky: 'day', g: 'water', e: [['sun', 340, 46, 0.9], ['cloud', 220, 40, 1], ['hill', 60, 300, 1, '#86cc6e'], ['kid', 60, 240, 1.15, k(SORA, { arms: 'up' }), 'happy'], ['reed', 355, 190, 1.2], ['fish', 270, 212, 1.2], ['boat', 265, 190, 0.8, 'paper']], cap: 'A friendly carp nudged it free and sent it spinning back to the current.', why: 'The boat is out of the reeds again, with a fish beside it.' },
      { sky: 'dusk', g: 'water', e: [['sun', 340, 135, 1], ['boat', 280, 170, 0.6, 'paper']], cap: 'It drifted on toward the sea as the sun went down.', why: 'It is sunset and the boat has gone far away.' },
      { sky: 'night', g: 'water', e: [['moon', 300, 52, 1.1], ['boat', 200, 192, 1, 'paper'], ['lantern', 200, 140, 0.6]], cap: 'At night, beneath a thousand stars, the little boat sailed on alone.', why: 'The night is the end of the journey.' },
    ],
  },
  egg: {
    name: 'The Egg on the Hill',
    blurb: 'A runaway egg, a warm basket and a surprise at sunrise.',
    cards: [
      { sky: 'dawn', g: 'hill', e: [['nest', 100, 205, 1.2], ['egg', 100, 196, 0.9, 0], ['bird', 160, 218, 1.3, 'happy']], cap: 'On a misty morning a sparrow guarded her one speckled egg in a nest.', why: 'The egg is safe in the nest at the start of the day.' },
      { sky: 'day', g: 'hill', e: [['sun', 340, 46, 0.9], ['nest', 80, 195, 1.2], ['bird', 120, 140, 1.2, { fly: true }, 'wow'], ['egg', 230, 258, 0.9, 0]], cap: 'A gust tipped the nest over, and the egg rolled all the way down the hill.', why: 'The nest is empty and the egg is on the ground far below.', p: 0.8 },
      { sky: 'day', g: 'hill', e: [['sun', 340, 46, 0.9], ['rock', 320, 252, 1.2], ['egg', 285, 258, 0.9, 0], ['kid', 130, 258, 1.25, k(YUKI, { arms: 'out' }), 'wow']], cap: 'Yuki found it resting safely against a warm stone.', why: 'A girl discovers the egg after it has rolled.' },
      { sky: 'night', g: 'hill', e: [['moon', 320, 52, 1], ['basket', 205, 258, 1.3, 'egg'], ['kid', 100, 258, 1.25, k(YUKI), 'sleep']], cap: 'She tucked it in a basket and kept it warm through the night.', why: 'The egg is in a basket at night, so the girl has taken it in.' },
      { sky: 'dawn', g: 'hill', e: [['basket', 205, 258, 1.3], ['egg', 205, 236, 1.2, 1], ['kid', 100, 258, 1.25, k(YUKI, { arms: 'out' }), 'wow']], cap: 'At sunrise there came a tap, tap, tap, and a crack ran across the shell.', why: 'The shell is cracked at sunrise: the chick is about to hatch.', p: 1.0 },
      { sky: 'day', g: 'hill', e: [['sun', 340, 46, 0.9], ['egg', 205, 258, 1.4, 2], ['bird', 320, 252, 1.3, { flip: true }, 'happy'], ['kid', 100, 258, 1.25, k(YUKI, { arms: 'up' }), 'happy']], cap: 'Out peeped a little chick, and its mother came flying back to the hill.', why: 'The chick is out of the shell and its mother has come back.' },
    ],
  },
  drum: {
    name: 'The Festival Drum',
    blurb: 'A wobbly beginner, a wise old turtle and a night of lanterns.',
    cards: [
      { sky: 'dawn', g: 'road', e: [['cart', 250, 258, 1.2], ['drum', 250, 224, 0.9], ['kid', 120, 258, 1.25, k(DAI, { arms: 'out' }), 'wow']], cap: 'At dawn Daichi found an old drum waiting on a farmer\'s cart.', why: 'He has only just found the drum.' },
      { sky: 'day', g: 'road', e: [['sun', 340, 46, 0.9], ['house', 70, 212, 1.1], ['drum', 235, 258, 1.2, 'hit'], ['kid', 150, 258, 1.25, k(DAI, { arms: 'up' }), 'sad'], ['cat', 340, 250, 1, { flip: true }, 'sad']], cap: 'His first beats were loud and wobbly, and even the cat winced.', why: 'He is a beginner: the first try sounds bad.' },
      { sky: 'day', g: 'road', e: [['sun', 340, 46, 0.9], ['drum', 220, 258, 1.2, 'hit'], ['turtle', 320, 258, 1.2, { flip: true }, 'happy'], ['kid', 130, 258, 1.25, k(DAI, { arms: 'up' }), 'happy']], cap: 'A wise old turtle taught him to listen to his own heartbeat before every stroke.', why: 'A teacher appears after the bad first try.' },
      { sky: 'night', g: 'road', e: [['moon', 320, 52, 1], ['drum', 230, 258, 1.2, 'hit'], ['firefly', 160, 160, 1], ['kid', 130, 258, 1.25, k(DAI, { arms: 'up' }), 'proud']], cap: 'He practised every night until the beats were as steady as falling rain.', why: 'Nights of practice follow the lesson.' },
      { sky: 'day', g: 'road', e: [['sun', 340, 46, 0.9], ['line', 20, 84, 1, 380, 84], ['lantern', 90, 98, 1.1], ['lantern', 200, 94, 1.1], ['lantern', 310, 98, 1.1], ['stall', 80, 230, 1.3], ['crowd', 280, 262, 1.2]], cap: 'On festival day the whole village gathered beneath hanging lanterns.', why: 'The big day arrives, with the village gathered.' },
      { sky: 'dusk', g: 'road', e: [['sun', 60, 170, 1], ['line', 20, 84, 1, 380, 84], ['lantern', 90, 98, 1.1], ['lantern', 200, 94, 1.1], ['lantern', 310, 98, 1.1], ['drum', 150, 258, 1.5, 'hit'], ['kid', 80, 258, 1.2, k(DAI, { arms: 'up' }), 'proud'], ['crowd', 300, 262, 1.1]], cap: 'Daichi drummed the opening beat, and the crowd began to clap along.', why: 'Evening comes and he plays in front of everyone.' },
      { sky: 'night', g: 'road', e: [['moon', 320, 52, 1], ['line', 20, 84, 1, 380, 84], ['lantern', 90, 98, 1.1], ['lantern', 200, 94, 1.1], ['lantern', 310, 98, 1.1], ['firefly', 200, 170, 1], ['cat', 100, 252, 1, { sleep: true }, 'happy'], ['turtle', 180, 258, 1, 'happy'], ['kid', 270, 258, 1.2, k(DAI), 'happy']], cap: 'The festival lasted far into the night, and even the cat purred.', why: 'The last scene is deep night after the show.' },
    ],
  },
  road: {
    name: 'The Long Road to the Sea',
    blurb: 'A girl, a fox and a journey from the hills to the water.',
    cards: [
      { sky: 'dawn', g: 'road', e: [['house', 90, 212, 1.2, 'lit'], ['basket', 260, 256, 1.1], ['kid', 190, 258, 1.25, k(NORI, { arms: 'hold' }), 'happy']], cap: 'Before dawn Nori packed a basket and set off for the faraway sea.', why: 'The journey starts from her own front door.' },
      { sky: 'day', g: 'water', e: [['sun', 340, 46, 0.9], ['cloud', 100, 46, 1], ['bridge', 200, 170, 1.6], ['kid', 200, 128, 0.85, k(NORI, { walk: true }), 'happy']], cap: 'She crossed the red bridge over the shining river.', why: 'A bridge is the first obstacle after leaving home.' },
      { sky: 'day', g: 'hill', e: [['mountain', 300, 176, 1.2], ['pine', 320, 220, 1.2], ['pine', 365, 230, 1], ['sign', 235, 252, 1], ['kid', 110, 256, 1.2, k(NORI, { walk: true }), 'happy']], cap: 'The path climbed through the pine woods, higher and higher.', why: 'After the bridge she climbs into the hills.' },
      { sky: 'day', g: 'hill', e: [['sun', 340, 46, 0.9], ['tree', 350, 215, 1.2, 'green'], ['kid', 120, 256, 1.2, k(NORI, { arms: 'out' }), 'happy'], ['riceball', 205, 252, 1.2], ['fox', 280, 256, 1.1, { flip: true }, 'happy']], cap: 'A hungry fox watched her, so she shared her rice ball with him.', why: 'She meets the fox on the road and makes a friend.' },
      { sky: 'rain', g: 'hill', e: [['tree', 240, 212, 1.6, 'green'], ['kid', 190, 256, 1.2, k(NORI, { look: 2 }), 'worry'], ['fox', 300, 256, 1.1, { flip: true }, 'worry']], cap: 'Rain came pouring down, and they sheltered together under a big old tree.', why: 'The fox is with her now and the weather turns.' },
      { sky: 'dusk', g: 'hill', e: [['sun', 330, 150, 1], ['tent', 275, 240, 1.2], ['campfire', 170, 256, 1.2], ['kid', 80, 256, 1.2, k(NORI, { arms: 'out' }), 'happy'], ['fox', 215, 256, 1, { flip: true }, 'proud']], cap: 'At dusk they lit a small fire and shared a cup of warm tea.', why: 'Evening: they have stopped for the night.' },
      { sky: 'night', g: 'hill', e: [['moon', 330, 50, 1], ['lantern', 90, 190, 0.5], ['lantern', 150, 198, 0.5], ['lantern', 240, 192, 0.5], ['lantern', 310, 200, 0.5], ['kid', 150, 256, 1.2, k(NORI, { look: 2 }), 'wow'], ['fox', 230, 258, 1.1, { flip: true }, 'wow']], cap: 'Beneath a million stars they saw tiny lights far below, where the land ended.', why: 'Deep night comes after the camp and shows the town by the sea.' },
      { sky: 'dawn', g: 'water', e: [['sun', 200, 138, 1.3], ['hill', 60, 300, 1, '#f2dfab'], ['boat', 340, 192, 1], ['kid', 80, 236, 1.2, k(NORI, { arms: 'up' }), 'proud'], ['fox', 150, 240, 1.1, 'proud']], cap: 'At sunrise the sea opened out before them, wide and bright and blue.', why: 'The final card: the journey ends at the sea at the next sunrise.' },
    ],
  },
};

export const STORY_IDS = ['kite', 'seed', 'rain', 'pot', 'lantern', 'snow', 'boat', 'egg', 'drum', 'road'];
export const CHAPTERS = [
  { id: 'corner', name: 'Street Corner', tales: ['kite', 'seed'], blurb: 'Four cards each: the gentlest tales.' },
  { id: 'lane', name: 'Market Lane', tales: ['rain', 'pot', 'lantern'], blurb: 'Five cards, weather and surprises.' },
  { id: 'river', name: 'Riverside', tales: ['snow', 'boat', 'egg'], blurb: 'Six cards: small changes to spot.' },
  { id: 'road', name: 'Festival Road', tales: ['drum', 'road'], blurb: 'Seven and eight cards: the long tales.' },
];
export const TIERS = ['Gentle', 'Steady', 'Master'];
export const TIER_TEXT = ['First and last cards placed. The show cannot fail.', 'Every card is yours to place.', 'Short clues on the card backs and a stricter audience.'];

// Reading time of a card's line, in seconds (also the beat of its pull ring).
export function beatFor(card) {
  const words = card.cap.split(' ').length;
  return Math.round((1.7 + 0.3 * words + (card.p ?? 0)) * 10) / 10;
}
export function captionFor(card, tier) {
  if (tier < 2) return card.cap;
  const w = card.cap.split(' ');
  if (w.length <= 6) return card.cap;
  return `${w.slice(0, Math.ceil(w.length * 0.45)).join(' ')} ...`;
}
export const parTries = (n) => Math.max(2, Math.ceil(n / 3));
