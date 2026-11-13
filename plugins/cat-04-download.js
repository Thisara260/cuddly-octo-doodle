'use strict';
// GIMAA-MD — Download Bundle v3 (upgraded APIs)
// tiktok, facebook, instagram, twitter, dl, video, statusdl + more
const _bundle = [];

/* ===== tiktok.js ===== */
try {
  const _m = (function() {
    const module = {exports: {}}; const exports = module.exports;
'use strict';
const axios = require('axios');
const MAX_VIDEO_SIZE = 60 * 1024 * 1024;

async function downloadBuffer(url, timeout = 90000) {
  const r = await axios.get(url, {
    responseType: 'arraybuffer', timeout,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0', 'Referer': 'https://www.tiktok.com/' }
  });
  return Buffer.from(r.data);
}

async function sendVideo(sock, chatId, message, buf, caption) {
  if (buf.length > MAX_VIDEO_SIZE) {
    await sock.sendMessage(chatId, { document: buf, mimetype: 'video/mp4', fileName: 'tiktok_video.mp4', caption }, { quoted: message });
  } else {
    await sock.sendMessage(chatId, { video: buf, mimetype: 'video/mp4', caption }, { quoted: message });
  }
}

// Method 1: tikwm.com
async function tryTikwm(url) {
  const params = new URLSearchParams({ url, hd: '1' });
  const { data } = await axios.post('https://www.tikwm.com/api/', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TikTok 26.2.0' },
    timeout: 30000,
  });
  if (data.code !== 0 || !data.data) throw new Error(data.msg || 'tikwm error');
  const d = data.data;
  const videoUrl = d.hdplay || d.play;
  if (!videoUrl) throw new Error('No video URL from tikwm');
  return { url: videoUrl, title: d.title, author: d.author?.nickname, quality: d.hdplay ? 'HD' : 'SD' };
}

// Method 2: discardapi
async function tryDiscardApi(url) {
  const apiUrl = `https://discardapi.onrender.com/api/dl/tiktok?apikey=guru&url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(apiUrl, { timeout: 45000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!data?.status || !data?.result) throw new Error('Invalid API response');
  const res = data.result;
  const hd = res.data?.find(v => v.type === 'nowatermark_hd');
  const noWm = res.data?.find(v => v.type === 'nowatermark');
  const videoUrl = hd?.url || noWm?.url;
  if (!videoUrl) throw new Error('No downloadable video');
  return { url: videoUrl, title: res.title, author: res.author?.nickname, quality: hd ? 'HD No Watermark' : 'No Watermark', stats: res.stats, music: res.music_info?.title };
}

// Method 3: @mrnima/tiktok-downloader
async function tryMrnima(url) {
  const tiktok = require('@mrnima/tiktok-downloader');
  const res = await tiktok(url);
  const videoUrl = res?.nowm || res?.video || res?.result?.video;
  if (!videoUrl) throw new Error('No URL from @mrnima');
  return { url: videoUrl, title: res?.title || 'TikTok Video', author: res?.author };
}

// Method 4: ruhend-scraper
async function tryRuhend(url) {
  const { ttdl } = require('ruhend-scraper');
  const res = await ttdl(url);
  const videoUrl = res?.data?.play || res?.data?.video;
  if (!videoUrl) throw new Error('No URL from ruhend');
  return { url: videoUrl, title: res?.data?.title };
}

// Method 5: jawad-tech (shared multi-platform downloader — see lib/jawadDownloader.js)
async function tryJawad(url) {
  const { jawadDownload } = require('../lib/jawadDownloader');
  const { media } = await jawadDownload(url);
  const best = media.find(m => m.type === 'video') || media[0];
  if (!best?.url) throw new Error('No URL from jawad-tech');
  return { url: best.url, title: best.title || 'TikTok Video' };
}

const METHODS = [
  { name: 'tikwm',      fn: tryTikwm     },
  { name: 'discardapi', fn: tryDiscardApi },
  { name: 'mrnima',     fn: tryMrnima    },
  { name: 'ruhend',     fn: tryRuhend    },
  { name: 'jawad-tech', fn: tryJawad     },
];

module.exports = {
  command: 'tiktok', aliases: ['tt', 'ttdl', 'tiktokdl'],
  category: 'download', description: 'Download TikTok video (no watermark, HD)',
  usage: '.tiktok <TikTok URL>',
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const url = args.join(' ').trim();
    if (!url) return sock.sendMessage(chatId, { text: '🎵 *TikTok Downloader*\n\nUsage: .tiktok <TikTok URL>' }, { quoted: message });
    await sock.sendMessage(chatId, { text: '⏳ Downloading TikTok...' }, { quoted: message });
    let lastErr;
    for (const m of METHODS) {
      try {
        const info = await m.fn(url);
        const buf  = await downloadBuffer(info.url);
        let caption = `🎵 *TikTok by ${info.author || 'Unknown'}*\n✨ Quality: ${info.quality || 'No Watermark'}\n🎶 ${info.music || ''}`.trim();
        if (info.stats) caption += `\n❤️ ${info.stats.likes} | 👀 ${info.stats.views}`;
        await sendVideo(sock, chatId, message, buf, caption);
        return;
      } catch (e) { lastErr = e; }
    }
    await sock.sendMessage(chatId, { text: `❌ All TikTok methods failed: ${lastErr?.message}` }, { quoted: message });
  }
};
    return module.exports;
  })();
  _bundle.push(_m);
  if (_m.command) require('../lib/commandHandler').registerCommand(_m);
} catch(e) { console.warn('[BUNDLE:cat-04-download] tiktok.js:', e.message); }

/* ===== instagram.js ===== */
try {
  const _m = (function() {
    const module = {exports: {}}; const exports = module.exports;
'use strict';
const axios = require('axios');
let igdl;
try { igdl = require('ruhend-scraper').igdl; } catch {}

// ✅ FIX: detect real media type instead of trusting a ".mp4 in the URL"
// guess — CDN links rarely carry a file extension, which was causing
// videos to get sent with `image:` (WhatsApp then shows a broken/blank
// picture). We check the API's own type field first, then fall back to
// a lightweight HEAD request to read the real Content-Type.
async function resolveIsVideo(item) {
  const t = (item.type || item.mediaType || '').toString().toLowerCase();
  if (t.includes('video') || t === 'reel') return true;
  if (t.includes('image') || t === 'photo') return false;
  if (/\.(mp4|mov|m4v)(\?|$)/i.test(item.url)) return true;
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(item.url)) return false;
  try {
    const head = await axios.head(item.url, { timeout: 8000 });
    return (head.headers['content-type'] || '').includes('video');
  } catch {
    return false; // safest default when we truly can't tell
  }
}

// Primary provider: nexray (handles posts, reels & stories more reliably
// than the old scraper, which was 404-ing on a lot of links).
async function nexrayDownload(url) {
  const { data } = await axios.get('https://api.nexray.eu.cc/downloader/instagram', {
    params: { url }, timeout: 25000
  });
  const list = data?.result?.data || data?.result || data?.data || [];
  const arr = Array.isArray(list) ? list : [list];
  const media = arr
    .map(m => ({ url: m.url || m.download_url || m.link, type: m.type || m.mediaType }))
    .filter(m => m.url);
  if (!media.length) throw new Error('nexray returned no media');
  return media;
}

module.exports = {
  command: 'instagram', aliases: ['ig', 'igdl', 'insta'],
  category: 'download', description: 'Download Instagram posts, reels, stories & videos',
  usage: '.ig <instagram link>',
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const url = args.join(' ').trim() || message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    if (!url) return sock.sendMessage(chatId, { text: '📸 *Instagram Downloader*\n\nUsage: .ig <post | reel | story | video link>' }, { quoted: message });
    const igRegex = /https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|tv|stories)\//i;
    if (!igRegex.test(url)) return sock.sendMessage(chatId, { text: '❌ Invalid Instagram link.' }, { quoted: message });
    await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });

    let media = null;
    let lastErr = null;

    // Primary: nexray (heavier/more reliable API, fixes the 404s on stories)
    try {
      media = await nexrayDownload(url);
    } catch (e) {
      lastErr = e;
    }

    // Fallback 1: ruhend-scraper
    if (!media) {
      try {
        if (!igdl) throw new Error('ruhend-scraper not available');
        const res = await igdl(url);
        if (!res?.data?.length) throw new Error('empty result');
        const seen = new Set();
        media = res.data.filter(m => { if (!m?.url || seen.has(m.url)) return false; seen.add(m.url); return true; });
      } catch (e) { lastErr = e; }
    }

    // Fallback 2: jawad-tech
    if (!media) {
      try {
        const { jawadDownload } = require('../lib/jawadDownloader');
        const { media: jMedia } = await jawadDownload(url);
        media = jMedia;
      } catch (e) { lastErr = e; }
    }

    if (!media || !media.length) {
      return sock.sendMessage(chatId, { text: `❌ Failed to fetch: ${lastErr?.message || 'no providers returned media (link may be private/expired)'}` }, { quoted: message });
    }

    try {
      for (const item of media.slice(0, 5)) {
        const isVideo = await resolveIsVideo(item);
        if (isVideo) await sock.sendMessage(chatId, { video: { url: item.url }, caption: '📸 Instagram Video' }, { quoted: message });
        else await sock.sendMessage(chatId, { image: { url: item.url }, caption: '📸 Instagram Photo' }, { quoted: message });
      }
    } catch (e2) {
      await sock.sendMessage(chatId, { text: `❌ Failed to send media: ${e2.message}` }, { quoted: message });
    }
  }
};
    return module.exports;
  })();
  _bundle.push(_m);
  if (_m.command) require('../lib/commandHandler').registerCommand(_m);
} catch(e) { console.warn('[BUNDLE:cat-04-download] instagram.js:', e.message); }

/* ===== twitter.js ===== */
try {
  const _m = (function() {
    const module = {exports: {}}; const exports = module.exports;
'use strict';
const axios = require('axios');
module.exports = {
  command: 'twitter', aliases: ['xtweet', 'twitterdl', 'xdl'],
  category: 'download', description: 'Download video/image from X/Twitter',
  usage: '.twitter <Tweet URL>',
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const url = args.join(' ').trim();
    if (!url) return sock.sendMessage(chatId, { text: '🐦 *Twitter/X Downloader*\n\nUsage: .twitter <tweet URL>' }, { quoted: message });
    try {
      const apiUrl = `https://discardapi.dpdns.org/api/dl/twitter?apikey=guru&url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(apiUrl, { timeout: 20000 });
      if (!data?.status || !data.result?.media?.length) throw new Error('empty result');
      const tweet = data.result;
      const caption = `🐦 @${tweet.authorUsername} (${tweet.authorName})\n${tweet.text}\n\n❤️ ${tweet.likes} | 🔁 ${tweet.retweets} | 💬 ${tweet.replies}`.trim();
      for (const item of tweet.media) {
        if (item.type === 'video') await sock.sendMessage(chatId, { video: { url: item.url }, caption }, { quoted: message });
        else if (item.type === 'image') await sock.sendMessage(chatId, { image: { url: item.url }, caption }, { quoted: message });
      }
    } catch (e) {
      // ✅ FIX: fall back to jawad-tech when the primary API is down/empty.
      try {
        const { jawadDownload } = require('../lib/jawadDownloader');
        const { media } = await jawadDownload(url);
        for (const item of media.slice(0, 5)) {
          if (item.type === 'video') await sock.sendMessage(chatId, { video: { url: item.url }, caption: '🐦 X/Twitter' }, { quoted: message });
          else await sock.sendMessage(chatId, { image: { url: item.url }, caption: '🐦 X/Twitter' }, { quoted: message });
        }
      } catch (e2) { await sock.sendMessage(chatId, { text: `❌ Failed: ${e2.message}` }, { quoted: message }); }
    }
  }
};
    return module.exports;
  })();
  _bundle.push(_m);
  if (_m.command) require('../lib/commandHandler').registerCommand(_m);
} catch(e) { console.warn('[BUNDLE:cat-04-download] twitter.js:', e.message); }

/* ===== facebook.js ===== */
try {
  const _m = (function() {
    const module = {exports: {}}; const exports = module.exports;
'use strict';
const axios = require('axios');
// ✅ FIX (fbdl is not a function): package exports a named `facebook`
// function, not a callable module — destructure the real function.
let fbdl;
try { fbdl = require('@mrnima/facebook-downloader').facebook; } catch {}

// ✅ FIX (ENOTFOUND): the old fallback domain (api.davidcyriltech.my.id) no
// longer resolves at all. Swapped for the shared jawad-tech downloader,
// which also backs tiktok/instagram/twitter below.
const { jawadDownload } = require('../lib/jawadDownloader');
async function fetchViaFallbackAPI(url) {
  const { media } = await jawadDownload(url);
  const best = media.find(m => m.type === 'video') || media[0];
  return best?.url;
}

module.exports = {
  command: 'facebook', aliases: ['fb', 'fbdl'],
  category: 'download', description: 'Download Facebook video',
  usage: '.fb <facebook video URL>',
  async handler(sock, message, args, context = {}) {
    const chatId = context.chatId || message.key.remoteJid;
    const url = args.join(' ').trim();
    if (!url) return sock.sendMessage(chatId, { text: '📘 *Facebook Downloader*\n\nUsage: .fb <Facebook video URL>' }, { quoted: message });
    await sock.sendMessage(chatId, { text: '⏳ Fetching Facebook video...' }, { quoted: message });

    let videoUrl = null, title = '', lastErr = null;

    // Primary provider
    try {
      if (typeof fbdl !== 'function') throw new Error('@mrnima/facebook-downloader not installed');
      const res = await fbdl(url);
      const links = res?.result?.links || res?.links || {};
      videoUrl = links.HD || links.hd || links.SD || links.sd || res?.result?.hd || res?.result?.sd || res?.hd || res?.sd || res?.url;
      title = res?.result?.title || res?.title || '';
      if (!videoUrl) throw new Error('No video URL in response');
    } catch (e) { lastErr = e; }

    // Fallback provider if primary failed (e.g. 404 from a dead upstream endpoint)
    if (!videoUrl) {
      try { videoUrl = await fetchViaFallbackAPI(url); }
      catch (e2) { lastErr = e2; }
    }

    if (!videoUrl) {
      return sock.sendMessage(chatId, { text: `❌ Failed: ${lastErr?.message || 'No video URL found'}\n\nThe link may be private/expired, or both download providers are temporarily down. Try again in a bit.` }, { quoted: message });
    }
    try {
      await sock.sendMessage(chatId, { video: { url: videoUrl }, caption: `📘 *Facebook Video*\n${title}`.trim() }, { quoted: message });
    } catch (e) { await sock.sendMessage(chatId, { text: `❌ Failed to send video: ${e.message}` }, { quoted: message }); }
  }
};
    return module.exports;
  })();
  _bundle.push(_m);
  if (_m.command) require('../lib/commandHandler').registerCommand(_m);
} catch(e) { console.warn('[BUNDLE:cat-04-download] facebook.js:', e.message); }

module.exports = _bundle;
