function calcXP(difficulty, responseTime, baseSeconds = 30) {
  // difficulty: 'easy'|'medium'|'hard'
  const difficultyBase = { easy: 5, medium: 10, hard: 15 }[difficulty] || 5;
  const speedBonus = Math.max(0, Math.floor((baseSeconds - responseTime) / 3));
  return difficultyBase + speedBonus;
}

module.exports = { calcXP };
