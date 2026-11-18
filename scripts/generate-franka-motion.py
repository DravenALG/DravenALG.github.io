"""Generate and validate deterministic Panda pick/place paths; no IK runs in the browser.

Requires numpy, scipy and PyYAML. Run after prepare-franka.py.
The site serves the resulting motion.json directly, without a build step.
"""
from pathlib import Path
import json

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation
import yaml

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/franka"
KINEMATICS = yaml.safe_load((ASSETS / "kinematics.yaml").read_text())
LIMITS = yaml.safe_load((ASSETS / "joint_limits.yaml").read_text())
ORIGINS = [KINEMATICS[f"joint{i}"]["kinematic"] for i in range(1, 8)]


def matrix(xyz=(0, 0, 0), rpy=(0, 0, 0)):
    result = np.eye(4)
    result[:3, :3] = Rotation.from_euler("xyz", rpy).as_matrix()
    result[:3, 3] = xyz
    return result


TRANSFORMS = [matrix([o[k] for k in ("x", "y", "z")],
                     [o[k] for k in ("roll", "pitch", "yaw")]) for o in ORIGINS]
HAND = matrix((0, 0, 0.107), (0, 0, -np.pi / 4))
TCP = matrix((0, 0, 0.1034))
LOW = np.array([LIMITS[f"joint{i}"]["limit"]["lower"] for i in range(1, 8)])
HIGH = np.array([LIMITS[f"joint{i}"]["limit"]["upper"] for i in range(1, 8)])
DOWN = Rotation.from_euler("x", np.pi).as_matrix()
SIZE = 0.055


def forward(q, all_links=False):
    transform = np.eye(4)
    links = [transform.copy()]
    for origin, angle in zip(TRANSFORMS, q):
        transform = transform @ origin @ matrix(rpy=(0, 0, angle))
        links.append(transform.copy())
    hand = transform @ HAND
    return (links, hand) if all_links else hand @ TCP


def solve(position, seed):
    def error(q):
        actual = forward(q)
        rotation = Rotation.from_matrix(DOWN.T @ actual[:3, :3]).as_rotvec()
        # Resolve redundancy consistently so sequential targets cannot drift
        # toward a joint limit during the cross-table transfer.
        return np.r_[actual[:3, 3] - position, rotation * 0.3, q[2] * .01]
    result = least_squares(error, seed, bounds=(LOW + .015, HIGH - .015),
                           ftol=1e-10, xtol=1e-10, gtol=1e-10, max_nfev=180)
    if np.linalg.norm(error(result.x)) > 0.00005:
        raise ValueError(f"Unreachable waypoint: {position}, residual={error(result.x)}")
    return result.x


def main():
    home_position = np.array([.38, 0, .38])
    home = solve(home_position, np.array([0, -.5, 0, -2.2, 0, 1.8, .785]))
    objects = []
    colors = [("blue", "Blue", "#679bcb"), ("coral", "Coral", "#df987f"),
              ("sage", "Sage", "#94b6a0"), ("gold", "Gold", "#d9bb75")]
    pick_positions = [[.38, -.24, SIZE / 2], [.55, -.24, SIZE / 2],
                      [.38, -.08, SIZE / 2], [.55, -.08, SIZE / 2]]
    place_positions = [[.40, .17, SIZE / 2 + .012], [.53, .17, SIZE / 2 + .012],
                       [.40, .30, SIZE / 2 + .012], [.53, .30, SIZE / 2 + .012]]
    worst_step = 0
    for (identity, label, color), pick, place in zip(colors, pick_positions, place_positions):
        q = home.copy()
        position = home_position.copy()
        segments = []

        def move(target, seconds, label):
            nonlocal q, position, worst_step
            target = np.array(target)
            count = max(12, int(np.linalg.norm(target - position) / .008))
            samples = [q.tolist()]
            for point in np.linspace(position, target, count + 1)[1:]:
                following = solve(point, q)
                worst_step = max(worst_step, float(np.max(np.abs(following - q))))
                if np.max(np.abs(following - q)) > .15:
                    raise ValueError("Discontinuous IK solution")
                q = following
                samples.append(q.tolist())
            segments.append({"kind": "move", "duration": seconds, "label": label,
                             "samples": samples})
            position = target

        move([pick[0], pick[1], .24], 1.6, "Reaching")
        move(pick, 1.25, "Lowering")
        segments.append({"kind": "close", "duration": .55, "label": "Grasping"})
        move([pick[0], pick[1], .28], 1.4, "Lifting")
        move([place[0], place[1], .28], 1.9, "Carrying")
        move(place, 1.35, "Placing")
        segments.append({"kind": "open", "duration": .5, "label": "Releasing"})
        move([place[0], place[1], .28], 1.3, "Retracting")
        # A joint-space return resolves the redundant seventh DoF to identical home.
        samples = np.linspace(q, home, 40).tolist()
        segments.append({"kind": "move", "duration": 1.8,
                         "label": "Returning", "samples": samples})
        objects.append({"id": identity, "label": label, "color": color,
                        "pick": pick, "place": place, "segments": segments})
    data = {"version": 1, "origins": ORIGINS, "limits": {"lower": LOW.tolist(), "upper": HIGH.tolist()},
            "home": home.tolist(), "size": SIZE, "objects": objects}
    (ASSETS / "motion.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(f"Generated {len(objects)} paths; largest sample step {worst_step:.4f} rad")


if __name__ == "__main__":
    main()
