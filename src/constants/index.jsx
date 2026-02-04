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

export const SCORE_MAPPINGS = {
  cod: (year) => {
    const codYear = parseInt(year) || 0;
    if (codYear < 2000) return 3;
    if (codYear <= 2005) return 2;
    return 1;
  },
  
  capacityFactor: (cf) => {
    const cfNum = parseFloat(cf) || 0;
    if (cfNum < 0.1) return 3;
    if (cfNum <= 0.25) return 2;
    return 1;
  },
  
  market: (iso) => {
    const premiumMarkets = ["PJM", "NYISO", "ISO-NE"];
    const goodMarkets = ["MISO North", "SERC"];
    const neutralMarkets = ["SPP", "MISO South"];
    const poorMarkets = ["ERCOT", "WECC", "CAISO"];
    
    if (premiumMarkets.includes(iso)) return 3;
    if (goodMarkets.includes(iso)) return 2;
    if (neutralMarkets.includes(iso)) return 1;
    if (poorMarkets.includes(iso)) return 0;
    return 1;
  },
  
  transactability: (type) => {
    if (typeof type !== 'string') return 1;
    const lowerType = type.toLowerCase();
    if (lowerType.includes("bilateral") && lowerType.includes("developed")) return 3;
    if (lowerType.includes("bilateral") || lowerType.includes("process") && lowerType.includes("less than 10")) return 2;
    if (lowerType.includes("competitive") && lowerType.includes("more than 10")) return 1;
    return 2;
  },
  
  thermalOptimization: (value) => {
    if (value && value.toString().toLowerCase().includes("readily apparent")) return 2;
    return 1;
  },
  
  environmental: (value) => {
    if (!value) return 1;
    const score = parseInt(value) || 1;
    return Math.min(Math.max(score, 0), 3);
  },
  
  redevMarket: (value) => {
    if (!value) return 1;
    const score = parseInt(value) || 1;
    return Math.min(Math.max(score, 0), 3);
  },
  
  infra: (value) => {
    if (!value) return 1;
    const score = parseFloat(value) || 1;
    if (score >= 2.5) return 3;
    if (score >= 1.5) return 2;
    if (score >= 0.5) return 1;
    return 0;
  },
  
  ix: (value) => {
    if (!value) return 1;
    const score = parseFloat(value) || 1;
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