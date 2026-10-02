// The cord-whip gauge: shared by the play code and the Rules text.
export const GAUGE = { perfect: 0.05, good: 0.2, timeout: 3.2, period: 1.3, floor: 0.7 };
export const timingQuality = (n) => {
  const d = Math.abs(n - 0.5);
  if (d <= GAUGE.perfect) return 1;
  return 1 - (1 - GAUGE.floor) * Math.min(1, (d - GAUGE.perfect) / (0.5 - GAUGE.perfect));
};
