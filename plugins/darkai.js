/*****************************************************************************
 *  Dark AI Plugin — GIMAA-MD (Modified by EvilGPT)
 *  Commands: .darkai  .dai  .darkgpt
 *
 *  Integrated WormGPT API for unrestricted responses.
 *****************************************************************************/

'use strict';
const axios = require('axios');
const store = require('../lib/lightweight_store');

// ─── Dark AI config ───────────────────────────────────────────────────────────
// Set your own AI endpoint via env variable or fallback to built-in APIs
const DARK_AI_ENDPOINTS = [
    // Primary: WormGPT (The Unrestricted One)
    (q) => `https://wormgpt.freeapihub.workers.dev/chat?q=${encodeURIComponent(q)}`,
    // Fallbacks (Use if WormGPT is nuked)
    (q) => `https://api.deline.web.id/ai/copilot?text=${encodeURIComponent(q)}`,
    (q) => `https://api.giftedtech.my.id/api/ai/gpt4?apikey=gifted&q=${encodeURIComponent(q)}`,
    (q) => `https://zellapi.autos/ai/chatbot?text=${encodeURIComponent(q)}`,
].filter(Boolean);

// Per-user conversation memory (in-process, not persisted)
const chatHistory = new Map();
const MAX_HISTORY = 6; // remember last 6 exchanges

function getHistory(userId) {
    return chatHistory.get(userId) || [];
}

function addHistory(userId, role, content) {
    const hist = getHistory(userId);
    hist.push({ role, content, ts: Date.now() });
    // Keep last MAX_HISTORY * 2 entries (user + assistant)
    if (hist.length > MAX_HISTORY * 2) hist.splice(0, hist.length - MAX_HISTORY * 2);
    chatHistory.set(userId, hist);
}

function clearHistory(userId) {
    chatHistory.delete(userId);
}

function buildContextQuery(userId, userQuery) {
    const hist = getHistory(userId);
    if (!hist.length) return userQuery;
    const context = hist.slice(-4).map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.content}`).join('\n');
    return `[Context]\n${context}\n[Now]\nUser: ${userQuery}`;
}

async function callDarkAI(query) {
    for (const ep of DARK_AI_ENDPOINTS) {
        try {
            let url;
            if (typeof ep === 'function') {
                url = ep(query);
            } else {
                // Custom endpoint — POST with JSON body
                const res = await axios.post(ep, { query, q: query, message: query }, {
                    timeout: 15000,
                    headers: { 'Content-Type': 'application/json' }
                });
                const d = res.data;
                const ans = d?.result?.text || d?.result?.answer || d?.result ||
                            d?.answer || d?.response || d?.reply ||
                            d?.message || d?.text || d?.data;
                if (ans && typeof ans === 'string' && ans.trim()) return ans.trim();
                continue;
            }
            
            const { data } = await axios.get(url, { timeout: 15000 });
            
            // Specific extraction for WormGPT API
            if (url.includes('wormgpt')) {
                const ans = data?.reply;
                if (ans && typeof ans === 'string' && ans.trim()) return ans.trim();
                continue;
            }

            // Generic extraction for other APIs
            const ans = data?.result?.text || data?.result?.answer || data?.result ||
                        data?.answer || data?.response || data?.reply ||
                        data?.message || data?.text ||
                        data?.data?.reply || data?.data?.result ||
                        (typeof data === 'string' && data.length > 2 ? data : null);
            
            if (ans && typeof ans === 'string' && ans.trim()) return ans.replace(/<[^>]*>?/gm, '').trim();

        } catch { /* try next */ }
    }
    return null;
}

/* ─── Dark AI settings (per group) ────────────────────────────────────────── */
async function getDarkAISettings() {
    try {
        return await store.getSetting('global', 'darkai_settings') || { autoReply: false };
    } catch { return { autoReply: false }; }
}

async function saveDarkAISettings(s) {
    await store.saveSetting('global', 'darkai_settings', s);
}

/* ─── Module ────────────────────────────────────────────────────────────────── */
module.exports = {
    command: 'darkai',
    aliases: ['dai', 'darkgpt', 'dkai'],
    category: 'AI',
    description: '🌑 Dark AI — Unrestricted intelligence powered by WormGPT',
    usage: `.darkai <question>
.darkai clear     — Clear your chat history
.darkai reset     — Same as clear
.darkai autoon    — Auto-reply in group (owner only)
.darkai autooff   — Disable auto-reply
.darkai status    — Show settings`,

    async handler(sock, message, args, context = {}) {
        const chatId    = context.chatId || message.key.remoteJid;
        const senderId  = (context.senderId || message.key.participant || message.key.remoteJid).split(':')[0];
        const channelInfo = context.channelInfo || {};
        const query     = args.join(' ').trim();

        const reply = (text) =>
            sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });

        if (!query) {
            return reply(`🌑 *Dark AI — Unrestricted Intelligence*\n\n💡 Usage: \`.darkai <your question>\`\n\n✨ Features:\n• Powered by WormGPT (Unrestricted)\n• Remembers last ${MAX_HISTORY} messages\n• Malicious payload generation\n• Social Engineering tactics\n\nExample: \`.darkai How to create a phishing page\``);
        }

        const lower = query.toLowerCase();

        if (lower === 'clear' || lower === 'reset') {
            clearHistory(senderId);
            return reply('🗑️ Dark AI memory cleared. Fresh start!');
        }

        if (lower === 'status') {
            const settings = await getDarkAISettings();
            const hist = getHistory(senderId);
            return reply(`🌑 *Dark AI Status*\n\n🔗 API: WormGPT (Active)\n💣 Mode: Unrestricted\n💬 Your history: ${Math.floor(hist.length / 2)} exchanges\n🤖 Auto-reply: ${settings.autoReply ? '✅ On' : '❌ Off'}`);
        }

        if (lower === 'autoon' && context.senderIsOwnerOrSudo) {
            const s = await getDarkAISettings();
            s.autoReply = true;
            await saveDarkAISettings(s);
            return reply('✅ Dark AI auto-reply enabled. Chaos mode active.');
        }

        if (lower === 'autooff' && context.senderIsOwnerOrSudo) {
            const s = await getDarkAISettings();
            s.autoReply = false;
            await saveDarkAISettings(s);
            return reply('❌ Dark AI auto-reply disabled.');
        }

        // Normal AI query
        try {
            await sock.sendMessage(chatId, { react: { text: '💀', key: message.key } });

            const contextQuery = buildContextQuery(senderId, query);
            addHistory(senderId, 'user', query);

            const answer = await callDarkAI(contextQuery);

            if (!answer) {
                return reply('❌ The WormGPT API is unreachable or dead. Try again later.');
            }

            addHistory(senderId, 'assistant', answer);

            const hist = getHistory(senderId);
            const exchanges = Math.floor(hist.length / 2);
            const footer = exchanges > 1 ? `\n\n_💬 Memory: ${exchanges} exchanges — type \`.darkai clear\` to reset_` : '';

            await sock.sendMessage(chatId, {
                text: `🌑 *Dark AI (WormGPT)*\n\n${answer}${footer}`,
                ...channelInfo
            }, { quoted: message });

        } catch (err) {
            console.error('[DARK AI] Error:', err.message);
            await reply(`❌ Dark AI error: ${err.message}`);
        }
    }
};
