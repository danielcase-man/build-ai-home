/**
 * Vendor name normalization and fuzzy matching utilities.
 * Used by the data integrity agent to detect fragmented bids from the same vendor.
 */

/**
 * Normalize a vendor name for comparison:
 * - Remove parenthetical content
 * - Remove "Supplier" prefix
 * - Strip special characters, normalize whitespace, lowercase
 */
export function normalizeVendorName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let result = name;

  // Remove parenthetical content (including nested)
  // Repeat to handle nested parens like "(SupplierOmega - Framed)"
  let prev = '';
  while (prev !== result) {
    prev = result;
    result = result.replace(/\s*\([^)]*\)/g, '');
  }

  // Remove "Supplier" prefix (case-insensitive, with or without space after)
  result = result.replace(/^Supplier\s*/i, '');

  // Strip special characters except alphanumeric and spaces
  result = result.replace(/[^a-zA-Z0-9\s]/g, ' ');

  // Normalize whitespace and lowercase
  result = result.replace(/\s+/g, ' ').trim().toLowerCase();

  return result;
}

/**
 * Standard Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use two-row optimization for space efficiency
  let prevRow = new Array(b.length + 1);
  let currRow = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    currRow[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1,       // insertion
        prevRow[j] + 1,           // deletion
        prevRow[j - 1] + cost     // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[b.length];
}

/**
 * Returns 0.0-1.0 similarity based on Levenshtein distance.
 * Formula: 1 - (distance / max(a.length, b.length))
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Token sort ratio: normalize both names, split into word tokens,
 * sort alphabetically, rejoin, then compute Levenshtein similarity.
 * Handles word order differences: "FBS Appliances" vs "Appliances FBS"
 */
export function tokenSortRatio(a: string, b: string): number {
  const sortedA = normalizeVendorName(a).split(/\s+/).filter(Boolean).sort().join(' ');
  const sortedB = normalizeVendorName(b).split(/\s+/).filter(Boolean).sort().join(' ');
  return levenshteinSimilarity(sortedA, sortedB);
}

/**
 * Find the longest word token that appears in both normalized names.
 * Minimum 3 chars to avoid false positives on short words like "a", "the".
 */
export function longestCommonToken(a: string, b: string): string | null {
  const tokensA = normalizeVendorName(a).split(/\s+/).filter(t => t.length >= 3);
  const tokensB = new Set(normalizeVendorName(b).split(/\s+/).filter(t => t.length >= 3));

  let longest: string | null = null;

  for (const token of tokensA) {
    if (tokensB.has(token)) {
      if (longest === null || token.length > longest.length) {
        longest = token;
      }
    }
  }

  return longest;
}

/**
 * Returns true if two vendor names are likely duplicates.
 * Criteria: tokenSortRatio > 0.7 OR shared longest common token of 5+ chars
 * OR one normalized name's tokens are a subset of the other's.
 */
export function areLikelyDuplicateVendors(a: string, b: string): boolean {
  const normA = normalizeVendorName(a);
  const normB = normalizeVendorName(b);

  // Guard: empty names are never duplicates
  if (!normA || !normB) return false;

  if (tokenSortRatio(a, b) > 0.7) return true;

  const common = longestCommonToken(a, b);
  if (common && common.length >= 5) return true;

  // Token containment: if all tokens of one name appear in the other,
  // they are likely the same vendor (e.g., "FBS" is contained in "FBS Appliances")
  const tokensA = normA.split(/\s+/).filter(Boolean);
  const tokensB = normB.split(/\s+/).filter(Boolean);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const aInB = tokensA.every(t => setB.has(t));
  const bInA = tokensB.every(t => setA.has(t));
  if (aInB || bInA) return true;

  return false;
}

/**
 * Check if a vendor name matches any known alias and return the canonical name.
 * Case-insensitive matching on normalized names.
 */
export function resolveVendorAlias(
  name: string,
  aliases: Array<{ canonical_name: string; alias: string }>
): string {
  const normalized = normalizeVendorName(name);
  if (!normalized) return name;

  for (const entry of aliases) {
    if (normalizeVendorName(entry.alias) === normalized) {
      return entry.canonical_name;
    }
  }

  return name;
}
