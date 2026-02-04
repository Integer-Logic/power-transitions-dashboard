# Power Pipeline Dashboard - Change Log

## 2026-02-04: Score Calculation Formula Fix (Excel Parity)

### Problem
The Overall Project Score, Thermal Operating Score, and Redevelopment Score calculations in the dashboard didn't match the Excel formulas.

### Excel Formulas (from MASTER - Operating Plants sheet)

**Thermal Operating Score** = Weighted average:
```
= SUMPRODUCT([COD, CapFactor, Markets, Transactability, ThermalOpt, Environmental],
             [0.20, 0, 0.30, 0.30, 0.05, 0.15])
```

**Redevelopment Score** = Conditional weighted average:
```
= IF(any of Market/Infra/IX = 0, 0,
     (Market × 0.4 + Infra × 0.3 + IX × 0.3) × multiplier)
where multiplier = 0.75 if "Repower", else 1
```

**Overall Project Score** = Simple sum (NOT multiplied by 2):
```
= Thermal Operating Score + Redevelopment Score
```

### Fix Applied

**ExpertAnalysisModal.jsx - generateDefaultAnalysis:**
Added extraction of additional project values needed for formula:
- `codScore` (Plant COD score)
- `capacityFactorScore` (Capacity Factor score)
- `marketsScore` (Markets score)
- `transactabilityScore` (Transactability score)
- `coLocateRepower` (determines Repower multiplier)

**ExpertAnalysisModal.jsx - recalculateScores:**
Updated to use Excel formulas:
```javascript
// Thermal Operating Score
thermalScore = (codScore * 0.20) + (marketsScore * 0.30) +
               (transactabilityScore * 0.30) + (thermalOptScore * 0.05) +
               (environmentalScore * 0.15);

// Redevelopment Score (with zero check and Repower multiplier)
if (marketScore === 0 || infrastructureScore === 0 || ixScore === 0) {
  redevelopmentScore = 0;
} else {
  redevelopmentScore = (marketScore * 0.40 + infrastructureScore * 0.30 + ixScore * 0.30) * repowerMultiplier;
}

// Overall = simple sum
overallScore = thermalScore + redevelopmentScore;
```

### Weight Summary

| Component | Weight |
|-----------|--------|
| **Thermal Operating Score** | |
| COD | 0.20 |
| Capacity Factor | 0 (not used) |
| Markets | 0.30 |
| Transactability | 0.30 |
| Thermal Optimization | 0.05 |
| Environmental | 0.15 |
| **Redevelopment Score** | |
| Market | 0.40 |
| Infra (avg of Land + Utilities) | 0.30 |
| IX (Interconnection) | 0.30 |
| Repower multiplier | 0.75 (if "Repower") |

---

## 2026-02-04: Expert Analysis Modal Sync with Project Details

### Problem
When opening Expert Analysis modal, the breakdown scores showed hardcoded default values (1, 2, 2, 2, 2, 2) instead of the actual values from the projects table (displayed in Pipeline Details).

### Root Cause
The `generateDefaultAnalysis` function used hardcoded defaults for breakdown scores:
```javascript
// Before - hardcoded defaults
thermalBreakdown: project.expertAnalysis?.thermalBreakdown || {
  thermal_optimization: { score: 1 },
  environmental: { score: 2 }
}
```

It did NOT read from the project's actual column values (`thermal_optimization`, `environmental_score`, `market_score`, `infra`, `ix`).

### Fix
Updated `generateDefaultAnalysis` in `ExpertAnalysisModal.jsx` to read breakdown values from the project data:

```javascript
// After - reads from project data (synced with Pipeline Details)
const thermalOptScore = Math.max(1, getIntValue(
  project.detailData?.thermal_optimization, 1
));
const envScore = getIntValue(project.detailData?.environmental_score, 2);
const marketScore = getIntValue(project.detailData?.market_score, 2);
const infraValue = getNumericValue(project.detailData?.infra, 2);
const ixScore = getIntValue(project.detailData?.ix, 2);
```

### Column Mapping
| Expert Analysis Field | Projects Table Column |
|----------------------|----------------------|
| Thermal Optimization | `thermal_optimization` |
| Environmental | `environmental_score` |
| Market Position | `market_score` |
| Land Availability | `infra` (estimated) |
| Utilities | `infra` (estimated) |
| Interconnection | `ix` |

---

## 2026-02-04: Thermal Optimization Minimum Value Enforcement

### Problem
Thermal Optimization Potential values in the projects table could be 0, but the minimum valid value is 1.

### Fix
Updated `backend/scripts/importToSupabase.js` to enforce minimum value of 1:

```javascript
// Thermal optimization must be minimum 1
const toThermalOptimization = (val) => {
  const str = toString(val);
  if (str === null) return '1'; // Default to 1
  const num = parseInt(str);
  if (isNaN(num) || num < 1) return '1'; // Minimum is 1
  return String(num);
};
```

Re-imported all 48 projects with this fix applied.

---

## 2026-02-04: Expert Analysis Save Notification Visibility

### Problem
The save notification in Expert Analysis Modal was disappearing immediately because the dashboard refresh (triggered right after save) caused a re-render that reset the modal state.

### Fix
In `ExpertAnalysisModal.jsx`, delayed the dashboard refresh to allow the notification to display:

**Before:**
1. Save to database
2. Show notification + trigger refresh immediately (notification gets wiped by re-render)

**After:**
1. Save to database
2. Show "Changes Saved!" notification immediately
3. After 2 seconds: trigger dashboard refresh
4. After 3 seconds: clear notification

```javascript
// Delay dashboard refresh to allow notification to show
setTimeout(() => {
  if (selectedExpertProject.onSaveSuccess) {
    selectedExpertProject.onSaveSuccess();
  }
  window.dispatchEvent(new Event('expertAnalysisUpdated'));
  if (window.refreshDashboardData) {
    window.refreshDashboardData();
  }
}, 2000);

// Clear success message after 3 seconds
setTimeout(() => {
  setSaveStatus(null);
}, 3000);
```

The notification system displays:
- Spinner animation during save
- Green checkmark with "Changes Saved!" for success
- Yellow info icon for "No Changes Made"
- Red X for errors

---

## 2026-02-04: Dashboard Auto-Refresh on Expert Analysis Save

### Problem
After saving changes in the Expert Analysis Modal, users had to manually refresh the page to see updated values in the Pipeline Details.

### Solution
Connected the existing event dispatch in ExpertAnalysisModal to DashboardContent's data fetch function.

**ExpertAnalysisModal (already existed):**
- Dispatches `expertAnalysisUpdated` event after save
- Calls `window.refreshDashboardData()` if defined

**DashboardContent.jsx (added):**
```javascript
// Auto-refresh when expert analysis is updated
useEffect(() => {
  // Define global refresh function for ExpertAnalysisModal to call
  window.refreshDashboardData = fetchData;

  // Listen for expertAnalysisUpdated event
  const handleExpertAnalysisUpdate = (event) => {
    console.log('[DashboardContent] Expert analysis updated, refreshing data...', event.detail);
    fetchData();
  };

  window.addEventListener('expertAnalysisUpdated', handleExpertAnalysisUpdate);

  // Cleanup on unmount
  return () => {
    delete window.refreshDashboardData;
    window.removeEventListener('expertAnalysisUpdated', handleExpertAnalysisUpdate);
  };
}, []);
```

### Result
Pipeline Details now automatically refresh when Expert Analysis changes are saved. No manual page refresh needed.

---

## 2026-02-04: Expert Analysis Option B Implementation

### Overview
Implemented Option B architecture for Expert Analysis feature:
- **Current values** stored directly in `projects` table (visible in Pipeline Details)
- **Edit history** stored in `expert_analysis_history` table (append-only audit log)
- Tracks WHO made edits, WHEN, and WHAT changed

### Problem Solved
Previously, the Expert Analysis Modal saved data to a separate `expert_analysis` table using JSONB breakdowns. This meant:
- Changes were NOT reflected in Pipeline Details
- No connection between modal scores and project table columns (`thermal_optimization`, `environmental_score`, `market_score`, `infra`, `ix`)

### Files Created

#### `backend/scripts/supabase_expert_analysis_option_b.sql`
SQL migration script that:
- Drops old `expert_analysis` table
- Creates `expert_analysis_history` table (append-only audit log)
- Adds new columns to `projects` table:
  - `thermal_optimization_score` (INTEGER)
  - `environmental_score_value` (INTEGER)
  - `market_score_value` (INTEGER)
  - `land_availability_score` (INTEGER)
  - `utilities_score` (INTEGER)
  - `interconnection_score` (INTEGER)
  - `thermal_operating_score_calc` (DECIMAL)
  - `redevelopment_score_calc` (DECIMAL)
  - `infrastructure_score_calc` (DECIMAL)
  - `overall_score_calc` (DECIMAL)
  - `overall_rating` (VARCHAR)
  - `confidence` (INTEGER)
  - `expert_edited_by` (VARCHAR)
  - `expert_edited_at` (TIMESTAMP)
- Creates view `v_project_expert_analysis` for easy access
- Creates function `get_project_edit_history()` for querying history

### Files Modified

#### `backend/models/expertAnalysis.js`
Complete rewrite for Option B:
- `getExpertAnalysisByProjectId(projectId)` - Now reads directly from `projects` table
- `saveExpertAnalysis(analysisData)` - Updates `projects` table AND inserts history record
- `getEditHistory(projectId, limit)` - NEW: Returns list of edits for a project
- `getHistoryEntry(historyId)` - NEW: Returns full details of a specific edit
- `checkExpertAnalysisExists(projectName)` - Updated to check `expert_edited_at` column

#### `backend/controllers/expertAnalysisController.js`
- Updated `getExpertAnalysis` to work with new model format
- Updated `saveExpertAnalysis` to handle new response format
- Added `getEditHistory` controller for history endpoint
- Added `getHistoryEntry` controller for single history entry

#### `backend/routes/expertAnalysisRoutes.js`
Added new routes:
- `GET /api/expert-analysis/history` - Get edit history for a project
- `GET /api/expert-analysis/history/:historyId` - Get specific history entry

### Data Flow

```
Expert Analysis Modal saves →
├── 1. UPDATE projects table
│     • Individual breakdown scores
│     • Calculated aggregate scores
│     • Legacy columns (backwards compatibility)
│     • Edit tracking (expert_edited_by, expert_edited_at)
│
└── 2. INSERT into expert_analysis_history
        • Full snapshot of all scores at time of edit
        • edited_by, edited_at
        • changes_summary (what changed)
```

### Column Mapping (Modal → Projects Table)

**IMPORTANT**: Uses EXISTING columns in projects table for Pipeline Details display.
Individual breakdown values (land_availability, utilities) are stored ONLY in history JSONB.

| Modal Field | Projects Column | Type | Notes |
|-------------|-----------------|------|-------|
| thermalBreakdown.thermal_optimization.score | `thermal_optimization` | VARCHAR | Existing column |
| thermalBreakdown.environmental.score | `environmental_score` | VARCHAR | Existing column |
| redevelopmentBreakdown.redev_market.score | `market_score` | VARCHAR | Existing column |
| **infrastructureScore** (calculated) | `infra` | VARCHAR | **avg(land + utilities)** |
| redevelopmentBreakdown.interconnection.score | `ix` | VARCHAR | Existing column |
| Calculated thermal score | `thermal_score_calc` | DECIMAL | New column |
| Calculated redev score | `redev_score_calc` | DECIMAL | New column |
| Calculated overall score | `overall_score_calc` | DECIMAL | New column |

**Infrastructure Score Calculation:**
```javascript
infra = (land_availability + utilities) / 2
```
- `land_availability` and `utilities` are NOT stored separately in projects table
- They ARE stored in `expert_analysis_history.redevelopment_breakdown` (JSONB) for audit
- When reading, `infra` value is used to estimate both land_availability and utilities

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expert-analysis?projectId=X` | Get current expert analysis for project |
| POST | `/api/expert-analysis` | Save expert analysis (updates projects + creates history) |
| GET | `/api/expert-analysis/history?projectId=X` | Get edit history for project |
| GET | `/api/expert-analysis/history/:historyId` | Get specific history entry |

### Migration Steps

1. Run SQL migration in Supabase SQL Editor:
   ```sql
   -- Copy contents of backend/scripts/supabase_expert_analysis_option_b.sql
   ```

2. Restart backend server to pick up code changes

3. Test by:
   - Opening Expert Analysis Modal for a project
   - Making changes and saving
   - Verifying changes appear in Pipeline Details
   - Checking `expert_analysis_history` table for audit record

### Benefits

1. **Single Source of Truth**: Current values in `projects` table
2. **Immediate Visibility**: Changes reflect in Pipeline Details instantly
3. **Full Audit Trail**: Every edit is logged with who/when/what
4. **Backwards Compatible**: Legacy columns still updated
5. **Query History**: Can answer "who changed what, when?"

---

## 2026-02-04: Expert Analysis Edits Not Persisting Fix

### Problem
Changes made in Expert Analysis Modal immediately reverted to default values after saving.

### Root Cause
API response format mismatch between DashboardContent and ExpertAnalysisModal.

**API returns:**
```json
{ "success": true, "data": { "thermalBreakdown": {...}, ... } }
```

**DashboardContent returned:**
```javascript
return data;  // Returns the wrapper: { success: true, data: {...} }
```

**Modal expected:**
```javascript
dbAnalysis.thermalBreakdown  // undefined! It's actually in dbAnalysis.data.thermalBreakdown
```

### Fix Applied

**DashboardContent.jsx - fetchExpertAnalysis:**
```javascript
// Extract actual data from API response wrapper
if (data && data.success && data.data) {
  return data.data;
}
return data;
```

**DashboardContent.jsx - saveExpertAnalysis:**
Same fix applied for consistency.

### Result
Expert Analysis edits now persist correctly to the database and display properly when modal is reopened.

---

## 2026-02-04: Expert Analysis Score Fields - Allow 0 Values

### Problem
Market Position and other score fields in Expert Analysis Modal couldn't select 0 because JavaScript's `||` operator treats 0 as falsy.

### Root Cause
Code like `value={score || 2}` would fall back to 2 when score was 0.

### Fix Applied

**Frontend (ExpertAnalysisModal.jsx):**
Changed `||` to `??` (nullish coalescing) for fields that allow 0:
- Environmental: `|| 2` → `?? 2`
- Market Position: `|| 2` → `?? 2`
- Land Availability: `|| 2` → `?? 2`
- Utilities: `|| 2` → `?? 2`
- Interconnection: `|| 2` → `?? 2`

**Kept as is:**
- Thermal Optimization: `|| 1` (minimum value is 1, not 0)

**Backend (expertAnalysis.js):**
Added helper functions to properly parse values while allowing 0:
```javascript
const parseIntOrDefault = (val, defaultVal) => {
  const parsed = parseInt(val);
  return isNaN(parsed) ? defaultVal : parsed;
};
```

### Fields and Allowed Ranges

| Field | Min | Max | Default |
|-------|-----|-----|---------|
| Thermal Optimization | 1 | 2 | 1 |
| Environmental | 0 | 3 | 2 |
| Market Position | 0 | 3 | 2 |
| Land Availability | 0 | 3 | 2 |
| Utilities | -1 | 3 | 2 |
| Interconnection | 0 | 3 | 2 |

---

## 2026-02-04: Transactability Import Fix

### Problem
Transactability columns were NULL for all 48 projects despite data existing in Excel.

### Root Cause
Excel column names had trailing spaces:
- `"Transactability Scores "` (with trailing space)
- `"Transactability "` (with trailing space)

Import script was looking for columns WITHOUT trailing spaces, causing mismatch.

### Fix Applied
1. Updated `backend/scripts/importToSupabase.js` to trim all Excel column names:
```javascript
data = data.map(row => {
  const cleanRow = {};
  Object.keys(row).forEach(key => {
    cleanRow[key.trim()] = row[key];
  });
  return cleanRow;
});
```

2. Expanded `transactability` column from VARCHAR(50) to VARCHAR(255) (values were too long)

3. Re-imported all 48 projects

### Result
- 45/48 projects now have transactability text
- 34/48 projects now have transactability scores

---

## Previous Changes (Pre-2026-02-04)

### Database Migration: Azure → Supabase
- Migrated from Azure PostgreSQL to Supabase
- Updated connection strings and pooler configuration
- Fixed schema references (`pipeline_dashboard` schema)

### Frontend API URL Fixes
- Fixed 16+ hardcoded Azure URLs in `DashboardContent.jsx`
- Updated to use `import.meta.env.VITE_API_URL` with localhost fallback
- Fixed `AuthContext.jsx` API URL configuration

### Data Import
- Imported 48 projects from Excel (`pt_cleanedrecords.xlsx`) to Supabase
- Created import script `backend/scripts/importToSupabase.js`

### Schema Fixes
- Added missing `ma_tiers` table
- Added `is_active` columns to lookup tables
- Recreated `projects` table with all required columns
