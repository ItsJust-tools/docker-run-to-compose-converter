'use client';

import React from 'react';
import { PRESETS, type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="compose-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Supported flags</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <code>-d, --detach</code> — detached mode
          </li>
          <li>
            <code>--name</code> — container/service name
          </li>
          <li>
            <code>-p, --publish</code> — port mappings
          </li>
          <li>
            <code>-v, --volume</code> — volume mounts
          </li>
          <li>
            <code>-e, --env</code> — environment variables
          </li>
          <li>
            <code>--env-file</code> — env file references
          </li>
          <li>
            <code>--restart</code> — restart policy
          </li>
          <li>
            <code>--network</code> — external network
          </li>
          <li>
            <code>--pull</code> — pull policy
          </li>
          <li>
            <code>-it, --rm</code> — stdin/tty/auto-remove
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Sample commands</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {PRESETS.map((preset) => (
            <li key={preset.label}>
              <button
                type="button"
                className="font-mono underline-offset-2 hover:underline"
                onClick={() => onChange({ ...state, command: preset.command })}
              >
                {preset.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved results</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>C</kbd> — Copy generated YAML
          </li>
          <li>
            <kbd>H</kbd> — Save conversion to history
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current command; open it to
          restore the conversion.
        </p>
      </div>
    </div>
  );
};
