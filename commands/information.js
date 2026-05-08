const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { updateGuild } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('information')
    .setDescription('Schedule or send daily technical information for students')
    .addStringOption(o => o.setName('time').setDescription('HH:MM (24h) e.g. 10:00').setRequired(false))
    .addChannelOption(o => o.setName('channel').setDescription('Text channel to post information in').setRequired(false))
    .addBooleanOption(o => o.setName('now').setDescription('Send the information now (ignore scheduling)')),
  async execute(interaction) {
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Admin only', ephemeral: true });
    }
    const time = interaction.options.getString('time');
    const channel = interaction.options.getChannel('channel');
    const nowSend = interaction.options.getBoolean('now');
    try { await interaction.deferReply({ ephemeral: true }); } catch (e) {}
    const INFO = [
      "A program is a set of instructions executed by a computer.",
      "Source code is written by developers in programming languages.",
      "Machine code is binary executed directly by the CPU.",
      "Compilers convert code into machine language before execution.",
      "Interpreters execute code line by line.",
      "JavaScript is a high-level, interpreted language.",
      "Python emphasizes readability and simplicity.",
      "C is a low-level, high-performance programming language.",
      "Java uses a virtual machine (JVM) for portability.",
      "TypeScript adds static typing to JavaScript.",
      "Variables store data in memory.",
      "Constants cannot be reassigned after initialization.",
      "Data types define the kind of data stored.",
      "Primitive types include number, string, boolean.",
      "Reference types include objects and arrays.",
      "Functions encapsulate reusable logic.",
      "Arrow functions provide shorter syntax in JS.",
      "Closures allow access to outer scope variables.",
      "Scopes control variable visibility.",
      "Global scope is accessible everywhere.",
      "Local scope is limited to a block or function.",
      "Hoisting moves declarations to the top.",
      "Callbacks are functions passed as arguments.",
      "Promises handle async operations.",
      "Async/await simplifies asynchronous code.",
      "Event-driven programming reacts to events.",
      "The event loop manages async execution in JS.",
      "Threads allow parallel execution.",
      "Single-threaded means one task at a time.",
      "Multithreading improves performance.",
      "Arrays store ordered collections.",
      "Linked lists store elements as nodes.",
      "Stacks follow LIFO principle.",
      "Queues follow FIFO principle.",
      "Trees represent hierarchical data.",
      "Graphs represent networks of nodes.",
      "Hash maps store key-value pairs efficiently.",
      "Sorting arranges data in order.",
      "Searching finds specific elements.",
      "Binary search works on sorted data.",
      "Algorithms solve computational problems.",
      "Time complexity measures speed.",
      "Space complexity measures memory usage.",
      "Big-O notation describes performance.",
      "O(1) is constant time.",
      "O(n) is linear time.",
      "O(log n) is logarithmic time.",
      "O(n^2) is quadratic time.",
      "Recursion solves problems via self-calls.",
      "Base case stops recursion.",
      "Iteration uses loops to repeat tasks.",
      "For loops run a fixed number of times.",
      "While loops run until a condition fails.",
      "Do-while runs at least once.",
      "Break exits loops early.",
      "Continue skips to next iteration.",
      "Debugging finds and fixes errors.",
      "Syntax errors break code execution.",
      "Runtime errors occur during execution.",
      "Logical errors produce wrong results.",
      "Version control tracks code changes.",
      "Git is the most popular VCS.",
      "Repositories store project files.",
      "Commits save snapshots of code.",
      "Branches allow parallel development.",
      "Merging combines branches.",
      "Pull requests review changes.",
      "CI/CD automates testing and deployment.",
      "Build systems compile and bundle code.",
      "Package managers install dependencies.",
      "NPM manages JavaScript packages.",
      "APIs enable software communication.",
      "REST APIs use HTTP methods.",
      "GraphQL allows flexible queries.",
      "Endpoints define API routes.",
      "JSON is used for data exchange.",
      "XML is another data format.",
      "Authentication verifies identity.",
      "JWT is used for secure auth.",
      "OAuth enables third-party login."
    ];

    if (nowSend) {
      let target = channel || interaction.channel;
      if (!target) return interaction.editReply('Cannot determine target channel to send information.');
      const data = await require('../utils/dataStore').readData();
      const g = data.guilds && data.guilds[interaction.guild.id];
      const lastIndex = g && g.lastInfoIndex;
      let idx = Math.floor(Math.random() * INFO.length);
      if (INFO.length > 1 && idx === lastIndex) idx = (idx + 1) % INFO.length;
      const info = INFO[idx];
      const todayKey = new Date().toISOString().slice(0,10);
      const topic = (info.split(':')[0] || 'General').trim();
      const tip = info.replace(/^\s*[^:]+:\s*/, '').trim();
      const embed = new EmbedBuilder()
        .setTitle('📢 DAILY TECH INSIGHT')
        .setColor(0x00d9ff)
        .setDescription([`🧠 Topic:\n\`${topic}\``, '', `💡 Insight:\n> ${tip}`, '', '🚀 Small knowledge daily = huge growth.'].join('\n'))
        .setFooter({ text: '⚡ Zenith Learning System' })
        .setTimestamp();
      await target.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
      await updateGuild(interaction.guild.id, { lastInfoDate: todayKey, lastInfoIndex: idx });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x00d9ff).setDescription('Information sent.')] });
    }

    if (!time || !channel) return interaction.editReply('To schedule info, provide both `time` and `channel`.');
    await updateGuild(interaction.guild.id, { infoSchedule: { time, channelId: channel.id } });

    const embed = new EmbedBuilder()
      .setTitle('✅ Information Scheduled')
      .setDescription(`Daily technical info set at **${time}** in <#${channel.id}>`)
      .setColor(0x7B61FF)
      .setTimestamp();

    try { await interaction.editReply({ embeds: [embed] }); } catch (e) { await interaction.followUp({ content: 'Scheduled.', ephemeral: true }); }
  }
};
