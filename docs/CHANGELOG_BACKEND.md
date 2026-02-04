# Backend Changes Detail

## Latest Changes (2026-02-04)

### backend/models/projectModel.js - M&A Tier Case-Insensitivity Fix

**Problem**: M&A Tier dropdown values with different casing (e.g., "Second Round" vs "second round") weren't being mapped correctly to tier IDs.

**Solution**: Normalize M&A Tier values to lowercase before mapping.

#### handleMaTier Function (in BOTH createProject and updateProject)

**OLD**:
```javascript
const handleMaTier = (maTierValue) => {
  if (!maTierValue) return null;

  const maTierMap = {
    'Owned': 1,
    'Exclusivity': 2,
    'second round': 3,
    'first round': 4,
    'pipeline': 5,
    'passed': 6
  };

  return maTierMap[maTierValue] || null;
};
```

**NEW**:
```javascript
const handleMaTier = (maTierValue) => {
  if (!maTierValue) return null;

  // Normalize to lowercase for case-insensitive matching
  const normalizedValue = maTierValue.toString().toLowerCase().trim();

  const maTierMap = {
    'owned': 1,
    'exclusivity': 2,
    'second round': 3,
    'first round': 4,
    'pipeline': 5,
    'passed': 6
  };

  return maTierMap[normalizedValue] || null;
};
```

**Result**: "Second Round", "SECOND ROUND", "second round" all correctly map to ID 3.

---

### backend/migrations/002_add_score_columns.sql - NEW Migration

**Purpose**: Add `capacity_size` and `fuel_score` columns to store calculated scores.

```sql
-- Add capacity_size column (0 or 1 based on MW threshold)
ALTER TABLE pipeline_dashboard.projects
ADD COLUMN IF NOT EXISTS capacity_size INTEGER;

-- Add fuel_score column (0 or 1 based on fuel type)
ALTER TABLE pipeline_dashboard.projects
ADD COLUMN IF NOT EXISTS fuel_score INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN pipeline_dashboard.projects.capacity_size IS
  'Score: 1 if MW > 50 (individual) or > 150 (portfolio), else 0';
COMMENT ON COLUMN pipeline_dashboard.projects.fuel_score IS
  'Score: 1 for Gas/Oil, 0 for Solar/Wind/Coal/BESS';
```

**To run this migration**:
```sql
-- Execute in Supabase SQL Editor or psql
ALTER TABLE pipeline_dashboard.projects ADD COLUMN IF NOT EXISTS capacity_size INTEGER;
ALTER TABLE pipeline_dashboard.projects ADD COLUMN IF NOT EXISTS fuel_score INTEGER;
```

---

### backend/utils/scoreCalculations.js - New Scoring Functions

Added two new scoring functions for the Add New Project auto-scoring feature:

#### calculateCapacitySizeScore

```javascript
/**
 * Calculate Capacity Size Score
 * Scores based on MW threshold: >50MW individual or >150MW portfolio = 1, else 0
 *
 * @param {number|string} mw - Capacity in MW
 * @param {boolean} isPortfolio - Whether this is a portfolio project
 * @returns {number|null} - Score (0 or 1) or null if input is missing
 */
function calculateCapacitySizeScore(mw, isPortfolio = false) {
  if (mw === null || mw === undefined || mw === '') return null;
  const mwNum = parseFloat(mw);
  if (isNaN(mwNum)) return null;
  const threshold = isPortfolio ? 150 : 50;
  return mwNum > threshold ? 1 : 0;
}
```

#### calculateFuelScore

```javascript
/**
 * Calculate Fuel Type Score
 * Gas/Oil = 1, Solar/Wind/Coal/BESS = 0
 *
 * @param {string} fuel - Fuel type
 * @returns {number|null} - Score (0 or 1) or null if input is missing
 */
function calculateFuelScore(fuel) {
  if (fuel === null || fuel === undefined || fuel === '') return null;
  const fuelStr = String(fuel).trim().toLowerCase();
  if (fuelStr === '') return null;
  // Gas, Oil = 1 point
  if (fuelStr.includes('gas') || fuelStr.includes('oil')) return 1;
  // Solar, Wind, Coal, BESS = 0 points
  if (fuelStr.includes('solar') || fuelStr.includes('wind') ||
      fuelStr.includes('coal') || fuelStr.includes('bess')) return 0;
  return 0; // Default
}
```

#### Updated Exports

```javascript
module.exports = {
  // ... existing exports
  calculateCapacitySizeScore,
  calculateFuelScore
};
```

---

## backend/models/expertAnalysis.js

### Storage Architecture Change (Option B)

**OLD**: Expert analysis stored in separate `expert_analysis` table

```javascript
// OLD: Query from expert_analysis table
const query = `
  SELECT ea.*, p.project_name as actual_project_name
  FROM ${schema}.expert_analysis ea
  LEFT JOIN ${schema}.projects p ON ea.project_id::varchar = p.id::varchar
  WHERE ea.project_id = $1
`;
```

**NEW**: Current values in `projects` table, history in `expert_analysis_history`

```javascript
// NEW: Query directly from projects table
const query = `
  SELECT
    p.id,
    p.project_name,
    p.thermal_optimization,
    p.environmental_score,
    p.market_score,
    p.infra,
    p.ix,
    COALESCE(p.thermal_score_calc, 0) as thermal_score_calc,
    COALESCE(p.redev_score_calc, 0) as redev_score_calc,
    COALESCE(p.overall_score_calc, 0) as overall_score_calc,
    p.expert_edited_by as edited_by,
    p.expert_edited_at as edited_at
  FROM ${schema}.projects p
  WHERE p.id = $1 AND p.is_active = true
`;
```

### Save Function - Server-Side Score Recalculation

**NEW**: Scores are recalculated server-side using canonical functions:

```javascript
// Recalculate scores using canonical functions
const recalculatedThermal = calculateThermalScore({
  plant_cod: projectComponents.plant_cod,
  markets: projectComponents.markets,
  transactability_scores: projectComponents.transactability_scores,
  thermal_optimization: thermalOptimizationScore,
  environmental_score: environmentalScoreValue
});

const recalculatedRedev = calculateRedevelopmentScore({
  market_score: marketScoreValue,
  infra: parseFloat(calculatedInfraScore),
  ix: interconnectionScore,
  co_locate_repower: projectComponents.co_locate_repower
});

const recalculatedOverall = calculateOverallScore(recalculatedThermal, recalculatedRedev);
```

### History Record Creation

**NEW**: Every save creates a history record:

```javascript
const historyQuery = `
  INSERT INTO ${schema}.expert_analysis_history (
    project_id, project_name,
    thermal_optimization_score, environmental_score,
    market_score, land_availability_score, utilities_score, interconnection_score,
    thermal_operating_score, redevelopment_score, infrastructure_score,
    overall_score, overall_rating, confidence,
    thermal_breakdown, redevelopment_breakdown,
    edited_by, edited_at, changes_summary
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), $18)
  RETURNING id
`;
```

---

## Transmission Interconnection Changes

### Delete-Then-Insert Pattern

**OLD**: Only upsert (insert or update on conflict):

```javascript
// OLD: ON CONFLICT only updates, never deletes
INSERT INTO ${schema}.transmission_interconnection (...)
VALUES (...)
ON CONFLICT (site, poi_voltage, project_id)
DO UPDATE SET ...
```

**NEW**: Delete all existing entries first, then insert:

```javascript
// NEW: Delete all existing entries for this project first
const deleteQuery = `
  DELETE FROM ${schema}.transmission_interconnection
  WHERE project_id = $1
`;
const deleteResult = await client.query(deleteQuery, [projectId]);
console.log(`Deleted ${deleteResult.rowCount} existing transmission records`);

// Then insert new entries
if (transmissionData.length > 0) {
  const insertQuery = `
    INSERT INTO ${schema}.transmission_interconnection (...)
    VALUES (...)
    RETURNING *
  `;
  // ... insert each entry
}
```

### Max 5 Entries Enforcement

**NEW**: Server-side validation:

```javascript
// Enforce max 5 entries
if (transmissionData.length > 5) {
  throw new Error('Maximum of 5 POI voltage entries allowed');
}
```

### Fetch by ProjectId

**NEW**: `getTransmissionInterconnectionByProjectId` improved:

```javascript
// NEW: Better type handling and logging
const query = `
  SELECT ti.*, p.project_name as actual_project_name,
         p.project_codename, p.iso, p.plant_owner
  FROM ${schema}.transmission_interconnection ti
  LEFT JOIN ${schema}.projects p ON ti.project_id::integer = p.id
  WHERE ti.project_id = $1::varchar
  ORDER BY ti.created_at DESC
`;
```

---

## backend/controllers/expertAnalysisController.js

### Transmission Fetch - ProjectId Support

**OLD**: Only supported `?project=name`

```javascript
// OLD
const { project } = req.query;
if (!project) {
  return res.status(400).json({ message: 'Project name is required' });
}
const transmissionData = await expertAnalysis.getTransmissionInterconnectionByProject(project);
```

**NEW**: Supports both `?project=name` and `?projectId=123`

```javascript
// NEW
const { project, projectId } = req.query;

if (!project && !projectId) {
  return res.status(400).json({ message: 'Project name or project ID is required' });
}

let transmissionData;
if (projectId) {
  // Prefer projectId if provided (more reliable)
  transmissionData = await expertAnalysis.getTransmissionInterconnectionByProjectId(projectId);
} else {
  transmissionData = await expertAnalysis.getTransmissionInterconnectionByProject(project);
}
```

---

## backend/routes/expertAnalysisRoutes.js

### New History Routes

**NEW**: Added edit history endpoints:

```javascript
// Edit History Routes (NEW - Option B)
router.get('/expert-analysis/history', protect, getEditHistory);
router.get('/expert-analysis/history/:historyId', protect, getHistoryEntry);
```

---

## New Backend Files

### backend/utils/scoreCalculations.js

Backend copy of the canonical score calculation functions, mirroring the frontend implementation for server-side recalculation.

### backend/scripts/checkTransactability.js

Utility script for validating transactability data in the database.

### backend/scripts/importToSupabase.js

Script for importing Excel data to Supabase.

### backend/scripts/runMigration.js

Database migration runner for schema updates.
