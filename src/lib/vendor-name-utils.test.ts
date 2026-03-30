import { describe, it, expect } from 'vitest';
import {
  normalizeVendorName,
  levenshteinDistance,
  levenshteinSimilarity,
  tokenSortRatio,
  longestCommonToken,
  areLikelyDuplicateVendors,
  resolveVendorAlias,
} from './vendor-name-utils';

describe('normalizeVendorName', () => {
  it('removes parenthetical content', () => {
    expect(normalizeVendorName('Omega Cabinetry (Framed)')).toBe('omega cabinetry');
  });

  it('removes nested parenthetical content', () => {
    expect(normalizeVendorName('Omega Cabinetry (SupplierOmega - Framed)')).toBe('omega cabinetry');
  });

  it('removes Supplier prefix', () => {
    expect(normalizeVendorName('SupplierOmega (Framed)')).toBe('omega');
  });

  it('removes Supplier prefix case-insensitively', () => {
    expect(normalizeVendorName('supplierAlpha')).toBe('alpha');
  });

  it('strips special characters and normalizes whitespace', () => {
    expect(normalizeVendorName('FBS Appliances / Tri Supply')).toBe('fbs appliances tri supply');
  });

  it('lowercases the result', () => {
    expect(normalizeVendorName('ACME Builders')).toBe('acme builders');
  });

  it('trims whitespace', () => {
    expect(normalizeVendorName('  Some Vendor  ')).toBe('some vendor');
  });

  it('handles empty string', () => {
    expect(normalizeVendorName('')).toBe('');
  });

  it('handles null-ish input', () => {
    expect(normalizeVendorName(null as unknown as string)).toBe('');
    expect(normalizeVendorName(undefined as unknown as string)).toBe('');
  });

  it('handles string with only parenthetical content', () => {
    expect(normalizeVendorName('(just parens)')).toBe('');
  });

  it('handles multiple parenthetical groups', () => {
    expect(normalizeVendorName('Vendor (A) Name (B)')).toBe('vendor name');
  });

  it('handles apostrophes and hyphens', () => {
    expect(normalizeVendorName("Brown's Garage-Doors")).toBe("brown s garage doors");
  });

  it('handles Supplier prefix without space', () => {
    expect(normalizeVendorName('SupplierAcme')).toBe('acme');
  });

  it('does not strip Supplier in the middle of a name', () => {
    expect(normalizeVendorName('Acme Supplier Inc')).toBe('acme supplier inc');
  });
});

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns length of other string when one is empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('computes known edit distances', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    expect(levenshteinDistance('abc', 'def')).toBe(3);
  });

  it('handles single character difference', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
    expect(levenshteinDistance('cat', 'at')).toBe(1);
  });

  it('is symmetric', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(levenshteinDistance('xyz', 'abc'));
  });
});

describe('levenshteinSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1.0);
  });

  it('returns 1.0 for two empty strings', () => {
    expect(levenshteinSimilarity('', '')).toBe(1.0);
  });

  it('returns 0.0 for completely different strings of same length', () => {
    expect(levenshteinSimilarity('abc', 'xyz')).toBe(0.0);
  });

  it('returns value between 0 and 1', () => {
    const sim = levenshteinSimilarity('kitten', 'sitting');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('computes correct similarity for known cases', () => {
    // distance=1, maxLen=4 → 1 - 1/4 = 0.75
    expect(levenshteinSimilarity('cat', 'cats')).toBeCloseTo(0.75, 5);
  });

  it('returns 0 when one string is empty and other is not', () => {
    expect(levenshteinSimilarity('', 'abc')).toBe(0.0);
    expect(levenshteinSimilarity('abc', '')).toBe(0.0);
  });
});

describe('tokenSortRatio', () => {
  it('is order-independent', () => {
    const ratio = tokenSortRatio('FBS Appliances', 'Appliances FBS');
    expect(ratio).toBe(1.0);
  });

  it('returns 1.0 for identical names', () => {
    expect(tokenSortRatio('Omega Cabinetry', 'Omega Cabinetry')).toBe(1.0);
  });

  it('handles parenthetical differences', () => {
    const ratio = tokenSortRatio('Omega Cabinetry (Framed)', 'Omega Cabinetry');
    expect(ratio).toBe(1.0);
  });

  it('returns low score for completely different names', () => {
    const ratio = tokenSortRatio("Brown's Garage Doors", 'Triple C Septic');
    expect(ratio).toBeLessThan(0.5);
  });

  it('handles case differences', () => {
    expect(tokenSortRatio('acme builders', 'ACME BUILDERS')).toBe(1.0);
  });

  it('handles extra whitespace', () => {
    expect(tokenSortRatio('  FBS  Appliances  ', 'FBS Appliances')).toBe(1.0);
  });
});

describe('longestCommonToken', () => {
  it('finds the longest shared token', () => {
    expect(longestCommonToken('Omega Cabinetry', 'Omega Doors')).toBe('omega');
  });

  it('returns the longer of two shared tokens', () => {
    expect(longestCommonToken('Omega Cabinetry Inc', 'Omega Cabinetry LLC')).toBe('cabinetry');
  });

  it('returns null when no tokens are shared', () => {
    expect(longestCommonToken('Alpha Beta', 'Gamma Delta')).toBeNull();
  });

  it('filters out tokens shorter than 3 chars', () => {
    // "a" is shared but too short
    expect(longestCommonToken('A B Builders', 'A B Plumbing')).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(longestCommonToken('', '')).toBeNull();
    expect(longestCommonToken('Omega', '')).toBeNull();
  });

  it('handles parenthetical content by normalizing first', () => {
    expect(longestCommonToken('Omega (Framed)', 'Omega (Frameless)')).toBe('omega');
  });

  it('requires minimum 3 chars', () => {
    // "to" is only 2 chars
    expect(longestCommonToken('to the moon', 'to the stars')).toBe('the');
  });
});

describe('areLikelyDuplicateVendors', () => {
  it('detects Omega Cabinetry variants as duplicates', () => {
    expect(areLikelyDuplicateVendors(
      'Omega Cabinetry (Framed)',
      'SupplierOmega (Framed Cabinetry)'
    )).toBe(true);
  });

  it('rejects clearly different vendors', () => {
    expect(areLikelyDuplicateVendors(
      "Brown's Garage Doors",
      'Triple C Septic'
    )).toBe(false);
  });

  it('detects FBS variants as duplicates', () => {
    expect(areLikelyDuplicateVendors(
      'FBS Appliances',
      'FBS (Appliance Supplier)'
    )).toBe(true);
  });

  it('detects word-order swaps as duplicates', () => {
    expect(areLikelyDuplicateVendors(
      'FBS Appliances',
      'Appliances FBS'
    )).toBe(true);
  });

  it('detects same name with different parentheticals', () => {
    expect(areLikelyDuplicateVendors(
      'Omega Cabinetry (Framed)',
      'Omega Cabinetry (Frameless)'
    )).toBe(true);
  });

  it('rejects vendors with only short shared tokens', () => {
    expect(areLikelyDuplicateVendors(
      'ABC Plumbing',
      'ABC Electrical'
    )).toBe(false);
  });

  it('handles empty strings gracefully', () => {
    expect(areLikelyDuplicateVendors('', '')).toBe(false);
  });

  it('matches vendors that share a long common token (5+ chars)', () => {
    expect(areLikelyDuplicateVendors(
      'Anderson Windows Co',
      'Anderson Doors LLC'
    )).toBe(true);
  });

  it('rejects vendors with a 4-char shared token and low similarity', () => {
    // "home" is only 4 chars, below the 5-char threshold
    expect(areLikelyDuplicateVendors(
      'Home Builders Inc',
      'Home Depot Supply'
    )).toBe(false);
  });
});

describe('resolveVendorAlias', () => {
  const aliases = [
    { canonical_name: 'Omega Cabinetry', alias: 'SupplierOmega' },
    { canonical_name: 'FBS Appliances', alias: 'FBS (Appliance Supplier)' },
    { canonical_name: 'Triple C Septic', alias: 'Triple C' },
  ];

  it('resolves a known alias to canonical name', () => {
    expect(resolveVendorAlias('SupplierOmega', aliases)).toBe('Omega Cabinetry');
  });

  it('resolves case-insensitively', () => {
    expect(resolveVendorAlias('supplieromega', aliases)).toBe('Omega Cabinetry');
  });

  it('returns original name when no alias matches', () => {
    expect(resolveVendorAlias('Unknown Vendor', aliases)).toBe('Unknown Vendor');
  });

  it('resolves alias with parenthetical content', () => {
    expect(resolveVendorAlias('FBS (Appliance Supplier)', aliases)).toBe('FBS Appliances');
  });

  it('returns original name for empty alias list', () => {
    expect(resolveVendorAlias('Some Vendor', [])).toBe('Some Vendor');
  });

  it('handles empty name input', () => {
    expect(resolveVendorAlias('', aliases)).toBe('');
  });
});
