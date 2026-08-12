import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Clock, WarningCircle } from "@phosphor-icons/react";
import type { SessionState, SubagentState } from "../lib/types.js";
import { registerCard } from "../lib/cardRegistry.js";
import { STATUS_META } from "../lib/statusMeta.js";
import { useNow, formatElapsed } from "../lib/useNow.js";

/** Smaller card for a subagent, visually tied to its parent via LinkLayer. */
export function SubagentCard({ session, subagent }: { session: SessionState; subagent: SubagentState }) {
  const now = useNow();
  const meta = STATUS_META[subagent.status === "running" ? "subagent_active" : "ended"];
  const isBg = subagent.background;
  const typeLabel = subagent.subagentType || "unknown";
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return registerCard(`${session.id}:${subagent.id}`, ref.current);
  }, [session.id, subagent.id]);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: subagent.status === "ended" ? 0.5 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
      style={{
        position: "relative",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 12px",
      }}
    >
      <motion.div
        animate={{ backgroundColor: meta.color }}
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <motion.div
            className={meta.pulse ? "pulse-dot" : undefined}
            animate={{ backgroundColor: meta.color, color: meta.color }}
            transition={{ duration: 0.25 }}
            style={{ width: 6, height: 6, borderRadius: "50%" }}
          />
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
            }}
          >
            {typeLabel}
          </span>
          {isBg && (
            <span
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: "var(--accent)",
                background: "var(--accent-dim)",
                padding: "1px 5px",
                borderRadius: 999,
              }}
            >
              BG
            </span>
          )}
        </div>
        <motion.span
          animate={{ color: meta.color }}
          transition={{ duration: 0.25 }}
          style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}
        >
          {subagent.status === "running" ? "稼働中" : "完了"}
        </motion.span>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {subagent.description}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--text-faint)",
          fontSize: 10,
        }}
      >
        <Clock size={11} />
        <span className="mono">{formatElapsed(subagent.startedAt, now)}</span>
        <span style={{ marginLeft: "auto" }} className="mono">
          親: {session.projectLabel.slice(0, 12)}
        </span>
      </div>
    </motion.div>
  );
}
