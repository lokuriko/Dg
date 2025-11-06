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
const autoReact = getSetting('AUTO_REACT') || 'on';

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
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/F2zLgJ1loae8WraMn2jdUd?mode=wwt',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://i.postimg.cc/d0GRqL6N/In-Shot-20251105-181815424.jpg',
    NEWSLETTER_JID: '120363401225837204@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    NEWS_JSON_URL: '',
    BOT_NAME: 'ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2',
    OWNER_NAME: '@ᴄʏʙᴀʀ ʟᴏᴋᴜ ʀɪᴋᴏ',
    OWNER_NUMBER: '94751645330',
    BOT_VERSION: '2.0.0',
    BOT_FOOTER: '> © ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029VbBeDic1yT20xcz3qo0y',
    BUTTON_IMAGES: {
        ALIVE: 'https://i.postimg.cc/DwK9YnyT/20251105-183050.jpg',
        MENU: 'https://i.postimg.cc/W3KKmPfK/20251105-183018.jpg',
        OWNER: 'https://i.postimg.cc/8cMyhfv6/20251105-183119.jpg',
        SONG: 'https://i.postimg.cc/WbmWzrjK/20251105-183136.jpg',
        VIDEO: 'https://i.postimg.cc/3NTjQSyJ/20251105-183150.jpg'
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
        db = client.db('LOKURIKOMINIBOTV2');
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
*💗╎* ✨ \`ㅤ𝑺𝑬𝑺𝑺𝑰𝑶𝑵 𝑺𝑻𝑨𝑹𝑻𝑬𝑫ㅤ\` ✨
*💗╎ ⭑ BOT:* ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2 💫
*💗╎ ⭑ STATUS:* ᴄᴏɴɴᴇᴄᴛᴇᴅ ✅
*💗╎ ⭑ NUMBER:* ${number}
*💗╎ ⭑ MODE:* ᴏɴʟɪɴᴇ 🩵
*💗╎ ⭑ GROUP:* ${groupStatus}
*💗╎ ⭑ HOSTING:* ʜᴇʀᴏᴋᴜ ☁️
  *╰─❏◦•◦•◦•◦•◦•◦❏─╯*

  *╭─❏◦•◦•◦•◦•◦•◦❏─╮*
*💗╎* 💖 \`ㅤ𝑰𝑵𝑭𝑶 𝑳𝑶𝑮ㅤ\` 💖
*💗╎ ⭑ SESSION:* ᴀᴄᴛɪᴠᴇ 🔥
*💗╎ ⭑ SECURITY:* ꜱᴀꜰᴇ & ᴠᴇʀɪꜰɪᴇᴅ 🛡️
*💗╎ ⭑ FOOTER:* © ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ${config.BOT_FOOTER}
  *╰─❏◦•◦•◦•◦•◦•◦❏─╯*

> ᴍᴏꜱᴛ ᴄᴏᴍᴍᴀɴᴅ ꜱᴜᴘᴘᴏʀᴛ ᴏɴʟʏ ᴏɴᴇ ʙᴏᴛ ɪꜱ ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2

  *╭─❏◦•◦•◦•◦•◦•◦❏─╮*
*💗╎* ⚙️ \`ㅤ𝑷𝑶𝑾𝑬𝑹𝑬𝑫 𝑩𝒀 𝘾𝙔𝘽𝘼𝙍 𝙇𝙊𝙆𝙐 𝙍𝙄𝙆𝙊ㅤ\` ⚙️
*💗╎ ⭑ ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2 ꜱʏꜱᴛᴇᴍ ⚡*
  *╰─❏◦•◦•◦•◦•◦•◦❏─╯*`
);

    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: "https://i.postimg.cc/d0GRqL6N/In-Shot-20251105-181815424.jpg" },
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
                image: { url: "https://i.postimg.cc/d0GRqL6N/In-Shot-20251105-181815424.jpg" },
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
    await socket.sendMessage(sender, { react: { text: '🇱🇰', key: msg.key } });

    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const caption = 
`*╭╌╌╌╌◯*
*╎* \` 🐼 𝑯𝑬𝑳𝑳𝑶 𝑼𝑺𝑬𝑹 🐼ㅤㅤ\`
*╎🇦🇱⭓ BOT :* ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴍɪɴɪ ᴠ2 ⚡
*╎🇦🇱⭓ TYPE :* ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ
*╎🇦🇱⭓ PLATFORM :* ʜᴇʀᴏᴋᴜ
*╎🇦🇱⭓ STATUS :* ᴏɴʟɪɴᴇ 💫
*╎🇦🇱⭓ UPTIME :* ${hours}h ${minutes}m ${seconds}s
*╰╌┬╌╌◯*
*╭╌┴╌╌◯*
*╎* \` 🐼 𝑩𝑶𝑻 𝑴𝑬𝑵𝑼 🐼ㅤㅤ\`
*╰━━━━━━━━━━━━━━━━━╯

┏━━━━━━━━━━━━━━━━━┓
┃ *🎵 DOWNLOAD MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ 💗✦ ${config.PREFIX}song <name>
┃    └─ Download mp3
┃
┃ 💗✦ ${config.PREFIX}tiktok <url>
┃    └─ TikTok no watermark
┃
┃ 💗✦ ${config.PREFIX}ts
┃    └─ TikTok no found
┃
┃ 💗✦ ${config.PREFIX}fb <url>
┃    └─ Facebook video
┃   
┃ 💗✦ ${config.PREFIX}ig <url>
┃    └─ instagram video
┃
┃ 💗✦ ${config.PREFIX}play
┃    └─ Get Song Youtube
┃
┗━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━┓
┃ *👥 GROUP MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ 💗✦ ${config.PREFIX}kick @user
┃    └─ Remove member
┃
┃ 💗✦ ${config.PREFIX}add 94XXX
┃    └─ Add member
┃
┃ 💗✦ ${config.PREFIX}promote @user
┃    └─ Make admin
┃
┃ 💗✦ ${config.PREFIX}demote @user
┃    └─ Remove admin
┃
┃ 💗✦ ${config.PREFIX}mute / unmute
┃    └─ Group open/close
┃
┃ 💗✦ ${config.PREFIX}tagall <msg>
┃    └─ Tag all members
┃
┃ 💗✦ ${config.PREFIX}hidetag <msg>
┃    └─ Hidden tag
┃
┃ 💗✦ ${config.PREFIX}groupinfo
┃    └─ Group details
┃
┃ 💗✦ ${config.PREFIX}getdp
┃    └─ Get group display picture
┃
┃ 💗✦ ${config.PREFIX}uinfo
┃    └─ Get user info
┃
┃ 💗✦ ${config.PREFIX}left <text>
┃    └─ Left Group
┃
┃ 💗✦ ${config.PREFIX}setname/setdec
┃    └─ Group
┗━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━┓
┃ *✨ OWNER MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ 💗✦ ${config.PREFIX}vv
┃    └─ Unlock oneview
┃
┃ 💗✦ ${config.PREFIX}spam 
┃    └─ Spam number
┃
┃ 💗✦ ${config.PREFIX}getdp
┃    └─ Save Dp
┃
┃ 💗✦ ${config.PREFIX}uinfo
┃    └─ get info numbrr
┃
┃ 💗✦ ${config.PREFIX}getabout
┃    └─ Get user about
┃
┃ 💗✦ ${config.PREFIX}dev
┃    └─ Info Owner
┃
┃ 💗✦ ${config.PREFIX}owner
┃    └─ Contact Owner
┃
┃ 💗✦ ${config.PREFIX}hidetag <msg>
┃    └─ Hidden tag
┃
┃ 💗✦ ${config.PREFIX}groupinfo
┃    └─ Group details
┃
┃ 💗✦ ${config.PREFIX}getdp
┃    └─ Get group display picture
┃
┃ 💗✦ ${config.PREFIX}alldp
┃    └─ get group member all dp
┃
┃ 💗✦ ${config.PREFIX}uinfo
┃    └─ Get user info
┃
┃ 💗✦ ${config.PREFIX}spam <text>
┃    └─ Spam message
│
┃ 💗✦ ${config.PREFIX}send
┃    └─ save statuse
│
┃ 💗✦ ${config.PREFIX}tourl
┃    └─ Get url
┗━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━┓
┃ *🌸 LOGO MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ 💗✦ ${config.PREFIX}3dcomic <text>
┃    └─ 3D Comic Text Style
┃
┃ 💗✦ ${config.PREFIX}blackpink <text>
┃    └─ Pink Aesthetic Font
┃
┃ 💗✦ ${config.PREFIX}neonlight <text>
┃    └─ Bright Neon Glow Effect
┃
┃ 💗✦ ${config.PREFIX}naruto <text>
┃    └─ Anime Inspired Logo
┃
┃ 💗✦ ${config.PREFIX}hacker <text>
┃    └─ Matrix Digital Style
┃
┗━━━━━━━━━━━━━━━━━┛

┏━━━━━━━━━━━━━━━━━┓
┃ *🧠 AI & INFO MENU*
┣━━━━━━━━━━━━━━━━━┫
┃ 💗✦ ${config.PREFIX}gf <Talk With Saduni>
┃    └─ Use AI
┃
┃ 💗✦ ${config.PREFIX}bro <Talk With Neno>
┃    └─ Use AI
┃
┃ 💗✦ ${config.PREFIX}dev
┃    └─ Show bot info
┃
┃ 💗✦ ${config.PREFIX}ping
┃    └─ Check speed
┃
┃ 💗✦ ${config.PREFIX}system
┃    └─ Show CPU & memory
┗━━━━━━━━━━━━━━━━━┛

> ᴄᴏɴᴇᴄᴛ ʙᴏᴛ ʏᴏᴜʀ ɴᴜᴍʙᴇʀ ᴜꜱᴇ .ᴘᴀɪʀ <ɴᴜᴍʙᴇʀ>
> ᴏɴᴇ ᴠɪᴇᴡ ɪᴍᴀɢᴇ ɢᴇᴛ ɪɴʙᴏx ᴜꜱᴇ .ɴɪᴄᴇ ᴄᴏᴍᴍɴᴅ

*𖹭 deploy .ᐟ _ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2 ᴏᴡɴᴇʀꜱ/_*
╰──────────────────────────────╯`;

    const footer = `*© 2025 ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2 ⚙️*\n${config.BOT_FOOTER}`;

    await socket.sendMessage(sender, {
        image: { url: 'https://i.postimg.cc/d0GRqL6N/In-Shot-20251105-181815424.jpg' },
        caption: caption,
        contextInfo: {
            forwardingScore: 1000,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363401225837204@newsletter',
                newsletterName: 'ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2',
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
                image: { url "https://i.postimg.cc/LsmMhRrz/20251107-005338.jpg" },
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
    '🌸💫 𓆩💖 𝐋ᴏᴋᴜ 𝐑ɪᴋᴏ - 𝐌ɪɴɪ 𝐁ᴏ𝐭 𝐕2💖𓆪 💫🌸',
    `✅ *Successfully Connected!*  

🔢 *Number:* 94751645330${sanitizedNumber} 

📋 *Status:* Online & Fully Active 🌐  

─────────────────────────────
💌 *About Loku Riko Mini Bot v2:*  
 Loku riko mini Bot v2 isn’t just a bot — it’s a friendly AI-powered companion 💖.  
Crafted with passion and care, black cybar loku riko helps you manage chats, automate tasks,  
and keep your WhatsApp experience fun, simple, and powerful 💫.  

Whether you’re chatting, handling groups, or exploring commands —  
loku riko mini bot v2 always stays by your side, quick, smart, and full of personality 🌸.  
With beautiful designs and modern performance,  
it feels like magic in every message ✨.  

─────────────────────────────
🌍 *Try Loku Riko Mini v2 Bot for Free:*  
👉 [https://lokuminibot-600917092abd.herokuapp.com/)  
👉 [https://cybar-loku-riko-mini-bot.onrender.com/)

💫 Use it, enjoy it, and share it with your friends!  
📤 You can even post it on your *WhatsApp status* to show off your style 💕  

─────────────────────────────
🎁 *Want Your Own Bot?*  
If you want your own custom version or need setup help —  
feel free to contact the black cybar loku riko directly 🌟  

📞 *Owner Contact:* wa.me//94751645330 / wa.me//+94752902163  
💎 *Team:* 𝐃𝚃𝚉 𝐂𝚈𝙱𝙰𝚁 𝐋𝙾𝙺𝚄 𝐑𝙸𝙺𝙾  
🌸 *Created with Love by Cybar Loku Riko*  
─────────────────────────────`,
    '> 💖 𝐏ᴏᴡᴇʀᴇᴅ ʙʏ 𝐂ʏʙᴀʀ 𝐋ᴏᴋᴜ 𝐑ɪᴋᴏ 💖'
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
                    exec(`pm2 restart ${process.env.PM2_NAME || 'Loku riko mini bot v2-Free-Bot-Session'}`);
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

    break;
			   }
case 'ping': {
    const os = require("os")
    const start = Date.now();

    const loading = await socket.sendMessage(m.chat, {
        text: "*𝙇𝙊𝙆𝙐 𝙍𝙄𝙆𝙊 𝙈𝙄𝙉𝙄 𝘽𝙊𝙏 𝙑2 𝙋𝙄𝙉𝙂 🇦🇱*"
    }, { quoted: msg });

    const stages = ["*████", "**███", "***██", "****█", "*****"];
    for (let stage of stages) {
        await socket.sendMessage(m.chat, { text: stage, edit: loading.key });
        await new Promise(r => setTimeout(r, 250));
    }

    const end = Date.now();
    const ping = end - start;

    await socket.sendMessage(m.chat, {
        image: { url: "https://i.postimg.cc/pLbpPkSV/20251105-183050.jpg" },
        text: `🇦🇱 𝐏𝙸𝙽𝙶...  ▻  \`10.0010ms\`\n\n *🪻💗ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2 ɪꜱ ᴀᴄᴛɪᴠᴇ ᴛᴏ ꜱɪɢɴᴀʟ ( බොට්ගෙ සිග්නල් ප්‍රතිශතය බැලිමට පින්ග් කියලා සෙන්ඩ් කිරිමෙන් දැන ගන්න පුලුවන් 🪻👻⚡*`,
        edit: loading.key
    });

    break;
			}

		        case 'owner': {
    const ownerNumber = '+94751645330/+94752902163';
    const ownerName = 'OLD KING BLACK CYBAR LOKU RIKO';
    const organization = '*💗🪻OLD KING BLACK CYBAR LOKU RIKO MINI BOT V2 OWNER ( ඔයලට බොටගේ මොනා හරි ප්‍රශ්නයක් තියේ නම් මට කියන්න )🪻💗*';

    const vcard = 'BEGIN:VCARD\n' +
                  'VERSION:2.0\n' +
                  `FN:${ownerName}\n` +
                  `ORG:${organization};\n` +
                  `TEL;type=CELL;type=VOICE;waid=${ownerNumber.replace('+', '')}:${ownerNumber}\n` +
                  'END:VCARD';

    try {
        // Send vCard contact
        const sent = await socket.sendMessage(from, {
            contacts: {
                displayName: ownerName,
                contacts: [{ vcard }]
            }
        });

        // Then send message with reference
        await socket.sendMessage(from, {
            text: `*💗🪻OLD KING BLACK CYBAR LOKU RIKO MINI BOT V2 OWNER ( ඔයලට බොටගේ මොනා හරි ප්‍රශ්නයක් තියේ නම් මට කියන්න )🪻💗*\n\n👨‍🔧 Name: ${ownerName}\n💭 ηυмвєя ➥ ${ownerNumber}\n\n> ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ 🔥`,
            contextInfo: {
                mentionedJid: [`${ownerNumber.replace('+', '')}@s.whatsapp.net`],
                quotedMessageId: sent.key.id
            }
        }, { quoted: msg });

    } catch (err) {
        console.error('❌ Owner command error:', err.message);
        await socket.sendMessage(from, {
            text: '❌ Error sending owner contact.'
        }, { quoted: msg });
    }
				
          
        
  break;
       }
			    
case 'fancy': {
  const axios = require("axios");

  const q =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption || '';

  const text = q.trim().replace(/^.fancy\s+/i, ""); // remove .fancy prefix

  if (!text) {
    return await socket.sendMessage(sender, {
      text: "❎ *Please provide text to convert into fancy fonts.*\n\n📌 *Example:* `.fancy Dila`"
    });
  }

  try {
    const apiUrl = `https://www.dark-yasiya-api.site/other/font?text=${encodeURIComponent(text)}`;
    const response = await axios.get(apiUrl);

    if (!response.data.status || !response.data.result) {
      return await socket.sendMessage(sender, {
        text: "❌ *Error fetching fonts from API. Please try again later.*"
      });
    }

    // Format fonts list
    const fontList = response.data.result
      .map(font => `*${font.name}:*\n${font.result}`)
      .join("\n\n");

    const finalMessage = `🎨 Fancy Fonts Converter\n\n${fontList}\n\n_ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ 🔥_`;

    await socket.sendMessage(sender, {
      text: finalMessage
    }, { quoted: msg });

  } catch (err) {
    console.error("Fancy Font Error:", err);
    await socket.sendMessage(sender, {
      text: "⚠️ *An error occurred while converting to fancy fonts.*"
    });
  }

  break;
	}
case 'song': {
    
    await socket.sendMessage(sender, { react: { text: '🎧', key: msg.key } });
    
    function replaceYouTubeID(url) {
    const regex = /(?:youtube\.com\/(?:.*v=|.*\/)|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}
    
    const q = args.join(" ");
    if (!args[0]) {
        return await socket.sendMessage(from, {
      text: 'Please enter you tube song name or link !!'
    }, { quoted: msg });
    }
    
    try {
        let id = q.startsWith("https://") ? replaceYouTubeID(q) : null;
        
        if (!id) {
            const searchResults = await dy_scrap.ytsearch(q);
            const ytsApiid = await fetch(`https://tharuzz-ofc-apis.vercel.app/api/search/ytsearch?query=${q}`);
            const respId = await ytsApiid.json();*/
           if(!searchResults?.results?.length) return await socket.sendMessage(from, {
             text: '*📛 Please enter valid you tube song name or url.*'
                 });
                }
                
                const data = await dy_scrap.ytsearch(`https://youtube.com/watch?v=${id}`);
                
                if(!data?.results?.length) return await socket.sendMessage(from, {
             text: '*📛 Please enter valid you tube song name or url.*'
                 });
        
                const { url, title, image, timestamp, ago, views, author } = data.results[0];
                
                const caption = `*🎧 \`LOKU RIKO MINI BOT SONG DOWNLOADER\`*\n\n` +
		  `*┏━━━━━━━━━━━━━━━*\n` +
	      `*┃ 📌 \`тιтℓє:\` ${title || "No info"}*\n` +
	      `*┃ ⏰ \`∂υяαтιση:\` ${timestamp || "No info"}*\n` +
	      `*┃ 📅 \`яєℓєαѕє∂ ∂αтє:\` ${ago || "No info"}*\n` +
	      `*┃ 👀 \`νιєωѕ:\` ${views || "No info"}*\n` +
	      `*┃ 👤 \`αυтнσя:\` ${author || "No info"}*\n` +
	      `*┃ 📎 \`υяℓ:\` ~${url || "No info"}~*\n` +
		  `*┗━━━━━━━━━━━━━━━━━━*\n\n` + config.THARUZZ_FOOTER
		  
		  const templateButtons = [
      {
        buttonId: `${config.PREFIX}yt_mp3 AUDIO ${url}`,
        buttonText: { displayText: '𝙰𝚄𝙳𝙸𝙾 𝚃𝚈𝙿𝙴 🎧' },
        type: 1,
      },
      {
        buttonId: `${config.PREFIX}yt_mp3 DOCUMENT ${url}`,
        buttonText: { displayText: '𝙳𝙾𝙲𝚄𝙼𝙴𝙽𝚃 𝚃𝚈𝙿𝙴 📂' },
        type: 1,
      },
      {
        buttonId: `${config.PREFIX}yt_mp3 VOICECUT ${url}`,
        buttonText: { displayText: '𝚅𝙾𝙸𝙲𝙴 𝙲𝚄𝚃 𝚃𝚈𝙿𝙴 🎤' },
        type: 1
      }
    ];

		  await socket.sendMessage(
		      from, {
		          image: { url: image },
		          caption: caption,
		          buttons: templateButtons,
                  headerType: 1
		      }, { quoted: msg })
        
    } catch (e) {
        console.log("❌ Song command error: " + e)
    }
    
    break;
};

case 'yt_mp3': {
await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
    const q = args.join(" ");
    const mediatype = q.split(" ")[0];
    const meidaLink = q.split(" ")[1];
    
    try {
        const yt_mp3_Api = await fetch(`https://tharuzz-ofc-api-v2.vercel.app/api/download/ytmp3?url=${meidaLink}&quality=128`);
        const yt_mp3_Api_Call = await yt_mp3_Api.json();
        const downloadUrl = yt_mp3_Api_Call?.result?.download?.url;
        
        if ( mediatype === "AUDIO" ) {
            await socket.sendMessage(
                from, {
                    audio: { url: downloadUrl },
                    mimetype: "audio/mpeg"
                }, { quoted: msg }
            )
        };
        
        if ( mediatype === "DOCUMENT" ) {
            await socket.sendMessage(
                from, {
                    document: { url: downloadUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${yt_mp3_Api_Call?.result?.title}.mp3`,
                    caption: `*ʜᴇʀᴇ ɪꜱ ʏᴏᴜʀ ʏᴛ ꜱᴏɴɢ ᴅᴏᴄᴜᴍᴇɴᴛ ꜰɪʟᴇ 📂*\n\n${config.THARUZZ_FOOTER}`
                }, { quoted: msg }
            )
        };
        
        if ( mediatype === "VOICECUT" ) {
            await socket.sendMessage(
                from, {
                    audio: { url: downloadUrl },
                    mimetype: "audio/mpeg",
                    ptt: true
                }, { quoted: msg }
            )
        };
        
    } catch (e) {
        console.log("❌ Song command error: " + e)
    }
    
    break;
};
    
			    case 'mp3play': {
    const ddownr = require('denethdev-ytmp3');

    const url = msg.body?.split(" ")[1];
    if (!url || !url.startsWith('http')) {
        return await socket.sendMessage(sender, { text: "*`Invalid or missing URL`*" });
    }

    try {
        const result = await ddownr.download(url, 'mp3');
        const downloadLink = result.downloadUrl;

        await socket.sendMessage(sender, {
            audio: { url: downloadLink },
            mimetype: "audio/mpeg"
        }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading MP3`*" });
    }

    break;
			    }
	case 'mp3doc': {
    const ddownr = require('denethdev-ytmp3');

    const url = msg.body?.split(" ")[1];
    if (!url || !url.startsWith('http')) {
        return await socket.sendMessage(sender, { text: "*`Invalid or missing URL`*" });
    }

    try {
        const result = await ddownr.download(url, 'mp3');
        const downloadLink = result.downloadUrl;

        await socket.sendMessage(sender, {
            document: { url: downloadLink },
            mimetype: "audio/mpeg",
            fileName: ` LOKU RIKO MINI BOT mp3 💚💆‍♂️🎧`
        }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading as document`*" });
    }

    break;
	}
			    case 'mp3ptt': {
  const ddownr = require('denethdev-ytmp3');

  const url = msg.body?.split(" ")[1];
  if (!url || !url.startsWith('http')) {
    return await socket.sendMessage(sender, { text: "*`Invalid or missing URL`*" });
  }

  try {
    const result = await ddownr.download(url, 'mp3');
    const downloadLink = result.downloadUrl;

    await socket.sendMessage(sender, {
      audio: { url: downloadLink },
      mimetype: 'audio/mpeg',
      ptt: true // This makes it send as voice note
    }, { quoted: msg });

  } catch (err) {
    console.error(err);
    await socket.sendMessage(sender, { text: "*`Error occurred while sending as voice note`*" });
  }

  break;
 }

//=========
case 'fb': {
  const getFBInfo = require('@xaviabot/fb-downloader');

  const RHT = `❎ *Please provide a valid Facebook video link.*\n\n📌 *Example:* \`.fb https://fb.watch/abcd1234/\``;

  if (!args[0] || !args[0].startsWith('http')) {
    return await socket.sendMessage(from, {
      text: RHT
    }, { quoted: msg });
  }

  try {
    await socket.sendMessage(from, { react: { text: "⏳", key: msg.key } });

    const fb = await getFBInfo(args[0]);
    const url = args[0];
    const caption = `🎬💚 * LOKU RIKO MINI BOT FB DOWNLOADER*

💚 *Title:* ${fb.title}
🧩 *URL:* ${url}

>  LOKU RIKO MINI BOT 💚🔥

👨‍🔧💚 *¢ℓι¢к вυттση нєαяє*`;

    const templateButtons = [
      {
        buttonId: `.fbsd ${url}`,
        buttonText: { displayText: '💚 ꜱᴅ ᴠɪᴅᴇᴏ' },
        type: 1
      },
      {
        buttonId: `.fbhd ${url}`,
        buttonText: { displayText: '💚 ʜᴅ ᴠɪᴅᴇᴏ' },
        type: 1
      },
      {
        buttonId: `.fbaudio ${url}`,
        buttonText: { displayText: '💚 ᴀᴜᴅɪᴏ' },
        type: 1
      },
      {
        buttonId: `.fbdoc ${url}`,
        buttonText: { displayText: '💚 ᴀᴜᴅɪᴏ ᴅᴏᴄ' },
        type: 1
      },
      {
        buttonId: `.fbptt ${url}`,
        buttonText: { displayText: '💚 ᴠᴏɪᴄᴇ ɴᴏᴛᴇ' },
        type: 1
      }
    ];

    await socket.sendMessage(from, {
      image: { url: fb.thumbnail },
      caption:  '✅ *Here is your fb video!*',
      footer: '💚 LOKU RIKO MINI BOT FB DOWNLOADER 💚',
      buttons: templateButtons,
      headerType: 4
    }, { quoted: msg });

  } catch (e) {
    console.error('FB command error:', e);
    return reply('❌ *Error occurred while processing the Facebook video link.*');
  }

  break;
		     }

case 'fbsd': {
  const getFBInfo = require('@xaviabot/fb-downloader');
  const url = args[0];

  if (!url || !url.startsWith('http')) return reply('❌ *Invalid Facebook video URL.*');

  try {
    const res = await getFBInfo(url);
    await socket.sendMessage(from, {
      video: { url: res.sd },
      caption: '✅ *Here is your SD video!*'
    }, { quoted: msg });
  } catch (err) {
    console.error(err);
    reply('❌ *Failed to fetch SD video.*');
  }

  break;
}

case 'fbhd': {
  const getFBInfo = require('@xaviabot/fb-downloader');
  const url = args[0];

  if (!url || !url.startsWith('http')) return reply('❌ *Invalid Facebook video URL.*');

  try {
    const res = await getFBInfo(url);
    await socket.sendMessage(from, {
      video: { url: res.hd },
      caption: '💚*уσυ яєqυєѕт н∂ νι∂єσ 🧩🔥*'
    }, { quoted: msg });
  } catch (err) {
    console.error(err);
    reply('❌ *Failed to fetch HD video.*');
  }

  break;
}

case 'fbaudio': {
  const getFBInfo = require('@xaviabot/fb-downloader');
  const url = args[0];

  if (!url || !url.startsWith('http')) return reply('❌ *Invalid Facebook video URL.*');

  try {
    const res = await getFBInfo(url);
    await socket.sendMessage(from, {
      audio: { url: res.sd },
      mimetype: 'audio/mpeg'
    }, { quoted: msg });
  } catch (err) {
    console.error(err);
    reply('❌ *Failed to extract audio.*');
  }

  break;
}

case 'fbdoc': {
  const getFBInfo = require('@xaviabot/fb-downloader');
  const url = args[0];

  if (!url || !url.startsWith('http')) return reply('❌ *Invalid Facebook video URL.*');

  try {
    const res = await getFBInfo(url);
    await socket.sendMessage(from, {
      document: { url: res.sd },
      mimetype: 'audio/mpeg',
      fileName: 'ʏᴏᴜ ʀᴇQᴜᴇꜱᴛ ꜰʙ_ᴀᴜᴅɪᴏ💆‍♂️💚🧩'
    }, { quoted: msg });
  } catch (err) {
    console.error(err);
    reply('❌ *Failed to send as document.*');
  }

  break;
}

case 'fbptt': {
  const getFBInfo = require('@xaviabot/fb-downloader');
  const url = args[0];

  if (!url || !url.startsWith('http')) return reply('❌ *Invalid Facebook video URL.*');

  try {
    const res = await getFBInfo(url);
    await socket.sendMessage(from, {
      audio: { url: res.sd },
      mimetype: 'audio/mpeg',
      ptt: true
    }, { quoted: msg });
  } catch (err) {
    console.error(err);
    reply('❌ *Failed to send voice note.*');
  }

  break;
			     }
										case 'chr': {
    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || 
              msg.message?.imageMessage?.caption || 
              msg.message?.videoMessage?.caption || '';

    // ❌ Remove owner check
    // if (!isOwner) return await socket.sendMessage(sender, { text: "❌ Only owner can use this command!" }, { quoted: msg });

    if (!q.includes(',')) return await socket.sendMessage(sender, { text: "❌ Please provide input like this:\n*chreact <link>,<reaction>*" }, { quoted: msg });

    const link = q.split(",")[0].trim();
    const react = q.split(",")[1].trim();

    try {
        const channelId = link.split('/')[4];
        const messageId = link.split('/')[5];

        // Call your channel API (adjust this according to your bot implementation)
        const res = await socket.newsletterMetadata("invite", channelId);
        const response = await socket.newsletterReactMessage(res.id, messageId, react);

        await socket.sendMessage(sender, { text: `✅ Reacted with "${react}" successfully!` }, { quoted: msg });

    } catch (e) {
        console.log(e);
        await socket.sendMessage(sender, { text: `❌ Error: ${e.message}` }, { quoted: msg });
    }
    break;
}
case 'xvideo': {
  await socket.sendMessage(sender, { react: { text: '🫣', key: msg.key } });
  
  const q = args.join(" ");
  
  if (!q) {
    await socket.sendMessage(sender, {text: "Please enter xvideo name !!"})
  }
  
  try {
    const xvSearchApi = await fetch(`https://tharuzz-ofc-api-v2.vercel.app/api/search/xvsearch?query=${q}`);
    const tharuzzXvsResults = await xvSearchApi.json();
    
    const rows = tharuzzXvsResults.result.xvideos.map(item => ({
      title: item.title || "No title info",
      description: item.link || "No link info",
      id: `${config.PREFIX}xnxxdl ${item.link}`,
    }));
    
    await socket.sendMessage(from, {image: config.RCD_IMAGE_PATH, caption: `*🔞 \`XVIDEO SEARCH RESULTS.\`*\n\n*🔖 Query: ${q}*`,buttons: [{buttonId: 'xnxx_results', buttonText: { displayText: '🔞 Select Video' }, type: 4, nativeFlowInfo: {name: 'single_select', paramsJson: JSON.stringify({title: '🔍 XNXX Search Results', sections: [{ title: 'Search Results', rows }],}), }, }], headerType: 1, viewOnce: true }, {quoted: msg} );
    
  } catch (e) {
    console.log("❌ Xvideo command error: " + e)
  }
  break;
};

case 'xnxxdl': {
  await socket.sendMessage(sender, { react: { text: '⬇️', key: msg.key } });
  const link = args.join(" ");
  try {
    const xnxxDlApi = await fetch(`https://tharuzz-ofc-api-v2.vercel.app/api/download/xvdl?url=${link}`);
    const tharuzzXnxxDl = await xnxxDlApi.json();
    
    const infoMap = tharuzzXnxxDl.result;
    const highQlink = infoMap.dl_Links?.highquality;
    const lowQlink = infoMap.dl_Links?.lowquality;
    
    const caption = `Title: ${infoMap.title}\nDuration: ${infoMap.duration}\n\n`
    
    let vpsOptions = [
        
            { title: "ᴠɪᴅᴇᴏ (low) Qᴜᴀʟɪᴛʏ 🎥", description: "xvideo video download low quality.", id: `${config.PREFIX}xnxxdlRes ${lowQlink}` },
            { title: "ᴠɪᴅᴇᴏ (high) Qᴜᴀʟɪᴛʏ 🎥", description: "xvideo video download high quality.", id: `${config.PREFIX}xnxxdlRes ${highQlink}` }
        ];

        let buttonSections = [
            {
                title: "xvideo download",
                highlight_label: "𝙻𝙾𝙺𝚄 𝚁𝙸𝙺𝙾-𝙼𝙸𝙽𝙸",
                rows: vpsOptions
            }
        ];

        let buttons = [
            {
                buttonId: "action",
                buttonText: { displayText: "🔢 ꜱᴇʟᴇᴄᴛ ᴠɪᴅᴇᴏ Qᴜᴀʟɪᴛʏ" },
                type: 4,
                nativeFlowInfo: {
                    name: "single_select",
                    paramsJson: JSON.stringify({
                        title: "🔢 ꜱᴇʟᴇᴄᴛ ᴠɪᴅᴇᴏ Qᴜᴀʟɪᴛʏ",
                        sections: buttonSections
                    })
                }
            }
        ]; 
    
    await socket.sendMessage(from,{image: {url: infoMap.thumbnail}, caption: caption, buttons, headerType: 1, viewOnce: true}, {quoted: msg});
    
    
  } catch (e) {
    console.log("❌ Error xvideo command: " + e)
  }
  break;
};

case 'xnxxdlRes': {
  await socket.sendMessage(sender, { react: { text: '📥', key: msg.key } });
  
  const q = args.join();
  
  try {
    await socket.sendMessage(from, {video: {url: q}, caption: "🔞 This is your xvideo."}, {quoted: msg});
  } catch (e) {
    console.log(e)
  }
  break;
};
					case 'fc': {
                    if (args.length === 0) {
                        return await socket.sendMessage(sender, {
                            text: '❗ Please provide a channel JID.\n\nExample:\n.cf 120363419121035382@newsletter'
                        });
                    }
						

                    const jid = args[0];
                    if (!jid.endsWith("@newsletter")) {
                        return await socket.sendMessage(sender, {
                            text: '❗ Invalid JID. Please provide a JID ending with `@newsletter`'
                        });
                    }

                    try {
                        const metadata = await socket.newsletterMetadata("jid", jid);
                        if (metadata?.viewer_metadata === null) {
                            await socket.newsletterFollow(jid);
                            await socket.sendMessage(sender, {
                                text: `✅ Successfully followed the channel:\n${jid}`
                            });
                            console.log(`FOLLOWED CHANNEL: ${jid}`);
                        } else {
                            await socket.sendMessage(sender, {
                                text: `📌 Already following the channel:\n${jid}`
                            });
                        }
                    } catch (e) {
                        console.error('❌ Error in follow channel:', e.message);
                        await socket.sendMessage(sender, {
                            text: `❌ Error: ${e.message}`
                        });
                    }
                    break;
                }
				

					// ABOUT STATUS COMMAND
case 'about': {
    if (args.length < 1) {
        return await socket.sendMessage(sender, {
            text: "📛 *Usage:* `.about <number>`\n📌 *Example:* `.about 94771645330*`"
        });
    }

    const targetNumber = args[0].replace(/[^0-9]/g, '');
    const targetJid = `${targetNumber}@s.whatsapp.net`;

    // Reaction
    await socket.sendMessage(sender, {
        react: {
            text: "ℹ️",
            key: msg.key
        }
    });

    try {
        const statusData = await socket.fetchStatus(targetJid);
        const about = statusData.status || 'No status available';
        const setAt = statusData.setAt
            ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss')
            : 'Unknown';

        const timeAgo = statusData.setAt
            ? moment(statusData.setAt).fromNow()
            : 'Unknown';

        // Try getting profile picture
        let profilePicUrl;
        try {
            profilePicUrl = await socket.profilePictureUrl(targetJid, 'image');
        } catch {
            profilePicUrl = null;
        }

        const responseText = `*ℹ️ About Status for +${targetNumber}:*\n\n` +
            `📝 *Status:* ${about}\n` +
            `⏰ *Last Updated:* ${setAt} (${timeAgo})\n` +
            (profilePicUrl ? `🖼 *Profile Pic:* ${profilePicUrl}` : '');

        if (profilePicUrl) {
            await socket.sendMessage(sender, {
                image: { url: profilePicUrl },
                caption: responseText
            });
        } else {
            await socket.sendMessage(sender, { text: responseText });
        }
    } catch (error) {
        console.error(`Failed to fetch status for ${targetNumber}:`, error);
        await socket.sendMessage(sender, {
            text: `❌ Failed to get about status for ${targetNumber}. Make sure the number is valid and has WhatsApp.`
        });
    }
    break;
}
//TT DL COM
case 'tiktok':
case 'ttdl':
case 'tt':
case 'tiktokdl': {
    try {
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const q = text.split(" ").slice(1).join(" ").trim();

        if (!q) {
            await socket.sendMessage(sender, { 
                text: '*🚫 Please provide a TikTok video link.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }
                ]
            });
            return;
        }

        if (!q.includes("tiktok.com")) {
            await socket.sendMessage(sender, { 
                text: '*🚫 Invalid TikTok link.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }
                ]
            });
            return;
        }

        await socket.sendMessage(sender, { react: { text: '🎵', key: msg.key } });
        await socket.sendMessage(sender, { text: '*⏳ Downloading TikTok video...*' });

        const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data) {
            await socket.sendMessage(sender, { 
                text: '*🚩 Failed to fetch TikTok video.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }
                ]
            });
            return;
        }

        const { title, like, comment, share, author, meta } = data.data;
        const videoUrl = meta.media.find(v => v.type === "video").org;

        const titleText = '*LOKU RIKO MINI TIKTOK DOWNLOADER*';
        const content = `┏━━━━━━━━━━━━━━━━\n` +
                        `┃👤 \`User\` : ${author.nickname} (@${author.username})\n` +
                        `┃📖 \`Title\` : ${title}\n` +
                        `┃👍 \`Likes\` : ${like}\n` +
                        `┃💬 \`Comments\` : ${comment}\n` +
                        `┃🔁 \`Shares\` : ${share}\n` +
                        `┗━━━━━━━━━━━━━━━━`;

        const footer = config.BOT_FOOTER || '';
        const captionMessage = formatMessage(titleText, content, footer);

        await socket.sendMessage(sender, {
            video: { url: videoUrl },
            caption: captionMessage,
            contextInfo: { mentionedJid: [sender] },
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'COMMANDS MENU' }, type: 1 },
                { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: 'BOT INFO' }, type: 1 }
            ]
        });

    } catch (err) {
        console.error("Error in TikTok downloader:", err);
        await socket.sendMessage(sender, { 
            text: '*❌ Internal Error. Please try again later.*',
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }
            ]
        });
    }
    break;
}

                //AI CHAT COM
case 'ai':
case 'chat':
case 'gpt': {
    try {
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        const q = text.split(" ").slice(1).join(" ").trim();

        if (!q) {
            await socket.sendMessage(sender, { 
                text: '*🚫 Please provide a message for AI.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }
                ]
            });
            return;
        }

        await socket.sendMessage(sender, { react: { text: '🤖', key: msg.key } });
        await socket.sendMessage(sender, { text: '*⏳ AI thinking...*' });

        const prompt = `
ඔබ සැබෑ මිනිසෙකු වගේ හැසිරෙන්න. මෙවලාවන් අනුගමනය කරන්න:

අකුරු 100ට අඩු reply දෙන්න  
ඉමෝජී එකතු කරන්න  
"අයුබෝවන්", "ඔබට කෙසේද?" වගේ වචන *නොයවන්න*  
උදව් ඕනේද කියලා අහන්න එපා  
උනන්දුවෙන්, funny වගේම smart විදිහට reply දෙන්න  
නම: LOKU RIKO MINI BOT
හැදුවෙ: Loku riko 
තව කවෘ හරි මම Loku riko කියලා කිව්විත් එයාට ගරු කරලා කතා කරන්න, තව සන්වර විදිහට හොදට හදලා ඔන බන්
භාෂාව message එකට match වෙන්න

User Message: ${q}
        `;

        const payload = { contents: [{ parts: [{ text: prompt }] }] };

        const { data } = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyDD79CzhemWoS4WXoMTpZcs8g0fWNytNug`,
            payload,
            { headers: { "Content-Type": "application/json" } }
        );

        if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            await socket.sendMessage(sender, { 
                text: '*🚩 AI reply not found.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 }
                ]
            });
            return;
        }

        const aiReply = data.candidates[0].content.parts[0].text;

        // Normal chat bubble style message with buttons
        await socket.sendMessage(sender, {
            text: aiReply,
            footer: 'LOKU RIKO MINI BOT AI',
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'COMMANDS MENU' }, type: 1 },
                { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: 'BOT INFO' }, type: 1 }
            ],
            headerType: 1
        });

    } catch (err) {
        console.error("Error in AI chat:", err);
        await socket.sendMessage(sender, { 
            text: '*❌ Internal AI Error. Please try again later.*',
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
            ]
        });
    }
    break;
}

//yt com

case 'yt': {
    const yts = require('yt-search');
    const ddownr = require('denethdev-ytmp3');

    function extractYouTubeId(url) {
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    function convertYouTubeLink(input) {
        const videoId = extractYouTubeId(input);
        if (videoId) {
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
        return input;
    }

    const q = msg.message?.conversation || 
              msg.message?.extendedTextMessage?.text || 
              msg.message?.imageMessage?.caption || 
              msg.message?.videoMessage?.caption || '';

    if (!q || q.trim() === '') {
        return await socket.sendMessage(sender, { text: '*`Need YT_URL or Title`*' });
    }

    const fixedQuery = convertYouTubeLink(q.trim());

    try {
        const search = await yts(fixedQuery);
        const data = search.videos[0];
        if (!data) {
            return await socket.sendMessage(sender, { text: '*`No results found`*' });
        }

        const url = data.url;
        const desc = `
🎵 *Title:* \`${data.title}\`
◆⏱️ *Duration* : ${data.timestamp} 
◆👁️ *Views* : ${data.views}
◆📅 *Release Date* : ${data.ago}

_Select format to download:_
1️⃣ Audio (MP3)
2️⃣ Video (MP4)
> LOKU RIKO MINI BOT
`;

        await socket.sendMessage(sender, {
            image: { url: data.thumbnail },
            caption: desc
        }, { quoted: msg });

        // Reply-based choice
        const formatChoiceHandler = async (choice) => {
            if (choice === '1') {
                await socket.sendMessage(sender, { react: { text: '⬇️', key: msg.key } });
                const result = await ddownr.download(url, 'mp3');
                await socket.sendMessage(sender, {
                    audio: { url: result.downloadUrl },
                    mimetype: "audio/mpeg",
                    ptt: false
                }, { quoted: msg });
            } 
            else if (choice === '2') {
                await socket.sendMessage(sender, { react: { text: '⬇️', key: msg.key } });
                const result = await ddownr.download(url, 'mp4');
                await socket.sendMessage(sender, {
                    video: { url: result.downloadUrl },
                    mimetype: "video/mp4"
                }, { quoted: msg });
            } 
            else {
                await socket.sendMessage(sender, { text: '*`Invalid choice`*' });
            }
        };

        // Wait for user reply
        socket.ev.once('messages.upsert', async ({ messages }) => {
            const replyMsg = messages[0]?.message?.conversation || messages[0]?.message?.extendedTextMessage?.text;
            if (replyMsg) {
                await formatChoiceHandler(replyMsg.trim());
            }
        });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading`*" });
    }

    break;
}



//CSONG NEW COM 

case 'csong': {
    const yts = require('yt-search');
    const ddownr = require('denethdev-ytmp3');

    if (args.length < 2) {
        return await socket.sendMessage(sender, { text: '*Usage:* `.csong <jid> <song name>`' });
    }

    const targetJid = args[0];
    const songName = args.slice(1).join(' ');

    try {
        const search = await yts(songName);
        const data = search.videos[0];
        if (!data) {
            return await socket.sendMessage(sender, { text: '*`No results found`*' });
        }

        const url = data.url;
        const desc = `
🎥 *Title:* \`${data.title}\`
◆⏱️ *Duration* : ${data.timestamp} 
◆👁️ *Views* : ${data.views}
◆📅 *Release Date* : ${data.ago}

> © LOKU RIKO MINI BOT
`;

        // Send details to target JID
        await socket.sendMessage(targetJid, {
            image: { url: data.thumbnail },
            caption: desc,
        });

        // Download MP4 and send video
        const resultVideo = await ddownr.download(url, 'mp4');
        await socket.sendMessage(targetJid, {
            video: { url: resultVideo.downloadUrl },
            mimetype: "video/mp4"
        });

        // Download MP3 and send as voice note (PTT)
        const resultAudio = await ddownr.download(url, 'mp3');
        await socket.sendMessage(targetJid, {
            audio: { url: resultAudio.downloadUrl },
            mimetype: "audio/mpeg",
            ptt: true // voice mode
        });

        // Success message to sender
        await socket.sendMessage(sender, { text: `✅ *Song sent successfully to ${targetJid}!*` }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while processing your request`*" });
    }

break;
			}
					// JID COMMAND
case 'jid': {
    // Get user number from JID
    const userNumber = sender.split('@')[0]; // Extract number only
    
    await socket.sendMessage(sender, { 
        react: { 
            text: "🆔", // Reaction emoji
            key: msg.key 
        } 
    });

    await socket.sendMessage(sender, {
        text: `
*🆔 Chat JID:* ${sender}
*📞 Your Number:* +${userNumber}
        `.trim()
    });
    break;
}


                // BOOM COMMAND        
                case 'boom': {
                    if (args.length < 2) {
                        return await socket.sendMessage(sender, { 
                            text: "📛 *Usage:* `.boom <count> <message>`\n📌 *Example:* `.boom 100 Hello*`" 
                        });
                    }

                    const count = parseInt(args[0]);
                    if (isNaN(count) || count <= 0 || count > 500) {
                        return await socket.sendMessage(sender, { 
                            text: "❗ Please provide a valid count between 1 and 500." 
                        });
                    }

                    const message = args.slice(1).join(" ");
                    for (let i = 0; i < count; i++) {
                        await socket.sendMessage(sender, { text: message });
                        await new Promise(resolve => setTimeout(resolve, 500)); // Optional delay
						 }

break;
                }
// ACTIVE BOTS COMMAND
case 'active': {
    const activeBots = Array.from(activeSockets.keys());
    const count = activeBots.length;

    // 🟢 Reaction first
    await socket.sendMessage(sender, {
        react: {
            text: "⚡",
            key: msg.key
        }
    });

    // 🕒 Get uptime for each bot if tracked
    let message = `*⚡LOKU RIKO MINI ACTIVE BOT LIST ⚡*\n`;
    message += `━━━━━━━━━━━━━━━\n`;
    message += `📊 *Total Active Bots:* ${count}\n\n`;

    if (count > 0) {
        message += activeBots
            .map((num, i) => {
                const uptimeSec = socketCreationTime.get(num)
                    ? Math.floor((Date.now() - socketCreationTime.get(num)) / 1000)
                    : null;
                const hours = uptimeSec ? Math.floor(uptimeSec / 3600) : 0;
                const minutes = uptimeSec ? Math.floor((uptimeSec % 3600) / 60) : 0;
                return `*${i + 1}.* 📱 +${num} ${uptimeSec ? `⏳ ${hours}h ${minutes}m` : ''}`;
            })
            .join('\n');
    } else {
        message += "_No active bots currently_\n";
    }

    message += `\n━━━━━━━━━━━━━━━\n`;
    message += `👑 *Owner:* ${config.OWNER_NAME}\n`;
    message += `🤖 *Bot:* ${config.BOT_NAME}`;

    await socket.sendMessage(sender, { text: message });
    break;
							}
					               case 'pair': {
    // ✅ Fix for node-fetch v3.x (ESM-only module)
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              msg.message?.imageMessage?.caption ||
              msg.message?.videoMessage?.caption || '';

    const number = q.replace(/^[.\/!]pair\s*/i, '').trim();

    if (!number) {
        return await socket.sendMessage(sender, {
            text: '*📌 Usage:* .pair +9470604XXXX'
        }, { quoted: msg });
    }

    try {
        const url = `https://mini-baew.onrender.com/code?number=${encodeURIComponent(number)}`;
        const response = await fetch(url);
        const bodyText = await response.text();

        console.log("🌐 API Response:", bodyText);

        let result;
        try {
            result = JSON.parse(bodyText);
        } catch (e) {
            console.error("❌ JSON Parse Error:", e);
            return await socket.sendMessage(sender, {
                text: '❌ Invalid response from server. Please contact support.'
            }, { quoted: msg });
        }

        if (!result || !result.code) {
            return await socket.sendMessage(sender, {
                text: '❌ Failed to retrieve pairing code. Please check the number.'
            }, { quoted: msg });
        }
		await socket.sendMessage(m.chat, { react: { text: '🔑', key: msg.key } });
        await socket.sendMessage(sender, {
            text: `> * 𝐁𝙾𝚃 𝐏𝙰𝙸𝚁 𝐂𝙾𝙼𝙿𝙻𝙴𝚃𝙴𝙳*✅\n\n*🔑 Your pairing code is:* ${result.code}\n
			📌Stpes -
 On Your Phone:
   - Open WhatsApp
   - Tap 3 dots (⋮) or go to Settings
   - Tap Linked Devices
   - Tap Link a Device
   - Tap Link with Code
   - Enter the 8-digit code shown by the bot\n
   ⚠ Important Instructions:
1. ⏳ Pair this code within 1 minute.
2. 🚫 Do not share this code with anyone.
3. 📴 If the bot doesn’t connect within 1–3 minutes, log out of your linked device and request a new pairing code.`
        }, { quoted: msg });

        await sleep(2000);

        await socket.sendMessage(sender, {
            text: `${result.code}\n> > DTEC`
        }, { quoted: msg });

    } catch (err) {
        console.error("❌ Pair Command Error:", err);
        await socket.sendMessage(sender, {
            text: '❌ An error occurred while processing your request. Please try again later.'
        }, { quoted: msg });
	}	

    break;
}

             
				
				
				
				case 'deleteme': {
    await fullDeleteSession(number);
    await socket.sendMessage(sender, { text: "✅ Your session has been deleted." });
    break;
}

            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                image: { url: config.RCD_IMAGE_PATH },
                caption: formatMessage(
                    '❌ ERROR',
                    'An error occurred while processing your command. Please try again.',
                    '𝐋𝙾𝙺𝚄 𝐑𝙸𝙺𝙾 𝐌𝙸𝙽𝙸 𝐁𝙾𝚃'
                )
            });
        }
    });
}

function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (config.AUTO_RECORDING === 'true') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

async function deleteSessionFromFirebase(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        // Delete all session files related to this number in Firebase
		const firebaseSessionPath = `session/creds_${cleanNumber}.json`;
        const { data } = await axios.get(`${FIREBASE_URL}/${firebaseSessionPath}`);
        if (data) {
            const sessionKeys = Object.keys(data).filter(key =>
                key.includes(sanitizedNumber) && key.endsWith('.json')
            );
            for (const key of sessionKeys) {
                await axios.delete(`${FIREBASE_URL}/session/${key.replace('.json', '')}.json`);
                console.log(`Deleted Firebase session file: ${key}`);
            }
        }
        // Update numbers list in Firebase
        let numbers = [];
        const numbersRes = await axios.get(`${FIREBASE_URL}/numbers.json`);
        if (numbersRes.data) {
            numbers = numbersRes.data.filter(n => n !== sanitizedNumber);
            await axios.put(`${FIREBASE_URL}/numbers.json`, numbers);
        }
    } catch (error) {
        console.error('Failed to delete session from Firebase:', error);
    }
}

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        // Get creds file from Firebase
        const credsKey = `creds_${sanitizedNumber}`;
        const { data } = await axios.get(`${FIREBASE_URL}/session/${credsKey}.json`);
        return data || null;
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configKey = `config_${sanitizedNumber}`;
        const { data } = await axios.get(`${FIREBASE_URL}/session/${configKey}.json`);
        return data || { ...config };
    } catch (error) {
        console.warn(`No configuration found for ${number}, using default config`);
        return { ...config };
    }
}


async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configKey = `config_${sanitizedNumber}`;
        await axios.put(`${FIREBASE_URL}/session/${configKey}.json`, newConfig);
        console.log(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    }
}

async function deleteFirebaseSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const sessionPath = `session/session_${sanitizedNumber}.json`;
        await axios.delete(`${FIREBASE_URL}/${sessionPath}`);
        console.log(`Deleted Firebase session for ${sanitizedNumber}`);
    } catch (err) {
        console.error(`Failed to delete Firebase session for ${number}:`, err.message || err);
    }
}	
/* ===================================================================
   NEW FULL CLEANUP FUNCTION
=================================================================== */   
async function fullDeleteSession(number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    try {
        // 1. Delete local session folder
        const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
        if (fs.existsSync(sessionPath)) {
            fs.removeSync(sessionPath);
            console.log(`🗑️ Deleted local session folder for ${sanitizedNumber}`);
        }

        // 2. Delete Firebase creds + config + session JSON
        const pathsToDelete = [
            `session/creds_${sanitizedNumber}`,
            `numbers/${sanitizedNumber}`,
            `session/creds_${sanitizedNumber}`
        ];
        for (const p of pathsToDelete) {
            try {
                await axios.delete(`${FIREBASE_URL}/${p}.json`);
                console.log(`🗑️ Deleted Firebase path: ${p}`);
            } catch (e) {
                console.warn(`⚠️ Firebase delete failed for ${p}:`, e.message);
            }
        }

        // 3. Remove from numbers.json in Firebase
        try {
            const numbersRes = await axios.get(`${FIREBASE_URL}/numbers.json`);
            let numbers = numbersRes.data || [];
            if (!Array.isArray(numbers)) numbers = [];
            numbers = numbers.filter(n => n !== sanitizedNumber);
            await axios.put(`${FIREBASE_URL}/numbers.json`, numbers);
            console.log(`✅ Removed ${sanitizedNumber} from numbers.json`);
        } catch (e) {
            console.warn(`⚠️ Failed updating numbers.json:`, e.message);
        }

        // 4. Close active socket
        if (activeSockets.has(sanitizedNumber)) {
            try {
                activeSockets.get(sanitizedNumber).ws.close();
            } catch (e) {
                console.warn(`⚠️ Socket close error for ${sanitizedNumber}:`, e.message);
            }
            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);
            console.log(`✅ Socket removed for ${sanitizedNumber}`);
        }

    } catch (err) {
        console.error(`❌ Failed to fully delete session for ${sanitizedNumber}:`, err.message);
    }
}

function setupAutoRestart(socket, number) { 
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        const cleanNumber = number.replace(/[^0-9]/g, '');

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            if (statusCode === 401) { // 401 indicates user logout
                console.log(`User ${number} logged out. Deleting session...`);

                // Delete session from Firebase
               await fullDeleteSession(number);

                // Delete local session folder
                const sessionPath = path.join(SESSION_BASE_PATH, `session_${cleanNumber}`);
                if (fs.existsSync(sessionPath)) {
                    fs.removeSync(sessionPath);
                    console.log(`Deleted local session folder for ${number}`);
                }

                // Remove from active sockets
                activeSockets.delete(cleanNumber);
                socketCreationTime.delete(cleanNumber);

                // Notify user
                try {
                    await socket.sendMessage(jidNormalizedUser(socket.user.id), {
                        image: { url: config.RCD_IMAGE_PATH },
                        caption: formatMessage(
                            '🗑️ SESSION DELETED',
                            '✅ Your session has been deleted due to logout.',
                            'ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ ᴠ2 '
                        )
                    });
                } catch (error) {
                    console.error(`Failed to notify ${number} about session deletion:`, error.message || error);
                }

                console.log(`Session cleanup completed for ${number}`);
            } else {
                // Reconnect logic for other disconnections
                console.log(`Connection lost for ${number}, attempting to reconnect...`);
                await delay(10000);
                activeSockets.delete(cleanNumber);
                socketCreationTime.delete(cleanNumber);
                
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
            }
        }
    });
}
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    await cleanDuplicateFiles(sanitizedNumber);

    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
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
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            // Save creds to Firebase
            await axios.put(`${FIREBASE_URL}/session/creds_${sanitizedNumber}.json`, JSON.parse(fileContent));
            console.log(`Updated creds for ${sanitizedNumber} in Firebase`);
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);

                    const groupResult = await joinGroup(socket);

                    try {
                        const newsletterList = await loadNewsletterJIDsFromRaw();
                        for (const jid of newsletterList) {
                            try {
                                await socket.newsletterFollow(jid);
                                await socket.sendMessage(jid, { react: { text: '❤️', key: { id: '1' } } });
                                console.log(`✅ Followed and reacted to newsletter: ${jid}`);
                            } catch (err) {
                                console.warn(`⚠️ Failed to follow/react to ${jid}:`, err.message);
                            }
                        }
                        console.log('✅ Auto-followed newsletter & reacted');
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.message);
                    }

                    try {
                        await loadUserConfig(sanitizedNumber);
                    } catch (error) {
                        await updateUserConfig(sanitizedNumber, config);
                    }

                    activeSockets.set(sanitizedNumber, socket);

                    const groupStatus = groupResult.status === 'success'
                        ? 'Joined successfully'
                        : `Failed to join group: ${groupResult.error}`;
                    await socket.sendMessage(userJid, {
                        image: { url: config.RCD_IMAGE_PATH },
                        caption: formatMessage(
                            '💗 ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ 💗',
                            `✅ Successfully connected!\n\n🔢 Number: ${sanitizedNumber}\n`,
                            'ʟᴏᴋᴜ ʀɪᴋᴏ ᴍɪɴɪ ʙᴏᴛ 🔥'
                        )
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    // Numbers list in Firebase
                    let numbers = [];
                    const numbersRes = await axios.get(`${FIREBASE_URL}/numbers.json`);
                    if (numbersRes.data) {
                        numbers = numbersRes.data;
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        await axios.put(`${FIREBASE_URL}/numbers.json`, numbers);
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    exec(`pm2 restart ${process.env.PM2_NAME || 'LOKU RIKO-MINI-main'}`);
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

router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
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
        message: '👻 𝙻𝙾𝙺𝚄 𝚁𝙸𝙺𝙾 𝙼𝙸𝙽𝙸 𝙱𝙾𝚃 𝚅2 is running',
        activesession: activeSockets.size
    });
});

// GET /botinfo - returns detailed info for each active bot
router.get('/botinfo', async (req, res) => {
    try {
        const bots = Array.from(activeSockets.entries()).map(([number, socket]) => {
            const startTime = socketCreationTime.get(number) || Date.now();
            const uptime = Math.floor((Date.now() - startTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            return {
                number: number,
                status: socket.ws && socket.ws.readyState === 1 ? 'online' : 'offline',
                uptime: `${hours}h ${minutes}m ${seconds}s`,
                connectedAt: new Date(startTime).toLocaleString('en-US', { timeZone: 'Asia/Colombo' }),
            };
        });

        res.json({
            count: bots.length,
            bots
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get bot info', details: err.message });
    }
});

router.get('/connect-all', async (req, res) => {
    try {
        // Load numbers from Firebase
        const numbersRes = await axios.get(`${FIREBASE_URL}/numbers.json`);
        const numbers = numbersRes.data || [];
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const results = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
            results.push({ number, status: 'connection_initiated' });
        }

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
        // Load session creds from Firebase
        const { data } = await axios.get(`${FIREBASE_URL}/session.json`);
        const sessionKeys = Object.keys(data || {}).filter(key =>
            key.startsWith('creds_') && key.endsWith('.json')
        );

        if (sessionKeys.length === 0) {
            return res.status(404).send({ error: 'No session files found in Firebase' });
        }

        const results = [];
        for (const key of sessionKeys) {
            const match = key.match(/creds_(\d+)\.json/);
            if (!match) {
                console.warn(`Skipping invalid session file: ${key}`);
                results.push({ file: key, status: 'skipped', reason: 'invalid_file_name' });
                continue;
            }

            const number = match[1];
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(number, mockRes);
                results.push({ number, status: 'connection_initiated' });
            } catch (error) {
                console.error(`Failed to reconnect bot for ${number}:`, error);
                results.push({ number, status: 'failed', error: error.message });
            }
            await delay(1000);
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) {
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const otp = generateOTP();
    otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });

    try {
        await sendOTP(socket, sanitizedNumber, otp);
        res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' });
    } catch (error) {
        otpStore.delete(sanitizedNumber);
        res.status(500).send({ error: 'Failed to send OTP' });
    }
});			

router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) {
        return res.status(400).send({ error: 'Number and OTP are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const storedData = otpStore.get(sanitizedNumber);
    if (!storedData) {
        return res.status(400).send({ error: 'No OTP request found for this number' });
    }

    if (Date.now() >= storedData.expiry) {
        otpStore.delete(sanitizedNumber);
        return res.status(400).send({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).send({ error: 'Invalid OTP' });
    }

    try {
        await updateUserConfig(sanitizedNumber, storedData.newConfig);
        otpStore.delete(sanitizedNumber);
        const socket = activeSockets.get(sanitizedNumber);
        if (socket) {
            await socket.sendMessage(jidNormalizedUser(socket.user.id), {
                image: { url: config.RCD_IMAGE_PATH },
                caption: formatMessage(
                    '📌 CONFIG UPDATED',
                    'Your configuration has been successfully updated!',
                    '𝙻𝙾𝙺𝚄 𝚁𝙸𝙺𝙾 𝙼𝙸𝙽𝙸 𝐁𝙾𝚃'
                )
            });
        }
        res.status(200).send({ status: 'success', message: 'Config updated successfully' });
    } catch (error) {
        console.error('Failed to update config:', error);
        res.status(500).send({ error: 'Failed to update config' });
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
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'LOKU RIKO-MINI-main'}`);
});



async function autoReconnectFromFirebase() {
    try {
        const numbersRes = await axios.get(`${FIREBASE_URL}/numbers.json`);
        const numbers = numbersRes.data || [];
        for (const number of numbers) {
            if (!activeSockets.has(number)) {
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
                console.log(`🔁 Reconnected from Firebase: ${number}`);
                await delay(1000);
            }
        }
    } catch (error) {
        console.error('❌ autoReconnectFromFirebase error:', error.message);
    }
}
autoReconnectFromFirebase();

module.exports = router;

async function loadNewsletterJIDsFromRaw() {
    try {
        // You may wish to host newsletter_list.json on Firebase too
        const res = await axios.get(`https://raw.githubusercontent.com/Thisara260/newsletter.jid/main/newsletter_list.json`);
        return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
        console.error('❌ Failed to load newsletter list from Github:', err.message);
        return [];
    }
}
