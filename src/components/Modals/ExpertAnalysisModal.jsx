import React, { useState, useEffect, useRef, useCallback } from 'react';
import { calculateThermalScore, calculateRedevelopmentScore, calculateOverallScore, formatScoreDisplay } from '../../utils/scoreCalculations';

const ExpertAnalysisModal = ({ 
  selectedExpertProject, 
  setSelectedExpertProject,
  currentUser = "PowerTrans Team",
  authToken = null,
  fetchExpertAnalysis,
  saveExpertAnalysis,
  fetchTransmissionInterconnection,
  saveTransmissionInterconnection
}) => {
  if (!selectedExpertProject) return null;
  
  // Stable references
  const projectRef = useRef(selectedExpertProject);
  const isInitialLoad = useRef(true);
  const originalAnalysisRef = useRef(null);
  const originalTransmissionRef = useRef([]);
  const transmissionInputRefs = useRef({});
  
  // Track if we need to refresh data on next mount
  const lastProjectIdRef = useRef(null);
  
  // Generate default analysis
  const generateDefaultAnalysis = useCallback((project) => {
    const getNumericValue = (value, defaultValue = 0) => {
      if (value === undefined || value === null) return defaultValue;
      const num = parseFloat(value);
      return isNaN(num) ? defaultValue : num;
    };

    // Helper to get integer value from project data, allowing 0
    const getIntValue = (value, defaultValue) => {
      if (value === undefined || value === null || value === '') return defaultValue;
      const num = parseInt(value);
      return isNaN(num) ? defaultValue : num;
    };

    const overallScore = getNumericValue(
      project.expertAnalysis?.overallScore ||
      (project.overall !== undefined && project.overall !== 0 ? project.overall : null) ||
      project.detailData?.["Calculated Overall"] ||
      project.detailData?.["Overall Project Score"] ||
      project.detailData?.overall_project_score,
      0
    ).toFixed(1);

    const thermalScore = getNumericValue(
      project.expertAnalysis?.thermalScore ||
      (project.thermal !== undefined && project.thermal !== 0 ? project.thermal : null) ||
      project.detailData?.["Calculated Thermal"] ||
      project.detailData?.["Thermal Operating Score"] ||
      project.detailData?.thermal_operating_score,
      0
    ).toFixed(1);

    const redevelopmentScore = getNumericValue(
      project.expertAnalysis?.redevelopmentScore ||
      (project.redev !== undefined && project.redev !== 0 ? project.redev : null) ||
      project.detailData?.["Calculated Redevelopment"] ||
      project.detailData?.["Redevelopment Score"] ||
      project.detailData?.redevelopment_score,
      0
    ).toFixed(1);

    const projectName = project.expertAnalysis?.projectName ||
                       project.detailData?.["Project Name"] ||
                       project.detailData?.project_name ||
                       project.asset ||
                       `Project ${project.id || ""}`;

    const projectId = project.id || project.detailData?.id || "N/A";

    // Read breakdown values from project data (synced with Pipeline Details)
    // thermal_optimization minimum is 1, others can be 0
    const thermalOptValue = getIntValue(
      project.expertAnalysis?.thermalBreakdown?.thermal_optimization?.score ??
      project.detailData?.thermal_optimization ??
      project.detailData?.["Thermal Optimization"],
      1
    );
    // Ensure thermal optimization is at least 1
    const thermalOptScore = Math.max(1, thermalOptValue);

    const envScore = getIntValue(
      project.expertAnalysis?.thermalBreakdown?.environmental?.score ??
      project.detailData?.environmental_score ??
      project.detailData?.["Environmental Score"],
      2
    );

    const marketScore = getIntValue(
      project.expertAnalysis?.redevelopmentBreakdown?.redev_market?.score ??
      project.detailData?.market_score ??
      project.detailData?.["Market Score"],
      2
    );

    // Infrastructure score (infra) is the average of land_availability and utilities
    // When reading, we use infra value for both
    const infraValue = getNumericValue(
      project.expertAnalysis?.infrastructureScore ??
      project.detailData?.infra ??
      project.detailData?.["Infra"],
      2
    );

    const ixScore = getIntValue(
      project.expertAnalysis?.redevelopmentBreakdown?.interconnection?.score ??
      project.detailData?.ix ??
      project.detailData?.["IX"],
      2
    );

    // Additional values needed for Thermal Operating Score calculation (from Excel formula)
    // These are read-only values from the project, not editable in Expert Analysis
    const codScore = getIntValue(
      project.detailData?.plant_cod ??
      project.detailData?.["Plant  COD"],
      0
    );

    const capacityFactorScore = getIntValue(
      project.detailData?.capacity_factor ??
      project.detailData?.["Capacity Factor"],
      0
    );

    const marketsScore = getIntValue(
      project.detailData?.markets ??
      project.detailData?.["Markets"],
      0
    );

    const transactabilityScore = getIntValue(
      project.detailData?.transactability_scores ??
      project.detailData?.["Transactability Scores"],
      0
    );

    // Co-Locate/Repower determines multiplier for Redevelopment Score
    const coLocateRepower = (
      project.detailData?.co_locate_repower ??
      project.detailData?.["Co-Locate/Repower"] ??
      ""
    ).toString().trim();

    const defaultAnalysis = {
      overallScore: overallScore,
      overallRating: parseFloat(overallScore) >= 4.5 ? "Strong" :
                    parseFloat(overallScore) >= 3.0 ? "Moderate" : "Weak",
      ratingClass: parseFloat(overallScore) >= 4.5 ? "strong" :
                  parseFloat(overallScore) >= 3.0 ? "moderate" : "weak",
      thermalScore: thermalScore,
      redevelopmentScore: redevelopmentScore,
      projectName: projectName,
      projectId: projectId,
      thermalBreakdown: project.expertAnalysis?.thermalBreakdown || {
        thermal_optimization: { score: thermalOptScore },
        environmental: { score: envScore }
      },
      redevelopmentBreakdown: project.expertAnalysis?.redevelopmentBreakdown || {
        redev_market: { score: marketScore },
        land_availability: { score: Math.round(infraValue) },
        utilities: { score: Math.round(infraValue) },
        interconnection: { score: ixScore }
      },
      infrastructureScore: infraValue.toFixed(2),
      confidence: project.expertAnalysis?.confidence || 75,
      // Additional fields for Excel formula calculation (read-only)
      codScore: codScore,
      capacityFactorScore: capacityFactorScore,
      marketsScore: marketsScore,
      transactabilityScore: transactabilityScore,
      coLocateRepower: coLocateRepower
    };

    return defaultAnalysis;
  }, []);

  // State
  const [token] = useState(authToken || localStorage.getItem('token') || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [editedTransmissionData, setEditedTransmissionData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(() => {
    const initialAnalysis = selectedExpertProject.expertAnalysis || generateDefaultAnalysis(selectedExpertProject);
    return initialAnalysis;
  });
  
  // Local state for transmission inputs
  const [localTransmissionData, setLocalTransmissionData] = useState([]);
  
  // API Base URL
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  // Get token
  const getAuthToken = useCallback(() => {
    return authToken || localStorage.getItem('token') || '';
  }, [authToken]);

  // Check if there are changes
  const hasChanges = useCallback(() => {
    if (!isEditing) return false;
    
    // Check analysis changes
    if (originalAnalysisRef.current && editedAnalysis) {
      const analysisChanged = JSON.stringify(originalAnalysisRef.current) !== JSON.stringify(editedAnalysis);
      if (analysisChanged) return true;
    }
    
    // Check transmission changes - use localTransmissionData
    if (originalTransmissionRef.current && localTransmissionData) {
      const transmissionChanged = JSON.stringify(originalTransmissionRef.current) !== JSON.stringify(localTransmissionData);
      if (transmissionChanged) return true;
    }
    
    return false;
  }, [isEditing, editedAnalysis, localTransmissionData]);

  // Refresh data
  const refreshAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const projectId = selectedExpertProject.id;
      
      if (!projectId) {
        return;
      }
      
      // Refresh expert analysis
      if (fetchExpertAnalysis) {
        const freshAnalysis = await fetchExpertAnalysis(projectId);
        
        if (freshAnalysis) {
          // Update analysis data
          setAnalysisData(prev => ({
            ...prev,
            ...freshAnalysis,
            thermalBreakdown: freshAnalysis.thermalBreakdown || prev.thermalBreakdown,
            redevelopmentBreakdown: freshAnalysis.redevelopmentBreakdown || prev.redevelopmentBreakdown
          }));
          
          // Update edited analysis if not in edit mode
          if (!isEditing) {
            setEditedAnalysis(prev => ({
              ...prev,
              ...freshAnalysis,
              thermalBreakdown: freshAnalysis.thermalBreakdown || prev?.thermalBreakdown,
              redevelopmentBreakdown: freshAnalysis.redevelopmentBreakdown || prev?.redevelopmentBreakdown
            }));
          }
          
          // Update original reference
          originalAnalysisRef.current = JSON.parse(JSON.stringify({
            ...(editedAnalysis || analysisData),
            ...freshAnalysis
          }));
        }
      }
      
      // Refresh transmission data using projectId for reliability
      if (fetchTransmissionInterconnection && projectId) {
        const freshTransmission = await fetchTransmissionInterconnection(projectId, true);

        if (freshTransmission && Array.isArray(freshTransmission)) {
          setEditedTransmissionData(freshTransmission);
          setLocalTransmissionData(freshTransmission);

          // Update original reference
          originalTransmissionRef.current = JSON.parse(JSON.stringify(freshTransmission));
        }
      }
      
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedExpertProject, fetchExpertAnalysis, fetchTransmissionInterconnection, isEditing, analysisData, editedAnalysis]);

  // Fetch expert analysis
  const fetchExpertAnalysisData = useCallback(async () => {
    try {
      setIsLoading(true);
      const projectId = selectedExpertProject.id;
      
      if (!projectId) {
        return null;
      }
      
      if (fetchExpertAnalysis) {
        try {
          const data = await fetchExpertAnalysis(projectId);
          if (data) {
            return data;
          }
        } catch (error) {
          console.warn('Fetch expert analysis failed:', error);
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('Error fetching expert analysis:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [selectedExpertProject, fetchExpertAnalysis]);
  
  // Fetch transmission data
  const fetchTransmissionData = useCallback(async () => {
    try {
      const projectId = selectedExpertProject?.id ||
                       selectedExpertProject?.detailData?.id ||
                       selectedExpertProject?.expertAnalysis?.projectId;

      if (!projectId) {
        console.warn('No project ID found for transmission fetch');
        return [];
      }

      if (fetchTransmissionInterconnection) {
        try {
          // Use projectId for more reliable fetching
          const data = await fetchTransmissionInterconnection(projectId, true);

          if (data && Array.isArray(data)) {
            return data;
          }
        } catch (error) {
          console.warn('Transmission fetch failed:', error);
        }
      }

      return [];

    } catch (error) {
      console.error('Error fetching transmission data:', error);
      return [];
    }
  }, [selectedExpertProject, fetchTransmissionInterconnection]);
  
  // Initialize all data - FIXED: Reset state when project changes
  useEffect(() => {
    const initializeData = async () => {
      if (!selectedExpertProject) return;
      
      const currentProjectId = selectedExpertProject.id;
      
      // Reset states when project changes
      if (lastProjectIdRef.current !== currentProjectId) {
        setIsEditing(false);
        setSaveStatus(null);
        isInitialLoad.current = true;
        lastProjectIdRef.current = currentProjectId;
      }
      
      let dbAnalysis = await fetchExpertAnalysisData();
      let dbTransmission = await fetchTransmissionData();
      
      let initialAnalysis = generateDefaultAnalysis(selectedExpertProject);
      
      if (dbAnalysis) {
        // Merge DB analysis but preserve calculated scores if DB has 0/invalid values
        const dbOverall = parseFloat(dbAnalysis.overallScore);
        const dbThermal = parseFloat(dbAnalysis.thermalScore);
        const dbRedev = parseFloat(dbAnalysis.redevelopmentScore);

        initialAnalysis = {
          ...initialAnalysis,
          ...dbAnalysis,
          // Prefer calculated scores over 0/invalid DB values
          overallScore: (dbOverall && dbOverall > 0) ? dbAnalysis.overallScore : initialAnalysis.overallScore,
          thermalScore: (dbThermal && dbThermal > 0) ? dbAnalysis.thermalScore : initialAnalysis.thermalScore,
          redevelopmentScore: (dbRedev && dbRedev > 0) ? dbAnalysis.redevelopmentScore : initialAnalysis.redevelopmentScore,
          thermalBreakdown: dbAnalysis.thermalBreakdown || initialAnalysis.thermalBreakdown,
          redevelopmentBreakdown: dbAnalysis.redevelopmentBreakdown || initialAnalysis.redevelopmentBreakdown
        };
      }
      
      // Store original data for change detection
      originalAnalysisRef.current = JSON.parse(JSON.stringify(initialAnalysis));
      originalTransmissionRef.current = JSON.parse(JSON.stringify(dbTransmission || []));
      
      setEditedAnalysis(initialAnalysis);
      setAnalysisData(initialAnalysis);
      setEditedTransmissionData(dbTransmission || []);
      setLocalTransmissionData(dbTransmission || []);
      
      isInitialLoad.current = false;
    };
    
    initializeData();
    
    // Cleanup function
    return () => {
      // Optional: Reset some states when component unmounts
    };
  }, [selectedExpertProject]);

  // Recalculate scores using canonical formula from scoreCalculations.js
  // Thermal Operating Score = (COD × 0.20) + (Markets × 0.30) + (Transactability × 0.30) + (ThermalOpt × 0.05) + (Environmental × 0.15)
  // Redevelopment Score = IF(any of Market/Infra/IX = 0, 0, (Market × 0.4 + Infra × 0.3 + IX × 0.3) × multiplier)
  // Overall Project Score = Thermal Operating Score + Redevelopment Score
  const recalculateScores = useCallback((analysisData) => {
    const thermalBreakdown = analysisData.thermalBreakdown || {};
    const redevBreakdown = analysisData.redevelopmentBreakdown || {};

    // Get score from breakdown, properly handling 0 as a valid value
    const getSafeScore = (breakdown, key, defaultValue = 0) => {
      const entry = breakdown[key];
      if (entry === undefined || entry === null) return defaultValue;
      const value = entry.score;
      // Explicitly check for 0 - it's a valid score, not missing
      if (value === 0) return 0;
      if (value === undefined || value === null) return defaultValue;
      const num = parseFloat(value);
      return isNaN(num) ? defaultValue : num;
    };

    const getSafeValue = (value, defaultValue = 0) => {
      if (value === 0) return 0; // Explicitly handle 0
      if (value === undefined || value === null) return defaultValue;
      const num = parseFloat(value);
      return isNaN(num) ? defaultValue : num;
    };

    // Get component values from breakdown
    const codScore = getSafeValue(analysisData.codScore, 0);
    const marketsScore = getSafeValue(analysisData.marketsScore, 0);
    const transactabilityScore = getSafeValue(analysisData.transactabilityScore, 0);
    const thermalOptScore = getSafeScore(thermalBreakdown, 'thermal_optimization', 1);
    const environmentalScore = getSafeScore(thermalBreakdown, 'environmental', 2);

    const marketScore = getSafeScore(redevBreakdown, 'redev_market', 2);
    const landScore = getSafeScore(redevBreakdown, 'land_availability', 2);
    const utilitiesScore = getSafeScore(redevBreakdown, 'utilities', 2);
    const infrastructureScore = (landScore + utilitiesScore) / 2;  // Infra is average of land + utilities
    const ixScore = getSafeScore(redevBreakdown, 'interconnection', 2);

    // Use canonical calculation functions
    const thermalScore = calculateThermalScore({
      plant_cod: codScore,
      markets: marketsScore,
      transactability_scores: transactabilityScore,
      thermal_optimization: thermalOptScore,
      environmental_score: environmentalScore
    });

    const redevelopmentScore = calculateRedevelopmentScore({
      market_score: marketScore,
      infra: infrastructureScore,
      ix: ixScore,
      co_locate_repower: analysisData.coLocateRepower || ''
    });

    const overallScore = calculateOverallScore(thermalScore, redevelopmentScore);

    const result = {
      ...analysisData,
      thermalScore: thermalScore.toFixed(2),
      redevelopmentScore: redevelopmentScore.toFixed(2),
      overallScore: overallScore.toFixed(2),
      infrastructureScore: infrastructureScore.toFixed(2),
      overallRating: overallScore >= 4.5 ? 'Strong' : overallScore >= 3.0 ? 'Moderate' : 'Weak',
      confidence: overallScore >= 4.5 ? 85 : overallScore >= 3.0 ? 75 : 60
    };

    return result;
  }, []);

  // Handle save - FIXED: Exit edit mode after save
  const handleSave = useCallback(async () => {
    console.log('💾 Save button clicked');
    
    // Check if there are changes
    if (!hasChanges()) {
      setSaveStatus('no-changes');
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
      return;
    }
    
    if (saveStatus === 'saving') return;
    
    setSaveStatus('saving');
    
    try {
      const currentAnalysisToSave = editedAnalysis || analysisData;
      
      if (!currentAnalysisToSave) {
        throw new Error('No analysis data to save');
      }
      
      const updatedAnalysis = recalculateScores(currentAnalysisToSave);
      
      const projectId = selectedExpertProject.id || 
                       selectedExpertProject.detailData?.id || 
                       selectedExpertProject.expertAnalysis?.projectId;
      
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      
      // Sync local transmission data to parent state before saving
      setEditedTransmissionData(localTransmissionData);
      
      const saveData = {
        projectId: projectId,
        projectName: updatedAnalysis.projectName,
        overallScore: parseFloat(updatedAnalysis.overallScore) || 0,
        overallRating: updatedAnalysis.overallRating || 'Moderate',
        confidence: updatedAnalysis.confidence || 75,
        thermalOperatingScore: parseFloat(updatedAnalysis.thermalScore) || 0,
        thermalBreakdown: updatedAnalysis.thermalBreakdown || {
          thermal_optimization: { score: 1 },
          environmental: { score: 2 }
        },
        redevelopmentScore: parseFloat(updatedAnalysis.redevelopmentScore) || 0,
        redevelopmentBreakdown: updatedAnalysis.redevelopmentBreakdown || {
          redev_market: { score: 2 },
          land_availability: { score: 2 },
          utilities: { score: 2 },
          interconnection: { score: 2 }
        },
        infrastructureScore: parseFloat(updatedAnalysis.infrastructureScore) || 0,
        editedBy: currentUser,
        lastUpdated: new Date().toISOString()
      };
      
      if (saveExpertAnalysis) {
        const savedResult = await saveExpertAnalysis(saveData);
        console.log('✅ Save successful:', savedResult);
        
        // Update original references with saved data
        originalAnalysisRef.current = JSON.parse(JSON.stringify(updatedAnalysis));
        originalTransmissionRef.current = JSON.parse(JSON.stringify(localTransmissionData));
        
        // Update all states with saved data
        setAnalysisData(updatedAnalysis);
        setEditedAnalysis(updatedAnalysis);
       
        setIsEditing(false);
        
        setSaveStatus('success');

        // Save transmission data immediately (always save, even if empty to handle deletions)
        if (saveTransmissionInterconnection) {
          saveTransmissionInterconnection(projectId, localTransmissionData)
            .then(() => console.log(`✅ Transmission data saved (${localTransmissionData.length} entries)`))
            .catch(error => console.error('Transmission save error:', error));
        }

        // Delay dashboard refresh to allow notification to show
        // Refresh happens after 2 seconds, notification clears after 3 seconds
        setTimeout(() => {
          if (selectedExpertProject.onSaveSuccess) {
            selectedExpertProject.onSaveSuccess();
          }

          window.dispatchEvent(new Event('expertAnalysisUpdated'));

          if (window.refreshDashboardData) {
            window.refreshDashboardData();
          }
        }, 2000);

        // Clear success message after 3 seconds for better visibility
        setTimeout(() => {
          setSaveStatus(null);
        }, 3000);
        
      } else {
        throw new Error('No save function provided');
      }
      
    } catch (error) {
      console.error('❌ Save error:', error);
      
      setSaveStatus('error');
      
      setTimeout(() => {
        const errorMessage = error.message.includes('404') 
          ? 'Save failed: API endpoint not found.'
          : error.message.includes('401') || error.message.includes('403')
          ? 'Save failed: Authentication error.'
          : `Save failed: ${error.message}`;
        
        alert(`❌ ${errorMessage}`);
      }, 100);
    }
  }, [selectedExpertProject, editedAnalysis, analysisData, saveStatus, recalculateScores, saveExpertAnalysis, saveTransmissionInterconnection, localTransmissionData, currentUser, hasChanges]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (isEditing && window.refreshDashboardData) {
      window.refreshDashboardData();
    }
    
    setSelectedExpertProject(null);
  }, [isEditing, setSelectedExpertProject]);

  // Manual refresh
  const handleManualRefresh = useCallback(async () => {
    if (isEditing && hasChanges()) {
      if (!window.confirm('You have unsaved changes. Refreshing will discard them. Continue?')) {
        return;
      }
      setIsEditing(false);
    }
    
    await refreshAllData();
  }, [isEditing, hasChanges, refreshAllData]);

  // Get score color class
  const getScoreColorClass = useCallback((score) => {
    const numScore = parseFloat(score) || 0;
    if (numScore >= 2.5) return 'score-excellent';
    if (numScore >= 1.5) return 'score-good';
    if (numScore >= 0.5) return 'score-fair';
    return 'score-poor';
  }, []);

  // Get score text - handles N/A
  const getScoreText = useCallback((score) => {
    if (score === null || score === undefined) return 'N/A';
    const numScore = parseFloat(score);
    if (isNaN(numScore)) return 'N/A';
    if (numScore >= 2.5) return 'EXCELLENT';
    if (numScore >= 1.5) return 'GOOD';
    if (numScore >= 0.5) return 'FAIR';
    return 'POOR';
  }, []);

  // Helper to format score for display with N/A handling
  const formatScoreForDisplay = useCallback((score, decimals = 2, maxScore = 3.0) => {
    if (score === null || score === undefined) return 'N/A';
    const numScore = parseFloat(score);
    if (isNaN(numScore)) return 'N/A';
    return `${numScore.toFixed(decimals)}/${maxScore}`;
  }, []);

  // Check if a value is N/A
  const isScoreNA = useCallback((score) => {
    return score === null || score === undefined || (typeof score === 'number' && isNaN(score));
  }, []);

  // Get rating color
  const getRatingColor = useCallback((rating) => {
    switch(rating?.toLowerCase()) {
      case 'strong': return '#10b981';
      case 'moderate': return '#f59e0b';
      case 'weak': return '#ef4444';
      default: return '#6b7280';
    }
  }, []);

  // Handle score change
  const handleScoreChange = useCallback((category, component, value) => {
    // Use functional update to ensure we always have the latest state
    setEditedAnalysis(prevAnalysis => {
      const currentAnalysis = prevAnalysis || analysisData;

      const updated = { ...currentAnalysis };

      // Use Number() instead of parseInt() || 0 to properly handle "0"
      const numericScore = Number(value);
      const scoreValue = isNaN(numericScore) ? 0 : numericScore;

      if (category === 'thermal') {
        updated.thermalBreakdown = {
          ...updated.thermalBreakdown,
          [component]: {
            ...updated.thermalBreakdown?.[component],
            score: scoreValue
          }
        };
      } else if (category === 'redevelopment') {
        updated.redevelopmentBreakdown = {
          ...updated.redevelopmentBreakdown,
          [component]: {
            ...updated.redevelopmentBreakdown?.[component],
            score: scoreValue
          }
        };
      }

      return recalculateScores(updated);
    });
  }, [analysisData, recalculateScores]);

  // Handle transmission change
  const handleLocalTransmissionChange = useCallback((index, field, value, event) => {
    if (!isEditing) return;
    
    // Store the focused element before update
    const focusedElement = document.activeElement;
    const selectionStart = focusedElement.selectionStart;
    const selectionEnd = focusedElement.selectionEnd;
    
    setLocalTransmissionData(prev => {
      const newData = [...prev];
      newData[index] = {
        ...newData[index],
        [field]: field === 'excessInjectionCapacity' || field === 'excessWithdrawalCapacity' 
          ? parseFloat(value) || 0 
          : value
      };
      return newData;
    });
    
    // Restore focus and cursor position AFTER state update
    setTimeout(() => {
      if (focusedElement && focusedElement.tagName === 'INPUT') {
        focusedElement.focus();
        if (focusedElement.setSelectionRange) {
          focusedElement.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    }, 0);
  }, [isEditing]);

  // Add new POI voltage entry (max 5)
  const addNewTransmissionEntry = useCallback((e) => {
    if (!isEditing) return;
    e.preventDefault();

    // Enforce max 5 entries
    if (localTransmissionData.length >= 5) {
      alert('Maximum of 5 POI voltage entries allowed.');
      return;
    }

    const projectName = selectedExpertProject?.expertAnalysis?.projectName ||
                       selectedExpertProject.detailData?.["Project Name"] ||
                       selectedExpertProject.detailData?.project_name ||
                       selectedExpertProject.asset ||
                       "";

    setLocalTransmissionData(prev => [
      ...prev,
      {
        id: Date.now(),
        site: projectName,
        excessIXCapacity: true,
        constraints: "-",
        poiVoltage: "",
        excessInjectionCapacity: 0,
        excessWithdrawalCapacity: 0
      }
    ]);
  }, [isEditing, selectedExpertProject, localTransmissionData.length]);

  // Remove POI voltage entry
  const removeTransmissionEntry = useCallback((index) => {
    if (!isEditing) return;
    
    setLocalTransmissionData(prev => {
      const newData = [...prev];
      newData.splice(index, 1);
      return newData;
    });
  }, [isEditing]);

  // Memoized Transmission Edit Table
  const TransmissionEditTable = React.memo(({ data, onFieldChange, onAdd, onRemove }) => {
    const handleChange = useCallback((index, field, value, event) => {
      onFieldChange(index, field, value, event);
    }, [onFieldChange]);
    
    return (
      <div className="transmission-edit">
        <div className="transmission-table-container" style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table className="transmission-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr>
                <th style={{ width: '25%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>POI Voltage</th>
                <th style={{ width: '25%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>Excess Injection Capacity (MW)</th>
                <th style={{ width: '25%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>Excess Withdrawal Capacity (MW)</th>
                <th style={{ width: '15%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>Constraints</th>
                <th style={{ width: '10%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={`transmission-${item.id || index}`} style={{ borderBottom: '1px solid #4a5568' }}>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      defaultValue={item.poiVoltage || ''}
                      onBlur={(e) => handleChange(index, 'poiVoltage', e.target.value)}
                      placeholder="e.g., 69 kV"
                      style={{ 
                        width: '100%', 
                        padding: '10px 12px', 
                        fontSize: '14px',
                        backgroundColor: '#2d3748',
                        color: 'white',
                        border: '1px solid #4a5568',
                        borderRadius: '6px'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="number"
                      defaultValue={item.excessInjectionCapacity || 0}
                      onBlur={(e) => handleChange(index, 'excessInjectionCapacity', e.target.value)}
                      placeholder="0.0"
                      step="0.1"
                      min="0"
                      style={{ 
                        width: '100%', 
                        padding: '10px 12px', 
                        fontSize: '14px',
                        backgroundColor: '#2d3748',
                        color: 'white',
                        border: '1px solid #4a5568',
                        borderRadius: '6px'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="number"
                      defaultValue={item.excessWithdrawalCapacity || 0}
                      onBlur={(e) => handleChange(index, 'excessWithdrawalCapacity', e.target.value)}
                      placeholder="0.0"
                      step="0.1"
                      min="0"
                      style={{ 
                        width: '100%', 
                        padding: '10px 12px', 
                        fontSize: '14px',
                        backgroundColor: '#2d3748',
                        color: 'white',
                        border: '1px solid #4a5568',
                        borderRadius: '6px'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <input
                      type="text"
                      defaultValue={item.constraints || '-'}
                      onBlur={(e) => handleChange(index, 'constraints', e.target.value)}
                      placeholder="e.g., None, 1, 2"
                      style={{ 
                        width: '100%', 
                        padding: '10px 12px', 
                        fontSize: '14px',
                        backgroundColor: '#2d3748',
                        color: 'white',
                        border: '1px solid #4a5568',
                        borderRadius: '6px'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button 
                      onClick={() => onRemove(index)}
                      title="Remove this entry"
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🗑️ Remove
                    </button>
                  </td>
                </tr>
              ))}
              
              {data.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#a0aec0', fontStyle: 'italic', padding: '20px' }}>
                    No transmission data available. Click "Add POI Voltage" to add new entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="transmission-actions" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          <button
            onClick={onAdd}
            disabled={data.length >= 5}
            style={{
              background: data.length >= 5 ? 'rgba(100, 100, 100, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              border: data.length >= 5 ? '1px solid rgba(100, 100, 100, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
              color: data.length >= 5 ? '#9ca3af' : '#86efac',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: data.length >= 5 ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            + Add POI Voltage
          </button>
          <span style={{ color: '#a0aec0', fontSize: '12px' }}>
            {data.length}/5 entries
          </span>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    if (prevProps.data.length !== nextProps.data.length) return false;
    
    // Check if any item actually changed
    const prevData = prevProps.data;
    const nextData = nextProps.data;
    
    for (let i = 0; i < prevData.length; i++) {
      const prevItem = prevData[i];
      const nextItem = nextData[i];
      
      // Compare only the values that matter for rendering
      if (prevItem.poiVoltage !== nextItem.poiVoltage ||
          prevItem.excessInjectionCapacity !== nextItem.excessInjectionCapacity ||
          prevItem.excessWithdrawalCapacity !== nextItem.excessWithdrawalCapacity ||
          prevItem.constraints !== nextItem.constraints) {
        return false;
      }
    }
    
    return true;
  });

  const TransmissionViewTable = React.memo(({ data }) => (
    <div className="transmission-view">
      {data.length > 0 ? (
        <div className="transmission-table-container" style={{ overflowX: 'auto' }}>
          <table className="transmission-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr>
                <th style={{ width: '30%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>POI Voltage</th>
                <th style={{ width: '30%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>Excess Injection Capacity</th>
                <th style={{ width: '30%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>Excess Withdrawal Capacity</th>
                <th style={{ width: '20%', background: '#1a202c', color: '#a0aec0', padding: '12px', textAlign: 'left' }}>Constraints</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #4a5568' }}>
                  <td style={{ padding: '12px', color: '#e2e8f0' }}>{item.poiVoltage || ''}</td>
                  <td style={{ padding: '12px', color: '#e2e8f0' }}>{parseFloat(item.excessInjectionCapacity || 0).toFixed(1)} MW</td>
                  <td style={{ padding: '12px', color: '#e2e8f0' }}>{parseFloat(item.excessWithdrawalCapacity || 0).toFixed(1)} MW</td>
                  <td style={{ padding: '12px', color: '#e2e8f0' }}>{item.constraints === "-" ? "None" : item.constraints || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#a0aec0' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px', opacity: '0.5' }}>📊</div>
          <div>No transmission interconnection data available.</div>
        </div>
      )}
    </div>
  ));

  // Current analysis data
  const currentAnalysis = editedAnalysis || analysisData;
  
  // Use localTransmissionData for editing, editedTransmissionData for viewing
  const displayTransmissionData = isEditing ? localTransmissionData : editedTransmissionData;
  
  // Loading overlay
  if (isLoading && isInitialLoad.current) {
    return (
      <div className="modal-overlay" onClick={() => !isEditing && handleClose()}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          background: '#1a1a1a',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div className="loading-spinner" style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            margin: '0 auto 20px',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#a0aec0' }}>Loading expert analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={() => !isEditing && handleClose()}>
      <div className="modal-content expert-analysis-modal" onClick={(e) => e.stopPropagation()}>
        {/* Save Status Overlay */}
        {saveStatus && (
          <div className="save-status-overlay" style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10001
          }}>
            <div style={{
              background: '#2d3748',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid #4a5568',
              textAlign: 'center',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
              {saveStatus === 'saving' && (
                <>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    border: '3px solid rgba(59, 130, 246, 0.3)',
                    borderTopColor: '#3b82f6',
                    borderRadius: '50%',
                    margin: '0 auto 16px',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <h3 style={{ color: 'white', margin: '0 0 8px' }}>Saving Changes</h3>
                  <p style={{ color: '#a0aec0' }}>Please wait while we save your changes...</p>
                </>
              )}
              {saveStatus === 'success' && (
                <>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    color: '#10b981'
                  }}>✓</div>
                  <h3 style={{ color: 'white', margin: '0 0 8px' }}>Changes Saved!</h3>
                  <p style={{ color: '#a0aec0' }}>Your changes have been saved successfully.</p>
                </>
              )}
              {saveStatus === 'no-changes' && (
                <>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    color: '#f59e0b'
                  }}>ℹ️</div>
                  <h3 style={{ color: 'white', margin: '0 0 8px' }}>No Changes Made</h3>
                  <p style={{ color: '#a0aec0' }}>You haven't made any changes to save.</p>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    color: '#ef4444'
                  }}>✗</div>
                  <h3 style={{ color: 'white', margin: '0 0 8px' }}>Save Failed</h3>
                  <p style={{ color: '#a0aec0' }}>Unable to save changes. Please try again.</p>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="modal-header" style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
          borderBottom: '1px solid #4a5568',
          borderRadius: '12px 12px 0 0'
        }}>
          <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div className="header-left">
              <h2 style={{ margin: '0', color: '#ffffff', fontSize: '24px', fontWeight: '600' }}>
                {currentAnalysis?.projectName || 'Project'} - Expert Analysis
              </h2>
              <p className="subtitle" style={{ color: '#a0aec0', margin: '4px 0 0 0', fontSize: '14px' }}>
                AI-powered assessment of all pipeline projects
              </p>
            </div>
            <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={handleManualRefresh}
                title="Refresh data from server"
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: '#93c5fd',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🔄 Refresh
              </button>
              <button onClick={handleClose} style={{
                background: 'none',
                border: 'none',
                color: '#a0aec0',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>×</button>
            </div>
          </div>
          
          <div className="edit-toggle" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!isEditing ? (
              <button onClick={() => {
                // Store current state as original when entering edit mode
                originalAnalysisRef.current = JSON.parse(JSON.stringify(currentAnalysis));
                originalTransmissionRef.current = JSON.parse(JSON.stringify(editedTransmissionData));
                setLocalTransmissionData(editedTransmissionData); // Sync local state
                setIsEditing(true);
              }} style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#93c5fd',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                <span>✏️</span> Enable Editing
              </button>
            ) : (
              <div className="edit-mode-indicator" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>EDIT MODE</span>
                <button onClick={() => {
                  setIsEditing(false);
                  setEditedAnalysis(JSON.parse(JSON.stringify(originalAnalysisRef.current)));
                  setLocalTransmissionData(JSON.parse(JSON.stringify(originalTransmissionRef.current)));
                }} style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}>
                  Cancel Edit
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Overall Score Summary */}
        <div className="overall-score-section" style={{ padding: '20px', borderBottom: '1px solid #4a5568' }}>
          <h3 style={{ color: '#ffffff', margin: '0 0 16px 0', fontSize: '18px' }}>Overall Score Summary</h3>
          <div className="score-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="score-card" style={{
              background: '#2d3748',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #4a5568',
              textAlign: 'center'
            }}>
              <div style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                OVERALL SCORE
              </div>
              {isScoreNA(currentAnalysis?.overallScore) ? (
                <>
                  <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px', color: '#6b7280' }}>
                    N/A
                  </div>
                  <div style={{ color: '#a0aec0', fontSize: '14px', marginBottom: '8px' }}>
                    --
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#6b7280' }}>
                    N/A
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    marginBottom: '4px',
                    color: getScoreColorClass((parseFloat(currentAnalysis?.overallScore) || 0) / 2) === 'score-excellent' ? '#10b981' :
                           getScoreColorClass((parseFloat(currentAnalysis?.overallScore) || 0) / 2) === 'score-good' ? '#f59e0b' :
                           getScoreColorClass((parseFloat(currentAnalysis?.overallScore) || 0) / 2) === 'score-fair' ? '#fbbf24' : '#ef4444'
                  }}>
                    {(parseFloat(currentAnalysis?.overallScore) || 0).toFixed(1)}/6.0
                  </div>
                  <div style={{ color: '#a0aec0', fontSize: '14px', marginBottom: '8px' }}>
                    {Math.round(((parseFloat(currentAnalysis?.overallScore) || 0) / 6) * 100)}%
                  </div>
                  <div style={{
                    fontWeight: '600',
                    fontSize: '14px',
                    color: getRatingColor(currentAnalysis?.overallRating)
                  }}>
                    {currentAnalysis?.overallRating || 'N/A'}
                  </div>
                </>
              )}
            </div>

            <div className="score-card" style={{
              background: '#2d3748',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #4a5568',
              textAlign: 'center'
            }}>
              <div style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                THERMAL OPERATING SCORE
              </div>
              {isScoreNA(currentAnalysis?.thermalScore) ? (
                <>
                  <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px', color: '#6b7280' }}>
                    N/A
                  </div>
                  <div style={{ color: '#a0aec0', fontSize: '14px', marginBottom: '8px' }}>
                    --
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#6b7280' }}>
                    N/A
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    marginBottom: '4px',
                    color: getScoreColorClass(currentAnalysis?.thermalScore || 0) === 'score-excellent' ? '#10b981' :
                           getScoreColorClass(currentAnalysis?.thermalScore || 0) === 'score-good' ? '#f59e0b' :
                           getScoreColorClass(currentAnalysis?.thermalScore || 0) === 'score-fair' ? '#fbbf24' : '#ef4444'
                  }}>
                    {(parseFloat(currentAnalysis?.thermalScore) || 0).toFixed(2)}/3.0
                  </div>
                  <div style={{ color: '#a0aec0', fontSize: '14px', marginBottom: '8px' }}>
                    {Math.round(((parseFloat(currentAnalysis?.thermalScore) || 0) / 3) * 100)}%
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>
                    {getScoreText(parseFloat(currentAnalysis?.thermalScore) || 0)}
                  </div>
                </>
              )}
            </div>

            <div className="score-card" style={{
              background: '#2d3748',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #4a5568',
              textAlign: 'center'
            }}>
              <div style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                REDEVELOPMENT
              </div>
              {isScoreNA(currentAnalysis?.redevelopmentScore) ? (
                <>
                  <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '4px', color: '#6b7280' }}>
                    N/A
                  </div>
                  <div style={{ color: '#a0aec0', fontSize: '14px', marginBottom: '8px' }}>
                    --
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#6b7280' }}>
                    N/A
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    marginBottom: '4px',
                    color: getScoreColorClass(currentAnalysis?.redevelopmentScore || 0) === 'score-excellent' ? '#10b981' :
                           getScoreColorClass(currentAnalysis?.redevelopmentScore || 0) === 'score-good' ? '#f59e0b' :
                           getScoreColorClass(currentAnalysis?.redevelopmentScore || 0) === 'score-fair' ? '#fbbf24' : '#ef4444'
                  }}>
                    {(parseFloat(currentAnalysis?.redevelopmentScore) || 0).toFixed(2)}/3.0
                  </div>
                  <div style={{ color: '#a0aec0', fontSize: '14px', marginBottom: '8px' }}>
                    {Math.round(((parseFloat(currentAnalysis?.redevelopmentScore) || 0) / 3) * 100)}%
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>
                    {getScoreText(parseFloat(currentAnalysis?.redevelopmentScore) || 0)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Expert Analysis Cards */}
        <div className="expert-cards-section" style={{ padding: '20px' }}>
          <h3 style={{ color: '#ffffff', margin: '0 0 8px 0', fontSize: '18px' }}>Expert Analysis Cards</h3>
          <p style={{ color: '#a0aec0', margin: '0 0 20px 0', fontSize: '14px' }}>
            Click info buttons for scoring criteria details
          </p>
          
          <div className="cards-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {/* Left Card - Thermal Operating Assessment */}
            <div style={{ background: '#2d3748', border: '1px solid #4a5568', borderRadius: '8px' }}>
              <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid #4a5568' }}>
                <h4 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '16px' }}>Thermal Operating Assessment</h4>
                <p style={{ color: '#a0aec0', fontSize: '13px', margin: '0 0 8px 0' }}>
                  Evaluation of existing plant operations and market position
                </p>
                <span style={{ display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
                  Weight: 50%
                </span>
              </div>
              
              <div style={{ padding: '16px' }}>
                {/* M&A Thermal Optimization */}
                <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #4a5568' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ background: '#4a5568', color: '#e2e8f0', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>
                      M&A
                    </span>
                    <h5 style={{ margin: '0', color: '#e2e8f0', fontSize: '14px', fontWeight: '600' }}>Thermal Optimization Potential</h5>
                  </div>
                  <div>
                    {isEditing ? (
                      <select 
                        value={currentAnalysis?.thermalBreakdown?.thermal_optimization?.score ?? 0}
                        onChange={(e) => handleScoreChange('thermal', 'thermal_optimization', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '14px',
                          backgroundColor: '#2d3748',
                          color: 'white',
                          border: '1px solid #4a5568',
                          borderRadius: '6px',
                          marginBottom: '8px'
                        }}
                      >
                        <option value="0">0 - Yet to be saved</option>
                        <option value="1">1 - No identifiable value add</option>
                        <option value="2">2 - Readily apparent value add</option>
                      </select>
                    ) : (
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#2d3748',
                        borderRadius: '6px',
                        border: '1px solid #4a5568',
                        marginBottom: '8px'
                      }}>
                        Score: {currentAnalysis?.thermalBreakdown?.thermal_optimization?.score ?? 0}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a0aec0', fontSize: '12px' }}>Weight: 5%</span>
                      <span style={{ color: '#a0aec0', fontSize: '12px' }}>
                        Contribution: {(() => {
                          const score = currentAnalysis?.thermalBreakdown?.thermal_optimization?.score;
                          if (score === null || score === undefined) return 'N/A';
                          return ((score ?? 0) * 0.05).toFixed(2);
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Environmental Considerations */}
                <div style={{ marginBottom: '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ background: '#4a5568', color: '#e2e8f0', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>
                      Env
                    </span>
                    <h5 style={{ margin: '0', color: '#e2e8f0', fontSize: '14px', fontWeight: '600' }}>Environmental Considerations</h5>
                  </div>
                  <div>
                    {isEditing ? (
                      <select 
                        value={currentAnalysis?.thermalBreakdown?.environmental?.score ?? 2}
                        onChange={(e) => handleScoreChange('thermal', 'environmental', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '14px',
                          backgroundColor: '#2d3748',
                          color: 'white',
                          border: '1px solid #4a5568',
                          borderRadius: '6px',
                          marginBottom: '8px'
                        }}
                      >
                        <option value="0">0 - Known and not mitigable</option>
                        <option value="1">1 - Not known</option>
                        <option value="2">2 - Known, mitigable, no cost advantage</option>
                        <option value="3">3 - Known, mitigable, PT has cost advantage</option>
                      </select>
                    ) : (
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#2d3748',
                        borderRadius: '6px',
                        border: '1px solid #4a5568',
                        marginBottom: '8px'
                      }}>
                        Score: {currentAnalysis?.thermalBreakdown?.environmental?.score ?? 2}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a0aec0', fontSize: '12px' }}>Weight: 15%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Card - Redevelopment Assessment */}
            <div style={{ background: '#2d3748', border: '1px solid #4a5568', borderRadius: '8px' }}>
              <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid #4a5568' }}>
                <h4 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '16px' }}>Redevelopment Assessment</h4>
                <p style={{ color: '#a0aec0', fontSize: '13px', margin: '0 0 8px 0' }}>
                  Evaluation of future development potential and infrastructure
                </p>
                <span style={{ display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
                  Weight: 50%
                </span>
              </div>
              
              <div style={{ padding: '16px' }}>
                {/* Market Position */}
                <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #4a5568' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ background: '#4a5568', color: '#e2e8f0', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>
                      Mkt
                    </span>
                    <h5 style={{ margin: '0', color: '#e2e8f0', fontSize: '14px', fontWeight: '600' }}>Market Position</h5>
                  </div>
                  <div>
                    {isEditing ? (
                      <select 
                        value={currentAnalysis?.redevelopmentBreakdown?.redev_market?.score ?? 2}
                        onChange={(e) => handleScoreChange('redevelopment', 'redev_market', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '14px',
                          backgroundColor: '#2d3748',
                          color: 'white',
                          border: '1px solid #4a5568',
                          borderRadius: '6px',
                          marginBottom: '8px'
                        }}
                      >
                        <option value="0">0 - Challenging</option>
                        <option value="1">1 - Uncertain</option>
                        <option value="2">2 - Secondary</option>
                        <option value="3">3 - Primary</option>
                      </select>
                    ) : (
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#2d3748',
                        borderRadius: '6px',
                        border: '1px solid #4a5568',
                        marginBottom: '8px'
                      }}>
                        Score: {currentAnalysis?.redevelopmentBreakdown?.redev_market?.score ?? 2}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a0aec0', fontSize: '12px' }}>Weight: 40%</span>
                      <span style={{ color: '#a0aec0', fontSize: '12px' }}>
                        Contribution: {(() => {
                          const score = currentAnalysis?.redevelopmentBreakdown?.redev_market?.score;
                          if (score === null || score === undefined) return 'N/A';
                          return (score * 0.40).toFixed(2);
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Infrastructure */}
                <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #4a5568' }}>
                  <h5 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '14px', fontWeight: '600' }}>Infrastructure</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '12px 0' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#a0aec0', fontSize: '12px', fontWeight: '500' }}>Land Availability</label>
                      {isEditing ? (
                        <select 
                          value={currentAnalysis?.redevelopmentBreakdown?.land_availability?.score ?? 2}
                          onChange={(e) => handleScoreChange('redevelopment', 'land_availability', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '14px',
                            backgroundColor: '#2d3748',
                            color: 'white',
                            border: '1px solid #4a5568',
                            borderRadius: '6px'
                          }}
                        >
                          <option value="0">0 - No land available</option>
                          <option value="1">1 - No onsite, available nearby</option>
                          <option value="2">2 - Some onsite + nearby parcel</option>
                          <option value="3">3 - Sufficient land onsite</option>
                        </select>
                      ) : (
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#2d3748',
                          borderRadius: '6px',
                          border: '1px solid #4a5568'
                        }}>
                          Score: {currentAnalysis?.redevelopmentBreakdown?.land_availability?.score ?? 2}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', color: '#a0aec0', fontSize: '12px', fontWeight: '500' }}>Utilities</label>
                      {isEditing ? (
                        <select 
                          value={currentAnalysis?.redevelopmentBreakdown?.utilities?.score ?? 2}
                          onChange={(e) => handleScoreChange('redevelopment', 'utilities', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '14px',
                            backgroundColor: '#2d3748',
                            color: 'white',
                            border: '1px solid #4a5568',
                            borderRadius: '6px'
                          }}
                        >
                          <option value="-1">-1 - N/A - BESS and Solar</option>
                          <option value="0">0 - No clear path</option>
                          <option value="1">1 - Utilities available but expensive</option>
                          <option value="2">2 - Utilities nearby, low cost</option>
                          <option value="3">3 - Sufficient utilities onsite</option>
                        </select>
                      ) : (
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#2d3748',
                          borderRadius: '6px',
                          border: '1px solid #4a5568'
                        }}>
                          Score: {currentAnalysis?.redevelopmentBreakdown?.utilities?.score ?? 2}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #4a5568' }}>
                    <span style={{ fontWeight: '500', color: '#e2e8f0' }}>Infrastructure Score:</span>
                    {isScoreNA(currentAnalysis?.infrastructureScore) ? (
                      <span style={{ fontWeight: '600', color: '#6b7280' }}>N/A</span>
                    ) : (
                      <span style={{
                        fontWeight: '600',
                        color: getScoreColorClass(currentAnalysis?.infrastructureScore || 0) === 'score-excellent' ? '#10b981' :
                               getScoreColorClass(currentAnalysis?.infrastructureScore || 0) === 'score-good' ? '#f59e0b' :
                               getScoreColorClass(currentAnalysis?.infrastructureScore || 0) === 'score-fair' ? '#fbbf24' : '#ef4444'
                      }}>
                        {(parseFloat(currentAnalysis?.infrastructureScore) || 0).toFixed(2)}/3.0
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Interconnection */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ background: '#4a5568', color: '#e2e8f0', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>
                      IX
                    </span>
                    <h5 style={{ margin: '0', color: '#e2e8f0', fontSize: '14px', fontWeight: '600' }}>Interconnection (IX)</h5>
                  </div>
                  <div>

                    
                    {/* In the Interconnection section, change the select options to: */}
                  {isEditing ? (
                    <select 
                      value={currentAnalysis?.redevelopmentBreakdown?.interconnection?.score ?? 2}
                      onChange={(e) => handleScoreChange('redevelopment', 'interconnection', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '14px',
                        backgroundColor: '#2d3748',
                        color: 'white',
                        border: '1px solid #4a5568',
                        borderRadius: '6px',
                        marginBottom: '8px'
                      }}
                    >
                      <option value="0">0 - Major upgrades needed</option>
                      <option value="1">1 - Minimal upgrades needed</option>
                      <option value="2">2 - No upgrades needed (Unsecured)</option>
                      <option value="3">3 - Secured IX Rights</option>
                    </select>
                  ) : (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#2d3748',
                      borderRadius: '6px',
                      border: '1px solid #4a5568',
                      marginBottom: '8px'
                    }}>
                      Score: {currentAnalysis?.redevelopmentBreakdown?.interconnection?.score ?? 2}
                    </div>
                  )}

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#a0aec0', fontSize: '12px' }}>Weight: 30%</span>
                    </div>
                  </div>
                </div>
                
                {/* Transmission Data Section */}
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #4a5568' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h5 style={{ margin: '0', color: '#e2e8f0', fontSize: '14px', fontWeight: '600' }}>Transmission Interconnection Details</h5>
                    {displayTransmissionData.length > 0 && (
                      <span style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        color: '#86efac',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ color: '#22c55e', fontSize: '16px' }}>●</span> Excess IX Capacity Available
                      </span>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <TransmissionEditTable 
                      data={displayTransmissionData}
                      onFieldChange={handleLocalTransmissionChange}
                      onAdd={addNewTransmissionEntry}
                      onRemove={removeTransmissionEntry}
                    />
                  ) : (
                    <TransmissionViewTable data={displayTransmissionData} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div style={{ 
          padding: '20px', 
          borderTop: '1px solid #4a5568', 
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '0 0 12px 12px'
        }}>
          {isEditing ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                style={{
                  background: saveStatus === 'saving' ? 'rgba(107, 114, 128, 0.5)' : 'rgba(59, 130, 246, 0.9)',
                  border: saveStatus === 'saving' ? '1px solid rgba(107, 114, 128, 0.5)' : '1px solid rgba(59, 130, 246, 0.9)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  fontSize: '14px',
                  minWidth: '120px'
                }}
              >
                {saveStatus === 'saving' ? '💾 Saving...' : '💾 Save Changes'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                onClick={handleClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#e2e8f0',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                Back to Scores
              </button>
              <button 
                onClick={() => {
                  alert('Report generation feature would be implemented here.');
                }}
                style={{
                  background: 'rgba(59, 130, 246, 0.9)',
                  border: '1px solid rgba(59, 130, 246, 0.9)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                📄 Generate Report
              </button>
            </div>
          )}
        </div>
        
        {/* CSS Styles */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .expert-analysis-modal {
            max-width: min(95vw, 1200px);
            width: 95%;
            max-height: 90vh;
            overflow-y: auto;
            background: #1a1a1a;
            color: #e0e0e0;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }

          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            padding: 20px;
          }

          /* Input focus styles */
          input:focus {
            outline: none;
            border-color: #63b3ed !important;
            box-shadow: 0 0 0 2px rgba(99, 179, 237, 0.1);
          }

          /* Scrollbar styling */
          .expert-analysis-modal::-webkit-scrollbar {
            width: 10px;
          }

          .expert-analysis-modal::-webkit-scrollbar-track {
            background: #1a202c;
            border-radius: 5px;
          }

          .expert-analysis-modal::-webkit-scrollbar-thumb {
            background: #4a5568;
            border-radius: 5px;
          }

          .expert-analysis-modal::-webkit-scrollbar-thumb:hover {
            background: #63b3ed;
          }

          /* Transmission table wrapper */
          .transmission-table-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin: 0 -12px;
            padding: 0 12px;
          }

          .transmission-table-container::-webkit-scrollbar {
            height: 6px;
          }

          .transmission-table-container::-webkit-scrollbar-track {
            background: #1a202c;
            border-radius: 3px;
          }

          .transmission-table-container::-webkit-scrollbar-thumb {
            background: #4a5568;
            border-radius: 3px;
          }

          /* Large screens (1025px+) */
          @media (min-width: 1025px) {
            .score-grid {
              grid-template-columns: repeat(3, 1fr) !important;
            }

            .cards-container {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }

          /* Medium screens (769px - 1024px) */
          @media (min-width: 769px) and (max-width: 1024px) {
            .cards-container {
              grid-template-columns: 1fr !important;
            }

            .score-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }

            .expert-analysis-modal {
              max-width: 95vw;
            }
          }

          /* Small screens / Tablets (481px - 768px) */
          @media (min-width: 481px) and (max-width: 768px) {
            .expert-analysis-modal {
              width: 100%;
              max-width: 100%;
              max-height: 100vh;
              border-radius: 0;
            }

            .modal-overlay {
              padding: 0;
            }

            .cards-container {
              grid-template-columns: 1fr !important;
            }

            .score-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }

            .score-card {
              padding: 16px !important;
            }

            .infra-grid {
              grid-template-columns: 1fr !important;
            }

            .header-top {
              flex-direction: column !important;
              gap: 12px !important;
            }

            .header-right {
              width: 100% !important;
              justify-content: space-between !important;
            }

            .modal-header h2 {
              font-size: clamp(18px, 4vw, 24px) !important;
            }

            .overall-score-section h3,
            .expert-cards-section h3 {
              font-size: clamp(16px, 3.5vw, 18px) !important;
            }

            /* Transmission table mobile cards */
            .transmission-table {
              min-width: 500px;
            }
          }

          /* Extra small screens / Phones (max 480px) */
          @media (max-width: 480px) {
            .modal-overlay {
              padding: 0;
              align-items: stretch;
            }

            .expert-analysis-modal {
              width: 100%;
              max-width: 100%;
              height: 100vh;
              max-height: 100vh;
              border-radius: 0;
              display: flex;
              flex-direction: column;
            }

            .modal-header {
              padding: 16px !important;
              border-radius: 0 !important;
            }

            .modal-header h2 {
              font-size: 18px !important;
              line-height: 1.3 !important;
            }

            .modal-header .subtitle {
              font-size: 12px !important;
            }

            .header-top {
              flex-direction: column !important;
              gap: 10px !important;
            }

            .header-left {
              width: 100%;
            }

            .header-right {
              width: 100% !important;
              flex-direction: row-reverse !important;
              justify-content: space-between !important;
            }

            .header-right button {
              min-height: 44px;
              min-width: 44px;
            }

            .edit-toggle {
              margin-top: 12px;
            }

            .edit-toggle button {
              width: 100%;
              justify-content: center;
              min-height: 44px;
            }

            .overall-score-section {
              padding: 16px !important;
            }

            .overall-score-section h3 {
              font-size: 16px !important;
              margin-bottom: 12px !important;
            }

            .score-grid {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }

            .score-card {
              padding: 14px !important;
            }

            .score-card > div:first-child {
              font-size: 10px !important;
            }

            .score-card > div:nth-child(2) {
              font-size: 24px !important;
            }

            .expert-cards-section {
              padding: 16px !important;
              flex: 1;
              overflow-y: auto;
            }

            .expert-cards-section h3 {
              font-size: 16px !important;
            }

            .expert-cards-section p {
              font-size: 12px !important;
            }

            .cards-container {
              grid-template-columns: 1fr !important;
              gap: 16px !important;
            }

            /* Card sections */
            .cards-container > div {
              border-radius: 8px !important;
            }

            .cards-container > div > div:first-child {
              padding: 12px !important;
            }

            .cards-container > div > div:first-child h4 {
              font-size: 14px !important;
            }

            .cards-container > div > div:first-child p {
              font-size: 12px !important;
            }

            .cards-container > div > div:last-child {
              padding: 12px !important;
            }

            /* Form elements */
            select, input {
              min-height: 44px !important;
              font-size: 16px !important; /* Prevents iOS zoom */
            }

            /* Infrastructure grid */
            .infra-grid,
            div[style*="grid-template-columns: 1fr 1fr"] {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }

            /* Transmission table - horizontal scroll with indicator */
            .transmission-table-container {
              position: relative;
              margin: 0 -12px;
              padding: 0 12px;
            }

            .transmission-table-container::after {
              content: '← Scroll →';
              position: absolute;
              bottom: -20px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 10px;
              color: #64748b;
              background: #1a202c;
              padding: 2px 8px;
              border-radius: 4px;
            }

            .transmission-table {
              min-width: 450px;
              font-size: 12px !important;
            }

            .transmission-table th,
            .transmission-table td {
              padding: 10px 8px !important;
            }

            .transmission-table input {
              padding: 8px !important;
              font-size: 14px !important;
            }

            /* Action buttons footer */
            div[style*="border-top: 1px solid #4a5568"] {
              padding: 16px !important;
            }

            div[style*="border-top: 1px solid #4a5568"] button {
              min-height: 44px;
              padding: 12px 20px !important;
              font-size: 14px !important;
            }

            /* Save status overlay */
            .save-status-overlay > div {
              margin: 20px;
              max-width: calc(100vw - 40px);
            }
          }

          /* Touch target minimum sizes */
          @media (hover: none) and (pointer: coarse) {
            button,
            select,
            input[type="text"],
            input[type="number"] {
              min-height: 44px;
            }

            .modal-close,
            .header-right button {
              min-width: 44px;
              min-height: 44px;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ExpertAnalysisModal;
