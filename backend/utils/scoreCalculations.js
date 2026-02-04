/**
 * Score Calculations - Single Source of Truth (CommonJS version for backend)
 *
 * This module contains the canonical score calculation functions that match
 * the Excel formulas exactly. These functions are used everywhere scores
 * are calculated to ensure consistency.
 *
 * N/A Propagation Rules:
 * - If any required input is null/missing, the calculated result is null (N/A)
 * - Exception: thermal_optimization defaults to 0 if missing
 *
 * Excel Formula Reference:
 * - Thermal Operating Score: =SUMPRODUCT([COD, Markets, Transactability, ThermalOpt, Environmental], [0.20, 0.30, 0.30, 0.05, 0.15])
 * - Redevelopment Score: =IF(any of Market/Infra/IX = 0, 0, (Market × 0.4 + Infra × 0.3 + IX × 0.3) × multiplier)
 *   where multiplier = 0.75 if "Repower", else 1
 * - Overall Project Score: = Thermal Operating Score + Redevelopment Score
 */

/**
 * Check if a value is N/A (null, undefined, or empty)
 * @param {*} value - Value to check
 * @returns {boolean} - True if value is N/A (missing)
 */
function isNA(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || trimmed === '#N/A' || trimmed === 'N/A' || trimmed === '#VALUE!';
  }
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  return false;
}

/**
 * Helper to get numeric value from multiple sources
 * Returns null if all sources are missing (for N/A propagation)
 * Returns the first valid numeric value otherwise
 */
function getScore(...sources) {
  for (const src of sources) {
    // Explicitly handle 0 as valid
    if (src === 0) return 0;
    if (src !== undefined && src !== null && src !== '') {
      const stringVal = String(src).trim();
      // Check for Excel error values
      if (stringVal === '#N/A' || stringVal === 'N/A' || stringVal === '#VALUE!') continue;
      const num = parseFloat(src);
      if (!isNaN(num)) return num;
    }
  }
  return null;
}

/**
 * Format a score value for display
 * Returns "N/A" for null values, formatted number otherwise
 * @param {number|null} value - Score value
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted display string
 */
function formatScoreDisplay(value, decimals = 2) {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number' && Number.isNaN(value)) return 'N/A';
  return parseFloat(value).toFixed(decimals);
}

/**
 * Calculate Thermal Operating Score
 * Formula: (COD × 0.20) + (Markets × 0.30) + (Transactability × 0.30) + (ThermalOpt × 0.05) + (Environmental × 0.15)
 *
 * N/A Propagation:
 * - Returns null if plant_cod, markets, transactability, OR environmental is null
 * - Exception: thermal_optimization defaults to 0 if missing
 *
 * @param {Object} data - Project data object with component values
 * @returns {number|null} - Calculated thermal score or null if required inputs are missing
 */
function calculateThermalScore(data) {
  // Extract values with fallbacks for both database column names and Excel column names
  const cod = getScore(data.plant_cod, data["Plant  COD"], data["Plant COD"]);
  const markets = getScore(data.markets, data["Markets"]);
  const transact = getScore(data.transactability_scores, data["Transactability Scores"]);
  const environmental = getScore(data.environmental_score, data["Envionmental Score"], data["Environmental Score"]);

  // Thermal optimization defaults to 0 (yet to be saved) - this is the EXCEPTION
  const thermalOptRaw = getScore(data.thermal_optimization, data["Thermal Optimization"]);
  const thermalOpt = thermalOptRaw === null ? 0 : thermalOptRaw;

  // N/A Propagation: If any required field is null, return null
  // Required fields: cod, markets, transactability, environmental
  // Exception: thermal_optimization defaults to 0
  if (cod === null || markets === null || transact === null || environmental === null) {
    return null;
  }

  // Calculate thermal score with Excel formula weights
  const score = (cod * 0.20) +
                (markets * 0.30) +
                (transact * 0.30) +
                (thermalOpt * 0.05) +
                (environmental * 0.15);

  return isNaN(score) ? null : score;
}

/**
 * Calculate Redevelopment Score
 * Formula: IF(any of Market/Infra/IX = 0, 0, (Market × 0.40 + Infra × 0.30 + IX × 0.30) × multiplier)
 * Multiplier: 0.75 if Co-Locate/Repower = "Repower", else 1
 *
 * N/A Propagation:
 * - Returns null if market_score, infra, or ix is null
 * - co_locate_repower can be empty (defaults to multiplier 1)
 *
 * @param {Object} data - Project data object with component values
 * @returns {number|null} - Calculated redevelopment score or null if required inputs are missing
 */
function calculateRedevelopmentScore(data) {
  // Extract values with fallbacks for both database column names and Excel column names
  const market = getScore(data.market_score, data["Market Score"]);
  const infra = getScore(data.infra, data["Infra"]);
  const ix = getScore(data.ix, data["IX"]);

  // N/A Propagation: If any required field is null, return null
  if (market === null || infra === null || ix === null) {
    return null;
  }

  // Determine multiplier based on Co-Locate/Repower value
  // co_locate_repower can be empty - defaults to multiplier 1
  const coLocate = (
    data.co_locate_repower ||
    data["Co-Locate/Repower"] ||
    ""
  ).toString().toLowerCase().trim();

  const multiplier = coLocate === "repower" ? 0.75 : 1;

  // If any of Market, Infra, or IX is 0, return 0
  if (market === 0 || infra === 0 || ix === 0) {
    return 0;
  }

  // Calculate redevelopment score with Excel formula weights
  const score = ((market * 0.40) + (infra * 0.30) + (ix * 0.30)) * multiplier;

  return isNaN(score) ? null : score;
}

/**
 * Calculate Overall Project Score
 * Formula: Thermal Operating Score + Redevelopment Score
 *
 * N/A Propagation:
 * - Returns null if thermal OR redevelopment is null
 *
 * @param {number|null} thermal - Thermal operating score
 * @param {number|null} redev - Redevelopment score
 * @returns {number|null} - Overall project score or null if either input is null
 */
function calculateOverallScore(thermal, redev) {
  // N/A Propagation: If either score is null, return null
  if (thermal === null || redev === null) {
    return null;
  }

  const thermalVal = parseFloat(thermal);
  const redevVal = parseFloat(redev);

  if (isNaN(thermalVal) || isNaN(redevVal)) {
    return null;
  }

  return thermalVal + redevVal;
}

/**
 * Calculate all scores for a project
 * Returns thermal, redevelopment, and overall scores along with rating
 *
 * N/A Propagation:
 * - If any component score is null, overall_rating becomes "N/A"
 * - has_na flag indicates if any score is N/A
 *
 * @param {Object} data - Project data object with all component values
 * @returns {Object} - Object containing all calculated scores and rating
 */
function calculateAllScores(data) {
  const thermal = calculateThermalScore(data);
  const redev = calculateRedevelopmentScore(data);
  const overall = calculateOverallScore(thermal, redev);

  // Determine if any score is N/A
  const hasNA = thermal === null || redev === null || overall === null;

  // Determine rating based on overall score
  let rating;
  if (overall === null) {
    rating = "N/A";
  } else if (overall >= 4.5) {
    rating = "Strong";
  } else if (overall >= 3.0) {
    rating = "Moderate";
  } else {
    rating = "Weak";
  }

  return {
    thermal_score: thermal === null ? null : parseFloat(thermal.toFixed(2)),
    redevelopment_score: redev === null ? null : parseFloat(redev.toFixed(2)),
    overall_score: overall === null ? null : parseFloat(overall.toFixed(2)),
    overall_rating: rating,
    has_na: hasNA
  };
}

/**
 * Verify calculation against expected values
 * Useful for testing and debugging
 *
 * @param {Object} data - Project data
 * @param {Object} expected - Expected scores from Excel
 * @returns {Object} - Comparison results
 */
function verifyCalculation(data, expected) {
  const calculated = calculateAllScores(data);

  // Handle N/A values in comparison
  const thermalMatch = calculated.thermal_score === null
    ? (expected.thermal === null || expected.thermal === undefined || expected.thermal === 'N/A')
    : Math.abs(calculated.thermal_score - parseFloat(expected.thermal || 0)) < 0.01;

  const redevMatch = calculated.redevelopment_score === null
    ? (expected.redev === null || expected.redev === undefined || expected.redev === 'N/A')
    : Math.abs(calculated.redevelopment_score - parseFloat(expected.redev || 0)) < 0.01;

  const overallMatch = calculated.overall_score === null
    ? (expected.overall === null || expected.overall === undefined || expected.overall === 'N/A')
    : Math.abs(calculated.overall_score - parseFloat(expected.overall || 0)) < 0.01;

  return {
    calculated,
    expected: {
      thermal: expected.thermal ?? null,
      redev: expected.redev ?? null,
      overall: expected.overall ?? null
    },
    matches: {
      thermal: thermalMatch,
      redev: redevMatch,
      overall: overallMatch,
      all: thermalMatch && redevMatch && overallMatch
    }
  };
}

// CommonJS exports
module.exports = {
  calculateThermalScore,
  calculateRedevelopmentScore,
  calculateOverallScore,
  calculateAllScores,
  verifyCalculation,
  isNA,
  formatScoreDisplay
};
