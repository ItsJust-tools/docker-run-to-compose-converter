'use client';

import React from 'react';
import { PRESETS, convertCommand, parseDockerRun, summaryText } from '../types';
import type { ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const command = state.command;
  const converted = convertCommand(command);
  const yaml = converted.yaml;
  const error = converted.error;
  const parsed = parseDockerRun(command);
  const config = parsed.success ? parsed.config : undefined;

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="compose-canvas">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Sample presets
        </h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              data-testid={`preset-${preset.label}`}
              onClick={() => update({ command: preset.command })}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          docker run command
        </h3>
        <textarea
          value={command}
          onChange={(e) => update({ command: e.target.value })}
          data-testid="command-input"
          rows={4}
          spellCheck={false}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          placeholder="docker run -d --name web -p 8080:80 nginx"
        />
      </div>

      {error ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
          role="alert"
          data-testid="error-message"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Parsed configuration
          </h3>
          {config ? (
            <dl
              className="space-y-1 rounded-lg border border-gray-200 bg-white p-4 text-xs dark:border-gray-800 dark:bg-gray-900"
              data-testid="parsed-config"
            >
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Service</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">{config.name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Image</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">{config.image}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Ports</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">
                  {config.ports.length ? config.ports.join(', ') : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Volumes</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">
                  {config.volumes.length ? config.volumes.join(', ') : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Environment</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">
                  {config.environment.length
                    ? config.environment.map((e) => e.split('=')[0]).join(', ')
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Restart</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">
                  {config.restart ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500 dark:text-gray-400">Network</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">
                  {config.network ?? '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="parsed-empty">
              No valid configuration yet.
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              docker-compose.yml
            </h3>
            {yaml ? (
              <button
                type="button"
                data-testid="btn-copy-yaml"
                onClick={() => void navigator.clipboard.writeText(yaml).catch(() => undefined)}
                className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
              >
                Copy YAML
              </button>
            ) : null}
          </div>
          <pre
            className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
            data-testid="yaml-output"
          >
            {yaml ?? 'services: {}'}
          </pre>
        </div>
      </div>

      {yaml ? (
        <button
          type="button"
          data-testid="btn-save-history"
          onClick={() => onSaveHistory?.(summaryText(state))}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Save to history
        </button>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          History
        </h3>
        {state.history.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            No saved conversions yet.
          </p>
        ) : (
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-300"
              >
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All conversions run locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
