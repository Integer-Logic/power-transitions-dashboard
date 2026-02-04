/**
 * N/A Value Utilities
 *
 * Handles N/A value propagation for missing Excel data.
 * When values are missing from Excel imports, display "N/A" instead of default values.
 * If any field used in a calculation is N/A, the calculated result should also be N/A.
 */

/**
 * Check if a value is N/A (null, undefined, or empty)
 * @param {*} value - Value to check
 * @returns {boolean} - True if value is N/A (missing)
 */
export function isNA(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || trimmed === '#N/A' || trimmed === 'N/A' || trimmed === '#VALUE!';
  }
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  return false;
}

/**
 * Parse a value to a number, returning null for missing/invalid values
 * This distinguishes null (missing/N/A) from 0 (actual zero value)
 * @param {*} value - Value to parse
 * @returns {number|null} - Parsed number or null if missing/invalid
 */
export function parseNullableNumber(value) {
  // Explicitly handle 0 as a valid value
  if (value === 0) return 0;

  // Check for N/A values
  if (isNA(value)) return null;

  // Parse string values
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const num = parseFloat(trimmed);
    return Number.isNaN(num) ? null : num;
  }

  // Handle numbers
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }

  return null;
}

/**
 * Parse a value to an integer, returning null for missing/invalid values
 * @param {*} value - Value to parse
 * @returns {number|null} - Parsed integer or null if missing/invalid
 */
export function parseNullableInt(value) {
  const num = parseNullableNumber(value);
  if (num === null) return null;
  return Math.round(num);
}

/**
 * Format a score value for display
 * Returns "N/A" for null values, formatted number otherwise
 * @param {number|null} value - Score value
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted display string
 */
export function formatScoreDisplay(value, decimals = 2) {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number' && Number.isNaN(value)) return 'N/A';
  return parseFloat(value).toFixed(decimals);
}

/**
 * Check if any value in an array is N/A
 * Useful for checking if a calculation should propagate N/A
 * @param  {...any} values - Values to check
 * @returns {boolean} - True if any value is N/A
 */
export function hasAnyNA(...values) {
  return values.some(v => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)));
}

/**
 * Get a numeric value from multiple possible sources
 * Returns null if all sources are N/A, otherwise returns the first valid value
 * @param {*[]} sources - Array of possible values to check
 * @returns {number|null} - First valid number or null if all are N/A
 */
export function getValueOrNull(...sources) {
  for (const src of sources) {
    // 0 is a valid value, not N/A
    if (src === 0) return 0;
    if (!isNA(src)) {
      const num = parseNullableNumber(src);
      if (num !== null) return num;
    }
  }
  return null;
}

/**
 * Get a numeric value with a default fallback
 * Unlike getValueOrNull, this returns a default value when all sources are N/A
 * Used for fields that should have defaults (like thermal_optimization)
 * @param {number} defaultValue - Default value if all sources are N/A
 * @param {...any} sources - Values to check
 * @returns {number} - First valid number or default value
 */
export function getValueOrDefault(defaultValue, ...sources) {
  const value = getValueOrNull(...sources);
  return value === null ? defaultValue : value;
}

// Default export for convenience
export default {
  isNA,
  parseNullableNumber,
  parseNullableInt,
  formatScoreDisplay,
  hasAnyNA,
  getValueOrNull,
  getValueOrDefault
};
