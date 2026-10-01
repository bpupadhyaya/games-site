// All player-facing text, in English and Chinese (Simplified). Language is a real, visible choice
// (title screen chips + Settings); the two are never mixed on one screen except the title's own
// "Tangram / 七巧板" name plate.

export const LANGS = ['en', 'zh'];

export const STR = {
  playBtn: { en: 'Play', zh: '开始游戏' },
  dailyBtn: { en: 'Daily Puzzle', zh: '每日挑战' },
  autoBtn: { en: 'Watch & Learn', zh: '观看学习' },
  howtoBtn: { en: 'How to Play', zh: '玩法说明' },
  rulesBtn: { en: 'Rules', zh: '规则详解' },
  aboutBtn: { en: 'About', zh: '关于' },
  settingsBtn: { en: 'Settings', zh: '设置' },
  back: { en: 'Back', zh: '返回' },
  menu: { en: 'Menu', zh: '菜单' },
  levels: { en: 'Levels', zh: '关卡' },
  next: { en: 'Next', zh: '下一页' },
  prev: { en: 'Previous', zh: '上一页' },
  nextLevel: { en: 'Next Level', zh: '下一关' },
  replay: { en: 'Play Again', zh: '再玩一次' },
  hint: { en: 'Hint', zh: '提示' },
  undo: { en: 'Undo', zh: '撤销' },
  reset: { en: 'Reset', zh: '重置' },
  rotL: { en: 'Left', zh: '左转' },
  rotR: { en: 'Right', zh: '右转' },
  flip: { en: 'Flip', zh: '翻转' },
  resume: { en: 'Resume', zh: '继续' },
  paused: { en: 'Paused', zh: '已暂停' },
  restartLevel: { en: 'Restart Level', zh: '重新开始本关' },
  quitMenu: { en: 'Main Menu', zh: '主菜单' },
  levelWord: { en: 'Level', zh: '第' },
  solved: { en: 'Solved!', zh: '完成！' },
  stars3: { en: 'Perfect: no hints used.', zh: '完美：没有使用提示。' },
  stars2: { en: 'Great: only a little help.', zh: '很棒：只用了一点提示。' },
  stars1: { en: 'Solved. Try again without hints for three stars.', zh: '已完成。不用提示再试一次可得三星。' },
  locked: { en: 'Solve 8 puzzles in the previous chapter to unlock this one.', zh: '先完成上一章中的 8 道题即可解锁本章。' },
  chapter: { en: 'Chapter', zh: '章节' },
  stars: { en: 'Stars', zh: '星星' },
  solvedCount: { en: 'Solved', zh: '已完成' },
  soundOn: { en: 'Sound: On', zh: '声音：开' },
  soundOff: { en: 'Sound: Off', zh: '声音：关' },
  glowOn: { en: 'Fit glow: On', zh: '贴合提示光：开' },
  glowOff: { en: 'Fit glow: Off', zh: '贴合提示光：关' },
  textSize: { en: 'Text size', zh: '文字大小' },
  thinkTime: { en: 'Watch & Learn think time', zh: '观看学习的思考时间' },
  seconds: { en: 's', zh: ' 秒' },
  language: { en: 'Language', zh: '语言' },
  restore: { en: 'Restore Purchases', zh: '恢复购买' },
  unlock: { en: 'Unlock Full Game', zh: '解锁完整游戏' },
  resetProgress: { en: 'Erase All Progress', zh: '清除全部进度' },
  resetConfirm: { en: 'Tap again to erase all progress', zh: '再点一次确认清除全部进度' },
  owned: { en: 'Full game unlocked. Thank you!', zh: '已解锁完整游戏，谢谢支持！' },
  dailyDone: { en: 'Daily puzzle solved!', zh: '每日挑战完成！' },
  dailyStreak: { en: 'Daily streak', zh: '连续天数' },
  dailyTitle: { en: 'Daily Puzzle', zh: '每日挑战' },
  dailyLocked: { en: 'Daily puzzles are in the full game.', zh: '每日挑战在完整版中提供。' },
  hintMsg: { en: 'Try the {p} here', zh: '试试把{p}放在这里' },
  hintPlaced: { en: 'Here is the {p}', zh: '这是{p}的位置' },
  nothingUndo: { en: 'Nothing to undo', zh: '没有可撤销的操作' },
  tapRotate: { en: 'Tap again to turn it', zh: '再点一下可旋转' },
  tipDrag: { en: 'Drag a piece onto the shape', zh: '把板块拖到图形上' },
  autoThink: { en: 'Thinking…', zh: '思考中…' },
  autoReveal: { en: 'Here is the next move', zh: '下一步在这里' },
  autoAct: { en: 'Placing the piece', zh: '正在放置' },
  autoDone: { en: 'Puzzle complete', zh: '拼图完成' },
  autoPause: { en: 'Pause', zh: '暂停' },
  autoPlay: { en: 'Resume', zh: '继续' },
  autoExit: { en: 'Exit', zh: '退出' },
  autoSlower: { en: 'Think -', zh: '思考 -' },
  autoFaster: { en: 'Think +', zh: '思考 +' },
  autoSession: { en: 'Watch & Learn', zh: '观看学习' },
  autoAgain: { en: 'Watch Again', zh: '再看一遍' },
  autoSummary: { en: 'You watched three puzzles solved step by step.', zh: '你看完了三道拼图的逐步解法。' },
  demoLimitTitle: { en: 'FREE PREVIEW FINISHED', zh: '免费试玩已结束' },
  demoLimitBody: { en: 'You solved the six free puzzles. Get the full game on iPhone and Android for all chapters, the daily puzzle and the thirteen convex shapes.', zh: '你已完成六道免费题。在 iPhone 和安卓上获取完整版，畅玩全部章节、每日挑战和十三凸形。' },
  demoLeft: { en: '{n} free puzzles left', zh: '还剩 {n} 道免费题' },
  pieceL: { en: 'large triangle', zh: '大三角形' },
  pieceM: { en: 'medium triangle', zh: '中三角形' },
  pieceS: { en: 'small triangle', zh: '小三角形' },
  pieceSQ: { en: 'square', zh: '正方形' },
  piecePA: { en: 'parallelogram', zh: '平行四边形' },
  mysteryShape: { en: 'Mystery shape', zh: '神秘图形' },
  convexTitle: { en: 'Convex shape', zh: '凸形' },
  langPrompt: { en: 'English', zh: '中文' },
  tagline: { en: 'Seven pieces. Endless shapes.', zh: '七块板，千变万化。' },
  best: { en: 'Best', zh: '最佳' },
};

export function tr(lang, key, vars) {
  const e = STR[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

export const CHAPTERS = [
  { en: 'First Steps', zh: '初试牛刀', blurb: { en: 'Guide lines show where every piece goes.', zh: '图中会显示每块板的位置线。' } },
  { en: 'Animals', zh: '飞禽走兽', blurb: { en: 'Birds, beasts and sea creatures.', zh: '飞禽、走兽和海洋生物。' } },
  { en: 'People', zh: '人物百态', blurb: { en: 'Figures running, bowing and dancing.', zh: '奔跑、鞠躬、起舞的人物。' } },
  { en: 'Home & Objects', zh: '居家器物', blurb: { en: 'Things from the house and the market.', zh: '家中与集市上的器物。' } },
  { en: 'Land, Sea & Sky', zh: '山水舟车', blurb: { en: 'Vehicles, boats and the natural world.', zh: '车船飞机与大自然。' } },
  { en: 'Letters & Shapes', zh: '字母图形', blurb: { en: 'Bold letters and geometric figures.', zh: '粗体字母与几何图形。' } },
  { en: 'Masters', zh: '大师之路', blurb: { en: 'The thirteen convex shapes: no dents, no clues.', zh: '十三种凸形：没有凹口，没有提示。' } },
];

export const HOWTO = {
  en: [
    { title: 'The goal', body: 'Cover the dark silhouette completely with the seven pieces. Pieces may not overlap and may not leave gaps.' },
    { title: 'Move a piece', body: 'Put one finger on a piece and drag it onto the silhouette. It lifts while you hold it. When you let go near a corner, it clicks into place.' },
    { title: 'Turn a piece', body: 'Tap a piece to select it. Tap the selected piece again to turn it a quarter of a quarter-turn (45 degrees). Or use the Left and Right buttons, or drag the round handle in a circle.' },
    { title: 'Flip a piece', body: 'The parallelogram has a mirror image that is not the same as itself. Select it and press Flip to mirror it. The other pieces look the same when flipped.' },
    { title: 'Need help?', body: 'Press Hint once to see which piece goes where. Press Hint again to see it placed. Three stars means no hints at all.' },
    { title: 'Keep going', body: 'Solve eight puzzles in a chapter to open the next. A new Daily Puzzle arrives every day, and Watch & Learn solves a puzzle for you step by step.' },
  ],
  zh: [
    { title: '目标', body: '用七块板把深色轮廓完全盖住。板块之间不能重叠，也不能留下空隙。' },
    { title: '移动板块', body: '用手指按住一块板，把它拖到轮廓上。按住时它会浮起。在角点附近松手，它会“咔”地贴合到位。' },
    { title: '旋转板块', body: '点一下板块即可选中，再点一下已选中的板块，它会转 45 度。也可以用“左转”“右转”按钮，或沿圆圈拖动圆形把手。' },
    { title: '翻转板块', body: '平行四边形的镜像与它本身不同。选中它并按“翻转”即可镜像。其他板块翻转后看起来完全一样。' },
    { title: '需要帮助？', body: '按一次“提示”，会显示该放哪一块、放在哪里。再按一次，板块会自动放好。不用任何提示可得三星。' },
    { title: '继续前进', body: '完成一章中的 8 道题即可开启下一章。每天都有新的每日挑战，“观看学习”会一步一步为你演示解法。' },
  ],
};

export const ABOUT = {
  en: [
    { title: 'Tangram: Seven Pieces', body: 'The tangram, called qiqiaoban or "seven boards of skill" in Chinese, is a dissection puzzle that began in China and spread around the world. A square is cut into seven flat pieces, and the fun is in arranging them into thousands of shapes.' },
    { title: 'What is in the game', body: '83 hand-checked silhouettes in seven chapters, from guided first steps to the thirteen convex shapes, plus a new Daily Puzzle every day. Every silhouette is built from the seven real pieces, so each one can be solved.' },
    { title: 'Made to feel good', body: 'Pieces lift, turn and click into place. A hint shows you the next move, and Watch & Learn plays a whole puzzle for you with time to think. Everything works offline, with no timers and no ads. Text can be enlarged to 300 percent and the whole game is available in English and Chinese.' },
  ],
  zh: [
    { title: '七巧板', body: '七巧板是一种起源于中国、流传世界各地的拼图游戏。把一个正方形切成七块平板，再把它们拼成成千上万种图形，乐趣就在于排列组合。' },
    { title: '游戏内容', body: '七个章节共 83 道人工校验过的剪影，从有提示线的入门题到十三种凸形，另有每天一道的每日挑战。每个剪影都由真正的七块板拼成，所以每一题都有解。' },
    { title: '手感与功能', body: '板块会浮起、旋转并“咔”地贴合。提示会告诉你下一步，“观看学习”会留出思考时间，为你完整演示一道题。全部内容可离线游玩，没有计时，没有广告。文字可放大到 300%，整个游戏提供英文和中文。' },
  ],
};

// Rules pages are written against the engine (geom.js / puzzle.js). `art` names an illustration that
// view.js draws with the game's own piece drawing.
export const RULES = {
  en: [
    { art: 'pieces', title: 'The seven pieces', body: [
      'There are always exactly seven pieces, and every puzzle uses all of them: two large triangles, one medium triangle, two small triangles, one square and one parallelogram.',
      'All triangles are right-angled and isosceles. If the small triangle has legs of 1, the medium has legs of 1.41, the large has legs of 2, the square has sides of 1 and the parallelogram has sides of 1 and 1.41.',
      'Together the seven pieces always cover the same area: they can be packed into a perfect square.' ] },
    { art: 'target', title: 'The goal', body: [
      'Every puzzle shows a dark silhouette. You win when the seven pieces fill it exactly: all seven are inside the silhouette and no two overlap.',
      'The game checks the real geometry, not a stored answer. Swapping the two large triangles, or the two small ones, or any other valid arrangement, counts just as much.',
      'There is no time limit and no move limit.' ] },
    { art: 'drag', title: 'Moving pieces', body: [
      'Pieces start on the wooden tray. Drag any piece with one finger or the mouse; a piece lifts above your fingertip while held, so you can always see it, and follows your finger.',
      'You can pick up a piece again at any time, including pieces already on the board, and drop it anywhere on the screen.' ] },
    { art: 'snap', title: 'Snapping', body: [
      'When you let go, the piece clicks to the closest tidy position if one of its corners is within about the width of a fingertip (roughly 5 millimetres on a phone screen) of a corner of the silhouette, of the solution, or of another piece.',
      'The click only happens when it does not make things worse: a snap that would push the piece mostly outside the silhouette or on top of other pieces is ignored.',
      'Rotations always settle on multiples of 45 degrees.' ] },
    { art: 'rotate', title: 'Turning pieces', body: [
      'Tap a piece to select it. Tapping the selected piece again turns it 45 degrees clockwise.',
      'The Left and Right buttons turn the selected piece 45 degrees either way. The round handle above the selected piece can be dragged around it for free turning; when you let go it settles on the nearest 45 degrees.' ] },
    { art: 'flip', title: 'Flipping the parallelogram', body: [
      'The Flip button mirrors the selected piece left to right.',
      'Four of the seven shapes are their own mirror image once turned, so flipping them changes nothing. Only the parallelogram has a real mirror image, so it is the one piece you will sometimes need to flip.' ] },
    { art: 'glow', title: 'Fit glow and guide lines', body: [
      'In most chapters a piece glows softly when it lies completely inside the silhouette and overlaps nothing. The glow means "this piece is in a legal spot", not "this is the only answer". You can switch it off in Settings.',
      'The first chapter also draws faint guide lines showing where each piece goes. The Masters chapter has neither glow nor guide lines.' ] },
    { art: 'hint', title: 'Hints', body: [
      'Press Hint once: the next piece to place pulses, and the spot where it belongs lights up. Press Hint again to have that piece placed for you.',
      'The hint picks the largest open spot that touches the pieces already placed. Every press of Hint counts as one hint.' ] },
    { art: 'stars', title: 'Stars', body: [
      'Three stars: solved with no hints. Two stars: one or two hint presses. One star: three or more hint presses.',
      'Your best result for each puzzle is kept. Undo and Reset never cost stars.' ] },
    { art: 'undo', title: 'Undo and Reset', body: [
      'Undo takes back your last move, turn or flip. You can keep pressing it to go back step by step.',
      'Reset sends all seven pieces back to the tray. You can Undo a reset.' ] },
    { art: 'chapters', title: 'Chapters', body: [
      'There are seven chapters. Solve eight puzzles in a chapter to open the next one; inside a chapter every puzzle is open from the start.',
      'First Steps, Animals, People, Home and Objects, and Land, Sea and Sky have twelve puzzles each, Letters and Shapes has ten, and Masters has thirteen.' ] },
    { art: 'masters', title: 'The thirteen convex shapes', body: [
      'In 1942 two mathematicians proved that exactly thirteen different convex shapes (shapes with no dents) can be made from the seven pieces. All thirteen are in the Masters chapter, from a triangle to the square.',
      'Masters puzzles have no guide lines and no fit glow, and the pieces start turned and flipped.' ] },
    { art: 'daily', title: 'Daily Puzzle', body: [
      'Each day a fresh silhouette is built by joining the seven pieces edge to edge, then checked to be solvable, connected and free of holes and thin slits. Everyone with the same date gets the same shape.',
      'Solve it to extend your streak. A new puzzle appears at midnight UTC.' ] },
    { art: 'auto', title: 'Watch & Learn', body: [
      'Watch & Learn plays three puzzles by itself using each puzzle\'s stored solution. For each piece it first thinks (you choose 2, 5, 8 or 10 seconds), then reveals the move by lighting the piece and its spot for 2 seconds, then places it.',
      'Pause freezes everything exactly where it is and Resume carries on. Watch & Learn is free everywhere and never changes your progress.' ] },
    { art: 'demo', title: 'Free preview', body: [
      'The web preview contains the first six puzzles of the first chapter. The full game on iPhone and Android has everything described here, and works offline.' ] },
  ],
  zh: [
    { art: 'pieces', title: '七块板', body: [
      '每道题都恰好使用七块板，而且必须全部用上：两块大三角形、一块中三角形、两块小三角形、一块正方形和一块平行四边形。',
      '所有三角形都是等腰直角三角形。若小三角形的直角边为 1，则中三角形为 1.41，大三角形为 2，正方形边长为 1，平行四边形的边长为 1 和 1.41。',
      '七块板的总面积固定不变，它们可以拼成一个完整的正方形。' ] },
    { art: 'target', title: '目标', body: [
      '每道题都会给出一个深色剪影。当七块板恰好填满它时就过关：七块板全部位于剪影内，并且任何两块都不重叠。',
      '游戏检查的是真实的几何关系，而不是对照标准答案。交换两块大三角形、两块小三角形，或任何其他有效拼法，都同样算数。',
      '没有时间限制，也没有步数限制。' ] },
    { art: 'drag', title: '移动板块', body: [
      '板块一开始放在木盘里。用一根手指或鼠标拖动任意板块；按住时板块会浮在指尖上方，让你始终看得见，并跟随手指移动。',
      '你可以随时再次拿起板块，包括已经放在盘面上的板块，并把它放到屏幕上的任何位置。' ] },
    { art: 'snap', title: '吸附', body: [
      '松手时，如果板块的某个角离剪影的角、答案的角或其他板块的角在大约一根指尖宽度（手机屏幕上约 5 毫米）以内，它会“咔”地吸附到最近的整齐位置。',
      '只有在不会变得更糟时才会吸附：如果吸附会让板块大部分跑到剪影外或压在其他板块上，就不会吸附。',
      '旋转角度最终总是 45 度的整数倍。' ] },
    { art: 'rotate', title: '旋转板块', body: [
      '点一下板块即可选中。再点一下已选中的板块，它会顺时针转 45 度。',
      '“左转”“右转”按钮会让选中的板块向两个方向各转 45 度。选中板块上方的圆形把手可以绕板块拖动，自由旋转；松手后会停在最近的 45 度位置。' ] },
    { art: 'flip', title: '翻转平行四边形', body: [
      '“翻转”按钮会把选中的板块左右镜像。',
      '七块板中有四种形状旋转后与自己的镜像完全相同，翻转它们没有任何变化。只有平行四边形有真正不同的镜像，所以它是唯一偶尔需要翻转的板块。' ] },
    { art: 'glow', title: '贴合光与提示线', body: [
      '在大多数章节中，当板块完全位于剪影内并且没有与任何板块重叠时，它会发出柔和的光。光的意思是“这块板位置合法”，而不是“这是唯一答案”。可以在设置中关闭。',
      '第一章还会绘制浅色的提示线，显示每块板的位置。大师章既没有光，也没有提示线。' ] },
    { art: 'hint', title: '提示', body: [
      '按一次“提示”：下一块要放的板会闪动，它该去的位置会亮起。再按一次，这块板会自动为你放好。',
      '提示会选择与已放板块相邻的最大空位。每按一次“提示”都算一次提示。' ] },
    { art: 'stars', title: '星星', body: [
      '三星：没有使用提示。两星：按了一次或两次提示。一星：按了三次或更多次提示。',
      '每道题只保留你的最好成绩。撤销和重置不会扣星。' ] },
    { art: 'undo', title: '撤销与重置', body: [
      '“撤销”会取消上一步移动、旋转或翻转，可以连续按，一步步往回退。',
      '“重置”会把七块板全部送回木盘。重置也可以撤销。' ] },
    { art: 'chapters', title: '章节', body: [
      '共有七个章节。完成一章中的 8 道题即可开启下一章；章内的每道题一开始都是开放的。',
      '初试牛刀、飞禽走兽、人物百态、居家器物、山水舟车各有 12 题，字母图形有 10 题，大师之路有 13 题。' ] },
    { art: 'masters', title: '十三种凸形', body: [
      '1942 年，两位数学家证明：用这七块板恰好只能拼出十三种不同的凸形（没有凹口的图形）。这十三种都在大师章里，从三角形到正方形。',
      '大师章没有提示线和贴合光，板块一开始就是旋转并翻转过的。' ] },
    { art: 'daily', title: '每日挑战', body: [
      '每天会把七块板边对边连接，生成一个新的剪影，并检查它可解、连通，没有孔洞和细缝。同一天所有玩家得到相同的图形。',
      '完成它即可延长连续天数。新题在世界协调时午夜更新。' ] },
    { art: 'auto', title: '观看学习', body: [
      '“观看学习”会用每道题保存的答案，自动演示三道题。每一步先“思考”（可选 2、5、8 或 10 秒），再用 2 秒点亮要放的板和它的位置，然后放下。',
      '暂停会把一切冻结在原处，继续则从原处接着播放。“观看学习”在任何版本都免费，也不会改变你的进度。' ] },
    { art: 'demo', title: '免费试玩', body: [
      '网页试玩版包含第一章的前六道题。iPhone 和安卓上的完整版包含这里介绍的全部内容，并且可离线游玩。' ] },
  ],
};

// Level names (en, zh) per template key.
export const NAMES = {
  arrow: ['Arrow', '箭头'], house: ['House', '房屋'], kite: ['Kite', '风筝'], hat: ['Hat', '帽子'], mountain: ['Mountain', '山峰'],
  crown: ['Crown', '王冠'], heart: ['Heart', '爱心'], hourglass: ['Hourglass', '沙漏'], pinetree: ['Pine Tree', '松树'],
  boot: ['Boot', '靴子'], stairs: ['Stairs', '台阶'], crescent: ['Crescent Moon', '弯月'],
};

export const PIECE_SHORT = {
  en: ['Large', 'Large', 'Medium', 'Small', 'Small', 'Square', 'Parallelogram'],
  zh: ['大三角', '大三角', '中三角', '小三角', '小三角', '正方形', '平行四边形'],
};
