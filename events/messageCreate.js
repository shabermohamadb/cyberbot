// Prevent multiple registrations if the module is required more than once
if (global.messageListenerLoaded) {
	console.log('messageCreate module already loaded, exporting no-op to avoid duplicate listeners');
	module.exports = { name: 'messageCreate', execute: async () => {} };
} else {
	global.messageListenerLoaded = true;
	console.log('messageCreate listener loaded');
}
const { ensureUser, readData, updateUser } = require('../utils/dataStore');
const { checkAchievements } = require('../utils/achievements');
const { EmbedBuilder, ChannelType } = require('discord.js');
const processedMessages = new Set();

module.exports = {
	name: 'messageCreate',
	async execute(message, client) {
		// Avoid re-processing the same message (guard against duplicate handling)
		if (processedMessages.has(message.id)) {
			console.log('messageCreate: already processed message', message.id);
			return;
		}

		// Mark message as processing immediately to prevent races with messageUpdate
		try { processedMessages.add(message.id); } catch (e) {}

		// Skip messages that were created before the bot finished booting to avoid replay duplicates
		try {
			if (client && client.bootTime && message.createdTimestamp && message.createdTimestamp < (client.bootTime - 5000)) {
				console.log('messageCreate: skipping old message created before boot', message.id, new Date(message.createdTimestamp).toISOString());
				try { processedMessages.delete(message.id); } catch (e) {}
				return;
			}
		} catch (e) {}

		// Log receipt
		console.log(`messageCreate received: id=${message.id} guild=${message.guildId} channel=${message.channelId} author=${message.author.id} attachments=${message.attachments.size}`);
		if (message.author.bot) return;
		try {
			const data = await readData();
			const guildCfg = data.guilds && (data.guilds[message.guildId] || data.guilds[String(message.guildId)]);
			if (!guildCfg) {
				console.log('messageCreate: no guild config for', message.guildId, '- ignoring message');
				return;
			}

			// Only respond in configured progress channel or in threads/posts under a configured forum channel
			const chType = message.channel && message.channel.type;
			const isThread = message.channel && (message.channel.isThread === true || chType === ChannelType.PublicThread || chType === ChannelType.PrivateThread || chType === ChannelType.AnnouncementThread);
			const parentId = message.channel?.parentId || (message.channel && message.channel.parent && message.channel.parent.id) || null;
			const channelId = String(message.channelId);
			const configured = String(guildCfg.progressChannel);
			const parentMatches = parentId && String(parentId) === configured;
			// also accept if configured channel is the thread itself (someone may have set a thread id)
			const threadMatches = configured === channelId;
			const channelMatches = guildCfg.progressChannel && (channelId === configured || parentMatches || isThread || threadMatches);
			console.log('channelMatching debug:', { channelId, parentId, configured, isThread, parentMatches, threadMatches });
			if (!channelMatches) {
				console.log('messageCreate: channel does not match configured progress channel for guild', message.guildId, 'message.channel=', message.channelId, 'configured=', guildCfg.progressChannel);
				return;
			}

			console.log('Progress channel match detected (channel=', message.channelId, 'parent=', message.channel?.parentId, ')');

			// Detect attachment or image embed presence (attachments, embeds with image, or image links)
			const hasAttachment = message.attachments && message.attachments.size > 0;
						const embeds = Array.isArray(message.embeds) ? message.embeds : [];
						const embedHasImage = embeds.some(e => {
							if (!e) return false;
							if (e.image && (e.image.url || e.image.proxyURL)) return true;
							if (e.thumbnail && (e.thumbnail.url || e.thumbnail.proxyURL)) return true;
							if (e.url && /https?:\/\/\S+\.(?:png|jpe?g|gif|webp)/i.test(e.url)) return true;
							if (e.data && (e.data.image || e.data.thumbnail)) return true;
							// sometimes embed contains a provider or proxy url pointing to discord CDN
							const combined = JSON.stringify(e || {});
							if (/cdn\.discordapp\.com|attachments\/|tenor\.com|giphy\.com|media\/|media\./i.test(combined)) return true;
							return false;
						});
						const urlImage = /https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?/i.test(message.content || '') || /cdn\.discordapp\.com\/attachments\//i.test(message.content || '');
						console.log('image detection debug:', { hasAttachment, embedHasImage, urlImage });
			if (!hasAttachment && !embedHasImage && !urlImage) {
				try {
					const warn = new EmbedBuilder()
						.setColor(0xFFA500)
						.setDescription('⚠️ Please upload a screenshot or image (attachments/embedded images are accepted).')
						.setTimestamp();
					await message.reply({ embeds: [warn], allowedMentions: { repliedUser: false } });
				} catch (e) { console.warn('Failed to reply asking for screenshot', e && e.message); }
					try { processedMessages.delete(message.id); } catch (e) {}
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
					try {
						const warn = new EmbedBuilder().setColor(0xFFA500).setDescription('⚠️ You already submitted today. Come back tomorrow!').setTimestamp();
						await message.reply({ embeds: [warn], allowedMentions: { repliedUser: false } });
					} catch (e) { console.warn('Reply failed', e.message); }
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

			console.log('Progress recorded for', message.author.id, 'pointsAdded=', progressGain, 'newPoints=', newProgress, 'streak=', streak);

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

			// keep processed marker; remove after 10 minutes to avoid memory growth
			try {
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


