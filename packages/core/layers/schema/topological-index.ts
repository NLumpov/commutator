import type { Field } from "../commutator";
import type { PinsRegistry } from "./pins-registry";
import type { WiresRegistry } from "./wires-registry";

export class TopologicalIndex<DataTypes extends Record<string, Field<DataTypes>>> {
  // node -> outgoing nodes
  private adjacency: Map<string, Set<string>> = new Map();

  // node -> indegree
  private inDegree: Map<string, number> = new Map();

  // topo order
  private topoOrder: Map<string, number> = new Map();

  // cache
  private dirty = true;
  private hasCycleCache: boolean | null = null;

  // dfs marks (без аллокаций)
  private visitMark = new Map<string, number>();
  private visitToken = 1;

  private ensureNode(node: string): void {
    if (!this.adjacency.has(node)) {
      this.adjacency.set(node, new Set());
      this.inDegree.set(node, 0);
      this.dirty = true;
    }
  }

  addWire(from: string, to: string): void {
    this.ensureNode(from);
    this.ensureNode(to);

    const set = this.adjacency.get(from);

    // biome-ignore lint/style/noNonNullAssertion: No-check for optimization
    if (set!.has(to)) return;

    // biome-ignore lint/style/noNonNullAssertion: No-check for optimization
    set!.add(to);
    this.inDegree.set(to, (this.inDegree.get(to) ?? 0) + 1);
    this.dirty = true;
    this.hasCycleCache = null;
  }

  removeWire(from: string, to: string): void {
    const set = this.adjacency.get(from);
    if (!set || !set.delete(to)) return;

    this.inDegree.set(to, Math.max(0, (this.inDegree.get(to) ?? 1) - 1));
    this.dirty = true;
    this.hasCycleCache = null;
  }

  /**
   * Полная проверка (Kahn) + построение topoOrder
   * Вызывается редко
   */
  hasCycle(): boolean {
    if (!this.dirty && this.hasCycleCache !== null) {
      return this.hasCycleCache;
    }

    const inDeg = new Map(this.inDegree);
    const queue: string[] = [];
    let qi = 0;

    for (const [n, d] of inDeg) {
      if (d === 0) queue.push(n);
    }

    const topo: string[] = [];

    while (qi < queue.length) {
      const n = queue[qi++];

      // biome-ignore lint/style/noNonNullAssertion: Inline for optimization
      topo.push(n!);

      // biome-ignore lint/style/noNonNullAssertion: Inline for optimization
      const out = this.adjacency.get(n!);
      if (!out) continue;

      for (const m of out) {
        const d = (inDeg.get(m) ?? 0) - 1;
        inDeg.set(m, d);
        if (d === 0) queue.push(m);
      }
    }

    const hasCycle = topo.length !== this.adjacency.size;

    this.topoOrder.clear();
    for (let i = 0; i < topo.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: Inline topo[i] for optimization
      this.topoOrder.set(topo[i]!, i);
    }

    this.dirty = false;
    this.hasCycleCache = hasCycle;
    return hasCycle;
  }

  /**
   * БЫСТРАЯ интерактивная проверка
   * 99% случаев — O(1)
   */
  willCreateCycleFast(
    fromNode: string,
    toNode: string,
    pinsRegistry: PinsRegistry<DataTypes>,
    wiresRegistry: WiresRegistry<DataTypes>,
    wireType: "exec" | "data",
  ): boolean {
    if (fromNode === toNode) return true;

    // если порядок известен и корректен — цикла ТОЧНО нет
    if (!this.dirty) {
      const fromOrd = this.topoOrder.get(fromNode);
      const toOrd = this.topoOrder.get(toNode);

      if (fromOrd !== undefined && toOrd !== undefined && fromOrd < toOrd) {
        return false;
      }
    }

    // fallback: DFS (редко)
    return this.willCreateCycleDFS(fromNode, toNode, pinsRegistry, wiresRegistry, wireType);
  }

  /**
   * Медленный путь (редко вызывается)
   */
  private willCreateCycleDFS(
    fromNode: string,
    toNode: string,
    pinsRegistry: PinsRegistry<DataTypes>,
    wiresRegistry: WiresRegistry<DataTypes>,
    wireType: "exec" | "data",
  ): boolean {
    const nodeOutPins =
      wireType === "exec"
        ? pinsRegistry.getNodeOutExecPinsIndex()
        : pinsRegistry.getNodeOutPinsIndex();

    const pinToNode = pinsRegistry.getPinsToNodeIndex();

    const stack: string[] = [toNode];
    const token = ++this.visitToken;

    while (stack.length > 0) {
      const node = stack.pop();

      if (!node) break;

      if (node === fromNode) return true;

      if (this.visitMark.get(node) === token) continue;
      this.visitMark.set(node, token);

      const outPins = nodeOutPins.get(node);
      if (!outPins) continue;

      for (const pin of outPins) {
        const wires = wiresRegistry.getWiresByFromPin(pin.uuid);
        for (const w of wires) {
          const next = pinToNode.get(w.to);
          if (next) stack.push(next);
        }
      }
    }

    return false;
  }

  clear(): void {
    this.adjacency.clear();
    this.inDegree.clear();
    this.topoOrder.clear();
    this.dirty = true;
    this.hasCycleCache = null;
  }
}
