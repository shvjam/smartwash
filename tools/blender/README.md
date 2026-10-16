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

`setup_prefs.py` and the build scripts are enough for everything above. The MCP server is for
the other case: changing a scene interactively while Blender is open in front of you.

It is already installed:

* `tools/blender/.venv` holds `mcp-for-blender`, declared in `.mcp.json` at the project root.
* The add-on is copied into Blender's add-ons folder and enabled.

Two things are still manual, and deliberately so:

1. **Start the server in Blender.** Open Blender, press `N` in the 3D viewport, go to the
   **MCP** tab and press *Start MCP Server*. That opens a socket on port 9876; nothing here
   does that to your machine on its own.
2. **Restart the Claude session** after the first time, so the `blender` tools are loaded.

With both done, `blender` appears in the tool list and the scene in front of you can be built,
measured and exported through it.

## GPU

This machine runs an Intel Core Ultra with Intel Graphics, which Cycles drives through
**oneAPI**; `setup_prefs.py` selected it and saved the preference. Renders here use EEVEE
anyway, because a flat-shaded asset does not need a path tracer and EEVEE finishes in seconds.
