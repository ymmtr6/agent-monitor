export interface CardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Cards live inside `overflow`-clipped kanban columns, so the roaming cursor is rendered
 * in a fixed overlay instead and looks its target card up here.
 *
 * A session can briefly have two mounted cards — the one exiting its old column and the
 * one entering the new one — so nodes are kept as a list and the newest connected node
 * wins. That is what lets the cursor fly to the new column instead of blinking out.
 */
const nodes = new Map<string, HTMLElement[]>();

export function registerCard(id: string, el: HTMLElement): () => void {
  const list = nodes.get(id) ?? [];
  list.push(el);
  nodes.set(id, list);

  return () => {
    const current = nodes.get(id);
    if (!current) return;
    const index = current.indexOf(el);
    if (index >= 0) current.splice(index, 1);
    if (current.length === 0) nodes.delete(id);
  };
}

export function measureCards(): Record<string, CardRect> {
  const out: Record<string, CardRect> = {};
  for (const [id, list] of nodes) {
    for (let i = list.length - 1; i >= 0; i--) {
      const el = list[i];
      if (!el.isConnected) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) break;
      out[id] = {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      break;
    }
  }
  // Also expose the collected bounds for LinkLayer to read directly.
  (window as unknown as { __cardRegistryBounds: Record<string, CardRect> }).__cardRegistryBounds = out;
  return out;
}

export function sameRects(a: Record<string, CardRect>, b: Record<string, CardRect>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => {
    const x = a[key];
    const y = b[key];
    return y && x.left === y.left && x.top === y.top && x.width === y.width && x.height === y.height;
  });
}
