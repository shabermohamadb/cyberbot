const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { readData } = require('../utils/dataStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendnow')
    .setDescription('Force-send a scheduled message now (admin only)')
    .addStringOption(o => o.setName('type').setDescription('quote|info|learn').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member || !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Admin only', ephemeral: true });
    }
    const type = interaction.options.getString('type');
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const data = await readData();
    const g = data.guilds && data.guilds[interaction.guild.id];
    if (!g) return interaction.editReply('No guild configuration found.');

    try {
      if (type === 'quote') {
        const chId = g.quoteSchedule && g.quoteSchedule.channelId;
        if (!chId) return interaction.editReply('No quote channel configured.');
        const ch = await interaction.client.channels.fetch(chId).catch(() => null);
        if (!ch) return interaction.editReply('Cannot fetch quote channel.');
        const QUOTES = [
          "Small steps every day lead to big results.",
          "Consistency beats intensity — keep showing up.",
          "Learn a little, improve a lot. You've got this!",
          "Today +1% better than yesterday. Keep going.",
          "Progress is progress — celebrate small wins."
        ];
          const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
          const embed = new (require('discord.js').EmbedBuilder)()
            .setTitle('⚡ DAILY MOTIVATION')
            .setColor(0x00d9ff)
            .setDescription([`> ${q}`, '', '🔥 Stay disciplined.', '📚 Learn daily.', '🚀 Grow continuously.'].join('\n'))
            .setFooter({ text: '⚡ Zenith Learning System' })
            .setTimestamp();
          await ch.send({ embeds: [embed] }).catch(() => null);
          await require('../utils/dataStore').updateGuild(interaction.guild.id, { lastQuoteDate: new Date().toISOString().slice(0,10) });
          return interaction.editReply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(0x00d9ff).setDescription('Motivation sent.')] });
      }
      if (type === 'info') {
        const chId = g.infoSchedule && g.infoSchedule.channelId;
        if (!chId) return interaction.editReply('No info channel configured.');
        const ch = await interaction.client.channels.fetch(chId).catch(() => null);
        if (!ch) return interaction.editReply('Cannot fetch info channel.');
        const TECH_INFO = [
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
          "OAuth enables third-party login.",
          "Frontend handles UI and UX.",
          "Backend manages logic and databases.",
          "Full-stack developers handle both.",
          "HTML structures web pages.",
          "CSS styles web pages.",
          "JavaScript adds interactivity.",
          "React is a frontend library.",
          "Node.js runs JS on servers.",
          "Express is a Node.js framework.",
          "Databases store persistent data.",
          "SQL databases use structured tables.",
          "NoSQL databases are flexible.",
          "MongoDB is a NoSQL database.",
          "Indexes speed up queries.",
          "Normalization reduces redundancy.",
          "Caching improves performance.",
          "Redis is used for caching.",
          "Load balancing distributes traffic.",
          "Microservices split applications.",
          "Monolith is a single large system.",
          "Docker packages apps into containers.",
          "Kubernetes manages containers.",
          "Cloud computing provides scalability.",
          "AWS is a major cloud provider.",
          "Serverless runs code without servers.",
          "Virtual machines emulate hardware.",
          "Operating systems manage resources.",
          "Linux is widely used in servers.",
          "Windows is common for desktops.",
          "MacOS is Unix-based.",
          "Encryption secures data.",
          "Hashing creates fixed-length values.",
          "HTTPS ensures secure communication.",
          "Firewalls protect networks.",
          "VPN secures internet traffic.",
          "Latency is network delay.",
          "Bandwidth is data capacity.",
          "CDN speeds up content delivery.",
          "DNS resolves domain names.",
          "IP addresses identify devices.",
          "Unit testing tests individual parts.",
          "Integration testing tests modules together.",
          "E2E testing tests full workflows.",
          "Test automation saves time.",
          "Refactoring improves code structure.",
          "Clean code improves readability.",
          "Design patterns solve common problems.",
          "MVC separates concerns.",
          "Agile is iterative development.",
          "Scrum is a popular Agile framework."
        ];
        const info = TECH_INFO[Math.floor(Math.random() * TECH_INFO.length)];
        const topic = (info.split(':')[0] || 'General').trim();
        const tip = info.replace(/^\s*[^:]+:\s*/, '').trim();
        const embed = new (require('discord.js').EmbedBuilder)()
          .setTitle('📢 DAILY TECH INSIGHT')
          .setColor(0x00d9ff)
          .setDescription([`🧠 Topic:\n\`${topic}\``, '', `💡 Insight:\n> ${tip}`, '', '🚀 Small knowledge daily = huge growth.'].join('\n'))
          .setFooter({ text: '⚡ Zenith Learning System' })
          .setTimestamp();
        await ch.send({ embeds: [embed] }).catch(() => null);
        await require('../utils/dataStore').updateGuild(interaction.guild.id, { lastInfoDate: new Date().toISOString().slice(0,10) });
        return interaction.editReply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(0x00d9ff).setDescription('Information sent.')] });
      }
      if (type === 'learn') {
        const announceId = g.vcReminder && g.vcReminder.announceChannelId ? g.vcReminder.announceChannelId : null;
        const targetChId = announceId || g.progressChannel || g.questChannel;
        if (!targetChId) return interaction.editReply('No target channel configured for daily learning.');
        const ch = await interaction.client.channels.fetch(targetChId).catch(() => null);
        if (!ch) return interaction.editReply('Cannot fetch target channel.');
        const vcMention = g.vcReminder && g.vcReminder.channelId ? `<#${g.vcReminder.channelId}>` : '';
        const embed = new (require('discord.js').EmbedBuilder)()
          .setTitle('🔥 DAILY LEARNING TIME!')
          .setColor(0x00d9ff)
          .setDescription([`⏳ Time: ${g.dailyLearnTime || 'now'}`, `Join VC: ${vcMention}`, 'Duration: 10 minutes', '', '💡 Just 10 minutes daily can change your future.'].join('\n'))
          .setFooter({ text: '⚡ Zenith Learning System' })
          .setTimestamp();
        await ch.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => null);
        return interaction.editReply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(0x00d9ff).setDescription('Daily learning announcement sent.')] });
      }
      return interaction.editReply('Unknown type. Use quote|info|learn');
    } catch (e) {
      console.error('sendnow failed', e);
      return interaction.editReply('Send failed.');
    }
  }
};
