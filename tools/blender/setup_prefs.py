"""
Points Blender at this machine's GPU and saves the choice.

Run once, headless:

    blender --background --python tools/blender/setup_prefs.py

Cycles starts on the CPU unless told otherwise. This machine has an Intel Core Ultra with
Intel Graphics, which Cycles drives through oneAPI, so that backend is selected and every
device it reports is switched on. The same script works on an NVIDIA or AMD machine: it picks
the first backend that actually reports a GPU, in the order those vendors prefer.
"""
import bpy

# The order a machine should be asked in: OptiX beats CUDA on NVIDIA, and the rest are the
# single backend their vendor offers.
PREFERRED = ["OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"]


def main() -> None:
    cycles = bpy.context.preferences.addons.get("cycles")
    if cycles is None:
        print("SW: the Cycles add-on is not enabled; nothing to configure")
        return

    prefs = cycles.preferences
    available = [t[0] for t in prefs.get_device_types(bpy.context)]
    chosen = None

    for backend in PREFERRED:
        if backend not in available:
            continue
        prefs.compute_device_type = backend
        prefs.get_devices()
        # The device list is the same whichever backend is selected, so a card is only this
        # backend's if the device says so. Asking only "is there a GPU here" picked OptiX on a
        # machine whose only card is Intel, and OptiX runs on NVIDIA hardware alone.
        if any(d.type == backend for d in prefs.devices):
            chosen = backend
            break

    if chosen is None:
        print("SW: no GPU backend reports a device; Cycles will render on the CPU")
        return

    for device in prefs.devices:
        # The CPU is left out on purpose: mixing it in costs more in scheduling than the
        # few cores add, on a laptop whose cores are also running the browser and the API.
        device.use = device.type != "CPU"

    bpy.ops.wm.save_userpref()
    on = [d.name for d in prefs.devices if d.use]
    print(f"SW: Cycles set to {chosen} using {on}")


main()
