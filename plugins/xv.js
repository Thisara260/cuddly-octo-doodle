
'use strict';

const axios = require('axios');

const API_URL = 'https://eliteprotech-apis.zone.id/download/nsfw';

const SAFE_CATEGORIES = [
    'hentai',
    'porn',
    'xxx',
    'nsfw',
    'nude',
    'naked',
    'sex',
    'sexual',
    'explicit',
    'erotic',
    'fetish'
];

const BLOCKED_WORDS = [
    'comedy',
    'sports',
    'music',
    'gaming',
    'education',
    'nature',
    'travel',
    'technology',
    'animation'
];

module.exports = {
    command: 'xxx',
    aliases: ['xxxsearch'],
    category: 'search',
    description: 'Search videos and download by number',
    usage: '.xxx <query>',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const senderId = context.senderId || message.key.participant || chatId;

        const reply = async (text) => {
            return sock.sendMessage(
                chatId,
                { text },
                { quoted: message }
            );
        };

        if (!args.length) {
            return reply(
                '⚠️ Please enter a video search query.\n\n' +
                'Example: .xxx hot'
            );
        }

        const query = args.join(' ').trim();

        try {
            await sock.sendMessage(chatId, {
                react: { text: '🔎', key: message.key }
            });

            const response = await axios.get(API_URL, {
                params: { s: query },
                timeout: 20000
            });

            const data = response.data;

            if (!data || data.success !== true || !Array.isArray(data.results)) {
                return reply('❌ No results found or the API returned an invalid response.');
            }

            // Default-deny: only explicitly allowlisted categories.
            const safeResults = data.results.filter(item => {
                const category = String(item.category || '')
                    .toLowerCase()
                    .trim();

                const title = String(item.title || '').toLowerCase();

                const categoryAllowed = SAFE_CATEGORIES.includes(category);
                const titleBlocked = BLOCKED_WORDS.some(word =>
                    title.includes(word)
                );

                return categoryAllowed && !titleBlocked && item.mp4;
            }).slice(0, 8);

            if (!safeResults.length) {
                return reply(
                    '❌ No results passed the safe-category filter.\n\n' +
                    'Try another query or use a verified non-explicit video API.'
                );
            }

            // Create the pending-selection store used by messageHandler.js.
            if (!global._dlPending) {
                global._dlPending = new Map();
            }

            const pendingKey = `dlmenu_${chatId}_${senderId}`;

            global._dlPending.set(pendingKey, {
                items: safeResults.map(item => ({
                    url: item.mp4
                })),
                expires: Date.now() + 3 * 60 * 1000
            });

            const resultText = safeResults.map((item, index) => {
                const title = item.title || 'Untitled';
                const category = item.category || 'Unknown';
                const views = Number(item.views_count || 0).toLocaleString();

                return (
                    `*${index + 1}.* ${title}\n` +
                    `📂 Category: ${category}\n` +
                    `👁 Views: ${views}`
                );
            }).join('\n\n');

            await reply(
                `🎬 *XXX VIDEO SEARCH*\n\n` +
                `🔎 Query: ${query}\n\n` +
                `${resultText}\n\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `↪ Reply with a number (1-${safeResults.length}) to download.\n` +
                `⏳ Selection expires in 3 minutes.`
            );

        } catch (error) {
            console.error('[WWW PLUGIN]', error.message);

            return reply(
                '❌ Video search failed.\n' +
                'Please try again later.'
            );
        }
    }
};
