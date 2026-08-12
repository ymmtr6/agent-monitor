import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cursor } from "@phosphor-icons/react";
import { useAgentStore } from "../lib/store.js";
import { STATUS_META } from "../lib/statusMeta.js";
import { measureCards, sameRects, type CardRect } from "../lib/cardRegistry.js";
import type { SessionState, StatusKind } from "../lib/types.js";

/** Cards only move on status change, so a coarse poll is enough to drive the flight. */
const MEASURE_INTERVAL_MS = 120;

const CHIP_LABEL: Record<StatusKind, string> = {
  running: "作業中",
  subagent_active: "委任中",
  waiting_input: "待機中",
  needs_attention: "要対応",
  ended: "終了",
};

/** Idle statuses drift lazily; working ones roam at full speed. */
const SPEED: Record<StatusKind, number> = {
  running: 1,
  subagent_active: 1,
  waiting_input: 1.9,
  needs_attention: 1.3,
  ended: 2.4,
};

const FLIGHT = { type: "spring", stiffness: 190, damping: 24 } as const;

/** Deterministic PRNG so each card keeps the same drift path across re-renders. */
function seeded(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const WAYPOINTS = 4;
const CHIP_WIDTH = 78;

function driftPath(id: string, width: number, height: number, speed: number) {
  const rand = seeded(id);
  const maxX = Math.max(6, width - CHIP_WIDTH);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < WAYPOINTS; i++) {
    xs.push(Math.round(6 + rand() * (maxX - 6)));
    ys.push(Math.round(height * 0.18 + rand() * height * 0.5));
  }
  // Close the loop so the infinite repeat doesn't snap back visibly.
  xs.push(xs[0]);
  ys.push(ys[0]);
  return { xs, ys, duration: (7 + rand() * 6) * speed };
}

function useCardRects(): Record<string, CardRect> {
  const [rects, setRects] = useState<Record<string, CardRect>>({});
  const latest = useRef(rects);

  useEffect(() => {
    const id = setInterval(() => {
      const next = measureCards();
      if (sameRects(latest.current, next)) return;
      latest.current = next;
      setRects(next);
    }, MEASURE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return rects;
}

function AgentCursor({ session, rect }: { session: SessionState; rect: CardRect }) {
  const meta = STATUS_META[session.status];
  const speed = SPEED[session.status];
  const drift = useMemo(
    () => driftPath(session.id, rect.width, rect.height, speed),
    [session.id, rect.width, rect.height, speed],
  );
  const initial = session.projectLabel.slice(0, 1).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: rect.left, y: rect.top }}
      animate={{ opacity: 1, x: rect.left, y: rect.top }}
      exit={{ opacity: 0 }}
      transition={{ x: FLIGHT, y: FLIGHT, opacity: { duration: 0.25 } }}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <motion.div
        animate={{ x: drift.xs, y: drift.ys }}
        transition={{ duration: drift.duration, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "flex", alignItems: "flex-start", gap: 1 }}
      >
        <Cursor
          size={13}
          weight="fill"
          color="var(--text-primary)"
          style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.7))", flexShrink: 0 }}
        />
        <motion.span
          animate={{ backgroundColor: meta.color }}
          transition={{ duration: 0.3 }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            marginTop: 6,
            padding: "1px 6px 1px 2px",
            borderRadius: 999,
            color: "#101114",
            fontSize: 9,
            fontWeight: 700,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.24)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
            }}
          >
            {initial}
          </span>
          {CHIP_LABEL[session.status]}
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

export function CursorLayer() {
  const sessions = useAgentStore((s) => s.sessions);
  const rects = useCardRects();

  const cursors = Object.values(sessions).filter(
    (s) => s.status !== "ended" && rects[`${s.id}:parent`],
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none", overflow: "hidden" }}>
      <AnimatePresence>
        {cursors.map((session) => (
          <AgentCursor
            key={session.id}
            session={session}
            rect={rects[`${session.id}:parent`]}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
