/**
 * Score Calculations - Single Source of Truth
 *
 * This module contains the canonical score calculation functions that match
 * the Excel formulas exactly. These functions are used everywhere scores
 * are calculated to ensure consistency.
 *
 * Excel Formula Reference:
 * - Thermal Operating Score: =SUMPRODUCT([COD, Markets, Transactability, ThermalOpt, Environmental], [0.20, 0.30, 0.30, 0.05, 0.15])
 * - Redevelopment Score: =IF(any of Market/Infra/IX = 0, 0, (Market × 0.4 + Infra × 0.3 + IX × 0.3) × multiplier)
 *   where multiplier = 0.75 if "Repower", else 1
 * - Overall Project Score: = Thermal Operating Score + Redevelopment Score
 */

/**
 * Calculate Thermal Operating Score
 * Formula: (COD × 0.20) + (Markets × 0.30) + (Transactability × 0.30) + (ThermalOpt × 0.05) + (Environmental × 0.15)
 *
 * @param {Object} data - Project data object with component values
 * @returns {number} - Calculated thermal score
 */
export function calculateThermalScore(data) {
  // Helper to get numeric value, properly handling 0 as valid (not falsy)
  const getScore = (...sources) => {
    const defaultVal = sources.pop(); // Last argument is the default
    for (const src of sources) {
      if (src !== undefined && src !== null && src !== '') {
        const num = parseFloat(src);
        if (!isNaN(num)) return num;
      }
    }
    return defaultVal;
  };

  // Extract values - must handle 0 as a valid score, not as falsy
  const cod = getScore(data.plant_cod, data["Plant  COD"], data["Plant COD"], 0);
  const markets = getScore(data.markets, data["Markets"], 0);
  const transact = getScore(data.transactability_scores, data["Transactability Scores"], 0);

  // Thermal optimization has minimum value of 1
  const thermalOptRaw = getScore(data.thermal_optimization, data["Thermal Optimization"], 1);
  const thermalOpt = Math.max(1, isNaN(thermalOptRaw) ? 1 : thermalOptRaw);

  const environmental = getScore(data.environmental_score, data["Envionmental Score"], data["Environmental Score"], 2);

  // Calculate thermal score with Excel formula weights
  const score = (cod * 0.20) +
                (markets * 0.30) +
                (transact * 0.30) +
                (thermalOpt * 0.05) +
                (environmental * 0.15);

  return isNaN(score) ? 0 : score;
}

/**
 * Calculate Redevelopment Score
 * Formula: IF(any of Market/Infra/IX = 0, 0, (Market × 0.40 + Infra × 0.30 + IX × 0.30) × multiplier)
 * Multiplier: 0.75 if Co-Locate/Repower = "Repower", else 1
 *
 * @param {Object} data - Project data object with component values
 * @returns {number} - Calculated redevelopment score
 */
export function calculateRedevelopmentScore(data) {
  // Helper to get numeric value, properly handling 0 as valid (not falsy)
  const getScore = (primary, secondary, defaultVal) => {
    if (primary !== undefined && primary !== null && primary !== '') {
      const num = parseFloat(primary);
      if (!isNaN(num)) return num;
    }
    if (secondary !== undefined && secondary !== null && secondary !== '') {
      const num = parseFloat(secondary);
      if (!isNaN(num)) return num;
    }
    return defaultVal;
  };

  // Extract values - must handle 0 as a valid score, not as falsy
  const market = getScore(data.market_score, data["Market Score"], 2);
  const infra = getScore(data.infra, data["Infra"], 2);
  const ix = getScore(data.ix, data["IX"], 2);

  // Determine multiplier based on Co-Locate/Repower value
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

  return isNaN(score) ? 0 : score;
}

/**
 * Calculate Overall Project Score
 * Formula: Thermal Operating Score + Redevelopment Score
 *
 * @param {number} thermal - Thermal operating score
 * @param {number} redev - Redevelopment score
 * @returns {number} - Overall project score
 */
export function calculateOverallScore(thermal, redev) {
  const thermalVal = parseFloat(thermal) || 0;
  const redevVal = parseFloat(redev) || 0;
  return thermalVal + redevVal;
}

/**
 * Calculate all scores for a project
 * Returns thermal, redevelopment, and overall scores along with rating
 *
 * @param {Object} data - Project data object with all component values
 * @returns {Object} - Object containing all calculated scores and rating
 */
export function calculateAllScores(data) {
  const thermal = calculateThermalScore(data);
  const redev = calculateRedevelopmentScore(data);
  const overall = calculateOverallScore(thermal, redev);

  // Determine rating based on overall score
  let rating;
  if (overall >= 4.5) {
    rating = "Strong";
  } else if (overall >= 3.0) {
    rating = "Moderate";
  } else {
    rating = "Weak";
  }

  return {
    thermal_score: parseFloat(thermal.toFixed(2)),
    redevelopment_score: parseFloat(redev.toFixed(2)),
    overall_score: parseFloat(overall.toFixed(2)),
    overall_rating: rating
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
export function verifyCalculation(data, expected) {
  const calculated = calculateAllScores(data);

  const thermalMatch = Math.abs(calculated.thermal_score - parseFloat(expected.thermal || 0)) < 0.01;
  const redevMatch = Math.abs(calculated.redevelopment_score - parseFloat(expected.redev || 0)) < 0.01;
  const overallMatch = Math.abs(calculated.overall_score - parseFloat(expected.overall || 0)) < 0.01;

  return {
    calculated,
    expected: {
      thermal: parseFloat(expected.thermal || 0),
      redev: parseFloat(expected.redev || 0),
      overall: parseFloat(expected.overall || 0)
    },
    matches: {
      thermal: thermalMatch,
      redev: redevMatch,
      overall: overallMatch,
      all: thermalMatch && redevMatch && overallMatch
    }
  };
}

// Default export for convenience
export default {
  calculateThermalScore,
  calculateRedevelopmentScore,
  calculateOverallScore,
  calculateAllScores,
  verifyCalculation
};
