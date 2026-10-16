import { ACCENTS, shade, type AccentKey } from "adwaita-gpuix";

export interface GraphNode {
  id: string;
  offset: number;
  branch: number;
  routes: Array<[number, number, number]>;
}

interface Lane {
  laneId: number;
  target: string;
}

interface Convergence {
  nodeColumn: number;
  nodeLaneId: number;
  nodeLaneExistsAbove: boolean;
  mergedSet: Set<number>;
}

function trimRight(lanes: (Lane | null)[]): void {
  while (lanes.length > 0 && lanes[lanes.length - 1] == null) lanes.pop();
}

function convergeLanes(
  lanesAbove: (Lane | null)[],
  commitId: string,
): Convergence {
  const mergedSet = new Set<number>();
  const conv: Convergence = {
    nodeColumn: -1,
    nodeLaneId: -1,
    nodeLaneExistsAbove: false,
    mergedSet,
  };
  for (let c = 0; c < lanesAbove.length; c++) {
    const lane = lanesAbove[c];
    if (lane && lane.target === commitId) {
      if (conv.nodeColumn === -1) {
        conv.nodeColumn = c;
        conv.nodeLaneId = lane.laneId;
        conv.nodeLaneExistsAbove = true;
      } else {
        mergedSet.add(c);
      }
    }
  }
  return conv;
}

function ensureNodeLane(
  lanesAbove: (Lane | null)[],
  counter: { next: number },
  conv: Convergence,
  commitId: string,
): void {
  if (conv.nodeColumn === -1) {
    conv.nodeLaneId = counter.next++;
    conv.nodeLaneExistsAbove = false;
    const freeCol = lanesAbove.findIndex((l) => l == null);
    if (freeCol === -1) {
      conv.nodeColumn = lanesAbove.length;
      lanesAbove.push({ laneId: conv.nodeLaneId, target: commitId });
    } else {
      conv.nodeColumn = freeCol;
      lanesAbove[freeCol] = { laneId: conv.nodeLaneId, target: commitId };
    }
  }
}

function clearMergedLanes(
  lanesBelow: (Lane | null)[],
  mergedSet: Set<number>,
): void {
  for (const m of Array.from(mergedSet)) lanesBelow[m] = null;
}

function attachFirstParent(
  lanesBelow: (Lane | null)[],
  nodeColumn: number,
  nodeLaneId: number,
  firstParent: string,
  parentLaneIds: number[],
): void {
  const nodeLane = lanesBelow[nodeColumn];
  if (nodeLane) {
    nodeLane.target = firstParent;
    parentLaneIds.push(nodeLaneId);
  }
}

function collectEmptyColumns(
  lanesBelow: (Lane | null)[],
  laneIdsAbove: (number | null)[],
  nodeColumn: number,
  mergedSet: Set<number>,
): { withoutAbove: number[]; withAbove: number[] } {
  const withoutAbove: number[] = [];
  const withAbove: number[] = [];
  for (let c = nodeColumn + 1; c < lanesBelow.length; c++) {
    if (mergedSet.has(c)) continue;
    if (lanesBelow[c] == null) {
      if (laneIdsAbove[c] == null) withoutAbove.push(c);
      else withAbove.push(c);
    }
  }
  return { withoutAbove, withAbove };
}

interface PendingLaneCursors {
  withoutAbove: number[];
  withAbove: number[];
  withoutIdx: number;
  withIdx: number;
}

function placePendingLane(
  lanesBelow: (Lane | null)[],
  pending: Lane,
  cursors: PendingLaneCursors,
): void {
  while (
    cursors.withoutIdx < cursors.withoutAbove.length &&
    lanesBelow[cursors.withoutAbove[cursors.withoutIdx]] != null
  ) {
    cursors.withoutIdx++;
  }
  if (cursors.withoutIdx < cursors.withoutAbove.length) {
    lanesBelow[cursors.withoutAbove[cursors.withoutIdx]] = pending;
    cursors.withoutIdx++;
    return;
  }
  while (
    cursors.withIdx < cursors.withAbove.length &&
    lanesBelow[cursors.withAbove[cursors.withIdx]] != null
  ) {
    cursors.withIdx++;
  }
  if (cursors.withIdx < cursors.withAbove.length) {
    lanesBelow[cursors.withAbove[cursors.withIdx]] = pending;
    cursors.withIdx++;
    return;
  }
  lanesBelow.push(pending);
}

function placeParentLanes(
  lanesAbove: (Lane | null)[],
  mergedSet: Set<number>,
  nodeColumn: number,
  nodeLaneId: number,
  laneIdsAbove: (number | null)[],
  commit: { id: string; parents: string[] },
  counter: { next: number },
): { lanesBelow: (Lane | null)[]; parentLaneIds: number[] } {
  const lanesBelow = lanesAbove.slice();
  clearMergedLanes(lanesBelow, mergedSet);
  const parentLaneIds: number[] = [];
  if (commit.parents.length === 0) {
    lanesBelow[nodeColumn] = null;
    return { lanesBelow, parentLaneIds };
  }
  attachFirstParent(
    lanesBelow,
    nodeColumn,
    nodeLaneId,
    commit.parents[0],
    parentLaneIds,
  );
  const { withoutAbove, withAbove } = collectEmptyColumns(
    lanesBelow,
    laneIdsAbove,
    nodeColumn,
    mergedSet,
  );
  const cursors: PendingLaneCursors = {
    withoutAbove,
    withAbove,
    withoutIdx: 0,
    withIdx: 0,
  };
  for (let pi = 1; pi < commit.parents.length; pi++) {
    const newLaneId = counter.next++;
    parentLaneIds.push(newLaneId);
    placePendingLane(
      lanesBelow,
      { laneId: newLaneId, target: commit.parents[pi] },
      cursors,
    );
  }
  return { lanesBelow, parentLaneIds };
}

function buildLanePositions(
  lanes: (Lane | null)[],
): Map<number, number> {
  const positions = new Map<number, number>();
  for (let c = 0; c < lanes.length; c++) {
    const lane = lanes[c];
    if (lane) positions.set(lane.laneId, c);
  }
  return positions;
}

function computeBlockedLanes(
  laneIdsAbove: (number | null)[],
  lanePositionsBelow: Map<number, number>,
  mergedSet: Set<number>,
  nodeLaneId: number,
  laneWidth: number,
): boolean[] {
  const blocked = new Array<boolean>(laneWidth).fill(false);
  const markBlocked = (from: number, to: number): void => {
    if (from === to) return;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (let c = lo; c <= hi && c < laneWidth; c++) blocked[c] = true;
  };
  for (let c = 0; c < laneWidth; c++) {
    const aboveLane = c < laneIdsAbove.length ? laneIdsAbove[c] : null;
    if (aboveLane == null) continue;
    if (mergedSet.has(c)) continue;
    if (aboveLane === nodeLaneId) continue;
    const dest = lanePositionsBelow.get(aboveLane);
    if (dest != null && c !== dest) markBlocked(c, dest);
  }
  return blocked;
}

function collectLanes(lanesBelow: (Lane | null)[]): Lane[] {
  const laneList: Lane[] = [];
  for (let c = 0; c < lanesBelow.length; c++) {
    const lane = lanesBelow[c];
    if (lane) laneList.push(lane);
  }
  return laneList;
}

function resetLaneArray(lanesBelow: (Lane | null)[], laneWidth: number): void {
  lanesBelow.length = 0;
  for (let c = 0; c < laneWidth; c++) lanesBelow[c] = null;
}

function packLanesInto(
  laneList: Lane[],
  lanesBelow: (Lane | null)[],
  laneWidth: number,
  blocked: boolean[],
): void {
  for (const lane of laneList) {
    let target = 0;
    while (
      target < laneWidth &&
      (lanesBelow[target] != null || blocked[target])
    )
      target++;
    if (target >= laneWidth) target = lanesBelow.length;
    lanesBelow[target] = lane;
  }
}

function packLanesLeft(
  lanesBelow: (Lane | null)[],
  laneIdsAbove: (number | null)[],
  mergedSet: Set<number>,
  nodeLaneId: number,
): Map<number, number> {
  trimRight(lanesBelow);
  const lanePositionsBelow = buildLanePositions(lanesBelow);
  const laneWidth = Math.max(laneIdsAbove.length, lanesBelow.length);
  const blocked = computeBlockedLanes(
    laneIdsAbove,
    lanePositionsBelow,
    mergedSet,
    nodeLaneId,
    laneWidth,
  );
  const laneList = collectLanes(lanesBelow);
  resetLaneArray(lanesBelow, laneWidth);
  packLanesInto(laneList, lanesBelow, laneWidth, blocked);
  trimRight(lanesBelow);
  return buildLanePositions(lanesBelow);
}

function routesFromAbove(
  laneIdsAbove: (number | null)[],
  lanePositionsBelow: Map<number, number>,
  mergedSet: Set<number>,
  nodeColumn: number,
  nodeLaneId: number,
  nodeLaneExistsAbove: boolean,
): Array<[number, number, number]> {
  const routes: Array<[number, number, number]> = [];
  for (let c = 0; c < laneIdsAbove.length; c++) {
    const aboveLane = laneIdsAbove[c];
    if (aboveLane == null) continue;
    if (mergedSet.has(c)) {
      routes.push([c, nodeColumn, nodeLaneId - 1]);
    } else if (aboveLane === nodeLaneId) {
      if (
        nodeLaneExistsAbove &&
        c !== nodeColumn &&
        lanePositionsBelow.has(nodeLaneId)
      ) {
        routes.push([c, nodeColumn, nodeLaneId - 1]);
      }
    } else {
      const dest = lanePositionsBelow.get(aboveLane);
      if (dest != null) routes.push([c, dest, aboveLane - 1]);
    }
  }
  return routes;
}

function routesFromParents(
  parentLaneIds: number[],
  lanePositionsBelow: Map<number, number>,
  nodeColumn: number,
  nodeLaneId: number,
  nodeColAbove: number,
): Array<[number, number, number]> {
  const routes: Array<[number, number, number]> = [];
  for (const p of parentLaneIds) {
    const dest = lanePositionsBelow.get(p);
    if (dest == null) continue;
    if (p === nodeLaneId && nodeColAbove !== nodeColumn) continue;
    routes.push([nodeColumn, dest, p - 1]);
  }
  return routes;
}

function buildRoutes(
  laneIdsAbove: (number | null)[],
  lanePositionsBelow: Map<number, number>,
  mergedSet: Set<number>,
  nodeColumn: number,
  nodeLaneId: number,
  nodeLaneExistsAbove: boolean,
  parentLaneIds: number[],
  nodeColAbove: number,
): Array<[number, number, number]> {
  return routesFromAbove(
    laneIdsAbove,
    lanePositionsBelow,
    mergedSet,
    nodeColumn,
    nodeLaneId,
    nodeLaneExistsAbove,
  ).concat(
    routesFromParents(
      parentLaneIds,
      lanePositionsBelow,
      nodeColumn,
      nodeLaneId,
      nodeColAbove,
    ),
  );
}

export function generateGraphData(
  commits: Array<{ id: string; parents: string[] }>,
): GraphNode[] {
  const counter = { next: 1 };
  let lanesAbove: (Lane | null)[] = [];
  const nodes: GraphNode[] = [];
  for (const commit of commits) {
    trimRight(lanesAbove);
    const conv = convergeLanes(lanesAbove, commit.id);
    ensureNodeLane(lanesAbove, counter, conv, commit.id);
    const laneIdsAbove = lanesAbove.map((l) => (l ? l.laneId : null));
    const nodeColAbove = conv.nodeColumn;
    const { lanesBelow, parentLaneIds } = placeParentLanes(
      lanesAbove,
      conv.mergedSet,
      conv.nodeColumn,
      conv.nodeLaneId,
      laneIdsAbove,
      commit,
      counter,
    );
    const lanePositionsBelow = packLanesLeft(
      lanesBelow,
      laneIdsAbove,
      conv.mergedSet,
      conv.nodeLaneId,
    );
    const finalNodeColumn = lanePositionsBelow.get(conv.nodeLaneId);
    const nodeColumn =
      finalNodeColumn != null ? finalNodeColumn : conv.nodeColumn;
    const routes = buildRoutes(
      laneIdsAbove,
      lanePositionsBelow,
      conv.mergedSet,
      nodeColumn,
      conv.nodeLaneId,
      conv.nodeLaneExistsAbove,
      parentLaneIds,
      nodeColAbove,
    );
    nodes.push({
      id: commit.id,
      offset: nodeColumn,
      branch: conv.nodeLaneId - 1,
      routes,
    });
    lanesAbove = lanesBelow;
  }
  return nodes;
}

export function graphLaneCount(data: GraphNode[]): number {
  let max = 0;
  for (const node of data) {
    max = Math.max(max, node.offset + 1);
    for (const [from, to] of node.routes) max = Math.max(max, from + 1, to + 1);
  }
  return max;
}

export const GRAPH_X_STEP = 20;
export const GRAPH_Y_STEP = 24;
export const GRAPH_DOT_RADIUS = 3;
export const GRAPH_LINE_WIDTH = 2;

export const GRAPH_MAX_GUTTER_WIDTH = 160;

export function graphXStep(laneCount: number): number {
  if (laneCount <= 0) return GRAPH_X_STEP;
  return Math.min(GRAPH_X_STEP, GRAPH_MAX_GUTTER_WIDTH / laneCount);
}

export const COLOURS: string[] = (() => {
  const order: AccentKey[] = [
    "blue",
    "red",
    "teal",
    "orange",
    "green",
    "purple",
    "yellow",
    "pink",
    "slate",
  ];
  const out: string[] = [];
  for (const k of order) {
    out.push(ACCENTS[k]);
    out.push(shade(ACCENTS[k], 0.45));
  }
  out.push(shade(ACCENTS.slate, 0.6));
  out.push(shade(ACCENTS.slate, 0.8));
  return out;
})();

export function branchColour(branch: number): string {
  return COLOURS[branch % COLOURS.length];
}

export function graphGutterWidth(laneCount: number): number {
  return Math.ceil((laneCount + 0.5) * graphXStep(laneCount));
}

interface Pt {
  x: number;
  y: number;
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

function routeGeometry(
  from: number,
  to: number,
  xs: number,
): { p0: Pt; p3: Pt; c1: Pt; c2: Pt } {
  const H = GRAPH_Y_STEP;
  const fx = (from + 1) * xs;
  const tx = (to + 1) * xs;
  const p0 = { x: fx, y: H / 2 };
  const p3 = { x: tx, y: (3 * H) / 2 };
  const c1 = { x: fx - xs / 4, y: H / 2 + (2 * H) / 3 };
  const c2 = { x: tx + xs / 4, y: (3 * H) / 2 - (2 * H) / 3 };
  return { p0, p3, c1, c2 };
}

function boundaryT(from: number, to: number, xs: number): number {
  if (from === to) return 0.5;
  const { p0, p3, c1, c2 } = routeGeometry(from, to, xs);
  const yAt = (t: number) => {
    const u = 1 - t;
    return (
      u * u * u * p0.y +
      3 * u * u * t * c1.y +
      3 * u * t * t * c2.y +
      t * t * t * p3.y
    );
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (yAt(mid) < GRAPH_Y_STEP) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function splitCubic(
  p0: Pt,
  c1: Pt,
  c2: Pt,
  p3: Pt,
  t: number,
): { head: [Pt, Pt, Pt]; tail: [Pt, Pt, Pt, Pt] } {
  const a = lerp(p0, c1, t);
  const b = lerp(c1, c2, t);
  const c = lerp(c2, p3, t);
  const d = lerp(a, b, t);
  const e = lerp(b, c, t);
  const f = lerp(d, e, t);
  return { head: [a, b, f], tail: [f, e, c, p3] };
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

function routePath(
  from: number,
  to: number,
  mode: "head" | "tail",
  xs: number,
): string {
  const { p0, p3, c1, c2 } = routeGeometry(from, to, xs);
  if (from === to) {
    if (mode === "head")
      return `M ${fmt(p0.x)} ${fmt(p0.y)} L ${fmt(p0.x)} ${fmt(GRAPH_Y_STEP)}`;
    return `M ${fmt(p0.x)} 0 L ${fmt(p3.x)} ${fmt(p3.y - GRAPH_Y_STEP)}`;
  }
  const t = boundaryT(from, to, xs);
  const { head, tail } = splitCubic(p0, c1, c2, p3, t);
  if (mode === "head") {
    const [a, b, f] = head;
    return `M ${fmt(p0.x)} ${fmt(p0.y)} C ${fmt(a.x)} ${fmt(a.y)} ${fmt(b.x)} ${fmt(b.y)} ${fmt(f.x)} ${fmt(f.y)}`;
  }

  const H = GRAPH_Y_STEP;
  const [f, e, c, q3] = tail;
  const s = (p: Pt) => ({ x: p.x, y: p.y - H });
  const a = s(f);
  const b = s(e);
  const d = s(c);
  const g = s(q3);
  return `M ${fmt(a.x)} ${fmt(a.y)} C ${fmt(b.x)} ${fmt(b.y)} ${fmt(d.x)} ${fmt(d.y)} ${fmt(g.x)} ${fmt(g.y)}`;
}

export interface RowSvgOptions {
  selected?: boolean;

  dotStroke?: string;

  selectedStroke?: string;
}

export function renderRowSvg(
  node: GraphNode,
  prev: GraphNode | null,
  laneCount: number,
  xs: number,
  opts: RowSvgOptions = {},
): string {
  const W = graphGutterWidth(laneCount);
  const H = GRAPH_Y_STEP;
  const colour = branchColour(node.branch);
  const parts: string[] = [];

  if (prev) {
    for (const [from, to, branch] of prev.routes) {
      parts.push(
        `<path d="${routePath(from, to, "tail", xs)}" stroke="${branchColour(branch)}"/>`,
      );
    }
  }
  for (const [from, to, branch] of node.routes) {
    parts.push(
      `<path d="${routePath(from, to, "head", xs)}" stroke="${branchColour(branch)}"/>`,
    );
  }

  const cx = (node.offset + 1) * xs;
  const cy = H / 2;
  const stroke = opts.selected
    ? (opts.selectedStroke ?? colour)
    : (opts.dotStroke ?? colour);
  const strokeWidth = opts.selected || opts.dotStroke ? GRAPH_LINE_WIDTH : 1;
  parts.push(
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${GRAPH_DOT_RADIUS}" fill="${colour}" stroke="${stroke}" stroke-width="${strokeWidth}" class="commits-graph-branch-${node.branch}" data-sha="${node.id}"/>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g fill="none" stroke-width="${GRAPH_LINE_WIDTH}">${parts.join("")}</g></svg>`;
}
