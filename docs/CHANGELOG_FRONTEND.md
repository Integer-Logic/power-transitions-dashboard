# Frontend Changes Detail

## Latest Changes (2026-02-04)

### src/DashboardContent.jsx - Score Persistence Fix

**Problem**: Calculated scores were displayed in AddSiteModal preview but never saved to the database.

#### New Import

```javascript
import { SCORE_MAPPINGS } from './constants/index.jsx';
```

#### poi_voltage_kv Added to State

**Initial State** (line 155):
```javascript
const [newSiteData, setNewSiteData] = useState({
  // ... existing fields ...
  transactability: "",
  poi_voltage_kv: ""  // NEW
});
```

**Reset State in closeAddSiteModal**:
```javascript
setNewSiteData({
  // ... existing fields ...
  transactability: "",
  poi_voltage_kv: ""  // NEW
});
```

**Numeric Fields Array**:
```javascript
const numericFields = [
  'legacy_nameplate_capacity_mw', 'redev_capacity_mw',
  'heat_rate_btu_kwh', 'redev_heatrate_btu_kwh',
  'capacity_factor_2024', 'overall_project_score',
  'thermal_operating_score', 'redevelopment_score',
  'poi_voltage_kv'  // NEW
];
```

#### Score Calculation in handleAddSiteSubmit

**NEW**: Calculate and add scores before sending to API:

```javascript
// Calculate component scores from raw values
const legacyCod = cleanSiteData.legacy_cod;
const capacityMW = cleanSiteData.legacy_nameplate_capacity_mw;
const fuel = cleanSiteData.fuel;
const capacityFactor = cleanSiteData.capacity_factor_2024;
const iso = cleanSiteData.iso;
const transactability = cleanSiteData.transactability;

// Calculate and add scores to data being sent
cleanSiteData.plant_cod = SCORE_MAPPINGS.cod(legacyCod);
cleanSiteData.capacity_size = SCORE_MAPPINGS.capacitySize(capacityMW, false);
cleanSiteData.fuel_score = SCORE_MAPPINGS.fuelType(fuel);

// Handle capacity factor conversion (if >1, treat as percentage)
let cfValue = parseFloat(capacityFactor);
if (!isNaN(cfValue) && cfValue > 1) cfValue = cfValue / 100;
cleanSiteData.capacity_factor = SCORE_MAPPINGS.capacityFactor(cfValue);

cleanSiteData.markets = SCORE_MAPPINGS.market(iso);
cleanSiteData.transactability_scores = SCORE_MAPPINGS.transactability(transactability);

console.log("📊 Calculated scores:", {
  plant_cod: cleanSiteData.plant_cod,
  capacity_size: cleanSiteData.capacity_size,
  fuel_score: cleanSiteData.fuel_score,
  capacity_factor: cleanSiteData.capacity_factor,
  markets: cleanSiteData.markets,
  transactability_scores: cleanSiteData.transactability_scores
});
```

#### Data Flow After Fix

```
User fills form → Raw values stored in newSiteData
                           ↓
handleAddSiteSubmit() builds cleanSiteData from raw values
                           ↓
SCORE_MAPPINGS calculates derived scores:
  - legacy_cod "1995" → plant_cod = 3
  - fuel "Gas" → fuel_score = 1
  - iso "PJM" → markets = 3
  - etc.
                           ↓
Both raw values AND calculated scores sent to backend
                           ↓
Database stores everything correctly
```

---

### src/components/Modals/AddSiteModal.jsx - Auto-Scoring Preview

Added real-time score calculation and preview to the Add New Project modal.

#### New Import

```javascript
import { SCORE_MAPPINGS } from '../../constants/index.jsx';
```

#### New State Variables

```javascript
// Portfolio checkbox state
const [isPortfolio, setIsPortfolio] = useState(false);

// Calculated scores state
const [calculatedScores, setCalculatedScores] = useState({});
```

#### ScoreItem Helper Component

```javascript
const ScoreItem = ({ label, value, max }) => {
  const displayValue = value === null || value === undefined ? 'N/A' : value;
  const color = value === null ? '#6b7280' : value >= max * 0.66 ? '#22c55e' : value >= max * 0.33 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 12px',
      backgroundColor: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '6px'
    }}>
      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{label}</span>
      <span style={{ color, fontWeight: '600', fontSize: '14px' }}>
        {displayValue}{value !== null ? `/${max}` : ''}
      </span>
    </div>
  );
};
```

#### Real-Time Score Calculation useEffect

```javascript
useEffect(() => {
  const capacity = newSiteData["legacy_nameplate_capacity_mw"] || newSiteData["Legacy Nameplate Capacity (MW)"];
  const fuel = newSiteData["fuel"] || newSiteData["Fuel"];
  const cod = newSiteData["legacy_cod"] || newSiteData["Legacy COD"];
  const cf = newSiteData["capacity_factor_2024"] || newSiteData["2024 Capacity Factor"];
  const iso = newSiteData["iso"] || newSiteData["ISO"];
  const transact = newSiteData["transactability"] || newSiteData["Transactability"];

  // Calculate component scores
  const capacitySizeScore = SCORE_MAPPINGS.capacitySize(capacity, isPortfolio);
  const fuelScore = SCORE_MAPPINGS.fuelType(fuel);
  const codScore = SCORE_MAPPINGS.cod(cod);

  // Convert capacity factor: if > 1, assume percentage and divide by 100
  let cfValue = parseFloat(cf);
  if (!isNaN(cfValue) && cfValue > 1) cfValue = cfValue / 100;
  const cfScore = SCORE_MAPPINGS.capacityFactor(cfValue);

  const marketScore = SCORE_MAPPINGS.market(iso);
  const transactScore = SCORE_MAPPINGS.transactability(transact);

  setCalculatedScores({
    capacitySize: capacitySizeScore,
    fuel: fuelScore,
    cod: codScore,
    capacityFactor: cfScore,
    market: marketScore,
    transactability: transactScore
  });
}, [newSiteData, isPortfolio]);
```

#### Portfolio Checkbox (in Technical Details section)

```jsx
<div className="form-group">
  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <input
      type="checkbox"
      checked={isPortfolio}
      onChange={(e) => setIsPortfolio(e.target.checked)}
      style={{ width: '18px', height: '18px' }}
    />
    Portfolio Project
  </label>
  <small className="form-hint">
    Check if this is a portfolio (&gt;150MW threshold), uncheck for individual asset (&gt;50MW threshold)
  </small>
</div>
```

#### Calculated Scores Preview Section (before modal footer)

```jsx
{/* Calculated Scores Preview */}
<div className="form-section" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', padding: '16px' }}>
  <h3 className="form-section-title" style={{ color: '#60a5fa' }}>Calculated Scores Preview</h3>
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
    <ScoreItem label="Capacity Size" value={calculatedScores.capacitySize} max={1} />
    <ScoreItem label="Fuel" value={calculatedScores.fuel} max={1} />
    <ScoreItem label="Unit COD" value={calculatedScores.cod} max={3} />
    <ScoreItem label="Capacity Factor" value={calculatedScores.capacityFactor} max={3} />
    <ScoreItem label="Markets" value={calculatedScores.market} max={3} />
    <ScoreItem label="Transactability" value={calculatedScores.transactability} max={3} />
  </div>
</div>
```

---

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
