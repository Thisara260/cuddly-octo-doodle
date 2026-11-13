'use strict';
/*****************************************************************************
 *  cat-05-music.js — GIMAA-MD Music Bundle v5 ULTRA
 *  > POWERED BY GIMAA
 *
 *  YTDL: Uses MEGA-MDX's exact qasimdev API approach (proven working)
 *  Commands:
 *    play, play2, song, video, lyrics, trending, radio, shazam, spotify
 *    + ringtone (from MEGA-MDX)
 *    + soundcloud, ytplaylist, audiofx (new)
 *****************************************************************************/

const _bundle = [];
const axios = require('axios');

const QASIM_API  = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const QASIM_KEY  = 'qasim-dev';
const QASIM_KEY2 = 'xbps-install-Syu';
const wait       = ms => new Promise(r => setTimeout(r, ms));

/* ─── MEGA-MDX exact downloadWithRetry ────────────────────────────────────── */
async function downloadWithRetry(url, format = 'mp3', retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(QASIM_API, {
                params: { apiKey: QASIM_KEY, format, url },
                timeout: format === 'mp3' ? 90000 : 120000
            });
            if (data?.data?.downloadUrl) return data.data;
            throw new Error(data?.message || 'No download URL from API');
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`[YTDL] Attempt ${i+1} failed, retry in 5s... (${err.message})`);
            await wait(5000);
        }
    }
}

/* ─── Cobalt fallback ──────────────────────────────────────────────────────── */
async function cobaltFallback(url, isAudio = true) {
    const { data } = await axios.post('https://api.cobalt.tools/', {
        url, downloadMode: isAudio ? 'audio' : 'auto',
        audioFormat: isAudio ? 'mp3' : undefined
    }, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, timeout: 30000 });
    if (data.status === 'error') throw new Error(data.error?.code || 'cobalt error');
    const dlUrl = data.url || data.picker?.[0]?.url;
    if (!dlUrl) throw new Error('No URL from cobalt');
    return { downloadUrl: dlUrl, title: 'Song' };
}

/* ─── Extra public API fallbacks (used before giving up) ──────────────────── */
async function siputzxFallback(url, isAudio = true) {
    const ep = isAudio ? 'https://api.siputzx.my.id/api/d/ytmp3' : 'https://api.siputzx.my.id/api/d/ytmp4';
    const { data } = await axios.get(ep, { params: { url }, timeout: 60000 });
    const dl = data?.data?.dl || data?.data?.url || data?.data?.download || data?.result?.download;
    if (!dl) throw new Error('siputzx: no url');
    return { downloadUrl: dl, title: data?.data?.title || 'audio' };
}

async function ytdlpApiFallback(url, isAudio = true) {
    // Well-known community youtube downloader mirror
    const { data } = await axios.get('https://api.vreden.my.id/api/ytmp3', {
        params: { url }, timeout: 60000
    }).catch(async () => {
        return await axios.get(`https://api.zenzxz.dpdns.org/downloader/ytmp3`, { params: { url }, timeout: 60000 });
    });
    const dl = data?.result?.download?.url || data?.result?.url || data?.download || data?.result?.audio;
    if (!dl) throw new Error('vreden: no url');
    return { downloadUrl: dl, title: data?.result?.title || 'audio' };
}

async function downloadAny(url, format = 'mp3') {
    const isAudio = format === 'mp3';
    const chain = [
        { name: 'qasimdev',  fn: () => downloadWithRetry(url, format, 2) },
        { name: 'siputzx',   fn: () => siputzxFallback(url, isAudio) },
        { name: 'vreden',    fn: () => ytdlpApiFallback(url, isAudio) },
        { name: 'cobalt',    fn: () => cobaltFallback(url, isAudio) },
    ];
    let lastErr = null;
    for (const step of chain) {
        try {
            const r = await step.fn();
            if (r?.downloadUrl) return r;
        } catch (e) {
            lastErr = e;
            console.log(`[YTDL] ${step.name} failed: ${e.message}`);
        }
    }
    throw lastErr || new Error('All download sources failed');
}

async function ytSearch(query) {
    const yts = require('yt-search');
    const { videos } = await yts(query);
    if (!videos?.length) throw new Error('No YouTube results found.');
    return videos[0];
}

/* ─── Direct local download (no 3rd-party API needed) ─────────────────────
 * lib/ytdl.js wraps @distube/ytdl-core + ffmpeg and downloads/encodes the
 * mp3 locally. This doesn't depend on any free public API staying alive,
 * so it's used as the FIRST attempt. The qasimdev/siputzx/vreden/cobalt
 * chain (downloadAny, above) is kept as a fallback in case YouTube's
 * player signature blocks direct extraction on this host.
 * ───────────────────────────────────────────────────────────────────────── */
async function downloadAudioLocal(url) {
    const ytdlLocal = require('../lib/ytdl');
    const result = await ytdlLocal.downloadAudio(url, true); // { path, title, duration, size }
    return result;
}

/* ─── .play (MEGA-MDX exact logic) ────────────────────────────────────────── */
const _play = {
    command: 'play', aliases: ['plays', 'playsong'],
    category: 'music', description: 'Search and stream MP3 from YouTube',
    usage: '.play <song name>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const query  = args.join(' ').trim();
        if (!query) return sock.sendMessage(chatId, { text: '*Which song do you want to play?*\nUsage: .play <song name>' }, { quoted: message });
        let localFile = null;
        try {
            await sock.sendMessage(chatId, { text: '🔍 *Searching...*' }, { quoted: message });
            const video = await ytSearch(query);

            await sock.sendMessage(chatId, {
                image: { url: video.thumbnail },
                caption: `✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ *Downloading... (may take up to 30s)*`
            }, { quoted: message });

            let audioUrl, fileName, sendBuffer = false;

            // 1) Direct local download — most reliable, no 3rd-party API dependency
            try {
                const local = await downloadAudioLocal(video.url);
                localFile = local.path;
                fileName = `${(local.title || video.title || 'song').slice(0, 60)}.mp3`;
                sendBuffer = true;
            } catch (localErr) {
                console.log('[PLAY] local ytdl-core failed, falling back to API chain:', localErr.message);
                // 2) Fallback: remote API chain (qasimdev → siputzx → vreden → cobalt)
                const songData = await downloadAny(video.url, 'mp3');
                audioUrl = songData.downloadUrl;
                fileName = `${(songData.title || video.title || 'song').slice(0, 60)}.mp3`;
            }

            await sock.sendMessage(chatId, {
                audio: sendBuffer ? require('fs').readFileSync(localFile) : { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName,
                ptt: false
            }, { quoted: message });

        } catch (err) {
            console.error('[PLAY]', err.message);
            const reason = err.response?.status === 408 ? 'Download timed out. Try again.'
                : err.response?.status === 429 ? 'Rate limited. Wait a minute.'
                : err.message;
            await sock.sendMessage(chatId, { text: `❌ *Failed:* ${reason}` }, { quoted: message });
        } finally {
            if (localFile) {
                try { require('fs').unlinkSync(localFile); } catch (_) {}
            }
        }
    }
};

/* ─── .play2 (multi-URL fallback chain) ────────────────────────────────────── */
const _play2 = {
    command: 'play2', aliases: ['mp3fallback', 'playfb'],
    category: 'music', description: 'Stream MP3 with full URL fallback chain',
    usage: '.play2 <song name>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const query  = args.join(' ').trim();
        if (!query) return sock.sendMessage(chatId, { text: '🎵 Usage: `.play2 <song name>`' }, { quoted: message });
        try {
            await sock.sendMessage(chatId, { text: '🔍 Searching...' }, { quoted: message });
            const video = await ytSearch(query);

            if (video.thumbnail) {
                await sock.sendMessage(chatId, {
                    image: { url: video.thumbnail },
                    caption: `*🎵 ${video.title}*\n⏱️ ${video.timestamp}\n📢 ${video.author.name}\n\n🔄 Fetching URLs...`
                }, { quoted: message });
            }

            const { data: apiResp } = await axios.get(QASIM_API, {
                params: { apiKey: QASIM_KEY, format: 'mp3', url: video.url }, timeout: 120000
            }).catch(() => ({ data: {} }));

            const urlsToTry = [];
            if (apiResp?.data?.downloadUrl) urlsToTry.push(apiResp.data.downloadUrl);
            if (apiResp?.data?.alternativeUrls?.length) apiResp.data.alternativeUrls.forEach(a => urlsToTry.push(a.url));
            urlsToTry.push('__cobalt__');

            let sent = false, lastErr = null;
            for (let i = 0; i < urlsToTry.length; i++) {
                try {
                    let finalUrl = urlsToTry[i];
                    if (finalUrl === '__cobalt__') {
                        const d = await cobaltFallback(video.url, true);
                        finalUrl = d.downloadUrl;
                    } else {
                        await axios.head(finalUrl, { timeout: 8000 });
                    }
                    await sock.sendMessage(chatId, {
                        audio: { url: finalUrl }, mimetype: 'audio/mpeg',
                        fileName: `${video.title}.mp3`
                    }, { quoted: message });
                    sent = true;
                    break;
                } catch (e) { lastErr = e; }
            }
            if (!sent) throw new Error(`All ${urlsToTry.length} URLs failed. Last: ${lastErr?.message}`);
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ Play2 failed: ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── .song (with thumbnail card) ──────────────────────────────────────────── */
const _song = {
    command: 'song', aliases: ['mp3', 'audio', 'dlmp3'],
    category: 'music', description: 'Download song MP3 from YouTube',
    usage: '.song <name | YouTube URL>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const query  = args.join(' ').trim();
        if (!query) return sock.sendMessage(chatId, { text: '🎵 *Song Downloader*\n\nUsage:\n.song <song name | YouTube link>' }, { quoted: message });
        try {
            const isUrl = query.startsWith('http');
            const video = isUrl ? { url: query, title: query, timestamp: '?', author: { name: '' }, thumbnail: null } : await ytSearch(query);

            if (video.thumbnail) {
                await sock.sendMessage(chatId, {
                    image: { url: video.thumbnail },
                    caption: `🎵 *${video.title}*\n⏱ ${video.timestamp}\n👤 ${video.author.name}\n\n⏳ Downloading...`
                }, { quoted: message });
            }

            const dl = await downloadAny(video.url, 'mp3');
            await sock.sendMessage(chatId, {
                audio: { url: dl.downloadUrl }, mimetype: 'audio/mpeg',
                fileName: `${dl.title || video.title || 'song'}.mp3`, ptt: false
            }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── .video (MEGA-MDX exact logic) ────────────────────────────────────────── */
const _video = {
    command: 'video', aliases: ['ytmp4', 'ytvideo', 'ytdl'],
    category: 'download', description: 'Download YouTube video (MP4 360p)',
    usage: '.video <youtube link | search>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const query  = args.join(' ').trim();
        if (!query) return sock.sendMessage(chatId, { text: '🎥 *Video Downloader*\nExample:\n.video Alan Walker Faded' }, { quoted: message });
        try {
            let videoUrl, videoTitle, videoThumbnail;
            if (query.startsWith('http://') || query.startsWith('https://')) {
                videoUrl = query;
            } else {
                const v = await ytSearch(query);
                videoUrl = v.url; videoTitle = v.title; videoThumbnail = v.thumbnail;
            }

            const validYT = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
            if (!validYT) return sock.sendMessage(chatId, { text: '❌ Not a valid YouTube link!' }, { quoted: message });

            const ytId = validYT[1];
            const thumb = videoThumbnail || `https://i.ytimg.com/vi/${ytId}/sddefault.jpg`;

            await sock.sendMessage(chatId, {
                image: { url: thumb },
                caption: `🎬 *${videoTitle || query}*\n⬇️ Downloading... *(may take up to 30s)*`
            }, { quoted: message });

            const videoData = await downloadAny(videoUrl, '360');
            await sock.sendMessage(chatId, {
                video: { url: videoData.downloadUrl }, mimetype: 'video/mp4',
                fileName: `${videoData.title || videoTitle || 'video'}.mp4`,
                caption: `🎬 *${videoData.title || videoTitle || 'Video'}*\n\n> *_GIMAA-MD_*`
            }, { quoted: message });
        } catch (err) {
            await sock.sendMessage(chatId, { text: `❌ Download failed: ${err.message}` }, { quoted: message });
        }
    }
};

/* ─── .lyrics (MEGA-MDX discardapi) ────────────────────────────────────────── */
const _lyrics = {
    command: 'lyrics', aliases: ['lyric', 'songlyrics', 'lrc'],
    category: 'music', description: 'Get song lyrics with artist and image',
    usage: '.lyrics <song name>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const query  = args.join(' ').trim();
        if (!query) return sock.sendMessage(chatId, { text: '🎤 Usage: `.lyrics <song name>`' }, { quoted: message });
        try {
            // MEGA-MDX approach: discardapi
            const { data } = await axios.get(`https://discardapi.dpdns.org/api/music/lyrics`, {
                params: { apikey: 'qasim', song: query }, timeout: 15000
            });
            const md = data?.result?.message;
            if (!md?.lyrics) {
                // fallback: lrclib.net
                const { data: lb } = await axios.get('https://lrclib.net/api/search', { params: { q: query }, timeout: 10000 });
                const track = lb?.[0];
                if (!track) return sock.sendMessage(chatId, { text: `❌ No lyrics found for "${query}".` }, { quoted: message });
                const lrc = track.plainLyrics || 'No lyrics text.';
                return sock.sendMessage(chatId, {
                    text: `🎤 *${track.trackName}*\n👤 ${track.artistName}\n💽 ${track.albumName||'?'}\n\n${lrc.slice(0, 59000)}`
                }, { quoted: message });
            }
            const caption = `🎵 *${md.title}*\n👤 *Artist:* ${md.artist}\n🔗 ${md.url}\n\n📝 *Lyrics:*\n${md.lyrics.slice(0, 4000)}`.trim();
            if (md.image) {
                await sock.sendMessage(chatId, { image: { url: md.image }, caption }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ Lyrics error: ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── .trending ─────────────────────────────────────────────────────────────── */
const _trending = {
    command: 'trending', aliases: ['yttrend', 'musictrend'],
    category: 'music', description: 'Top trending music on YouTube',
    usage: '.trending [country]',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const gl = (args[0] || 'PK').toUpperCase();
        try {
            const yts = require('yt-search');
            const { videos } = await yts({ search: 'trending music 2025', gl });
            if (!videos?.length) return sock.sendMessage(chatId, { text: '❌ No trending results.' }, { quoted: message });
            const list = videos.slice(0,10).map((v, i) =>
                `${i+1}. *${v.title}*\n   ⏱ ${v.timestamp} | 👤 ${v.author.name}`
            ).join('\n\n');
            await sock.sendMessage(chatId, { text: `🔥 *Trending Music — ${gl}*\n\n${list}\n\n_Use \`.play <name>\` to stream_` }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── .radio ────────────────────────────────────────────────────────────────── */
const STATIONS = {
    'fm91':     { name: 'FM91 Pakistan',      url: 'https://stream.zeno.fm/5ak3ey5y9e8uv' },
    'cityfm89': { name: 'City FM89 Pakistan', url: 'https://stream.zeno.fm/mxlj5g5wquhvv' },
    'humfm':    { name: 'HUM FM 106.2',       url: 'https://stream.zeno.fm/8wr0xv4kwenuv' },
    'radioone': { name: 'Radio One 91 FM',    url: 'https://stream.zeno.fm/5jwy09fyyghvv' },
    'lofi':     { name: 'Lofi Chill Beats',   url: 'https://stream.zeno.fm/f3wvbbqmdg8uv' },
    'quran':    { name: 'Radio Quran',        url: 'https://stream.radiojar.com/quran' },
    'bbc':      { name: 'BBC World Service',  url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service' },
    'jazz':     { name: 'Jazz 24/7',          url: 'https://live.amperwave.net/manifest/ppm-jazz24aacstream-hlsc.m3u8' },
};
const _radio = {
    command: 'radio', aliases: ['stream', 'radiofm'],
    category: 'music', description: 'Stream internet radio stations',
    usage: '.radio <station> | .radio list',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const sub = (args[0] || 'list').toLowerCase();
        if (sub === 'list' || !STATIONS[sub]) {
            const list = Object.entries(STATIONS).map(([k,v]) => `• \`.radio ${k}\` — ${v.name}`).join('\n');
            return sock.sendMessage(chatId, { text: `📻 *Radio Stations*\n\n${list}` }, { quoted: message });
        }
        const st = STATIONS[sub];
        try {
            await sock.sendMessage(chatId, { text: `📻 Streaming *${st.name}*...` }, { quoted: message });
            await sock.sendMessage(chatId, { audio: { url: st.url }, mimetype: 'audio/mpeg', ptt: false }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ Stream failed: ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── .shazam (ACRCloud from MEGA-MDX) ─────────────────────────────────────── */
const _shazam = {
    command: 'shazam', aliases: ['identify', 'songid', 'whatssong'],
    category: 'music', description: 'Identify a song from audio or video',
    usage: '.shazam (reply to audio/video)',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const fs = require('fs'), path = require('path');
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        try {
            const m = message.message || {};
            const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage;
            const audioMsg  = m.audioMessage || m.voiceMessage || quoted?.audioMessage || quoted?.voiceMessage;
            const videoMsg  = m.videoMessage || quoted?.videoMessage;
            const mediaMsg  = audioMsg || videoMsg;
            const mediaType = audioMsg ? 'audio' : videoMsg ? 'video' : null;
            if (!mediaMsg || !mediaType) return sock.sendMessage(chatId, { text: '⚠️ *Reply to an audio or video message.*' }, { quoted: message });

            await sock.sendMessage(chatId, { text: '🔍 Analyzing audio...' }, { quoted: message });

            const stream = await downloadContentFromMessage(mediaMsg, mediaType);
            let buf = Buffer.alloc(0);
            for await (const ch of stream) buf = Buffer.concat([buf, ch]);

            const tmpDir = path.join(process.cwd(), 'tmp');
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const ext = mediaType === 'audio' ? '.mp3' : '.mp4';
            const tmpPath = path.join(tmpDir, `shazam_${Date.now()}${ext}`);
            fs.writeFileSync(tmpPath, buf);

            let result = null;
            // Try ACRCloud (from MEGA-MDX)
            try {
                const acrcloud = require('acrcloud');
                const acr = new acrcloud({
                    host: 'identify-eu-west-1.acrcloud.com',
                    access_key: process.env.ACRCLOUD_KEY || 'c33c767d683f78bd17d4bd4991955d81',
                    access_secret: process.env.ACRCLOUD_SECRET || 'bvgaIAEtADBTbLwiPGYlxupWqkNGIjT7J9Ag2vIu',
                });
                const res = await acr.identify(fs.readFileSync(tmpPath));
                if (res.status.code === 0 && res.metadata.music?.[0]) {
                    const music = res.metadata.music[0];
                    result = {
                        title:   music.title,
                        artist:  music.artists?.map(a => a.name).join(', '),
                        album:   music.album?.name,
                        genre:   music.genres?.map(g => g.name).join(', '),
                        release: music.release_date
                    };
                }
            } catch {}

            // Fallback: audd.io
            if (!result) {
                try {
                    const FormData = require('form-data');
                    const form = new FormData();
                    form.append('file', fs.createReadStream(tmpPath));
                    form.append('return', 'apple_music,spotify');
                    form.append('api_token', process.env.AUDD_API_KEY || 'test');
                    const { data } = await axios.post('https://api.audd.io/', form, {
                        headers: form.getHeaders(), timeout: 30000
                    });
                    if (data?.status === 'success' && data?.result) {
                        const r = data.result;
                        result = { title: r.title, artist: r.artist, album: r.album, release: r.release_date };
                    }
                } catch {}
            }

            try { fs.unlinkSync(tmpPath); } catch {}

            if (!result) return sock.sendMessage(chatId, { text: '❌ Could not identify the song.' }, { quoted: message });

            await sock.sendMessage(chatId, {
                text: `🎵 *Song Identified!*\n\n` +
                      `• 📌 *Title:*   ${result.title || '?'}\n` +
                      `• 👤 *Artist:*  ${result.artist || '?'}\n` +
                      `• 💽 *Album:*   ${result.album || '?'}\n` +
                      `• 🎭 *Genre:*   ${result.genre || '?'}\n` +
                      `• 📅 *Release:* ${result.release || '?'}\n\n` +
                      `_Use \`.play ${result.title}\` to stream_`
            }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ Shazam error: ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── .spotify (MEGA-MDX qasimdev spotify API) ──────────────────────────────── */
const _spotify = {
    command: 'spotify', aliases: ['sptfdl', 'spotifydl'],
    category: 'download', description: 'Download music from Spotify URL',
    usage: '.spotify <spotify track URL>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const url = args.join(' ').trim();
        if (!url || !url.includes('spotify.com')) return sock.sendMessage(chatId, {
            text: '🎵 *Spotify Downloader*\n\nUsage: `.spotify <spotify track url>`\nExample: `.spotify https://open.spotify.com/track/4LMlVCXHJtCE9abhmn0mYo`'
        }, { quoted: message });
        try {
            await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });
            const { data } = await axios.get('https://api.qasimdev.dpdns.org/api/spotify/download', {
                params: { apiKey: QASIM_KEY, url }, timeout: 30000
            });
            if (!data?.success || !data?.data) throw new Error('Invalid API response');
            const track = data.data;
            if (!track.download) return sock.sendMessage(chatId, { text: '❌ No downloadable audio found.' }, { quoted: message });
            const fmtDur = ms => { const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000); return `${m}:${String(s).padStart(2,'0')}`; };
            const caption = [
                `🎵 *${track.title || 'Unknown'}*`,
                track.artist   ? `👤 ${track.artist}` : '',
                track.duration ? `⏱ ${fmtDur(track.duration)}` : '',
                track.format   ? `🎧 ${track.format.toUpperCase()}` : ''
            ].filter(Boolean).join('\n');
            if (track.cover) await sock.sendMessage(chatId, { image: { url: track.cover }, caption }, { quoted: message });
            else await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            await sock.sendMessage(chatId, {
                audio: { url: track.download }, mimetype: 'audio/mpeg',
                fileName: `${(track.title||'track').replace(/[\\/:*?"<>|]/g,'')}.mp3`
            }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ Spotify failed: ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── .ringtone (MEGA-MDX exact) ───────────────────────────────────────────── */
const _ringtone = {
    command: 'ringtone', aliases: ['ring', 'tone', 'ringtones'],
    category: 'music', description: 'Search and download ringtones',
    usage: '.ringtone <search term>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const query  = args.join(' ').trim();
        if (!query) return sock.sendMessage(chatId, { text: '*Which ringtone do you want?\nUsage: .ringtone <name>\n\nExample: .ringtone Nokia*' }, { quoted: message });
        try {
            await sock.sendMessage(chatId, { text: '🔍 *Searching for ringtones...*' }, { quoted: message });
            await wait(2000); // small delay for API
            const { data } = await axios.get(`https://discardapi.dpdns.org/api/dl/ringtone`, {
                params: { apikey: 'guru', title: query }, timeout: 30000
            });
            if (!data?.result?.length) return sock.sendMessage(chatId, { text: '❌ *No ringtones found!*\nTry a different search term.' }, { quoted: message });
            const tones = data.result.slice(0, 2);
            for (const tone of tones) {
                await sock.sendMessage(chatId, {
                    audio: { url: tone.audio }, mimetype: 'audio/mpeg',
                    fileName: `${tone.title || query}.mp3`, ptt: false,
                    caption: `🎵 *${tone.title || query}*`
                }, { quoted: message });
                await wait(500);
            }
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ Ringtone failed: ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── .soundcloud ───────────────────────────────────────────────────────────── */
const _soundcloud = {
    command: 'soundcloud', aliases: ['sc', 'scdl'],
    category: 'music', description: 'Download SoundCloud track',
    usage: '.soundcloud <SoundCloud URL or name>',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const query  = args.join(' ').trim();
        if (!query) return sock.sendMessage(chatId, { text: '🎵 Usage: `.soundcloud <SoundCloud URL or track name>`' }, { quoted: message });
        try {
            await sock.sendMessage(chatId, { text: '⏳ Fetching from SoundCloud...' }, { quoted: message });
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/soundcloud', {
                params: { url: query }, timeout: 30000
            });
            const audioUrl = data?.data?.audio || data?.data?.download || data?.audio;
            const title    = data?.data?.title || data?.title || query;
            if (!audioUrl) throw new Error('No audio URL from API');
            await sock.sendMessage(chatId, {
                audio: { url: audioUrl }, mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`, ptt: false
            }, { quoted: message });
        } catch (e) {
            await sock.sendMessage(chatId, { text: `❌ SoundCloud failed: ${e.message}` }, { quoted: message });
        }
    }
};

/* ─── Register all ──────────────────────────────────────────────────────────── */
const ALL = [_play, _play2, _song, _video, _lyrics, _trending, _radio, _shazam, _spotify, _ringtone, _soundcloud];
for (const m of ALL) {
    _bundle.push(m);
    try {
        const ch = require('../lib/commandHandler');
        if (m.command) ch.registerCommand(m.command, m);
        if (m.aliases) m.aliases.forEach(a => { try { ch.registerCommand(a, m); } catch {} });
    } catch {}
}
module.exports = _bundle;
