import { BUILTIN_AUDIO_OPTIONS, formatAudioDuration, getBuiltinAudioDurationSeconds } from '../lib/audio';
import { formatEventTime } from '../lib/time';
import type { AudioAsset, ScenarioEvent } from '../types';

interface EventEditorProps {
  event: ScenarioEvent;
  timezone: string;
  audioAssets: AudioAsset[];
  onChange: (event: ScenarioEvent) => void;
  onRemove: () => void;
  onPreview: (event: ScenarioEvent) => Promise<void>;
  onStopPreview: () => void;
}

const toAudioValue = (event: ScenarioEvent) =>
  event.audio.type === 'builtin'
    ? `builtin:${event.audio.key}`
    : `uploaded:${'assetId' in event.audio ? event.audio.assetId : ''}`;

export function EventEditor({
  event,
  timezone,
  audioAssets,
  onChange,
  onRemove,
  onPreview,
  onStopPreview,
}: EventEditorProps) {
  // let selectedUploadedAsset: AudioAsset | null = null;
  // if ('assetId' in event.audio) {
  //   const uploadedAssetId = event.audio.assetId;
  //   selectedUploadedAsset = audioAssets.find((asset) => asset.id === uploadedAssetId) ?? null;
  // }

  // const selectedDuration =
  //   event.audio.type === 'builtin'
  //     ? getBuiltinAudioDurationSeconds(event.audio.key)
  //     : selectedUploadedAsset?.durationSeconds;

  return (
    <article className="event-card event-card--builder">
      <div className="event-card__top-row">
        <label className="field event-cell event-cell--time">
          <span className="event-cell__label">Time</span>
          <input
            type="datetime-local"
            value={event.scheduledAtLocal}
            onChange={(inputEvent) =>
              onChange({
                ...event,
                scheduledAtLocal: inputEvent.target.value,
              })
            }
          />
        </label>

        <label className="field event-cell event-cell--title">
          <span className="event-cell__label">Title</span>
          <input
            type="text"
            value={event.title}
            placeholder="Sprint review starts"
            onChange={(inputEvent) =>
              onChange({
                ...event,
                title: inputEvent.target.value,
              })
            }
          />
        </label>

        <label className="field event-cell event-cell--voice">
          <span className="event-cell__label">Voice notification</span>
          <select
            value={toAudioValue(event)}
            onChange={(inputEvent) => {
              const [type, value] = inputEvent.target.value.split(':');
              onChange({
                ...event,
                audio:
                  type === 'builtin'
                    ? { type: 'builtin', key: value as ScenarioEvent['audio'] extends { type: 'builtin'; key: infer Key } ? Key : never }
                    : { type: 'uploaded', assetId: value },
              });
            }}
          >
            {BUILTIN_AUDIO_OPTIONS.map((option) => (
              <option key={option.key} value={`builtin:${option.key}`}>
                Built-in: {option.label} ({formatAudioDuration(getBuiltinAudioDurationSeconds(option.key))})
              </option>
            ))}
            {audioAssets.map((asset) => (
              <option key={asset.id} value={`uploaded:${asset.id}`}>
                Uploaded: {asset.name} ({formatAudioDuration(asset.durationSeconds)})
              </option>
            ))}
          </select>
        </label>

        <div className="field field--static event-cell event-cell--preview">
          <span className="event-cell__label">Preview</span>
          <div className="event-cell__actions">
            <button
              type="button"
              className="event-icon-button"
              aria-label="Preview voice notification"
              title="Preview voice notification"
              onClick={() => void onPreview(event)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 6v12l10-6-10-6Z" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="event-icon-button"
              aria-label="Stop voice notification preview"
              title="Stop voice notification preview"
              onClick={onStopPreview}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7h10v10H7V7Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>

        <div className="field field--static event-cell event-cell--action">
          <span className="event-cell__label">Remove</span>
          <button
            type="button"
            className="event-icon-button event-icon-button--danger"
            aria-label="Remove event"
            title="Remove event"
            onClick={onRemove}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7h10v2H7V7Zm2 3h2v7H9v-7Zm4 0h2v7h-2v-7ZM10 4h4l1 1h4v2H5V5h4l1-1Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      <label className="field event-cell event-cell--description">
        <span className="event-cell__label">Description</span>
        <textarea
          rows={4}
          value={event.description}
          placeholder="Short support text shown while this event is active"
          onChange={(inputEvent) =>
            onChange({
              ...event,
              description: inputEvent.target.value,
            })
          }
        />
      </label>

      {event.scheduledAtUtc ? (
        <p className="support-line event-card__support-line">Will trigger at {formatEventTime(event.scheduledAtUtc, timezone)} ({timezone})</p>
      ) : (
        <p className="support-line support-line--warning event-card__support-line">Choose a valid date and time to arm this event.</p>
      )}
    </article>
  );
}
