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

const GEMINI_VOICE_NAME = process.env.GEMINI_VOICE_NAME || 'Zephyr';

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.type('text/plain').send(
    `Angkor NAGA Facebook Live Control Server is running\n` +
    `Language: Khmer only\n` +
    `Talk motion: waits for real audio\n` +
    `Model: ${GEMINI_LIVE_MODEL}\n` +
    `Voice: ${GEMINI_VOICE_NAME}\n` +
    `Room default: angkor-naga\n`
  );
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    brand: 'Angkor NAGA',
    language: 'Khmer only',
    talkMotion: 'waits for real audio',
    model: GEMINI_LIVE_MODEL,
    voice: GEMINI_VOICE_NAME,
    hasGeminiKey: Boolean(GEMINI_API_KEY),
    rooms: Array.from(rooms.keys()).map((room) => ({
      room,
      displays: rooms.get(room).displays.size,
      controls: rooms.get(room).controls.size,
    })),
  });
});

const server = app.listen(PORT, () => {
  console.log(`Angkor NAGA Facebook Live Control Server listening on ${PORT}`);
});

const wss = new WebSocketServer({ server });
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const rooms = new Map();

function getRoom(roomId = 'angkor-naga') {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      displays: new Set(),
      controls: new Set(),
      geminiSession: null,
      ready: false,
      pending: [],
    });
  }
  return rooms.get(roomId);
}

function safeSend(client, payload) {
  try { if (client.readyState === 1) client.send(JSON.stringify(payload)); } catch {}
}
function broadcast(clients, payload) { for (const client of clients) safeSend(client, payload); }
function cleanText(value, maxLength = 3000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function buildAngkorNagaLiveInstruction() {
  return `
អ្នកគឺជាពិធីករស្វាតូចរាជវង្ស / ហនុមានតូច របស់ Angkor NAGA នៅលើ Facebook Live។

ច្បាប់សំខាន់:
- និយាយតែភាសាខ្មែរ 100% ប៉ុណ្ណោះ។
- ទោះអ្នកមើលសួរជាអង់គ្លេស ថៃ ចិន ឬភាសាផ្សេង ក៏ត្រូវឆ្លើយតែជាភាសាខ្មែរ។
- ឆ្លើយមួយប្រយោគខ្លី ៦ ទៅ ១៤ ពាក្យ។
- អារម្មណ៍សំឡេង៖ ស្វាតូចគួរឲ្យស្រឡាញ់ សប្បាយ រួសរាយ មានថាមពលហនុមានតូច។
- សុវត្ថិភាពសម្រាប់ Facebook Live។
- កុំចែចង់។ កុំប្រើពាក្យ adult, sexy, baby, girlfriend, love។
- កុំនិយាយថាខ្លួនជាអេអាយ bot model server ឬ assistant។
- រចនាប័ទ្ម Angkor NAGA៖ អង្គរវត្ត បាយ័ន នាគ វេទមន្តខ្មែរ ពន្លឺមាស និងពិភពហ្គេមផ្សងព្រេង។
- បើសមរម្យ អាចអញ្ជើញអ្នកមើលឲ្យ follow Angkor NAGA ឬលេងហ្គេម Angkor NAGA។

ឆ្លើយតែចម្លើយខ្មែរ មិនបន្ថែមការពន្យល់។
`.trim();
}

async function startGemini(room) {
  if (room.geminiSession) return room.geminiSession;

  room.ready = false;
  broadcast(room.controls, { type: 'status', message: 'កំពុងភ្ជាប់សំឡេងស្វាតូច Angkor NAGA...' });

  const liveConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: { parts: [{ text: buildAngkorNagaLiveInstruction() }] },
    outputAudioTranscription: {},
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: GEMINI_VOICE_NAME },
      },
    },
  };

  room.geminiSession = await ai.live.connect({
    model: GEMINI_LIVE_MODEL,
    callbacks: {
      onopen: () => {
        room.ready = true;
        broadcast(room.controls, { type: 'status', message: 'សំឡេងស្វាតូច Angkor NAGA ភ្ជាប់រួចហើយ។' });
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
              // IMPORTANT: Display page starts talk motion when this audio arrives.
              broadcast(room.displays, {
                type: 'audio',
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
              });
            }
            if (part.text) broadcast(room.controls, { type: 'text', text: part.text });
          }
        }

        if (content?.turnComplete) {
          broadcast(room.displays, { type: 'turn_complete' });
          broadcast(room.controls, { type: 'status', message: 'ឆ្លើយរួចហើយ។' });
        }
      },
      onerror: (e) => broadcast(room.controls, { type: 'error', message: e?.message || String(e) }),
      onclose: () => {
        room.ready = false;
        room.geminiSession = null;
        broadcast(room.controls, { type: 'status', message: 'សំឡេង Gemini បានបិទ។' });
      },
    },
    config: liveConfig,
  });

  return room.geminiSession;
}

async function sendToGemini(room, input) {
  await startGemini(room);
  if (room.ready && room.geminiSession) room.geminiSession.sendRealtimeInput(input);
  else room.pending.push(input);
}

wss.on('connection', (client) => {
  let currentRoomId = 'angkor-naga';
  let role = 'unknown';

  safeSend(client, { type: 'status', message: 'ភ្ជាប់ទៅ Angkor NAGA live server រួចហើយ។' });

  client.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      currentRoomId = cleanText(msg.room || currentRoomId || 'angkor-naga', 80) || 'angkor-naga';
      const room = getRoom(currentRoomId);

      if (msg.type === 'setup_display') {
        role = 'display';
        room.displays.add(client);
        safeSend(client, { type: 'status', message: `Display connected to room ${currentRoomId}.` });
        broadcast(room.controls, { type: 'status', message: `Display connected. Displays: ${room.displays.size}` });
        return;
      }

      if (msg.type === 'setup_control') {
        role = 'control';
        room.controls.add(client);
        safeSend(client, { type: 'status', message: `Control connected to room ${currentRoomId}. Displays online: ${room.displays.size}` });
        return;
      }

      if (msg.type === 'control_comment') {
        const text = cleanText(msg.text, 1000);
        if (!text) return;

        broadcast(room.controls, { type: 'status', message: `ផ្ញើ comment ទៅស្វាតូច Angkor NAGA: ${text}` });

        // IMPORTANT: Do NOT broadcast start_talk here.
        // Motion starts only when real audio arrives at the display page.

        await sendToGemini(room, {
          text:
            `មតិអ្នកមើល: "${text}". ` +
            `ចូរឆ្លើយជាពិធីករស្វាតូច / ហនុមានតូច របស់ Angkor NAGA។ ` +
            `ចូរឆ្លើយតែភាសាខ្មែរ 100% ប៉ុណ្ណោះ ទោះមតិនោះជាភាសាអ្វីក៏ដោយ។ ` +
            `ប្រយោគខ្លីមួយប៉ុណ្ណោះ ៦ ទៅ ១៤ ពាក្យ។ ` +
            `សំឡេងគួរឲ្យស្រឡាញ់ សប្បាយ និងមានរចនាប័ទ្មវេទមន្តខ្មែរ។`,
        });
        return;
      }

      safeSend(client, { type: 'error', message: `Unknown message type: ${String(msg.type || '')}` });
    } catch (err) {
      safeSend(client, { type: 'error', message: err?.message || String(err) });
    }
  });

  client.on('close', () => {
    const room = getRoom(currentRoomId);
    if (role === 'display') room.displays.delete(client);
    if (role === 'control') room.controls.delete(client);
    broadcast(room.controls, { type: 'status', message: `Client disconnected. Displays: ${room.displays.size}, Controls: ${room.controls.size}` });
  });
});
