
'use strict';

const axios = require('axios');
const yts = require('yt-search');

const APIS = [
    async (url) => {
        const { data } = await axios.get(
            'https://eliteprotech-apis.zone.id/download/ytmp3',
            { params: { url }, timeout: 60000 }
        );
        return data?.status ? data.download?.downloadUrl : null;
    },

    async (url) => {
        const { data } = await axios.get(
            'https://jerrycoder.oggyapi.workers.dev/down/ytmp3-v1',
            { params: { url }, timeout: 60000 }
        );
        return data?.status === 'success' ? data.url : null;
    },

    async (url) => {
        const { data } = await axios.get(
            'https://xenoytdl-2.vercel.app/api/youtube',
            { params: { url, format: 'mp3' }, timeout: 60000 }
        );
        return data?.status ? data.download : null;
    }
];

async function getAudioUrl(videoUrl) {
    for (const api of APIS) {
        try {
            const result = await api(videoUrl);

            if (result && /^https?:\/\//i.test(result)) {
                return result;
            }
        } catch (error) {
            console.log('[GIMAA SONG API]', error.message);
        }
    }

    return null;
}

module.exports = {
    command: 'song',
    aliases: ['mp3', 'ytaudio', 'play'],
    category: 'download',
    description: 'Search and download songs from YouTube',
    usage: '.song <song name>',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        const reply = async (text) => {
            return sock.sendMessage(
                chatId,
                { text },
                { quoted: message }
            );
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

            const search = await yts(query);
            const video = search.videos?.[0];

            if (!video?.url) {
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

            await reply('⬇️ Getting audio download link...');

            const audioUrl = await getAudioUrl(videoUrl);

            if (!audioUrl) {
                return reply('❌ All audio download APIs failed!');
            }

            const file = await axios.get(audioUrl, {
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
                audioUrl.includes('mime=audio%2Fmp4');

            const extension = isMp4 ? 'm4a' : 'mp3';
            const mimeType = isMp4 ? 'audio/mp4' : 'audio/mpeg';

            const safeTitle = title
                .replace(/[\\/:*?"<>|]/g, '')
                .slice(0, 90);

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
                '> POWERED BY GIMAA';

            if (thumbnail) {
                try {
                    const thumb = await axios.get(thumbnail, {
                        responseType: 'arraybuffer',
                        timeout: 15000
                    });

                    await sock.sendMessage(chatId, {
                        image: Buffer.from(thumb.data),
                        caption: details
                    }, { quoted: message });

                } catch (error) {
                    await reply(details);
                }
            } else {
                await reply(details);
            }

            await sock.sendMessage(chatId, {
                audio: buffer,
                mimetype: mimeType,
                fileName: `${safeTitle}.${extension}`,
                ptt: false
            }, { quoted: message });

        } catch (error) {
            console.error('[GIMAA SONG ERROR]', error);

            await reply(
                '❌ *SONG DOWNLOAD FAILED*\n\n' +
                `Error: ${error.response?.data?.message || error.message}`
            );
        }
    }
};
