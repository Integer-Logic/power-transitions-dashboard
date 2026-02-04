// src/constants/index.js
export const US_CITIES = [
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
  "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
  // ... (all 646 cities - truncated for brevity)
  "Lawrence, KS"
];

export const ISO_COLORS = ["#22D3EE", "#A78BFA", "#10B981", "#F59E0B", "#EF4444"];
export const TECH_COLORS = ["#22D3EE", "#FB7185", "#FACC15", "#A78BFA", "#10B981", "#F59E0B"];

export const TECHNOLOGY_OPTIONS = ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"];
export const ISO_OPTIONS = ["PJM", "NYISO", "ISONE", "MISO", "ERCOT", "CAISO", "SPP", "Other"];
export const PROCESS_OPTIONS = ["P", "B"];

/**
 * SCORE_MAPPINGS - Functions to map raw values to scores
 *
 * N/A Propagation Rules:
 * - Return null for missing/empty values to propagate N/A through calculations
 * - Exception: thermalOptimization defaults to 0 if missing (already implemented)
 * - 0 is a valid score, distinct from null (missing)
 */
export const SCORE_MAPPINGS = {
  // Capacity Size scoring: >50MW individual or >150MW portfolio = 1, else 0
  capacitySize: (mw, isPortfolio = false) => {
    if (mw === null || mw === undefined || mw === '') return null;
    const mwNum = parseFloat(mw);
    if (isNaN(mwNum)) return null;
    const threshold = isPortfolio ? 150 : 50;
    return mwNum > threshold ? 1 : 0;
  },

  // Fuel Type scoring: Gas/Oil = 1, Solar/Wind/Coal/BESS = 0
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

  cod: (year) => {
    // Check for missing/empty values - return null to propagate N/A
    if (year === null || year === undefined || year === '') return null;
    const yearStr = String(year).trim();
    if (yearStr === '' || yearStr === '#N/A' || yearStr === 'N/A' || yearStr === '#VALUE!') return null;
    const codYear = parseInt(year);
    if (isNaN(codYear)) return null;
    if (codYear < 2000) return 3;
    if (codYear <= 2005) return 2;
    return 1;
  },

  capacityFactor: (cf) => {
    // Check for missing/empty values - return null to propagate N/A
    if (cf === null || cf === undefined || cf === '') return null;
    const cfStr = String(cf).trim();
    if (cfStr === '' || cfStr === '#N/A' || cfStr === 'N/A' || cfStr === '#VALUE!') return null;
    const cfNum = parseFloat(cf);
    if (isNaN(cfNum)) return null;
    if (cfNum < 0.1) return 3;
    if (cfNum <= 0.25) return 2;
    return 1;
  },

  market: (iso) => {
    // Check for missing/empty values - return null to propagate N/A
    if (iso === null || iso === undefined || iso === '') return null;
    const isoStr = String(iso).trim();
    if (isoStr === '' || isoStr === '#N/A' || isoStr === 'N/A' || isoStr === '#VALUE!') return null;

    const premiumMarkets = ["PJM", "NYISO", "ISO-NE"];
    const goodMarkets = ["MISO North", "SERC"];
    const neutralMarkets = ["SPP", "MISO South"];
    const poorMarkets = ["ERCOT", "WECC", "CAISO"];

    if (premiumMarkets.includes(isoStr)) return 3;
    if (goodMarkets.includes(isoStr)) return 2;
    if (neutralMarkets.includes(isoStr)) return 1;
    if (poorMarkets.includes(isoStr)) return 0;
    return 1;
  },

  transactability: (type) => {
    // Check for missing/empty values - return null to propagate N/A
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
    const typeStr = String(type).trim();
    if (typeStr === '' || typeStr === '#N/A' || typeStr === 'N/A' || typeStr === '#VALUE!') return null;

    const lowerType = typeStr.toLowerCase();
    if (lowerType.includes("bilateral") && lowerType.includes("developed")) return 3;
    if (lowerType.includes("bilateral") || lowerType.includes("process")) return 2;
    if (lowerType.includes("competitive")) return 1;
    return 2;
  },

  // EXCEPTION: thermalOptimization defaults to 0 if missing (not null)
  thermalOptimization: (value) => {
    // Handle text descriptions
    if (value && typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower.includes("readily apparent")) return 2;
      if (lower.includes("no identifiable")) return 1;
    }
    // Handle numeric values
    if (value === 0) return 0; // Explicit 0 is valid
    if (value === null || value === undefined || value === '') return 0; // Default to 0 for missing
    const valueStr = String(value).trim();
    if (valueStr === '' || valueStr === '#N/A' || valueStr === 'N/A' || valueStr === '#VALUE!') return 0; // Default to 0
    const parsed = parseInt(value);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) return parsed;
    return 0;  // Default to 0 (yet to be saved) for invalid values
  },

  environmental: (value) => {
    // Check for missing/empty values - return null to propagate N/A
    if (value === null || value === undefined || value === '') return null;
    if (value === 0) return 0; // Explicit 0 is valid
    const valueStr = String(value).trim();
    if (valueStr === '' || valueStr === '#N/A' || valueStr === 'N/A' || valueStr === '#VALUE!') return null;
    const score = parseInt(value);
    if (isNaN(score)) return null;
    return Math.min(Math.max(score, 0), 3);
  },

  redevMarket: (value) => {
    // Check for missing/empty values - return null to propagate N/A
    if (value === null || value === undefined || value === '') return null;
    if (value === 0) return 0; // Explicit 0 is valid
    const valueStr = String(value).trim();
    if (valueStr === '' || valueStr === '#N/A' || valueStr === 'N/A' || valueStr === '#VALUE!') return null;
    const score = parseInt(value);
    if (isNaN(score)) return null;
    return Math.min(Math.max(score, 0), 3);
  },

  infra: (value) => {
    // Check for missing/empty values - return null to propagate N/A
    if (value === null || value === undefined || value === '') return null;
    if (value === 0) return 0; // Explicit 0 is valid
    const valueStr = String(value).trim();
    if (valueStr === '' || valueStr === '#N/A' || valueStr === 'N/A' || valueStr === '#VALUE!') return null;
    const score = parseFloat(value);
    if (isNaN(score)) return null;
    if (score >= 2.5) return 3;
    if (score >= 1.5) return 2;
    if (score >= 0.5) return 1;
    return 0;
  },

  ix: (value) => {
    // Check for missing/empty values - return null to propagate N/A
    if (value === null || value === undefined || value === '') return null;
    if (value === 0) return 0; // Explicit 0 is valid
    const valueStr = String(value).trim();
    if (valueStr === '' || valueStr === '#N/A' || valueStr === 'N/A' || valueStr === '#VALUE!') return null;
    const score = parseFloat(value);
    if (isNaN(score)) return null;
    if (score >= 2.5) return 3;
    if (score >= 1.5) return 2;
    if (score >= 0.5) return 1;
    return 0;
  }
};

export const SORTABLE_COLUMNS = [
  { key: 'asset', label: 'Asset', type: 'string' },
  { key: 'owner', label: 'Owner', type: 'string' },
  { key: 'overall', label: 'Overall', type: 'number' },
  { key: 'thermal', label: 'Thermal', type: 'number' },
  { key: 'redev', label: 'Redev', type: 'number' },
  { key: 'mkt', label: 'Mkt', type: 'string' },
  { key: 'zone', label: 'Zone', type: 'string' },
  { key: 'mw', label: 'MW', type: 'number' },
  { key: 'tech', label: 'Tech', type: 'string' },
  { key: 'hr', label: 'HR', type: 'number' },
  { key: 'cf', label: 'CF', type: 'string' },
  { key: 'cod', label: 'COD', type: 'number' },
];

export const INITIAL_SCORING_WEIGHTS = {
  thermal: {
    unit_cod: 0.20,
    capacity_factor: 0.00,
    markets: 0.30,
    transactability: 0.30,
    thermal_optimization: 0.05,
    environmental: 0.15
  },
  redevelopment: {
    market: 0.40,
    infra: 0.30,
    ix: 0.30
  }
};

export const INITIAL_NEW_SITE_DATA = {
  "Project Name": "",
  "Project Codename": "",
  "Plant Owner": "",
  "Location": "",
  "Legacy Nameplate Capacity (MW)": "",
  "Tech": "",
  "Heat Rate (Btu/kWh)": "",
  "2024 Capacity Factor": "",
  "Legacy COD": "",
  "Fuel": "",
  "Site Acreage": "",
  "ISO": "",
  "Zone/Submarket": "",
  "Markets": "",
  "Process (P) or Bilateral (B)": "",
  "Gas Reference": "",
  "Redevelopment Base Case": "",
  "Redev COD": "",
  "Thermal Optimization": "",
  "Co-Locate/Repower": "",
  "Contact": "",
  "Overall Project Score": "",
  "Thermal Operating Score": "",
  "Redevelopment Score": "",
  "Redevelopment (Load) Score": "",
  "I&C Score": "",
  "Environmental Score": "",
  "Market Score": "",
  "Infra": "",
  "IX": "",
  "Transactibility": ""
};