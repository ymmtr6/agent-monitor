import { useId } from "react";

interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
  /** Draws the filled area under the line; off for the tiny inline variants. */
  fill?: boolean;
  strokeWidth?: number;
}

/** Fixed viewBox with preserveAspectRatio="none" so the path stretches to any width. */
const VIEW_W = 100;

export function Sparkline({
  values,
  color = "var(--accent)",
  height = 28,
  fill = true,
  strokeWidth = 1.5,
}: SparklineProps) {
  const gradientId = useId();
  if (values.length < 2) {
    return <div style={{ height }} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = VIEW_W / (values.length - 1);
  // Inset the curve so a flat series doesn't sit exactly on the clipped edge.
  const points = values.map((value, i) => {
    const x = i * stepX;
    const y = height - 2 - ((value - min) / span) * (height - 4);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VIEW_W} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${height} ${points.join(" ")} ${VIEW_W},${height}`} fill={`url(#${gradientId})`} />
        </>
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
