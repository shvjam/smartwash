"""
The wash, as a macro photograph that moves.

    node tools/blender/run.mjs build_wash.py [--still] [--frames A-B] [--quality draft|final]

One continuous shot, no cuts: the camera tracks low along the flank of a red car while the
foam on it slides away, the water beads up on the clear coat, and a light sweeps along the
shoulder line. Foam to shine. The landing page scrubs this shot with the reader's scroll, so
each beat of the story sits on a moment of the wash.

Why this and not a model of a car. A whole car at web size is either low-poly — which reads as
a toy, and was rejected as one — or a photoreal model nobody here has the rights to. A macro
of paint needs neither: the subject is a surface, a few curves define it, and everything that
makes it look expensive (the clear coat, the beads, the long highlights a studio strip light
draws across a body panel) comes from materials and light, which Blender does better than
anything else.

Outputs, all into frontend/public/assets/wash/:
    wash.mp4         the scrubbed shot, 1920x1080, every frame a keyframe-friendly GOP
    wash-poster.jpg  its first frame, for the moment before the video can play
    wash-end.jpg     its last frame, for reduced motion and as the shine still
    strip.mp4        a short ping-pong loop for the strip inside the hero sentence
    still-*.jpg      four stills from the same world for the feature rows
"""
from __future__ import annotations

import math
import pathlib
import random
import sys

import bpy
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "public" / "assets" / "wash"
OUT.mkdir(parents=True, exist_ok=True)

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
STILL_ONLY = "--still" in ARGS
QUALITY = "final" if "--quality" in ARGS and ARGS[ARGS.index("--quality") + 1] == "final" else "draft"

FPS = 24
SHOT_FRAMES = 144          # six seconds: one frame per ~25px of a 400vh scroll is smooth enough
CROP_TARGET = None         # the camera, once it exists; the scatter only builds near it
random.seed(7)

# The brand red, as car paint: deeper and cooler than the screen red, because a clear coat
# over metallic flake reads darker than the pigment, and the highlights supply the brightness.
PAINT = (0.30, 0.006, 0.012, 1.0)


# ── scene ──────────────────────────────────────────────────────────────────

def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, SHOT_FRAMES
    sc.unit_settings.scale_length = 1.0


def body_panel() -> bpy.types.Object:
    """
    A stretch of a car's flank: convex in section, with the sharp shoulder line every modern
    body carries a third of the way down, and a slow bulge along its length so no two
    highlights are parallel. Built as a grid so the profile is exact rather than sculpted.
    """
    nx, ny = 220, 120
    length, height = 1.6, 0.62
    verts, faces = [], []
    for i in range(nx + 1):
        u = i / nx
        x = (u - 0.5) * length
        bulge = 0.025 * math.sin(math.pi * u)            # along the length
        for j in range(ny + 1):
            v = j / ny
            y = (v - 0.5) * height
            # the section: a gentle crown, plus a ridge at v≈0.62 with a tight upper face
            crown = -0.09 * (v - 0.45) ** 2
            d = v - 0.62
            ridge = 0.012 * math.exp(-(d / 0.022) ** 2) + (0.010 * (1 - 1 / (1 + math.exp(-d / 0.01))))
            z = crown + ridge + bulge
            verts.append((x, y, z))
    for i in range(nx):
        for j in range(ny):
            a = i * (ny + 1) + j
            faces.append((a, a + ny + 1, a + ny + 2, a + 1))
    mesh = bpy.data.meshes.new("Panel")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Panel", mesh)
    bpy.context.collection.objects.link(obj)
    for p in mesh.polygons:
        p.use_smooth = True
    # Tilt the panel the way a door stands: near vertical, leaning back a little.
    obj.rotation_euler = (math.radians(72), 0, 0)
    return obj


def paint_material() -> bpy.types.Material:
    """Base coat with metallic flake, under a near-perfect clear coat."""
    m = bpy.data.materials.new("CarPaint")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = PAINT
    bsdf.inputs["Metallic"].default_value = 0.35
    bsdf.inputs["Roughness"].default_value = 0.24
    bsdf.inputs["Coat Weight"].default_value = 1.0
    bsdf.inputs["Coat Roughness"].default_value = 0.015
    bsdf.inputs["Coat IOR"].default_value = 1.52

    # Flake: tiny Voronoi cells perturbing the base coat's normal only. The coat above stays
    # mirror-smooth, which is exactly the depth real paint has.
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 4200.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.035
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    nt.links.new(vor.outputs["Distance"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def water_material() -> bpy.types.Material:
    m = bpy.data.materials.new("Water")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Roughness"].default_value = 0.0
    bsdf.inputs["Transmission Weight"].default_value = 1.0
    bsdf.inputs["IOR"].default_value = 1.333
    try:
        m.use_raytrace_refraction = True
        m.surface_render_method = "DITHERED"
    except AttributeError:
        pass
    return m


def foam_material() -> bpy.types.Material:
    """Soap foam: white, soft, a little translucent at the edges where the bubbles are thin."""
    m = bpy.data.materials.new("Foam")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.95, 0.96, 0.98, 1)
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Subsurface Weight"].default_value = 0.6
    bsdf.inputs["Subsurface Radius"].default_value = (0.006, 0.006, 0.007)
    bsdf.inputs["Specular IOR Level"].default_value = 0.35
    return m


def bubble_material() -> bpy.types.Material:
    """The skin of a soap bubble: white, glossy, every one carrying its own small highlight."""
    m = bpy.data.materials.new("Bubble")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.9, 0.92, 0.95, 1)
    bsdf.inputs["Roughness"].default_value = 0.18
    bsdf.inputs["Subsurface Weight"].default_value = 0.3
    bsdf.inputs["Subsurface Radius"].default_value = (0.002, 0.002, 0.0025)
    bsdf.inputs["Coat Weight"].default_value = 1.0
    bsdf.inputs["Coat Roughness"].default_value = 0.02
    return m


def bead_mesh(name: str, radius: float, squash: float, subdiv: int) -> bpy.types.Object:
    """A droplet sitting on a waxed surface: a sphere flattened against it."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdiv, radius=radius)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (1.0, 1.0, squash)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    obj.hide_render = True
    obj.hide_viewport = True
    return obj


# ── geometry nodes: beads and foam, divided by a moving front ──────────────

def foam_blanket(N, L, geometry, rinsed, taper, mat):
    """
    The body of the foam: a continuous, lumpy layer lifted a few millimetres off the paint.
    Bubbles alone leave gaps the paint shows through, and real wash foam has none — it is a
    blanket with bubbles on its skin, cut away wherever the paint is rinsed.

    Its thickness runs down to almost nothing over the last few centimetres before the front,
    so the edge is a thin film sliding off rather than a cliff — and the grid the cut follows
    is never tall enough to show as a staircase.
    """
    sub = N.new("GeometryNodeSubdivideMesh")
    sub.inputs["Level"].default_value = 3
    L.new(geometry, sub.inputs["Mesh"])

    pos = N.new("GeometryNodeInputPosition")

    def octave(scale, detail, lo, hi):
        tex = N.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = detail
        L.new(pos.outputs["Position"], tex.inputs["Vector"])
        rng = N.new("ShaderNodeMapRange")
        rng.inputs["To Min"].default_value = lo
        rng.inputs["To Max"].default_value = hi
        L.new(tex.outputs["Fac"], rng.inputs["Value"])
        return rng.outputs["Result"]

    # Two scales: the soft heaps a foam lance leaves, and the grain of the bubbles in them.
    heaps = octave(16.0, 6.0, 0.0, 0.0055)
    grain = octave(150.0, 3.0, 0.0, 0.0009)
    both = N.new("ShaderNodeMath"); both.operation = "ADD"
    L.new(heaps, both.inputs[0]); L.new(grain, both.inputs[1])
    thin = N.new("ShaderNodeMath"); thin.operation = "MULTIPLY"
    L.new(both.outputs[0], thin.inputs[0]); L.new(taper, thin.inputs[1])
    floor = N.new("ShaderNodeMath"); floor.operation = "ADD"   # never coincident with the paint
    L.new(thin.outputs[0], floor.inputs[0]); floor.inputs[1].default_value = 0.0003

    nrm = N.new("GeometryNodeInputNormal")
    lift = N.new("ShaderNodeVectorMath"); lift.operation = "SCALE"
    L.new(nrm.outputs["Normal"], lift.inputs[0])
    L.new(floor.outputs[0], lift.inputs["Scale"])
    setp = N.new("GeometryNodeSetPosition")
    L.new(sub.outputs["Mesh"], setp.inputs["Geometry"])
    L.new(lift.outputs["Vector"], setp.inputs["Offset"])

    cut = N.new("GeometryNodeDeleteGeometry")
    cut.domain = "POINT"
    L.new(setp.outputs["Geometry"], cut.inputs["Geometry"])
    L.new(rinsed, cut.inputs["Selection"])

    setm = N.new("GeometryNodeSetMaterial")
    setm.inputs["Material"].default_value = mat
    L.new(cut.outputs["Geometry"], setm.inputs["Geometry"])
    return setm.outputs["Geometry"]


def scatter(panel, front: bpy.types.Object, bead: bpy.types.Object, bubble: bpy.types.Object,
            water: bpy.types.Material, foam: bpy.types.Material, bubbles: bpy.types.Material) -> None:
    """
    One modifier scatters both. Every point on the panel is either still under foam or already
    rinsed, decided by which side of the moving `front` it lies on — with noise on the boundary
    so the foam's edge is ragged, the way it actually slides off a car.
    """
    tree = bpy.data.node_groups.new("Wash", "GeometryNodeTree")
    tree.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N = tree.nodes
    L = tree.links

    gin_raw = N.new("NodeGroupInput")
    gout = N.new("NodeGroupOutput")

    # Only the stretch of panel near the camera gets beads and foam. The lens sees about a
    # quarter of a metre at a time; building foam along all 1.6 m every frame was most of the
    # render time, spent on geometry that was never in the picture.
    cam_info = N.new("GeometryNodeObjectInfo")
    cam_info.transform_space = "RELATIVE"
    cam_info.inputs["Object"].default_value = CROP_TARGET
    cam_sep = N.new("ShaderNodeSeparateXYZ")
    L.new(cam_info.outputs["Location"], cam_sep.inputs["Vector"])
    cpos = N.new("GeometryNodeInputPosition")
    cpsep = N.new("ShaderNodeSeparateXYZ")
    L.new(cpos.outputs["Position"], cpsep.inputs["Vector"])
    dx = N.new("ShaderNodeMath"); dx.operation = "SUBTRACT"
    L.new(cpsep.outputs["X"], dx.inputs[0]); L.new(cam_sep.outputs["X"], dx.inputs[1])
    adx = N.new("ShaderNodeMath"); adx.operation = "ABSOLUTE"
    L.new(dx.outputs[0], adx.inputs[0])
    far = N.new("FunctionNodeCompare"); far.data_type = "FLOAT"; far.operation = "GREATER_THAN"
    L.new(adx.outputs[0], far.inputs[0]); far.inputs[1].default_value = 0.34
    crop = N.new("GeometryNodeDeleteGeometry")
    crop.domain = "FACE"
    L.new(gin_raw.outputs["Geometry"], crop.inputs["Geometry"])
    L.new(far.outputs["Result"], crop.inputs["Selection"])

    class _Cropped:
        """Stands in for the group input: the scatter layers read the cropped panel."""
        outputs = {"Geometry": crop.outputs["Geometry"]}
    gin = _Cropped()

    # where the front is, in the panel's own space
    finfo = N.new("GeometryNodeObjectInfo")
    finfo.transform_space = "RELATIVE"
    finfo.inputs["Object"].default_value = front
    fsep = N.new("ShaderNodeSeparateXYZ")
    L.new(finfo.outputs["Location"], fsep.inputs["Vector"])

    def side_mask(offset: float, seed: int, invert: bool):
        """True on the points beyond the front (foam) or behind it (rinsed)."""
        pos = N.new("GeometryNodeInputPosition")
        psep = N.new("ShaderNodeSeparateXYZ")
        L.new(pos.outputs["Position"], psep.inputs["Vector"])
        noise = N.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 9.0
        noise.inputs["Detail"].default_value = 6.0
        L.new(pos.outputs["Position"], noise.inputs["Vector"])
        nmap = N.new("ShaderNodeMapRange")
        nmap.inputs["To Min"].default_value = -0.09
        nmap.inputs["To Max"].default_value = 0.09
        L.new(noise.outputs["Fac"], nmap.inputs["Value"])
        edge = N.new("ShaderNodeMath"); edge.operation = "ADD"
        L.new(psep.outputs["X"], edge.inputs[0]); L.new(nmap.outputs["Result"], edge.inputs[1])
        shifted = N.new("ShaderNodeMath"); shifted.operation = "ADD"
        L.new(fsep.outputs["X"], shifted.inputs[0]); shifted.inputs[1].default_value = offset
        cmp = N.new("FunctionNodeCompare")
        cmp.data_type = "FLOAT"
        cmp.operation = "LESS_THAN" if invert else "GREATER_THAN"
        L.new(edge.outputs[0], cmp.inputs[0]); L.new(shifted.outputs[0], cmp.inputs[1])
        return cmp.outputs["Result"]

    def layer(density: float, inst, mat, scale_min: float, scale_max: float, power: float,
              mask, seed: int, lift: float, on=None):
        dist = N.new("GeometryNodeDistributePointsOnFaces")
        dist.distribute_method = "RANDOM"
        dist.inputs["Density"].default_value = density
        dist.inputs["Seed"].default_value = seed
        L.new(on if on is not None else gin.outputs["Geometry"], dist.inputs["Mesh"])
        L.new(mask, dist.inputs["Selection"])

        # Sizes follow a power curve: a crowd of tiny beads and a few big ones, which is what
        # water on a fresh coat of wax does.
        rnd = N.new("FunctionNodeRandomValue")
        rnd.data_type = "FLOAT"
        rnd.inputs["Seed"].default_value = seed + 1
        powr = N.new("ShaderNodeMath"); powr.operation = "POWER"
        L.new(rnd.outputs[0], powr.inputs[0]); powr.inputs[1].default_value = power
        rng = N.new("ShaderNodeMapRange")
        rng.inputs["To Min"].default_value = scale_min
        rng.inputs["To Max"].default_value = scale_max
        L.new(powr.outputs[0], rng.inputs["Value"])

        align = N.new("FunctionNodeAlignEulerToVector")
        align.axis = "Z"
        L.new(dist.outputs["Normal"], align.inputs["Vector"])

        oinfo = N.new("GeometryNodeObjectInfo")
        oinfo.inputs["Object"].default_value = inst
        inst_node = N.new("GeometryNodeInstanceOnPoints")
        L.new(dist.outputs["Points"], inst_node.inputs["Points"])
        L.new(oinfo.outputs["Geometry"], inst_node.inputs["Instance"])
        L.new(align.outputs["Rotation"], inst_node.inputs["Rotation"])
        L.new(rng.outputs["Result"], inst_node.inputs["Scale"])

        # Sit the instances on the surface, not centred in it.
        nrm = N.new("GeometryNodeInputNormal")
        off = N.new("ShaderNodeVectorMath"); off.operation = "SCALE"
        L.new(nrm.outputs["Normal"], off.inputs[0]); off.inputs["Scale"].default_value = lift
        setp = N.new("GeometryNodeSetPosition")
        L.new(inst_node.outputs["Instances"], setp.inputs["Geometry"])
        L.new(off.outputs["Vector"], setp.inputs["Offset"])

        setm = N.new("GeometryNodeSetMaterial")
        setm.inputs["Material"].default_value = mat
        L.new(setp.outputs["Geometry"], setm.inputs["Geometry"])
        return setm.outputs["Geometry"]

    def foam_depth():
        """How far behind the ragged front a point lies, clamped to 0..1 over three centimetres."""
        pos = N.new("GeometryNodeInputPosition")
        psep = N.new("ShaderNodeSeparateXYZ")
        L.new(pos.outputs["Position"], psep.inputs["Vector"])
        noise = N.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 9.0
        noise.inputs["Detail"].default_value = 6.0
        L.new(pos.outputs["Position"], noise.inputs["Vector"])
        nmap = N.new("ShaderNodeMapRange")
        nmap.inputs["To Min"].default_value = -0.09
        nmap.inputs["To Max"].default_value = 0.09
        L.new(noise.outputs["Fac"], nmap.inputs["Value"])
        edge = N.new("ShaderNodeMath"); edge.operation = "ADD"
        L.new(psep.outputs["X"], edge.inputs[0]); L.new(nmap.outputs["Result"], edge.inputs[1])
        behind = N.new("ShaderNodeMath"); behind.operation = "SUBTRACT"
        L.new(fsep.outputs["X"], behind.inputs[0]); L.new(edge.outputs[0], behind.inputs[1])
        ramp = N.new("ShaderNodeMapRange")
        ramp.interpolation_type = "SMOOTHSTEP"
        ramp.inputs["From Min"].default_value = 0.0
        ramp.inputs["From Max"].default_value = 0.03
        L.new(behind.outputs[0], ramp.inputs["Value"])
        return ramp.outputs["Result"]

    def clustered(mask, scale: float, threshold: float):
        """Foam bubbles gather in colonies, not an even sprinkle: keep the points inside the clumps."""
        pos = N.new("GeometryNodeInputPosition")
        tex = N.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        tex.inputs["Detail"].default_value = 3.0
        L.new(pos.outputs["Position"], tex.inputs["Vector"])
        cmp = N.new("FunctionNodeCompare")
        cmp.data_type = "FLOAT"
        cmp.operation = "GREATER_THAN"
        L.new(tex.outputs["Fac"], cmp.inputs[0]); cmp.inputs[1].default_value = threshold
        both = N.new("FunctionNodeBooleanMath"); both.operation = "AND"
        L.new(mask, both.inputs[0]); L.new(cmp.outputs["Result"], both.inputs[1])
        return both.outputs["Boolean"]

    # Foam lies on the near side of the front and the rinsed paint beyond it; the front sweeps
    # past the camera, so the shot opens under foam and ends on clean, beaded paint.
    rinsed = side_mask(0.0, 3, invert=False)
    covered = side_mask(0.0, 5, invert=True)

    beads_big = layer(5200, bead, water, 0.35, 2.4, 3.2, rinsed, 11, 0.0)
    beads_mist = layer(26000, bead, water, 0.08, 0.32, 1.6, rinsed, 13, 0.0)
    blanket = foam_blanket(N, L, gin.outputs["Geometry"], side_mask(0.0, 7, invert=False), foam_depth(), foam)
    # Bubbles are scattered on the blanket itself, so they ride its heaps instead of sinking into
    # them, and sit a little sunk into its skin the way they do in real foam.
    always = N.new("FunctionNodeInputBool"); always.boolean = True
    foam_body = layer(420000, bubble, bubbles, 0.22, 0.95, 1.6, clustered(always.outputs[0], 55.0, 0.42), 17, -0.0004, on=blanket)
    foam_crust = layer(50000, bubble, bubbles, 0.8, 2.2, 2.4, clustered(always.outputs[0], 22.0, 0.5), 19, -0.0006, on=blanket)
    # The rim: where the foam thins out at its edge it breaks up into loose bubbles. A dense
    # band of small ones along the outline is what hides the grid the cut has to follow.
    near_edge = N.new("FunctionNodeCompare"); near_edge.data_type = "FLOAT"; near_edge.operation = "LESS_THAN"
    L.new(foam_depth(), near_edge.inputs[0]); near_edge.inputs[1].default_value = 0.35
    foam_rim = layer(900000, bubble, bubbles, 0.18, 0.7, 1.4, near_edge.outputs["Result"], 23, -0.0002, on=blanket)

    join = N.new("GeometryNodeJoinGeometry")
    for g in (gin_raw.outputs["Geometry"], beads_big, beads_mist, blanket, foam_body, foam_crust, foam_rim):
        L.new(g, join.inputs["Geometry"])
    L.new(join.outputs["Geometry"], gout.inputs["Geometry"])

    mod = panel.modifiers.new("Wash", "NODES")
    mod.node_group = tree


# ── light and camera ───────────────────────────────────────────────────────

def strip_light(name, location, rotation, size_x, size_y, energy, colour=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = size_x, size_y
    data.energy = energy
    data.color = colour
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    bpy.context.collection.objects.link(obj)
    return obj


def lighting():
    """
    A car studio: a black room with long thin softboxes. Their reflections are the long
    highlights that run along a body panel in every car advert — the light is the subject.
    """
    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.004, 0.005, 1)
    bpy.context.scene.world = world

    key = strip_light("Key", (0.0, -0.55, 1.05), (math.radians(28), 0, 0), 3.2, 0.06, 70)
    second = strip_light("Second", (0.0, -1.05, 0.62), (math.radians(62), 0, 0), 3.2, 0.035, 22, (0.92, 0.96, 1.0))
    fill = strip_light("Fill", (0.0, -1.6, -0.2), (math.radians(100), 0, 0), 4.0, 1.4, 0.3, (1.0, 0.92, 0.88))
    rim = strip_light("Rim", (0.0, 0.9, 0.9), (math.radians(-35), 0, 0), 3.0, 0.08, 14)
    # A rake: low and nearly parallel to the panel, from the far end. On paint it adds a falloff
    # along the length; on foam it is the only light that shows the heaps and the bubbles.
    rake = strip_light("Rake", (1.15, -0.10, 0.10), (0, math.radians(84), math.radians(8)), 0.9, 0.5, 9, (1.0, 0.97, 0.94))
    return key, second, fill, rim


def camera_rig(front):
    """
    A low track along the flank, close enough that a bead fills a few pixels and the panel
    falls into bokeh behind the focus — the camera language of a macro product shot.
    """
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 85
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 2.4
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    focus = bpy.data.objects.new("Focus", None)
    bpy.context.collection.objects.link(focus)
    cam_data.dof.focus_object = focus

    track = cam.constraints.new("TRACK_TO")
    track.target = focus
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"

    # Keyframes. The camera drifts right to left (forward, on a page that reads that way)
    # and climbs a touch at the end, so the last frames look along the shoulder line.
    keys = [
        (1,   (0.38, -0.62, 0.18), (0.22, 0.0, 0.05)),
        (74,  (0.05, -0.58, 0.16), (-0.05, 0.0, 0.05)),
        (144, (-0.30, -0.50, 0.24), (-0.38, 0.02, 0.09)),
    ]
    for frame, loc, aim in keys:
        cam.location = loc
        cam.keyframe_insert("location", frame=frame)
        focus.location = aim
        focus.keyframe_insert("location", frame=frame)

    # The foam front runs ahead of the camera: the frame opens under foam and ends rinsed.
    for frame, x in ((1, 0.62), (16, 0.55), (100, -0.62), (144, -0.95)):
        front.location.x = x
        front.keyframe_insert("location", index=0, frame=frame)
    for obj in (cam, focus, front):
        if obj.animation_data and obj.animation_data.action:
            for fc in _fcurves(obj.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = "BEZIER"
                    kp.easing = "EASE_IN_OUT"
    return cam


def _fcurves(action):
    """Blender 5 keeps F-curves in layered channelbags; older versions on the action."""
    if hasattr(action, "fcurves") and action.fcurves:
        return list(action.fcurves)
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out


def shine_sweep(key):
    """The payoff: in the last two seconds the key light slides along, and the highlight with it."""
    key.location.x = 0.0
    key.keyframe_insert("location", index=0, frame=106)
    key.location.x = -0.9
    key.keyframe_insert("location", index=0, frame=144)


# ── render settings ────────────────────────────────────────────────────────

def configure_render(width, height):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = width, height
    sc.render.resolution_percentage = 100
    ee = sc.eevee
    ee.taa_render_samples = 96 if QUALITY == "final" else 24
    for attr, val in (("use_raytracing", True), ("use_shadows", True), ("use_volumetric_shadows", False)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
    if hasattr(ee, "ray_tracing_options"):
        ee.ray_tracing_options.resolution_scale = "1" if QUALITY == "final" else "2"
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Punchy"
    except TypeError:
        pass
    sc.view_settings.exposure = -0.3

    # A soft bloom on the highlights, from the compositor: EEVEE no longer draws it itself.
    # Blender 5 keeps the compositor as a node group on the scene; older versions as a tree.
    try:
        if hasattr(sc, "compositing_node_group"):
            tree = bpy.data.node_groups.new("Bloom", "CompositorNodeTree")
            tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
            sc.compositing_node_group = tree
            rl = tree.nodes.new("CompositorNodeRLayers")
            out = tree.nodes.new("NodeGroupOutput")
            glare = tree.nodes.new("CompositorNodeGlare")
            _glare_settings(glare)
            tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
            tree.links.new(glare.outputs["Image"], out.inputs[0])
        else:
            sc.use_nodes = True
            nt = sc.node_tree
            rl = nt.nodes.get("Render Layers") or nt.nodes.new("CompositorNodeRLayers")
            comp = nt.nodes.get("Composite") or nt.nodes.new("CompositorNodeComposite")
            glare = nt.nodes.new("CompositorNodeGlare")
            _glare_settings(glare)
            nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
            nt.links.new(glare.outputs["Image"], comp.inputs["Image"])
    except Exception as exc:  # the bloom is polish; a missing one must not stop the render
        print("BLOOM_SKIPPED", exc)


def _glare_settings(glare) -> None:
    """Fog glow on the brightest highlights only. Blender 5 made these sockets, not properties."""
    values = {"Type": "Fog Glow", "Quality": "High", "Threshold": 1.0, "Size": 0.6, "Strength": 0.35}
    for name, value in values.items():
        sock = glare.inputs.get(name)
        if sock is not None:
            try:
                sock.default_value = value
                continue
            except (TypeError, AttributeError):
                pass
        prop = name.lower().replace(" ", "_")
        if prop == "type":
            prop, value = "glare_type", "FOG_GLOW"
        if hasattr(glare, prop):
            try:
                setattr(glare, prop, value if not isinstance(value, str) else value.upper().replace(" ", "_"))
            except (TypeError, AttributeError):
                pass


def render_still(path: pathlib.Path, frame: int) -> None:
    sc = bpy.context.scene
    sc.frame_set(frame)
    if hasattr(sc.render.image_settings, "media_type"):
        sc.render.image_settings.media_type = "IMAGE"
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = 88
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def render_video(path: pathlib.Path, start: int, end: int, step: int = 1) -> None:
    """
    H.264 with a keyframe every eight frames: the page seeks this file on every scroll tick,
    and a long GOP would make every seek decode back to a distant keyframe.
    """
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end, sc.frame_step = start, end, step
    s = sc.render.image_settings
    if hasattr(s, "media_type"):          # Blender 5 keeps video behind its own media type
        s.media_type = "VIDEO"
    s.file_format = "FFMPEG"
    ff = sc.render.ffmpeg
    ff.format = "MPEG4"
    ff.codec = "H264"
    ff.constant_rate_factor = "MEDIUM"
    ff.ffmpeg_preset = "GOOD"
    ff.gopsize = 8
    ff.max_b_frames = 0
    ff.use_max_b_frames = True
    ff.audio_codec = "NONE"
    sc.render.filepath = str(path.with_suffix(""))
    bpy.ops.render.render(animation=True)
    # Blender names a movie after its frame range ("wash0001-0144.mp4"); give it the name the
    # page asks for.
    produced = sorted(path.parent.glob(path.stem + "*" + path.suffix), key=lambda p: p.stat().st_mtime)
    if produced and produced[-1] != path:
        if path.exists():
            path.unlink()
        produced[-1].rename(path)


# ── build ──────────────────────────────────────────────────────────────────

def build():
    reset()
    panel = body_panel()
    panel.data.materials.append(paint_material())

    front = bpy.data.objects.new("FoamFront", None)
    bpy.context.collection.objects.link(front)
    front.parent = panel

    key, *_ = lighting()
    cam = camera_rig(front)
    shine_sweep(key)

    global CROP_TARGET
    CROP_TARGET = cam
    bead = bead_mesh("Bead", 0.0022, 0.42, 3)
    bubble = bead_mesh("Bubble", 0.0016, 0.9, 2)
    scatter(panel, front, bead, bubble, water_material(), foam_material(), bubble_material())

    focus_on_surface(cam)
    return panel, cam, key, front


def focus_on_surface(cam) -> None:
    """
    Put the focus where the lens actually meets the subject.

    The aim points are guesses at where the panel is; at f/2.4 and 85mm the depth of field is a
    centimetre, so a guess that lands just behind the foam blurs the whole frame. Instead, at
    every frame of the shot a ray goes from the lens through the centre of the picture, and the
    focus is keyed to wherever it hits — the top of the foam while there is foam, the paint and
    its beads once it is gone.
    """
    sc = bpy.context.scene
    focus = cam.data.dof.focus_object
    cam.data.dof.focus_object = None
    for frame in range(sc.frame_start, sc.frame_end + 1, 4):
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        origin = cam.matrix_world.translation
        direction = (cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))).normalized()
        hit, location, *_ = sc.ray_cast(dg, origin, direction)
        if hit:
            cam.data.dof.focus_distance = (location - origin).length
            cam.data.keyframe_insert("dof.focus_distance", frame=frame)
    if focus is not None:
        focus.hide_render = True


def strip_rig(cam, key, front) -> None:
    """
    The hero's strip: a still frame along the shoulder line of rinsed, beaded paint, with the
    key light sliding out and back so the highlight breathes. Keyed out-and-back over 96
    frames and rendered 1–96, so frame 97 would be frame 1: the loop has no seam.
    """
    sc = bpy.context.scene
    for obj in (cam, cam.data, key, front):
        obj.animation_data_clear()
    for c in list(cam.constraints):
        cam.constraints.remove(c)
    front.location.x = -3.0                      # everything in view is rinsed
    cam.location = (0.02, -0.66, 0.085)
    _aim(cam, Vector((-0.02, 0.0, 0.07)))
    cam.data.lens = 100
    for frame, x in ((1, 0.32), (49, -0.32), (97, 0.32)):
        key.location.x = x
        key.keyframe_insert("location", index=0, frame=frame)
    for fc in _fcurves(key.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.easing = "EASE_IN_OUT"
    sc.frame_start, sc.frame_end = 1, 96
    focus_on_surface(cam)


def _aim(obj, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def mode(name: str) -> bool:
    return f"--{name}" in ARGS


if __name__ == "__main__":
    panel, cam, key, front = build()
    samples_video = 40 if QUALITY == "final" else 16
    if STILL_ONLY:
        configure_render(1280, 720)
        for f in (1, 46, 80, 134):
            render_still(OUT / f"probe-{f:03d}.jpg", f)
    if mode("shot"):
        configure_render(1600, 900)
        bpy.context.scene.eevee.taa_render_samples = samples_video
        render_still(OUT / "wash-poster.jpg", 1)
        render_still(OUT / "wash-end.jpg", SHOT_FRAMES)
        render_video(OUT / "wash.mp4", 1, SHOT_FRAMES)
    if mode("stills"):
        # Four moments of the same shot, at the unequal sizes the feature rows lay out —
        # rendered at twice their display size so they stay sharp on a dense screen.
        for name, frame, (w, h) in (("still-foam", 1, (720, 900)), ("still-edge", 52, (960, 640)),
                                     ("still-beads", 84, (640, 640)), ("still-shine", 140, (960, 640))):
            configure_render(w, h)
            bpy.context.scene.eevee.taa_render_samples = 64 if QUALITY == "final" else 24
            render_still(OUT / f"{name}.jpg", frame)
    if mode("strip"):
        strip_rig(cam, key, front)
        configure_render(1600, 320)
        bpy.context.scene.eevee.taa_render_samples = samples_video
        render_still(OUT / "strip-poster.jpg", 1)
        render_video(OUT / "strip.mp4", 1, 96)
    print("BUILD_WASH_DONE")
