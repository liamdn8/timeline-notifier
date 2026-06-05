import type { AudioAsset, BuiltinAudioKey, EventAudioSource } from '../types';

interface BuiltinAudioDefinition {
  key: BuiltinAudioKey;
  label: string;
  sequence: Array<{ frequency: number; duration: number; gain: number; type?: OscillatorType }>;
}

export const BUILTIN_AUDIO_OPTIONS: BuiltinAudioDefinition[] = [
  {
    key: 'bright-bell',
    label: 'Bright Bell',
    sequence: [
      { frequency: 880, duration: 0.18, gain: 0.18, type: 'triangle' },
      { frequency: 1174, duration: 0.24, gain: 0.12, type: 'sine' },
    ],
  },
  {
    key: 'soft-chime',
    label: 'Soft Chime',
    sequence: [
      { frequency: 659, duration: 0.22, gain: 0.14, type: 'sine' },
      { frequency: 784, duration: 0.28, gain: 0.12, type: 'sine' },
      { frequency: 988, duration: 0.34, gain: 0.1, type: 'triangle' },
    ],
  },
  {
    key: 'focus-ping',
    label: 'Focus Ping',
    sequence: [
      { frequency: 523, duration: 0.14, gain: 0.2, type: 'square' },
      { frequency: 784, duration: 0.14, gain: 0.14, type: 'triangle' },
      { frequency: 523, duration: 0.14, gain: 0.18, type: 'square' },
    ],
  },
];

let audioContextPromise: Promise<AudioContext> | null = null;
let stopActivePlayback = () => {};
let activePlaybackToken = 0;

const clearActivePlayback = (token: number) => {
  if (activePlaybackToken !== token) {
    return;
  }

  stopActivePlayback = () => {};
};

const setActivePlayback = (stop: () => void) => {
  const token = activePlaybackToken + 1;
  activePlaybackToken = token;

  let stopped = false;
  stopActivePlayback = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    stop();
    clearActivePlayback(token);
  };

  return {
    token,
    stop: stopActivePlayback,
  };
};

const getAudioContext = async () => {
  if (!audioContextPromise) {
    audioContextPromise = Promise.resolve(new AudioContext());
  }

  const context = await audioContextPromise;
  if (context.state === 'suspended') {
    await context.resume();
  }
  return context;
};

const playBuiltin = async (key: BuiltinAudioKey) => {
  const context = await getAudioContext();
  const definition = BUILTIN_AUDIO_OPTIONS.find((option) => option.key === key);

  if (!definition) {
    return;
  }

  stopAudioPlayback();

  let cursor = context.currentTime;
  const oscillators: OscillatorNode[] = [];
  const gainNodes: GainNode[] = [];
  for (const note of definition.sequence) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = note.type ?? 'sine';
    oscillator.frequency.setValueAtTime(note.frequency, cursor);
    gainNode.gain.setValueAtTime(0.0001, cursor);
    gainNode.gain.exponentialRampToValueAtTime(note.gain, cursor + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, cursor + note.duration);

    oscillator.connect(gainNode).connect(context.destination);
    oscillator.start(cursor);
    oscillator.stop(cursor + note.duration + 0.02);
    oscillators.push(oscillator);
    gainNodes.push(gainNode);
    cursor += note.duration + 0.03;
  }

  const playback = setActivePlayback(() => {
    for (const oscillator of oscillators) {
      try {
        oscillator.stop();
      } catch {
        // Ignore nodes that already completed.
      }
      oscillator.disconnect();
    }

    for (const gainNode of gainNodes) {
      gainNode.disconnect();
    }
  });

  const durationMs = Math.max(0, Math.ceil((cursor - context.currentTime + 0.05) * 1000));
  window.setTimeout(() => {
    clearActivePlayback(playback.token);
  }, durationMs);
};

const playUploaded = async (asset: AudioAsset) => {
  await getAudioContext();

  stopAudioPlayback();

  if (asset.url) {
    const audio = new Audio(asset.url);
    audio.volume = 0.95;
    const playback = setActivePlayback(() => {
      audio.pause();
      audio.currentTime = 0;
    });
    audio.addEventListener(
      'ended',
      () => {
        clearActivePlayback(playback.token);
      },
      { once: true },
    );
    await audio.play();
    return;
  }

  if (!asset.blob) {
    return;
  }

  const objectUrl = URL.createObjectURL(asset.blob);

  try {
    const audio = new Audio(objectUrl);
    audio.volume = 0.95;
    const playback = setActivePlayback(() => {
      audio.pause();
      audio.currentTime = 0;
      URL.revokeObjectURL(objectUrl);
    });
    audio.addEventListener(
      'ended',
      () => {
        clearActivePlayback(playback.token);
        URL.revokeObjectURL(objectUrl);
      },
      { once: true },
    );
    await audio.play();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }
};

export const primeAudioPlayback = async () => {
  await getAudioContext();
};

export const stopAudioPlayback = () => {
  stopActivePlayback();
};

export const playAudioSource = async (
  source: EventAudioSource,
  assetsById: Map<string, AudioAsset>,
) => {
  if (source.type === 'builtin') {
    await playBuiltin(source.key);
    return;
  }

  const asset = assetsById.get(source.assetId);
  if (asset) {
    await playUploaded(asset);
  }
};
