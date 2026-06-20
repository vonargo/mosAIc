// Central store.
//
// MosAIc's reconfiguration mechanism is "base + overlay": a base structure plus
// an overlay that reshapes it. `effective()` is the hook the build generalizes
// into a full layout schema an LLM can emit. Keep that idea central.

export const STATE = {
  route: null,
  overlay: {},   // id -> partial override merged over a base view/panel
};

// base ⊕ overlay -> effective view. (The build turns `overlay` into the
// LLM-emitted layout/content config and expands this merge accordingly.)
export function effective(base) {
  if (!base) return null;
  const ov = STATE.overlay[base.id];
  return ov ? { ...base, ...ov } : base;
}
