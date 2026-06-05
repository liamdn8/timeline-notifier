import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
const s3Enabled = /^(1|true|yes|on)$/i.test(process.env.AUDIO_S3_ENABLED ?? '');
const s3Bucket = process.env.AUDIO_S3_BUCKET?.trim() ?? '';
const s3Prefix = (process.env.AUDIO_S3_PREFIX ?? '').trim().replace(/^\/+|\/+$/g, '');
const s3Configured = s3Enabled && s3Bucket.length > 0;

if (s3Enabled && !s3Configured) {
  console.warn('AUDIO_S3_ENABLED is set but AUDIO_S3_BUCKET is missing. S3 integration is disabled.');
}

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
    s3Key: { type: String },
    createdAt: { type: String, required: true },
  },
  { versionKey: false },
);

const ScenarioModel = mongoose.model('Scenario', scenarioSchema);
const AudioAssetModel = mongoose.model('AudioAsset', audioAssetSchema);

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '2mb' }));

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
const s3Client = s3Configured ? new S3Client({}) : null;
const mediaSyncByFileName = new Map();

const buildAudioAssetS3Key = (fileName) => (s3Prefix ? `${s3Prefix}/${fileName}` : fileName);

const getLocalMediaPath = (fileName) => path.join(mediaDir, path.basename(fileName));

const createNotFoundError = (message) => {
  const error = new Error(message);
  error.code = 'ENOENT';
  return error;
};

const isNotFoundError = (error) =>
  error?.code === 'ENOENT' ||
  error?.name === 'NoSuchKey' ||
  error?.$metadata?.httpStatusCode === 404;

const uploadAudioToS3 = async (asset, localFilePath) => {
  if (!s3Client || !s3Bucket) {
    return;
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: asset.s3Key ?? buildAudioAssetS3Key(asset.fileName),
      Body: await readFile(localFilePath),
      ContentType: asset.mimeType,
    }),
  );
};

const deleteAudioFromS3 = async (asset) => {
  if (!s3Client || !s3Bucket || !asset?.s3Key) {
    return;
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: s3Bucket,
      Key: asset.s3Key,
    }),
  );
};

const hydrateLocalAudioFromS3 = async (asset) => {
  if (!s3Client || !s3Bucket) {
    throw createNotFoundError(`Audio file is not available locally: ${asset.fileName}`);
  }

  const localFilePath = getLocalMediaPath(asset.fileName);
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: s3Bucket,
      Key: asset.s3Key ?? buildAudioAssetS3Key(asset.fileName),
    }),
  );

  if (!response.Body) {
    throw new Error(`S3 returned an empty body for ${asset.fileName}`);
  }

  const bytes = Buffer.from(await response.Body.transformToByteArray());
  await writeFile(localFilePath, bytes);
};

const ensureLocalAudioFile = async (fileName) => {
  const localFilePath = getLocalMediaPath(fileName);

  try {
    await access(localFilePath);
    return localFilePath;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  if (!s3Configured) {
    throw createNotFoundError(`Audio file is not available locally: ${fileName}`);
  }

  const inFlight = mediaSyncByFileName.get(fileName);
  if (inFlight) {
    await inFlight;
    return localFilePath;
  }

  const hydratePromise = (async () => {
    const asset = await AudioAssetModel.findOne({ fileName }).lean();

    if (!asset) {
      throw createNotFoundError(`Audio asset was not found: ${fileName}`);
    }

    await hydrateLocalAudioFromS3(asset);
  })();

  mediaSyncByFileName.set(fileName, hydratePromise);

  try {
    await hydratePromise;
    return localFilePath;
  } finally {
    mediaSyncByFileName.delete(fileName);
  }
};

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

app.get('/media/:fileName', async (req, res, next) => {
  try {
    const localFilePath = await ensureLocalAudioFile(req.params.fileName);
    res.sendFile(localFilePath);
  } catch (error) {
    if (isNotFoundError(error)) {
      res.status(404).send('Audio file not found.');
      return;
    }

    next(error);
  }
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

app.post('/api/audio-assets', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).send('Missing file upload.');
    return;
  }

  const asset = {
    id: `audio_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: req.file.originalname,
    mimeType: req.file.mimetype || 'audio/mpeg',
    fileName: req.file.filename,
    s3Key: s3Configured ? buildAudioAssetS3Key(req.file.filename) : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await uploadAudioToS3(asset, req.file.path);
    await AudioAssetModel.create(asset);
    res.status(201).json(toAudioAssetPayload(asset));
  } catch (error) {
    try {
      await deleteAudioFromS3(asset);
    } catch {
      // Ignore rollback failures after an upload error.
    }

    try {
      await unlink(req.file.path);
    } catch {
      // Ignore cleanup failures after an upload error.
    }

    next(error);
  }
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

app.use((error, _req, res, _next) => {
  console.error(error);

  if (res.headersSent) {
    return;
  }

  res.status(500).send(error instanceof Error ? error.message : 'Internal server error');
});

app.listen(port, () => {
  console.log(`timeline-notifier-server listening on :${port}`);
});
