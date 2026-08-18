export type DeferredPrimeDecision = "idle" | "wait" | "prime";

export function deferredPrimeDecision(
  pending: boolean,
  assistantGenerating: boolean,
): DeferredPrimeDecision {
  if (!pending) return "idle";
  return assistantGenerating ? "wait" : "prime";
}
