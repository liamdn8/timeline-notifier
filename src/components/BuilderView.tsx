import { useEffect, useMemo, useRef, useState } from 'react';
import { playAudioSource } from '../lib/audio';
import { createId } from '../lib/utils';
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS, getDefaultLocalDateTime, normalizeScenario } from '../lib/time';
import type { AudioAsset, Scenario, ScenarioEvent } from '../types';
import { EventEditor } from './EventEditor';

interface BuilderViewProps {
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  audioAssets: AudioAsset[];
  onSelectScenario: (scenarioId: string) => void;
  onSaveScenario: (scenario: Scenario) => Promise<void>;
  onDeleteScenario: (scenarioId: string) => Promise<void>;
  editorRequest?: {
    mode: 'new' | 'edit';
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

export function BuilderView({
  scenarios,
  selectedScenarioId,
  audioAssets,
  onSelectScenario,
  onSaveScenario,
  onDeleteScenario,
  editorRequest,
}: BuilderViewProps) {
  const [draft, setDraft] = useState<Scenario>(() => createEmptyScenario());
  const [saveState, setSaveState] = useState<string>('');
  const handledEditorRequestNonceRef = useRef<number | null>(null);
  const assetsById = useMemo(() => new Map(audioAssets.map((asset) => [asset.id, asset])), [audioAssets]);

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
  }, [editorRequest, onSelectScenario, scenarios]);

  useEffect(() => {
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
  }, [scenarios, selectedScenarioId]);

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
                onClick={() => void onDeleteScenario(draft.id)}
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
            onClick={() =>
              setDraft({
                ...draft,
                events: [...draft.events, createEmptyEvent(draft.timezone)],
              })
            }
          >
            Add event
          </button>
        </div>

        <div className="event-stack event-stack--cards">
          {draft.events.map((event) => (
            <EventEditor
              key={event.id}
              event={event}
              timezone={draft.timezone}
              audioAssets={audioAssets}
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
            />
          ))}
        </div>

        {saveState ? <p className="support-line">{saveState}</p> : null}
      </section>
    </section>
  );
}