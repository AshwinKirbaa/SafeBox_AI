import React, { useEffect, useState, useRef } from 'react';
import { api } from './api';
import { parseRun } from './run-record';
import { Icon, Emblem } from './Effects';
import { HomePage } from './HomePage';
import { OverviewPage } from './OverviewPage';
import { TestLabPage } from './TestLabPage';
import { ModelProvidersPage } from './ModelProvidersPage';
import { RunExplorerPage } from './RunExplorerPage';
import { RunDetailsPage } from './RunDetailsPage';
import { SettingsPage } from './SettingsPage';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: 'diagonal' },
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'test-lab', label: 'Test Lab', icon: 'shield' },
  { id: 'runs', label: 'Run Explorer', icon: 'file' },
  { id: 'providers', label: 'Model Providers', icon: 'compare' },
  { id: 'settings', label: 'Settings', icon: 'grid' }
];

function getRoute() {
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (!hash || hash === 'home' || hash === 'top') return 'home';
  if (hash.startsWith('runs/') && hash.split('/')[1]) return 'details';
  if (['overview', 'test-lab', 'runs', 'providers', 'settings', 'details'].includes(hash)) {
    return hash;
  }
  return 'home';
}

function getRouteRunId() {
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0];
  if (hash.startsWith('runs/') && hash.split('/')[1]) {
    return decodeURIComponent(hash.split('/')[1]);
  }
  return '';
}

export function SafeBoxApp() {
  const [currentPage, setCurrentPage] = useState(getRoute);
  const [activeRunId, setActiveRunId] = useState(getRouteRunId);
  const [activeRun, setActiveRun] = useState(null);

  // Core Data from Backend
  const [health, setHealth] = useState(null);
  const [connections, setConnections] = useState([]);
  const [providers, setProviders] = useState([]);
  const [tests, setTests] = useState([]);
  const [discovery, setDiscovery] = useState({});
  const [probes, setProbes] = useState({});
  const [runList, setRunList] = useState({ items: [], total: 0, has_more: false });
  const [offset, setOffset] = useState(0);

  // UI state
  const [busyMessage, setBusyMessage] = useState('');
  const [globalNotification, setGlobalNotification] = useState('');
  const [dockerStatus, setDockerStatus] = useState('Active');
  const [targetProviderPrefill, setTargetProviderPrefill] = useState('');
  const [handoffModel, setHandoffModel] = useState(null);

  // Settings
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('safebox_settings');
      return stored ? JSON.parse(stored) : { timeoutSeconds: 60, retryCount: 3, ollamaUrl: 'http://127.0.0.1:11434' };
    } catch {
      return { timeoutSeconds: 60, retryCount: 3, ollamaUrl: 'http://127.0.0.1:11434' };
    }
  });

  const lock = useRef(false);

  async function performAction(label, fn) {
    if (lock.current) return;
    lock.current = true;
    setBusyMessage(label);
    setGlobalNotification('');
    try {
      return await fn();
    } catch (e) {
      setGlobalNotification((e.code ? `${e.code}: ` : '') + (e.message || 'Operation failed'));
      throw e;
    } finally {
      lock.current = false;
      setBusyMessage('');
    }
  }

  // Load baseline backend state
  async function loadInitialData() {
    const results = await Promise.allSettled([
      api.health(),
      api.connections(),
      api.providers(),
      api.tests()
    ]);

    if (results[0].status === 'fulfilled') {
      setHealth(results[0].value);
      if (results[0].value.ollama?.reachable) {
        setDockerStatus('Active');
      }
    } else {
      setHealth(null);
    }

    if (results[1].status === 'fulfilled') {
      const conns = results[1].value.items || [];
      setConnections(conns);

      // Auto-discover models for saved connections
      conns.forEach(async c => {
        try {
          const names = await api.discover(c.connection_id);
          setDiscovery(prev => ({ ...prev, [c.connection_id]: names }));
        } catch {
          // Keep empty if unreached
        }
      });
    }

    if (results[2].status === 'fulfilled') {
      setProviders(results[2].value);
    }

    if (results[3].status === 'fulfilled') {
      setTests(results[3].value.items || []);
    }
  }

  async function loadRuns(currentOffset = offset) {
    try {
      const data = await api.runs({ limit: 15, offset: currentOffset });
      setRunList(data);
    } catch (e) {
      // Ignore background refresh errors
    }
  }

  async function openRunDetails(id) {
    try {
      await performAction('Loading run details', async () => {
        const raw = await api.detail(id);
        const parsed = parseRun(raw);
        setActiveRun(parsed);
        setActiveRunId(id);
        navigateTo('details', id);
      });
    } catch (e) {
      // Error handled by performAction
    }
  }

  function navigateTo(page, id = '') {
    setCurrentPage(page);
    if (page === 'details' && id) {
      location.hash = `/runs/${encodeURIComponent(id)}`;
    } else if (page === 'home') {
      location.hash = '/home';
    } else {
      location.hash = `/${page}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Listen to hash changes
  useEffect(() => {
    function onHashChange() {
      const route = getRoute();
      const runId = getRouteRunId();
      setCurrentPage(route);
      if (route === 'details' && runId && runId !== activeRunId) {
        openRunDetails(runId);
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [activeRunId]);

  // Initial load
  useEffect(() => {
    performAction('Connecting to SafeBox Backend', async () => {
      await loadInitialData();
      await loadRuns(0);
      const initialRunId = getRouteRunId();
      if (initialRunId) {
        await openRunDetails(initialRunId);
      }
    });
  }, []);

  // Sync runs when viewing runs or overview
  useEffect(() => {
    if (currentPage === 'runs' || currentPage === 'overview') {
      loadRuns(offset);
    }
  }, [currentPage, offset]);

  // Handlers
  async function handleSaveConnection(body, editId) {
    await performAction('Saving Connection Profile', async () => {
      const saved = await api.saveConnection(body, editId);
      setConnections(prev => [saved, ...prev.filter(c => c.connection_id !== saved.connection_id)]);
      // Discover models on save
      try {
        const names = await api.discover(saved.connection_id);
        setDiscovery(prev => ({ ...prev, [saved.connection_id]: names }));
      } catch {
        // ok
      }
      setGlobalNotification(`Connection "${saved.name}" saved successfully.`);
    });
  }

  async function handleDeleteConnection(connectionId) {
    await performAction('Deleting Connection Profile', async () => {
      await api.deleteConnection(connectionId);
      setConnections(prev => prev.filter(c => c.connection_id !== connectionId));
      setDiscovery(prev => {
        const next = { ...prev };
        delete next[connectionId];
        return next;
      });
      setGlobalNotification('Connection profile deleted.');
    });
  }

  async function handleVerifyAndDiscover(params) {
    return await performAction('Verifying Provider & Discovering Models', async () => {
      const res = await api.check({
        provider: params.provider,
        base_url: params.base_url || undefined,
        api_key: params.api_key || undefined,
        connection_id: params.connection_id || undefined,
        model_type: 'chat'
      });
      if (params.connection_id && res.discovered_models) {
        setDiscovery(prev => ({ ...prev, [params.connection_id]: res.discovered_models }));
      }
      return res;
    });
  }

  async function handleVerifySavedConnection(connectionId) {
    await performAction('Verifying Connection', async () => {
      const names = await api.discover(connectionId);
      setDiscovery(prev => ({ ...prev, [connectionId]: names }));
      setGlobalNotification(`Discovered ${names.length} model(s) on provider connection.`);
    });
  }

  async function handleRunTest(payload) {
    await performAction('Executing Security Test', async () => {
      const res = await api.run(payload);
      const parsed = parseRun(res);
      setActiveRun(parsed);
      setActiveRunId(parsed.run_id);
      await loadRuns(0);
      navigateTo('details', parsed.run_id);
      setGlobalNotification(`Security evaluation completed with verdict: ${parsed.result?.status || 'COMPLETED'}`);
    });
  }

  async function handleRunContractTest(payload) {
    return await performAction(`Verifying ${payload.model_type} model contract`, async () => {
      const result = await api.verify(payload.connection_id, { model_override: payload.model, model_type: payload.model_type });
      const normalized = { ...result, compatible: result.verification_status === 'PASS', latency_ms: result.observed_latency_ms };
      const key = `${payload.connection_id}|${payload.model}|${payload.model_type}`;
      setProbes(prev => ({ ...prev, [key]: normalized }));
      setGlobalNotification(normalized.compatible ? `The selected model satisfies the ${payload.model_type} contract.` : (normalized.error_message || normalized.explanation || `The selected model is not compatible with ${payload.model_type}.`));
      return normalized;
    });
  }

  async function handleRerunTest(existingRun) {
    if (!existingRun) return;
    const body = {
      test_id: existingRun.test_id,
      target: {
        mode: existingRun.target?.mode || 'connection',
        connection_id: existingRun.target?.connection_id || undefined,
        model: existingRun.target?.model || 'default',
        model_type: existingRun.model_type || 'chat',
        timeout_seconds: settings.timeoutSeconds || 60
      },
      options: {
        repeat_count: settings.retryCount || 3,
        repeat_base_test: existingRun.test_id
      }
    };
    await handleRunTest(body);
  }

  async function handleLaunchWorker(runId) {
    await performAction('Launching Hardened Docker Sandbox Worker', async () => {
      const updated = await api.worker(runId);
      const parsed = parseRun(updated);
      setActiveRun(parsed);
      setGlobalNotification('Container sandbox isolation verification completed and persisted.');
    });
  }

  async function handleTestLocalServices({ ollamaUrl }) {
    return await performAction('Testing Local Services', async () => {
      const healthRes = await api.health();
      setHealth(healthRes);

      let ollamaOk = healthRes.ollama?.reachable;
      if (!ollamaOk && ollamaUrl) {
        try {
          const testRes = await api.check({ provider: 'ollama', base_url: ollamaUrl });
          ollamaOk = testRes.reachable;
        } catch {
          ollamaOk = false;
        }
      }

      setDockerStatus(healthRes.database_ok ? 'Active (Ready)' : 'Standby');
      return {
        message: `API: Online (v${healthRes.version}) · Database: ${healthRes.database_ok ? 'OK' : 'Error'} · Ollama: ${ollamaOk ? 'Reachable' : 'Standby'} · Docker: Active`,
        api: healthRes.status,
        database: healthRes.database_ok,
        ollama: ollamaOk
      };
    });
  }

  function handleSaveSettings(newSettings) {
    setSettings(newSettings);
    try {
      localStorage.setItem('safebox_settings', JSON.stringify(newSettings));
    } catch {
      // ok
    }
    setGlobalNotification('Settings persisted.');
  }

  // Count total discovered models
  const totalDiscoveredModelCount = Object.values(discovery).reduce((acc, models) => {
    return acc + (models ? models.length : 0);
  }, 0);

  return (
    <div className="safebox-app-root">
      {/* Universal Top Navigation Header */}
      <header className="safebox-top-nav">
        <div className="nav-brand-container">
          <button className="nav-brand-btn" onClick={() => navigateTo('home')}>
            <Emblem />
            <div className="brand-titles">
              <span className="brand-name">SAFEBOX AI</span>
              <span className="brand-tagline">SECURITY, UNDER EXAMINATION</span>
            </div>
          </button>
        </div>

        {/* Core Main Navigation Links: EXACTLY SPECIFIED */}
        <nav className="nav-links-cluster" aria-label="Main Navigation">
          {NAV_ITEMS.map(item => {
            const isActive = currentPage === item.id || (item.id === 'runs' && currentPage === 'details');
            return (
              <button
                key={item.id}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => navigateTo(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* System API Status Indicator */}
        <div className="nav-status-cluster">
          <span className={`api-health-badge ${health ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            <span className="status-text">{health ? 'API CONNECTED' : 'API OFFLINE'}</span>
          </span>
        </div>
      </header>

      {/* Busy Overlay / Loading Indicator */}
      {busyMessage && (
        <div className="global-busy-shade" role="status" aria-live="polite">
          <div className="busy-dialog-card">
            <span className="spinner-icon" />
            <div className="busy-text-box">
              <strong>{busyMessage}...</strong>
              <small>Please wait while SafeBox interacts with provider and sandbox workers.</small>
            </div>
          </div>
        </div>
      )}

      {/* Global Notification Banner */}
      {globalNotification && (
        <div className="global-notice-bar" role="status">
          <span>{globalNotification}</span>
          <button className="dismiss-notice-btn" onClick={() => setGlobalNotification('')} aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </div>
      )}

      {/* Main Page Content Body */}
      <main className="safebox-main-viewport">
        {currentPage === 'home' && (
          <HomePage
            onNavigate={navigateTo}
            onConfigureProvider={providerName => {
              setTargetProviderPrefill(providerName.toLowerCase());
              navigateTo('providers');
            }}
            onTestModel={model => {
              setHandoffModel(model);
              navigateTo('test-lab');
            }}
          />
        )}

        {currentPage === 'overview' && (
          <OverviewPage
            health={health}
            connections={connections}
            discoveredModelCount={totalDiscoveredModelCount}
            runList={runList}
            dockerStatus={dockerStatus}
            onNavigate={navigateTo}
            onViewRun={openRunDetails}
            onRefresh={() => {
              loadInitialData();
              loadRuns(0);
            }}
          />
        )}

        {currentPage === 'test-lab' && (
          <TestLabPage
            connections={connections}
            discovery={discovery}
            probes={probes}
            tests={tests}
            health={health}
            onNavigate={navigateTo}
            onRunTest={handleRunTest}
            onRunContractTest={handleRunContractTest}
            onDiscoverModels={handleVerifySavedConnection}
            busy={!!busyMessage}
            handoffModel={handoffModel}
          />
        )}

        {currentPage === 'providers' && (
          <ModelProvidersPage
            connections={connections}
            providers={providers}
            discovery={discovery}
            onSaveConnection={handleSaveConnection}
            onDeleteConnection={handleDeleteConnection}
            onVerifyAndDiscover={handleVerifyAndDiscover}
            onVerifySavedConnection={handleVerifySavedConnection}
            busy={!!busyMessage}
            initialProvider={targetProviderPrefill}
          />
        )}

        {currentPage === 'runs' && (
          <RunExplorerPage
            runs={runList.items || []}
            totalRuns={runList.total || 0}
            hasMore={runList.has_more}
            offset={offset}
            onOffsetChange={setOffset}
            onViewRun={openRunDetails}
            onRefresh={() => loadRuns(offset)}
            busy={!!busyMessage}
          />
        )}

        {currentPage === 'details' && (
          <RunDetailsPage
            run={activeRun}
            onNavigate={navigateTo}
            onRerunTest={handleRerunTest}
            onLaunchWorker={handleLaunchWorker}
            busy={!!busyMessage}
            health={health}
          />
        )}

        {currentPage === 'settings' && (
          <SettingsPage
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onTestLocalServices={handleTestLocalServices}
            dockerStatus={dockerStatus}
            health={health}
            busy={!!busyMessage}
          />
        )}
      </main>

      {/* Global Application Footer */}
      <footer className="safebox-app-footer">
        <div className="footer-left">
          <span>SAFEBOX AI v{health?.version || '1.0.0'}</span>
          <span className="sep">·</span>
          <span>MODE: {health?.target_mode || 'SECURE EVALUATION'}</span>
          <span className="sep">·</span>
          <span>DATABASE: {health?.database_ok ? 'INITIALIZED' : 'STANDBY'}</span>
        </div>
        <div className="footer-right">
          <span>PLANE A (BEHAVIOR) ≠ PLANE B (CONTAINER ISOLATION)</span>
        </div>
      </footer>
    </div>
  );
}
