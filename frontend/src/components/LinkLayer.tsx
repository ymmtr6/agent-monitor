import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SessionState, SubagentState } from "../lib/types.js";
import { STATUS_META } from "../lib/statusMeta.js";
import { measureCards, type CardRect } from "../lib/cardRegistry.js";

const UPDATE_INTERVAL_MS = 120;

/** Maps a unique key for each subagent across the whole store. */
function subagentKey(sessionId: string, subagentId: string): string {
  return `${sessionId}/${subagentId}`;
}

interface SubagentBounds {
  sessionId: string;
  subagentId: string;
  parentRect: CardRect | null;
  childRect: CardRect | null;
}

/** Computes the SVG path string for a curved link line. */
function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x1.toFixed(1)} ${midY.toFixed(1)} L ${x2.toFixed(1)} ${midY.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** Computes the bottom edge y-coordinate of a card rect. */
function cardBottom(rect: CardRect): number {
  return rect.top + rect.height;
}

export function LinkLayer() {
  const [bounds, setBounds] = useState<SubagentBounds[]>([]);
  const latest = useRef<SubagentBounds[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      const next = latest.current;
      const rects = measureCards();
      const updated: SubagentBounds[] = [];

      for (const b of next) {
        const parent = rects[`${b.sessionId}:parent`];
        const child = rects[`${b.sessionId}:${b.subagentId}`];
        if (!parent || !child) continue;
        updated.push({ ...b, parentRect: parent, childRect: child });
      }

      setBounds(updated);
    }, UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Exposed for the kanban board to drive updates when subagents come and go.
  useEffect(() => {
    const original = latest.current;
    latest.current = bounds;
    return () => {
      latest.current = original;
    };
  }, [bounds]);

  return (
    <svg
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 4,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {bounds.map((b) => {
        if (!b.parentRect || !b.childRect) return null;
        const x1 = b.parentRect.left + b.parentRect.width / 2;
        const y1 = cardBottom(b.parentRect);
        const x2 = b.childRect.left + b.childRect.width / 2;
        const y2 = b.childRect.top;
        return (
          <motion.path
            key={`${b.sessionId}/${b.subagentId}`}
            d={linkPath(x1, y1, x2, y2)}
            stroke="var(--status-subagent-dim)"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          />
        );
      })}
    </svg>
  );
}

/** Hook for the kanban board to register all subagent bounds. */
export function useSubagentBounds(sessions: Record<string, SessionState>): void {
  useEffect(() => {
    const collected: SubagentBounds[] = [];
    for (const session of Object.values(sessions)) {
      for (const sub of Object.values(session.subagents)) {
        // Only link running subagents to avoid clutter.
        if (sub.status === "running") {
          collected.push({
            sessionId: session.id,
            subagentId: sub.id,
            parentRect: null,
            childRect: null,
          });
        }
      }
    }
    // This will be picked up by LinkLayer on the next tick.
    // We rely on a single Set/Map per DOM node, so we reuse the parent card's key.
    (window as unknown as { __subagentBounds: SubagentBounds[] }).__subagentBounds = collected;
  }, [sessions]);
}
