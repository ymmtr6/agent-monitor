import { useMemo } from "react";
import { useAgentStore } from "../lib/store.js";
import { STATUS_ORDER } from "../lib/statusMeta.js";
import type { SessionState, StatusKind } from "../lib/types.js";
import { StatusColumn } from "./StatusColumn.js";

export function KanbanBoard() {
  const sessions = useAgentStore((s) => s.sessions);

  const grouped = useMemo(() => {
    const groups: Record<StatusKind, SessionState[]> = {
      needs_attention: [],
      running: [],
      subagent_active: [],
      waiting_input: [],
      ended: [],
    };
    const sessionsList = Object.values(sessions).sort((a, b) => b.lastEventAt - a.lastEventAt);
    for (const session of sessionsList) groups[session.status].push(session);
    return groups;
  }, [sessions]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 10,
        flex: 1,
        minHeight: 0,
      }}
    >
      {STATUS_ORDER.map((status) => (
        <StatusColumn key={status} status={status} sessions={grouped[status]} />
      ))}
    </div>
  );
}
