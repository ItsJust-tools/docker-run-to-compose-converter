export interface HistoryEntry {
  /** Short human readable description of the conversion. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ToolState {
  /** Docker run command text. */
  command: string;
  /** Last parse/conversion error message, or null when valid. */
  error: string | null;
  /** Saved conversion history, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  command: 'docker run -d --name web -p 8080:80 -v site:/usr/share/nginx/html nginx:latest',
  error: null,
  history: [],
};

export const MAX_HISTORY = 20;

export interface RunConfig {
  /** Container image including tag. */
  image: string;
  /** Service/container name from --name, or derived from the image. */
  name: string;
  /** Container name (--name) or null when not given. */
  containerName: string | null;
  /** Port mappings "host:container". */
  ports: string[];
  /** Volume mounts "source:target". */
  volumes: string[];
  /** Environment variables as KEY=VALUE entries. */
  environment: string[];
  /** env-file references. */
  envFiles: string[];
  /** Restart policy (no, always, unless-stopped, on-failure). */
  restart: string | null;
  /** Network name. */
  network: string | null;
  /** Pull policy. */
  pull: string | null;
  /** detached flag (-d). */
  detached: boolean;
  /** interactive flag (-i). */
  interactive: boolean;
  /** tty flag (-t). */
  tty: boolean;
  /** remove on exit (--rm). */
  remove: boolean;
  /** Extra positional command args after the image. */
  commandArgs: string[];
}

export interface ParseResult {
  success: boolean;
  /** Parsed configuration when success is true. */
  config?: RunConfig;
  /** Error message when success is false. */
  error?: string;
}

const KNOWN_FLAGS = new Set([
  'd',
  'detach',
  'i',
  'interactive',
  't',
  'tty',
  'rm',
  'name',
  'p',
  'publish',
  'v',
  'volume',
  'e',
  'env',
  'env-file',
  'restart',
  'network',
  'pull',
]);

const VALUE_FLAGS = new Set([
  'name',
  'p',
  'publish',
  'v',
  'volume',
  'e',
  'env',
  'env-file',
  'restart',
  'network',
  'pull',
]);

/** Split a command string on whitespace, respecting single and double quotes. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens;
}

/** Human-readable error for a command, or null when the command parses. */
export function commandError(input: string): string | null {
  return convertCommand(input).error;
}

/** Sanitize an image reference into a valid compose service name. */
export function serviceFromImage(image: string): string {
  const base = image.split(':')[0] ?? image;
  const path = base.includes('/') ? base.slice(base.lastIndexOf('/') + 1) : base;
  return path.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase() || 'service';
}

/** Derive a RunConfig from a docker run command, or an error. */
export function parseDockerRun(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: false, error: 'Enter a docker run command to convert.' };
  }
  const tokens = tokenize(trimmed);
  // Strip a leading "docker run" prefix.
  let start = 0;
  if (tokens[0] === 'docker') {
    if (tokens[1] !== 'run') {
      return { success: false, error: `Expected "docker run", found "docker ${tokens[1] ?? ''}".` };
    }
    start = 2;
  } else if (tokens[0] !== 'run') {
    return { success: false, error: 'Command must start with "docker run".' };
  } else {
    start = 1;
  }

  const config: RunConfig = {
    image: '',
    name: '',
    containerName: null,
    ports: [],
    volumes: [],
    environment: [],
    envFiles: [],
    restart: null,
    network: null,
    pull: null,
    detached: false,
    interactive: false,
    tty: false,
    remove: false,
    commandArgs: [],
  };

  let i = start;
  let imageSeen = false;
  while (i < tokens.length) {
    const token = tokens[i] ?? '';
    if (!token.startsWith('-')) {
      if (!imageSeen) {
        config.image = token;
        imageSeen = true;
      } else {
        config.commandArgs = tokens.slice(i);
        break;
      }
      i += 1;
      continue;
    }
    // Split combined short flags like "-dit".
    let name = token;
    if (token.startsWith('--')) {
      name = token.slice(2);
    } else {
      name = token.slice(1);
      if (name.length > 1 && !name.includes('=') && !VALUE_FLAGS.has(name)) {
        for (const ch of name) {
          applyFlag(ch, null, config);
        }
        i += 1;
        continue;
      }
    }
    let value: string | null = null;
    if (name.includes('=')) {
      const eq = name.indexOf('=');
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    } else if (VALUE_FLAGS.has(name)) {
      const next = tokens[i + 1];
      if (next === undefined) {
        return { success: false, error: `Missing value for "--${name}".` };
      }
      value = next;
      i += 1;
    }
    if (!KNOWN_FLAGS.has(name)) {
      return { success: false, error: `Unsupported flag "--${name}" cannot be converted.` };
    }
    applyFlag(name, value, config);
    i += 1;
  }

  if (!imageSeen || !config.image) {
    return { success: false, error: 'No container image found in the command.' };
  }
  config.name = config.containerName ?? serviceFromImage(config.image);
  config.restart = normalizeRestart(config.restart);
  return { success: true, config };
}

/** Normalize the restart policy value; null stays null. */
export function normalizeRestart(restart: string | null): string | null {
  if (restart === null) return null;
  const value = restart.trim();
  if (!value || value === 'no' || value === 'false') return null;
  return value;
}

/** Apply one known flag to the config; value may be null for boolean flags. */
export function applyFlag(name: string, value: string | null, config: RunConfig): void {
  switch (name) {
    case 'd':
    case 'detach':
      config.detached = true;
      break;
    case 'i':
    case 'interactive':
      config.interactive = true;
      break;
    case 't':
    case 'tty':
      config.tty = true;
      break;
    case 'rm':
      config.remove = true;
      break;
    case 'name':
      config.containerName = value;
      break;
    case 'p':
    case 'publish':
      if (value) config.ports.push(value);
      break;
    case 'v':
    case 'volume':
      if (value) config.volumes.push(value);
      break;
    case 'e':
    case 'env':
      if (value) config.environment.push(value);
      break;
    case 'env-file':
      if (value) config.envFiles.push(value);
      break;
    case 'restart':
      config.restart = value;
      break;
    case 'network':
      config.network = value;
      break;
    case 'pull':
      config.pull = value;
      break;
  }
}

/** Quote a YAML string only when it contains characters that require quoting. */
export function yamlQuote(value: string): string {
  if (
    /^[A-Za-z0-9_./:@+-]+$/.test(value) &&
    !/^[-?:,\[\]{}#&*!|>'"%@`]/.test(value) &&
    value.trim() !== ''
  ) {
    return value;
  }
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** Build docker-compose.yml content (service block) from a parsed config. */
export function buildCompose(config: RunConfig): string {
  const lines: string[] = ['services:'];
  lines.push(`  ${config.name}:`);
  lines.push(`    image: ${yamlQuote(config.image)}`);
  if (config.containerName) {
    lines.push(`    container_name: ${yamlQuote(config.containerName)}`);
  }
  if (config.ports.length > 0) {
    lines.push('    ports:');
    for (const port of config.ports) {
      lines.push(`      - ${yamlQuote(port)}`);
    }
  }
  if (config.volumes.length > 0) {
    lines.push('    volumes:');
    for (const volume of config.volumes) {
      lines.push(`      - ${yamlQuote(volume)}`);
    }
  }
  if (config.environment.length > 0) {
    lines.push('    environment:');
    for (const entry of config.environment) {
      const eq = entry.indexOf('=');
      const key = eq >= 0 ? entry.slice(0, eq) : entry;
      const value = eq >= 0 ? entry.slice(eq + 1) : '';
      lines.push(`      ${key}: ${yamlQuote(value)}`);
    }
  }
  if (config.envFiles.length > 0) {
    lines.push('    env_file:');
    for (const file of config.envFiles) {
      lines.push(`      - ${yamlQuote(file)}`);
    }
  }
  if (config.restart) {
    lines.push(`    restart: ${yamlQuote(config.restart)}`);
  }
  if (config.network) {
    lines.push('    networks:');
    lines.push(`      - ${yamlQuote(config.network)}`);
    lines.push('networks:');
    lines.push(`  ${config.network}:`);
    lines.push('    external: true');
  }
  if (config.pull && config.pull !== 'missing') {
    lines.push(`    pull_policy: ${yamlQuote(config.pull)}`);
  }
  if (config.interactive) {
    lines.push('    stdin_open: true');
  }
  if (config.tty) {
    lines.push('    tty: true');
  }
  if (config.remove) {
    lines.push('    auto_remove: true');
  }
  if (config.commandArgs.length > 0) {
    lines.push(`    command: ${yamlQuote(config.commandArgs.join(' '))}`);
  }
  return lines.join('\n');
}

/** Parse and convert; throws nothing. Returns yaml or error message. */
export function convertCommand(input: string): { yaml: string | null; error: string | null } {
  const parsed = parseDockerRun(input);
  if (!parsed.success || !parsed.config) {
    return { yaml: null, error: parsed.error ?? 'Failed to parse the command.' };
  }
  return { yaml: buildCompose(parsed.config), error: null };
}

/** Human-readable result for the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  if (!state.command.trim()) return 'Docker Run to Compose: paste a docker run command';
  const converted = convertCommand(state.command);
  if (converted.error) return `Docker Run to Compose: ${converted.error}`;
  const parsed = parseDockerRun(state.command);
  const name = parsed.success && parsed.config ? parsed.config.name : 'service';
  return `Docker Run to Compose: service ${name}`;
}

/** Build a history entry text for the current state. */
export function historyText(state: ToolState): string {
  return summaryText(state);
}

export function isState(value: unknown): value is ToolState {
  if (typeof value === 'object' || value === null) {
    return typeof (value as Partial<ToolState>)?.command === 'string';
  }
  return false;
}

/** Sample commands offered as presets. */
export const PRESETS: { label: string; command: string }[] = [
  {
    label: 'nginx',
    command: 'docker run -d --name web -p 8080:80 -v site:/usr/share/nginx/html nginx:latest',
  },
  {
    label: 'postgres',
    command:
      'docker run -d --name db -p 5432:5432 -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=app -v pgdata:/var/lib/postgresql/data --restart unless-stopped postgres:16',
  },
  {
    label: 'redis',
    command: 'docker run -d --name cache -p 6379:6379 --network backend redis:7-alpine',
  },
];
