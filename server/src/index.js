import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT ?? 3001);
const mongoUri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/timeline_notifier';
const mediaDir = process.env.MEDIA_DIR ?? path.resolve(__dirname, '../media');
const staticDir = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : null;

await mkdir(mediaDir, { recursive: true });
await mongoose.connect(mongoUri);

const audioSourceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['builtin', 'uploaded'], required: true },
    key: { type: String },
    assetId: { type: String },
  },
  { _id: false },
);

const scenarioEventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    scheduledAtLocal: { type: String, required: true },
    scheduledAtUtc: { type: String, required: true },
    audio: { type: audioSourceSchema, required: true },
  },
  { _id: false },
);

const scenarioSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    timezone: { type: String, required: true },
    events: { type: [scenarioEventSchema], default: [] },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { versionKey: false },
);

const audioAssetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileName: { type: String, required: true, unique: true },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

const ScenarioModel = mongoose.model('Scenario', scenarioSchema);
const AudioAssetModel = mongoose.model('AudioAsset', audioAssetSchema);

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '2mb' }));
app.use('/media', express.static(mediaDir));

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, mediaDir);
  },
  filename: (_req, file, callback) => {
    const safeBaseName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    callback(null, `${Date.now()}-${safeBaseName}`);
  },
});

const upload = multer({ storage });

const toAudioAssetPayload = (assetDoc) => ({
  id: assetDoc.id,
  name: assetDoc.name,
  mimeType: assetDoc.mimeType,
  createdAt: assetDoc.createdAt,
  url: `/media/${assetDoc.fileName}`,
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/scenarios', async (_req, res) => {
  const scenarios = await ScenarioModel.find().sort({ updatedAt: -1 }).lean();
  res.json(scenarios);
});

app.put('/api/scenarios/:id', async (req, res) => {
  const scenario = req.body;

  if (!scenario?.id || scenario.id !== req.params.id) {
    res.status(400).send('Scenario id mismatch.');
    return;
  }

  await ScenarioModel.findOneAndUpdate({ id: scenario.id }, scenario, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  res.json(scenario);
});

app.delete('/api/scenarios/:id', async (req, res) => {
  await ScenarioModel.findOneAndDelete({ id: req.params.id });
  res.json({ ok: true });
});

app.get('/api/audio-assets', async (_req, res) => {
  const assets = await AudioAssetModel.find().sort({ createdAt: -1 }).lean();
  res.json(assets.map(toAudioAssetPayload));
});

app.post('/api/audio-assets', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).send('Missing file upload.');
    return;
  }

  const asset = {
    id: `audio_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: req.file.originalname,
    mimeType: req.file.mimetype || 'audio/mpeg',
    fileName: req.file.filename,
    createdAt: new Date().toISOString(),
  };

  await AudioAssetModel.create(asset);
  res.status(201).json(toAudioAssetPayload(asset));
});

if (staticDir) {
  try {
    await access(path.join(staticDir, 'index.html'));
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/media/')) {
        next();
        return;
      }

      res.sendFile(path.join(staticDir, 'index.html'));
    });
  } catch {
    console.warn(`STATIC_DIR is set but index.html was not found: ${staticDir}`);
  }
}

app.listen(port, () => {
  console.log(`timeline-notifier-server listening on :${port}`);
});