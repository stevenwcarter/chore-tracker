import confetti from 'canvas-confetti';

/**
 * Runs `action` and fires confetti only if it resolves.
 *
 * The rejection is swallowed deliberately: the mutation layer already toasted
 * it via `withErrorToast`, and the only thing left to decide here is whether to
 * celebrate. Do not "improve" this by re-throwing without checking the callers.
 */
export async function celebrateOnSuccess(action: () => Promise<void>): Promise<void> {
  try {
    await action();
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  } catch {
    // Already handled and toasted upstream; just skip the confetti.
  }
}
