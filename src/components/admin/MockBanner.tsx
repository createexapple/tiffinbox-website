'use client';

import { SCENARIO_LABEL, type MockScenario } from '@/admin/mock/seed';
import { useAdmin } from './AdminProvider';

const SCENARIOS = Object.keys(SCENARIO_LABEL) as MockScenario[];

/**
 * STAGE 2 ONLY. Honest label on every admin screen: the data is synthetic and nothing is saved.
 * The "Mock controls" let a reviewer reach states that are otherwise hard to reach (empty data, failures).
 * Removed when the Supabase repository replaces the mock (Stage 3).
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
          Sample records are fake. Changes last only until you reload this page. Sign-in is a mock
          too: nothing is checked or stored. Sample date: Sun 22 Nov 2026.
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
