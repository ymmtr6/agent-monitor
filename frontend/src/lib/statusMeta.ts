import type { StatusKind } from "./types.js";

export interface StatusMeta {
  key: StatusKind;
  label: string;
  color: string;
  dim: string;
  pulse: boolean;
}

export const STATUS_ORDER: StatusKind[] = [
  "needs_attention",
  "running",
  "subagent_active",
  "waiting_input",
  "ended",
];

export const STATUS_META: Record<StatusKind, StatusMeta> = {
  needs_attention: {
    key: "needs_attention",
    label: "要対応",
    color: "var(--status-attention)",
    dim: "var(--status-attention-dim)",
    pulse: true,
  },
  running: {
    key: "running",
    label: "実行中",
    color: "var(--status-running)",
    dim: "var(--status-running-dim)",
    pulse: true,
  },
  subagent_active: {
    key: "subagent_active",
    label: "サブエージェント",
    color: "var(--status-subagent)",
    dim: "var(--status-subagent-dim)",
    pulse: true,
  },
  waiting_input: {
    key: "waiting_input",
    label: "入力待ち",
    color: "var(--status-waiting)",
    dim: "var(--status-waiting-dim)",
    pulse: false,
  },
  ended: {
    key: "ended",
    label: "終了",
    color: "var(--status-ended)",
    dim: "var(--status-ended-dim)",
    pulse: false,
  },
};
