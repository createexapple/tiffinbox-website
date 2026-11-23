'use client';

import { SCENARIO_LABEL, type MockScenario } from '@/admin/mock/seed';
import { useAdmin } from './AdminProvider';

const SCENARIOS = Object.keys(SCENARIO_LABEL) as MockScenario[];

/**
 * TEST MODE ONLY (explicit test flag, never in a deployed environment). Honest label on every admin screen: the data
 * is synthetic and nothing is saved. The "Mock controls" let a test reach states that are otherwise hard to reach
 * (empty data, failures). Not rendered when the real backend is in use.
 */
export function AdminMockBanner() {
  const { controls, version } = useAdmin();
  const flags = controls?.getFlags();
  const scenario = controls?.getScenario();
  // `version` makes this re-render after the controls change.
  void version;

  return (
    <div className="adm-mock" role="note" data-testid="mock-banner">
      <div className="adm-mock-row">
        <strong>Mock data: nothing is saved.</strong>
        <span>
          Test mode: sample records are fake and changes last only until you reload this page. No
          real backend is connected and no login is checked. Sample date: Sun 22 Nov 2026.
        </span>
      </div>
      {controls && flags && scenario ? (
        <details>
          <summary>Mock controls (reviewers)</summary>
          <div className="mock-controls">
            <h2>Data set</h2>
            {SCENARIOS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-secondary btn-sm"
                aria-pressed={scenario === s}
                onClick={() => controls.reset(s)}
              >
                {scenario === s ? 'Current: ' : 'Load: '}
                {SCENARIO_LABEL[s]}
              </button>
            ))}
            <h2>Simulate problems</h2>
            <label className="choice">
              <input
                type="checkbox"
                checked={flags.slowLoads}
                onChange={(e) => controls.setFlag('slowLoads', e.target.checked)}
              />
              <span>Slow loading (shows the loading state)</span>
            </label>
            <label className="choice">
              <input
                type="checkbox"
                checked={flags.failLoads}
                onChange={(e) => controls.setFlag('failLoads', e.target.checked)}
              />
              <span>Data cannot be loaded (shows the error state with Try again)</span>
            </label>
            <label className="choice">
              <input
                type="checkbox"
                checked={flags.failNextPublish}
                onChange={(e) => controls.setFlag('failNextPublish', e.target.checked)}
              />
              <span>Next publish fails (shows the publish failure state)</span>
            </label>
          </div>
        </details>
      ) : null}
    </div>
  );
}
