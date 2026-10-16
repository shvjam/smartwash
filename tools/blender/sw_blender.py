"""
The house rules for anything this project builds in Blender.

Every asset here is made for a web page, not for a film. That decides almost everything:

* Low polygon counts. A landing page budget is a few hundred kilobytes, not a few megabytes,
  and a visitor on a phone pays for every triangle twice — in download and in frame time.
* Flat, lit colour rather than photoreal material. The site is drawn in flat brand colour;
  a photoreal car in the middle of it would look like a stock photo someone pasted in.
* glTF binary (.glb) with Draco compression, exported +Y up. Blender stands Z up and the web
  stands Y up; exporting without that conversion lays every model on its side in three.js.
* PNG renders come out with a transparent film, so a still can be dropped onto any section
  without carrying a background colour that will not match.

Import this from a build script; it is not meant to be run on its own.
"""
from __future__ import annotations

import math
import pathlib

import bpy

# Where the web app reads from. Written straight into the public folder so an asset is
# testable in the browser the moment it is built, with nothing to copy by hand.
ROOT = pathlib.Path(__file__).resolve().parents[2]
MODELS_DIR = ROOT / "frontend" / "public" / "assets" / "3d"
RENDERS_DIR = ROOT / "frontend" / "public" / "assets" / "renders"

# The brand, in linear RGB as Blender wants it. These are the same colours the site uses, so
# a model dropped into a section belongs to it rather than sitting on top of it.
BRAND = {
    "red": (0.78, 0.09, 0.10, 1.0),
    "red_dark": (0.42, 0.04, 0.05, 1.0),
    "sky": (0.20, 0.52, 0.86, 1.0),
    "violet": (0.49, 0.32, 0.86, 1.0),
    "emerald": (0.13, 0.66, 0.45, 1.0),
    "amber": (0.95, 0.68, 0.16, 1.0),
    "glass": (0.62, 0.79, 0.92, 1.0),
    "tyre": (0.06, 0.06, 0.07, 1.0),
    "chrome": (0.78, 0.80, 0.83, 1.0),
    "white": (0.95, 0.96, 0.98, 1.0),
}


def reset_scene() -> None:
    """Empties the file, including the default cube, lamp and camera."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.unit_settings.system = "METRIC"


def flat_material(name: str, colour, *, roughness: float = 0.45, metallic: float = 0.0):
    """
    A single flat colour with a little sheen.

    Deliberately one Principled node and nothing else: every extra node is another thing the
    glTF exporter has to bake or drop, and the look this page wants is flat colour anyway.
    """
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def shade(obj, mat, *, smooth: bool = True) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True


def bevel(obj, *, width: float = 0.02, segments: int = 2) -> None:
    """
    Softens every hard edge.

    A low-poly shape with perfectly sharp corners reads as unfinished; two segments of bevel
    catch the light along each edge and cost almost nothing in triangles.
    """
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(40)


def join(objects, name: str):
    """Welds a group of parts into one object, so the model arrives as one draw call."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    merged = bpy.context.active_object
    merged.name = name
    return merged


def apply_modifiers(obj) -> None:
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def studio_light() -> None:
    """
    Three lamps and a soft world: a key, a fill, and a rim that separates the model from a
    page it will sit on without a background behind it.
    """
    world = bpy.data.worlds.new("sw-world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.9, 0.93, 0.97, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    bpy.context.scene.world = world

    for name, location, energy, size in (
        ("key", (3.2, -3.6, 4.2), 900.0, 4.0),
        ("fill", (-4.0, -2.2, 2.4), 320.0, 6.0),
        ("rim", (-1.4, 4.4, 3.0), 500.0, 3.0),
    ):
        data = bpy.data.lights.new(f"sw-{name}", "AREA")
        data.energy = energy
        data.size = size
        lamp = bpy.data.objects.new(f"sw-{name}", data)
        lamp.location = location
        lamp.rotation_euler = _aim_at(location, (0.0, 0.0, 0.6))
        bpy.context.collection.objects.link(lamp)


def camera(location=(5.4, -6.2, 3.1), target=(0.0, 0.0, 0.62), lens: float = 55.0):
    data = bpy.data.cameras.new("sw-camera")
    data.lens = lens
    cam = bpy.data.objects.new("sw-camera", data)
    cam.location = location
    cam.rotation_euler = _aim_at(location, target)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def _aim_at(location, target):
    from mathutils import Vector
    direction = Vector(target) - Vector(location)
    return direction.to_track_quat("-Z", "Y").to_euler()


def export_glb(objects, name: str) -> pathlib.Path:
    """
    Writes one .glb the web app can load, compressed and turned the way the web expects.

    Draco shrinks the mesh several times over; three.js reads it with the decoder that ships
    with the library. +Y up is not optional: without it every model arrives on its side.
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    path = MODELS_DIR / f"{name}.glb"

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=12,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_cameras=False,
        export_lights=False,
        export_animations=True,
    )
    print(f"SW: wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")
    return path


def render_png(name: str, *, width: int = 1400, height: int = 900, samples: int = 32) -> pathlib.Path:
    """A still with a transparent film, sized for a page rather than for print."""
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    path = RENDERS_DIR / f"{name}.png"

    scene = bpy.context.scene
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 90
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = samples
    scene.render.filepath = str(path)

    bpy.ops.render.render(write_still=True)
    print(f"SW: wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")
    return path


def triangle_count(obj) -> int:
    mesh = obj.data
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)
