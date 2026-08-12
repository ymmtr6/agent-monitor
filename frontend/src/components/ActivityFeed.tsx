import { AnimatePresence, motion } from "framer-motion";
import { useAgentStore } from "../lib/store.js";
import { STATUS_META } from "../lib/statusMeta.js";
import { formatTime } from "../lib/useNow.js";

/** Rendering the whole 200-entry backlog costs more than it shows; the feed only scrolls so far. */
const VISIBLE_LIMIT = 60;

export function ActivityFeed() {
  const activity = useAgentStore((s) => s.activity);
  const items = activity.slice(0, VISIBLE_LIMIT);

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "var(--bg-surface)",
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
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em" }}>
          アクティビティ
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--status-attention)",
          }}
        >
          <span
            className="pulse-dot"
            style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }}
          />
          LIVE
        </span>
      </div>

      {/* Extra bottom padding keeps the last entries scrollable out from under the mascot. */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "6px 0 150px 0" }}>
        {items.length === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "10px 12px" }}>
            イベント待機中...
          </div>
        )}
        <AnimatePresence initial={false}>
          {items.map((event) => {
            const meta = STATUS_META[event.status];
            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                style={{ display: "flex", gap: 7, padding: "5px 12px", alignItems: "flex-start" }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: meta.color,
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{event.sessionLabel}</span>
                    {" が "}
                    {event.text}
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--text-faint)" }}>
                    {formatTime(event.ts)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </aside>
  );
}
