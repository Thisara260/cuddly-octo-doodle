
'use strict';

const axios = require('axios');
const yts = require('yt-search');

const API_URL = 'https://supunofc.site/api/download/ytmp3-down';
const API_KEY = process.env.SUPUN_API_KEY || 'supun_85ef36bc62988cf3ea1609ab19db8333';

module.exports = {
    command: 'song',
    aliases: ['mp3', 'ytaudio'],
    category: 'download',
    description: 'Search and download songs from YouTube',
    usage: '.song <song name>',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        const reply = async (text) => {
            return sock.sendMessage(chatId, { text }, { quoted: message });
        };

        try {
            const query = args?.join(' ').trim();

            if (!query) {
                return reply(
                    '╭━━〔 🎵 GIMAA SONG DOWNLOADER 〕━━╮\n' +
                    '┃\n' +
                    '┃ Search and download songs!\n' +
                    '┃\n' +
                    '┃ Examples:\n' +
                    '┃ .song lelena\n' +
                    '┃ .song faded\n' +
                    '┃ .song perfect ed sheeran\n' +
                    '┃\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━╯'
                );
            }

            await reply(`🔎 Searching YouTube...\n\n🎵 Query: ${query}`);

            // Search YouTube
            const search = await yts(query);
            const video = search.videos?.[0];

            if (!video || !video.url) {
                return reply('❌ No matching songs found!');
            }

            const title = video.title || 'Unknown';
            const artist = video.author?.name || 'Unknown';
            const duration = video.timestamp || 'Unknown';
            const views = video.views
                ? Number(video.views).toLocaleString()
                : 'Unknown';
            const uploaded = video.ago || 'Unknown';
            const thumbnail = video.thumbnail;
            const videoUrl = video.url;

            // Download using Supun API
            const response = await axios.get(API_URL, {
                params: {
                    url: videoUrl,
                    apikey: API_KEY
                },
                timeout: 60000
            });

            const data = response.data;

            if (!data?.success || !Array.isArray(data.result)) {
                return reply(
                    '❌ Download API failed!\n' +
                    (data?.message || 'No audio available.')
                );
            }

            // Find audio track
            const audio = data.result.find(item =>
                item.type === 'Audio Track' &&
                item.downloadUrl &&
                item.downloadUrl.includes('mime=audio%2Fmp4')
            ) || data.result.find(item =>
                item.type === 'Audio Track' && item.downloadUrl
            );

            if (!audio) {
                return reply('❌ Audio download link not found!');
            }

            await reply('⬇️ Downloading audio...\n\nPlease wait.');

            // Download audio buffer
            const file = await axios.get(audio.downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxContentLength: 50 * 1024 * 1024,
                maxBodyLength: 50 * 1024 * 1024
            });

            const buffer = Buffer.from(file.data);

            if (!buffer.length) {
                return reply('❌ Audio file is empty!');
            }

            const contentType = String(
                file.headers['content-type'] || ''
            ).toLowerCase();

            if (
                contentType.includes('text/html') ||
                contentType.includes('application/json')
            ) {
                return reply('❌ Invalid audio response from server!');
            }

            const isMp4 =
                contentType.includes('audio/mp4') ||
                audio.downloadUrl.includes('mime=audio%2Fmp4');

            const extension = isMp4 ? 'm4a' : 'webm';
            const mimeType = isMp4 ? 'audio/mp4' : 'audio/webm';

            const safeTitle = title
                .replace(/[\\/:*?"<>|]/g, '')
                .slice(0, 90);

            // Song information
            const details =
                '╭━━〔 🎵 GIMAA SONG 〕━━╮\n' +
                '┃\n' +
                `┃ 🎶 Title: ${title}\n` +
                `┃ 👤 Artist: ${artist}\n` +
                `┃ ⏱️ Duration: ${duration}\n` +
                `┃ 👁️ Views: ${views}\n` +
                `┃ 📅 Uploaded: ${uploaded}\n` +
                '┃\n' +
                '┃ 📥 Download: SUCCESS\n' +
                `┃ 💾 Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n` +
                '┃\n' +
                `┃ 🔗 YouTube: ${videoUrl}\n` +
                '┃\n' +
                '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
                '> POWERED BY GIMAA MD';

            // Send thumbnail and song details
            if (thumbnail) {
                try {
                    const thumb = await axios.get(thumbnail, {
                        responseType: 'arraybuffer',
                        timeout: 15000
                    });

                    await sock.sendMessage(chatId, {
                        image: Buffer.from(thumb.data),
                        caption: details
                    }, {
                        quoted: message
                    });
                } catch (error) {
                    await reply(details);
                }
            } else {
                await reply(details);
            }

            // Send actual audio
            await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: mimeType,
                fileName: `${safeTitle}.${extension}`,
                ptt: false
            }, {
                quoted: message
            });

        } catch (error) {
            console.error('[GIMAA SONG ERROR]', error);

            await reply(
                '❌ *SONG DOWNLOAD FAILED*\n\n' +
                `Error: ${error.response?.data?.message || error.message}`
            );
        }
    }
};
