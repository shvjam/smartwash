"""
Builds the wash bay the car drives through on the landing page.

    node tools/blender/run.mjs build_bay.py

Writes three files, deliberately separate rather than one scene:

  bay.glb      the gantry, rails and floor — never moves
  brush.glb    one brush, standing at the origin, spun in the browser
  nozzle.glb   one nozzle arm, repeated along the gantry

Keeping the moving parts out of the static shell means the browser can place and animate them
with instancing, and a change of timing does not need Blender to run again. The whole set is
under 30 KB; the page is paying for a scene, not a film set.

Everything stands on Z = 0 facing +X, matching car.glb, so the car drives through the bay
along +X with no rotation anywhere in the web code.
"""
import sys
import pathlib
import math

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bpy  # noqa: E402
import sw_blender as sw  # noqa: E402

BAY_WIDTH = 3.6      # inner width: a 1.8 m car with room to walk round it
BAY_HEIGHT = 3.0
POST = 0.22          # how thick the gantry legs are


def box(name, size, location):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return obj


def cylinder(name, location, radius, depth, axis="Z", verts=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=location)
    obj = bpy.context.active_object
    obj.name = name
    if axis == "Y":
        obj.rotation_euler = (math.radians(90), 0, 0)
    elif axis == "X":
        obj.rotation_euler = (0, math.radians(90), 0)
    bpy.ops.object.transform_apply(rotation=True)
    return obj


def build_bay():
    sw.reset_scene()

    steel = sw.flat_material("sw-steel", sw.BRAND["chrome"], roughness=0.38, metallic=0.75)
    paint = sw.flat_material("sw-bay-paint", sw.BRAND["sky"], roughness=0.5)
    floor_mat = sw.flat_material("sw-floor", (0.82, 0.85, 0.89, 1.0), roughness=0.65)
    rail_mat = sw.flat_material("sw-rail", (0.68, 0.72, 0.78, 1.0), roughness=0.4, metallic=0.5)

    parts = []

    # Floor: a slab with a drainage channel down the middle, which is what tells the eye this
    # is a wash bay and not a garage.
    floor = box("floor", (9.0, BAY_WIDTH + 1.6, 0.12), (0, 0, -0.06))
    sw.shade(floor, floor_mat, smooth=False)
    parts.append(floor)

    channel = box("channel", (8.4, 0.26, 0.06), (0, 0, 0.0))
    sw.shade(channel, rail_mat, smooth=False)
    parts.append(channel)

    # Gantry: two legs and a beam, the shape every automatic wash has.
    for side in (1, -1):
        leg = box(f"leg{side}", (POST, POST, BAY_HEIGHT), (0, side * BAY_WIDTH / 2, BAY_HEIGHT / 2))
        sw.bevel(leg, width=0.03, segments=2)
        sw.shade(leg, steel)
        parts.append(leg)

        foot = box(f"foot{side}", (0.6, 0.5, 0.1), (0, side * BAY_WIDTH / 2, 0.05))
        sw.shade(foot, steel)
        parts.append(foot)

        rail = box(f"rail{side}", (8.6, 0.12, 0.1), (0, side * (BAY_WIDTH / 2 + 0.26), 0.07))
        sw.shade(rail, rail_mat, smooth=False)
        parts.append(rail)

    beam = box("beam", (POST, BAY_WIDTH + POST, 0.34), (0, 0, BAY_HEIGHT - 0.17))
    sw.bevel(beam, width=0.04, segments=2)
    sw.shade(beam, steel)
    parts.append(beam)

    # A band of brand colour across the beam: the one piece of the bay that is ours.
    band = box("band", (POST + 0.02, BAY_WIDTH * 0.72, 0.12), (0, 0, BAY_HEIGHT - 0.17))
    sw.shade(band, paint)
    parts.append(band)

    for part in parts:
        sw.apply_modifiers(part)

    bay = sw.join(parts, "SmartWashBay")
    print(f"SW: bay has {sw.triangle_count(bay)} triangles")
    sw.export_glb([bay], "bay")


def build_brush():
    """One brush: a hub with soft radial vanes, standing on the floor."""
    sw.reset_scene()

    hub_mat = sw.flat_material("sw-brush-hub", sw.BRAND["chrome"], roughness=0.3, metallic=0.8)
    vane_mat = sw.flat_material("sw-brush-vane", sw.BRAND["violet"], roughness=0.85)

    parts = []
    hub = cylinder("hub", (0, 0, 1.3), radius=0.12, depth=2.4, verts=12)
    sw.shade(hub, hub_mat)
    parts.append(hub)

    # Twelve vanes is enough to read as a brush while it turns, and cheap enough to repeat.
    for i in range(12):
        angle = math.radians(i * 30)
        vane = box(f"vane{i}", (0.56, 0.06, 2.2), (math.cos(angle) * 0.3, math.sin(angle) * 0.3, 1.3))
        vane.rotation_euler = (0, 0, angle)
        bpy.ops.object.transform_apply(rotation=True)
        sw.shade(vane, vane_mat, smooth=False)
        parts.append(vane)

    for part in parts:
        sw.apply_modifiers(part)

    brush = sw.join(parts, "SmartWashBrush")
    print(f"SW: brush has {sw.triangle_count(brush)} triangles")
    sw.export_glb([brush], "brush")


def build_nozzle():
    """One nozzle head, hanging from the beam."""
    sw.reset_scene()
    steel = sw.flat_material("sw-nozzle", sw.BRAND["chrome"], roughness=0.3, metallic=0.8)

    stem = cylinder("stem", (0, 0, -0.14), radius=0.035, depth=0.28, verts=8)
    head = cylinder("head", (0, 0, -0.3), radius=0.07, depth=0.1, verts=10)
    for part in (stem, head):
        sw.shade(part, steel)
        sw.apply_modifiers(part)

    nozzle = sw.join([stem, head], "SmartWashNozzle")
    print(f"SW: nozzle has {sw.triangle_count(nozzle)} triangles")
    sw.export_glb([nozzle], "nozzle")


build_bay()
build_brush()
build_nozzle()
