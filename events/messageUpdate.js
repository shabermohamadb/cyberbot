module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    try {
      // If attachments were added after message creation, attempt to process as progress
      if (!newMessage) return;
      if (newMessage.author && newMessage.author.bot) return;
      const hadAttachments = oldMessage && oldMessage.attachments && oldMessage.attachments.size > 0;
      const hasAttachments = newMessage.attachments && newMessage.attachments.size > 0;
      if (!hadAttachments && hasAttachments) {
        // delegate to messageCreate handler for consistent processing
        const handler = require('./messageCreate');
        // If the message was already processed, skip delegating
        if (handler && handler.processedMessages && handler.processedMessages.has(newMessage.id)) {
          console.log('messageUpdate: message already processed, skipping', newMessage.id);
        } else if (handler && handler.execute) {
          // mark as processing to avoid race where both messageUpdate and messageCreate fire
          try { if (handler && handler.processedMessages) handler.processedMessages.add(newMessage.id); } catch (e) {}
          await handler.execute(newMessage, client);
        }
      }
    } catch (e) {
      console.error('messageUpdate handler error', e);
    }
  }
};
