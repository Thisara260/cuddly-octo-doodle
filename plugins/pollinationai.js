
'use strict';

const axios = require('axios');

const API_URL = 'https://eliteprotech-apis.zone.id/ai/pollinationai';

module.exports = {
    command: 'pollination',
    aliases: ['imagine', 'img', 'aiimg', 'imagegen', 'aiimage'],
    category: 'ai',
    description: 'Generate AI images from text prompts',
    usage: '.imagine <image prompt>',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        const reply = async (text) => {
            return sock.sendMessage(
                chatId,
                { text },
                { quoted: message }
            );
        };

        if (!args.length) {
            return reply(
                '🎨 *GIMAA AI IMAGE GENERATOR*\n\n' +
                'Enter a prompt to generate an image.\n\n' +
                '*Example:*\n' +
                '.imagine A futuristic black sports car in a neon city'
            );
        }

        const prompt = args.join(' ').trim();

        try {
            await sock.sendMessage(chatId, {
                react: { text: '🎨', key: message.key }
            });

            await reply('🎨 Generating your AI image...\nPlease wait.');

            const response = await axios.get(API_URL, {
                params: { prompt },
                responseType: 'arraybuffer',
                timeout: 120000,
                maxContentLength: 25 * 1024 * 1024,
                headers: {
                    Accept: 'image/*, application/json'
                }
            });

            const contentType = (
                response.headers['content-type'] || ''
            ).toLowerCase();

            let imageBuffer;
            let mimeType = contentType;

            // API returned the image directly.
            if (contentType.startsWith('image/')) {
                imageBuffer = Buffer.from(response.data);
            } else {
                // API returned JSON or text.
                const raw = Buffer.from(response.data).toString('utf8');

                let data;

                try {
                    data = JSON.parse(raw);
                } catch {
                    data = raw.trim();
                }

                if (data && typeof data === 'object' &&
                    (data.success === false || data.status === false)) {
                    throw new Error(data.message || 'Image generation failed');
                }

                // Find image URLs or base64 data in common API response fields.
                const imageKeys = [
                    'image', 'imageUrl', 'image_url',
                    'url', 'downloadUrl', 'download_url',
                    'result', 'output', 'data'
                ];

                function findImage(value, depth = 0) {
                    if (depth > 5 || value == null) return null;

                    if (typeof value === 'string') {
                        const text = value.trim();

                        if (/^https?:\/\/\S+$/i.test(text)) {
                            return { type: 'url', value: text };
                        }

                        const base64 = text.match(
                            /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
                        );

                        if (base64) {
                            return {
                                type: 'base64',
                                mime: base64[1],
                                value: base64[2]
                            };
                        }

                        return null;
                    }

                    if (Array.isArray(value)) {
                        for (const item of value) {
                            const found = findImage(item, depth + 1);
                            if (found) return found;
                        }
                        return null;
                    }

                    if (typeof value === 'object') {
                        for (const key of imageKeys) {
                            if (value[key] !== undefined) {
                                const found = findImage(
                                    value[key],
                                    depth + 1
                                );
                                if (found) return found;
                            }
                        }
                    }

                    return null;
                }

                const found = findImage(data);

                if (!found) {
                    throw new Error('No image URL or image data found in API response');
                }

                if (found.type === 'base64') {
                    imageBuffer = Buffer.from(found.value, 'base64');
                    mimeType = found.mime;
                } else {
                    const imageResponse = await axios.get(found.value, {
                        responseType: 'arraybuffer',
                        timeout: 90000,
                        maxContentLength: 25 * 1024 * 1024
                    });

                    mimeType = (
                        imageResponse.headers['content-type'] || ''
                    ).toLowerCase();

                    if (!mimeType.startsWith('image/')) {
                        throw new Error('The returned URL did not contain an image');
                    }

                    imageBuffer = Buffer.from(imageResponse.data);
                }
            }

            if (!imageBuffer || imageBuffer.length === 0) {
                throw new Error('Empty image received');
            }

            await sock.sendMessage(
                chatId,
                {
                    image: imageBuffer,
                    caption:
                        `🎨 *GIMAA AI IMAGE GENERATOR*\n\n` +
                        `📝 *Prompt:* ${prompt}\n\n` +
                        `> POWERED BY GIMAA`
                },
                { quoted: message }
            );

            await sock.sendMessage(chatId, {
                react: { text: '✅', key: message.key }
            });

        } catch (error) {
            console.error('[POLLINATION IMAGE]', error.message);

            return reply(
                '❌ *Image Generation Failed*\n\n' +
                'The image API may be unavailable or may have returned an unsupported response.\n' +
                'Please try again.'
            );
        }
    }
};
