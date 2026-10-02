// The Learn path: eight short lessons. Each is a real picture solved with Think available; `tech` is the solver technique
// the lesson teaches (the test checks the solver really uses it on that picture).
export const LESSONS = [
  { id: 'clues', puz: 'lesson:stripes', tech: ['full', 'zero'], art: 'clues', title: ['Reading clues', 'ヒントを読む'],
    intro: ['A number tells you how long a run of filled squares is. A clue of 5 in a line of 5 squares fills the whole line. A clue of 0 means every square is empty. Try the stripes: fill the rows marked 5 and cross out the rows marked 0.', '数字は塗られたマスの連続の長さを表します。5マスの線で「5」なら線全体を塗ります。「0」ならすべて空です。しましまで試しましょう。「5」の行を塗り、「0」の行にバツをつけます。'] },
  { id: 'overlap', puz: 'leaf', tech: ['overlap'], art: 'overlap', title: ['Overlap', '重なり'],
    intro: ['When a run has little room to slide, some squares are covered wherever it goes. Slide it fully left, then fully right: the squares in both positions are certain. Press Think to see an overlap in this picture.', '連続が動ける余地が少ないと、どこに置いても必ず通るマスが生まれます。いちばん左と右に置いてみて、両方に含まれるマスが確実なマスです。「ヒント」でこの絵の重なりを見てみましょう。'] },
  { id: 'edge', puz: 'tulip', tech: ['edge'], art: 'edge', title: ['Edges', '端'],
    intro: ['A filled square at the end of a line must start the first run (or finish the last one). Fill the rest of that run and cross out the square after it. Look for filled squares on the border.', '線の端の塗られたマスは、最初（または最後）の連続のはじまりです。その連続の残りを塗り、後ろのマスにバツをつけます。縁にある塗られたマスを探しましょう。'] },
  { id: 'gap', puz: 'teapot', tech: ['gap'], art: 'gap', title: ['Gaps', 'すき間'],
    intro: ['If the open squares between two crosses are fewer than the smallest run left, nothing can go there: cross them out. Crossing out cleans the board and creates new edges.', '二つのバツの間の空きマスが、残っている最も短い連続より少なければ、何も入りません。バツをつけましょう。バツで盤面が整理され、新しい端が生まれます。'] },
  { id: 'done', puz: 'cherries', tech: ['complete', 'zero'], art: 'done', title: ['Finished lines', '完成した線'],
    intro: ['When a line has all its runs, cross out the rest of it. Finished clues fade and turn green so you can see what is left to do.', '線のすべての連続がそろったら、残りにバツをつけます。完成したヒントは薄く緑色になり、残りの作業がわかります。'] },
  { id: 'count', puz: 'castle', tech: ['full'], art: 'example', title: ['Counting squares', 'マスを数える'],
    intro: ['Add the runs and one gap between each pair. If the total is the length of the line, there is only one arrangement. Count first; it often solves a line at once.', '連続の合計と、連続の間の空き一つずつを足します。合計が線の長さと同じなら、置き方は一通りです。まず数えると、一気に解けることがよくあります。'] },
  { id: 'combine', puz: 'fox', tech: ['overlap', 'edge'], art: 'sample', title: ['Rows and columns together', '行と列を組み合わせる'],
    intro: ['Every square lies in a row and a column. A square you find in one line becomes a clue for the other. Work back and forth: when a line is stuck, switch to a crossing line.', 'どのマスも行と列の両方に属します。ある線で見つけたマスは、交わる線の手がかりになります。行き詰まったら、交わる線に切り替えましょう。'] },
  { id: 'big', puz: 'starfish', tech: ['overlap'], art: 'bigboard', title: ['A bigger picture', '少し大きな絵'],
    intro: ['Now a 10 by 10 picture. Use every technique, ask Think when you want a nudge, and use Zoom if you need larger squares. A finished picture is the best lesson.', '10×10の絵です。ここまでの技をすべて使い、ほしいときは「ヒント」を使いましょう。大きな盤面では「拡大」も使えます。完成させるのが一番の練習です。'] },
];
