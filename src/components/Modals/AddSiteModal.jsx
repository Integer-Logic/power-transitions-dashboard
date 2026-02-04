import React, { useState, useEffect, useRef } from 'react';
import { SCORE_MAPPINGS } from '../../constants/index.jsx';

const AddSiteModal = ({
  showAddSiteModal,
  closeAddSiteModal,
  handleAddSiteSubmit,
  newSiteData,
  handleInputChange,
  allData,
  dropdownOptions, // ALL FROM DATABASE TABLES
  US_CITIES,
  allVoltages,
  calculateStatusFromCODs
}) => {
  // ALL DROPDOWN OPTIONS FROM DATABASE TABLES
  const {
    // From lookup tables:
    projectTypeOptions = [], // FROM project_types
    redevFuelOptions = [], // FROM redev_fuels
    redevelopmentBaseOptions = [], // FROM redev_base_cases
    redevLeadOptions = [], // FROM redev_lead_options
    redevSupportOptions = [], // FROM redev_support_options
    coLocateRepowerOptions = [], // FROM co_locate_repower_options
    maTierOptions = [], // NEW: M&A Tier options from lookup table
    
    // From distinct values in main tables:
    plantOwners = [], // DISTINCT plant_owner FROM projects
    technologyOptions = [], // DISTINCT technology FROM technical_details
    fuelTypes = [], // DISTINCT fuel_type FROM technical_details
    isoOptions = [], // DISTINCT iso_rto FROM market_details
    
    // Fixed options (no database table needed):
    processOptions = ["P", "B"],
    redevTechOptions = ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"],
    redevTierOptions = ["0", "1", "2", "3"],
    redevLandControlOptions = ["Y", "N"],
    redevStageGateOptions = ["0", "1", "2", "3", "P"]
  } = dropdownOptions || {};
  
  // State for form fields
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  
  // Multi-select states
  const [selectedRedevelopmentBases, setSelectedRedevelopmentBases] = useState([]);
  const [newRedevelopmentBase, setNewRedevelopmentBase] = useState("");
  const [selectedProjectTypes, setSelectedProjectTypes] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedRedevFuels, setSelectedRedevFuels] = useState([]);
  const [newRedevFuel, setNewRedevFuel] = useState("");
  
  // Add new options states
  const [showNewOwnerInput, setShowNewOwnerInput] = useState(false);
  const [newPlantOwner, setNewPlantOwner] = useState("");
  const [showNewCoLocateRepowerInput, setShowNewCoLocateRepowerInput] = useState(false);
  const [newCoLocateRepower, setNewCoLocateRepower] = useState("");

  // Portfolio checkbox state
  const [isPortfolio, setIsPortfolio] = useState(false);

  // Calculated scores state
  const [calculatedScores, setCalculatedScores] = useState({});

  // ScoreItem helper component for displaying individual scores
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

  // Transactability options
  const transactabilityOptions = [
    { value: "1", label: "1 - Bilateral w/ developed relationship" },
    { value: "2", label: "2 - Bilateral w/new relationship or Process w/less than 10 bidders" },
    { value: "3", label: "3 - Highly Competitive Process - More than 10 Bidders" }
  ];

  // Status options
  const statusOptions = ["Operating", "Retired", "Future", "N/A", "Unknown"];

  // Map frontend field names to database column names
  const fieldNameMapping = {
    "Project Name": "project_name",
    "Plant Owner": "plant_owner",
    "Project Codename": "project_codename",
    "Location": "location",
    "Site Acreage": "site_acreage",
    "Status": "status",
    "Legacy Nameplate Capacity (MW)": "legacy_nameplate_capacity_mw",
    "Tech": "tech",
    "Heat Rate (Btu/kWh)": "heat_rate_btu_kwh",
    "2024 Capacity Factor": "capacity_factor_2024",
    "Legacy COD": "legacy_cod",
    "Fuel": "fuel",
    "ISO": "iso",
    "Zone/Submarket": "zone_submarket",
    "Markets": "markets",
    "Process (P) or Bilateral (B)": "process_type",
    "Gas Reference": "gas_reference",
    "Transactability": "transactability",
    "Redev Tier": "redev_tier",
    "Redevelopment Base Case": "redevelopment_base_case",
    "Redev Capacity (MW)": "redev_capacity_mw",
    "Redev Tech": "redev_tech",
    "Redev Fuel": "redev_fuel",
    "Redev Heatrate (Btu/kWh)": "redev_heatrate_btu_kwh",
    "Redev COD": "redev_cod",
    "Redev Land Control": "redev_land_control",
    "Redev Stage Gate": "redev_stage_gate",
    "Redev Lead": "redev_lead",
    "Redev Support": "redev_support",
    "Co-Locate/Repower": "co_locate_repower",
    "Contact": "contact",
    // These already match or are handled specially:
    "Project Type": "project_type",
    // NEW: M&A Tier field mapping
    "M&A Tier": "ma_tier",
    // NEW: POI Voltage field mapping
    "POI Voltage (KV)": "poi_voltage_kv"
  };

  // Initialize form
  useEffect(() => {
    if (showAddSiteModal) {
      // Set location from existing data
      setLocationInput(newSiteData["location"] || newSiteData["Location"] || "");
      
      // Parse project types - check both possible field names
      const projectTypeValue = newSiteData["project_type"] || newSiteData["Project Type"] || "";
      if (projectTypeValue) {
        const types = projectTypeValue.split(',').map(t => t.trim()).filter(t => t);
        setSelectedProjectTypes(types);
      }
      
      // Parse redev fuels
      const redevFuelValue = newSiteData["redev_fuel"] || newSiteData["Redev Fuel"] || "";
      if (redevFuelValue) {
        const fuels = redevFuelValue.split(',').map(f => f.trim()).filter(f => f);
        setSelectedRedevFuels(fuels);
      }
      
      // Parse redevelopment bases
      const redevBaseValue = newSiteData["redevelopment_base_case"] || newSiteData["Redevelopment Base Case"] || "";
      if (redevBaseValue) {
        const bases = redevBaseValue.split(/[\n,]/).map(b => b.trim()).filter(b => b);
        setSelectedRedevelopmentBases(bases);
      }
      
      // Set status
      const statusValue = newSiteData["status"] || newSiteData["Status"] || "";
      setSelectedStatus(statusValue);
    }
  }, [showAddSiteModal, newSiteData]);

  // Calculate scores in real-time when form data changes
  useEffect(() => {
    const capacity = newSiteData["legacy_nameplate_capacity_mw"] || newSiteData["Legacy Nameplate Capacity (MW)"];
    const fuel = newSiteData["fuel"] || newSiteData["Fuel"];
    const cod = newSiteData["legacy_cod"] || newSiteData["Legacy COD"];
    const cf = newSiteData["capacity_factor_2024"] || newSiteData["2024 Capacity Factor"];
    const iso = newSiteData["iso"] || newSiteData["ISO"];
    const transact = newSiteData["transactability"] || newSiteData["Transactability"];

    // Calculate component scores
    const capacitySizeScore = SCORE_MAPPINGS.capacitySize ? SCORE_MAPPINGS.capacitySize(capacity, isPortfolio) : null;
    const fuelScore = SCORE_MAPPINGS.fuelType ? SCORE_MAPPINGS.fuelType(fuel) : null;
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

  // Handle field changes
  const handleFieldChange = (field, value) => {
    console.log(`Changing ${field} to:`, value);
    
    // Map the field name to database column name
    const dbFieldName = fieldNameMapping[field] || field;
    
    // Call the parent handler with the correct field name
    handleInputChange(dbFieldName, value);
  };

  // Location handlers
  const handleLocationInputChange = (value) => {
    setLocationInput(value);
    handleFieldChange("Location", value);
    
    if (value.length >= 2) {
      const filtered = US_CITIES.filter(city =>
        city.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredLocations(filtered.slice(0, 10));
      setShowLocationSuggestions(true);
    } else {
      setFilteredLocations([]);
      setShowLocationSuggestions(false);
    }
  };

  const selectCity = (city) => {
    setLocationInput(city);
    handleFieldChange("Location", city);
    setShowLocationSuggestions(false);
  };

  // Legacy COD handler
  const handleLegacyCODChange = (value) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    handleFieldChange("Legacy COD", digitsOnly);
    
    // Auto-update status
    if (digitsOnly.length === 4) {
      const redevCOD = newSiteData["redev_cod"] || newSiteData["Redev COD"] || "";
      const calculatedStatus = calculateStatusFromCODs(digitsOnly, redevCOD);
      if (calculatedStatus) {
        setSelectedStatus(calculatedStatus);
        handleFieldChange("Status", calculatedStatus);
      }
    }
  };

  // Redev COD handler
  const handleRedevCODChange = (value) => {
    handleFieldChange("Redev COD", value);
    
    // Auto-update status
    if (value && value.toString().trim() !== "") {
      const legacyCOD = newSiteData["legacy_cod"] || newSiteData["Legacy COD"] || "";
      const calculatedStatus = calculateStatusFromCODs(legacyCOD, value);
      if (calculatedStatus) {
        setSelectedStatus(calculatedStatus);
        handleFieldChange("Status", calculatedStatus);
      }
    }
  };

  // M&A Tier handler
  const handleMaTierChange = (value) => {
    handleFieldChange("M&A Tier", value);
  };

  // POI Voltage handler
  const handlePoiVoltageChange = (value) => {
    handleFieldChange("POI Voltage (KV)", value);
  };

  // Plant Owner handler
  const handlePlantOwnerChange = (value) => {
    if (value === "add_new") {
      setShowNewOwnerInput(true);
    } else {
      setShowNewOwnerInput(false);
      handleFieldChange("Plant Owner", value);
    }
  };

  const addNewPlantOwner = () => {
    if (newPlantOwner.trim()) {
      handleFieldChange("Plant Owner", newPlantOwner.trim());
      setShowNewOwnerInput(false);
      setNewPlantOwner("");
    }
  };

  // Co-locate/repower handler
  const handleCoLocateRepowerChange = (value) => {
    if (value === "add_new") {
      setShowNewCoLocateRepowerInput(true);
    } else {
      setShowNewCoLocateRepowerInput(false);
      handleFieldChange("Co-Locate/Repower", value);
    }
  };

  // Transactability handler
  const handleTransactabilityChange = (value) => {
    handleFieldChange("Transactability", value);
  };

  // Project Type handler
  const handleProjectTypeChange = (typeValue) => {
    let updatedTypes;
    if (selectedProjectTypes.includes(typeValue)) {
      updatedTypes = selectedProjectTypes.filter(t => t !== typeValue);
    } else {
      updatedTypes = [...selectedProjectTypes, typeValue];
    }
    
    setSelectedProjectTypes(updatedTypes);
    handleFieldChange("Project Type", updatedTypes.join(", "));
  };

  // Status handler
  const handleStatusChange = (value) => {
    setSelectedStatus(value);
    handleFieldChange("Status", value);
  };

  // Redevelopment Base Case handler
  const handleRedevelopmentBaseChange = (base) => {
    if (selectedRedevelopmentBases.includes(base)) {
      const updated = selectedRedevelopmentBases.filter(b => b !== base);
      setSelectedRedevelopmentBases(updated);
      handleFieldChange("Redevelopment Base Case", updated.join("\n"));
    } else {
      const updated = [...selectedRedevelopmentBases, base];
      setSelectedRedevelopmentBases(updated);
      handleFieldChange("Redevelopment Base Case", updated.join("\n"));
    }
  };

  const addNewRedevelopmentBase = () => {
    if (newRedevelopmentBase.trim() && !selectedRedevelopmentBases.includes(newRedevelopmentBase.trim())) {
      const updated = [...selectedRedevelopmentBases, newRedevelopmentBase.trim()];
      setSelectedRedevelopmentBases(updated);
      handleFieldChange("Redevelopment Base Case", updated.join("\n"));
      setNewRedevelopmentBase("");
    }
  };

  // Redev Fuel handler
  const handleRedevFuelChange = (fuel) => {
    let updatedFuels;
    if (selectedRedevFuels.includes(fuel)) {
      updatedFuels = selectedRedevFuels.filter(f => f !== fuel);
    } else {
      updatedFuels = [...selectedRedevFuels, fuel];
    }
    
    setSelectedRedevFuels(updatedFuels);
    handleFieldChange("Redev Fuel", updatedFuels.join(", "));
  };

  const addNewRedevFuel = () => {
    if (newRedevFuel.trim() && !selectedRedevFuels.includes(newRedevFuel.trim())) {
      const updated = [...selectedRedevFuels, newRedevFuel.trim()];
      setSelectedRedevFuels(updated);
      handleFieldChange("Redev Fuel", updated.join(", "));
      setNewRedevFuel("");
    }
  };

  // Form validation and submission
  const handleFormSubmit = (e) => {
    e.preventDefault();
    
    // Required fields - use database field names
    if (!newSiteData["project_name"] || newSiteData["project_name"].trim() === "") {
      alert("Please enter a Project Name");
      return;
    }
    
    if (!newSiteData["plant_owner"] || newSiteData["plant_owner"].trim() === "") {
      alert("Please select or enter a Plant Owner");
      return;
    }
    
    // Log for debugging
    console.log("Submitting new project:", {
      project_name: newSiteData["project_name"],
      plant_owner: newSiteData["plant_owner"],
      project_type: newSiteData["project_type"],
      status: newSiteData["status"],
      ma_tier: newSiteData["ma_tier"], // NEW: M&A Tier
      poi_voltage_kv: newSiteData["poi_voltage_kv"], // NEW: POI Voltage
      redev_fuel: newSiteData["redev_fuel"],
      redevelopment_base_case: newSiteData["redevelopment_base_case"],
      allData: newSiteData
    });
    
    // Log each field individually for debugging
    Object.entries(newSiteData).forEach(([key, value]) => {
      console.log(`${key}:`, value, `(type: ${typeof value})`);
    });
    
    handleAddSiteSubmit(e);
  };

  if (!showAddSiteModal) return null;

  return (
    <div className="modal-overlay" onClick={closeAddSiteModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "1100px" }}>
        <div className="modal-header">
          <h2 className="modal-title">Add New Project</h2>
          <button className="modal-close" onClick={closeAddSiteModal}>×</button>
        </div>
        
        <form onSubmit={handleFormSubmit}>
          <div className="modal-body">
            {/* Basic Information Section */}
            <div className="form-section">
              <h3 className="form-section-title">Basic Information</h3>
              
              {/* Project Type - Multi-select */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Project Type</label>
                <div className="checkbox-group" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {projectTypeOptions.map(option => {
                      const optionName = option.type_name || option.name || option;
                      return (
                        <label key={optionName} className="checkbox-label"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '10px 16px',
                            borderRadius: '6px',
                            backgroundColor: selectedProjectTypes.includes(optionName) ? '#334155' : '#1e293b',
                            border: '1px solid',
                            borderColor: selectedProjectTypes.includes(optionName) ? '#3b82f6' : '#374151',
                            transition: 'all 0.2s',
                            userSelect: 'none',
                            minWidth: '80px',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2d3748'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedProjectTypes.includes(optionName) ? '#334155' : '#1e293b'}
                        >
                          <input
                            type="checkbox"
                            className="checkbox-input"
                            checked={selectedProjectTypes.includes(optionName)}
                            onChange={() => handleProjectTypeChange(optionName)}
                            style={{ marginRight: '8px', width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <span style={{ color: '#e5e7eb', fontSize: '14px', fontWeight: selectedProjectTypes.includes(optionName) ? '500' : '400' }}>
                            {optionName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <small className="form-hint" style={{ display: 'block', marginTop: '8px', color: '#94a3b8' }}>
                    Select all applicable project types
                  </small>
                </div>
              </div>
              
              {/* Basic Info Grid */}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label required">Project Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["project_name"] || newSiteData["Project Name"] || ""}
                    onChange={(e) => handleFieldChange("Project Name", e.target.value)}
                    placeholder="Enter project name"
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Project Codename</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["project_codename"] || newSiteData["Project Codename"] || ""}
                    onChange={(e) => handleFieldChange("Project Codename", e.target.value)}
                    placeholder="Enter codename"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label required">Plant Owner</label>
                  <div className="select-with-add" style={{ width: '100%' }}>
                    <select
                      className="form-select"
                      value={newSiteData["plant_owner"] || newSiteData["Plant Owner"] || ""}
                      onChange={(e) => handlePlantOwnerChange(e.target.value)}
                      required
                      disabled={showNewOwnerInput}
                      style={{ width: '100%' }}
                    >
                      <option value="">Select Plant Owner</option>
                      {plantOwners.map(owner => (
                        <option key={owner} value={owner}>{owner}</option>
                      ))}
                      <option value="add_new">+ Add New Owner</option>
                    </select>
                    
                    {showNewOwnerInput && (
                      <div className="add-new-input" style={{ width: '100%', marginTop: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={newPlantOwner}
                          onChange={(e) => setNewPlantOwner(e.target.value)}
                          placeholder="Enter new plant owner"
                          autoFocus
                          style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button type="button" className="btn-add-small" onClick={addNewPlantOwner}>
                            Add
                          </button>
                          <button type="button" className="btn-cancel-small" onClick={() => setShowNewOwnerInput(false)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <div className="autocomplete-wrapper" style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={locationInput}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                      placeholder="Start typing city, state (e.g., Clarksville, TN)"
                      style={{ width: '100%' }}
                    />
                    {showLocationSuggestions && filteredLocations.length > 0 && (
                      <div className="autocomplete-dropdown">
                        {filteredLocations.map((city, index) => (
                          <div key={`${city}-${index}`} className="autocomplete-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectCity(city);
                            }}>
                            {city}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <small className="form-hint">Start typing to see city suggestions (min 2 characters)</small>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Site Acreage</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["site_acreage"] || newSiteData["Site Acreage"] || ""}
                    onChange={(e) => handleFieldChange("Site Acreage", e.target.value)}
                    placeholder="Enter acreage"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* M&A Tier Field */}
                <div className="form-group">
                  <label className="form-label">M&A Tier</label>
                  <select
                    className="form-select"
                    value={newSiteData["ma_tier"] || newSiteData["M&A Tier"] || ""}
                    onChange={(e) => handleMaTierChange(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select M&A Tier</option>
                    {maTierOptions && maTierOptions.length > 0 ? (
                      maTierOptions.map(tier => {
                        // Handle different possible data structures
                        const tierValue = tier.value || tier.tier_name || tier.name || tier;
                        return (
                          <option key={tierValue} value={tierValue}>
                            {tierValue}
                          </option>
                        );
                      })
                    ) : (
                      <>
                        <option value="Owned">Owned</option>
                        <option value="Exclusivity">Exclusivity</option>
                        <option value="second round">Second round</option>
                        <option value="first round">First round</option>
                        <option value="pipeline">Pipeline</option>
                        <option value="passed">Passed</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={selectedStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Status</option>
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Technical Details Section */}
            <div className="form-section">
              <h3 className="form-section-title">Technical Details</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Capacity (MW)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newSiteData["legacy_nameplate_capacity_mw"] || newSiteData["Legacy Nameplate Capacity (MW)"] || ""}
                    onChange={(e) => handleFieldChange("Legacy Nameplate Capacity (MW)", e.target.value)}
                    placeholder="Enter capacity in MW"
                    step="any"
                    min="0"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Portfolio Checkbox */}
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

                {/* POI Voltage Field */}
                <div className="form-group">
                  <label className="form-label">POI Voltage (KV)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newSiteData["poi_voltage_kv"] || newSiteData["POI Voltage (KV)"] || ""}
                    onChange={(e) => handlePoiVoltageChange(e.target.value)}
                    placeholder="Enter POI voltage in KV"
                    step="any"
                    min="0"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Technology</label>
                  <select
                    className="form-select"
                    value={newSiteData["tech"] || newSiteData["Tech"] || ""}
                    onChange={(e) => handleFieldChange("Tech", e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Technology</option>
                    {technologyOptions.map(tech => (
                      <option key={tech} value={tech}>{tech}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Heat Rate (Btu/kWh)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newSiteData["heat_rate_btu_kwh"] || newSiteData["Heat Rate (Btu/kWh)"] || ""}
                    onChange={(e) => handleFieldChange("Heat Rate (Btu/kWh)", e.target.value)}
                    placeholder="Enter heat rate"
                    step="any"
                    min="0"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Capacity Factor (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newSiteData["capacity_factor_2024"] || newSiteData["2024 Capacity Factor"] || ""}
                    onChange={(e) => handleFieldChange("2024 Capacity Factor", e.target.value)}
                    placeholder="Enter capacity factor"
                    step="any"
                    min="0"
                    max="100"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Legacy COD</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["legacy_cod"] || newSiteData["Legacy COD"] || ""}
                    onChange={(e) => handleLegacyCODChange(e.target.value)}
                    placeholder="YYYY"
                    maxLength="4"
                    style={{ width: '100%' }}
                  />
                  <small className="form-hint">Used for status calculation if no Redev COD</small>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Fuel</label>
                  <select
                    className="form-select"
                    value={newSiteData["fuel"] || newSiteData["Fuel"] || ""}
                    onChange={(e) => handleFieldChange("Fuel", e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Fuel Type</option>
                    {fuelTypes.map(fuel => (
                      <option key={fuel} value={fuel}>{fuel}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Market Details Section */}
            <div className="form-section">
              <h3 className="form-section-title">Market Details</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">ISO/RTO</label>
                  <select
                    className="form-select"
                    value={newSiteData["iso"] || newSiteData["ISO"] || ""}
                    onChange={(e) => handleFieldChange("ISO", e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select ISO/RTO</option>
                    {isoOptions.map(iso => (
                      <option key={iso} value={iso}>{iso}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Zone/Submarket</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["zone_submarket"] || newSiteData["Zone/Submarket"] || ""}
                    onChange={(e) => handleFieldChange("Zone/Submarket", e.target.value)}
                    placeholder="Enter zone/submarket"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Markets</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["markets"] || newSiteData["Markets"] || ""}
                    onChange={(e) => handleFieldChange("Markets", e.target.value)}
                    placeholder="Enter markets"
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Process Type</label>
                  <select
                    className="form-select"
                    value={newSiteData["process_type"] || newSiteData["Process (P) or Bilateral (B)"] || ""}
                    onChange={(e) => handleFieldChange("Process (P) or Bilateral (B)", e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Process Type</option>
                    {processOptions.map(proc => (
                      <option key={proc} value={proc}>{proc === "P" ? "Process" : "Bilateral"}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Gas Reference</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["gas_reference"] || newSiteData["Gas Reference"] || ""}
                    onChange={(e) => handleFieldChange("Gas Reference", e.target.value)}
                    placeholder="Enter gas reference"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* Transactability Section */}
            <div className="form-section">
              <h3 className="form-section-title">Transactability</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Transactability</label>
                  <select
                    className="form-select"
                    value={newSiteData["transactability"] || newSiteData["Transactability"] || ""}
                    onChange={(e) => handleTransactabilityChange(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Transactability Level</option>
                    {transactabilityOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Redevelopment Section */}
            <div className="form-section">
              <h3 className="form-section-title">Redevelopment</h3>
              <div className="form-grid">
                {/* Redev Tier */}
                <div className="form-group">
                  <label className="form-label">Redev Tier</label>
                  <select
                    className="form-select"
                    value={newSiteData["redev_tier"] || newSiteData["Redev Tier"] || ""}
                    onChange={(e) => handleFieldChange("Redev Tier", e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Redev Tier</option>
                    {redevTierOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                {/* Redevelopment Base Case - Multi-select */}
                <div className="form-group">
                  <label className="form-label">Redevelopment Base Case</label>
                  <div className="multi-select-container" style={{ width: '100%' }}>
                    <div className="selected-bases">
                      {selectedRedevelopmentBases.map(base => (
                        <span key={base} className="selected-base-tag">
                          {base}
                          <button type="button" className="remove-base" onClick={() => handleRedevelopmentBaseChange(base)}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    
                    <div className="bases-dropdown" style={{ marginTop: '8px', width: '100%' }}>
                      <select
                        className="form-select"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleRedevelopmentBaseChange(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        style={{ marginBottom: '8px', width: '100%' }}
                      >
                        <option value="">Select redevelopment base case</option>
                        {redevelopmentBaseOptions.map(base => {
                          const baseName = base.base_case_name || base.name || base;
                          return (
                            <option key={baseName} value={baseName} disabled={selectedRedevelopmentBases.includes(baseName)}>
                              {baseName}
                            </option>
                          );
                        })}
                      </select>
                      
                      <div className="add-custom-base" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={newRedevelopmentBase}
                          onChange={(e) => setNewRedevelopmentBase(e.target.value)}
                          placeholder="Add custom base case"
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="btn-add-small" onClick={addNewRedevelopmentBase}>
                          Add
                        </button>
                      </div>
                    </div>
                    
                    <small className="form-hint" style={{ display: 'block', marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
                      Select multiple base cases (e.g., Solar and Gas/Thermal)
                    </small>
                  </div>
                </div>

                {/* Redev Capacity */}
                <div className="form-group">
                  <label className="form-label">Redev Capacity (MW)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newSiteData["redev_capacity_mw"] || newSiteData["Redev Capacity (MW)"] || ""}
                    onChange={(e) => handleFieldChange("Redev Capacity (MW)", e.target.value)}
                    placeholder="Enter redev capacity"
                    step="any"
                    min="0"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Redev Tech */}
                <div className="form-group">
                  <label className="form-label">Redev Tech</label>
                  <select
                    className="form-select"
                    value={newSiteData["redev_tech"] || newSiteData["Redev Tech"] || ""}
                    onChange={(e) => handleFieldChange("Redev Tech", e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Redev Technology</option>
                    {redevTechOptions.map(tech => (
                      <option key={tech} value={tech}>{tech}</option>
                    ))}
                  </select>
                </div>

                {/* Redev Fuel - Multi-select */}
                <div className="form-group">
                  <label className="form-label">Redev Fuel</label>
                  <div className="multi-select-container" style={{ width: '100%' }}>
                    <div className="selected-fuels">
                      {selectedRedevFuels.map(fuel => (
                        <span key={fuel} className="selected-fuel-tag">
                          {fuel}
                          <button type="button" className="remove-fuel" onClick={() => handleRedevFuelChange(fuel)}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    
                    <div className="fuels-dropdown" style={{ marginTop: '8px', width: '100%' }}>
                      <select
                        className="form-select"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleRedevFuelChange(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        style={{ marginBottom: '8px', width: '100%' }}
                      >
                        <option value="">Select Redev Fuel</option>
                        {redevFuelOptions.map(fuel => {
                          const fuelName = fuel.fuel_name || fuel.name || fuel;
                          return (
                            <option key={fuelName} value={fuelName} disabled={selectedRedevFuels.includes(fuelName)}>
                              {fuelName}
                            </option>
                          );
                        })}
                      </select>
                      
                      <div className="add-custom-fuel" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={newRedevFuel}
                          onChange={(e) => setNewRedevFuel(e.target.value)}
                          placeholder="Add custom fuel"
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="btn-add-small" onClick={addNewRedevFuel}>
                          Add
                        </button>
                      </div>
                    </div>
                    
                    <small className="form-hint" style={{ display: 'block', marginTop: '8px', color: '#94a3b8', fontSize: '12px' }}>
                      Select multiple fuels (e.g., Gas and Diesel)
                    </small>
                  </div>
                </div>

                {/* Redev Heatrate */}
                <div className="form-group">
                  <label className="form-label">Redev Heatrate (Btu/kWh)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newSiteData["redev_heatrate_btu_kwh"] || newSiteData["Redev Heatrate (Btu/kWh)"] || ""}
                    onChange={(e) => handleFieldChange("Redev Heatrate (Btu/kWh)", e.target.value)}
                    placeholder="Enter redev heatrate"
                    step="any"
                    min="0"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Redev COD */}
                <div className="form-group">
                  <label className="form-label">Redev COD</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["redev_cod"] || newSiteData["Redev COD"] || ""}
                    onChange={(e) => handleRedevCODChange(e.target.value)}
                    placeholder="YYYY or description"
                    style={{ width: '100%' }}
                  />
                  <small className="form-hint">Takes priority over Legacy COD for status calculation</small>
                </div>

                {/* Redev Land Control */}
                <div className="form-group">
                  <label className="form-label">Redev Land Control</label>
                  <select
                    className="form-select"
                    value={newSiteData["redev_land_control"] || newSiteData["Redev Land Control"] || ""}
                    onChange={(e) => handleFieldChange("Redev Land Control", e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Land Control</option>
                    {redevLandControlOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                {/* Redev Stage Gate */}
                <div className="form-group">
                  <label className="form-label">Redev Stage Gate</label>
                  <select
                    className="form-select"
                    value={newSiteData["redev_stage_gate"] || newSiteData["Redev Stage Gate"] || ""}
                    onChange={(e) => handleFieldChange("Redev Stage Gate", e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Stage Gate</option>
                    {redevStageGateOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                {/* Redev Lead - CHANGED: Free-text with suggestions */}
                <div className="form-group">
                  <label className="form-label">Redev Lead</label>
                  <div className="autocomplete-wrapper" style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={newSiteData["redev_lead"] || newSiteData["Redev Lead"] || ""}
                      onChange={(e) => handleFieldChange("Redev Lead", e.target.value)}
                      placeholder="Enter redevelopment lead name"
                      list="redev-lead-suggestions"
                      style={{ width: '100%' }}
                    />
                    <datalist id="redev-lead-suggestions">
                      {redevLeadOptions && redevLeadOptions.map(lead => {
                        const leadName = lead.lead_name || lead.name || lead;
                        return <option key={leadName} value={leadName} />;
                      })}
                    </datalist>
                  </div>
                  <small className="form-hint">
                    Start typing for suggestions or enter a new lead name
                  </small>
                </div>

                {/* Redev Support - CHANGED: Free-text with suggestions */}
                <div className="form-group">
                  <label className="form-label">Redev Support</label>
                  <div className="autocomplete-wrapper" style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={newSiteData["redev_support"] || newSiteData["Redev Support"] || ""}
                      onChange={(e) => handleFieldChange("Redev Support", e.target.value)}
                      placeholder="Enter support team/contacts"
                      list="redev-support-suggestions"
                      style={{ width: '100%' }}
                    />
                    <datalist id="redev-support-suggestions">
                      {redevSupportOptions && redevSupportOptions.map(support => {
                        const supportName = support.support_name || support.name || support;
                        return <option key={supportName} value={supportName} />;
                      })}
                    </datalist>
                  </div>
                  <small className="form-hint">
                    Enter support team members or contacts (comma-separated for multiple)
                  </small>
                </div>

                {/* Co-Locate/Repower */}
                <div className="form-group">
                  <label className="form-label">Co-Locate/Repower</label>
                  <div className="select-with-add" style={{ width: '100%' }}>
                    {!showNewCoLocateRepowerInput ? (
                      <>
                        <select
                          className="form-select"
                          value={newSiteData["co_locate_repower"] || newSiteData["Co-Locate/Repower"] || ""}
                          onChange={(e) => handleCoLocateRepowerChange(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">Select Option</option>
                          {coLocateRepowerOptions.map(option => {
                            const optionName = option.option_name || option.name || option;
                            return (
                              <option key={optionName} value={optionName}>{optionName}</option>
                            );
                          })}
                          <option value="add_new">+ Add New Option</option>
                        </select>
                      </>
                    ) : (
                      <div className="add-new-input" style={{ width: '100%' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={newCoLocateRepower}
                          onChange={(e) => setNewCoLocateRepower(e.target.value)}
                          placeholder="Enter new Co-Locate/Repower option"
                          autoFocus
                          style={{ width: '100%', marginBottom: '8px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="button" className="btn-add-small" onClick={() => {
                            if (newCoLocateRepower.trim()) {
                              handleFieldChange("Co-Locate/Repower", newCoLocateRepower.trim());
                              setShowNewCoLocateRepowerInput(false);
                              setNewCoLocateRepower("");
                            }
                          }}>
                            Add
                          </button>
                          <button type="button" className="btn-cancel-small" onClick={() => {
                            setShowNewCoLocateRepowerInput(false);
                            setNewCoLocateRepower("");
                          }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="form-section">
              <h3 className="form-section-title">Additional Information</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Contact</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newSiteData["contact"] || newSiteData["Contact"] || ""}
                    onChange={(e) => handleFieldChange("Contact", e.target.value)}
                    placeholder="Enter contact person"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

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
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeAddSiteModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSiteModal;
