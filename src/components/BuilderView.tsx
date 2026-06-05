import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadAudioDurationSeconds, playAudioSource, stopAudioPlayback } from '../lib/audio';
import { createId } from '../lib/utils';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS, getDefaultLocalDateTime, normalizeScenario, toUtcIso } from '../lib/time';
import type { AudioAsset, Scenario, ScenarioEvent } from '../types';
import { EventEditor } from './EventEditor';

interface BuilderViewProps {
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  audioAssets: AudioAsset[];
  onUpdateAudioDuration: (audioAssetId: string, durationSeconds: number) => Promise<void>;
  onSelectScenario: (scenarioId: string) => void;
  onSaveScenario: (scenario: Scenario) => Promise<void>;
  onDeleteScenario: (scenarioId: string) => Promise<void>;
  editorRequest?: {
    mode: 'new' | 'edit' | 'clone';
    scenarioId: string | null;
    nonce: number;
  };
}

const createEmptyEvent = (timezone: string): ScenarioEvent => ({
  id: createId('event'),
  title: '',
  description: '',
  scheduledAtLocal: getDefaultLocalDateTime(timezone),
  scheduledAtUtc: '',
  audio: {
    type: 'builtin',
    key: 'bright-bell',
  },
});

const createEmptyScenario = (): Scenario => {
  const timezone = DEFAULT_TIMEZONE;
  const now = new Date().toISOString();

  return {
    id: createId('scenario'),
    title: '',
    description: '',
    timezone,
    events: [createEmptyEvent(timezone)],
    createdAt: now,
    updatedAt: now,
  };
};

const createClonedScenario = (scenario: Scenario): Scenario => {
  const now = new Date().toISOString();
  const baseTitle = scenario.title.trim() || 'Untitled scenario';

  return {
    ...scenario,
    id: createId('scenario'),
    title: `${baseTitle} copy`,
    events: scenario.events.map((event) => ({
      ...event,
      id: createId('event'),
    })),
    createdAt: now,
    updatedAt: now,
  };
};

export function BuilderView({
  scenarios,
  selectedScenarioId,
  audioAssets,
  onUpdateAudioDuration,
  onSelectScenario,
  onSaveScenario,
  onDeleteScenario,
  editorRequest,
}: BuilderViewProps) {
  const [draft, setDraft] = useState<Scenario>(() => createEmptyScenario());
  const [saveState, setSaveState] = useState<string>('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingScenario, setIsDeletingScenario] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [uploadedDurations, setUploadedDurations] = useState<Record<string, number | null>>({});
  const handledEditorRequestNonceRef = useRef<number | null>(null);
  const deleteInputRef = useRef<HTMLInputElement | null>(null);
  const eventAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const audioAssetsWithDurations = useMemo(
    () =>
      audioAssets.map((asset) => ({
        ...asset,
        durationSeconds: uploadedDurations[asset.id] ?? asset.durationSeconds,
      })),
    [audioAssets, uploadedDurations],
  );
  const assetsById = useMemo(
    () => new Map(audioAssetsWithDurations.map((asset) => [asset.id, asset])),
    [audioAssetsWithDurations],
  );
  const hasPersistedDraft = scenarios.some((scenario) => scenario.id === draft.id);
  const eventOrderWarning = useMemo(() => {
    let previousUtc = '';

    for (let index = 0; index < draft.events.length; index += 1) {
      const event = draft.events[index];
      const currentUtc = toUtcIso(event.scheduledAtLocal, draft.timezone);

      if (!currentUtc) {
        continue;
      }

      if (previousUtc && currentUtc <= previousUtc) {
        return {
          eventId: event.id,
          index,
          message: 'Event times are not increasing',
        };
      }

      previousUtc = currentUtc;
    }

    return null;
  }, [draft.events, draft.timezone]);

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

  useEffect(() => {
    if (!editorRequest) {
      return;
    }

    if (editorRequest?.mode === 'new') {
      if (handledEditorRequestNonceRef.current === editorRequest.nonce) {
        return;
      }

      const emptyScenario = createEmptyScenario();
      setDraft(emptyScenario);
      onSelectScenario(emptyScenario.id);
      setSaveState('');
      handledEditorRequestNonceRef.current = editorRequest.nonce;
      return;
    }

    if (editorRequest?.mode === 'edit' && editorRequest.scenarioId) {
      const requestedScenario = scenarios.find((scenario) => scenario.id === editorRequest.scenarioId);
      if (!requestedScenario || handledEditorRequestNonceRef.current === editorRequest.nonce) {
        return;
      }

      setDraft(requestedScenario);
      onSelectScenario(requestedScenario.id);
      setSaveState('');
      handledEditorRequestNonceRef.current = editorRequest.nonce;
      return;
    }

    if (editorRequest?.mode === 'clone' && editorRequest.scenarioId) {
      const requestedScenario = scenarios.find((scenario) => scenario.id === editorRequest.scenarioId);
      if (!requestedScenario || handledEditorRequestNonceRef.current === editorRequest.nonce) {
        return;
      }

      const clonedScenario = createClonedScenario(requestedScenario);
      setDraft(clonedScenario);
      onSelectScenario(clonedScenario.id);
      setSaveState('');
      handledEditorRequestNonceRef.current = editorRequest.nonce;
    }
  }, [editorRequest, onSelectScenario, scenarios]);

  useEffect(() => {
    if (editorRequest?.mode === 'new' && handledEditorRequestNonceRef.current === editorRequest.nonce && !hasPersistedDraft) {
      return;
    }

    const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId);
    if (selectedScenario) {
      setDraft(selectedScenario);
      setSaveState('');
      return;
    }

    if (selectedScenarioId) {
      return;
    }

    if (scenarios.length === 0) {
      setDraft(createEmptyScenario());
      return;
    }

    setDraft(scenarios[0]);
  }, [editorRequest, hasPersistedDraft, scenarios, selectedScenarioId]);

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return;
    }

    deleteInputRef.current?.focus();
  }, [isDeleteDialogOpen]);

  useEffect(() => {
    if (draft.events.length === 0) {
      setActiveEventId(null);
      return;
    }

    setActiveEventId((currentId) =>
      currentId && draft.events.some((event) => event.id === currentId) ? currentId : draft.events[0].id,
    );
  }, [draft.events]);

  useEffect(() => {
    if (draft.events.length === 0) {
      return;
    }

    const pickActiveEvent = () => {
      const anchorOffset = 140;
      let nextActiveEventId = draft.events[0].id;

      for (const event of draft.events) {
        const element = eventAnchorRefs.current[event.id];
        if (!element) {
          continue;
        }

        const { top } = element.getBoundingClientRect();
        if (top - anchorOffset <= 0) {
          nextActiveEventId = event.id;
        } else {
          break;
        }
      }

      setActiveEventId(nextActiveEventId);
    };

    pickActiveEvent();
    window.addEventListener('scroll', pickActiveEvent, { passive: true });
    window.addEventListener('resize', pickActiveEvent);

    return () => {
      window.removeEventListener('scroll', pickActiveEvent);
      window.removeEventListener('resize', pickActiveEvent);
    };
  }, [draft.events]);

  const saveDraft = async () => {
    const normalized = normalizeScenario({
      ...draft,
      title: draft.title.trim() || 'Untitled scenario',
      description: draft.description.trim(),
      events: draft.events.map((event) => ({
        ...event,
        title: event.title.trim() || 'Untitled event',
        description: event.description.trim(),
      })),
    });

    await onSaveScenario(normalized);
    onSelectScenario(normalized.id);
    setDraft(normalized);
    setSaveState(`Saved ${new Date().toLocaleTimeString('vi-VN')}`);
  };

  const closeDeleteDialog = () => {
    if (isDeletingScenario) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setDeleteConfirmationText('');
  };

  const confirmDeleteScenario = async () => {
    if (deleteConfirmationText.trim().toLowerCase() !== 'delete') {
      return;
    }

    setIsDeletingScenario(true);

    try {
      await onDeleteScenario(draft.id);
      setIsDeleteDialogOpen(false);
      setDeleteConfirmationText('');
    } finally {
      setIsDeletingScenario(false);
    }
  };

  const focusEvent = (eventId: string) => {
    const target = eventAnchorRefs.current[eventId];
    if (!target) {
      return;
    }

    const offset = 140;
    const top = window.scrollY + target.getBoundingClientRect().top - offset;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: 'smooth',
    });
    setActiveEventId(eventId);
  };

  const addEvent = () => {
    const nextEvent = createEmptyEvent(draft.timezone);

    setDraft({
      ...draft,
      events: [...draft.events, nextEvent],
    });
    setActiveEventId(nextEvent.id);

    window.setTimeout(() => {
      focusEvent(nextEvent.id);
    }, 0);
  };

  const eventNavigator = (
    <div className="builder-event-navigator" aria-label="Event navigator">
      <div className="builder-event-navigator__list" aria-label="Scenario events">
        <button
          type="button"
          aria-label={eventOrderWarning ? eventOrderWarning.message : 'Event times are increasing'}
          className={`builder-event-navigator__item builder-event-navigator__item--status ${eventOrderWarning ? 'is-warning' : 'is-ok'}`}
          onClick={() => {
            if (eventOrderWarning) {
              focusEvent(eventOrderWarning.eventId);
            }
          }}
        >
          <span className="builder-event-navigator__dot builder-event-navigator__dot--status" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0-6 6v2.1c0 .72-.2 1.43-.58 2.03L4 15.5V17h16v-1.5l-1.42-2.37a4.03 4.03 0 0 1-.58-2.03V9a6 6 0 0 0-6-6Zm0 18a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 21Z" fill="currentColor" />
            </svg>
          </span>
          <span className="builder-event-navigator__tooltip" aria-hidden="true">
            {eventOrderWarning ? `${eventOrderWarning.message} at event ${eventOrderWarning.index + 1}` : 'Event times are increasing'}
          </span>
        </button>
        {draft.events.map((event, index) => {
          const isActive = event.id === activeEventId;
          const hasTitle = Boolean(event.title.trim());
          const isIncomplete = !event.scheduledAtUtc || !hasTitle;
          const tooltipLabel = event.title.trim() || `Event ${index + 1}`;

          return (
            <button
              key={event.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              aria-label={tooltipLabel}
              className={`builder-event-navigator__item ${isActive ? 'is-active' : ''} ${isIncomplete ? 'is-incomplete' : ''}`}
              onClick={() => focusEvent(event.id)}
            >
              <span className="builder-event-navigator__dot" aria-hidden="true">
                {index + 1}
              </span>
              <span className="builder-event-navigator__tooltip" aria-hidden="true">
                {tooltipLabel}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Add event"
          className="builder-event-navigator__item builder-event-navigator__item--add"
          onClick={addEvent}
        >
          <span className="builder-event-navigator__dot builder-event-navigator__dot--add" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 5h2v14h-2V5Zm-6 6h14v2H5v-2Z" fill="currentColor" />
            </svg>
          </span>
          <span className="builder-event-navigator__tooltip" aria-hidden="true">
            Add event
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <section className="builder-layout builder-layout--single">
      <section className="glass-panel editor-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Scenario builder</p>
            <h2>Compose your timeline</h2>
          </div>
          <div className="action-row">
            {scenarios.some((scenario) => scenario.id === draft.id) ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                Delete
              </button>
            ) : null}
            <button type="button" className="primary-button" onClick={() => void saveDraft()}>
              Save scenario
            </button>
          </div>
        </div>

        <div className="builder-scenario-row">
          <label className="field builder-scenario-row__title">
            <span>Scenario title</span>
            <input
              type="text"
              value={draft.title}
              placeholder="Daily show run"
              onChange={(inputEvent) => setDraft({ ...draft, title: inputEvent.target.value })}
            />
          </label>

          <label className="field builder-scenario-row__timezone">
            <span>Timezone</span>
            <select
              value={draft.timezone}
              onChange={(inputEvent) => {
                const timezone = inputEvent.target.value;
                setDraft({
                  ...draft,
                  timezone,
                  events: draft.events.map((event) => ({
                    ...event,
                    scheduledAtLocal: event.scheduledAtLocal || getDefaultLocalDateTime(timezone),
                  })),
                });
              }}
            >
              {TIMEZONE_OPTIONS.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </label>

          <label className="field builder-scenario-row__description">
            <span>Scenario description</span>
            <textarea
              rows={1}
              value={draft.description}
              placeholder="Short context shown before the run starts"
              onChange={(inputEvent) => setDraft({ ...draft, description: inputEvent.target.value })}
            />
          </label>
        </div>

        <div className="section-header section-header--tight builder-events-header">
          <div>
            <p className="eyebrow">Events</p>
            <h3>{draft.events.length} scheduled cues</h3>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={addEvent}
          >
            Add event
          </button>
        </div>

        <div className="event-stack event-stack--cards">
          {draft.events.map((event) => (
            <div
              key={event.id}
              ref={(element) => {
                eventAnchorRefs.current[event.id] = element;
              }}
              className="builder-event-anchor"
            >
              <EventEditor
                event={event}
                timezone={draft.timezone}
                audioAssets={audioAssetsWithDurations}
                onChange={(updatedEvent) =>
                  setDraft({
                    ...draft,
                    events: draft.events.map((candidate) =>
                      candidate.id === updatedEvent.id ? updatedEvent : candidate,
                    ),
                  })
                }
                onRemove={() =>
                  setDraft({
                    ...draft,
                    events:
                      draft.events.length === 1
                        ? [createEmptyEvent(draft.timezone)]
                        : draft.events.filter((candidate) => candidate.id !== event.id),
                  })
                }
                onPreview={(previewEvent) => playAudioSource(previewEvent.audio, assetsById)}
                onStopPreview={stopAudioPlayback}
              />
            </div>
          ))}
        </div>

        {saveState ? <p className="support-line">{saveState}</p> : null}
      </section>

      {typeof document !== 'undefined' ? createPortal(eventNavigator, document.body) : null}

      {isDeleteDialogOpen ? (
        <div
          className="run-delete-dialog__overlay"
          role="presentation"
          onClick={() => {
            closeDeleteDialog();
          }}
        >
          <section
            className="glass-panel run-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="builder-delete-dialog-title"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <p className="eyebrow">Delete scenario</p>
            <h3 id="builder-delete-dialog-title">Type `delete` to confirm</h3>
            <p className="run-delete-dialog__body">
              This will permanently delete <strong>{draft.title || 'this scenario'}</strong>.
            </p>
            <label className="field run-delete-dialog__field">
              <span>Confirmation keyword</span>
              <input
                ref={deleteInputRef}
                type="text"
                value={deleteConfirmationText}
                placeholder="Type delete"
                onChange={(inputEvent) => setDeleteConfirmationText(inputEvent.target.value)}
              />
            </label>
            <div className="run-delete-dialog__actions">
              <button type="button" className="ghost-button" onClick={closeDeleteDialog} disabled={isDeletingScenario}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  void confirmDeleteScenario();
                }}
                disabled={isDeletingScenario || deleteConfirmationText.trim().toLowerCase() !== 'delete'}
              >
                {isDeletingScenario ? 'Deleting...' : 'Delete scenario'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
