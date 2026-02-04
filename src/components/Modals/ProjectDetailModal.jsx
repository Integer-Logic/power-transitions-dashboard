import React, { useState } from 'react';
import { scoringWeights } from '../../constants/scoringWeights';

const ProjectDetailModal = ({ selectedProject, closeProjectDetail }) => {
  if (!selectedProject) return null;

  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [activeTooltipType, setActiveTooltipType] = useState(null);

  const detailData = selectedProject.detailData || {};

 
  const isPresent = (v) => {
    if (v === 0) return true;       
    if (v === false) return true;    
    if (v === undefined || v === null) return false;
    if (typeof v === 'number' && Number.isNaN(v)) return false;
    if (typeof v === 'string' && v.trim() === '') return false;
    return true;
  };

   const getLoose = (obj, key) => {
    if (!obj || !key) return undefined;

    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const v = obj[key];
      if (isPresent(v)) return v;
    }

    const variants = [`${key}\n`, `${key}\r`, `${key}\r\n`];
    for (const k of variants) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const v = obj[k];
        if (isPresent(v)) return v;
      }
    }

    const wanted = String(key).trim().toLowerCase();
    const matches = Object.keys(obj).filter(
      (k) => String(k).trim().toLowerCase() === wanted
    );

    for (const mk of matches) {
      const v = obj[mk];
      if (isPresent(v)) return v;
    }

    return undefined;
  };

  const ns = <span style={{ color: '#999', fontStyle: 'italic' }}>Not specified</span>;

  // Helper function to parse transmission data
  const parseTransmissionData = (transmissionStr) => {
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

  // Safely get transmissionData - check multiple possible locations
  const transmissionData = selectedProject.transmissionData ||
    parseTransmissionData(detailData["Transmission Data"] || "") ||
    [];

  // Extract weights
  const thermalWeights = scoringWeights.thermal;
  const redevWeights = scoringWeights.redevelopment;

  // Criteria definitions from your Excel
  const criteriaDefinitions = {
    // Thermal Operating Criteria
    "Plant COD": {
      weight: 0.2,
      maxScore: 3,
      criteria: [
        { score: 3, description: "COD Year < 2000" },
        { score: 2, description: "COD Year 2000-2005" },
        { score: 1, description: "COD Year > 2005" }
      ]
    },
    "Markets": {
      weight: 0.3,
      maxScore: 3,
      criteria: [
        { score: 3, description: "PJM, NYISO, ISO-NE" },
        { score: 2, description: "MISO North, SERC" },
        { score: 1, description: "SPP, MISO South" },
        { score: 0, description: "ERCOT, WECC, CAISO" }
      ]
    },
    "Transactability": {
      weight: 0.3,
      maxScore: 3,
      criteria: [
        { score: 3, description: "Bilateral w/ developed relationship" },
        { score: 2, description: "Bilateral w/ new relationship OR Process w/ <10 bidders" },
        { score: 1, description: "Highly Competitive Process (>10 bidders)" }
      ]
    },
    "Thermal Optimization": {
      weight: 0.05,
      maxScore: 2,
      criteria: [
        { score: 2, description: "Readily apparent value add" },
        { score: 1, description: "No readily identifiable value add" }
      ]
    },
    "Environmental": {
      weight: 0.15,
      maxScore: 3,
      criteria: [
        { score: 3, description: "Known, mitigable liabilities with PT cost advantage" },
        { score: 2, description: "Known, mitigable liabilities without PT cost advantage" },
        { score: 1, description: "Environmental liabilities not known" },
        { score: 0, description: "Known, non-mitigable liabilities" }
      ]
    },
    // Redevelopment Criteria
    "Market": {
      weight: 0.4,
      maxScore: 3,
      criteria: [
        { score: 3, description: "Primary market" },
        { score: 2, description: "Secondary market" },
        { score: 1, description: "Uncertain market" },
        { score: 0, description: "Challenging market" }
      ]
    },
    "Infra": {
      weight: 0.3,
      maxScore: 3,
      criteria: [
        { score: 3, description: "Sufficient land onsite for all development" },
        { score: 2, description: "Some land onsite + available parcel nearby" },
        { score: 1, description: "No land onsite, but available nearby" },
        { score: 0, description: "No land onsite or offsite nearby" }
      ]
    },
    "IX": {
      weight: 0.3,
      maxScore: 3,
      criteria: [
        { score: 3, description: "Secured IX Rights" },
        { score: 2, description: "No network/POI upgrades needed (Unsecured)" },
        { score: 1, description: "Minimal network/POI upgrades needed (Unsecured)" },
        { score: 0, description: "Major network/POI upgrades needed (Unsecured)" }
      ]
    }
  };

  // Helper to get criteria explanation
  const getCriteriaExplanation = (label, score) => {
    const criteria = criteriaDefinitions[label];
    if (!criteria) return "No criteria available";

    const matchedCriterion = criteria.criteria.find(c => c.score === parseInt(score));
    return matchedCriterion ? matchedCriterion.description : "Score not defined in criteria";
  };

  // Tooltip handlers
  const handleScoreHover = (e, item, type) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const explanation = getCriteriaExplanation(item.label, item.score);
    const contribution = (parseFloat(item.score) * item.weight).toFixed(2);

    setTooltipContent({
      title: item.label,
      score: `${item.score}/${criteriaDefinitions[item.label]?.maxScore || 3}`,
      explanation,
      weight: `${(item.weight * 100)}%`,
      contribution: `${contribution} points`,
      fullCriteria: criteriaDefinitions[item.label]?.criteria || []
    });

    setTooltipPosition({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY - 10
    });

    setActiveTooltipType(type);
  };

  const handleWeightHover = (e, item, type) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const maxScore = criteriaDefinitions[item.label]?.maxScore || 3;
    const maxContribution = (maxScore * item.weight).toFixed(2);

    setTooltipContent({
      title: `${item.label} Weight`,
      weight: `${(item.weight * 100)}%`,
      maxScore: maxScore,
      maxContribution: `${maxContribution} points`,
      impact: `Each point contributes ${(item.weight * 100).toFixed(0)}% to total score`
    });

    setTooltipPosition({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY - 10
    });

    setActiveTooltipType(type);
  };

  const handleMouseLeave = () => {
    setTooltipContent(null);
    setActiveTooltipType(null);
  };

  // Helper function to clean transactability score from Excel data
  const cleanTransactabilityScore = (value) => {
    if (!value && value !== 0) return "0";

    const stringValue = value.toString().trim();

    // Handle #N/A values
    if (stringValue === '#N/A' || stringValue === 'N/A' || stringValue === '#VALUE!') {
      return "0";
    }

    // Try to convert to number
    const numericValue = parseFloat(stringValue);
    return isNaN(numericValue) ? "0" : numericValue.toString();
  };

  // Helper to display score - shows actual value (including 0) or "N/A" for missing
  // Returns "N/A" for null/missing values to propagate N/A through UI
  const displayScore = (...values) => {
    for (const val of values) {
      // Explicitly handle 0 as valid (not missing)
      if (val === 0 || val === "0") return "0";
      // Check for null/undefined/empty - return N/A
      if (val === null || val === undefined) continue;
      // Check for string N/A values
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === "" || trimmed === "#N/A" || trimmed === "N/A" || trimmed === "#VALUE!") continue;
      }
      // Try to parse as number
      const num = parseFloat(val);
      if (!isNaN(num)) return String(num);
    }
    return "N/A"; // Missing data - N/A propagation
  };

  // Helper to format score display with N/A handling
  const formatScoreValue = (value, decimals = 1, maxScore = 3.0) => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed === "N/A" || trimmed === "#N/A") return "N/A";
    }
    const num = parseFloat(value);
    if (isNaN(num)) return "N/A";
    return `${num.toFixed(decimals)}/${maxScore}`;
  };

  // Thermal Operating Score entries - FIXED: Transactability now uses correct column
  const thermalEntries = [
    {
      label: "Plant COD",
      score: displayScore(detailData["Plant COD"], detailData["Legacy COD"]),
      weight: thermalWeights.unit_cod,
      displayWeight: "20%"
    },
    {
      label: "Markets",
      score: displayScore(detailData["Markets"]),
      weight: thermalWeights.markets,
      displayWeight: "30%"
    },
    {
      label: "Transactability",
      // FIX: Use "Transactability Scores" column (AH) not "Transactibility"
      score: displayScore(cleanTransactabilityScore(detailData["Transactability Scores"])),
      weight: thermalWeights.transactability,
      displayWeight: "30%"
    },
    {
      label: "Thermal Optimization",
      score: displayScore(detailData["Thermal Optimization"]),
      weight: thermalWeights.thermal_optimization,
      displayWeight: "5%"
    },
    {
      label: "Environmental",
      score: displayScore(detailData["Environmental Score"]),
      weight: thermalWeights.environmental,
      displayWeight: "15%"
    }
  ];

  // Redevelopment Score entries
  const redevEntries = [
    {
      label: "Market",
      score: displayScore(detailData["Market Score"]),
      weight: redevWeights.market,
      displayWeight: "40%"
    },
    {
      label: "Infra",
      score: displayScore(detailData["Infra"]),
      weight: redevWeights.infra,
      displayWeight: "30%"
    },
    {
      label: "IX",
      score: displayScore(detailData["IX"]),
      weight: redevWeights.ix,
      displayWeight: "30%"
    }
  ];

  return (
    <>
      {/* Tooltip Component */}
      {tooltipContent && (
        <div
          className="score-tooltip"
          style={{
            position: 'absolute',
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translateY(-100%)',
            zIndex: 9999
          }}
          onMouseEnter={() => { }} // Keep tooltip open when hovering over it
          onMouseLeave={handleMouseLeave}
        >
          <div className="tooltip-content">
            <div className="tooltip-header">
              <span className="tooltip-title">{tooltipContent.title}</span>
              {tooltipContent.score && (
                <span className="tooltip-score">{tooltipContent.score}</span>
              )}
            </div>

            {activeTooltipType === 'score' && (
              <>
                <div className="tooltip-section">
                  <div className="tooltip-row">
                    <span className="tooltip-label">Criteria Met:</span>
                    <span className="tooltip-value">{tooltipContent.explanation}</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="tooltip-label">Weight:</span>
                    <span className="tooltip-value">{tooltipContent.weight}</span>
                  </div>
                  <div className="tooltip-row">
                    <span className="tooltip-label">Contribution:</span>
                    <span className="tooltip-value highlight">{tooltipContent.contribution}</span>
                  </div>
                </div>

                {tooltipContent.fullCriteria.length > 0 && (
                  <div className="tooltip-section criteria-section">
                    <div className="tooltip-subtitle">Scoring Criteria</div>
                    {tooltipContent.fullCriteria.map((crit, idx) => (
                      <div key={idx} className="criteria-row">
                        <span className="criteria-score">{crit.score} pt{crit.score !== 1 ? 's' : ''}:</span>
                        <span className="criteria-desc">{crit.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTooltipType === 'weight' && (
              <div className="tooltip-section">
                <div className="tooltip-row">
                  <span className="tooltip-label">Weight:</span>
                  <span className="tooltip-value">{tooltipContent.weight}</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">Max Possible Score:</span>
                  <span className="tooltip-value">{tooltipContent.maxScore} points</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">Max Contribution:</span>
                  <span className="tooltip-value highlight">{tooltipContent.maxContribution}</span>
                </div>
                <div className="tooltip-row">
                  <span className="tooltip-label">Impact:</span>
                  <span className="tooltip-value">{tooltipContent.impact}</span>
                </div>
              </div>
            )}

            <div className="tooltip-footer">
              <span className="tooltip-hint">Hover over weight for different view</span>
            </div>
          </div>
          <div className="tooltip-arrow"></div>
        </div>
      )}

      <div className="modal-overlay" onClick={closeProjectDetail}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">{selectedProject.asset} - Project Details</h2>
            <button className="modal-close" onClick={closeProjectDetail}>×</button>
          </div>

          <div className="modal-body">
            <div className="project-detail-grid">
              <div className="detail-section">
                <h3 className="detail-section-title">Basic Information</h3>
                <div className="detail-grid">
                  {detailData["Project Name"] && (
                    <div className="detail-item">
                      <span className="detail-label">Project Name:</span>
                      <span className="detail-value">{detailData["Project Name"]}</span>
                    </div>
                  )}
                  {detailData["Project Codename"] && (
                    <div className="detail-item">
                      <span className="detail-label">Project Codename:</span>
                      <span className="detail-value">{detailData["Project Codename"]}</span>
                    </div>
                  )}
                  {detailData["Plant Owner"] && (
                    <div className="detail-item">
                      <span className="detail-label">Plant Owner:</span>
                      <span className="detail-value">{detailData["Plant Owner"]}</span>
                    </div>
                  )}
                  {detailData["Location"] && (
                    <div className="detail-item">
                      <span className="detail-label">Location:</span>
                      <span className="detail-value">{detailData["Location"]}</span>
                    </div>
                  )}
                  {detailData["Site Acreage"] && (
                    <div className="detail-item">
                      <span className="detail-label">Site Acreage:</span>
                      <span className="detail-value">{detailData["Site Acreage"]}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3 className="detail-section-title">Project Scores</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Overall Project Score:</span>
                    {(() => {
                      const score = detailData["Overall Project Score"] ?? detailData["Calculated Overall"];
                      const displayVal = formatScoreValue(score, 1, 6.0);
                      return displayVal === "N/A" ? (
                        <span className="detail-value badge" style={{ backgroundColor: '#6b7280', color: '#e5e7eb' }}>N/A</span>
                      ) : (
                        <span className="detail-value badge badge-green">{displayVal}</span>
                      );
                    })()}
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Thermal Operating Score:</span>
                    {(() => {
                      const score = detailData["Thermal Operating Score"] ?? detailData["Calculated Thermal"];
                      const displayVal = formatScoreValue(score, 1, 3.0);
                      return displayVal === "N/A" ? (
                        <span className="detail-value badge" style={{ backgroundColor: '#6b7280', color: '#e5e7eb' }}>N/A</span>
                      ) : (
                        <span className="detail-value badge badge-red">{displayVal}</span>
                      );
                    })()}
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Redevelopment Score:</span>
                    {(() => {
                      const score = detailData["Redevelopment Score"] ?? detailData["Calculated Redevelopment"];
                      const displayVal = formatScoreValue(score, 1, 3.0);
                      return displayVal === "N/A" ? (
                        <span className="detail-value badge" style={{ backgroundColor: '#6b7280', color: '#e5e7eb' }}>N/A</span>
                      ) : (
                        <span className="detail-value badge badge-teal">{displayVal}</span>
                      );
                    })()}
                  </div>
                  {detailData["Redevelopment (Load) Score"] && (
                    <div className="detail-item">
                      <span className="detail-label">Redevelopment (Load) Score:</span>
                      <span className="detail-value">{detailData["Redevelopment (Load) Score"]}</span>
                    </div>
                  )}
                  {detailData["I&C Score"] && (
                    <div className="detail-item">
                      <span className="detail-label">I&C Score:</span>
                      <span className="detail-value">{detailData["I&C Score"]}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Thermal Operating Scores with Tooltips */}
              <div className="detail-section score-section">
                <div className="expert-scores-header">
                  <h3 className="detail-section-title">Thermal Operating Scores</h3>
                  <h3 className="weight-header">Weight</h3>
                </div>
                <div className="expert-scores-grid">
                  {thermalEntries.map((item, index) => (
                    <div key={index} className="expert-score-row">
                      <div className="expert-score-left">
                        <span className="expert-score-label">
                          {item.label}:
                          {/* Info icon moved to appear as superscript after the colon */}
                          <sup
                            className="info-icon-superscript tooltip-trigger"
                            onMouseEnter={(e) => handleScoreHover(e, item, 'score')}
                            onMouseLeave={handleMouseLeave}
                            style={{
                              cursor: 'help',
                              marginLeft: '4px',
                              fontSize: '12px',
                              opacity: 0.6,
                              verticalAlign: 'super'
                            }}
                          >
                            ⓘ
                          </sup>
                        </span>
                        <span className="expert-score-value">
                          {item.score}
                        </span>
                      </div>
                      <div className="expert-score-right">
                        <span className="expert-score-weight">
                          {item.displayWeight}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Redevelopment Scores with Tooltips */}
              <div className="detail-section score-section">
                <div className="expert-scores-header">
                  <h3 className="detail-section-title">Redevelopment Scores</h3>
                  <h3 className="weight-header">Weight</h3>
                </div>
                <div className="expert-scores-grid">
                  {redevEntries.map((item, index) => (
                    <div key={index} className="expert-score-row">
                      <div className="expert-score-left">
                        <span className="expert-score-label">
                          {item.label}:
                          <sup
                            className="info-icon-superscript tooltip-trigger"
                            onMouseEnter={(e) => handleScoreHover(e, item, 'score')}
                            onMouseLeave={handleMouseLeave}
                            style={{
                              cursor: 'help',
                              marginLeft: '4px',
                              fontSize: '12px',
                              opacity: 0.6,
                              verticalAlign: 'super'
                            }}
                          >
                            ⓘ
                          </sup>
                        </span>
                        <span className="expert-score-value">
                          {item.score}
                        </span>
                      </div>
                      <div className="expert-score-right">
                        <span className="expert-score-weight">
                          {item.displayWeight}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3 className="detail-section-title">Technical Details</h3>
                <div className="detail-grid">
                  {detailData["Legacy Nameplate Capacity (MW)"] && (
                    <div className="detail-item">
                      <span className="detail-label">Capacity:</span>
                      <span className="detail-value">{detailData["Legacy Nameplate Capacity (MW)"]} MW</span>
                    </div>
                  )}
                  {detailData["Tech"] && (
                    <div className="detail-item">
                      <span className="detail-label">Technology:</span>
                      <span className="detail-value tag tag-yellow">{detailData["Tech"]}</span>
                    </div>
                  )}
                  {detailData["Heat Rate (Btu/kWh)"] && (
                    <div className="detail-item">
                      <span className="detail-label">Heat Rate:</span>
                      <span className="detail-value">{detailData["Heat Rate (Btu/kWh)"]} Btu/kWh</span>
                    </div>
                  )}
                  {detailData["2024 Capacity Factor"] && (
                    <div className="detail-item">
                      <span className="detail-label">Capacity Factor:</span>
                      <span className="detail-value">{detailData["2024 Capacity Factor"]}</span>
                    </div>
                  )}
                  {detailData["Legacy COD"] && (
                    <div className="detail-item">
                      <span className="detail-label">Legacy COD Year:</span>
                      <span className="detail-value">{detailData["Legacy COD"]}</span>
                    </div>
                  )}
                  {detailData["Plant COD"] && (
                    <div className="detail-item">
                      <span className="detail-label">Plant COD Score:</span>
                      <span className="detail-value">{detailData["Plant COD"]}</span>
                    </div>
                  )}
                  {detailData["Fuel"] && (
                    <div className="detail-item">
                      <span className="detail-label">Fuel:</span>
                      <span className="detail-value">{detailData["Fuel"]}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3 className="detail-section-title">Market Details</h3>
                <div className="detail-grid">
                  {detailData["ISO"] && (
                    <div className="detail-item">
                      <span className="detail-label">ISO/RTO:</span>
                      <span className="detail-value tag tag-dark">{detailData["ISO"]}</span>
                    </div>
                  )}
                  {detailData["Zone/Submarket"] && (
                    <div className="detail-item">
                      <span className="detail-label">Zone/Submarket:</span>
                      <span className="detail-value">{detailData["Zone/Submarket"]}</span>
                    </div>
                  )}
                  {detailData["Markets"] && (
                    <div className="detail-item">
                      <span className="detail-label">Markets:</span>
                      <span className="detail-value">{detailData["Markets"]}</span>
                    </div>
                  )}
                  {detailData["Gas Reference"] && (
                    <div className="detail-item">
                      <span className="detail-label">Gas Reference:</span>
                      <span className="detail-value">{detailData["Gas Reference"]}</span>
                    </div>
                  )}
                  {detailData["Process (P) or Bilateral (B)"] && (
                    <div className="detail-item">
                      <span className="detail-label">Process Type:</span>
                      <span className="detail-value">{detailData["Process (P) or Bilateral (B)"]}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ Redevelopment: FIXED (uses getLoose + isPresent) */}
              <div className="detail-section">
                <h3 className="detail-section-title">Redevelopment</h3>
                <div className="detail-grid">

                  <div className="detail-item full-width">
                    <span className="detail-label">Redevelopment Base Case:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redevelopment Base Case")) ? getLoose(detailData, "Redevelopment Base Case") : ns}
                    </span>
                  </div>

                <div className="detail-item">
  <span className="detail-label">Redevelopment Tier:</span>
  <span className="detail-value">
    {(() => {
      // Use getLoose to find the value first
      const tierValue = getLoose(detailData, "Redev Tier");
      
      // Check if it's present (including 0)
      return isPresent(tierValue) ? tierValue : ns;
    })()}
  </span>
</div>

                  <div className="detail-item">
                    <span className="detail-label">Redevelopment Capacity:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev Capacity (MW)"))
                        ? `${getLoose(detailData, "Redev Capacity (MW)")} MW`
                        : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Redevelopment Technology:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev Tech")) ? getLoose(detailData, "Redev Tech") : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Redevelopment Fuel:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev Fuel")) ? getLoose(detailData, "Redev Fuel") : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Redevelopment Heat Rate:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev Heatrate (Btu/kWh)"))
                        ? `${getLoose(detailData, "Redev Heatrate (Btu/kWh)")} Btu/kWh`
                        : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Redevelopment COD:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev COD")) ? getLoose(detailData, "Redev COD") : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Land Control:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev Land Control")) ? getLoose(detailData, "Redev Land Control") : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Stage Gate:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev Stage Gate")) ? getLoose(detailData, "Redev Stage Gate") : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Redevelopment Lead:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev Lead")) ? getLoose(detailData, "Redev Lead") : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Redevelopment Support:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Redev Support")) ? getLoose(detailData, "Redev Support") : ns}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Co-Locate/Repower:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Co-Locate/Repower")) ? getLoose(detailData, "Co-Locate/Repower") : ns}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3 className="detail-section-title">Additional Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Contact:</span>
                    <span className="detail-value">
                      {isPresent(getLoose(detailData, "Contact")) ? getLoose(detailData, "Contact") : ns}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={closeProjectDetail}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* CSS Styles for Tooltips */}
      <style>{`
        .score-tooltip {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 280px;
          max-width: min(320px, calc(100vw - 40px));
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          pointer-events: none;
          z-index: 9999;
        }

        .tooltip-content {
          padding: 12px;
          font-size: 12px;
          line-height: 1.4;
        }

        .tooltip-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #f1f5f9;
        }

        .tooltip-title {
          font-weight: 600;
          font-size: 13px;
          color: #1e293b;
        }

        .tooltip-score {
          font-weight: 600;
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
        }

        .tooltip-section {
          margin-bottom: 8px;
        }

        .tooltip-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          flex-wrap: wrap;
          gap: 4px;
        }

        .tooltip-label {
          color: #64748b;
          font-weight: 500;
        }

        .tooltip-value {
          color: #1e293b;
          text-align: right;
          max-width: 180px;
          word-break: break-word;
        }

        .tooltip-value.highlight {
          font-weight: 600;
          color: #059669;
        }

        .tooltip-subtitle {
          font-weight: 600;
          color: #475569;
          margin: 6px 0 4px 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .criteria-section {
          background: #f8fafc;
          border-radius: 4px;
          padding: 8px;
          margin-top: 8px;
        }

        .criteria-row {
          display: flex;
          margin-bottom: 3px;
          font-size: 11px;
          flex-wrap: wrap;
        }

        .criteria-score {
          font-weight: 600;
          color: #475569;
          min-width: 40px;
        }

        .criteria-desc {
          color: #64748b;
          flex: 1;
          min-width: 150px;
        }

        .tooltip-footer {
          margin-top: 8px;
          padding-top: 6px;
          border-top: 1px solid #f1f5f9;
          font-size: 10px;
          color: #94a3b8;
          text-align: center;
        }

        .tooltip-arrow {
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid white;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
        }

        .tooltip-arrow::before {
          content: '';
          position: absolute;
          top: -7px;
          left: -6px;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid #e2e8f0;
          z-index: -1;
        }

        .tooltip-trigger:hover .info-icon-superscript {
          opacity: 1 !important;
        }

        .info-icon-superscript {
          transition: all 0.2s ease;
        }

        .expert-score-value, .expert-score-weight {
          transition: all 0.2s ease;
        }

        .tooltip-trigger:hover {
          text-decoration: none;
        }

        /* Responsive tooltip positioning */
        @media (max-width: 768px) {
          .score-tooltip {
            min-width: 240px;
            max-width: calc(100vw - 32px);
            font-size: 11px;
          }

          .tooltip-content {
            padding: 10px;
          }

          .tooltip-title {
            font-size: 12px;
          }

          .tooltip-value {
            max-width: 140px;
          }

          .criteria-desc {
            min-width: 120px;
          }
        }

        @media (max-width: 480px) {
          .score-tooltip {
            position: fixed !important;
            left: 16px !important;
            right: 16px !important;
            bottom: 80px !important;
            top: auto !important;
            transform: none !important;
            max-width: none;
            min-width: auto;
          }

          .tooltip-arrow {
            display: none;
          }

          .tooltip-content {
            padding: 12px;
          }

          .tooltip-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .tooltip-value {
            text-align: left;
            max-width: none;
          }

          .info-icon-superscript {
            font-size: 14px !important;
            padding: 4px;
          }
        }

        /* Touch device hover alternative */
        @media (hover: none) and (pointer: coarse) {
          .info-icon-superscript {
            font-size: 16px !important;
            padding: 8px;
            margin-left: 8px !important;
            cursor: pointer;
          }
        }
      `}</style>
    </>
  );
};

export default ProjectDetailModal;
