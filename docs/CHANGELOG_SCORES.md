# Score Calculations Changes Detail

## Overview

The score calculation system was completely refactored to:
1. Use a **single source of truth** for score calculations
2. Properly handle **N/A value propagation** when Excel data is missing
3. Match the **exact Excel formulas**

---

## Latest Changes (2026-02-04)

### New Scoring Functions in SCORE_MAPPINGS

Added two new scoring functions to `src/constants/index.jsx`:

#### capacitySize

Scores based on MW threshold with different rules for individual vs portfolio projects.

```javascript
capacitySize: (mw, isPortfolio = false) => {
  if (mw === null || mw === undefined || mw === '') return null;
  const mwNum = parseFloat(mw);
  if (isNaN(mwNum)) return null;
  const threshold = isPortfolio ? 150 : 50;
  return mwNum > threshold ? 1 : 0;
},
```

| Type | Threshold | >Threshold | ≤Threshold |
|------|-----------|------------|------------|
| Individual | 50 MW | 1 | 0 |
| Portfolio | 150 MW | 1 | 0 |

#### fuelType

Scores fuel types based on dispatchability.

```javascript
fuelType: (fuel) => {
  if (fuel === null || fuel === undefined || fuel === '') return null;
  const fuelStr = String(fuel).trim().toLowerCase();
  if (fuelStr === '') return null;
  // Gas, Oil = 1 point
  if (fuelStr.includes('gas') || fuelStr.includes('oil')) return 1;
  // Solar, Wind, Coal, BESS = 0 points
  if (fuelStr.includes('solar') || fuelStr.includes('wind') ||
      fuelStr.includes('coal') || fuelStr.includes('bess')) return 0;
  return 0; // Default
},
```

| Fuel Type | Score |
|-----------|-------|
| Gas | 1 |
| Oil | 1 |
| Solar | 0 |
| Wind | 0 |
| Coal | 0 |
| BESS | 0 |

### Fixed: transactability Function

**Problem**: The transactability dropdown stores numeric values (1, 2, 3) but the scoring is inverted.

**OLD** (incorrect for dropdown values):
```javascript
transactability: (type) => {
  if (typeof type !== 'string') {
    const num = parseFloat(type);
    if (!isNaN(num)) return Math.min(Math.max(Math.round(num), 0), 3);
    return null;
  }
  // ... text handling
},
```

**NEW** (properly maps dropdown values):
```javascript
transactability: (type) => {
  if (type === null || type === undefined || type === '') return null;

  // Handle numeric values from dropdown (1, 2, 3)
  const num = parseInt(type);
  if (!isNaN(num)) {
    // Dropdown value 1 = Bilateral w/ developed = highest score (3)
    // Dropdown value 2 = Bilateral new/Process <10 = score 2
    // Dropdown value 3 = Competitive >10 = lowest score (1)
    if (num === 1) return 3;
    if (num === 2) return 2;
    if (num === 3) return 1;
  }

  // Handle text descriptions (fallback)
  const typeStr = String(type).trim().toLowerCase();
  if (typeStr.includes("bilateral") && typeStr.includes("developed")) return 3;
  if (typeStr.includes("bilateral") || typeStr.includes("process")) return 2;
  if (typeStr.includes("competitive")) return 1;
  return 2;
},
```

| Dropdown Value | Label | Score |
|----------------|-------|-------|
| 1 | Bilateral w/ developed relationship | 3 |
| 2 | Bilateral new/Process <10 bidders | 2 |
| 3 | Competitive >10 bidders | 1 |

### Complete Scoring Rules Reference

| Field | Values | Score |
|-------|--------|-------|
| **Capacity Size** | >50MW individual or >150MW portfolio | 1 |
| | ≤50MW individual or ≤150MW portfolio | 0 |
| **Fuel** | Gas, Oil | 1 |
| | Solar, Wind, Coal, BESS | 0 |
| **Unit COD** | <2000 | 3 |
| | 2000-2005 | 2 |
| | >2005 | 1 |
| **Capacity Factor** | <10% | 3 |
| | 10-25% | 2 |
| | 25-100% | 1 |
| **Markets** | PJM, NYISO, ISO-NE | 3 |
| | MISO North, SERC | 2 |
| | SPP, MISO South | 1 |
| | ERCOT, WECC, CAISO | 0 |
| **Transactability** | Bilateral w/ developed relationship | 3 |
| | Bilateral new/Process <10 bidders | 2 |
| | Competitive Process >10 bidders | 1 |
| **Thermal Optimization** | Readily apparent value add | 2 |
| | No identifiable value add | 1 |
| | Yet to be saved | 0 |

---

## New Files

### src/utils/naValues.js

**Purpose**: Handle N/A (missing) values properly

```javascript
/**
 * Check if a value is N/A (null, undefined, or empty)
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
 */
export function parseNullableNumber(value) {
  // Explicitly handle 0 as a valid value
  if (value === 0) return 0;
  if (isNA(value)) return null;
  // ... parsing logic
}

/**
 * Format a score value for display
 * Returns "N/A" for null values, formatted number otherwise
 */
export function formatScoreDisplay(value, decimals = 2) {
  if (value === null || value === undefined) return 'N/A';
  return parseFloat(value).toFixed(decimals);
}
```

---

### src/utils/scoreCalculations.js

**Purpose**: Single source of truth for all score calculations

#### Excel Formula Reference

```
Thermal Operating Score:
= (COD × 0.20) + (Markets × 0.30) + (Transactability × 0.30)
  + (ThermalOpt × 0.05) + (Environmental × 0.15)

Redevelopment Score:
= IF(any of Market/Infra/IX = 0, 0,
     (Market × 0.40 + Infra × 0.30 + IX × 0.30) × multiplier)
where multiplier = 0.75 if "Repower", else 1

Overall Project Score:
= Thermal Operating Score + Redevelopment Score
```

#### Thermal Score Calculation

```javascript
export function calculateThermalScore(data) {
  // Extract values - handles multiple field name formats
  const cod = getScore(data.plant_cod, data["Plant  COD"], data["Plant COD"]);
  const markets = getScore(data.markets, data["Markets"]);
  const transact = getScore(data.transactability_scores, data["Transactability Scores"]);
  const environmental = getScore(data.environmental_score, data["Environmental Score"]);

  // thermal_optimization defaults to 0 (EXCEPTION - does not propagate N/A)
  const thermalOptRaw = getScore(data.thermal_optimization, data["Thermal Optimization"]);
  const thermalOpt = thermalOptRaw === null ? 0 : thermalOptRaw;

  // N/A Propagation: If any required field is null, return null
  if (cod === null || markets === null || transact === null || environmental === null) {
    return null;
  }

  // Calculate with Excel formula weights
  const score = (cod * 0.20) +
                (markets * 0.30) +
                (transact * 0.30) +
                (thermalOpt * 0.05) +
                (environmental * 0.15);

  return score;
}
```

#### Redevelopment Score Calculation

```javascript
export function calculateRedevelopmentScore(data) {
  const market = getScore(data.market_score, data["Market Score"]);
  const infra = getScore(data.infra, data["Infra"]);
  const ix = getScore(data.ix, data["IX"]);

  // N/A Propagation
  if (market === null || infra === null || ix === null) {
    return null;
  }

  // Multiplier based on Co-Locate/Repower
  const coLocate = (data.co_locate_repower || data["Co-Locate/Repower"] || "")
    .toString().toLowerCase().trim();
  const multiplier = coLocate === "repower" ? 0.75 : 1;

  // If any of Market, Infra, or IX is 0, return 0
  if (market === 0 || infra === 0 || ix === 0) {
    return 0;
  }

  // Calculate with Excel formula weights
  const score = ((market * 0.40) + (infra * 0.30) + (ix * 0.30)) * multiplier;

  return score;
}
```

#### Overall Score Calculation

```javascript
export function calculateOverallScore(thermal, redev) {
  // N/A Propagation: If either score is null, return null
  if (thermal === null || redev === null) {
    return null;
  }

  return parseFloat(thermal) + parseFloat(redev);
}
```

#### All Scores with Rating

```javascript
export function calculateAllScores(data) {
  const thermal = calculateThermalScore(data);
  const redev = calculateRedevelopmentScore(data);
  const overall = calculateOverallScore(thermal, redev);

  const hasNA = thermal === null || redev === null || overall === null;

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
```

---

## Changes to Existing Files

### src/utils/scoring.js

**OLD**: Used direct Excel values, crashed on null:

```javascript
export function generateExpertAnalysis(projectData) {
  // CRITICAL FIX: Use the Excel values directly from the spreadsheet
  const overallScore = parseFloat(projectData["Overall Project Score"] || "0").toFixed(1);
  const thermalScore = parseFloat(projectData["Thermal Operating Score"] || "0").toFixed(1);
  // ... etc
}
```

**NEW**: Uses canonical calculations, handles null:

```javascript
export function generateExpertAnalysis(projectData) {
  // Use canonical score calculation function
  const scores = calculateAllScores(projectData);

  // Handle null scores (N/A values)
  const overallScore = scores.overall_score !== null
    ? scores.overall_score.toFixed(1) : "0.0";
  const thermalScore = scores.thermal_score !== null
    ? scores.thermal_score.toFixed(1) : "0.0";
  const redevelopmentScore = scores.redevelopment_score !== null
    ? scores.redevelopment_score.toFixed(1) : "0.0";

  // Use numeric value for rating comparison
  const overallNumeric = parseFloat(overallScore);
  const overallRating = overallNumeric >= 4.5 ? "Strong" :
                       overallNumeric >= 3.0 ? "Moderate" : "Weak";
  // ...
}
```

---

## N/A Propagation Rules

| Field | If Missing... |
|-------|--------------|
| `plant_cod` | Thermal score = N/A |
| `markets` | Thermal score = N/A |
| `transactability_scores` | Thermal score = N/A |
| `environmental_score` | Thermal score = N/A |
| `thermal_optimization` | **Defaults to 0** (exception) |
| `market_score` | Redevelopment score = N/A |
| `infra` | Redevelopment score = N/A |
| `ix` | Redevelopment score = N/A |
| `co_locate_repower` | Defaults to multiplier 1 |
| Thermal score = N/A | Overall score = N/A |
| Redevelopment score = N/A | Overall score = N/A |

---

## Backend Mirror

### backend/utils/scoreCalculations.js

The backend has a mirror of the frontend score calculations for server-side recalculation. This ensures consistency when expert analysis is saved - scores are recalculated server-side using the same formulas.

```javascript
// Backend imports and uses the same calculation logic
const { calculateThermalScore, calculateRedevelopmentScore, calculateOverallScore }
  = require('../utils/scoreCalculations');

// In saveExpertAnalysis:
const recalculatedThermal = calculateThermalScore({
  plant_cod: projectComponents.plant_cod,
  markets: projectComponents.markets,
  transactability_scores: projectComponents.transactability_scores,
  thermal_optimization: thermalOptimizationScore,
  environmental_score: environmentalScoreValue
});
```

This ensures that even if the frontend sends incorrect scores, the server recalculates and stores the correct values.
