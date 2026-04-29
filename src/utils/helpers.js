// Format overs: 23 balls → "3.5" (3 overs 5 balls)
const formatOvers = (totalBalls, ballsPerOver = 6) => {
  const overs = Math.floor(totalBalls / ballsPerOver);
  const balls = totalBalls % ballsPerOver;
  return balls === 0 ? `${overs}.0` : `${overs}.${balls}`;
};

// Batting average: total_runs / (innings - not_outs)
const battingAverage = (runs, innings, notOuts) => {
  const dismissals = innings - notOuts;
  if (dismissals === 0) return runs > 0 ? 'N/A' : '0.00';
  return (runs / dismissals).toFixed(2);
};

// Strike rate: (runs / balls) * 100
const strikeRate = (runs, balls) =>
  balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00';

// Economy: runs / overs
const economy = (runs, totalBalls, ballsPerOver = 6) => {
  const overs = totalBalls / ballsPerOver;
  return overs > 0 ? (runs / overs).toFixed(2) : '0.00';
};

// Required run rate for 2nd innings
const requiredRunRate = (target, currentRuns, ballsRemaining, ballsPerOver = 6) => {
  const runsNeeded = target - currentRuns;
  if (runsNeeded <= 0) return '0.00';
  const oversRemaining = ballsRemaining / ballsPerOver;
  return oversRemaining > 0 ? (runsNeeded / oversRemaining).toFixed(2) : 'N/A';
};

// Build match result string
const buildResult = ({ winner, method, margin }) =>
  `${winner} won by ${margin} ${method}`;

module.exports = { formatOvers, battingAverage, strikeRate, economy, requiredRunRate, buildResult };
