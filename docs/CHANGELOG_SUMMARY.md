# Codebase Changes Summary

## Overview

This document outlines all changes made to the power-pipeline-dashboard codebase compared to the previous version (`power-pipeline-dashboard-main-old`).

---

## Latest Changes (2026-02-04)

### Add Project - Score Persistence Fix (HIGH PRIORITY)

**Problem**: Calculated scores (Plant COD, Fuel, Capacity Size, etc.) were displayed in the preview but **never saved to the database** when creating a project.

**Root Cause**: `handleAddSiteSubmit` in `DashboardContent.jsx` only sent raw values, not the calculated scores from `SCORE_MAPPINGS`.

#### Files Modified
| File | Changes |
|------|---------|
| `src/DashboardContent.jsx` | Import SCORE_MAPPINGS, calculate scores in handleAddSiteSubmit, add poi_voltage_kv to state/reset/numericFields |
| `backend/models/projectModel.js` | Make M&A Tier mapping case-insensitive (both createProject and updateProject) |
| `backend/migrations/002_add_score_columns.sql` | **NEW** Migration to add `capacity_size` and `fuel_score` columns |

#### Scores Now Saved to Database
| Score Field | Calculated From | Rules |
|-------------|-----------------|-------|
| `plant_cod` | Legacy COD year | 3 if <2000, 2 if 2000-2005, 1 if >2005 |
| `capacity_size` | MW | 1 if >50MW (individual) or >150MW (portfolio), else 0 |
| `fuel_score` | Fuel Type | 1 for Gas/Oil, 0 for Solar/Wind/Coal/BESS |
| `capacity_factor` | CF% | 3 if <10%, 2 if 10-25%, 1 if 25-100% |
| `markets` | ISO/RTO | 3=PJM/NYISO/ISO-NE, 2=MISO North/SERC, 1=SPP/MISO South, 0=ERCOT/WECC/CAISO |
| `transactability_scores` | Transactability | 3=Bilateral developed, 2=Bilateral new/<10 bidders, 1=Competitive >10 |

#### POI Voltage Field Added
- Added `poi_voltage_kv` to initial state, reset state, and numericFields array
- Ensures POI Voltage is properly handled as a numeric field

#### M&A Tier Case-Insensitivity Fix
- Backend now normalizes M&A Tier values to lowercase before mapping
- "Second Round", "SECOND ROUND", "second round" all map to ID 3

---

### Add New Project - Auto-Scoring Rules (Previous)

Added real-time score calculation and preview to the Add New Project modal.

#### New Scoring Functions
- **Capacity Size**: >50MW individual or >150MW portfolio = 1, else 0
- **Fuel Type**: Gas/Oil = 1, Solar/Wind/Coal/BESS = 0

#### Files Modified
| File | Changes |
|------|---------|
| `src/constants/index.jsx` | Added `capacitySize` and `fuelType` to SCORE_MAPPINGS, fixed `transactability` for numeric dropdown values |
| `src/components/Modals/AddSiteModal.jsx` | Added portfolio checkbox, real-time score calculation, Calculated Scores Preview section |
| `backend/utils/scoreCalculations.js` | Added `calculateCapacitySizeScore` and `calculateFuelScore` functions |

#### Features Added
- **Portfolio Checkbox**: Toggle between individual (>50MW) and portfolio (>150MW) capacity thresholds
- **Real-Time Score Preview**: Shows 6 calculated scores as user fills form (Capacity Size, Fuel, Unit COD, Capacity Factor, Markets, Transactability)
- **Color-Coded Scores**: Green (high), yellow (medium), red (low), gray (N/A)

---

## SQL / Database Schema Changes

### Quick Reference - Run Order

| # | File | Purpose |
|---|------|---------|
| 1 | `supabase_full_setup.sql` | Initial schema (first time only) |
| 2 | `supabase_migration_fix.sql` | Add ma_tiers table, rebuild projects |
| 3 | `supabase_add_expert_tables.sql` | Add expert_analysis, transmission_interconnection |
| 4 | `supabase_expert_analysis_option_b.sql` | History tracking, new columns |
| 5 | `migrations/002_add_score_columns.sql` | **NEW** Add capacity_size, fuel_score |

### New Tables

| Table | Purpose |
|-------|---------|
| `ma_tiers` | M&A Tier lookup (Owned, Exclusivity, etc.) |
| `expert_analysis_history` | Audit trail for expert score edits |
| `transmission_interconnection` | POI voltage data (max 5 entries per project) |

### New Columns on `projects` Table

| Column | Type | Source |
|--------|------|--------|
| `capacity_size` | INTEGER | **NEW** - Calculated from MW |
| `fuel_score` | INTEGER | **NEW** - Calculated from Fuel Type |
| `overall_score_calc` | DECIMAL(5,2) | Calculated overall score |
| `thermal_score_calc` | DECIMAL(5,2) | Calculated thermal score |
| `redev_score_calc` | DECIMAL(5,2) | Calculated redev score |
| `overall_rating` | VARCHAR(50) | Strong/Moderate/Weak |
| `confidence` | INTEGER | Confidence percentage |
| `expert_edited_by` | VARCHAR(100) | Last editor username |
| `expert_edited_at` | TIMESTAMP | Last edit timestamp |
| `ma_tier_id` | INTEGER | FK to ma_tiers table |

### New Views

| View | Purpose |
|------|---------|
| `v_project_expert_analysis` | Joins projects with expert analysis fields |

### New Functions

| Function | Purpose |
|----------|---------|
| `get_project_edit_history(project_id)` | Returns edit history for a project |

**See [CHANGELOG_BACKEND.md](./CHANGELOG_BACKEND.md) for complete SQL details.**

---

## Files Changed

### New Files Added (12 files)

#### SQL Migration Files (5)
| File Path | Description |
|-----------|-------------|
| `backend/scripts/supabase_full_setup.sql` | Complete initial schema setup |
| `backend/scripts/supabase_migration_fix.sql` | Add ma_tiers, rebuild projects table |
| `backend/scripts/supabase_add_expert_tables.sql` | Add expert_analysis, transmission tables |
| `backend/scripts/supabase_expert_analysis_option_b.sql` | History tracking, views, functions |
| `backend/migrations/002_add_score_columns.sql` | **NEW** Add capacity_size, fuel_score columns |

#### Backend Scripts (3)
| File Path | Description |
|-----------|-------------|
| `backend/scripts/checkTransactability.js` | Script for validating transactability data |
| `backend/scripts/importToSupabase.js` | Script for importing data to Supabase |
| `backend/scripts/runMigration.js` | Database migration runner script |

#### Backend Utilities (1)
| File Path | Description |
|-----------|-------------|
| `backend/utils/scoreCalculations.js` | Backend score calculation utilities (mirrors frontend) |

#### Frontend Utilities (2)
| File Path | Description |
|-----------|-------------|
| `src/utils/naValues.js` | N/A value handling utilities for missing Excel data |
| `src/utils/scoreCalculations.js` | Canonical score calculation functions |

### Modified Files (20 files)

#### Backend Files (5)
| File | Key Changes |
|------|-------------|
| `backend/controllers/expertAnalysisController.js` | Added `projectId` query param support for transmission fetch |
| `backend/models/expertAnalysis.js` | Major rewrite: Option B storage (projects table + history), delete-then-insert for transmission, max 5 POI limit |
| `backend/package.json` | Dependency updates |
| `backend/routes/dropdownOptions.js` | Minor updates |
| `backend/routes/expertAnalysisRoutes.js` | Added history routes |

#### Frontend Components (8)
| File | Key Changes |
|------|-------------|
| `src/components/AdminApprovalRedirect.jsx` | URL/routing fixes |
| `src/components/ApprovalRedirect.jsx` | URL/routing fixes |
| `src/components/ApprovalSuccess.jsx` | URL/routing fixes |
| `src/components/Header.jsx` | Minor UI updates |
| `src/components/Login.jsx` | Authentication flow updates |
| `src/components/Modals/ExpertAnalysisModal.jsx` | POI voltage: max 5 limit, delete persistence, projectId-based fetch |
| `src/components/Modals/ProjectDetailModal.jsx` | Field display updates |
| `src/components/Pipeline/PipelineTable.jsx` | Edit modal field mapping fixes |

#### Frontend Config/Utils (7)
| File | Key Changes |
|------|-------------|
| `src/constants/index.jsx` | New constants added |
| `src/contexts/AuthContext.jsx` | Auth context updates |
| `src/DashboardContent.jsx` | `fetchTransmissionInterconnection` now supports projectId |
| `src/utils/calculations.js` | Added 8 missing fields for edit modal (codename, acreage, fuel, etc.) |
| `src/utils/excelUtils.js` | Excel parsing updates |
| `src/utils/index.js` | Export updates |
| `src/utils/scoring.js` | Uses canonical `calculateAllScores`, handles null scores |

### Deleted Files (0)
No files were deleted.

---

## Major Implementation Changes

### 1. N/A Value Propagation System

**Problem**: When Excel data has missing values, the system was showing "0" instead of "N/A".

**Solution**: Created a new N/A value handling system:

- **New file**: `src/utils/naValues.js`
  - `isNA(value)` - Checks if value is N/A
  - `parseNullableNumber(value)` - Returns `null` for missing values (not 0)
  - `formatScoreDisplay(value)` - Shows "N/A" for null values
  - `hasAnyNA(...values)` - Checks if any value is N/A

- **New file**: `src/utils/scoreCalculations.js`
  - Canonical score calculations that propagate N/A correctly
  - If any required input is missing, the calculated score is `null` (displayed as "N/A")

### 2. Expert Analysis Storage (Option B)

**Problem**: Expert analysis data was stored in a separate `expert_analysis` table, causing sync issues.

**Solution**: Moved to "Option B" storage pattern:

- **Current values** stored directly in `projects` table columns
- **Edit history** stored in new `expert_analysis_history` table
- Server-side score recalculation ensures consistency
- Full audit trail of all changes

### 3. Edit Modal Data Population Fix

**Problem**: When editing a project, several fields appeared empty (codename, acreage, fuel, etc.).

**Solution**: Added 8 missing fields to the pipeline row object in `calculatePipelineData()`:

```javascript
// NEW fields added to pipeline row
codename: row[projectCodenameCol] || "",
acreage: row[siteAcreageCol] || "",
fuel: row[fuelCol] || "",
markets: row[marketsCol] || "",
process: row[allColumns.processCol] || "",
gasReference: row[gasReferenceCol] || "",
colocateRepower: row[coLocateRepowerCol] || "",
contact: row[contactCol] || "",
```

### 4. POI Voltage Management Improvements

**Problem**:
- No limit on number of POI voltage entries
- Remove button didn't persist deletions
- Data fetch/save used inconsistent identifiers

**Solution**:
- **Max 5 limit** enforced in frontend and backend
- **Delete-then-insert** pattern ensures removals are persisted
- **ProjectId-based fetch** for reliable data retrieval

### 5. Score Calculation Fixes

**Problem**: `generateExpertAnalysis()` crashed when scores were null.

**Solution**: Added null handling:

```javascript
// OLD - crashes on null
const overallScore = scores.overall_score.toFixed(1);

// NEW - handles null gracefully
const overallScore = scores.overall_score !== null
  ? scores.overall_score.toFixed(1)
  : "0.0";
```

---

## See Also

- [Backend Changes Detail](./CHANGELOG_BACKEND.md)
- [Frontend Changes Detail](./CHANGELOG_FRONTEND.md)
- [Score Calculations Detail](./CHANGELOG_SCORES.md)
