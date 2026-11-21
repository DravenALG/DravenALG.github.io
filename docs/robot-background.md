# Franka background (archived)

The 3D scene has been removed from the homepage. `index.html` no longer includes
the scene host, the Three.js import map, or the robot bootstrap script, and the
homepage stylesheet no longer reserves space for a canvas. Visiting the homepage
does not load the robot model or its rendering dependencies.

The files and notes below document the archived implementation.

### Local preview

Run `python3 -m http.server 8765` from this directory, then open
`http://localhost:8765`. No build step or backend is required.

### Franka background

The scene is 208 CSS pixels wide, with a 22:19 aspect ratio, and sits
beside the portrait and profile details (affiliation, email, and social links),
below the name and research tagline in the homepage hero. The desktop profile
row has enough space for all four social links; on smaller screens, links can
wrap as whole links. The scene remains vertically centered inside the profile
row, against the hero's light gray background. A rounded silver workbench,
fine blue grid, illuminated edge, and cool rim lighting give it a subtle studio
look. Rounded blocks retain the original grasp dimensions. All decorative
overlays are excluded from pointer picking. It scrolls with the page and has no visible captions or
controls. It is enabled at viewport widths of at least 960 CSS pixels. Smaller,
initially hidden, or offscreen profiles do not load Three.js, the model, or the
motion data. The scene loads after the page, runs at at most 30 FPS with a pixel
ratio capped at 1.5, and suspends rendering while the profile or tab is hidden.
WebGL failure leaves the ordinary homepage available.

The scene autoplays by default. Moving the pointer into it immediately resets
the arm, blocks, pending target, and any fade, then waits for a click. Click a
block to pick it; subsequent clicks choose the next target after the current
grasp completes. Moving within the scene does not reset again. Leaving the
scene resumes autoplay, finishing any ongoing grasp first. Every new pointer
entry starts a fresh manual round, even during a grasp or fade.

Keyboard focus also enters manual mode: arrow keys highlight an available block,
Enter or Space selects it, and Escape resets. The canvas has an accessible
label and focus outline, with no visible text or buttons. Reduced-motion
preferences suppress autoplay, including after the pointer leaves; explicit
selections still animate. All four blocks reset between completed rounds.

Runtime files are `robot-background.js` (lazy-loading gate), `assets/robot/`
(scene, joint hierarchy, and timeline), and `assets/franka/` (GLB and precomputed
motion). Motion is an illustrative kinematic animation, not a dynamics simulator
or a controller for real hardware.

**Checks:** Node.js 22.15+ can run `node --test tests/robot.test.mjs`. Tests load
the actual GLB and validate endpoints, joint limits, tabletop clearance, camera
framing, attachment, queueing, pause/resume, hover resets, and lazy-load gating.
Browser appearance, pointer/keyboard interaction, reduced-motion behavior, and
background-tab suspension should also be checked in Safari and Chrome. Preview
the 960 × 720, 1280 × 800, and 1920 × 1080 layouts, and check that 390 × 844 and
959 × 800 layouts do not request the 3D assets. No visual browser QA was completed in the
implementation session because browser access was unavailable.

**Asset maintenance:** The model is derived from the official
[Franka description repository](https://github.com/frankarobotics/franka_description)
at the commit recorded in `assets/franka/source.json`. Its meshes were converted
from Collada to GLB and simplified per material region; Apache-2.0 license and
NOTICE files are included beside the model. The original joint origins and
limits are retained in YAML. Three.js 0.180.0 and its GLTFLoader utilities are
vendored under `assets/vendor/three/`, with the MIT license. Visitors do not need
access to a third-party model or JavaScript CDN.

To regenerate assets, install the development-only Python packages `numpy`,
`scipy`, `PyYAML`, `trimesh==5.2.1`, `pycollada==0.9.3`, and
`fast-simplification==0.2.0` in a virtual environment, then run:

```sh
python scripts/prepare-franka.py
python scripts/generate-franka-motion.py
node --test tests/robot.test.mjs
```

Both generated files are committed with the site; these tools are not needed
for normal serving or GitHub Pages deployment. No deployment settings changed.
