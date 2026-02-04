import React, { useState, useEffect } from 'react';

const EditSiteModal = ({
  showEditModal,
  closeEditModal,
  handleUpdateProject,
  handleDeleteProject,
  projectData,
  allData,
  dropdownOptions,
  calculateStatusFromCODs
}) => {
  const [formData, setFormData] = useState({});
  const [locationInput, setLocationInput] = useState("");
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  
  const [selectedProjectTypes, setSelectedProjectTypes] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedRedevelopmentBases, setSelectedRedevelopmentBases] = useState([]);
  const [newRedevelopmentBase, setNewRedevelopmentBase] = useState("");
  const [selectedRedevFuels, setSelectedRedevFuels] = useState([]);
  const [newRedevFuel, setNewRedevFuel] = useState("");
  const [showNewCoLocateRepowerInput, setShowNewCoLocateRepowerInput] = useState(false);
  const [newCoLocateRepower, setNewCoLocateRepower] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    // From lookup tables:
    projectTypeOptions = [],
    redevFuelOptions = [],
    redevelopmentBaseOptions = [],
    redevLeadOptions = [],
    redevSupportOptions = [],
    coLocateRepowerOptions = [],
    maTierOptions = [], 
    plantOwners = [],
    technologyOptions = [],
    fuelTypes = [],
    isoOptions = [],
    processOptions = ["P", "B"],
    redevTechOptions = ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"],
    redevTierOptions = ["0", "1", "2", "3", "I", "II", "III", "IV", "V"],
    redevLandControlOptions = ["Y", "N"],
    redevStageGateOptions = ["0", "1", "2", "3", "P"]
  } = dropdownOptions || {};
  
  const defaultMaTierOptions = [
    'Owned',
    'Exclusivity',
    'Second round',
    'First round',
    'Pipeline',
    'Passed'
  ];
  
  const maTierOptionsToUse = maTierOptions && maTierOptions.length > 0 
    ? maTierOptions.map(tier => tier.value || tier.tier_name || tier.name || tier)
    : defaultMaTierOptions;
  
  // Transactability options
  const transactabilityScoreOptions = [
    { value: 1, label: "1 - Bilateral w/ developed relationship" },
    { value: 2, label: "2 - Bilateral w/new relationship or Process w/less than 10 bidders" },
    { value: 3, label: "3 - Highly Competitive Process - More than 10 Bidders" }
  ];
  
  // Status options
  const statusOptions = ["Operating", "Retired", "Future", "Development", "Proposed", "Cancelled", "Unknown"];

  // Import US_CITIES for location autocomplete
  const US_CITIES = [
    "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
    "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
    "Austin, TX", "Jacksonville, FL", "Fort Worth, TX", "Columbus, OH", "Charlotte, NC",
    "San Francisco, CA", "Indianapolis, IN", "Seattle, WA", "Denver, CO", "Washington, DC",
    "Boston, MA", "El Paso, TX", "Detroit, MI", "Nashville, TN", "Portland, OR",
    "Memphis, TN", "Oklahoma City, OK", "Las Vegas, NV", "Louisville, KY", "Baltimore, MD",
    "Milwaukee, WI", "Albuquerque, NM", "Tucson, AZ", "Fresno, CA", "Sacramento, CA",
    "Kansas City, MO", "Long Beach, CA", "Mesa, AZ", "Atlanta, GA", "Colorado Springs, CO",
    "Virginia Beach, VA", "Raleigh, NC", "Omaha, NE", "Miami, FL", "Oakland, CA",
    "Minneapolis, MN", "Tulsa, OK", "Wichita, KS", "New Orleans, LA", "Arlington, TX"
  ];

  useEffect(() => {
    if (showEditModal && projectData) {
      console.log("=== EDIT MODAL: Loading project data ===");
      console.log("Project data received:", projectData);
      
      // Debug: Check all possible sources for POI Voltage
      console.log("Checking POI Voltage sources:");
      console.log("1. projectData['POI Voltage (KV)']:", projectData["POI Voltage (KV)"]);
      console.log("2. projectData.poi_voltage_kv:", projectData.poi_voltage_kv);
      console.log("3. projectData.poi_voltage:", projectData.poi_voltage);
      console.log("4. projectData.poiVoltage:", projectData.poiVoltage);
      console.log("5. projectData.detailData?.poi_voltage_kv:", projectData.detailData?.poi_voltage_kv);
      console.log("6. projectData.detailData?.poiVoltage:", projectData.detailData?.poiVoltage);
      console.log("7. projectData.detailData?.['POI Voltage (KV)']:", projectData.detailData?.["POI Voltage (KV)"]);
      
      const formattedData = {
        id: projectData.id || projectData.project_id || projectData.detailData?.id,
        project_id: projectData.project_id || projectData.id,
        "Project Name": projectData["Project Name"] || projectData.project_name || projectData.asset || "",
        "Project Codename": projectData["Project Codename"] || projectData.project_codename || projectData.codename || "",
        "Plant Owner": projectData["Plant Owner"] || projectData.plant_owner || projectData.owner || "",
        "Location": projectData["Location"] || projectData.location || "",
        "Site Acreage": projectData["Site Acreage"] || projectData.site_acreage || projectData.acreage || "",
        "Status": projectData["Status"] || projectData.status || "",
        "M&A Tier": projectData["M&A Tier"] || projectData.ma_tier || projectData.maTier || "",
        // FIXED: Check multiple sources for POI Voltage
        "POI Voltage (KV)": projectData["POI Voltage (KV)"] || 
                           projectData.poi_voltage_kv || 
                           projectData.poi_voltage || 
                           projectData.poiVoltage ||
                           projectData.detailData?.poi_voltage_kv ||
                           projectData.detailData?.poiVoltage ||
                           projectData.detailData?.["POI Voltage (KV)"] || 
                           "",
        "Legacy Nameplate Capacity (MW)": projectData["Legacy Nameplate Capacity (MW)"] || 
                                          projectData.legacy_capacity_mw || 
                                          projectData.mw || 
                                          "",
        "Tech": projectData["Tech"] || projectData.technology || projectData.tech || "",
        "Heat Rate (Btu/kWh)": projectData["Heat Rate (Btu/kWh)"] || 
                              projectData.heat_rate_btu_kwh || 
                              projectData.hr || 
                              "",
        "2024 Capacity Factor": projectData["2024 Capacity Factor"] || 
                               projectData.capacity_factor_percent || 
                               projectData.cf || 
                               "",
        "Legacy COD": projectData["Legacy COD"] || projectData.legacy_cod || projectData.cod || "",
        "Fuel": projectData["Fuel"] || projectData.fuel_type || projectData.fuel || "",
        "ISO": projectData["ISO"] || projectData.iso_rto || projectData.mkt || "",
        "Zone/Submarket": projectData["Zone/Submarket"] || 
                         projectData.zone_submarket || 
                         projectData.zone || 
                         "",
        "Markets": projectData["Markets"] || projectData.markets || "",
        "Process (P) or Bilateral (B)": projectData["Process (P) or Bilateral (B)"] || 
                                       projectData.process_type || 
                                       projectData.process || 
                                       "",
        "Gas Reference": projectData["Gas Reference"] || 
                        projectData.gas_reference || 
                        projectData.gasReference || 
                        "",
        "Transactability": projectData["Transactability"] || 
                          projectData.transactability_score || 
                          "",
        "Redev Tier": projectData["Redev Tier"] || projectData.redev_tier || "",
        "Redevelopment Base Case": projectData["Redevelopment Base Case"] || 
                                   projectData.redev_base_case || 
                                   "",
        "Redev Capacity (MW)": projectData["Redev Capacity (MW)"] || 
                              projectData.redev_capacity_mw || 
                              "",
        "Redev Tech": projectData["Redev Tech"] || projectData.redev_tech || "",
        "Redev Fuel": projectData["Redev Fuel"] || projectData.redev_fuel || "",
        "Redev Heatrate (Btu/kWh)": projectData["Redev Heatrate (Btu/kWh)"] || 
                                    projectData.redev_heatrate_btu_kwh || 
                                    "",
        "Redev COD": projectData["Redev COD"] || projectData.redev_cod || "",
        "Redev Land Control": projectData["Redev Land Control"] || 
                             projectData.redev_land_control || 
                             "",
        "Redev Stage Gate": projectData["Redev Stage Gate"] || 
                           projectData.redev_stage_gate || 
                           "",
        "Redev Lead": projectData["Redev Lead"] || projectData.redev_lead || "",
        "Redev Support": projectData["Redev Support"] || projectData.redev_support || "",
        "Co-Locate/Repower": projectData["Co-Locate/Repower"] || 
                            projectData.co_locate_repower || 
                            projectData.colocateRepower || 
                            "",
        "Contact": projectData["Contact"] || projectData.contact_name || projectData.contact || "",
        "Project Type": projectData["Project Type"] || projectData.project_type || "",
      };
      
      console.log("Formatted data for edit:", formattedData);
      console.log("M&A Tier value:", formattedData["M&A Tier"]);
      console.log("POI Voltage value:", formattedData["POI Voltage (KV)"]);
      
      // Set form data
      setFormData(formattedData);
      setLocationInput(formattedData["Location"] || "");
      const projectTypeValue = formattedData["Project Type"] || "";
      if (projectTypeValue) {
        const types = projectTypeValue.split(',').map(t => t.trim()).filter(t => t);
        setSelectedProjectTypes(types);
        console.log("Parsed project types:", types);
      }
      
      // Redev Fuels
      const redevFuelValue = formattedData["Redev Fuel"] || "";
      if (redevFuelValue) {
        const fuels = redevFuelValue.split(',').map(f => f.trim()).filter(f => f);
        setSelectedRedevFuels(fuels);
        console.log("Parsed redev fuels:", fuels);
      }
      
      // Redevelopment Bases
      const redevBaseValue = formattedData["Redevelopment Base Case"] || "";
      if (redevBaseValue) {
        const bases = redevBaseValue.split(/[\n,]/).map(b => b.trim()).filter(b => b);
        setSelectedRedevelopmentBases(bases);
        console.log("Parsed redev bases:", bases);
      }
      
      // Status
      setSelectedStatus(formattedData["Status"] || "");
    }
  }, [showEditModal, projectData]);

  // Handle field changes
  const handleInputChange = (field, value) => {
    console.log(`Changing ${field} to:`, value);
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (field === "Location") {
      setLocationInput(value);
    }
  };

  // Location handlers
  const handleLocationInputChange = (value) => {
    setLocationInput(value);
    handleInputChange("Location", value);
    
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
    handleInputChange("Location", city);
    setShowLocationSuggestions(false);
  };

  // Legacy COD handler
  const handleLegacyCODChange = (value) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    handleInputChange("Legacy COD", digitsOnly);
    
    // Auto-update status
    if (digitsOnly.length === 4) {
      const redevCOD = formData["Redev COD"] || "";
      const calculatedStatus = calculateStatusFromCODs(digitsOnly, redevCOD);
      if (calculatedStatus) {
        setSelectedStatus(calculatedStatus);
        handleInputChange("Status", calculatedStatus);
      }
    }
  };

  // Redev COD handler
  const handleRedevCODChange = (value) => {
    handleInputChange("Redev COD", value);
    
    // Auto-update status
    if (value && value.toString().trim() !== "") {
      const calculatedStatus = calculateStatusFromCODs(formData["Legacy COD"] || "", value);
      if (calculatedStatus) {
        setSelectedStatus(calculatedStatus);
        handleInputChange("Status", calculatedStatus);
      }
    }
  };

  // POI Voltage handler - Updated to handle both string and number
  const handlePoiVoltageChange = (value) => {
    // Convert to number if it's a valid number, otherwise keep as string
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && value.trim() !== '') {
      handleInputChange("POI Voltage (KV)", numericValue);
    } else {
      handleInputChange("POI Voltage (KV)", value);
    }
  };

  // Transactability handler
  const handleTransactabilityChange = (value) => {
    const numericValue = parseInt(value, 10);
    handleInputChange("Transactability", isNaN(numericValue) ? "" : numericValue);
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
    handleInputChange("Project Type", updatedTypes.join(", "));
  };

  // Status handler
  const handleStatusChange = (value) => {
    setSelectedStatus(value);
    handleInputChange("Status", value);
  };

  // M&A Tier handler
  const handleMaTierChange = (value) => {
    handleInputChange("M&A Tier", value);
  };

  // Redevelopment Base Case handler
  const handleRedevelopmentBaseChange = (base) => {
    if (selectedRedevelopmentBases.includes(base)) {
      const updated = selectedRedevelopmentBases.filter(b => b !== base);
      setSelectedRedevelopmentBases(updated);
      handleInputChange("Redevelopment Base Case", updated.join("\n"));
    } else {
      const updated = [...selectedRedevelopmentBases, base];
      setSelectedRedevelopmentBases(updated);
      handleInputChange("Redevelopment Base Case", updated.join("\n"));
    }
  };

  const addNewRedevelopmentBase = () => {
    if (newRedevelopmentBase.trim() && !selectedRedevelopmentBases.includes(newRedevelopmentBase.trim())) {
      const updated = [...selectedRedevelopmentBases, newRedevelopmentBase.trim()];
      setSelectedRedevelopmentBases(updated);
      handleInputChange("Redevelopment Base Case", updated.join("\n"));
      setNewRedevelopmentBase("");
    }
  };

  // Co-locate/repower handler
  const handleCoLocateRepowerChange = (value) => {
    if (value === "add_new") {
      setShowNewCoLocateRepowerInput(true);
    } else {
      setShowNewCoLocateRepowerInput(false);
      handleInputChange("Co-Locate/Repower", value);
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
    handleInputChange("Redev Fuel", updatedFuels.join(", "));
  };

  const addNewRedevFuel = () => {
    if (newRedevFuel.trim() && !selectedRedevFuels.includes(newRedevFuel.trim())) {
      const updated = [...selectedRedevFuels, newRedevFuel.trim()];
      setSelectedRedevFuels(updated);
      handleInputChange("Redev Fuel", updated.join(", "));
      setNewRedevFuel("");
    }
  };

  // Form validation and submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Required fields
    if (!formData["Project Name"] || formData["Project Name"].trim() === "") {
      alert("Please enter a Project Name");
      return;
    }
    
    if (!formData["Plant Owner"] || formData["Plant Owner"].trim() === "") {
      alert("Please select or enter a Plant Owner");
      return;
    }
    
    console.log("Submitting updated project:", formData);
    console.log("Project ID:", formData.id);
    console.log("Project Type:", formData["Project Type"]);
    console.log("M&A Tier:", formData["M&A Tier"]);
    console.log("POI Voltage:", formData["POI Voltage (KV)"]);
    console.log("Status:", formData["Status"]);
    console.log("Redev Fuel:", formData["Redev Fuel"]);
    console.log("Redev Base Case:", formData["Redevelopment Base Case"]);
    
    handleUpdateProject(formData);
  };

  const handleDelete = async () => {
    if (!projectData?.id) return;

    setIsDeleting(true);
    try {
      await handleDeleteProject(projectData.id);
      setShowDeleteConfirm(false);
      closeEditModal();
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!showEditModal) return null;

  return (
    <div className="modal-overlay" onClick={closeEditModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "1100px" }}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Project: {formData["Project Name"] || "Unknown Project"}</h2>
          <button className="modal-close" onClick={closeEditModal}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
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
                    value={formData["Project Name"] || ""}
                    onChange={(e) => handleInputChange("Project Name", e.target.value)}
                    placeholder="Enter project name"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Project Codename</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData["Project Codename"] || ""}
                    onChange={(e) => handleInputChange("Project Codename", e.target.value)}
                    placeholder="Enter codename"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label required">Plant Owner</label>
                  <select
                    className="form-select"
                    value={formData["Plant Owner"] || ""}
                    onChange={(e) => handleInputChange("Plant Owner", e.target.value)}
                    required
                  >
                    <option value="">Select Plant Owner</option>
                    {plantOwners.map(owner => (
                      <option key={owner} value={owner}>{owner}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <div className="autocomplete-wrapper">
                    <input
                      type="text"
                      className="form-input"
                      value={locationInput}
                      onChange={(e) => handleLocationInputChange(e.target.value)}
                      placeholder="City, State"
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
                </div>
                
                <div className="form-group">
                  <label className="form-label">Site Acreage</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData["Site Acreage"] || ""}
                    onChange={(e) => handleInputChange("Site Acreage", e.target.value)}
                    placeholder="Enter acreage"
                  />
                </div>

                {/* NEW: M&A Tier Field */}
                <div className="form-group">
                  <label className="form-label">M&A Tier</label>
                  <select
                    className="form-select"
                    value={formData["M&A Tier"] || ""}
                    onChange={(e) => handleMaTierChange(e.target.value)}
                  >
                    <option value="">Select M&A Tier</option>
                    {maTierOptionsToUse.map(tier => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={selectedStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
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
                    value={formData["Legacy Nameplate Capacity (MW)"] || ""}
                    onChange={(e) => handleInputChange("Legacy Nameplate Capacity (MW)", e.target.value)}
                    placeholder="Enter capacity in MW"
                    step="any"
                    min="0"
                  />
                </div>
                
                {/* NEW: POI Voltage Field - Added after Capacity MW */}
                <div className="form-group">
                  <label className="form-label">POI Voltage (KV)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData["POI Voltage (KV)"] || ""}
                    onChange={(e) => handlePoiVoltageChange(e.target.value)}
                    placeholder="Enter POI voltage in KV"
                    step="any"
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Technology</label>
                  <select
                    className="form-select"
                    value={formData["Tech"] || ""}
                    onChange={(e) => handleInputChange("Tech", e.target.value)}
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
                    value={formData["Heat Rate (Btu/kWh)"] || ""}
                    onChange={(e) => handleInputChange("Heat Rate (Btu/kWh)", e.target.value)}
                    placeholder="Enter heat rate"
                    step="any"
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Capacity Factor (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData["2024 Capacity Factor"] || ""}
                    onChange={(e) => handleInputChange("2024 Capacity Factor", e.target.value)}
                    placeholder="Enter capacity factor"
                    step="any"
                    min="0"
                    max="100"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Legacy COD</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData["Legacy COD"] || ""}
                    onChange={(e) => handleLegacyCODChange(e.target.value)}
                    placeholder="YYYY"
                    maxLength="4"
                  />
                  <small className="form-hint">Used to calculate status if no Redev COD</small>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Fuel</label>
                  <select
                    className="form-select"
                    value={formData["Fuel"] || ""}
                    onChange={(e) => handleInputChange("Fuel", e.target.value)}
                  >
                    <option value="">Select Fuel Type</option>
                    {fuelTypes.map(fuel => (
                      <option key={fuel} value={fuel}>{fuel}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Transactability Score</label>
                  <select
                    className="form-select"
                    value={formData["Transactability"] || ""}
                    onChange={(e) => handleTransactabilityChange(e.target.value)}
                  >
                    <option value="">Select Transactability Score</option>
                    {transactabilityScoreOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
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
                    value={formData["ISO"] || ""}
                    onChange={(e) => handleInputChange("ISO", e.target.value)}
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
                    value={formData["Zone/Submarket"] || ""}
                    onChange={(e) => handleInputChange("Zone/Submarket", e.target.value)}
                    placeholder="Enter zone/submarket"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Markets</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData["Markets"] || ""}
                    onChange={(e) => handleInputChange("Markets", e.target.value)}
                    placeholder="Enter markets"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Process Type</label>
                  <select
                    className="form-select"
                    value={formData["Process (P) or Bilateral (B)"] || ""}
                    onChange={(e) => handleInputChange("Process (P) or Bilateral (B)", e.target.value)}
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
                    value={formData["Gas Reference"] || ""}
                    onChange={(e) => handleInputChange("Gas Reference", e.target.value)}
                    placeholder="Enter gas reference"
                  />
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
                    value={formData["Redev Tier"] || ""}
                    onChange={(e) => handleInputChange("Redev Tier", e.target.value)}
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
                    value={formData["Redev Capacity (MW)"] || ""}
                    onChange={(e) => handleInputChange("Redev Capacity (MW)", e.target.value)}
                    placeholder="Enter redev capacity"
                    step="any"
                    min="0"
                  />
                </div>

                {/* Redev Tech */}
                <div className="form-group">
                  <label className="form-label">Redev Tech</label>
                  <select
                    className="form-select"
                    value={formData["Redev Tech"] || ""}
                    onChange={(e) => handleInputChange("Redev Tech", e.target.value)}
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
                    value={formData["Redev Heatrate (Btu/kWh)"] || ""}
                    onChange={(e) => handleInputChange("Redev Heatrate (Btu/kWh)", e.target.value)}
                    placeholder="Enter redev heatrate"
                    step="any"
                    min="0"
                  />
                </div>

                {/* Redev COD */}
                <div className="form-group">
                  <label className="form-label">Redev COD</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData["Redev COD"] || ""}
                    onChange={(e) => handleRedevCODChange(e.target.value)}
                    placeholder="YYYY or description"
                  />
                  <small className="form-hint">Takes priority over Legacy COD for status calculation</small>
                </div>

                {/* Redev Land Control */}
                <div className="form-group">
                  <label className="form-label">Redev Land Control</label>
                  <select
                    className="form-select"
                    value={formData["Redev Land Control"] || ""}
                    onChange={(e) => handleInputChange("Redev Land Control", e.target.value)}
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
                    value={formData["Redev Stage Gate"] || ""}
                    onChange={(e) => handleInputChange("Redev Stage Gate", e.target.value)}
                  >
                    <option value="">Select Stage Gate</option>
                    {redevStageGateOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                {/* Redev Lead */}
                <div className="form-group">
                  <label className="form-label">Redev Lead</label>
                  <select
                    className="form-select"
                    value={formData["Redev Lead"] || ""}
                    onChange={(e) => handleInputChange("Redev Lead", e.target.value)}
                  >
                    <option value="">Select Redev Lead</option>
                    {redevLeadOptions.map(lead => {
                      const leadName = lead.lead_name || lead.name || lead;
                      return (
                        <option key={leadName} value={leadName}>{leadName}</option>
                      );
                    })}
                  </select>
                </div>

                {/* Redev Support */}
                <div className="form-group">
                  <label className="form-label">Redev Support</label>
                  <select
                    className="form-select"
                    value={formData["Redev Support"] || ""}
                    onChange={(e) => handleInputChange("Redev Support", e.target.value)}
                  >
                    <option value="">Select Redev Support</option>
                    {redevSupportOptions.map(support => {
                      const supportName = support.support_name || support.name || support;
                      return (
                        <option key={supportName} value={supportName}>{supportName}</option>
                      );
                    })}
                  </select>
                </div>

                {/* Co-Locate/Repower */}
                <div className="form-group">
                  <label className="form-label">Co-Locate/Repower</label>
                  <div className="select-with-add" style={{ width: '100%' }}>
                    {!showNewCoLocateRepowerInput ? (
                      <>
                        <select
                          className="form-select"
                          value={formData["Co-Locate/Repower"] || ""}
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
                              handleInputChange("Co-Locate/Repower", newCoLocateRepower.trim());
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
                    value={formData["Contact"] || ""}
                    onChange={(e) => handleInputChange("Contact", e.target.value)}
                    placeholder="Enter contact person"
                  />
                </div>
              </div>
            </div>

            {/* Danger Zone Section */}
            <div className="form-section" style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginTop: '24px'
            }}>
              <h3 className="form-section-title" style={{ color: '#ef4444' }}>Danger Zone</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
                Once you delete a project, it will be removed from all views in the dashboard.
              </p>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Delete This Project
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Update Project
            </button>
          </div>
        </form>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100
          }}>
            <div style={{
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              border: '1px solid #374151'
            }}>
              <h3 style={{ color: '#ef4444', marginBottom: '16px' }}>Delete Project?</h3>
              <p style={{ color: '#94a3b8', marginBottom: '8px' }}>
                Are you sure you want to delete:
              </p>
              <p style={{ color: '#e5e7eb', fontWeight: '600', marginBottom: '24px' }}>
                {formData["Project Name"] || projectData?.project_name || "this project"}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>
                The project will be removed from all dashboard views.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #374151',
                    backgroundColor: 'transparent',
                    color: '#e5e7eb',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    opacity: isDeleting ? 0.7 : 1
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditSiteModal;