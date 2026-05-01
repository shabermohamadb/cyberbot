const { updateUser, readData } = require('./dataStore');

const ACHIEVEMENTS = [
  { key: 'beginner', name: 'Beginner', condition: (u) => u.streak >= 3 },
  { key: 'consistent', name: 'Consistent', condition: (u) => u.streak >= 5 },
  { key: 'discipline_master', name: 'Discipline Master', condition: (u) => u.streak >= 10 },
  { key: '100_club', name: '100 Club', condition: (u) => (u.progressPoints || 0) >= 100 }
];

async function checkAchievements(userId) {
  const data = await readData();
  const user = data.users[userId];
  if (!user) return [];
  const newly = [];
  user.achievements = user.achievements || [];
  for (const a of ACHIEVEMENTS) {
    if (a.condition(user) && !user.achievements.includes(a.key)) {
      user.achievements.push(a.key);
      newly.push(a);
    }
  }
  await updateUser(userId, { achievements: user.achievements });
  return newly;
}

module.exports = { ACHIEVEMENTS, checkAchievements };
