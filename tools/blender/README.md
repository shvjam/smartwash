# Blender in this project

Everything 3D on the public site is built here and written straight into the web app's public
folder. There is no manual export step and no file to copy by hand.

```
tools/blender/
  sw_blender.py      the house rules: materials, lighting, export, render
  build_car.py       the car in the hero
  setup_prefs.py     points Cycles at this machine's GPU (run once)
  install_addon.py   installs the MCP add-on into Blender (run once)
  .venv/             the MCP server, installed not committed
```

## Running a build

Blender is at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` on this machine
and is not on PATH, so scripts are run with the full path — or through the shortcuts in
`frontend/package.json`:

```bash
npm run assets:car      # rebuilds frontend/public/assets/3d/car.glb and its still
npm run assets:gpu      # re-detects the GPU for Cycles
```

Headless is the default. Blender never needs to be open for a build.

## The rules every asset follows

These are not preferences; they are what keeps a landing page loading in under a second.

**Low poly.** The car is about 1,900 triangles and 16 KB. Budget per asset: under 50 KB
compressed. A visitor on a phone pays for every triangle twice, in download and in frame time.

**Flat brand colour, not photoreal.** One Principled node per material, colours from
`sw_blender.BRAND`, which are the same colours the site's CSS uses. A photoreal car dropped
into a flat illustrated page reads as a stock photo someone pasted in.

**glTF binary with Draco.** `.glb`, Draco on, level 6. The decoder is fetched from the CDN by
the web component, so it costs nothing until a page actually shows a model.

**+Y up, always.** Blender stands Z up and the web stands Y up. `export_yup=True` is not
optional — without it every model arrives in three.js lying on its side.

**Renders come out transparent.** `film_transparent`, PNG RGBA, so a still can be dropped on
any section without carrying a background colour that will not match.

**Real-world scale.** The car is 4.24 m long because a saloon is. Getting proportions wrong is
what makes a low-poly model read as a toy, and no amount of material work fixes it afterwards.

## Where things land

| What | Where | Used by |
|---|---|---|
| Models | `frontend/public/assets/3d/*.glb` | `components/landing/CarModel.tsx` |
| Stills | `frontend/public/assets/renders/*.png` | any section that wants a static image |

Both folders are served by Vite at `/assets/3d/…` and `/assets/renders/…`, so a rebuilt asset
is live on the dev server the moment Blender finishes writing it.

## Driving a running Blender from Claude

The build scripts above need nothing of this. The MCP bridge is for the other case: changing
a scene while Blender is open in front of you.

It is Blender Lab's official add-on and server, and both halves are already in place:

* **Blender side** — the `mcp` extension (`mcp-1.0.3.zip` from
  <https://projects.blender.org/lab/blender_mcp/releases>), installed and enabled.
  It opens a local socket on port 9876 one second after Blender starts, on its own.
  Re-run `node tools/blender/run.mjs install_addon.py` after downloading a newer release.
* **Claude side** — `tools/blender/mcp-server`, the official `.mcpb` bundle unpacked and
  installed into `tools/blender/.venv`, declared in `.mcp.json` at the project root.

The only manual step is restarting the Claude session once, so the `blender` tools load.

### What it can do, and the warning that comes with it

The bridge runs Python inside Blender. Blender Lab say so plainly: there are no guards, and
generated code can delete or send whatever Blender can reach. Keep it for scenes you are
happy to lose, and close Blender when you are not using it — the socket is open while it runs.

A request on the wire looks like this, which is also how to check that the bridge is alive —
sent to `localhost:9876`, terminated with a null byte:

```json
{"type": "execute", "strict_json": true, "code": "import bpy\nresult = bpy.app.version_string"}
```

## GPU

This machine runs an Intel Core Ultra with Intel Graphics, which Cycles drives through
**oneAPI**; `setup_prefs.py` selected it and saved the preference. Renders here use EEVEE
anyway, because a flat-shaded asset does not need a path tracer and EEVEE finishes in seconds.

## A local model instead of Claude

Blender Lab's own setup guide pairs their MCP server with [llama.cpp], a local LLM runtime, so
Blender can be driven by a model running on this machine with nothing leaving it. That is set
up here too, alongside the Claude route — they share the same add-on and the same server.

[llama.cpp]: https://github.com/ggml-org/llama.cpp

```bash
node tools/blender/llama.mjs      # starts the model and the bridge
```

Then open <http://127.0.0.1:8080/> and point its MCP settings at `http://127.0.0.1:9191/`.
Blender has to be open; its add-on starts the socket on 9876 by itself.

What is installed:

* `llama.cpp` build 11680 via winget, with the Vulkan backend — which is what drives the
  Intel GPU on this machine.
* `Qwen3-4B-Instruct` (Q4_K_M, 2.5 GB) in `%USERPROFILE%\models`.

### Why a 4B model and not the ones the guide recommends

The guide suggests Gemma4 26B or Qwen3.6 35B. This machine has 15.5 GB of memory and an
integrated GPU that eats from the same pool, so a 15–23 GB model would spend its time reading
itself off the disk. A 4B model fits with room to spare and answers quickly; it is noticeably
weaker at multi-step work, which is the trade being made.

Any other `.gguf` dropped into `%USERPROFILE%\models` is picked up — the newest by name wins,
or name one: `node tools/blender/llama.mjs my-model.gguf`.
