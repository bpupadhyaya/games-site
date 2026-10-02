// All player-facing text. Every string is a pair [English, Japanese]; English is the default and Japanese is an explicit,
// named choice ("日本語で遊ぶ" / "Play in English"), never mixed. Counts quoted in Rules come from the engine's own tables.
import { TOTAL } from './chapters.js';

let LANG = 'en';
export const setLang = (l) => { LANG = l === 'ja' ? 'ja' : 'en'; };
export const getLang = () => LANG;
const pick = (pair) => (LANG === 'ja' ? pair[1] : pair[0]);

export const STR = {
  title: ['Nonogram', 'ノノグラム'], tagline: ['Fill the grid. Reveal the picture.', 'マスを埋めて、絵を浮かび上がらせよう。'],
  playBtn: ['Play', '遊ぶ'], continueBtn: ['Continue', 'つづきから'], dailyBtn: ['Daily Puzzle', '今日の一枚'], learnBtn: ['Learn', '学ぶ'], autoBtn: ['Watch & Learn', '見て学ぶ'],
  howtoBtn: ['How to Play', '遊び方'], rulesBtn: ['Rules', 'ルール'], aboutBtn: ['About', 'このゲームについて'], settingsBtn: ['Settings', '設定'],
  back: ['Back', '戻る'], next: ['Next', '次へ'], prev: ['Previous', '前へ'], langEn: ['Play in English', 'Play in English'], langJa: ['日本語で遊ぶ', '日本語で遊ぶ'],
  fill: ['Fill', '塗る'], cross: ['Cross', 'バツ'], move: ['Move', '移動'], zoom: ['Zoom', '拡大'], undo: ['Undo', '戻す'], redo: ['Redo', '進む'], think: ['Think', 'ヒント'], check: ['Check', '確認'],
  row: ['Row {n}', '{n}行目'], col: ['Column {n}', '{n}列目'], noClue: ['no clue', 'ヒントなし'], rowWord: ['row', '行'], colWord: ['column', '列'],
  pauseTitle: ['Paused', '一時停止'], resume: ['Resume', '再開'], restart: ['Restart puzzle', 'やり直す'], quitMenu: ['Main Menu', 'メインメニュー'], chapterList: ['Pictures', '絵の一覧'],
  textSize: ['Text size', '文字サイズ'], soundOn: ['Sound: On', '音: オン'], soundOff: ['Sound: Off', '音: オフ'], checkOn: ['Mistake check: On', '間違い確認: オン'], checkOff: ['Mistake check: Off', '間違い確認: オフ'],
  thinkTime: ['Watch & Learn think time', '見て学ぶの考える時間'], seconds: ['s', '秒'], theme: ['Look', '見た目'], language: ['Language', '言語'],
  restore: ['Restore Purchases', '購入を復元'], unlock: ['Unlock Full Game', 'フルバージョンを購入'], owned: ['Full game unlocked. Thank you!', 'フルバージョンを購入済みです。ありがとうございます！'],
  resetProgress: ['Erase Progress and Stars', '進行状況と星を消す'], resetConfirm: ['Tap again to erase everything', 'もう一度押すとすべて消えます'],
  chapters: ['Chapters', 'チャプター'], picturesDone: ['{a} of {b} pictures', '{a} / {b} 枚'], starsOf: ['{a} of {b} stars', '星 {a} / {b}'], sizeLabel: ['{w} x {h}', '{w}×{h}'],
  inProgress: ['In progress', '途中'], solved: ['Solved', '完成'], locked: ['In the full game', '製品版で遊べます'],
  endHead: ['Picture complete!', '絵が完成しました！'], endAgain: ['Play Again', 'もう一度'], endNext: ['Next Picture', '次の絵へ'], endList: ['All Pictures', '絵の一覧'], endMenu: ['Main Menu', 'メインメニュー'],
  starLine: ['Stars: {n}', '星: {n}'], star1: ['Solved', '完成'], star2: ['No Think used', 'ヒントなし'], star3: ['No wrong marks', '間違いなし'],
  dailyHead: ['Daily Puzzle', '今日の一枚'], dailyBody: ['One picture a day, the same for everyone on the same date.', '毎日一枚、同じ日付なら誰でも同じ絵です。'], dailySolved: ['Solved today', '今日は完成済み'], dailyStreak: ['Streak: {n} days', '連続: {n}日'], dailyPlay: ['Play today\'s picture', '今日の絵を遊ぶ'],
  tipFill: ['Tap a square to fill it. Drag along a line to fill many.', 'マスをタップして塗ります。線に沿ってドラッグすると、まとめて塗れます。'],
  tipCross: ['Cross mode: tap or drag to mark squares you know are empty.', 'バツモード: 空とわかったマスをタップかドラッグで印をつけます。'],
  tipMove: ['Move mode: drag to slide the board.', '移動モード: ドラッグで盤面を動かします。'],
  tipCheck: ['Mistake check is on: a wrong mark is refused.', '間違い確認オン: 間違った印は入りません。'],
  tipSolved: ['Every row and column matches its clue.', 'すべての行と列がヒントと一致しました。'],
  focusIdle: ['Touch a square to see its clues.', 'マスに触れると、その行と列のヒントが表示されます。'],
  wrongMark: ['Not that one: that mark does not fit the picture.', 'そこではありません。その印は絵に合いません。'],
  nothingUndo: ['Nothing to undo', '戻せる操作がありません'], nothingRedo: ['Nothing to redo', 'やり直せる操作がありません'],
  hintApply: ['Do it', '実行'], why: ['Why?', '理由'], hintNone: ['No line can be finished by logic from here. Check your marks.', 'ここから論理で決められる行はありません。印を確認してください。'],
  autoThink: ['Thinking', '考え中'], autoReveal: ['The move', '次の一手'], autoPause: ['Pause', '一時停止'], autoPlay: ['Resume', '再開'], autoExit: ['Exit', '終了'], autoSlower: ['Think -', '考える時間 -'], autoFaster: ['Think +', '考える時間 +'],
  autoSession: ['Watch & Learn', '見て学ぶ'], autoAgain: ['Watch Again', 'もう一度見る'],
  autoSummary: ['You watched three whole pictures solved with line logic only. Every step was a real deduction with its reason, and no square was ever guessed.', '線の論理だけで解かれた三枚の絵を見ました。すべての手には理由があり、当て推量は一度もありません。'],
  lessonsTitle: ['Learn', '学ぶ'], lessonDone: ['Done', '完了'], lessonStart: ['Practice', '練習する'], lessonNext: ['Next Lesson', '次のレッスン'], lessonRetry: ['Try Again', 'もう一度'], lessonList: ['All Lessons', 'レッスン一覧'],
  lessonPass: ['Lesson complete!', 'レッスン完了！'], lessonTask: ['Practice: solve the picture. Think shows the next step.', '練習: 絵を完成させましょう。ヒントで次の一手がわかります。'],
  demoLimitTitle: ['FREE PREVIEW FINISHED', '無料体験はここまでです'], demoLimitBody: ['You played the three free pictures. Get the full game on iPhone and Android for 121 pictures in six chapters, Think, the daily puzzle and the whole Learn path.', '無料の三枚を遊びました。iPhoneとAndroidの製品版では、6つのチャプターの121枚、ヒント、毎日の一枚、すべてのレッスンが遊べます。'],
  demoLeft: ['{n} free pictures left', '無料の絵 あと{n}枚'],
  thinkingHead: ['Thinking...', '考え中...'], solvedNote: ['Solved', '完成'],
  bad: ['Check {line}', '{line}を確認'],
  yes: ['Yes', 'はい'], no: ['No', 'いいえ'],
  menuHint: ['Tap Play to choose a picture.', '「遊ぶ」で絵を選びます。'],
  continueSub: ['{name} · {pct}%', '{name} · {pct}%'],
  newBadge: ['New', '新'],
};
export const tr = (key, vars) => {
  const e = STR[key];
  let s = e ? pick(e) : key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
};

// Picture titles in Japanese (English titles live in puzzles.js).
const JA_NAMES = {
  heart: 'ハート', apple: 'りんご', pine: 'もみの木', cottage: '小さな家', teacup: 'ティーカップ', sailboat: 'ヨット', butterfly5: 'ちょうちょ', flower: '花', key: '鍵', star: '星', moon: '月', toadstool: 'きのこ', umbrella: '傘', bell: 'ベル', leaf: '葉っぱ', icecream: 'アイスクリーム', raincloud: '雨雲', cherries: 'さくらんぼ', tulip: 'チューリップ', lantern: 'ちょうちん',
  teapot: 'ティーポット', lighthouse: '灯台', whale: 'くじら', owl: 'ふくろう', duck: 'あひる', cactus: 'サボテン', pumpkin: 'かぼちゃ', balloon: '気球', castle: 'お城', barn: '納屋', butterfly: 'チョウ', anchor: 'いかり', snail: 'かたつむり', rocket: 'ロケット', fox: 'きつね', crown: '王冠', cat: '黒猫', boot: '長靴', acorn: 'どんぐり', shell: '貝がら',
  fuji: '富士山', paperboat: '紙の舟', koi: '鯉', fan: '扇', doubledecker: '赤いバス', clocktower: '時計塔', bonsai: '盆栽', teabowl: '茶碗', diamondkite: 'ひし形の凧', wagasa: '和傘', hillcastle: '丘の城', carp: 'こいのぼり', tallship: '帆船', fishtank: '水槽', rainbow: '虹', tinrobot: 'ブリキのロボット', littledino: '小さな恐竜', campsite: 'テント', steamtrain: '蒸気機関車', cupcake: 'カップケーキ', palmisland: 'やしの島', starfish: 'ひとで', skyballoon: '空の気球',
  bicycle: '自転車', wateringcan: 'じょうろ', cake: 'バースデーケーキ', turtle: 'かめ', elephant: 'ぞう', swan: '白鳥', hedgehog: 'はりねずみ', bee: 'みつばち', chest: '宝箱', snowman: '雪だるま', ladybug: 'てんとう虫', dolphin: 'イルカ', compass: '羅針盤', tractor: 'トラクター', books: '本の山', applebasket: 'りんごかご',
  harbour: '港の夕日', mountainlake: '山の湖', lighthousecliff: '崖の灯台', windmillfield: '風車の野原', blossomtree: '桜の木', teaset: 'お茶のセット', stonebridge: '石の橋', snowycottage: '雪の家', balloontrio: '三つの気球', locomotive: '機関車', regatta: 'ヨットレース', owlbranch: '夜のふくろう', foxhead: 'きつねの顔', koipond: '鯉の池', greenhouse: '温室', birdhouse: '巣箱', lanternfestival: '灯籠の祭り', campnight: '夜のキャンプ', rocketlaunch: 'ロケット発射', hillcastle15: '丘のお城', sunflower: 'ひまわり', whalewaves: 'くじらと波', desertcactus: '砂漠のサボテン',
  fujiblossom: '富士と桜', whaletail: 'くじらの尾', tallship20: '大きな帆船', lighthousestorm: '嵐の灯台', windmillvillage: '風車の村', castlekingdom: 'お城の王国', balloonfestival: '気球まつり', viaduct: '高架橋の列車', lilypond: 'すいれんの池', moonowl: '月とふくろう', alpinepeak: '雪山の峰', butterflymeadow: 'チョウの草原', coralreef: 'サンゴ礁', skyline: '町の景色', desertsunset: '砂漠の夕暮れ', forestcabin: '森の小屋', planetrocket: '惑星とロケット', bigkoi: '大きな鯉',
  stripes: 'しましま',
};
export const nameOf = (puz) => (LANG === 'ja' && JA_NAMES[puz.id] ? JA_NAMES[puz.id] : puz.name);

// ------------------------------------------------------------------------------------------------ How to Play
export const HOWTO = [
  { art: 'sample', title: ['The goal', 'めざすもの'], body: ['Every number beside the grid tells you how many squares in that row or column are filled, in a run. Fill the right squares and a hidden picture appears.', 'グリッドの横と上の数字は、その行や列で何マスが連続して塗られるかを表します。正しいマスを塗ると、隠れていた絵が現れます。'] },
  { art: 'clues', title: ['Reading the clues', 'ヒントの読み方'], body: ['A clue of 3 1 means a run of three filled squares, then at least one empty square, then one more filled square. The runs always appear in that order. A 0 means the line is empty.', '「3 1」は、3マス連続して塗り、1マス以上あけて、さらに1マス塗るという意味です。順番はいつもこのとおりです。「0」はその線が空という意味です。'] },
  { art: 'drag', title: ['Fill and cross out', '塗る・バツをつける'], body: ['Tap a square to fill it, or drag along a row or column to fill a whole run. Switch to Cross to mark squares you know are empty. Tap a marked square again to clear it.', 'マスをタップして塗ります。行や列に沿ってドラッグすると、まとめて塗れます。「バツ」に切り替えると、空とわかったマスに印をつけられます。もう一度タップすると消えます。'] },
  { art: 'think', title: ['Think', 'ヒント'], body: ['Stuck? Think finds a square that logic proves, shows the row or column it comes from and explains why in plain words. You can fill it yourself or press Do it.', '行き詰まったら「ヒント」を押してください。論理で確実に決まるマスを見つけ、どの行か列かと、その理由をやさしい言葉で説明します。自分で塗ってもいいし、「実行」を押してもかまいません。'] },
  { art: 'bigboard', title: ['Big pictures', '大きな絵'], body: ['On larger boards use Zoom to make the squares bigger and Move to slide the board. The row and column clues stay beside the squares, and the line you touch is spelled out in large type above the board.', '大きな盤面では「拡大」でマスを大きくし、「移動」で盤面を動かします。行と列のヒントはマスのそばに残り、触れている線のヒントは盤面の上に大きな文字で表示されます。'] },
  { art: 'stars', title: ['Stars and the daily picture', '星と今日の一枚'], body: ['Every picture earns up to three stars: solved, solved without Think, and solved with no wrong marks. Each day there is one picture for everyone. Learn and Watch & Learn teach the techniques step by step.', '絵ごとに最大三つの星がもらえます。完成、ヒントなしで完成、間違った印なしで完成です。毎日、みんなに同じ絵が一枚用意されます。「学ぶ」と「見て学ぶ」では、技を順番に学べます。'] },
];

// ------------------------------------------------------------------------------------------------ Rules
export const RULES = [
  { art: 'sample', title: ['The puzzle', 'パズルについて'], body: [
    ['A picture is hidden in a grid of squares. Your job is to decide, square by square, which ones are filled and which are empty. The numbers beside the rows and above the columns are the only information you get.', '絵が四角いマスのグリッドに隠れています。どのマスが塗られ、どのマスが空なのかを、一つずつ決めていきます。手がかりは、行の横と列の上にある数字だけです。'],
    ['Every picture in this game has exactly one solution, and every one can be solved by reasoning about a single row or column at a time. You never have to guess. This was checked for all ' + TOTAL + ' pictures by an exact solver.', 'このゲームのすべての絵には、答えがちょうど一つだけあります。しかも一度に一つの行か列を考えるだけで解けるので、当て推量は不要です。' + TOTAL + '枚すべてを厳密なソルバーで確認しています。'],
  ] },
  { art: 'clues', title: ['Clue numbers', 'ヒントの数字'], body: [
    ['A clue is a list of numbers read left to right (rows) or top to bottom (columns). Each number is the length of one run of filled squares in that line, and the runs appear in the same order as the numbers.', 'ヒントは数字の並びで、行は左から右へ、列は上から下へ読みます。それぞれの数字は、その線にある塗られたマスの連続の長さで、連続は数字と同じ順に並びます。'],
    ['Between two runs there is at least one empty square. A clue of 0 means the whole line is empty. The squares before the first run and after the last run are empty.', '二つの連続の間には、少なくとも一つの空きマスがあります。「0」はその線がすべて空という意味です。最初の連続の前と最後の連続のあとも空です。'],
  ] },
  { art: 'example', title: ['A worked clue', 'ヒントの例'], body: [
    ['In a line of 10 squares the clue 3 2 needs 3 + 1 + 2 = 6 squares at least. Four squares are spare, so the 3-run can start anywhere from the first to the fifth square.', '10マスの線でヒントが「3 2」なら、最低でも3 + 1 + 2 = 6マス必要です。余りは4マスなので、3の連続は1マス目から5マス目のどこからでも始められます。'],
    ['Where every possible placement agrees, the squares are certain. That is how every deduction in this game works.', 'すべての置き方が一致する場所は確実なマスです。このゲームのすべての推理は、この考え方で成り立っています。'],
  ] },
  { art: 'drag', title: ['Filling squares', 'マスを塗る'], body: [
    ['In Fill mode, tapping an empty or crossed square fills it, and tapping a filled square empties it. Dragging does the same to every square it passes, but only squares that began in the same state as the first square are changed.', '「塗る」モードでは、空のマスかバツのマスをタップすると塗られ、塗られたマスをタップすると空に戻ります。ドラッグすると、通ったマスのうち最初のマスと同じ状態だったものだけが同じように変わります。'],
    ['A drag locks to one line: once the finger leaves the first square, the stroke follows the row or the column, whichever you moved along more, and the squares between the start and the finger are painted. Move back and they are undone. A stray touch from a second finger is ignored.', 'ドラッグは一本の線に固定されます。最初のマスから指が出たあとは、より多く動かした方向の行か列に沿って塗られ、始点と指の間のマスが塗られます。戻ると取り消されます。二本目の指が触れても無視されます。'],
  ] },
  { art: 'cross', title: ['Crossing squares', 'バツをつける'], body: [
    ['Cross mode marks a square you know is empty. It works exactly like Fill: tap to cross, tap again to clear, drag to cross a run. A cross never counts towards the picture; it only helps you keep track.', '「バツ」モードは、空とわかったマスに印をつけます。使い方は「塗る」と同じで、タップで印、もう一度で消去、ドラッグで連続して印をつけます。バツは絵には数えられず、整理のための印です。'],
    ['A puzzle is solved when the filled squares match every clue, so crosses are optional.', 'パズルは、塗られたマスがすべてのヒントに一致すれば完成なので、バツは必須ではありません。'],
  ] },
  { art: 'bigboard', title: ['Zoom and Move', '拡大と移動'], body: [
    ['The board is drawn as large as it can be while the whole picture still fits. On bigger boards, Zoom switches to a close view with squares big enough for a fingertip. Zoom does nothing when the squares are already large.', '盤面は、絵全体が収まる範囲でできるだけ大きく表示されます。大きな盤面では「拡大」で、指で押しやすい大きさのマスに切り替わります。マスがすでに大きい場合は何も変わりません。'],
    ['In Move mode a drag slides the board. In Fill or Cross mode, dragging near the edge of the board slides it too. The row clues stay beside the squares you see and the column clues stay above them. Think and Watch & Learn slide the board for you.', '「移動」モードではドラッグで盤面が動きます。「塗る」や「バツ」でも、盤面の端の近くでドラッグすると盤面が動きます。行のヒントは見えているマスの横に、列のヒントは上に残ります。「ヒント」と「見て学ぶ」は盤面を自動で動かします。'],
  ] },
  { art: 'undo', title: ['Undo and Redo', '戻すと進む'], body: [
    ['Every tap or drag is one step. Undo takes back the last step and Redo puts it back. The game keeps the last 400 steps of the picture you are working on. Starting a new move clears what Redo could bring back.', 'タップやドラッグは一回が一手です。「戻す」で直前の一手を取り消し、「進む」でやり直せます。作業中の絵について最後の400手まで記録されます。新しい手を打つと、「進む」で戻せる内容は消えます。'],
  ] },
  { art: 'done', title: ['Finished lines', '完成した線'], body: [
    ['When the filled squares in a row or column spell out its clue exactly, its numbers fade and turn green. A line with a clue of 0 fades once all its squares are marked. A faded clue is a hint that you can stop working on that line.', '行や列の塗られたマスがヒントとちょうど一致すると、その数字は薄くなり緑色になります。ヒントが「0」の線は、すべてのマスに印がつくと薄くなります。薄くなったヒントは、その線はもう終わりという目印です。'],
    ['This only says that the line matches its clue. It does not say that the line is correct for the picture, though in a puzzle with one solution a finished line is always right.', 'これは線がヒントと一致したことを示すだけです。ただし答えが一つのパズルでは、完成した線は必ず正しい線です。'],
  ] },
  { art: 'check', title: ['Mistake check', '間違い確認'], body: [
    ['Check is off by default. Switch it on and a mark that does not fit the hidden picture is refused with a red flash: filling a square that is empty in the picture, or crossing a square that is filled. Every refused or wrong mark counts as one wrong mark.', '「確認」は初期状態ではオフです。オンにすると、隠れた絵に合わない印（絵では空のマスを塗る、塗られているマスにバツをつける）は赤く光って入りません。拒否された印や間違った印は一回として数えられます。'],
    ['Even with Check off the game quietly counts wrong marks, because they decide your stars. It never shows a count while you play.', '「確認」がオフでも、星に関わるので間違った印は静かに数えられます。遊んでいる間に回数が表示されることはありません。'],
  ] },
  { art: 'think', title: ['Think', 'ヒント機能'], body: [
    ['Think runs the same line solver used to check every picture. It looks at each row and column, using the marks you have made, and picks the line where logic proves the most new squares (rows first, then the lowest number). It highlights the line, circles the squares and explains the reason in words.', 'ヒント機能は、すべての絵の確認に使われた線ソルバーと同じものを使います。あなたの印を踏まえて各行と各列を調べ、新しく確実に決まるマスが最も多い線を選びます（同じなら行が先、番号が小さい方）。線を光らせ、マスを丸で囲み、理由を言葉で説明します。'],
    ['If one of your marks contradicts a clue, Think says which line to check instead. Using Think costs the second star for that picture. Press Do it to place the marks for you.', '印がヒントと食い違っている場合は、確認すべき線を知らせます。ヒントを使うとその絵の二つ目の星は付きません。「実行」を押すと、印を代わりに入れます。'],
  ] },
  { art: 'overlap', title: ['Technique: overlap', '技: 重なり'], body: [
    ['Count the squares a clue needs, including one gap between runs. If a line has few spare squares, a long run covers some of the same squares wherever it slides. Those squares are filled. A clue of 8 in a line of 10 has two spare squares, so the middle six squares are filled.', 'ヒントに必要なマス数（連続の間の空き一つを含む）を数えます。余りが少ない線では、長い連続はどこに動かしても同じマスを通ります。そのマスは塗られます。10マスの線で「8」なら余りは2マスなので、真ん中の6マスが塗られます。'],
  ] },
  { art: 'edge', title: ['Technique: edges', '技: 端'], body: [
    ['A filled square at the very end of a line must belong to the first (or last) run, so that run begins right there: fill the rest of it and cross out the square just after it. A cross at the end of a line shifts every run along and can create new overlaps.', '線の一番端の塗られたマスは、最初（または最後）の連続の一部なので、その連続はそこから始まります。残りを塗り、すぐ後ろのマスにバツをつけます。端のバツは連続をずらし、新しい重なりを生むことがあります。'],
  ] },
  { art: 'gap', title: ['Technique: gaps and finished lines', '技: すき間と完成した線'], body: [
    ['A stretch of open squares between crosses that is shorter than the smallest run left to place cannot hold anything, so cross it out. When a line already has every run in place, cross out everything else. A line with a clue that exactly fills it, such as 4 1 in a line of 6, has only one arrangement.', 'バツにはさまれた空きマスの並びが、残っている最も短い連続よりも短ければ、何も入らないのでバツをつけます。すべての連続がそろった線は、残りをすべてバツにします。「6マスの線で4 1」のようにヒントが線を埋めきる場合は、置き方が一つだけです。'],
  ] },
  { art: 'reveal', title: ['The reveal', '絵の登場'], body: [
    ['The picture is complete when every row and every column matches its clue. The squares then change from ink to their real colours, the clues slide away and the finished picture is shown, with its title. Each picture is a small mosaic in a shared palette.', 'すべての行と列がヒントに一致すると完成です。マスは墨の色から本当の色に変わり、ヒントが退き、題名とともに完成した絵が表示されます。どの絵も、共通のパレットで描かれた小さなモザイクです。'],
  ] },
  { art: 'stars', title: ['Stars', '星'], body: [
    ['One star for solving a picture. A second star if you solved it without using Think. A third star if you also made no wrong marks. If you play it again and do better, the stars you earned are kept. Stars never run out and there is no timer.', '絵を完成させると星が一つ。ヒントを使わずに完成させるとさらに一つ。間違った印もなければもう一つ。もう一度遊んで良い結果になれば、獲得した星は残ります。星は減らず、時間制限もありません。'],
  ] },
  { art: 'chapters', title: ['Chapters and pictures', 'チャプターと絵'], body: [
    ['There are ' + TOTAL + ' pictures in six chapters: 5 by 5, 7 by 7, 10 by 10, 12 by 12, 15 by 15 and 20 by 20. All are open from the start, so choose by mood. Each shows its progress and stars, and solved pictures keep their colours.', TOTAL + '枚の絵が6つのチャプターに分かれています: 5×5、7×7、10×10、12×12、15×15、20×20。どれも最初から選べるので、気分で選んでください。進み具合と星が表示され、完成した絵は色つきで残ります。'],
  ] },
  { art: 'daily', title: ['Daily puzzle', '今日の一枚'], body: [
    ['Each day the game offers one picture from the larger boards. The choice is made from the date alone (days counted in UTC), so everyone who plays on the same date gets the same picture. Solving it keeps a streak of consecutive days.', '毎日、大きめの盤面から絵が一枚選ばれます。選び方は日付だけで決まる（UTCで日数を数えます）ので、同じ日に遊ぶ人はみな同じ絵になります。解くと連続日数が記録されます。'],
  ] },
  { art: 'save', title: ['Saving and Continue', '保存とつづきから'], body: [
    ['The game saves the picture you are working on after every move. Leave at any time and pick up from the menu with Continue; it opens paused, ready when you are. Open an unfinished picture from the list and it resumes too.', 'ゲームは一手ごとに作業中の絵を保存します。いつでも中断でき、メニューの「つづきから」で再開します。再開時は一時停止の状態で、準備ができたら始められます。一覧から途中の絵を開いても、続きから始まります。'],
  ] },
  { art: 'auto', title: ['Watch & Learn', '見て学ぶ'], body: [
    ['Three pictures are solved for you, one line at a time. Each step has three parts: THINK (the solver looks along the lines), REVEAL (the line is lit, the squares are outlined and the reason is written) and ACT (the marks go in). Choose a think time of 2, 5, 8 or 10 seconds, and pause whenever you like.', '三枚の絵が一行ずつ解かれていきます。各ステップは三つの段階です。考える（ソルバーが線を見ていく）、見せる（線が光り、マスが囲まれ、理由が書かれる）、実行（印が入る）。考える時間は2・5・8・10秒から選べ、いつでも一時停止できます。'],
  ] },
  { art: 'text', title: ['Text size and language', '文字サイズと言語'], body: [
    ['Every screen has A- and A+ to scale text from 100 to 300 percent, including the row and column readout above the board during a puzzle. In Settings, or on the menu, choose Play in English or 日本語で遊ぶ; they are two complete versions of the game and never mixed.', 'どの画面にもA-とA+があり、文字を100〜300パーセントに変えられます。パズル中に盤面の上に出る行と列のヒント表示も含みます。設定かメニューで「Play in English」か「日本語で遊ぶ」を選べます。二つは別々の完全版で、混ざることはありません。'],
  ] },
  { art: 'keys', title: ['Keyboard', 'キーボード'], body: [
    ['Arrow keys move the cursor, Space or Enter fills (X crosses), F, C and M choose Fill, Cross and Move, U undoes, Y redoes, T asks Think, and Escape or P pauses.', '矢印キーでカーソルを動かし、SpaceかEnterで塗ります（Xでバツ）。F、C、Mで塗る・バツ・移動、Uで戻す、Yで進む、Tでヒント、EscapeかPで一時停止します。'],
  ] },
];
export const RULE_COUNT = RULES.length, HOWTO_COUNT = HOWTO.length;

export const ABOUT = [
  { title: ['Nonogram', 'ノノグラム'], body: [
    'A calm logic picture puzzle. Use the numbers beside the grid to decide which squares are filled, and a small illustration appears. ' + TOTAL + ' pictures in six chapters, from 5 by 5 to 20 by 20, each with exactly one solution that logic alone can reach.',
    'マスの横と上の数字を手がかりに塗るマスを決めていくと、小さなイラストが現れます。6つのチャプターに、5×5から20×20まで' + TOTAL + '枚の絵。どれも答えは一つで、論理だけで解けます。'] },
  { title: ['A short history', 'ちょっとした歴史'], body: [
    'Number-grid picture puzzles of this kind were invented independently in Japan in the late 1980s, where Non Ishida and Tetsuya Nishio each devised them. The name "nonogram" and their popularity in the United Kingdom came in the 1990s through newspaper puzzle pages, where they were also called "griddlers". Other names include "paint by numbers" and "hanjie".',
    'このような数字による絵のパズルは、1980年代後半の日本で、石田ノンさんと西尾徹也さんがそれぞれ考案しました。「ノノグラム」という名前と英国での人気は、1990年代の新聞のパズル欄から広まりました。日本では「お絵かきロジック」とも呼ばれます。'] },
  { title: ['What is in this version', 'この版の内容'], body: [
    'Think explains the next deduction in plain words. Watch & Learn solves three pictures with the reasons shown. Learn teaches overlap, edges and gaps. A new daily picture, three looks, and text from 100 to 300 percent. No timer, no ads.',
    '「ヒント」は次の一手を平易な言葉で説明します。「見て学ぶ」は三枚の絵を理由つきで解きます。「学ぶ」では重なり・端・すき間を学べます。毎日の一枚、三種類の見た目、100〜300パーセントの文字サイズ。時間制限も広告もありません。'] },
  { title: ['Language', '言語'], body: [
    'The game is complete in English and in Japanese (日本語). Choose one in Settings or on the menu.',
    'このゲームは英語版と日本語版の両方が完全に用意されています。設定かメニューで選べます。'] },
];
export const aboutText = (pair) => pick(pair);
export const L = (pair) => pick(pair);
