import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket,
    Contact,
    BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { generateAIResponse } from './ai';
import fs from 'fs';

// Define the shape of our global state
interface BaileysGlobalState {
    sock: WASocket | null;
    qr: string | null;
    connectionStatus: 'disconnected' | 'connecting' | 'connected';
    config: {
        isAiActive: boolean;
        systemPrompt: string;
    };
    stats: {
        messagesToday: number;
        aiResponses: number;
    };
}

// Extend globalThis to include our state
declare global {
    var baileysState: BaileysGlobalState | undefined;
}

// Initialize global state if it doesn't exist
if (!global.baileysState) {
    global.baileysState = {
        sock: null,
        qr: null,
        connectionStatus: 'disconnected',
        config: {
            isAiActive: true, // Default to true
            systemPrompt: '',  // Default
        },
        stats: {
            messagesToday: 0,
            aiResponses: 0,
        }
    };
}

const state = global.baileysState!;

// Helper to update connection status safely
function updateStatus(status: BaileysGlobalState['connectionStatus'], qr: string | null = null) {
    state.connectionStatus = status;
    state.qr = qr;
}

export async function initBaileys() {
    if (state.sock) {
        return state.sock;
    }

    // Ensure auth directory exists
    if (!fs.existsSync('./auth_info_baileys')) {
        fs.mkdirSync('./auth_info_baileys', { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Use silent logger to avoid clutter
        printQRInTerminal: false,
        auth: {
            creds: authState.creds,
            keys: makeCacheableSignalKeyStore(authState.keys, pino({ level: 'silent' })),
        },
        msgRetryCounterCache: undefined,
        generateHighQualityLinkPreview: true,
    });

    state.sock = sock;
    state.connectionStatus = 'connecting';

    sock.ev.process(
        async (events) => {
            if (events['connection.update']) {
                const update = events['connection.update'];
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    updateStatus('disconnected', qr);
                    // console.log('QR Generated');
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                    updateStatus('disconnected', null);
                    state.sock = null;
                    if (shouldReconnect) {
                        initBaileys();
                    }
                } else if (connection === 'open') {
                    console.log('Opened connection');
                    updateStatus('connected', null);
                }
            }

            if (events['creds.update']) {
                await saveCreds();
            }

            if (events['messages.upsert']) {
                const upsert = events['messages.upsert'];

                if (upsert.type === 'notify') {
                    for (const msg of upsert.messages) {
                        console.log('Msg received. FromMe:', msg.key.fromMe, 'AI Active:', state.config.isAiActive);

                        // Increment message counter (simple)
                        state.stats.messagesToday += 1;

                        if (!msg.key.fromMe && state.config.isAiActive) {
                            // Check if text message
                            let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                            const imageMessage = msg.message?.imageMessage;
                            let imageBase64: string | undefined;

                            if (imageMessage) {
                                text = imageMessage.caption;
                                try {
                                    const buffer = await import('@whiskeysockets/baileys').then(m => m.downloadMediaMessage(
                                        msg,
                                        'buffer',
                                        {},
                                        {
                                            logger: pino({ level: 'silent' }),
                                            reuploadRequest: async (msg) => new Promise(resolve => resolve(msg)), // Mock
                                        }
                                    ));
                                    if (Buffer.isBuffer(buffer)) {
                                        imageBase64 = buffer.toString('base64');
                                    }
                                } catch (e) {
                                    console.error('Failed to download media', e);
                                }
                            }

                            if (text || imageBase64) {
                                console.log('Processing message:', text);

                                // Generate AI Response
                                const response = await generateAIResponse(
                                    text || "Analyze this image",
                                    state.config.systemPrompt,
                                    imageBase64
                                );

                                if (response) {
                                    state.stats.aiResponses += 1;

                                    if (response.type === 'image') {
                                        await sock.sendMessage(msg.key.remoteJid!, {
                                            image: { url: response.urlOrBase64 }, // Bailes handles URL or Base64 automatically if prefixed correctly, or just URL
                                            caption: response.caption
                                        });
                                    } else {
                                        await sock.sendMessage(msg.key.remoteJid!, { text: response.content });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    );

    return sock;
}

export function getBaileysState() {
    // If not initialized, trigger init (fire and forget pattern for nextjs api route)
    if (!state.sock && state.connectionStatus === 'disconnected' && !state.qr) {
        initBaileys();
    }
    return {
        qr: state.qr,
        connectionStatus: state.connectionStatus,
        stats: state.stats
    };
}

export function updateBaileysConfig(config: Partial<BaileysGlobalState['config']>) {
    state.config = { ...state.config, ...config };
}
