import express from 'express';
import path, { dirname } from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { KokoroTTS } from "kokoro-js";
import fs from "fs";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
// static
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
//body parser
app.use(express.urlencoded({ extended: true }));
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
app.post('/api/speech-to-text', async (req, res) => {
    const chunks = [];
    req.on('data', (chunk) => {
        chunks.push(chunk);
    });
    req.on('end', async () => {
        const audioBuffer = Buffer.concat(chunks);
        try {
            const response = await fetch('https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'audio/wav', // تأكد إن نوع الصوت من المايك متطابق
                },
                body: audioBuffer,
            });
            const result = await response.json();
            res.json({ result });
        }
        catch (error) {
            console.error('❌ Whisper error:', error);
            res.status(500).json({ error: 'فشل تحويل الصوت إلى نص' });
        }
    });
    req.on('error', (err) => {
        console.error('❌ Request error:', err);
        res.status(500).json({ error: 'خطأ في استقبال البيانات' });
    });
});
app.post('/api/generate-Script', async (req, res) => {
    const { prompt } = req.body;
    const client = new OpenAI({
        baseURL: "https://router.huggingface.co/novita/v3/openai",
        apiKey: HF_API_KEY,
    });
    const chatCompletion = await client.chat.completions.create({
        model: "moonshotai/kimi-k2-instruct",
        messages: [
            {
                role: "user",
                content: `${prompt}`,
            },
        ],
    });
    console.log(chatCompletion.choices[0].message);
    let generatedText = chatCompletion.choices[0].message.content;
    // Your cleaning logic
    if (generatedText) {
        if (generatedText.startsWith("'") && generatedText.endsWith("'")) {
            generatedText = generatedText.substring(1, generatedText.length - 1);
        }
        if (generatedText?.startsWith('"') && generatedText.endsWith('"')) {
            generatedText = generatedText.substring(1, generatedText.length - 1);
        }
        generatedText = generatedText.replace(/['"]?\s*\+\s*\\n['"]?\s*\+\s*\\n['"]?\s*\+/g, '\n');
        generatedText = generatedText.replace(/['"]?\s*\+\s*\\n['"]?/g, '\n');
        generatedText = generatedText.replace(/\\n/g, '\n');
        generatedText = generatedText.replace(/\\'/g, "'");
        generatedText = generatedText.replace(/\\"/g, '"');
        generatedText = generatedText.trim();
    }
    console.log(generatedText);
    res.json({ generatedText });
});
// src/tts.ts
export async function generateVoice(text, outputPath) {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-ONNX", {
        dtype: "q8",
    });
    const audio = await tts.generate(text, {
        voice: "bf_emma",
    });
    // فقط استخدمي save
    await audio.save(outputPath);
    console.log("✅ تم حفظ الملف الصوتي في:", outputPath);
}
// af_heart, af_alloy, af_aoede, af_bella, af_jessica,
// af_kore, af_nicole, af_nova, af_river, af_sarah, af_sky,
// am_adam, am_echo, am_eric, am_fenrir, am_liam, am_michael,
// am_onyx, am_puck, am_santa,
// bf_emma, bf_isabella, bf_alice, bf_lily,
// bm_george, bm_lewis, bm_daniel, bm_fable
app.post("/api/text-to-speech", async (req, res) => {
    const { text } = req.body;
    if (!text)
        return res.status(400).json({ error: "No text provided" });
    const filePath = path.join(__dirname, "../output/audio.wav");
    try {
        await generateVoice(text, filePath);
        res.download(filePath);
    }
    catch (error) {
        console.error("Error generating voice:", error);
        res.status(500).json({ error: "Failed to generate voice" });
    }
});
app.get('/', (req, res) => {
    res.render('audio'); // لازم يكون عندك views/index.ejs
});
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
