// src/commitLog.ts
var DEFAULT_CAPACITY = 1e3;
var REGISTRY = /* @__PURE__ */ new WeakMap();
function commitLog(graph, options = {}) {
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  if (capacity <= 0) throw new Error("CommitLog capacity must be > 0");
  const id = options.id ?? `__devtools.commitLog.${capacity}`;
  let perGraph = REGISTRY.get(graph);
  if (!perGraph) {
    perGraph = /* @__PURE__ */ new Map();
    REGISTRY.set(graph, perGraph);
  }
  const cached = perGraph.get(id);
  if (cached) return cached;
  const node = graph.commitMetadataDerived(id, (get) => {
    const log = get(graph.commitLog);
    const start = Math.max(0, log.length - capacity);
    const window = [];
    for (let i = log.length - 1; i >= start; i--) {
      window.push(log[i]);
    }
    return window;
  });
  perGraph.set(id, node);
  return node;
}

// src/inspector.ts
function inspect(graph, node) {
  const explanation = graph.read(graph.explain(node));
  return { explanation, inspectedAt: graph.now };
}
function watchInspect(graph, node, observer) {
  const explainNode = graph.explain(node);
  return graph.subscribe(explainNode, (explanation) => {
    observer({ explanation, inspectedAt: graph.now });
  });
}

// src/statechart.ts
function statechart(graph) {
  return {
    engine: "Idle",
    graphTime: graph.now,
    commitCount: graph.now
  };
}
function renderStatechartMermaid(config) {
  const active = config.engine;
  const lines = [
    "stateDiagram-v2",
    "    [*] --> Idle",
    "    Idle --> Committing : commit",
    "    Committing --> Idle : publish",
    `    note right of ${active}`,
    `      active @ t=${config.graphTime}`,
    `      ${config.commitCount} commits observed`,
    "    end note"
  ];
  return lines.join("\n");
}

// src/why.ts
import { assertNever } from "@causl/core/internal";
function withBecause(partial) {
  return { ...partial, because: renderWhy(partial) };
}
function renderWhy(r) {
  const t = r.cause?.time;
  const i = r.cause?.intent;
  switch (r.reason) {
    case "directly-set":
      return `Set directly in commit "${i}" (t=${t}).`;
    case "recomputed":
      return `Recomputed because ${(r.inputs ?? []).join(", ")} changed in commit "${i}" (t=${t}).`;
    case "no-cause":
      return `${r.node} has not changed in the visible commit window.`;
    case "did-update":
      return `${r.node} DID update in the latest commit "${i}".`;
    case "no-dep-overlap":
      return `Latest commit "${i}" touched ${(r.inputs ?? ["(nothing)"]).join(", ")}, none of which are dependencies of ${r.node}.`;
    case "object-is-deduped":
      return `Dependencies (${(r.inputs ?? []).join(", ")}) recomputed but produced an Object.is-equal value; the engine skipped notification.`;
    default:
      return assertNever(r.reason, "renderWhy: unhandled WhyReason");
  }
}
var WHY_UPDATED_REGISTRY = /* @__PURE__ */ new WeakMap();
var WHY_NOT_UPDATED_REGISTRY = /* @__PURE__ */ new WeakMap();
function classifyWhyUpdated(id, log, directDeps) {
  for (let k = log.length - 1; k >= 0; k--) {
    const c = log[k];
    if (!c.changedNodes.includes(id)) continue;
    const inputs = c.changedNodes.filter(
      (other) => other !== id && directDeps.includes(other)
    );
    if (inputs.length > 0) {
      return withBecause({
        node: id,
        reason: "recomputed",
        cause: c,
        path: [...inputs, id],
        inputs
      });
    }
    return withBecause({
      node: id,
      reason: "directly-set",
      cause: c,
      path: [id]
    });
  }
  return withBecause({
    node: id,
    reason: "no-cause",
    cause: null,
    path: null
  });
}
function classifyWhyNotUpdated(id, log, directDeps) {
  if (log.length === 0) {
    return withBecause({
      node: id,
      reason: "no-cause",
      cause: null,
      path: null
    });
  }
  const latest = log[log.length - 1];
  if (latest.changedNodes.includes(id)) {
    return withBecause({
      node: id,
      reason: "did-update",
      cause: latest,
      path: [id]
    });
  }
  const overlap = latest.changedNodes.filter((d) => directDeps.includes(d));
  if (overlap.length === 0) {
    return withBecause({
      node: id,
      reason: "no-dep-overlap",
      cause: latest,
      path: null,
      inputs: latest.changedNodes
    });
  }
  return withBecause({
    node: id,
    reason: "object-is-deduped",
    cause: latest,
    path: [...overlap, id],
    inputs: overlap
  });
}
function resolveDirectDeps(get, graph, node) {
  const exp = get(graph.explain(node));
  return exp.via === "cycle" ? [] : exp.deps.map((d) => d.node);
}
function whyUpdated(graph, node) {
  const id = node.id;
  let perGraph = WHY_UPDATED_REGISTRY.get(graph);
  if (!perGraph) {
    perGraph = /* @__PURE__ */ new Map();
    WHY_UPDATED_REGISTRY.set(graph, perGraph);
  }
  const cached = perGraph.get(id);
  if (cached) return cached;
  const derivedId = `__devtools.whyUpdated:${id}`;
  const handle = graph.commitMetadataDerived(
    derivedId,
    (get) => {
      const log = get(graph.commitLog);
      const directDeps = resolveDirectDeps(get, graph, node);
      return classifyWhyUpdated(id, log, directDeps);
    }
  );
  perGraph.set(id, handle);
  return handle;
}
function whyNotUpdated(graph, node) {
  const id = node.id;
  let perGraph = WHY_NOT_UPDATED_REGISTRY.get(graph);
  if (!perGraph) {
    perGraph = /* @__PURE__ */ new Map();
    WHY_NOT_UPDATED_REGISTRY.set(graph, perGraph);
  }
  const cached = perGraph.get(id);
  if (cached) return cached;
  const derivedId = `__devtools.whyNotUpdated:${id}`;
  const handle = graph.commitMetadataDerived(
    derivedId,
    (get) => {
      const log = get(graph.commitLog);
      const directDeps = resolveDirectDeps(get, graph, node);
      return classifyWhyNotUpdated(id, log, directDeps);
    }
  );
  perGraph.set(id, handle);
  return handle;
}

// src/liveDerivation.ts
import { CommitInProgressError } from "@causl/core";
var REGISTRY2 = /* @__PURE__ */ new WeakMap();
function registerInternal(graph, id, internal) {
  let map = REGISTRY2.get(graph);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    REGISTRY2.set(graph, map);
  }
  map.set(id, internal);
}
function getInternal(graph, id) {
  return REGISTRY2.get(graph)?.get(id);
}
function liveDerived(graph, id, initial) {
  const slot = { compute: initial };
  const version = graph.input(`${id}::__version`, 0);
  const node = graph.derived(
    id,
    (get) => {
      void get(version);
      return slot.compute(get);
    },
    { tag: "live" }
  );
  const handle = {
    node,
    id,
    replace(next) {
      if (slot.compute === next) return;
      slot.compute = next;
      try {
        graph.commit(`replace:${id}`, (tx) => tx.set(version, graph.read(version) + 1));
      } catch (e) {
        if (e instanceof CommitInProgressError) return;
        throw e;
      }
    }
  };
  registerInternal(graph, id, { handle, current: slot, version });
  return handle;
}
function replaceMany(graph, edits) {
  const internals = [];
  for (const { handle, next } of edits) {
    const internal = getInternal(graph, handle.id);
    if (!internal) {
      throw new Error(`replaceMany: handle ${handle.id} is not registered with this graph`);
    }
    internal.current.compute = next;
    internals.push(internal);
  }
  graph.commit(
    `replaceMany:${edits.map((e) => e.handle.id).join(",")}`,
    (tx) => {
      for (const internal of internals) {
        tx.set(internal.version, graph.read(internal.version) + 1);
      }
    }
  );
}

// src/snapshot.ts
function exportSnapshot(graph, options) {
  const inputs = {};
  for (const node of options.inputs) {
    inputs[node.id] = graph.read(node);
  }
  const snapshot = options.intent ? { schema: 1, time: graph.now, inputs, intent: options.intent } : { schema: 1, time: graph.now, inputs };
  return snapshot;
}
function exportSnapshotJson(graph, options) {
  return JSON.stringify(exportSnapshot(graph, options));
}
function importSnapshot(graph, snapshot, options) {
  if (snapshot.schema !== 1) {
    throw new Error(`Unsupported snapshot schema: ${snapshot.schema}`);
  }
  const intent = options.intent ?? snapshot.intent ?? "import-snapshot";
  graph.commit(intent, (tx) => {
    for (const [id, value] of Object.entries(snapshot.inputs)) {
      const node = options.inputs.get(id);
      if (!node) continue;
      tx.set(node, value);
    }
  });
}
function importSnapshotJson(graph, json, options) {
  importSnapshot(graph, JSON.parse(json), options);
}

// src/index.ts
var VERSION = "0.0.0";
export {
  VERSION,
  commitLog,
  exportSnapshot,
  exportSnapshotJson,
  importSnapshot,
  importSnapshotJson,
  inspect,
  liveDerived,
  renderStatechartMermaid,
  renderWhy,
  replaceMany,
  statechart,
  watchInspect,
  whyNotUpdated,
  whyUpdated
};
//# sourceMappingURL=index.js.map