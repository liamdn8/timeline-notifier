import { BUILTIN_AUDIO_OPTIONS, playAudioSource, primeAudioPlayback } from '../lib/audio';
import type { AudioAsset } from '../types';

interface AudioLibraryViewProps {
  audioAssets: AudioAsset[];
  onUploadAudio: (file: File) => Promise<void>;
}

export function AudioLibraryView({ audioAssets, onUploadAudio }: AudioLibraryViewProps) {
  const assetsById = new Map(audioAssets.map((asset) => [asset.id, asset]));
  const libraryItems = [
    ...BUILTIN_AUDIO_OPTIONS.map((option) => ({
      id: option.key,
      title: option.label,
      subtitle: 'Generated locally with Web Audio',
      type: 'built-in' as const,
    })),
    ...audioAssets.map((asset) => ({
      id: asset.id,
      title: asset.name,
      subtitle: asset.mimeType,
      type: 'uploaded' as const,
    })),
  ];

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
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}