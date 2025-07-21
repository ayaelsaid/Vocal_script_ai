import express from 'express';
import path,{ dirname } from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { KokoroTTS } from "kokoro-js";
import fs from "fs";


dotenv.config()
const app = express();
const PORT = process.env.PORT || 5000
// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// ejs
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/views'));
// static
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

//body parser
app.use(express.urlencoded({ extended: true }));
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
app.post('/api/speech-to-text', async (req, res) => {
    const chunks = <any>[];
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
                    'Content-Type': 'audio/webm',
                },
                body: audioBuffer,
            });
            const result = await response.json();
            console.log({result })
            res.json({ result });
        }
        catch (error) {
            console.error('❌ Whisper error:', error);
            res.status(500).json({ error: 'faild to covert voice to text' });
        }
    });
    req.on('error', (err) => {
        console.error('❌ Request error:', err);
        res.status(500).json({ error: 'error in data' });
    });
});
app.post('/api/generate-Script', async(req, res)=>{
  const { prompt } = req.body;
const client = new OpenAI({
 baseURL: "https://router.huggingface.co/v1",
    apiKey: HF_API_KEY,
});

const chatCompletion = await client.chat.completions.create({
        model: "meta-llama/Llama-3.1-8B-Instruct:novita",

    messages: [
        {
            role: "user",
            content: `${prompt}`,
        },
    ],

}

);
console.log(chatCompletion.choices[0].message);

let generatedText = chatCompletion.choices[0].message.content;

if(generatedText){
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

export async function generateVoice(text: any, outputPath: any) {
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

  await audio.save(outputPath);

  console.log("✅ تم حفظ الملف الصوتي في:", outputPath);
}


app.post("/api/text-to-speech", async (req, res) => {
    const { text } = req.body;
    if (!text)
        return res.status(400).json({ error: "No text provided" });
  const outputFile = path.join(__dirname, "../public/audio/audio.mp3");

  try {
    await generateVoice(text, outputFile);
    const fileUrl = `audio/audio.mp3`;

    res.json({ filePath: fileUrl });
  } catch (error) {
    console.error("Error generating voice:", error);
    res.status(500).json({ error: "Failed to generate voice" });
  }
});
app.get('/', (req, res) => {
  res.render('audio');
})

app.listen(PORT, ()=>{
    console.log(`Server started on http://localhost:${PORT}`)
})