/** Shapes shared by the generated dataset and every view that renders it. */

export type Family =
  | 'LLM'
  | 'Coder'
  | 'Math'
  | 'VL'
  | 'OCR'
  | 'Prover'
  | 'Janus'
  | 'Reasoning'
  | 'Image'
  | 'Video'
  | 'Audio'
  | 'Agent'

/** How loudly a release should shout on the timeline. */
export type Tier = 'flagship' | 'major' | 'minor'

export interface Benchmark {
  /** Display name, e.g. "MMLU", "AIME 2024", "SWE-bench Verified". */
  name: string
  /** Numeric score, always the same unit as `unit`. */
  score: number
  /** "%" | "Elo" | "pass@1" | ... */
  unit: string
  /** Evaluation flavour, e.g. "EM", "Pass@1", "avg@8". */
  note?: string
}

export interface Release {
  /** Stable slug, also used as React key. */
  id: string
  /** Hugging Face repo id, e.g. "deepseek-ai/DeepSeek-V3". */
  repo: string
  /** Which lab shipped it; lets combined views label each node. */
  org?: string
  /** Display name, e.g. "DeepSeek-V3". */
  name: string
  family: Family
  /** ISO date used as the x coordinate. */
  date: string
  tier: Tier
  /** Human strings exactly as the model card states them. */
  totalParams: string | null
  /** "card" = printed on the model card; "inferred" = taken from the same-generation backbone. */
  paramsSource: 'card' | 'inferred' | null
  activatedParams: string | null
  contextLength: string | null
  license: string | null
  /** Snapshot metrics from the Hugging Face API. */
  downloads: number
  likes: number
  /** Total bytes HF reports for the repo (weights + variants). */
  storageBytes: number | null
  /** Human label for `storageBytes`, e.g. "475.3 GB". */
  storageLabel: string | null
  /** Parameter count in billions, parsed for charts (MoE = total). */
  paramsB: number | null
  /** Activated parameters in billions, for sparse models. */
  activeB: number | null
  /** Best cross-generation comparable score, used by the capability curve. */
  headline: { metric: string; score: number } | null
  /** Sibling repos folded into this single timeline node. */
  variants: string[]
  /** Technique tags shown as chips. */
  innovations: string[]
  benchmarks: Benchmark[]
  /** One-paragraph Chinese description of what this release was. */
  summary: string
  /** The single most important thing it introduced, if any. */
  breakthrough: string | null
}

/** A technique worth its own marker on the timeline, independent of releases. */
export interface Breakthrough {
  id: string
  date: string
  /** Short English/code-style label, e.g. "MLA". */
  label: string
  /** Chinese name, e.g. "多头潜在注意力". */
  name: string
  /** Which release introduced it, if any. */
  releaseId: string | null
  /** Where it fits: architecture, training, inference, multimodal, reasoning. */
  lane: '架构' | '训练' | '推理' | '多模态' | '后训练'
  /** One line on the mechanism. */
  mechanism: string
  /** Why it mattered. */
  impact: string
  /** Rough magnitude of the win, e.g. "KV cache ↓93%". */
  magnitude: string
}

export interface Dataset {
  /** Org slug, e.g. "deepseek-ai"; "combined" when several orgs are merged. */
  org: string
  /** Display name of the org. */
  orgName: string
  /** When the metrics were pulled. */
  snapshot: string
  /** Total public repos seen for the org at snapshot time. */
  repoCount: number
  releases: Release[]
  breakthroughs: Breakthrough[]
}

/** One lab whose open-weight models the chronicle tracks. */
export interface OrgMeta {
  /** Hugging Face org slug, matches `Dataset.org`. */
  id: string
  /** Display name, e.g. "智谱 GLM". */
  name: string
  /** Short label for the filter chips. */
  short: string
  /** One Chinese line shown under the switcher. */
  blurb: string
  /** Accent hue in HSL degrees; keeps families readable while labs stay distinct. */
  hue: number
}
