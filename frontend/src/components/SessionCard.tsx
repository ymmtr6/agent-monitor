import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Clock } from "@phosphor-icons/react";
import type { SessionState } from "../lib/types.js";
import { STATUS_META } from "../lib/statusMeta.js";
import { registerCard } from "../lib/cardRegistry.js";
import { AgentBadge } from "./AgentBadge.js";
import { useNow, formatElapsed } from "../lib/useNow.js";
import { formatTokens } from "../lib/formatTokens.js";

export function SessionCard({ session }: { session: SessionState }) {
  const now = useNow();
  const meta = STATUS_META[session.status];
  const shortId = session.id.slice(0, 8);
  const ref = useRef<HTMLDivElement>(null);

  // CursorLayer tracks this node so the roaming cursor can follow the card across columns.
  // LinkLayer also uses it to draw parent→subagent lines.
  useEffect(() => {
    if (!ref.current) return;
    return registerCard(`${session.id}:parent`, ref.current);
  }, [session.id]);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: session.status === "ended" ? 0.5 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
      style={{
        position: "relative",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <motion.div
        animate={{ backgroundColor: meta.color }}
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
      />

      <div style={{ padding: "12px 12px 0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <AgentBadge agentType={session.agentType} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <motion.span
            className={meta.pulse ? "pulse-dot" : undefined}
            animate={{ backgroundColor: meta.color, color: meta.color }}
            transition={{ duration: 0.25 }}
            style={{ width: 6, height: 6, borderRadius: "50%" }}
          />
          <motion.span
            animate={{ color: meta.color }}
            transition={{ duration: 0.25 }}
            style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.03em", whiteSpace: "nowrap" }}
          >
            {meta.label}
          </motion.span>
        </div>
      </div>

      <div style={{ padding: "0 12px" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={session.projectPath}
        >
          {session.projectLabel}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={session.gitBranch ?? undefined}
        >
          {shortId}
          {session.gitBranch ? ` · ${session.gitBranch}` : ""}
        </div>
      </div>

      {session.currentActivity && (
        <div style={{ padding: "0 12px" }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              background: "var(--bg-surface-raised)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 8px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {session.currentActivity}
          </div>
        </div>
      )}

      <div
        style={{
          padding: "0 12px 10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--text-faint)",
          fontSize: 10,
        }}
      >
        <Clock size={11} />
        <span className="mono">{formatElapsed(session.startedAt, now)}</span>
        {session.tokens.total > 0 && (
          <span className="mono" style={{ marginLeft: "auto" }} title="消費トークン">
            {formatTokens(session.tokens.total)} tok
          </span>
        )}
      </div>
    </motion.div>
  );
}
