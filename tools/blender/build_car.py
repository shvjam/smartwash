"""
Builds the car the landing page turns: a low-poly saloon in the brand's red.

    blender --background --python tools/blender/build_car.py

It writes frontend/public/assets/3d/car.glb and a transparent still beside it. The shape is
deliberately simple — a body, a cabin, four wheels, lights — because at the size this appears
on a page nobody reads panel gaps, and every triangle is paid for on a phone.

Proportions are kept close to a real saloon: a 4.2 m car is about 1.8 m wide and 1.45 m tall,
its wheels about 0.64 m across and tucked inside the body. Getting that wrong is what makes a
low-poly car read as a toy — the first attempt here had the wheels standing outside the body
and the roof floating above it.

The car is modelled facing +X and standing on Z = 0, so after the +Y-up export it drives
along +X in three.js with its wheels on the floor.
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import bpy  # noqa: E402
import sw_blender as sw  # noqa: E402

# One place for the measurements, so a change keeps the parts together.
LENGTH, WIDTH = 4.24, 1.80
BODY_BOTTOM, BODY_TOP = 0.50, 1.06      # the main volume, sill to shoulder
CABIN_TOP = 1.46                         # roof
WHEEL_R, WHEEL_W = 0.37, 0.24
AXLE_FRONT, AXLE_REAR = 1.38, -1.40
TRACK = 0.80                             # half the distance between the wheels


def box(name, size, location):
    """A box of exactly `size` metres, centred on `location`."""
    # primitive_cube_add(size=1) is one metre on a side, so the scale is the size itself.
    # Halving it here built every panel at half scale, which is what made the first car look
    # like a brick with lorry wheels.
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return obj


def wheel(name, location, radius=WHEEL_R, width=WHEEL_W, verts=18):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=width, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = (1.5707963, 0, 0)   # lay the barrel across the car
    bpy.ops.object.transform_apply(rotation=True)
    return obj


def taper_top(obj, *, scale_x=0.8, scale_y=0.9, shift_x=0.0):
    """Pulls the top face of a box in, and optionally back, to give it a roofline."""
    import bmesh
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    zs = [v.co.z for v in bm.verts]
    top = max(zs)
    centre_x = sum(v.co.x for v in bm.verts) / len(bm.verts)
    for v in bm.verts:
        if abs(v.co.z - top) < 1e-4:
            v.co.x = centre_x + (v.co.x - centre_x) * scale_x + shift_x
            v.co.y *= scale_y
    bm.to_mesh(mesh)
    bm.free()

def build():
    sw.reset_scene()

    paint = sw.flat_material("sw-paint", sw.BRAND["red"], roughness=0.3, metallic=0.1)
    paint_dark = sw.flat_material("sw-paint-dark", sw.BRAND["red_dark"], roughness=0.5)
    glass = sw.flat_material("sw-glass", sw.BRAND["glass"], roughness=0.08)
    tyre = sw.flat_material("sw-tyre", sw.BRAND["tyre"], roughness=0.85)
    chrome = sw.flat_material("sw-chrome", sw.BRAND["chrome"], roughness=0.25, metallic=0.9)
    amber = sw.flat_material("sw-amber", sw.BRAND["amber"], roughness=0.2)
    white = sw.flat_material("sw-head", sw.BRAND["white"], roughness=0.1)

    body_h = BODY_TOP - BODY_BOTTOM
    body = box("body", (LENGTH, WIDTH, body_h), (0, 0, BODY_BOTTOM + body_h / 2))
    sw.bevel(body, width=0.1, segments=3)
    sw.shade(body, paint)

    # The sill runs below the doors and is a shade darker, which gives the side a line to read
    # instead of one flat slab of colour.
    sill = box("sill", (LENGTH - 0.3, WIDTH + 0.02, 0.2), (0, 0, BODY_BOTTOM + 0.04))
    sw.bevel(sill, width=0.05, segments=2)
    sw.shade(sill, paint_dark)

    cabin_h = CABIN_TOP - (BODY_TOP - 0.12)
    cabin = box("cabin", (2.18, WIDTH - 0.16, cabin_h), (-0.18, 0, BODY_TOP - 0.12 + cabin_h / 2))
    # A roof narrower than the waist, pulled back a little: the one change that stops the
    # cabin reading as a box parked on a box. Done on the mesh so it costs no extra faces.
    taper_top(cabin, scale_x=0.78, scale_y=0.88, shift_x=-0.12)
    sw.bevel(cabin, width=0.12, segments=3)
    sw.shade(cabin, paint)

    # Glass sits a few centimetres inside the cabin on every side, so it reads as a window
    # rather than as a sticker on the outside of the roof.
    windows = box("windows", (1.86, WIDTH - 0.10, cabin_h * 0.46),
                  (-0.22, 0, BODY_TOP - 0.12 + cabin_h * 0.52))
    # The glass follows the same roofline as the cabin it sits in. Left untapered it stood
    # proud of the roof on both sides and read as a white stripe painted round the car.
    taper_top(windows, scale_x=0.8, scale_y=0.9, shift_x=-0.1)
    sw.bevel(windows, width=0.05, segments=2)
    sw.shade(windows, glass)

    parts = [body, sill, cabin, windows]

    for i, (x, y) in enumerate(((AXLE_FRONT, TRACK), (AXLE_FRONT, -TRACK),
                                (AXLE_REAR, TRACK), (AXLE_REAR, -TRACK))):
        tyre_obj = wheel(f"tyre{i}", (x, y, WHEEL_R))
        sw.shade(tyre_obj, tyre)
        parts.append(tyre_obj)

        # the hub pokes a centimetre proud of the tyre, on the outside face only
        side = 1 if y > 0 else -1
        hub = wheel(f"hub{i}", (x, y + side * 0.02, WHEEL_R), radius=0.15, width=WHEEL_W + 0.01, verts=12)
        sw.shade(hub, chrome)
        parts.append(hub)

        # a dark arch behind each wheel, so the wheel sits in the body instead of beside it
        arch = box(f"arch{i}", (WHEEL_R * 2.3, 0.1, WHEEL_R * 1.5), (x, y - side * 0.08, WHEEL_R + 0.1))
        sw.bevel(arch, width=0.06, segments=2)
        sw.shade(arch, paint_dark)
        parts.append(arch)

    for y in (0.58, -0.58):
        head = box(f"head{y}", (0.1, 0.36, 0.16), (LENGTH / 2 - 0.06, y, BODY_TOP - 0.22))
        sw.bevel(head, width=0.03, segments=2)
        sw.shade(head, white)
        parts.append(head)

        tail = box(f"tail{y}", (0.08, 0.32, 0.14), (-LENGTH / 2 + 0.05, y, BODY_TOP - 0.2))
        sw.bevel(tail, width=0.03, segments=2)
        sw.shade(tail, amber)
        parts.append(tail)

    for part in parts:
        sw.apply_modifiers(part)

    car = sw.join(parts, "SmartWashCar")
    car.location = (0, 0, 0)
    print(f"SW: car has {sw.triangle_count(car)} triangles")
    return car


def main():
    car = build()
    sw.export_glb([car], "car")

    sw.studio_light()
    sw.camera(location=(8.6, -9.4, 4.0), target=(0, 0, 0.74), lens=62)
    sw.render_png("car-hero", width=1600, height=1000, samples=48)


main()
