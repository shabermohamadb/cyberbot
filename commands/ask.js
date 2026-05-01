const { SlashCommandBuilder } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');
const cooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder().setName('ask').setDescription('Ask the AI mentor a question').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    const uid = interaction.user.id;
    const now = Date.now();
    const cd = 10 * 1000; // 10s
    if (cooldowns.has(uid) && now - cooldowns.get(uid) < cd) return interaction.reply({ content: 'Please wait a few seconds before asking again.', ephemeral: true });
    cooldowns.set(uid, now);
    try {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
    } catch (e) { console.warn('deferReply failed (ask):', e && e.message); }
    if (!process.env.OPENAI_API_KEY) return interaction.editReply('OpenAI API key not configured.');
    const question = interaction.options.getString('question');
    try {
      const conf = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
      const openai = new OpenAIApi(conf);
      // Use a stable chat model; fall back will be handled by the API if unavailable
      const resp = await openai.createChatCompletion({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Explain this simply: ${question}` }],
        max_tokens: 500
      });
      const text = resp?.data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from AI');
      try { await interaction.editReply(text); } catch (e) { console.warn('editReply failed (ask):', e && e.message); }
    } catch (e) {
      console.error('OpenAI error', e?.response?.data || e.message || e);
      // Provide a concise user-facing error without leaking internals
      const short = e?.response?.data?.error?.message || e.message || 'Unknown error';
      try { await interaction.editReply({ content: `Error contacting AI: ${short}` }); } catch (er) { console.warn('editReply failed (ask error):', er && er.message); }
    }
  }
};
