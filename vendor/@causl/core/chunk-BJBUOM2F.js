import {
  assertNever,
  registerInternalDispatch
} from "./chunk-SG3KXR2O.js";
import {
  registerTestingDispatch
} from "./chunk-SHOBOWND.js";

// package.json
var version = "0.3.6";

// src/errors.ts
var CauslError = class extends Error {
  name = "CauslError";
};
var DuplicateNodeError = class extends CauslError {
  constructor(id) {
    super(`Node already registered: ${id}`);
    this.id = id;
  }
  id;
  name = "DuplicateNodeError";
  /** Discriminated tag for exhaustive matching. */
  kind = "DuplicateNode";
};
var UnknownNodeError = class extends CauslError {
  constructor(id) {
    super(`Unknown node: ${id}`);
    this.id = id;
  }
  id;
  name = "UnknownNodeError";
  /** Discriminated tag for exhaustive matching. */
  kind = "UnknownNode";
};
var NotAnInputNodeError = class extends CauslError {
  constructor(id) {
    super(`Cannot tx.set a derived node: ${id}`);
    this.id = id;
  }
  id;
  name = "NotAnInputNodeError";
  /** Discriminated tag for exhaustive matching. */
  kind = "NotAnInputNode";
};
var CommitInProgressError = class extends CauslError {
  name = "CommitInProgressError";
  /** Discriminated tag for exhaustive matching. */
  kind = "CommitInProgress";
  constructor() {
    super("A commit is already in progress; commits do not nest.");
  }
};
var CycleError = class extends CauslError {
  constructor(path) {
    super(`Derivation cycle detected: ${path.join(" \u2192 ")}`);
    this.path = path;
  }
  path;
  name = "CycleError";
  /** Discriminated tag for exhaustive matching. */
  kind = "Cycle";
};
var UNDECLARED_DEPENDENCY_MARKER = "causl:undeclared-dependency";
var UndeclaredDependencyError = class extends CauslError {
  constructor(derivedId, depId) {
    super(
      `derived '${derivedId}' read dependency '${depId}', which is not a registered node on the graph (${UNDECLARED_DEPENDENCY_MARKER})`
    );
    this.derivedId = derivedId;
    this.depId = depId;
  }
  derivedId;
  depId;
  name = "UndeclaredDependencyError";
  /** Discriminated tag for exhaustive matching. */
  kind = "UndeclaredDependency";
};
var DerivedComputeError = class extends CauslError {
  constructor(derivedId, cause) {
    const causeMsg = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    super(
      `Derived ${JSON.stringify(derivedId)} compute threw: ${causeMsg}`
    );
    this.derivedId = derivedId;
    this.cause = cause;
  }
  derivedId;
  cause;
  name = "DerivedComputeError";
  /** Discriminated tag for exhaustive matching. */
  kind = "DerivedCompute";
};
function asDerivedComputeError(derivedId, err) {
  if (err instanceof CauslError) return err;
  return new DerivedComputeError(derivedId, err);
}
var StaleTxError = class extends CauslError {
  name = "StaleTxError";
  /** Discriminated tag for exhaustive matching. */
  kind = "StaleTx";
  constructor() {
    super("Tx used outside its commit callback.");
  }
};
var NodeDisposedError = class extends CauslError {
  constructor(id, disposedAt) {
    super(`Node "${id}" was disposed at t=${disposedAt}`);
    this.id = id;
    this.disposedAt = disposedAt;
  }
  id;
  disposedAt;
  name = "NodeDisposedError";
  /** Discriminated tag for exhaustive matching. */
  kind = "NodeDisposed";
};
var NodeHasDependentsError = class extends CauslError {
  constructor(id, dependents) {
    super(
      `Cannot dispose "${id}" \u2014 it still has ${dependents.length} dependent(s): ${dependents.join(", ")}`
    );
    this.id = id;
    this.dependents = dependents;
  }
  id;
  dependents;
  name = "NodeHasDependentsError";
  /** Discriminated tag for exhaustive matching. */
  kind = "NodeHasDependents";
};
var HydrationSchemaError = class extends CauslError {
  constructor(reason, detail) {
    super(`Hydration rejected (${reason}): ${detail}`);
    this.reason = reason;
    this.detail = detail;
  }
  reason;
  detail;
  name = "HydrationSchemaError";
  /** Discriminated tag for exhaustive matching. */
  kind = "HydrationSchema";
};
var DisposalDuringCommitError = class extends CauslError {
  constructor(id) {
    super(`Cannot dispose "${id}" while a commit is in progress`);
    this.id = id;
  }
  id;
  name = "DisposalDuringCommitError";
  /** Discriminated tag for exhaustive matching. */
  kind = "DisposalDuringCommit";
};
var NonDeterministicComputeError = class extends CauslError {
  constructor(id, path) {
    super(
      `Derived "${id}" is not a deterministic function of its declared dependencies: re-running its compute against the same dep snapshot produced a different value. Path: ${path.join(" \u2192 ")}`
    );
    this.id = id;
    this.path = path;
  }
  id;
  path;
  name = "NonDeterministicComputeError";
  /** Discriminated tag for exhaustive matching. */
  kind = "NonDeterministicCompute";
};
var DerivedRegistrationStackOverflowError = class extends CauslError {
  constructor(id, scale = -1) {
    super(
      `Derived "${id}" registration overflowed the V8 call stack \u2014 the engine's closure-tracking walker recurses one frame per dep-chain edge and exhausted the stack at depth` + (scale >= 0 ? ` \u2265 ${scale}` : "") + `. The chain is too deep for the recursive registration walker; reduce the chain depth, or split the registration into smaller batches separated by a commit (#936).`
    );
    this.id = id;
    this.scale = scale;
  }
  id;
  scale;
  name = "DerivedRegistrationStackOverflowError";
  /** Discriminated tag for exhaustive matching. */
  kind = "DerivedRegistrationStackOverflow";
};
var InvalidGraphNameError = class extends CauslError {
  constructor(invalidName) {
    super(
      `Invalid graph name: ${JSON.stringify(invalidName)}. Must match /^[A-Za-z0-9_.:-]{1,256}$/.`
    );
    this.invalidName = invalidName;
  }
  invalidName;
  name = "InvalidGraphNameError";
  /** Discriminated tag for exhaustive matching. */
  kind = "InvalidGraphName";
};
var InvariantViolationError = class extends CauslError {
  constructor(nodeId, value, cause) {
    const causeMsg = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    super(
      `Invariant violated for input node ${JSON.stringify(nodeId)}: ${causeMsg}`
    );
    this.nodeId = nodeId;
    this.value = value;
    this.cause = cause;
  }
  nodeId;
  value;
  cause;
  name = "InvariantViolationError";
  /** Discriminated tag for exhaustive matching. */
  kind = "InvariantViolation";
};
var WasmInstancePoisonedError = class extends CauslError {
  constructor(cause) {
    super(
      `The shared wasm instance is poisoned: a Rust trap (panic) aborted mid-mutation with no unwinding, leaving the engine's state undefined. This is NOT a \xA75.2 atomic rollback \u2014 every engine multiplexed on this instance now fails loud rather than silently serving state that diverges from the poisoned engine. Rebuild the graph on a fresh instance to recover.`
    );
    this.cause = cause;
  }
  cause;
  name = "WasmInstancePoisonedError";
  /** Discriminated tag for exhaustive matching. */
  kind = "WasmInstancePoisoned";
};
var RetainedValueUnavailableError = class extends CauslError {
  constructor(nodeId, time) {
    super(
      `Historical container value for input node ${JSON.stringify(nodeId)} at time ${time} is unavailable: the wasm engine retains containers only as a structural content-hash, and this row's value is no longer the live reference held host-side. The value was not retained and cannot be reconstructed.`
    );
    this.nodeId = nodeId;
    this.time = time;
  }
  nodeId;
  time;
  name = "RetainedValueUnavailableError";
  /** Discriminated tag for exhaustive matching. */
  kind = "RetainedValueUnavailable";
};
var InvalidInjectedBackendError = class extends CauslError {
  constructor(missing) {
    super(
      missing.length === 0 ? `Invalid authoritative backend: expected an object implementing the InjectedBackend contract, received a non-object.` : `Invalid authoritative backend: missing required member(s) ${missing.map((m) => JSON.stringify(m)).join(", ")}. The injected backend must implement the full InjectedBackend contract (commit, read, subscribe, registerInput, registerDerived, has).`
    );
    this.missing = missing;
  }
  missing;
  name = "InvalidInjectedBackendError";
  /** Discriminated tag for exhaustive matching. */
  kind = "InvalidInjectedBackend";
};

// src/backend.ts
var JsBackend = class {
  #ops;
  constructor(ops) {
    this.#ops = ops;
  }
  commit(intent, writes) {
    return this.#ops.commit(intent, writes);
  }
  read(node) {
    return this.#ops.read(node);
  }
  subscribe(node, observer) {
    return this.#ops.subscribe(node, observer);
  }
  subscribeCommits(observer) {
    return this.#ops.subscribeCommits(observer);
  }
  snapshot() {
    return this.#ops.snapshot();
  }
  hydrate(s) {
    this.#ops.hydrate(s);
  }
  exportModel(opts) {
    return this.#ops.exportModel(opts);
  }
  readAt(node, time) {
    return this.#ops.readAt(node, time);
  }
  snapshotAt(time) {
    return this.#ops.snapshotAt(time);
  }
  dispose(node) {
    this.#ops.dispose(node);
  }
  evaluateStatechart(input) {
    return this.#ops.evaluateStatechart(input);
  }
  get now() {
    return this.#ops.now();
  }
};

// src/wasm-registry.ts
var registration;
function registerWasmSyncEngine(reg) {
  registration = reg;
}
var capabilityFallbackHook;
function onCauslCapabilityFallback(hook) {
  const prior = capabilityFallbackHook;
  capabilityFallbackHook = hook;
  return () => {
    capabilityFallbackHook = prior;
  };
}
var capabilityFallbackNotified = false;
var firstPrePreloadTsFallSite;
var mixedEngineNotified = false;
function captureConstructSite() {
  const stack = new Error("causl construct site").stack;
  if (typeof stack !== "string" || stack.length === 0) {
    return "<construct site unavailable: no stack on this host>";
  }
  const frames = stack.split("\n");
  for (const raw of frames) {
    const line = raw.trim();
    if (!line.startsWith("at ")) continue;
    if (line.includes("wasm-registry") || /\bcreateCausl\b/.test(line)) {
      continue;
    }
    return line;
  }
  const firstAt = frames.find((f) => f.trim().startsWith("at "));
  return firstAt !== void 0 ? firstAt.trim() : "<construct site unavailable: unrecognised stack format>";
}
function recordPrePreloadTsFall() {
  if (firstPrePreloadTsFallSite !== void 0) return;
  firstPrePreloadTsFallSite = captureConstructSite();
}
function warnMixedEngineOnce() {
  if (mixedEngineNotified) return;
  if (firstPrePreloadTsFallSite === void 0) return;
  mixedEngineNotified = true;
  console.warn(
    `causl: MIXED-ENGINE startup race (\xA718A.5) \u2014 an implicit createCausl() built a pure-TS graph BEFORE preloadCauslWasm() resolved, then a later createCausl() built a wasm graph. The engines differ in read()-identity and commit-clock, so mixing them is a glitch-freedom hazard. First pre-preload site:
    ${firstPrePreloadTsFallSite}
Fix the boot ordering: await preloadCauslWasm() once at init BEFORE the first createCausl(), or pin engine:'rust-ssot'/'js-ssot' per call.`
  );
}
function emitCapabilityFallbackOnce(cause) {
  if (capabilityFallbackNotified) return;
  capabilityFallbackNotified = true;
  console.warn(
    "causl: WasmGC engine unavailable on this host \u2014 falling back to the TypeScript engine (engine:'js-ssot'). This is the \xA718A.13.1 capability fallback (implicit createCausl() path only); explicit createCauslWasm() / engine:'rust-ssot' still fail loud. Affected hosts: Safari < 18 / macOS < 15, policy-pinned pre-119 Chromium/WebView2, Node <= 20."
  );
  const hook = capabilityFallbackHook;
  if (hook !== void 0) {
    try {
      hook({
        type: "causl:capability-fallback",
        spec: "\xA718A.13.1",
        fallbackEngine: "js-ssot",
        cause
      });
    } catch {
    }
  }
}
function createWasmSyncIfPreloaded(createOptions) {
  const reg = registration;
  if (reg === void 0) {
    recordPrePreloadTsFall();
    return void 0;
  }
  if (!reg.isPreloadedForDefaultBridge()) {
    recordPrePreloadTsFall();
    return void 0;
  }
  try {
    const graph = reg.createSync(createOptions);
    warnMixedEngineOnce();
    return graph;
  } catch (err) {
    if (reg.isCapabilityFailure(err)) {
      emitCapabilityFallbackOnce(err);
      return void 0;
    }
    throw err;
  }
}
var WasmEngineUnavailableError = class extends Error {
  code = "CAUSL_WASM_ENGINE_UNAVAILABLE";
  constructor(detail) {
    super(detail);
    this.name = "WasmEngineUnavailableError";
  }
};
function createWasmExplicitOrThrow(createOptions) {
  const reg = registration;
  if (reg === void 0) {
    throw new WasmEngineUnavailableError(
      "createCausl({ engine: 'rust-ssot' }): the wasm engine was explicitly requested but the @causl/client-ts/wasm subpath has not been imported, so no wasm engine is available on this host \u2014 refusing to silently fall back to the TS engine. Import @causl/client-ts/wasm and call preloadCauslWasm() once at init, or drop the explicit engine to use the implicit createCausl() capability fallback."
    );
  }
  return reg.createSync(createOptions);
}

// src/statechart-evaluator.ts
function evaluateConflict(state, event, time, id) {
  const to = event.kind === "resolve" ? "resolved" : event.kind === "ignore" ? "ignored" : "superseded";
  if (state !== "open") {
    const reason = {
      region: "conflict",
      from: state,
      to,
      id
    };
    return { kind: "forbidden", reason };
  }
  switch (event.kind) {
    case "resolve":
      return {
        kind: "ok",
        next: { kind: "resolved", value: event.resolution, at: time }
      };
    case "ignore":
      return { kind: "ok", next: { kind: "ignored", at: time } };
    case "supersede":
      return {
        kind: "ok",
        next: {
          kind: "superseded",
          bySupersedingId: event.bySupersedingId,
          at: time
        }
      };
  }
}
function evaluateResource(state, event, time, id) {
  switch (event.kind) {
    // `* → Loading` is unconditional in the chart — issuing a fetch
    // from any source state is the host-driven trigger.
    case "fetch-start":
      return {
        kind: "ok",
        next: {
          state: "loading",
          origin: event.origin,
          promise: event.promise
        }
      };
    // `Loading → Loaded | Stale` applies only to the *current* loading
    // episode. A settle whose `episode` token no longer matches the
    // loading state (superseded by a newer fetch, or the resource left
    // `loading` via a host `fail()`/refetch) is a chart no-op, NOT a
    // forbidden throw — issue #109.
    case "fetch-resolve": {
      if (state.state !== "loading" || state.promise !== event.episode) {
        return { kind: "ok", next: state };
      }
      const isStale = event.stalenessGuard && time > event.loadingAt;
      return {
        kind: "ok",
        next: isStale ? {
          state: "stale",
          value: event.value,
          origin: state.origin,
          loadedAt: time
        } : {
          state: "loaded",
          value: event.value,
          origin: state.origin,
          loadedAt: time
        }
      };
    }
    // `Loading → Errored` via the loader's rejection branch. Legal only
    // for the *current* loading episode; a superseded/host-cancelled
    // rejection is a chart no-op so the loader's real error is neither
    // swallowed nor allowed to overwrite a newer state — issue #109.
    case "fetch-reject": {
      if (state.state !== "loading" || state.promise !== event.episode) {
        return { kind: "ok", next: state };
      }
      return {
        kind: "ok",
        next: {
          state: "errored",
          error: event.error,
          origin: state.origin,
          erroredAt: time
        }
      };
    }
    // `Loaded → Stale` via `invalidate`. Every other source state is
    // a chart-named no-op (the pre-#698 silent-no-op).
    case "invalidate": {
      if (state.state !== "loaded") {
        return { kind: "ok", next: state };
      }
      return {
        kind: "ok",
        next: {
          state: "stale",
          value: state.value,
          origin: state.origin,
          loadedAt: state.loadedAt
        }
      };
    }
    // `Loading | Loaded → Errored` via the host-side `fail()` trigger.
    // Every other source state is forbidden and surfaces through
    // `ForbiddenResourceTransitionError` on the wiring side.
    case "fail":
      if (state.state !== "loading" && state.state !== "loaded") {
        const reason = {
          region: "resource",
          from: state.state,
          to: "errored",
          id
        };
        return { kind: "forbidden", reason };
      }
      return {
        kind: "ok",
        next: {
          state: "errored",
          error: event.error,
          origin: state.origin,
          erroredAt: time
        }
      };
  }
}
function evaluateStatechart(input) {
  switch (input.region) {
    case "conflict":
      return evaluateConflict(
        input.state,
        input.event,
        input.time,
        input.id
      );
    case "resource":
      return evaluateResource(
        input.state,
        input.event,
        input.time,
        input.id
      );
  }
}

// src/flags.ts
function loadFlagsFromEnv() {
  let freezeOffInProd = false;
  let assertDeterministicCompute = false;
  try {
    const proc = globalThis.process;
    if (proc?.env?.CAUSL_FREEZE_OFF_IN_PROD === "1") {
      freezeOffInProd = true;
    }
    if (proc?.env?.CAUSL_ASSERT_DETERMINISTIC_COMPUTE === "1") {
      assertDeterministicCompute = true;
    }
  } catch {
  }
  return Object.freeze({ freezeOffInProd, assertDeterministicCompute });
}
var MODULE_FLAGS = loadFlagsFromEnv();
function mergeFlags(overrides) {
  if (overrides === void 0) return MODULE_FLAGS;
  return Object.freeze({ ...MODULE_FLAGS, ...overrides });
}

// src/injected-backend.ts
var INJECTED_BACKEND = /* @__PURE__ */ Symbol(
  "causl.internal.injectedBackend"
);
function withInjectedBackend(options, backend) {
  return { ...options, [INJECTED_BACKEND]: backend };
}
function readInjectedBackend(options) {
  return options[INJECTED_BACKEND];
}
var REQUIRED_MEMBERS = [
  "commit",
  "read",
  "subscribe",
  "registerInput",
  "registerDerived",
  "has"
];
function assertValidInjectedBackend(backend) {
  if (typeof backend !== "object" || backend === null) {
    throw new InvalidInjectedBackendError([]);
  }
  const bag = backend;
  const missing = REQUIRED_MEMBERS.filter(
    (member) => typeof bag[member] !== "function"
  );
  if (missing.length > 0) {
    throw new InvalidInjectedBackendError(missing);
  }
}

// src/ir.ts
var CAUSL_MODEL_SCHEMA = 3;
function parseCauslModel(input) {
  if (typeof input !== "object" || input === null) {
    return { ok: false, path: [], reason: "not-an-object" };
  }
  const m = input;
  if (m.schema !== CAUSL_MODEL_SCHEMA) {
    return {
      ok: false,
      path: ["schema"],
      reason: `expected schema ${CAUSL_MODEL_SCHEMA}, got ${String(m.schema)}`
    };
  }
  if (typeof m.time !== "number") {
    return { ok: false, path: ["time"], reason: "expected number" };
  }
  if (!Array.isArray(m.nodes)) {
    return { ok: false, path: ["nodes"], reason: "expected array" };
  }
  if (!Array.isArray(m.commits)) {
    return { ok: false, path: ["commits"], reason: "expected array" };
  }
  if (!Array.isArray(m.events)) {
    return { ok: false, path: ["events"], reason: "expected array" };
  }
  if (!Array.isArray(m.scopes)) {
    return { ok: false, path: ["scopes"], reason: "expected array" };
  }
  if (!Array.isArray(m.bridges)) {
    return { ok: false, path: ["bridges"], reason: "expected array" };
  }
  for (let i = 0; i < m.events.length; i++) {
    const e = m.events[i];
    if (typeof e !== "object" || e === null) {
      return {
        ok: false,
        path: ["events", i],
        reason: "event is not an object"
      };
    }
    const ev = e;
    const kind = ev.kind;
    switch (kind) {
      case "subscribe":
      case "subscribe-callback":
      case "unsubscribe":
      case "read":
      case "tx-set":
        break;
      case "dispose": {
        const da = ev.disposeAt;
        if (!Array.isArray(da) || da.length !== 2 || typeof da[0] !== "number" || typeof da[1] !== "number") {
          return {
            ok: false,
            path: ["events", i, "disposeAt"],
            reason: "expected [number, number]"
          };
        }
        break;
      }
      default:
        return {
          ok: false,
          path: ["events", i, "kind"],
          reason: `unknown event kind: ${String(kind)}`
        };
    }
  }
  return { ok: true, value: input };
}

// src/env.ts
var NODE_ENV_IS_PRODUCTION = process.env.NODE_ENV === "production";

// src/value-domain.ts
function isWireNull(value) {
  if (value === null || value === void 0) return true;
  const t = typeof value;
  return t === "bigint" || t === "symbol" || t === "function";
}
function inputValueChanged(before, after) {
  if (Object.is(before, after)) return false;
  if (isWireNull(before) && isWireNull(after)) return false;
  return true;
}

// wasm/cyclic-guard.ts
var MAX_ENCODE_DEPTH = 256;
var CyclicValueError = class extends RangeError {
  constructor(context, maxDepth = MAX_ENCODE_DEPTH) {
    super(
      `cyclic or over-nested value: encode step "${context}" exceeded the maximum value-nesting depth of ${maxDepth} \u2014 the value is cyclic (a container reachable from itself) or nested too deeply to cross the wasm value boundary`
    );
    this.context = context;
    this.maxDepth = maxDepth;
  }
  context;
  maxDepth;
  name = "CyclicValueError";
};
function guardEncodeDepth(depth, context) {
  if (depth >= MAX_ENCODE_DEPTH) {
    throw new CyclicValueError(context);
  }
}

// wasm/tagged-types.ts
var CAUSL_TYPE_KEY = "__causlType";
var KNOWN_TAGS = /* @__PURE__ */ new Set([
  "Set",
  "Map",
  "Date",
  "Temporal"
]);
var injectedTemporal;
var warnedNoTemporal = false;
function currentTemporalImpl() {
  return injectedTemporal;
}
function resolveTemporal(temporal) {
  if (temporal !== void 0) return temporal;
  if (injectedTemporal !== void 0) return injectedTemporal;
  const g = globalThis.Temporal;
  return g;
}
function looksLikeTag(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const tag = v[CAUSL_TYPE_KEY];
  return typeof tag === "string" && KNOWN_TAGS.has(tag);
}
function temporalKindOf(v) {
  const tag = v[Symbol.toStringTag];
  if (typeof tag !== "string" || !tag.startsWith("Temporal.")) return void 0;
  const kind = tag.slice("Temporal.".length);
  switch (kind) {
    case "Instant":
    case "PlainDate":
    case "PlainTime":
    case "PlainDateTime":
    case "PlainYearMonth":
    case "PlainMonthDay":
    case "ZonedDateTime":
    case "Duration":
      return kind;
    default:
      return void 0;
  }
}
function hasTaggedTypes(value, depth = 0) {
  if (value === null || typeof value !== "object") return false;
  if (value instanceof Set || value instanceof Map || value instanceof Date) {
    return true;
  }
  if (temporalKindOf(value) !== void 0) return true;
  guardEncodeDepth(depth, "hasTaggedTypes");
  if (Array.isArray(value)) {
    for (const el of value) if (hasTaggedTypes(el, depth + 1)) return true;
    return false;
  }
  for (const k in value) {
    if (Object.prototype.hasOwnProperty.call(value, k)) {
      if (hasTaggedTypes(value[k], depth + 1)) {
        return true;
      }
    }
  }
  return false;
}
function encodeTagged(value, depth = 0) {
  if (value === null || typeof value !== "object") return value;
  guardEncodeDepth(depth, "encodeTagged");
  if (value instanceof Set) {
    return {
      [CAUSL_TYPE_KEY]: "Set",
      values: Array.from(value, (el) => encodeTagged(el, depth + 1))
    };
  }
  if (value instanceof Map) {
    const entries = [];
    for (const [k, v] of value) {
      entries.push([encodeTagged(k, depth + 1), encodeTagged(v, depth + 1)]);
    }
    return { [CAUSL_TYPE_KEY]: "Map", entries };
  }
  if (value instanceof Date) {
    return { [CAUSL_TYPE_KEY]: "Date", epochMs: value.getTime() };
  }
  const temporalKind = temporalKindOf(value);
  if (temporalKind !== void 0) {
    return {
      [CAUSL_TYPE_KEY]: "Temporal",
      kind: temporalKind,
      iso: value.toString()
    };
  }
  if (Array.isArray(value)) {
    return value.map((el) => encodeTagged(el, depth + 1));
  }
  const out = {};
  for (const k in value) {
    if (Object.prototype.hasOwnProperty.call(value, k)) {
      out[k] = encodeTagged(value[k], depth + 1);
    }
  }
  return out;
}
function reviveDate(tag) {
  const epochMs = tag.epochMs;
  return new Date(typeof epochMs === "number" ? epochMs : NaN);
}
function reviveTemporal(tag, temporal) {
  const iso = tag.iso;
  const kind = tag.kind;
  if (typeof iso !== "string" || typeof kind !== "string") return iso;
  const Temporal = resolveTemporal(temporal);
  const ctor = Temporal?.[kind];
  if (ctor === void 0 || typeof ctor.from !== "function") {
    if (!warnedNoTemporal) {
      warnedNoTemporal = true;
      console.warn(
        `@causl/client-ts/wasm: a Temporal.${kind} value round-tripped through the wasm value path but no Temporal impl is available to reconstruct it (call setTemporalImpl(Temporal) at wasm graph construction). Falling back to the ISO string '${iso}'.`
      );
    }
    return iso;
  }
  try {
    return ctor.from(iso);
  } catch {
    return iso;
  }
}
function reviveTagged(value, temporal) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((el) => reviveTagged(el, temporal));
  }
  if (looksLikeTag(value)) {
    const tag = value;
    switch (tag[CAUSL_TYPE_KEY]) {
      case "Set": {
        const values = Array.isArray(tag.values) ? tag.values : [];
        return new Set(values.map((el) => reviveTagged(el, temporal)));
      }
      case "Map": {
        const entries = Array.isArray(tag.entries) ? tag.entries : [];
        const map = /* @__PURE__ */ new Map();
        for (const entry of entries) {
          if (Array.isArray(entry) && entry.length === 2) {
            map.set(
              reviveTagged(entry[0], temporal),
              reviveTagged(entry[1], temporal)
            );
          }
        }
        return map;
      }
      case "Date":
        return reviveDate(tag);
      case "Temporal":
        return reviveTemporal(tag, temporal);
      // istanbul ignore next — KNOWN_TAGS gates looksLikeTag.
      default:
        break;
    }
  }
  const out = {};
  for (const k in value) {
    if (Object.prototype.hasOwnProperty.call(value, k)) {
      out[k] = reviveTagged(value[k], temporal);
    }
  }
  return out;
}

// wasm/content-hash.ts
var SOH = "";
var CONTENT_HASH_MARKER_PREFIX = `${SOH}causl-content-hash:`;
var CONTENT_HASH_MARKER_LEN = CONTENT_HASH_MARKER_PREFIX.length + 32;
var INPUT_EPOCH_MARKER_PREFIX = `${SOH}ie:`;
var INPUT_EPOCH_HEX_LEN = 16;
var INPUT_EPOCH_MARKER_LEN = INPUT_EPOCH_MARKER_PREFIX.length + INPUT_EPOCH_HEX_LEN;
function packInputEpoch(slot, epoch) {
  return BigInt(slot >>> 0) << 32n | BigInt(epoch >>> 0);
}
function inputEpochMarkerForPacked(payload) {
  const hex = (payload & 0xffffffffffffffffn).toString(16).padStart(INPUT_EPOCH_HEX_LEN, "0");
  return `${INPUT_EPOCH_MARKER_PREFIX}${hex}`;
}
function inputEpochMarker(slot, epoch) {
  return inputEpochMarkerForPacked(packInputEpoch(slot, epoch));
}
function parseInputEpoch(s) {
  if (s.length !== INPUT_EPOCH_MARKER_LEN) return void 0;
  if (!s.startsWith(INPUT_EPOCH_MARKER_PREFIX)) return void 0;
  const tail = s.slice(INPUT_EPOCH_MARKER_PREFIX.length);
  if (!/^[0-9a-f]{16}$/.test(tail)) return void 0;
  return BigInt(`0x${tail}`);
}
var textEncoder = new TextEncoder();
var SHA256_K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function rotr32(x, n) {
  return x >>> n | x << 32 - n;
}
function newHasher() {
  return {
    // SHA-256 IV: first 32 bits of the square roots of the first 8 primes.
    h: Uint32Array.of(
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ),
    block: new Uint8Array(64),
    blockLen: 0,
    totalLen: 0
  };
}
var W = new Uint32Array(64);
function compress(hh) {
  const h = hh.h;
  const b = hh.block;
  for (let i = 0; i < 16; i++) {
    const j = i << 2;
    W[i] = (b[j] << 24 | b[j + 1] << 16 | b[j + 2] << 8 | b[j + 3]) >>> 0;
  }
  for (let i = 16; i < 64; i++) {
    const x = W[i - 15];
    const y = W[i - 2];
    const s0 = rotr32(x, 7) ^ rotr32(x, 18) ^ x >>> 3;
    const s1 = rotr32(y, 17) ^ rotr32(y, 19) ^ y >>> 10;
    W[i] = W[i - 16] + s0 + W[i - 7] + s1 | 0;
  }
  let a = h[0];
  let b0 = h[1];
  let c = h[2];
  let d = h[3];
  let e = h[4];
  let f = h[5];
  let g = h[6];
  let hw = h[7];
  for (let i = 0; i < 64; i++) {
    const s1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
    const ch = e & f ^ ~e & g;
    const t1 = hw + s1 + ch + SHA256_K[i] + W[i] | 0;
    const s0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
    const maj = a & b0 ^ a & c ^ b0 & c;
    const t2 = s0 + maj | 0;
    hw = g;
    g = f;
    f = e;
    e = d + t1 | 0;
    d = c;
    c = b0;
    b0 = a;
    a = t1 + t2 | 0;
  }
  h[0] = h[0] + a | 0;
  h[1] = h[1] + b0 | 0;
  h[2] = h[2] + c | 0;
  h[3] = h[3] + d | 0;
  h[4] = h[4] + e | 0;
  h[5] = h[5] + f | 0;
  h[6] = h[6] + g | 0;
  h[7] = h[7] + hw | 0;
}
function updateByte(h, byte) {
  h.block[h.blockLen++] = byte;
  h.totalLen++;
  if (h.blockLen === 64) {
    compress(h);
    h.blockLen = 0;
  }
}
function updateBytes(h, bytes) {
  for (let i = 0; i < bytes.length; i++) updateByte(h, bytes[i]);
}
function updateU32(h, n) {
  updateByte(h, n & 255);
  updateByte(h, n >>> 8 & 255);
  updateByte(h, n >>> 16 & 255);
  updateByte(h, n >>> 24 & 255);
}
function updateU32be(h, n) {
  updateByte(h, n >>> 24 & 255);
  updateByte(h, n >>> 16 & 255);
  updateByte(h, n >>> 8 & 255);
  updateByte(h, n & 255);
}
function hex32(n) {
  return (n >>> 0).toString(16).padStart(8, "0");
}
function finalizeHex128(h) {
  const totalBytes = h.totalLen;
  const bitLenHi = Math.floor(totalBytes / 536870912);
  const bitLenLo = totalBytes * 8 >>> 0;
  updateByte(h, 128);
  while (h.blockLen !== 56) updateByte(h, 0);
  updateU32be(h, bitLenHi);
  updateU32be(h, bitLenLo);
  return hex32(h.h[0]) + hex32(h.h[1]) + hex32(h.h[2]) + hex32(h.h[3]);
}
var TAG_NULL = 0;
var TAG_BOOL = 1;
var TAG_NUMBER = 2;
var TAG_STRING = 3;
var TAG_ARRAY = 4;
var TAG_OBJECT = 5;
var f64buf = new ArrayBuffer(8);
var f64view = new DataView(f64buf);
var f64u32 = new Uint32Array(f64buf);
f64view.setFloat64(0, NaN, true);
var NAN_LO = f64u32[0];
var NAN_HI = f64u32[1];
function hashValue(h, value, depth = 0) {
  if (value === null || value === void 0) {
    updateByte(h, TAG_NULL);
    return;
  }
  if (typeof value === "boolean") {
    updateByte(h, TAG_BOOL);
    updateByte(h, value ? 1 : 0);
    return;
  }
  if (typeof value === "number") {
    updateByte(h, TAG_NUMBER);
    if (Number.isNaN(value)) {
      updateU32(h, NAN_LO);
      updateU32(h, NAN_HI);
    } else {
      f64view.setFloat64(0, value, true);
      updateU32(h, f64u32[0]);
      updateU32(h, f64u32[1]);
    }
    return;
  }
  if (typeof value === "string") {
    updateByte(h, TAG_STRING);
    const bytes = textEncoder.encode(value);
    updateU32(h, bytes.length);
    updateBytes(h, bytes);
    return;
  }
  guardEncodeDepth(depth, "hashValue");
  if (Array.isArray(value)) {
    updateByte(h, TAG_ARRAY);
    updateU32(h, value.length);
    for (const el of value) hashValue(h, el, depth + 1);
    return;
  }
  if (typeof value === "object") {
    updateByte(h, TAG_OBJECT);
    const keys = Object.keys(value).sort();
    updateU32(h, keys.length);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const keyBytes = textEncoder.encode(k);
      updateU32(h, keyBytes.length);
      updateBytes(h, keyBytes);
      hashValue(h, value[k], depth + 1);
    }
    return;
  }
  updateByte(h, TAG_NULL);
}
function contentHashMarker(value) {
  const tagged = hasTaggedTypes(value) ? encodeTagged(value) : value;
  const h = newHasher();
  hashValue(h, tagged);
  return `${CONTENT_HASH_MARKER_PREFIX}${finalizeHex128(h)}`;
}

// src/graph.ts
function derivedValueChanged(before, after) {
  if (Object.is(before, after)) return false;
  if (isWireNull(before) && isWireNull(after)) return false;
  const beforeIsContainer = typeof before === "object" && before !== null;
  const afterIsContainer = typeof after === "object" && after !== null;
  if (beforeIsContainer && afterIsContainer) {
    return contentHashMarker(before) !== contentHashMarker(after);
  }
  return true;
}
var DEFAULT_COMMIT_HISTORY_CAP = 0;
var DEFAULT_SNAPSHOT_RETENTION_CAP = 0;
function makeFreezeIfDev(flags) {
  if (flags.freezeOffInProd) {
    return (value) => value;
  }
  return (value) => Object.freeze(value);
}
var DEFAULT_DISPOSED_TOMBSTONE_CAP = 1e3;
var defaultOnObserverError = (error, ctx) => {
  console.error(
    `[causl] observer threw (${ctx.source}${ctx.nodeId ? ":" + ctx.nodeId : ""} @ t=${ctx.time}):`,
    error
  );
};
function makeInputNode(id) {
  return Object.freeze({ id });
}
function makeDerivedNode(id) {
  return Object.freeze({ id });
}
function makeInputEntry(id, value, lastWriteTime, node) {
  return {
    kind: "input",
    id,
    value,
    node,
    lastWriteTime,
    // #994 — every freshly-registered input starts with no derived
    // consumers. Edges flip this true on the first `setDeps` add and
    // back to false on the last edge remove.
    hasDependents: false,
    // #995 — split-staged read-shadow sentinel. `-1` is the
    // never-staged value; `tx.set`'s slow path stamps `now` on first
    // stage. See InputEntry's field comment for the lifecycle
    // rationale.
    lastStagedAt: -1,
    lastStagedRow: -1,
    // #1303 — every freshly-registered input starts with no
    // transitively-downstream subscriber. `subscribe` flips this true
    // when the per-node refcount crosses 0 → ≥1 (either by a direct
    // subscriber on this input or by a `setDeps` edge that newly
    // routes a subscribed-derived's path through this input).
    hasDownstreamSubscriber: false
  };
}
var pretenureLatchTripped = false;
var PRETENURE_WARMUP_COUNT = 2e4;
function pretenureInputAllocationSites() {
  if (pretenureLatchTripped) return;
  pretenureLatchTripped = true;
  for (let i = 0; i < PRETENURE_WARMUP_COUNT; i++) {
    const id = `__causl_pretenure__:${i}`;
    const node = makeInputNode(id);
    makeInputEntry(id, i, 0, node);
  }
  const warmupGraph = createCausl();
  for (let i = 0; i < PRETENURE_WARMUP_COUNT; i++) {
    warmupGraph.input(`__causl_pretenure_input__:${i}`, i);
  }
}
var GRAPH_ID_REGEX = /^[A-Za-z0-9_.:-]{1,256}$/;
var autoBackendDeprecationWarned = false;
function warnAutoBackendDeprecatedOnce() {
  if (autoBackendDeprecationWarned) return;
  autoBackendDeprecationWarned = true;
  console.warn(
    "[causl] createCausl({ backend: 'auto' }) is deprecated: it is now an alias for the default engine selection (the real wasm engine when preloaded, else the pure-TS floor) and no longer performs a runtime TS\u2192TS migration. Drop the `backend` option, or call preloadCauslWasm() once at init for the wasm engine."
  );
}
function createCausl(options = {}) {
  if (readInjectedBackend(options) === void 0) {
    if (options.backend === "auto") warnAutoBackendDeprecatedOnce();
    if (options.engine === "rust-ssot") {
      return createWasmExplicitOrThrow(options);
    }
    if (options.engine !== "js-ssot") {
      const wasmGraph = createWasmSyncIfPreloaded(options);
      if (wasmGraph !== void 0) return wasmGraph;
    }
  }
  return createCauslTs(options);
}
function createCauslTs(options = {}) {
  const injectedBackend = readInjectedBackend(options);
  if (injectedBackend !== void 0) {
    assertValidInjectedBackend(injectedBackend);
  }
  const mirroredDerivedIds = /* @__PURE__ */ new Set();
  let materialized = false;
  function flushSeed() {
    if (injectedBackend === void 0) return;
    if (materialized) return;
    materialized = true;
    injectedBackend.materialize?.();
  }
  const rustSsotBackend = injectedBackend !== void 0 && injectedBackend.engineMode === "rust-ssot" && typeof injectedBackend.dependencies === "function" && typeof injectedBackend.dependents === "function" && typeof injectedBackend.stats === "function" ? injectedBackend : void 0;
  function rustOwns(id) {
    return rustSsotBackend !== void 0 && rustSsotBackend.has(id);
  }
  const explainsTopologyFromRust = injectedBackend !== void 0 && injectedBackend.explainsLineageFromRust?.() === true && injectedBackend.explainNode !== void 0;
  const explainsTimestampsFromRust = explainsTopologyFromRust && injectedBackend.explainsTimestampsFromRust?.() === true && injectedBackend.nodeMeta !== void 0;
  pretenureInputAllocationSites();
  const commitHistoryCap = options.commitHistoryCap ?? DEFAULT_COMMIT_HISTORY_CAP;
  injectedBackend?.setCommitHistoryCap?.(commitHistoryCap);
  const engineCommitLogWindow = injectedBackend?.ownsCommitLog?.() ? injectedBackend.commitLogWindow?.bind(injectedBackend) : void 0;
  function backendOwnsCommitLog() {
    return engineCommitLogWindow !== void 0 && commitMetadataIds.size === 0;
  }
  const snapshotRetentionCap = options.snapshotRetentionCap ?? DEFAULT_SNAPSHOT_RETENTION_CAP;
  injectedBackend?.setSnapshotRetentionCap?.(
    commitHistoryCap > 0 ? snapshotRetentionCap : 0
  );
  const backendOwnsRetention = commitHistoryCap > 0 && injectedBackend?.ownsRetention?.() === true && injectedBackend.readAt !== void 0;
  const disposedTombstoneCap = options.disposedTombstoneCap ?? DEFAULT_DISPOSED_TOMBSTONE_CAP;
  const onObserverError = options.onObserverError ?? defaultOnObserverError;
  const _strictCyclesDeprecated = options.strictCycles ?? true;
  const flags = mergeFlags(options.experimentalFlags);
  const freezeIfDev = makeFreezeIfDev(flags);
  const enableH1HazardWarning = options.enableH1HazardWarning ?? false;
  let h1HazardTrack = null;
  if (!NODE_ENV_IS_PRODUCTION) {
    h1HazardTrack = enableH1HazardWarning ? [] : null;
  }
  let adapterReadDepth = 0;
  if (options.name !== void 0 && !GRAPH_ID_REGEX.test(options.name)) {
    throw new InvalidGraphNameError(options.name);
  }
  const graphId = options.name ?? mintGraphIdUuid();
  function mintGraphIdUuid() {
    const fromCrypto = globalThis.crypto?.randomUUID?.();
    if (fromCrypto !== void 0) return fromCrypto;
    const hex = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        s += "-";
      } else if (i === 14) {
        s += "4";
      } else if (i === 19) {
        s += hex[Math.random() * 16 & 3 | 8];
      } else {
        s += hex[Math.random() * 16 | 0];
      }
    }
    return s;
  }
  const retainedSnapshots = [];
  function resolveRetained(row, id) {
    let cur = row;
    while (cur !== null) {
      if (cur.delta.has(id)) return { found: true, value: cur.delta.get(id) };
      cur = cur.prev;
    }
    return { found: false };
  }
  function materialiseRetained(row) {
    const out = {};
    let cur = row;
    while (cur !== null) {
      for (const [id, v] of cur.delta) {
        if (!(id in out)) out[id] = v;
      }
      cur = cur.prev;
    }
    return out;
  }
  const entries = /* @__PURE__ */ new Map();
  const inputInvariants = /* @__PURE__ */ new Map();
  const inputRegisteredAtMap = /* @__PURE__ */ new Map();
  const inputSerializableMemo = /* @__PURE__ */ new Map();
  const commitMetadataIds = /* @__PURE__ */ new Set();
  const explainHandles = /* @__PURE__ */ new Map();
  const dependents = /* @__PURE__ */ new Map();
  const subscriberRefcount = /* @__PURE__ */ new Map();
  const disposed = /* @__PURE__ */ new Map();
  const subscriptions = /* @__PURE__ */ new Set();
  const subscriptionsByNode = /* @__PURE__ */ new Map();
  const pendingTransientDrops = /* @__PURE__ */ new Set();
  const commitObservers = /* @__PURE__ */ new Set();
  const subscribeReadsRegistrations = /* @__PURE__ */ new Set();
  const subscribeReadsByNode = /* @__PURE__ */ new Map();
  let activeReadTracker = null;
  const commitHistory = [];
  let phaseFRingAppendCount = 0;
  let phaseBCellPublishCount = 0;
  const COMMIT_LOG_ID = "__causl_commit_log__";
  const commitLogNode = makeDerivedNode(COMMIT_LOG_ID);
  let commitLogConsumerCount = 0;
  let phaseDDerivedWalkCount = 0;
  let phaseDStructuralWalkCount = 0;
  let inputCount = 0;
  let derivedCount = 0;
  const nodeVersions = /* @__PURE__ */ new Map();
  const nodeVersionAccessor = (node) => nodeVersions.get(node.id) ?? 0;
  let preFireBumpedThisCommit;
  injectedBackend?.onPreFireChangedSet?.((changedNodes) => {
    const bumped = /* @__PURE__ */ new Set();
    for (const id of changedNodes) {
      nodeVersions.set(id, (nodeVersions.get(id) ?? 0) + 1);
      bumped.add(id);
    }
    preFireBumpedThisCommit = bumped;
  });
  injectedBackend?.onObserverError?.((error, ctx) => {
    reportObserverError(error, ctx);
  });
  let transientSubscriberCount = 0;
  let now = 0;
  let committing = false;
  let inBackendDispatchWindow = false;
  const stagedWriteEntries = [];
  const stagedWriteValues = [];
  let stagedActive = false;
  retainedSnapshots.push({ time: 0, delta: /* @__PURE__ */ new Map(), prev: null });
  const commitLogEntry = {
    kind: "derived",
    id: COMMIT_LOG_ID,
    compute: (() => buildCommitLogValue()),
    value: Object.freeze([]),
    computed: true,
    lastTime: 0,
    deps: /* @__PURE__ */ new Set(),
    // Engine-owned commit log: registered at genesis t₀ alongside the
    // graph itself, so its Behavior domain is [0, ∞) — no caller ever
    // hits the pre-existence branch on this id.
    derivedRegisteredAt: 0,
    // Always-set tag field per #703 Win 5 (monomorphic hidden class).
    tag: void 0
  };
  entries.set(COMMIT_LOG_ID, commitLogEntry);
  function buildCommitLogValue() {
    if (backendOwnsCommitLog()) {
      return engineCommitLogWindow();
    }
    return Object.freeze(
      commitHistory.map(
        (row) => (
          // Always-set the optional `originatedAt` field (#703 Win 5 /
          // #760) so the published Commit hidden class is monomorphic
          // across regular and hydrate-issued records. The conditional
          // spread previously produced two hidden classes the moment
          // the first hydrate landed, sending every commit-log
          // consumer's `c.originatedAt` access megamorphic.
          Object.freeze({
            time: row.time,
            intent: row.intent,
            changedNodes: freezeIfDev(row.changedNodes.slice()),
            originatedAt: row.originatedAt
          })
        )
      )
    );
  }
  function reportObserverError(error, ctx) {
    try {
      onObserverError(error, ctx);
    } catch {
      console.error("[causl] onObserverError threw while reporting:", error);
    }
  }
  function getEntry(id) {
    const e = entries.get(id);
    if (!e) {
      const disposedAt = disposed.get(id);
      if (disposedAt !== void 0) throw new NodeDisposedError(id, disposedAt);
      throw new UnknownNodeError(id);
    }
    return e;
  }
  function readEntry(node) {
    const e = getEntry(node.id);
    return readEntryFromResolved(e, node);
  }
  function readDispatchValue(node) {
    if (injectedBackend !== void 0 && mirroredDerivedIds.has(node.id) && injectedBackend.has(node.id)) {
      return injectedBackend.read(node.id);
    }
    return readEntry(node);
  }
  function readEntryFromResolved(e, node) {
    if (activeReadTracker !== null) {
      activeReadTracker.add(e.id);
    }
    if (e.kind === "input") {
      if (stagedActive && e.lastStagedAt === now) {
        return stagedWriteValues[e.lastStagedRow];
      }
      if (engineOwnsWriteCells && commitMetadataIds.size === 0 && injectedBackend.has(e.id)) {
        return injectedBackend.read(e.id);
      }
      return e.value;
    }
    if (e.id === COMMIT_LOG_ID && e.lastTime < now && commitHistoryCap > 0) {
      e.value = buildCommitLogValue();
      e.lastTime = now;
    }
    if (e.kind === "derived" && !e.computed) {
      computeDerived(e);
    }
    return e.value;
  }
  function anyInputSubscriberIn(changedInputIds) {
    if (changedInputIds.length === 0) return false;
    if (subscriptionsByNode.size === 0) return false;
    for (const id of changedInputIds) {
      if (subscriptionsByNode.has(id)) return true;
    }
    return false;
  }
  function anyProjectionDepIn(changedInputIds) {
    if (changedInputIds.length === 0) return false;
    if (subscribeReadsByNode.size === 0) return false;
    for (const id of changedInputIds) {
      if (subscribeReadsByNode.has(id)) return true;
    }
    return false;
  }
  function anyChangedInputHasSubscriber(changedInputIds) {
    if (changedInputIds.length === 0) return false;
    for (const id of changedInputIds) {
      const e = entries.get(id);
      if (e !== void 0 && e.kind === "input" && e.hasDownstreamSubscriber) {
        return true;
      }
    }
    return false;
  }
  function bumpSubscriberRefcountUp(startId, delta) {
    if (delta === 0) return;
    const stack = [startId];
    while (stack.length > 0) {
      const cur = stack.pop();
      const e = entries.get(cur);
      if (e === void 0) continue;
      const prev = subscriberRefcount.get(cur) ?? 0;
      const next = prev + delta;
      if (next === 0) {
        subscriberRefcount.delete(cur);
        if (e.kind === "input" && e.hasDownstreamSubscriber) {
          e.hasDownstreamSubscriber = false;
        }
      } else {
        subscriberRefcount.set(cur, next);
        if (e.kind === "input" && !e.hasDownstreamSubscriber && next > 0) {
          e.hasDownstreamSubscriber = true;
        }
      }
      if (e.kind === "derived") {
        for (const dep of e.deps) stack.push(dep);
      }
    }
  }
  function setDeps(derivedId, nextDeps) {
    const prev = entries.get(derivedId);
    if (!prev || prev.kind !== "derived") return;
    if (nextDeps.size === prev.deps.size) {
      if (prev.deps === nextDeps) return;
      let identical = true;
      for (const id of nextDeps) {
        if (!prev.deps.has(id)) {
          identical = false;
          break;
        }
      }
      if (identical) {
        return;
      }
    }
    const derivedSubCount = subscriberRefcount.get(derivedId) ?? 0;
    for (const oldDep of prev.deps) {
      if (!nextDeps.has(oldDep)) {
        const bucket = dependents.get(oldDep);
        if (bucket !== void 0) {
          bucket.delete(derivedId);
          if (bucket.size === 0) {
            const upstream = entries.get(oldDep);
            if (upstream !== void 0 && upstream.kind === "input") {
              upstream.hasDependents = false;
            }
          }
        }
        if (derivedSubCount > 0) {
          bumpSubscriberRefcountUp(oldDep, -derivedSubCount);
        }
      }
    }
    for (const newDep of nextDeps) {
      let set = dependents.get(newDep);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        dependents.set(newDep, set);
      }
      const sizeBefore = set.size;
      set.add(derivedId);
      if (sizeBefore === 0 && set.size === 1) {
        const upstream = entries.get(newDep);
        if (upstream !== void 0 && upstream.kind === "input") {
          upstream.hasDependents = true;
        }
      }
      if (derivedSubCount > 0 && !prev.deps.has(newDep)) {
        bumpSubscriberRefcountUp(newDep, +derivedSubCount);
      }
    }
    if (prev.tag !== "commit-metadata") {
      const hadBefore = prev.deps.has(COMMIT_LOG_ID);
      const hasAfter = nextDeps.has(COMMIT_LOG_ID);
      if (hasAfter && !hadBefore) commitLogConsumerCount++;
      else if (!hasAfter && hadBefore) commitLogConsumerCount--;
    }
    prev.deps = nextDeps;
  }
  function setDepsFromArray(derivedId, arr, len) {
    const prev = entries.get(derivedId);
    if (!prev || prev.kind !== "derived") return;
    const prevDeps = prev.deps;
    if (len === prevDeps.size) {
      let identical = true;
      for (let i = 0; i < len; i++) {
        if (!prevDeps.has(arr[i])) {
          identical = false;
          break;
        }
      }
      if (identical) return;
    }
    const next = /* @__PURE__ */ new Set();
    for (let i = 0; i < len; i++) next.add(arr[i]);
    const derivedSubCount = subscriberRefcount.get(derivedId) ?? 0;
    for (const oldDep of prevDeps) {
      if (!next.has(oldDep)) {
        const bucket = dependents.get(oldDep);
        if (bucket !== void 0) {
          bucket.delete(derivedId);
          if (bucket.size === 0) {
            const upstream = entries.get(oldDep);
            if (upstream !== void 0 && upstream.kind === "input") {
              upstream.hasDependents = false;
            }
          }
        }
        if (derivedSubCount > 0) {
          bumpSubscriberRefcountUp(oldDep, -derivedSubCount);
        }
      }
    }
    for (let i = 0; i < len; i++) {
      const newDep = arr[i];
      let set = dependents.get(newDep);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        dependents.set(newDep, set);
      }
      const sizeBefore = set.size;
      set.add(derivedId);
      if (sizeBefore === 0 && set.size === 1) {
        const upstream = entries.get(newDep);
        if (upstream !== void 0 && upstream.kind === "input") {
          upstream.hasDependents = true;
        }
      }
      if (derivedSubCount > 0 && !prevDeps.has(newDep)) {
        bumpSubscriberRefcountUp(newDep, +derivedSubCount);
      }
    }
    if (prev.tag !== "commit-metadata") {
      const hadBefore = prevDeps.has(COMMIT_LOG_ID);
      const hasAfter = next.has(COMMIT_LOG_ID);
      if (hasAfter && !hadBefore) commitLogConsumerCount++;
      else if (!hasAfter && hadBefore) commitLogConsumerCount--;
    }
    prev.deps = next;
  }
  function findCyclePathFrom(startId) {
    const startEntry = entries.get(startId);
    if (!startEntry || startEntry.kind !== "derived") return null;
    const parent = /* @__PURE__ */ new Map();
    const visited = /* @__PURE__ */ new Set();
    const stack = [];
    for (const d of startEntry.deps) {
      if (!parent.has(d) && d !== startId) {
        parent.set(d, startId);
        stack.push(d);
      } else if (d === startId) {
        return [startId, startId];
      }
    }
    while (stack.length > 0) {
      const cur = stack.pop();
      if (visited.has(cur)) continue;
      visited.add(cur);
      const e = entries.get(cur);
      if (!e || e.kind !== "derived") continue;
      for (const d of e.deps) {
        if (d === startId) {
          const path = [startId];
          const reverseChain = [cur];
          let p = parent.get(cur);
          while (p !== void 0 && p !== startId) {
            reverseChain.push(p);
            p = parent.get(p);
          }
          for (let i = reverseChain.length - 1; i >= 0; i--) {
            path.push(reverseChain[i]);
          }
          path.push(startId);
          return path;
        }
        if (!parent.has(d) && !visited.has(d)) {
          parent.set(d, cur);
          stack.push(d);
        }
      }
    }
    return null;
  }
  function recoverCyclePath(residue) {
    const residueSet = new Set(residue);
    const seed = residue[0];
    const visited = /* @__PURE__ */ new Set();
    const path = [];
    const onPath = /* @__PURE__ */ new Set();
    function dfs(cur) {
      if (onPath.has(cur)) {
        const startIdx = path.indexOf(cur);
        return path.slice(startIdx).concat([cur]);
      }
      if (visited.has(cur)) return null;
      visited.add(cur);
      onPath.add(cur);
      path.push(cur);
      const e = entries.get(cur);
      if (e && e.kind === "derived") {
        for (const d of e.deps) {
          if (!residueSet.has(d)) continue;
          const found2 = dfs(d);
          if (found2 !== null) return found2;
        }
      }
      path.pop();
      onPath.delete(cur);
      return null;
    }
    const found = dfs(seed);
    if (found !== null) return found;
    return [...residue, residue[0]];
  }
  let activeRecording = null;
  function recordingGet(n) {
    const rec = activeRecording;
    if (rec === null) {
      throw new Error(
        "[causl] recordingGet called outside a compute frame \u2014 internal invariant violated"
      );
    }
    const dep = getEntry(n.id);
    if (dep.kind === "derived") {
      if (rec.kind === "iterative") {
        if (rec.inFlight.has(n.id)) {
          const stack = rec.stackForCycle;
          const ids = [];
          for (let i = 0; i < stack.length; i++) ids.push(stack[i].entry.id);
          const cycleStart = ids.indexOf(n.id);
          const path = ids.slice(cycleStart).concat([n.id]);
          throw new CycleError(path);
        }
        if (!dep.computed) {
          throw new MissingUpstream(n.id);
        }
      } else {
        if (!dep.computed) {
          computeDerived(dep, rec.dirtyStack);
        }
      }
    }
    const id = n.id;
    const arr = rec.nextDepsArr;
    const len = rec.nextDepsLen;
    let already = false;
    for (let i = 0; i < len; i++) {
      if (arr[i] === id) {
        already = true;
        break;
      }
    }
    if (!already) {
      arr[len] = id;
      rec.nextDepsLen = len + 1;
    }
    const value = readEntryFromResolved(dep, n);
    if (rec.captured !== null) rec.captured.set(n.id, value);
    return value;
  }
  function computeDerived(e, dirtyStack = []) {
    if (dirtyStack.includes(e.id)) {
      throw new CycleError([...dirtyStack, e.id]);
    }
    const nextDepsArr = [];
    const nextStack = [...dirtyStack, e.id];
    const gate = flags.assertDeterministicCompute;
    const frame = {
      kind: "recursive",
      nextDepsArr,
      nextDepsLen: 0,
      dirtyStack: nextStack,
      captured: gate ? /* @__PURE__ */ new Map() : null
    };
    const prevRecording = activeRecording;
    activeRecording = frame;
    let next;
    try {
      next = e.compute(recordingGet);
    } catch (err) {
      throw asDerivedComputeError(e.id, err);
    } finally {
      activeRecording = prevRecording;
    }
    if (frame.captured !== null) {
      const captured = frame.captured;
      const verifyGet = (n) => {
        if (captured.has(n.id)) return captured.get(n.id);
        return recordingGet(n);
      };
      const prev2 = activeRecording;
      activeRecording = frame;
      let verify;
      try {
        verify = e.compute(verifyGet);
      } finally {
        activeRecording = prev2;
      }
      if (!Object.is(verify, next)) {
        throw new NonDeterministicComputeError(e.id, [...dirtyStack, e.id]);
      }
    }
    e.value = next;
    setDepsFromArray(e.id, nextDepsArr, frame.nextDepsLen);
    e.computed = true;
    e.lastTime = now;
  }
  class MissingUpstream {
    constructor(id) {
      this.id = id;
    }
    id;
  }
  function computeDerivedIterative(rootEntry) {
    if (rootEntry.computed) return;
    const stack = [];
    const inFlight = /* @__PURE__ */ new Set();
    const gate = flags.assertDeterministicCompute;
    const pushFrame = (entry) => {
      stack.push({ entry, nextDepsArr: [], nextDepsLen: 0 });
      inFlight.add(entry.id);
    };
    pushFrame(rootEntry);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      frame.nextDepsLen = 0;
      const captured = gate ? /* @__PURE__ */ new Map() : null;
      const recFrame = {
        kind: "iterative",
        nextDepsArr: frame.nextDepsArr,
        nextDepsLen: 0,
        inFlight,
        stackForCycle: stack,
        captured
      };
      let nextValue;
      const prevRecording = activeRecording;
      activeRecording = recFrame;
      let computeErr = void 0;
      let computeThrew = false;
      try {
        nextValue = frame.entry.compute(recordingGet);
      } catch (err) {
        computeErr = err;
        computeThrew = true;
      } finally {
        activeRecording = prevRecording;
      }
      frame.nextDepsLen = recFrame.nextDepsLen;
      if (computeThrew) {
        if (computeErr instanceof MissingUpstream) {
          const upstream = entries.get(computeErr.id);
          if (!upstream || upstream.kind !== "derived") {
            throw computeErr;
          }
          pushFrame(upstream);
          continue;
        }
        for (const f of stack) inFlight.delete(f.entry.id);
        stack.length = 0;
        throw asDerivedComputeError(frame.entry.id, computeErr);
      }
      if (captured !== null) {
        const verifyGet = (n) => {
          if (captured.has(n.id)) return captured.get(n.id);
          return recordingGet(n);
        };
        const prev2 = activeRecording;
        activeRecording = recFrame;
        let verifyErr = void 0;
        let verifyThrew = false;
        let verify;
        try {
          verify = frame.entry.compute(verifyGet);
        } catch (err) {
          verifyErr = err;
          verifyThrew = true;
        } finally {
          activeRecording = prev2;
        }
        frame.nextDepsLen = recFrame.nextDepsLen;
        if (verifyThrew) {
          if (verifyErr instanceof MissingUpstream) {
            const upstream = entries.get(verifyErr.id);
            if (!upstream || upstream.kind !== "derived") throw verifyErr;
            pushFrame(upstream);
            continue;
          }
          for (const f of stack) inFlight.delete(f.entry.id);
          stack.length = 0;
          throw verifyErr;
        }
        if (!Object.is(verify, nextValue)) {
          const errPath = [];
          for (let i = 0; i < stack.length; i++) errPath.push(stack[i].entry.id);
          for (const f of stack) inFlight.delete(f.entry.id);
          stack.length = 0;
          throw new NonDeterministicComputeError(frame.entry.id, errPath);
        }
      }
      frame.entry.value = nextValue;
      setDepsFromArray(frame.entry.id, frame.nextDepsArr, frame.nextDepsLen);
      frame.entry.computed = true;
      frame.entry.lastTime = now;
      inFlight.delete(frame.entry.id);
      stack.pop();
    }
  }
  function input(id, initial, options2) {
    if (entries.has(id)) throw new DuplicateNodeError(id);
    const node = makeInputNode(id);
    if (options2?.invariant !== void 0) {
      inputInvariants.set(id, options2.invariant);
    }
    entries.set(id, makeInputEntry(id, initial, now, node));
    inputCount++;
    if (now !== 0) inputRegisteredAtMap.set(id, now);
    if (snapshotRetentionCap > 0 && isSerializable(initial)) {
      for (const snap of retainedSnapshots) {
        if (snap.time === now) {
          snap.delta.set(id, initial);
        }
      }
    }
    if (injectedBackend !== void 0) {
      injectedBackend.registerInput(id, initial);
    }
    return node;
  }
  function derived(id, compute, options2) {
    if (entries.has(id)) throw new DuplicateNodeError(id);
    const node = makeDerivedNode(id);
    const entry = {
      kind: "derived",
      id,
      compute,
      value: void 0,
      computed: false,
      lastTime: now,
      deps: /* @__PURE__ */ new Set(),
      // Anchor the Behavior's domain at the registration moment so
      // `readAt(derived, t < derivedRegisteredAt)` surfaces the
      // discriminated `evicted` arm rather than fabricating a value
      // by recomputing against a pre-existence input snapshot (#374).
      derivedRegisteredAt: now,
      // Always-set the optional `tag` field (#703 Win 5) so the
      // DerivedEntry hidden class is monomorphic across plain
      // `derived(...)` and `commitMetadataDerived(...)` callers.
      // The conditional spread previously produced two hidden
      // classes the moment any tagged node was registered, sending
      // every entries.get(id).kind === 'derived' branch megamorphic.
      tag: options2?.tag
    };
    entries.set(id, entry);
    if (options2?.tag === "commit-metadata") {
      if (backendOwnsCommitLog() && commitHistoryCap > 0) {
        commitHistory.length = 0;
        for (const row of engineCommitLogWindow()) {
          commitHistory.push({ ...row, graphId });
        }
      }
      if (engineOwnsWriteCells) {
        for (const e of entries.values()) {
          if (e.kind !== "input") continue;
          e.value = injectedBackend.read(e.id);
          inputSerializableMemo.delete(e.id);
        }
      }
      commitMetadataIds.add(id);
      commitLogConsumerCount++;
    }
    try {
      computeDerivedIterative(entry);
    } catch (err) {
      entries.delete(id);
      commitMetadataIds.delete(id);
      if (options2?.tag === "commit-metadata") commitLogConsumerCount--;
      if (isStackOverflowRangeError(err)) {
        throw new DerivedRegistrationStackOverflowError(id);
      }
      throw err;
    }
    derivedCount++;
    if (injectedBackend !== void 0 && options2?.tag !== "commit-metadata") {
      const depIds = [...entry.deps];
      const bridgedCompute = (get) => compute(
        ((depNode) => get(depNode.id))
      );
      injectedBackend.registerDerived(id, depIds, bridgedCompute, options2?.tag);
      mirroredDerivedIds.add(id);
    }
    return node;
  }
  function isStackOverflowRangeError(err) {
    if (!(err instanceof RangeError)) return false;
    const msg = err.message;
    return typeof msg === "string" && msg.startsWith("Maximum call stack size exceeded");
  }
  function commitMetadataDerived(id, compute) {
    return derived(id, compute, { tag: "commit-metadata" });
  }
  function read(node) {
    const value = readEntry(node);
    if (!NODE_ENV_IS_PRODUCTION) {
      recordH1HazardRead(value, node.id);
    }
    return value;
  }
  function recordH1HazardRead(value, nodeId) {
    if (h1HazardTrack !== null && activeReadTracker === null && adapterReadDepth === 0 && value !== null && (typeof value === "object" || typeof value === "function")) {
      h1HazardTrack.push({
        ref: new WeakRef(value),
        nodeId,
        capturedAt: now
      });
      if (h1HazardTrack.length > H1_HAZARD_TRACK_CAP) {
        pruneH1HazardTrack();
      }
    }
  }
  const H1_HAZARD_TRACK_CAP = 4096;
  function pruneH1HazardTrack() {
    if (NODE_ENV_IS_PRODUCTION) return;
    if (h1HazardTrack === null) return;
    let write = 0;
    for (let read2 = 0; read2 < h1HazardTrack.length; read2++) {
      const rec = h1HazardTrack[read2];
      if (rec.ref.deref() !== void 0) {
        h1HazardTrack[write++] = rec;
      }
    }
    h1HazardTrack.length = write;
  }
  function checkH1HazardOnCommit() {
    if (NODE_ENV_IS_PRODUCTION) return;
    if (h1HazardTrack === null || h1HazardTrack.length === 0) return;
    let write = 0;
    for (let read2 = 0; read2 < h1HazardTrack.length; read2++) {
      const rec = h1HazardTrack[read2];
      const referent = rec.ref.deref();
      if (referent === void 0) continue;
      if (rec.capturedAt < now) {
        console.warn(
          `[causl] H1 hazard: graph.read(node '${rec.nodeId}') return value held across commit \u2014 reference identity not guaranteed (SPEC \xA715.1)`
        );
        continue;
      }
      h1HazardTrack[write++] = rec;
    }
    h1HazardTrack.length = write;
  }
  function runInAdapterReadMode(fn) {
    if (NODE_ENV_IS_PRODUCTION) {
      return fn();
    }
    adapterReadDepth++;
    try {
      return fn();
    } finally {
      adapterReadDepth--;
    }
  }
  function recordDerivedRollback(h, id, makeRec) {
    const m = h.map;
    if (m !== void 0) {
      if (!m.has(id)) m.set(id, makeRec());
      return;
    }
    if (h.singleId === void 0) {
      h.singleId = id;
      h.single = makeRec();
      return;
    }
    if (h.singleId === id) {
      return;
    }
    const promoted = /* @__PURE__ */ new Map();
    promoted.set(h.singleId, h.single);
    promoted.set(id, makeRec());
    h.map = promoted;
    h.singleId = void 0;
    h.single = void 0;
  }
  function derivedRollbackIsEmpty(h) {
    return h.map === void 0 && h.singleId === void 0;
  }
  function forEachDerivedRollback(h, fn) {
    if (h.singleId !== void 0) fn(h.singleId, h.single);
    const m = h.map;
    if (m !== void 0) {
      for (const [id, prior] of m) fn(id, prior);
    }
  }
  function recomputeAffected(seedChanged, rollback, runMirrored = false, backendOwnsCycleCheck = false) {
    if (!runMirrored && backendOwnsCycleCheck && injectedBackend !== void 0 && commitMetadataIds.size === 0) {
      return [];
    }
    const indegree = /* @__PURE__ */ new Map();
    const queue = [];
    for (const id of seedChanged) {
      const downstream = dependents.get(id);
      if (!downstream) continue;
      for (const d of downstream) {
        if (!indegree.has(d)) {
          indegree.set(d, 0);
          queue.push(d);
        }
      }
    }
    let qHead = 0;
    while (qHead < queue.length) {
      const id = queue[qHead++];
      const downstream = dependents.get(id);
      if (!downstream) continue;
      for (const d of downstream) {
        const cur = indegree.get(d);
        if (cur !== void 0) {
          indegree.set(d, cur + 1);
        } else {
          indegree.set(d, 1);
          queue.push(d);
        }
      }
    }
    const ready = [];
    for (const [id, d] of indegree.entries()) {
      if (d === 0) ready.push(id);
    }
    const ordered = [];
    let rHead = 0;
    while (rHead < ready.length) {
      const id = ready[rHead++];
      ordered.push(id);
      phaseDStructuralWalkCount++;
      const downstream = dependents.get(id);
      if (!downstream) continue;
      for (const d of downstream) {
        const cur = indegree.get(d);
        if (cur === void 0) continue;
        const next = cur - 1;
        indegree.set(d, next);
        if (next === 0) ready.push(d);
      }
    }
    if (ordered.length < indegree.size) {
      const orderedSet = new Set(ordered);
      const residue = [];
      for (const id of indegree.keys()) {
        if (!orderedSet.has(id)) residue.push(id);
      }
      throw new CycleError(recoverCyclePath(residue));
    }
    if (!runMirrored && injectedBackend !== void 0 && commitMetadataIds.size === 0) {
      return [];
    }
    const processedThisPass = /* @__PURE__ */ new Set();
    const changedThisCommit = [];
    const cutoffStable = /* @__PURE__ */ new Set();
    for (const id of ordered) {
      const e = entries.get(id);
      if (!e || e.kind !== "derived") continue;
      phaseDDerivedWalkCount++;
      if (!runMirrored && mirroredDerivedIds.has(id)) {
        cutoffStable.add(id);
        continue;
      }
      if (e.computed) {
        let allStable = true;
        for (const dp of e.deps) {
          if (seedChanged.has(dp)) {
            allStable = false;
            break;
          }
          if (indegree.has(dp) && !cutoffStable.has(dp)) {
            allStable = false;
            break;
          }
        }
        if (allStable) {
          cutoffStable.add(id);
          continue;
        }
      }
      const before = e.value;
      const wasComputed = e.computed;
      const prevDeps = e.deps;
      if (rollback !== void 0) {
        recordDerivedRollback(rollback, id, () => ({
          value: e.value,
          deps: e.deps,
          computed: e.computed,
          lastTime: e.lastTime
        }));
      }
      computeDerived(e);
      processedThisPass.add(id);
      let hasNewDep = false;
      for (const d of e.deps) {
        if (!prevDeps.has(d)) {
          hasNewDep = true;
          break;
        }
      }
      if (hasNewDep) {
        const cyclePath = findCyclePathFrom(e.id);
        if (cyclePath !== null) {
          throw new CycleError(cyclePath);
        }
      }
      if (!wasComputed || derivedValueChanged(before, e.value)) {
        changedThisCommit.push(id);
      } else {
        cutoffStable.add(id);
      }
    }
    return changedThisCommit;
  }
  function recomputeCommitMetadata(rollback) {
    if (commitMetadataIds.size === 0) return [];
    const changedThisPhase = [];
    for (const id of commitMetadataIds) {
      const e = entries.get(id);
      if (!e || e.kind !== "derived") continue;
      const before = e.value;
      const wasComputed = e.computed;
      recordDerivedRollback(rollback, id, () => ({
        value: e.value,
        // #703 Win 3 — capture by reference; `setDeps` swaps the
        // reference rather than mutating in place, so the prior
        // set stays a valid pre-recompute snapshot for the
        // commit() catch-arm rollback. Same invariant as Phase D's
        // capture site above; same property-test gate
        // (`test/properties/setDeps-immutability.test.ts`).
        deps: e.deps,
        computed: e.computed,
        lastTime: e.lastTime
      }));
      computeDerived(e);
      if (!wasComputed || derivedValueChanged(before, e.value)) {
        changedThisPhase.push(id);
      }
    }
    return changedThisPhase;
  }
  function commit(intent, run) {
    return commitInternal(intent, run);
  }
  function phaseD_recomputeAffected(changed, derivedRollback) {
    return recomputeAffected(changed, derivedRollback, false, true);
  }
  function phaseF4_refreshCommitLog(currentNow, changed) {
    commitLogEntry.value = buildCommitLogValue();
    commitLogEntry.lastTime = currentNow;
    changed.add(COMMIT_LOG_ID);
  }
  function phaseF6_retainInputSnapshot(currentNow, changedInputIds) {
    const delta = /* @__PURE__ */ new Map();
    if (!backendOwnsRetention) {
      for (const id of changedInputIds) {
        const e = entries.get(id);
        if (e === void 0 || e.kind !== "input") continue;
        if (engineOwnsWriteCells) {
          const v = committedInputValue(e);
          if (isSerializable(v)) delta.set(id, v);
        } else if (isInputValueSerializable(e, inputSerializableMemo)) {
          delta.set(id, e.value);
        }
      }
    }
    const head = retainedSnapshots.length > 0 ? retainedSnapshots[retainedSnapshots.length - 1] : null;
    retainedSnapshots.push({ time: currentNow, delta, prev: head });
    while (retainedSnapshots.length > snapshotRetentionCap) {
      const evicted = retainedSnapshots.shift();
      const newRoot = retainedSnapshots[0];
      if (!newRoot) break;
      let cur = evicted;
      while (cur !== null) {
        for (const [id, v] of cur.delta) {
          if (!newRoot.delta.has(id)) {
            newRoot.delta.set(id, v);
          }
        }
        cur = cur.prev;
      }
      newRoot.prev = null;
    }
  }
  function phaseG_dispatchPerNodeSubscribers(changed, c, currentNow) {
    let firedManyGroups;
    for (const changedId of changed) {
      const bucket = subscriptionsByNode.get(changedId);
      if (bucket === void 0) continue;
      for (const sub of bucket) {
        if (sub.manyGroup !== null) {
          if (sub.manyGroup.disposed) continue;
          if (firedManyGroups !== void 0 && firedManyGroups.has(sub.manyGroup)) continue;
        }
        const v = readDispatchValue(sub.node);
        if (!sub.hasFired || !Object.is(sub.lastValue, v)) {
          sub.lastValue = v;
          sub.hasFired = true;
          if (sub.manyGroup !== null) {
            if (firedManyGroups === void 0) firedManyGroups = /* @__PURE__ */ new Set();
            firedManyGroups.add(sub.manyGroup);
          }
          try {
            sub.observer(v, currentNow);
          } catch (err) {
            reportObserverError(err, {
              source: "node-subscriber",
              nodeId: sub.node.id,
              time: currentNow
            });
          }
          if (sub.transient) {
            if (sub.manyGroup !== null) {
              for (const peer of sub.manyGroup.entries) {
                pendingTransientDrops.add(peer);
              }
            } else {
              pendingTransientDrops.add(sub);
            }
          }
        }
      }
    }
    if (subscribeReadsRegistrations.size > 0) {
      const fired = /* @__PURE__ */ new Set();
      for (const changedId of changed) {
        const bucket = subscribeReadsByNode.get(changedId);
        if (bucket === void 0) continue;
        for (const reg of bucket) {
          if (fired.has(reg)) continue;
          fired.add(reg);
          let result;
          try {
            result = runProjectionTracked(reg.projection);
          } catch (err) {
            reportObserverError(err, {
              source: "subscribe-reads-projection",
              time: currentNow
            });
            continue;
          }
          reconcileProjectionDeps(reg, result.deps);
          try {
            reg.observer(c, result.value);
          } catch (err) {
            reportObserverError(err, {
              source: "subscribe-reads",
              time: currentNow
            });
          }
        }
      }
    }
  }
  function phaseH_dispatchCommitObservers(c, currentNow) {
    for (const obs of commitObservers) {
      try {
        obs(c);
      } catch (err) {
        reportObserverError(err, { source: "commit-subscriber", time: currentNow });
      }
    }
  }
  function commitInternal(intent, run, originatedAt, acceptAuthoritative) {
    if (committing) throw new CommitInProgressError();
    committing = true;
    const gatedWrites = engineOwnsWriteCells && commitMetadataIds.size === 0;
    stagedWriteEntries.length = 0;
    stagedWriteValues.length = 0;
    stagedActive = true;
    const inputRollbackEntries = [];
    const inputRollbackPriorValues = [];
    const inputRollbackPriorLastWrite = [];
    let fastInputRollbackActive = false;
    let fastInputRollbackEntry;
    let fastInputRollbackPriorValue;
    let fastInputRollbackPriorLastWrite = 0;
    const beforeNow = now;
    let txAlive = true;
    const tx = {
      set(node, value) {
        if (!txAlive) throw new StaleTxError();
        if (value === void 0) value = null;
        const id = node.id;
        const e = getEntry(id);
        if (e.kind !== "input") throw new NotAnInputNodeError(id);
        if (!gatedWrites && !e.hasDependents) {
          if (Object.is(e.value, value)) return;
          if (e.lastWriteTime > now) {
            e.value = value;
            return;
          }
          phaseBCellPublishCount++;
          inputRollbackEntries.push(e);
          inputRollbackPriorValues.push(e.value);
          inputRollbackPriorLastWrite.push(e.lastWriteTime);
          e.value = value;
          e.lastWriteTime = now + 1;
          return;
        }
        if (e.lastStagedAt === now) {
          const idx = e.lastStagedRow;
          if (Object.is(stagedWriteValues[idx], value)) return;
          stagedWriteValues[idx] = value;
          return;
        }
        if (Object.is(gatedWrites ? committedInputValue(e) : e.value, value))
          return;
        e.lastStagedAt = now;
        e.lastStagedRow = stagedWriteEntries.length;
        stagedWriteEntries.push(e);
        stagedWriteValues.push(value);
      }
    };
    const changedInputIds = [];
    const derivedRollback = {
      map: void 0,
      singleId: void 0,
      single: void 0
    };
    let commitHistorySnapshot = null;
    const commitLogValueBeforeF4 = commitLogEntry.value;
    const commitLogLastTimeBeforeF4 = commitLogEntry.lastTime;
    try {
      run(tx);
      txAlive = false;
      const fastPathLen = inputRollbackEntries.length;
      if (fastPathLen > 0) {
        let writeIdx = 0;
        for (let i = 0; i < fastPathLen; i++) {
          const e = inputRollbackEntries[i];
          const priorValue = inputRollbackPriorValues[i];
          const priorLastWrite = inputRollbackPriorLastWrite[i];
          if (Object.is(e.value, priorValue)) {
            e.lastWriteTime = priorLastWrite;
            continue;
          }
          if (writeIdx !== i) {
            inputRollbackEntries[writeIdx] = e;
            inputRollbackPriorValues[writeIdx] = priorValue;
            inputRollbackPriorLastWrite[writeIdx] = priorLastWrite;
          }
          writeIdx++;
          if (inputValueChanged(priorValue, e.value)) changedInputIds.push(e.id);
          inputSerializableMemo.delete(e.id);
        }
        if (writeIdx !== fastPathLen) {
          inputRollbackEntries.length = writeIdx;
          inputRollbackPriorValues.length = writeIdx;
          inputRollbackPriorLastWrite.length = writeIdx;
        }
      }
      if (inputInvariants.size > 0) {
        if (gatedWrites) {
          for (let pass = 0; pass < 2; pass++) {
            const wantFast = pass === 0;
            for (let i = 0, n = stagedWriteEntries.length; i < n; i++) {
              const e = stagedWriteEntries[i];
              if (e.hasDependents === wantFast) continue;
              const inv = inputInvariants.get(e.id);
              if (inv === void 0) continue;
              const v = stagedWriteValues[i];
              if (wantFast && Object.is(committedInputValue(e), v)) continue;
              try {
                inv(v);
              } catch (cause) {
                if (cause instanceof CauslError) throw cause;
                throw new InvariantViolationError(e.id, v, cause);
              }
            }
          }
        } else {
          for (let i = 0, n = inputRollbackEntries.length; i < n; i++) {
            const e = inputRollbackEntries[i];
            const inv = inputInvariants.get(e.id);
            if (inv === void 0) continue;
            try {
              inv(e.value);
            } catch (cause) {
              if (cause instanceof CauslError) throw cause;
              throw new InvariantViolationError(e.id, e.value, cause);
            }
          }
          for (let i = 0, n = stagedWriteEntries.length; i < n; i++) {
            const e = stagedWriteEntries[i];
            const inv = inputInvariants.get(e.id);
            if (inv === void 0) continue;
            const v = stagedWriteValues[i];
            try {
              inv(v);
            } catch (cause) {
              if (cause instanceof CauslError) throw cause;
              throw new InvariantViolationError(e.id, v, cause);
            }
          }
        }
      }
      const stagedLen = stagedWriteEntries.length;
      let rollbackLen = inputRollbackEntries.length;
      if (gatedWrites) {
        for (let pass = 0; pass < 2; pass++) {
          const wantFast = pass === 0;
          for (let i = 0; i < stagedLen; i++) {
            const e = stagedWriteEntries[i];
            if (e.hasDependents === wantFast) continue;
            const v = stagedWriteValues[i];
            const baseline = committedInputValue(e);
            if (Object.is(baseline, v)) continue;
            const fires = inputValueChanged(baseline, v);
            inputRollbackEntries.push(e);
            inputRollbackPriorValues.push(e.value);
            inputRollbackPriorLastWrite.push(e.lastWriteTime);
            rollbackLen++;
            e.value = null;
            inputSerializableMemo.delete(e.id);
            if (fires) changedInputIds.push(e.id);
          }
        }
      } else if (stagedLen === 1 && rollbackLen === 0) {
        const e = stagedWriteEntries[0];
        const v = stagedWriteValues[0];
        if (!Object.is(e.value, v)) {
          phaseBCellPublishCount++;
          const fires = inputValueChanged(e.value, v);
          fastInputRollbackActive = true;
          fastInputRollbackEntry = e;
          fastInputRollbackPriorValue = e.value;
          fastInputRollbackPriorLastWrite = e.lastWriteTime;
          e.value = v;
          inputSerializableMemo.delete(e.id);
          if (fires) changedInputIds.push(e.id);
        }
      } else if (stagedLen > 0) {
        const cap = rollbackLen + stagedLen;
        inputRollbackEntries.length = cap;
        inputRollbackPriorValues.length = cap;
        inputRollbackPriorLastWrite.length = cap;
        for (let i = 0; i < stagedLen; i++) {
          const e = stagedWriteEntries[i];
          const v = stagedWriteValues[i];
          if (!Object.is(e.value, v)) {
            phaseBCellPublishCount++;
            const fires = inputValueChanged(e.value, v);
            inputRollbackEntries[rollbackLen] = e;
            inputRollbackPriorValues[rollbackLen] = e.value;
            inputRollbackPriorLastWrite[rollbackLen] = e.lastWriteTime;
            rollbackLen++;
            e.value = v;
            inputSerializableMemo.delete(e.id);
            if (fires) changedInputIds.push(e.id);
          }
        }
        if (rollbackLen !== cap) {
          inputRollbackEntries.length = rollbackLen;
          inputRollbackPriorValues.length = rollbackLen;
          inputRollbackPriorLastWrite.length = rollbackLen;
        }
      }
      now += 1;
      if (fastInputRollbackActive) {
        fastInputRollbackEntry.lastWriteTime = now;
      }
      for (let i = 0, n = inputRollbackEntries.length; i < n; i++) {
        inputRollbackEntries[i].lastWriteTime = now;
      }
      const changed = new Set(changedInputIds);
      let downstreamChanged = [];
      if (changedInputIds.length > 0) {
        downstreamChanged = phaseD_recomputeAffected(changed, derivedRollback);
        for (const id of downstreamChanged) changed.add(id);
      }
      if (acceptAuthoritative !== void 0) inBackendDispatchWindow = true;
      const authoritativeChangedNodes = acceptAuthoritative?.() ?? void 0;
      if (changedInputIds.length === 0 && downstreamChanged.length === 0 && commitObservers.size === 0 && commitMetadataIds.size === 0 && commitHistoryCap === 0 && !anyInputSubscriberIn(changedInputIds) && !anyProjectionDepIn(changedInputIds)) {
        return Object.freeze({
          time: now,
          intent,
          changedNodes: freezeIfDev([]),
          originatedAt
        });
      }
      const changedNodes = Array.from(changed);
      const frozenChangedNodes = freezeIfDev(changedNodes);
      const c = Object.freeze({
        time: now,
        intent,
        changedNodes: frozenChangedNodes,
        originatedAt
      });
      if (commitMetadataIds.size > 0) {
        commitHistorySnapshot = commitHistory.slice();
      }
      if (commitHistoryCap > 0) {
        if (!backendOwnsCommitLog()) {
          phaseFRingAppendCount++;
          commitHistory.push({
            time: c.time,
            graphId,
            intent: c.intent,
            changedNodes: authoritativeChangedNodes ?? c.changedNodes,
            originatedAt: c.originatedAt
          });
          if (commitHistory.length > commitHistoryCap) {
            commitHistory.splice(0, commitHistory.length - commitHistoryCap);
          }
        }
      }
      if (commitHistoryCap > 0 && commitLogConsumerCount > 0) {
        phaseF4_refreshCommitLog(now, changed);
      }
      if (commitMetadataIds.size > 0) {
        const metadataChanged = recomputeCommitMetadata(derivedRollback);
        for (const id of metadataChanged) changed.add(id);
      }
      for (const id of changed) {
        if (preFireBumpedThisCommit?.has(id) === true) continue;
        nodeVersions.set(id, (nodeVersions.get(id) ?? 0) + 1);
      }
      if (commitHistoryCap > 0) {
        phaseF6_retainInputSnapshot(now, changedInputIds);
      }
      if (changed.size > 0 && (anyChangedInputHasSubscriber(changedInputIds) || changed.has(COMMIT_LOG_ID) && (subscriberRefcount.get(COMMIT_LOG_ID) ?? 0) > 0 || subscribeReadsRegistrations.size > 0)) {
        let changedForDispatch = changed;
        if (preFireBumpedThisCommit !== void 0) {
          let extended;
          for (const id of preFireBumpedThisCommit) {
            if (!changed.has(id)) {
              if (extended === void 0) extended = new Set(changed);
              extended.add(id);
            }
          }
          if (extended !== void 0) changedForDispatch = extended;
        }
        phaseG_dispatchPerNodeSubscribers(changedForDispatch, c, now);
      }
      if (commitObservers.size > 0) {
        phaseH_dispatchCommitObservers(c, now);
      }
      if (!NODE_ENV_IS_PRODUCTION) {
        if (h1HazardTrack !== null) checkH1HazardOnCommit();
      }
      return c;
    } catch (err) {
      if (fastInputRollbackActive) {
        const e = fastInputRollbackEntry;
        e.value = fastInputRollbackPriorValue;
        inputSerializableMemo.delete(e.id);
        e.lastWriteTime = fastInputRollbackPriorLastWrite;
      }
      for (let i = 0, n = inputRollbackEntries.length; i < n; i++) {
        const e = inputRollbackEntries[i];
        e.value = inputRollbackPriorValues[i];
        inputSerializableMemo.delete(e.id);
        e.lastWriteTime = inputRollbackPriorLastWrite[i];
      }
      for (let i = 0, n = stagedWriteEntries.length; i < n; i++) {
        stagedWriteEntries[i].lastStagedAt = -1;
      }
      if (!derivedRollbackIsEmpty(derivedRollback)) {
        forEachDerivedRollback(derivedRollback, (id, prior) => {
          const e = entries.get(id);
          if (e && e.kind === "derived") {
            e.value = prior.value;
            setDeps(id, prior.deps);
            e.computed = prior.computed;
            e.lastTime = prior.lastTime;
          }
        });
      }
      if (commitHistorySnapshot !== null) {
        commitHistory.length = 0;
        for (const row of commitHistorySnapshot) commitHistory.push(row);
        commitLogEntry.value = commitLogValueBeforeF4;
        commitLogEntry.lastTime = commitLogLastTimeBeforeF4;
      }
      now = beforeNow;
      throw err;
    } finally {
      if (pendingTransientDrops.size > 0) {
        for (const sub of pendingTransientDrops) {
          if (sub.manyGroup !== null) {
            disposeManyGroup(sub.manyGroup);
            continue;
          }
          const wasPresent = subscriptions.delete(sub);
          const b = subscriptionsByNode.get(sub.node.id);
          if (b !== void 0) {
            b.delete(sub);
            if (b.size === 0) subscriptionsByNode.delete(sub.node.id);
          }
          if (wasPresent) bumpSubscriberRefcountUp(sub.node.id, -1);
          if (wasPresent && sub.node.id === COMMIT_LOG_ID) {
            commitLogConsumerCount--;
          }
          if (wasPresent) transientSubscriberCount--;
        }
        pendingTransientDrops.clear();
      }
      txAlive = false;
      committing = false;
      inBackendDispatchWindow = false;
      stagedActive = false;
      stagedWriteEntries.length = 0;
      stagedWriteValues.length = 0;
    }
  }
  function simulate(intent, run) {
    if (committing) throw new CommitInProgressError();
    committing = true;
    stagedWriteEntries.length = 0;
    stagedWriteValues.length = 0;
    stagedActive = true;
    const inputRollbackEntries = [];
    const inputRollbackPriorValues = [];
    const inputRollbackPriorLastWrite = [];
    const beforeNow = now;
    let txAlive = true;
    const tx = {
      set(node, value) {
        if (!txAlive) throw new StaleTxError();
        if (value === void 0) value = null;
        const id = node.id;
        const e = getEntry(id);
        if (e.kind !== "input") throw new NotAnInputNodeError(id);
        if (!e.hasDependents) {
          if (Object.is(e.value, value)) return;
          if (e.lastWriteTime > now) {
            e.value = value;
            return;
          }
          inputRollbackEntries.push(e);
          inputRollbackPriorValues.push(e.value);
          inputRollbackPriorLastWrite.push(e.lastWriteTime);
          e.value = value;
          e.lastWriteTime = now + 1;
          return;
        }
        if (e.lastStagedAt === now) {
          const idx = e.lastStagedRow;
          if (Object.is(stagedWriteValues[idx], value)) return;
          stagedWriteValues[idx] = value;
          return;
        }
        if (Object.is(e.value, value)) return;
        e.lastStagedAt = now;
        e.lastStagedRow = stagedWriteEntries.length;
        stagedWriteEntries.push(e);
        stagedWriteValues.push(value);
      }
    };
    const changedInputIds = [];
    const derivedRollback = {
      map: void 0,
      singleId: void 0,
      single: void 0
    };
    let prediction = null;
    let predictedError = null;
    try {
      run(tx);
      txAlive = false;
      const fastPathLen = inputRollbackEntries.length;
      if (fastPathLen > 0) {
        let writeIdx = 0;
        for (let i = 0; i < fastPathLen; i++) {
          const e = inputRollbackEntries[i];
          const priorValue = inputRollbackPriorValues[i];
          const priorLastWrite = inputRollbackPriorLastWrite[i];
          if (Object.is(e.value, priorValue)) {
            e.lastWriteTime = priorLastWrite;
            continue;
          }
          if (writeIdx !== i) {
            inputRollbackEntries[writeIdx] = e;
            inputRollbackPriorValues[writeIdx] = priorValue;
            inputRollbackPriorLastWrite[writeIdx] = priorLastWrite;
          }
          writeIdx++;
          if (inputValueChanged(priorValue, e.value)) changedInputIds.push(e.id);
          inputSerializableMemo.delete(e.id);
        }
        if (writeIdx !== fastPathLen) {
          inputRollbackEntries.length = writeIdx;
          inputRollbackPriorValues.length = writeIdx;
          inputRollbackPriorLastWrite.length = writeIdx;
        }
      }
      for (let i = 0, n = stagedWriteEntries.length; i < n; i++) {
        const e = stagedWriteEntries[i];
        const v = stagedWriteValues[i];
        if (!Object.is(e.value, v)) {
          const fires = inputValueChanged(e.value, v);
          inputRollbackEntries.push(e);
          inputRollbackPriorValues.push(e.value);
          inputRollbackPriorLastWrite.push(e.lastWriteTime);
          e.value = v;
          inputSerializableMemo.delete(e.id);
          if (fires) changedInputIds.push(e.id);
        }
      }
      now += 1;
      for (let i = 0, n = inputRollbackEntries.length; i < n; i++) {
        inputRollbackEntries[i].lastWriteTime = now;
      }
      const changed = new Set(changedInputIds);
      const derivedDiff = [];
      if (changedInputIds.length > 0) {
        if (injectedBackend !== void 0 && mirroredDerivedIds.size > 0) {
          for (const id of mirroredDerivedIds) {
            const e = entries.get(id);
            if (!e || e.kind !== "derived") continue;
            recordDerivedRollback(derivedRollback, id, () => ({
              value: e.value,
              deps: e.deps,
              computed: e.computed,
              lastTime: e.lastTime
            }));
            e.value = injectedBackend.read(id);
            e.computed = true;
          }
        }
        const downstreamChanged = recomputeAffected(
          changed,
          derivedRollback,
          true
        );
        for (const id of downstreamChanged) {
          changed.add(id);
          derivedDiff.push(id);
        }
      }
      const changedNodes = Array.from(changed);
      const c = Object.freeze({
        time: now,
        intent,
        changedNodes: freezeIfDev(changedNodes.slice()),
        originatedAt: void 0
      });
      prediction = { c, derivedDiff };
    } catch (err) {
      predictedError = err;
    } finally {
      for (let i = 0, n = inputRollbackEntries.length; i < n; i++) {
        const e = inputRollbackEntries[i];
        e.value = inputRollbackPriorValues[i];
        inputSerializableMemo.delete(e.id);
        e.lastWriteTime = inputRollbackPriorLastWrite[i];
      }
      if (!derivedRollbackIsEmpty(derivedRollback)) {
        forEachDerivedRollback(derivedRollback, (id, prior) => {
          const e = entries.get(id);
          if (e && e.kind === "derived") {
            e.value = prior.value;
            setDeps(id, prior.deps);
            e.computed = prior.computed;
            e.lastTime = prior.lastTime;
          }
        });
      }
      now = beforeNow;
      txAlive = false;
      committing = false;
      for (let i = 0, n = stagedWriteEntries.length; i < n; i++) {
        stagedWriteEntries[i].lastStagedAt = -1;
      }
      stagedActive = false;
      stagedWriteEntries.length = 0;
      stagedWriteValues.length = 0;
    }
    if (prediction !== null) {
      return {
        status: "clean",
        commit: prediction.c,
        stagedDiff: Object.freeze(changedInputIds.slice()),
        derivedDiff: Object.freeze(prediction.derivedDiff.slice())
      };
    }
    return {
      status: "failed",
      error: predictedError,
      stagedDiff: Object.freeze(changedInputIds.slice())
    };
  }
  const engineSimulateReroute = injectedBackend?.buildSimulateReroute?.({
    isCommitting: () => committing,
    setCommitting: (value) => {
      committing = value;
    },
    resolveInputEntry: (id) => {
      const e = getEntry(id);
      if (e.kind !== "input") throw new NotAnInputNodeError(id);
      return e;
    },
    isDerived: (id) => entries.get(id)?.kind === "derived",
    inputValueChanged,
    flushSeed,
    freezeIfDev
  });
  function backendOwnsSimulate() {
    return engineSimulateReroute !== void 0 && commitMetadataIds.size === 0;
  }
  const engineOwnsWriteCells = engineSimulateReroute !== void 0 && injectedBackend?.ownsWriteCells?.() === true;
  function committedInputValue(e) {
    return engineOwnsWriteCells ? injectedBackend.read(e.id) : e.value;
  }
  function subscribe(node, observer, options2) {
    getEntry(node.id);
    const initialValue = readEntry(node);
    const sub = {
      node,
      observer,
      lastValue: initialValue,
      hasFired: false,
      // PR-B1 stamps registration time as the current GraphTime;
      // the value flows through to `IRSubscribe.time` on export.
      subscribedAt: now,
      // #766 — `transient: true` registers the observer as a one-shot
      // that auto-disposes after the first Phase G fire. Default is
      // `false`, preserving the canonical `subscribe` retain-across-
      // commits contract for every existing call site.
      transient: options2?.transient === true,
      // Plain `subscribe` is not part of a multi-node group; the
      // per-commit dedupe path in Phase G never visits this entry's
      // `manyGroup` slot when it's `null`.
      manyGroup: null
    };
    subscriptions.add(sub);
    let bucket = subscriptionsByNode.get(node.id);
    if (bucket === void 0) {
      bucket = /* @__PURE__ */ new Set();
      subscriptionsByNode.set(node.id, bucket);
    }
    bucket.add(sub);
    bumpSubscriberRefcountUp(node.id, 1);
    if (node.id === COMMIT_LOG_ID) commitLogConsumerCount++;
    if (sub.transient) transientSubscriberCount++;
    try {
      observer(initialValue, now);
      sub.hasFired = true;
    } catch (err) {
      reportObserverError(err, {
        source: "subscribe-initial",
        nodeId: node.id,
        time: now
      });
    }
    return () => {
      const wasPresent = subscriptions.delete(sub);
      const b = subscriptionsByNode.get(node.id);
      if (b !== void 0) {
        b.delete(sub);
        if (b.size === 0) subscriptionsByNode.delete(node.id);
      }
      if (wasPresent) bumpSubscriberRefcountUp(node.id, -1);
      if (wasPresent && node.id === COMMIT_LOG_ID) commitLogConsumerCount--;
      if (wasPresent && sub.transient) transientSubscriberCount--;
    };
  }
  function disposeManyGroup(group) {
    if (group.disposed) return;
    group.disposed = true;
    for (const entry of group.entries) {
      const wasPresent = subscriptions.delete(entry);
      const b = subscriptionsByNode.get(entry.node.id);
      if (b !== void 0) {
        b.delete(entry);
        if (b.size === 0) subscriptionsByNode.delete(entry.node.id);
      }
      if (wasPresent) bumpSubscriberRefcountUp(entry.node.id, -1);
      if (entry.node.id === COMMIT_LOG_ID) commitLogConsumerCount--;
      if (wasPresent && entry.transient) transientSubscriberCount--;
    }
    group.entries.clear();
  }
  function subscribeMany(nodes, observer, options2) {
    for (const node of nodes) {
      getEntry(node.id);
    }
    const transient = options2?.transient === true;
    const observerErased = observer;
    const group = {
      entries: /* @__PURE__ */ new Set(),
      nodes: nodes.slice(),
      observer: observerErased,
      transient,
      disposed: false
    };
    const fireGroupOnce = (_value, _time) => {
      if (group.disposed) return;
      const values = new Array(group.nodes.length);
      for (let i = 0; i < group.nodes.length; i++) {
        values[i] = readDispatchValue(group.nodes[i]);
      }
      observerErased(values);
    };
    for (const node of nodes) {
      const initialValue = readDispatchValue(node);
      const sub = {
        node,
        observer: fireGroupOnce,
        lastValue: initialValue,
        hasFired: false,
        subscribedAt: now,
        transient,
        manyGroup: group
      };
      subscriptions.add(sub);
      let bucket = subscriptionsByNode.get(node.id);
      if (bucket === void 0) {
        bucket = /* @__PURE__ */ new Set();
        subscriptionsByNode.set(node.id, bucket);
      }
      bucket.add(sub);
      bumpSubscriberRefcountUp(node.id, 1);
      if (node.id === COMMIT_LOG_ID) commitLogConsumerCount++;
      if (transient) transientSubscriberCount++;
      group.entries.add(sub);
    }
    try {
      const initialValues = [];
      for (const entry of group.entries) {
        initialValues.push(entry.lastValue);
      }
      observerErased(initialValues);
      for (const entry of group.entries) entry.hasFired = true;
    } catch (err) {
      const firstId = nodes[0]?.id;
      reportObserverError(
        err,
        firstId !== void 0 ? { source: "subscribe-initial", nodeId: firstId, time: now } : { source: "subscribe-initial", time: now }
      );
    }
    return () => {
      disposeManyGroup(group);
    };
  }
  function subscribeCommits(observer) {
    commitObservers.add(observer);
    return () => {
      commitObservers.delete(observer);
    };
  }
  function runProjectionTracked(projection) {
    const prior = activeReadTracker;
    const deps = /* @__PURE__ */ new Set();
    activeReadTracker = deps;
    try {
      const value = projection();
      return { value, deps };
    } finally {
      activeReadTracker = prior;
    }
  }
  function reconcileProjectionDeps(reg, nextDeps) {
    for (const oldDep of reg.recordedDeps) {
      if (!nextDeps.has(oldDep)) {
        const b = subscribeReadsByNode.get(oldDep);
        if (b !== void 0) {
          b.delete(reg);
          if (b.size === 0) subscribeReadsByNode.delete(oldDep);
        }
      }
    }
    for (const newDep of nextDeps) {
      let b = subscribeReadsByNode.get(newDep);
      if (b === void 0) {
        b = /* @__PURE__ */ new Set();
        subscribeReadsByNode.set(newDep, b);
      }
      b.add(reg);
    }
    reg.recordedDeps = nextDeps;
  }
  function subscribeReads(observer, projection) {
    const { value: initialValue, deps: initialDeps } = runProjectionTracked(projection);
    const reg = {
      observer,
      projection,
      // Filled in by `reconcileProjectionDeps` immediately below.
      recordedDeps: /* @__PURE__ */ new Set()
    };
    subscribeReadsRegistrations.add(reg);
    reconcileProjectionDeps(reg, initialDeps);
    try {
      const initialCommit = Object.freeze({
        time: now,
        intent: "subscribe-reads-initial",
        changedNodes: freezeIfDev([]),
        originatedAt: void 0
      });
      observer(initialCommit, initialValue);
    } catch (err) {
      reportObserverError(err, {
        source: "subscribe-reads-initial",
        time: now
      });
    }
    return () => {
      if (!subscribeReadsRegistrations.has(reg)) return;
      subscribeReadsRegistrations.delete(reg);
      for (const dep of reg.recordedDeps) {
        const b = subscribeReadsByNode.get(dep);
        if (b !== void 0) {
          b.delete(reg);
          if (b.size === 0) subscribeReadsByNode.delete(dep);
        }
      }
      reg.recordedDeps = /* @__PURE__ */ new Set();
    };
  }
  function explain(node) {
    getEntry(node.id);
    const explainId = `__explain__:${node.id}`;
    const cached = explainHandles.get(explainId);
    if (cached) return cached;
    const handle = derived(explainId, (get) => {
      return buildExplanation(node.id, get, /* @__PURE__ */ new Set());
    });
    explainHandles.set(explainId, handle);
    return handle;
  }
  function buildExplanation(id, get, stack) {
    if (stack.has(id)) {
      return { via: "cycle", node: id, cycleBackTo: id };
    }
    const entry = entries.get(id);
    if (!entry) return { via: "cycle", node: id, cycleBackTo: id };
    const rustTopo = explainsTopologyFromRust && rustOwns(id) ? rustSsotBackend.explainNode(id) : void 0;
    if (explainsTopologyFromRust && rustOwns(id) && rustTopo === void 0) {
      return { via: "cycle", node: id, cycleBackTo: id };
    }
    const rustMeta = explainsTimestampsFromRust && rustTopo !== void 0 ? rustSsotBackend.nodeMeta(id) : void 0;
    const kind = rustTopo !== void 0 ? rustTopo.kind : entry.kind;
    if (kind === "input") {
      const value2 = get({ id });
      return Object.freeze({
        via: "input",
        node: id,
        // #83 — `computedAt` (the input `lastWriteTime`) resolves from the TS
        // `entries` mirror, NOT the Rust `node_meta` extern. `explain` reads
        // run INSIDE a dispatch frame (the `__explain__` derivation computes in
        // `__causl_compute`), where the extern serves a STALE stamp (the
        // in-dispatch state view carries the topology + kind but not the
        // in-flight write time). The `entries` map is the transactionally-
        // maintained client stamp mirror (#75/#77 rollback; stamped at Phase
        // C.5 before the Phase-G/H observer fires) the js-ssot oracle also
        // reads — byte-identical, zero wasm hops. Topology (kind + deps) + the
        // `via` tag stay Rust-authoritative (the extern serves those live).
        value: value2,
        computedAt: entry.kind === "input" ? entry.lastWriteTime : entry.lastTime,
        deps: freezeIfDev([])
      });
    }
    if (entry.kind !== "derived") {
      return { via: "cycle", node: id, cycleBackTo: id };
    }
    const derivedEntry = entry;
    const value = get({ id });
    stack.add(id);
    const deps = [];
    const depIds = rustTopo !== void 0 ? rustTopo.deps : Array.from(derivedEntry.deps).sort();
    for (const depId of depIds) {
      const childEntry = entries.get(depId);
      if (!childEntry) continue;
      const contributedAt = childEntry.kind === "input" ? childEntry.lastWriteTime : childEntry.lastTime;
      const subExplanation = buildExplanation(depId, get, stack);
      deps.push(freezeIfDev({ node: depId, contributedAt, explanation: subExplanation }));
    }
    stack.delete(id);
    const via = rustMeta !== void 0 ? rustMeta.tag === "live" ? "live" : "derived" : derivedEntry.tag === "live" ? "live" : "derived";
    return Object.freeze({
      via,
      node: id,
      value,
      computedAt: derivedEntry.lastTime,
      deps: freezeIfDev(deps)
    });
  }
  function dependenciesOf(node) {
    const entry = getEntry(node.id);
    if (entry.kind === "input") return Object.freeze([]);
    if (rustOwns(node.id)) return rustSsotBackend.dependencies(node.id);
    return Object.freeze([...entry.deps].sort());
  }
  function dependentsOf(node) {
    getEntry(node.id);
    if (rustOwns(node.id)) return rustSsotBackend.dependents(node.id);
    const set = dependents.get(node.id);
    if (!set || set.size === 0) return Object.freeze([]);
    return Object.freeze([...set].sort());
  }
  function exportModel(opts) {
    const maxCommits = opts?.maxCommits ?? 100;
    const captureCallGraph = opts?.captureCallGraph ?? true;
    const nodes = [];
    for (const e of entries.values()) {
      if (e.id === COMMIT_LOG_ID) continue;
      switch (e.kind) {
        case "input":
          nodes.push({
            kind: "input",
            id: e.id,
            graphId,
            // #703 Win 1 — route through the cached probe so a
            // repeated `exportModel` on a quiescent engine doesn't
            // re-stringify each input cell on every call.
            value: isInputValueSerializable(e, inputSerializableMemo) ? e.value : null,
            serializable: isInputValueSerializable(e, inputSerializableMemo)
          });
          break;
        case "derived":
          nodes.push({
            kind: "derived",
            id: e.id,
            graphId,
            deps: Array.from(e.deps).sort(),
            conditionalDeps: [],
            value: serialiseSafely(e.value),
            serializable: isSerializable(e.value)
          });
          break;
        default:
          assertNever(e, "exportModel: unknown entry kind");
      }
    }
    const commits = commitHistory.slice(-maxCommits);
    void captureCallGraph;
    const events = [];
    const defaultScopeId = `${graphId}:default`;
    let exportSubSeq = 0;
    for (const sub of subscriptions) {
      events.push({
        kind: "subscribe",
        graphId,
        id: `${graphId}:s.${++exportSubSeq}`,
        scopeId: defaultScopeId,
        target: sub.node.id,
        callbackSite: "<unknown>",
        time: sub.subscribedAt
      });
    }
    const scopes = [
      {
        id: `${graphId}:default`,
        kind: "infinite",
        lifetime: { origin: "graph-construct", terminator: "process-exit" }
      }
    ];
    return {
      schema: CAUSL_MODEL_SCHEMA,
      time: now,
      nodes,
      commits,
      events,
      scopes,
      bridges: []
    };
  }
  function computeSchemaHash() {
    const tokens = [];
    for (const e of entries.values()) {
      tokens.push(`${e.kind}:${e.id}`);
    }
    tokens.sort();
    let h = 2166136261;
    const str = tokens.join("|");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }
  function snapshot() {
    const inputs = {};
    for (const e of entries.values()) {
      if (e.kind !== "input") continue;
      if (engineOwnsWriteCells) {
        const v = committedInputValue(e);
        if (!isSerializable(v)) continue;
        inputs[e.id] = v;
        continue;
      }
      if (!isInputValueSerializable(e, inputSerializableMemo)) continue;
      inputs[e.id] = e.value;
    }
    return {
      schema: 1,
      time: now,
      inputs,
      schemaHash: computeSchemaHash()
    };
  }
  function snapshotAt(time) {
    if (retainedSnapshots.length === 0) {
      return { status: "evicted", oldestRetainedTime: now };
    }
    const oldest = retainedSnapshots[0].time;
    if (time < oldest) {
      return { status: "evicted", oldestRetainedTime: oldest };
    }
    let chosen;
    for (const snap of retainedSnapshots) {
      if (snap.time <= time) chosen = snap;
      else break;
    }
    if (!chosen) return { status: "evicted", oldestRetainedTime: oldest };
    const materialised = materialiseRetained(chosen);
    const inputs = {};
    for (const [id, v] of Object.entries(materialised)) {
      if (!isSerializable(v)) continue;
      inputs[id] = cloneForRetention(v);
    }
    return {
      status: "retained",
      time: chosen.time,
      value: {
        schema: 1,
        time: chosen.time,
        inputs,
        schemaHash: computeSchemaHash()
      }
    };
  }
  function hydrate(snap) {
    if (snap.schema !== 1) {
      throw new HydrationSchemaError(
        "schema-version",
        `unsupported schema version ${String(snap.schema)} (expected 1)`
      );
    }
    if (snap.schemaHash !== void 0) {
      const live = computeSchemaHash();
      if (snap.schemaHash !== live) {
        throw new HydrationSchemaError(
          "schema-hash",
          `snapshot schemaHash ${snap.schemaHash} does not match live graph ${live}`
        );
      }
    }
    const writes = [];
    for (const [id, value] of Object.entries(snap.inputs)) {
      const e = entries.get(id);
      if (!e || e.kind !== "input") continue;
      writes.push([id, value]);
    }
    let wasmCommit;
    const tsCommit = commitInternal(
      "hydrate",
      (tx) => {
        for (const [id, value] of writes) {
          tx.set({ id }, value);
        }
      },
      snap.time,
      injectedBackend === void 0 ? void 0 : () => {
        flushSeed();
        wasmCommit = injectedBackend.hydrate !== void 0 ? injectedBackend.hydrate(new Map(writes), snap.time) : injectedBackend.commit("hydrate", new Map(writes));
        return wasmCommit.changedNodes;
      }
    );
    if (injectedBackend !== void 0) {
      if (wasmCommit === void 0) {
        throw new Error(
          "[causl] injected-backend hydrate facade: the acceptance gate did not run \u2014 commitInternal returned without driving the authoritative backend. This is a wiring bug."
        );
      }
      if (wasmCommit.changedNodes.length > 0) {
        const tsCounted = new Set(tsCommit.changedNodes);
        for (const id of wasmCommit.changedNodes) {
          if (!tsCounted.has(id) && preFireBumpedThisCommit?.has(id) !== true) {
            nodeVersions.set(id, (nodeVersions.get(id) ?? 0) + 1);
          }
        }
      }
      preFireBumpedThisCommit = void 0;
    }
  }
  function _migrateFrom(snap) {
    if (snap.schema !== 1) {
      throw new HydrationSchemaError(
        "schema-version",
        `unsupported schema version ${String(snap.schema)} (expected 1)`
      );
    }
    if (snap.schemaHash !== void 0) {
      const live = computeSchemaHash();
      if (snap.schemaHash !== live) {
        throw new HydrationSchemaError(
          "schema-hash",
          `snapshot schemaHash ${snap.schemaHash} does not match live graph ${live}`
        );
      }
    }
    if (committing) throw new CommitInProgressError();
    if (now !== 0 || commitHistory.length !== 0) {
      throw new Error(
        `_migrateFrom: graph is not in a fresh migration-boundary state (now=${now}, commitHistory.length=${commitHistory.length}). _migrateFrom is only valid on a freshly-registered graph with no prior commits; use Graph.hydrate() to restore a snapshot onto a running graph.`
      );
    }
    const writes = [];
    for (const [id, value] of Object.entries(snap.inputs)) {
      const e = entries.get(id);
      if (!e || e.kind !== "input") continue;
      writes.push([id, value, e]);
    }
    now = snap.time;
    const changedInputIds = [];
    for (const [id, value, e] of writes) {
      if (Object.is(e.value, value)) continue;
      e.value = value;
      e.lastWriteTime = now;
      inputSerializableMemo.delete(id);
      changedInputIds.push(id);
    }
    if (commitHistoryCap > 0 && snapshotRetentionCap > 0) {
      const delta = /* @__PURE__ */ new Map();
      if (!backendOwnsRetention) {
        for (const id of changedInputIds) {
          const e = entries.get(id);
          if (e && e.kind === "input" && isInputValueSerializable(e, inputSerializableMemo)) {
            delta.set(id, e.value);
          }
        }
      }
      const head = retainedSnapshots.length > 0 ? retainedSnapshots[retainedSnapshots.length - 1] : null;
      retainedSnapshots.push({ time: now, delta, prev: head });
      while (retainedSnapshots.length > snapshotRetentionCap) {
        const evicted = retainedSnapshots.shift();
        const newRoot = retainedSnapshots[0];
        if (!newRoot) break;
        let cur = evicted;
        while (cur !== null) {
          for (const [id, v] of cur.delta) {
            if (!newRoot.delta.has(id)) {
              newRoot.delta.set(id, v);
            }
          }
          cur = cur.prev;
        }
        newRoot.prev = null;
      }
    }
    if (changedInputIds.length > 0) {
      const seedSet = new Set(changedInputIds);
      recomputeAffected(seedSet);
    }
  }
  function readAt(node, time) {
    const e = entries.get(node.id);
    if (e && e.kind === "input") {
      const registeredAt = inputRegisteredAtMap.get(node.id) ?? 0;
      if (time < registeredAt) {
        return { status: "evicted", oldestRetainedTime: registeredAt };
      }
    }
    if (e && e.kind === "derived" && time < e.derivedRegisteredAt) {
      return { status: "evicted", oldestRetainedTime: e.derivedRegisteredAt };
    }
    if (inBackendDispatchWindow && time === now && commitHistoryCap > 0 && e && e.kind === "derived") {
      const inFlightRow = { time: now, delta: /* @__PURE__ */ new Map(), prev: null };
      const value = recomputeFromSnapshot(e.id, inFlightRow);
      return { status: "retained", value, time: now };
    }
    if (retainedSnapshots.length === 0) {
      return { status: "evicted", oldestRetainedTime: now };
    }
    const oldest = retainedSnapshots[0].time;
    if (time < oldest) {
      return { status: "evicted", oldestRetainedTime: oldest };
    }
    let chosen;
    for (const snap of retainedSnapshots) {
      if (snap.time <= time) chosen = snap;
      else break;
    }
    if (!chosen) {
      return { status: "evicted", oldestRetainedTime: oldest };
    }
    if (e && e.kind === "input") {
      const lookup = resolveRetained(chosen, node.id);
      if (!lookup.found) {
        return { status: "evicted", oldestRetainedTime: oldest };
      }
      return {
        status: "retained",
        value: cloneForRetention(lookup.value),
        time: chosen.time
      };
    }
    if (e && e.kind === "derived") {
      if (backendOwnsRetention && injectedBackend?.readAt !== void 0) {
        let engineRow;
        try {
          engineRow = injectedBackend.readAt(e.id, time);
        } catch (err) {
          if (!(err instanceof RetainedValueUnavailableError)) throw err;
          engineRow = void 0;
        }
        if (engineRow !== void 0 && engineRow.status === "retained") {
          return {
            status: "retained",
            value: engineRow.value,
            time: chosen.time
          };
        }
        const value2 = recomputeFromEngineHistory(e.id, time);
        return { status: "retained", value: value2, time: chosen.time };
      }
      const value = recomputeFromSnapshot(e.id, chosen);
      return { status: "retained", value, time: chosen.time };
    }
    return { status: "evicted", oldestRetainedTime: oldest };
  }
  function recomputeFromSnapshot(id, snapshotRow, memo = /* @__PURE__ */ new Map(), inFlight = /* @__PURE__ */ new Set()) {
    if (memo.has(id)) return memo.get(id);
    const e = entries.get(id);
    if (!e) throw new UnknownNodeError(id);
    if (e.kind === "input") {
      const lookup = resolveRetained(snapshotRow, id);
      const v = lookup.found ? lookup.value : committedInputValue(e);
      memo.set(id, v);
      return v;
    }
    if (inFlight.has(id)) {
      throw new CycleError([...inFlight, id]);
    }
    inFlight.add(id);
    const get = (n) => recomputeFromSnapshot(n.id, snapshotRow, memo, inFlight);
    const value = e.compute(get);
    inFlight.delete(id);
    memo.set(id, value);
    return value;
  }
  function recomputeFromEngineHistory(id, time, memo = /* @__PURE__ */ new Map(), inFlight = /* @__PURE__ */ new Set()) {
    if (memo.has(id)) return memo.get(id);
    const e = entries.get(id);
    if (!e) throw new UnknownNodeError(id);
    if (e.kind === "input") {
      const row = injectedBackend.readAt(id, time);
      const v = row.status === "retained" ? row.value : committedInputValue(e);
      memo.set(id, v);
      return v;
    }
    if (inFlight.has(id)) {
      throw new CycleError([...inFlight, id]);
    }
    inFlight.add(id);
    const get = (n) => recomputeFromEngineHistory(n.id, time, memo, inFlight);
    const value = e.compute(get);
    inFlight.delete(id);
    memo.set(id, value);
    return value;
  }
  function _dispose(node) {
    const id = node.id;
    const e = entries.get(id);
    if (!e) return;
    if (committing) throw new DisposalDuringCommitError(id);
    const downstream = dependents.get(id);
    if (downstream && downstream.size > 0) {
      throw new NodeHasDependentsError(id, [...downstream]);
    }
    injectedBackend?.disposeNode?.(id);
    if (e.kind === "derived") {
      for (const dep of e.deps) {
        const bucket = dependents.get(dep);
        if (bucket !== void 0) {
          bucket.delete(id);
          if (bucket.size === 0) {
            const upstream = entries.get(dep);
            if (upstream !== void 0 && upstream.kind === "input") {
              upstream.hasDependents = false;
            }
          }
        }
      }
      if (e.tag === "commit-metadata") {
        commitLogConsumerCount--;
      } else if (e.deps.has(COMMIT_LOG_ID)) {
        commitLogConsumerCount--;
      }
    }
    dependents.delete(id);
    for (const sub of subscriptions) {
      if (sub.node.id === id) {
        subscriptions.delete(sub);
        bumpSubscriberRefcountUp(sub.node.id, -1);
        if (id === COMMIT_LOG_ID) commitLogConsumerCount--;
        if (sub.transient) transientSubscriberCount--;
      }
    }
    subscriptionsByNode.delete(id);
    const projBucket = subscribeReadsByNode.get(id);
    if (projBucket !== void 0) {
      for (const reg of projBucket) {
        reg.recordedDeps.delete(id);
      }
      subscribeReadsByNode.delete(id);
    }
    if (disposed.has(id)) {
      disposed.delete(id);
    }
    entries.delete(id);
    if (e.kind === "input") inputCount--;
    else derivedCount--;
    inputRegisteredAtMap.delete(id);
    inputSerializableMemo.delete(id);
    commitMetadataIds.delete(id);
    mirroredDerivedIds.delete(id);
    nodeVersions.delete(id);
    subscriberRefcount.delete(id);
    disposed.set(id, now);
    while (disposed.size > disposedTombstoneCap) {
      const oldest = disposed.keys().next().value;
      if (oldest === void 0) break;
      disposed.delete(oldest);
    }
  }
  function stats() {
    const rust = rustSsotBackend?.stats();
    return {
      inputs: rust ? rust.inputs : inputCount,
      deriveds: rust ? rust.deriveds + commitMetadataIds.size : derivedCount,
      subscribersTotal: rust ? rust.subscribersTotal + subscriptions.size : subscriptions.size,
      subscribersByNodeKeys: rust ? rust.subscribersByNodeKeys + subscriptionsByNode.size : subscriptionsByNode.size,
      transientSubscribers: rust ? rust.transientSubscribers + transientSubscriberCount : transientSubscriberCount,
      commitObservers: commitObservers.size,
      commitMetadataDeriveds: commitMetadataIds.size,
      commitLogConsumerCount,
      entries: entries.size,
      lastCommitTime: now,
      // #129 — under the engine-owned commitLog gate the TS ring is never
      // appended, so serve the retained count from the ENGINE horizon: the
      // cap-bounded engine log's adopter-visible row count, the same
      // `min(user commits ever, commitHistoryCap)` the floor's ring length
      // reports (the horizons are one — SetCommitLogCap threaded the cap).
      retainedCommits: (backendOwnsCommitLog() ? engineCommitLogWindow() : commitHistory).length,
      // #1242 — per-node version accessor (SPEC §15.1). Closure-captured
      // lookup against the `nodeVersions` Map maintained alongside the
      // existing `changed` set in `commitInternal`'s success arm (post
      // Phase F.5 / pre Phase G). Returns `0` for a never-changed node,
      // including nodes the engine has never seen, so adopters can
      // safely call `nodeVersion(node)` without preconditioning on
      // registration. Disposed nodes have their entry deleted in
      // `_dispose`, so a future reuse under generational NodeId (#1164)
      // starts from a fresh counter at 0. Function reference is hoisted
      // (see `nodeVersionAccessor` declaration above) so sequential
      // `stats()` snapshots share the same closure identity — the leak-
      // gate `expect(s1).toEqual(s2)` test in `stats.test.ts` compares
      // function-typed fields by reference under vitest's deep-equal,
      // and a fresh closure per call would defeat that gate.
      nodeVersion: nodeVersionAccessor
    };
  }
  const backend = new JsBackend({
    commit: (intent, writes) => commit(intent, (tx) => {
      for (const [id, value] of writes) {
        tx.set({ id }, value);
      }
    }),
    // WIRE — when an authoritative backend is injected the four target
    // ops (read / subscribe / commit / derived-compute) resolve from it.
    // `read` returns the wasm-side value; `subscribe` registers the
    // observer for wasm Phase-G firing. Reads/subscribes for nodes the
    // injected backend does not own (e.g. the engine-owned `commitLog`, or
    // commit-metadata deriveds that were NOT mirrored) fall back to the TS
    // closure so those affordances keep working. `commit` is mirrored at
    // the public `commit` seam below (it needs the tx-callback validation
    // path), not here.
    read: (node) => {
      if (injectedBackend !== void 0 && !entries.has(node.id) && disposed.has(node.id)) {
        return read(node);
      }
      if (injectedBackend !== void 0 && injectedBackend.has(node.id)) {
        flushSeed();
        if (activeReadTracker !== null) {
          activeReadTracker.add(node.id);
        }
        const value = injectedBackend.read(node.id);
        if (!NODE_ENV_IS_PRODUCTION) {
          recordH1HazardRead(value, node.id);
        }
        return value;
      }
      return read(node);
    },
    subscribe: (node, observer) => {
      if (injectedBackend !== void 0 && !entries.has(node.id) && disposed.has(node.id)) {
        return subscribe(node, observer);
      }
      if (injectedBackend !== void 0 && injectedBackend.has(node.id)) {
        flushSeed();
        return injectedBackend.subscribe(node.id, observer);
      }
      return subscribe(node, observer);
    },
    // lift-subscribecommits (causljs/causl-wasm#170) — under rust-ssot the
    // commit-level observers are fired FROM the Rust apply path (the §5.5
    // Phase-H `__causl_on_commit` crossing, once per commit, AFTER the
    // Phase-G per-node firing), NOT the TS `#graph` Phase-H dispatch. The
    // injected backend reproduces the TS `subscribeCommits` `Commit`
    // (time/intent/changedNodes/originatedAt) byte-identically; there is NO
    // TS `#graph` Phase-H consult on this path once the backend reports the
    // rebuilt commit channel is present. Falls back to the TS closure on a
    // legacy artefact (sidecar commit-handler registry absent).
    subscribeCommits: (observer) => injectedBackend !== void 0 && injectedBackend.firesCommitsFromRust?.() === true && injectedBackend.subscribeCommits !== void 0 ? injectedBackend.subscribeCommits(observer) : subscribeCommits(observer),
    snapshot: () => snapshot(),
    hydrate: (snap) => {
      hydrate(snap);
    },
    // lift-export (causljs/causl-wasm#170) — under rust-ssot the whole
    // `CauslModel` IR resolves FROM the Rust §18A.3 deep export (nodes +
    // deps + commit-log-with-originatedAt + the IRSubscribe event stream),
    // NOT the TS closure. The `graphId` (the IR foreign key) is this
    // closure's `graphId` — a marshaling-layer concern (the adopter's graph
    // name) the facade supplies; the backend does not consult the `#graph`.
    // The only TS on the rerouted path is the marshaling `serializable`
    // shim over the Rust values. Falls back to the TS closure on a legacy
    // artefact (extern absent).
    exportModel: (opts) => {
      if (injectedBackend !== void 0 && injectedBackend.exportsModelFromRust?.() === true && injectedBackend.exportModel !== void 0) {
        flushSeed();
        const model = injectedBackend.exportModel(graphId, opts);
        const maxCommits = opts?.maxCommits ?? 100;
        const commits = commitHistoryCap <= 0 ? [] : model.commits.slice(-Math.min(commitHistoryCap, maxCommits));
        return { ...model, commits };
      }
      return exportModel(opts);
    },
    // lift-readat (causljs/causl-wasm#170) — under the ownership gate the
    // discriminated historical INPUT reads resolve FROM the Rust retention
    // chain (the §12.2 `read_at_result` extern), NOT the TS closure. The
    // Rust resolver reproduces the TS `readAt`/`snapshotAt`
    // `RetentionResult` byte-identically for input cells. Falls back to
    // the TS closure on a legacy artefact (extern absent).
    //
    // #80 → #252 — DERIVED nodes route through THIS closure's `readAt`,
    // whose derived branch is ownership-aware: the pre-#252 Rust chain
    // carried input rows only, so a derived read-at-time was
    // definitionally the reference RECOMPUTE over the retained input row
    // (`recomputeFromSnapshot`); the #80 comment's "future artefact that
    // retains derived cell rows engine-side" is the causljs/causl-wasm#321
    // `RetainDerivedRows` opt-in this facade now threads at boot, so under
    // ownership the derived value serves from the engine-retained row
    // (recompute-free), with the reference recompute over ENGINE-retained
    // input history covering the in-window miss + container-row classes.
    // The retained arm's `time` breadcrumb is the chosen ENVELOPE row's
    // time — the TS reference's attribution — on every path.
    //
    // In-frame caveat (documented, same class as the cc#71 in-observer
    // corner): a Phase-G/H observer calling `readAt` for the NOTIFYING
    // commit's time reads this closure's retention BEFORE Phase F.6
    // retains that commit's row (TS publication follows backend
    // acceptance, #77) — commit-boundary reads, the pinned surface, are
    // byte-identical.
    // #252 — the reroute gate is now the retention-SSOT OWNERSHIP gate
    // (`backendOwnsRetention`): rust-ssot + a #321/#323-era artefact +
    // the adopter's effective window threaded at construction +
    // `commitHistoryCap > 0`. Pre-#252 the gate was the bare
    // `readsHistoryFromRust` capability probe, which resolved INPUT
    // reads from the engine's hardcoded-1024 window while DERIVED reads
    // stayed on the TS `snapshotRetentionCap` window — adopter-visibly
    // inconsistent at any non-1024 cap (the #129 deferral analysis).
    // Under ownership both namespaces resolve from the ONE threaded
    // window; disarmed (js-ssot, legacy artefact, or `commitHistoryCap
    // === 0`, whose frozen-genesis floor shape no engine window can
    // represent) EVERY historical read keeps the TS closure — byte-
    // identical to the floor by construction.
    readAt: (node, time) => backendOwnsRetention && injectedBackend.readAt !== void 0 && injectedBackend.has(node.id) && entries.get(node.id)?.kind !== "derived" ? injectedBackend.readAt(node.id, time) : readAt(node, time),
    snapshotAt: (time) => backendOwnsRetention && injectedBackend.snapshotAt !== void 0 ? injectedBackend.snapshotAt(time) : snapshotAt(time),
    dispose: (node) => {
      _dispose(node);
    },
    // `evaluateStatechart` — SPEC §6 composite-statechart extension
    // point landed by issue #1068 as the deferred-from-#698 work. The
    // default implementation lives in `./statechart-evaluator.ts` and
    // mirrors the sync-side reducers (`reduceConflict` /
    // `reduceResource` in `@causl/sync/src/statechart-reducers.ts`)
    // structurally. A cross-backend determinism gate verifies the two
    // implementations stay byte-equivalent; the WASM backend's
    // `evaluateStatechart` (Sub-D of EPIC #680) replaces this with a
    // Rust-side implementation consuming the
    // `tools/engine-rs-core/src/statechart_reducers.rs` enums (gated
    // behind `feature = "future"`).
    evaluateStatechart: (input2) => evaluateStatechart(input2),
    // WIRE — the authoritative clock is the wasm commit time when a
    // backend is injected. Both clocks advance exactly one tick per commit
    // (SPEC §5 — one transaction, one `t`), so they stay in lockstep;
    // routing through the injected backend makes the wasm side the SSOT
    // for `graph.now`.
    //
    // #91 — in-frame corner (sibling of #86). The wasm Phase-G/H observer
    // fan fires INSIDE `apply_commands`, within the #77 dispatch window that
    // opens at Phase C.5 (see `inBackendDispatchWindow`) — AFTER Phase C
    // already advanced the engine-closure `now` to the committing tick, but
    // BEFORE `apply_commands` returns and promotes `injectedBackend.now`.
    // So a `graph.now` read issued from a wasm observer would route through
    // `injectedBackend.now` and see the LAST-PROMOTED tick — one behind the
    // committing time the fire records and `__causl_on_commit` stamps already
    // carry (PR #85). While the window is open resolve the engine-closure
    // `now` (the staged committing tick), byte-identical to the TS reference,
    // whose observers read the same closure clock post-Phase-C. Gated on
    // `inBackendDispatchWindow` (set only across the injected `acceptAuthoritative`
    // call, never Phase D — see the flag) so the commit-BOUNDARY read (window
    // closed) keeps routing through `injectedBackend.now`, and the no-backend
    // closure (`createCausl`/`createCauslTs`) is byte-untouched. Cap-independent:
    // the clock ticks regardless of retention cap, so no cap guard (unlike the
    // #86 readAt corner, which needed one because at cap=0 there is no `now` row).
    now: () => injectedBackend !== void 0 ? inBackendDispatchWindow ? now : injectedBackend.now : now
  });
  const commitFacade = injectedBackend === void 0 ? commit : (intent, run) => {
    const writes = /* @__PURE__ */ new Map();
    let wasmCommit;
    const tsCommit = commitInternal(
      intent,
      (tx) => {
        const recordingTx = {
          set: (node, value) => {
            writes.set(node.id, value);
            tx.set(node, value);
          }
        };
        run(recordingTx);
      },
      void 0,
      () => {
        flushSeed();
        wasmCommit = injectedBackend.commit(intent, writes);
        return wasmCommit.changedNodes;
      }
    );
    if (wasmCommit === void 0) {
      throw new Error(
        "[causl] injected-backend commit facade: the acceptance gate did not run \u2014 commitInternal returned without driving the authoritative backend. This is a wiring bug."
      );
    }
    if (wasmCommit.changedNodes.length > 0) {
      const tsCounted = new Set(tsCommit.changedNodes);
      for (const id of wasmCommit.changedNodes) {
        if (!tsCounted.has(id) && preFireBumpedThisCommit?.has(id) !== true) {
          nodeVersions.set(id, (nodeVersions.get(id) ?? 0) + 1);
        }
      }
    }
    preFireBumpedThisCommit = void 0;
    return wasmCommit.intent === intent ? wasmCommit : { ...wasmCommit, intent: tsCommit.intent };
  };
  const graph = {
    input,
    derived,
    commitMetadataDerived,
    commit: commitFacade,
    // #129 (write-SSOT cutover) — under the engine-owned dry-run gate
    // (rust-ssot + the cw#320 extern + no commit-metadata derived) the §5
    // dry-run reroutes to the engine's `simulate_commands`; every other
    // shape (js-ssot, legacy artefact, the metadata shape, the pure-TS
    // floor) keeps the TS pipeline byte-identically.
    simulate: (intent, run) => backendOwnsSimulate() ? engineSimulateReroute(intent, run) : simulate(intent, run),
    read: (node) => backend.read(node),
    subscribe: (node, observer, options2) => {
      if (options2 === void 0) return backend.subscribe(node, observer);
      if (injectedBackend === void 0) {
        return subscribe(node, observer, options2);
      }
      if (options2.transient !== true) {
        return backend.subscribe(node, observer);
      }
      let fireCount = 0;
      let done = false;
      let unsub = () => {
      };
      unsub = backend.subscribe(node, (value, time) => {
        observer(value, time);
        fireCount += 1;
        if (fireCount >= 2 && !done) {
          done = true;
          unsub();
        }
      });
      return () => {
        if (!done) {
          done = true;
          unsub();
        }
      };
    },
    subscribeMany,
    subscribeCommits: (observer) => backend.subscribeCommits(observer),
    subscribeReads,
    explain,
    dependencies: dependenciesOf,
    dependents: dependentsOf,
    exportModel: (opts) => (
      // #117 — the BackendEngine seam now threads `ExportModelOptions`, so
      // BOTH the no-options and tuned forms route through the backend. Under
      // rust-ssot this keeps the whole export (nodes + commit-window)
      // Rust-authoritative; a legacy artefact / js-ssot falls back to the TS
      // closure inside the reroute.
      backend.exportModel(opts)
    ),
    snapshot: () => backend.snapshot(),
    snapshotAt: (time) => backend.snapshotAt(time),
    hydrate: (snap) => backend.hydrate(snap),
    readAt: (node, time) => backend.readAt(node, time),
    get now() {
      return backend.now;
    },
    commitLog: commitLogNode,
    stats
  };
  registerInternalDispatch(graph, {
    dispose: (node) => backend.dispose(node),
    _migrateFrom: (snap) => _migrateFrom(snap),
    // #1241 — adapter-exemption seam. Routes through the
    // closure-scoped `runInAdapterReadMode` helper which manages the
    // H1 hazard tracker's depth counter. See
    // `InternalDispatch.__causlAdapterRead` for the contract.
    __causlAdapterRead: (fn) => runInAdapterReadMode(fn)
  });
  registerTestingDispatch(graph, {
    disposedTombstoneSize: () => disposed.size,
    commitLogConsumerCount: () => commitLogConsumerCount,
    // #129 — cumulative count of derived entries the Phase-D recompute
    // fixpoint has visited over this engine's lifetime. Tests snapshot it
    // before/after a commit: the delta is |affected deriveds| on the pure-TS
    // floor and 0 on a fully-mirrored wasm-backed graph (the reduction).
    phaseDDerivedWalkCount: () => phaseDDerivedWalkCount,
    phaseDStructuralWalkCount: () => phaseDStructuralWalkCount,
    // #129 (commit-SSOT cutover) — cumulative count of rows pushed onto the
    // TS `commitHistory` ring. Tests snapshot it before/after a commit: the
    // delta is 1 per accepted commit at cap > 0 on the pure-TS floor and 0
    // under the engine-owned commitLog gate (the Phase-F ring append is
    // deleted; the engine's cap-bounded log is the single storage).
    phaseFRingAppendCount: () => phaseFRingAppendCount,
    // #129 (write-SSOT cutover) — Phase-B outer-cell publication counter
    // (0 per backed commit under the write-cells gate; 1 per publishing
    // input on the floor) + the raw cell probe (the AC2 release pin: the
    // cell holds `null` under the gate, the committed value on the floor).
    phaseBCellPublishCount: () => phaseBCellPublishCount,
    inputCellRawValue: (id) => {
      const e = entries.get(id);
      return e !== void 0 && e.kind === "input" ? e.value : void 0;
    },
    // #703 Win 3 — expose the live deps Set so the
    // setDeps-immutability property suite can capture a reference
    // and verify subsequent commits leave it byte-identical.
    derivedDeps: (id) => {
      const e = entries.get(id);
      if (!e || e.kind !== "derived") return null;
      return e.deps;
    }
  });
  return graph;
}
function cloneForRetention(value) {
  if (value === null || value === void 0) return value;
  const t = typeof value;
  if (t === "number" || t === "string" || t === "boolean") return value;
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}
function isSerializable(value) {
  if (value === null || value === void 0) return true;
  const t = typeof value;
  if (t === "number" || t === "string" || t === "boolean") return true;
  if (t === "function" || t === "symbol") return false;
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}
function isInputValueSerializable(e, memoMap) {
  const memo = memoMap.get(e.id);
  if (memo !== void 0) return memo;
  const verdict = isSerializable(e.value);
  memoMap.set(e.id, verdict);
  return verdict;
}
function serialiseSafely(value) {
  if (isSerializable(value)) return value;
  return null;
}

// src/schema.ts
var causlModelJsonSchema = {
  // Document-level metadata: dialect, identifier, and human-readable title.
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://causl.dev/schemas/causl-model-v3.json",
  title: "CauslModel",
  type: "object",
  // Top-level required keys; mirrors the CauslModel interface.
  // The shape is closed by `additionalProperties: false`: schema 3
  // adds `events` (lifecycle stream), `scopes` (scope registry), and
  // `bridges` (cross-graph allowlist). Adapter packages that need
  // richer model state ship a sibling document the checker reads
  // alongside the engine IR; they do not extend `CauslModel` itself.
  required: ["schema", "time", "nodes", "commits", "events", "scopes", "bridges"],
  additionalProperties: false,
  properties: {
    // Pinned schema version: must equal CAUSL_MODEL_SCHEMA exactly.
    schema: { const: CAUSL_MODEL_SCHEMA },
    // GraphTime is a non-negative integer counting committed moments.
    time: { type: "integer", minimum: 0 },
    // Node array: each element is either an IRInput or an IRDerived.
    // The `oneOf` is the wire-level expression of §4's two-primitive
    // commitment — adding a third arm here would be a schema break
    // and must clear the same bar as adding a third `kind` to the
    // engine's runtime universe.
    nodes: {
      type: "array",
      items: {
        oneOf: [
          // IRInput shape — writable Behavior snapshot.
          {
            type: "object",
            required: ["kind", "id", "graphId", "value", "serializable"],
            additionalProperties: false,
            properties: {
              kind: { const: "input" },
              id: { type: "string", minLength: 1 },
              graphId: { type: "string", minLength: 1 },
              value: {},
              serializable: { type: "boolean" }
            }
          },
          // IRDerived shape — composed Behavior with dep edges.
          {
            type: "object",
            required: ["kind", "id", "graphId", "deps", "conditionalDeps", "value", "serializable"],
            additionalProperties: false,
            properties: {
              kind: { const: "derived" },
              id: { type: "string", minLength: 1 },
              graphId: { type: "string", minLength: 1 },
              deps: { type: "array", items: { type: "string" } },
              conditionalDeps: { type: "array", items: { type: "string" } },
              value: {},
              serializable: { type: "boolean" }
            }
          }
        ]
      }
    },
    // Capped commit log used for replay-determinism checks. Each
    // commit carries `graphId` (schema-3 multi-graph foreign key); the
    // optional `originatedAt`, `callGraph`, and `originEvent` fields
    // are reserved by schema 3 and emitted by the exporter when their
    // capture options are enabled.
    commits: {
      type: "array",
      items: {
        type: "object",
        required: ["time", "graphId", "intent", "changedNodes"],
        additionalProperties: false,
        properties: {
          time: { type: "integer", minimum: 0 },
          graphId: { type: "string", minLength: 1 },
          intent: { type: "string" },
          changedNodes: { type: "array", items: { type: "string" } },
          originatedAt: { type: "integer", minimum: 0 },
          callGraph: {
            type: "object",
            required: ["frames", "truncatedDeeper"],
            additionalProperties: false,
            properties: {
              frames: { type: "array" },
              truncatedDeeper: { type: "boolean" }
            }
          },
          originEvent: { type: "string" }
        }
      }
    },
    // Lifecycle event stream. Closed under `oneOf` on the `kind`
    // discriminator. Adding a seventh variant requires bumping the
    // schema and is caught at every `assertNever`-guarded reading
    // site in the engine and the checker.
    events: {
      type: "array",
      items: {
        oneOf: [
          // IRSubscribe — observer registration.
          {
            type: "object",
            required: ["kind", "graphId", "id", "scopeId", "target", "callbackSite", "time"],
            additionalProperties: false,
            properties: {
              kind: { const: "subscribe" },
              graphId: { type: "string", minLength: 1 },
              id: { type: "string", minLength: 1 },
              scopeId: { type: "string", minLength: 1 },
              target: { type: "string", minLength: 1 },
              callbackSite: { type: "string" },
              time: { type: "integer", minimum: 0 }
            }
          },
          // IRSubscribeCallback — observer invocation frame.
          {
            type: "object",
            required: ["kind", "graphId", "id", "subscribeId", "firedAt"],
            additionalProperties: false,
            properties: {
              kind: { const: "subscribe-callback" },
              graphId: { type: "string", minLength: 1 },
              id: { type: "string", minLength: 1 },
              subscribeId: { type: "string", minLength: 1 },
              firedAt: { type: "integer", minimum: 0 }
            }
          },
          // IRUnsubscribe — subscription teardown.
          {
            type: "object",
            required: ["kind", "graphId", "id", "scopeId", "time"],
            additionalProperties: false,
            properties: {
              kind: { const: "unsubscribe" },
              graphId: { type: "string", minLength: 1 },
              id: { type: "string", minLength: 1 },
              scopeId: { type: "string", minLength: 1 },
              time: { type: "integer", minimum: 0 }
            }
          },
          // IRDispose — node removal with half-open
          // [enqueueAt, appliedAt] interval per the brutal-critical
          // review's recommendation #5.
          {
            type: "object",
            required: ["kind", "graphId", "nodeId", "scopeId", "time", "disposeAt"],
            additionalProperties: false,
            properties: {
              kind: { const: "dispose" },
              graphId: { type: "string", minLength: 1 },
              nodeId: { type: "string", minLength: 1 },
              scopeId: { type: "string", minLength: 1 },
              time: { type: "integer", minimum: 0 },
              disposeAt: {
                type: "array",
                items: { type: "integer", minimum: 0 }
              }
            }
          },
          // IRRead — per-commit derived-read summary.
          {
            type: "object",
            required: ["kind", "graphId", "derivedId", "readNodeId", "time", "seq", "truncated"],
            additionalProperties: false,
            properties: {
              kind: { const: "read" },
              graphId: { type: "string", minLength: 1 },
              derivedId: { type: "string", minLength: 1 },
              readNodeId: { type: "string", minLength: 1 },
              time: { type: "integer", minimum: 0 },
              seq: { type: "integer", minimum: 0 },
              truncated: { type: "boolean" }
            }
          },
          // IRTxSet — `tx.set(input, value)` event.
          {
            type: "object",
            required: ["kind", "graphId", "inputId", "time"],
            additionalProperties: false,
            properties: {
              kind: { const: "tx-set" },
              graphId: { type: "string", minLength: 1 },
              inputId: { type: "string", minLength: 1 },
              time: { type: "integer", minimum: 0 }
            }
          }
        ]
      }
    },
    // Lifecycle scopes referenced by IRSubscribe / IRUnsubscribe /
    // IRDispose. Closed at three `kind` arms.
    scopes: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "kind", "lifetime"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          kind: { enum: ["ephemeral", "infinite", "process-exit"] },
          lifetime: {
            type: "object",
            required: ["origin", "terminator"],
            additionalProperties: false,
            properties: {
              origin: { type: "string" },
              terminator: { type: "string" }
            }
          }
        }
      }
    },
    // Sanctioned cross-graph dependency declarations. Closed at
    // three `policy` arms.
    bridges: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "to", "dep", "policy"],
        additionalProperties: false,
        properties: {
          from: { type: "string", minLength: 1 },
          to: { type: "string", minLength: 1 },
          dep: { type: "string", minLength: 1 },
          policy: { enum: ["legacy-allow", "test-only", "read-only"] }
        }
      }
    }
  }
};

// src/bridge.ts
async function detectFeatures() {
  const gc = await probeWasmGc();
  const jsStringBuiltins = await probeJsStringBuiltins();
  const sharedMemory = probeSharedMemory();
  const stringView = await probeStringView();
  return Object.freeze({ gc, jsStringBuiltins, sharedMemory, stringView });
}
async function tryCompile(bytes) {
  try {
    if (typeof WebAssembly === "undefined" || typeof WebAssembly.compile !== "function") {
      return false;
    }
    await WebAssembly.compile(bytes);
    return true;
  } catch {
    return false;
  }
}
async function probeWasmGc() {
  const bytes = new Uint8Array([
    0,
    97,
    115,
    109,
    // \0asm
    1,
    0,
    0,
    0,
    // version 1
    1,
    4,
    1,
    96,
    0,
    0,
    // type section: () -> ()
    3,
    2,
    1,
    0,
    // function section: one function of type 0
    10,
    7,
    1,
    5,
    0,
    208,
    110,
    26,
    11
    // code section: ref.null any (0xd0 0x6e), drop (0x1a), end (0x0b)
  ]);
  return tryCompile(bytes);
}
async function probeJsStringBuiltins() {
  const bytes = new Uint8Array([
    0,
    97,
    115,
    109,
    // \0asm
    1,
    0,
    0,
    0,
    // version 1
    // type section: (param externref) -> (i32)
    1,
    6,
    1,
    96,
    1,
    111,
    1,
    127,
    // import section: "wasm:js-string" . "length" : func type 0
    2,
    28,
    1,
    14,
    119,
    97,
    115,
    109,
    58,
    106,
    115,
    45,
    115,
    116,
    114,
    105,
    110,
    103,
    6,
    108,
    101,
    110,
    103,
    116,
    104,
    0,
    0
  ]);
  return tryCompile(bytes);
}
function probeSharedMemory() {
  try {
    const isolation = globalThis.crossOriginIsolated;
    if (isolation === false) return false;
    if (typeof WebAssembly === "undefined" || typeof WebAssembly.Memory !== "function") {
      return false;
    }
    new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    return true;
  } catch {
    return false;
  }
}
async function probeStringView() {
  const bytes = new Uint8Array([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    1,
    6,
    1,
    96,
    1,
    111,
    1,
    127,
    2,
    38,
    1,
    24,
    119,
    97,
    115,
    109,
    58,
    115,
    116,
    114,
    105,
    110,
    103,
    45,
    118,
    105,
    101,
    119,
    47,
    119,
    116,
    102,
    49,
    54,
    6,
    108,
    101,
    110,
    103,
    116,
    104,
    0,
    0
  ]);
  return tryCompile(bytes);
}
function readBridgeOverride() {
  try {
    const proc = globalThis.process;
    const raw = proc?.env?.CAUSL_WASM_BRIDGE;
    if (raw === "gc" || raw === "auto") return raw;
    return void 0;
  } catch {
    return void 0;
  }
}
function makeDefaultBridgePlaceholder() {
  const placeholderError = () => new Error(
    "[@causl/core] wasmgc-classic bridge is a placeholder pending #692. Real implementation lands with the wasm-pack pipeline."
  );
  const features = Object.freeze({
    gc: false,
    jsStringBuiltins: false,
    sharedMemory: false,
    stringView: false
  });
  return Object.freeze({
    id: "wasmgc-classic",
    features,
    abiVersion: 0,
    toWasmObject() {
      throw placeholderError();
    },
    fromWasmObject() {
      throw placeholderError();
    },
    toWasmString() {
      throw placeholderError();
    },
    fromWasmString() {
      throw placeholderError();
    },
    release() {
    }
  });
}
async function detectBridge() {
  let features;
  try {
    features = await detectFeatures();
  } catch {
    features = Object.freeze({
      gc: false,
      jsStringBuiltins: false,
      sharedMemory: false,
      stringView: false
    });
  }
  const explicit = readBridgeOverride();
  if (explicit === "gc" || features.gc && features.jsStringBuiltins) {
    try {
      return await loadGcBridge(features);
    } catch {
    }
  }
  if (features.gc) {
    try {
      return await loadGcClassicBridge(features);
    } catch {
    }
  }
  return loadGcClassicBridge(features);
}
async function loadGcBridge(_features) {
  await Promise.resolve();
  return makeDefaultBridgePlaceholder();
}
async function loadGcClassicBridge(_features) {
  await Promise.resolve();
  return makeDefaultBridgePlaceholder();
}

// src/auto-adapt.ts
var DEFAULT_THRESHOLDS = Object.freeze({
  nodeCount: 5e4,
  maxChainDepth: 500,
  medianCommitMsThreshold: 1,
  rollingCommitWindow: 100,
  commitCount: 500,
  totalSubscribers: 1e3
});
var HYSTERESIS_TRIP_COUNT = 3;
var NODE_COUNT_EWMA_ALPHA = 0.1;
function ewmaOver(values, alpha) {
  if (values.length === 0) return 0;
  let ewma = values[0];
  for (let i = 1; i < values.length; i += 1) {
    ewma = alpha * values[i] + (1 - alpha) * ewma;
  }
  return ewma;
}
function medianOf(values) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if ((sorted.length & 1) === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
function tripped(stats, t, medianCommitMs) {
  const nodes = stats.inputs + stats.deriveds;
  if (nodes > t.nodeCount) return true;
  const chainDepth = stats.maxChainDepth ?? 0;
  if (chainDepth > t.maxChainDepth) return true;
  if (stats.lastCommitTime > t.commitCount && stats.subscribersTotal > t.totalSubscribers && medianCommitMs > t.medianCommitMsThreshold) {
    return true;
  }
  return false;
}
function shouldMigrate(stats, thresholds, history, commitTimings = []) {
  const medianCommitMs = commitTimings.length > 0 ? medianOf(commitTimings) : stats.medianCommitMs ?? 0;
  if (history.length < HYSTERESIS_TRIP_COUNT - 1) return false;
  const tail = history.slice(-(HYSTERESIS_TRIP_COUNT - 1));
  if (!tripped(stats, thresholds, medianCommitMs)) return false;
  for (let i = 0; i < tail.length; i += 1) {
    if (!tripped(tail[i], thresholds, tail[i].medianCommitMs ?? 0)) return false;
  }
  const allNodeCounts = new Array(history.length + 1);
  for (let i = 0; i < history.length; i += 1) {
    const s = history[i];
    allNodeCounts[i] = s.inputs + s.deriveds;
  }
  allNodeCounts[history.length] = stats.inputs + stats.deriveds;
  const ewma = ewmaOver(allNodeCounts, NODE_COUNT_EWMA_ALPHA);
  return ewma > thresholds.nodeCount;
}
function loadThresholdsFromEnv() {
  const overrides = {};
  try {
    const proc = globalThis.process;
    const env = proc?.env;
    if (env === void 0 || env === null) return overrides;
    const tryParse = (key) => {
      const raw = env[key];
      if (raw === void 0 || raw === "") return void 0;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) return void 0;
      return parsed;
    };
    const nodeCount = tryParse("CAUSL_WASM_NODE_THRESHOLD");
    if (nodeCount !== void 0) overrides.nodeCount = nodeCount;
    const chain = tryParse("CAUSL_WASM_CHAIN_THRESHOLD");
    if (chain !== void 0) overrides.maxChainDepth = chain;
    const subs = tryParse("CAUSL_WASM_SUBSCRIBER_THRESHOLD");
    if (subs !== void 0) overrides.totalSubscribers = subs;
    const commits = tryParse("CAUSL_WASM_COMMIT_THRESHOLD");
    if (commits !== void 0) overrides.commitCount = commits;
    const commitMs = tryParse("CAUSL_WASM_COMMIT_MS_THRESHOLD");
    if (commitMs !== void 0) overrides.medianCommitMsThreshold = commitMs;
  } catch {
  }
  return overrides;
}
var MODULE_THRESHOLD_OVERRIDES = Object.freeze(loadThresholdsFromEnv());

// src/index.ts
var VERSION = version;

export {
  CauslError,
  DuplicateNodeError,
  UnknownNodeError,
  NotAnInputNodeError,
  CommitInProgressError,
  CycleError,
  UNDECLARED_DEPENDENCY_MARKER,
  UndeclaredDependencyError,
  DerivedComputeError,
  asDerivedComputeError,
  StaleTxError,
  NodeDisposedError,
  NodeHasDependentsError,
  HydrationSchemaError,
  DisposalDuringCommitError,
  NonDeterministicComputeError,
  DerivedRegistrationStackOverflowError,
  InvalidGraphNameError,
  InvariantViolationError,
  WasmInstancePoisonedError,
  RetainedValueUnavailableError,
  InvalidInjectedBackendError,
  registerWasmSyncEngine,
  onCauslCapabilityFallback,
  evaluateStatechart,
  withInjectedBackend,
  CAUSL_MODEL_SCHEMA,
  parseCauslModel,
  currentTemporalImpl,
  hasTaggedTypes,
  encodeTagged,
  reviveTagged,
  inputEpochMarkerForPacked,
  inputEpochMarker,
  parseInputEpoch,
  contentHashMarker,
  GRAPH_ID_REGEX,
  createCausl,
  createCauslTs,
  causlModelJsonSchema,
  detectFeatures,
  detectBridge,
  DEFAULT_THRESHOLDS,
  shouldMigrate,
  VERSION
};
//# sourceMappingURL=chunk-BJBUOM2F.js.map