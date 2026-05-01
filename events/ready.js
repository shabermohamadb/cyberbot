module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    // start cron jobs after client is ready
    try {
      const { startCrons } = require('../utils/cron');
      startCrons(client);
      console.log('Cron started');
    } catch (e) {
      console.error('Failed to start crons', e);
    }
  }
};
