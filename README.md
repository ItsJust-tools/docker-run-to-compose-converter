# Docker Run to Compose Converter

Paste a `docker run` command and get the equivalent `docker-compose.yml` service definition instantly. All conversion happens locally in your browser.

**Live:** [docker-run-to-compose-converter.itsjust.tools](https://docker-run-to-compose-converter.itsjust.tools)

## Features

- Parses `--name`, `-p/--publish`, `-v/--volume`, `-e/--env`, `--env-file`, `--restart`, `--network`, `--pull`, `-d`, `-it` and `--rm`
- Live two-pane view: docker run command on the left, generated YAML on the right
- Parsed configuration summary (service, image, ports, volumes, environment, restart, network)
- Copy the generated `docker-compose.yml` with one click (`C`)
- Sample presets for common images like nginx, postgres and redis
- Clear error messages for malformed or unsupported flags
- Save conversions to history (`H`) and share state via URL
- 100% client-side — no data ever leaves your browser

## Keyboard shortcuts

| Key | Action                     |
| --- | -------------------------- |
| `C` | Copy generated YAML        |
| `H` | Save conversion to history |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-docker-run-to-compose-converter .
docker run -p 3000:3000 itsjust-docker-run-to-compose-converter
```

## License

MIT
