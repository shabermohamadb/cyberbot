const { ensureUser, readData, updateUser } = require('../utils/dataStore');
const { checkAchievements } = require('../utils/achievements');
const { EmbedBuilder } = require('discord.js');
const processedMessages = new Set();

module.exports = {
	name: 'messageCreate',
	async execute(message, client) {
		// Avoid re-processing the same message (guard against duplicate handling)
		if (processedMessages.has(message.id)) {
			console.log('messageCreate: already processed message', message.id);
			return;
		}

		// Log receipt
		console.log(`messageCreate received: id=${message.id} guild=${message.guildId} channel=${message.channelId} author=${message.author.id} attachments=${message.attachments.size}`);
		if (message.author.bot) return;
		try {
			const data = await readData();
			const guildCfg = data.guilds && (data.guilds[message.guildId] || data.guilds[String(message.guildId)]);
			if (!guildCfg) {
				console.debug('messageCreate: no guild config for', message.guildId);
				return;
			}

			// Only respond in configured progress channel or in threads under a configured forum channel
			const channelMatches = guildCfg.progressChannel && (String(message.channelId) === String(guildCfg.progressChannel) || String(message.channel?.parentId) === String(guildCfg.progressChannel));
			if (!channelMatches) return;

			console.log('Progress channel match detected (channel=', message.channelId, 'parent=', message.channel?.parentId, ')');

			// Detect attachment presence
			if (!message.attachments || message.attachments.size === 0) {
				try { await message.reply({ content: 'Upload screenshot', allowedMentions: { repliedUser: false } }); } catch (e) { console.warn('Failed to reply asking for screenshot', e.message); }
				return;
			}

			console.log('Attachment detected, processing progress for', message.author.id);
			await ensureUser(message.author.id);
			let user = (await readData()).users[message.author.id];

			const last = user.lastProgress ? new Date(user.lastProgress) : null;
			const today = new Date();
			const todayStart = new Date(today.toDateString());
			const yesterday = new Date(todayStart);
			yesterday.setDate(todayStart.getDate() - 1);
			let streak = user.streak || 0;
			if (last) {
				const lastDate = new Date(new Date(last).toDateString());
				// If user already posted today, don't award again
				if (lastDate.getTime() === todayStart.getTime()) {
					try { await message.reply({ content: '⚠️ You already submitted today. Come back tomorrow!', allowedMentions: { repliedUser: false } }); } catch (e) { console.warn('Reply failed', e.message); }
					return;
				}
				if (lastDate.getTime() === yesterday.getTime()) {
					streak = (streak || 0) + 1;
				} else {
					streak = 1;
				}
			} else streak = 1;

			const progressGain = parseInt(process.env.PROGRESS_POINTS || '10', 10);
			const newProgress = (user.progressPoints || 0) + progressGain;
			// update user: progressPoints, streak, lastProgress and reset progressStrikes
			await updateUser(message.author.id, { progressPoints: newProgress, streak, lastProgress: new Date().toISOString(), progressStrikes: 0 });

			// React and send a single embed reply (clean UI)
			try { await message.react('✅'); } catch (e) { console.warn('React failed', e.message); }
			try {
				const embed = new EmbedBuilder()
					.setTitle('📸 Progress Recorded')
					.setDescription(`+${progressGain} Points Added\n🔥 Streak: ${streak} days\n💰 Total Points: ${newProgress}`)
					.setColor(0x00AE86)
					.setTimestamp()
					.setFooter({ text: 'Keep posting screenshots to maintain your streak' });
				await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
			} catch (e) { console.warn('Reply failed', e.message); }

			// mark processed to avoid duplicate handling on edits
		try {
			processedMessages.add(message.id);
			// Remove processed marker after 10 minutes to avoid memory growth
			setTimeout(() => { try { processedMessages.delete(message.id); } catch (e) {} }, 10 * 60 * 1000);
		} catch (e) {}

			// Achievement check (non-blocking)
			try { const newly = await checkAchievements(message.author.id); if (newly && newly.length) console.log('Achievements:', newly.map(a=>a.name)); } catch (e) {}

		} catch (err) {
			console.error('messageCreate handler error', err);
		}
	}
};

	// expose processedMessages so other event handlers can check it
	module.exports.processedMessages = processedMessages;


