const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { startQuiz } = require('../utils/quizManager');

// /quize - start a quick quiz in this channel
// Options:
//   time: number of seconds for the quiz (overrides fast)
//   fast: boolean - if true uses a shorter default (10s) for rapid play
// Fast quizzes reward more speed XP proportionally; use for quick practice rounds.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('quize')
    .setDescription('Start a quick quiz in this channel')
    .addIntegerOption(opt => opt.setName('time').setDescription('Quiz time limit in seconds'))
    .addBooleanOption(opt => opt.setName('fast').setDescription('Use fast mode (short timer)')),
  async execute(interaction) {
    try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }); } catch (e) { console.warn('deferReply failed (quize):', e && e.message); }
    const timeOpt = interaction.options.getInteger('time');
    const fast = interaction.options.getBoolean('fast');
    let seconds = parseInt(process.env.QUIZ_TIME_SECONDS || '30', 10);
    if (fast) seconds = 10; // fast default
    if (timeOpt && Number.isInteger(timeOpt) && timeOpt > 0) seconds = timeOpt;

    const guildId = interaction.guildId;
    const data = require('../utils/dataStore').readData;
    let targetChannel = interaction.channel;
    try {
      const d = await require('../utils/dataStore').readData();
      const g = d.guilds && d.guilds[guildId];
      if (g && g.questChannel) {
        const fetched = await interaction.client.channels.fetch(g.questChannel).catch(() => null);
        if (fetched) targetChannel = fetched;
      }
    } catch (e) { /* ignore */ }

    if (!targetChannel) return interaction.editReply('Cannot determine the channel to run the quiz in.');

    // If user has admin/manage guild permission, mention everyone to invite participation
    try {
      const member = interaction.member;
      if (member && (member.permissions.has(PermissionsBitField.Flags.Administrator) || member.permissions.has(PermissionsBitField.Flags.ManageGuild))) {
        await targetChannel.send({ content: `@everyone Quiz is live! You have ${seconds}s to answer.`, allowedMentions: { parse: ['everyone'] } });
      }
    } catch (e) { console.warn('Failed to send mention', e.message); }

    const active = await startQuiz(targetChannel, interaction.client, seconds).catch(() => null);
    if (!active) return interaction.editReply('A quiz is already running or could not fetch a question. Try again later.');

    const embed = new EmbedBuilder()
      .setTitle('Quiz Starting')
      .setDescription(`Quick quiz started — time limit: ${seconds}s`)
      .setColor(0x00AE86);

    await interaction.editReply({ embeds: [embed] });
  }
};
