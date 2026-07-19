# 🌿 Canopy — Biodiversity Field Lab

An interactive, vintage field-guide web app that celebrates **pollinators** through
rotatable 3D specimens. Built as a fan tribute to the **FIRST® CANOPY (2026–2027)**
biodiversity season and its **BIOBUZZ** game, whose scoring element — *Pollen* — is a
nod to the real pollinators explored here.

> *"In every flower, a story. In every pollinator, a connection."*

## ✨ Features

- **7 pollinator groups** — Bees, Wasps, Moths, Butterflies, Beetles, Hummingbirds, Bats — each with a real, animated 3D specimen.
- **360° 3D viewer** — rotation slider, auto-rotate, zoom, fullscreen; animated models play their own wing/flight animations.
- **Bilingual (TR / EN)** — one-click language toggle for the whole interface *and* content.
- **Field-guide panel** — family, traits, favourite flowers, range, ecological role, and a **forest-layer** indicator (Emergent · Canopy · Understory · Forest Floor).
- **Explore menu** — *Garden* (plant ↔ pollinator pairings), *Notes* (field discoveries), *Learn* (about the season).
- **Responsive** — three-column desktop layout that stacks into a single scroll column on narrow screens.

## 🚀 Run it

No build step — it's plain HTML + ES modules + [three.js](https://threejs.org) (vendored in `lib/`).

```bash
# from the project folder
python3 -m http.server 4174
# then open http://localhost:4174
```

(Any static file server works.)

## 🧩 Add your own specimen

The app is data-driven:

1. Drop a `.glb` into `models/` (rigged/animated GLBs work — skeletal bounds and
   spec-glossiness textures are handled automatically).
2. Add an entry to `data.js` (bilingual text, forest layer, flower fit).
3. Register the model + attribution in the `MODELS` map in `main.js`.

## 🎨 3D model credits

All specimens are **Creative Commons Attribution (CC-BY 4.0)** — see [`models/CREDITS.txt`](models/CREDITS.txt).
Attribution is also shown in-app beneath each specimen.

- **Orchid Bee** — *"Animated Bee"* by **sikoro**
- **Common Wasp** — *"Vespula Vulgaris (wasp)"* by **Nobilis the Palaeovespa**
- **Giant Peacock Moth** — *"Animated Peacock Moth"* by **Osian CG**
- **Monarch** — *"BUTTERFLY"* by **Rukh3D**
- **Rhinoceros Beetle** — *"Rhinoceros Beetle (Golofa Sp)"* by **RISD Nature Lab**
- **Ruby-throated Hummingbird** — *"Hummingbird Flying020"* by **SabininAA**
- **Lesser Long-nosed Bat** — *"Bat (Low Poly, Animated, Rigged)"* by **danielvanderkaaden**

## ⚠️ Disclaimer

This is a **fan-made, educational** project and is **not affiliated with, endorsed by,
or sponsored by *FIRST*®**. "FIRST", "FIRST CANOPY", and "BIOBUZZ" are trademarks of
*FIRST* (For Inspiration and Recognition of Science and Technology).
