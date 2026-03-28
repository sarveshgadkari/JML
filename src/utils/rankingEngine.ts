export interface LawyerStats {
  wins: number;
  losses: number;
  settlements: number;
  avgHearings: number;
  avgDurationDays: number;
}

export interface TriFactorRank {
  winRateScore: number;    // 0-100: Quality of outcomes (Bayesian smoothed)
  experienceScore: number; // 0-100: Volume of cases (Logarithmic)
  velocityScore: number;   // 0-100: Speed of resolution (Weighted by success)
}

// Tribunal Constants (Can be dynamic later based on court selected)
const TRIBUNAL_AVG_HEARINGS = 6;
const TRIBUNAL_AVG_DURATION = 200;

export function calculateTriFactorRank(stats: LawyerStats): TriFactorRank {
  const { wins, losses, settlements, avgHearings, avgDurationDays } = stats;
  const totalCases = wins + losses + settlements;

  if (totalCases === 0) {
    return { winRateScore: 0, experienceScore: 0, velocityScore: 0 };
  }

  // ---------------------------------------------------------
  // 1. WIN RATE SCORE (Bayesian Smoothing / Laplace Estimate)
  // Prevents a 1/1 (100%) from beating a 98/100 (98%).
  // Formula: (Wins + 1) / (TotalCases + 2) * 100
  // ---------------------------------------------------------
  // Note: We count settlements as half-wins for the sake of quality scoring
  const effectiveWins = wins + settlements * 0.5;
  const rawWinRateScore = ((effectiveWins + 1) / (totalCases + 2)) * 100;
  const winRateScore = Math.min(100, Math.round(rawWinRateScore));

  // ---------------------------------------------------------
  // 2. EXPERIENCE SCORE (Logarithmic Curve)
  // Maps case volume to a 0-100 scale.
  // ~10 cases = 50, ~100 cases = 80, ~500+ cases = 95-100
  // ---------------------------------------------------------
  const experienceScoreRaw = (Math.log10(totalCases + 1) / 3) * 100;
  const experienceScore = Math.min(100, Math.round(experienceScoreRaw));

  // ---------------------------------------------------------
  // 3. VELOCITY (SPEED) SCORE
  // Rewards lower hearings and lower duration compared to tribunal average.
  // ---------------------------------------------------------
  // Baseline is 50 points. If they take exactly the average time, they get 50.
  // If they are twice as fast, they get 100. If twice as slow, they get 0.
  const hearingEfficiency = Math.max(0, 100 - ((avgHearings / TRIBUNAL_AVG_HEARINGS) * 50));
  const durationEfficiency = Math.max(0, 100 - ((avgDurationDays / TRIBUNAL_AVG_DURATION) * 50));
  const rawVelocity = (hearingEfficiency + durationEfficiency) / 2;

  // CRITICAL: Multiply by win rate. A lawyer who instantly loses in 1 day shouldn't be ranked as "Fastest".
  // Speed is only rewarded if it yields a positive outcome.
  const trueWinPercentage = wins / totalCases;
  const velocityScore = Math.min(100, Math.round(rawVelocity * (trueWinPercentage + 0.2))); // +0.2 buffer so settlements don't completely kill speed score

  return {
    winRateScore,
    experienceScore,
    velocityScore,
  };
}

