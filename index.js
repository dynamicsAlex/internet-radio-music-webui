import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PLAY_SCRIPT = "C:\\Users\\alter\\.openclaw\\skills\\internet-radio-music-player\\scripts\\play_music.py";
const DB_CLI = "C:\\Users\\alter\\.openclaw\\skills\\internet-radio-music-db\\scripts\\cli.py";
const DB_STATS = "C:\\Users\\alter\\.openclaw\\skills\\internet-radio-music-db\\scripts\\show_stats.py";
const DB_CHECK = "C:\\Users\\alter\\.openclaw\\skills\\internet-radio-music-db\\scripts\\check_availability.py";
const DB_BUILD = "C:\\Users\\alter\\.openclaw\\skills\\internet-radio-music-db\\scripts\\build_db.py";

async function runScript(script, args = [], timeout = 30000) {
  try {
    const { stdout, stderr } = await execFileAsync(
      "python",
      [script, ...args],
      { timeout, encoding: "utf-8" }
    );
    return { ok: true, output: stdout.trim(), error: stderr || null };
  } catch (err) {
    return { ok: false, output: "", error: err.message };
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    try {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf-8");
          resolve(raw ? JSON.parse(raw) : {});
        } catch { resolve({}); }
      });
      req.on("error", () => resolve({}));
    } catch { resolve({}); }
  });
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function jsonRes(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

// ── Player API ─────────────────────────────────────────────────────
async function handlePlayerApi(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost`);
  const parts = url.pathname.split("/").filter(Boolean);
  const command = parts[parts.length - 1];
  const body = req.method === "POST" ? await readBody(req) : {};

  let result;
  switch (command) {
    case "status":   result = await runScript(PLAY_SCRIPT, ["status"]); break;
    case "play":     result = await runScript(PLAY_SCRIPT, body.mood ? ["play", "-m", body.mood] : ["play"]); break;
    case "stop":     result = await runScript(PLAY_SCRIPT, ["stop"]); break;
    case "next":     result = await runScript(PLAY_SCRIPT, ["next"]); break;
    case "prev":     result = await runScript(PLAY_SCRIPT, ["prev"]); break;
    case "history":  result = await runScript(PLAY_SCRIPT, ["history"]); break;
    default:
      jsonRes(res, 404, { error: `Unknown player command: ${command}` });
      return;
  }
  jsonRes(res, result.ok ? 200 : 500, result);
}

// ── Stream DB API ─────────────────────────────────────────────────
async function handleDbApi(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost`);
  const parts = url.pathname.split("/").filter(Boolean);
  const action = parts[parts.length - 1];
  const body = req.method === "POST" ? await readBody(req) : {};

  let result;
  switch (action) {
    case "stats": {
      const sub = body.sub || "";
      const args = [];
      if (sub === "genres") args.push("--genres");
      else if (sub === "lang") args.push("--lang");
      else if (sub === "speed") args.push("--speed");
      else if (sub === "effective") args.push("--effective");
      else if (sub === "top") args.push("--top", String(body.n || 10));
      else if (sub === "top-speed") args.push("--top-speed", String(body.n || 10));
      result = await runScript(DB_STATS, args, 60000);
      break;
    }
    case "list":
      result = await runScript(DB_CLI, body.genre ? ["list", body.genre] : ["list"]);
      break;
    case "check":
      result = await runScript(DB_CHECK, [], 120000);
      break;
    case "rebuild":
      result = await runScript(DB_BUILD, [], 120000);
      break;
    case "add":
      if (!body.url || !body.name || !body.genre) {
        jsonRes(res, 400, { error: "Missing required fields: url, name, genre" });
        return;
      }
      result = await runScript(DB_CLI, ["add", body.url, body.name, body.genre, body.lang || ""]);
      break;
    default:
      jsonRes(res, 404, { error: `Unknown DB action: ${action}` });
      return;
  }
  jsonRes(res, result.ok ? 200 : 500, result);
}

// ── HTML Panel ────────────────────────────────────────────────────
// Uses CSS custom properties inherited from OpenClaw webchat theme.
// Falls back to sensible dark-theme defaults when opened standalone.
function getPanelHtml() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
:root{
  /* Inherit from webchat theme with dark-theme fallbacks */
  --_bg:       var(--bg,            rgba(14,16,21,0.97));
  --_bg2:      var(--bg-elevated,   rgba(25,28,36,0.97));
  --_bg3:      var(--bg-muted,      rgba(31,35,48,0.97));
  --_bg-hover: var(--bg-hover,      rgba(255,255,255,0.08));
  --_text:     var(--text-strong,   #f0f0f2);
  --_text2:    var(--text,          #d4d4d8);
  --_muted:    var(--muted,         #9ca3af);
  --_muted2:   var(--muted-strong,  #6b7280);
  --_border:   var(--border,        rgba(255,255,255,0.10));
  --_border2:  var(--border-strong, rgba(255,255,255,0.18));
  --_accent:   var(--accent,        #60a5fa);
  --_accent-h: var(--accent-hover, #93bbfd);
  --_green:    var(--cm-success,    #4ade80);
  --_red:      var(--cm-danger,     #f87171);
  --_blue:     #60a5fa;
  --_font:     Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --_r:        var(--control-ui-text-scale, 1);
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:var(--_font);
  background:var(--_bg);
  color:var(--_text);
  overflow:hidden;
  font-size:max(14px, calc(1rem * var(--_r)));
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
/* Tabs */
.tabs{display:flex;gap:2px;padding:4px 8px 0}
.tab{
  padding:6px 14px;
  font-size:max(13px, calc(0.875rem * var(--_r)));
  border:none;border-radius:6px 6px 0 0;
  background:var(--_bg3);
  color:var(--_muted);
  cursor:pointer;font-weight:500;
  transition:background .15s,color .15s;
}
.tab:hover{color:var(--_text2)}
.tab.active{background:var(--_bg2);color:var(--_text);font-weight:600}
/* Panes */
.pane{padding:8px;display:none}
.pane.active{display:block}
/* Rows */
.bar{display:flex;align-items:center;gap:6px;min-height:42px}
/* Buttons */
.btn{
  width:38px;height:38px;
  border:1px solid var(--_border);
  border-radius:6px;
  background:var(--_bg3);
  color:var(--_text);
  cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  font-size:max(16px, calc(1.125rem * var(--_r)));
  font-weight:600;
  transition:background .15s,transform .1s;
}
.btn:hover{background:var(--_bg-hover);border-color:var(--_border2)}
.btn:active{transform:scale(0.94)}
/* Play / Stop with accent tint */
.btn.play{
  background:rgba(74,222,128,0.10);
  color:var(--_green);
  border-color:rgba(74,222,128,0.2);
}
.btn.play:hover{background:rgba(74,222,128,0.20)}
.btn.stop{
  background:rgba(248,113,113,0.10);
  color:var(--_red);
  border-color:rgba(248,113,113,0.2);
}
.btn.stop:hover{background:rgba(248,113,113,0.20)}
/* DB buttons */
.btn.db{
  width:auto;padding:0 10px;
  font-size:max(12px, calc(0.8125rem * var(--_r)));
  background:rgba(96,165,250,0.10);
  color:var(--_blue);
  border-color:rgba(96,165,250,0.2);
  font-weight:500;
}
.btn.db:hover{background:rgba(96,165,250,0.20)}
/* Status text */
.status{
  font-size:max(13px, calc(0.875rem * var(--_r)));
  color:var(--_muted);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  max-width:220px;margin-left:6px;flex:1;
  line-height:1.4;
}
.status.on{color:var(--_green);font-weight:500}
.status.err{color:var(--_red);font-weight:500}
/* DB output area */
.db-output{
  font-size:max(12px, calc(0.8125rem * var(--_r)));
  color:var(--_text2);
  white-space:pre-wrap;
  max-height:130px;overflow-y:auto;
  margin-top:4px;
  font-family:"SF Mono",SFMono-Regular,Consolas,"Liberation Mono",monospace;
  line-height:1.5;
  border-radius:6px;
  padding:8px;
  background:var(--_bg3);
  border:1px solid var(--_border);
}
/* Form controls */
.db-row{display:flex;gap:6px;margin-top:6px}
.db-row select,.db-row input{
  background:var(--_bg3);
  border:1px solid var(--_border);
  color:var(--_text);
  border-radius:6px;
  padding:6px 10px;
  font-size:max(14px, calc(0.875rem * var(--_r)));
  font-family:inherit;
}
.db-row select:focus,.db-row input:focus{
  outline:none;
  border-color:var(--_accent);
  box-shadow:0 0 0 2px rgba(96,165,250,0.15);
}
.db-row select option{background:var(--_bg2);color:var(--_text)}
</style></head><body>
<div class="tabs">
  <button class="tab active" onclick="switchTab('player',this)">&#9835; Player</button>
  <button class="tab" onclick="switchTab('db',this)">&#128196; DB</button>
</div>

<div id="player-pane" class="pane active">
  <div class="bar">
    <button class="btn" onclick="player('prev')" title="Previous">&#9194;</button>
    <button class="btn play" onclick="player('play')" title="Play / Resume">&#9654;</button>
    <button class="btn stop" onclick="player('stop')" title="Stop">&#9724;</button>
    <button class="btn" onclick="player('next')" title="Next">&#9193;</button>
    <span class="status" id="p-status">...</span>
  </div>
  <div class="bar" style="margin-top:4px">
    <span style="font-size:max(14px,calc(0.875rem * var(--_r)));color:var(--_muted);width:54px;font-weight:600">Mood:</span>
    <select id="mood" style="flex:1;background:var(--_bg3);border:1px solid var(--_border);color:var(--_text);border-radius:6px;padding:6px 10px;font-size:max(14px,calc(0.875rem * var(--_r)));font-family:inherit"><option value="">Resume</option><option value="ambient">Ambient</option><option value="rock">Rock</option><option value="jazz">Jazz</option><option value="country">Country</option><option value="electronic">Electronic</option><option value="classical">Classical</option><option value="pop">Pop</option><option value="dance">Dance</option><option value="blues">Blues</option><option value="metal">Metal</option><option value="reggae">Reggae</option><option value="soul">Soul</option><option value="funk">Funk</option><option value="techno">Techno</option><option value="indie">Indie</option><option value="folk">Folk</option><option value="lounge">Lounge</option><option value="80s">80s</option><option value="90s">90s</option></select>
    <button class="btn play" onclick="playMood()" title="Play mood">&#9654;</button>
  </div>
</div>

<div id="db-pane" class="pane">
  <div class="bar">
    <button class="btn db" onclick="db('stats')">Stats</button>
    <button class="btn db" onclick="db('stats','genres')">Genres</button>
    <button class="btn db" onclick="db('stats','lang')">Langs</button>
    <button class="btn db" onclick="db('stats','effective')">Efficiency</button>
    <button class="btn db" onclick="db('check')">Check</button>
    <button class="btn db" onclick="db('rebuild')">Rebuild</button>
  </div>
  <div class="db-row">
    <select id="db-genre"><option value="">All genres</option><option value="ambient">Ambient</option><option value="rock">Rock</option><option value="jazz">Jazz</option><option value="country">Country</option><option value="electronic">Electronic</option><option value="classical">Classical</option><option value="pop">Pop</option><option value="dance">Dance</option><option value="blues">Blues</option><option value="metal">Metal</option><option value="reggae">Reggae</option><option value="soul">Soul</option><option value="funk">Funk</option><option value="techno">Techno</option><option value="indie">Indie</option><option value="folk">Folk</option><option value="lounge">Lounge</option><option value="80s">80s</option><option value="90s">90s</option></select>
    <button class="btn db" onclick="dbList()">List</button>
  </div>
  <div class="db-output" id="db-output">Click a button to interact with the stream database</div>
</div>

<script>
const PAPI='/api/player', DAPI='/api/db';
function switchTab(t,el){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(x=>x.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(t+'-pane').classList.add('active');
}
function st(t,c){const s=document.getElementById('p-status');s.textContent=t;s.className='status '+(c||'')}
async function player(c){
  st('...','');
  try{
    const r=await fetch(PAPI+'/'+c,{method:'POST',headers:{'Content-Type':'application/json'}});
    const d=await r.json();
    if(d.ok){st(d.output.split('\\n')[0],'on');refresh()}else{st(d.error||'Err','err')}
  }catch(e){st('Conn err','err')}
}
function playMood(){
  const m=document.getElementById('mood').value;
  if(m){fetch(PAPI+'/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mood:m})}).then(r=>r.json()).then(d=>{st(d.ok?d.output.split('\\n')[0]:(d.error||'Err'),d.ok?'on':'err');refresh()}).catch(()=>st('Conn err','err'))}else{player('play')}
}
async function refresh(){
  try{
    const r=await fetch(PAPI+'/status');
    const d=await r.json();
    if(d.ok&&d.output){
      const l=d.output.split('\\n');let n='Not playing';
      for(const x of l){if(x.startsWith('NOW_PLAYING:'))n=x.replace('NOW_PLAYING:','').trim()}
      st(n,'on')
    }
  }catch{}
}
async function db(action, sub){
  const out=document.getElementById('db-output');
  out.textContent='Loading...';
  try{
    const body=sub?{sub:sub}:{};
    const r=await fetch(DAPI+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    out.textContent=d.ok?d.output:(d.error||'Error');
  }catch(e){out.textContent='Connection error: '+e.message}
}
function dbList(){
  const g=document.getElementById('db-genre').value;
  const out=document.getElementById('db-output');
  out.textContent='Loading...';
  fetch(DAPI+'/list',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({genre:g})}).then(r=>r.json()).then(d=>{out.textContent=d.ok?d.output:(d.error||'Error')}).catch(()=>out.textContent='Connection error');
}
refresh();setInterval(refresh,10000);
</script></body></html>`;
}

// ── HTTP router ────────────────────────────────────────────────────
async function handleHttpRequest(req, res) {
  const url = new URL(req.url, `http://localhost`);

  // Player API: /api/player/*
  if (url.pathname.startsWith("/api/player/") || url.pathname === "/api/player") {
    if (url.pathname === "/api/player" || url.pathname === "/api/player/") {
      setCors(res); res.writeHead(200); res.end(JSON.stringify({ok:true,endpoints:["status","play","stop","next","prev","history"]})); return;
    }
    return handlePlayerApi(req, res);
  }

  // DB API: /api/db/*
  if (url.pathname.startsWith("/api/db/") || url.pathname === "/api/db") {
    if (url.pathname === "/api/db" || url.pathname === "/api/db/") {
      setCors(res); res.writeHead(200); res.end(JSON.stringify({ok:true,endpoints:["stats","list","check","rebuild","add"]})); return;
    }
    return handleDbApi(req, res);
  }

  // HTML Panel at /mplayer
  if (url.pathname === "/mplayer" || url.pathname === "/mplayer/" || url.pathname === "/" || url.pathname === "") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHead(200);
    res.end(getPanelHtml());
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

// ── Plugin entry ───────────────────────────────────────────────────
export default definePluginEntry({
  id: "internet-radio-music-webui",
  name: "Internet Radio Music WebUI",
  description: "Web UI for controlling internet radio music player and stream database. Requires internet-radio-music-player and internet-radio-music-db skills.",

  register(api) {
    // Player API
    api.registerHttpRoute({
      path: "/api/player",
      auth: "plugin",
      match: "prefix",
      handler: handleHttpRequest,
    });

    // DB API
    api.registerHttpRoute({
      path: "/api/db",
      auth: "plugin",
      match: "prefix",
      handler: handleHttpRequest,
    });

    // HTML Panel
    api.registerHttpRoute({
      path: "/mplayer",
      auth: "plugin",
      match: "prefix",
      handler: handleHttpRequest,
    });

    // Agent tool
    api.registerTool({
      name: "music_player",
      description: "Control the internet radio music player. Commands: play [mood/genre], stop, next, prev, history, status. Use play without mood to resume last stopped stream.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", enum: ["play","stop","next","prev","history","status"] },
          mood: { type: "string", description: "Mood or genre (e.g. jazz, rock, ambient). Omit to resume last stopped stream." }
        },
        required: ["command"]
      },
      async execute(_id, params) {
        const args = params.command === "play" && params.mood ? ["play", "-m", params.mood] : [params.command];
        const r = await runScript(PLAY_SCRIPT, args);
        return { content: [{ type: "text", text: r.ok ? r.output : `Error: ${r.error}` }] };
      }
    });

    api.logger.info("Internet Radio Music WebUI: Player API=/api/player/* DB API=/api/db/* Panel=/mplayer");
  }
});
