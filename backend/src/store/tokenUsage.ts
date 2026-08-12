export interface TokenUsage {
  /** Uncached prompt tokens. */
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export function emptyUsage(): TokenUsage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
}

function withTotal(usage: Omit<TokenUsage, "total">): TokenUsage {
  return { ...usage, total: usage.input + usage.output + usage.cacheRead + usage.cacheWrite };
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return withTotal({
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
  });
}

/** b - a, floored at zero so a restarted/rewound counter can't push totals negative. */
export function diffUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return withTotal({
    input: Math.max(0, b.input - a.input),
    output: Math.max(0, b.output - a.output),
    cacheRead: Math.max(0, b.cacheRead - a.cacheRead),
    cacheWrite: Math.max(0, b.cacheWrite - a.cacheWrite),
  });
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * ClaudeCode reports usage per assistant message, and `input_tokens` excludes the
 * cached portion — so each parsed value is a delta to accumulate.
 */
export function parseClaudeUsage(raw: unknown): TokenUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = raw as Record<string, unknown>;
  const parsed = withTotal({
    input: num(usage.input_tokens),
    output: num(usage.output_tokens),
    cacheRead: num(usage.cache_read_input_tokens),
    cacheWrite: num(usage.cache_creation_input_tokens),
  });
  return parsed.total > 0 ? parsed : null;
}

/**
 * Codex reports a running total per session, and its `input_tokens` *includes*
 * `cached_input_tokens` — so the cached part is subtracted out to match Claude's shape.
 */
export function parseCodexTotals(raw: unknown): TokenUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = raw as Record<string, unknown>;
  const cacheRead = num(usage.cached_input_tokens);
  const parsed = withTotal({
    input: Math.max(0, num(usage.input_tokens) - cacheRead),
    output: num(usage.output_tokens),
    cacheRead,
    cacheWrite: num(usage.cache_write_input_tokens),
  });
  return parsed.total > 0 ? parsed : null;
}
