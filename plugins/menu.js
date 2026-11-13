'use strict';

/*
 * GIMAA-MD SIMPLE MENU
 *
 * Commands:
 * .menu
 * .menu 1
 * .menu download
 * .menu all
 */

const settings = require('../settings');
const CommandHandler = require('../lib/commandHandler');
const store = require('../lib/lightweight_store');

const BRAND = 'GIMAA-MD';
const FOOTER = '> POWERED BY GIMAA';

// Category emojis
const CATEGORY_EMOJIS = {
    ai: '🤖',
    admin: '🛡️',
    owner: '👑',
    general: '📱',
    main: '🏠',
    group: '👥',
    download: '📥',
    downloader: '📥',
    search: '🔎',
    music: '🎵',
    audio: '🎧',
    fun: '🎮',
    games: '🕹️',
    sticker: '🖼️',
    tools: '🧰',
    utility: '⚙️',
    info: 'ℹ️',
    images: '🌄',
    other: '📂'
};

function getEmoji(category) {
    return CATEGORY_EMOJIS[String(category).toLowerCase()] || '📁';
}

// Get the current session prefix
function getPrefix(context) {
    return context.prefix || settings.prefixes?.[0] || '.';
}

// Get all command categories
function getCategories() {
    return Array.from(CommandHandler.categories.keys())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
}

// Get commands in a category
function getCommands(category) {
    return CommandHandler.getCommandsByCategory(category) || [];
}

// Calculate bot uptime
function formatUptime() {
    const seconds = Math.floor(process.uptime());

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

// Find category by number or name
function findCategory(input, categories) {
    if (!input) return null;

    const number = Number.parseInt(input, 10);

    if (
        Number.isInteger(number) &&
        number >= 1 &&
        number <= categories.length
    ) {
        return categories[number - 1];
    }

    return categories.find(
        category => category.toLowerCase() === input.toLowerCase()
    ) || null;
}

// Main menu
function buildHomeMenu(prefix, botName, ownerName, categories) {
    const totalCommands = CommandHandler.commands?.size || 0;

    let text = `╭━━━〔 *${BRAND}* 〕━━━╮\n`;

    text += `┃ 🤖 Bot: *${botName}*\n`;
    text += `┃ 👑 Owner: *${ownerName}*\n`;
    text += `┃ ⚡ Prefix: *${prefix}*\n`;
    text += `┃ 📦 Commands: *${totalCommands}*\n`;
    text += `┃ ⏱️ Uptime: *${formatUptime()}*\n`;

    text += `╰━━━━━━━━━━━━━━━━╯\n\n`;

    text += `*📚 COMMAND CATEGORIES*\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;

    categories.forEach((category, index) => {
        const count = getCommands(category).length;

        text += `${index + 1}. ${getEmoji(category)} `;
        text += `*${category.toUpperCase()}* _(${count})_\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    text += `*HOW TO USE*\n`;
    text += `• Open a category: *${prefix}menu 1*\n`;
    text += `• Open by name: *${prefix}menu download*\n`;
    text += `• Show all commands: *${prefix}menu all*\n\n`;

    text += FOOTER;

    return text;
}

// Category menu
function buildCategoryMenu(category, prefix) {
    const commands = getCommands(category)
        .slice()
        .sort((a, b) => String(a).localeCompare(String(b)));

    let text = `╭━━〔 ${getEmoji(category)} `;
    text += `*${category.toUpperCase()}* 〕━━╮\n`;

    text += `┃ 📦 Commands: *${commands.length}*\n`;
    text += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;

    if (!commands.length) {
        text += 'No commands found in this category.\n\n';
    } else {
        commands.forEach((command, index) => {
            text += `${index + 1}. *${prefix}${command}*\n`;
        });

        text += '\n';
    }

    text += `To return: *${prefix}menu*\n`;
    text += FOOTER;

    return text;
}

// All commands menu
function buildAllMenu(prefix, categories) {
    let text = `╭━━━〔 *${BRAND} COMMANDS* 〕━━━╮\n\n`;

    for (const category of categories) {
        const commands = getCommands(category)
            .slice()
            .sort((a, b) => String(a).localeCompare(String(b)));

        if (!commands.length) continue;

        text += `${getEmoji(category)} *${category.toUpperCase()}*\n`;

        commands.forEach(command => {
            text += `• ${prefix}${command}\n`;
        });

        text += '\n';
    }

    text += FOOTER;

    return text;
}

// Menu command
const menuCommand = {
    command: 'menu',
    aliases: ['help', 'cmd', 'commands'],
    category: 'main',
    description: 'Show the GIMAA-MD command menu',
    usage: '.menu | .menu <number/category/all>',

    async handler(sock, message, args = [], context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const channelInfo = context.channelInfo || {};

        const prefix = getPrefix(context);

        try {
            const categories = getCategories();
            const query = args.join(' ').trim();

            // Show all commands
            if (!query || query.toLowerCase() === 'all') {
                const allText = buildAllMenu(prefix, categories);

                await sock.sendMessage(
                    chatId,
                    { text: allText, ...channelInfo },
                    { quoted: message }
                );

                return;
            }

            // Open category by number or name
            const selectedCategory = findCategory(query, categories);

            if (selectedCategory) {
                const categoryText = buildCategoryMenu(
                    selectedCategory,
                    prefix
                );

                await sock.sendMessage(
                    chatId,
                    { text: categoryText, ...channelInfo },
                    { quoted: message }
                );

                return;
            }

            // Show main menu
            const savedBotName = await store.getSetting(
                'global',
                'botName'
            );

            const botName = savedBotName || settings.botName || BRAND;
            const ownerName = settings.botOwner || 'Gimaa';

            const homeText = buildHomeMenu(
                prefix,
                botName,
                ownerName,
                categories
            );

            await sock.sendMessage(
                chatId,
                { text: homeText, ...channelInfo },
                { quoted: message }
            );

        } catch (error) {
            console.error('[GIMAA MENU] Error:', error);

            await sock.sendMessage(
                chatId,
                {
                    text: '❌ Sorry, the menu could not be displayed. Please try again.',
                    ...channelInfo
                },
                { quoted: message }
            );
        }
    }
};

module.exports = menuCommand;
