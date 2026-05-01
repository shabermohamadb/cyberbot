const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { readData, updateUser, ensureUser } = require('../utils/dataStore');

const VALID_TYPES = ['progress', 'quiz'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addpoints')
    .setDescription('Add points to a user (admin only)')
    .addIntegerOption(o => o.setName('amount').setDescription('Amount of points to add').setRequired(true))
    .addUserOption(o => o.setName('user').setDescription('User to add points to').setRequired(true))
    .addStringOption(o => o.setName('type').setDescription('Type: progress or quiz').setRequired(false).addChoices(
      { name: 'progress', value: 'progress' },
      { name: 'quiz', value: 'quiz' }
    )),
  async execute(interaction) {
    // permission check
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '❌ You don’t have permission', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true }).catch(() => null);
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const type = interaction.options.getString('type') || 'progress';

    if (!user) return interaction.editReply('⚠️ Invalid user');
    if (!Number.isInteger(amount) || amount === 0) return interaction.editReply('⚠️ Enter valid number');
    if (!VALID_TYPES.includes(type)) return interaction.editReply('⚠️ Invalid type');

    try {
      await ensureUser(user.id);
      const data = await readData();
      const u = (data.users && data.users[user.id]) ? data.users[user.id] : {};
      let newProgress = u.progressPoints || 0;
      let newQuest = u.questPoints || 0;
      if (type === 'progress') {
        newProgress = newProgress + amount;
        await updateUser(user.id, { progressPoints: newProgress });
      } else if (type === 'quiz') {
        newQuest = newQuest + amount;
        await updateUser(user.id, { questPoints: newQuest });
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Points Added')
        .setDescription(`👤 User: <@${user.id}>\n💰 Points Added: +${amount}\n📊 Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`)
        .setFooter({ text: 'Admin action' })
        .setColor(0x00FF00)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error('addpoints error', e);
      return interaction.editReply('⚠️ Failed to add points');
    }
  }
};
