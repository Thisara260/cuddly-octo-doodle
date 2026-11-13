/* > POWERED BY GIMAA */

const settings = require('../settings');
const commandHandler = require('../lib/commandHandler');
const store = require('../lib/lightweight_store');
const axios = require('axios');
const { sendInteractiveMessage } = require('gifted-btns');

const MENU_IMAGE_URL = 'https://files.catbox.moe/msqok2.jpg';

// SPEED FIX: cache the menu image buffer — old code downloaded it on EVERY
// .menu call (1-10s network hit). 6-hour TTL, keyed by URL. We ALSO warm the
// cache at load so the very first .menu is instant on Render free tier.
let _imgCache = { url: null, buf: null, ts: 0 };
const IMG_TTL = 6 * 60 * 60 * 1000;
let _imgInflight = null;
async function getMenuImage(url) {
 const now = Date.now();
 if (_imgCache.buf && _imgCache.url === url && now - _imgCache.ts < IMG_TTL) return _imgCache.buf;
    // De-dupe concurrent downloads (many .menu calls at once one network hit).
 if (_imgInflight) { try { return await _imgInflight; } catch {} }
 _imgInflight = (async () => {
 try {
 const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
 _imgCache = { url, buf: Buffer.from(res.data), ts: now };
 return _imgCache.buf;
        } catch {
 if (url !== MENU_IMAGE_URL) return getMenuImage(MENU_IMAGE_URL);
 return _imgCache.buf || null; // stale is better than nothing
        } finally { _imgInflight = null; }
    })();
 return _imgInflight;
}
// Warm the image cache in the background at startup (non-blocking).
getMenuImage(MENU_IMAGE_URL).catch(() => {});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

//  5 MENU STYLES
const STYLES = {
    1: {
 name: 'SILA CLASSIC',
 emoji: '',
 header: (i) =>
 `*${i.botName}*\n` +
 `├ *Owner:* ${i.owner}\n` +
 `├ *Commands:* ${i.total}\n` +
 `├  *Runtime:* ${i.uptime}\n` +
 `├ *Platform:* ${i.platform}\n` +
 `├ *Prefix:* ${i.prefix}\n` +
 `├ *Mode:* ${i.mode}\n` +
 `├ *Version:* ${i.version}\n` +
 `\n\n`,
 catOpen: (c) => `*${c}*\n\n`,
 cmd: (c) => `*${c}*\n`,
 catClose: () => `\n\n`,
 footer: `> POWERED BY GIMAA`,
    },
    2: {
 name: 'NEON CYBER',
 emoji: '',
 header: (i) =>
 `*${i.botName}*\n\n` +
 `*SYSTEM*\n` +
 ` Owner   : ${i.owner}\n` +
 ` Commands: ${i.total}\n` +
 `  Uptime  : ${i.uptime}\n` +
 ` Platform: ${i.platform}\n` +
 ` Prefix  : ${i.prefix}\n` +
 ` Mode    : ${i.mode}\n` +
 ` Version : ${i.version}\n` +
 `\n\n`,
 catOpen: (c) => `*${c}*\n\n`,
 cmd: (c) => `  ${c}\n`,
 catClose: () => `\n\n`,
 footer: `> POWERED BY GIMAA `,
    },
    3: {
 name: 'MINIMAL CLEAN',
 emoji: '',
 header: (i) =>
 `*${i.botName}*\n` +
 `\n` +
 `owner    : ${i.owner}\n` +
 `commands : ${i.total}\n` +
 `uptime   : ${i.uptime}\n` +
 `platform : ${i.platform}\n` +
 `prefix   : ${i.prefix}\n` +
 `mode     : ${i.mode}\n` +
 `version  : ${i.version}\n` +
 `\n\n`,
 catOpen: (c) => `*${c.toLowerCase()}*\n`,
 cmd: (c) => ` ${c}\n`,
 catClose: () => `\n`,
 footer: `> POWERED BY GIMAA`,
    },
    4: {
 name: 'ROYAL ELEGANT',
 emoji: '',
 header: (i) =>
 ` \n` +
 `*${i.botName}*\n` +
 ` \n\n` +
 `*ROYAL COURT*\n` +
 ` Owner     ${i.owner}\n` +
 ` Commands  ${i.total}\n` +
 `  Uptime    ${i.uptime}\n` +
 ` Platform  ${i.platform}\n` +
 ` Prefix    ${i.prefix}\n` +
 ` Mode      ${i.mode}\n` +
 ` Version   ${i.version}\n` +
 `  \n\n`,
 catOpen: (c) => `*${c}*\n`,
 cmd: (c) => ` ${c}\n`,
 catClose: () => `\n\n`,
 footer: `> POWERED BY GIMAA `,
    },
    5: {
 name: 'MATRIX HACKER',
 emoji: '',
 header: (i) =>
            '```' + `\n[root@silaxmini ~]# ./launch ${String(i.botName).replace(/\s+/g, '_')}\n` +
 `[OK] identity  -> ${i.owner}\n` +
 `[OK] commands  -> ${i.total} loaded\n` +
 `[OK] uptime    -> ${i.uptime}\n` +
 `[OK] platform  -> ${i.platform}\n` +
 `[OK] prefix    -> "${i.prefix}"\n` +
 `[OK] mode      -> ${i.mode}\n` +
 `[OK] version   -> ${i.version}\n` +
 `[OK] status    -> ONLINE\n` + '```\n\n',
 catOpen: (c) => '```# ' + c + '```\n',
 cmd: (c) => `> ${c}\n`,
 catClose: () => `\n`,
 footer: '> POWERED BY GIMAA',
    },
    6: {
 name: 'FIRE BLAZE',
 emoji: '',
 header: (i) =>
 `*${i.botName}*\n\n` +
 `\n` +
 ` Owner    ${i.owner}\n` +
 ` Commands  ${i.total}\n` +
 `  Uptime    ${i.uptime}\n` +
 ` Platform  ${i.platform}\n` +
 ` Prefix    ${i.prefix}\n` +
 ` Mode      ${i.mode}\n` +
 ` Version   ${i.version}\n` +
 `\n\n`,
 catOpen: (c) => `*${c}*\n`,
 cmd: (c) => ` ${c}\n`,
 catClose: () => `\n\n`,
 footer: `> POWERED BY GIMAA `,
    },
    7: {
 name: 'OCEAN WAVE',
 emoji: '',
 header: (i) =>
 `*${i.botName}*\n\n` +
 `*INFO*\n` +
 ` Owner ~ ${i.owner}\n` +
 ` Commands ~ ${i.total}\n` +
 `  Uptime ~ ${i.uptime}\n` +
 ` Platform ~ ${i.platform}\n` +
 ` Prefix ~ ${i.prefix}\n` +
 ` Mode ~ ${i.mode}\n` +
 ` Version ~ ${i.version}\n` +
 `\n\n`,
 catOpen: (c) => `*${c}*\n\n`,
 cmd: (c) => ` ${c}\n`,
 catClose: () => `\n\n`,
 footer: `> POWERED BY GIMAA `,
    },
    8: {
 name: 'GALAXY STAR',
 emoji: '',
 header: (i) =>
 `*${i.botName}*   \n\n` +
 `*COSMOS*  \n` +
 ` Owner    : ${i.owner}\n` +
 ` Commands : ${i.total}\n` +
 ` Uptime   : ${i.uptime}\n` +
 ` Platform : ${i.platform}\n` +
 ` Prefix   : ${i.prefix}\n` +
 ` Mode     : ${i.mode}\n` +
 ` Version  : ${i.version}\n` +
 `\n\n`,
 catOpen: (c) => `*${c}*\n`,
 cmd: (c) => ` ${c}\n`,
 catClose: () => `  \n\n`,
 footer: `> POWERED BY GIMAA `,
    },
};
const STYLE_COUNT = Object.keys(STYLES).length;

async function getStyleNumber() {
 const raw = await store.getSetting('global', 'menuStyle');
 const n = parseInt(raw, 10);
 return (n >= 1 && n <= STYLE_COUNT) ? n : 1;
}

function buildMenuText(styleNo, info) {
 const s = STYLES[styleNo] || STYLES[1];
 let text = s.header(info);
 const categories = Array.from(commandHandler.categories.keys()).sort();
 for (const cat of categories) {
 const cmdList = commandHandler.getCommandsByCategory(cat);
 if (!cmdList.length) continue;
 text += s.catOpen(cat.toUpperCase());
 for (const cmd of cmdList) text += s.cmd(cmd);
 text += s.catClose();
    }
 text += s.footer;
 return text;
}

const menuCommand = {
 command: 'menu',
 aliases: ['help', 'cmd'],
 category: 'main',
 description: 'Show the command menu (8 styles — see .menustyle)',
 usage: '.menu [1-8]',

 async handler(sock, message, args, context) {
 const { chatId, channelInfo } = context;
 try {
            // Optional one-shot style override: .menu 3
 let styleNo = parseInt(args?.[0], 10);
 if (!(styleNo >= 1 && styleNo <= STYLE_COUNT)) styleNo = await getStyleNumber();
 const style = STYLES[styleNo];

 const [prefix, botName, botDesc, botDp, botMode] = await Promise.all([
 Promise.resolve(context.prefix || settings.prefixes[0]),
 store.getSetting('global', 'botName'),
 store.getSetting('global', 'botDesc'),
 store.getSetting('global', 'botDp'),
 store.getBotMode(),
            ]);

 const up = process.uptime();
 const info = {
 botName: botName || settings.botName,
 owner: `${settings.botOwner}${settings.secondOwner ? ' & ' + settings.secondOwner : ''}`,
 total: commandHandler.commands.size,
 uptime: `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m ${Math.floor(up % 60)}s`,
 platform: (settings.platform || 'cloud').toUpperCase(),
 prefix: prefix || settings.prefixes[0],
 mode: botMode,
 version: settings.version,
 desc: botDesc || settings.botDesc,
            };

 const menuText = buildMenuText(styleNo, info);

            // SPEED FIX: NO loading animation. The menu image is served from an
            // in-memory cache (warmed at startup), so the menu is delivered in one
            // shot with zero fake "booting…" delay.
 const imgUrl = (botDp && botDp !== 'uploaded via image') ? botDp : MENU_IMAGE_URL;
 const imageBuffer = await getMenuImage(imgUrl);

 if (imageBuffer) {
 await sock.sendMessage(chatId, { image: imageBuffer, caption: menuText, ...channelInfo }, { quoted: message });
            } else {
 await sock.sendMessage(chatId, { text: menuText, ...channelInfo }, { quoted: message });
            }

            // Quick-link buttons (best-effort, non-blocking so it never slows the menu)
 sendInteractiveMessage(sock, chatId, {
 text: '*JOIN OUR COMMUNITY*\n\nTap the button below to join our WhatsApp group.',
 footer: `Style ${styleNo}/${STYLE_COUNT} — ${style.name}  change with .menustyle`,
 interactiveButtons: [
                    { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'WhatsApp Group', url: settings.whatsappGroup || 'https://chat.whatsapp.com/K9Wqwf7EQsn2hFwwAJgWw7' }) },
                ],
            }, { quoted: message }).catch(() => {});
        } catch (error) {
 console.error('Error in menu command:', error);
 await sock.sendMessage(chatId, { text: ' An error occurred while displaying the menu.', ...channelInfo }, { quoted: message });
        }
    },
};

const menuStyleCommand = {
 command: 'menustyle',
 aliases: ['setmenu', 'menutheme'],
 category: 'main',
 description: 'Choose your menu style (1-8)',
 usage: '.menustyle <1-8>',

 async handler(sock, message, args, context) {
 const { chatId, channelInfo } = context;
 try {
 const n = parseInt(args?.[0], 10);
 if (n >= 1 && n <= STYLE_COUNT) {
 await store.saveSetting('global', 'menuStyle', String(n));
 const s = STYLES[n];
 await sock.sendMessage(chatId, {
 text: ` Menu style set to *${n} — ${s.emoji} ${s.name}*\n\nType *.menu* to see it in action!`,
                    ...channelInfo,
                }, { quoted: message });
 return;
            }
 const current = await getStyleNumber();
 let text = `*MENU STYLE SELECTOR*\n\nReply with *.menustyle <number>*\n\n`;
 for (const [no, s] of Object.entries(STYLES)) {
 text += `${Number(no) === current ? '' : ''} *${no}.* ${s.emoji} ${s.name}${Number(no) === current ? ' _(current)_' : ''}\n`;
            }
 text += `\n Tip: *.menu 3* previews a style once without saving.`;
 await sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });
        } catch (error) {
 console.error('Error in menustyle command:', error);
 await sock.sendMessage(chatId, { text: ' Failed to set menu style.', ...channelInfo }, { quoted: message });
        }
    },
};

module.exports = [menuCommand, menuStyleCommand];
