export const scoringWeights = {
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

export const sortableColumns = [
  { key: 'id', label: '#', type: 'number' },
  { key: 'asset', label: 'Asset', type: 'string' },
  { key: 'owner', label: 'Owner', type: 'string' },
  { key: 'projectType', label: 'Project Type', type: 'string' },
  { key: 'maTier', label: 'M&A Tier', type: 'string' },
  { key: 'redevTier', label: 'Redev Tier', type: 'string' },
  { key: 'status', label: 'Status', type: 'string' },
  { key: 'overall', label: 'Overall', type: 'number' },
  { key: 'thermal', label: 'Thermal', type: 'number' },
  { key: 'redev', label: 'Redev', type: 'number' },
  { key: 'mkt', label: 'Mkt', type: 'string' },
  { key: 'zone', label: 'Zone', type: 'string' },
  { key: 'mw', label: 'MW', type: 'number' },
  // NEW: POI Voltage column
  { key: 'poiVoltage', label: 'POI Voltage (KV)', type: 'number' },
  { key: 'tech', label: 'Tech', type: 'string' },
  { key: 'hr', label: 'HR', type: 'number' },
  { key: 'cf', label: 'CF', type: 'number' },
  { key: 'cod', label: 'COD', type: 'string' },
  { key: 'redevBaseCase', label: 'Redev Case', type: 'string' },
  { key: 'redevCapacity', label: 'Redev MW', type: 'number' },
  { key: 'redevTech', label: 'Redev Tech', type: 'string' },
  { key: 'redevStageGate', label: 'Stage Gate', type: 'string' },
  { key: 'transactabilityScore', label: 'Transact Score', type: 'number' }
];