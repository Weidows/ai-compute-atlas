#!/usr/bin/env python
"""从「模型年鉴 · 大语言模型发布年表」里抽出基础技术节点，并生成「模型 → 技术」连线。

为什么要单独一个脚本：
- 技术节点必须能追到年表里那条一手记录（日期、机构、来源链接），不能手抄；
- 连线必须有证据句（模型档案自己写了「用了 X」），否则宁可不连。

输入：vendor/llm-timeline/releases.json（RACErace/llm-release-timeline 快照）、src/data/atlas.json
输出：data/llm-tech.json
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIMELINE = ROOT / "vendor" / "llm-timeline" / "releases.json"
ATLAS = ROOT / "src" / "data" / "atlas.json"
OUT = ROOT / "data" / "llm-tech.json"

SOURCE = {
    "id": "llm-release-timeline",
    "title": "模型年鉴 · 大语言模型发布年表",
    "url": "https://github.com/RACErace/llm-release-timeline",
    "author": "RACErace",
    "retrievedAt": "2026-11-03",
    "level": "secondary",
}

# 选进时间轴的技术节点：(本地 id, 短标签, 年表里的 name, lane)
# 只收「首次公开一种方法/架构」的记录；纯模型发布不放这里。
TECHS = [
    ("x-transformer", "Transformer", "Transformer", "架构"),
    ("x-moe-sparse", "Sparse MoE", "GShard", "架构"),
    ("x-flan-instruct", "Instruct", "FLAN", "后训练"),
    ("x-retro-rag", "RETRO", "RETRO", "推理"),
    ("x-instructgpt", "RLHF", "InstructGPT", "后训练"),
    ("x-chinchilla", "Chinchilla", "Chinchilla", "训练"),
    ("x-flamingo", "VLM", "Flamingo", "多模态"),
    ("x-rwkv", "RWKV", "RWKV", "架构"),
    ("x-mamba", "Mamba", "Mamba", "架构"),
    ("x-llada", "Diffusion LM", "LLaDA 8B", "架构"),
]

# 用一句话说明「它提出了什么」，直接取自年表的 note，不做转述。
SHORT = {
    "x-transformer": "以注意力机制取代循环结构，成为此后所有大模型的骨架",
    "x-moe-sparse": "用稀疏专家把 Transformer 扩到六千亿参数，只激活其中一部分",
    "x-flan-instruct": "把任务写成自然语言指令再微调，零样本迁移到没见过的任务",
    "x-retro-rag": "生成时检索外部语料片段，把结果拼进上下文",
    "x-instructgpt": "按人类反馈做强化学习，让模型真正「听指令」",
    "x-chinchilla": "训练预算固定时，参数少、数据多比参数堆大更划算",
    "x-flamingo": "把视觉编码器接进语言模型，支持图文交错输入",
    "x-rwkv": "用固定大小的状态做线性复杂度序列建模",
    "x-mamba": "选择性状态空间层，序列计算量随长度线性增长",
    "x-llada": "从零训练的扩散语言模型，先遮蔽再反向去噪生成",
}

# 关键词 → 技术。命中即认为「该模型用了这项技术」，需要在模型档案里找到证据句。
# 原则：词要够专，宁缺勿滥（「强化学习」这种太泛的不进表）。
ALIASES: dict[str, list[str]] = {
    # 年表里的基础技术
    "x-moe-sparse": ["混合专家", "MoE", "稀疏专家"],
    "x-flan-instruct": ["指令微调", "指令遵循"],
    "x-retro-rag": ["检索增强", "RAG"],
    "x-instructgpt": ["RLHF", "人类反馈"],
    "x-chinchilla": ["Chinchilla", "数据配比"],
    "x-flamingo": ["视觉编码器", "图文交错"],
    "x-rwkv": ["RWKV"],
    "x-mamba": ["Mamba", "状态空间"],
    "x-llada": ["扩散语言模型", "离散扩散"],
    # 本地已有的 DeepSeek 系列技术（标签短、容易误配，只用长关键词）
    "deepseekmoe": ["DeepSeekMoE", "细粒度专家", "共享专家"],
    "grpo": ["GRPO"],
    "mla": ["MLA"],
    "mtp": ["MTP", "多 token 预测", "多token预测"],
    "fp8-training": ["FP8"],
    "aux-loss-free": ["无辅助损失", "Aux-loss-free"],
    "pure-rl": ["纯强化学习", "无 SFT"],
    "hybrid-thinking": ["混合推理", "thinking / non-thinking", "双模式"],
    "dsa": ["DSA", "稀疏注意力"],
    "kimi-kimi-k3": ["KDA"],
    "kimi-kimi-linear-48b-a3b-instruct": ["KDA"],
}


def sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[。；！？])", text) if s.strip()]


def model_text(m: dict) -> str:
    head = m.get("headline") or {}
    return " ".join(
        [
            m.get("summary") or "",
            m.get("breakthrough") or "",
            " · ".join(m.get("innovations") or []),
            f"{head.get('metric', '')} {head.get('score', '')}" if head else "",
        ]
    )


def main() -> None:
    timeline = json.loads(TIMELINE.read_text(encoding="utf-8"))
    atlas = json.loads(ATLAS.read_text(encoding="utf-8"))
    models = atlas["models"]
    by_name = {r["name"]: r for r in timeline}

    techs = []
    for tid, label, tname, lane in TECHS:
        rec = by_name.get(tname)
        if not rec:
            raise SystemExit(f"年表里找不到「{tname}」，先确认 vendor 快照是否更新")
        techs.append(
            {
                "id": tid,
                "label": label,
                "name": SHORT[tid],
                "date": rec["date"],
                "lane": lane,
                "org": rec.get("org"),
                "orgName": rec.get("org"),
                "impact": SHORT[tid],
                "origin": "external",
                "note": rec.get("note"),
                "source": {"url": rec.get("url"), "name": rec.get("source"), "title": SOURCE["title"]},
            }
        )

    links = []
    for m in models:
        text = model_text(m)
        for tid, keys in ALIASES.items():
            hit = None
            for k in keys:
                for s in sentences(text):
                    i = s.lower().find(k.lower())
                    if i >= 0:
                        lo, hi = max(0, i - 28), min(len(s), i + len(k) + 34)
                        hit = ("…" if lo else "") + s[lo:hi].strip() + ("…" if hi < len(s) else "")
                        break
                if hit:
                    break
            if hit:
                links.append(
                    {
                        "model": m["id"],
                        "tech": tid,
                        "evidence": hit[:90],
                        "src": "model-profile",
                    }
                )

    # 引入者：只给「真·技术」节点补连线。GLM/Kimi 那批节点的 label 其实是基准名
    # （BFCL / SWE / INT4…），连上去只会多一条没有信息量的竖线。
    for b in atlas["breakthroughs"]:
        rel = b.get("releaseId")
        if not rel or b["id"] not in ALIASES:
            continue
        if any(l["model"] == rel and l["tech"] == b["id"] for l in links):
            continue
        links.append({"model": rel, "tech": b["id"], "evidence": "该技术由本模型首次提出", "src": "introducer"})

    # 去重（同 model+tech 只留第一条）
    seen = set()
    uniq = []
    for l in links:
        key = (l["model"], l["tech"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(l)
    uniq.sort(key=lambda l: (l["model"], l["tech"]))

    doc = {
        "asOf": "2026-11-03",
        "source": SOURCE,
        "techs": techs,
        "links": uniq,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    per_tech: dict[str, int] = {}
    for l in uniq:
        per_tech[l["tech"]] = per_tech.get(l["tech"], 0) + 1
    print(f"技术节点 {len(techs)} 个，连线 {len(uniq)} 条，覆盖模型 {len({l['model'] for l in uniq})} 个")
    for t in techs:
        print(f"  {t['id']:18} {t['date']} {per_tech.get(t['id'], 0):3} 条  {t['label']}")


if __name__ == "__main__":
    main()
