#!/usr/bin/env python
"""Build src/data/atlas.json — the single snapshot the atlas renders.

Inputs (all read-only, pointed at by absolute paths below):
  1. D:/Downloads/NVIDIA显卡历代产品全览.docx   — 10 Word tables, 7 generations + appendix
  2. ../gpu-server-compare/data/{gpus,servers,market,sources}.json
  3. ../model-chronicle/src/data/{deepseek,zai,kimi,index}.ts

Every number keeps the source it came from: a docx row is `docx`, a matched
gpu-server-compare row adds `market` facts, model facts come from the HF
snapshot. Nothing is invented; missing stays null.
"""
from __future__ import annotations

import json
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT.parent
DOCX = Path(os.environ.get("ATLAS_DOCX", "D:/Downloads/NVIDIA显卡历代产品全览.docx"))
GSC = WEB / "gpu-server-compare" / "data"
MC = WEB / "model-chronicle" / "src" / "data"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

ARCHS = [
    # (name, short, years, table index, key tech line)
    ("Blackwell", "BLK", "2024—2026", 0, "FP4 · 双die · HBM3e"),
    ("Hopper", "HOP", "2022—2025", 1, "Transformer Engine · HBM3"),
    ("Ada Lovelace", "ADA", "2022—2024", 2, "DLSS 3 · 4N"),
    ("Ampere", "AMP", "2020—2022", 3, "TF32 · MIG"),
    ("Turing", "TUR", "2018—2020", 4, "RT Core · Tensor Core"),
    ("Volta", "VOL", "2017—2019", 5, "首代 Tensor Core · HBM2"),
    ("Pascal", "PAS", "2016—2018", 6, "FP16 · HBM2 · 16nm"),
    ("Maxwell", "MAX", "2014—2016", 7, "能效跃迁"),
    ("Kepler", "KEP", "2012—2014", 8, "GK110 · 动态并行"),
    ("Fermi", "FER", "2010—2011", 9, "首代完整 GPGPU"),
]


def cell_text(tc) -> str:
    return "".join(t.text or "" for t in tc.findall(".//w:t", NS)).strip()


def read_tables() -> list[list[list[str]]]:
    with zipfile.ZipFile(DOCX) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    out = []
    for tbl in root.findall(".//w:tbl", NS):
        rows = []
        for tr in tbl.findall("w:tr", NS):
            rows.append([cell_text(tc) for tc in tr.findall("w:tc", NS)])
        out.append(rows)
    return out


def parse_date(text: str) -> tuple[str, str]:
    text = (text or "").strip()
    m = re.search(r"(\d{4})\s*年(?:\s*(\d{1,2})\s*月)?", text)
    if not m:
        # appendix tables only print a bare year
        m2 = re.fullmatch(r"(\d{4})", text)
        if not m2:
            return "", "unknown"
        return f"{int(m2.group(1)):04d}-06-01", "year"
    y = int(m.group(1))
    mo = int(m.group(2)) if m.group(2) else None
    if mo:
        return f"{y:04d}-{mo:02d}-01", "month"
    return f"{y:04d}-06-01", "year"


def parse_number(text: str) -> float | None:
    m = re.search(r"(\d+(?:\.\d+)?)", text.replace(",", ""))
    return float(m.group(1)) if m else None


def parse_vram(text: str) -> tuple[float | None, float | None, str | None, str | None]:
    """Return (total GB, per-GPU GB, memory type, label as printed).

    Multi-GPU boards are printed as `4×16GB GDDR6（共64GB）`: the board total is
    useful for the spec sheet, but the per-GPU slice is what belongs on a
    single-card axis, so both are kept.
    """
    if not text or text.strip() in {"—", "-"}:
        return None, None, None, None
    total = re.search(r"共\s*(\d+(?:\.\d+)?)\s*GB", text)
    nums = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*GB", text)]
    gb = float(total.group(1)) if total else (max(nums) if nums else None)
    stack = re.search(r"(\d+)\s*×\s*(\d+(?:\.\d+)?)\s*GB", text)
    per = float(stack.group(2)) if stack else gb
    typ = None
    for cand in ("HBM3e", "HBM3", "HBM2e", "HBM2", "GDDR7", "GDDR6X", "GDDR6", "GDDR5X", "GDDR5"):
        if cand in text:
            typ = cand
            break
    return gb, per, typ, text.strip()


def segment_of(cat: str) -> str:
    if "数据中心" in cat:
        return "datacenter"
    if "专业" in cat:
        return "workstation"
    if "半专业" in cat:
        return "semi"
    if "消费" in cat:
        return "consumer"
    return "other"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


ALIASES = {
    # docx label -> gpu-server-compare id (only NVIDIA rows are listed)
    "rtx5090": "rtx5090",
    "rtx5080": "rtx5080",
    "rtx4090": "rtx4090",
    "rtx4080super": "rtx4080s",
    "rtx4070super": "rtx4070s",
    "rtx5070ti": "rtx5070ti",
    "rtx5070": "rtx5070",
    "rtx5060ti": "rtx5060ti_16",
    "rtx5060": "rtx5060",
    "rtx5050": "rtx5050",
    "rtx4060ti": "rtx4060ti_16",
    "rtx4060": "rtx4060",
    "h100sxm": "h100_sxm",
    "h200sxm": "h200_sxm",
    "b200": "b200_sxm",
    "b300blackwellultra": "b300_sxm",
    "l40s": "l40s",
    "l4": "l4",
    "rtx6000ada": "rtx6000ada",
    "rtxpro6000blackwell": "rtx_pro6000_bw",
}

PREFIX_ALIASES = [
    ("a100", "a100_80"),
    ("h100", "h100_sxm"),
    ("h200", "h200_sxm"),
    ("rtxpro6000", "rtx_pro6000_bw"),
    ("l40s", "l40s"),
]


def build_products() -> list[dict]:
    tables = read_tables()
    products = []
    seen: dict[str, int] = {}
    for arch, short, years, idx, tech in ARCHS:
        if idx >= len(tables):
            continue
        rows = tables[idx]
        header = rows[0]
        has_fp32 = any("FP32" in h for h in header)
        for row in rows[1:]:
            if len(row) < 3 or not row[0]:
                continue
            if row[0].startswith("型号"):
                continue
            name = row[0].strip()
            cat = row[1].strip() if len(row) > 1 else ""
            if has_fp32:
                cuda, vram, fp32, date_txt, note = (
                    row[2] if len(row) > 2 else "",
                    row[3] if len(row) > 3 else "",
                    row[4] if len(row) > 4 else "",
                    row[5] if len(row) > 5 else "",
                    row[6] if len(row) > 6 else "",
                )
            else:
                cuda, vram, fp32, date_txt, note = (
                    "",
                    row[2] if len(row) > 2 else "",
                    "",
                    row[3] if len(row) > 3 else "",
                    row[4] if len(row) > 4 else "",
                )
            gb, per, vtype, vlabel = parse_vram(vram)
            date, precision = parse_date(date_txt)
            if not date:
                continue
            base_id = f"{short.lower()}-{norm(name)}"
            n = seen.get(base_id, 0)
            seen[base_id] = n + 1
            pid = base_id if n == 0 else f"{base_id}-{n + 1}"
            products.append(
                {
                    "id": pid,
                    "name": name,
                    "arch": arch,
                    "archShort": short,
                    "archYears": years,
                    "archTech": tech,
                    "tier": segment_of(cat),
                    "category": cat,
                    "cuda": parse_number(cuda) if cuda not in {"—", "-", ""} else None,
                    "vramGb": gb,
                    "vramPerGpuGb": per,
                    "vramType": vtype,
                    "vramLabel": vlabel,
                    "fp32": parse_number(fp32) if fp32 not in {"—", "-", ""} else None,
                    "date": date,
                    "datePrecision": precision,
                    "dateText": date_txt.strip(),
                    "note": note.strip(),
                    "china": "中国特供" in cat or "特供" in note,
                    "brand": "NVIDIA",
                    "source": "docx",
                }
            )
    return products


def load_gpus() -> list[dict]:
    return json.loads((GSC / "gpus.json").read_text(encoding="utf-8"))


def match_market(products: list[dict], gpus: list[dict]) -> tuple[list[dict], list[dict]]:
    """Attach market/perf facts to docx rows; return leftovers as extra nodes.

    Matching is alias-first and strictly one-to-one: only NVIDIA rows are
    candidates, and a gpu id is consumed by the first product that claims it
    (docx order follows flagship → entry, so the flagship keeps the match).
    """
    by_id = {g["id"]: g for g in gpus}
    used: set[str] = set()
    for p in products:
        key = norm(p["name"])
        target = ALIASES.get(key)
        cand = by_id.get(target) if target else None
        if not cand:
            # a few docx labels carry a parenthetical variant, e.g. A100 SXM（80GB）
            for prefix, gid in PREFIX_ALIASES:
                if key.startswith(prefix) and gid not in used:
                    cand = by_id.get(gid)
                    break
        if cand and cand["id"] in used:
            cand = None
        if cand:
            used.add(cand["id"])
            p["marketId"] = cand["id"]
            p["msrpUsd"] = cand.get("msrp_usd")
            p["priceCny"] = (cand.get("region_price") or {}).get("CN")
            p["regionAvail"] = (cand.get("region_avail") or {}).get("CN")
            p["perfAi"] = cand.get("perf_ai_llm")
            p["perfGaming"] = cand.get("perf_gaming_4k")
            p["tdpW"] = cand.get("tdp_w")
            p["bandwidthGbps"] = cand.get("bandwidth_gbps")
            p["tensorTflops"] = cand.get("tensor_tflops")
            p["nvlink"] = cand.get("nvlink")
            p["multiMax"] = cand.get("multi_max")
            if p["vramGb"] is None:
                p["vramGb"] = cand.get("vram_gb")
        # fall back to note-derived FP16 tensor so every node has a size driver
        if p["fp32"] is None:
            m = re.search(r"FP16(?:（稠密）|\(稠密\))?\s*([\d.]+)\s*TFLOPS", p["note"])
            if m:
                p["fp16Note"] = float(m.group(1))

    extras = []
    for g in gpus:
        if g["id"] in used:
            continue
        extras.append(
            {
                "id": f"x-{g['id']}",
                "name": g["name"],
                "arch": g.get("arch") or g["brand"],
                "archShort": (g.get("arch") or g["brand"])[:3].upper(),
                "archYears": "",
                "archTech": "",
                "tier": {
                    "consumer_gpu": "consumer",
                    "workstation_gpu": "workstation",
                    "datacenter_gpu": "datacenter",
                    "enterprise_gpu": "datacenter",
                }.get(g.get("device_class"), "other"),
                "category": g.get("device_class"),
                "cuda": g.get("cuda_cores"),
                "vramGb": g.get("vram_gb"),
                "vramType": g.get("vram_type"),
                "vramLabel": f"{g.get('vram_gb')}GB {g.get('vram_type') or ''}".strip(),
                "fp32": g.get("fp32_tflops"),
                "date": g.get("release"),
                "datePrecision": "day",
                "dateText": g.get("release"),
                "note": "gpu-server-compare 收录; 非 docx 覆盖型号",
                "china": (g.get("region_avail") or {}).get("CN") == "restricted",
                "brand": g["brand"],
                "source": "gpu-server-compare",
                "marketId": g["id"],
                "msrpUsd": g.get("msrp_usd"),
                "priceCny": (g.get("region_price") or {}).get("CN"),
                "regionAvail": (g.get("region_avail") or {}).get("CN"),
                "perfAi": g.get("perf_ai_llm"),
                "perfGaming": g.get("perf_gaming_4k"),
                "tdpW": g.get("tdp_w"),
                "bandwidthGbps": g.get("bandwidth_gbps"),
                "tensorTflops": g.get("tensor_tflops"),
                "nvlink": g.get("nvlink"),
                "multiMax": g.get("multi_max"),
            }
        )
    return products, extras


def build_servers(gpus: list[dict], market: dict) -> list[dict]:
    by_id = {g["id"]: g for g in gpus}
    quotes = {}
    for q in market.get("quotes", []):
        quotes.setdefault(q["device_id"], []).append(q)
    out = []
    for s in json.loads((GSC / "servers.json").read_text(encoding="utf-8")):
        g = by_id.get(s.get("gpu_id") or "")
        q = (quotes.get(s["id"]) or [None])[0]
        out.append(
            {
                "id": s["id"],
                "name": s["name"],
                "vendor": s.get("vendor"),
                "kind": s.get("device_class"),
                "gpu": s.get("gpu"),
                "gpuId": s.get("gpu_id"),
                "gpuCount": s.get("gpu_count"),
                "powerKw": s.get("power_kw"),
                "rackUnits": s.get("rack_units"),
                "segment": s.get("segment"),
                "priceUsd": s.get("price_usd"),
                "priceCny": q["price_cny"] if q else None,
                "priceRaw": q["raw"] if q else None,
                "date": g.get("release") if g else None,
                "datePrecision": "derived",
                "dateNote": f"随 {g['name']} 平台上市" if g else "上市时间未收录",
            }
        )
    return out


def load_models() -> tuple[list[dict], list[dict], list[dict]]:
    def load_ts(name: str) -> dict:
        text = (MC / name).read_text(encoding="utf-8")
        # `import type { Dataset }` also has braces, and the literal ends with `as Dataset`.
        m = re.search(r"export const dataset: Dataset =\s*(\{.*\})\s*as\s+Dataset", text, re.S)
        if not m:
            raise SystemExit(f"cannot locate dataset literal in {name}")
        return json.loads(m.group(1))

    orgs_ts = (MC / "index.ts").read_text(encoding="utf-8")
    # `OrgMeta[]` also contains a bracket, so anchor on the assignment itself.
    m = re.search(r"ORGS[^=]*=\s*(\[.*?\n\])", orgs_ts, re.S)
    if not m:
        raise SystemExit("cannot locate ORGS array in model-chronicle/src/data/index.ts")
    orgs = json.loads(m.group(1))
    datasets = [load_ts("deepseek.ts"), load_ts("zai.ts"), load_ts("kimi.ts")]
    releases, breakthroughs = [], []
    for d in datasets:
        for r in d["releases"]:
            releases.append(
                {
                    "id": r["id"],
                    "name": r["name"],
                    "org": d["org"],
                    "orgName": d["orgName"],
                    "family": r.get("family"),
                    "tier": r.get("tier"),
                    "date": r["date"],
                    "totalParams": r.get("totalParams"),
                    "paramsB": r.get("paramsB"),
                    "activeB": r.get("activeB"),
                    "contextLength": r.get("contextLength"),
                    "license": r.get("license"),
                    "downloads": r.get("downloads") or 0,
                    "likes": r.get("likes") or 0,
                    "breakthrough": r.get("breakthrough"),
                    "innovations": r.get("innovations") or [],
                    "summary": r.get("summary") or "",
                    "headline": r.get("headline"),
                    "paramsSource": r.get("paramsSource"),
                    "repo": r.get("repo"),
                }
            )
        for b in d["breakthroughs"]:
            breakthroughs.append(
                {
                    "id": b["id"],
                    "label": b["label"],
                    "name": b["name"],
                    "date": b["date"],
                    "lane": b["lane"],
                    "org": d["org"],
                    "orgName": d["orgName"],
                    "releaseId": b.get("releaseId"),
                    "impact": b.get("impact"),
                    "magnitude": b.get("magnitude"),
                    "mechanism": b.get("mechanism"),
                }
            )
    return releases, breakthroughs, orgs


def main() -> None:
    gpus = load_gpus()
    market = json.loads((GSC / "market.json").read_text(encoding="utf-8"))
    products = build_products()
    products, extras = match_market(products, gpus)
    servers = build_servers(gpus, market)
    releases, breakthroughs, orgs = load_models()

    # keep only the datasets the site can place on the axis
    products = [p for p in products if p["date"]]
    extras = [x for x in extras if x["date"]]
    servers = [s for s in servers if s["date"]]

    atlas = {
        "generatedAt": "2026-11-03",
        "archs": [
            {
                "name": a,
                "short": s,
                "years": y,
                "tech": t,
                "first": min(
                    (p["date"] for p in products if p["arch"] == a), default=None
                ),
                "last": max(
                    (p["date"] for p in products if p["arch"] == a), default=None
                ),
                "count": sum(1 for p in products if p["arch"] == a),
            }
            for a, s, y, _, t in ARCHS
        ],
        "products": products,
        "extras": extras,
        "servers": servers,
        "models": releases,
        "breakthroughs": breakthroughs,
        "orgs": orgs,
        "market": {
            "updatedAt": market.get("updated_at"),
            "quotes": market.get("quotes", []),
        },
        "counts": {
            "docxProducts": len(products),
            "extraProducts": len(extras),
            "servers": len(servers),
            "models": len(releases),
            "breakthroughs": len(breakthroughs),
            "china": sum(1 for p in products if p["china"]),
            "matched": sum(1 for p in products if p.get("marketId")),
        },
    }
    dest = ROOT / "src" / "data" / "atlas.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(atlas, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(atlas["counts"], ensure_ascii=False))
    print("wrote", dest, dest.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
