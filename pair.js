const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const yts = require('yt-search');
const fetch = require('node-fetch');
const os = require('os');
const ddownr = require('denethdev-ytmp3');
const api = `https://api-dark-shan-yt.koyeb.app`;
const apikey = `edbcfabbca5a9750`;
const { initUserEnvIfMissing } = require('./settingsdb');
const { initEnvsettings, getSetting } = require('./settings');

//=======================================
const autoReact = getSetting('AUTO_REACT') || 'off';

//=======================================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
//=======================================
const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_ANTI_DELETE: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: [
  '💖', '🩷', '💘', '💝', '💗', '💕', '💞', '🌸', '🎀', '🧸',
  '🐰', '🦋', '🩵', '🍓', '🧁', '🌷', '☁️', '🌈', '🍒', '🐝',
  '💫', '⭐', '🫶', '🦄', '🐥', '💐', '🪩', '🕊️', '💟', '🩰',
  '✨', '🎈', '🧃', '🐇', '🥹', '🌼', '🪻', '🫧', '🌹', '🦢'
],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/Ekoe6EykUJf0KfQShsBfoN',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://raw.githubusercontent.com/Nimeshkamihiran/mini-bot-sup/main/20251013_045921.jpg',
    NEWSLETTER_JID: '120363401225837204@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    NEWS_JSON_URL: '',
    BOT_NAME: 'ɴᴇɴᴏ_ᴍɪɴɪ',
    OWNER_NAME: '@ɴɪᴍᴇꜱʜᴋᴀ',
    OWNER_NUMBER: '94721584279',
    BOT_VERSION: '2.0.0',
    BOT_FOOTER: '> © ɴᴇɴᴏ ᴍɪɴɪ',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb6BQQmFnSz7bmxefu40',
    BUTTON_IMAGES: {
        ALIVE: 'https://files.catbox.moe/9uuvfz.jpg',
        MENU: 'https://raw.githubusercontent.com/Nimeshkamihiran/mini-bot-sup/main/20251012_212302.jpg',
        OWNER: 'https://raw.githubusercontent.com/Nimeshkamihiran/mini-bot-sup/main/20251015_092409.jpg',
        SONG: 'https://files.catbox.moe/fkw8ac.jpg',
        VIDEO: 'https://files.catbox.moe/fkw8ac.jpg'
    }
};
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const mongoUri = 'mongodb://mongo:lwcQdyOoMYvzQpyizLcHuxxjdzcxdxGU@shuttle.proxy.rlwy.net:47706';
const client = new MongoClient(mongoUri);
let db;

async function initMongo() {
    if (!db) {
        await client.connect();
        db = client.db('NENOMINI');
        // Create index for faster queries
        await db.collection('sessions').createIndex({ number: 1 });
    }
    return db;
}
function generateListMessage(text, buttonTitle, sections) {
    return {
        text: text,
        footer: config.BOT_FOOTER,
        title: buttonTitle,
        buttonText: "Select",
        sections: sections
    };
}
//=======================================
function generateButtonMessage(content, buttons, image = null) {
    const message = {
        text: content,
        footer: config.BOT_FOOTER,
        buttons: buttons,
        headerType: 1
    };
    if (image) {
        message.headerType = 4;
        message.image = typeof image === 'string' ? { url: image } : image;
    }
    return message;
}
//=======================================
const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}
//=======================================
function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}
function formatMessage(title, content, footer) {
    return `${title}\n\n${content}\n\n${footer}`;
}
function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}
// Utility function for runtime formatting (used in 'system' case)
function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
    const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}
//=======================================
async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
        console.error('Invalid group invite link format');
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
                console.log(`Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
            console.warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}
//=======================================
async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success'
    ? `✅ Joined Successfully`
    : `❌ Failed to Join Group\n> ${groupResult.error}`;

const caption = formatMessage(
`*╭─❏◦•◦•◦•◦•◦•◦❏─╮*
*╎* ✨ \`ㅤ𝑺𝑬𝑺𝑺𝑰𝑶𝑵 𝑺𝑻𝑨𝑹𝑻𝑬𝑫ㅤ\` ✨
*╎ ⭑ BOT:* ᴺᴱᴺᴼ-ˣᴹᴰ 💫
*╎ ⭑ STATUS:* ᴄᴏɴɴᴇᴄᴛᴇᴅ ✅
*╎ ⭑ NUMBER:* ${number}
*╎ ⭑ MODE:* ᴏɴʟɪɴᴇ 🩵
*╎ ⭑ GROUP:* ${groupStatus}
*╎ ⭑ HOSTING:* ʜᴇʀᴏᴋᴜ ☁️
*╰─❏◦•◦•◦•◦•◦•◦❏─╯*

*╭─❏◦•◦•◦•◦•◦•◦❏─╮*
*╎* 💖 \`ㅤ𝑰𝑵𝑭𝑶 𝑳𝑶𝑮ㅤ\` 💖
*╎ ⭑ SESSION:* ᴀᴄᴛɪᴠᴇ 🔥
*╎ ⭑ SECURITY:* ꜱᴀꜰᴇ & ᴠᴇʀɪꜰɪᴇᴅ 🛡️
*╎ ⭑ FOOTER:* ${config.BOT_FOOTER}
*╰─❏◦•◦•◦•◦•◦•◦❏─╯*

> ᴍᴏꜱᴛ ᴄᴏᴍᴍᴀɴᴅ ꜱᴜᴘᴘᴏʀᴛ ᴏɴʟʏ ᴏɴᴇ ʙᴏᴛ ɪꜱ ɴᴇɴᴏ ᴍɪɴɪ

*╭─❏◦•◦•◦•◦•◦•◦❏─╮*
*╎* ⚙️ \`ㅤ𝑷𝑶𝑾𝑬𝑹𝑬𝑫 𝑩𝒀ㅤ\` ⚙️
*╎ ⭑ ᴺᴱᴺᴼ-ˣᴹᴰ ꜱʏꜱᴛᴇᴍ ⚡*
*╰─❏◦•◦•◦•◦•◦•◦❏─╯*`
);

    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: config.IMAGE_PATH },
                    caption
                }
            );
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}
//=======================================
async function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        
        // Newsletter message එකක්ද කියලා check කරනවා
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            // 🧠 Multiple emojis array
            const emojis = [
                '💖', '❤️', '🩵', '💙', '💜', '💚', '🧡', '🤍', '🤎',
                '✨', '🔥', '🌸', '🌹', '💫', '⭐', '💎', '🎉', '😇',
                '😊', '🥰', '😍', '🤩', '😎', '💪', '🙌', '🙏', '😉'
            ];

            // 🎲 Random emoji select කරනවා
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            
            // Newsletter message ID එක extract කරනවා
            const messageId = message.key.id || message.newsletterServerId;

            if (!messageId) {
                console.warn('No valid message ID found:', message.key);
                return;
            }

            // Retry mechanism with exponential backoff
            let retries = config.MAX_RETRIES || 3;
            while (retries > 0) {
                try {
                    // @dark-yasiya/baileys හරහා newsletter reaction යවනවා
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId,
                        randomEmoji
                    );
                    
                    console.log(`✅ Successfully reacted to newsletter message with ${randomEmoji}`);
                    break;
                    
                } catch (error) {
                    retries--;
                    console.warn(
                        `⚠️ Failed to react to newsletter message, retries left: ${retries}`,
                        error.message || error
                    );
                    
                    if (retries === 0) {
                        throw new Error(`Failed after ${config.MAX_RETRIES} attempts: ${error.message}`);
                    }
                    
                    // Exponential backoff delay
                    const delayTime = 2000 * (config.MAX_RETRIES - retries);
                    console.log(`⏳ Waiting ${delayTime}ms before retry...`);
                    await delay(delayTime);
                }
            }
            
        } catch (error) {
            console.error('❌ Newsletter reaction error:', error.message || error);
        }
    });
}
//antidel function
async function setupAntiDeleteHandler(socket) {
    socket.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            try {
                // Delete කළ message එකක්ද කියලා check කරනවා
                if (update.update.message?.protocolMessage?.type === 0) { // REVOKE type
                    const deletedMessageKey = update.update.message.protocolMessage.key;
                    
                    // වැදගත්: AUTO_ANTI_DELETE feature එක on ද කියලා check කරනවා
                    if (config.AUTO_ANTI_DELETE !== 'true') return;

                    console.log('🗑️ Message deleted detected:', deletedMessageKey);

                    // Store එකේ message එක තියෙනවාද බලනවා
                    let originalMessage = null;
                    
                    try {
                        // Message store එකෙන් original message එක load කරනවා
                        originalMessage = await socket.loadMessage(
                            deletedMessageKey.remoteJid,
                            deletedMessageKey.id
                        );
                    } catch (error) {
                        console.warn('⚠️ Could not load original message from store:', error.message);
                    }

                    if (!originalMessage) {
                        console.log('❌ Original message not found in store');
                        return;
                    }

                    // Delete කරපු message එක යලි යවනවා
                    const sender = deletedMessageKey.participant || deletedMessageKey.remoteJid;
                    const chatJid = deletedMessageKey.remoteJid;
                    
                    let retries = config.MAX_RETRIES || 3;
                    while (retries > 0) {
                        try {
                            // Anti-delete notification message
                            let antiDeleteText = `🚫 *Anti-Delete Message*\n\n`;
                            antiDeleteText += `👤 Sender: @${sender.split('@')[0]}\n`;
                            antiDeleteText += `🕒 Deleted at: ${new Date().toLocaleString()}\n`;
                            antiDeleteText += `\n📝 Original Message:\n`;

                            // Message type අනුව handle කරනවා
                            if (originalMessage.message.conversation) {
                                antiDeleteText += originalMessage.message.conversation;
                                
                                await socket.sendMessage(chatJid, {
                                    text: antiDeleteText,
                                    mentions: [sender]
                                });
                                
                            } else if (originalMessage.message.extendedTextMessage) {
                                antiDeleteText += originalMessage.message.extendedTextMessage.text;
                                
                                await socket.sendMessage(chatJid, {
                                    text: antiDeleteText,
                                    mentions: [sender]
                                });
                                
                            } else if (originalMessage.message.imageMessage) {
                                const caption = originalMessage.message.imageMessage.caption || '';
                                
                                await socket.sendMessage(chatJid, {
                                    image: { url: originalMessage.message.imageMessage.url },
                                    caption: `${antiDeleteText}${caption}`,
                                    mentions: [sender]
                                });
                                
                            } else if (originalMessage.message.videoMessage) {
                                const caption = originalMessage.message.videoMessage.caption || '';
                                
                                await socket.sendMessage(chatJid, {
                                    video: { url: originalMessage.message.videoMessage.url },
                                    caption: `${antiDeleteText}${caption}`,
                                    mentions: [sender]
                                });
                                
                            } else if (originalMessage.message.audioMessage) {
                                await socket.sendMessage(chatJid, {
                                    text: antiDeleteText + '🎵 Audio message',
                                    mentions: [sender]
                                });
                                
                                await socket.sendMessage(chatJid, {
                                    audio: { url: originalMessage.message.audioMessage.url },
                                    mimetype: originalMessage.message.audioMessage.mimetype
                                });
                                
                            } else if (originalMessage.message.documentMessage) {
                                const fileName = originalMessage.message.documentMessage.fileName || 'document';
                                
                                await socket.sendMessage(chatJid, {
                                    document: { url: originalMessage.message.documentMessage.url },
                                    mimetype: originalMessage.message.documentMessage.mimetype,
                                    fileName: fileName,
                                    caption: antiDeleteText,
                                    mentions: [sender]
                                });
                                
                            } else if (originalMessage.message.stickerMessage) {
                                await socket.sendMessage(chatJid, {
                                    text: antiDeleteText + '🎭 Sticker',
                                    mentions: [sender]
                                });
                                
                                await socket.sendMessage(chatJid, {
                                    sticker: { url: originalMessage.message.stickerMessage.url }
                                });
                                
                            } else {
                                // Other message types
                                await socket.sendMessage(chatJid, {
                                    text: antiDeleteText + '📎 Other media type',
                                    mentions: [sender]
                                });
                            }

                            console.log('✅ Anti-delete message sent successfully');
                            break;
                            
                        } catch (error) {
                            retries--;
                            console.warn(
                                `⚠️ Failed to send anti-delete message, retries left: ${retries}`,
                                error.message || error
                            );
                            
                            if (retries === 0) {
                                throw new Error(`Failed after ${config.MAX_RETRIES} attempts: ${error.message}`);
                            }
                            
                            const delayTime = 1000 * (config.MAX_RETRIES - retries);
                            console.log(`⏳ Waiting ${delayTime}ms before retry...`);
                            await delay(delayTime);
                        }
                    }
                }
                
            } catch (error) {
                console.error('❌ Anti-delete handler error:', error.message || error);
            }
        }
    });
}
// Helper function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
//=======================================
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

        try {
            if (autoReact === 'on' && message.key.remoteJid) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }

            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        // @dark-yasiya/baileys වලට ගැලපෙන විදිහට update කළා
                        await socket.sendMessage(
                            message.key.remoteJid,
                            { 
                                react: { 
                                    text: randomEmoji, 
                                    key: message.key 
                                } 
                            }
                        );
                        console.log(`Reacted to status with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}
//=======================================
async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getSriLankaTimestamp();
        
        const message = formatMessage(
            '╭──◯',
            `│ \`D E L E T E\`\n│ *⦁ From :* ${messageKey.remoteJid}\n│ *⦁ Time:* ${deletionTime}\n│ *⦁ Type: Normal*\n╰──◯`,
            `${config.BOT_FOOTER}`
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.IMAGE_PATH },
                caption: message
            });
            console.log(`Notified ${number} about message deletion: ${messageKey.id}`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}

// Image resizing function
async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    return kiyomasa;
}

// Capitalize first letter
function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Generate serial
const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

// Send slide with news items
async function SendSlide(socket, jid, newsItems) {
    let anu = [];
    for (let item of newsItems) {
        let imgBuffer;
        try {
            imgBuffer = await resize(item.thumbnail, 300, 200);
        } catch (error) {
            console.error(`Failed to resize image for ${item.title}:`, error);
            imgBuffer = await Jimp.read('https://i.ibb.co/PJvjMx9/20250717-093632.jpg');
            imgBuffer = await imgBuffer.resize(300, 200).getBufferAsync(Jimp.MIME_JPEG);
        }
        let imgsc = await prepareWAMessageMedia({ image: imgBuffer }, { upload: socket.waUploadToServer });
        anu.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `*${capital(item.title)}*\n\n${item.body}`
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                hasMediaAttachment: true,
                ...imgsc
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐃𝙴𝙿𝙻𝙾𝚈","url":"https:/","merchant_url":"https://www.google.com"}`
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐂𝙾𝙽𝚃𝙰𝙲𝚃","url":"https","merchant_url":"https://www.google.com"}`
                    }
                ]
            })
        });
    }
    const msgii = await generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: "*Latest News Updates*"
                    }),
                    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                        cards: anu
                    })
                })
            }
        }
    }, { userJid: jid });
    return socket.relayMessage(jid, msgii.message, {
        messageId: msgii.key.id
    });
}

// Fetch news from API
async function fetchNews() {
    try {
        const response = await axios.get(config.NEWS_JSON_URL);
        return response.data || [];
    } catch (error) {
        console.error('Failed to fetch news from raw JSON URL:', error.message);
        return [];
    }
}

// Setup command handlers with buttons and images
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
            const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }
        else if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        if (!command) return;

        try {
            switch (command) {
                case 'allmenu': {
    await socket.sendMessage(sender, { react: { text: '🔥', key: msg.key } });

    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const caption = 
`*╭╌╌╌╌◯*
*╎* \`ㅤㅤ𝑯𝑬𝑳𝑳𝑶 𝑼𝑺𝑬𝑹ㅤㅤ\`
*╎ ⭓ BOT :* ɴᴇɴᴏ ᴍɪɴɪ ᴠ3 ⚡
*╎ ⭓ TYPE :* ᴍɪɴɪ ʙᴏᴛ
*╎ ⭓ PLATFORM :* ɴᴇɴᴏ ʜᴏꜱᴛ
*╎ ⭓ STATUS :* ᴏɴʟɪɴᴇ 💫
*╎ ⭓ UPTIME :* ${hours}h ${minutes}m ${seconds}s
*╰╌┬╌╌◯*
*╭╌┴╌╌◯*
*╎* \`ㅤㅤ𝑩𝑶𝑻 𝑴𝑬𝑵𝑼ㅤㅤ\`
*╰━━━━━━━━━━━━━━━━━╯

┏━━━━━━━━━━━━━━━━━┓
┃ *🎵 DOWNLOAD MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ ✦ ${config.PREFIX}song <name>
┃    └─ Download mp3
┃
┃ ✦ ${config.PREFIX}tiktok <url>
┃    └─ TikTok no watermark
┃
┃ ✦ ${config.PREFIX}ts
┃    └─ TikTok no found
┃
┃ ✦ ${config.PREFIX}fb <url>
┃    └─ Facebook video
┃   
┃ ✦ ${config.PREFIX}ig <url>
┃    └─ instagram video
┃
┃ ✦ ${config.PREFIX}play
┃    └─ Get Song Youtube
┃
┗━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━┓
┃ *👥 GROUP MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ ✦ ${config.PREFIX}kick @user
┃    └─ Remove member
┃
┃ ✦ ${config.PREFIX}add 94XXX
┃    └─ Add member
┃
┃ ✦ ${config.PREFIX}promote @user
┃    └─ Make admin
┃
┃ ✦ ${config.PREFIX}demote @user
┃    └─ Remove admin
┃
┃ ✦ ${config.PREFIX}mute / unmute
┃    └─ Group open/close
┃
┃ ✦ ${config.PREFIX}tagall <msg>
┃    └─ Tag all members
┃
┃ ✦ ${config.PREFIX}hidetag <msg>
┃    └─ Hidden tag
┃
┃ ✦ ${config.PREFIX}groupinfo
┃    └─ Group details
┃
┃ ✦ ${config.PREFIX}getdp
┃    └─ Get group display picture
┃
┃ ✦ ${config.PREFIX}uinfo
┃    └─ Get user info
┃
┃ ✦ ${config.PREFIX}left <text>
┃    └─ Left Group
┃
┃ ✦ ${config.PREFIX}setname/setdec
┃    └─ Group
┗━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━┓
┃ *✨ OWNER MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ ✦ ${config.PREFIX}vv
┃    └─ Unlock oneview
┃
┃ ✦ ${config.PREFIX}spam 
┃    └─ Spam number
┃
┃ ✦ ${config.PREFIX}getdp
┃    └─ Save Dp
┃
┃ ✦ ${config.PREFIX}uinfo
┃    └─ get info numbrr
┃
┃ ✦ ${config.PREFIX}getabout
┃    └─ Get user about
┃
┃ ✦ ${config.PREFIX}dev
┃    └─ Info Owner
┃
┃ ✦ ${config.PREFIX}owner
┃    └─ Contact Owner
┃
┃ ✦ ${config.PREFIX}hidetag <msg>
┃    └─ Hidden tag
┃
┃ ✦ ${config.PREFIX}groupinfo
┃    └─ Group details
┃
┃ ✦ ${config.PREFIX}getdp
┃    └─ Get group display picture
┃
┃ ✦ ${config.PREFIX}alldp
┃    └─ get group member all dp
┃
┃ ✦ ${config.PREFIX}uinfo
┃    └─ Get user info
┃
┃ ✦ ${config.PREFIX}spam <text>
┃    └─ Spam message
│
┃ ✦ ${config.PREFIX}send
┃    └─ save statuse
│
┃ ✦ ${config.PREFIX}tourl
┃    └─ Get url
┗━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━┓
┃ *🌸 LOGO MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ ✦ ${config.PREFIX}3dcomic <text>
┃    └─ 3D Comic Text Style
┃
┃ ✦ ${config.PREFIX}blackpink <text>
┃    └─ Pink Aesthetic Font
┃
┃ ✦ ${config.PREFIX}neonlight <text>
┃    └─ Bright Neon Glow Effect
┃
┃ ✦ ${config.PREFIX}naruto <text>
┃    └─ Anime Inspired Logo
┃
┃ ✦ ${config.PREFIX}hacker <text>
┃    └─ Matrix Digital Style
┃
┗━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━┓
┃ *🧠 AI & INFO MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ ✦ ${config.PREFIX}gf <Talk With Saduni>
┃    └─ Use AI
┃
┃ ✦ ${config.PREFIX}bro <Talk With Neno>
┃    └─ Use AI
┃
┃ ✦ ${config.PREFIX}dev
┃    └─ Show bot info
┃
┃ ✦ ${config.PREFIX}ping
┃    └─ Check speed
┃
┃ ✦ ${config.PREFIX}system
┃    └─ Show CPU & memory
┗━━━━━━━━━━━━━━━━━┛

> ᴄᴏɴᴇᴄᴛ ʙᴏᴛ ʏᴏᴜʀ ɴᴜᴍʙᴇʀ ᴜꜱᴇ .ᴘᴀɪʀ <ɴᴜᴍʙᴇʀ>
> ᴏɴᴇ ᴠɪᴇᴡ ɪᴍᴀɢᴇ ɢᴇᴛ ɪɴʙᴏx ᴜꜱᴇ .ɴɪᴄᴇ ᴄᴏᴍᴍɴᴅ

*𖹭 deploy .ᐟ _ɴᴇɴᴏ ᴏᴡɴᴇʀꜱ/_*
╰──────────────────────────────╯`;

    const footer = `*© 2025 ɴᴇɴᴏ ᴍɪɴɪ ⚙️*\n${config.BOT_FOOTER}`;

    await socket.sendMessage(sender, {
        image: { url: 'https://raw.githubusercontent.com/Nimeshkamihiran/mini-bot-sup/main/20251019_155747.png' },
        caption: caption,
        contextInfo: {
            forwardingScore: 1000,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363401225837204@newsletter',
                newsletterName: 'ɴᴇɴᴏ ᴍɪɴɪ',
                serverMessageId: 1
            }
        },
        buttons: [
            { buttonId: `${config.PREFIX}dev`, buttonText: { displayText: '💤 ʙᴏᴛ ɪɴꜰᴏ' }, type: 1 },
            { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: '💫 ᴛᴇꜱᴛ ʙᴏᴛ ᴀʟɪᴠᴇ' }, type: 1 },
            { buttonId: `${config.PREFIX}donate`, buttonText: { displayText: '✨ ᴅᴏɴᴀᴛᴇ ʙᴏᴛ ᴏᴡɴᴇʀꜱ' }, type: 1 }            
        ],
        headerType: 4
    }, { quoted: msg });

    await socket.sendMessage(sender, { react: { text: '✔', key: msg.key } });
    break;
}
    case 'jid':
    try {

        const chatJid = sender;
        
        await socket.sendMessage(sender, {
            text: `${chatJid}`
        });

        await socket.sendMessage(sender, { 
            react: { text: '✅', key: messageInfo.key } 
        });

    } catch (e) {
        await socket.sendMessage(sender, { 
            react: { text: '❌', key: messageInfo.key } 
        });
        
        await socket.sendMessage(sender, {
            text: 'Error while retrieving the JID!'
        });
        
        console.log(e);
    }
    break;
    }           
            
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '❌ ERROR',
                    'An error occurred while processing your command. Please try again.',
                    `${config.BOT_FOOTER}`
                )
            });
        }
    });
}

// Setup message handlers
function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (autoReact === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

// Delete session from MongoDB
async function deleteSessionFromMongo(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        const collection = db.collection('sessions');
        await collection.deleteOne({ number: sanitizedNumber });
        console.log(`Deleted session for ${sanitizedNumber} from MongoDB`);
    } catch (error) {
        console.error('Failed to delete session from MongoDB:', error);
    }
}

// Rename creds on logout
async function renameCredsOnLogout(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        const collection = db.collection('sessions');

        const count = (await collection.countDocuments({ active: false })) + 1;

        await collection.updateOne(
            { number: sanitizedNumber },
            {
                $rename: { "creds": `delete_creds${count}` },
                $set: { active: false }
            }
        );
        console.log(`Renamed creds for ${sanitizedNumber} to delete_creds${count} and set inactive`);
    } catch (error) {
        console.error('Failed to rename creds on logout:', error);
    }
}

// Restore session from MongoDB
async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const db = await initMongo();
        const collection = db.collection('sessions');
        const doc = await collection.findOne({ number: sanitizedNumber, active: true });
        if (!doc) return null;
        return JSON.parse(doc.creds);
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

// Setup auto restart
function setupAutoRestart(socket, number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === 401) {
                console.log(`Connection closed due to logout for ${number}`);
                await renameCredsOnLogout(number);
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
            } else {
                console.log(`Connection lost for ${number}, attempting to reconnect...`);
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
            }
        }
    });
}

// Main pairing function
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await initUserEnvIfMissing(sanitizedNumber);
    await initEnvsettings(sanitizedNumber);
  
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        await fs.ensureDir(sessionPath);
        await fs.writeFile(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`Successfully restored session for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to request pairing code: ${retries}, error.message`, retries);
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) {
                res.send({ code });
            }
        } else {
            if (!res.headersSent) {
                res.send({ status: 'already_paired', message: 'Session restored and connecting' });
            }
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            const db = await initMongo();
            const collection = db.collection('sessions');
            const sessionId = uuidv4();
            await collection.updateOne(
                { number: sanitizedNumber },
                {
                    $set: {
                        sessionId,
                        number: sanitizedNumber,
                        creds: fileContent,
                        active: true,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
            console.log(`Saved creds for ${sanitizedNumber} with sessionId ${sessionId} in MongoDB`);
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    const groupResult = await joinGroup(socket);

                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: '❤️', key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                        console.log('✅ Auto-followed newsletter & reacted ❤️');
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.message);
                    }

                    activeSockets.set(sanitizedNumber, socket);

                    const groupStatus = groupResult.status === 'success'
                        ? 'Joined successfully'
                        : `Failed to join group: ${groupResult.error}`;
                    await socket.sendMessage(userJid, {
                        image: { url: config.IMAGE_PATH },
                        caption: formatMessage(
    '🌸💫 𓆩💖 𝐍ᴇɴᴏ - 𝐌ɪɴɪ 𝐁ᴏ𝐭 💖𓆪 💫🌸',
    `✅ *Successfully Connected!*  

🔢 *Number:* ${sanitizedNumber}  

📋 *Status:* Online & Fully Active 🌐  

─────────────────────────────
💌 *About Neno Mini Bot:*  
Neno Mini Bot isn’t just a bot — it’s a friendly AI-powered companion 💖.  
Crafted with passion and care, Neno helps you manage chats, automate tasks,  
and keep your WhatsApp experience fun, simple, and powerful 💫.  

Whether you’re chatting, handling groups, or exploring commands —  
Neno always stays by your side, quick, smart, and full of personality 🌸.  
With beautiful designs and modern performance,  
it feels like magic in every message ✨.  

─────────────────────────────
🌍 *Try Neno Mini Bot for Free:*  
👉 [https://neno-mini-d9c364a1c5b9.herokuapp.com/](https://neno-mini-d9c364a1c5b9.herokuapp.com/)  

💫 Use it, enjoy it, and share it with your friends!  
📤 You can even post it on your *WhatsApp status* to show off your style 💕  

─────────────────────────────
🎁 *Want Your Own Bot?*  
If you want your own custom version or need setup help —  
feel free to contact the Neno Owners Team directly 🌟  

📞 *Owner Contact:* wa.me/94721584279  
💎 *Team:* 𝐍ᴇɴᴏ 𝐎ᴡɴᴇʀ𝐬 𝐓ᴇᴀ𝐦  
🌸 *Created with Love by Nimeshka Mihiran*  
─────────────────────────────`,
    '> 💖 𝐏ᴏᴡᴇʀᴇᴅ ʙʏ 𝐍ᴇɴᴏ 𝐎ᴡɴᴇʀ𝐬 𝐓ᴇᴀ𝐦 💖'
)
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    exec(`pm2 restart ${process.env.PM2_NAME || 'Shala-Md-Free-Bot-Session'}`);
                }
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) {
            res.status(503).send({ error: 'Service Unavailable' });
        }
    }
}

// Routes
router.get('/', async (req, res) => {
    const { number, force } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    const forceRepair = force === 'true';
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    if (activeSockets.has(sanitizedNumber)) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    if (forceRepair) {
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        await deleteSessionFromMongo(sanitizedNumber);
        if (fs.existsSync(sessionPath)) {
            await fs.remove(sessionPath);
        }
        console.log(`Forced re-pair for ${sanitizedNumber}: deleted old session`);
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'active',
        message: 'BOT is running',
        activesession: activeSockets.size
    });
});

router.get('/connect-all', async (req, res) => {
    try {
        if (!fs.existsSync(NUMBER_LIST_PATH)) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH));
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const results = [];
        const promises = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            promises.push(
                EmpirePair(number, mockRes)
                    .then(() => ({ number, status: 'connection_initiated' }))
                    .catch(error => ({ number, status: 'failed', error: error.message }))
            );
        }

        const promiseResults = await Promise.all(promises);
        results.push(...promiseResults);

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

router.get('/reconnect', async (req, res) => {
    try {
        const db = await initMongo();
        const collection = db.collection('sessions');
        const docs = await collection.find({ active: true }).toArray();

        if (docs.length === 0) {
            return res.status(404).send({ error: 'No active sessions found in MongoDB' });
        }

        const results = [];
        const promises = [];
        for (const doc of docs) {
            const number = doc.number;
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            promises.push(
                EmpirePair(number, mockRes)
                    .then(() => ({ number, status: 'connection_initiated' }))
                    .catch(error => ({ number, status: 'failed', error: error.message }))
            );
        }

        const promiseResults = await Promise.all(promises);
        results.push(...promiseResults);

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

router.get('/getabout', async (req, res) => {
    const { number, target } = req.query;
    if (!number || !target) {
        return res.status(400).send({ error: 'Number and target number are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    try {
        const statusData = await socket.fetchStatus(targetJid);
        const aboutStatus = statusData.status || 'No status available';
        const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
        res.status(200).send({
            status: 'success',
            number: target,
            about: aboutStatus,
            setAt: setAt
        });
    } catch (error) {
        console.error(`Failed to fetch status for ${target}:`, error);
        res.status(500).send({
            status: 'error',
            message: `Failed to fetch About status for ${target}. The number may not exist or the status is not accessible.`
        });
    }
});

// Cleanup
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
    client.close();
});

process.on('uncaughtException', async (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'BOT-session'}`);
});

// Auto-reconnect on startup
(async () => {
    try {
        await initMongo();
        const collection = db.collection('sessions');
        const docs = await collection.find({ active: true }).toArray();
        for (const doc of docs) {
            const number = doc.number;
            if (!activeSockets.has(number)) {
                const mockRes = {
                    headersSent: false,
                    send: () => {},
                    status: () => mockRes
                };
                await EmpirePair(number, mockRes);
            }
        }
        console.log('Auto-reconnect completed on startup');
    } catch (error) {
        console.error('Failed to auto-reconnect on startup:', error);
    }
})();

module.exports = router;
