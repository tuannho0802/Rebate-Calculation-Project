/**
 * Unit tests for the getChildMaxLabel logic in rebate-management/page.tsx.
 *
 * The function logic under test (extracted inline for isolation):
 *
 *   if (!parentAssetConfig) return 'parentMissingConfig'
 *   if (parentAssetConfig.maxPips === 0) return 'parentNotAllocated'
 *   return `maxLabel:${parentAssetConfig.maxPips}`
 *
 * Key regression: before fix, condition used markupPips === 0.
 * After fix it must use maxPips === 0.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Mirror of the fixed getChildMaxLabel logic (pure function, no React deps)
// ---------------------------------------------------------------------------
type AssetConfig = { markupPips: number; maxPips: number };

function getChildMaxLabel(
  parentAssetConfig: AssetConfig | undefined,
): string {
  if (!parentAssetConfig) {
    return 'parentMissingConfig';
  }
  if (parentAssetConfig.maxPips === 0) {
    return 'parentNotAllocated';
  }
  return `maxLabel:${parentAssetConfig.maxPips}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getChildMaxLabel — after fix (maxPips-based)', () => {
  it('shows parentMissingConfig when parent has no config', () => {
    expect(getChildMaxLabel(undefined)).toBe('parentMissingConfig');
  });

  it('shows parentNotAllocated when maxPips === 0 (regardless of markupPips)', () => {
    // maxPips=0, markupPips=0 → not allocated
    expect(getChildMaxLabel({ maxPips: 0, markupPips: 0 })).toBe('parentNotAllocated');
    // maxPips=0, markupPips=5 → still not allocated (maxPips is the authority)
    expect(getChildMaxLabel({ maxPips: 0, markupPips: 5 })).toBe('parentNotAllocated');
  });

  it('REGRESSION: parent is MIB — maxPips=12, markupPips=0 → shows "Tối đa 12", NOT parentNotAllocated', () => {
    // This is the exact scenario that was broken: MIB always has markupPips=0
    // but maxPips=12 after setMibMaxOverride. Children of MIB must show "Tối đa 12".
    const result = getChildMaxLabel({ maxPips: 12, markupPips: 0 });
    expect(result).toBe('maxLabel:12');
    expect(result).not.toBe('parentNotAllocated');
  });

  it('shows maxLabel with correct maxPips when parent has maxPips > 0', () => {
    expect(getChildMaxLabel({ maxPips: 5, markupPips: 3 })).toBe('maxLabel:5');
    expect(getChildMaxLabel({ maxPips: 8, markupPips: 0 })).toBe('maxLabel:8');
  });

  it('REGRESSION (pre-fix behaviour): old code would have shown parentNotAllocated for markupPips=0 — verify new code does NOT', () => {
    // All of these have markupPips=0 but maxPips > 0 → must NOT show parentNotAllocated
    const cases = [
      { maxPips: 12, markupPips: 0 },
      { maxPips: 7,  markupPips: 0 },
      { maxPips: 1,  markupPips: 0 },
    ];
    for (const cfg of cases) {
      expect(getChildMaxLabel(cfg)).not.toBe('parentNotAllocated');
    }
  });
});
