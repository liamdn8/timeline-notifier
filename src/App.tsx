import { useCallback, useEffect, useState } from 'react';
import './styles.css';
import { BuilderView } from './components/BuilderView';
import { RunView2 } from './components/RunView2';
import {
  deleteAudioAsset,
  deleteScenario,
  listAudioAssets,
  listScenarios,
  saveScenario,
  updateAudioAssetDuration,
  uploadAudioAsset,
} from './lib/db';
import type { AudioAsset, Scenario } from './types';

type WorkspaceView = 'run' | 'builder';
type EditorRequest = {
  mode: 'new' | 'edit' | 'clone';
  scenarioId: string | null;
  nonce: number;
};

export default function App() {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('run');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [editorRequest, setEditorRequest] = useState<EditorRequest | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string>('');
  const [isLiveRunActive, setIsLiveRunActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));

  const refreshData = useCallback(async () => {
    const [nextScenarios, nextAudioAssets] = await Promise.all([listScenarios(), listAudioAssets()]);
    setScenarios(nextScenarios);
    setAudioAssets(nextAudioAssets);
    setApiError('');

    setSelectedScenarioId((currentId) => currentId ?? nextScenarios[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refreshData();
      } catch (error) {
        setApiError(error instanceof Error ? error.message : 'Unable to reach the backend API.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshData]);

  useEffect(() => {
    if (workspaceView !== 'run' || !isLiveRunActive || apiError) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void refreshData().catch((error) => {
        setApiError(error instanceof Error ? error.message : 'Unable to reach the backend API.');
      });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [apiError, isLiveRunActive, refreshData, workspaceView]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to change fullscreen mode.');
    }
  }, []);

  const supportsFullscreen = typeof document.documentElement.requestFullscreen === 'function';

  const handleSaveScenario = async (scenario: Scenario) => {
    try {
      await saveScenario(scenario);
      await refreshData();
      setWorkspaceView('run');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to save scenario.');
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    try {
      await deleteScenario(scenarioId);
      await refreshData();
      setSelectedScenarioId((currentId) => (currentId === scenarioId ? null : currentId));
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to delete scenario.');
    }
  };

  const handleUploadAudio = async (file: File) => {
    try {
      await uploadAudioAsset(file);
      await refreshData();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to upload audio.');
    }
  };

  const handleDeleteAudio = async (audioAssetId: string) => {
    try {
      await deleteAudioAsset(audioAssetId);
      await refreshData();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to delete audio.');
    }
  };

  const handleUpdateAudioDuration = async (audioAssetId: string, durationSeconds: number) => {
    try {
      await updateAudioAssetDuration(audioAssetId, durationSeconds);
      setAudioAssets((currentAssets) =>
        currentAssets.map((asset) => (asset.id === audioAssetId ? { ...asset, durationSeconds } : asset)),
      );
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unable to update audio duration.');
    }
  };

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand-lockup">
          <p className="eyebrow">Timeline Voice Notifier</p>
        </div>

        {supportsFullscreen ? (
          <button type="button" className="ghost-button fullscreen-toggle" onClick={handleToggleFullscreen}>
            {isFullscreen ? 'Exit full screen' : 'Open full screen'}
          </button>
        ) : null}
      </div>

      {apiError ? (
        <section className="glass-panel loading-panel">
          <p>Backend connection issue: {apiError}</p>
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setIsLoading(true);
                void (async () => {
                  try {
                    await refreshData();
                  } catch (error) {
                    setApiError(error instanceof Error ? error.message : 'Unable to reach the backend API.');
                  } finally {
                    setIsLoading(false);
                  }
                })();
              }}
            >
              Retry connection
            </button>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <section className="glass-panel loading-panel">
          <p>Loading server data...</p>
        </section>
      ) : workspaceView === 'run' ? (
        <RunView2
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          audioAssets={audioAssets}
          onLiveRunStateChange={setIsLiveRunActive}
          onSelectScenario={setSelectedScenarioId}
          onOpenScenarioSettings={(scenarioId) => {
            setSelectedScenarioId(scenarioId);
            setEditorRequest({ mode: 'edit', scenarioId, nonce: Date.now() });
            setWorkspaceView('builder');
          }}
          onCreateScenario={() => {
            setSelectedScenarioId(null);
            setEditorRequest({ mode: 'new', scenarioId: null, nonce: Date.now() });
            setWorkspaceView('builder');
          }}
          onCloneScenario={(scenarioId) => {
            setSelectedScenarioId(scenarioId);
            setEditorRequest({ mode: 'clone', scenarioId, nonce: Date.now() });
            setWorkspaceView('builder');
          }}
          onDeleteScenario={handleDeleteScenario}
          onUploadAudio={handleUploadAudio}
          onDeleteAudio={handleDeleteAudio}
          onUpdateAudioDuration={handleUpdateAudioDuration}
        />
      ) : (
        <section className="builder-workspace">
          <div className="builder-workspace__toolbar">
            <button type="button" className="ghost-button" onClick={() => setWorkspaceView('run')}>
              Back to run browser
            </button>
          </div>
        <BuilderView
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          audioAssets={audioAssets}
          onUpdateAudioDuration={handleUpdateAudioDuration}
          onSelectScenario={setSelectedScenarioId}
          onSaveScenario={handleSaveScenario}
          onDeleteScenario={async (scenarioId) => {
            await handleDeleteScenario(scenarioId);
            setWorkspaceView('run');
          }}
          editorRequest={editorRequest}
        />
        </section>
      )}
    </div>
  );
}
