import { loadAudioDurationSeconds } from './audio';
import type { AudioAsset, Scenario } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
};

export const listScenarios = async () =>
  readJson<Scenario[]>(await fetch(`${API_BASE_URL}/scenarios`));

export const saveScenario = async (scenario: Scenario) => {
  await readJson<Scenario>(
    await fetch(`${API_BASE_URL}/scenarios/${scenario.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scenario),
    }),
  );
};

export const deleteScenario = async (scenarioId: string) => {
  await readJson<{ ok: true }>(
    await fetch(`${API_BASE_URL}/scenarios/${scenarioId}`, {
      method: 'DELETE',
    }),
  );
};

export const listAudioAssets = async () =>
  readJson<AudioAsset[]>(await fetch(`${API_BASE_URL}/audio-assets`));

export const uploadAudioAsset = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const durationSeconds = await loadAudioDurationSeconds({ url: '', blob: file });
    if (Number.isFinite(durationSeconds)) {
      formData.append('durationSeconds', String(durationSeconds));
    }
  } catch {
    // Let the upload continue even if browser metadata decoding fails.
  }

  await readJson<AudioAsset>(
    await fetch(`${API_BASE_URL}/audio-assets`, {
      method: 'POST',
      body: formData,
    }),
  );
};

export const deleteAudioAsset = async (audioAssetId: string) => {
  await readJson<{ ok: true }>(
    await fetch(`${API_BASE_URL}/audio-assets/${audioAssetId}`, {
      method: 'DELETE',
    }),
  );
};

export const updateAudioAssetDuration = async (audioAssetId: string, durationSeconds: number) => {
  await readJson<AudioAsset>(
    await fetch(`${API_BASE_URL}/audio-assets/${audioAssetId}/duration`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ durationSeconds }),
    }),
  );
};
