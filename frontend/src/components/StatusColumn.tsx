import { AnimatePresence, motion } from "framer-motion";
import type { SessionState, StatusKind } from "../lib/types.js";
import { STATUS_META } from "../lib/statusMeta.js";
import { SessionCard } from "./SessionCard.js";
import { SubagentCard } from "./SubagentCard.js";

export function StatusColumn({ status, sessions }: { status: StatusKind; sessions: SessionState[] }) {
  const meta = STATUS_META[status];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "var(--bg-canvas)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
              letterSpacing: "0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {meta.label}
          </span>
        </div>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--text-faint)",
            background: "var(--bg-surface)",
            borderRadius: 999,
            padding: "1px 7px",
            minWidth: 18,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {sessions.length}
        </span>
      </div>

      <div
        style={{
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflowY: "auto",
          flex: 1,
        }}
      >
        <AnimatePresence initial={false}>
          {sessions.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ fontSize: 11, color: "var(--text-faint)", padding: "8px 4px" }}
            >
              なし
            </motion.div>
          )}
          {sessions.map((session) => (
            <motion.div key={session.id} layout style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <SessionCard session={session} />
              <AnimatePresence initial={false}>
                {Object.values(session.subagents)
                  .sort((a, b) => b.startedAt - a.startedAt)
                  .map((subagent) => (
                    <SubagentCard key={subagent.id} session={session} subagent={subagent} />
                  ))}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
