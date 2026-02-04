# Frontend Changes Detail

## src/utils/calculations.js

### Edit Modal Data Population Fix

**Location**: `calculatePipelineData()` function, return object

**Problem**: Fields like codename, acreage, fuel were only in `detailData`, not at top level of pipeline row. The edit modal mapped `row.codename || ""` which was always empty.

**OLD**:

```javascript
return {
  id: row.id || row.project_id || index + 1,
  displayId: index + 1,
  asset: row[projectNameCol] || "",
  // ... other fields ...
  projectType: projectType,
  status: status,
  detailData: detailData,
  transmissionData: transmissionData
};
```

**NEW**: Added 8 missing fields:

```javascript
return {
  id: row.id || row.project_id || index + 1,
  displayId: index + 1,
  asset: row[projectNameCol] || "",
  // ... existing fields ...
  projectType: projectType,
  status: status,
  // ADD MISSING FIELDS FOR EDIT MODAL
  codename: row[projectCodenameCol] || "",
  acreage: row[siteAcreageCol] || "",
  fuel: row[fuelCol] || "",
  markets: row[marketsCol] || "",
  process: row[allColumns.processCol] || "",
  gasReference: row[gasReferenceCol] || "",
  colocateRepower: row[coLocateRepowerCol] || "",
  contact: row[contactCol] || "",
  detailData: detailData,
  transmissionData: transmissionData
};
```

---

## src/utils/scoring.js

### Null Score Handling in generateExpertAnalysis

**Problem**: Calling `.toFixed()` on null crashed the function, causing Expert Analysis panel to show "No Projects Found".

**OLD**:

```javascript
export function generateExpertAnalysis(projectData) {
  const scores = calculateAllScores(projectData);
  const overallScore = scores.overall_score.toFixed(1);  // CRASHES if null
  const thermalScore = scores.thermal_score.toFixed(1);
  const redevelopmentScore = scores.redevelopment_score.toFixed(1);

  const overallRating = overallScore >= 4.5 ? "Strong" :
                       overallScore >= 3.0 ? "Moderate" : "Weak";
  // ...
}
```

**NEW**:

```javascript
export function generateExpertAnalysis(projectData) {
  const scores = calculateAllScores(projectData);

  // Handle null scores (N/A values) - use 0 as fallback for display
  const overallScore = scores.overall_score !== null
    ? scores.overall_score.toFixed(1)
    : "0.0";
  const thermalScore = scores.thermal_score !== null
    ? scores.thermal_score.toFixed(1)
    : "0.0";
  const redevelopmentScore = scores.redevelopment_score !== null
    ? scores.redevelopment_score.toFixed(1)
    : "0.0";

  // Use numeric value for comparison
  const overallNumeric = parseFloat(overallScore);
  const overallRating = overallNumeric >= 4.5 ? "Strong" :
                       overallNumeric >= 3.0 ? "Moderate" : "Weak";
  // ...
}
```

---

## src/components/Modals/ExpertAnalysisModal.jsx

### Max 5 POI Voltage Limit

**OLD**:

```javascript
const addNewTransmissionEntry = useCallback((e) => {
  if (!isEditing) return;
  e.preventDefault();
  // No limit check
  setLocalTransmissionData(prev => [...prev, { /* new entry */ }]);
}, [isEditing, selectedExpertProject]);
```

**NEW**:

```javascript
const addNewTransmissionEntry = useCallback((e) => {
  if (!isEditing) return;
  e.preventDefault();

  // Enforce max 5 entries
  if (localTransmissionData.length >= 5) {
    alert('Maximum of 5 POI voltage entries allowed.');
    return;
  }

  setLocalTransmissionData(prev => [...prev, { /* new entry */ }]);
}, [isEditing, selectedExpertProject, localTransmissionData.length]);
```

### Add Button UI Update

**OLD**:

```jsx
<button onClick={onAdd} style={{...}}>
  + Add POI Voltage
</button>
```

**NEW**: Shows count and disables at max:

```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
  <button
    onClick={onAdd}
    disabled={data.length >= 5}
    style={{
      background: data.length >= 5 ? 'rgba(100, 100, 100, 0.1)' : 'rgba(34, 197, 94, 0.1)',
      cursor: data.length >= 5 ? 'not-allowed' : 'pointer',
      // ...
    }}
  >
    + Add POI Voltage
  </button>
  <span style={{ color: '#a0aec0', fontSize: '12px' }}>
    {data.length}/5 entries
  </span>
</div>
```

### Transmission Data Fetch - Use ProjectId

**OLD**: Used project name (unreliable):

```javascript
const projectName = selectedExpertProject?.expertAnalysis?.projectName || ...;
const freshTransmission = await fetchTransmissionInterconnection(projectName);
```

**NEW**: Uses projectId (reliable):

```javascript
if (fetchTransmissionInterconnection && projectId) {
  const freshTransmission = await fetchTransmissionInterconnection(projectId, true);
  // ...
}
```

### Always Save Transmission Data

**OLD**: Only saved if there were entries:

```javascript
if (localTransmissionData.length > 0) {
  if (saveTransmissionInterconnection) {
    saveTransmissionInterconnection(projectId, localTransmissionData)
      .then(() => console.log('Transmission data saved'));
  }
}
```

**NEW**: Always saves (empty array deletes all entries):

```javascript
// Always save, even if empty to handle deletions
if (saveTransmissionInterconnection) {
  saveTransmissionInterconnection(projectId, localTransmissionData)
    .then(() => console.log(`Transmission data saved (${localTransmissionData.length} entries)`));
}
```

---

## src/DashboardContent.jsx

### Transmission Fetch - ProjectId Support

**OLD**:

```javascript
const fetchTransmissionInterconnection = async (projectName) => {
  const response = await fetch(
    `${API_URL}/api/transmission-interconnection?project=${encodeURIComponent(projectName)}`,
    { headers: {...} }
  );
  // ...
};
```

**NEW**: Supports both project name and project ID:

```javascript
const fetchTransmissionInterconnection = async (projectNameOrId, useProjectId = false) => {
  // Build the URL with either project name or project ID
  const queryParam = useProjectId
    ? `projectId=${encodeURIComponent(projectNameOrId)}`
    : `project=${encodeURIComponent(projectNameOrId)}`;

  const response = await fetch(
    `${API_URL}/api/transmission-interconnection?${queryParam}`,
    { headers: {...} }
  );
  // ...
};
```

---

## src/components/Pipeline/PipelineTable.jsx

### Edit Modal Field Mapping

The edit button click handler maps short field names to display names. These mappings now work because the fields exist at the top level of the row object:

```javascript
const originalData = {
  ...row,
  "Project Codename": row.codename || "",      // Now works!
  "Site Acreage": row.acreage || "",           // Now works!
  "Fuel": row.fuel || "",                       // Now works!
  "Markets": row.markets || "",                 // Now works!
  "Process (P) or Bilateral (B)": row.process || "",  // Now works!
  "Gas Reference": row.gasReference || "",      // Now works!
  "Co-Locate/Repower": row.colocateRepower || "",     // Now works!
  "Contact": row.contact || "",                 // Now works!
  // ... other fields
};
```

---

## New Frontend Files

### src/utils/naValues.js

N/A value handling utilities:

```javascript
// Check if a value is N/A (null, undefined, or empty)
export function isNA(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || trimmed === '#N/A' || trimmed === 'N/A';
  }
  return false;
}

// Parse value to number, returning null for missing
export function parseNullableNumber(value) {
  if (value === 0) return 0;  // 0 is valid, not N/A
  if (isNA(value)) return null;
  // ...
}

// Format score for display
export function formatScoreDisplay(value, decimals = 2) {
  if (value === null || value === undefined) return 'N/A';
  return parseFloat(value).toFixed(decimals);
}
```

### src/utils/scoreCalculations.js

Canonical score calculation functions (single source of truth):

```javascript
// Thermal Operating Score
// Formula: (COD × 0.20) + (Markets × 0.30) + (Transactability × 0.30)
//        + (ThermalOpt × 0.05) + (Environmental × 0.15)
export function calculateThermalScore(data) {
  // Returns null if any required input is missing (N/A propagation)
}

// Redevelopment Score
// Formula: IF(any of Market/Infra/IX = 0, 0,
//            (Market × 0.40 + Infra × 0.30 + IX × 0.30) × multiplier)
export function calculateRedevelopmentScore(data) {
  // Returns null if any required input is missing (N/A propagation)
}

// Overall Project Score = Thermal + Redevelopment
export function calculateOverallScore(thermal, redev) {
  // Returns null if either input is null
}
```
