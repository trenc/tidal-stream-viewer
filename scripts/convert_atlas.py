#!/usr/bin/env python3
"""
convert_atlas.py nc/*.nc --out public_html/atlas
convert_atlas.py --reindex --out public_html/atlas
"""
import argparse, json, re, statistics
from collections import Counter
from datetime import datetime, timezone, date
from pathlib import Path
import numpy as np
import xarray as xr

U_STD = "eastward_sea_water_velocity_due_to_tides"
V_STD = "northward_sea_water_velocity_due_to_tides"
SENTINEL, SCALE = -32768, 0.001
TIDAL_REFERENCE = datetime(1950, 1, 1, 12, tzinfo=timezone.utc)
MINUTES = {"second": 1 / 60, "minute": 1, "hour": 60, "day": 1440}
METRES_PER_DEGREE = 111_195

# "IROISE-560-250M-5min": area, atlas number, grid size in metres, time step in minutes
SHORT_NAME = re.compile(r"^(?P<area>.+)-(?P<num>\d+)-(?P<res>\d+)M-(?P<step>\d+)min$", re.I)


def atlas_id_for(src: Path) -> str:
    """File names are unique, atlas numbers are not."""
    return re.sub(r"[^a-z0-9]+", "-", src.stem.lower()).strip("-")


def find_var(ds, std):
    for v in ds.data_vars.values():
        if v.attrs.get("standard_name") == std:
            return v
    raise ValueError(f"no variable with standard_name={std}")


def plane(var, c):
    v = var.isel(coeff=c)
    if "Z" in v.dims:
        v = v.isel(Z=0)
    return v.transpose("time", "Y", "X").values


def quantize(a):
    out = np.full(a.shape, SENTINEL, dtype=np.int16)
    ok = np.isfinite(a)
    out[ok] = np.clip(np.rint(a[ok] / SCALE), -32767, 32767)
    return out


def tidal_offsets(time_var):
    m = re.match(r"(second|minute|hour|day)s?\s+since\s+(\S+)", time_var.attrs.get("units", ""), re.I)
    if not m:
        raise ValueError("unsupported time units")
    origin = datetime.fromisoformat(m.group(2).replace("Z", "+00:00"))
    if origin.tzinfo is None:
        origin = origin.replace(tzinfo=timezone.utc)
    if origin.date() != date(1950, 1, 1):
        raise ValueError("not a tidal atlas (time origin is not 1950-01-01)")
    base = (origin - TIDAL_REFERENCE).total_seconds() / 60
    factor = MINUTES[m.group(1).lower()]
    return [round(base + float(v) * factor) for v in time_var.values]


def reference_of(ds):
    port = str(ds.attrs.get("Portref", "")).strip()
    if not port:
        return None
    return {
        "port": port.title(),
        "code": str(ds.attrs.get("code_du_port_de_reference", "")),
        "type": "LW" if int(ds.attrs.get("isBM", 0)) == 1 else "HW",
        "title": str(ds.attrs.get("title", "")),
    }


def label_of(ds, atlas_id):
    parts = [
        ds.attrs.get("source", atlas_id),
        ds.attrs.get("spacestep", ""),
        ds.attrs.get("timestep", ""),
        ds.attrs.get("Portref", ""),
    ]
    return " · ".join(str(p) for p in parts if p)


def convert(src: Path, root: Path, atlas_id: str) -> dict:
    ds = xr.open_dataset(src, mask_and_scale=True, decode_times=False)
    u, v = find_var(ds, U_STD), find_var(ds, V_STD)
    if not str(u.attrs.get("units", "")).startswith("m"):
        raise ValueError(f"unexpected velocity units: {u.attrs.get('units')}")

    lat, lon = ds["latitude"].values, ds["longitude"].values
    if lat.ndim != 1 or lon.ndim != 1:
        raise ValueError("curvilinear grid not supported")
    if lon[0] > lon[-1]:
        raise ValueError("descending longitude not supported")

    flip = bool(lat[0] > lat[-1])
    if flip:
        lat = lat[::-1]

    offsets = tidal_offsets(ds["time"])
    coeffs = [int(c) for c in ds["coeff"].values]
    nt, ny, nx = len(offsets), len(lat), len(lon)
    out = root / atlas_id
    out.mkdir(parents=True, exist_ok=True)

    max_ms = 0.0
    for c in range(len(coeffs)):
        uc, vc = plane(u, c), plane(v, c)
        max_ms = max(max_ms, float(np.nanmax(np.hypot(uc, vc))))
        for t in range(nt):
            frame = np.stack([quantize(uc[t]), quantize(vc[t])], axis=-1)
            if flip:
                frame = frame[::-1]
            (out / f"f_c{c}_t{t}.bin").write_bytes(np.ascontiguousarray(frame).astype("<i2").tobytes())

    depths = [float(d) for d in ds["depth"].values] if "depth" in ds else []
    depths = depths if all(np.isfinite(depths)) else []

    meta = {
        "id": atlas_id, "label": label_of(ds, atlas_id), "sourceFile": src.name,
        "nt": nt, "ny": ny, "nx": nx,
        "coeffs": coeffs, "offsets": offsets,
        "reference": reference_of(ds), "depths": depths,
        "lat": [round(float(x), 6) for x in lat],
        "lon": [round(float(x), 6) for x in lon],
        "scale": SCALE, "sentinel": SENTINEL,
        "maxSpeedKn": round(max_ms * 1.943844, 2),
        "release": ds.attrs.get("Release_date", ""),
        "frame": "f_c{c}_t{t}.bin",
    }
    (out / "meta.json").write_text(json.dumps(meta))
    return meta


# --- index entries (everything below works from meta.json alone, so --reindex needs no NetCDF) ---


def short_label(meta: dict) -> str:
    """'Iroise (560) · 250 m · 5 min' from the file name; the long label if the name has another shape."""
    stem = Path(meta.get("sourceFile", "")).stem
    m = SHORT_NAME.match(stem.split("_")[-1])
    if not m:
        return meta["label"]

    area = m["area"].replace("-", " ").title()
    return f"{area} ({m['num']}) · {m['res']} m · {m['step']} min"


def bbox_of(meta: dict) -> list:
    """[south, west, north, east]"""
    lat, lon = meta["lat"], meta["lon"]
    return [round(min(lat), 4), round(min(lon), 4), round(max(lat), 4), round(max(lon), 4)]


def resolution_m(meta: dict) -> int:
    """Grid size in metres, from the latitude steps."""
    lat = meta["lat"]
    steps = [abs(b - a) for a, b in zip(lat, lat[1:])]
    return round(statistics.median(steps) * METRES_PER_DEGREE) if steps else 0


def index_entry(meta: dict) -> dict:
    return {
        "id": meta["id"],
        "label": short_label(meta),
        "kind": "frames",
        "version": meta["release"],
        "bbox": bbox_of(meta),
        "resolutionM": resolution_m(meta),
    }


def load_index(root: Path):
    """Returns (entries of other atlas kinds, frame entries by id) from the shared index.json."""
    path = root / "index.json"
    if not path.exists():
        return [], {}
    existing = json.loads(path.read_text()).get("atlases", [])
    others = [e for e in existing if e.get("kind") != "frames"]
    frames = {e["id"]: e for e in existing if e.get("kind") == "frames"}
    return others, frames


def write_index(root: Path, others: list, frames: dict):
    ordered = others + sorted(frames.values(), key=lambda e: e["label"])
    (root / "index.json").write_text(json.dumps({"atlases": ordered}, indent=1))


def warn_duplicate_labels(frames: dict):
    for label, n in Counter(e["label"] for e in frames.values()).items():
        if n > 1:
            print(f"WARN {n} atlases share the label '{label}'")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("files", nargs="*", type=Path)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--reindex", action="store_true", help="rebuild the frame entries from */meta.json")
    a = p.parse_args()

    a.out.mkdir(parents=True, exist_ok=True)
    others, frames = load_index(a.out)

    if a.reindex:
        metas = [json.loads(m.read_text()) for m in sorted(a.out.glob("*/meta.json"))]
        frames = {m["id"]: index_entry(m) for m in metas}
        print(f"reindexed {len(metas)} frame atlases")
    else:
        if not a.files:
            p.error("give at least one .nc file, or use --reindex")

        seen = {}
        for f in a.files:
            atlas_id = atlas_id_for(f)
            if atlas_id in seen:
                print(f"FAIL {f.name}: same id as {seen[atlas_id]}")
                continue
            seen[atlas_id] = f.name

            try:
                meta = convert(f, a.out, atlas_id)
                frames[atlas_id] = index_entry(meta)
                print("ok  ", f.name, "->", atlas_id)
            except Exception as e:
                print("FAIL", f.name, e)

    warn_duplicate_labels(frames)
    write_index(a.out, others, frames)
    print(f"{len(frames)} frame atlases, {len(others)} other atlases in index")
