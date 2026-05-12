import {
  createCausl
} from "./chunk-IYUJL32F.js";
import {
  _migrateFrom
} from "./chunk-NZKNVSHZ.js";
import "./chunk-6AT5T6LD.js";

// wasm/index.ts
var modulePromiseByBridge = /* @__PURE__ */ new Map();
function __resetWasmBackendCacheForTests() {
  modulePromiseByBridge.clear();
}
async function detectBridge() {
  return "serde-json";
}
function wasmUrlFor(bridge, baseUrl) {
  const segment = bridgeArtifactSegment(bridge);
  const file = `${segment}/engine_rs_bg.wasm`;
  if (baseUrl) {
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL(file, base);
  }
  return new URL(`./pkg/${file}`, import.meta.url);
}
function bridgeArtifactSegment(bridge) {
  switch (bridge) {
    case "wasmgc-builtins":
      return "gc-builtins";
    case "wasmgc-classic":
      return "gc-classic";
    case "serde-json":
      return "serde";
    default:
      return bridge;
  }
}
async function loadWasmBackend(options = {}) {
  const bridge = options.bridge ?? await detectBridge();
  let cached = modulePromiseByBridge.get(bridge);
  if (cached) return cached;
  cached = instantiateBackend(bridge, options);
  modulePromiseByBridge.set(bridge, cached);
  cached.catch(() => modulePromiseByBridge.delete(bridge));
  return cached;
}
var WasmBackendUnavailableError = class extends Error {
  code = "CAUSL_WASM_NOT_BUILT";
  constructor(bridge) {
    super(
      `@causl/core/wasm: backend artifact for bridge '${bridge}' is not yet built. WASM support is gated on issues #682, #683, and #693; until those land, pin backend: 'js' or use the default auto path which stays on the TS engine.`
    );
    this.name = "WasmBackendUnavailableError";
  }
};
async function instantiateBackend(bridge, options) {
  void wasmUrlFor(bridge, options.wasmBaseUrl);
  void options.fetch;
  const graphName = options.graphName ?? `causl.wasm.${bridge}`;
  return new WasmBackend(bridge, graphName);
}
var WasmBackend = class {
  /** Bridge identifier — surfaced for diagnostics. */
  bridge;
  /** Underlying TS engine — wrapped to satisfy the FFI-shaped surface. */
  #graph;
  /** Node-id-keyed registry of input handles for `commit` writes. */
  #inputs = /* @__PURE__ */ new Map();
  /**
   * Auto-registration cache for nodes referenced through `commit()`
   * that haven't been pre-registered via `__registerInput()`. Keeps
   * the FFI surface honest: the bridge will produce `Action` values
   * carrying writes keyed by `NodeId`, and the wrapper must be able
   * to resolve those ids without the caller having walked an explicit
   * `g.input()` call site for each one.
   *
   * Adopters who use the higher-level `Graph` surface go through
   * `g.input()` / `g.derived()` first and the registry is populated
   * by `__registerInput()`. Adopters who use `BackendEngine.commit`
   * directly (e.g. the cross-backend determinism gate's WASM-side
   * `World`) pre-register input handles through `__registerInput()`.
   */
  #nodeRegistry = /* @__PURE__ */ new Map();
  constructor(bridge, graphName) {
    this.bridge = bridge;
    this.#graph = createCausl({ name: graphName });
  }
  get now() {
    return this.#graph.now;
  }
  /**
   * Apply a precomputed map of input writes atomically.
   *
   * @param intent - Caller-supplied label retained on the
   *   {@link Commit} record.
   * @param writes - Map of `NodeId` → new value. Every id must have
   *   been registered via `__registerInput()` (or implicitly through
   *   the wrapped `Graph` if adopters reach for `__graph` directly).
   */
  commit(intent, writes) {
    return this.#graph.commit(intent, (tx) => {
      for (const [id, value] of writes) {
        const handle = this.#inputs.get(id);
        if (handle === void 0) {
          throw new Error(
            `WasmBackend.commit(): no input registered for NodeId '${id}'. Use the wrapped Graph surface (via __graph()) or pre-register the input through __registerInput(id, handle).`
          );
        }
        tx.set(handle, value);
      }
    });
  }
  read(node) {
    const handle = this.#nodeRegistry.get(node);
    if (handle === void 0) {
      throw new Error(
        `WasmBackend.read(): no node registered for NodeId '${node}'.`
      );
    }
    return this.#graph.read(handle);
  }
  subscribe(node, observer) {
    const handle = this.#nodeRegistry.get(node);
    if (handle === void 0) {
      throw new Error(
        `WasmBackend.subscribe(): no node registered for NodeId '${node}'.`
      );
    }
    return this.#graph.subscribe(handle, observer);
  }
  subscribeCommits(observer) {
    return this.#graph.subscribeCommits(observer);
  }
  snapshot() {
    return this.#graph.snapshot();
  }
  hydrate(snap) {
    this.#graph.hydrate(snap);
  }
  /**
   * Internal-API migration hydrate (issue #1090). Routes through
   * `@causl/core/internal`'s `_migrateFrom(graph, snap)` so the
   * wrapped TS engine adopts the snapshot WITHOUT publishing the
   * synthetic `'hydrate'` commit record. The migration boundary
   * itself isn't a commit; `now` starts where the snapshot left off
   * and the §3 monotonicity invariant is preserved by the
   * fresh-graph precondition (`now === 0`, no commit history).
   *
   * @remarks
   * Used by the cross-backend determinism property test's migration
   * matrix so the (N+M)-commit pure-TS baseline and the JS → WASM
   * migrated engine compare byte-identical at literal IR level.
   * Adopter packages use `hydrate(snap)` — this method is reachable
   * only through the `__migrateFrom` accessor and is namespaced with
   * the `__` prefix to match the rest of the WasmBackend's
   * test/integration helpers (`__graph`, `__registerInput`, …).
   *
   * @internal
   */
  __migrateFrom(snap) {
    _migrateFrom(this.#graph, snap);
  }
  readAt(node, time) {
    const handle = this.#nodeRegistry.get(node);
    if (handle === void 0) {
      throw new Error(
        `WasmBackend.readAt(): no node registered for NodeId '${node}'.`
      );
    }
    return this.#graph.readAt(handle, time);
  }
  snapshotAt(time) {
    return this.#graph.snapshotAt(time);
  }
  exportModel() {
    return this.#graph.exportModel();
  }
  dispose(node) {
    const handle = this.#nodeRegistry.get(node);
    if (handle === void 0) return;
    const { dispose } = this.#graph.__causl_internal_dispatch ?? { dispose: () => void 0 };
    dispose(handle);
  }
  /**
   * SPEC §6 composite-statechart extension point (issue #1068,
   * deferred from #698). The Phase-1 `WasmBackend` wraps a TS engine
   * (see `createCausl` call in the constructor) so this method
   * routes through the same `evaluateStatechart` evaluator the
   * underlying `JsBackend` exposes — the wrapped Graph's internal
   * BackendEngine seam is the source of truth.
   *
   * @remarks
   * The Phase-2 Sub-D work (EPIC #680) replaces this delegation with
   * a Rust-side `evaluate_statechart()` call consuming the
   * `engine-rs-core::statechart_reducers` enums (gated behind
   * `feature = "future"`; landed structurally by #1068). The wire
   * shape of the extension point is the same on both sides — the
   * cross-backend determinism gate (#685) verifies the two
   * implementations stay byte-equivalent.
   *
   * The wrapped-Graph back-channel for reaching the BackendEngine is
   * the `__backendForTest` accessor namespaced under the `__` prefix
   * to make it clear it is not part of the supported public surface.
   * The cross-backend determinism gate uses this accessor; the
   * eventual Rust-bridge implementation replaces the delegation
   * entirely.
   */
  evaluateStatechart(input) {
    const backendForTest = this.#graph.__backendForTest;
    if (backendForTest !== void 0) {
      return backendForTest.evaluateStatechart(input);
    }
    return {
      kind: "forbidden",
      reason: {
        region: input.region,
        from: "__backend-for-test-missing__",
        to: "__backend-for-test-missing__",
        id: input.id
      }
    };
  }
  /**
   * Test/integration helper — return the wrapped `Graph`.
   *
   * @remarks
   * Not part of the supported public surface; reachable only through
   * the `__graph()` accessor on the `WasmBackend` instance so adopter
   * code that programs against `BackendEngine` alone cannot
   * accidentally reach in. The cross-backend determinism gate (#685)
   * and the migration round-trip suite (#687) use this to build a
   * `World`-shaped pair of engines that share a graphId.
   *
   * @internal
   */
  __graph() {
    return this.#graph;
  }
  /**
   * Register an input handle so subsequent `commit({ id })` writes
   * can resolve the typed `Node<T>` they map to. Idempotent — calling
   * with an already-registered id is a no-op.
   *
   * @internal Used by the cross-backend determinism gate's
   * `World`-shaped adapter to keep the wrapper's id registry in
   * lockstep with the underlying `Graph`'s.
   */
  __registerInput(id, handle) {
    this.#inputs.set(id, handle);
    this.#nodeRegistry.set(id, handle);
  }
  /**
   * Register a derived handle for read/subscribe routing. Derived
   * nodes are not write targets so they bypass the `#inputs` map.
   *
   * @internal
   */
  __registerDerived(id, handle) {
    this.#nodeRegistry.set(id, handle);
  }
};
function __isPhase1WasmBackendForTests(engine) {
  return engine instanceof WasmBackend;
}
function __createWasmBackendSyncForTests(graphName, bridge = "serde-json") {
  return new WasmBackend(bridge, graphName);
}
async function loadStreaming(url, imports, fetchImpl = fetch) {
  const href = typeof url === "string" ? url : url.href;
  if (typeof WebAssembly.instantiateStreaming === "function") {
    try {
      const resp = fetchImpl(href, { credentials: "same-origin" });
      return await WebAssembly.instantiateStreaming(resp, imports);
    } catch {
    }
  }
  const buf = await (await fetchImpl(href)).arrayBuffer();
  return WebAssembly.instantiate(buf, imports);
}
export {
  WasmBackendUnavailableError,
  __createWasmBackendSyncForTests,
  __isPhase1WasmBackendForTests,
  __resetWasmBackendCacheForTests,
  detectBridge,
  loadStreaming,
  loadWasmBackend,
  wasmUrlFor
};
//# sourceMappingURL=wasm.js.map