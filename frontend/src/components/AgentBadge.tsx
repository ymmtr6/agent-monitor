import { Robot, TerminalWindow } from "@phosphor-icons/react";
import type { AgentType } from "../lib/types.js";

const AGENT_META: Record<AgentType, { label: string; color: string; icon: typeof Robot }> = {
  claude: { label: "Claude", color: "#ff9830", icon: Robot },
  codex: { label: "Codex", color: "#3ecfb2", icon: TerminalWindow },
};

export function AgentBadge({ agentType }: { agentType: AgentType }) {
  const meta = AGENT_META[agentType];
  const Icon = meta.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px 2px 4px",
        borderRadius: "var(--radius-sm)",
        background: `${meta.color}1f`,
        color: meta.color,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} weight="bold" />
      {meta.label}
    </span>
  );
}
