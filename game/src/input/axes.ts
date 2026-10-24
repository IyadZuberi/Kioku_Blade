export interface Axis {
  x: number;
  y: number;
}

/** Add movement sources (keys, hand, pad), ignoring any source that is not a finite pair, and cap the length at 1. */
export function combineAxes(sources: Axis[]): Axis {
  let x = 0, y = 0;
  for (const s of sources) {
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) continue; // a broken source is ignored whole
    x += s.x;
    y += s.y;
  }
  const l = Math.hypot(x, y);
  if (l > 1) {
    x /= l;
    y /= l;
  }
  return { x: x || 0, y: y || 0 };
}

/** Radial dead zone: nothing inside `zone`, then a smooth rescale so the edge still reaches 1. */
export function deadzone(a: Axis, zone: number): Axis {
  const l = Math.hypot(a.x, a.y);
  if (!(l > zone)) return { x: 0, y: 0 };
  const k = Math.min(1, (l - zone) / (1 - zone)) / l;
  return { x: a.x * k, y: a.y * k };
}