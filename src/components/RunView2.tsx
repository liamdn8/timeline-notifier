import { DateTime } from 'luxon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playAudioSource, primeAudioPlayback } from '../lib/audio';
import { AudioLibraryView } from './AudioLibraryView';
import { formatClock, formatEventTime, getTimelineEvents } from '../lib/time';
import type { AudioAsset, Scenario } from '../types';

interface RunView2Props {
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  audioAssets: AudioAsset[];
  onLiveRunStateChange: (isLiveRunning: boolean) => void;
  onSelectScenario: (scenarioId: string) => void;
  onOpenScenarioSettings: (scenarioId: string) => void;
  onCreateScenario: () => void;
  onDeleteScenario: (scenarioId: string) => Promise<void>;
  onUploadAudio: (file: File) => Promise<void>;
}

export function RunView2({
  scenarios,
  selectedScenarioId,
  audioAssets,
  onLiveRunStateChange,
  onSelectScenario,
  onOpenScenarioSettings,
  onCreateScenario,
  onDeleteScenario,
  onUploadAudio,
}: RunView2Props) {
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [browserTab, setBrowserTab] = useState<'scenarios' | 'audio'>('scenarios');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pendingDeleteScenario, setPendingDeleteScenario] = useState<{ id: string; title: string } | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingScenario, setIsDeletingScenario] = useState(false);
  const [nowMillis, setNowMillis] = useState(() => Date.now());
  const playedEventIdsRef = useRef<Set<string>>(new Set());
  const eventRefs = useRef<Record<string, HTMLElement | null>>({});
  const deleteInputRef = useRef<HTMLInputElement | null>(null);
  const assetsById = useMemo(() => new Map(audioAssets.map((asset) => [asset.id, asset])), [audioAssets]);
  const scenario = useMemo(
    () => scenarios.find((candidate) => candidate.id === activeScenarioId) ?? null,
    [activeScenarioId, scenarios],
  );
  const timeline = useMemo(() => (scenario ? getTimelineEvents(scenario) : []), [scenario]);
  const currentEvent = useMemo(
    () => [...timeline].reverse().find((event) => event.atMillis <= nowMillis) ?? null,
    [nowMillis, timeline],
  );
  const nextEvent = useMemo(
    () => timeline.find((event) => event.atMillis > nowMillis) ?? null,
    [nowMillis, timeline],
  );
  const targetEventId = currentEvent?.id ?? nextEvent?.id ?? timeline[0]?.id ?? null;
  const filteredScenarios = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const nextScenarios = normalizedQuery
      ? scenarios.filter((candidate) => {
          const searchSurface = [
            candidate.title,
            candidate.description,
            candidate.timezone,
            ...candidate.events.map((event) => `${event.title} ${event.description}`),
          ]
            .join(' ')
            .toLowerCase();

          return searchSurface.includes(normalizedQuery);
        })
      : [...scenarios];

    nextScenarios.sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (sortBy === 'date') {
        return left.updatedAt.localeCompare(right.updatedAt) * direction;
      }

      return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }) * direction;
    });

    return nextScenarios;
  }, [scenarios, sortBy, sortDirection, searchQuery]);

  useEffect(() => {
    playedEventIdsRef.current = new Set();
  }, [activeScenarioId]);

  useEffect(() => {
    onLiveRunStateChange(activeScenarioId !== null);
  }, [activeScenarioId, onLiveRunStateChange]);

  useEffect(() => {
    if (!selectedScenarioId || scenarios.length === 0) {
      return;
    }

    const exists = scenarios.some((candidate) => candidate.id === selectedScenarioId);
    if (!exists) {
      onSelectScenario(scenarios[0].id);
    }
  }, [onSelectScenario, scenarios, selectedScenarioId]);

  useEffect(() => {
    if (!scenario) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowMillis(Date.now());
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [scenario]);

  useEffect(() => {
    if (!scenario) {
      return;
    }

    const dueEvents = timeline.filter(
      (event) => event.atMillis <= nowMillis && !playedEventIdsRef.current.has(event.id),
    );

    dueEvents.forEach((event) => {
      playedEventIdsRef.current.add(event.id);
      void playAudioSource(event.audio, assetsById);
    });
  }, [assetsById, nowMillis, scenario, timeline]);

  useEffect(() => {
    if (!targetEventId) {
      return;
    }

    const targetElement = eventRefs.current[targetEventId];
    if (!targetElement) {
      return;
    }

    targetElement.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }, [targetEventId]);

  useEffect(() => {
    if (!pendingDeleteScenario) {
      return;
    }

    deleteInputRef.current?.focus();
  }, [pendingDeleteScenario]);

  const launchScenario = async (scenarioId: string) => {
    onSelectScenario(scenarioId);
    await primeAudioPlayback();
    setNowMillis(Date.now());
    playedEventIdsRef.current = new Set();
    setActiveScenarioId(scenarioId);
  };

  const closeDeleteDialog = () => {
    if (isDeletingScenario) {
      return;
    }

    setPendingDeleteScenario(null);
    setDeleteConfirmationText('');
  };

  const requestDeleteScenario = (scenarioId: string, title: string) => {
    setPendingDeleteScenario({ id: scenarioId, title });
    setDeleteConfirmationText('');
  };

  const confirmDeleteScenario = async () => {
    if (!pendingDeleteScenario || deleteConfirmationText.trim().toLowerCase() !== 'delete') {
      return;
    }

    setIsDeletingScenario(true);

    try {
      await onDeleteScenario(pendingDeleteScenario.id);
      setPendingDeleteScenario(null);
      setDeleteConfirmationText('');
    } finally {
      setIsDeletingScenario(false);
    }
  };

  if (!activeScenarioId) {
    return (
      <section className="run-browser-layout">
        <section className="glass-panel run-browser-panel">
          <div className="run-browser-tabs" role="tablist" aria-label="Run tools tabs">
            <button
              type="button"
              role="tab"
              aria-selected={browserTab === 'scenarios'}
              className={browserTab === 'scenarios' ? 'run-browser-tabs__button is-active' : 'run-browser-tabs__button'}
              onClick={() => setBrowserTab('scenarios')}
            >
              Run browser
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={browserTab === 'audio'}
              className={browserTab === 'audio' ? 'run-browser-tabs__button is-active' : 'run-browser-tabs__button'}
              onClick={() => setBrowserTab('audio')}
            >
              Audio library
            </button>
          </div>

          {browserTab === 'audio' ? (
            <AudioLibraryView audioAssets={audioAssets} onUploadAudio={onUploadAudio} />
          ) : (
            <>
              <div className="section-header run-browser-header">
                <div>
                  <p className="eyebrow">Run browser</p>
                  <h2>Select a scenario to launch immediately</h2>
                </div>
                <div className="run-browser-meta">
                  <span>{scenarios.length} scenarios available</span>
                </div>
              </div>

              <div className="run-browser-toolbar">
                <label className="field run-search-field">
                  <span>Search scenarios</span>
                  <input
                    type="search"
                    value={searchQuery}
                    placeholder="Search by title, description, timezone, or event text"
                    onChange={(inputEvent) => setSearchQuery(inputEvent.target.value)}
                  />
                </label>

                <div className="run-sort-controls">
                  <label className="field run-sort-field">
                    <span>Sort by</span>
                    <select
                      value={sortBy}
                      onChange={(inputEvent) => setSortBy(inputEvent.target.value as 'name' | 'date')}
                    >
                      <option value="name">Name</option>
                      <option value="date">Date updated</option>
                    </select>
                  </label>

                  <div className="field field--static run-sort-direction-field">
                    <span>Order</span>
                    <button
                      type="button"
                      className="ghost-button run-sort-direction-button"
                      aria-label={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
                      title={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
                      onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
                    >
                      {sortDirection === 'asc' ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 5 6.5 10.5h3.5V19h4v-8.5H17.5L12 5Z" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 19 17.5 13.5H14V5h-4v8.5H6.5L12 19Z" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="run-browser-actions">
                  <button type="button" className="primary-button" onClick={onCreateScenario}>
                    Create
                  </button>
                </div>
              </div>

              <div className="run-browser-grid">
                {filteredScenarios.length === 0 ? (
                  <p className="empty-state">No scenario matches the current search.</p>
                ) : (
                  filteredScenarios.map((candidate) => {
                    const nextTimelineEvent = getTimelineEvents(candidate)[0];
                    const isSelected = candidate.id === selectedScenarioId;

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        className={`run-scenario-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => void launchScenario(candidate.id)}
                      >
                        <div className="run-scenario-card__title">
                          <div>
                            <p className="eyebrow">{candidate.timezone}</p>
                            <h3>{candidate.title}</h3>
                          </div>
                        </div>
                        <p className="run-scenario-card__description">{candidate.description || 'No description provided.'}</p>
                        <div className="run-scenario-card__meta">
                          <span>{candidate.events.length} events</span>
                          <span>{nextTimelineEvent ? formatEventTime(nextTimelineEvent.scheduledAtUtc, candidate.timezone) : 'No events'}</span>
                        </div>
                        <div className="run-scenario-card__controls">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              requestDeleteScenario(candidate.id, candidate.title);
                            }}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenScenarioSettings(candidate.id);
                            }}
                          >
                            Setting
                          </button>
                          <button
                            type="button"
                            className="primary-button run-scenario-card__action-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void launchScenario(candidate.id);
                            }}
                          >
                            Launch
                          </button>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>

        {pendingDeleteScenario ? (
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
              aria-labelledby="run-delete-dialog-title"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <p className="eyebrow">Delete scenario</p>
              <h3 id="run-delete-dialog-title">Type `delete` to confirm</h3>
              <p className="run-delete-dialog__body">
                This will permanently delete <strong>{pendingDeleteScenario.title}</strong>.
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

  if (!scenario) {
    return (
      <section className="glass-panel run-panel run-panel--empty">
        <p className="eyebrow">Run mode</p>
        <h2>Create and save a scenario first</h2>
        <p className="empty-state">The runner highlights the active event and triggers audio on time.</p>
      </section>
    );
  }

  const now = DateTime.fromMillis(nowMillis, { zone: scenario.timezone });
  const boardDate = now.toFormat('cccc, dd/LL/yyyy');
  const featuredEvent = currentEvent ?? nextEvent;

  return (
    <section className="run-live-board-layout">
      <button type="button" className="ghost-button run-live-board__back" onClick={() => setActiveScenarioId(null)}>
        Back
      </button>

      <header className="run-live-board__hero">
        {/* <span className="eyebrow">Run scenario</span> */}
        <h1>{scenario.title}</h1>
        {scenario.description ? <p>{scenario.description}</p> : null}
      </header>

      <section className="glass-panel run-live-board__clock-panel">
        <span className="eyebrow">Current time</span>
        <strong>{formatClock(nowMillis, scenario.timezone)}</strong>
        <p>{boardDate}</p>
        <small>{scenario.timezone}</small>

        <section className="run-live-board__current-panel">
          <span className="eyebrow">Current event</span>
          <h3>{featuredEvent?.title ?? 'Waiting for the first event'}</h3>
          <p>
            {featuredEvent?.description || scenario.description || 'The scenario is armed and waiting for the next scheduled cue.'}
          </p>
        </section>

        {/* <div className="run-live-board__timeline-footer">
          <span>
            {currentEvent
              ? `Current: ${currentEvent.title}`
              : nextEvent
                ? `Waiting for: ${nextEvent.title}`
                : 'Scenario complete'}
          </span>
        </div> */}
      </section>

      <section className="glass-panel run-live-board__timeline-panel">
        <div className="run-live-board__timeline-header">
          <span className="eyebrow">Timeline</span>
          <strong>{timeline.length} events</strong>
        </div>

        <div className="run-live-board__timeline-list">
          {timeline.map((event) => {
            const isCurrent = currentEvent?.id === event.id;

            return (
              <article
                key={event.id}
                ref={(element) => {
                  eventRefs.current[event.id] = element;
                }}
                className={isCurrent ? 'run-live-board__event is-current' : 'run-live-board__event'}
              >
                <div className="run-live-board__event-rail" aria-hidden="true">
                  <span className="run-live-board__event-dot" />
                </div>
                <div className="run-live-board__event-time">
                  {DateTime.fromISO(event.scheduledAtUtc, { zone: 'utc' }).setZone(scenario.timezone).toFormat('HH:mm')}
                </div>
                <div className="run-live-board__event-content">
                  <h2>{event.title}</h2>
                  <p>{event.description || 'No description provided.'}</p>
                </div>
              </article>
            );
          })}
        </div>

        {/* <div className="run-live-board__timeline-footer">
          <span>
            {currentEvent
              ? `Current: ${currentEvent.title}`
              : nextEvent
                ? `Waiting for: ${nextEvent.title}`
                : 'Scenario complete'}
          </span>
        </div> */}
      </section>
    </section>
  );
}