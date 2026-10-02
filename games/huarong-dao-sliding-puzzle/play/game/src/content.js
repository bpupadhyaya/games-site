// All player-facing text, in English and Chinese (Simplified). Language is a real, visible choice
// (title screen chips + Settings); the two are never mixed on one screen except the title's own name plate
// and the carved characters on the blocks.

export const LANGS = ['en', 'zh'];

export const STR = {
  playBtn: { en: 'Play', zh: '开始游戏' },
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
  think: { en: 'Think', zh: '思考' },
  undo: { en: 'Undo', zh: '撤销' },
  reset: { en: 'Restart', zh: '重来' },
  resume: { en: 'Resume', zh: '继续' },
  paused: { en: 'Paused', zh: '已暂停' },
  restartLevel: { en: 'Restart Level', zh: '重新开始本关' },
  quitMenu: { en: 'Main Menu', zh: '主菜单' },
  levelWord: { en: 'Level', zh: '第' },
  moves: { en: 'Moves', zh: '步数' },
  minimum: { en: 'Fewest possible', zh: '最少步数' },
  yourBest: { en: 'Your best', zh: '你的最佳' },
  solved: { en: 'Cao Cao is free!', zh: '突围成功！' },
  solvedIn: { en: 'Solved in {n} moves', zh: '用了 {n} 步' },
  perfect: { en: 'The fewest possible: a perfect solution!', zh: '已是最少步数：完美解法！' },
  newBest: { en: 'New best', zh: '新纪录' },
  stars3: { en: 'Three stars: within a quarter of the fewest moves, no Think.', zh: '三星：步数不超过最少步数的 1.25 倍，且没有使用思考。' },
  stars2: { en: 'Two stars. Fewer moves, and no Think, earns three.', zh: '两星。步数更少并且不用思考可得三星。' },
  stars1: { en: 'Solved. Try for fewer moves to earn more stars.', zh: '已完成。用更少的步数可得更多星星。' },
  locked: { en: 'Solve 6 levels in the previous chapter to unlock this one.', zh: '先完成上一章中的 6 关即可解锁本章。' },
  chapter: { en: 'Chapter', zh: '章节' },
  stars: { en: 'Stars', zh: '星星' },
  solvedCount: { en: 'Solved', zh: '已完成' },
  soundOn: { en: 'Sound: On', zh: '声音：开' },
  soundOff: { en: 'Sound: Off', zh: '声音：关' },
  textSize: { en: 'Text size', zh: '文字大小' },
  thinkTime: { en: 'Watch & Learn think time', zh: '观看学习的思考时间' },
  seconds: { en: 's', zh: ' 秒' },
  language: { en: 'Language', zh: '语言' },
  restore: { en: 'Restore Purchases', zh: '恢复购买' },
  unlock: { en: 'Unlock Full Game', zh: '解锁完整游戏' },
  resetProgress: { en: 'Erase All Progress', zh: '清除全部进度' },
  resetConfirm: { en: 'Tap again to erase all progress', zh: '再点一次确认清除全部进度' },
  owned: { en: 'Full game unlocked. Thank you!', zh: '已解锁完整游戏，谢谢支持！' },
  thinkMsg: { en: 'Move {n} here: {c} moves to go', zh: '把{n}移到这里：还需 {c} 步' },
  thinkAgain: { en: 'Press Think again to make the move', zh: '再按一次“思考”即可走这一步' },
  nothingUndo: { en: 'Nothing to undo', zh: '没有可撤销的操作' },
  tipDrag: { en: 'Slide a block into a gap', zh: '把方块滑入空位' },
  tipTap: { en: 'Tap a block to see where it can go', zh: '点一下方块可查看它能去哪里' },
  tipGoal: { en: 'Lead Cao Cao to the gate at the bottom', zh: '把曹操带到下方的关口' },
  stuck: { en: 'This block cannot move right now', zh: '这个方块现在动不了' },
  autoThink: { en: 'Thinking…', zh: '思考中…' },
  autoReveal: { en: 'Here is the next move', zh: '下一步在这里' },
  autoAct: { en: 'Sliding the block', zh: '正在滑动' },
  autoDone: { en: 'Level complete', zh: '本关完成' },
  autoPause: { en: 'Pause', zh: '暂停' },
  autoPlay: { en: 'Resume', zh: '继续' },
  autoExit: { en: 'Exit', zh: '退出' },
  autoSlower: { en: 'Think -', zh: '思考 -' },
  autoFaster: { en: 'Think +', zh: '思考 +' },
  autoSession: { en: 'Watch & Learn', zh: '观看学习' },
  autoAgain: { en: 'Watch Again', zh: '再看一遍' },
  autoSummary: { en: 'You watched three levels solved step by step with the fewest possible moves.', zh: '你看完了三关的逐步解法，每一关都用了最少步数。' },
  autoMove: { en: 'Move {a} of {b}', zh: '第 {a} 步，共 {b} 步' },
  demoLimitTitle: { en: 'FREE PREVIEW FINISHED', zh: '免费试玩已结束' },
  demoLimitBody: { en: 'You solved the six free levels. Get the full game on iPhone and Android for all four chapters and every layout, including the famous Heng Dao Li Ma.', zh: '你已完成六道免费关卡。在 iPhone 和安卓上获取完整版，畅玩全部四个章节和所有布局，包括著名的横刀立马。' },
  demoLeft: { en: '{n} free levels left', zh: '还剩 {n} 道免费关卡' },
  tagline: { en: 'Free the commander. Fewest moves wins.', zh: '护送主将突围，步数越少越好。' },
  best: { en: 'Best', zh: '最佳' },
  gate: { en: 'Gate', zh: '关口' },
};

export function tr(lang, key, vars) {
  const e = STR[key];
  let s = e ? (e[lang] ?? e.en) : key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

export const CHAPTERS = [
  { en: 'First Gate', zh: '初入关隘', blurb: { en: 'Gentle layouts to learn how the blocks slide.', zh: '用温和的布局熟悉方块的滑动。' } },
  { en: 'Past the Guards', zh: '过关斩将', blurb: { en: 'Tighter squeezes that ask you to plan ahead.', zh: '空间更紧，需要提前规划。' } },
  { en: 'The Long Defence', zh: '层层设防', blurb: { en: 'Long solutions where every block has a part.', zh: '解法漫长，每个方块都有作用。' } },
  { en: 'Masters of the Pass', zh: '关隘大师', blurb: { en: 'The hardest layouts, with the famous Heng Dao Li Ma.', zh: '最难的布局，包括著名的横刀立马。' } },
];

export const HOWTO = {
  en: [
    { title: 'The goal', body: 'Cao Cao, the big red block, is trapped inside the pass. Slide the other blocks out of the way and lead him to the gate at the bottom of the board. When he stands in the gate, you are free.' },
    { title: 'Slide a block', body: 'Put a finger on a block and drag it into an empty space. The block slides along the real route, around corners if it has room, and never through another block. Let go and it settles into its cell.' },
    { title: 'Tap to move', body: 'Tap a block to select it. Outlines show every place it can go. Tap an outline and the block slides there. Tap the block again, or an empty spot, to let go of it.' },
    { title: 'Think and Undo', body: 'Press Think and the game shows the best next move, and how many moves are left. Press Think again to make that move for you. Undo takes back your last move, one at a time, and Restart sets the level up again.' },
    { title: 'Moves and stars', body: 'Every level shows the fewest possible moves, found by checking every position. Finish close to that number for three stars. Solve six levels in a chapter to open the next.' },
    { title: 'Watch and learn', body: 'Watch & Learn on the menu solves three levels for you, move by move, with time to think and a clear look at each move before it is made. Pause it any time.' },
  ],
  zh: [
    { title: '目标', body: '大红色的方块是曹操，他被困在关隘之中。把其他方块挪开，把他带到棋盘下方的关口。当他站到关口上，就突围成功了。' },
    { title: '滑动方块', body: '用手指按住一个方块，把它拖进空位。方块会沿着真实的路线滑动，有空间时可以拐弯，但绝不会穿过别的方块。松手后它会落入格子。' },
    { title: '点一下就走', body: '点一下方块即可选中，所有能去的位置会显示轮廓。点一个轮廓，方块就会滑过去。再点一下该方块或空白处可以取消选择。' },
    { title: '思考与撤销', body: '按“思考”，游戏会显示最佳的下一步，以及还需多少步。再按一次“思考”，游戏会替你走这一步。“撤销”会一步一步取消你的上一步，“重来”会重新摆好本关。' },
    { title: '步数与星星', body: '每一关都会显示最少步数，这是检查过所有局面后得出的。用接近这个数的步数完成可得三星。完成一章中的 6 关即可开启下一章。' },
    { title: '观看学习', body: '菜单里的“观看学习”会一步一步为你解开三关，每一步之前都有思考时间，并清楚地展示这一步，之后才会走。随时可以暂停。' },
  ],
};

export const ABOUT = {
  en: [
    { title: 'Huarong Dao: Sliding Puzzle', body: 'Huarong Dao is the Chinese sliding-block puzzle known in the West as Klotski. It is named after the Huarong Pass of the Three Kingdoms story, where the general Cao Cao slips away through a narrow road guarded by his enemies. Its best-known layout is called Heng Dao Li Ma, "the blade across, the horse upright".' },
    { title: 'What is in the game', body: '32 layouts in four chapters, from gentle first puzzles to the hardest positions of the classic set, with the fewest possible moves for every one worked out by checking every position. Think shows a real best move, Undo is unlimited and Watch & Learn plays whole levels for you.' },
    { title: 'Made to feel good', body: 'Blocks are carved lacquer with the generals\' names engraved on them. They slide, turn corners and settle with a soft knock. Everything works offline, with no timers and no ads. Text can be enlarged to 300 percent and the whole game is available in English and Chinese.' },
  ],
  zh: [
    { title: '华容道', body: '华容道是源自中国的滑块拼图，西方称之为 Klotski。它的名字来自三国故事里的华容道：曹操从被敌人把守的小路中脱身。最著名的布局叫作“横刀立马”。' },
    { title: '游戏内容', body: '四个章节共 32 个布局，从温和的入门关到经典棋局里最难的局面。每一关的最少步数都是通过检查所有局面算出的。“思考”会给出真正的最佳一步，撤销没有次数限制，“观看学习”会为你完整演示整关。' },
    { title: '手感与功能', body: '方块是雕刻的漆木，上面刻着将领的名字。它们滑动、拐弯，并带着轻轻的“笃”声落定。全部内容可离线游玩，没有计时，没有广告。文字可放大到 300%，整个游戏提供英文和中文。' },
  ],
};

// Rules pages are written against the engine (engine.js / puzzle.js). `art` names an illustration that
// view.js draws with the game's own block drawing.
export const RULES = {
  en: [
    { art: 'board', title: 'The board and the blocks', body: [
      'The board is a grid of 4 columns and 5 rows: 20 cells. Every layout uses ten blocks and leaves two cells empty; a few gentle layouts have more room.',
      'There is one 2 by 2 block (Cao Cao), blocks of 1 by 2 and 2 by 1 (the generals) and 1 by 1 blocks (soldiers). Blocks never turn or flip; a tall block stays tall.',
      'Block names are only decoration and make no difference to the rules: any block of the same size moves in the same way.' ] },
    { art: 'gate', title: 'The goal', body: [
      'You win when Cao Cao stands on the two bottom-centre cells of the board, the gate: columns 2 and 3, rows 4 and 5.',
      'Only Cao Cao matters for winning. Every other block can finish anywhere.',
      'When you win, Cao Cao walks out through the gate and the result card opens.' ] },
    { art: 'moves', title: 'What a move is', body: [
      'A move is lifting one block and setting it down on another cell it can reach. The counter goes up by one however far the block travels.',
      'A block reaches a cell if it can slide there one cell at a time through empty cells, turning corners if it needs to. It can never pass through or jump over another block, or leave the board.',
      'Letting a block go on the cell it started on is not a move.' ] },
    { art: 'drag', title: 'Dragging', body: [
      'Press a block and drag. The block follows your finger along its real route and lands on the reachable cell nearest to where you let go. It lifts a little while you hold it and settles with a soft knock.',
      'The outline under a held block shows where it will land. If a block cannot move at all, a tap makes it shake to say so.' ] },
    { art: 'tap', title: 'Tap to move', body: [
      'Tap a block to select it (gold outline). Outlines then show every cell it can reach. Tap one of them to slide the block there as a single move.',
      'Tap the selected block, or any other empty spot, to let go of it. On a keyboard: Space or Tab picks the next block that can move, the arrow keys slide the chosen block one cell, H is Think, U is Undo, R is Restart and Esc pauses.' ] },
    { art: 'undo', title: 'Undo and Restart', body: [
      'Undo takes back your last move and lowers the counter by one. You can undo all the way back to the start.',
      'Restart puts the level back as it was at the beginning and sets the counter to zero.',
      'Neither costs stars.' ] },
    { art: 'think', title: 'Think', body: [
      'Think works out the best next move from where you are right now, whatever you did before, by checking every position the blocks can reach. It shows the block and the cell it should go to, and how many moves are left in the best solution.',
      'Press Think a second time to have the game make that move. Pressing Think at all keeps the level to two stars at most.' ] },
    { art: 'minimum', title: 'Fewest possible moves', body: [
      'Each level shows the fewest moves in which it can be solved. It is computed by checking every position the blocks can reach, so no solution is shorter.',
      'The famous layout Heng Dao Li Ma needs 81 moves in this counting, where a block that turns a corner still counts as one move.' ] },
    { art: 'stars', title: 'Stars', body: [
      'Three stars: solved in at most a quarter more moves than the fewest possible, rounded up, without Think. Two stars: at most twice the fewest possible, or three-star play that used Think. One star: anything else.',
      'Your best stars and your fewest moves for each level are kept.' ] },
    { art: 'chapters', title: 'Chapters', body: [
      'There are four chapters of eight levels. Solve six levels in a chapter to open the next one; inside a chapter every level is open from the start.',
      'Levels get harder as the fewest possible moves grows, from under 20 in the first chapter to more than 80 in the last.' ] },
    { art: 'hdlm', title: 'Heng Dao Li Ma', body: [
      'The most famous Huarong Dao layout has the general Guan Yu lying across the board in front of Cao Cao, with four generals standing at the sides and four soldiers below. It opens the final chapter.',
      'Its fewest possible moves is 81 in this counting.' ] },
    { art: 'auto', title: 'Watch & Learn', body: [
      'Watch & Learn plays three levels by itself. For each move it first thinks (you choose 2, 5, 8 or 10 seconds), then reveals the move for 2 seconds by lighting the block that will move and the cell it will land on, then slides it.',
      'It always chooses a move from a shortest solution, so every level is finished in the fewest possible moves. Pause freezes everything exactly where it is and Resume carries on. Watch & Learn is free and never changes your progress.' ] },
    { art: 'demo', title: 'Free preview', body: [
      'The web preview contains the first six levels. The full game on iPhone and Android has all 32 levels and works offline.' ] },
  ],
  zh: [
    { art: 'board', title: '棋盘与方块', body: [
      '棋盘是 4 列 5 行共 20 格。每个布局使用十个方块，留下两个空格；少数温和的布局空间更大。',
      '有一个 2×2 的方块（曹操），1×2 和 2×1 的方块（将领），以及 1×1 的方块（士卒）。方块不会旋转或翻转，竖的永远是竖的。',
      '方块上的名字只是装饰，不影响规则：同样大小的方块移动方式完全一样。' ] },
    { art: 'gate', title: '目标', body: [
      '当曹操站到棋盘下方正中的两格上，也就是关口（第 2、3 列，第 4、5 行），就获胜了。',
      '只有曹操的位置决定胜负，其他方块可以停在任何地方。',
      '获胜时曹操会从关口走出，随后弹出结果卡。' ] },
    { art: 'moves', title: '什么算一步', body: [
      '拿起一个方块，放到它能到达的另一个格子上，算一步。无论方块移动多远，计数都只加一。',
      '如果方块能通过空格一格一格地滑过去（需要时可以拐弯），它就能到达那里。方块不能穿过或跳过别的方块，也不能离开棋盘。',
      '把方块放回原来的格子不算一步。' ] },
    { art: 'drag', title: '拖动', body: [
      '按住方块并拖动。方块会沿着真实的路线跟着手指移动，并落在离你松手处最近的可到达格子上。按住时它会微微浮起，落下时带着轻轻的“笃”声。',
      '被按住的方块下方的轮廓显示它将落在哪里。如果方块完全动不了，点一下它会抖动提示。' ] },
    { art: 'tap', title: '点一下就走', body: [
      '点一下方块即可选中（金色轮廓），随后所有能到达的格子会显示轮廓。点其中一个，方块就会滑过去，算一步。',
      '再点已选中的方块或任何空白处即可取消选择。键盘：空格或 Tab 选择下一个能动的方块，方向键让选中的方块移动一格，H 为思考，U 为撤销，R 为重来，Esc 为暂停。' ] },
    { art: 'undo', title: '撤销与重来', body: [
      '“撤销”会取消你的上一步，并把计数减一。可以一直撤销到开局。',
      '“重来”会把本关恢复成开局时的样子，计数归零。',
      '两者都不会扣星。' ] },
    { art: 'think', title: '思考', body: [
      '“思考”会根据你当前的局面，通过检查方块所能到达的所有局面，算出最佳的下一步，无论你之前怎么走。它会显示要移动的方块、应该去的格子，以及最佳解法还剩多少步。',
      '再按一次“思考”，游戏会替你走这一步。只要按过“思考”，本关最多只能得两星。' ] },
    { art: 'minimum', title: '最少步数', body: [
      '每一关都会显示它最少能用多少步解开。这是通过检查方块能到达的所有局面算出的，不存在更短的解法。',
      '著名的横刀立马布局在这种计数下最少需要 81 步，方块拐弯也只算一步。' ] },
    { art: 'stars', title: '星星', body: [
      '三星：步数不超过最少步数的 1.25 倍（向上取整），并且没有使用思考。两星：步数不超过最少步数的两倍，或者三星水平但用过思考。一星：其他情况。',
      '每一关会保存你的最佳星数和最少步数。' ] },
    { art: 'chapters', title: '章节', body: [
      '共有四个章节，每章八关。完成一章中的 6 关即可开启下一章；章内的每一关一开始都是开放的。',
      '关卡随最少步数增加而变难，从第一章的不到 20 步，到最后一章的 80 步以上。' ] },
    { art: 'hdlm', title: '横刀立马', body: [
      '最著名的华容道布局里，关羽横卧在曹操面前，四员大将立于两侧，下方是四名士卒。它是最后一章的第一关。',
      '在这种计数下，它最少需要 81 步。' ] },
    { art: 'auto', title: '观看学习', body: [
      '“观看学习”会自动演示三关。每一步先“思考”（可选 2、5、8 或 10 秒），再用 2 秒点亮将要移动的方块和它将落下的格子，然后滑过去。',
      '它总是选择最短解法中的一步，所以每一关都是用最少步数完成的。暂停会把一切冻结在原处，继续则从原处接着播放。“观看学习”免费，也不会改变你的进度。' ] },
    { art: 'demo', title: '免费试玩', body: [
      '网页试玩版包含前六关。iPhone 和安卓上的完整版有全部 32 关，并且可离线游玩。' ] },
  ],
};
