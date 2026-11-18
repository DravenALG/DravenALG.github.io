"""Rebuild the homepage's vendored Panda meshes (not needed to serve the site).

Requires: trimesh==5.2.1 pycollada==0.9.3 fast-simplification==0.2.0
Source meshes and their license are pinned to an upstream commit.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import tempfile
import urllib.request

import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets/franka"
COMMIT = "7aeeddc449edf8d62b594f9e36a81da53e7796f9"
BASE = f"https://raw.githubusercontent.com/frankarobotics/franka_description/{COMMIT}/"
PARTS = [f"link{i}" for i in range(8)] + ["hand", "finger"]


def download(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as response:
        target.write_bytes(response.read())


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="franka-meshes-") as directory:
        cache = Path(directory)
        with ThreadPoolExecutor(max_workers=6) as executor:
            list(executor.map(lambda part: download(
                BASE + f"meshes/robots/fer/visual/{part}.dae", cache / f"{part}.dae"
            ), PARTS))
        output = trimesh.Scene(base_frame="world")
        report = {}
        for part in PARTS:
            source = trimesh.load_scene(cache / f"{part}.dae")
            output.graph.update(frame_to=part, frame_from="world", matrix=np.eye(4))
            count = 0
            for index, node in enumerate(source.graph.nodes_geometry):
                transform, geometry = source.graph[node]
                mesh = source.geometry[geometry].copy()
                material = mesh.visual.material
                if hasattr(material, "to_pbr"):
                    material = material.to_pbr()
                # The original materials are untextured. Keep their color regions.
                material.metallicFactor = 0.12
                material.roughnessFactor = 0.48
                if len(mesh.faces) > 1800:
                    mesh = mesh.simplify_quadric_decimation(face_count=1800)
                mesh.visual = trimesh.visual.TextureVisuals(material=material)
                output.add_geometry(mesh, node_name=f"{part}_surface_{index}",
                                    geom_name=f"{part}_mesh_{index}",
                                    parent_node_name=part, transform=transform)
                count += len(mesh.faces)
            report[part] = count
            print(part, "bounds", source.bounds.round(4).tolist(), flush=True)
        output.export(DEST / "panda.glb")
    download(BASE + "LICENSE", DEST / "LICENSE.txt")
    download(BASE + "NOTICE", DEST / "NOTICE.txt")
    for name in ["kinematics", "joint_limits"]:
        download(BASE + f"robots/fer/{name}.yaml", DEST / f"{name}.yaml")
    (DEST / "source.json").write_text(json.dumps({
        "repository": "https://github.com/frankarobotics/franka_description",
        "commit": COMMIT,
        "source": "meshes/robots/fer/visual/*.dae",
        "changes": "Converted to GLB; decimated material regions to at most 1800 triangles; adjusted roughness and metallic values.",
        "triangles": report,
    }, indent=2) + "\n")
    print(json.dumps({"triangles": report, "bytes": (DEST / "panda.glb").stat().st_size}))


if __name__ == "__main__":
    main()
