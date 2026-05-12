import {
  lookupTestingDispatch
} from "./chunk-6AT5T6LD.js";

// testing/src/recomputeCounter.ts
function recomputeCounter() {
  const counts = /* @__PURE__ */ new Map();
  let nextIdx = 0;
  const counter = {
    wrap(compute, label) {
      const lbl = label ?? `__anon_${nextIdx++}`;
      if (!counts.has(lbl)) counts.set(lbl, 0);
      return (get) => {
        counts.set(lbl, (counts.get(lbl) ?? 0) + 1);
        return compute(get);
      };
    },
    count(label) {
      return counts.get(label) ?? 0;
    },
    total() {
      let n = 0;
      for (const c of counts.values()) n += c;
      return n;
    },
    byNode(node) {
      return counts.get(node.id) ?? 0;
    },
    reset() {
      for (const k of counts.keys()) counts.set(k, 0);
      nextIdx = 0;
    },
    snapshot() {
      return Object.freeze(Object.fromEntries(counts));
    }
  };
  return counter;
}

// testing/src/glitchDetector.ts
function glitchDetector(graph, derived, expected, deps, options) {
  const equals = options?.equals ?? Object.is;
  const depValues = deps.map((d) => ({ id: d.id, value: graph.read(d), time: graph.now }));
  let glitches = 0;
  const subs = [];
  const evaluate = (derivedValue, time) => {
    const tuple2 = depValues.map((d) => d.value);
    const want = expected(tuple2);
    if (!equals(derivedValue, want)) glitches++;
    void time;
  };
  for (const d of depValues) {
    subs.push(
      graph.subscribe(deps.find((n) => n.id === d.id), (value, time) => {
        d.value = value;
        d.time = time;
      })
    );
  }
  subs.push(graph.subscribe(derived, evaluate));
  return {
    get observed() {
      return glitches;
    },
    isGlitched() {
      return glitches > 0;
    },
    reset() {
      glitches = 0;
    },
    dispose() {
      while (subs.length) subs.pop()();
    }
  };
}

// testing/src/assertConsistentGraphTime.ts
var GraphTimeInconsistency = class extends Error {
  frameId;
  observed;
  constructor(frameId, observed) {
    const summary = [...observed.entries()].map(([t, entries]) => `t=${t}: ${entries.map((e) => e.selector).join(", ")}`).join(" | ");
    super(
      `Inconsistent GraphTime in render frame ${String(frameId)} \u2014 selectors disagreed across times: ${summary}`
    );
    this.name = "GraphTimeInconsistency";
    this.frameId = frameId;
    this.observed = observed;
  }
};
function assertConsistentGraphTime(trace) {
  const byFrame = /* @__PURE__ */ new Map();
  for (const e of trace) {
    const list = byFrame.get(e.frameId) ?? [];
    list.push(e);
    byFrame.set(e.frameId, list);
  }
  for (const [frameId, entries] of byFrame) {
    const byTime = /* @__PURE__ */ new Map();
    for (const e of entries) {
      const list = byTime.get(e.time) ?? [];
      list.push(e);
      byTime.set(e.time, list);
    }
    if (byTime.size > 1) {
      throw new GraphTimeInconsistency(frameId, byTime);
    }
  }
}

// testing/src/assertResultStability.ts
var ResultInstability = class extends Error {
  first;
  second;
  constructor(first, second) {
    super(
      `getSnapshot returned a fresh reference between back-to-back calls with no intervening commit. React's useSyncExternalStore will enter a render loop. First: ${describe(first)}, Second: ${describe(second)}.`
    );
    this.name = "ResultInstability";
    this.first = first;
    this.second = second;
  }
};
function describe(v) {
  if (v === null) return "null";
  if (v === void 0) return "undefined";
  if (typeof v === "object") return `[object ${Object.prototype.toString.call(v)}]`;
  return JSON.stringify(v);
}
function assertResultStability(probe) {
  const equals = probe.equals ?? Object.is;
  const first = probe.getSnapshot();
  const second = probe.getSnapshot();
  if (!equals(first, second)) {
    throw new ResultInstability(first, second);
  }
}

// testing/src/propertyTrials.ts
var DEFAULT_TRIALS = 1e3;
function propertyTrials(label, options = {}) {
  const numRuns = options.unsafeTrials !== void 0 ? options.unsafeTrials : options.numRuns ?? DEFAULT_TRIALS;
  if (options.unsafeTrials === void 0 && options.numRuns !== void 0 && options.numRuns < DEFAULT_TRIALS) {
    throw new Error(
      `propertyTrials('${label}'): numRuns ${options.numRuns} below the SPEC \xA715.2 floor of ${DEFAULT_TRIALS}. Use \`unsafeTrials\` if you genuinely need fewer (with documented rationale).`
    );
  }
  const seed = options.seed !== void 0 ? options.seed : seedFromEnv() ?? Math.floor(Math.random() * 2147483647);
  return {
    label,
    numRuns,
    seed,
    verbose: false,
    markInterruptAsFailure: true
  };
}
function seedFromEnv() {
  const raw = globalThis.process?.env?.CAUSL_FUZZ_SEED;
  if (!raw) return void 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : void 0;
}

// testing/src/propertyDag.ts
import * as fc from "fast-check";
function propertyDag(opts) {
  const min = opts?.minDerived ?? 2;
  const max = opts?.maxDerived ?? 12;
  return fc.integer({ min, max }).chain((n) => {
    const inputId = "n0";
    const derivedIds = Array.from({ length: n }, (_, i) => `n${i + 1}`);
    if (derivedIds.length === 0) {
      return fc.constant({ inputId, deriveds: [] });
    }
    return fc.tuple(
      ...derivedIds.map((id, i) => {
        const candidates = [inputId, ...derivedIds.slice(0, i)];
        return fc.uniqueArray(fc.constantFrom(...candidates), {
          minLength: 1,
          maxLength: candidates.length
        }).map((deps) => ({ id, deps }));
      })
    ).map((deriveds) => ({ inputId, deriveds }));
  });
}
function buildPropertyDag(graph, spec) {
  const input = graph.input(spec.inputId, 0);
  const deriveds = /* @__PURE__ */ new Map();
  for (const ds of spec.deriveds) {
    const handle = graph.derived(ds.id, (get) => {
      let sum = 0;
      for (const depId of ds.deps) {
        const node = depId === spec.inputId ? input : deriveds.get(depId);
        sum += get(node);
      }
      return sum;
    });
    deriveds.set(ds.id, handle);
  }
  return { input, deriveds };
}

// testing/src/disposedTombstoneSize.ts
function disposedTombstoneSize(graph) {
  return lookupTestingDispatch(graph).disposedTombstoneSize();
}

// testing/src/commitLogConsumerCount.ts
function commitLogConsumerCount(graph) {
  return lookupTestingDispatch(graph).commitLogConsumerCount();
}

// testing/src/derivedDeps.ts
function derivedDeps(graph, id) {
  return lookupTestingDispatch(graph).derivedDeps(id);
}
export {
  GraphTimeInconsistency,
  ResultInstability,
  assertConsistentGraphTime,
  assertResultStability,
  buildPropertyDag,
  commitLogConsumerCount,
  derivedDeps,
  disposedTombstoneSize,
  glitchDetector,
  propertyDag,
  propertyTrials,
  recomputeCounter
};
//# sourceMappingURL=testing.js.map