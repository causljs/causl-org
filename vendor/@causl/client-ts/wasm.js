import {
  CAUSL_MODEL_SCHEMA,
  CauslError,
  CommitInProgressError,
  CycleError,
  RetainedValueUnavailableError,
  StaleTxError,
  UNDECLARED_DEPENDENCY_MARKER,
  UndeclaredDependencyError,
  WasmInstancePoisonedError,
  asDerivedComputeError,
  contentHashMarker,
  createCausl,
  createCauslTs,
  currentTemporalImpl,
  encodeTagged,
  evaluateStatechart,
  hasTaggedTypes,
  inputEpochMarker,
  inputEpochMarkerForPacked,
  parseInputEpoch,
  registerWasmSyncEngine,
  reviveTagged,
  withInjectedBackend
} from "./chunk-BJBUOM2F.js";
import {
  _migrateFrom
} from "./chunk-SG3KXR2O.js";
import "./chunk-SHOBOWND.js";

// wasm/simulate-facade.ts
function buildSimulateRerouteImpl(ctx, engineSimulate, readCommitted) {
  return function simulateViaEngine(intent, run) {
    if (ctx.isCommitting()) throw new CommitInProgressError();
    ctx.setCommitting(true);
    const rowIds = [];
    const rowValues = [];
    const rowFast = [];
    const rowIndex = /* @__PURE__ */ new Map();
    const writes = /* @__PURE__ */ new Map();
    let txAlive = true;
    const tx = {
      set(node, value) {
        if (!txAlive) throw new StaleTxError();
        if (value === void 0) value = null;
        const id = node.id;
        const entry = ctx.resolveInputEntry(id);
        writes.set(id, value);
        const idx = rowIndex.get(id);
        if (idx !== void 0) {
          rowValues[idx] = value;
          return;
        }
        if (Object.is(readCommitted(id), value)) return;
        rowIndex.set(id, rowIds.length);
        rowIds.push(id);
        rowValues.push(value);
        rowFast.push(!entry.hasDependents);
      }
    };
    const stagedDiff = [];
    let predicted = null;
    let predictedError = null;
    try {
      run(tx);
      txAlive = false;
      for (let pass = 0; pass < 2; pass++) {
        const wantFast = pass === 0;
        for (let i = 0; i < rowIds.length; i++) {
          if (rowFast[i] !== wantFast) continue;
          const baseline = readCommitted(rowIds[i]);
          const v = rowValues[i];
          if (Object.is(baseline, v)) continue;
          if (ctx.inputValueChanged(baseline, v)) stagedDiff.push(rowIds[i]);
        }
      }
      ctx.flushSeed();
      predicted = engineSimulate(intent, writes);
    } catch (err) {
      if (err instanceof WasmInstancePoisonedError) {
        ctx.setCommitting(false);
        throw err;
      }
      predictedError = err;
    } finally {
      txAlive = false;
      ctx.setCommitting(false);
    }
    if (predictedError === null && predicted !== null) {
      const derivedDiff = [];
      for (const id of predicted.changedNodes) {
        if (ctx.isDerived(id)) derivedDiff.push(id);
      }
      const changedNodes = [...stagedDiff, ...derivedDiff];
      const c = Object.freeze({
        time: predicted.time,
        intent,
        changedNodes: ctx.freezeIfDev(changedNodes),
        originatedAt: void 0
      });
      return {
        status: "clean",
        commit: c,
        stagedDiff: Object.freeze(stagedDiff.slice()),
        derivedDiff: Object.freeze(derivedDiff)
      };
    }
    return {
      status: "failed",
      error: predictedError,
      stagedDiff: Object.freeze(stagedDiff.slice())
    };
  };
}

// wasm/wire-guard.ts
var U8_MAX = 255;
var U32_MAX = 4294967295;
var WireFieldOverflowError = class extends RangeError {
  constructor(field, value, max, format, context) {
    super(
      `wire overflow: ${format} field "${field}" value ${value} exceeds ${max} (datatype cap)${context ? ` [${context}]` : ""}`
    );
    this.field = field;
    this.value = value;
    this.max = max;
    this.format = format;
    this.context = context;
  }
  field;
  value;
  max;
  format;
  context;
  name = "WireFieldOverflowError";
};
function checkRange(v, max, field, fmt, ctx) {
  if (!Number.isInteger(v) || v < 0 || v > max) {
    throw new WireFieldOverflowError(field, v, max, fmt, ctx);
  }
}
function writeU8Checked(view, off, v, field, ctx, fmt = "cmd-buf") {
  checkRange(v, U8_MAX, field, fmt, ctx);
  view.setUint8(off, v);
}
function writeU32Checked(view, off, v, field, ctx, fmt = "cmd-buf") {
  checkRange(v, U32_MAX, field, fmt, ctx);
  view.setUint32(off, v, true);
}
function checkU32(v, field, fmt = "cmd-buf", ctx) {
  checkRange(v, U32_MAX, field, fmt, ctx);
  return v;
}

// wasm/cmd-buf.ts
var op = {
  SET_INPUT: 0,
  BEGIN_COMMIT: 1,
  END_COMMIT: 2,
  DISPOSE: 3,
  SUBSCRIBE: 4,
  UNSUBSCRIBE: 5,
  DISPATCH_MSG: 6,
  BEGIN_FETCH: 7,
  RESOLVE_PENDING: 8,
  TICK: 9,
  REGISTER_DERIVED: 10,
  /** R1 (causl/causl-client-ts#59) — eager direct-write input seed (SetInput's 12-byte body, applied out-of-commit). */
  SEED_INPUT: 11,
  /** R1 (causl/causl-client-ts#59) — non-committing Phase-D materialise pass (0-byte payload). */
  MATERIALIZE: 12,
  /**
   * #129 / causl/causl-core-rs#318 — set the engine's commit-log eviction
   * horizon (`cap u32` body; 0 disables retention). Threads the adopter's
   * `commitHistoryCap` onto `State::commit_log_cap` so the engine ring and
   * the adopter-facing `commitLog` window share ONE horizon.
   */
  SET_COMMIT_LOG_CAP: 13,
  /**
   * #252 / causl/causl-core-rs#321 — opt in to Phase F.6 DERIVED-row
   * retention (`enabled u32` body; 0 = off). With the flag on, each
   * commit's engine retention delta is widened with the post-Phase-D
   * value of every derived in the changed set, so `read_at_result`
   * resolves deriveds from the same chain + promoted floor the input
   * rows ride. Threaded once at boot, exactly like `SetCommitLogCap`.
   */
  RETAIN_DERIVED_ROWS: 14,
  /**
   * #252 / causl/causl-core-rs#323 — set the engine's retention-chain
   * eviction window (`cap u32` body; 0 disables retention). Threads the
   * adopter's effective `snapshotRetentionCap` onto
   * `State::commit_history_cap` — the window `read_at_result` resolves
   * from — replacing the engine's hardcoded 1024 default so the engine
   * window and the TS floor's readAt/snapshotAt window are provably ONE.
   */
  SET_SNAPSHOT_RETENTION_CAP: 15
};
var kind = {
  NULL: 0,
  BOOL: 1,
  NUMBER: 2,
  STRING_ID: 3,
  ARRAY_REF: 4,
  OBJECT_REF: 5,
  PENDING: 6,
  ERROR: 7,
  STRING_EXTREF: 8,
  /**
   * Content-hash container handle (feat/content-hash-values) — mirrors
   * the Rust bridge's `cmd_decoder::kind::CONTENT_HASH`. The inline u64
   * low 32 bits is the intern-table `StringId` of a deterministic
   * structural content-hash MARKER of an Array/Object value. The engine
   * stores the marker for its cutoff / `State::hash`; the real value
   * lives in the JS NodeId read cache.
   */
  CONTENT_HASH: 9,
  /**
   * Container-INPUT epoch marker (#221/#115) — mirrors the Rust bridge's
   * `cmd_decoder::kind::INPUT_EPOCH`. The inline u64 carries a
   * `(slot, epoch)` pair packed INLINE (`packInputEpoch` — slot high 32
   * bits, epoch low 32 bits) with NOTHING interned, superseding the
   * {@link CONTENT_HASH} path on the authoritative INPUT container write.
   * The engine reconstructs the change-token marker from the payload for
   * its cutoff / `State::hash`; the real container value lives in the JS
   * NodeId read cache. A re-`set` container therefore no longer mints one
   * immortal intern-table entry per commit.
   */
  INPUT_EPOCH: 10
};
var cmdBufTextEncoder = new TextEncoder();
var internMemoByBridge = /* @__PURE__ */ new WeakMap();
var INTERN_MEMO_CAP = 4096;
function internStringMemo(bridge, value, field, record) {
  let memo = internMemoByBridge.get(bridge);
  if (memo === void 0) {
    memo = /* @__PURE__ */ new Map();
    internMemoByBridge.set(bridge, memo);
  }
  const hit = memo.get(value);
  if (hit !== void 0) return hit;
  const id = checkU32(
    bridge.intern_string(cmdBufTextEncoder.encode(value)),
    field,
    "cmd-buf",
    record
  );
  if (memo.size >= INTERN_MEMO_CAP) {
    const oldest = memo.keys().next().value;
    if (oldest !== void 0) memo.delete(oldest);
  }
  memo.set(value, id);
  return id;
}
function packInlineValue(value, bridge, containerMarkerOverride) {
  if (value === null || value === void 0) {
    return { kind: kind.NULL, inline: 0n };
  }
  if (typeof value === "boolean") {
    return { kind: kind.BOOL, inline: value ? 1n : 0n };
  }
  if (typeof value === "number") {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    const bits = new DataView(buf).getBigUint64(0, true);
    return { kind: kind.NUMBER, inline: bits };
  }
  if (hasTaggedTypes(value)) {
    value = encodeTagged(value);
  }
  if (bridge !== void 0) {
    if (typeof value === "string") {
      const id = internStringMemo(
        bridge,
        value,
        "SET_INPUT::string_intern_id",
        "SET_INPUT"
      );
      return { kind: kind.STRING_ID, inline: BigInt(id) };
    }
    if (Array.isArray(value) || typeof value === "object") {
      if (containerMarkerOverride !== void 0) {
        const payload = parseInputEpoch(containerMarkerOverride);
        if (payload !== void 0) {
          return { kind: kind.INPUT_EPOCH, inline: payload };
        }
      }
      const marker = containerMarkerOverride ?? contentHashMarker(value);
      const id = internStringMemo(
        bridge,
        marker,
        "SET_INPUT::content_hash_intern_id",
        "SET_INPUT"
      );
      return { kind: kind.CONTENT_HASH, inline: BigInt(id) };
    }
  }
  return { kind: kind.NULL, inline: 0n };
}
function encodeBeginCommit(intentId, intentStringId, originatedAt) {
  if (intentStringId === void 0) {
    const buf2 = new Uint8Array(8);
    const view2 = new DataView(buf2.buffer);
    view2.setUint16(0, op.BEGIN_COMMIT, true);
    view2.setUint16(2, 4, true);
    writeU32Checked(view2, 4, intentId, "BEGIN_COMMIT::intent_id", "BEGIN_COMMIT");
    return buf2;
  }
  if (originatedAt !== void 0) {
    const buf2 = new Uint8Array(20);
    const view2 = new DataView(buf2.buffer);
    view2.setUint16(0, op.BEGIN_COMMIT, true);
    view2.setUint16(2, 16, true);
    writeU32Checked(view2, 4, intentId, "BEGIN_COMMIT::intent_id", "BEGIN_COMMIT");
    writeU32Checked(
      view2,
      8,
      intentStringId,
      "BEGIN_COMMIT::intent_string_id",
      "BEGIN_COMMIT"
    );
    view2.setBigUint64(12, BigInt(originatedAt), true);
    return buf2;
  }
  const buf = new Uint8Array(12);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.BEGIN_COMMIT, true);
  view.setUint16(2, 8, true);
  writeU32Checked(view, 4, intentId, "BEGIN_COMMIT::intent_id", "BEGIN_COMMIT");
  writeU32Checked(
    view,
    8,
    intentStringId,
    "BEGIN_COMMIT::intent_string_id",
    "BEGIN_COMMIT"
  );
  return buf;
}
function encodeSetCommitLogCap(cap) {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.SET_COMMIT_LOG_CAP, true);
  view.setUint16(2, 4, true);
  writeU32Checked(view, 4, cap, "SET_COMMIT_LOG_CAP::cap", "SET_COMMIT_LOG_CAP");
  return buf;
}
function encodeRetainDerivedRows(enabled) {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.RETAIN_DERIVED_ROWS, true);
  view.setUint16(2, 4, true);
  view.setUint32(4, enabled ? 1 : 0, true);
  return buf;
}
function encodeSetSnapshotRetentionCap(cap) {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.SET_SNAPSHOT_RETENTION_CAP, true);
  view.setUint16(2, 4, true);
  writeU32Checked(
    view,
    4,
    cap,
    "SET_SNAPSHOT_RETENTION_CAP::cap",
    "SET_SNAPSHOT_RETENTION_CAP"
  );
  return buf;
}
function encodeEndCommit() {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.END_COMMIT, true);
  view.setUint16(2, 0, true);
  return buf;
}
function encodeSetInput(slot, gen, valueKind, valueInline) {
  const buf = new Uint8Array(24);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.SET_INPUT, true);
  view.setUint16(2, 12, true);
  writeU32Checked(view, 4, slot, "SET_INPUT::slot", "SET_INPUT");
  writeU32Checked(view, 8, gen, "SET_INPUT::gen", "SET_INPUT");
  writeU8Checked(view, 12, valueKind, "SET_INPUT::value_kind", "SET_INPUT");
  view.setBigUint64(16, valueInline, true);
  return buf;
}
function encodeSeedInput(slot, gen, valueKind, valueInline) {
  const buf = new Uint8Array(24);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.SEED_INPUT, true);
  view.setUint16(2, 12, true);
  writeU32Checked(view, 4, slot, "SEED_INPUT::slot", "SEED_INPUT");
  writeU32Checked(view, 8, gen, "SEED_INPUT::gen", "SEED_INPUT");
  writeU8Checked(view, 12, valueKind, "SEED_INPUT::value_kind", "SEED_INPUT");
  view.setBigUint64(16, valueInline, true);
  return buf;
}
function encodeMaterialize() {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.MATERIALIZE, true);
  view.setUint16(2, 0, true);
  return buf;
}
function encodeDispose(handle) {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.DISPOSE, true);
  view.setUint16(2, 4, true);
  writeU32Checked(view, 4, handle, "DISPOSE::handle", "DISPOSE");
  return buf;
}
function encodeSubscribe(slot, gen, engineId, callbackId) {
  const buf = new Uint8Array(20);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.SUBSCRIBE, true);
  view.setUint16(2, 8, true);
  writeU32Checked(view, 4, slot, "SUBSCRIBE::slot", "SUBSCRIBE");
  writeU32Checked(view, 8, gen, "SUBSCRIBE::gen", "SUBSCRIBE");
  writeU32Checked(view, 12, engineId, "SUBSCRIBE::engine_id", "SUBSCRIBE");
  writeU32Checked(view, 16, callbackId, "SUBSCRIBE::callback_id", "SUBSCRIBE");
  return buf;
}
var PAYLOAD_LEN_ESCAPE_SENTINEL = 65535;
var MAX_LITERAL_PAYLOAD_LEN = PAYLOAD_LEN_ESCAPE_SENTINEL - 1;
var REGISTER_DERIVED_MAX_DEP_COUNT = Math.floor(
  (4294967295 - 8) / 8
);
function encodeRegisterDerived(derivedSlot, derivedGen, fnId, deps) {
  const depCount = deps.length;
  const declared = 8 + 8 * depCount;
  if (depCount > REGISTER_DERIVED_MAX_DEP_COUNT) {
    throw new Error(
      `encodeRegisterDerived: dep_count ${depCount} exceeds the maximum ${REGISTER_DERIVED_MAX_DEP_COUNT} describable by the u32 declared length (8 + 8*dep_count must fit a u32).`
    );
  }
  const escaped = declared > MAX_LITERAL_PAYLOAD_LEN;
  const headerLen = escaped ? 8 : 4;
  const total = headerLen + 8 + declared;
  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);
  view.setUint16(0, op.REGISTER_DERIVED, true);
  if (escaped) {
    view.setUint16(2, PAYLOAD_LEN_ESCAPE_SENTINEL, true);
    writeU32Checked(
      view,
      4,
      declared,
      "REGISTER_DERIVED::extended_len",
      "REGISTER_DERIVED"
    );
  } else {
    view.setUint16(2, declared, true);
  }
  writeU32Checked(
    view,
    headerLen,
    derivedSlot,
    "REGISTER_DERIVED::derived_slot",
    "REGISTER_DERIVED"
  );
  writeU32Checked(
    view,
    headerLen + 4,
    derivedGen,
    "REGISTER_DERIVED::derived_gen",
    "REGISTER_DERIVED"
  );
  writeU32Checked(
    view,
    headerLen + 8,
    depCount,
    "REGISTER_DERIVED::dep_count",
    "REGISTER_DERIVED"
  );
  writeU32Checked(
    view,
    headerLen + 12,
    fnId,
    "REGISTER_DERIVED::fn_id",
    "REGISTER_DERIVED"
  );
  let off = headerLen + 16;
  for (const d of deps) {
    writeU32Checked(view, off, d.slot, "REGISTER_DERIVED::dep_slot", "REGISTER_DERIVED");
    writeU32Checked(
      view,
      off + 4,
      d.gen,
      "REGISTER_DERIVED::dep_gen",
      "REGISTER_DERIVED"
    );
    off += 8;
  }
  return buf;
}
function concatCmds(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
function buildCommitCmdBuf(intentId, writes, bridge, intent, originatedAt) {
  let intentStringId;
  if (bridge !== void 0 && intent !== void 0) {
    intentStringId = internStringMemo(
      bridge,
      intent,
      "BEGIN_COMMIT::intent_intern_id",
      "BEGIN_COMMIT"
    );
  }
  const parts = [
    encodeBeginCommit(
      intentId,
      intentStringId,
      intentStringId !== void 0 ? originatedAt : void 0
    )
  ];
  for (const [, w] of writes) {
    const { kind: k, inline } = packInlineValue(w.value, bridge, w.containerMarker);
    parts.push(encodeSetInput(w.slot, w.gen, k, inline));
  }
  parts.push(encodeEndCommit());
  return concatCmds(parts);
}

// wasm/value-buf.ts
var VALUE_BUF_RECORD_LEN = 12;
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
var ValueHandleCache = class _ValueHandleCache {
  #map = /* @__PURE__ */ new Map();
  #cap;
  /**
   * @param capacity Max entries before LRU eviction (default 4096). Pass
   *   `Number.MAX_SAFE_INTEGER` (or any value ≥ 2^31) for an effectively
   *   unbounded cache — the authoritative engine uses this so a live
   *   container cell's value (the ONLY copy, post content-hash) never ages
   *   out. `Math.floor` (not `| 0`, which truncates to 32 bits and would
   *   wrap a large capacity to a tiny one) keeps a large cap large.
   */
  constructor(capacity = 4096) {
    this.#cap = Math.max(1, Math.floor(capacity));
  }
  /** Cache the original JS value for `key` (most-recently-used). */
  set(key, value) {
    if (this.#map.has(key)) this.#map.delete(key);
    this.#map.set(key, value);
    if (this.#map.size > this.#cap) {
      const oldest = this.#map.keys().next().value;
      if (oldest !== void 0) this.#map.delete(oldest);
    }
  }
  /**
   * Return the cached value for `key`, or the {@link MISS} sentinel when
   * absent (distinct from a cached `undefined` / `null`). A hit promotes
   * the entry to most-recently-used.
   */
  get(key) {
    if (!this.#map.has(key)) return _ValueHandleCache.MISS;
    const value = this.#map.get(key);
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }
  /** Drop a single entry (e.g. a disposed node). */
  delete(key) {
    this.#map.delete(key);
  }
  /** Drop every entry (the value-pool reset / bridge reset). */
  clear() {
    this.#map.clear();
  }
  /** Current entry count (test / diagnostics). */
  get size() {
    return this.#map.size;
  }
  /** Sentinel distinguishing a MISS from a cached `undefined` / `null`. */
  static MISS = /* @__PURE__ */ Symbol("value-handle-cache-miss");
};
function encodeValueRecord(value, bridge, out) {
  if (hasTaggedTypes(value)) {
    value = encodeTagged(value);
  }
  let kindByte;
  let lo = 0;
  let hi = 0;
  if (value === null || value === void 0) {
    kindByte = kind.NULL;
  } else if (typeof value === "boolean") {
    kindByte = kind.BOOL;
    lo = value ? 1 : 0;
  } else if (typeof value === "number") {
    kindByte = kind.NUMBER;
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setFloat64(0, value, true);
    lo = view.getUint32(0, true);
    hi = view.getUint32(4, true);
  } else if (typeof value === "string") {
    kindByte = kind.STRING_ID;
    lo = checkU32(
      bridge.intern_string(textEncoder.encode(value)),
      "value-buf::string_intern_id",
      "value-buf",
      "STRING_ID"
    );
  } else if (Array.isArray(value) || typeof value === "object") {
    kindByte = kind.CONTENT_HASH;
    lo = checkU32(
      bridge.intern_string(textEncoder.encode(contentHashMarker(value))),
      "value-buf::content_hash_intern_id",
      "value-buf",
      "CONTENT_HASH"
    );
  } else {
    kindByte = kind.NULL;
  }
  out.push(kindByte, 0, 0, 0);
  out.push(lo & 255, lo >>> 8 & 255, lo >>> 16 & 255, lo >>> 24 & 255);
  out.push(hi & 255, hi >>> 8 & 255, hi >>> 16 & 255, hi >>> 24 & 255);
}
function encodeValueBuf(value, bridge) {
  const out = [];
  encodeValueRecord(value, bridge, out);
  return Uint8Array.from(out);
}
var CONTENT_HASH_FROM_CACHE = /* @__PURE__ */ Symbol(
  "causl-content-hash-from-cache"
);
function decodeValueRecord(buf, offset, bridge, temporal) {
  if (offset + VALUE_BUF_RECORD_LEN > buf.length) {
    throw new Error(
      `@causl/client-ts/wasm: value-buf record truncated at offset ${offset} (need ${VALUE_BUF_RECORD_LEN}, have ${buf.length - offset})`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset + offset, VALUE_BUF_RECORD_LEN);
  const kindByte = view.getUint8(0);
  const lo = view.getUint32(4, true);
  switch (kindByte) {
    case kind.NULL:
      return null;
    case kind.BOOL:
      return lo !== 0;
    case kind.NUMBER:
      return view.getFloat64(4, true);
    case kind.STRING_ID: {
      const resolved = bridge.read_interned_string(lo >>> 0);
      if (resolved === void 0) {
        throw new Error(
          `@causl/client-ts/wasm: value-buf STRING_ID references unknown interned string id ${lo >>> 0} (stale or corrupt record)`
        );
      }
      return resolved;
    }
    case kind.CONTENT_HASH:
    case kind.INPUT_EPOCH:
      return CONTENT_HASH_FROM_CACHE;
    case kind.ARRAY_REF:
    case kind.OBJECT_REF: {
      const bytes = bridge.read_pool_value(lo >>> 0);
      if (bytes === void 0) return null;
      const parsed = JSON.parse(textDecoder.decode(bytes));
      return reviveTagged(parsed, temporal);
    }
    default:
      return null;
  }
}

// wasm/structural-buf.ts
var StructuralDecodeError = class extends Error {
  constructor(message, offset, bufferLength) {
    super(message);
    this.offset = offset;
    this.bufferLength = bufferLength;
  }
  offset;
  bufferLength;
  name = "StructuralDecodeError";
};
var structuralDecodeDebugEnabled = false;
var structuralDecodeDroppedPairs = 0;
function noteUnresolvedPairDrop() {
  if (structuralDecodeDebugEnabled) structuralDecodeDroppedPairs += 1;
}
var NODE_ID_PAIR_LEN = 8;
function snapshotDecodeBuffer(buf) {
  return buf.slice();
}
var STATS_FIELD_COUNT = 7;
function decodeNodeIdPairs(buf, resolve) {
  if (buf.length % NODE_ID_PAIR_LEN !== 0) {
    throw new Error(
      `@causl/client-ts/wasm: node-id-pair buffer length ${buf.length} is not a multiple of the ${NODE_ID_PAIR_LEN}-byte pair width`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = [];
  for (let off = 0; off < buf.length; off += NODE_ID_PAIR_LEN) {
    const slot = view.getUint32(off, true);
    const gen = view.getUint32(off + 4, true);
    const id = resolve(slot, gen);
    if (id !== void 0) out.push(id);
  }
  return out;
}
function decodeCommitLog(buf, bridge, resolve) {
  buf = snapshotDecodeBuffer(buf);
  if (buf.length < 4) {
    throw new Error(
      `@causl/client-ts/wasm: commit-log buffer truncated header (need 4 bytes, got ${buf.length})`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = view.getUint32(0, true);
  let pos = 4;
  const records = [];
  for (let i = 0; i < count; i++) {
    if (pos + VALUE_BUF_RECORD_LEN > buf.length) {
      throw new Error(
        `@causl/client-ts/wasm: commit-log truncated intent record at offset ${pos} (record ${i} of ${count})`
      );
    }
    const decoded = decodeValueRecord(buf, pos, bridge);
    const intent = typeof decoded === "string" ? decoded : decoded === CONTENT_HASH_FROM_CACHE || decoded == null ? "" : String(decoded);
    pos += VALUE_BUF_RECORD_LEN;
    if (pos + 8 > buf.length) {
      throw new Error(
        `@causl/client-ts/wasm: commit-log truncated time at offset ${pos} (record ${i} of ${count})`
      );
    }
    const time = Number(view.getBigUint64(pos, true));
    pos += 8;
    if (pos + 4 > buf.length) {
      throw new Error(
        `@causl/client-ts/wasm: commit-log truncated changed-count at offset ${pos} (record ${i} of ${count})`
      );
    }
    const changedCount = view.getUint32(pos, true);
    pos += 4;
    const changedNodes = [];
    for (let j = 0; j < changedCount; j++) {
      if (pos + NODE_ID_PAIR_LEN > buf.length) {
        throw new Error(
          `@causl/client-ts/wasm: commit-log truncated changed-node tail at offset ${pos} (record ${i}, node ${j} of ${changedCount})`
        );
      }
      const slot = view.getUint32(pos, true);
      const gen = view.getUint32(pos + 4, true);
      pos += NODE_ID_PAIR_LEN;
      const id = resolve(slot, gen);
      if (id !== void 0) changedNodes.push(id);
    }
    records.push({ intent, time, changedNodes });
  }
  return records;
}
var COMMIT_LOG_META_CAP_UNBOUNDED = 4294967295;
function decodeCommitLogMeta(buf, bridge, resolve) {
  buf = snapshotDecodeBuffer(buf);
  if (buf.length < 16) {
    throw new Error(
      `@causl/client-ts/wasm: commit_log_meta buffer truncated header (need 16 bytes, got ${buf.length})`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const capWord = view.getUint32(0, true);
  const cap = capWord === COMMIT_LOG_META_CAP_UNBOUNDED ? void 0 : capWord;
  const totalCommitsEver = Number(view.getBigUint64(4, true));
  const count = view.getUint32(12, true);
  let pos = 16;
  const need = (n, what) => {
    if (pos + n > buf.length) {
      throw new StructuralDecodeError(
        `@causl/client-ts/wasm: commit_log_meta truncated ${what} at offset ${pos} (need ${n} more bytes, have ${buf.length - pos})`,
        pos,
        buf.length
      );
    }
  };
  const records = [];
  for (let i = 0; i < count; i++) {
    need(VALUE_BUF_RECORD_LEN, "commit intent");
    const decoded = decodeValueRecord(buf, pos, bridge);
    const intent = typeof decoded === "string" ? decoded : decoded === CONTENT_HASH_FROM_CACHE || decoded == null ? "" : String(decoded);
    pos += VALUE_BUF_RECORD_LEN;
    need(8, "commit time");
    const time = Number(view.getBigUint64(pos, true));
    pos += 8;
    need(4 + 8, "commit originated_at");
    const origStatus = view.getUint8(pos);
    const origAt = Number(view.getBigUint64(pos + 4, true));
    pos += 4 + 8;
    let originatedAt;
    if (origStatus === EXPORT_ORIGINATED_SOME) {
      originatedAt = origAt;
    } else if (origStatus === EXPORT_ORIGINATED_NONE) {
      originatedAt = void 0;
    } else {
      throw new Error(
        `@causl/client-ts/wasm: commit_log_meta commit carries unknown originated status byte ${origStatus} (expected ${EXPORT_ORIGINATED_NONE} none / ${EXPORT_ORIGINATED_SOME} some)`
      );
    }
    need(4, "commit changed_count");
    const changedCount = view.getUint32(pos, true);
    pos += 4;
    const changedNodes = [];
    for (let j = 0; j < changedCount; j++) {
      need(NODE_ID_PAIR_LEN, "commit changed-node");
      const cSlot = view.getUint32(pos, true);
      const cGen = view.getUint32(pos + 4, true);
      pos += NODE_ID_PAIR_LEN;
      const cId = resolve(cSlot, cGen);
      if (cId !== void 0) changedNodes.push(cId);
      else noteUnresolvedPairDrop();
    }
    records.push({ intent, time, originatedAt, changedNodes });
  }
  if (pos !== buf.length) {
    throw new StructuralDecodeError(
      `@causl/client-ts/wasm: commit_log_meta buffer has ${buf.length - pos} trailing bytes after ${count} records (encoder/decoder drift)`,
      pos,
      buf.length
    );
  }
  return { cap, totalCommitsEver, records };
}
var EXPORT_ORIGINATED_NONE = 0;
var EXPORT_ORIGINATED_SOME = 1;
var EXPORT_EVENT_RECORD_LEN = 16;
function decodeExportModel(buf, bridge, resolve, temporal) {
  buf = snapshotDecodeBuffer(buf);
  if (buf.length < 8) {
    throw new Error(
      `@causl/client-ts/wasm: export_model buffer truncated header (need 8 bytes, got ${buf.length})`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 0;
  const need = (n, what) => {
    if (pos + n > buf.length) {
      throw new StructuralDecodeError(
        `@causl/client-ts/wasm: export_model truncated ${what} at offset ${pos} (need ${n} more bytes, have ${buf.length - pos})`,
        pos,
        buf.length
      );
    }
  };
  const time = Number(view.getBigUint64(pos, true));
  pos += 8;
  const decodeCell = () => {
    need(8 + VALUE_BUF_RECORD_LEN + 4, "export cell header");
    const slot = view.getUint32(pos, true);
    const gen = view.getUint32(pos + 4, true);
    const value = decodeValueRecord(buf, pos + 8, bridge, temporal);
    const depCount = view.getUint32(pos + 8 + VALUE_BUF_RECORD_LEN, true);
    pos += 8 + VALUE_BUF_RECORD_LEN + 4;
    const deps = [];
    for (let j = 0; j < depCount; j++) {
      need(NODE_ID_PAIR_LEN, "export cell dep");
      const dSlot = view.getUint32(pos, true);
      const dGen = view.getUint32(pos + 4, true);
      pos += NODE_ID_PAIR_LEN;
      const depId = resolve(dSlot, dGen);
      if (depId !== void 0) deps.push(depId);
      else noteUnresolvedPairDrop();
    }
    const id = resolve(slot, gen);
    if (id === void 0) {
      noteUnresolvedPairDrop();
      return void 0;
    }
    return { id, value, deps };
  };
  need(4, "input_count");
  const inputCount = view.getUint32(pos, true);
  pos += 4;
  const inputs = [];
  for (let i = 0; i < inputCount; i++) {
    const cell = decodeCell();
    if (cell !== void 0) inputs.push(cell);
  }
  need(4, "derived_count");
  const derivedCount = view.getUint32(pos, true);
  pos += 4;
  const deriveds = [];
  for (let i = 0; i < derivedCount; i++) {
    const cell = decodeCell();
    if (cell !== void 0) deriveds.push(cell);
  }
  need(4, "commit_count");
  const commitCount = view.getUint32(pos, true);
  pos += 4;
  const commits = [];
  for (let i = 0; i < commitCount; i++) {
    need(VALUE_BUF_RECORD_LEN, "commit intent");
    const decoded = decodeValueRecord(buf, pos, bridge);
    const intent = typeof decoded === "string" ? decoded : decoded === CONTENT_HASH_FROM_CACHE || decoded == null ? "" : String(decoded);
    pos += VALUE_BUF_RECORD_LEN;
    need(8, "commit time");
    const cTime = Number(view.getBigUint64(pos, true));
    pos += 8;
    need(4 + 8, "commit originated_at");
    const origStatus = view.getUint8(pos);
    const origAt = Number(view.getBigUint64(pos + 4, true));
    pos += 4 + 8;
    let originatedAt;
    if (origStatus === EXPORT_ORIGINATED_SOME) {
      originatedAt = origAt;
    } else if (origStatus === EXPORT_ORIGINATED_NONE) {
      originatedAt = void 0;
    } else {
      throw new Error(
        `@causl/client-ts/wasm: export_model commit carries unknown originated status byte ${origStatus} (expected ${EXPORT_ORIGINATED_NONE} none / ${EXPORT_ORIGINATED_SOME} some)`
      );
    }
    need(4, "commit changed_count");
    const changedCount = view.getUint32(pos, true);
    pos += 4;
    const changedNodes = [];
    for (let j = 0; j < changedCount; j++) {
      need(NODE_ID_PAIR_LEN, "commit changed-node");
      const cSlot = view.getUint32(pos, true);
      const cGen = view.getUint32(pos + 4, true);
      pos += NODE_ID_PAIR_LEN;
      const cId = resolve(cSlot, cGen);
      if (cId !== void 0) changedNodes.push(cId);
      else noteUnresolvedPairDrop();
    }
    commits.push({ intent, time: cTime, originatedAt, changedNodes });
  }
  need(4, "event_count");
  const eventCount = view.getUint32(pos, true);
  pos += 4;
  const events = [];
  for (let i = 0; i < eventCount; i++) {
    need(EXPORT_EVENT_RECORD_LEN, "export event");
    const slot = view.getUint32(pos, true);
    const gen = view.getUint32(pos + 4, true);
    const subscribedAt = Number(view.getBigUint64(pos + 8, true));
    pos += EXPORT_EVENT_RECORD_LEN;
    const target = resolve(slot, gen);
    if (target !== void 0) events.push({ target, subscribedAt });
    else noteUnresolvedPairDrop();
  }
  if (pos !== buf.length) {
    throw new StructuralDecodeError(
      `@causl/client-ts/wasm: export_model decoded ${pos} of ${buf.length} bytes \u2014 ${buf.length - pos} trailing byte(s) remain after the events section (encoder/decoder drift: a version-skewed encoder appended a section this decoder does not read)`,
      pos,
      buf.length
    );
  }
  return { time, inputs, deriveds, commits, events };
}
function decodeStats(buf) {
  const want = STATS_FIELD_COUNT * 4;
  if (buf.length < want) {
    throw new Error(
      `@causl/client-ts/wasm: stats buffer truncated (need ${want} bytes, got ${buf.length})`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    inputs: view.getUint32(0, true),
    deriveds: view.getUint32(4, true),
    subscribersTotal: view.getUint32(8, true),
    subscribersByNodeKeys: view.getUint32(12, true),
    transientSubscribers: view.getUint32(16, true),
    nodeVersions: view.getUint32(20, true),
    pending: view.getUint32(24, true)
  };
}
var READ_AT_RESULT_RECORD_LEN = 12 + VALUE_BUF_RECORD_LEN;
var READ_AT_STATUS_RETAINED = 0;
var READ_AT_STATUS_EVICTED = 1;
function decodeReadAtResult(buf, bridge, temporal) {
  if (buf.length < READ_AT_RESULT_RECORD_LEN) {
    throw new Error(
      `@causl/client-ts/wasm: read_at_result buffer truncated (need ${READ_AT_RESULT_RECORD_LEN} bytes, got ${buf.length})`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const status = view.getUint8(0);
  const graphTime = Number(view.getBigUint64(4, true));
  if (status === READ_AT_STATUS_EVICTED) {
    return { status: "evicted", oldestRetainedTime: graphTime };
  }
  if (status !== READ_AT_STATUS_RETAINED) {
    throw new Error(
      `@causl/client-ts/wasm: read_at_result carries unknown status byte ${status} (expected ${READ_AT_STATUS_RETAINED} retained / ${READ_AT_STATUS_EVICTED} evicted)`
    );
  }
  const value = decodeValueRecord(buf, 12, bridge, temporal);
  return { status: "retained", value, time: graphTime };
}
function decodeCommitRecord(buf, bridge, resolve) {
  buf = snapshotDecodeBuffer(buf);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 0;
  const need = (n, what) => {
    if (pos + n > buf.length) {
      throw new StructuralDecodeError(
        `@causl/client-ts/wasm: __causl_on_commit truncated ${what} at offset ${pos} (need ${n} more bytes, have ${buf.length - pos})`,
        pos,
        buf.length
      );
    }
  };
  need(VALUE_BUF_RECORD_LEN, "commit intent");
  const decoded = decodeValueRecord(buf, pos, bridge);
  const intent = typeof decoded === "string" ? decoded : decoded === CONTENT_HASH_FROM_CACHE || decoded == null ? "" : String(decoded);
  pos += VALUE_BUF_RECORD_LEN;
  need(8, "commit time");
  const time = Number(view.getBigUint64(pos, true));
  pos += 8;
  need(4 + 8, "commit originated_at");
  const origStatus = view.getUint8(pos);
  const origAt = Number(view.getBigUint64(pos + 4, true));
  pos += 4 + 8;
  let originatedAt;
  if (origStatus === EXPORT_ORIGINATED_SOME) {
    originatedAt = origAt;
  } else if (origStatus === EXPORT_ORIGINATED_NONE) {
    originatedAt = void 0;
  } else {
    throw new Error(
      `@causl/client-ts/wasm: __causl_on_commit record carries unknown originated status byte ${origStatus} (expected ${EXPORT_ORIGINATED_NONE} none / ${EXPORT_ORIGINATED_SOME} some)`
    );
  }
  need(4, "commit changed_count");
  const changedCount = view.getUint32(pos, true);
  pos += 4;
  const changedNodes = [];
  for (let j = 0; j < changedCount; j++) {
    need(NODE_ID_PAIR_LEN, "commit changed-node");
    const slot = view.getUint32(pos, true);
    const gen = view.getUint32(pos + 4, true);
    pos += NODE_ID_PAIR_LEN;
    const id = resolve(slot, gen);
    if (id !== void 0) changedNodes.push(id);
    else noteUnresolvedPairDrop();
  }
  if (pos !== buf.length) {
    throw new StructuralDecodeError(
      `@causl/client-ts/wasm: __causl_on_commit decoded ${pos} of ${buf.length} bytes \u2014 ${buf.length - pos} trailing byte(s) remain after the changed-node tail (encoder/decoder drift: a version-skewed encoder appended a section this decoder does not read)`,
      pos,
      buf.length
    );
  }
  return { time, intent, originatedAt, changedNodes };
}
var fireBatchTextDecoder = new TextDecoder();
function decodeFireBatch(buf) {
  if (buf.length < 4) return [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const count = view.getUint32(0, true);
  let pos = 4;
  const truncated = (i, n, what) => {
    throw new StructuralDecodeError(
      `@causl/client-ts/wasm: __causl_fire batch truncated ${what} at offset ${pos} (record ${i} of ${count}; need ${n} more bytes, have ${buf.length - pos}) \u2014 encoder/decoder drift`,
      pos,
      buf.length
    );
  };
  const records = [];
  for (let i = 0; i < count; i++) {
    if (pos + 12 > buf.length) truncated(i, 12, "record header");
    const nodeSlot = view.getUint32(pos + 4, true);
    const nodeGen = view.getUint32(pos + 8, true);
    pos += 12;
    if (pos + 4 > buf.length) truncated(i, 4, "observer length");
    const observerLen = view.getUint32(pos, true);
    pos += 4;
    if (pos + observerLen > buf.length) truncated(i, observerLen, "observer id");
    const observerId = fireBatchTextDecoder.decode(
      buf.subarray(pos, pos + observerLen)
    );
    pos += observerLen;
    if (pos + VALUE_BUF_RECORD_LEN > buf.length)
      truncated(i, VALUE_BUF_RECORD_LEN, "value record");
    const valueOffset = pos;
    pos += VALUE_BUF_RECORD_LEN;
    records.push({ nodeSlot, nodeGen, observerId, valueOffset });
  }
  return records;
}
var NODE_META_RECORD_LEN = 4 + 8 + 8;
var NODE_META_KIND_INPUT = 0;
var NODE_META_KIND_DERIVED = 1;
var NODE_META_KIND_MISSING = 2;
function decodeNodeMeta(buf) {
  if (buf.length < NODE_META_RECORD_LEN) {
    throw new Error(
      `@causl/client-ts/wasm: node_meta buffer truncated (need ${NODE_META_RECORD_LEN} bytes, got ${buf.length})`
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const kindByte = view.getUint8(0);
  const computedAt = Number(view.getBigUint64(4, true));
  const contributedAt = Number(view.getBigUint64(12, true));
  const kind2 = kindByte === NODE_META_KIND_INPUT ? "input" : kindByte === NODE_META_KIND_DERIVED ? "derived" : kindByte === NODE_META_KIND_MISSING ? "missing" : void 0;
  if (kind2 === void 0) {
    throw new Error(
      `@causl/client-ts/wasm: node_meta carries unknown kind byte ${kindByte} (expected ${NODE_META_KIND_INPUT} input / ${NODE_META_KIND_DERIVED} derived / ${NODE_META_KIND_MISSING} missing)`
    );
  }
  return { kind: kind2, computedAt, contributedAt };
}

// wasm/diff-buf.ts
var tag = {
  NODE_ADDED: 1,
  NODE_DISPOSED: 2,
  COMMITTED: 3,
  NODE_CHANGED: 4,
  SUBSCRIBER_FIRED: 5,
  DERIVED_RECOMPUTED: 6,
  ERROR: 7,
  SNAPSHOT: 8,
  // gap-1 (causl-wasm#169) — per-write §12 change-token column emitted
  // AFTER a commit's Committed + NodeChanged trail. Decoded to `unknown`
  // and discarded today (an internal wasm→JS transport detail); the
  // constant pins the tag so the sentinel-escape skip + tests can name
  // it. Mirrors `diff_encoder::tag::CHANGE_TOKENS`.
  CHANGE_TOKENS: 9,
  // causl-wasm#286 (#223 follow-up) — the value-payload-gated sibling of
  // tag-6 `DerivedRecomputed`. A Phase-D drain iteration whose derived
  // value did NOT change and whose dep set did NOT flip (the B.4
  // cutoff-skip / SameValue arm) emits this lean record in place of the
  // full tag-6 row: a fixed 12-byte payload carrying only the step-trace
  // triple (`step_index | node_slot | node_gen`), with NO value_before /
  // value_after columns and NO dep-delta columns. Mirrors
  // `diff_encoder::tag::DERIVED_UNCHANGED`.
  DERIVED_UNCHANGED: 10
};
function decodeDiff(buf) {
  const records = [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 0;
  while (pos < buf.length) {
    if (buf.length - pos < 4) {
      throw new Error(
        `@causl/client-ts/wasm: diff-buf truncated header at offset ${pos} (need 4 bytes, got ${buf.length - pos})`
      );
    }
    const recordTag = view.getUint16(pos, true);
    const rawLen = view.getUint16(pos + 2, true);
    const PAYLOAD_LEN_ESCAPE_SENTINEL2 = 65535;
    let payloadLen;
    let headerLen;
    if (rawLen === PAYLOAD_LEN_ESCAPE_SENTINEL2) {
      if (buf.length - pos < 8) {
        throw new Error(
          `@causl/client-ts/wasm: diff-buf truncated escaped header at offset ${pos} (need 8 bytes for the 0xFFFF sentinel + u32 extended_len, got ${buf.length - pos})`
        );
      }
      payloadLen = view.getUint32(pos + 4, true);
      headerLen = 8;
    } else {
      payloadLen = rawLen;
      headerLen = 4;
    }
    const after = pos + headerLen;
    if (after + payloadLen > buf.length) {
      throw new Error(
        `@causl/client-ts/wasm: diff-buf truncated payload at offset ${pos} (tag=${recordTag}, declared=${payloadLen}, available=${buf.length - after})`
      );
    }
    const payload = buf.subarray(after, after + payloadLen);
    const pView = new DataView(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength
    );
    switch (recordTag) {
      case tag.COMMITTED:
        records.push({
          kind: "committed",
          time: pView.getBigUint64(0, true),
          // Offset 8: opaque numeric commit ordinal, NOT a StringId
          // (causl-wasm#239). Wire bytes unchanged — name-only fix.
          intentId: pView.getUint32(8, true),
          nChanges: pView.getUint32(12, true)
        });
        break;
      case tag.NODE_CHANGED:
        records.push({
          kind: "nodeChanged",
          slot: pView.getUint32(0, true),
          gen: pView.getUint32(4, true),
          valueKind: pView.getUint32(8, true),
          payload: payload.slice(12)
        });
        break;
      case tag.NODE_DISPOSED:
        records.push({
          kind: "nodeDisposed",
          slot: pView.getUint32(0, true),
          gen: pView.getUint32(4, true)
        });
        break;
      case tag.DERIVED_RECOMPUTED: {
        const stepIndex = pView.getUint32(0, true);
        const slot = pView.getUint32(4, true);
        const gen = pView.getUint32(8, true);
        const before = payload.slice(12, 24);
        const after2 = payload.slice(24, 36);
        const addedCount = pView.getUint16(36, true);
        const removedCount = pView.getUint16(38, true);
        const declaredDepBytes = 40 + 8 * (addedCount + removedCount);
        if (declaredDepBytes > payloadLen) {
          throw new Error(
            `@causl/client-ts/wasm: diff-buf truncated DerivedRecomputed record at offset ${pos} (added=${addedCount}, removed=${removedCount} declare ${declaredDepBytes} payload bytes, available=${payloadLen})`
          );
        }
        const depsAdded = [];
        let off = 40;
        for (let i = 0; i < addedCount; i++) {
          depsAdded.push({
            slot: pView.getUint32(off, true),
            gen: pView.getUint32(off + 4, true)
          });
          off += 8;
        }
        const depsRemoved = [];
        for (let i = 0; i < removedCount; i++) {
          depsRemoved.push({
            slot: pView.getUint32(off, true),
            gen: pView.getUint32(off + 4, true)
          });
          off += 8;
        }
        records.push({
          kind: "derivedRecomputed",
          stepIndex,
          slot,
          gen,
          before,
          after: after2,
          depsAdded,
          depsRemoved
        });
        break;
      }
      case tag.DERIVED_UNCHANGED: {
        if (payloadLen !== 12) {
          throw new Error(
            `@causl/client-ts/wasm: diff-buf malformed DerivedUnchanged record at offset ${pos} (declared ${payloadLen} payload bytes, expected the fixed 12)`
          );
        }
        records.push({
          kind: "derivedUnchanged",
          stepIndex: pView.getUint32(0, true),
          slot: pView.getUint32(4, true),
          gen: pView.getUint32(8, true)
        });
        break;
      }
      case tag.ERROR:
        records.push({
          kind: "error",
          code: pView.getUint16(0, true),
          // _pad u16 at offset 2 — skipped
          slot: pView.getUint32(4, true),
          messageStringId: pView.getUint32(8, true)
        });
        break;
      default:
        records.push({
          kind: "unknown",
          tag: recordTag,
          payload: payload.slice(0)
        });
        break;
    }
    pos = after + payloadLen;
  }
  return records;
}
function findCommitted(records) {
  for (const r of records) if (r.kind === "committed") return r;
  return void 0;
}
function findChangedNodes(records) {
  return records.filter(
    (r) => r.kind === "nodeChanged"
  );
}
function findRecomputed(records) {
  return records.filter(
    (r) => r.kind === "derivedRecomputed"
  );
}
function findUnchanged(records) {
  return records.filter(
    (r) => r.kind === "derivedUnchanged"
  );
}

// wasm/authoritative.ts
var COMMIT_IN_PROGRESS_VERDICT_TOKEN = /^apply_commands error: Engine\(CommitInProgress\b/;
var COMPUTE_THREW_VERDICT_TOKEN = /^apply_commands error: Engine\(ComputeThrew\b/;
var CYCLE_CLOSED_VERDICT_TOKEN = /^apply_commands error: Engine\(CycleClosed\b/;
function classifyEngineVerdict(err) {
  if (!(err instanceof Error)) return "other";
  if (COMMIT_IN_PROGRESS_VERDICT_TOKEN.test(err.message))
    return "commit-in-progress";
  if (COMPUTE_THREW_VERDICT_TOKEN.test(err.message)) return "compute-threw";
  if (CYCLE_CLOSED_VERDICT_TOKEN.test(err.message)) return "cycle-closed";
  return "other";
}
function parseCycleClosedPath(message, resolve) {
  const path = [];
  const re = /slot:\s*(\d+)\s*,\s*gen:\s*(\d+)/g;
  let m;
  while ((m = re.exec(message)) !== null) {
    const id = resolve(Number(m[1]), Number(m[2]));
    if (id !== void 0) path.push(id);
  }
  return path;
}
var lastRawEngineVerdict;
var STATUS_OK = 0;
var STATUS_THREW = 1;
var DEFAULT_ENGINE_ID = 0;
var INTERNAL_SEED_INTENT = "__seed";
function isInternalCommitIntent(intent) {
  return intent === INTERNAL_SEED_INTENT;
}
var nextEngineId = DEFAULT_ENGINE_ID;
var poisonedBridges = /* @__PURE__ */ new WeakSet();
function isWasmTrap(err) {
  return typeof WebAssembly !== "undefined" && typeof WebAssembly.RuntimeError === "function" && err instanceof WebAssembly.RuntimeError;
}
var textDecoder2 = new TextDecoder();
var AuthoritativeWasmEngine = class _AuthoritativeWasmEngine {
  #bridge;
  #imports;
  /**
   * NodeId → stable `(slot, gen, isInput)` handle.
   *
   * SLOT DISCIPLINE (register_derived_p1.rs §"separate Vecs"): inputs and
   * deriveds live in SEPARATE engine Vecs but BOTH index by the raw slot
   * integer, so a slot can be both an input index and a derived index.
   * The cell-id tiebreaker in `read_during_recompute` / `get_value`
   * matches on the FULL generational `NodeId`, so an input and a derived
   * that collide on a slot are disambiguated by GENERATION. We therefore
   * mint inputs from one counter at gen 0 and deriveds from an
   * INDEPENDENT counter at gen 1 — a derived NodeId can never equal an
   * input NodeId, so the phantom default cells the engine's auto-extend
   * creates never shadow a real input dep (the cutover derived-deps bug).
   */
  #slots = /* @__PURE__ */ new Map();
  /**
   * #165 — the REVERSE index of {@link #slots}: `${slot}:${gen}` -> NodeId.
   * The commit / fire / observer-error decode paths resolve a
   * Rust-reported `(slot, gen)` pair back to its NodeId through this map
   * ({@link #slotToIdIndex}). It was rebuilt O(N) from scratch on every
   * lookup, up to four times per commit; I now maintain it INCREMENTALLY
   * in lockstep with `#slots` (one `set` on registration, one `delete` on
   * disposal), so a lookup is O(1) and a commit does zero rebuild work. A
   * `(slot, gen)` key is unique per live entry (input slots carry gen 0,
   * derived slots {@link DERIVED_GEN} = 1, and each class draws slots from
   * its own monotonic counter), so this stays equivalent to the old full
   * rebuild's last-write-wins Map.
   */
  #slotToId = /* @__PURE__ */ new Map();
  #nextInputSlot = 0;
  #nextDerivedSlot = 0;
  #nextIntentId = 0;
  #nextFnId = 0;
  /** The generation deriveds are minted at (distinct from inputs' gen 0). */
  static DERIVED_GEN = 1;
  /** fn_id → derived registration (compute lambda + deps). */
  #fnTable = /* @__PURE__ */ new Map();
  /** derived slot → registration (for the fire/read deps-order mapping). */
  #derivedBySlot = /* @__PURE__ */ new Map();
  /**
   * del-final (causl/causl-core-rs#170) — the explain `via`-tag a derived was
   * registered with (`'live'` for a hot-swappable devtools node so `explain`
   * reports `via: 'live'`; `'commit-metadata'` for a Phase-F.5 metadata
   * derived). A devtools REGISTRATION attribute the Rust engine core does NOT
   * retain — this backend (which survives the §18A.3 TS-engine deletion) holds
   * it so {@link nodeMeta} can resolve `via` without the TS `entries` map.
   * Plain `derived(...)` callers are absent here → `via: 'derived'`.
   */
  #derivedTags = /* @__PURE__ */ new Map();
  /**
   * causl-client#103 — dynamic-dep rewires discovered during a commit's
   * Phase-D recompute, keyed by derived NodeId → the new first-read-ordered
   * dep set. Populated by `#onCompute` when a recompute's tracked read set
   * diverges from the registered dep list, and drained in {@link commit}
   * once the `apply_commands` window has closed (re-registering inside it
   * would re-enter the commit). Empty between commits.
   */
  #pendingRewires = /* @__PURE__ */ new Map();
  /**
   * causl-client#120 — the typed error captured host-side when a derived's
   * `__causl_compute` lambda threw. The compute runs in JS (behind the
   * `__causl_compute` FFI import), so `#onCompute` has the REAL thrown
   * object; only its Display string survives the crossing back through Rust
   * as the `Engine(ComputeThrew { reason })` verdict. `#onCompute` stashes
   * the normalised typed error here (via {@link asDerivedComputeError}) and
   * {@link #applyCommands} rethrows it when the matching verdict crosses
   * back — so the original throw surfaces as `cause` on a
   * {@link DerivedComputeError} (or the engine's own `CauslError`),
   * byte-identical to the TS floor, WITHOUT a Rust wire change. Cleared at
   * the start of every `apply_commands` and after it is consumed.
   */
  #pendingComputeThrow = void 0;
  /** NodeId → observer set (Phase-G subscriber bridge). */
  #observers = /* @__PURE__ */ new Map();
  /**
   * lift-subscribecommits (causl-wasm#170) — the commit-LEVEL observer set
   * (Phase-H). Fed by the Rust `__causl_on_commit` crossing once per commit
   * (after the Phase-G per-node firing), distinct from the per-NODE
   * `#observers`. Registration order is preserved (insertion-ordered `Set`),
   * so the fan-out matches the TS `commitObservers` dispatch order.
   */
  #commitObservers = /* @__PURE__ */ new Set();
  /**
   * pre-fire (causl-wasm#189/#190) — the SINGLE pre-fire changed-set
   * observer (the `graph.ts` facade's nodeVersion union-bump hook). Fed by
   * the Rust `__causl_pre_fire` crossing once per commit BEFORE the first
   * Phase-G observer byte, with the commit's authoritative changed-set
   * NodeIds. One slot, not a fan: the facade is the only consumer, and the
   * bump must run exactly once per commit.
   */
  #preFireObserver;
  /**
   * gap-5 (causl-wasm#169; causl-client#102) — the SINGLE observer-error
   * sink (the `graph.ts` facade's `reportObserverError` hook). Fed by the
   * Rust `__causl_on_observer_error` crossing once per surfaced Phase-G
   * `ObserverError`, with the decoded `(error, ctx)` reconstructed from the
   * §5.5 single-error wire record. One slot, not a fan: the facade is the
   * only consumer, and it re-fans to the adopter's `onObserverError`.
   */
  #observerErrorObserver;
  /** Per-NodeId synthesised callback-id used in the Subscribe cmd record. */
  #callbackIds = /* @__PURE__ */ new Map();
  #nextCallbackId = 1;
  /** Monotonic clock, advanced from the wasm Committed diff record. */
  #now = 0;
  /**
   * #78 — the accepted-hydrate breadcrumb: commit `time` → the snapshot
   * envelope's recorded time (`originatedAt`). LEGACY-ARTEFACT FALLBACK
   * ONLY since #129: a #318-era artefact persists `originated_at`
   * engine-side (the widened 16-byte `BeginCommit` body), so the
   * `commit_log_meta` / `export_model` wires carry the breadcrumb and this
   * map stays EMPTY (never written, never grows). On a legacy artefact
   * (no `commit_log_meta` extern, so no widened `BeginCommit` decode) the
   * pre-#129 behaviour is preserved: {@link hydrate} records the accepted
   * commit's `time → originatedAt` here and the backend-sourced mouths
   * ({@link #onCommit} Phase-H delivery, {@link exportModel}) stamp it
   * from this map, keeping them byte-identical to the TS reference's
   * hydrate-issued records. Written only on the ACCEPTED path (a rejected
   * hydrate records nothing).
   */
  #hydrateOriginatedAt = /* @__PURE__ */ new Map();
  /**
   * #129 / causl/causl-core-rs#318 — the adopter `commitHistoryCap` LAST
   * threaded onto the engine's commit-log eviction horizon via
   * {@link setCommitHistoryCap} (the `SetCommitLogCap` cmd-buf op).
   * `undefined` until the facade threads it; {@link ownsCommitLog} arms
   * only once it is set, so the engine ring and the adopter-facing
   * `commitLog` window provably share ONE horizon before the facade
   * re-sources the log from here.
   */
  #commitLogCap;
  /**
   * #252 / causl/causl-core-rs#321+#323 — the EFFECTIVE retention window
   * LAST threaded onto the engine's retention chain via
   * {@link setSnapshotRetentionCap} (the `SetSnapshotRetentionCap` cmd-buf
   * op, batched atomically with the `RetainDerivedRows` opt-in).
   * `undefined` until the facade threads it — or forever, on a legacy
   * artefact whose decoder rejects ops 14/15 ({@link ownsRetention} then
   * stays `false` and the facade keeps the TS floor's retention
   * byte-identically, fail-safe).
   */
  #snapshotRetentionCap;
  /**
   * #129 — the PUBLISHED adopter-facing commitLog window (frozen
   * `readonly Commit[]`, oldest-first), maintained copy-on-write so the
   * facade's Phase-F.4 refresh never re-decodes the engine wire per
   * commit. `undefined` until the first {@link commitLogWindow} read
   * materialises it (zero per-commit cost for a graph with no commitLog
   * consumer); {@link commit} appends the just-accepted row when the
   * cache is fresh through the previous clock tick and drops it
   * otherwise (a cold reader then re-decodes the wire). Each append
   * allocates a FRESH frozen array, so a window published to a
   * subscriber is never mutated under it.
   */
  #commitLogWindowCache;
  /** #129 — the engine time {@link #commitLogWindowCache} is fresh through. */
  #commitLogWindowFreshAt = 0;
  /**
   * #78 — the IN-FLIGHT hydrate's `originatedAt`. Set for the duration of
   * {@link hydrate}'s `commit('hydrate', …)` call so the Phase-H
   * `__causl_on_commit` crossing (which fires DURING `apply_commands`,
   * before the {@link #hydrateOriginatedAt} entry exists) can stamp the
   * delivered {@link Commit}. `undefined` at every other moment; nested
   * same-engine commits cannot interleave (the #178 commit-window guard
   * rejects them before touching state).
   */
  #pendingHydrateOriginatedAt;
  /**
   * The tag-6 `DerivedRecomputed` sextuple trace from the MOST RECENT
   * `commit()` — the authoritative Rust Phase-D Kahn drain, projected
   * onto NodeId strings. Read by {@link collectRustPhaseDTrace} for the
   * B.8 cross-bridge gate. Replaced wholesale every commit (the gate
   * drives one isolating commit, then reads).
   */
  #lastPhaseDTrace = [];
  /** Whether the compute/fire handlers have been installed. */
  #handlersInstalled = false;
  /**
   * mux-5 (causl-client#42) — this engine's stable id, minted from the
   * module-level {@link nextEngineId} allocator at construction. Threaded
   * through every `apply_commands(engine_id, …)` / `read_cell_value(engine_id,
   * …)` call, stamped into the Subscribe cmd records, and used as the
   * `Map<engineId, handler>` key the mux-6 sidecar dispatches on. Distinct per
   * live engine, so N engines coexist on the ONE shared wasm instance with no
   * cross-talk (mux-6b/mux-7/mux-8 — the #143 at-most-one guard is retired).
   */
  #engineId;
  /**
   * promote-read (causl/causl-core-rs#169) — this engine's canonicality mode,
   * threaded from {@link WasmBackend} (`'js-ssot'` default | `'rust-ssot'`).
   * The READ-SIDE structural facade (`dependencies` / `dependents` /
   * `commitLog` / `stats`) in `graph.ts` consults THIS engine's structural
   * reads ONLY when this is `'rust-ssot'`; under `'js-ssot'` the facade stays
   * byte-identical on the TS closure (the V2.1 #1522 oracle invariant). Stored
   * here so the facade gate is a single field read, not a cross-module hop.
   */
  #engineMode;
  /**
   * NodeId → current JS value cache. See {@link ValueHandleCache}.
   * Populated when the engine HOLDS the original JS value — on input
   * commit and on a derived's compute result — and served on `read()`,
   * on Phase-D dep resolution, and on Phase-G firing.
   *
   * AUTHORITATIVE for container values (feat/content-hash-values). The
   * engine now stores only a structural content-HASH for a container cell
   * (Array/Object), never the value itself, so the container value can
   * ONLY come from this cache — a miss is unrecoverable for a container.
   * The cache is therefore non-evicting for live (registered, non-
   * disposed) cells: capacity is unbounded so a live cell's value never
   * ages out. The live-cell set is bounded by the graph's node count
   * (exactly the values the JS engine would hold anyway). Scalars
   * (number/string/bool/null) still round-trip through the engine
   * losslessly, so a scalar cache miss remains safe; only the container
   * path depends on cache authority. Cleared on the value-pool reset (a
   * fresh engine — `__resetValuePool` in `__enableAuthoritativeWasm`),
   * which also resets the wasm side, keeping the two in lockstep.
   */
  #valueCache = new ValueHandleCache(Number.MAX_SAFE_INTEGER);
  /**
   * #165 — the PER-ENGINE Temporal impl, snapshotted from the module-level
   * `setTemporalImpl` injection at CONSTRUCTION time and threaded through
   * every value decode this engine performs. Two engines constructed in
   * one realm, each injecting its own impl before its own construction
   * (the documented `setTemporalImpl` contract), therefore decode with
   * THEIR impl: a later injection for engine B no longer rewrites what
   * engine A reconstructs `Temporal.*` values with. `undefined` when
   * nothing was injected at construction — the decode then falls back to
   * the LIVE module-level injection, then `globalThis.Temporal`, so a
   * legacy late injection still takes effect (module-scoped, noted on
   * #165 as the residual sharing).
   */
  #temporal = currentTemporalImpl();
  /**
   * Per-input-node `Object.is` change-token state (SPEC §5.1 Phase B). For
   * each INPUT node that has carried a container value, holds the last
   * committed JS reference and a monotonic epoch counter. On commit the
   * epoch bumps ONLY when `!Object.is(prevRef, nextRef)`; the interned
   * marker (`inputEpochMarker(slot, epoch)`) is then identical for a
   * same-reference write (no-op) and distinct for a new reference
   * (propagate) — matching causl-ts's input cutoff exactly, in O(1)
   * instead of the O(rows) structural content-hash. DERIVED container
   * results keep the structural hash (SPEC §15.1). Reset in lockstep with
   * `#valueCache` (fresh engine / value-pool reset).
   */
  #inputEpoch = /* @__PURE__ */ new Map();
  /**
   * #72 — the commit-window mirror journal. `commit()` opens one before
   * staging its writes and closes it in its `finally`; while open, every
   * {@link #cacheSet} records the id's PRIOR cache entry (or the MISS
   * sentinel) on first overwrite. When `apply_commands` throws — the
   * engine rolled the commit back byte-identically per SPEC §5.2 — the
   * catch arm replays the journal so the JS mirror (`#valueCache`) rolls
   * back the same way, instead of serving the never-committed value.
   * Saved/restored around nested windows (a re-entrant `commit()` from a
   * notification frame journals into its OWN map; the outer journal
   * survives for the outer catch). `undefined` outside any commit window
   * — non-commit cache writes (registration seeds, read fills) are
   * unjournaled by design: they mirror already-committed engine state.
   */
  #cacheJournal = void 0;
  /**
   * #72 — write-through to `#valueCache` that records the prior entry in
   * the open commit-window journal (first-overwrite-wins), so a rejected
   * commit can restore the exact pre-commit mirror. Outside a commit
   * window this is a plain `#valueCache.set`.
   */
  #cacheSet(id, value) {
    const journal = this.#cacheJournal;
    if (journal !== void 0 && !journal.has(id)) {
      journal.set(id, this.#valueCache.get(id));
    }
    this.#valueCache.set(id, value);
  }
  /**
   * cw#181+#182+#184 re-vendor — the commit time IN FLIGHT while this
   * engine's `apply_commands` commit window is open, `undefined` outside
   * one. `#now` mirrors the LAST decoded commit time and only advances
   * after `apply_commands` returns (the diff decode at the bottom of
   * {@link commit}), but Phase-G observer delivery (`__causl_fire`) and
   * any in-dispatch `subscribe()` initial fire happen DURING the window
   * — the TS reference stamps those with the POST-Phase-C clock (the
   * commit's own time). With GraphTime now owned exclusively by commits
   * (§5.1 — causl-wasm#180/#183: no lifecycle op ticks), the in-flight
   * time is exactly `#now + 1`. Saved at {@link commit} entry and
   * restored in its `finally` (#116, mirroring `#cacheJournal`): a
   * same-engine nested `commit()` from an outer commit's notification
   * frame IS re-entered here and rejects INSIDE its own window at the
   * causl-wasm#178 `apply_commands` guard — its `finally` must restore
   * the outer window's stamp, not null it, or the outer commit's
   * remaining Phase-G firings read the settled (past) `#now`.
   */
  #inFlightTime = void 0;
  /**
   * The adopter-visible clock for observer delivery: the in-flight
   * commit time while this engine's commit window is open (Phase-G
   * fires, in-dispatch subscribe initial fires), else the settled
   * `#now`. Byte-identical to the TS reference's `now` at every
   * delivery seam.
   */
  #liveNow() {
    return this.#inFlightTime ?? this.#now;
  }
  constructor(bridge, imports, engineMode = "js-ssot") {
    this.#bridge = bridge;
    this.#imports = imports;
    this.#engineMode = engineMode;
    this.#engineId = nextEngineId;
    nextEngineId += 1;
    this.#installHandlers();
  }
  /** mux-5 — this engine's minted id (test/diagnostic surface). @internal */
  get engineId() {
    return this.#engineId;
  }
  /**
   * #111 — `true` once {@link dispose} has torn this engine down (its
   * per-`engineId` handler registrations removed from the sidecar). Idempotent
   * teardown reads this; also a test/diagnostic surface.
   *
   * @internal
   */
  get disposed() {
    return !this.#handlersInstalled;
  }
  /**
   * #111 — the sidecar handler module this engine's compute/fire/commit
   * handlers are registered in. Exposed so the lifecycle gate can drive the
   * sidecar's `__causl_compute` dispatch directly (the SAME singleton the
   * engine registered into) to prove a disposed engine's registration is gone.
   *
   * @internal test seam.
   */
  get __sidecarForTests() {
    return this.#imports;
  }
  /**
   * #115 — the shared per-wasm-instance intern table this engine's cmd-buf
   * writes route through. Exposed so a retention test can probe the
   * monotonic `intern_string` id (an opaque, never-recycled handle) before
   * and after a workload to prove steady-state intern growth is bounded for
   * a bounded-live-state graph (an epoch/content-hash marker must not mint
   * one immortal interned string per commit).
   *
   * @internal test seam.
   */
  get __bridgeForTests() {
    return this.#bridge;
  }
  /**
   * promote-read (causl/causl-core-rs#169) — this engine's canonicality mode.
   * The `graph.ts` read-side structural facade reads this to decide whether
   * to route `dependencies` / `dependents` / `commitLog` / `stats` through
   * THIS engine's Rust externs (`'rust-ssot'`) or stay on the TS closure
   * (`'js-ssot'`, byte-identical).
   */
  get engineMode() {
    return this.#engineMode;
  }
  /**
   * Clear the value-handle cache (the value-pool reset / bridge reset).
   * A miss is always safe (falls back to `read_pool_value`), so this only
   * costs a later parse — never corrupts.
   *
   * @internal
   */
  __resetValueCache() {
    this.#valueCache.clear();
    this.#inputEpoch.clear();
  }
  get now() {
    return this.#now;
  }
  // ====================================================================
  // Slot allocation
  // ====================================================================
  #slotFor(id, isInput) {
    let entry = this.#slots.get(id);
    if (entry === void 0) {
      if (isInput) {
        entry = { slot: this.#nextInputSlot, gen: 0, isInput: true };
        this.#nextInputSlot += 1;
      } else {
        entry = {
          slot: this.#nextDerivedSlot,
          gen: _AuthoritativeWasmEngine.DERIVED_GEN,
          isInput: false
        };
        this.#nextDerivedSlot += 1;
      }
      this.#slots.set(id, entry);
      this.#slotToId.set(`${entry.slot}:${entry.gen}`, id);
    }
    return entry;
  }
  /** Look up an existing slot, or `undefined` if the id is unregistered. */
  #lookupSlot(id) {
    return this.#slots.get(id);
  }
  // ====================================================================
  // Derived registration (Phase-D fn-table binding)
  // ====================================================================
  /**
   * Register a derived node: mint its slot, emit a `RegisterDerived`
   * cmd-buf record (binding `fn_id` + dep slots in the engine) and bind
   * the JS compute lambda in the fn-table the `__causl_compute` import
   * dispatches to.
   *
   * `deps` is the ORDERED dependency list — the engine drives Phase-D in
   * this order and passes dep values to `__causl_compute` in the same
   * order, so the compute lambda maps each dep value back to its NodeId
   * positionally.
   */
  registerDerived(id, deps, compute, tag2) {
    if (tag2 !== void 0) this.#derivedTags.set(id, tag2);
    const derivedEntry = this.#slotFor(id, false);
    const depHandles = deps.map((dep) => {
      const existing = this.#slots.get(dep);
      const handle = existing ?? this.#slotFor(dep, true);
      return { dep, slot: handle.slot, gen: handle.gen };
    });
    const fnId = this.#nextFnId;
    this.#nextFnId += 1;
    const registration = {
      id,
      slot: derivedEntry.slot,
      gen: derivedEntry.gen,
      fnId,
      deps,
      compute
    };
    this.#fnTable.set(fnId, registration);
    this.#derivedBySlot.set(derivedEntry.slot, registration);
    const cmdBuf = encodeRegisterDerived(
      derivedEntry.slot,
      derivedEntry.gen,
      fnId,
      depHandles.map((d) => ({ slot: d.slot, gen: d.gen }))
    );
    const diffBuf = this.#applyCommands(cmdBuf);
    decodeDiff(diffBuf);
    try {
      const value = compute((depId) => this.read(depId));
      this.#cacheSet(id, value);
    } catch {
    }
  }
  // ====================================================================
  // Authoritative commit
  // ====================================================================
  /**
   * Drive `apply_commands` against THIS engine's registry slot, decoding
   * the structured engine race verdict the bridge throws
   * (causl/causl-core-rs#178) into the SAME typed error the TS reference
   * engine raises — so the two backends are type-identical at the
   * adopter boundary. The one decodable verdict today is
   * `Engine(CommitInProgress)`: a same-engine re-entrant
   * `apply_commands` inside its own commit/notification frame (SPEC
   * §5.1 / E.6 option (a)) surfaces as {@link CommitInProgressError},
   * byte-identical to the TS engine's same-graph re-entrancy throw
   * (`graph.ts` `commitInternal`'s `committing` guard). Any other throw
   * (malformed cmd-buf, wiring bug) rethrows untouched.
   */
  /**
   * #127 — fail loud if this engine's shared wasm instance has been poisoned
   * by a prior trap. The poison is instance-scoped ({@link poisonedBridges}
   * keys on the bridge object), so this fails EVERY engine multiplexed on a
   * poisoned instance, not just the one that trapped. Throws a fresh
   * {@link WasmInstancePoisonedError} with no `cause` (the original trap's
   * `cause` rode on the throw from the engine that trapped).
   */
  #assertInstanceLive() {
    if (poisonedBridges.has(this.#bridge)) {
      throw new WasmInstancePoisonedError();
    }
  }
  #applyCommands(cmdBuf, entry = (engine_id, cmd_buf) => this.#bridge.apply_commands(engine_id, cmd_buf)) {
    this.#assertInstanceLive();
    this.#pendingComputeThrow = void 0;
    try {
      return entry(this.#engineId, cmdBuf);
    } catch (err) {
      if (isWasmTrap(err)) {
        this.#pendingComputeThrow = void 0;
        poisonedBridges.add(this.#bridge);
        throw new WasmInstancePoisonedError(err);
      }
      if (err instanceof Error) lastRawEngineVerdict = err.message;
      const verdict = classifyEngineVerdict(err);
      if (verdict === "commit-in-progress") {
        this.#pendingComputeThrow = void 0;
        throw new CommitInProgressError();
      }
      if (verdict === "cycle-closed" && err instanceof Error) {
        this.#pendingComputeThrow = void 0;
        throw new CycleError(
          parseCycleClosedPath(err.message, this.#slotGenResolver())
        );
      }
      if (verdict === "compute-threw" && err instanceof Error) {
        const stashed = this.#pendingComputeThrow;
        this.#pendingComputeThrow = void 0;
        if (stashed !== void 0) throw stashed;
        if (err.message.includes(UNDECLARED_DEPENDENCY_MARKER)) {
          const m = err.message.match(
            /derived '([^']*)' read dependency '([^']*)'/
          );
          throw new UndeclaredDependencyError(
            m?.[1] ?? "",
            m?.[2] ?? ""
          );
        }
      }
      this.#pendingComputeThrow = void 0;
      throw err;
    }
  }
  /**
   * Stage a writes map into the per-(slot, gen) shape `buildCommitCmdBuf`
   * consumes, mirroring the values into `#valueCache` (journaled — the
   * caller's `#cacheJournal` window is already open) and minting the
   * per-(slot, epoch) container change tokens (journaled first-bump-wins
   * into `epochJournal`). Shared verbatim between the live {@link commit}
   * and the {@link simulate} dry-run so the two encode byte-identical
   * cmd-bufs from the same writes.
   */
  #stageWrites(writes, epochJournal) {
    const slotWrites = /* @__PURE__ */ new Map();
    for (const [id, rawValue] of writes) {
      const value = rawValue === void 0 ? null : rawValue;
      const entry = this.#slotFor(id, true);
      let containerMarker;
      if (value !== null && typeof value === "object") {
        const prev = this.#inputEpoch.get(id);
        let epoch;
        if (prev === void 0 || !Object.is(prev.ref, value)) {
          if (!epochJournal.has(id)) epochJournal.set(id, prev);
          epoch = (prev?.epoch ?? 0) + 1;
          this.#inputEpoch.set(id, { ref: value, epoch });
        } else {
          epoch = prev.epoch;
        }
        containerMarker = inputEpochMarker(entry.slot, epoch);
      }
      slotWrites.set(id, {
        slot: entry.slot,
        gen: entry.gen,
        value,
        ...containerMarker !== void 0 ? { containerMarker } : {}
      });
      this.#cacheSet(id, value);
    }
    return slotWrites;
  }
  /**
   * causl-client#129 / causl/causl-core-rs#320 — whether the engine-owned
   * dry-run entry point is available on this artefact. The `graph.simulate`
   * facade gates its reroute on this (plus its own fully-mirrored dynamic
   * guard); a legacy artefact keeps the TS dry-run.
   */
  hasSimulateCommands() {
    return this.#bridge.simulate_commands !== void 0;
  }
  /**
   * causl-client#129 — the {@link InjectedBackend.simulatesDryRunFromRust}
   * capability probe. `true` only under rust-ssot AND with the rebuilt
   * `simulate_commands` extern present; the `graph.ts` facade gates the
   * `graph.simulate` reroute on this (plus its fully-mirrored dynamic
   * guard), keeping the TS dry-run for js-ssot and legacy artefacts.
   */
  simulatesDryRunFromRust() {
    return this.#engineMode === "rust-ssot" && this.hasSimulateCommands();
  }
  /**
   * causl-client#129 (write-SSOT cutover) — whether the ENGINE (+ this
   * backend's `#valueCache` mirror) owns the committed input values, so the
   * TS closure can stop publishing staged writes onto its outer input cells
   * (the Phase A-C publication deletion / the AC2 retention drop). `true`
   * only under rust-ssot when EVERY remaining TS-cell consumer has an
   * engine-side (or backend-cache) resolution on this artefact:
   *
   *   - `simulate_commands` (cw#320) — the TS dry-run walk reads live
   *     cells; the reroute replaces it;
   *   - `read_at_result` (cw#170/#198) — historical input reads +
   *     `snapshotAt` resolve from the Rust retention chain;
   *   - `export_model` (cw#170) — the TS `exportModel` fallback reads
   *     cells;
   *   - `node_meta` (cw#170 del-final) — the structural explain reroute
   *     (`explainsTimestampsFromRust`) is armed, so `explain` keeps only
   *     its #83 TS-mirror STAMP reads (`lastWriteTime`, preserved by the
   *     gated Phase C.5) and no VALUE reads.
   *
   * Everything else re-sources from this backend's `#valueCache` (the
   * write-through mirror that also owns `read()` reference identity), which
   * the commit path keeps byte-identical to the TS floor's cell.
   */
  ownsWriteCells() {
    return this.#engineMode === "rust-ssot" && this.hasSimulateCommands() && this.hasReadAtResult() && this.hasExportModel() && this.#bridge.node_meta !== void 0;
  }
  /**
   * causl-client#129 — build the `graph.simulate` reroute closure over the
   * engine-closure hooks. The BODY lives on the wasm subpath
   * (`./simulate-facade.js`) so the main-bundle `createCausl` cell stays
   * inside its SPEC §14.2.2 budget; `graph.ts` supplies only the small
   * context bag and delegates. Returns `undefined` when this engine cannot
   * own the dry-run (js-ssot, or a legacy artefact without the
   * causl/causl-core-rs#320 extern) — the facade then keeps the TS dry-run.
   */
  buildSimulateReroute(ctx) {
    if (!this.simulatesDryRunFromRust()) return void 0;
    return buildSimulateRerouteImpl(
      ctx,
      (intent, writes) => this.simulate(intent, writes),
      (id) => this.read(id)
    );
  }
  /**
   * causl-client#129 (write-SSOT cutover) — engine-owned DRY-RUN of the
   * commit the same `writes` map would produce, via the
   * causl/causl-core-rs#320 `simulate_commands` extern. Encodes the SAME
   * commit-window cmd-buf {@link commit} encodes (same staging: `undefined`
   * collapse, container change-token minting, `#valueCache` write-through
   * so the Phase-D `__causl_compute` crossings resolve staged dep values
   * cache-first exactly as on the live commit), drives the engine's cloned
   * dry-run pipeline, and returns the decoded prediction.
   *
   * OBSERVER-INVISIBLE BY CONSTRUCTION, on every exit path (success,
   * predicted rejection, wiring error):
   *
   *   - the ENGINE's registry slot is byte-untouched (cw#320: the clone is
   *     discarded; no clock tick, no commit-log row, no retention, zero
   *     Phase-G/H crossings);
   *   - the JS MIRROR rolls back unconditionally: every `#cacheSet` this
   *     call performed (the staging loop AND the dry-run compute crossings)
   *     is replayed from the journal, every container-epoch bump is
   *     restored, and any dynamic-dep rewires the dry-run compute
   *     discovered are DISCARDED (the TS floor's `simulate` rolls back
   *     `deps` the same way);
   *   - `#nextIntentId` is NOT consumed: the dry-run rides the id the NEXT
   *     real commit will use, predicting exactly that commit;
   *   - the `#lastPhaseDTrace` diagnostic is NOT overwritten.
   *
   * @returns the predicted commit time and changed `(slot, gen)`-mapped
   *  NodeIds, in DIFF order (engine Phase-B/D emission order — the same
   *  order {@link commit} would publish for the identical writes).
   * @throws the SAME typed errors the live {@link commit} path throws for
   *  the same rejection (`CommitInProgressError`, `CycleError`, the
   *  host-identity `DerivedComputeError`, `WasmInstancePoisonedError`) —
   *  the facade surfaces them on the `SimulateResult` failed arm.
   */
  simulate(intent, writes) {
    const extern = this.#bridge.simulate_commands;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.simulate(): the `simulate_commands` extern is absent from this bridge. Callers must gate on hasSimulateCommands()."
      );
    }
    const parentJournal = this.#cacheJournal;
    const cacheJournal = /* @__PURE__ */ new Map();
    this.#cacheJournal = cacheJournal;
    const epochJournal = /* @__PURE__ */ new Map();
    const parentRewires = new Map(this.#pendingRewires);
    let diffBuf;
    try {
      const slotWrites = this.#stageWrites(writes, epochJournal);
      const cmdBuf = buildCommitCmdBuf(
        this.#nextIntentId,
        slotWrites,
        this.#bridge,
        intent,
        void 0
      );
      diffBuf = this.#applyCommands(cmdBuf, extern);
    } finally {
      for (const [id, prev] of cacheJournal) {
        if (prev === ValueHandleCache.MISS) this.#valueCache.delete(id);
        else this.#valueCache.set(id, prev);
      }
      for (const [id, prev] of epochJournal) {
        if (prev === void 0) this.#inputEpoch.delete(id);
        else this.#inputEpoch.set(id, prev);
      }
      this.#pendingRewires.clear();
      for (const [id, deps] of parentRewires) this.#pendingRewires.set(id, deps);
      this.#cacheJournal = parentJournal;
    }
    const records = decodeDiff(diffBuf);
    const committed = findCommitted(records);
    const slotToId = this.#slotToIdIndex();
    const changedNodes = [];
    for (const rec of findChangedNodes(records)) {
      const id = slotToId.get(`${rec.slot}:${rec.gen}`);
      if (id === void 0) {
        throw new Error(
          `AuthoritativeWasmEngine.simulate(): the engine predicted a changed cell (slot ${rec.slot}, gen ${rec.gen}) with no registered NodeId in the slot:gen index. This can only mean the JS slot index has desynced from the Rust engine; refusing to silently drop it from the prediction.`
        );
      }
      changedNodes.push(id);
    }
    return {
      time: committed !== void 0 ? Number(committed.time) : this.#now + 1,
      changedNodes
    };
  }
  /**
   * Commit input writes authoritatively through the wasm engine. The
   * wasm-produced diff drives the returned `Commit` (time, changed-set)
   * and Phase-G fires the registered observers of the changed nodes.
   */
  commit(intent, writes) {
    const parentJournal = this.#cacheJournal;
    const cacheJournal = /* @__PURE__ */ new Map();
    this.#cacheJournal = cacheJournal;
    const parentInFlightTime = this.#inFlightTime;
    const epochJournal = /* @__PURE__ */ new Map();
    let diffBuf;
    try {
      const slotWrites = this.#stageWrites(writes, epochJournal);
      const intentId = this.#nextIntentId;
      this.#nextIntentId += 1;
      const cmdBuf = buildCommitCmdBuf(
        intentId,
        slotWrites,
        this.#bridge,
        intent,
        this.#persistsOriginatedAt() && intent === "hydrate" ? this.#pendingHydrateOriginatedAt : void 0
      );
      this.#inFlightTime = this.#now + 1;
      diffBuf = this.#applyCommands(cmdBuf);
    } catch (err) {
      if (err instanceof WasmInstancePoisonedError) throw err;
      for (const [id, prev] of cacheJournal) {
        if (prev === ValueHandleCache.MISS) this.#valueCache.delete(id);
        else this.#valueCache.set(id, prev);
      }
      for (const [id, prev] of epochJournal) {
        if (prev === void 0) this.#inputEpoch.delete(id);
        else this.#inputEpoch.set(id, prev);
      }
      throw err;
    } finally {
      this.#cacheJournal = parentJournal;
      this.#inFlightTime = parentInFlightTime;
    }
    const records = decodeDiff(diffBuf);
    if (this.#pendingRewires.size > 0) {
      const rewires = [...this.#pendingRewires];
      this.#pendingRewires.clear();
      for (const [id, deps] of rewires) {
        const slot = this.#lookupSlot(id);
        if (slot === void 0) continue;
        const prev = this.#derivedBySlot.get(slot.slot);
        if (prev === void 0) continue;
        this.registerDerived(id, deps, prev.compute, this.#derivedTags.get(id));
        if (this.#fnTable.get(prev.fnId) === prev) this.#fnTable.delete(prev.fnId);
      }
    }
    const committed = findCommitted(records);
    if (committed !== void 0) {
      this.#now = Number(committed.time);
    }
    const slotToId = this.#slotToIdIndex();
    const changed = findChangedNodes(records);
    const changedNodes = [];
    for (const rec of changed) {
      const id = slotToId.get(`${rec.slot}:${rec.gen}`);
      if (id === void 0) {
        throw new Error(
          `AuthoritativeWasmEngine.commit(): the engine reported a changed cell (slot ${rec.slot}, gen ${rec.gen}) with no registered NodeId in the slot:gen index. This can only mean the JS slot index has desynced from the Rust engine; refusing to silently drop it from the commit's changed-set.`
        );
      }
      changedNodes.push(id);
    }
    const trace = [];
    for (const rec of findRecomputed(records)) {
      const nodeId = slotToId.get(`${rec.slot}:${rec.gen}`);
      if (nodeId === void 0) continue;
      const depsAdded = [];
      for (const d of rec.depsAdded) {
        const depId = slotToId.get(`${d.slot}:${d.gen}`);
        if (depId !== void 0) depsAdded.push(depId);
      }
      const depsRemoved = [];
      for (const d of rec.depsRemoved) {
        const depId = slotToId.get(`${d.slot}:${d.gen}`);
        if (depId !== void 0) depsRemoved.push(depId);
      }
      trace.push({
        stepIndex: rec.stepIndex,
        nodeId,
        valueBefore: this.#materializeTraceValue(nodeId, rec.before),
        valueAfter: this.#materializeTraceValue(nodeId, rec.after),
        depsAdded,
        depsRemoved
      });
    }
    for (const rec of findUnchanged(records)) {
      const nodeId = slotToId.get(`${rec.slot}:${rec.gen}`);
      if (nodeId === void 0) continue;
      const value = this.#materializeUnchangedTraceValue(nodeId, rec.slot, rec.gen);
      trace.push({
        stepIndex: rec.stepIndex,
        nodeId,
        valueBefore: value,
        valueAfter: value,
        depsAdded: [],
        depsRemoved: []
      });
    }
    trace.sort((a, b) => a.stepIndex - b.stepIndex);
    this.#lastPhaseDTrace = trace;
    if (this.#commitLogWindowCache !== void 0 && this.#commitLogCap !== void 0) {
      const cap = this.#commitLogCap;
      if (cap === 0) {
        this.#commitLogWindowFreshAt = this.#now;
      } else if (this.#commitLogWindowFreshAt === this.#now - 1) {
        const prev = this.#commitLogWindowCache;
        const row = Object.freeze({
          time: this.#now,
          intent,
          changedNodes: Object.freeze(changedNodes.slice()),
          // The engine persisted the same breadcrumb via the widened
          // BeginCommit body this commit rode (see the encode above).
          originatedAt: intent === "hydrate" && this.#persistsOriginatedAt() ? this.#pendingHydrateOriginatedAt : void 0
        });
        this.#commitLogWindowCache = Object.freeze(
          prev.length >= cap ? [...prev.slice(prev.length - cap + 1), row] : [...prev, row]
        );
        this.#commitLogWindowFreshAt = this.#now;
      } else {
        this.#commitLogWindowCache = void 0;
      }
    }
    return {
      time: this.#now,
      intent,
      changedNodes,
      originatedAt: void 0
    };
  }
  /**
   * #78 (causl-client) — the {@link InjectedBackend.hydrate} op: apply a
   * snapshot's input writes as ONE `'hydrate'`-labelled commit through
   * the SAME {@link commit} body (cmd-buf → `apply_commands` → diff) —
   * exactly one clock tick, Phase-D recompute, Rust commit-log row,
   * retention row, Phase G/H firing, and the same #178 commit-window
   * rejection surface (typed {@link CommitInProgressError}; a throw
   * means the engine applied NOTHING and the mirror journal rolled
   * back, §5.2).
   *
   * `originatedAt` is the snapshot envelope's recorded time. On a
   * #318-era artefact the Rust pipeline PERSISTS it (#129): `commit`
   * rides it in the widened 16-byte cmd-buf `BeginCommit` body, so the
   * `commit_log_meta` / `export_model` wires return it and every
   * backend-sourced mouth ({@link #onCommit} Phase-H delivery,
   * {@link exportModel}, {@link commitLogWindow}) publishes it straight
   * off the wire — byte-identical to the TS reference, which publishes
   * `originatedAt: snap.time` on hydrate-issued records. On a LEGACY
   * artefact (no `commit_log_meta` extern, so the widened body would be
   * rejected) this backend records the accepted commit's
   * `time → originatedAt` in {@link #hydrateOriginatedAt} and the mouths
   * stamp it from that map, exactly as before #129. The transient
   * {@link #pendingHydrateOriginatedAt} covers the in-flight Phase-H
   * crossing (it fires DURING `apply_commands`, before the map entry
   * exists). One map entry per accepted hydrate — hydrates are
   * boot/persistence-restore events, so growth is negligible.
   */
  hydrate(writes, originatedAt) {
    const parentPendingHydrateOriginatedAt = this.#pendingHydrateOriginatedAt;
    this.#pendingHydrateOriginatedAt = originatedAt;
    try {
      const committed = this.commit("hydrate", writes);
      if (!this.#persistsOriginatedAt()) {
        this.#hydrateOriginatedAt.set(committed.time, originatedAt);
      }
      return {
        time: committed.time,
        intent: committed.intent,
        changedNodes: committed.changedNodes,
        originatedAt
      };
    } finally {
      this.#pendingHydrateOriginatedAt = parentPendingHydrateOriginatedAt;
    }
  }
  #slotToIdIndex() {
    return this.#slotToId;
  }
  /**
   * Decode a 12-byte value record from a tag-6 row into a materialised JS
   * value for the B.8 trace. Scalars (NUMBER full-f64-bits, BOOL, NULL,
   * STRING_ID) round-trip through the canonical decoder. A container
   * record decodes to {@link CONTENT_HASH_FROM_CACHE} (the engine holds
   * only the structural hash); resolve it from the live value cache by
   * NodeId — the v1 gate workload is scalar-only, so this fallback is
   * never exercised, but it keeps the row materialised rather than
   * leaking the sentinel symbol into the canonical comparison.
   */
  #materializeTraceValue(nodeId, record) {
    const decoded = decodeValueRecord(record, 0, this.#bridge, this.#temporal);
    if (decoded === CONTENT_HASH_FROM_CACHE) {
      const cached = this.#valueCache.get(nodeId);
      return cached === ValueHandleCache.MISS ? void 0 : cached;
    }
    return decoded;
  }
  /**
   * causl-wasm#286 — materialise the before/after value for a tag-10
   * `DerivedUnchanged` row. The lean record carries NO value column (a
   * cutoff-skip did not change the value), so read the derived's CURRENT
   * 12-byte value record from the live cell and run it through the same
   * {@link #materializeTraceValue} decoder the tag-6 value columns use.
   * `value_before == value_after` for a skip, so the caller reuses this
   * single materialisation for both columns.
   */
  #materializeUnchangedTraceValue(nodeId, slot, gen) {
    const record = this.#bridge.read_cell_value(this.#engineId, slot, gen, false);
    return this.#materializeTraceValue(nodeId, record);
  }
  /**
   * B.8 (#1146) — read the authoritative Rust Phase-D sextuple trace
   * collected during the most recent {@link commit}. Empty until a
   * commit runs Phase D. The cross-bridge gate asserts this is non-empty
   * for a multi-derived workload before comparing it (NodeId-canonical)
   * against the TS-side `collectTsPhaseDTrace` emitter.
   *
   * @internal
   */
  collectRustPhaseDTrace() {
    return this.#lastPhaseDTrace;
  }
  // ====================================================================
  // Read projection
  // ====================================================================
  /**
   * Read a node's CURRENT value from wasm at full fidelity (inputs and
   * deriveds). Returns the decoded JS value.
   *
   * Serves the cached current value (skipping `read_cell_value` + the
   * O(rows) `JSON.parse`) when present; on a miss decodes from wasm and
   * caches the result so the next read is fast.
   */
  read(id) {
    this.#assertInstanceLive();
    const entry = this.#lookupSlot(id);
    if (entry === void 0) {
      throw new Error(
        `AuthoritativeWasmEngine.read(): no node registered for NodeId '${id}'.`
      );
    }
    const cached = this.#valueCache.get(id);
    if (cached !== ValueHandleCache.MISS) return cached;
    const record = this.#bridge.read_cell_value(
      this.#engineId,
      entry.slot,
      entry.gen,
      entry.isInput
    );
    const value = decodeValueRecord(record, 0, this.#bridge, this.#temporal);
    if (value === CONTENT_HASH_FROM_CACHE) {
      throw new Error(
        `AuthoritativeWasmEngine.read(): NodeId '${id}' is a content-hash container cell whose value is absent from the read cache (the engine holds only the structural hash). This indicates a read of a disposed or never-committed container cell.`
      );
    }
    this.#cacheSet(id, value);
    return value;
  }
  /** Whether a NodeId is registered (input or derived). */
  has(id) {
    return this.#slots.has(id);
  }
  /** Register an input id so reads resolve before the first commit. */
  registerInput(id, initial) {
    const entry = this.#slotFor(id, true);
    if (initial !== void 0) {
      let containerMarker;
      if (initial !== null && typeof initial === "object") {
        const prev = this.#inputEpoch.get(id);
        const epoch = prev === void 0 || !Object.is(prev.ref, initial) ? (prev?.epoch ?? 0) + 1 : prev.epoch;
        this.#inputEpoch.set(id, { ref: initial, epoch });
        containerMarker = inputEpochMarker(entry.slot, epoch);
      }
      const { kind: k, inline } = packInlineValue(
        initial,
        this.#bridge,
        containerMarker
      );
      const cmdBuf = encodeSeedInput(entry.slot, entry.gen, k, inline);
      const diffBuf = this.#applyCommands(cmdBuf);
      decodeDiff(diffBuf);
      this.#cacheSet(id, initial);
    } else {
      void entry;
    }
  }
  /**
   * #101 — retire node `id`. Crosses the FFI (emits the cmd-buf `Dispose`
   * record so the Rust engine retires the node) and drops every per-node
   * marshalling entry so the node is fully released host-side:
   *
   *   - `#fnTable` / `#derivedBySlot` — unbinds the disposed derived's compute
   *     lambda so it is never run again (the ghost-recompute leak),
   *   - `#valueCache` / `#inputEpoch` — releases the retained container value
   *     + the input change-token state so neither pins the engine's lifetime,
   *   - `#callbackIds` / `#observers` — drops the Phase-G subscriber bridge
   *     state, `#derivedTags` the explain `via` record,
   *   - `#slots` — so {@link has} reports `false` and the facade read/subscribe
   *     seams fall through to the TS floor's {@link NodeDisposedError}.
   *
   * Idempotent; a no-op for an id this engine does not own. An input and a
   * derived may collide on the raw slot integer (distinct generations), so the
   * `#derivedBySlot` / `#fnTable` teardown is gated on `!entry.isInput` AND an
   * `id` match — disposing the input must not evict the colliding derived.
   *
   * @internal
   */
  disposeNode(id) {
    const entry = this.#slots.get(id);
    if (entry === void 0) return;
    const diffBuf = this.#applyCommands(encodeDispose(entry.slot));
    decodeDiff(diffBuf);
    if (!entry.isInput) {
      const reg = this.#derivedBySlot.get(entry.slot);
      if (reg !== void 0 && reg.id === id) {
        this.#fnTable.delete(reg.fnId);
        this.#derivedBySlot.delete(entry.slot);
      }
    }
    this.#derivedTags.delete(id);
    this.#valueCache.delete(id);
    this.#inputEpoch.delete(id);
    this.#callbackIds.delete(id);
    this.#observers.delete(id);
    this.#slots.delete(id);
    this.#slotToId.delete(`${entry.slot}:${entry.gen}`);
  }
  /**
   * R1 (causl/causl-client-ts#59) — run the non-committing Phase-D materialise
   * pass. Emits a `Materialize` cmd-buf op; the bridge runs `recompute_affected`
   * over the eagerly-seeded graph, computing every derived's wasm cell value via
   * the JS compute callback WITHOUT a commit (no clock tick / commit-log row /
   * Phase-G fire). Idempotent on a settled graph (a second call recomputes to
   * the same values). Called by the facade once, lazily, at the first
   * `read`/`subscribe`/`exportModel` so the deriveds + their wasm cells are
   * materialised before any structural read (`exportModel`/`dependencies`)
   * consults them. Replaces the old deferred `__seed` commit flush.
   */
  materialize() {
    const cmdBuf = encodeMaterialize();
    const diffBuf = this.#applyCommands(cmdBuf);
    decodeDiff(diffBuf);
  }
  // ====================================================================
  // promote-read (causl/causl-core-rs#169) — read-side STRUCTURAL surface.
  //
  // Each method decodes the corresponding §12 Rust extern buffer into the
  // shape the `graph.ts` facade returns, projecting the wire-level
  // generational `(slot, gen)` handles back onto canonical NodeId strings
  // via the SAME `#slotToIdIndex` used for the commit changed-set. Routed
  // from the facade ONLY under `engineMode === 'rust-ssot'`.
  // ====================================================================
  /**
   * §12.1 — the depth-1 static dependency adjacency of `id` (a derived),
   * decoded from the `dependencies(engine_id, slot, gen)` extern. An input
   * (or an unregistered / disposed id) yields `[]`, matching the facade's
   * `dependenciesOf` for an input. The result is in the encoder's adjacency
   * order; the facade sorts for its diffable projection.
   *
   * @throws if the rebuilt structural extern is absent from the bridge.
   */
  dependencies(id) {
    const entry = this.#lookupSlot(id);
    if (entry === void 0) return Object.freeze([]);
    const extern = this.#bridge.dependencies;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.dependencies(): the `dependencies` extern is absent from this bridge (legacy artefact). Rebuild with the \xA712 structural read surface."
      );
    }
    const buf = extern(this.#engineId, entry.slot, entry.gen);
    return Object.freeze(decodeNodeIdPairs(buf, this.#slotGenResolver()).sort());
  }
  /**
   * §12.1 — the DEPTH-1 dependents of `id` (the reverse-edge view the facade
   * `dependentsOf` returns), structurally derived from the per-engine dep
   * adjacency.
   *
   * IMPORTANT (ffi-1 note): the Rust `dependents` extern is the TRANSITIVE
   * closure, NOT depth-1; routing it here would over-report. There is no
   * depth-1 `dependents` extern. The depth-1 reverse edge is exactly
   * "every registered derived `d` such that `id ∈ dependencies(d)`", so we
   * resolve it from the depth-1 `dependencies` extern over the engine's live
   * deriveds — every consulted buffer is the Rust-authoritative dep
   * adjacency, so the result is resolved FROM the Rust side (not the TS
   * closure) while matching the facade's depth-1 semantics exactly.
   */
  dependents(id) {
    if (!this.#slots.has(id)) return Object.freeze([]);
    const extern = this.#bridge.dependencies;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.dependents(): the `dependencies` extern (used to derive the depth-1 reverse edge) is absent from this bridge (legacy artefact). Rebuild with the \xA712 structural reads."
      );
    }
    const resolve = this.#slotGenResolver();
    const out = [];
    for (const reg of this.#derivedBySlot.values()) {
      const buf = extern(this.#engineId, reg.slot, reg.gen);
      const deps = decodeNodeIdPairs(buf, resolve);
      if (deps.includes(id)) out.push(reg.id);
    }
    return Object.freeze(out.sort());
  }
  /**
   * lift-explain (causl/causl-core-rs#170) — whether this engine resolves the
   * `explain` lineage TOPOLOGY (node kind + depth-1 deps) from the Rust
   * structural surface. `true` only when `engineMode === 'rust-ssot'` AND the
   * rebuilt `dependencies` extern is present (the same extern `explainNode`
   * decodes). The facade gates the `buildExplanation` topology reroute on this
   * so a legacy artefact keeps the whole walk on the TS closure.
   */
  explainsLineageFromRust() {
    return this.#engineMode === "rust-ssot" && typeof this.#bridge.dependencies === "function";
  }
  /**
   * lift-explain (causl/causl-core-rs#170) — §12.1 the lineage TOPOLOGY of `id`
   * for one frame of the `explain` walk: the structural `kind` (input vs
   * derived, from the per-engine input/derived slot registry) and the depth-1
   * dep adjacency (from the `dependencies` extern — `[]` for an input). Both
   * come from the Rust side, so `buildExplanation`'s tree SHAPE no longer
   * consults the TS `#graph` `entries` map under rust-ssot.
   *
   * An id the engine does not own (unregistered / disposed out from under the
   * walk) returns `undefined`, letting the walker emit the same defensive
   * `cycle` marker the TS closure does (`if (!entry) return cycle`). The deps
   * are returned lex-sorted (the `dependencies` extern already sorts), matching
   * the TS walk's `Array.from(entry.deps).sort()` iteration order.
   *
   * @throws if the rebuilt `dependencies` extern is absent (gated away by
   *  {@link explainsLineageFromRust} on a legacy artefact).
   */
  explainNode(id) {
    const entry = this.#lookupSlot(id);
    if (entry === void 0) return void 0;
    if (entry.isInput) return { kind: "input", deps: Object.freeze([]) };
    return { kind: "derived", deps: this.dependencies(id) };
  }
  /**
   * del-final (causl/causl-core-rs#170) — whether this engine resolves the
   * `explain` per-node TIMESTAMPS (`computedAt` / `contributedAt`) and the
   * `via` tag from the Rust `node_meta` extern. `true` only when
   * `engineMode === 'rust-ssot'` AND the rebuilt `node_meta` extern is present.
   * The facade gates the `buildExplanation` timestamp/`via` reroute on this so
   * a legacy artefact (no `node_meta`) keeps them on the TS `entries` map. This
   * is the LAST TS-closure read `explain` carried — with it true, no
   * `buildExplanation` field reads the TS `entries` under rust-ssot.
   */
  explainsTimestampsFromRust() {
    return this.#engineMode === "rust-ssot" && typeof this.#bridge.node_meta === "function";
  }
  /**
   * del-final (causl/causl-core-rs#170) — the per-node EXPLAIN metadata of `id`
   * for one `explain` frame: the structural `kind`, the `computedAt` /
   * `contributedAt` timestamps (from the Rust `node_meta` extern — the input
   * `lastWriteTime` / the derived `lastTime`), and the `via` `tag` (from this
   * backend's registration-time {@link registerDerived} record, which the Rust
   * core does not retain). Composes the Rust-authoritative timestamps with the
   * devtools tag so `buildExplanation` reads NO field off the TS `entries` map.
   *
   * An id the engine no longer owns resolves to `kind: 'missing'` (both
   * timestamps `0`), letting the walker skip it exactly as the TS closure's
   * `if (!childEntry) continue` does.
   *
   * @throws if the rebuilt `node_meta` extern is absent (gated away by
   *  {@link explainsTimestampsFromRust} on a legacy artefact).
   */
  nodeMeta(id) {
    const extern = this.#bridge.node_meta;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.nodeMeta(): the `node_meta` extern is absent from this bridge (legacy artefact). Rebuild with the del-final explain-timestamp extern."
      );
    }
    const slot = this.#lookupSlot(id);
    if (slot === void 0) {
      return { kind: "missing", computedAt: 0, contributedAt: 0, tag: void 0 };
    }
    const decoded = decodeNodeMeta(extern(this.#engineId, slot.slot, slot.gen));
    return { ...decoded, tag: this.#derivedTags.get(id) };
  }
  /**
   * §12.1 — the per-engine commit log (intent / time / changed nodes),
   * oldest-first, decoded from the `commit_log(engine_id)` extern. The
   * facade's `commitLog` derived publishes the most-recent-first `Commit[]`;
   * this returns the wire shape and the facade adapts ordering / `Commit`
   * fields.
   *
   * @throws if the rebuilt structural extern is absent from the bridge.
   */
  commitLog() {
    const extern = this.#bridge.commit_log;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.commitLog(): the `commit_log` extern is absent from this bridge (legacy artefact). Rebuild with the \xA712 structural read surface."
      );
    }
    const buf = extern(this.#engineId);
    return decodeCommitLog(buf, this.#bridge, this.#slotGenResolver()).filter(
      (c) => !isInternalCommitIntent(c.intent)
    );
  }
  /**
   * #129 / causl/causl-core-rs#318 — whether the #318 write-side wire
   * widenings are available on this artefact: the `commit_log_meta` extern,
   * the `SetCommitLogCap` cmd-buf op, and the 16-byte `BeginCommit` body
   * (they shipped together, so the extern's presence probes all three).
   */
  #persistsOriginatedAt() {
    return this.#bridge.commit_log_meta !== void 0;
  }
  /**
   * #129 / causl/causl-core-rs#318 — thread the adopter's `commitHistoryCap`
   * onto the engine's commit-log eviction horizon (`State::commit_log_cap`)
   * via the `SetCommitLogCap` cmd-buf op, replacing the engine's hardcoded
   * `Some(1024)` default. `cap = 0` disables engine-side commit-log
   * retention entirely (matching the facade's cap-0 "no observable
   * history" contract, and freeing the default-cap ring's memory).
   *
   * Called by the `graph.ts` facade ONCE at construction, with the SAME
   * resolved cap that gates Phases F/F.4/F.6, so the engine ring and the
   * adopter-facing `commitLog` window share ONE horizon. No-op on a legacy
   * artefact (the op would be rejected by the old decoder); the facade
   * then keeps the TS ring because {@link ownsCommitLog} stays `false`.
   */
  setCommitHistoryCap(cap) {
    if (!this.#persistsOriginatedAt()) return;
    if (!Number.isInteger(cap) || cap < 0 || cap > 4294967294) return;
    const diffBuf = this.#applyCommands(encodeSetCommitLogCap(cap));
    decodeDiff(diffBuf);
    this.#commitLogCap = cap;
  }
  /**
   * #129 — `true` when the ENGINE is the single source of truth for the
   * adopter-facing `commitLog` window: rust-ssot mode, a #318-era artefact
   * (the `commit_log_meta` extern + persisted `originated_at`), AND the
   * adopter's `commitHistoryCap` already threaded onto the engine horizon
   * via {@link setCommitHistoryCap}. The `graph.ts` facade gates the TS
   * Phase-F ring-append deletion and the `commitLog` re-source on this, so
   * a legacy artefact or a js-ssot graph keeps the TS ring byte-identically.
   */
  ownsCommitLog() {
    return this.#engineMode === "rust-ssot" && this.#persistsOriginatedAt() && this.#commitLogCap !== void 0;
  }
  /**
   * #252 / causl/causl-core-rs#321+#323 — thread the adopter's EFFECTIVE
   * retention window (`commitHistoryCap > 0 ? snapshotRetentionCap : 0`,
   * resolved by the facade) onto the engine's retention-chain eviction
   * horizon (`State::commit_history_cap`, the `SetSnapshotRetentionCap`
   * cmd-buf op), and opt in to derived-row retention (`RetainDerivedRows`)
   * in the SAME atomic batch, replacing the engine's hardcoded 1024
   * default. Called by the `graph.ts` facade ONCE at construction, with
   * the SAME resolved window that gates the TS floor's Phase F.6, so the
   * engine chain and the adopter-facing `readAt` / `snapshotAt` window
   * provably share ONE horizon for inputs AND deriveds.
   *
   * Unlike {@link setCommitHistoryCap} (whose #318 artefact co-shipped the
   * `commit_log_meta` extern probe) the #321/#323 ops shipped with NO new
   * extern, so artefact support is probed by APPLYING the batch: a legacy
   * decoder rejects op 14/15 as `UnknownOp` and the whole batch rolls back
   * atomically — the catch arm leaves {@link ownsRetention} disarmed and
   * the facade keeps the TS floor's retention byte-identically (fail-safe).
   */
  setSnapshotRetentionCap(cap) {
    if (!Number.isInteger(cap) || cap < 0 || cap > 4294967294) return;
    const batch = new Uint8Array(16);
    batch.set(encodeRetainDerivedRows(true), 0);
    batch.set(encodeSetSnapshotRetentionCap(cap), 8);
    try {
      const diffBuf = this.#applyCommands(batch);
      decodeDiff(diffBuf);
    } catch {
      return;
    }
    this.#snapshotRetentionCap = cap;
  }
  /**
   * #252 — `true` when the ENGINE is the single source of truth for the
   * `readAt` / `snapshotAt` retention window: rust-ssot mode, the §12.2
   * `read_at_result` extern present, AND the adopter's effective window
   * already threaded (with the derived-row opt-in) via
   * {@link setSnapshotRetentionCap}. The `graph.ts` facade gates the TS
   * Phase-F.6 delta-build deletion and the derived `readAt` reroute on
   * this, so a legacy artefact or a js-ssot graph keeps the TS floor
   * byte-identically.
   */
  ownsRetention() {
    return this.#engineMode === "rust-ssot" && this.#snapshotRetentionCap !== void 0 && this.hasReadAtResult();
  }
  /**
   * #129 / causl/causl-core-rs#318 — the PUBLISHED adopter-facing
   * commit-log window: frozen `readonly Commit[]`, oldest-first, rows
   * carrying the REAL adopter intent, the commit time, the hydrate-aware
   * `originatedAt` breadcrumb, and the authoritative changed set (inputs
   * + mirrored deriveds). Sourced from the `commit_log_meta(engine_id)`
   * extern, with the {@link #commitLogWindowCache} copy-on-write cache
   * making the per-commit consumer path O(1) amortised (no wire decode).
   * Engine-internal rows (the legacy `'__seed'` flush; eliminated at
   * source by #59, filtered here as defence-in-depth) never surface.
   * Because {@link setCommitHistoryCap} threaded the adopter cap, the
   * window is exactly the rows the TS `commitHistory` ring would have
   * held — the `graph.ts` facade publishes it VERBATIM.
   *
   * @throws if the #318 extern is absent from the bridge (legacy artefact —
   *   callers must gate on {@link ownsCommitLog}).
   */
  commitLogWindow() {
    const extern = this.#bridge.commit_log_meta;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.commitLogWindow(): the `commit_log_meta` extern is absent from this bridge (legacy artefact). Rebuild with the causl/causl-core-rs#318 commit-log API."
      );
    }
    if (this.#commitLogWindowCache !== void 0 && this.#commitLogWindowFreshAt === this.#now) {
      return this.#commitLogWindowCache;
    }
    const meta = decodeCommitLogMeta(
      extern(this.#engineId),
      this.#bridge,
      this.#slotGenResolver()
    );
    const rows = meta.records.filter((c) => !isInternalCommitIntent(c.intent)).map(
      (row) => (
        // Always-set the optional `originatedAt` slot (#703 Win 5 /
        // #760) so every published row shares the floor's monomorphic
        // hidden class.
        Object.freeze({
          time: row.time,
          intent: row.intent,
          changedNodes: Object.freeze(row.changedNodes),
          originatedAt: row.originatedAt
        })
      )
    );
    this.#commitLogWindowCache = Object.freeze(rows);
    this.#commitLogWindowFreshAt = this.#now;
    return this.#commitLogWindowCache;
  }
  /**
   * §12.2 — the per-engine telemetry counters, decoded from the
   * `stats(engine_id)` extern. The 7 counters are the subset of
   * `EngineTelemetry` the Rust core tracks; the facade merges them with the
   * TS-closure-only fields (commit observers, entries map size, …).
   *
   * @throws if the rebuilt structural extern is absent from the bridge.
   */
  stats() {
    const extern = this.#bridge.stats;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.stats(): the `stats` extern is absent from this bridge (legacy artefact). Rebuild with the \xA712 structural read surface."
      );
    }
    return decodeStats(extern(this.#engineId));
  }
  /**
   * lift-export (causl/causl-core-rs#170) — §18A.3 the whole `CauslModel`
   * IR, decoded from the `export_model(engine_id)` extern. RUST-AUTHORITATIVE
   * under rust-ssot: the nodes (+ values + dep adjacency), commit-log (+ the
   * hydrate-aware `originatedAt`), `time`, and the `IRSubscribe` event stream
   * all come from Rust — there is NO wrapped TS `#graph` consult.
   *
   * The `graphId` is supplied by the caller (the `graph.ts` facade's closure
   * `graphId`, sourced from the adopter's `createCausl({ name })`) — a
   * marshaling-layer concern (the adopter's graph name), NOT engine state.
   * It stamps every node / commit / event and synthesises the single default
   * `scopes` entry, byte-identical to the TS `exportModel`.
   *
   * The node VALUE + the `serializable` verdict are the THIN marshaling shim
   * (`JSON.stringify` round-trip) the §18A.3 lift sanctions: it runs over the
   * ENGINE's own value surface ({@link read} — the marshaling value cache
   * holding the original adopter reference, or the decoded Rust value), NOT
   * the `#graph`. A non-serialisable input (function / symbol) was marshaled
   * to Rust as a NULL value record, but the original reference survives in
   * the value cache — so the shim's verdict is `false` and the value `null`,
   * byte-identical to the TS `serialiseSafely` / `isSerializable` pair.
   *
   * @param graphId - The adopter's graph name (the IR foreign key on every
   *   node / commit / event), supplied by the facade.
   * @param opts - Caller-supplied {@link ExportModelOptions}; `maxCommits`
   *   (default 100) bounds the exported commit-log window byte-identically to
   *   the TS floor's `commitHistory.slice(-maxCommits)`. `captureCallGraph`
   *   is accepted but — like the TS floor — not yet emitted (`IRCommit.callGraph`
   *   is reserved).
   * @throws if the rebuilt `export_model` extern is absent from the bridge.
   */
  exportModel(graphId, opts) {
    const extern = this.#bridge.export_model;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.exportModel(): the `export_model` extern is absent from this bridge (legacy artefact). Rebuild with the \xA718A.3 deep-export read surface."
      );
    }
    const decoded = decodeExportModel(
      extern(this.#engineId),
      this.#bridge,
      this.#slotGenResolver(),
      this.#temporal
    );
    const inputCells = /* @__PURE__ */ new Map();
    for (const cell of decoded.inputs) inputCells.set(cell.id, cell);
    const derivedCells = /* @__PURE__ */ new Map();
    for (const cell of decoded.deriveds) derivedCells.set(cell.id, cell);
    const nodes = [];
    for (const [id, entry] of this.#slots) {
      if (entry.isInput) {
        const cell = inputCells.get(id);
        const value = this.#exportValueFor(id, cell?.value);
        const serializable = isExportSerializable(value);
        const node = {
          kind: "input",
          id,
          graphId,
          value: serializable ? value : null,
          serializable
        };
        nodes.push(node);
      } else {
        const cell = derivedCells.get(id);
        const value = this.#exportValueFor(id, cell?.value);
        const serializable = isExportSerializable(value);
        const node = {
          kind: "derived",
          id,
          graphId,
          deps: cell ? [...cell.deps].sort() : [],
          conditionalDeps: [],
          value: serializable ? value : null,
          serializable
        };
        nodes.push(node);
      }
    }
    const maxCommits = opts?.maxCommits ?? 100;
    const commits = decoded.commits.filter((c) => !isInternalCommitIntent(c.intent)).map((c) => ({
      time: c.time,
      graphId,
      intent: c.intent,
      changedNodes: c.changedNodes,
      originatedAt: c.originatedAt ?? this.#hydrateOriginatedAt.get(c.time)
    })).slice(-maxCommits);
    const defaultScopeId = `${graphId}:default`;
    let seq = 0;
    const events = decoded.events.map((e) => {
      seq += 1;
      return {
        kind: "subscribe",
        graphId,
        id: `${graphId}:s.${seq}`,
        scopeId: defaultScopeId,
        target: e.target,
        callbackSite: "<unknown>",
        time: e.subscribedAt
      };
    });
    const scopes = [
      {
        id: `${graphId}:default`,
        kind: "infinite",
        lifetime: { origin: "graph-construct", terminator: "process-exit" }
      }
    ];
    return {
      schema: CAUSL_MODEL_SCHEMA,
      time: decoded.time,
      nodes,
      commits,
      events,
      scopes,
      bridges: []
    };
  }
  /**
   * lift-export (#170) — whether the rebuilt `export_model` extern is present
   * on this bridge. The facade gates the rust-ssot `exportModel` reroute on
   * this so a legacy artefact (no §18A.3 deep-export extern) falls back to the
   * wrapped TS `#graph` rather than throwing.
   */
  hasExportModel() {
    return typeof this.#bridge.export_model === "function";
  }
  /**
   * lift-export (#170) — the {@link InjectedBackend.exportsModelFromRust}
   * capability probe. `true` only under rust-ssot AND with the rebuilt
   * `export_model` extern present, so the `graph.ts` facade reroutes
   * `exportModel` to the Rust deep export (otherwise it keeps it on the TS
   * closure).
   */
  exportsModelFromRust() {
    return this.#engineMode === "rust-ssot" && this.hasExportModel();
  }
  /**
   * lift-export (#170) — resolve the EXPORT value for a node: prefer the
   * marshaling value cache (the ORIGINAL adopter reference — load-bearing for
   * the `serializable` verdict on a value that marshaled to Rust as a NULL
   * record, e.g. a function / symbol input, or a container served from the
   * cache rather than its content-hash). Falls back to the decoded Rust value
   * record (a scalar that round-trips exactly). A `CONTENT_HASH` sentinel
   * always resolves through the cache. This is the §18A.3 marshaling
   * boundary — it does NOT consult the wrapped TS `#graph` engine state.
   */
  #exportValueFor(id, decodedValue) {
    const cached = this.#valueCache.get(id);
    if (cached !== ValueHandleCache.MISS) return cached;
    if (decodedValue === CONTENT_HASH_FROM_CACHE) return void 0;
    return decodedValue;
  }
  /**
   * lift-readat (causl/causl-core-rs#170) — §12.2 the DISCRIMINATED
   * historical read of `id` at GraphTime `time`, decoded from the
   * `read_at_result(engine_id, slot, gen, time)` extern into the exact
   * {@link RetentionResult} shape the TS `readAt(node, t)` returns.
   *
   * The Rust resolver reproduces the TS decision tree — §3 Behavior-domain
   * check (`t < registrationTime`) → retention-window check → genesis-seed
   * fallback → retained value — so the discriminant (`retained` value +
   * `time`, or `evicted` + `oldestRetainedTime`) is byte-identical to the
   * pure-TS oracle. An unregistered id surfaces as `evicted` with
   * `oldestRetainedTime: 0` (the slot was never minted; there is no
   * history to resolve), matching a never-written genesis node.
   *
   * @throws if the rebuilt `read_at_result` extern is absent from the bridge.
   */
  readAt(id, time) {
    const extern = this.#requireReadAtResult();
    const entry = this.#lookupSlot(id);
    if (entry === void 0) {
      return { status: "evicted", oldestRetainedTime: 0 };
    }
    const buf = extern(
      this.#engineId,
      entry.slot,
      entry.gen,
      BigInt(time)
    );
    const result = decodeReadAtResult(buf, this.#bridge, this.#temporal);
    if (result.status === "retained" && result.value === CONTENT_HASH_FROM_CACHE) {
      const recovered = this.#recoverRetainedContainer(id, entry, buf);
      if (recovered !== void 0) {
        return { status: "retained", value: recovered.value, time: result.time };
      }
      throw new RetainedValueUnavailableError(id, time);
    }
    return result;
  }
  /**
   * #100 — the trailing 12-byte value record of a `read_at_result` buffer
   * begins at offset 12. Resolve the retained container row's per-(slot,
   * epoch) change token back to its marker STRING so
   * {@link #recoverRetainedContainer} can decide whether the retained row is
   * still the live reference. Returns `undefined` for any non-container row
   * (the caller only asks after seeing the sentinel, so this is
   * defence-in-depth).
   *
   * #221/#115 — the authoritative INPUT container path now carries the token
   * INLINE as an `INPUT_EPOCH` record: the packed `(slot, epoch)` payload is
   * the little-endian u64 at record byte 4 (buffer offset 16), and the marker
   * is rebuilt from it with NO intern lookup (nothing was interned). The
   * legacy `CONTENT_HASH` arm (an interned marker `StringId` at the same
   * offset, resolved via `read_interned_string`) is retained for any
   * structural content-hash container row.
   */
  #contentHashRowMarker(buf) {
    if (buf.length < READ_AT_RESULT_RECORD_LEN) return void 0;
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const rowKind = view.getUint8(12);
    if (rowKind === kind.INPUT_EPOCH) {
      return inputEpochMarkerForPacked(view.getBigUint64(16, true));
    }
    if (rowKind === kind.CONTENT_HASH) {
      const strId = view.getUint32(16, true);
      return this.#bridge.read_interned_string(strId >>> 0) ?? void 0;
    }
    return void 0;
  }
  /**
   * #100 — recover a retained CONTAINER input value the engine stored only as
   * a content-hash marker. The host-side `#valueCache` holds ONLY the CURRENT
   * reference, so a historical row is recoverable iff it is still the live
   * one — detected by comparing the row's per-(slot, epoch) change token
   * (`inputEpochMarker`) to the current epoch's token. On a match the cached
   * container IS the value at that row; on a mismatch (or a missing cache
   * entry) the historical value is genuinely gone. Returns `{ value }` when
   * recoverable, `undefined` otherwise (the caller decides: throw for
   * `readAt`, omit for the `snapshotAt` envelope).
   */
  #recoverRetainedContainer(id, entry, buf) {
    const rowMarker = this.#contentHashRowMarker(buf);
    const cur = this.#inputEpoch.get(id);
    if (rowMarker !== void 0 && cur !== void 0 && inputEpochMarker(entry.slot, cur.epoch) === rowMarker) {
      const cached = this.#valueCache.get(id);
      if (cached !== ValueHandleCache.MISS) return { value: cached };
    }
    return void 0;
  }
  /**
   * lift-readat (causl/causl-core-rs#170) — §12.2 the historical
   * {@link GraphSnapshot} projection at GraphTime `time`, as a
   * {@link RetentionResult}. The retention discriminant (retained vs
   * evicted + `oldestRetainedTime`) is resolved FROM the Rust retention
   * window — byte-identical to the TS `snapshotAt(t)`. The retained arm's
   * envelope is materialised by reading every registered input's value at
   * `time` from the SAME Rust `read_at_result` extern, filtered to
   * JSON-serialisable values (matching the TS `snapshot()` / `snapshotAt()`
   * `isSerializable` gate). `schemaHash` is sourced from `computeSchemaHash`
   * — a structural-identity digest over the registered id-set, NOT a
   * retention concern.
   *
   * The window discriminant is node-INDEPENDENT (the TS `snapshotAt`
   * evicts purely on `t < oldest` / empty-buffer → `now`, with no per-node
   * §3 domain check), so it is read from a genesis-registered input probe
   * (`registered_at == 0`, whose `read_at_result` evicted arm carries the
   * window front exactly). A graph with no inputs has an empty retention
   * window; the probe-less fallback returns `evicted { now }`, matching the
   * TS empty-buffer arm.
   *
   * @throws if the rebuilt `read_at_result` extern is absent from the bridge.
   * @throws {@link RetainedValueUnavailableError} #114 — when a retained
   *  CONTAINER input in the window can no longer be recovered host-side (its
   *  reference has since changed). The envelope fails LOUD rather than
   *  silently omitting the input, symmetric to {@link readAt}'s #100 arm.
   */
  snapshotAt(time, computeSchemaHash = () => "") {
    const extern = this.#requireReadAtResult();
    const probe = this.#firstInputSlot();
    if (probe === void 0) {
      return { status: "evicted", oldestRetainedTime: this.#now };
    }
    const probeBuf = extern(this.#engineId, probe.slot, probe.gen, BigInt(time));
    const probeResult = decodeReadAtResult(probeBuf, this.#bridge, this.#temporal);
    if (probeResult.status === "evicted") {
      return { status: "evicted", oldestRetainedTime: probeResult.oldestRetainedTime };
    }
    const inputs = {};
    for (const [nodeId, entry] of this.#slots) {
      if (!entry.isInput) continue;
      const buf = extern(this.#engineId, entry.slot, entry.gen, BigInt(time));
      const r = decodeReadAtResult(buf, this.#bridge, this.#temporal);
      if (r.status !== "retained") continue;
      if (r.value === CONTENT_HASH_FROM_CACHE) {
        const recovered = this.#recoverRetainedContainer(nodeId, entry, buf);
        if (recovered === void 0) {
          throw new RetainedValueUnavailableError(nodeId, time);
        }
        inputs[nodeId] = recovered.value;
        continue;
      }
      inputs[nodeId] = r.value;
    }
    return {
      status: "retained",
      time: probeResult.time,
      value: {
        schema: 1,
        time: probeResult.time,
        inputs,
        schemaHash: computeSchemaHash()
      }
    };
  }
  /**
   * lift-readat (#170) — whether the rebuilt `read_at_result` extern is
   * present on this bridge. The facade gates the rust-ssot readAt /
   * snapshotAt reroute on this so a legacy artefact (no §12.2 discriminated
   * extern) falls back to the wrapped TS `#graph` rather than throwing.
   */
  hasReadAtResult() {
    return typeof this.#bridge.read_at_result === "function";
  }
  /**
   * lift-readat (#170) — the {@link InjectedBackend.readsHistoryFromRust}
   * capability probe. `true` only under rust-ssot AND with the rebuilt
   * `read_at_result` extern present, so the `graph.ts` facade reroutes
   * `readAt` / `snapshotAt` to the Rust retention chain (otherwise it keeps
   * the reads on the TS closure). This engine is the actual `injectedBackend`
   * passed to `createCausl({ injectedBackend })`, so the facade calls this
   * method directly.
   */
  readsHistoryFromRust() {
    return this.#engineMode === "rust-ssot" && this.hasReadAtResult();
  }
  /**
   * lift-readat (#170) — resolve the `read_at_result` extern or throw the
   * legacy-artefact diagnostic. Shared by {@link readAt} / {@link snapshotAt}.
   */
  #requireReadAtResult() {
    const extern = this.#bridge.read_at_result;
    if (extern === void 0) {
      throw new Error(
        "AuthoritativeWasmEngine.readAt()/snapshotAt(): the `read_at_result` extern is absent from this bridge (legacy artefact). Rebuild with the \xA712.2 discriminated time-travel read surface."
      );
    }
    return extern;
  }
  /**
   * lift-readat (#170) — the registered input slot with the lowest slot
   * index (the genesis-registered window probe for {@link snapshotAt}), or
   * `undefined` when the engine has no inputs.
   */
  #firstInputSlot() {
    let best;
    for (const entry of this.#slots.values()) {
      if (!entry.isInput) continue;
      if (best === void 0 || entry.slot < best.slot) best = entry;
    }
    return best;
  }
  /**
   * Build a `(slot, gen) → NodeId | undefined` resolver over the live slot
   * registry — the structural-decoder counterpart of {@link #slotToIdIndex}
   * (which keys on the `"slot:gen"` string). One Map is built per call; the
   * structural reads are devtools-grade (not on a commit hot path).
   */
  #slotGenResolver() {
    const idx = this.#slotToIdIndex();
    return (slot, gen) => idx.get(`${slot}:${gen}`);
  }
  // ====================================================================
  // Subscriber bridge (Phase G)
  // ====================================================================
  /**
   * Register a JS observer keyed by NodeId. On commit the wasm
   * `__causl_fire` dispatch fires it exactly once when the node changed.
   * Returns an unsubscribe thunk.
   */
  subscribe(id, observer) {
    let set = this.#observers.get(id);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      this.#observers.set(id, set);
    }
    set.add(observer);
    const entry = this.#lookupSlot(id);
    if (entry !== void 0) {
      const callbackId = this.#callbackIdFor(id);
      const cmdBuf = encodeSubscribe(
        entry.slot,
        entry.gen,
        this.#engineId,
        callbackId
      );
      const diffBuf = this.#applyCommands(cmdBuf);
      decodeDiff(diffBuf);
      try {
        ;
        observer(this.read(id), this.#liveNow());
      } catch (err) {
        const sink = this.#observerErrorObserver;
        if (sink !== void 0) {
          try {
            sink(err, {
              source: "subscribe-initial",
              nodeId: id,
              time: this.#liveNow()
            });
          } catch {
          }
        }
      }
    }
    return () => {
      const s = this.#observers.get(id);
      if (s !== void 0) {
        s.delete(observer);
        if (s.size === 0) this.#observers.delete(id);
      }
    };
  }
  #callbackIdFor(id) {
    let cid = this.#callbackIds.get(id);
    if (cid === void 0) {
      cid = this.#nextCallbackId;
      this.#nextCallbackId += 1;
      this.#callbackIds.set(id, cid);
    }
    return cid;
  }
  // ====================================================================
  // Compute / fire handlers (the __causl_compute / __causl_fire imports)
  // ====================================================================
  #installHandlers() {
    if (this.#handlersInstalled) return;
    this.#imports.__causl_set_compute_handler(
      this.#engineId,
      (engineId, fnId, depsBuf) => this.#onCompute(engineId, fnId, depsBuf)
    );
    this.#imports.__causl_set_fire_handler(
      this.#engineId,
      (firingsBuf) => this.#onFire(firingsBuf)
    );
    this.#imports.__causl_set_commit_handler?.(
      this.#engineId,
      (engineId, commitBuf) => this.#onCommit(engineId, commitBuf)
    );
    this.#imports.__causl_set_pre_fire_handler?.(
      this.#engineId,
      (engineId, commitBuf) => this.#onPreFire(engineId, commitBuf)
    );
    this.#imports.__causl_set_error_handler?.(
      this.#engineId,
      (engineId, errBuf) => this.#onObserverError(engineId, errBuf)
    );
    this.#handlersInstalled = true;
  }
  /**
   * mux-6 — tear down this engine: remove its compute/fire handlers from the
   * sidecar's per-id registry so a stale dispatch for its `#engineId` is a
   * no-op (returns a THREW out-buffer for compute / drops the firing for
   * fire). Idempotent. Wired into the {@link WasmBackend} teardown.
   *
   * @internal
   */
  dispose() {
    if (!this.#handlersInstalled) return;
    this.#imports.__causl_remove_compute_handler(this.#engineId);
    this.#imports.__causl_remove_fire_handler(this.#engineId);
    this.#imports.__causl_remove_commit_handler?.(this.#engineId);
    this.#imports.__causl_remove_pre_fire_handler?.(this.#engineId);
    this.#imports.__causl_remove_error_handler?.(this.#engineId);
    this.#handlersInstalled = false;
    this.#bridge.dispose_engine?.(this.#engineId);
    this.#valueCache.clear();
    this.#inputEpoch.clear();
    this.#fnTable.clear();
    this.#derivedBySlot.clear();
    this.#observers.clear();
    this.#commitObservers.clear();
    this.#callbackIds.clear();
  }
  /**
   * The `__causl_compute` handler: recompute one derived. `depsBuf` is a
   * value buffer of the dep values in engine `deps` order; returns the
   * §5.4 out-buffer (status byte + value record + read-deps, or status
   * byte + thrown message).
   */
  #onCompute(engineId, fnId, depsBufView) {
    if (engineId !== this.#engineId) {
      return encodeThrew(
        `__causl_compute routed engine_id ${engineId} to engine ${this.#engineId} (per-engineId dispatch mismatch)`
      );
    }
    const registration = this.#fnTable.get(fnId);
    if (registration === void 0) {
      return encodeThrew(`no compute lambda bound for fn_id ${fnId}`);
    }
    const depValues = /* @__PURE__ */ new Map();
    let depsBuf;
    for (let i = 0; i < registration.deps.length; i++) {
      const dep = registration.deps[i];
      const cached = this.#valueCache.get(dep);
      if (cached !== ValueHandleCache.MISS) {
        depValues.set(dep, cached);
        continue;
      }
      if (depsBuf === void 0) depsBuf = depsBufView.slice();
      const off = i * VALUE_BUF_RECORD_LEN;
      if (off + VALUE_BUF_RECORD_LEN > depsBuf.length) break;
      const decoded = decodeValueRecord(depsBuf, off, this.#bridge, this.#temporal);
      if (decoded === CONTENT_HASH_FROM_CACHE) {
        return encodeThrew(
          `derived '${registration.id}' dep '${dep}' is a content-hash container whose value is absent from the read cache`
        );
      }
      this.#cacheSet(dep, decoded);
      depValues.set(dep, decoded);
    }
    const readOrder = [];
    const seen = /* @__PURE__ */ new Set();
    const get = (dep) => {
      if (!seen.has(dep)) {
        seen.add(dep);
        readOrder.push(dep);
      }
      if (depValues.has(dep)) return depValues.get(dep);
      if (this.#lookupSlot(dep) === void 0) {
        throw new UndeclaredDependencyError(registration.id, dep);
      }
      const v = this.read(dep);
      depValues.set(dep, v);
      return v;
    };
    let value;
    try {
      value = registration.compute(get);
    } catch (err) {
      const typed = asDerivedComputeError(registration.id, err);
      this.#pendingComputeThrow = typed;
      return encodeThrew(typed.message);
    }
    const rewired = readOrder.length !== registration.deps.length || readOrder.some((d, i) => registration.deps[i] !== d);
    if (rewired) this.#pendingRewires.set(registration.id, readOrder.slice());
    this.#cacheSet(registration.id, value);
    return encodeComputeOk(this.#engineId, value, this.#bridge);
  }
  /**
   * The `__causl_fire` handler: fire THIS engine's subscriber batch.
   * `firingsBuf` is the §5.5 record stream the mux-6 sidecar already
   * GROUPED to this engine (`count u32 | records…`), each record carrying a
   * leading `engine_id u32` (== `this.#engineId`), then node_slot, node_gen,
   * observer-id, value-record. Fires each registered observer exactly once
   * with the node's new value; returns the mux-4 §5.5 observer-errors buffer
   * (`err_count u32 | engine_id u32 | records…`).
   */
  #onFire(firingsBufView) {
    const firingsBuf = firingsBufView.slice();
    const records = decodeFireBatch(firingsBuf);
    const slotToId = this.#slotToIdIndex();
    const errors = [];
    for (const { nodeSlot, nodeGen, observerId, valueOffset } of records) {
      const id = slotToId.get(`${nodeSlot}:${nodeGen}`);
      if (id === void 0) {
        noteUnresolvedPairDrop();
        continue;
      }
      const observerSet = this.#observers.get(id);
      if (observerSet === void 0) continue;
      let value = this.#valueCache.get(id);
      if (value === ValueHandleCache.MISS) {
        const decoded = decodeValueRecord(
          firingsBuf,
          valueOffset,
          this.#bridge,
          this.#temporal
        );
        if (decoded === CONTENT_HASH_FROM_CACHE) {
          continue;
        }
        value = decoded;
        this.#cacheSet(id, value);
      }
      const fireTime = this.#liveNow();
      for (const observer of observerSet) {
        try {
          observer(value, fireTime);
        } catch (err) {
          errors.push({
            slot: nodeSlot,
            gen: nodeGen,
            observer: observerId,
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
    }
    return encodeObserverErrors(this.#engineId, errors);
  }
  /**
   * lift-subscribecommits (causl-wasm#170) — the `__causl_on_commit`
   * handler: Phase H. The Rust apply path crosses here ONCE per commit,
   * AFTER the Phase-G per-node firing (`#onFire`), carrying the §5.5 commit
   * record (`time | intent | changedNodes | originatedAt`). Decode it into
   * the adopter-facing {@link Commit} shape and fan it out to the registered
   * commit observers in registration order — the exact dispatch the TS
   * `commitObservers` / `phaseH_dispatchCommitObservers` performs.
   *
   * The `engineId` the sidecar passes MUST be ours (it dispatched by
   * engine_id); a mismatch means the per-id registry misrouted (a wiring
   * bug) — skip rather than fire a sibling engine's commit. A throw inside
   * an observer is swallowed (the channel is a post-commit side-effect; the
   * commit already happened), mirroring the Phase-G fire's per-observer
   * try/catch and the sidecar's swallow-on-throw discipline.
   */
  #onCommit(engineId, commitBufView) {
    if (engineId !== this.#engineId) return;
    if (this.#commitObservers.size === 0) return;
    const commitBuf = commitBufView.slice();
    const decoded = decodeCommitRecord(commitBuf, this.#bridge, this.#slotGenResolver());
    if (isInternalCommitIntent(decoded.intent)) return;
    const commit = {
      time: decoded.time,
      intent: decoded.intent,
      changedNodes: decoded.changedNodes,
      originatedAt: decoded.originatedAt !== void 0 ? decoded.originatedAt : decoded.intent === "hydrate" ? this.#pendingHydrateOriginatedAt ?? this.#hydrateOriginatedAt.get(decoded.time) : void 0
    };
    for (const observer of this.#commitObservers) {
      try {
        observer(commit);
      } catch {
      }
    }
  }
  /**
   * lift-subscribecommits (causl-wasm#170) — register a commit-LEVEL
   * observer (Phase H). On every commit the Rust `__causl_on_commit`
   * crossing fires it exactly once with the just-published {@link Commit},
   * AFTER the per-node Phase-G firing. Mirrors the per-node {@link subscribe}
   * unsubscribe discipline: the returned thunk removes this observer; a
   * removed observer never fires again. Registration order is preserved
   * (insertion-ordered `Set`), so multiple commit observers fan out in the
   * order they were added.
   */
  subscribeCommits(observer) {
    this.#commitObservers.add(observer);
    return () => {
      this.#commitObservers.delete(observer);
    };
  }
  /**
   * lift-subscribecommits (#170) — whether the rebuilt sidecar carries the
   * commit-level handler registry (`__causl_set_commit_handler`). The facade
   * gates the rust-ssot `subscribeCommits` reroute on this so a legacy
   * artefact (no commit channel) falls back to the wrapped TS `#graph`.
   */
  hasCommitChannel() {
    return typeof this.#imports.__causl_set_commit_handler === "function";
  }
  /**
   * lift-subscribecommits (#170) — the {@link InjectedBackend.firesCommitsFromRust}
   * capability probe. `true` only under rust-ssot AND with the rebuilt
   * commit-handler registry present, so the `graph.ts` facade reroutes
   * `subscribeCommits` to the Rust Phase-H channel (otherwise it keeps it on
   * the TS closure).
   */
  firesCommitsFromRust() {
    return this.#engineMode === "rust-ssot" && this.hasCommitChannel();
  }
  /**
   * pre-fire (causl-wasm#189/#190) — whether this engine delivers the
   * commit's changed set BEFORE the first Phase-G observer byte (the
   * `__causl_pre_fire` crossing; sidecar registry present). When `false`
   * (legacy artefact) the facade's post-`apply_commands` union bump remains
   * the fallback — commit-boundary `nodeVersion` reads stay byte-identical
   * there; only the in-frame corner needs the crossing.
   */
  deliversPreFireChangedSet() {
    return typeof this.#imports.__causl_set_pre_fire_handler === "function";
  }
  /**
   * pre-fire (causl-wasm#189/#190) — register the facade's pre-fire
   * changed-set observer (the #71 nodeVersion union-bump hook). Called once
   * at graph construction; the observer fires once per accepted commit,
   * inside `apply_commands`, strictly before any Phase-G/H observer byte,
   * with the commit's authoritative changed-set NodeIds (engine-internal
   * commits filtered, matching the Phase-H delivery discipline).
   */
  onPreFireChangedSet(observer) {
    this.#preFireObserver = observer;
  }
  /**
   * The `__causl_pre_fire` handler: decode the pre-fire record (the wire
   * shape is byte-identical to the `__causl_on_commit` Phase-H record) and
   * hand the commit's changed-set NodeIds to the facade observer. Mirrors
   * `#onCommit`'s discipline: engine-id guard, copy off linear memory
   * before decoding (the intent decode calls back into the bridge), and
   * the R3 internal-intent filter (an engine-internal commit must never
   * bump adopter-facing counters — js-ssot never surfaces one). A throw
   * inside the observer is swallowed sidecar-side (#190), but guard here
   * too: the delivery channel must never trap the pipeline.
   */
  #onPreFire(engineId, commitBufView) {
    if (engineId !== this.#engineId) return;
    if (this.#preFireObserver === void 0) return;
    const commitBuf = commitBufView.slice();
    const decoded = decodeCommitRecord(commitBuf, this.#bridge, this.#slotGenResolver());
    if (isInternalCommitIntent(decoded.intent)) return;
    if (decoded.changedNodes.length === 0) return;
    try {
      this.#preFireObserver(decoded.changedNodes);
    } catch {
    }
  }
  /**
   * gap-5 (causl-wasm#169; causl-client#102) — register the facade's
   * observer-error sink. Called once at graph construction; the observer
   * fires once per surfaced Phase-G `ObserverError`, delivered by the Rust
   * `__causl_on_observer_error` crossing, with the reconstructed
   * `(error, ctx)` the facade re-fans to the adopter's `onObserverError`.
   * Single slot — the facade is the only consumer.
   */
  onObserverError(observer) {
    this.#observerErrorObserver = observer;
  }
  /**
   * gap-5 (causl-wasm#169; causl-client#102) — the
   * `__causl_on_observer_error` handler. The Rust `apply_commands`
   * error-hook crosses here ONCE per surfaced Phase-G `ObserverError` (the
   * throws `#onFire` caught and returned in the §5.5 observer-errors buffer,
   * re-stamped with the dispatch `engine_id` and routed back out through the
   * hook). `errBuf` is the single-error wire record (`err_count u32 = 1 |
   * engine_id u32 | slot u32 | gen u32 | observer_len u32 | observer |
   * message_len u32 | message`), decoded with the SAME §5.5 layout
   * {@link encodeObserverErrors} writes.
   *
   * The original JS throw cannot survive the Rust round trip (only its
   * message crosses the boundary), so the reconstructed `Error(message)`
   * carries the same message the TS floor reports; the offending NodeId is
   * resolved from the `(slot, gen)` pair via the live slot→id index, and the
   * `time` is the commit's in-flight tick (`#liveNow()`, matching the
   * Phase-G fire stamp and the TS reference's `now`). Mirrors `#onFire`'s
   * discipline: engine-id guard, copy off linear memory before decoding, and
   * a per-delivery try/catch (the sidecar swallows a handler throw too —
   * defence-in-depth so the sink can never trap the commit pipeline).
   */
  #onObserverError(engineId, errBufView) {
    if (engineId !== this.#engineId) return;
    const observer = this.#observerErrorObserver;
    if (observer === void 0) return;
    const errBuf = errBufView.slice();
    if (errBuf.length < 8) return;
    const view = new DataView(errBuf.buffer, errBuf.byteOffset, errBuf.byteLength);
    const count = view.getUint32(0, true);
    let pos = 8;
    const slotToId = this.#slotToIdIndex();
    const time = this.#liveNow();
    for (let i = 0; i < count; i++) {
      if (pos + 8 > errBuf.length) break;
      const slot = view.getUint32(pos, true);
      const gen = view.getUint32(pos + 4, true);
      pos += 8;
      if (pos + 4 > errBuf.length) break;
      const observerLen = view.getUint32(pos, true);
      pos += 4;
      if (pos + observerLen > errBuf.length) break;
      pos += observerLen;
      if (pos + 4 > errBuf.length) break;
      const messageLen = view.getUint32(pos, true);
      pos += 4;
      if (pos + messageLen > errBuf.length) break;
      const message = textDecoder2.decode(errBuf.subarray(pos, pos + messageLen));
      pos += messageLen;
      const nodeId = slotToId.get(`${slot}:${gen}`);
      const ctx = nodeId === void 0 ? { source: "node-subscriber", time } : { source: "node-subscriber", nodeId, time };
      try {
        observer(new Error(message), ctx);
      } catch {
      }
    }
  }
};
var textEncoder2 = new TextEncoder();
function encodeThrew(message) {
  const msgBytes = textEncoder2.encode(message);
  const out = new Uint8Array(1 + 4 + msgBytes.length);
  const view = new DataView(out.buffer);
  out[0] = STATUS_THREW;
  writeU32Checked(
    view,
    1,
    msgBytes.length,
    "STATUS_THREW::message_len",
    "compute-out",
    "compute-out"
  );
  out.set(msgBytes, 5);
  return out;
}
function encodeComputeOk(engineId, value, bridge) {
  const valueRecord = encodeValueBuf(value, bridge);
  const out = new Uint8Array(1 + 4 + VALUE_BUF_RECORD_LEN + 4);
  const view = new DataView(out.buffer);
  out[0] = STATUS_OK;
  writeU32Checked(view, 1, engineId, "COMPUTE_OUT::engine_id", "compute-out");
  out.set(valueRecord, 1 + 4);
  return out;
}
function encodeObserverErrors(engineId, errors) {
  const parts = [];
  const pushU32 = (n, field) => {
    checkU32(n, field, "observer-errors", "observer-errors");
    parts.push(n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255);
  };
  const pushStr = (s, field) => {
    const bytes = textEncoder2.encode(s);
    pushU32(bytes.length, field);
    for (let i = 0; i < bytes.length; i++) parts.push(bytes[i]);
  };
  pushU32(errors.length, "observer-errors::count");
  pushU32(engineId, "observer-errors::engine_id");
  for (const e of errors) {
    pushU32(e.slot, "observer-errors::slot");
    pushU32(e.gen, "observer-errors::gen");
    pushStr(e.observer, "observer-errors::observer_len");
    pushStr(e.message, "observer-errors::message_len");
  }
  return Uint8Array.from(parts);
}
function isExportSerializable(value) {
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

// wasm/js-fallback-backend.ts
var JsFallbackBackend = class {
  // A plain TS engine — the §18A value-of-record floor. Built with
  // `createCauslTs` (NOT `createCausl`): post-FLIP (epic #31 / issue #33)
  // `createCausl()` routes to the wasm engine when a module is preloaded, so a
  // `createCausl()` here — inside the wasm subpath, which is only loaded once a
  // wasm path is in play — would re-enter the wasm factory and recurse. This
  // fallback wraps the TS floor by definition.
  #graph;
  #inputs = /* @__PURE__ */ new Map();
  #deriveds = /* @__PURE__ */ new Map();
  // #150 — dormant observers subscribed to a not-yet-registered id. The wasm
  // engine tolerates a subscribe to an unregistered node (it records the
  // observer without arming a Phase-G fire); we mirror that inert tolerance
  // rather than throwing. Kept so the returned unsubscribe stays correct and
  // the set does not leak.
  #dormant = /* @__PURE__ */ new Map();
  /**
   * @param options adopter construction options threaded into the wrapped TS
   *  engine — the retention caps / graph name / observer-error hook the real
   *  {@link import('./authoritative.js').AuthoritativeWasmEngine} would carry.
   *  `name` defaults to the fallback marker when the caller supplies none.
   */
  constructor(options = {}) {
    this.#graph = createCauslTs({ name: "causl.wasm.js-fallback", ...options });
  }
  get now() {
    return this.#graph.now;
  }
  has(id) {
    return this.#inputs.has(id) || this.#deriveds.has(id);
  }
  registerInput(id, initial) {
    if (this.has(id)) return;
    this.#inputs.set(id, this.#graph.input(id, initial));
  }
  registerDerived(id, deps, compute) {
    if (this.#deriveds.has(id)) return;
    const node = this.#graph.derived(
      id,
      (get) => compute((dep) => {
        const handle = this.#nodeFor(dep);
        return get(handle);
      })
    );
    this.#deriveds.set(id, node);
  }
  commit(intent, writes) {
    for (const id of writes.keys()) {
      if (!this.#inputs.has(id)) this.registerInput(id);
    }
    return this.#graph.commit(intent, (tx) => {
      for (const [id, value] of writes) {
        tx.set(this.#nodeForInput(id), value);
      }
    });
  }
  read(id) {
    return this.#graph.read(this.#nodeFor(id));
  }
  subscribe(id, observer) {
    const node = this.#inputs.get(id) ?? this.#deriveds.get(id);
    if (node !== void 0) {
      return this.#graph.subscribe(node, observer);
    }
    const obs = observer;
    let set = this.#dormant.get(id);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      this.#dormant.set(id, set);
    }
    set.add(obs);
    return () => {
      const s = this.#dormant.get(id);
      if (s !== void 0) {
        s.delete(obs);
        if (s.size === 0) this.#dormant.delete(id);
      }
    };
  }
  #nodeFor(id) {
    const node = this.#inputs.get(id) ?? this.#deriveds.get(id);
    if (node === void 0) {
      throw new Error(
        `JsFallbackBackend: no node registered for NodeId '${id}'.`
      );
    }
    return node;
  }
  #nodeForInput(id) {
    const node = this.#inputs.get(id);
    if (node === void 0) {
      throw new Error(
        `JsFallbackBackend.commit(): NodeId '${id}' is not a writable input.`
      );
    }
    return node;
  }
};

// wasm/marshaler.ts
var NodeDisposedError = class extends Error {
  /** The offending NodeId. Exposed so adopters can introspect. */
  nodeId;
  constructor(nodeId) {
    super(`NodeId '${nodeId}' refers to a disposed slot`);
    this.name = "NodeDisposedError";
    this.nodeId = nodeId;
  }
};
function marshalCommitEnvelope(mirror, intent, writes) {
  const resolvedWrites = /* @__PURE__ */ new Map();
  for (const [nodeId, value] of writes) {
    const slot = mirror.dictionary.get(nodeId);
    if (slot === void 0) {
      throw new NodeDisposedError(nodeId);
    }
    resolvedWrites.set(slot.idx, value);
  }
  const nextTime = mirror.now + 1;
  const slotsByIdx = /* @__PURE__ */ new Map();
  for (const slot of mirror.dictionary.values()) {
    if (slotsByIdx.has(slot.idx)) continue;
    slotsByIdx.set(slot.idx, {
      slot,
      // Default last_write_time = 0 for previously-untouched cells.
      // Adopter rewrites will bump this below.
      lastWriteTime: 0
    });
  }
  const sortedIdxs = Array.from(slotsByIdx.keys()).sort((a, b) => a - b);
  const inputs = sortedIdxs.map((idx) => {
    const entry = slotsByIdx.get(idx);
    if (entry === void 0) throw new Error("marshalCommitEnvelope: invariant");
    const writeValue = resolvedWrites.get(idx);
    const value = writeValue !== void 0 ? writeValue : mirror.inputs.get(idx) ?? null;
    const lastWriteTime = writeValue !== void 0 ? nextTime : entry.lastWriteTime;
    return { id: idx, value, last_write_time: lastWriteTime };
  });
  const writeSlots = Array.from(resolvedWrites.keys()).sort((a, b) => a - b);
  return {
    state: {
      now: mirror.now,
      inputs
    },
    action: {
      action: "commit",
      intent,
      writes: writeSlots
    }
  };
}
function marshalBatchEnvelope(mirror, commits) {
  const resolvedPerCommit = [];
  for (const { writes } of commits) {
    const resolved = [];
    for (const [nodeId, value] of writes) {
      const slot = mirror.dictionary.get(nodeId);
      if (slot === void 0) {
        throw new NodeDisposedError(nodeId);
      }
      resolved.push({ idx: slot.idx, value });
    }
    resolvedPerCommit.push(resolved);
  }
  const firstWrites = /* @__PURE__ */ new Map();
  const firstResolved = resolvedPerCommit[0];
  if (firstResolved !== void 0) {
    for (const { idx, value } of firstResolved) {
      firstWrites.set(idx, value);
    }
  }
  const nextTime = mirror.now + 1;
  const slotsByIdx = /* @__PURE__ */ new Map();
  for (const slot of mirror.dictionary.values()) {
    if (slotsByIdx.has(slot.idx)) continue;
    slotsByIdx.set(slot.idx, { slot });
  }
  const sortedIdxs = Array.from(slotsByIdx.keys()).sort((a, b) => a - b);
  const inputs = sortedIdxs.map((idx) => {
    const writeValue = firstWrites.get(idx);
    const value = writeValue !== void 0 ? writeValue : mirror.inputs.get(idx) ?? null;
    const lastWriteTime = writeValue !== void 0 ? nextTime : 0;
    return { id: idx, value, last_write_time: lastWriteTime };
  });
  const actions = commits.map((c, i) => {
    const resolved = resolvedPerCommit[i] ?? [];
    const writeSlots = Array.from(new Set(resolved.map((r) => r.idx))).sort(
      (a, b) => a - b
    );
    return {
      action: "commit",
      intent: c.intent,
      writes: writeSlots
    };
  });
  return {
    state: {
      now: mirror.now,
      inputs
    },
    actions
  };
}
function applyBridgeResult(mirror, result) {
  mirror.now = result.state.now;
  for (const cell of result.state.inputs) {
    mirror.inputs.set(cell.id, cell.value);
  }
  const idxToNodeId = /* @__PURE__ */ new Map();
  for (const [nodeId, slot] of mirror.dictionary) {
    idxToNodeId.set(slot.idx, nodeId);
  }
  const changedNodes = [];
  for (const slot of result.commit.changedNodes) {
    const nodeId = idxToNodeId.get(slot);
    if (nodeId !== void 0) {
      changedNodes.push(nodeId);
    }
  }
  return {
    time: result.commit.time,
    intent: result.commit.intent,
    changedNodes,
    originatedAt: void 0
  };
}
function applyBatchBridgeResult(mirror, result) {
  mirror.now = result.state.now;
  for (const cell of result.state.inputs) {
    mirror.inputs.set(cell.id, cell.value);
  }
  const idxToNodeId = /* @__PURE__ */ new Map();
  for (const [nodeId, slot] of mirror.dictionary) {
    idxToNodeId.set(slot.idx, nodeId);
  }
  const commits = [];
  for (const record of result.commits) {
    const changedNodes = [];
    for (const slot of record.changedNodes) {
      const nodeId = idxToNodeId.get(slot);
      if (nodeId !== void 0) {
        changedNodes.push(nodeId);
      }
    }
    commits.push({
      time: record.time,
      intent: record.intent,
      changedNodes,
      originatedAt: void 0
    });
  }
  return commits;
}

// wasm/index.ts
var DEFAULT_WASM_ENGINE_MODE = "rust-ssot";
var modulePromiseByBridge = /* @__PURE__ */ new Map();
function __resetWasmBackendCacheForTests() {
  for (const ref of liveWasmBackends) {
    ref.deref()?.disposeAuthoritativeEngine();
  }
  liveWasmBackends.clear();
  modulePromiseByBridge.clear();
  compiledModuleByBridge.clear();
  preloadFingerprintByBridge.clear();
  resolvedModuleByBridge.clear();
  defaultPreloadedBridge = void 0;
  cacheEpoch += 1;
  sharedInstanceByKey.clear();
  sharedInstancesReset.clear();
  importedSidecarHrefs.length = 0;
}
async function detectBridge() {
  return "wasmgc-classic";
}
var CONSOLIDATED_BRIDGE_ARTEFACT_FILENAME = "causl_engine_bridge_bg.wasm";
function wasmUrlFor(bridge, baseUrl) {
  const segment = bridgeArtifactSegment(bridge);
  const file = `${segment}/${CONSOLIDATED_BRIDGE_ARTEFACT_FILENAME}`;
  if (baseUrl) {
    const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const resolvedBase = new URL(base, resolveBaseOrigin());
    return new URL(file, resolvedBase);
  }
  return new URL(`./pkg/${file}`, import.meta.url);
}
function resolveBaseOrigin() {
  const doc = globalThis.document;
  if (typeof doc?.baseURI === "string" && doc.baseURI.length > 0) {
    return doc.baseURI;
  }
  const loc = globalThis.location;
  if (typeof loc?.href === "string" && loc.href.length > 0) {
    return loc.href;
  }
  return import.meta.url;
}
function bridgeArtifactSegment(bridge) {
  switch (bridge) {
    case "wasmgc-builtins":
      return "gc-builtins";
    case "wasmgc-classic":
      return "gc-classic";
    default:
      return bridge;
  }
}
function canonicalBridgeId(bridge) {
  const segment = bridgeArtifactSegment(bridge);
  const BUNDLER_SUFFIX = "-bundler";
  return segment.endsWith(BUNDLER_SUFFIX) ? segment.slice(0, -BUNDLER_SUFFIX.length) : segment;
}
var cacheEpoch = 0;
async function loadWasmBackend(options = {}) {
  const bridge = options.bridge ?? await detectBridge();
  let cached = modulePromiseByBridge.get(bridge);
  if (cached) return cached;
  cached = instantiateBackend(bridge, options);
  modulePromiseByBridge.set(bridge, cached);
  cached.catch(() => modulePromiseByBridge.delete(bridge));
  return cached;
}
async function createCauslWasm(options = {}) {
  const { create, ...loadOpts } = options;
  try {
    const handle = await preloadCauslWasm(loadOpts);
    return constructWasmGraphSync(
      handle,
      resolvePerGraphBackendParams(loadOpts, handle.bridge),
      create ?? {}
    );
  } catch (err) {
    if (loadOpts.fallbackToTs === true || loadOpts.fallbackToJs === true) {
      return createCauslTs(create);
    }
    throw err;
  }
}
async function activateAutoMigrationBackend(options = {}) {
  return loadWasmBackend(options);
}
var WasmBackendUnavailableError = class extends Error {
  code = "CAUSL_WASM_NOT_BUILT";
  constructor(bridge) {
    super(
      `@causl/client-ts/wasm: the wasm artefact for bridge '${bridge}' is not resolvable on this host. The Rust engine artefact must be reachable at load time \u2014 on a browser/bundler host, vendor the wasm-pkg/<bridge>-bundler/ tree, serve it, and pass { wasmBaseUrl, computeImportsUrl }; on Node, a source/linked checkout resolves wasm-pkg/ zero-config (see wasm/README.md).`
    );
    this.name = "WasmBackendUnavailableError";
  }
};
var WasmEngineUnavailableError = class extends CauslError {
  name = "WasmEngineUnavailableError";
  // The declared type admits the §18A.12 subclass code so
  // {@link CauslWasmNotPreloadedError} can `override` it (the base
  // instances still carry the literal `'CAUSL_WASM_ENGINE_UNAVAILABLE'`
  // value — branching on `error.code === 'CAUSL_WASM_ENGINE_UNAVAILABLE'`
  // is unchanged).
  code = "CAUSL_WASM_ENGINE_UNAVAILABLE";
  /** The underlying resolution failure, if any. */
  cause;
  constructor(detail, cause) {
    super(
      `@causl/client-ts/wasm: the wasm engine was explicitly requested but could not be loaded \u2014 refusing to silently fall back to the TS engine.

${detail}

The wasm engine is the REAL Rust engine (rust-ssot, the production default); this failure means the artefact was not resolvable or not instantiable on THIS host \u2014 not that wasm support is unshipped. On a browser/bundler host (e.g. Vite), vendor the wasm-pkg/<bridge>-bundler/ tree, serve it, and pass { wasmBaseUrl, computeImportsUrl } to preloadCauslWasm(). To opt into the soft path (a pure-TS Graph instead of this throw), pass { fallbackToTs: true }.`
    );
    this.name = "WasmEngineUnavailableError";
    if (cause !== void 0) this.cause = cause;
  }
};
var CauslWasmNotPreloadedError = class extends WasmEngineUnavailableError {
  code = "CAUSL_WASM_NOT_PRELOADED";
  /** The bridge the sync factory tried to resolve a handle for. */
  bridge;
  constructor(bridge) {
    super(
      `createCauslWasmSync() found no preloaded wasm module for bridge '${bridge}'. The sync factory never silently awaits \u2014 call
    await preloadCauslWasm({ bridge: '${bridge}' })
ONCE at app init (before first render that builds a wasm graph), then createCauslWasmSync() is fully synchronous thereafter. To degrade to the pure-TS engine instead of throwing, pass createCauslWasmSync(undefined, { fallbackToTs: true }).`
    );
    this.name = "CauslWasmNotPreloadedError";
    this.bridge = bridge;
  }
};
var CauslWasmPreloadConflictError = class extends CauslError {
  name = "CauslWasmPreloadConflictError";
  code = "CAUSL_WASM_PRELOAD_CONFLICT";
  /** The resolved bridge the conflicting re-preload targeted. */
  bridge;
  /** The option names whose values differ from the first preload. */
  conflictingOptions;
  constructor(bridge, conflictingOptions) {
    super(
      `@causl/client-ts/wasm: preloadCauslWasm() was called again for bridge '${bridge}' with option(s) that CONFLICT with the options it was first preloaded under: ${conflictingOptions.join(", ")}.

The preload cache is keyed by bridge and holds the FIRST caller's resolved module + params; a differing later call would be silently dropped (you would keep getting the first artefact/params), so it is rejected here instead. A given bridge resolves ONE artefact for the process lifetime \u2014 pin a DISTINCT bridge per artefact location, or (in tests/HMR) reset the cache before re-preloading. Re-preload with the IDENTICAL options is still idempotent.`
    );
    this.name = "CauslWasmPreloadConflictError";
    this.bridge = bridge;
    this.conflictingOptions = conflictingOptions;
  }
};
var compiledModuleByBridge = /* @__PURE__ */ new Map();
var preloadFingerprintByBridge = /* @__PURE__ */ new Map();
function preloadFingerprintOf(options) {
  const ci = options.computeImportsUrl;
  return {
    wasmBaseUrl: options.wasmBaseUrl,
    computeImportsUrl: ci === void 0 ? void 0 : typeof ci === "string" ? ci : ci.href,
    fetch: options.fetch
  };
}
function conflictingPreloadOptions(first, next) {
  const keys = [
    "wasmBaseUrl",
    "computeImportsUrl",
    "fetch"
  ];
  return keys.filter((k) => first[k] !== next[k]);
}
var resolvedModuleByBridge = /* @__PURE__ */ new Map();
var defaultPreloadedBridge;
async function preloadCauslWasm(options = {}) {
  const requested = options.bridge ?? await detectBridge();
  const bridge = canonicalBridgeId(requested);
  const fingerprint = preloadFingerprintOf(options);
  const cached = compiledModuleByBridge.get(bridge);
  if (cached) {
    const first = preloadFingerprintByBridge.get(bridge);
    if (first !== void 0) {
      const conflicts = conflictingPreloadOptions(first, fingerprint);
      if (conflicts.length > 0) {
        throw new CauslWasmPreloadConflictError(requested, conflicts);
      }
    }
    return cached;
  }
  const compiling = compileCauslWasmModuleOrCapabilitySentinel(bridge, options);
  compiledModuleByBridge.set(bridge, compiling);
  preloadFingerprintByBridge.set(bridge, fingerprint);
  compiling.then(
    (handle) => {
      resolvedModuleByBridge.set(bridge, handle);
      defaultPreloadedBridge = bridge;
    },
    // Transient-failure guard — drop the in-flight entry so the next call
    // retries (mirrors loadWasmBackend's cache-poison guard). #144 — drop the
    // fingerprint in lockstep so the retry is not judged a conflict.
    () => {
      compiledModuleByBridge.delete(bridge);
      preloadFingerprintByBridge.delete(bridge);
    }
  );
  return compiling;
}
async function compileCauslWasmModuleOrCapabilitySentinel(bridge, options) {
  try {
    return await compileCauslWasmModule(bridge, options);
  } catch (err) {
    if (!isWasmCapabilityError(err)) throw err;
    const cause = err instanceof WasmEngineUnavailableError ? err.cause ?? err : err;
    return makeCapabilityUnavailableHandle(bridge, cause);
  }
}
function makeCapabilityUnavailableHandle(bridge, cause) {
  return Object.freeze({
    bridge,
    epoch: cacheEpoch,
    capabilityUnavailable: { cause },
    // Inert placeholders — never read (all construct paths gate on
    // `capabilityUnavailable` first). Present only to satisfy the handle shape.
    module: void 0,
    sidecar: void 0,
    sidecarHref: void 0,
    imports: {},
    computeImports: void 0,
    graphName: `causl.wasm.${bridge}`,
    engineMode: "js-ssot",
    batchedFlush: void 0,
    retentionCaps: void 0
  });
}
async function compileCauslWasmModule(bridge, options) {
  try {
    let resolvedBridge = bridge;
    let wasmBaseUrl = options.wasmBaseUrl;
    if (wasmBaseUrl === void 0) {
      const base = await resolveDefaultWasmBase(bridge);
      if (base !== void 0) {
        wasmBaseUrl = base.wasmBaseUrl;
        resolvedBridge = base.bridgeSegment;
      }
    }
    const wasmUrl = wasmUrlFor(resolvedBridge, wasmBaseUrl);
    const compiled = await compileConsolidatedBridge(wasmUrl, options.fetch);
    if (compiled === void 0) {
      throw new WasmEngineUnavailableError(
        `the consolidated bridge artefact for bridge '${resolvedBridge}' could not be read or compiled (resolved URL: ${wasmUrl.href}).`
      );
    }
    const computeImportsUrl = options.computeImportsUrl ?? await resolveComputeImportsUrl(resolvedBridge, wasmBaseUrl);
    const computeImportsHref = typeof computeImportsUrl === "string" ? computeImportsUrl : computeImportsUrl.href;
    const computeImports = await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      computeImportsHref
    );
    const perGraph = resolvePerGraphBackendParams(options, bridge);
    return Object.freeze({
      bridge,
      epoch: cacheEpoch,
      module: compiled.module,
      sidecar: compiled.sidecar,
      sidecarHref: compiled.sidecarHref,
      imports: compiled.imports,
      computeImports,
      graphName: perGraph.graphName,
      engineMode: perGraph.engineMode,
      batchedFlush: perGraph.batchedFlush,
      retentionCaps: perGraph.retentionCaps
    });
  } catch (err) {
    if (err instanceof WasmEngineUnavailableError) throw err;
    throw new WasmEngineUnavailableError(
      err instanceof Error ? err.message : String(err),
      err
    );
  }
}
async function resolveComputeImportsUrl(bridge, baseUrl) {
  const wasmUrl = wasmUrlFor(bridge, baseUrl);
  const snippetsDir = new URL("./snippets/", wasmUrl);
  if (snippetsDir.protocol !== "file:") {
    throw new Error(
      `@causl/client-ts/wasm: cannot auto-resolve causl-compute-imports.js under ${snippetsDir.href} \u2014 the snippets/<crate-hash>/ segment is content-addressed and a non-file URL cannot be enumerated. Pass { computeImportsUrl } pointing at the served snippet (vendor the wasm-pkg/<bridge>-bundler/ tree and serve it alongside { wasmBaseUrl }).`
    );
  }
  const fs = await import("node:fs/promises");
  const url2 = await import("node:url");
  if (typeof url2.fileURLToPath !== "function" || typeof fs.readFile !== "function" || typeof fs.readdir !== "function" || typeof fs.access !== "function") {
    throw new Error(
      `@causl/client-ts/wasm: cannot auto-resolve causl-compute-imports.js \u2014 this host has no usable node:fs/node:url (browser/bundler stubs). Pass { computeImportsUrl } pointing at the served snippet (vendor the wasm-pkg/<bridge>-bundler/ tree and serve it alongside { wasmBaseUrl }).`
    );
  }
  const sidecarHref = sidecarHrefFor(wasmUrl);
  if (sidecarHref !== void 0) {
    const fromSidecar = await resolveSnippetFromSidecarGlue(
      new URL(sidecarHref),
      fs.readFile,
      url2.fileURLToPath
    );
    if (fromSidecar !== void 0) return fromSidecar;
  }
  const dirPath = url2.fileURLToPath(snippetsDir);
  const hashDirs = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of hashDirs) {
    if (!entry.isDirectory()) continue;
    const candidate = new URL(
      `${entry.name}/causl-compute-imports.js`,
      snippetsDir
    );
    const candidatePath = url2.fileURLToPath(candidate);
    try {
      await fs.access(candidatePath);
      return candidate;
    } catch {
    }
  }
  throw new Error(
    `@causl/client-ts/wasm: could not resolve causl-compute-imports.js under ${dirPath}. Pass { computeImportsUrl } explicitly, or rebuild the artefact with the wasm:build pipeline.`
  );
}
var SIDECAR_SNIPPET_IMPORT_RE = /from\s*['"]([^'"]*snippets\/[^'"]*causl-compute-imports\.js)['"]/;
async function resolveSnippetFromSidecarGlue(sidecarUrl, readFile, fileURLToPath) {
  if (sidecarUrl.protocol !== "file:") return void 0;
  let source;
  try {
    source = await readFile(fileURLToPath(sidecarUrl), "utf8");
  } catch {
    return void 0;
  }
  const match = SIDECAR_SNIPPET_IMPORT_RE.exec(source);
  const specifier = match?.[1];
  if (specifier === void 0) return void 0;
  return new URL(specifier, sidecarUrl);
}
async function resolveDefaultWasmBase(bridge) {
  let path;
  let urlMod;
  let fs;
  try {
    path = await import("node:path");
    urlMod = await import("node:url");
    fs = await import("node:fs");
  } catch {
    return void 0;
  }
  if (!import.meta.url.startsWith("file:") || typeof path.dirname !== "function" || typeof path.join !== "function" || typeof urlMod.fileURLToPath !== "function" || typeof urlMod.pathToFileURL !== "function" || typeof fs.existsSync !== "function") {
    return void 0;
  }
  const selfDir = path.dirname(urlMod.fileURLToPath(import.meta.url));
  const segment = bridgeArtifactSegment(bridge);
  const filename = CONSOLIDATED_BRIDGE_ARTEFACT_FILENAME;
  const builtBase = path.join(selfDir, "pkg");
  if (fs.existsSync(path.join(builtBase, segment, filename))) {
    return {
      wasmBaseUrl: urlMod.pathToFileURL(builtBase + path.sep).href,
      bridgeSegment: bridge
    };
  }
  const srcBase = path.join(selfDir, "..", "wasm-pkg");
  const bundlerSegment = `${segment}-bundler`;
  if (fs.existsSync(path.join(srcBase, bundlerSegment, filename))) {
    return {
      wasmBaseUrl: urlMod.pathToFileURL(srcBase + path.sep).href,
      bridgeSegment: bundlerSegment
    };
  }
  return void 0;
}
async function compileConsolidatedBridge(url, fetchImpl) {
  const read = await readArtefactBytes(url, fetchImpl);
  if (read.bytes === void 0) {
    if (read.cause !== void 0) {
      throw new WasmEngineUnavailableError(
        `the consolidated bridge artefact could not be read or compiled (resolved URL: ${url.href}).`,
        read.cause
      );
    }
    return void 0;
  }
  const bytes = read.bytes;
  if (forcedCompileThrow !== void 0) {
    throw forcedCompileThrow();
  }
  const module = await WebAssembly.compile(bytes);
  const baseSidecarHref = sidecarHrefFor(url);
  if (baseSidecarHref === void 0) {
    throw new WasmEngineUnavailableError(
      `the wasm-bindgen '_bg.js' sidecar URL could not be derived from the artefact URL '${url.href}' (expected a '\u2026_bg.wasm' name). A hashed, query-carrying, or otherwise rewritten asset URL makes the sidecar unresolvable; the raw wasm exports use the lowered wasm-bindgen ABI and MUST NOT be called directly. Serve the '_bg.js' glue next to the '.wasm' under an unrewritten '\u2026_bg.wasm' name (or pass an explicit { wasmBaseUrl } whose artefact keeps that name).`
    );
  }
  const loaded = await tryLoadBridgeSidecar(baseSidecarHref);
  if (!loaded.ok) {
    throw new WasmEngineUnavailableError(
      `the wasm-bindgen '_bg.js' sidecar next to the artefact could not be loaded (resolved glue href: '${baseSidecarHref}'). The marshaled byte-buffer externs (apply_commands, read_cell_value, \u2026) live in this sidecar; without it only the raw lowered-ABI exports remain, which must NEVER be called directly. Ensure the wasm-bindgen '\u2026_bg.js' glue ships and is served next to the '.wasm'.`,
      loaded.cause
    );
  }
  const { sidecar, href: sidecarHref } = loaded;
  const imports = buildBridgeImportsFromSidecar(module, sidecar);
  if (imports === void 0) {
    throw new WasmEngineUnavailableError(
      `the wasm-bindgen '_bg.js' sidecar at '${sidecarHref}' does not expose every import the compiled module requires (a required '__wbg_*' glue export or the host 'wasm:js-string' surface is missing) \u2014 the sidecar ABI does not match the artefact. Rebuild the artefact + sidecar together with the wasm:build pipeline.`
    );
  }
  return { module, imports, sidecar, sidecarHref };
}
function sidecarHrefFor(wasmUrl) {
  const href = wasmUrl.href.replace(/_bg\.wasm$/, "_bg.js");
  return href === wasmUrl.href ? void 0 : href;
}
var sharedInstanceByKey = /* @__PURE__ */ new Map();
var sharedInstancesReset = /* @__PURE__ */ new Set();
var forcedInstantiateThrow;
function assertTestSeamAllowed(seam) {
  let isProduction = false;
  try {
    const proc = globalThis.process;
    isProduction = proc?.env?.NODE_ENV === "production";
  } catch {
    isProduction = false;
  }
  if (isProduction) {
    throw new Error(
      `@causl/client-ts/wasm: ${seam} is a test-only seam and cannot be armed in a production build (NODE_ENV=production)`
    );
  }
}
function __forceWasmInstantiateUnavailableForTests(makeError) {
  if (makeError === void 0) {
    forcedInstantiateThrow = void 0;
    return;
  }
  assertTestSeamAllowed("__forceWasmInstantiateUnavailableForTests");
  forcedInstantiateThrow = makeError;
  sharedInstanceByKey.clear();
  sharedInstancesReset.clear();
}
var forcedCompileThrow;
function __forceWasmCompileUnavailableForTests(makeError) {
  if (makeError !== void 0) {
    assertTestSeamAllowed("__forceWasmCompileUnavailableForTests");
  }
  forcedCompileThrow = makeError;
  compiledModuleByBridge.clear();
  preloadFingerprintByBridge.clear();
  resolvedModuleByBridge.clear();
  defaultPreloadedBridge = void 0;
  cacheEpoch += 1;
  sharedInstanceByKey.clear();
  sharedInstancesReset.clear();
}
var forcedSidecarThrow;
function __forceSidecarUnavailableForTests(makeError) {
  forcedSidecarThrow = makeError;
  compiledModuleByBridge.clear();
  preloadFingerprintByBridge.clear();
  resolvedModuleByBridge.clear();
  defaultPreloadedBridge = void 0;
  cacheEpoch += 1;
  sharedInstanceByKey.clear();
  sharedInstancesReset.clear();
}
function isWasmCapabilityError(err) {
  const w = WebAssembly;
  const isCapabilityShaped = (e) => w.CompileError !== void 0 && e instanceof w.CompileError || w.LinkError !== void 0 && e instanceof w.LinkError;
  if (isCapabilityShaped(err)) return true;
  if (err instanceof WasmEngineUnavailableError) {
    return isCapabilityShaped(err.cause);
  }
  return false;
}
function instantiateConsolidatedBridgeSync(compiled) {
  if (forcedInstantiateThrow !== void 0) {
    throw forcedInstantiateThrow();
  }
  const { module, imports, sidecar, sidecarHref } = compiled;
  const key = sidecarHref ?? module;
  const existing = sharedInstanceByKey.get(key);
  if (existing !== void 0) return existing;
  let exports;
  if (sidecar !== void 0 && sidecarHref !== void 0) {
    const instance = new WebAssembly.Instance(module, imports);
    sidecar.__wbg_set_wasm(instance.exports);
    exports = sidecar;
  } else {
    const instance = new WebAssembly.Instance(module, imports);
    if (sidecar !== void 0) {
      sidecar.__wbg_set_wasm(instance.exports);
      exports = sidecar;
    } else {
      exports = instance.exports;
    }
  }
  assertBridgeAbiSmokeProbe(exports);
  sharedInstanceByKey.set(key, exports);
  return exports;
}
function assertBridgeAbiSmokeProbe(exports) {
  const intern = exports.intern_string;
  const read = exports.read_interned_string;
  if (typeof intern !== "function" || typeof read !== "function") return;
  let roundTripped;
  try {
    const stringId = intern(new Uint8Array([97]));
    roundTripped = read(stringId);
  } catch (err) {
    throw new WasmEngineUnavailableError(
      `the wasm bridge surface failed its load-time ABI smoke-probe: calling intern_string / read_interned_string threw. This is the signature of a WRONG ABI \u2014 e.g. the raw wasm-bindgen lowered exports mistaken for the marshaled '_bg.js' sidecar surface. Refusing to hand a corrupt-on-first-use engine to the caller.`,
      err
    );
  }
  if (roundTripped !== "a") {
    throw new WasmEngineUnavailableError(
      `the wasm bridge surface failed its load-time ABI smoke-probe: read_interned_string(intern_string('a')) returned ${JSON.stringify(roundTripped)} instead of 'a'. This is the signature of a WRONG ABI (the raw lowered wasm-bindgen exports coerce the Uint8Array argument to 0 and shift the return), so the engine would corrupt linear memory at the first commit. Refusing to hand it to the caller.`
    );
  }
}
var sidecarCompileEpoch = 0;
var importedSidecarHrefs = [];
function __sidecarImportHrefsForTests() {
  return importedSidecarHrefs.slice();
}
async function tryLoadBridgeSidecar(sidecarHref) {
  if (forcedSidecarThrow !== void 0) {
    return { ok: false, cause: forcedSidecarThrow() };
  }
  let href = sidecarHref;
  try {
    const epoch = sidecarCompileEpoch;
    sidecarCompileEpoch += 1;
    if (epoch > 0) {
      const bust = `${sidecarHref.includes("?") ? "&" : "?"}__causlCompile=${epoch}`;
      href = sidecarHref + bust;
    }
    importedSidecarHrefs.push(href);
    const mod = await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      href
    );
    if (typeof mod.__wbg_set_wasm !== "function") {
      return {
        ok: false,
        cause: new Error(
          `@causl/client-ts/wasm: the module at '${href}' does not export '__wbg_set_wasm' \u2014 it is not a valid wasm-bindgen '_bg.js' glue sidecar.`
        )
      };
    }
    return { ok: true, sidecar: mod, href };
  } catch (err) {
    return { ok: false, cause: err };
  }
}
function buildBridgeImportsFromSidecar(module, sidecar) {
  const imports = {};
  const wasmString = WebAssembly.String;
  for (const desc of WebAssembly.Module.imports(module)) {
    const ns = imports[desc.module] ??= {};
    if (desc.module === "wasm:js-string") {
      const member = wasmString !== void 0 ? wasmString[desc.name] : void 0;
      if (member !== void 0) {
        ns[desc.name] = member;
        continue;
      }
      return void 0;
    }
    if (desc.kind === "function") {
      const glue = sidecar[desc.name];
      if (typeof glue !== "function") {
        return void 0;
      }
      ns[desc.name] = glue;
    }
  }
  return imports;
}
async function readArtefactBytes(url, fetchImpl) {
  try {
    if (url.protocol === "file:") {
      const fs = await import("node:fs/promises");
      const url2 = await import("node:url");
      const filePath = url2.fileURLToPath(url);
      const buf2 = await fs.readFile(filePath);
      return { bytes: new Uint8Array(buf2) };
    }
    const f = fetchImpl ?? fetch;
    const resp = await f(url.href, { method: "GET" });
    if (!resp.ok) return { bytes: void 0 };
    const buf = await resp.arrayBuffer();
    return { bytes: new Uint8Array(buf) };
  } catch (cause) {
    return { bytes: void 0, cause };
  }
}
async function loadAuthoritativeWasm(options = {}) {
  try {
    return await loadAuthoritativeWasmEngine(options);
  } catch (err) {
    if (options.fallbackToTs === true || options.fallbackToJs === true) {
      const retentionCaps = resolveRetentionCaps(options);
      return new JsFallbackBackend({
        ...options.graphName !== void 0 ? { name: options.graphName } : {},
        ...retentionCaps?.commitHistoryCap !== void 0 ? { commitHistoryCap: retentionCaps.commitHistoryCap } : {},
        ...retentionCaps?.snapshotRetentionCap !== void 0 ? { snapshotRetentionCap: retentionCaps.snapshotRetentionCap } : {}
      });
    }
    if (err instanceof WasmEngineUnavailableError) throw err;
    throw new WasmEngineUnavailableError(
      err instanceof Error ? err.message : String(err),
      err
    );
  }
}
async function loadAuthoritativeWasmEngine(options = {}) {
  const bridge = options.bridge ?? await detectBridge();
  const handle = await compileCauslWasmModule(bridge, options);
  const exports = instantiateConsolidatedBridgeSync({
    module: handle.module,
    imports: handle.imports,
    sidecar: handle.sidecar,
    sidecarHref: handle.sidecarHref
  });
  const backend = new WasmBackend(
    handle.bridge,
    handle.graphName,
    handle.batchedFlush,
    handle.engineMode,
    handle.retentionCaps
  );
  backend.__attachWasmExportsForTests(exports);
  backend.__enableAuthoritativeWasm(handle.computeImports);
  const engine = backend.getAuthoritativeEngine();
  if (engine === void 0) {
    throw new Error(
      "@causl/client-ts/wasm: authoritative engine was not installed after __enableAuthoritativeWasm(). This is a wiring bug."
    );
  }
  return engine;
}
function isCauslWasmPreloaded(bridge) {
  return getPreloadedCauslWasm(bridge) !== void 0;
}
function getPreloadedCauslWasm(bridge) {
  const key = bridge !== void 0 ? canonicalBridgeId(bridge) : defaultPreloadedBridge;
  if (key === void 0) return void 0;
  return resolvedModuleByBridge.get(key);
}
function createCauslWasmSync(handle, create) {
  const { fallbackToTs, fallbackToJs, ...createOpts } = create ?? {};
  const softFallback = fallbackToTs === true || fallbackToJs === true;
  const resolvedBridge = handle?.bridge ?? defaultPreloadedBridge ?? UNRESOLVED_BRIDGE;
  const resolved = handle ?? getPreloadedCauslWasm(resolvedBridge);
  if (resolved === void 0) {
    if (softFallback) {
      return createCauslTs(createOpts);
    }
    throw new CauslWasmNotPreloadedError(resolvedBridge);
  }
  if (resolved.epoch !== cacheEpoch) {
    if (softFallback) return createCauslTs(createOpts);
    throw new WasmEngineUnavailableError(
      `createCauslWasmSync(): the supplied handle for bridge '${resolved.bridge}' is STALE \u2014 it was preloaded under a previous cache generation that has since been cleared (its shared wasm instance and '_bg.js' glue were torn down). Re-run preloadCauslWasm() and construct from the handle it returns.`
    );
  }
  const preloadedForBridge = getPreloadedCauslWasm(resolved.bridge);
  if (preloadedForBridge !== void 0 && preloadedForBridge !== resolved) {
    throw new WasmEngineUnavailableError(
      `createCauslWasmSync(): the supplied handle for bridge '${resolved.bridge}' does not match the preloaded module for that bridge. A handle must be the value returned by preloadCauslWasm() for its own bridge.`
    );
  }
  try {
    return constructWasmGraphSync(
      resolved,
      perGraphParamsForSync(createOpts, resolved),
      createOpts
    );
  } catch (err) {
    if (softFallback) return createCauslTs(createOpts);
    throw err;
  }
}
function perGraphParamsForSync(createOpts, handle) {
  const retentionCaps = mergePerCallRetentionCaps(createOpts, handle.retentionCaps);
  if (createOpts.engine === void 0) return { ...handle, retentionCaps };
  const engineMode = resolveWasmEngineMode(createOpts.engine);
  return { ...handle, engineMode, batchedFlush: createOpts.batchedFlush, retentionCaps };
}
function mergePerCallRetentionCaps(createOpts, inherited) {
  const commitHistoryCap = createOpts.commitHistoryCap ?? inherited?.commitHistoryCap;
  const snapshotRetentionCap = createOpts.snapshotRetentionCap ?? inherited?.snapshotRetentionCap;
  if (commitHistoryCap === void 0 && snapshotRetentionCap === void 0) {
    return void 0;
  }
  return {
    ...commitHistoryCap !== void 0 ? { commitHistoryCap } : {},
    ...snapshotRetentionCap !== void 0 ? { snapshotRetentionCap } : {}
  };
}
function resolvePerGraphBackendParams(options, resolvedBridge) {
  const engineMode = resolveWasmEngineMode(options.engine);
  const batchedFlush = options.batchedFlush;
  const graphName = options.graphName ?? `causl.wasm.${resolvedBridge}`;
  return {
    graphName,
    engineMode,
    batchedFlush,
    // lift-readat (#170) — carry the adopter's retention caps so the
    // construct threads them into the wrapped TS `#graph`.
    retentionCaps: resolveRetentionCaps(options)
  };
}
function constructWasmGraphSync(resolved, perGraph, createOpts) {
  if (resolved.capabilityUnavailable !== void 0) {
    throw new WasmEngineUnavailableError(
      `the WasmGC engine could not COMPILE on this host (bridge '${resolved.bridge}'). This is the \xA718A.13.1 WasmGC-unavailable capability failure (validation-time \u2014 the mode real incapable hosts produce).`,
      resolved.capabilityUnavailable.cause
    );
  }
  let exports;
  try {
    exports = instantiateConsolidatedBridgeSync({
      module: resolved.module,
      imports: resolved.imports,
      sidecar: resolved.sidecar,
      sidecarHref: resolved.sidecarHref
    });
  } catch (err) {
    if (err instanceof WasmEngineUnavailableError) throw err;
    throw new WasmEngineUnavailableError(
      `createCauslWasmSync(): the WasmGC engine could not instantiate on this host (bridge '${resolved.bridge}'). This is the \xA718A.13.1 WasmGC-unavailable capability failure.`,
      err
    );
  }
  const backend = new WasmBackend(
    resolved.bridge,
    perGraph.graphName,
    perGraph.batchedFlush,
    perGraph.engineMode,
    perGraph.retentionCaps
  );
  backend.__attachWasmExportsForTests(exports);
  backend.__enableAuthoritativeWasm(resolved.computeImports);
  const engine = backend.getAuthoritativeEngine();
  if (engine === void 0) {
    throw new WasmEngineUnavailableError(
      "createCauslWasmSync(): the authoritative engine was not installed after __enableAuthoritativeWasm(). This is a wiring bug."
    );
  }
  const graph = createCausl(
    withInjectedBackend(
      withResolvedRetentionCaps(createOpts, perGraph.retentionCaps),
      engine
    )
  );
  wasmBackendByGraph.set(graph, backend);
  registerWasmGraphTeardown(graph, backend);
  return graph;
}
function withResolvedRetentionCaps(options, retentionCaps) {
  const { commitHistoryCap: _c, snapshotRetentionCap: _s, ...rest } = options;
  return {
    ...rest,
    ...retentionCaps?.commitHistoryCap !== void 0 ? { commitHistoryCap: retentionCaps.commitHistoryCap } : {},
    ...retentionCaps?.snapshotRetentionCap !== void 0 ? { snapshotRetentionCap: retentionCaps.snapshotRetentionCap } : {}
  };
}
var wasmBackendByGraph = /* @__PURE__ */ new WeakMap();
var wasmGraphTeardowns = /* @__PURE__ */ new WeakMap();
var liveWasmBackends = /* @__PURE__ */ new Set();
var wasmGraphFinalizers = typeof FinalizationRegistry === "function" ? new FinalizationRegistry((token) => {
  token.backend.disposeAuthoritativeEngine();
  liveWasmBackends.delete(token.ref);
}) : void 0;
function registerWasmGraphTeardown(graph, backend) {
  const ref = new WeakRef(backend);
  liveWasmBackends.add(ref);
  const teardown = () => {
    backend.disposeAuthoritativeEngine();
    wasmBackendByGraph.delete(graph);
    wasmGraphTeardowns.delete(graph);
    liveWasmBackends.delete(ref);
    wasmGraphFinalizers?.unregister(graph);
  };
  wasmGraphTeardowns.set(graph, teardown);
  wasmGraphFinalizers?.register(graph, { backend, ref }, graph);
  const attach = (key) => {
    Object.defineProperty(graph, key, {
      value: teardown,
      configurable: true,
      writable: true,
      enumerable: false
    });
  };
  attach("dispose");
  if (typeof Symbol.dispose === "symbol") attach(Symbol.dispose);
}
function disposeCauslWasmGraph(graph) {
  wasmGraphTeardowns.get(graph)?.();
}
function __wasmBackendForTests(graph) {
  return wasmBackendByGraph.get(graph);
}
var UNRESOLVED_BRIDGE = "<none-preloaded>";
registerWasmSyncEngine({
  isPreloadedForDefaultBridge: () => isCauslWasmPreloaded(),
  createSync: (createOptions) => createCauslWasmSync(void 0, createOptions),
  // §18A.13.1 / #124 — only a POSITIVELY-classified WasmGC host-capability
  // failure degrades the implicit createCausl() path to the TS floor. The base
  // `'CAUSL_WASM_ENGINE_UNAVAILABLE'` code is NOT sufficient on its own:
  // `constructWasmGraphSync` normalises EVERY instantiate-time throw — including
  // genuine wiring bugs ('authoritative engine was not installed') and
  // artefact/sidecar version skew on an otherwise healthy host — into that same
  // base code. Matching the code alone therefore misdiagnosed those failures as
  // 'Safari < 18 / Node <= 20' and silently degraded the whole fleet to the TS
  // floor, contradicting the contract that any non-capability throw propagates.
  //
  // Instead, classify by SHAPE via `isWasmCapabilityError`: a genuine WasmGC
  // host-capability failure is a `WebAssembly.CompileError` / `LinkError`
  // (raw, or wrapped one `cause` level deep inside the normalised
  // `WasmEngineUnavailableError`). The not-preloaded subclass, a missing/unserved
  // artefact, and any wiring/version-skew bug carry no such cause ⇒ classified
  // `false` ⇒ they propagate on every path (loud) instead of degrading.
  isCapabilityFailure: (err) => isWasmCapabilityError(err)
});
async function instantiateBackend(bridge, options) {
  void wasmUrlFor(bridge, options.wasmBaseUrl);
  void options.fetch;
  const graphName = options.graphName ?? `causl.wasm.${bridge}`;
  const engineMode = resolveWasmEngineMode(options.engine);
  const batchedFlush = options.batchedFlush;
  return new WasmBackend(
    bridge,
    graphName,
    batchedFlush,
    engineMode,
    resolveRetentionCaps(options)
  );
}
function resolveRetentionCaps(options) {
  if (options.commitHistoryCap === void 0 && options.snapshotRetentionCap === void 0) {
    return void 0;
  }
  return {
    ...options.commitHistoryCap !== void 0 ? { commitHistoryCap: options.commitHistoryCap } : {},
    ...options.snapshotRetentionCap !== void 0 ? { snapshotRetentionCap: options.snapshotRetentionCap } : {}
  };
}
function resolveWasmEngineMode(engine) {
  if (engine === void 0) return DEFAULT_WASM_ENGINE_MODE;
  if (engine !== "js-ssot" && engine !== "rust-ssot") {
    throw new RangeError(
      `createCausl({ engine }): engine must be 'js-ssot' or 'rust-ssot' (got ${JSON.stringify(engine)})`
    );
  }
  return engine;
}
var HOST_FLUSH_TIMER = {
  schedule(callback, ms) {
    const h = setTimeout(callback, ms);
    h.unref?.();
    return h;
  },
  cancel(handle) {
    clearTimeout(handle);
  }
};
var BatchedFlush = class {
  /** Count-based flush threshold. `1` = flush every commit (default). */
  afterN;
  /**
   * C.3 PR 2 (#1501) — time-based flush threshold (ms). Default 16 ms
   * = one animation frame at 60 Hz (option-c doc §2.2). `0` disables
   * the time trigger (count / manual / implicit only). A flush is
   * scheduled when the FIRST commit is buffered and fires after
   * `intervalMs` unless the count threshold flushes first.
   */
  intervalMs;
  /** Buffered per-commit shadow inputs, in commit order. */
  #buffer = [];
  /** The mirror the queue marshals against (Decision 1 SSOT — JS-side). */
  #mirror;
  /** Shadow bridge adapter (single + optional batched extern). */
  #bridge;
  /** Captured flush error for the determinism gate's assertion path. */
  #error;
  /**
   * promote-commit (causl/causl-core-rs#169) — the Rust canonical
   * {@link Commit} for the MOST RECENT flush, or `undefined` when there was
   * no rust-ssot flush this turn (`engine: 'js-ssot'`, the degrade
   * no-batched-extern path, or no flush this turn). Set to the LAST projected
   * Rust record of the window UNCONDITIONALLY under `'rust-ssot'` (§18A.8
   * fail-safe-removal — no byte-compare gates the promotion). RESET to
   * `undefined` as the FIRST statement of every {@link flush} (before the
   * buffer splice), so a stale value from a prior flush can NEVER be read as
   * this turn's canonical commit.
   *
   * This is the flush-boundary canonical-commit seam: under
   * `engine: 'rust-ssot'` with the synchronous `afterN === 1` window,
   * {@link WasmBackend.commit} reads this immediately after `enqueue` to RETURN
   * the Rust-derived `Commit` as the canonical authority. When this is
   * `undefined` (a buffered `afterN > 1` window, a timer-deferred flush, or
   * the `'js-ssot'` floor opt) the caller returns the wrapped TS-engine
   * `Commit`.
   */
  #lastPromotedCommit;
  /**
   * The `mirror.now` value the NEXT flush's envelope must start from
   * (the pre-batch clock). Set when the first commit is buffered so
   * the batch envelope's `state.now` matches what the SSOT TS engine
   * started the first buffered commit from — mirrors the pre-C.3
   * per-commit `mirror.now` sync (index.ts:581).
   */
  #pendingBaseNow;
  /** C.3 PR 2 — injectable timer surface. */
  #timer;
  /** C.3 PR 2 — handle of the in-flight interval timer (if any). */
  #timerHandle;
  /**
   * The per-graph engine canonicality mode threaded from
   * {@link WasmBackend.#engineMode}. `'rust-ssot'` (the default) makes
   * `flush()` apply the Rust `commit_batch` post-state to the mirror
   * UNCONDITIONALLY and expose the last projected `Commit` of the window
   * via {@link lastPromotedCommit} (§18A.8 fail-safe-removal — no
   * byte-compare, no rollback). `'js-ssot'` (the explicit floor opt) keeps
   * the Rust shadow applied but leaves {@link lastPromotedCommit}
   * `undefined`, so `WasmBackend.commit()` returns the wrapped TS-engine
   * `Commit` — byte-identical to dev `97da8420`.
   */
  #engineMode;
  constructor(mirror, bridge, afterN = 1, intervalMs = 16, timer = HOST_FLUSH_TIMER, engineMode = DEFAULT_WASM_ENGINE_MODE) {
    if (!Number.isInteger(afterN) || afterN < 1) {
      throw new RangeError(
        `BatchedFlush: afterN must be an integer >= 1 (got ${String(afterN)})`
      );
    }
    if (!Number.isFinite(intervalMs) || intervalMs < 0) {
      throw new RangeError(
        `BatchedFlush: intervalMs must be a finite number >= 0 (got ${String(intervalMs)})`
      );
    }
    this.#mirror = mirror;
    this.#bridge = bridge;
    this.afterN = afterN;
    this.intervalMs = intervalMs;
    this.#timer = timer;
    this.#engineMode = engineMode;
  }
  /** Number of commits currently buffered (un-flushed). */
  get pending() {
    return this.#buffer.length;
  }
  /**
   * promote-commit (causl/causl-core-rs#169) — the Rust canonical
   * {@link Commit} the MOST RECENT flush produced, or `undefined` when there
   * was no rust-ssot flush this turn (see {@link #lastPromotedCommit}).
   * {@link WasmBackend.commit} reads this immediately after a synchronous
   * (`afterN === 1`) `enqueue` to return the Rust-derived `Commit` as the
   * canonical authority under `rust-ssot`. `undefined` is the signal to
   * return the wrapped TS-engine `Commit` (the `'js-ssot'` floor opt).
   *
   * @internal Canonical-commit seam, not adopter-facing surface.
   */
  get lastPromotedCommit() {
    return this.#lastPromotedCommit;
  }
  /**
   * Captured flush error, if the most recent flush threw. Cleared on
   * the next successful flush. The cross-backend determinism gate
   * asserts this stays `undefined`.
   */
  get error() {
    return this.#error;
  }
  /**
   * Buffer one commit's shadow input. The `baseNow` is the TS graph's
   * PRE-commit clock for the FIRST buffered commit (the value the
   * batch envelope's `state.now` must carry); subsequent commits in
   * the same window do not move it (the Rust extern threads the
   * post-state internally). Triggers a count-based flush when the
   * buffer reaches `afterN`.
   */
  enqueue(input, baseNow) {
    if (this.#buffer.length === 0) {
      this.#pendingBaseNow = baseNow;
      if (this.intervalMs > 0) {
        this.#armTimer();
      }
    }
    this.#buffer.push(input);
    if (this.#buffer.length >= this.afterN) {
      this.flush();
    }
  }
  /**
   * C.3 PR 2 — schedule the interval flush. Cancels any prior handle
   * first (defensive — `enqueue` only arms on an empty buffer so this
   * is a single-armed invariant, but a future caller path must not
   * leak overlapping timers).
   */
  #armTimer() {
    this.#cancelTimer();
    this.#timerHandle = this.#timer.schedule(() => {
      this.#timerHandle = void 0;
      this.flush();
    }, this.intervalMs);
  }
  /** C.3 PR 2 — cancel the in-flight interval timer, if any. */
  #cancelTimer() {
    if (this.#timerHandle !== void 0) {
      this.#timer.cancel(this.#timerHandle);
      this.#timerHandle = void 0;
    }
  }
  /**
   * C.3 PR 2 — `true` when a time-based flush is currently armed.
   * Exposed for tests and the C.3 PR 3 implicit-flush callers (which
   * must cancel a pending timer when they force a synchronous flush).
   */
  get timerArmed() {
    return this.#timerHandle !== void 0;
  }
  /**
   * C.3 PR 2 — release the interval timer without flushing. Called by
   * the C.3 PR 3 dispose path; idempotent. Does NOT drain the buffer
   * (a caller that needs the bytes on the wire calls {@link flush}
   * first — the implicit-flush wiring in C.3 PR 3 does exactly that).
   */
  cancelTimer() {
    this.#cancelTimer();
  }
  /**
   * Flush the buffer as a single `commit_batch` envelope (or, if the
   * bridge lacks the batched extern, as N sequential single-commit
   * calls — byte-identical by construction, option-c doc §3.1). A
   * no-op when the buffer is empty (so implicit/manual flushes are
   * always safe to call). The projected `Commit[]` is returned for
   * the C.3 PR 3 implicit-flush callers; the per-commit subscriber
   * fire is the JS engine's job (Answer C — NOT batched here).
   */
  flush() {
    this.#cancelTimer();
    if (this.#buffer.length === 0) return [];
    this.#lastPromotedCommit = void 0;
    const batch = this.#buffer.splice(0, this.#buffer.length);
    const rustSsot = this.#engineMode === "rust-ssot";
    const baseNow = this.#pendingBaseNow ?? this.#mirror.now;
    this.#pendingBaseNow = void 0;
    try {
      this.#mirror.now = baseNow;
      const envelope = marshalBatchEnvelope(this.#mirror, batch);
      if (typeof this.#bridge.commit_batch === "function") {
        const result = this.#bridge.commit_batch(
          envelope.state,
          envelope.actions
        );
        const commits2 = applyBatchBridgeResult(this.#mirror, result);
        if (rustSsot) {
          this.#lastPromotedCommit = commits2[commits2.length - 1];
        }
        this.#error = void 0;
        return commits2;
      }
      const commits = [];
      for (const single of batch) {
        const singleEnv = marshalCommitEnvelope(
          this.#mirror,
          single.intent,
          single.writes
        );
        const singleResult = this.#bridge.commit(
          singleEnv.state,
          singleEnv.action
        );
        commits.push(applyBridgeResult(this.#mirror, singleResult));
      }
      this.#error = void 0;
      return commits;
    } catch (err) {
      this.#error = err;
      return [];
    }
  }
};
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
  /**
   * Per-instance counter incremented every time
   * `evaluateStatechart()` delegates to the canonical evaluator.
   * Exposed only via the dev-test seam {@link __evalCountersForTests}
   * so the 0.9.0-readiness no-fallback property gate can assert the
   * delegation path is taken (and the now-removed synthetic-forbidden
   * fallback is never invoked).
   *
   * @internal
   */
  #evalDelegateCount = 0;
  /**
   * Per-instance counter that MUST remain zero. The legacy
   * back-channel fallback (a synthetic-forbidden result with
   * `from='__backend-for-test-missing__'`) was removed in the
   * 0.9.0-readiness pass (issue #1122) because it masked real
   * divergence between the JS and WASM `evaluateStatechart`
   * implementations. The counter is retained as a forward-compat trip
   * wire: the no-fallback property gate asserts it is zero after every
   * trial so a future regression that re-introduces a silent fallback
   * fires the gate by construction.
   *
   * @internal
   */
  #syntheticFallbackCount = 0;
  /**
   * C.4 (#1505) — validated per-graph batched-flush config, or
   * `undefined` when the adopter did not opt in. When `undefined` the
   * backend behaves byte-identically to dev `b15069fa` (no queue, the
   * pre-C.3 per-commit shadow path) — the load-bearing C.4 acceptance
   * property. When present, a {@link BatchedFlush} queue is built from
   * it the moment a marshaler mirror + bridge are primed
   * (F-marshal.5 / future real bridge).
   */
  #batchedFlushConfig;
  /**
   * V2.1 (#1519) — the validated per-graph engine canonicality mode
   * (V2-DESIGN §2). `'rust-ssot'` (the default) makes the Rust
   * `commit_batch` post-state the UNCONDITIONAL canonical authority: the
   * batched-flush boundary applies it to the mirror and exposes its last
   * projected `Commit` as the adopter-facing return (§18A.8
   * fail-safe-removal — no per-flush byte-compare, no rollback, no
   * sticky-downgrade). `'js-ssot'` (the explicit floor opt, §18A.7
   * Criterion 5) keeps the wrapped TS engine canonical and the Rust
   * `commit_batch` result discarded into the shadow mirror —
   * byte-identical to dev `97da8420`.
   */
  #engineMode;
  /**
   * #82 — the resolved retention-caps bag this backend threaded into its
   * wrapped TS `#graph` (or `undefined` when the adopter supplied neither
   * cap). Retained ONLY for the per-graph-params fidelity probe
   * ({@link __retentionCapsForTests}); the runtime consumer is the
   * constructor's `createCauslTs` call.
   */
  #retentionCaps;
  /**
   * lift-export (causl/causl-core-rs#170) — the graph name the IR uses as its
   * `graphId` foreign key (the adopter's `createCausl({ name })`). Stored so
   * the rust-ssot `exportModel` reroute can stamp every node / commit / event
   * with it, byte-identical to the wrapped TS engine's `graphId`.
   */
  #graphName;
  constructor(bridge, graphName, batchedFlush, engineMode = DEFAULT_WASM_ENGINE_MODE, retentionCaps) {
    this.bridge = bridge;
    this.#graphName = graphName;
    this.#graph = createCauslTs({
      name: graphName,
      ...retentionCaps?.commitHistoryCap !== void 0 ? { commitHistoryCap: retentionCaps.commitHistoryCap } : {},
      ...retentionCaps?.snapshotRetentionCap !== void 0 ? { snapshotRetentionCap: retentionCaps.snapshotRetentionCap } : {}
    });
    this.#engineMode = engineMode;
    this.#retentionCaps = retentionCaps;
    if (batchedFlush !== void 0) {
      const afterN = batchedFlush.afterN ?? 1;
      const intervalMs = batchedFlush.intervalMs ?? 16;
      if (!Number.isInteger(afterN) || afterN < 1) {
        throw new RangeError(
          `createCausl({ batchedFlush }): afterN must be an integer >= 1 (got ${String(afterN)})`
        );
      }
      if (!Number.isFinite(intervalMs) || intervalMs < 0) {
        throw new RangeError(
          `createCausl({ batchedFlush }): intervalMs must be a finite number >= 0 (got ${String(intervalMs)})`
        );
      }
      this.#batchedFlushConfig = { afterN, intervalMs };
    } else {
      this.#batchedFlushConfig = void 0;
    }
  }
  // =====================================================================
  // WIRE (epic #31 / issue #32) — authoritative Rust→wasm seam.
  // =====================================================================
  /**
   * Per-instance reference to the consolidated bridge's wasm-bindgen exports
   * object (the `{ apply_commands, read_cell_value, intern_string, ... }`
   * marshaled surface). `undefined` until the live `WebAssembly.instantiate`
   * path attaches it via {@link __attachWasmExportsForTests}.
   *
   * @internal
   */
  #wasmExports;
  /**
   * WIRE — the authoritative wasm engine. When set, the four target adopter
   * ops (`commit` / `read` / `subscribe` / `now`) and derived registration
   * route through the REAL wasm engine as the source of truth (the engine is
   * injected into `createCausl({ injectedBackend })`); the wrapped TS `#graph`
   * is demoted to an optional oracle. `undefined` keeps the legacy Phase-1
   * shadow behaviour (TS engine SSOT).
   *
   * @internal
   */
  #authoritative;
  /**
   * Attach a live (or mock) wasm-exports object to this backend so the
   * authoritative seam can route through `apply_commands` / `read_cell_value`
   * / … . The production loader ({@link createCauslWasmSync} /
   * {@link loadAuthoritativeWasm}) calls this once the live instance is
   * available.
   *
   * @internal
   */
  __attachWasmExportsForTests(exports) {
    this.#wasmExports = exports;
  }
  /**
   * WIRE — flip this WasmBackend to wasm-AUTHORITATIVE for the four target
   * ops. Requires a live wasm-exports surface carrying the full-fidelity
   * externs (`apply_commands`, `read_cell_value`, `intern_string`,
   * `read_interned_string`) AND the `causl-compute-imports.js` snippet module
   * (to install the `__causl_compute` / `__causl_fire` handlers).
   *
   * Throws if the exports / imports are incomplete so a mis-wired cutover
   * surfaces eagerly rather than silently falling back.
   *
   * @internal
   */
  __enableAuthoritativeWasm(imports) {
    const ex = this.#wasmExports;
    if (ex === void 0) {
      throw new Error(
        "@causl/client-ts/wasm: __enableAuthoritativeWasm() requires a live wasm-exports surface \u2014 call __attachWasmExportsForTests() or instantiate the bridge first."
      );
    }
    const missing = [];
    if (typeof ex.apply_commands !== "function") missing.push("apply_commands");
    if (typeof ex.read_cell_value !== "function")
      missing.push("read_cell_value");
    if (typeof ex.intern_string !== "function") missing.push("intern_string");
    if (typeof ex.read_interned_string !== "function")
      missing.push("read_interned_string");
    if (missing.length > 0) {
      throw new Error(
        `@causl/client-ts/wasm: __enableAuthoritativeWasm() requires the serde-free authoritative surface; missing: ${missing.join(", ")}. Rebuild the artefact with the wasm:build pipeline.`
      );
    }
    const poolUnavailableShim = (name) => () => {
      throw new Error(
        `@causl/client-ts/wasm: \`${name}\` is absent from the lean (serde-free) production artefact. The authoritative codec ships containers as CONTENT_HASH markers held in an unbounded NodeId cache, so the value pool is never reached in the cutover; reaching this path means a non-cutover code path or a cache-invariant violation.`
      );
    };
    if (!sharedInstancesReset.has(ex)) {
      sharedInstancesReset.add(ex);
      ex.__resetEngineState?.();
      ex.__resetInternTable?.();
      ex.__resetValuePool?.();
    }
    const bridge = {
      apply_commands: ex.apply_commands,
      read_cell_value: ex.read_cell_value,
      intern_string: ex.intern_string,
      read_interned_string: ex.read_interned_string,
      register_value_buf: typeof ex.register_value_buf === "function" ? ex.register_value_buf : poolUnavailableShim(
        "register_value_buf"
      ),
      read_pool_value: typeof ex.read_pool_value === "function" ? ex.read_pool_value : poolUnavailableShim(
        "read_pool_value"
      ),
      // promote-read (causl/causl-core-rs#169) — bind the §12 read-side
      // STRUCTURAL externs when the rebuilt artefact carries them; leave them
      // `undefined` on a legacy bridge (the AuthoritativeWasmEngine's
      // structural reads throw a coherent "rebuild" error if reached, and the
      // facade only reaches them under `engine: 'rust-ssot'`). Read-only — no
      // commit / write path is affected.
      ...typeof ex.dependencies === "function" ? { dependencies: ex.dependencies } : {},
      ...typeof ex.dependents === "function" ? { dependents: ex.dependents } : {},
      ...typeof ex.commit_log === "function" ? { commit_log: ex.commit_log } : {},
      // #129 / causl/causl-core-rs#318 — bind the widened commit-log extern
      // when the rebuilt artefact carries it; leave it `undefined` on a
      // legacy bridge (the facade keeps the TS `commitHistory` ring and the
      // legacy `BeginCommit` body shapes — `ownsCommitLog()` reads `false`).
      ...typeof ex.commit_log_meta === "function" ? { commit_log_meta: ex.commit_log_meta } : {},
      // causl-client#129 / causl/causl-core-rs#320 — bind the engine-owned
      // dry-run extern when the rebuilt artefact carries it; leave it
      // `undefined` on a legacy bridge (`simulatesDryRunFromRust()` reads
      // `false`, so the facade keeps the TS dry-run).
      ...typeof ex.simulate_commands === "function" ? { simulate_commands: ex.simulate_commands } : {},
      ...typeof ex.stats === "function" ? { stats: ex.stats } : {},
      // lift-readat (causl/causl-core-rs#170) — bind the §12.2 discriminated
      // time-travel read extern when the rebuilt artefact carries it; leave
      // it `undefined` on a legacy bridge (readAt/snapshotAt throw a coherent
      // "rebuild" error if reached under rust-ssot).
      ...typeof ex.read_at_result === "function" ? { read_at_result: ex.read_at_result } : {},
      // lift-export (causl/causl-core-rs#170) — bind the §18A.3 deep
      // whole-graph `export_model` extern when the rebuilt artefact carries
      // it; leave it `undefined` on a legacy bridge (the facade keeps
      // exportModel on the wrapped TS closure rather than throwing).
      ...typeof ex.export_model === "function" ? { export_model: ex.export_model } : {},
      // del-final (causl/causl-core-rs#170) — bind the per-node explain-metadata
      // extern (`node_meta`) when the rebuilt artefact carries it; leave it
      // `undefined` on a legacy bridge (buildExplanation keeps the per-node
      // timestamps + `via` tag on the TS `entries` map rather than throwing).
      ...typeof ex.node_meta === "function" ? { node_meta: ex.node_meta } : {}
    };
    this.#authoritative = new AuthoritativeWasmEngine(
      bridge,
      imports,
      this.#engineMode
    );
  }
  /**
   * WIRE — expose the live {@link AuthoritativeWasmEngine} so it can be
   * injected into the public `createCausl({ injectedBackend })` factory. The
   * engine has exactly the `InjectedBackend` structural shape. Returns
   * `undefined` when this backend is not authoritative.
   */
  getAuthoritativeEngine() {
    return this.#authoritative;
  }
  /**
   * WIRE — `true` when this backend is wasm-authoritative.
   *
   * @internal
   */
  __isAuthoritativeForTests() {
    return this.#authoritative !== void 0;
  }
  /**
   * C.4 (#1505) — the validated per-graph batched-flush config (or
   * `undefined` when the adopter did not opt in). Read by the C.4
   * byte-identity acceptance test and by future real-bridge wiring.
   *
   * @internal
   */
  __batchedFlushConfigForTests() {
    return this.#batchedFlushConfig;
  }
  /**
   * V2.1 (#1519) — the validated per-graph engine canonicality mode
   * (V2-DESIGN §2). Read by the load-bearing V2.1 byte-identity
   * acceptance test (default ⇒ `'rust-ssot'`; explicit `'js-ssot'`
   * floor opt ⇒ byte-identical to dev `97da8420`).
   *
   * @internal
   */
  __engineModeForTests() {
    return this.#engineMode;
  }
  /**
   * #82 — the per-graph graph name this backend was constructed with (the
   * IR `graphId` foreign key). Read by the per-graph-params fidelity gate.
   *
   * @internal
   */
  __graphNameForTests() {
    return this.#graphName;
  }
  /**
   * #82 — the resolved retention-caps bag threaded into the wrapped TS
   * `#graph` (or `undefined` when neither cap was supplied). Read by the
   * per-graph-params fidelity gate.
   *
   * @internal
   */
  __retentionCapsForTests() {
    return this.#retentionCaps;
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
    const tsCommit = this.#graph.commit(intent, (tx) => {
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
    if (this.#batchedFlush !== void 0) {
      this.#batchedFlush.enqueue(
        {
          intent,
          writes
        },
        tsCommit.time - 1
      );
      if (this.#engineMode === "rust-ssot") {
        const promoted = this.#batchedFlush.lastPromotedCommit;
        if (promoted !== void 0) return promoted;
      }
    } else if (this.#marshaler !== void 0) {
      try {
        this.#marshaler.now = tsCommit.time - 1;
        const envelope = marshalCommitEnvelope(
          this.#marshaler,
          intent,
          writes
        );
        const bridgeResult = this.#marshalerBridge.commit(
          envelope.state,
          envelope.action
        );
        applyBridgeResult(this.#marshaler, bridgeResult);
      } catch (err) {
        this.#marshalerError = err;
      }
    }
    return tsCommit;
  }
  /** C.3 (#1501) — BatchedFlush queue (buffered shadow path). */
  #batchedFlush;
  /**
   * C.3 (#1501) — install a {@link BatchedFlush} queue so `commit()`
   * BUFFERS the shadow wire crossing instead of flushing per-commit.
   * The adopter-facing `commit()` return is unchanged (the TS graph's
   * synchronous `Commit`). When a queue is primed it SUPERSEDES the
   * pre-C.3 single-commit shadow path; the cross-backend determinism
   * gate's per-flush assertion (C.5) reads {@link __getBatchedFlushForTests}.
   *
   * @internal Test-only seam until C.4 wires it through `createCausl`.
   */
  __primeBatchedFlushForTests(queue) {
    this.#batchedFlush = queue;
  }
  /**
   * C.3 (#1501) — the installed {@link BatchedFlush} queue (or
   * `undefined`). The cross-backend determinism gate (C.5) reads
   * `.error` off this for its per-flush assertion path; implicit-flush
   * callers (C.3 PR 3) read it to force a flush before
   * `snapshot()` / `dispose()`.
   *
   * @internal
   */
  __getBatchedFlushForTests() {
    return this.#batchedFlush;
  }
  /**
   * C.3 PR 2 (#1501) — manual flush escape hatch (option-c doc §2.2).
   *
   * Forces any buffered shadow commits across the WASM wire NOW. The
   * adopter calls this before navigation / before `snapshot()` / in
   * tests when they need the wire bytes to land synchronously rather
   * than waiting for the count or time trigger.
   *
   * A no-op (returns `[]`) when no `BatchedFlush` queue is installed
   * (the default until C.4 wires it through `createCausl`) or when the
   * buffer is empty — so adopters can always call `backend.flush()`
   * safely regardless of configuration.
   *
   * Returns the projected `Commit[]` the flush produced (empty when
   * nothing was buffered). This does NOT re-fire subscribers — under
   * Answer C subscriber dispatch already ran synchronously per commit
   * in the JS engine (option-c doc §4.2 choice (i)); the flush only
   * reconciles the WASM-side wire/mirror state.
   */
  flush() {
    if (this.#batchedFlush === void 0) return [];
    return this.#batchedFlush.flush();
  }
  /**
   * C.3 PR 3 (#1501) — IMPLICIT flush. Any path that needs the
   * WASM-side state to reflect committed work forces a synchronous
   * flush of the buffered shadow window before it reads
   * (option-c doc §2.2 "Implicit (snapshot / read-from-WASM /
   * dispose)" row). Idempotent and null-safe: a no-op when no queue
   * is installed or the buffer is empty. Also cancels any armed time
   * trigger so a stale timer cannot re-flush an already-drained
   * window after the implicit flush already reconciled it.
   *
   * Under Answer C the JS engine is SSOT, so reads / subscriber
   * dispatch / `Commit` returns do NOT require a flush — only paths
   * that surface the WASM-side state (`snapshot()` shadows through the
   * marshaler per F-marshal.7; `dispose()` mutates the WASM-side
   * allocator) need the buffered window on the wire first
   * (option-c doc §2.2 final paragraph).
   */
  #implicitFlush() {
    this.#batchedFlush?.flush();
  }
  /**
   * F-marshal.5 (#1468) — install a marshaler mirror + bridge adapter
   * so `commit()` shadows the JS↔WASM wire path on every commit. The
   * cross-backend determinism gate uses this to exercise the marshaler
   * surface without changing adopter-facing semantics.
   *
   * @internal Test-only seam. Production paths leave the marshaler
   * dormant; F-marshal.7 promotes the marshaler from shadow to SSOT
   * for snapshot/hydrate.
   */
  __primeMarshalerForTests(mirror, bridge) {
    this.#marshaler = mirror;
    this.#marshalerBridge = bridge;
    this.#marshalerError = void 0;
  }
  /**
   * C.4 (#1505) — install a {@link BatchedFlush} queue built from the
   * per-graph `batchedFlush` config (validated in the constructor)
   * against a primed mirror + bridge. When the adopter did NOT opt in
   * (`#batchedFlushConfig === undefined`) this is a NO-OP and the
   * backend keeps the pre-C.3 per-commit shadow path — the
   * load-bearing C.4 byte-identity property: default config is
   * byte-identical to dev `b15069fa`.
   *
   * Wiring path: the C.5 cross-backend determinism gate and future
   * real-bridge loader call this after priming the mirror so the
   * configured `afterN` / `intervalMs` take effect per-graph. The
   * `timer` parameter is injectable so the gate / tests drive the
   * time trigger deterministically.
   *
   * @internal Wired through `createCausl({ batchedFlush })` /
   * `loadWasmBackend({ batchedFlush })`; not an adopter-facing method.
   */
  __installBatchedFlushFromConfig(mirror, bridge, timer) {
    if (this.#batchedFlushConfig === void 0) {
      return void 0;
    }
    const { afterN, intervalMs } = this.#batchedFlushConfig;
    const queue = timer !== void 0 ? new BatchedFlush(
      mirror,
      bridge,
      afterN,
      intervalMs,
      timer,
      this.#engineMode
    ) : new BatchedFlush(
      mirror,
      bridge,
      afterN,
      intervalMs,
      HOST_FLUSH_TIMER,
      this.#engineMode
    );
    this.#batchedFlush = queue;
    return queue;
  }
  /**
   * F-marshal.5 (#1468) — surface any error captured by the shadow
   * marshaler path. The cross-backend determinism gate calls this
   * after each command to assert the marshaler stays green; production
   * adopters never see this surface.
   *
   * @internal
   */
  __getMarshalerErrorForTests() {
    return this.#marshalerError;
  }
  /** F-marshal.5 (#1468) — JS-side mirror, populated by the gate's prime. */
  #marshaler;
  /** F-marshal.5 (#1468) — bridge adapter, populated by the gate's prime. */
  #marshalerBridge;
  /** F-marshal.5 (#1468) — captured shadow-path error for test inspection. */
  #marshalerError;
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
    this.#implicitFlush();
    return this.#graph.snapshot();
  }
  /**
   * #88 (PR #79 residual 2) — hydrate the wrapped TS `#graph` only.
   *
   * Unlike {@link snapshot}, this does NOT run {@link #implicitFlush} to
   * reconcile the WASM-side marshaler mirror. That asymmetry is INTENTIONAL
   * and safe because the WASM shadow is inert on every path that reaches
   * THIS method: `instantiateBackend()` (the `loadWasmBackend` core) never
   * calls `__enableAuthoritativeWasm` / `__primeBatchedFlushForTests` /
   * `__primeMarshalerForTests`, so `#authoritative`, the `#batchedFlush`
   * instance, and `#marshaler` are all `undefined` here — `commit`, `read`,
   * `snapshot` and `hydrate` all route through the same `#graph` SSOT, and
   * the hydrate is self-consistent with reads (pinned by
   * `wasm-legacy-backend-hydrate-consistency.test.ts`).
   *
   * The one production path that DOES enable the authoritative engine
   * (`createCauslWasm` / `createCauslWasmSync`) EXTRACTS it via
   * {@link getAuthoritativeEngine} and installs it as the graph's
   * `injectedBackend` — `Graph.hydrate` there routes through
   * `AuthoritativeWasmEngine.hydrate` (the #78/#79 `apply_commands` path,
   * pinned by `wasm-hydrate-ssot-parity`), NEVER this method. So no
   * adopter-reachable factory drives a live shadow through here.
   *
   * INVARIANT for future work: if a change ever activates a live shadow
   * (authoritative engine / primed batched-flush or marshaler) on the
   * `loadWasmBackend` path, this method must reconcile it — mirror
   * {@link snapshot}'s `this.#implicitFlush()` and route the hydrate through
   * the authoritative engine — or the mirror desyncs across a hydrate.
   */
  hydrate(snap) {
    this.#graph.hydrate(snap);
  }
  /**
   * Internal-API migration hydrate (issue #1090). Routes through
   * `@causl/client-ts/internal`'s `_migrateFrom(graph, snap)` so the
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
  /**
   * lift-readat (causl/causl-core-rs#170) — whether the discriminated
   * historical reads (`readAt` / `snapshotAt`) resolve from the Rust
   * retention chain. `true` only under rust-ssot with the rebuilt
   * `read_at_result` extern present. The `graph.ts` facade gates its
   * readAt/snapshotAt reroute on this.
   */
  readsHistoryFromRust() {
    return this.#engineMode === "rust-ssot" && this.#authoritative !== void 0 && this.#authoritative.hasReadAtResult();
  }
  readAt(node, time) {
    const authoritative = this.#authoritative;
    if (this.#engineMode === "rust-ssot" && authoritative !== void 0 && authoritative.hasReadAtResult()) {
      return authoritative.readAt(node, time);
    }
    const handle = this.#nodeRegistry.get(node);
    if (handle === void 0) {
      throw new Error(
        `WasmBackend.readAt(): no node registered for NodeId '${node}'.`
      );
    }
    return this.#graph.readAt(handle, time);
  }
  snapshotAt(time) {
    const authoritative = this.#authoritative;
    if (this.#engineMode === "rust-ssot" && authoritative !== void 0 && authoritative.hasReadAtResult()) {
      return authoritative.snapshotAt(
        time,
        () => this.#graph.snapshot().schemaHash ?? ""
      );
    }
    return this.#graph.snapshotAt(time);
  }
  /**
   * lift-export (causl/causl-core-rs#170) — whether the whole-graph
   * `exportModel` IR resolves from the Rust §18A.3 deep export. `true` only
   * under rust-ssot with the rebuilt `export_model` extern present. The
   * `graph.ts` facade gates its exportModel reroute on this.
   */
  exportsModelFromRust() {
    return this.#engineMode === "rust-ssot" && this.#authoritative !== void 0 && this.#authoritative.hasExportModel();
  }
  exportModel(opts) {
    const authoritative = this.#authoritative;
    if (this.#engineMode === "rust-ssot" && authoritative !== void 0 && authoritative.hasExportModel()) {
      return authoritative.exportModel(this.#graphName, opts);
    }
    return this.#graph.exportModel(opts);
  }
  dispose(node) {
    const handle = this.#nodeRegistry.get(node);
    if (handle === void 0) return;
    this.#implicitFlush();
    const { dispose } = this.#graph.__causl_internal_dispatch ?? { dispose: () => void 0 };
    dispose(handle);
  }
  /**
   * mux-6 (causl-client#42) — tear down this backend's authoritative wasm
   * engine: drop its per-`engineId` compute/fire handlers from the sidecar
   * registry so a stale dispatch for its id becomes a no-op (a THREW
   * out-buffer for compute / a dropped firing for fire). Idempotent and safe
   * when this backend is not authoritative. Wired into the HMR-dispose seam
   * (`__resetWasmBackendCacheForTests`) and callable directly by adopters
   * that explicitly retire a wasm graph.
   *
   * @internal
   */
  disposeAuthoritativeEngine() {
    this.#authoritative?.dispose();
  }
  /**
   * SPEC §6 composite-statechart extension point (issue #1068,
   * deferred from #698). The Phase-1 `WasmBackend` wraps a TS engine
   * (see `createCausl` call in the constructor) so this method
   * delegates directly to the canonical `evaluateStatechart`
   * implementation that the `JsBackend.evaluateStatechart` op (PR
   * #1092) routes through — the same module backs both the JS and
   * WASM `BackendEngine.evaluateStatechart` Phase-1 paths so the two
   * are byte-identical by construction.
   *
   * @remarks
   * History. The pre-#1122 implementation reached into the wrapped
   * Graph via a back-channel accessor and fell back to a
   * synthetic-forbidden result (with
   * `from='__backend-for-test-missing__'`) when the back-channel was
   * absent. Per the Markbåge/Miller ship-verdict panel the
   * back-channel and the synthetic-forbidden fallback were both
   * removed for 0.9.0 (issue #1122): the back-channel was never set
   * on the wrapped `Graph` (every call hit the fallback in
   * production) and the synthetic result masked real divergence
   * between the JS and WASM evaluators. The canonical evaluator
   * shipped by issue #1068 / PR #1092 is the only path.
   *
   * The Phase-2 Sub-D work (EPIC #680) replaces this delegation with
   * a Rust-side `evaluate_statechart()` call consuming the
   * `engine-rs-core::statechart_reducers` enums (gated behind
   * `feature = "future"`; landed structurally by #1068). The wire
   * shape of the extension point is the same on both sides — the
   * cross-implementation determinism gates (#685, #1068, #1122)
   * verify the two implementations stay byte-equivalent.
   */
  evaluateStatechart(input) {
    this.#evalDelegateCount += 1;
    return evaluateStatechart(
      input
    );
  }
  /**
   * Dev/test-only accessor exposing the per-instance instrumentation
   * counters that back the no-fallback property gate (issue #1122).
   *
   * - `evalDelegateCount` — number of times `evaluateStatechart()`
   *   delegated to the canonical evaluator (increments on every
   *   invocation post-#1122).
   * - `syntheticFallbackCount` — MUST remain zero. The legacy
   *   synthetic-forbidden fallback path was removed in #1122; this
   *   counter is the forward-compat trip wire that fires if a future
   *   regression silently re-introduces a fallback.
   *
   * Namespaced under the `__` prefix to make it clear it is not part
   * of the supported public surface. Adopters program against the
   * `BackendEngine` interface alone.
   *
   * @internal
   */
  __evalCountersForTests() {
    return {
      evalDelegateCount: this.#evalDelegateCount,
      syntheticFallbackCount: this.#syntheticFallbackCount
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
function __createWasmBackendSyncForTests(graphName, bridge = "wasmgc-classic", batchedFlush, engine) {
  return new WasmBackend(
    bridge,
    graphName,
    batchedFlush,
    resolveWasmEngineMode(engine)
  );
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
  AuthoritativeWasmEngine,
  BatchedFlush,
  CONSOLIDATED_BRIDGE_ARTEFACT_FILENAME,
  CauslWasmNotPreloadedError,
  CauslWasmPreloadConflictError,
  DEFAULT_WASM_ENGINE_MODE,
  WasmBackendUnavailableError,
  WasmEngineUnavailableError,
  __createWasmBackendSyncForTests,
  __forceSidecarUnavailableForTests,
  __forceWasmCompileUnavailableForTests,
  __forceWasmInstantiateUnavailableForTests,
  __isPhase1WasmBackendForTests,
  __resetWasmBackendCacheForTests,
  __sidecarImportHrefsForTests,
  __wasmBackendForTests,
  activateAutoMigrationBackend,
  assertBridgeAbiSmokeProbe,
  createCauslWasm,
  createCauslWasmSync,
  detectBridge,
  disposeCauslWasmGraph,
  getPreloadedCauslWasm,
  isCauslWasmPreloaded,
  isWasmCapabilityError,
  loadAuthoritativeWasm,
  loadStreaming,
  loadWasmBackend,
  preloadCauslWasm,
  readArtefactBytes,
  resolveComputeImportsUrl,
  resolveSnippetFromSidecarGlue,
  resolveWasmEngineMode,
  wasmUrlFor
};
//# sourceMappingURL=wasm.js.map