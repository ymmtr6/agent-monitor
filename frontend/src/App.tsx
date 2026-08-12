import { LayoutGroup } from "framer-motion";
import { useAgentSocket } from "./lib/useAgentSocket.js";
import { useAgentStore } from "./lib/store.js";
import { ActivityFeed } from "./components/ActivityFeed.js";
import { AgentPanel } from "./components/AgentPanel.js";
import { CursorLayer } from "./components/CursorLayer.js";
import { Header } from "./components/Header.js";
import { KanbanBoard } from "./components/KanbanBoard.js";
import { KpiRow } from "./components/KpiRow.js";
import { LinkLayer, useSubagentBounds } from "./components/LinkLayer.js";
import { Mascot } from "./components/Mascot.js";
import { ThroughputChart } from "./components/ThroughputChart.js";

export function App() {
  const sessions = useAgentStore((s) => s.sessions);
  useAgentSocket();
  useSubagentBounds(sessions);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "230px minmax(0, 1fr) 290px",
          gap: 10,
          padding: 10,
          flex: 1,
          minHeight: 0,
        }}
      >
        <AgentPanel />

        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          <KpiRow />
          <LayoutGroup>
            <KanbanBoard />
          </LayoutGroup>
          <ThroughputChart />
        </div>

        <ActivityFeed />
      </div>

      <LinkLayer />
      <CursorLayer />
      <Mascot />
    </div>
  );
}
