"""
Installs Blender Lab's official MCP add-on, so Claude can drive a running Blender.

    blender --background --python tools/blender/install_addon.py

The add-on is the Blender half of the bridge: it listens on a local socket and runs what the
MCP server sends it. The server half lives in tools/blender/mcp-server and is declared in
.mcp.json at the project root.

It is installed as an extension (Blender 4.2+ packaging), which is how the official release
ships. The third-party add-on this project used first is removed on the way past: both bind
port 9876, and two things listening on one port is a bug waiting for a confusing afternoon.
"""
import pathlib
import sys

import addon_utils
import bpy

HERE = pathlib.Path(__file__).resolve().parent
# Where the release was downloaded to. Kept out of the repo: it is 18 KB of someone else's
# code, versioned by them, and the download link is in the README.
CANDIDATES = [
    HERE / "mcp-1.0.3.zip",
    pathlib.Path.home() / "Downloads" / "mcp-1.0.3.zip",
]
OLD_MODULE = "blender_mcp_addon"   # the third-party add-on, installed before the official one
EXTENSION_ID = "mcp"


def remove_old() -> None:
    """Takes the earlier add-on out of the way, including its file."""
    if any(a.module == OLD_MODULE for a in bpy.context.preferences.addons):
        try:
            bpy.ops.preferences.addon_disable(module=OLD_MODULE)
            print(f"SW: disabled {OLD_MODULE}")
        except Exception as exc:
            print(f"SW: could not disable {OLD_MODULE}: {exc}")

    stale = pathlib.Path(bpy.utils.user_resource("SCRIPTS", path="addons")) / f"{OLD_MODULE}.py"
    if stale.exists():
        stale.unlink()
        print(f"SW: removed {stale.name}")


def main() -> None:
    remove_old()

    package = next((p for p in CANDIDATES if p.exists()), None)
    if package is None:
        sys.exit(
            "SW: mcp-1.0.3.zip not found. Download it from\n"
            "    https://projects.blender.org/lab/blender_mcp/releases\n"
            f"    and put it in {HERE} or your Downloads folder."
        )

    bpy.ops.extensions.package_install_files(
        filepath=str(package),
        repo="user_default",
        enable_on_install=True,
    )
    bpy.ops.wm.save_userpref()

    installed = [a.module for a in bpy.context.preferences.addons if EXTENSION_ID in a.module]
    if installed:
        print(f"SW: installed and enabled {installed[0]} from {package.name}")
    else:
        print("SW: the extension did not report as enabled; open Preferences > Add-ons and check 'MCP'")


main()
