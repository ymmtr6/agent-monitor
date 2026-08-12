import { AnimatePresence, motion } from "framer-motion";
import { GitBranch } from "@phosphor-icons/react";
import type { SubagentState } from "../lib/types.js";

export function SubagentList({ subagents }: { subagents: Record<string, SubagentState> }) {
  const items = Object.values(subagents).sort((a, b) => b.startedAt - a.startedAt);
  if (items.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 10,
        paddingLeft: 10,
        borderLeft: "2px solid var(--status-subagent-dim)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <AnimatePresence initial={false}>
        {items.map((sub) => (
          <motion.div
            key={sub.id}
            layout
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: sub.status === "running" ? "var(--status-subagent)" : "var(--text-faint)",
            }}
          >
            <GitBranch size={11} weight="bold" style={{ flexShrink: 0 }} />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono)",
              }}
            >
              {sub.description}
            </span>
            {sub.status === "running" && (
              <span
                className="pulse-dot"
                style={{ background: "var(--status-subagent)", width: 5, height: 5, borderRadius: "50%", flexShrink: 0 }}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
