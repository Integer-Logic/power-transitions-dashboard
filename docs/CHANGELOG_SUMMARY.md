# Codebase Changes Summary

## Overview

This document outlines all changes made to the power-pipeline-dashboard codebase compared to the previous version (`power-pipeline-dashboard-main-old`).

---

## Files Changed

### New Files Added (6 files)

| File Path | Description |
|-----------|-------------|
| `backend/scripts/checkTransactability.js` | Script for validating transactability data |
| `backend/scripts/importToSupabase.js` | Script for importing data to Supabase |
| `backend/scripts/runMigration.js` | Database migration runner script |
| `backend/utils/scoreCalculations.js` | Backend score calculation utilities (mirrors frontend) |
| `src/utils/naValues.js` | **NEW** N/A value handling utilities for missing Excel data |
| `src/utils/scoreCalculations.js` | **NEW** Canonical score calculation functions |

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
