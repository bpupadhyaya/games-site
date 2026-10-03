// All player-facing text, in English and Vietnamese. The language is a visible choice (Play in English / Chơi bằng tiếng Việt),
// never auto-detected. Numbers in the Rules come from the engine's own constants so the pages cannot drift from it.
import { START_DAN, YOUNG_MIN, MAX_PLIES } from './engine.js';

let LANG = 'en';
export const setLang = (l) => { LANG = l === 'vi' ? 'vi' : 'en'; };
export const getLang = () => LANG;

const STR = {
  en: {
    appName: 'Ô Ăn Quan', appSub: 'Mandarin Squares', tagline: 'The Vietnamese pebble game of sowing and capture.',
    playEn: 'Play in English', playVi: 'Chơi bằng tiếng Việt', langHead: 'Choose your language', langNote: 'You can change this any time on the main menu.',
    playBtn: 'Play', continueBtn: 'Continue game', learnBtn: 'Learn', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About',
    settingsBtn: 'Settings', back: 'Back', next: 'Next', prev: 'Previous', think: 'Think', undo: 'Undo', restart: 'Restart', resume: 'Resume', paused: 'Paused',
    quitMenu: 'Main Menu', soundOn: 'Sound: On', soundOff: 'Sound: Off', thinkTime: 'Watch & Learn think time', seconds: 's',
    restore: 'Restore Purchases', unlock: 'Unlock Full Game', resetProgress: 'Erase Records and Progress', resetConfirm: 'Tap again to erase everything',
    owned: 'Full game unlocked. Thank you!', theme: 'Board', textSize: 'Text size', language: 'Language',
    startGame: 'Start game', setupTitle: 'New game', opponentTitle: 'Opponent', sideTitle: 'Your side', rulesOptTitle: 'Rule options',
    first: 'Play first (bottom row)', second: 'Play second (top row)', twoPlayers: 'Two players', youWord: 'You', oppWord: 'Opponent', p1: 'Player 1', p2: 'Player 2',
    mandValue: 'Mandarin is worth', mandValueN: '{n} points', youngRule: 'Young mandarin', youngOn: 'Protected (5+ stones to capture)', youngOff: 'Not protected',
    lvNovice: 'Novice', lvCasual: 'Casual', lvClub: 'Club', lvExpert: 'Expert', lvMaster: 'Master',
    lvNoviceB: 'Plays any legal move. A gentle first opponent.', lvCasualB: 'Takes captures it can see, but often plays a random move.',
    lvClubB: 'Looks two turns ahead and slips now and then.', lvExpertB: 'Looks four turns ahead and rarely slips.', lvMasterB: 'Looks eight turns ahead and never plays a random move.',
    twoInfo: 'Two players share the phone. Player 1 sits at the bottom row, Player 2 at the top row.',
    record: 'Record', wins: 'W', draws: 'D', losses: 'L',
    autoThink: 'Thinking', autoPause: 'Pause', autoPlay: 'Resume', autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +',
    autoSession: 'Watch & Learn', autoAgain: 'Watch Again', autoSummary: 'You watched two whole games, each move chosen by the game\'s own engine with its reason shown: Master against Master, and Master against Expert.',
    demoLimitTitle: 'FREE PREVIEW FINISHED', demoLimitBody: 'You played the three free games. Get the full game on iPhone and Android for every opponent level, two players on one phone, the rule options and the full Learn course.',
    demoLeft: '{n} free games left', locked: 'In the full game', lessonsTitle: 'Learn', lessonDone: 'Done', again: 'Play Again', newSetup: 'Change Game',
    lessonNext: 'Next Lesson', lessonRetry: 'Try Again', lessonList: 'All Lessons', lessonOf: 'Lesson {n} of {m}', correct: 'Correct!', notQuite: 'Not quite',
    yourMove: 'Your move', thinking: 'Thinking...', turnOf: '{who} to move', pickSquare: 'Tap one of your squares that holds stones.', pickDir: 'Now choose which way to sow.',
    dirLeft: 'Sow left', dirRight: 'Sow right', sowing: 'Sowing...', nothingUndo: 'Nothing to undo', moveToast: 'Square {n}, {dir}',
    dirWordL: 'to the left', dirWordR: 'to the right', sqWord: 'square {n} of the row',
    youWon: 'You win!', youLost: '{who} wins', drawWord: 'A draw', winsWord: '{who} wins!',
    finalScore: 'Final count: {a} to {b}', cappedNote: ' The game reached its {n}-turn limit.',
    youTook: 'You took {n}', theyTook: '{who} took {n}', tookQuan: 'including the mandarin', tookNothing: 'No capture that turn',
    borrowNote: '{who} had no stones and put five back from their winnings.', borrowDebt: '{who} borrowed from the other side: the debt of {n} is repaid in the final count.',
    pileDan: 'Stones', pileQuan: 'Mandarins', pileTotal: 'Total', toMove: 'to move', waiting: 'waiting', winner: 'Winner', sideTop: 'top row', sideBottom: 'bottom row',
    resetDone: 'Erased',
    // hints
    hintHead: 'Square {n}, sow {dir}',
    r_quan: 'This takes a mandarin: {a} in all. The opponent\'s best answer then gains {b}.',
    r_capture: 'This captures stones worth {a}. The opponent\'s best answer then gains {b}.',
    r_safe: 'No capture is available, so this is the safest move: the opponent\'s best answer gains only {a}, the least of any move.',
    r_steady: 'Searching ahead, this keeps you furthest ahead. The opponent\'s best immediate answer gains {a}.',
    r_endWin: 'This ends the game with you ahead.', r_endDraw: 'This ends the game level.', r_endLoss: 'Every move ends the game behind; this loses by the least.',
    r_notBest: 'Not the strongest move: the engine prefers {h}.',
    lessonWrongNone: 'That move captures nothing. Look for a square whose last stone is followed by an empty square, with stones behind it.',
    lessonWrongLess: 'That move gains {a}, but another gains {b}. Compare the squares and both directions.',
    lessonWrongDef: 'After that move the opponent can take {a}. Find a move that leaves no big capture.',
    lessonGameFail: 'Play on and finish the game to complete this lesson.',
    savedGame: 'Saved game',
  },
  vi: {
    appName: 'Ô Ăn Quan', appSub: 'Ô Quan', tagline: 'Trò chơi rải sỏi và ăn quan của trẻ em Việt Nam.',
    playEn: 'Play in English', playVi: 'Chơi bằng tiếng Việt', langHead: 'Chọn ngôn ngữ', langNote: 'Bạn có thể đổi lại bất cứ lúc nào ở menu chính.',
    playBtn: 'Chơi', continueBtn: 'Chơi tiếp', learnBtn: 'Học chơi', autoBtn: 'Xem và học', howtoBtn: 'Cách chơi', rulesBtn: 'Luật chơi', aboutBtn: 'Giới thiệu',
    settingsBtn: 'Cài đặt', back: 'Quay lại', next: 'Tiếp', prev: 'Trước', think: 'Gợi ý', undo: 'Hoàn tác', restart: 'Chơi lại', resume: 'Tiếp tục', paused: 'Tạm dừng',
    quitMenu: 'Menu chính', soundOn: 'Âm thanh: Bật', soundOff: 'Âm thanh: Tắt', thinkTime: 'Thời gian suy nghĩ khi xem', seconds: ' giây',
    restore: 'Khôi phục giao dịch', unlock: 'Mở khóa toàn bộ trò chơi', resetProgress: 'Xóa kỷ lục và tiến trình', resetConfirm: 'Chạm lần nữa để xóa tất cả',
    owned: 'Đã mở khóa toàn bộ. Cảm ơn bạn!', theme: 'Bàn cờ', textSize: 'Cỡ chữ', language: 'Ngôn ngữ',
    startGame: 'Bắt đầu', setupTitle: 'Ván mới', opponentTitle: 'Đối thủ', sideTitle: 'Bên của bạn', rulesOptTitle: 'Tùy chọn luật',
    first: 'Đi trước (hàng dưới)', second: 'Đi sau (hàng trên)', twoPlayers: 'Hai người', youWord: 'Bạn', oppWord: 'Đối thủ', p1: 'Người chơi 1', p2: 'Người chơi 2',
    mandValue: 'Quan có giá trị', mandValueN: '{n} điểm', youngRule: 'Quan non', youngOn: 'Được bảo vệ (cần từ 5 dân mới ăn được)', youngOff: 'Không được bảo vệ',
    lvNovice: 'Người mới', lvCasual: 'Vui vẻ', lvClub: 'Khá', lvExpert: 'Cao thủ', lvMaster: 'Đại sư',
    lvNoviceB: 'Đi một nước hợp lệ bất kỳ. Đối thủ nhẹ nhàng đầu tiên.', lvCasualB: 'Ăn được khi nhìn thấy, nhưng hay đi bừa.',
    lvClubB: 'Nhìn trước hai lượt và thỉnh thoảng đi sai.', lvExpertB: 'Nhìn trước bốn lượt và hiếm khi sai.', lvMasterB: 'Nhìn trước tám lượt và không bao giờ đi bừa.',
    twoInfo: 'Hai người dùng chung một điện thoại. Người chơi 1 ở hàng dưới, người chơi 2 ở hàng trên.',
    record: 'Kỷ lục', wins: 'T', draws: 'H', losses: 'B',
    autoThink: 'Đang nghĩ', autoPause: 'Tạm dừng', autoPlay: 'Tiếp tục', autoExit: 'Thoát', autoSlower: 'Nghĩ -', autoFaster: 'Nghĩ +',
    autoSession: 'Xem và học', autoAgain: 'Xem lại', autoSummary: 'Bạn đã xem hai ván đầy đủ, mỗi nước đi do chính bộ máy của trò chơi chọn và có giải thích lý do: Đại sư gặp Đại sư, và Đại sư gặp Cao thủ.',
    demoLimitTitle: 'HẾT BẢN CHƠI THỬ', demoLimitBody: 'Bạn đã chơi ba ván miễn phí. Tải bản đầy đủ trên iPhone và Android để có mọi mức đối thủ, chế độ hai người trên một điện thoại, các tùy chọn luật và toàn bộ phần Học chơi.',
    demoLeft: 'Còn {n} ván miễn phí', locked: 'Có trong bản đầy đủ', lessonsTitle: 'Học chơi', lessonDone: 'Xong', again: 'Chơi lại', newSetup: 'Đổi ván',
    lessonNext: 'Bài tiếp theo', lessonRetry: 'Thử lại', lessonList: 'Tất cả bài học', lessonOf: 'Bài {n} trên {m}', correct: 'Đúng rồi!', notQuite: 'Chưa đúng',
    yourMove: 'Đến lượt bạn', thinking: 'Đang nghĩ...', turnOf: 'Đến lượt {who}', pickSquare: 'Chạm vào một ô của bạn có dân.', pickDir: 'Giờ chọn hướng rải.',
    dirLeft: 'Rải sang trái', dirRight: 'Rải sang phải', sowing: 'Đang rải...', nothingUndo: 'Không có gì để hoàn tác', moveToast: 'Ô {n}, {dir}',
    dirWordL: 'sang trái', dirWordR: 'sang phải', sqWord: 'ô thứ {n} của hàng',
    youWon: 'Bạn thắng!', youLost: '{who} thắng', drawWord: 'Hòa', winsWord: '{who} thắng!',
    finalScore: 'Kết quả: {a} - {b}', cappedNote: ' Ván đấu đã chạm giới hạn {n} lượt.',
    youTook: 'Bạn ăn được {n}', theyTook: '{who} ăn được {n}', tookQuan: 'có cả quan', tookNothing: 'Lượt đó không ăn được gì',
    borrowNote: '{who} hết dân và rải lại năm dân từ phần đã ăn.', borrowDebt: '{who} mượn từ bên kia: khoản nợ {n} sẽ được trả khi tính điểm cuối.',
    pileDan: 'Dân', pileQuan: 'Quan', pileTotal: 'Tổng', toMove: 'đến lượt', waiting: 'chờ', winner: 'Thắng', sideTop: 'hàng trên', sideBottom: 'hàng dưới',
    resetDone: 'Đã xóa',
    hintHead: 'Ô {n}, rải {dir}',
    r_quan: 'Nước này ăn được một quan: tổng cộng {a} điểm. Nước đáp trả tốt nhất của đối thủ sau đó được {b}.',
    r_capture: 'Nước này ăn được số dân trị giá {a} điểm. Nước đáp trả tốt nhất của đối thủ sau đó được {b}.',
    r_safe: 'Không có nước ăn nào, nên đây là nước an toàn nhất: đối thủ đáp trả tốt nhất cũng chỉ được {a}, ít nhất trong mọi nước.',
    r_steady: 'Tính trước nhiều lượt, nước này giữ bạn ở thế tốt nhất. Nước đáp trả tốt nhất ngay sau đó của đối thủ được {a}.',
    r_endWin: 'Nước này kết thúc ván với bạn dẫn điểm.', r_endDraw: 'Nước này kết thúc ván với tỷ số hòa.', r_endLoss: 'Mọi nước đều kết thúc ván khi bạn kém; nước này thua ít nhất.',
    r_notBest: 'Không phải nước mạnh nhất: bộ máy ưu tiên {h}.',
    lessonWrongNone: 'Nước đó không ăn được gì. Hãy tìm ô mà dân cuối cùng rơi xuống trước một ô trống, và phía sau có dân.',
    lessonWrongLess: 'Nước đó được {a}, nhưng có nước khác được {b}. Hãy so sánh các ô và cả hai hướng.',
    lessonWrongDef: 'Sau nước đó đối thủ ăn được {a}. Hãy tìm nước không để lại miếng ăn lớn.',
    lessonGameFail: 'Hãy chơi tiếp đến hết ván để hoàn thành bài học.',
    savedGame: 'Ván đã lưu',
  },
};

export const tr = (key, vars) => {
  let s = STR[LANG][key] ?? STR.en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(vars[k]);
  return s;
};
export const levelName = (id) => tr(`lv${id[0].toUpperCase()}${id.slice(1)}`);
export const levelBlurb = (id) => tr(`lv${id[0].toUpperCase()}${id.slice(1)}B`);

// Words for a move, from the engine-facing { col, dx } of explain.moveWords.
export const dirWord = (dx) => tr(dx > 0 ? 'dirWordR' : 'dirWordL');
export const hintText = (r, w) => ({ head: tr('hintHead', { n: w.col, dir: dirWord(w.dx) }), why: tr(`r_${r.code}`, { a: r.a, b: r.b }) });

// ------------------------------------------------------------------------------------------------ How to Play
const HOWTO_EN = [
  { title: 'The goal', art: 'board', body: 'Win more points than your opponent. Capture the two big mandarin stones and as many small stones as you can. A small stone is worth 1 point and a mandarin is worth 10.' },
  { title: 'Your move', art: 'tap', body: 'Tap one of your squares that holds stones, then choose a direction with the buttons, or just swipe left or right from the square. All its stones are picked up and dropped one by one into the squares ahead.' },
  { title: 'Keep sowing', art: 'relay', body: 'When your last stone lands and the next square holds stones, pick them all up and keep sowing from there. Your turn goes on until the sowing meets an empty square or a mandarin square.' },
  { title: 'Capturing', art: 'capture', body: 'When the last stone is followed by an empty square, and the square after that holds stones, you capture them all. Keep going: if another empty square and a full one follow, take those too.' },
  { title: 'Mandarins', art: 'quan', body: 'The big stones sit in the end squares. Take one by capturing its square, and you win it together with every small stone beside it. A young mandarin with fewer than 5 small stones is protected, unless you turn that rule off.' },
  { title: 'Out of stones', art: 'borrow', body: 'If your five squares are empty at your turn, you pay five of your captured stones to put one in each. If you have fewer than five, you borrow them, and the debt comes off your total at the end.' },
  { title: 'Think and Learn', art: 'think', body: 'Think shows the best move and says why. Learn is a short course of real positions, and Watch & Learn plays whole games for you, explaining every move.' },
];
const HOWTO_VI = [
  { title: 'Mục tiêu', art: 'board', body: 'Giành nhiều điểm hơn đối thủ. Hãy ăn hai quan lớn và càng nhiều dân nhỏ càng tốt. Mỗi dân được 1 điểm và mỗi quan được 10 điểm.' },
  { title: 'Lượt của bạn', art: 'tap', body: 'Chạm vào một ô của bạn có dân, rồi chọn hướng bằng nút, hoặc vuốt trái hay phải từ ô đó. Toàn bộ dân trong ô được nhấc lên và rải từng viên vào các ô phía trước.' },
  { title: 'Rải tiếp', art: 'relay', body: 'Khi viên cuối cùng rơi xuống và ô kế tiếp có dân, hãy nhấc hết dân ở ô đó lên và rải tiếp. Lượt của bạn kéo dài cho đến khi việc rải gặp ô trống hoặc ô quan.' },
  { title: 'Ăn dân', art: 'capture', body: 'Khi sau viên cuối cùng là một ô trống, và ô tiếp theo có dân, bạn ăn toàn bộ số dân đó. Cứ thế tiếp tục: nếu sau đó lại là một ô trống rồi một ô có dân, bạn ăn tiếp.' },
  { title: 'Ăn quan', art: 'quan', body: 'Quan lớn nằm ở hai ô đầu bàn. Ăn ô quan thì bạn được quan cùng mọi dân nhỏ trong ô. Quan non có dưới 5 dân được bảo vệ, trừ khi bạn tắt luật này.' },
  { title: 'Hết dân', art: 'borrow', body: 'Nếu đến lượt mà năm ô của bạn đều trống, bạn lấy năm dân đã ăn để rải mỗi ô một viên. Nếu có chưa đủ năm, bạn mượn thêm, và khoản nợ được trừ khi tính điểm cuối.' },
  { title: 'Gợi ý và Học chơi', art: 'think', body: 'Gợi ý cho bạn nước đi tốt nhất và giải thích lý do. Học chơi là loạt bài ngắn với các thế cờ thật, còn Xem và học tự chơi cả ván cho bạn xem, giải thích từng nước.' },
];

// ------------------------------------------------------------------------------------------------ Rules
const CAL = { en: '', vi: '' };
export const setCalibration = (en, vi) => { CAL.en = en; CAL.vi = vi; };

const rulesEn = () => [
  { title: 'The board', art: 'board', body: [
    'The board is a long rectangle of twelve squares in a ring. Ten are small squares in two rows of five. The other two are large semicircular mandarin squares, one at each end.',
    'The bottom row belongs to Player 1 and the top row to Player 2. Against the computer you are the bottom row if you play first, the top row if you play second. The mandarin squares belong to nobody.',
  ] },
  { title: 'The stones', art: 'setup', body: [
    `Each small square starts with ${START_DAN} small stones (dân, "citizens"): fifty in all. Each mandarin square starts with one large mandarin stone (quan) and no small stones.`,
    'A small stone is worth 1 point. A mandarin is worth 10 points; in the rule options you can make it 5. Players\' final points are the stones and mandarins they have captured.',
  ] },
  { title: 'Your turn: pick and sow', art: 'turn', body: [
    'Choose one of your five small squares that holds stones, and a direction: left or right along the board. Pick up every stone in it and drop them one by one into the next squares in that direction, one stone per square, going on around the ring (through the mandarin squares too).',
    'You may never start from a mandarin square or from the opponent\'s squares, and never from an empty square. The turn then continues by the rules on the next pages.',
  ] },
  { title: 'Relay sowing', art: 'relay', body: [
    'After the last stone is dropped, look at the next square in the same direction. If it is a small square that holds stones, pick up all of them and sow them on in the same direction. This repeats for as long as the next square is a full small square.',
    'It makes no difference whose side the squares are on: you pick up from either row. A very long relay is possible; the engine stops a relay after 120 pick-ups so a turn can never run forever.',
  ] },
  { title: 'When the turn ends', art: 'stop', body: [
    'Your turn ends, without a capture, when the last stone is followed by a mandarin square (full or empty), or by an empty small square that is followed by another empty square or by a protected young mandarin.',
    'Play then passes to the opponent. Nothing is lost: the stones you sowed stay where they fell.',
  ] },
  { title: 'Capturing', art: 'capture', body: [
    'When the last stone is followed by an empty small square, and the square after that holds stones (or a capturable mandarin), you capture everything in that square. The captured stones go to your pile and count for you at the end.',
    'The empty square you jumped is left empty. After a capture your turn is over, unless the chain on the next page applies.',
  ] },
  { title: 'Chain captures', art: 'chain', body: [
    'After a capture, look at the square just beyond the one you took. If that square is an empty small square and the one after it holds stones, you capture those too, and so on.',
    'The chain stops when the square beyond a capture is a full square, a mandarin square, or an empty square followed by another empty one. A chain may capture a mandarin on the way.',
  ] },
  { title: 'The mandarins', art: 'quan', body: [
    'Capture a mandarin square the same way as any other: it must lie two squares beyond your last stone with an empty small square between. You win the mandarin stone and every small stone that has been sown into its square. A mandarin square whose mandarin is already gone can still be captured for the small stones in it.',
    `The game ends the moment the second mandarin is captured. A mandarin square that holds fewer than ${YOUNG_MIN} small stones is called a young mandarin (quan non). With the default rule option it is protected: it cannot be captured, and the turn simply ends there. Turn the option off in Rule options to capture it at any time.`,
  ] },
  { title: 'Running out of stones', art: 'borrow', body: [
    `If at the start of your turn all five of your small squares are empty, you must put one stone in each of them, taking ${5} from your captured stones. That refill is your whole preparation: your turn then goes on as normal.`,
    'If your captured stones are fewer than five, you borrow the rest from the opponent. Your total goes below zero for a while, and that debt is simply repaid in the final count.',
  ] },
  { title: 'How a game ends', art: 'end', body: [
    'The game ends when both mandarins have been captured. Every small stone still on a player\'s side goes to that player. Small stones in a mandarin square whose mandarin was captured go to whoever captured it.',
    `The player with more points wins; equal points are a draw. There is also a safety limit of ${MAX_PLIES} turns: if the game is still going, it ends the same way, and a mandarin still on the board counts for nobody.`,
  ] },
  { title: 'Rule options and variants', art: 'options', body: [
    'Ô ăn quan is played slightly differently from family to family and region to region. This game documents its choices and lets you change two. Mandarin value: 10 points (the default) or 5. Young mandarin: protected (the default) or not.',
    'Fixed in this game: a sowing that ends before a mandarin square always ends the turn, even if that square holds stones; chain captures are on; and a player with an empty side refills from their winnings. Other versions of the game allow three or four players, which this game does not.',
  ] },
  { title: 'Making a move', art: 'tap', body: [
    'Tap one of your squares that holds stones. It lifts and glows, and two buttons appear under the board: Sow left and Sow right. Tap one to play. Instead you can swipe left or right starting on the square. Tapping the square again cancels. Tapping an empty or an opponent square flashes it and does nothing.',
    'On a keyboard use the arrow keys to move between your squares, Enter or Space to select, then Left or Right to sow, U for Undo, T for Think, R for Restart and Escape or P to pause.',
  ] },
  { title: 'Think and Undo', art: 'think', body: [
    'Think searches six turns ahead, lights the square and direction it likes best, and gives the reason with numbers it has just worked out: how many points the move captures, and the most the opponent can take in answer. It never moves for you and is free.',
    'Undo takes back your last move and the computer\'s answer, so it is your turn again. Your game is saved after every move: Continue game on the menu resumes it, paused.',
  ] },
  { title: 'Opponents', art: 'levels', body: [
    'Novice plays any legal move. Casual searches one turn ahead but plays a random move three times in ten. Club looks two turns ahead and slips one time in ten. Expert looks four turns ahead and Master eight, and neither ever plays a random move.',
    `${CAL.en} In two-player mode both players share the phone and the active row glows.`,
  ] },
  { title: 'Learn and Watch & Learn', art: 'learn', body: [
    'Learn is a course of six lessons: capture, relay, chain, take the mandarin, defend and a whole game. A wrong move is not played: you are told why and can try again.',
    'Watch & Learn plays two whole games with THINK (2, 5, 8 or 10 seconds), REVEAL (two seconds: the possible squares light up and the chosen square and direction are marked, with the reason in words) and ACT (the stones are sown). Pause freezes everything where it is.',
  ] },
  { title: 'Language, boards and text', art: 'themes', body: [
    'Play in English or Chơi bằng tiếng Việt is a real choice on the first launch and on the main menu: every screen, rule and hint is written in both languages.',
    'Settings offers two boards (Lacquer & Gold, Bamboo & Jade), sound, the Watch & Learn think time and text size up to 300 percent on every text screen, including the game screen. There are no timers; the free preview is the first 90 seconds of real play.',
  ] },
];

const rulesVi = () => [
  { title: 'Bàn cờ', art: 'board', body: [
    'Bàn cờ là một hình chữ nhật dài gồm mười hai ô nối thành vòng. Mười ô nhỏ chia thành hai hàng, mỗi hàng năm ô. Hai ô còn lại là ô quan lớn hình bán nguyệt ở hai đầu.',
    'Hàng dưới thuộc người chơi 1 và hàng trên thuộc người chơi 2. Khi đấu với máy, bạn ở hàng dưới nếu đi trước và ở hàng trên nếu đi sau. Hai ô quan không thuộc về ai.',
  ] },
  { title: 'Các viên sỏi', art: 'setup', body: [
    `Mỗi ô nhỏ có ${START_DAN} viên dân nhỏ lúc bắt đầu: tổng cộng năm mươi dân. Mỗi ô quan có một viên quan lớn và không có dân.`,
    'Mỗi dân được 1 điểm. Mỗi quan được 10 điểm; trong tùy chọn luật bạn có thể đặt là 5. Điểm cuối cùng của mỗi người là số dân và quan đã ăn.',
  ] },
  { title: 'Lượt của bạn: nhấc và rải', art: 'turn', body: [
    'Chọn một trong năm ô nhỏ của bạn có dân và một hướng: trái hoặc phải dọc bàn cờ. Nhấc toàn bộ dân trong ô và rải từng viên vào các ô kế tiếp theo hướng đó, mỗi ô một viên, đi tiếp quanh vòng (kể cả qua các ô quan).',
    'Bạn không bao giờ được bắt đầu từ ô quan, ô của đối thủ hay ô trống. Sau đó lượt đi tiếp tục theo các luật ở những trang sau.',
  ] },
  { title: 'Rải tiếp', art: 'relay', body: [
    'Sau khi rải viên cuối cùng, nhìn ô kế tiếp theo cùng hướng. Nếu đó là ô nhỏ có dân, hãy nhấc hết dân và rải tiếp theo cùng hướng. Việc này lặp lại chừng nào ô kế tiếp còn là ô nhỏ có dân.',
    'Không quan trọng ô thuộc bên nào: bạn nhấc dân ở cả hai hàng. Một chuỗi rải rất dài là có thể xảy ra; bộ máy dừng chuỗi sau 120 lần nhấc để một lượt không bao giờ kéo dài vô tận.',
  ] },
  { title: 'Khi lượt kết thúc', art: 'stop', body: [
    'Lượt của bạn kết thúc mà không ăn được gì khi sau viên cuối cùng là ô quan (có hay không có dân), hoặc là một ô nhỏ trống mà phía sau lại là một ô trống nữa hoặc một quan non được bảo vệ.',
    'Lượt chuyển sang đối thủ. Bạn không mất gì: các viên đã rải vẫn nằm nguyên chỗ rơi.',
  ] },
  { title: 'Ăn dân', art: 'capture', body: [
    'Khi sau viên cuối cùng là một ô nhỏ trống, và ô tiếp theo có dân (hoặc một quan có thể ăn), bạn ăn toàn bộ trong ô đó. Số dân ăn được vào phần của bạn và được tính điểm khi kết thúc.',
    'Ô trống bạn nhảy qua vẫn để trống. Sau khi ăn, lượt của bạn kết thúc, trừ khi áp dụng chuỗi ăn ở trang sau.',
  ] },
  { title: 'Ăn liên tiếp', art: 'chain', body: [
    'Sau khi ăn, nhìn ô ngay phía sau ô vừa ăn. Nếu đó là ô nhỏ trống và ô kế tiếp có dân, bạn ăn luôn ô đó, cứ thế tiếp tục.',
    'Chuỗi dừng khi ô phía sau là ô có dân, ô quan, hoặc ô trống mà sau đó lại trống. Chuỗi ăn có thể ăn cả quan trên đường đi.',
  ] },
  { title: 'Các ô quan', art: 'quan', body: [
    'Ăn ô quan giống như ăn mọi ô khác: nó phải nằm cách viên cuối cùng hai ô, với một ô nhỏ trống ở giữa. Bạn được viên quan và mọi dân đã rải vào ô đó. Ô quan đã mất quan vẫn ăn được để lấy số dân trong ô.',
    `Ván đấu kết thúc ngay khi quan thứ hai bị ăn. Ô quan có dưới ${YOUNG_MIN} dân gọi là quan non. Với tùy chọn mặc định, quan non được bảo vệ: không ăn được và lượt chỉ đơn giản kết thúc ở đó. Hãy tắt tùy chọn trong phần Tùy chọn luật để ăn được quan non bất cứ lúc nào.`,
  ] },
  { title: 'Hết dân', art: 'borrow', body: [
    'Nếu đến lượt mà cả năm ô nhỏ của bạn đều trống, bạn phải rải vào mỗi ô một viên, lấy năm viên từ số dân đã ăn. Việc rải lại này là toàn bộ sự chuẩn bị: sau đó lượt đi diễn ra bình thường.',
    'Nếu số dân đã ăn ít hơn năm, bạn mượn phần còn thiếu của đối thủ. Tổng điểm của bạn tạm thời xuống dưới không, và khoản nợ đó đơn giản được trả khi tính điểm cuối.',
  ] },
  { title: 'Kết thúc ván', art: 'end', body: [
    'Ván đấu kết thúc khi cả hai quan đã bị ăn. Mọi dân còn trên phần của mỗi người thuộc về người đó. Dân trong ô quan đã bị ăn thuộc về người đã ăn quan ấy.',
    `Người nhiều điểm hơn thắng; bằng điểm là hòa. Ngoài ra có giới hạn an toàn ${MAX_PLIES} lượt: nếu ván vẫn chưa xong thì kết thúc theo cách tương tự, và quan còn trên bàn không tính cho ai.`,
  ] },
  { title: 'Tùy chọn luật và biến thể', art: 'options', body: [
    'Ô ăn quan được chơi hơi khác nhau giữa các gia đình và các vùng. Trò chơi này ghi rõ các lựa chọn của mình và cho phép đổi hai điều. Giá trị quan: 10 điểm (mặc định) hoặc 5. Quan non: được bảo vệ (mặc định) hoặc không.',
    'Cố định trong trò chơi này: việc rải kết thúc trước ô quan luôn kết thúc lượt, kể cả khi ô quan có dân; có ăn liên tiếp; và người hết dân sẽ rải lại từ phần đã ăn. Một số phiên bản khác cho ba hoặc bốn người chơi, trò chơi này thì không.',
  ] },
  { title: 'Cách đi', art: 'tap', body: [
    'Chạm vào một ô của bạn có dân. Ô nhấc lên và sáng, và hai nút hiện dưới bàn cờ: Rải sang trái và Rải sang phải. Chạm một nút để đi. Hoặc bạn có thể vuốt trái hay phải bắt đầu từ ô đó. Chạm lại ô để hủy. Chạm vào ô trống hoặc ô đối thủ thì ô nháy đỏ và không có gì xảy ra.',
    'Trên bàn phím dùng phím mũi tên để chuyển giữa các ô, Enter hoặc Space để chọn, rồi Trái hoặc Phải để rải, U để hoàn tác, T để gợi ý, R để chơi lại và Escape hoặc P để tạm dừng.',
  ] },
  { title: 'Gợi ý và Hoàn tác', art: 'think', body: [
    'Gợi ý tính trước sáu lượt, làm sáng ô và hướng mà nó thích nhất, rồi nêu lý do bằng những con số vừa tính: nước đi ăn được bao nhiêu điểm và đối thủ đáp trả được nhiều nhất bao nhiêu. Nó không bao giờ đi thay bạn và miễn phí.',
    'Hoàn tác lấy lại nước đi của bạn và nước đáp trả của máy để bạn đi lại. Ván của bạn được lưu sau mỗi nước: nút Chơi tiếp ở menu mở lại ván, ở trạng thái tạm dừng.',
  ] },
  { title: 'Đối thủ', art: 'levels', body: [
    'Người mới đi một nước hợp lệ bất kỳ. Vui vẻ tính trước một lượt nhưng ba lần trong mười đi bừa. Khá nhìn trước hai lượt và mười lần sai một lần. Cao thủ nhìn trước bốn lượt và Đại sư tám lượt, hai mức này không bao giờ đi bừa.',
    `${CAL.vi} Ở chế độ hai người, cả hai dùng chung điện thoại và hàng đang đến lượt sẽ sáng lên.`,
  ] },
  { title: 'Học chơi và Xem và học', art: 'learn', body: [
    'Học chơi gồm sáu bài: ăn dân, rải tiếp, ăn liên tiếp, ăn quan, phòng thủ và một ván đầy đủ. Nước đi sai sẽ không được đi: bạn được giải thích lý do và có thể thử lại.',
    'Xem và học tự chơi hai ván đầy đủ với NGHĨ (2, 5, 8 hoặc 10 giây), HIỆN (hai giây: các ô có thể đi sáng lên và ô, hướng được chọn được đánh dấu, kèm lý do bằng lời) và ĐI (dân được rải). Tạm dừng làm đứng yên mọi thứ.',
  ] },
  { title: 'Ngôn ngữ, bàn cờ và chữ', art: 'themes', body: [
    'Chơi bằng tiếng Việt hay Play in English là lựa chọn thật sự ở lần mở đầu tiên và ở menu chính: mọi màn hình, luật và gợi ý đều có cả hai ngôn ngữ.',
    'Cài đặt có hai bàn cờ (Sơn mài và vàng, Tre và ngọc), âm thanh, thời gian suy nghĩ khi xem và cỡ chữ tới 300 phần trăm ở mọi màn hình có chữ, kể cả màn hình chơi. Không có đồng hồ bấm giờ; bản chơi thử là 90 giây chơi thật đầu tiên.',
  ] },
];

export const howtoPages = () => (LANG === 'vi' ? HOWTO_VI : HOWTO_EN);
export const rulesPages = () => (LANG === 'vi' ? rulesVi() : rulesEn());
export const RULE_COUNT = rulesEn().length;
export const HOWTO_COUNT = HOWTO_EN.length;

export const aboutSections = () => (LANG === 'vi' ? [
  { title: 'Ô Ăn Quan', body: 'Trò chơi sỏi cổ truyền của trẻ em Việt Nam, được làm lại với bàn gỗ sơn mài, sỏi sáng bóng và những hạt dân rải từng viên theo chuyển động mượt mà.' },
  { title: 'Nguồn gốc', body: 'Ô ăn quan là trò chơi dân gian của trẻ em Việt Nam, thuộc họ trò chơi rải hạt (mancala) trên thế giới. Trẻ em thường vẽ bàn cờ xuống đất hoặc lên sân bằng phấn hay que và chơi bằng sỏi, hạt hoặc hột trái cây. Luật hơi khác nhau giữa các vùng và các gia đình. "Ô" là ô vuông, "ăn" là bắt lấy, "quan" là vị quan, và "dân" là người dân.' },
  { title: 'Trong trò chơi này', body: 'Bàn mười hai ô, hai viên quan, năm mươi dân. Rải sang trái hoặc phải, rải tiếp, ăn liên tiếp, mượn dân khi hết, hai tùy chọn luật. Năm mức đối thủ từ Người mới tới Đại sư, hai người trên một điện thoại, Gợi ý có giải thích bằng lời, sáu bài học và Xem và học. Hai bàn cờ, cỡ chữ lên tới 300 phần trăm, không có đồng hồ, chơi được khi không có mạng. Mọi chữ có cả tiếng Anh và tiếng Việt.' },
] : [
  { title: 'Ô Ăn Quan', body: 'The traditional Vietnamese children\'s pebble game, rebuilt with a lacquered wooden board, polished stones and sowing that flows one stone at a time.' },
  { title: 'Where it comes from', body: 'Ô ăn quan is a folk game of Vietnamese children and belongs to the worldwide mancala family of sowing games. Children traditionally draw the board on the ground or pavement with chalk or a stick and play with pebbles, seeds or fruit stones. The rules differ a little from region to region and family to family. "Ô" means a square, "ăn" to eat or capture, "quan" a mandarin (an official), and "dân" a citizen.' },
  { title: 'In this game', body: 'A board of twelve squares, two mandarin stones and fifty small stones. Sow left or right, relay, chain captures, borrowing when you run out, and two rule options. Five opponent levels from Novice to Master, two players on one phone, Think with a reason in words, six lessons and Watch & Learn. Two boards, text that scales up to 300 percent, no timers, works offline. Every word is in English and in Vietnamese.' },
]);
