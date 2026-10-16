"""
Installs and enables the MCP add-on inside Blender, so Claude can drive a running Blender.

    blender --background --python tools/blender/install_addon.py

The add-on ships inside the mcp-for-blender package in tools/blender/.venv. Rather than ask
someone to find that file and walk the Preferences dialog, this copies it into Blender's own
add-ons folder, switches it on, and saves preferences — the same three things the dialog does.

The add-on only listens once the server is started from Blender's sidebar (View3D > N > MCP).
That one click stays manual on purpose: it opens a socket, and nothing here should do that to
someone's machine without them asking.
"""
import pathlib
import shutil
import sys

import addon_utils
import bpy

HERE = pathlib.Path(__file__).resolve().parent
SOURCE = HERE / ".venv" / "Lib" / "site-packages" / "blender_mcp" / "bundled" / "addon.py"
MODULE = "blender_mcp_addon"


def main() -> None:
    if not SOURCE.exists():
        sys.exit(f"SW: add-on not found at {SOURCE}; run pip install mcp-for-blender in tools/blender/.venv")

    scripts = pathlib.Path(bpy.utils.user_resource("SCRIPTS", path="addons", create=True))
    target = scripts / f"{MODULE}.py"

    fresh = not target.exists() or target.read_bytes() != SOURCE.read_bytes()
    if fresh:
        shutil.copyfile(SOURCE, target)
        print(f"SW: copied the add-on to {target}")

    # Blender builds its add-on module list at startup, and a file that appears afterwards is
    # not importable in that same run however the list is refreshed. So the copy and the
    # enable happen in two runs; the second sees the file already in place.
    addon_utils.modules_refresh()
    if str(scripts) not in sys.path:
        sys.path.append(str(scripts))

    try:
        bpy.ops.preferences.addon_enable(module=MODULE)
        bpy.ops.wm.save_userpref()
    except Exception as exc:
        print(f"SW: add-on copied but not enabled in this run ({exc}); run this script once more")
        return

    enabled = {a.module for a in bpy.context.preferences.addons}
    print("SW: add-on enabled and saved" if MODULE in enabled else "SW: add-on did NOT enable")


main()
