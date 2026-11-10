#!/usr/bin/env python
"""Build src/data/atlas.json — the single snapshot the atlas renders.

Inputs (all read-only, pointed at by absolute paths below):
  1. D:/Downloads/NVIDIA显卡历代产品全览.docx   — 10 Word tables, 7 generations + appendix
  2. vendor/gpu-server-compare/{gpus,servers,market,sources}.json   (snapshot of the old repo)
  3. vendor/model-chronicle/{deepseek,zai,kimi,index}.ts            (snapshot of the old repo)

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
# Sources are vendored into ./vendor so the build no longer depends on the
# sibling repos existing. Override with ATLAS_GSC / ATLAS_MC if you re-sync.
GSC = Path(os.environ.get("ATLAS_GSC", ROOT / "vendor" / "gpu-server-compare"))
MC = Path(os.environ.get("ATLAS_MC", ROOT / "vendor" / "model-chronicle"))
# 人工复核台账（每条数据的核对次数与最近复核时间），与数据分仓管理，
# 这样重跑 build 不会冲掉人工记录。没有台账时全部按「未复核」处理。
REVIEWS = Path(os.environ.get("ATLAS_REVIEWS", ROOT / "data" / "reviews.json"))
# 产业链维度（HBM / 互联 / 供电散热 / 制程 / 集群），人工整理，每条带来源。
INDUSTRY = Path(os.environ.get("ATLAS_INDUSTRY", ROOT / "data" / "industry.json"))

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
    # The source .docx is not in the repo (and can move between machines), so the
    # parsed rows are also kept as a snapshot. Same rows -> same atlas.json.
    if not DOCX.exists():
        snap = ROOT / "vendor" / "docx-products.json"
        if not snap.exists():
            raise SystemExit(
                f"docx 不存在（{DOCX}）且没有 vendor/docx-products.json 快照，无法重建数据。"
            )
        return json.loads(snap.read_text(encoding="utf-8"))

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


def load_reviews() -> tuple[dict, dict]:
    """人工复核台账：id -> {count, lastReviewedAt, by, note}。

    数据是人工抓取整理的，准确率无法自动保证，所以每一条都单独记录
    「被人工核对过几次 / 最近一次是哪天」。台账与 atlas.json 分离，
    重跑构建不会把人工记录冲掉；台账缺失时一律按 0 次处理。
    """
    if not REVIEWS.exists():
        return {}, {}
    try:
        doc = json.loads(REVIEWS.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"复核台账 {REVIEWS} 不是合法 JSON：{exc}") from exc
    items = doc.get("items")
    return (items if isinstance(items, dict) else {}), doc


def attach_reviews(rows: list[dict], ledger: dict) -> None:
    for r in rows:
        entry = ledger.get(r["id"]) or {}
        count = entry.get("count")
        r["review"] = {
            "count": int(count) if isinstance(count, (int, float)) else 0,
            "lastReviewedAt": entry.get("lastReviewedAt"),
            "by": entry.get("by"),
            "note": entry.get("note"),
        }


def review_summary(groups: dict[str, list[dict]], doc: dict) -> dict:
    by_kind: dict[str, dict] = {}
    total = reviewed = 0
    last: str | None = None
    for kind, rows in groups.items():
        ok = [r for r in rows if r["review"]["count"] > 0]
        total += len(rows)
        reviewed += len(ok)
        for r in ok:
            d = r["review"]["lastReviewedAt"]
            if d and (last is None or d > last):
                last = d
        by_kind[kind] = {
            "total": len(rows),
            "reviewed": len(ok),
            "unreviewed": len(rows) - len(ok),
        }
    return {
        "updatedAt": doc.get("updatedAt"),
        "reviewer": doc.get("reviewer"),
        "note": doc.get("note"),
        "stats": {
            "total": total,
            "reviewed": reviewed,
            "unreviewed": total - reviewed,
            "lastReviewedAt": last,
            "byKind": by_kind,
        },
    }


def load_industry() -> dict:
    """产业链五类维度：hbm / interconnect / power / process / clusters。

    和产品表不同，这些数字来自公开报道与规范页，不是同一份文档的原文，
    所以每条都带 source 与统一的 asOf，页面上标注为「外部口径」。
    """
    if not INDUSTRY.exists():
        return {}
    doc = json.loads(INDUSTRY.read_text(encoding="utf-8"))
    for key in INDUSTRY_KEYS:
        doc[key] = doc.get(key) or []
    return doc


INDUSTRY_KEYS = ("hbm", "interconnect", "power", "process", "clusters")


# 外部补充来源：论坛汇总、拆解贴、行业文章等二手资料。官方规格里没有、
# 或只精确到年份的字段才用它补；每条字段单独记来源与置信度，与本地冲突的
# 不覆盖，统一进 conflicts 清单，页面按「补」标注出来。
SUPPLEMENTS = Path(os.environ.get("ATLAS_SUPPLEMENTS", ROOT / "data" / "supplements"))


def date_precision(value: str) -> str:
    return {4: "year", 7: "month", 10: "day"}.get(len(value), "day")


def date_prefix(value: str, precision: str) -> str:
    if precision == "year":
        return value[:4]
    if precision == "month":
        return value[:7]
    return value[:10]


def date_text(value: str) -> str:
    """和 docx 里一致的写法：2018年9月13日 / 2018年9月 / 2018年。"""
    parts = value.split("-")
    if len(parts) == 3:
        return f"{parts[0]}年{int(parts[1])}月{int(parts[2])}日"
    if len(parts) == 2:
        return f"{parts[0]}年{int(parts[1])}月"
    return f"{parts[0]}年"


def load_supplements() -> list[dict]:
    if not SUPPLEMENTS.exists():
        return []
    docs = []
    for path in sorted(SUPPLEMENTS.glob("*.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"补充来源 {path.name} 不是合法 JSON：{exc}") from exc
        doc.setdefault("id", path.stem)
        docs.append(doc)
    return docs


def apply_supplements(rows_by_id: dict[str, dict], docs: list[dict]) -> list[dict]:
    """把二手来源补进空字段，返回按来源汇总的清单（生效字段 + 冲突）。"""
    summary = []
    for doc in docs:
        src = doc.get("id")
        applied = []
        conflicts = []
        for item in doc.get("items", []):
            row = rows_by_id.get(item.get("id"))
            if row is None:
                print(f"⚠ 补充来源 {src} 的 {item.get('id')} 在本次快照里不存在，已跳过")
                continue
            for field, raw in (item.get("fields") or {}).items():
                spec = raw if isinstance(raw, dict) else {"value": raw}
                value = spec.get("value")
                if value is None:
                    continue
                current = row.get(field)
                override = bool(spec.get("override"))
                take = False
                if current in (None, ""):
                    take = True
                elif current == value:
                    continue  # 和本地一致，不必记补录
                elif field == "date" and isinstance(current, str):
                    prec = row.get("datePrecision") or date_precision(current)
                    same = date_prefix(str(value), prec) == date_prefix(current, prec)
                    take = same and date_precision(str(value)) != prec
                if not take and not override:
                    conflicts.append(
                        {
                            "id": item["id"],
                            "name": row.get("name"),
                            "field": field,
                            "local": current,
                            "article": value,
                            "resolution": "keep-local",
                            "quote": spec.get("quote"),
                        }
                    )
                    continue
                row[field] = value
                if field == "date":
                    row["datePrecision"] = spec.get("precision") or date_precision(str(value))
                    row["dateText"] = date_text(str(value))
                row.setdefault("provenance", {})[field] = {
                    "src": src,
                    "conf": spec.get("confidence") or "medium",
                    "override": override,
                    "quote": spec.get("quote"),
                }
                applied.append(
                    {
                        "id": item["id"],
                        "name": row.get("name"),
                        "field": field,
                        "value": value,
                        "conf": spec.get("confidence") or "medium",
                        "override": override,
                        "reason": spec.get("reason"),
                    }
                )
        declared = doc.get("conflicts") or []
        summary.append(
            {
                "id": src,
                "title": doc.get("title"),
                "url": doc.get("url"),
                "author": doc.get("author"),
                "publishedAt": doc.get("publishedAt"),
                "retrievedAt": doc.get("retrievedAt"),
                "level": doc.get("level") or "secondary",
                "note": doc.get("note"),
                "applied": applied,
                "conflicts": conflicts + [c for c in declared if c not in conflicts],
            }
        )
        if applied:
            print(f"  · 补充来源 {src}：生效 {len(applied)} 个字段，冲突 {len(summary[-1]['conflicts'])} 条")
    return summary


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

    # 二手来源补录：只填空字段 / 细化到日的日期，冲突项不覆盖
    supplements = apply_supplements(
        {r["id"]: r for r in products + extras + servers}, load_supplements()
    )

    ledger, ledger_doc = load_reviews()
    groups = {
        "hardware": products + extras,
        "server": servers,
        "model": releases,
        "breakthrough": breakthroughs,
    }
    for rows in groups.values():
        attach_reviews(rows, ledger)

    industry = load_industry()
    industry_rows = [r for k in INDUSTRY_KEYS for r in industry.get(k, [])]
    if industry_rows:
        attach_reviews(industry_rows, ledger)
        groups["industry"] = industry_rows

    reviews = review_summary(groups, ledger_doc)
    orphans = sorted(set(ledger) - {r["id"] for rows in groups.values() for r in rows})
    if orphans:
        print(f"⚠ 台账里有 {len(orphans)} 个 id 在本次快照中不存在：{', '.join(orphans[:8])}")

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
        "reviews": reviews,
        "industry": industry,
        "supplements": supplements,
        "counts": {
            "docxProducts": len(products),
            "extraProducts": len(extras),
            "servers": len(servers),
            "models": len(releases),
            "breakthroughs": len(breakthroughs),
            "china": sum(1 for p in products if p["china"]),
            "matched": sum(1 for p in products if p.get("marketId")),
            "industry": len(industry_rows),
            "supplements": sum(len(s["applied"]) for s in supplements),
            "supplementSources": len(supplements),
        },
    }
    dest = ROOT / "src" / "data" / "atlas.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(atlas, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(atlas["counts"], ensure_ascii=False))
    st = reviews["stats"]
    print(f"复核 {st['reviewed']}/{st['total']} 项（最近 {st['lastReviewedAt'] or '—'}）")
    print("wrote", dest, dest.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
