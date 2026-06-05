import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BUILTIN_AUDIO_OPTIONS,
  formatAudioDuration,
  getBuiltinAudioDurationSeconds,
  loadAudioDurationSeconds,
  playAudioSource,
  primeAudioPlayback,
  stopAudioPlayback,
} from '../lib/audio';
import type { AudioAsset } from '../types';

interface AudioLibraryViewProps {
  audioAssets: AudioAsset[];
  onUploadAudio: (file: File) => Promise<void>;
  onDeleteAudio: (audioAssetId: string) => Promise<void>;
  onUpdateAudioDuration: (audioAssetId: string, durationSeconds: number) => Promise<void>;
}

export function AudioLibraryView({
  audioAssets,
  onUploadAudio,
  onDeleteAudio,
  onUpdateAudioDuration,
}: AudioLibraryViewProps) {
  const [deletingAudioId, setDeletingAudioId] = useState<string | null>(null);
  const [pendingDeleteAudio, setPendingDeleteAudio] = useState<{ id: string; title: string } | null>(null);
  const [uploadedDurations, setUploadedDurations] = useState<Record<string, number | null>>({});
  const assetsById = new Map(audioAssets.map((asset) => [asset.id, asset]));
  const libraryItems = useMemo(() => [
    ...BUILTIN_AUDIO_OPTIONS.map((option) => ({
      id: option.key,
      title: option.label,
      subtitle: 'Generated locally with Web Audio',
      type: 'built-in' as const,
      durationSeconds: getBuiltinAudioDurationSeconds(option.key),
    })),
    ...audioAssets.map((asset) => ({
      id: asset.id,
      title: asset.name,
      subtitle: asset.mimeType,
      type: 'uploaded' as const,
      durationSeconds: uploadedDurations[asset.id] ?? asset.durationSeconds,
    })),
  ], [audioAssets, uploadedDurations]);

  useEffect(() => {
    const pendingAssets = audioAssets.filter(
      (asset) => asset.durationSeconds === undefined && uploadedDurations[asset.id] === undefined,
    );
    if (pendingAssets.length === 0) {
      return;
    }

    let cancelled = false;

    pendingAssets.forEach((asset) => {
      void loadAudioDurationSeconds(asset)
        .then((durationSeconds) => {
          if (!cancelled) {
            setUploadedDurations((current) => ({
              ...current,
              [asset.id]: durationSeconds,
            }));
          }

          if (Number.isFinite(durationSeconds)) {
            void onUpdateAudioDuration(asset.id, durationSeconds).catch(() => {});
          }
        })
        .catch(() => {
          if (!cancelled) {
            setUploadedDurations((current) => ({
              ...current,
              [asset.id]: null,
            }));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [audioAssets, onUpdateAudioDuration, uploadedDurations]);

  const deleteDialog = pendingDeleteAudio ? (
    <div
      className="run-delete-dialog__overlay"
      role="presentation"
      onClick={() => {
        if (deletingAudioId) {
          return;
        }

        setPendingDeleteAudio(null);
      }}
    >
      <section
        className="glass-panel run-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-delete-dialog-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <p className="eyebrow">Delete audio</p>
        <h3 id="audio-delete-dialog-title">Delete this audio file?</h3>
        <p className="run-delete-dialog__body">
          This will permanently delete <strong>{pendingDeleteAudio.title}</strong>.
        </p>
        <div className="run-delete-dialog__actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setPendingDeleteAudio(null)}
            disabled={Boolean(deletingAudioId)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setDeletingAudioId(pendingDeleteAudio.id);
              void onDeleteAudio(pendingDeleteAudio.id).finally(() => {
                setDeletingAudioId((currentId) => (currentId === pendingDeleteAudio.id ? null : currentId));
                setPendingDeleteAudio((currentPending) =>
                  currentPending?.id === pendingDeleteAudio.id ? null : currentPending,
                );
              });
            }}
            disabled={Boolean(deletingAudioId)}
          >
            {deletingAudioId === pendingDeleteAudio.id ? 'Deleting...' : 'Delete audio'}
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <section className="audio-library-layout">
      <section className="editor-panel audio-library-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Audio library</p>
            <h2>Browse and preview sound assets</h2>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                void primeAudioPlayback();
              }}
            >
              Unlock audio
            </button>
            <label className="secondary-button secondary-button--label">
              Upload audio
              <input
                type="file"
                accept="audio/*"
                hidden
                onChange={(changeEvent) => {
                  const [file] = Array.from(changeEvent.target.files ?? []);
                  if (!file) {
                    return;
                  }

                  void onUploadAudio(file);
                  changeEvent.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        <div className="audio-browser-meta">
          <span>{libraryItems.length} total sounds</span>
          <span>{audioAssets.length} uploaded</span>
        </div>

        <div className="audio-browser-list">
          {libraryItems.length === 0 ? (
            <p className="empty-state">Upload MP3, WAV, or other browser-supported audio files to reuse them in scenarios.</p>
          ) : (
            libraryItems.map((item) => (
              <article key={item.id} className="run-scenario-card audio-browser-card">
                <div className="run-scenario-card__title">
                  <div>
                    <span className={`audio-browser-card__tag audio-browser-card__tag--${item.type}`}>
                      {item.type === 'built-in' ? 'Built-in' : 'Uploaded'}
                    </span>
                    <h3>{item.title}</h3>
                  </div>
                </div>
                <p className="run-scenario-card__description">{item.subtitle}</p>
                <div className="run-scenario-card__meta">
                  <span>{item.type === 'built-in' ? 'Ready to use' : 'Custom asset'}</span>
                  <span>{formatAudioDuration(item.durationSeconds)}</span>
                  <span>{item.type === 'built-in' ? 'Browser generated' : 'Stored on server'}</span>
                </div>
                <div className="run-scenario-card__controls">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      void playAudioSource(
                        item.type === 'built-in'
                          ? { type: 'builtin', key: item.id as (typeof BUILTIN_AUDIO_OPTIONS)[number]['key'] }
                          : { type: 'uploaded', assetId: item.id },
                        assetsById,
                      )
                    }
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={stopAudioPlayback}
                  >
                    Stop
                  </button>
                  {item.type === 'uploaded' ? (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={deletingAudioId === item.id}
                      onClick={() => {
                        stopAudioPlayback();
                        setPendingDeleteAudio({ id: item.id, title: item.title });
                      }}
                    >
                      {deletingAudioId === item.id ? 'Deleting...' : 'Delete'}
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {typeof document !== 'undefined' ? createPortal(deleteDialog, document.body) : null}
    </section>
  );
}
