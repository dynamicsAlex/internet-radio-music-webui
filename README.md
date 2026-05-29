# Internet Radio Music WebUI

Web UI plugin for OpenClaw that provides an embeddable control panel for the internet radio music player and stream database management.

## What it does

- **Music Player Controls**: Play, Stop, Next, Previous, Resume (auto-resume after stop)
- **Mood-based Genre Selection**: Pick from 20+ genres (ambient, jazz, rock, etc.)
- **Stream Database Management**: View stats, list streams, check availability, rebuild database
- **Embeddable Panel**: Embed in webchat via `[embed url=http://127.0.0.1:18789/mplayer]`

## Requirements

**⚠️ This plugin REQUIRES the following skills to be installed:**

1. **internet-radio-music-player** — Music player script (`play_music.py`)
2. **internet-radio-music-db** — Stream database management (`cli.py`, `show_stats.py`, etc.)

**The plugin will NOT work without these skills installed.**

## API Endpoints

### Player API (`/api/player/*`)
- `POST /api/player/status` — Get current playback status
- `POST /api/player/play` — Start playback (optional `{"mood": "jazz"}` body)
- `POST /api/player/stop` — Stop playback
- `POST /api/player/next` — Next random stream
- `POST /api/player/prev` — Previous stream from history
- `POST /api/player/history` — Playback history

### Database API (`/api/db/*`)
- `POST /api/db/stats` — Full statistics (optional `{"sub": "genres|lang|speed|effective"}`)
- `POST /api/db/list` — List streams (optional `{"genre": "jazz"}`)
- `POST /api/db/check` — Check all streams availability
- `POST /api/db/rebuild` — Rebuild stream database
- `POST /api/db/add` — Add stream (`{"url": "...", "name": "...", "genre": "...", "lang": "..."}`)

### HTML Panel
- `GET /mplayer` — Embeddable web panel with Player and DB tabs

## Usage in WebChat

Embed the panel in a webchat message:

```
[embed url="http://127.0.0.1:18789/mplayer" title="Music Player" height="200"]
```

## Auto-Resume Feature

When playback is stopped via `stop`, pressing `play` without specifying a mood/genre automatically resumes the last played stream. Specifying a mood always starts a new random stream.

## Installation

**⚠️ Important: use the `clawhub:` prefix, otherwise the plugin will not be found.**

```bash
openclaw plugins install "clawhub:internet-radio-music-webui"
openclaw gateway restart
```

## License

MIT
