export type BuiltinAudioKey = 'bright-bell' | 'soft-chime' | 'focus-ping';

export type EventAudioSource =
  | {
      type: 'builtin';
      key: BuiltinAudioKey;
    }
  | {
      type: 'uploaded';
      assetId: string;
    };

export interface ScenarioEvent {
  id: string;
  title: string;
  description: string;
  scheduledAtLocal: string;
  scheduledAtUtc: string;
  audio: EventAudioSource;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  timezone: string;
  events: ScenarioEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AudioAsset {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  blob?: Blob;
  createdAt: string;
}

export interface TimelineEvent extends ScenarioEvent {
  atMillis: number;
}