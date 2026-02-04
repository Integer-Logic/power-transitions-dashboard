// Import canonical score calculation functions
import { calculateAllScores } from './scoreCalculations';

// Add this function at the top of calculations.js
export const parseTransmissionData = (transmissionStr) => {
  if (!transmissionStr || transmissionStr.trim() === "") {
    return [];
  }
  
  try {
    // Expected format: "69 kV|143.9|144.2|-|true;138 kV|549.5|95.5|-|true"
    return transmissionStr.split(';').map(point => {
      const parts = point.split('|');
      if (parts.length >= 5) {
        return {
          voltage: parts[0].trim(),
          injectionCapacity: parseFloat(parts[1]) || 0,
          withdrawalCapacity: parseFloat(parts[2]) || 0,
          constraints: parts[3].trim(),
          hasExcessCapacity: parts[4].toLowerCase() === 'true'
        };
      }
      return null;
    }).filter(point => point !== null);
  } catch (error) {
    console.error('Error parsing transmission data:', error);
    return [];
  }
};

// Helper function to extract year from string
const extractYearFromString = (str) => {
  if (!str || str.toString().trim() === "") return null;
  const stringValue = str.toString().trim();
  
  // Handle special cases
  if (stringValue.includes('#N/A') || stringValue.includes('N/A') || stringValue.includes('#VALUE!')) {
    return null;
  }
  
  // Try to extract 4-digit year
  const yearMatch = stringValue.match(/\b(\d{4})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    // Validate year is reasonable (between 1900 and 2100)
    if (!isNaN(year) && year >= 1900 && year <= 2100) {
      return year;
    }
  }
  
  return null;
};

// Enhanced status calculation function
export const calculateStatus = (legacyCOD, redevCOD) => {
  const currentYear = new Date().getFullYear();
  
  // Debug logging
  console.log('Status calculation inputs:', { legacyCOD, redevCOD, currentYear });
  
  // First check Legacy COD for existing plants
  if (legacyCOD && legacyCOD.toString().trim() !== "") {
    const legacyYear = extractYearFromString(legacyCOD);
    console.log('Legacy year extracted:', legacyYear);
    
    if (legacyYear !== null && !isNaN(legacyYear)) {
      if (legacyYear < currentYear) {
        console.log('Status: Operating (Legacy COD in past)');
        return "Operating";
      }
      if (legacyYear > currentYear) {
        console.log('Status: Future (Legacy COD in future)');
        return "Future";
      }
      console.log('Status: Operating (Legacy COD current year)');
      return "Operating"; // Current year
    }
  }
  
  // If no valid Legacy COD, check Redev COD for new projects
  if (redevCOD && redevCOD.toString().trim() !== "") {
    const redevYear = extractYearFromString(redevCOD);
    console.log('Redev year extracted:', redevYear);
    
    if (redevYear !== null && !isNaN(redevYear)) {
      if (redevYear < currentYear) {
        console.log('Status: Operating (Redev COD in past)');
        return "Operating";
      }
      if (redevYear > currentYear) {
        console.log('Status: Future (Redev COD in future)');
        return "Future";
      }
      console.log('Status: Operating (Redev COD current year)');
      return "Operating"; // Current year
    }
  }
  
  // If we have COD but couldn't parse it, check for keywords
  if (legacyCOD && legacyCOD.toString().trim() !== "") {
    const codStr = legacyCOD.toString().toLowerCase();
    if (codStr.includes('future') || codStr.includes('planned') || codStr.includes('tbd')) {
      console.log('Status: Future (keyword in Legacy COD)');
      return "Future";
    }
  }
  
  if (redevCOD && redevCOD.toString().trim() !== "") {
    const codStr = redevCOD.toString().toLowerCase();
    if (codStr.includes('future') || codStr.includes('planned') || codStr.includes('tbd')) {
      console.log('Status: Future (keyword in Redev COD)');
      return "Future";
    }
  }
  
  console.log('Status: Unknown (no valid COD found)');
  return "Unknown";
};

export const findColumnName = (row, patterns) => {
  const keys = Object.keys(row);
  for (const pattern of patterns) {
    const foundKey = keys.find(key => 
      key && key.toString().toLowerCase().includes(pattern.toLowerCase())
    );
    if (foundKey) return foundKey;
  }
  return null;
};

export const filterData = (data, selectedIso, selectedProcess, selectedOwner, findColumnName) => {
  if (!data || data.length === 0) return [];
  
  let filtered = [...data];
  
  if (selectedIso !== "All") {
    filtered = filtered.filter(row => {
      const isoCol = findColumnName(row, ["ISO", "iso"]);
      const iso = isoCol ? row[isoCol] : "";
      return iso && iso.toString().trim().toUpperCase() === selectedIso.toUpperCase();
    });
  }
  
  if (selectedProcess !== "All") {
    filtered = filtered.filter(row => {
      const processCol = findColumnName(row, ["Process (P) or Bilateral (B)", "Process", "process", "P or B"]);
      const process = processCol ? row[processCol] : "";
      const processLetter = selectedProcess === "Process" ? "P" : "B";
      return process && process.toString().trim().toUpperCase() === processLetter;
    });
  }
  
  if (selectedOwner !== "All") {
    filtered = filtered.filter(row => {
      const ownerCol = findColumnName(row, ["Plant Owner", "Owner", "owner"]);
      const owner = ownerCol ? row[ownerCol] : "";
      return owner && owner.toString().trim() === selectedOwner;
    });
  }
  
  return filtered;
};

export const calculateKPIs = (jsonData, columns, setKpiRow1, setKpiRow2) => {
  const {
    projectNameCol, capacityCol, overallCol, thermalCol, redevCol,
    heatRateCol, codCol, processCol
  } = columns;

  const projectCount = jsonData.filter(row => {
    const name = row[projectNameCol];
    return name && name.toString().trim() !== "";
  }).length;

  // Calculate scores using canonical formula
  let totalCalculatedThermal = 0;
  let totalCalculatedRedev = 0;
  let totalCalculatedOverall = 0;
  let calculatedCount = 0;

  jsonData.forEach(row => {
    // Use canonical score calculation function
    const scores = calculateAllScores(row);
    const thermalScore = scores.thermal_score;
    const redevScore = scores.redevelopment_score;
    const overallScore = scores.overall_score;

    if (!isNaN(thermalScore)) totalCalculatedThermal += thermalScore;
    if (!isNaN(redevScore)) totalCalculatedRedev += redevScore;
    if (!isNaN(overallScore)) totalCalculatedOverall += overallScore;

    if (thermalScore || redevScore || overallScore) calculatedCount++;
  });

  const avgCalculatedThermal = calculatedCount > 0 ? totalCalculatedThermal / calculatedCount : 0;
  const avgCalculatedRedev = calculatedCount > 0 ? totalCalculatedRedev / calculatedCount : 0;
  const avgCalculatedOverall = calculatedCount > 0 ? totalCalculatedOverall / calculatedCount : 0;

  let totalCapacityMW = 0;
  let capacityCount = 0;
  
  jsonData.forEach(row => {
    let capacityStr = row[capacityCol] || "";
    capacityStr = capacityStr.toString().replace(/,/g, '').trim();
    
    if (capacityStr && capacityStr !== "" && 
        capacityStr.toUpperCase() !== "N/A" && 
        !capacityStr.includes("#")) {
      
      const capacity = parseFloat(capacityStr);
      if (!isNaN(capacity)) {
        totalCapacityMW += capacity;
        capacityCount++;
      }
    }
  });
  
  const totalCapacityGW = (totalCapacityMW / 1000).toFixed(1);
  
  let totalHeatRate = 0;
  let heatRateCount = 0;
  
  jsonData.forEach(row => {
    let heatRateStr = row[heatRateCol] || "";
    heatRateStr = heatRateStr.toString().replace(/,/g, '').trim();
    
    if (heatRateStr && heatRateStr !== "" && 
        heatRateStr.toUpperCase() !== "N/A" && 
        !heatRateStr.includes("#")) {
      const heatRate = parseFloat(heatRateStr);
      if (!isNaN(heatRate) && heatRate > 0) {
        totalHeatRate += heatRate;
        heatRateCount++;
      }
    }
  });
  
  const avgHeatRate = heatRateCount > 0 ? totalHeatRate / heatRateCount : 0;
  
  // DEBUG LOGGING for Average Age calculation
  console.log('=== CALCULATIONS DEBUG ===');
  console.log('codCol being used:', codCol);
  
  // FIXED: Use actual current year instead of hardcoded 2025
  const currentYear = new Date().getFullYear();
  console.log('Current year:', currentYear);
  
  let totalAge = 0;
  let ageCount = 0;
  let debugRows = 0;
  
  jsonData.forEach(row => {
    debugRows++;
    let codStr = row[codCol] || "";
    codStr = codStr.toString().trim();
    
    console.log(`Row ${debugRows}: codStr = "${codStr}"`);
    
    if (codStr && codStr !== "" && 
        codStr.toUpperCase() !== "N/A" && 
        !codStr.includes("#") &&
        !codStr.includes("XLOOKUP")) { // Skip Excel formulas
      
      const codMatch = codStr.toString().match(/\d{4}/);
      console.log(`  - Regex match result:`, codMatch);
      
      if (codMatch) {
        const cod = parseInt(codMatch[0]);
        console.log(`  - Parsed COD: ${cod}`);
        
        // Relaxed validation to include more years
        if (!isNaN(cod) && cod >= 1900 && cod <= currentYear + 10) { // Allow future plants up to 10 years ahead
          const age = Math.max(0, currentYear - cod); // Ensure age is not negative
          totalAge += age;
          ageCount++;
          console.log(`  - Age added: ${age}, totalAge now: ${totalAge}, ageCount: ${ageCount}`);
        } else {
          console.log(`  - COD ${cod} rejected (must be >=1900 and <=${currentYear + 10})`);
        }
      }
    } else {
      console.log(`  - Skipped: empty, N/A, #, or Excel formula`);
    }
  });
  
  console.log(`Final: totalAge = ${totalAge}, ageCount = ${ageCount}`);
  const avgAge = ageCount > 0 ? totalAge / ageCount : 0;
  console.log(`Avg Age: ${avgAge}`);
  
  let processCount = 0;
  let bilateralCount = 0;
  
  jsonData.forEach(row => {
    const processType = row[processCol] || "";
    const typeStr = processType.toString().toUpperCase();
    if (typeStr === "P") {
      processCount++;
    } else if (typeStr === "B") {
      bilateralCount++;
    }
  });

  setKpiRow1([
    { 
      label: "PROJECTS", 
      value: projectCount.toString(), 
      sub: `${processCount}P / ${bilateralCount}B`,
      colorClass: "projects"
    },
    { 
      label: "TOTAL CAPACITY", 
      value: `${totalCapacityGW} GW`, 
      sub: "Nameplate",
      colorClass: "capacity"
    },
    { 
      label: "AVG HEAT RATE", 
      value: Math.round(avgHeatRate).toLocaleString(), 
      sub: "Btu/kWh",
      colorClass: "heat-rate"
    },
    { 
      label: "AVG AGE", 
      value: `${Math.round(avgAge)} yrs`, 
      sub: "Vintage",
      colorClass: "age"
    },
  ]);

  setKpiRow2([
    { 
      label: "TOP QUARTILE", 
      value: "5", 
      sub: "3.2 GW",
      colorClass: "quartile"
    },
    { 
      label: "AVG OVERALL", 
      value: avgCalculatedOverall.toFixed(2), 
      sub: "/6.0",
      colorClass: "overall"
    },
    { 
      label: "AVG THERMAL", 
      value: avgCalculatedThermal.toFixed(2), 
      sub: "/3.0",
      colorClass: "thermal"
    },
    { 
      label: "AVG REDEV", 
      value: avgCalculatedRedev.toFixed(2), 
      sub: "/3.0",
      colorClass: "redev"
    },
  ]);
};

export const calculateIsoData = (jsonData, isoCol, capacityCol, setIsoData) => {
  const isoGroups = {};
  
  jsonData.forEach(row => {
    const iso = row[isoCol] || "Unknown";
    let capacityStr = row[capacityCol] || "";
    capacityStr = capacityStr.toString().replace(/,/g, '').trim();
    
    if (iso && iso.toString().trim() !== "" && 
        capacityStr && capacityStr !== "" && 
        capacityStr.toUpperCase() !== "N/A" && 
        !capacityStr.includes("#")) {
      
      const capacity = parseFloat(capacityStr);
      if (!isNaN(capacity)) {
        if (!isoGroups[iso]) {
          isoGroups[iso] = {
            capacity: 0,
            count: 0
          };
        }
        isoGroups[iso].capacity += capacity;
        isoGroups[iso].count++;
      }
    }
  });

  const isoArray = Object.keys(isoGroups).map(iso => ({
    name: iso,
    value: parseFloat((isoGroups[iso].capacity / 1000).toFixed(1)),
    count: isoGroups[iso].count
  })).sort((a, b) => b.value - a.value);

  setIsoData(isoArray);
};

export const calculateTechData = (jsonData, techCol, capacityCol, setTechData) => {
  const techGroups = {};
  
  jsonData.forEach(row => {
    const tech = row[techCol] || "Unknown";
    let capacityStr = row[capacityCol] || "";
    capacityStr = capacityStr.toString().replace(/,/g, '').trim();
    
    if (tech && tech.toString().trim() !== "" && 
        capacityStr && capacityStr !== "" && 
        capacityStr.toUpperCase() !== "N/A" && 
        !capacityStr.includes("#")) {
      
      const capacity = parseFloat(capacityStr);
      if (!isNaN(capacity)) {
        if (!techGroups[tech]) {
          techGroups[tech] = {
            capacity: 0,
            count: 0
          };
        }
        techGroups[tech].capacity += capacity;
        techGroups[tech].count++;
      }
    }
  });

  const techArray = Object.keys(techGroups).map(tech => ({
    tech: tech,
    value: parseFloat(techGroups[tech].capacity.toFixed(0)),
    count: techGroups[tech].count
  })).sort((a, b) => b.value - a.value);

  setTechData(techArray);
};

export const calculateRedevelopmentTypes = (jsonData, redevBaseCaseCol, setRedevelopmentTypes) => {
  const redevCounts = {};
  
  jsonData.forEach(row => {
    const redevStr = row[redevBaseCaseCol] || "";
    if (redevStr && redevStr.toString().trim() !== "") {
      const types = redevStr.toString().split(/[\n\/]/).map(t => t.trim()).filter(t => t);
      
      types.forEach(type => {
        let cleanType = type.trim();
        
        if (cleanType.toLowerCase().includes("bess")) {
          cleanType = "BESS";
        } else if (cleanType.toLowerCase().includes("gas") || cleanType.toLowerCase().includes("thermal")) {
          cleanType = "Gas/Thermal";
        } else if (cleanType.toLowerCase().includes("solar")) {
          cleanType = "Solar";
        } else if (cleanType.toLowerCase().includes("powered") || cleanType.toLowerCase().includes("land")) {
          cleanType = "Powered Land";
        } else if (cleanType.toLowerCase().includes("plant") || cleanType.toLowerCase().includes("optimization")) {
          cleanType = "Plant Optimization";
        }
        
        if (cleanType) {
          redevCounts[cleanType] = (redevCounts[cleanType] || 0) + 1;
        }
      });
    }
  });

  const redevArray = Object.keys(redevCounts).map(type => {
    let colorClass = "gray";
    let inlineStyle = {};
    
    if (type === "BESS") {
      colorClass = "green";
    } else if (type === "Gas/Thermal") {
      colorClass = "red";
    } else if (type === "Solar") {
      colorClass = "yellow";
    } else if (type === "Powered Land") {
      colorClass = "blue";
    } else if (type === "Plant Optimization") {
      colorClass = "purple";
      inlineStyle = {
        background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
        color: "white",
        border: "1px solid #7c3aed"
      };
    }
    
    return {
      label: type,
      value: redevCounts[type],
      className: `kpi-chip ${colorClass}`,
      style: inlineStyle
    };
  }).sort((a, b) => b.value - a.value);

  setRedevelopmentTypes(redevArray);
};

export const calculateCounterpartyData = (jsonData, ownerCol, overallCol, capacityCol, setCounterparties) => {
  const ownerGroups = {};

  jsonData.forEach(row => {
    const owner = row[ownerCol] || "Unknown";
    let capacityStr = row[capacityCol] || "";
    capacityStr = capacityStr.toString().replace(/,/g, '').trim();

    if (owner && owner.toString().trim() !== "" &&
        capacityStr && capacityStr !== "" &&
        capacityStr.toUpperCase() !== "N/A" &&
        !capacityStr.includes("#")) {

      const capacity = parseFloat(capacityStr);
      // Calculate overall score using canonical function
      const scores = calculateAllScores(row);
      const overall = scores.overall_score;

      if (!isNaN(capacity)) {
        if (!ownerGroups[owner]) {
          ownerGroups[owner] = {
            count: 0,
            totalCapacity: 0,
            totalOverall: 0
          };
        }
        ownerGroups[owner].count++;
        ownerGroups[owner].totalCapacity += capacity;
        ownerGroups[owner].totalOverall += overall;
      }
    }
  });

  const counterpartyArray = Object.keys(ownerGroups).map(owner => {
    const group = ownerGroups[owner];
    const avgScore = group.count > 0 ? (group.totalOverall / group.count).toFixed(2) : "0.00";
    const capacityGW = (group.totalCapacity / 1000).toFixed(1);
    
    return {
      name: owner,
      projects: `${group.count} project${group.count > 1 ? 's' : ''}`,
      gw: `${capacityGW} GW`,
      avg: avgScore
    };
  }).sort((a, b) => {
    const aGW = parseFloat(a.gw);
    const bGW = parseFloat(b.gw);
    return bGW - aGW;
  });

  setCounterparties(counterpartyArray);
};

export const calculatePipelineData = (jsonData, allColumns, setPipelineRows) => {
  const {
    projectNameCol, ownerCol, overallCol, thermalCol, redevCol,
    isoCol, zoneCol, capacityCol, techCol, heatRateCol, cfCol,
    locationCol, projectCodenameCol, redevLoadCol, icScoreCol, numberOfSitesCol,
    gasReferenceCol, contactCol, siteAcreageCol, fuelCol, redevCodCol, marketsCol,
    thermalOptimizationCol, environmentalScoreCol, marketScoreCol, infraCol, ixCol,
    coLocateRepowerCol, transactibilityCol, plantCodCol, legacyCodCol,
    transmissionCol,
    transactabilityScoresCol,
    transactabilityCol,
    // ADD ALL REDEVELOPMENT COLUMNS
    redevTierCol,
    redevCapacityCol,
    redevTechCol,
    redevFuelCol,
    redevHeatrateCol,
    redevLandControlCol,
    redevStageGateCol,
    redevLeadCol,
    redevSupportCol,
    redevBaseCaseCol,
    projectTypeCol,
    // ADD M&A Tier column
    maTierCol,
    // ADD POI Voltage column
    poiVoltageCol
  } = allColumns;

  const pipelineData = jsonData.map((row, index) => {
    let capacityStr = row[capacityCol] || "";
    capacityStr = capacityStr.toString().replace(/,/g, '').trim();
    const mw = parseFloat(capacityStr) || 0;
    
    let heatRateStr = row[heatRateCol] || "";
    heatRateStr = heatRateStr.toString().replace(/,/g, '').trim();
    const hr = parseFloat(heatRateStr) || 0;
    
    // Calculate scores using canonical formula
    const scores = calculateAllScores(row);
    const overall = scores.overall_score;
    const thermal = scores.thermal_score;
    const redev = scores.redevelopment_score;

    // FIX: Use parseTransmissionData which should now be defined
    const transmissionData = parseTransmissionData(row[transmissionCol] || "");
    
    // CRITICAL: Extract Transactability data
    const transactabilityScore = row[transactabilityScoresCol] || ""; // Column AH (numeric: 2, 3, #N/A)
    const transactability = row[transactabilityCol] || ""; // Column AI (text description)
    
    // CRITICAL: Extract M&A Tier data
    const maTier = row[maTierCol] || "";
    
    // CRITICAL: Extract POI Voltage data
    const poiVoltage = row[poiVoltageCol] || "";
    
    // CRITICAL: Extract all redevelopment fields
    const redevTier = row[redevTierCol] || "";
    const redevCapacity = row[redevCapacityCol] || "";
    const redevTech = row[redevTechCol] || "";
    const redevFuel = row[redevFuelCol] || "";
    const redevHeatrate = row[redevHeatrateCol] || "";
    const redevCOD = row[redevCodCol] || "";
    const redevLandControl = row[redevLandControlCol] || "";
    const redevStageGate = row[redevStageGateCol] || "";
    const redevLead = row[redevLeadCol] || "";
    const redevSupport = row[redevSupportCol] || "";
    const redevBaseCase = row[redevBaseCaseCol] || "";
    const projectType = row[projectTypeCol] || "";
    
    // Get Legacy COD and Redev COD for status calculation
    const legacyCOD = row[legacyCodCol] || "";
    const redevCODValue = redevCOD || "";
    
    // Calculate status using enhanced function
    const status = calculateStatus(legacyCOD, redevCODValue);
    
    let codStr = legacyCOD || "";
    let cod = 0;
    if (codStr && codStr.toString().trim() !== "") {
      const codMatch = codStr.toString().match(/\d{4}/);
      if (codMatch) {
        cod = parseInt(codMatch[0]) || 0;
      }
    }
    
    let cf = row[cfCol] || "0%";
    if (cf && cf.toString().includes("%")) {
    } else if (cf && !isNaN(parseFloat(cf))) {
      cf = `${(parseFloat(cf) * 100).toFixed(1)}%`;
    } else {
      cf = "0%";
    }

    // Helper to format score for detailData (handles null for N/A)
    const formatScore = (score) => {
      if (score === null || score === undefined) return null;
      return score.toFixed(2);
    };

    const detailData = {
      "Project Name": row[projectNameCol] || "",
      "Project Codename": row[projectCodenameCol] || "",
      "Plant Owner": row[ownerCol] || "",
      "Location": row[locationCol] || "",
      "Overall Project Score": formatScore(overall),
      "Thermal Operating Score": formatScore(thermal),
      "Redevelopment Score": formatScore(redev),
      "Redevelopment (Load) Score": row[redevLoadCol] || "",
      "I&C Score": row[icScoreCol] || "",
      "Legacy Nameplate Capacity (MW)": row[capacityCol] || "",
      "Tech": row[techCol] || "",
      "Heat Rate (Btu/kWh)": row[heatRateCol] || "",
      "2024 Capacity Factor": cf,
      "Legacy COD": legacyCOD || "",
      "Plant COD": row[plantCodCol] || "",
      "Fuel": row[fuelCol] || "",
      "ISO": row[isoCol] || "",
      "Zone/Submarket": row[zoneCol] || "",
      "Markets": row[marketsCol] || "",
      "Gas Reference": row[gasReferenceCol] || "",
      "Process (P) or Bilateral (B)": row[allColumns.processCol] || "",
      "Number of Sites": row[numberOfSitesCol] || "",
      "Redevelopment Base Case": redevBaseCase || "",
      "Redev COD": redevCODValue || "",
      "Thermal Optimization": row[thermalOptimizationCol] || "",
      "Co-Locate/Repower": row[coLocateRepowerCol] || "",
      "Environmental Score": row[environmentalScoreCol] || "",
      "Market Score": row[marketScoreCol] || "",
      "Infra": row[infraCol] || "",
      "IX": row[ixCol] || "",
      "Transactibility": row[transactibilityCol] || "",
      // CRITICAL: Add Transactability fields
      "Transactability Scores": transactabilityScore || "", // Column AH
      "Transactability": transactability || "", // Column AI
      "Transmission Data": row[transmissionCol] || "",  // ADD THIS
      "Contact": row[contactCol] || "",
      "Site Acreage": row[siteAcreageCol] || "",
      // CRITICAL: ADD M&A TIER FIELD
      "M&A Tier": maTier || "",
      // CRITICAL: ADD POI VOLTAGE FIELD
      "POI Voltage (KV)": poiVoltage || "",
      // CRITICAL: ADD ALL REDEVELOPMENT FIELDS TO DETAIL DATA
      "Redev Tier": redevTier || "",
      "Redev Capacity (MW)": redevCapacity || "",
      "Redev Tech": redevTech || "",
      "Redev Fuel": redevFuel || "",
      "Redev Heatrate (Btu/kWh)": redevHeatrate || "",
      "Redev Land Control": redevLandControl || "",
      "Redev Stage Gate": redevStageGate || "",
      "Redev Lead": redevLead || "",
      "Redev Support": redevSupport || "",
      "Project Type": projectType || "",
      "Status": status || "", // Add status to detail data
      "Calculated Overall": formatScore(overall),
      "Calculated Thermal": formatScore(thermal),
      "Calculated Redevelopment": formatScore(redev),
      "Score Breakdown": {},
      "has_na": scores.has_na || false // Flag indicating if any score is N/A
    };

    return {
      // FIXED: Use database ID if available, otherwise use index
      id: row.id || row.project_id || index + 1,
      displayId: index + 1, // Add sequential display ID
      asset: row[projectNameCol] || "",
      location: row[locationCol] || "",
      owner: row[ownerCol] || "",
      overall: overall,
      thermal: thermal,
      redev: redev,
      transactabilityScore: transactabilityScore,
      transactability: transactability,
      mkt: row[isoCol] || "",
      zone: row[zoneCol] || "",
      mw: mw,
      // ADD POI VOLTAGE TO PIPELINE ROW
      poiVoltage: poiVoltage,
      tech: row[techCol] || "",
      hr: hr,
      cf: cf,
      cod: cod,
      // CRITICAL: ADD M&A TIER TO PIPELINE ROW
      maTier: maTier,
      // CRITICAL: ADD ALL REDEVELOPMENT FIELDS TO PIPELINE ROW
      redevTier: redevTier,
      redevCapacity: redevCapacity,
      redevTech: redevTech,
      redevFuel: redevFuel,
      redevHeatrate: redevHeatrate,
      redevCOD: redevCODValue,
      redevLandControl: redevLandControl,
      redevStageGate: redevStageGate,
      redevLead: redevLead,
      redevSupport: redevSupport,
      redevBaseCase: redevBaseCase,
      projectType: projectType,
      // Add calculated status
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
  }).filter(row => row.asset && row.asset.trim() !== "");

  setPipelineRows(pipelineData);
};

export const calculateAllData = (jsonData, headers, setters) => {
  const {
    setKpiRow1, setKpiRow2, setIsoData, setTechData, 
    setRedevelopmentTypes, setCounterparties, setPipelineRows
  } = setters;

  if (!jsonData || jsonData.length === 0) {
    setKpiRow1([]);
    setKpiRow2([]);
    setIsoData([]);
    setTechData([]);
    setRedevelopmentTypes([]);
    setCounterparties([]);
    setPipelineRows([]);
    return;
  }

  const findColumnIndex = (patterns) => {
    for (const pattern of patterns) {
      const index = headers.findIndex(header => 
        header && header.toString().toLowerCase().includes(pattern.toLowerCase())
      );
      if (index !== -1) {
        console.log(`Found column for pattern "${pattern}": ${headers[index]} at index ${index}`);
        return index;
      }
    }
    console.log(`No column found for patterns: ${patterns.join(', ')}`);
    return -1;
  };

  // DEBUG: Log all headers
  console.log('=== CALCULATIONS DEBUG ===');
  console.log('All headers:', headers);
  console.log('First row sample:', jsonData[0]);

  // Add this line to the column definitions in calculateAllData function
  const transmissionCol = findColumnIndex(["transmission data", "transmission"]) !== -1 ? headers[findColumnIndex(["transmission data", "transmission"])] : "Transmission Data";
  
  // CRITICAL: Add Transactability column mappings
  const transactabilityScoresCol = findColumnIndex(["transactability scores", "transactability score"]) !== -1 ? headers[findColumnIndex(["transactability scores", "transactability score"])] : "Transactability Scores";
  const transactabilityCol = findColumnIndex(["transactability", "transactionality"]) !== -1 ? headers[findColumnIndex(["transactability", "transactionality"])] : "Transactability";
  
  // CRITICAL: ADD POI VOLTAGE COLUMN MAPPING
  const poiVoltageCol = findColumnIndex(["poi voltage", "poi_voltage", "voltage", "kv"]) !== -1 ? headers[findColumnIndex(["poi voltage", "poi_voltage", "voltage", "kv"])] : "POI Voltage (KV)";
  
  const projectNameCol = findColumnIndex(["project name"]) !== -1 ? headers[findColumnIndex(["project name"])] : "Project Name";
  const capacityCol = findColumnIndex(["legacy nameplate capacity", "capacity", "mw"]) !== -1 ? headers[findColumnIndex(["legacy nameplate capacity", "capacity", "mw"])] : "Legacy Nameplate Capacity (MW)";
  const overallCol = findColumnIndex(["overall project score", "overall"]) !== -1 ? headers[findColumnIndex(["overall project score", "overall"])] : "Overall Project Score";
  const thermalCol = findColumnIndex(["thermal operating score", "thermal"]) !== -1 ? headers[findColumnIndex(["thermal operating score", "thermal"])] : "Thermal Operating Score";
  const redevCol = findColumnIndex(["redevelopment score", "redevelopment", "redev"]) !== -1 ? headers[findColumnIndex(["redevelopment score", "redevelopment", "redev"])] : "Redevelopment Score";
  const heatRateCol = findColumnIndex(["heat rate", "hr"]) !== -1 ? headers[findColumnIndex(["heat rate", "hr"])] : "Heat Rate (Btu/kWh)";
  
  // FIXED: Use Legacy COD instead of Plant COD for age calculations
  const legacyCodCol = findColumnIndex(["legacy cod", "cod", "commissioning year", "year", "legacy"]) !== -1 ? headers[findColumnIndex(["legacy cod", "cod", "commissioning year", "year", "legacy"])] : "Legacy COD";
  
  // Still find Plant COD for display purposes
  const plantCodCol = findColumnIndex(["plant cod", "plant  cod", "cod (plant)"]) !== -1 ? headers[findColumnIndex(["plant cod", "plant  cod", "cod (plant)"])] : "Plant COD";
  
  const processCol = findColumnIndex(["process", "bilateral", "p or b"]) !== -1 ? headers[findColumnIndex(["process", "bilateral", "p or b"])] : "Process (P) or Bilateral (B)";
  const isoCol = findColumnIndex(["iso"]) !== -1 ? headers[findColumnIndex(["iso"])] : "ISO";
  const techCol = findColumnIndex(["tech"]) !== -1 ? headers[findColumnIndex(["tech"])] : "Tech";
  const redevBaseCaseCol = findColumnIndex(["redevelopment base case"]) !== -1 ? headers[findColumnIndex(["redevelopment base case"])] : "Redevelopment Base Case";
  const ownerCol = findColumnIndex(["plant owner", "owner"]) !== -1 ? headers[findColumnIndex(["plant owner", "owner"])] : "Plant Owner";
  const locationCol = findColumnIndex(["location"]) !== -1 ? headers[findColumnIndex(["location"])] : "Location";
  const zoneCol = findColumnIndex(["zone/submarket", "zone"]) !== -1 ? headers[findColumnIndex(["zone/submarket", "zone"])] : "Zone/Submarket";
  const cfCol = findColumnIndex(["2024 capacity factor", "capacity factor", "cf"]) !== -1 ? headers[findColumnIndex(["2024 capacity factor", "capacity factor", "cf"])] : "2024 Capacity Factor";
  const projectCodenameCol = findColumnIndex(["project codename"]) !== -1 ? headers[findColumnIndex(["project codename"])] : "Project Codename";
  const redevLoadCol = findColumnIndex(["redevelopment (load) score"]) !== -1 ? headers[findColumnIndex(["redevelopment (load) score"])] : "Redevelopment (Load) Score";
  const icScoreCol = findColumnIndex(["i&c score"]) !== -1 ? headers[findColumnIndex(["i&c score"])] : "I&C Score";
  const numberOfSitesCol = findColumnIndex(["number of sites"]) !== -1 ? headers[findColumnIndex(["number of sites"])] : "Number of Sites";
  const gasReferenceCol = findColumnIndex(["gas reference"]) !== -1 ? headers[findColumnIndex(["gas reference"])] : "Gas Reference";
  const contactCol = findColumnIndex(["contact"]) !== -1 ? headers[findColumnIndex(["contact"])] : "Contact";
  const siteAcreageCol = findColumnIndex(["site acreage"]) !== -1 ? headers[findColumnIndex(["site acreage"])] : "Site Acreage";
  const fuelCol = findColumnIndex(["fuel"]) !== -1 ? headers[findColumnIndex(["fuel"])] : "Fuel";
  const redevCodCol = findColumnIndex(["redev cod"]) !== -1 ? headers[findColumnIndex(["redev cod"])] : "Redev COD";
  const marketsCol = findColumnIndex(["markets"]) !== -1 ? headers[findColumnIndex(["markets"])] : "Markets";
  const thermalOptimizationCol = findColumnIndex(["thermal optimization"]) !== -1 ? headers[findColumnIndex(["thermal optimization"])] : "Thermal Optimization";
  const environmentalScoreCol = findColumnIndex(["envionmental score", "environmental score"]) !== -1 ? headers[findColumnIndex(["envionmental score", "environmental score"])] : "Environmental Score";
  const marketScoreCol = findColumnIndex(["market score"]) !== -1 ? headers[findColumnIndex(["market score"])] : "Market Score";
  const infraCol = findColumnIndex(["infra"]) !== -1 ? headers[findColumnIndex(["infra"])] : "Infra";
  const ixCol = findColumnIndex(["ix"]) !== -1 ? headers[findColumnIndex(["ix"])] : "IX";
  const coLocateRepowerCol = findColumnIndex(["co-locate/repower", "co-locate", "repower"]) !== -1 ? headers[findColumnIndex(["co-locate/repower", "co-locate", "repower"])] : "Co-Locate/Repower";
  const transactibilityCol = findColumnIndex(["transactibility"]) !== -1 ? headers[findColumnIndex(["transactibility"])] : "Transactibility";
  
  // CRITICAL: Add all redevelopment column mappings
  const redevTierCol = findColumnIndex(["redev tier", "tier"]) !== -1 ? headers[findColumnIndex(["redev tier", "tier"])] : "Redev Tier";
  const redevCapacityCol = findColumnIndex(["redev capacity", "capacity (mw)"]) !== -1 ? headers[findColumnIndex(["redev capacity", "capacity (mw)"])] : "Redev Capacity (MW)";
  const redevTechCol = findColumnIndex(["redev tech"]) !== -1 ? headers[findColumnIndex(["redev tech"])] : "Redev Tech";
  const redevFuelCol = findColumnIndex(["redev fuel"]) !== -1 ? headers[findColumnIndex(["redev fuel"])] : "Redev Fuel";
  const redevHeatrateCol = findColumnIndex(["redev heatrate"]) !== -1 ? headers[findColumnIndex(["redev heatrate"])] : "Redev Heatrate (Btu/kWh)";
  const redevLandControlCol = findColumnIndex(["redev land control"]) !== -1 ? headers[findColumnIndex(["redev land control"])] : "Redev Land Control";
  const redevStageGateCol = findColumnIndex(["redev stage gate"]) !== -1 ? headers[findColumnIndex(["redev stage gate"])] : "Redev Stage Gate";
  const redevLeadCol = findColumnIndex(["redev lead"]) !== -1 ? headers[findColumnIndex(["redev lead"])] : "Redev Lead";
  const redevSupportCol = findColumnIndex(["redev support"]) !== -1 ? headers[findColumnIndex(["redev support"])] : "Redev Support";
  const projectTypeCol = findColumnIndex(["project type"]) !== -1 ? headers[findColumnIndex(["project type"])] : "Project Type";
  
  // CRITICAL: ADD M&A Tier column mapping
  const maTierCol = findColumnIndex(["m&a tier", "ma tier", "ma_tier", "maTier"]) !== -1 ? headers[findColumnIndex(["m&a tier", "ma tier", "ma_tier", "maTier"])] : "M&A Tier";
  
  const allColumns = {
    projectNameCol, capacityCol, overallCol, thermalCol, redevCol,
    heatRateCol, legacyCodCol, plantCodCol, processCol, isoCol, techCol, redevBaseCaseCol,
    ownerCol, locationCol, zoneCol, cfCol, projectCodenameCol, redevLoadCol,
    icScoreCol, numberOfSitesCol, gasReferenceCol, contactCol, siteAcreageCol,
    fuelCol, redevCodCol, marketsCol, thermalOptimizationCol, environmentalScoreCol,
    marketScoreCol, infraCol, ixCol, coLocateRepowerCol, transactibilityCol,
    transmissionCol, // Add this line to include transmission data column
    // CRITICAL: Add Transactability columns
    transactabilityScoresCol,
    transactabilityCol,
    // CRITICAL: ADD POI VOLTAGE COLUMN
    poiVoltageCol,
    // CRITICAL: Add all redevelopment columns
    redevTierCol,
    redevCapacityCol,
    redevTechCol,
    redevFuelCol,
    redevHeatrateCol,
    redevLandControlCol,
    redevStageGateCol,
    redevLeadCol,
    redevSupportCol,
    projectTypeCol,
    // CRITICAL: ADD M&A Tier column
    maTierCol: maTierCol
  };

  
  calculateKPIs(jsonData, {
    projectNameCol, capacityCol, overallCol, thermalCol, redevCol,
    heatRateCol, 
    codCol: legacyCodCol, 
    processCol
  }, setKpiRow1, setKpiRow2);

  calculateIsoData(jsonData, isoCol, capacityCol, setIsoData);
  calculateTechData(jsonData, techCol, capacityCol, setTechData);
  calculateRedevelopmentTypes(jsonData, redevBaseCaseCol, setRedevelopmentTypes);
  calculateCounterpartyData(jsonData, ownerCol, overallCol, capacityCol, setCounterparties);
  calculatePipelineData(jsonData, allColumns, setPipelineRows);
};