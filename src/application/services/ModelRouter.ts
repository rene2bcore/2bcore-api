import { MODEL_TIERS } from '../../shared/constants/index.js';

const VALID_MODEL_IDS = new Set<string>(Object.values(MODEL_TIERS));
const TIER_NAMES = new Set<string>(Object.keys(MODEL_TIERS));

export class ModelRouter {
  /**
   * Resolve a user-supplied model hint to a canonical model ID.
   *
   * Accepts:
   *   - Tier names: 'fast' | 'standard' | 'powerful'
   *   - Exact model IDs: e.g. 'claude-sonnet-4-6'
   *   - undefined: defaults to 'standard'
   */
  resolve(requested?: string): string {
    if (!requested) return MODEL_TIERS.standard;

    // Tier name → model ID
    if (TIER_NAMES.has(requested)) {
      return MODEL_TIERS[requested as keyof typeof MODEL_TIERS];
    }

    // Exact model ID
    if (VALID_MODEL_IDS.has(requested)) {
      return requested;
    }

    // Unknown → default
    return MODEL_TIERS.standard;
  }

  isKnown(modelId: string): boolean {
    return VALID_MODEL_IDS.has(modelId);
  }
}
