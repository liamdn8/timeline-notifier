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

  await readJson<AudioAsset>(
    await fetch(`${API_BASE_URL}/audio-assets`, {
      method: 'POST',
      body: formData,
    }),
  );
};