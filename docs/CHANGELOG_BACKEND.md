# Backend Changes Detail

## Latest Changes (2026-02-04)

---

## SQL / Database Schema Changes

This section documents all SQL changes including new tables, schema updates, views, and functions.

### Migration Files

| File | Purpose | Run Order |
|------|---------|-----------|
| `backend/scripts/supabase_full_setup.sql` | Initial schema with all tables | 1 (first time) |
| `backend/scripts/supabase_migration_fix.sql` | Add M&A tiers, recreate projects with full schema | 2 |
| `backend/scripts/supabase_add_expert_tables.sql` | Add expert_analysis and transmission_interconnection | 3 |
| `backend/scripts/supabase_expert_analysis_option_b.sql` | History tracking for expert analysis | 4 |
| `backend/migrations/002_add_score_columns.sql` | **NEW** Add capacity_size and fuel_score columns | 5 |

---

### NEW TABLES

#### `ma_tiers` - M&A Tier Lookup Table
**File**: `supabase_migration_fix.sql`

```sql
CREATE TABLE IF NOT EXISTS ma_tiers (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(50) UNIQUE NOT NULL,
    tier_order INTEGER DEFAULT 0,
    color_hex VARCHAR(7) DEFAULT '#6b7280',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default data:
-- 1: Owned (#8b5cf6)
-- 2: Exclusivity (#10b981)
-- 3: second round (#3b82f6)
-- 4: first round (#f59e0b)
-- 5: pipeline (#6b7280)
-- 6: passed (#ef4444)
```

#### `expert_analysis_history` - Audit Trail for Expert Scores
**File**: `supabase_expert_analysis_option_b.sql`

```sql
CREATE TABLE IF NOT EXISTS expert_analysis_history (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    project_name VARCHAR(255),

    -- Individual breakdown scores
    thermal_optimization_score INTEGER DEFAULT 0,
    environmental_score INTEGER DEFAULT 2,
    market_score INTEGER DEFAULT 2,
    land_availability_score INTEGER DEFAULT 2,
    utilities_score INTEGER DEFAULT 2,
    interconnection_score INTEGER DEFAULT 2,

    -- Calculated scores at time of edit
    thermal_operating_score DECIMAL(5,2) DEFAULT 0,
    redevelopment_score DECIMAL(5,2) DEFAULT 0,
    infrastructure_score DECIMAL(5,2) DEFAULT 0,
    overall_score DECIMAL(5,2) DEFAULT 0,
    overall_rating VARCHAR(50) DEFAULT 'N/A',
    confidence INTEGER DEFAULT 75,

    -- Full breakdown JSONB for complete audit trail
    thermal_breakdown JSONB DEFAULT '{}',
    redevelopment_breakdown JSONB DEFAULT '{}',

    -- Audit info
    edited_by VARCHAR(100) NOT NULL,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edit_reason TEXT,
    changes_summary TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `transmission_interconnection` - POI Voltage Data
**File**: `supabase_add_expert_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS transmission_interconnection (
    id SERIAL PRIMARY KEY,
    site VARCHAR(255),
    poi_voltage VARCHAR(50),
    excess_injection_capacity DECIMAL(10,2) DEFAULT 0,
    excess_withdrawal_capacity DECIMAL(10,2) DEFAULT 0,
    constraints TEXT DEFAULT '-',
    excess_ix_capacity BOOLEAN DEFAULT TRUE,
    project_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(site, poi_voltage, project_id)
);
```

---

### SCHEMA UPDATES (ALTER TABLE)

#### `projects` Table - New Columns

**File**: `supabase_expert_analysis_option_b.sql`
```sql
-- Calculated score columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS overall_score_calc DECIMAL(5,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS thermal_score_calc DECIMAL(5,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS redev_score_calc DECIMAL(5,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS overall_rating VARCHAR(50) DEFAULT 'N/A';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS confidence INTEGER DEFAULT 75;

-- Expert analysis edit tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expert_edited_by VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expert_edited_at TIMESTAMP;
```

**File**: `backend/migrations/002_add_score_columns.sql` (NEW)
```sql
-- Component score columns for Add Project feature
ALTER TABLE pipeline_dashboard.projects ADD COLUMN IF NOT EXISTS capacity_size INTEGER;
ALTER TABLE pipeline_dashboard.projects ADD COLUMN IF NOT EXISTS fuel_score INTEGER;

-- Documentation comments
COMMENT ON COLUMN pipeline_dashboard.projects.capacity_size IS
  'Score: 1 if MW > 50 (individual) or > 150 (portfolio), else 0';
COMMENT ON COLUMN pipeline_dashboard.projects.fuel_score IS
  'Score: 1 for Gas/Oil, 0 for Solar/Wind/Coal/BESS';
```

#### Lookup Tables - is_active Column
**File**: `supabase_migration_fix.sql`
```sql
ALTER TABLE redev_fuels ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE redev_base_cases ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE redev_lead_options ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE redev_support_options ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE co_locate_repower_options ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
```

---

### NEW VIEWS

#### `v_project_expert_analysis` - Expert Analysis View
**File**: `supabase_expert_analysis_option_b.sql`

```sql
CREATE OR REPLACE VIEW v_project_expert_analysis AS
SELECT
    p.id,
    p.project_name,
    p.project_codename,
    p.plant_owner,
    p.location,
    p.iso,
    p.legacy_nameplate_capacity_mw,
    p.tech,
    p.thermal_optimization,
    p.environmental_score,
    p.market_score,
    p.infra,
    p.ix,
    p.thermal_score_calc,
    p.redev_score_calc,
    p.overall_score_calc,
    p.overall_rating,
    p.confidence,
    p.expert_edited_by AS edited_by,
    p.expert_edited_at AS edited_at,
    p.updated_at
FROM projects p
WHERE p.is_active = true;
```

---

### NEW FUNCTIONS

#### `get_project_edit_history()` - Retrieve Edit History
**File**: `supabase_expert_analysis_option_b.sql`

```sql
CREATE OR REPLACE FUNCTION get_project_edit_history(p_project_id INTEGER)
RETURNS TABLE (
    edit_id INTEGER,
    edited_by VARCHAR(100),
    edited_at TIMESTAMP,
    overall_score DECIMAL(5,2),
    thermal_score DECIMAL(5,2),
    redevelopment_score DECIMAL(5,2),
    infrastructure_score DECIMAL(5,2),
    changes_summary TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT h.id, h.edited_by, h.edited_at, h.overall_score,
           h.thermal_operating_score, h.redevelopment_score,
           h.infrastructure_score, h.changes_summary
    FROM expert_analysis_history h
    WHERE h.project_id = p_project_id
    ORDER BY h.edited_at DESC;
END;
$$ LANGUAGE plpgsql;
```

---

### NEW INDEXES

```sql
-- Expert Analysis History
CREATE INDEX IF NOT EXISTS idx_expert_history_project_id ON expert_analysis_history(project_id);
CREATE INDEX IF NOT EXISTS idx_expert_history_edited_at ON expert_analysis_history(edited_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_history_edited_by ON expert_analysis_history(edited_by);

-- Transmission Interconnection
CREATE INDEX IF NOT EXISTS idx_transmission_site ON transmission_interconnection(site);
CREATE INDEX IF NOT EXISTS idx_transmission_project_id ON transmission_interconnection(project_id);

-- Projects (additional)
CREATE INDEX IF NOT EXISTS idx_projects_iso ON projects(iso);
CREATE INDEX IF NOT EXISTS idx_projects_ma_tier ON projects(ma_tier);
CREATE INDEX IF NOT EXISTS idx_projects_ma_tier_id ON projects(ma_tier_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
```

---

### Complete `projects` Table Schema

After all migrations, the `projects` table has these columns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `excel_row_id` | INTEGER | Original Excel row reference |
| `project_name` | VARCHAR(255) | Project name |
| `project_codename` | VARCHAR(100) | Internal codename |
| `plant_owner` | VARCHAR(255) | Owner name |
| `location` | VARCHAR(255) | Location |
| `site_acreage` | VARCHAR(50) | Site size |
| `status` | VARCHAR(50) | Operating/Future/Retired |
| `project_type` | VARCHAR(100) | Redev/M&A/Owned |
| `overall_project_score` | VARCHAR(50) | Display score |
| `thermal_operating_score` | VARCHAR(50) | Display score |
| `redevelopment_score` | VARCHAR(50) | Display score |
| `environmental_score` | VARCHAR(50) | Expert input |
| `market_score` | VARCHAR(50) | Expert input |
| `plant_cod` | VARCHAR(50) | **Calculated score** (0-3) |
| `capacity_factor` | VARCHAR(50) | **Calculated score** (0-3) |
| `markets` | VARCHAR(255) | **Calculated score** (0-3) |
| `transactability_scores` | VARCHAR(50) | **Calculated score** (1-3) |
| `capacity_size` | INTEGER | **NEW: Calculated score** (0-1) |
| `fuel_score` | INTEGER | **NEW: Calculated score** (0-1) |
| `ma_tier` | VARCHAR(50) | M&A tier name |
| `ma_tier_id` | INTEGER | FK to ma_tiers |
| `poi_voltage_kv` | VARCHAR(50) | POI voltage |
| `thermal_optimization` | VARCHAR(255) | Expert input |
| `infra` | VARCHAR(100) | Infrastructure score |
| `ix` | VARCHAR(100) | Interconnection score |
| `overall_score_calc` | DECIMAL(5,2) | Calculated overall |
| `thermal_score_calc` | DECIMAL(5,2) | Calculated thermal |
| `redev_score_calc` | DECIMAL(5,2) | Calculated redev |
| `overall_rating` | VARCHAR(50) | Strong/Moderate/Weak |
| `confidence` | INTEGER | Confidence % |
| `expert_edited_by` | VARCHAR(100) | Last editor |
| `expert_edited_at` | TIMESTAMP | Last edit time |
| ... | ... | (other technical/redev columns) |

---

## Code Changes

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
