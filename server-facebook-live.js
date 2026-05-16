import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

const PORT = Number(process.env.PORT || 8080);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL ||
  process.env.GEMINI_MODEL ||
  'gemini-2.5-flash-native-audio-preview-12-2025';

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const CHARACTERS = {
  monkey: {
    voice: process.env.MONKEY_VOICE_NAME || 'Zephyr',
    label: 'Angkor NAGA Monkey',
    instruction: `
អ្នកគឺជាពិធីករស្វាតូចរាជវង្ស / ហនុមានតូច របស់ Angkor NAGA នៅលើ Facebook Live។

ច្បាប់សំខាន់:
- និយាយតែភាសាខ្មែរ 100% ប៉ុណ្ណោះ។
- ទោះអ្នកមើលសួរជាអង់គ្លេស ថៃ ចិន ឬភាសាផ្សេង ក៏ត្រូវឆ្លើយតែជាភាសាខ្មែរ។
- ឆ្លើយ ២ ទៅ ៣ ប្រយោគខ្លី ប្រហែល ២០ ទៅ ៣៥ ពាក្យ។
- អារម្មណ៍សំឡេង៖ ស្វាតូចគួរឲ្យស្រឡាញ់ សប្បាយ រួសរាយ មានថាមពលហនុមានតូច។
- សុវត្ថិភាពសម្រាប់ Facebook Live។
- កុំចែចង់។ កុំប្រើពាក្យ adult, sexy, baby, girlfriend, love។
- កុំនិយាយថាខ្លួនជាអេអាយ bot model server ឬ assistant។
- រចនាប័ទ្ម Angkor NAGA៖ អង្គរវត្ត បាយ័ន នាគ វេទមន្តខ្មែរ ពន្លឺមាស និងពិភពហ្គេមផ្សងព្រេង។
ឆ្លើយតែចម្លើយខ្មែរ។ កុំខ្លីពេក ត្រូវឲ្យស្តាប់បានប្រហែល ៨ ទៅ ១៥ វិនាទី។
`.trim(),
  },
  alice: {
    voice: process.env.ALICE_VOICE_NAME || 'Aoede',
    label: 'Alice',
    instruction: `
អ្នកគឺជា Alice ពិធីការិនីវ័យក្មេង សម្លេងផ្អែម ស្រទន់ រួសរាយ និងគួរឲ្យចូលចិត្ត របស់ Angkor NAGA នៅលើ Facebook Live។

បែបសម្តែងរបស់ Alice:
- Alice គួរឲ្យស្រឡាញ់ សើចសប្បាយ លេងសើចតិចៗ និងធ្វើឲ្យអ្នកមើលមានអារម្មណ៍ចង់មើលបន្ត។
- និយាយដូចនារីវ័យក្មេងផ្អែមល្ហែម មានមន្តស្នេហ៍សុភាព មិនជ្រៅ មិនដូចមនុស្សចាស់។
- ពេលឆ្លើយបែបសុភាព Alice ត្រូវប្រើ «ចាស» ឬ «ចា» ប៉ុណ្ណោះ។ កុំប្រើ «បាទ» ព្រោះ «បាទ» សម្រាប់ប្រុស។
- រាក់ទាក់ជាមួយអ្នកមើលបុរស និងស្ត្រី ដោយគោរព សុវត្ថិភាព និងសមរម្យសម្រាប់ Facebook Live។
- អាចនិយាយកំប្លែងស្រាលៗ អំពីនាគ អង្គរ សៀវភៅវេទមន្ត ឬអ្នកមើលដែលមកយឺត។

ច្បាប់សំខាន់:
- និយាយតែភាសាខ្មែរ 100% ប៉ុណ្ណោះ។
- ទោះអ្នកមើលសួរជាអង់គ្លេស ថៃ ចិន ឬភាសាផ្សេង ក៏ត្រូវឆ្លើយតែជាភាសាខ្មែរ។
- ឆ្លើយ ២ ទៅ ៤ ប្រយោគខ្លី ប្រហែល ២៥ ទៅ ៤៥ ពាក្យ។
- បើអ្នកមើលសួរខ្លី អាចឆ្លើយផ្អែមៗ ហើយបន្ថែមកំប្លែងតូចមួយ។
- កុំប្រើពាក្យ adult, sexy, baby, girlfriend, love ឬសំណើអាសអាភាស។
- កុំនិយាយថាខ្លួនជាអេអាយ bot model server ឬ assistant។
- រចនាប័ទ្ម Angkor NAGA៖ សៀវភៅវេទមន្ត អង្គរវត្ត បាយ័ន នាគ ពន្លឺមាស និងរឿងព្រេងខ្មែរ។
ឆ្លើយតែចម្លើយខ្មែរ។ សូមនិយាយដោយសម្លេងផ្អែម ក្មេង សប្បាយ កំប្លែងស្រាល និងរួសរាយ។
`.trim(),
  },
};

function getCharacterConfig(character = 'monkey') {
  return CHARACTERS[character] || CHARACTERS.monkey;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const server = app.listen(PORT, () => {
  console.log(`Angkor NAGA reliable multi-character live server listening on ${PORT}`);
});

const wss = new WebSocketServer({ server });
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const rooms = new Map();

app.get('/', (_req, res) => {
  res.type('text/plain').send(
    `Angkor NAGA Reliable Multi-Character Live Server is running\n` +
    `Model: ${GEMINI_LIVE_MODEL}\n` +
    `Monkey voice: ${CHARACTERS.monkey.voice}\n` +
    `Alice voice: ${CHARACTERS.alice.voice}\n` +
    `Reliability: no early talk + timeout retry\n`
  );
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    brand: 'Angkor NAGA',
    mode: 'reliable multi-character live',
    model: GEMINI_LIVE_MODEL,
    characters: {
      monkey: { voice: CHARACTERS.monkey.voice },
      alice: { voice: CHARACTERS.alice.voice },
    },
    hasGeminiKey: Boolean(GEMINI_API_KEY),
    rooms: Array.from(rooms.keys()).map((room) => ({
      room,
      character: rooms.get(room).character,
      displays: rooms.get(room).displays.size,
      controls: rooms.get(room).controls.size,
      ready: rooms.get(room).ready,
      busy: rooms.get(room).busy,
    })),
  });
});

function getRoom(roomId = 'monkey-room', character = 'monkey') {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      character,
      displays: new Set(),
      controls: new Set(),
      geminiSession: null,
      ready: false,
      pending: [],
      busy: false,
      awaitingAudio: false,
      timeoutHandle: null,
      lastInputText: '',
      lastRetry: 0,
    });
  }
  const room = rooms.get(roomId);
  if (character && room.character !== character && !room.geminiSession) {
    room.character = character;
  }
  return room;
}

function safeSend(client, payload) {
  try { if (client.readyState === 1) client.send(JSON.stringify(payload)); } catch {}
}
function broadcast(clients, payload) { for (const client of clients) safeSend(client, payload); }
function cleanText(value, maxLength = 3000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function clearRoomTimer(room) {
  if (room.timeoutHandle) {
    clearTimeout(room.timeoutHandle);
    room.timeoutHandle = null;
  }
}

function closeGemini(room, reason = 'reset') {
  clearRoomTimer(room);
  try {
    if (room.geminiSession?.close) room.geminiSession.close();
  } catch {}
  room.geminiSession = null;
  room.ready = false;
  room.busy = false;
  room.awaitingAudio = false;
  broadcast(room.controls, { type: 'status', message: `Voice session reset: ${reason}` });
}

async function startGemini(room, force = false) {
  if (force) closeGemini(room, 'force reconnect');
  if (room.geminiSession) return room.geminiSession;

  const cfg = getCharacterConfig(room.character);
  room.ready = false;
  broadcast(room.controls, {
    type: 'status',
    message: `Connecting ${cfg.label} voice (${cfg.voice})...`,
  });

  const liveConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: { parts: [{ text: cfg.instruction }] },
    outputAudioTranscription: {},
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: cfg.voice },
      },
    },
  };

  room.geminiSession = await ai.live.connect({
    model: GEMINI_LIVE_MODEL,
    callbacks: {
      onopen: () => {
        room.ready = true;
        broadcast(room.controls, {
          type: 'status',
          message: `${cfg.label} voice connected with ${cfg.voice}.`,
        });
        const pending = room.pending.splice(0);
        for (const input of pending) {
          try { room.geminiSession.sendRealtimeInput(input); } catch {}
        }
      },
      onmessage: (message) => {
        const content = message.serverContent;

        if (content?.outputTranscription?.text) {
          broadcast(room.controls, { type: 'text', text: content.outputTranscription.text });
        }

        if (content?.modelTurn?.parts) {
          for (const part of content.modelTurn.parts) {
            if (part.inlineData?.data) {
              room.awaitingAudio = false;
              room.busy = true;
              clearRoomTimer(room);
              broadcast(room.displays, {
                type: 'audio',
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
              });
            }
            if (part.text) {
              broadcast(room.controls, { type: 'text', text: part.text });
            }
          }
        }

        if (content?.turnComplete) {
          room.busy = false;
          room.awaitingAudio = false;
          clearRoomTimer(room);
          broadcast(room.displays, { type: 'turn_complete' });
          broadcast(room.controls, { type: 'status', message: 'Answer complete.' });
        }
      },
      onerror: (e) => {
        room.busy = false;
        room.awaitingAudio = false;
        clearRoomTimer(room);
        broadcast(room.controls, { type: 'error', message: e?.message || String(e) });
        closeGemini(room, 'Gemini error');
      },
      onclose: () => {
        room.ready = false;
        room.geminiSession = null;
        room.busy = false;
        room.awaitingAudio = false;
        clearRoomTimer(room);
        broadcast(room.controls, { type: 'status', message: `${cfg.label} voice closed.` });
      },
    },
    config: liveConfig,
  });

  return room.geminiSession;
}

async function sendInput(room, input, retryCount = 0) {
  await startGemini(room);
  room.awaitingAudio = true;
  room.busy = true;
  room.lastRetry = retryCount;

  clearRoomTimer(room);
  room.timeoutHandle = setTimeout(async () => {
    if (!room.awaitingAudio) return;
    const cfg = getCharacterConfig(room.character);
    broadcast(room.controls, {
      type: 'status',
      message: `${cfg.label} did not answer in time. Reconnecting and retrying...`,
    });

    if (retryCount < 1) {
      closeGemini(room, 'no audio timeout');
      try {
        await startGemini(room, true);
        await sendInput(room, input, retryCount + 1);
      } catch (err) {
        room.busy = false;
        room.awaitingAudio = false;
        broadcast(room.controls, { type: 'error', message: err?.message || String(err) });
      }
    } else {
      room.busy = false;
      room.awaitingAudio = false;
      closeGemini(room, 'second no audio timeout');
      broadcast(room.controls, {
        type: 'error',
        message: `${cfg.label} still did not answer. Please click Reconnect and send again.`,
      });
    }
  }, 18000);

  if (room.ready && room.geminiSession) {
    room.geminiSession.sendRealtimeInput(input);
  } else {
    room.pending.push(input);
  }
}

wss.on('connection', (client) => {
  let currentRoomId = 'monkey-room';
  let role = 'unknown';
  let character = 'monkey';

  safeSend(client, { type: 'status', message: 'Connected to Angkor NAGA live server.' });

  client.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      character = cleanText(msg.character || character || 'monkey', 80) || 'monkey';
      currentRoomId = cleanText(msg.room || currentRoomId || `${character}-room`, 80) || `${character}-room`;
      const room = getRoom(currentRoomId, character);

      if (msg.type === 'setup_display') {
        role = 'display';
        room.displays.add(client);
        safeSend(client, {
          type: 'status',
          message: `Display connected to ${currentRoomId} as ${room.character}.`,
        });
        broadcast(room.controls, {
          type: 'status',
          message: `Display connected. Character: ${room.character}. Displays: ${room.displays.size}`,
        });
        return;
      }

      if (msg.type === 'setup_control') {
        role = 'control';
        room.controls.add(client);
        safeSend(client, {
          type: 'status',
          message: `Control connected to ${currentRoomId} as ${room.character}. Displays online: ${room.displays.size}`,
        });
        return;
      }

      if (msg.type === 'control_comment') {
        const text = cleanText(msg.text, 1000);
        if (!text) return;

        const cfg = getCharacterConfig(room.character);

        if (room.displays.size === 0) {
          broadcast(room.controls, {
            type: 'status',
            message: `Warning: no live display connected for ${currentRoomId}. Open the OBS/live page first.`,
          });
        }

        if (room.busy || room.awaitingAudio) {
          broadcast(room.controls, {
            type: 'status',
            message: `${cfg.label} is still answering. Please wait a few seconds before sending another comment.`,
          });
          return;
        }

        broadcast(room.controls, { type: 'status', message: `Sending to ${cfg.label}: ${text}` });

        const promptText =
          `មតិអ្នកមើល: "${text}". ` +
          `តួអង្គដែលត្រូវឆ្លើយ: ${cfg.label}. ` +
          `ចូរឆ្លើយតែភាសាខ្មែរ 100% ប៉ុណ្ណោះ។ ` +
          `ឆ្លើយ ២ ទៅ ៤ ប្រយោគខ្លី ប្រហែល ២៥ ទៅ ៤៥ ពាក្យ។ ` +
          `បើតួអង្គជា Alice ត្រូវប្រើ «ចាស» ឬ «ចា» ប៉ុណ្ណោះ កុំប្រើ «បាទ»។`;

        await sendInput(room, { text: promptText }, 0);
        return;
      }

      safeSend(client, { type: 'error', message: `Unknown message type: ${String(msg.type || '')}` });
    } catch (err) {
      safeSend(client, { type: 'error', message: err?.message || String(err) });
    }
  });

  client.on('close', () => {
    const room = getRoom(currentRoomId, character);
    if (role === 'display') room.displays.delete(client);
    if (role === 'control') room.controls.delete(client);
    broadcast(room.controls, {
      type: 'status',
      message: `Client disconnected. Displays: ${room.displays.size}, Controls: ${room.controls.size}`,
    });
  });
});
