# Blender in this project

Every picture on the public landing page is a frame of one Blender shot, built by a script and
written straight into the web app's public folder. There is no manual export and no file to
copy by hand.

```
tools/blender/
  build_wash.py      the wash: one macro shot of a red car's flank, foam to shine
  run.mjs            runs a script headlessly, wherever Blender is installed
  setup_prefs.py     points Cycles at this machine's GPU (run once)
  install_addon.py   installs the MCP add-on into Blender (run once)
  sw_blender.py      shared helpers from the earlier 3D work
  .venv/             the MCP server, installed not committed
```

## The shot

One continuous camera move, no cuts. The camera tracks low along the flank of a red car while
the foam slides off, the water beads up on the clear coat, and a strip light sweeps along the
shoulder line. The landing page scrubs it with the reader's scroll.

It is a macro of paint rather than a model of a car on purpose. A whole car at web size is
either low-poly — which reads as a toy, and was rejected as one — or a photoreal model nobody
here has rights to. A macro needs neither: the subject is a surface a few curves define, and
everything that makes it look expensive comes from materials and light.

What makes it work, so the next change does not undo it:

- **The studio is black.** Strip lights of a few tens of watts. At 900 W the whole panel
  washed out pink; the colour of car paint lives in its highlights, not its diffuse.
- **The paint is three layers**: a dark red base, metallic flake as a faint Voronoi bump on the
  base coat only, and a mirror-smooth clear coat over it.
- **Foam is a blanket with bubbles on its skin**, not bubbles alone — bubbles alone leave
  gaps the paint shows through. The bubbles are scattered on the blanket's own surface so
  they ride its heaps, and the blanket thins to a film over the last 3 cm before the edge so
  the cut never shows the grid.
- **Focus is ray-cast.** At 85 mm and f/2.4 the depth of field is about a centimetre, so the
  focus distance is keyed every four frames to wherever a ray from the lens hits — foam
  while there is foam, paint after.
- **Only the stretch near the camera is built.** Beads and foam are cropped to ±34 cm of the
  camera in Geometry Nodes; building them along the whole panel was most of the render time.

## Building

Blender is at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` and is not on
PATH, so scripts go through `run.mjs`, which also starts Blender with `--factory-startup` so
personal add-ons never load into a build.

```bash
npm run assets:wash:probe   # four draft frames, about a minute — look at these first
npm run assets:wash         # everything at final quality
```

Or one output at a time, which is how it is usually run:

```bash
node tools/blender/run.mjs build_wash.py -- --stills --quality final
node tools/blender/run.mjs build_wash.py -- --strip --quality final
node tools/blender/run.mjs build_wash.py -- --shot --quality final
```

Outputs, in `frontend/public/assets/wash/`:

| file | what it is | used by |
|---|---|---|
| `wash.mp4` | the scrubbed shot, 1600×900, 144 frames, a keyframe every 8 frames | the pinned wash section |
| `wash-poster.jpg`, `wash-end.jpg` | first and last frames | before the video plays; reduced motion |
| `strip.mp4`, `strip-poster.jpg` | a 96-frame ping-pong loop along the shoulder line | the strip inside the hero sentence |
| `still-*.jpg` | four moments of the shot, at the sizes the feature rows lay out | the feature rows |

The shot is encoded with a short GOP and no B-frames because the page seeks it on every scroll
tick; a long GOP would make every seek decode back to a distant keyframe.

Blender 5 notes, each of which cost a failed run: the Random Value node has a single output;
the compositor is a node group on `scene.compositing_node_group`; and video needs
`image_settings.media_type = 'VIDEO'` before `FFMPEG` exists as a file format.

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
