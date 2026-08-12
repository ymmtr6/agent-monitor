import fs from "node:fs";

const offsets = new Map<string, number>();

function splitLines(text: string): string[] {
  return text.split("\n").filter((line) => line.trim().length > 0);
}

/** Reads only the bytes appended since the last call for this file. */
export function readNewLines(filePath: string): string[] {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return [];
  }
  const prevOffset = offsets.get(filePath) ?? 0;
  const start = stat.size < prevOffset ? 0 : prevOffset;
  if (start >= stat.size) {
    offsets.set(filePath, stat.size);
    return [];
  }
  const length = stat.size - start;
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, length, start);
  } finally {
    fs.closeSync(fd);
  }
  offsets.set(filePath, stat.size);
  return splitLines(buffer.toString("utf8"));
}

/** Reads the last `maxLines` lines of a file and marks the offset at EOF (for startup snapshots). */
export function readTailLines(filePath: string, maxLines: number): string[] {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = splitLines(content);
  offsets.set(filePath, Buffer.byteLength(content, "utf8"));
  return lines.slice(-maxLines);
}

export function markOffsetAtEnd(filePath: string): void {
  try {
    const stat = fs.statSync(filePath);
    offsets.set(filePath, stat.size);
  } catch {
    // file may have been removed between glob and stat; ignore
  }
}

export function forgetFile(filePath: string): void {
  offsets.delete(filePath);
}
