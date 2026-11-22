import { describe, it, expect } from 'vitest';
import {
  tokenize,
  serviceFromImage,
  parseDockerRun,
  applyFlag,
  normalizeRestart,
  yamlQuote,
  buildCompose,
  convertCommand,
  summaryText,
} from '@/tool/types';
import { deserializeState, serializeState, withHistory, roundTrips } from '@/tool/tool-definition';
import { DEFAULT_STATE, MAX_HISTORY, type ToolState } from '@/tool/types';
import { dockerRunToComposeTool } from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('tokenize', () => {
  it('splits on whitespace and respects quotes', () => {
    expect(tokenize('docker run -d nginx')).toEqual(['docker', 'run', '-d', 'nginx']);
    expect(tokenize('docker run -e "KEY=with space" alpine')).toEqual([
      'docker',
      'run',
      '-e',
      'KEY=with space',
      'alpine',
    ]);
    expect(tokenize("docker run -e 'KEY=other space' img")).toEqual([
      'docker',
      'run',
      '-e',
      'KEY=other space',
      'img',
    ]);
  });

  it('returns an empty array for blank input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('serviceFromImage', () => {
  it('derives a service name from the image', () => {
    expect(serviceFromImage('nginx:latest')).toBe('nginx');
    expect(serviceFromImage('library/postgres:16')).toBe('postgres');
    expect(serviceFromImage('ghcr.io/example/My-App:1.0')).toBe('my-app');
  });
});

describe('parseDockerRun', () => {
  it('parses a full command', () => {
    const result = parseDockerRun(
      'docker run -d --name web -p 8080:80 -p 443:443 -v site:/usr/share/nginx/html -e NODE_ENV=production --restart unless-stopped --network backend nginx:latest'
    );
    expect(result.success).toBe(true);
    if (result.success && result.config) {
      expect(result.config.image).toBe('nginx:latest');
      expect(result.config.containerName).toBe('web');
      expect(result.config.ports).toEqual(['8080:80', '443:443']);
      expect(result.config.volumes).toEqual(['site:/usr/share/nginx/html']);
      expect(result.config.environment).toEqual(['NODE_ENV=production']);
      expect(result.config.restart).toBe('unless-stopped');
      expect(result.config.network).toBe('backend');
      expect(result.config.detached).toBe(true);
      expect(result.config.name).toBe('web');
    }
  });

  it('collects multiple -p/-v/-e flags as lists', () => {
    const result = parseDockerRun('docker run -e A=1 -e B=2 -v v1:/a -v v2:/b -p 1:1 -p 2:2 img');
    expect(result.success).toBe(true);
    if (result.success && result.config) {
      expect(result.config.environment).toEqual(['A=1', 'B=2']);
      expect(result.config.volumes).toEqual(['v1:/a', 'v2:/b']);
      expect(result.config.ports).toEqual(['1:1', '2:2']);
    }
  });

  it('supports long flags with = values and combined short boolean flags', () => {
    const result = parseDockerRun('docker run --env KEY=value --rm -it alpine');
    expect(result.success).toBe(true);
    if (result.success && result.config) {
      expect(result.config.environment).toEqual(['KEY=value']);
      expect(result.config.remove).toBe(true);
      expect(result.config.interactive).toBe(true);
      expect(result.config.tty).toBe(true);
    }
  });

  it('keeps positional args after the image as command', () => {
    const result = parseDockerRun('docker run alpine echo hello world');
    expect(result.success).toBe(true);
    if (result.success && result.config) {
      expect(result.config.image).toBe('alpine');
      expect(result.config.commandArgs).toEqual(['echo', 'hello', 'world']);
    }
  });

  it('rejects malformed input', () => {
    expect(parseDockerRun('').success).toBe(false);
    expect(parseDockerRun('   ').success).toBe(false);
    expect(parseDockerRun('docker ps').success).toBe(false);
    expect(parseDockerRun('run nginx').success).toBe(true);
    expect(parseDockerRun('docker run --unknown-flag x img').success).toBe(false);
    expect(parseDockerRun('docker run --name').success).toBe(false);
    expect(parseDockerRun('docker run').success).toBe(false);
  });

  it('accepts command without the docker prefix when it starts with run', () => {
    const result = parseDockerRun('run -d nginx');
    expect(result.success).toBe(true);
    if (result.success && result.config) {
      expect(result.config.image).toBe('nginx');
      expect(result.config.detached).toBe(true);
    }
  });
});

describe('normalizeRestart', () => {
  it('maps no/false/empty to null and keeps others', () => {
    expect(normalizeRestart(null)).toBeNull();
    expect(normalizeRestart('no')).toBeNull();
    expect(normalizeRestart('false')).toBeNull();
    expect(normalizeRestart('always')).toBe('always');
    expect(normalizeRestart('unless-stopped')).toBe('unless-stopped');
    expect(normalizeRestart('on-failure:5')).toBe('on-failure:5');
  });
});

describe('applyFlag', () => {
  it('sets boolean and value flags', () => {
    const config = {
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
    applyFlag('d', null, config);
    applyFlag('t', null, config);
    expect(config.detached).toBe(true);
    expect(config.tty).toBe(true);
  });
});

describe('yamlQuote', () => {
  it('leaves plain values unquoted and quotes special values', () => {
    expect(yamlQuote('nginx:latest')).toBe('nginx:latest');
    expect(yamlQuote('8080:80')).toBe('8080:80');
    expect(yamlQuote('hello world')).toBe('"hello world"');
    expect(yamlQuote('KEY"value')).toBe('"KEY\\"value"');
  });
});

describe('buildCompose', () => {
  it('builds a compose service from a parsed command', () => {
    const parsed = parseDockerRun(
      'docker run -d --name db -p 5432:5432 -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data --restart unless-stopped postgres:16'
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success || !parsed.config) throw new Error('expected success');
    const yaml = buildCompose(parsed.config);
    expect(yaml).toContain('services:');
    expect(yaml).toContain('  db:');
    expect(yaml).toContain('    image: postgres:16');
    expect(yaml).toContain('    container_name: db');
    expect(yaml).toContain('    ports:');
    expect(yaml).toContain('      - 5432:5432');
    expect(yaml).toContain('    volumes:');
    expect(yaml).toContain('      - pgdata:/var/lib/postgresql/data');
    expect(yaml).toContain('    environment:');
    expect(yaml).toContain('      POSTGRES_PASSWORD: secret');
    expect(yaml).toContain('    restart: unless-stopped');
  });

  it('emits stdin_open and tty for -it', () => {
    const parsed = parseDockerRun('docker run -it alpine sh');
    if (parsed.success && parsed.config) {
      const yaml = buildCompose(parsed.config);
      expect(yaml).toContain('    stdin_open: true');
      expect(yaml).toContain('    tty: true');
      expect(yaml).toContain('    command: sh');
    }
  });

  it('declares an external network for --network', () => {
    const parsed = parseDockerRun('docker run --network backend redis');
    if (parsed.success && parsed.config) {
      const yaml = buildCompose(parsed.config);
      expect(yaml).toContain('networks:');
      expect(yaml).toContain('    external: true');
    }
  });
});

describe('convertCommand', () => {
  it('returns yaml for a valid command', () => {
    const result = convertCommand('docker run -d --name web -p 8080:80 nginx:latest');
    expect(result.error).toBeNull();
    expect(result.yaml).toContain('services:');
    expect(result.yaml).toContain('nginx:latest');
  });

  it('returns an error for invalid commands', () => {
    const bad = convertCommand('docker ps');
    expect(bad.yaml).toBeNull();
    expect(bad.error).toContain('docker run');
    expect(convertCommand('').error).toContain('Enter a docker run command');
    expect(convertCommand('docker run --nope x img').error).toContain('Unsupported');
  });
});

describe('summaryText', () => {
  it('summarizes state', () => {
    expect(summaryText(state())).toContain('Docker Run to Compose');
    expect(summaryText(state({ command: '' }))).toContain('paste a docker run command');
    expect(summaryText(state({ command: 'docker ps' }))).toContain('docker run');
  });
});

describe('serialize/deserialize', () => {
  const full: ToolState = {
    command: 'docker run -e A=1 alpine',
    error: null,
    history: [{ text: 'converted', createdAt: '2026-11-21T10:00:00.000Z' }],
  };

  it('round-trips all fields through serializeState/deserializeState', () => {
    const restored = deserializeState(JSON.parse(serializeState(full)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(full);
    }
    expect(serializeState(full)).toContain('"command":"docker run -e A=1 alpine"');
  });

  it('round-trips via the Tool object', () => {
    const serialized = dockerRunToComposeTool.serialize(full);
    const restored = dockerRunToComposeTool.deserialize(JSON.parse(serialized));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(full);
    }
  });

  it('recomputes the error field from the command on deserialize', () => {
    const restored = deserializeState({ command: 'docker ps' });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.error).toContain('docker run');
    }
  });

  it('keeps URL share state round-trip safe', () => {
    expect(roundTrips(full)).toBe(true);
    expect(roundTrips(DEFAULT_STATE)).toBe(true);
  });

  it('rejects malformed payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState('string').success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState(undefined).success).toBe(false);
  });

  it('falls back to defaults for missing fields', () => {
    const restored = deserializeState({});
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.command).toBe(DEFAULT_STATE.command);
      expect(restored.data.history).toEqual([]);
    }
  });

  it('filters invalid history entries and caps length', () => {
    const entries = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `entry ${i}`,
      createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    }));
    const restored = deserializeState({ command: '', history: [...entries, 'bad', { text: 'x' }] });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.history.length).toBe(MAX_HISTORY);
      expect(restored.data.history[0]?.text).toBe('entry 0');
    }
  });
});

describe('withHistory', () => {
  it('prepends newest entries first', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    let s = state();
    s = withHistory(s, 'one', now);
    s = withHistory(s, 'two', now);
    expect(s.history[0]?.text).toBe('two');
    expect(s.history[1]?.text).toBe('one');
    expect(s.history[0]?.createdAt).toBe('2026-11-21T12:00:00.000Z');
  });

  it('caps the history at MAX_HISTORY', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    let s = state();
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      s = withHistory(s, `entry ${i}`, now);
    }
    expect(s.history.length).toBe(MAX_HISTORY);
    expect(s.history[0]?.text).toBe(`entry ${MAX_HISTORY + 9}`);
  });
});
