import React, { useEffect, useState, useMemo, useCallback } from 'react';
import './Dashboard.css';
import Header from './components/Header';
import KPISection from './components/Sections/KPISection';
import MiddleGridSection from './components/Sections/MiddleGridSection';
import BottomGridSection from './components/Sections/BottomGridSection';
import AddSiteModal from './components/Modals/AddSiteModal';
import EditSiteModal from './components/Modals/EditSiteModal'; 
import ProjectDetailModal from './components/Modals/ProjectDetailModal';
import ScoringPanel from './components/Modals/ScoringPanel';
import ExpertScoresPanel from './components/Modals/ExpertScoresPanel';
import ExpertAnalysisModal from './components/Modals/ExpertAnalysisModal';
import ExportModal from './components/Modals/ExportModal'; 
import UploadModal from './components/Modals/UploadModal';
import { ActivityLogProvider } from './contexts/ActivityLogContext';
import ActivityLogPanel from './components/ActivityLog/ActivityLogPanel';
import { calculateAllData, filterData, findColumnName } from './utils/calculations';
import { calculateProjectScores, generateExpertAnalysis } from './utils/scoring';
import { US_CITIES } from './constants/cities';
import { scoringWeights, sortableColumns } from './constants/scoringWeights';
import { ISO_COLORS, TECH_COLORS } from './constants/colors';
import ApprovalSuccess from './components/ApprovalSuccess';
import { useAuth } from './contexts/AuthContext';

function DashboardContent() {
  // Data states
  const [kpiRow1, setKpiRow1] = useState([]);
  const [kpiRow2, setKpiRow2] = useState([]);
  const [isoData, setIsoData] = useState([]);
  const [techData, setTechData] = useState([]);
  const [redevelopmentTypes, setRedevelopmentTypes] = useState([]);
  const [counterparties, setCounterparties] = useState([]);
  const [pipelineRows, setPipelineRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectDetail, setShowProjectDetail] = useState(false);

  // Edit/Delete states
  const [editingProject, setEditingProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Expert analysis states
  const [showExpertScores, setShowExpertScores] = useState(false);
  const [selectedExpertProject, setSelectedExpertProject] = useState(null);
  const [expertAnalysisFilter, setExpertAnalysisFilter] = useState("all");
  
  // Filter states
  const [selectedIso, setSelectedIso] = useState("All");
  const [selectedProcess, setSelectedProcess] = useState("All");
  const [selectedOwner, setSelectedOwner] = useState("All");
  const [selectedTransmissionVoltage, setSelectedTransmissionVoltage] = useState("All");
  const [selectedHasExcessCapacity, setSelectedHasExcessCapacity] = useState("All");
  const [selectedProjectType, setSelectedProjectType] = useState("All");
  // Chart-based filter states
  const [activeTechFilter, setActiveTechFilter] = useState(null);
  const [activeIsoFilter, setActiveIsoFilter] = useState(null);
  const [activeRedevFilter, setActiveRedevFilter] = useState(null);
  const [activeCounterpartyFilter, setActiveCounterpartyFilter] = useState(null);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  const [allOwners, setAllOwners] = useState([]);
  const [allVoltages, setAllVoltages] = useState(["All"]);
  const [allData, setAllData] = useState([]);
  const [projectTransmissionData, setProjectTransmissionData] = useState({});
  const [dropdownOptions, setDropdownOptions] = useState({
    // From lookup tables:
    projectTypeOptions: [],
    redevFuelOptions: [],
    redevelopmentBaseOptions: [],
    redevLeadOptions: [],
    redevSupportOptions: [],
    coLocateRepowerOptions: [],
    maTierOptions: [], // NEW: M&A Tier options
    
    // From distinct values:
    plantOwners: [],
    technologyOptions: [],
    fuelTypes: [],
    isoOptions: [],
    
    // Fixed options:
    processOptions: ["P", "B"],
    redevTechOptions: ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"],
    redevTierOptions: ["0", "1", "2", "3", "I", "II", "III", "IV", "V"],
    redevLandControlOptions: ["Y", "N"],
    redevStageGateOptions: ["0", "1", "2", "3", "P"]
  });
  
  // Modal states
  const [showScoringPanel, setShowScoringPanel] = useState(false);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false); 
  const [showUploadModal, setShowUploadModal] = useState(false); 
  
  const [showActivityLog, setShowActivityLog] = useState(false);

  const [sortConfig, setSortConfig] = useState({
    column: null,
    direction: 'none',
  });

  const [autoSortedPipelineRows, setAutoSortedPipelineRows] = useState([]);

  // Add Site Modal State - UPDATED: Added ma_tier and status fields
  const [newSiteData, setNewSiteData] = useState({
    project_name: "",
    project_codename: "",
    plant_owner: "",
    location: "",
    legacy_nameplate_capacity_mw: "",
    tech: "",
    heat_rate_btu_kwh: "",
    capacity_factor_2024: "",
    legacy_cod: "",
    fuel: "",
    site_acreage: "",
    iso: "",
    zone_submarket: "",
    markets: "",
    process_type: "",
    gas_reference: "",
    redevelopment_base_case: "",
    redev_cod: "",
    thermal_optimization: "",
    co_locate_repower: "",
    contact: "",
    overall_project_score: "",
    thermal_operating_score: "",
    redevelopment_score: "",
    redevelopment_load_score: "",
    ic_score: "",
    environmental_score: "",
    market_score: "",
    redev_tier: "",
    redev_capacity_mw: "",
    redev_tech: "",
    redev_fuel: "",
    redev_heatrate_btu_kwh: "",
    redev_land_control: "",
    redev_stage_gate: "",
    redev_lead: "",
    redev_support: "",
    project_type: "",
    status: "",
    ma_tier: "", // NEW: M&A Tier field
    transactability_scores: "",
    transactability: ""
  });

  // Auth context
  const { token } = useAuth();

  // ============================================================================
  // NEW: ADDED MISSING API CALL FUNCTIONS
  // ============================================================================

  // Fetch expert analysis for a project
  const fetchExpertAnalysis = async (projectId) => {
    try {
      console.log(`[Frontend] Fetching expert analysis for project ID: ${projectId}`);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/expert-analysis?projectId=${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch expert analysis: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Frontend] Expert analysis data received:', data);

      // Extract actual data from API response wrapper { success: true, data: {...} }
      if (data && data.success && data.data) {
        return data.data;
      }
      return data;
    } catch (error) {
      console.error('[Frontend] Error fetching expert analysis:', error);
      return null;
    }
  };

  // Save expert analysis
  const saveExpertAnalysis = async (analysisData) => {
    try {
      console.log('[Frontend] Saving expert analysis:', analysisData);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/expert-analysis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(analysisData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Frontend] Save failed:', errorText);
        throw new Error(`Failed to save expert analysis: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Frontend] Expert analysis saved successfully:', data);

      // Extract actual data from API response wrapper { success: true, data: {...} }
      if (data && data.success && data.data) {
        return data.data;
      }
      return data;
    } catch (error) {
      console.error('[Frontend] Error saving expert analysis:', error);
      throw error;
    }
  };

  // Fetch transmission interconnection data
  const fetchTransmissionInterconnection = async (projectNameOrId, useProjectId = false) => {
    try {
      console.log(`[Frontend] Fetching transmission data for project: ${projectNameOrId} (useProjectId: ${useProjectId})`);

      // Build the URL with either project name or project ID
      const queryParam = useProjectId
        ? `projectId=${encodeURIComponent(projectNameOrId)}`
        : `project=${encodeURIComponent(projectNameOrId)}`;

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/transmission-interconnection?${queryParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log(`[Frontend] Transmission data not found for ${projectNameOrId}, status: ${response.status}`);
        return [];
      }
      
      const result = await response.json();
      console.log('[Frontend] Transmission API response:', result);
      
      // Extract data from the response structure
      let transmissionArray = [];
      
      if (result.success && Array.isArray(result.data)) {
        transmissionArray = result.data;
      } else if (Array.isArray(result)) {
        transmissionArray = result;
      } else if (result.data && Array.isArray(result.data)) {
        transmissionArray = result.data;
      }
      
      console.log(`[Frontend] Found ${transmissionArray.length} transmission records for ${projectNameOrId}`);
      
      // Transform data to frontend format
      const transformedData = transmissionArray.map(item => ({
        site: item.site || '',
        poiVoltage: item.poiVoltage || item.poi_voltage || '',
        excessInjectionCapacity: item.excessInjectionCapacity || item.excess_injection_capacity || 0,
        excessWithdrawalCapacity: item.excessWithdrawalCapacity || item.excess_withdrawal_capacity || 0,
        constraints: item.constraints || '-',
        excessIXCapacity: item.excessIXCapacity || item.excess_ix_capacity || true,
        project_id: item.projectId || item.project_id || null
      }));
      
      console.log('[Frontend] Transformed transmission data:', transformedData);
      return transformedData;
    } catch (error) {
      console.error('[Frontend] Error fetching transmission data:', error);
      return [];
    }
  };

  // Save transmission interconnection data
  const saveTransmissionInterconnection = async (projectId, transmissionData) => {
    try {
      console.log(`[Frontend] Saving transmission data for project ${projectId}:`, transmissionData);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/transmission-interconnection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          transmissionData
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Frontend] Save transmission failed:', errorText);
        throw new Error(`Failed to save transmission data: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Frontend] Transmission data saved successfully:', data);
      return data;
    } catch (error) {
      console.error('[Frontend] Error saving transmission data:', error);
      throw error;
    }
  };

  // Test API endpoints
  const testEndpoints = async () => {
    console.log('[Frontend] Testing API endpoints...');
    
    try {
      // Test expert analysis GET
      console.log('[Frontend] Testing GET /api/expert-analysis?projectId=33');
      const expertResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/expert-analysis?projectId=33`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('[Frontend] Expert analysis GET status:', expertResponse.status);
      if (expertResponse.ok) {
        const expertData = await expertResponse.json();
        console.log('[Frontend] Expert analysis data:', expertData);
      }
      
      // Test transmission GET
      console.log('[Frontend] Testing GET /api/transmission-interconnection?project=Dartmouth');
      const transmissionResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/transmission-interconnection?project=Dartmouth`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('[Frontend] Transmission GET status:', transmissionResponse.status);
      if (transmissionResponse.ok) {
        const transmissionData = await transmissionResponse.json();
        console.log('[Frontend] Transmission data:', transmissionData);
      }
      
      console.log('[Frontend] API endpoint tests completed');
    } catch (error) {
      console.error('[Frontend] Test failed:', error);
    }
  };

  // ============================================================================
  // END OF NEW API CALL FUNCTIONS
  // ============================================================================

  // NEW: Function to refresh expert data - FIXED VERSION
  const refreshExpertData = async () => {
    console.log('🔄 DashboardContent: Refreshing expert data...');
    try {
      // Only dispatch event, don't call fetchData()
      window.dispatchEvent(new Event('expertAnalysisUpdated'));
      console.log('✅ DashboardContent: Expert refresh event dispatched');
    } catch (error) {
      console.error('❌ DashboardContent: Error refreshing expert data:', error);
    }
  };

  // NEW: Function to handle expert analysis save success
  const handleExpertSaveSuccess = useCallback((updatedProject) => {
    console.log('✅ Dashboard: Expert analysis saved successfully:', updatedProject);
    
    if (!updatedProject || !updatedProject.id) {
      console.error('❌ No project ID in updated project:', updatedProject);
      return;
    }
    
    // Update the allData state with the saved expert analysis
    setAllData(prevData => {
      const updatedAllData = prevData.map(project => {
        if (project.id === updatedProject.id) {
          // Merge the updated expert analysis with existing project data
          const updatedProj = {
            ...project,
            expertAnalysis: updatedProject.expertAnalysis,
            // Also update the scores in the main data
            "Overall Project Score": updatedProject.expertAnalysis?.overallScore || project["Overall Project Score"],
            "Thermal Operating Score": updatedProject.expertAnalysis?.thermalScore || project["Thermal Operating Score"],
            "Redevelopment Score": updatedProject.expertAnalysis?.redevelopmentScore || project["Redevelopment Score"],
            // Update other fields that might have changed
            "Thermal Optimization": updatedProject.expertAnalysis?.thermalBreakdown?.thermal_optimization?.score || project["Thermal Optimization"],
            "Environmental Score": updatedProject.expertAnalysis?.thermalBreakdown?.environmental?.score || project["Environmental Score"],
            "Market Score": updatedProject.expertAnalysis?.redevelopmentBreakdown?.redev_market?.score || project["Market Score"],
            "I&C Score": updatedProject.expertAnalysis?.redevelopmentBreakdown?.interconnection?.score || project["I&C Score"]
          };
          
          console.log('🔄 Updated project in allData:', updatedProj.id, updatedProj.expertAnalysis);
          return updatedProj;
        }
        return project;
      });
      
      console.log('🔄 Updated allData with expert analysis changes');
      return updatedAllData;
    });
    
    // Also update the selectedExpertProject state so it has the latest data
    setSelectedExpertProject(prev => {
      if (prev && prev.id === updatedProject.id) {
        const updated = {
          ...prev,
          expertAnalysis: updatedProject.expertAnalysis
        };
        console.log('🔄 Updated selectedExpertProject with new analysis');
        return updated;
      }
      return prev;
    });
    
    // Show success notification
    setNotification({
      show: true,
      message: 'Expert analysis saved successfully!',
      type: 'success'
    });
    
    // Trigger a refresh of the expert scores panel
    window.dispatchEvent(new CustomEvent('expertAnalysisUpdated', {
      detail: { projectId: updatedProject.id }
    }));
    
  }, []);

  // Extract dropdown options for use in components
  const {
    // From lookup tables:
    projectTypeOptions = [],
    redevFuelOptions = [],
    redevelopmentBaseOptions = [],
    redevLeadOptions = [],
    redevSupportOptions = [],
    coLocateRepowerOptions = [],
    maTierOptions = [], // NEW: M&A Tier options
    
    // From distinct values:
    plantOwners = [],
    technologyOptions = [],
    fuelTypes = [],
    isoOptions = [],
    
    // Fixed options:
    processOptions = ["P", "B"],
    redevTechOptions = ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"],
    redevTierOptions = ["0", "1", "2", "3", "I", "II", "III", "IV", "V"],
    redevLandControlOptions = ["Y", "N"],
    redevStageGateOptions = ["0", "1", "2", "3", "P"]
  } = dropdownOptions;

  const excessCapacityOptions = ["All", "Yes", "No"];

  // Transmission data mapping
  const TRANSMISSION_DATA_MAP = {
    "Shoemaker": "69 kV|143.9|144.2|-|true;138 kV|549.5|95.5|-|true",
    "Hillburn": "69 kV|137.0|362.3|-|true;138 kV|337.7|138.5|-|true", 
    "Massena": "115 kV|553.4|145.0|1|true",
    "Ogdensburg": "115 kV|46.4|33.2|1|true",
    "Allegany": "115 kV|21.5|136.0|13|true",
    "Batavia": "115 kV|8.8|176.1|8|true",
    "Sterling": "115 kV|385.6|45.2|7|true",
    "Carthage": "115 kV|538.5|193.8|31|true",
  };

  // NEW: Helper functions for Redev Lead/Support lookup tables
  const checkAndAddToLeadOptions = async (leadName) => {
    if (!leadName || leadName.trim() === "") return;
    
    try {
      console.log('🔍 Checking if lead exists:', leadName);
      
      // Check if lead exists
      const checkResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/redev-leads/check?name=${encodeURIComponent(leadName)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (checkResponse.ok) {
        const { exists } = await checkResponse.json();
        console.log('✅ Lead check result:', { leadName, exists });
        
        if (!exists) {
          // Add new lead to lookup table
          console.log('➕ Adding new lead to lookup table:', leadName);
          const addResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/redev-leads`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lead_name: leadName })
          });
          
          if (addResponse.ok) {
            console.log('✅ Lead added successfully:', leadName);
            // Refresh dropdown options
            await fetchDropdownOptions();
          } else {
            console.error('❌ Failed to add lead:', addResponse.status);
          }
        }
      } else {
        console.warn('⚠️ Lead check API failed:', checkResponse.status);
      }
    } catch (error) {
      console.error('❌ Error adding to lead options:', error);
      // Don't block the main operation if this fails
    }
  };

  const checkAndAddToSupportOptions = async (supportName) => {
    if (!supportName || supportName.trim() === "") return;
    
    try {
      console.log('🔍 Checking if support exists:', supportName);
      
      // Support can be comma-separated multiple values
      const supportNames = supportName.split(',').map(s => s.trim()).filter(s => s);
      
      for (const name of supportNames) {
        // Check if support exists
        const checkResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/redev-supports/check?name=${encodeURIComponent(name)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        if (checkResponse.ok) {
          const { exists } = await checkResponse.json();
          console.log('✅ Support check result:', { name, exists });
          
          if (!exists) {
            // Add new support to lookup table
            console.log('➕ Adding new support to lookup table:', name);
            const addResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/redev-supports`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ support_name: name })
            });
            
            if (!addResponse.ok) {
              console.error('❌ Failed to add support:', addResponse.status);
            }
          }
        } else {
          console.warn('⚠️ Support check API failed:', checkResponse.status);
        }
      }
      
      // Refresh dropdown options
      await fetchDropdownOptions();
      
    } catch (error) {
      console.error('❌ Error adding to support options:', error);
      // Don't block the main operation if this fails
    }
  };

  // NEW: Custom sorting function for Redev Tier (ascending: 0, I, II, etc.)
  const sortRedevTier = (a, b) => {
    const tierOrder = {
      '0': 0, 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
      'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5
    };
    
    const getTierValue = (tier) => {
      if (tier === undefined || tier === null || tier === '' || tier === '') return 999; // Put empty/undefined at end
      const tierStr = String(tier).trim();
      return tierOrder[tierStr] !== undefined ? tierOrder[tierStr] : 999;
    };
    
    const aValue = getTierValue(a);
    const bValue = getTierValue(b);
    
    return aValue - bValue; // Ascending order
  };

  // NEW: Custom sorting function for M&A Tier with custom order
  const sortMaTier = (a, b) => {
    const maTierOrder = {
      'owned': 0,
      'exclusivity': 1,
      'second round': 2,
      'first round': 3,
      'pipeline': 4,
      'passed': 5
    };
    
    const getMaTierValue = (tier) => {
      if (!tier) return 999;
      const tierStr = String(tier).trim().toLowerCase();
      return maTierOrder[tierStr] !== undefined ? maTierOrder[tierStr] : 999;
    };
    
    const aValue = getMaTierValue(a);
    const bValue = getMaTierValue(b);
    
    return aValue - bValue; // Ascending order based on the custom order
  };

  // NEW: Function to automatically sort pipeline rows based on project type filter
  const getAutoSortedPipelineRows = (rows, projectType) => {
    if (!rows || rows.length === 0) return rows;
    
    // Create a copy to avoid mutating the original
    let sortedRows = [...rows];
    
    // Apply automatic sorting based on selected project type
    if (projectType === 'Redev') {
      // Sort Redev projects by Redev Tier ascending
      sortedRows = sortedRows.sort((a, b) => {
        return sortRedevTier(a.redevTier, b.redevTier);
      });
    } else if (projectType === 'M&A') {
      // Sort M&A projects by M&A Tier in custom order
      sortedRows = sortedRows.sort((a, b) => {
        return sortMaTier(a.maTier, b.maTier);
      });
    }
    // For "All" or "Owned" project types, no automatic sorting
    
    return sortedRows;
  };

  // NEW: Function to apply automatic sorting when filters change
  const applyAutomaticSorting = (rows) => {
    const sortedRows = getAutoSortedPipelineRows(rows, selectedProjectType);
    setAutoSortedPipelineRows(sortedRows);
  };

  // NEW: useEffect to apply automatic sorting when pipelineRows or selectedProjectType changes
  useEffect(() => {
    if (pipelineRows && pipelineRows.length > 0) {
      applyAutomaticSorting(pipelineRows);
    }
  }, [pipelineRows, selectedProjectType]);

  // UPDATED: Modified getSortedPipelineRows to use auto-sorted rows when applicable
  const getSortedPipelineRows = () => {
    // Start with auto-sorted rows if available
    const rowsToSort = autoSortedPipelineRows.length > 0 ? [...autoSortedPipelineRows] : [...pipelineRows];
    
    // If manual sorting is active, apply it on top of auto-sorting
    if (!sortConfig.column || sortConfig.direction === 'none') {
      return rowsToSort;
    }
    
    const column = sortableColumns.find(col => col.key === sortConfig.column);
    if (!column) return rowsToSort;
    
    return rowsToSort.sort((a, b) => {
      let aValue = a[sortConfig.column];
      let bValue = b[sortConfig.column];
      
      if (aValue == null) aValue = column.type === 'string' ? '' : 0;
      if (bValue == null) bValue = column.type === 'string' ? '' : 0;
      
      // Special handling for Redev Tier when manually sorting
      if (sortConfig.column === 'redevTier') {
        const tierOrder = {
          '0': 0, 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
          '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
          'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5
        };
        
        const getTierValue = (tier) => {
          if (tier === undefined || tier === null || tier === '') return 999;
          const tierStr = String(tier).trim();
          return tierOrder[tierStr] !== undefined ? tierOrder[tierStr] : 999;
        };
        
        const aTierValue = getTierValue(aValue);
        const bTierValue = getTierValue(bValue);
        
        return sortConfig.direction === 'asc' ? aTierValue - bTierValue : bTierValue - aTierValue;
      }
      
      // Special handling for M&A Tier when manually sorting
      if (sortConfig.column === 'maTier') {
        const maTierOrder = {
          'owned': 0,
          'exclusivity': 1,
          'second round': 2,
          'first round': 3,
          'pipeline': 4,
          'passed': 5
        };
        
        const getMaTierValue = (tier) => {
          if (!tier) return 999;
          const tierStr = String(tier).trim().toLowerCase();
          return maTierOrder[tierStr] !== undefined ? maTierOrder[tierStr] : 999;
        };
        
        const aTierValue = getMaTierValue(aValue);
        const bTierValue = getMaTierValue(bValue);
        
        return sortConfig.direction === 'asc' ? aTierValue - bTierValue : bTierValue - aTierValue;
      }
      
      if (sortConfig.column === 'cf') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }
      
      if (column.type === 'string') {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
        
        if (sortConfig.direction === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }
      
      if (column.type === 'number') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
        
        if (sortConfig.direction === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
      
      return 0;
    });
  };

  // NEW: Comprehensive status calculation function
  const calculateStatusFromCODs = (legacyCOD, redevCOD) => {
    const currentYear = new Date().getFullYear();
    
    // Helper function to extract year from COD string
    const extractYearFromCOD = (codValue) => {
      if (!codValue || codValue.toString().trim() === "") {
        return null;
      }
      
      const codString = codValue.toString().trim();
      const yearMatch = codString.match(/\b(\d{4})\b/);
      if (!yearMatch) {
        return null;
      }
      
      const year = parseInt(yearMatch[1]);
      return isNaN(year) ? null : year;
    };
    
    // Try Redev COD first (most recent/planned)
    const redevYear = extractYearFromCOD(redevCOD);
    if (redevYear !== null) {
      if (redevYear < currentYear) {
        return "Operating";
      } else if (redevYear > currentYear) {
        return "Future";
      } else {
        return "Operating"; // Current year
      }
    }
    
    // If no Redev COD, try Legacy COD
    const legacyYear = extractYearFromCOD(legacyCOD);
    if (legacyYear !== null) {
      if (legacyYear < currentYear) {
        return "Operating";
      } else if (legacyYear > currentYear) {
        return "Future";
      } else {
        return "Operating"; // Current year
      }
    }
    
    // If no valid years found in either COD
    return "Unknown";
  };

  // UPDATED: Include all filter states in currentFilters
  const currentFilters = {
    selectedIso,
    selectedProcess,
    selectedOwner,
    selectedTransmissionVoltage,
    selectedHasExcessCapacity,
    selectedProjectType,
    activeTechFilter,
    activeIsoFilter,
    activeRedevFilter,
    activeCounterpartyFilter
  };
  
  // Filter handlers for chart-based filtering
  const handleFilterByTech = (tech) => {
    setActiveTechFilter(activeTechFilter === tech ? null : tech);
  };
  
  // NEW: Filter handler for ISO/RTO
  const handleFilterByIso = (iso) => {
    setActiveIsoFilter(activeIsoFilter === iso ? null : iso);
  };
  
  // NEW: Filter handler for Redevelopment Types
  const handleFilterByRedev = (redevType) => {
    setActiveRedevFilter(activeRedevFilter === redevType ? null : redevType);
  };
  
  // NEW: Filter handler for Counterparty
  const handleFilterByCounterparty = (counterparty) => {
    setActiveCounterpartyFilter(activeCounterpartyFilter === counterparty ? null : counterparty);
  };
  
  // UPDATED: Clear all filters including chart-based filters
  const clearAllFilters = () => {
    setSelectedIso("All");
    setSelectedProcess("All");
    setSelectedOwner("All");
    setSelectedTransmissionVoltage("All");
    setSelectedHasExcessCapacity("All");
    setSelectedProjectType("All");
    setActiveTechFilter(null);
    setActiveIsoFilter(null);
    setActiveRedevFilter(null);
    setActiveCounterpartyFilter(null);
    // Reset manual sorting when clearing filters
    setSortConfig({ column: null, direction: 'none' });
  };

  const handleEditProject = (project) => {
    console.log('🎯 handleEditProject called with:', project);
    
    // Try multiple ways to find the project data
    const fullProjectData = allData.find(row => 
      row.id === project.id || 
      row.project_id === project.id ||
      row["Project Name"] === project.asset ||
      row.project_name === project.asset ||
      row.project_codename === project.codename
    ) || project.detailData || project;
    
    setEditingProject(fullProjectData);
    setShowEditModal(true);
  };

  const handleDeleteProject = async (projectId) => {
    console.log('🗑️ handleDeleteProject called with ID:', projectId);
    
    const projectToDelete = pipelineRows.find(row => row.id === projectId);
    
    if (!projectToDelete) {
      alert('Project not found!');
      return;
    }
    
    const projectName = projectToDelete.asset || projectToDelete.project_name || `Project ${projectId}`;
    
    if (window.confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/projects/${projectId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete project: ${response.statusText}`);
        }
        
        // Remove from local state
        const updatedAllData = allData.filter(row => row.id !== projectId);
        const updatedPipelineRows = pipelineRows.filter(row => row.id !== projectId);
        
        setAllData(updatedAllData);
        setPipelineRows(updatedPipelineRows);
        
        // Recalculate data
        const headers = Object.keys(updatedAllData[0] || {});
        calculateAllData(updatedAllData, headers, {
          setKpiRow1, setKpiRow2, setIsoData, setTechData, 
          setRedevelopmentTypes, setCounterparties, setPipelineRows
        });
        
        alert(`Project "${projectName}" deleted successfully!`);
      } catch (error) {
        console.error('Delete project error:', error);
        alert(`Failed to delete project: ${error.message}`);
      }
    }
  };

  // Simple notification function
  const showAlert = (message, type = 'success') => {
    // Create a simple alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `simple-alert simple-alert-${type}`;
    alertDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'} ${message}
      </div>
    `;
    
    // Add CSS for animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
      alertDiv.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.parentNode.removeChild(alertDiv);
        }
      }, 300);
    }, 3000);
  };

const handleUpdateProject = async (updatedData) => {
  console.log('🔄 handleUpdateProject called with:', updatedData);
  
  // Get projectId from multiple possible sources
  const projectId = updatedData.id || updatedData.project_id || updatedData.detailData?.id;
  
  if (!projectId) {
    // Show error notification
    setNotification({
      show: true,
      message: 'Project ID is required for update!',
      type: 'error'
    });
    console.error('No project ID found in data:', updatedData);
    return;
  }
  
  console.log('Updating project ID:', projectId);
  
  try {
    // 🔥 NEW: Check and add new Redev Lead/Support to lookup tables
    const redevLead = updatedData["Redev Lead"] || updatedData.redev_lead || updatedData.redevLead;
    const redevSupport = updatedData["Redev Support"] || updatedData.redev_support || updatedData.redevSupport;
    
    if (redevLead && redevLead.trim()) {
      await checkAndAddToLeadOptions(redevLead.trim());
    }
    
    if (redevSupport && redevSupport.trim()) {
      await checkAndAddToSupportOptions(redevSupport.trim());
    }
    
    // Transform form data to match EXACT database schema
    const backendData = {
      // Basic Information (from database schema)
      project_name: updatedData["Project Name"] || updatedData.project_name || null,
      project_codename: updatedData["Project Codename"] || updatedData.project_codename || null,
      plant_owner: updatedData["Plant Owner"] || updatedData.plant_owner || null,
      location: updatedData["Location"] || updatedData.location || null,
      site_acreage: updatedData["Site Acreage"] || updatedData.site_acreage || null,
      status: updatedData["Status"] || updatedData.status || null,
      ma_tier: updatedData["M&A Tier"] || updatedData.ma_tier || null,
      
      // Technical Details
      legacy_nameplate_capacity_mw: updatedData["Legacy Nameplate Capacity (MW)"] || updatedData.mw || null,
      tech: updatedData["Tech"] || updatedData.tech || null,
      heat_rate_btu_kwh: updatedData["Heat Rate (Btu/kWh)"] || updatedData.hr || null,
      capacity_factor_2024: updatedData["2024 Capacity Factor"] || updatedData.cf || null,
      legacy_cod: updatedData["Legacy COD"] || updatedData.cod || null,
      fuel: updatedData["Fuel"] || updatedData.fuel || null,
      
      // Market Details
      iso: updatedData["ISO"] || updatedData.mkt || null,
      zone_submarket: updatedData["Zone/Submarket"] || updatedData.zone || null,
      markets: updatedData["Markets"] || updatedData.markets || null,
      process_type: updatedData["Process (P) or Bilateral (B)"] || updatedData.process || null,
      gas_reference: updatedData["Gas Reference"] || updatedData.gas_reference || null,
      transactability: updatedData["Transactability"] || updatedData.transactability || null,
      
      // Redevelopment Details
      redev_tier: updatedData["Redev Tier"] || updatedData.redev_tier || null,
      redevelopment_base_case: updatedData["Redevelopment Base Case"] || updatedData.redev_base_case || null,
      redev_capacity_mw: updatedData["Redev Capacity (MW)"] || updatedData.redev_capacity || null,
      redev_tech: updatedData["Redev Tech"] || updatedData.redev_tech || null,
      redev_fuel: updatedData["Redev Fuel"] || updatedData.redev_fuel || null,
      redev_heatrate_btu_kwh: updatedData["Redev Heatrate (Btu/kWh)"] || updatedData.redev_heatrate || null,
      redev_cod: updatedData["Redev COD"] || updatedData.redev_cod || null,
      redev_land_control: updatedData["Redev Land Control"] || updatedData.redev_land_control || null,
      redev_stage_gate: updatedData["Redev Stage Gate"] || updatedData.redev_stage_gate || null,
      redev_lead: updatedData["Redev Lead"] || updatedData.redev_lead || null,
      redev_support: updatedData["Redev Support"] || updatedData.redev_support || null,
      co_locate_repower: updatedData["Co-Locate/Repower"] || updatedData.co_locate_repower || null,
      
      // Additional Information
      contact: updatedData["Contact"] || updatedData.contact || null,
      project_type: updatedData["Project Type"] || updatedData.project_type || null,
      
      // Scores - ONLY include if they exist in form
      overall_project_score: updatedData.overall_project_score || updatedData.overall || null,
      thermal_operating_score: updatedData.thermal_operating_score || updatedData.thermal || null,
      redevelopment_score: updatedData.redevelopment_score || updatedData.redev || null,
    };
    
    // Parse numeric fields properly
    const parseNumericField = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    };
    
    // Apply numeric parsing to specific fields
    backendData.legacy_nameplate_capacity_mw = parseNumericField(backendData.legacy_nameplate_capacity_mw);
    backendData.heat_rate_btu_kwh = parseNumericField(backendData.heat_rate_btu_kwh);
    backendData.capacity_factor_2024 = parseNumericField(backendData.capacity_factor_2024);
    backendData.redev_capacity_mw = parseNumericField(backendData.redev_capacity_mw);
    backendData.redev_heatrate_btu_kwh = parseNumericField(backendData.redev_heatrate_btu_kwh);
    backendData.overall_project_score = parseNumericField(backendData.overall_project_score);
    backendData.thermal_operating_score = parseNumericField(backendData.thermal_operating_score);
    backendData.redevelopment_score = parseNumericField(backendData.redevelopment_score);
    
    // Parse transactability as integer
    if (backendData.transactability) {
      const transactInt = parseInt(backendData.transactability);
      backendData.transactability = isNaN(transactInt) ? null : transactInt;
    }
    
    // Remove any fields that are explicitly null or undefined
    const cleanData = {};
    Object.keys(backendData).forEach(key => {
      if (backendData[key] !== null && backendData[key] !== undefined) {
        cleanData[key] = backendData[key];
      }
    });
    
    // CRITICAL: Remove the id field from the request body
    // The id should only be in the URL, not the request body
    delete cleanData.id;
    delete cleanData.project_id;
    
    console.log('🔄 Sending to backend:', cleanData);
    console.log('📊 Field count:', Object.keys(cleanData).length);
    console.log('🚀 PUT request to:', `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/projects/${projectId}`);
    
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cleanData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Server error response:', errorText);
      
      // Show error notification
      setNotification({
        show: true,
        message: `Failed to update project: ${response.statusText}`,
        type: 'error'
      });
      
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`Failed to update project: ${errorJson.message || response.statusText}`);
      } catch (e) {
        throw new Error(`Failed to update project: ${response.status} ${response.statusText}\n${errorText.substring(0, 200)}`);
      }
    }
    
    const updatedProject = await response.json();
    console.log('✅ Update response:', updatedProject);
    
    // 🔥 CRITICAL FIX: Show immediate success alert
    window.alert(`✅ Project "${updatedProject.project_name || updatedData["Project Name"]}" has been successfully updated!`);
    
    setShowEditModal(false);
    setEditingProject(null);
    
    // 🔥 CRITICAL FIX: RE-FETCH ALL DATA FROM BACKEND
    // This ensures the table updates automatically without browser refresh
    await fetchData();
    
    // Show success notification
    setNotification({
      show: true,
      message: `Project "${updatedProject.project_name || updatedData["Project Name"]}" updated successfully!`,
      type: 'success'
    });
    
  } catch (error) {
    console.error('❌ Update project error:', error);
    
    // Show error alert
    window.alert(`❌ Failed to update project: ${error.message}`);
    
    setNotification({
      show: true,
      message: `Failed to update project: ${error.message}`,
      type: 'error'
    });
  }
};

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingProject(null);
  };

  // Sorting functions
  const handleSort = (columnKey) => {
    setSortConfig(prevConfig => {
      if (prevConfig.column === columnKey) {
        switch (prevConfig.direction) {
          case 'asc':
            return { column: columnKey, direction: 'desc' };
          case 'desc':
            return { column: columnKey, direction: 'none' };
          default:
            return { column: columnKey, direction: 'asc' };
        }
      } else {
        return { column: columnKey, direction: 'asc' };
      }
    });
  };

  const resetSort = () => {
    setSortConfig({ column: null, direction: 'none' });
  };

  const getSortDirectionClass = (columnKey) => {
    if (sortConfig.column === columnKey) {
      return `sort-${sortConfig.direction}`;
    }
    return 'sort-none';
  };

  // Filter functions
  const handleIsoFilter = (iso) => {
    setSelectedIso(iso);
  };

  const handleProcessFilter = (process) => {
    setSelectedProcess(process);
  };

  const handleOwnerFilter = (owner) => {
    setSelectedOwner(owner);
  };

  const handleTransmissionVoltageFilter = (voltage) => {
    setSelectedTransmissionVoltage(voltage);
  };

  const handleHasExcessCapacityFilter = (hasExcess) => {
    setSelectedHasExcessCapacity(hasExcess);
  };

  // ADDED: Project Type filter handler
  const handleProjectTypeFilter = (type) => {
    setSelectedProjectType(type);
    // Reset manual sorting when changing project type
    setSortConfig({ column: null, direction: 'none' });
  };

  // Parse transmission data
  const parseTransmissionData = (transmissionStr) => {
    if (!transmissionStr || transmissionStr.toString().trim() === "") {
      return [];
    }
    
    const str = transmissionStr.toString().trim();
    
    try {
      return str.split(';').map(point => {
        const parts = point.split('|');
        if (parts.length >= 5) {
          return {
            voltage: parts[0].trim(),
            injectionCapacity: parseFloat(parts[1]) || 0,
            withdrawalCapacity: parseFloat(parts[2]) || 0,
            constraints: parts[3].trim(),
            hasExcessCapacity: parts[4].toLowerCase() === 'true' || parts[4] === '1'
          };
        }
        return null;
      }).filter(point => point !== null);
    } catch (error) {
      console.error('Error parsing transmission data:', error, 'String:', str);
      return [];
    }
  };

  // Event handlers
  const normalizeKey = (v) => (v ?? '').toString().trim().toLowerCase();

  const findExcelRowForProject = (projectName) => {
    const key = normalizeKey(projectName);
    if (!key) return null;

    return (
      allData.find(r => normalizeKey(r.project_name) === key) ||
      allData.find(r => normalizeKey(r["Project Name"]) === key) ||
      allData.find(r => normalizeKey(r.project_codename) === key) ||
      null
    );
  };

  const handleProjectClick = (project) => {
    const projectName = project.asset || 
                       project.detailData?.project_name ||
                       project.detailData?.project_codename ||
                       "";
    
    let transmissionData = [];
    
    if (projectName && TRANSMISSION_DATA_MAP[projectName]) {
      transmissionData = parseTransmissionData(TRANSMISSION_DATA_MAP[projectName]);
    } else if (project.transmissionData && project.transmissionData.length > 0) {
      transmissionData = project.transmissionData;
    } else if (projectName && projectTransmissionData[projectName]) {
      transmissionData = projectTransmissionData[projectName];
    } else if (project.detailData?.transmission_data) {
      transmissionData = parseTransmissionData(project.detailData.transmission_data);
    }
    
    // Hydrate full detailData from the database row first
    const dbRow = findExcelRowForProject(projectName);

    // Create project with ALL data including redevelopment fields
    const projectWithTransmission = {
      ...project,
      transmissionData: transmissionData,

      // Make sure the modal receives the full database row
      detailData: {
        ...(dbRow || {}),
        ...(project.detailData || {}),
        // Include database column names for redevelopment and new fields
        redev_tier: (dbRow?.redev_tier && dbRow.redev_tier.toString().trim() !== "" 
                     ? dbRow.redev_tier 
                     : project.redevTier ?? project.detailData?.redev_tier ?? ""),
        redev_capacity_mw: (dbRow?.redev_capacity_mw && dbRow.redev_capacity_mw.toString().trim() !== "" 
                          ? dbRow.redev_capacity_mw 
                          : project.redevCapacity ?? project.detailData?.redev_capacity_mw ?? ""),
        redev_tech: (dbRow?.redev_tech && dbRow.redev_tech.toString().trim() !== "" 
                     ? dbRow.redev_tech 
                     : project.redevTech ?? project.detailData?.redev_tech ?? ""),
        redev_fuel: (dbRow?.redev_fuel && dbRow.redev_fuel.toString().trim() !== "" 
                     ? dbRow.redev_fuel 
                     : project.redevFuel ?? project.detailData?.redev_fuel ?? ""),
        redev_heatrate_btu_kwh: (dbRow?.redev_heatrate_btu_kwh && dbRow.redev_heatrate_btu_kwh.toString().trim() !== "" 
                               ? dbRow.redev_heatrate_btu_kwh 
                               : project.redevHeatrate ?? project.detailData?.redev_heatrate_btu_kwh ?? ""),
        redev_cod: (dbRow?.redev_cod && dbRow.redev_cod.toString().trim() !== "" 
                    ? dbRow.redev_cod 
                    : project.redevCOD ?? project.detailData?.redev_cod ?? ""),
        redev_land_control: (dbRow?.redev_land_control && dbRow.redev_land_control.toString().trim() !== "" 
                           ? dbRow.redev_land_control 
                           : project.redevLandControl ?? project.detailData?.redev_land_control ?? ""),
        redev_stage_gate: (dbRow?.redev_stage_gate && dbRow.redev_stage_gate.toString().trim() !== "" 
                         ? dbRow.redev_stage_gate 
                         : project.redevStageGate ?? project.detailData?.redev_stage_gate ?? ""),
        redev_lead: (dbRow?.redev_lead && dbRow.redev_lead.toString().trim() !== "" 
                     ? dbRow.redev_lead 
                     : project.redevLead ?? project.detailData?.redev_lead ?? ""),
        redev_support: (dbRow?.redev_support && dbRow.redev_support.toString().trim() !== "" 
                      ? dbRow.redev_support 
                      : project.redevSupport ?? project.detailData?.redev_support ?? ""),
        // NEW: M&A Tier field
        ma_tier: (dbRow?.ma_tier && dbRow.ma_tier.toString().trim() !== "" 
                 ? dbRow.ma_tier 
                 : project.maTier ?? project.detailData?.ma_tier ?? ""),
        project_type: (dbRow?.project_type && dbRow.project_type.toString().trim() !== "" 
                     ? dbRow.project_type 
                     : project.projectType ?? project.detailData?.project_type ?? ""),
        status: (dbRow?.status && dbRow.status.toString().trim() !== "" 
                ? dbRow.status 
                : project.status ?? project.detailData?.status ?? ""),
      }
    };
    
    console.log('🔍 DEBUG: Project data being sent to modal:', projectWithTransmission);
    console.log('🔍 DEBUG: Database row found:', dbRow);
    console.log('🔍 DEBUG: M&A Tier:', projectWithTransmission.detailData.ma_tier);
    
    setSelectedProject(projectWithTransmission);
    setShowProjectDetail(true);
  };

  const closeProjectDetail = () => {
    setShowProjectDetail(false);
    setSelectedProject(null);
  };

  const openAddSiteModal = () => {
    setShowAddSiteModal(true);
  };

  const closeAddSiteModal = () => {
    setShowAddSiteModal(false);
    setNewSiteData({
      project_name: "",
      project_codename: "",
      plant_owner: "",
      location: "",
      legacy_nameplate_capacity_mw: "",
      tech: "",
      heat_rate_btu_kwh: "",
      capacity_factor_2024: "",
      legacy_cod: "",
      fuel: "",
      site_acreage: "",
      iso: "",
      zone_submarket: "",
      markets: "",
      process_type: "",
      gas_reference: "",
      redevelopment_base_case: "",
      redev_cod: "",
      thermal_optimization: "",
      co_locate_repower: "",
      contact: "",
      overall_project_score: "",
      thermal_operating_score: "",
      redevelopment_score: "",
      redevelopment_load_score: "",
      ic_score: "",
      environmental_score: "",
      market_score: "",
      redev_tier: "",
      redev_capacity_mw: "",
      redev_tech: "",
      redev_fuel: "",
      redev_heatrate_btu_kwh: "",
      redev_land_control: "",
      redev_stage_gate: "",
      redev_lead: "",
      redev_support: "",
      project_type: "",
      status: "",
      ma_tier: "", // NEW: M&A Tier field
      transactability_scores: "",
      transactability: ""
    });
  };

  const handleInputChange = (field, value) => {
    setNewSiteData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddSiteSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Log the data being sent
      console.log("📤 Original form data:", newSiteData);
      
      // Clean the data - convert empty strings to null for database
      const cleanSiteData = {};
      Object.entries(newSiteData).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) {
          cleanSiteData[key] = null;
        } else {
          // Convert numeric fields if they contain numbers
          const numericFields = [
            'legacy_nameplate_capacity_mw', 'redev_capacity_mw',
            'heat_rate_btu_kwh', 'redev_heatrate_btu_kwh',
            'capacity_factor_2024', 'overall_project_score',
            'thermal_operating_score', 'redevelopment_score'
          ];
          
          if (numericFields.includes(key) && !isNaN(parseFloat(value))) {
            cleanSiteData[key] = parseFloat(value);
          } else {
            cleanSiteData[key] = value;
          }
        }
      });
      
      // 🔥 NEW: Check and add new Redev Lead/Support to lookup tables
      const redevLead = cleanSiteData.redev_lead || cleanSiteData.redevLead;
      const redevSupport = cleanSiteData.redev_support || cleanSiteData.redevSupport;
      
      if (redevLead && redevLead.trim()) {
        await checkAndAddToLeadOptions(redevLead.trim());
      }
      
      if (redevSupport && redevSupport.trim()) {
        await checkAndAddToSupportOptions(redevSupport.trim());
      }
      
      // Ensure status is calculated if not provided
      if (!cleanSiteData.status || cleanSiteData.status === "") {
        const calculatedStatus = calculateStatusFromCODs(
          cleanSiteData.legacy_cod || "", 
          cleanSiteData.redev_cod || ""
        );
        cleanSiteData.status = calculatedStatus || "Unknown";
      }
      
      // Set default scores if empty
      cleanSiteData.overall_project_score = cleanSiteData.overall_project_score || "0.0";
      cleanSiteData.thermal_operating_score = cleanSiteData.thermal_operating_score || "0.0";
      cleanSiteData.redevelopment_score = cleanSiteData.redevelopment_score || "0.0";
      
      console.log("📤 Cleaned data being sent to API:", cleanSiteData);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanSiteData)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        throw new Error(`Failed to add project: ${response.status} ${response.statusText}\nDetails: ${errorText}`);
      }
      
      const newProject = await response.json();
      
      // Add to local state
      const updatedData = [...allData, newProject];
      setAllData(updatedData);
      
      // Recalculate data
      const headers = Object.keys(updatedData[0] || {});
      calculateAllData(updatedData, headers, {
        setKpiRow1, setKpiRow2, setIsoData, setTechData, 
        setRedevelopmentTypes, setCounterparties, setPipelineRows
      });
      
      closeAddSiteModal();
      alert("Site added successfully!");
    } catch (error) {
      console.error('❌ Add site error:', error);
      alert(`Failed to add site: ${error.message}`);
    }
  };

  // Handler for scores submission (if using scoring modal)
  const handleScoresSubmitted = (scoringResult) => {
    console.log('Scores submitted:', scoringResult);
    setShowScoringModal(false);
    setSelectedExpertProject(scoringResult.project);
  };

  // Fetch dropdown options from database
  const fetchDropdownOptions = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      console.log('🔧 [DEBUG] Fetching dropdown options from:', `${API_BASE_URL}/api/dropdown-options`);
      
      const response = await fetch(`${API_BASE_URL}/api/dropdown-options`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const options = await response.json();
          console.log('✅ [DEBUG] Dropdown options received:', options);
          setDropdownOptions(options);
        } else {
          console.warn('⚠️ [DEBUG] Dropdown options API returned non-JSON response');
          extractDropdownOptionsFromData();
        }
      } else {
        console.warn('⚠️ [DEBUG] Dropdown options API failed:', response.status);
        extractDropdownOptionsFromData();
      }
    } catch (error) {
      console.error("❌ [DEBUG] Error fetching dropdown options:", error);
      extractDropdownOptionsFromData();
    }
  };

  // Extract dropdown options from existing data if API fails
  const extractDropdownOptionsFromData = () => {
    if (!allData.length) return;
    
    const techSet = new Set();
    const isoSet = new Set();
    const processSet = new Set();
    const fuelSet = new Set();
    const maTierSet = new Set(["Owned", "Exclusivity", "second round", "first round", "pipeline", "passed"]);
    const redevTechSet = new Set(["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"]);
    const redevFuelSet = new Set(["Gas", "Coal", "Oil", "Nuclear", "Biomass", "Diesel", "N/A"]);
    const redevTierSet = new Set(["0", "1", "2", "3"]);
    const redevLandControlSet = new Set(["Y", "N"]);
    const redevStageGateSet = new Set(["0", "1", "2", "3", "P"]);
    const coLocateRepowerSet = new Set();
    const redevelopmentBaseSet = new Set();
    
    allData.forEach(row => {
      if (row["Tech"]) techSet.add(row["Tech"]);
      if (row["ISO"]) isoSet.add(row["ISO"]);
      if (row["Process (P) or Bilateral (B)"]) processSet.add(row["Process (P) or Bilateral (B)"]);
      if (row["Fuel"]) fuelSet.add(row["Fuel"]);
      if (row["Redev Tech"]) redevTechSet.add(row["Redev Tech"]);
      if (row["Redev Fuel"]) {
        const fuels = row["Redev Fuel"].toString().split(',').map(f => f.trim()).filter(f => f);
        fuels.forEach(fuel => {
          if (fuel !== "NA") redevFuelSet.add(fuel);
        });
      }
      if (row["Redev Tier"]) redevTierSet.add(row["Redev Tier"]);
      if (row["Redev Land Control"]) redevLandControlSet.add(row["Redev Land Control"]);
      if (row["Redev Stage Gate"]) redevStageGateSet.add(row["Redev Stage Gate"]);
      if (row["Co-Locate/Repower"]) coLocateRepowerSet.add(row["Co-Locate/Repower"]);
      if (row["Redevelopment Base Case"]) {
        const bases = row["Redevelopment Base Case"].toString().split(/[\n\/]/).map(b => b.trim()).filter(b => b);
        bases.forEach(base => redevelopmentBaseSet.add(base));
      }
      // NEW: Extract M&A Tier from data
      if (row["M&A Tier"]) {
        const maTiers = row["M&A Tier"].toString().split(',').map(t => t.trim()).filter(t => t);
        maTiers.forEach(tier => maTierSet.add(tier));
      }
    });
    
    const extractedOptions = {
      projectTypeOptions: [{ type_name: "Redev" }, { type_name: "M&A" }, { type_name: "Owned" }],
      redevFuelOptions: Array.from(redevFuelSet).map(fuel => ({ fuel_name: fuel })),
      redevelopmentBaseOptions: Array.from(redevelopmentBaseSet).map(base => ({ base_case_name: base })),
      maTierOptions: Array.from(maTierSet).map(tier => ({ 
        value: tier, 
        color: tier === 'Owned' ? '#8b5cf6' : 
               tier === 'Exclusivity' ? '#10b981' : 
               tier === 'second round' ? '#3b82f6' : 
               tier === 'first round' ? '#f59e0b' : 
               tier === 'pipeline' ? '#6b7280' : 
               '#ef4444'
      })),
      redevLeadOptions: [],
      redevSupportOptions: [],
      coLocateRepowerOptions: Array.from(coLocateRepowerSet).map(option => ({ option_name: option })),
      plantOwners: allOwners.filter(o => o !== "All"),
      technologyOptions: Array.from(techSet).sort(),
      fuelTypes: Array.from(fuelSet).sort(),
      isoOptions: Array.from(isoSet).sort(),
      processOptions: ["P", "B"],
      redevTechOptions: ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"],
      redevTierOptions: ["0", "1", "2", "3", "I", "II", "III", "IV", "V"],
      redevLandControlOptions: ["Y", "N"],
      redevStageGateOptions: ["0", "1", "2", "3", "P"]
    };
    
    console.log('📋 Extracted dropdown options from data:', extractedOptions);
    setDropdownOptions(extractedOptions);
  };

  // FIXED: Improved fetchData with better error handling and ID mapping
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const endpoint = `${API_BASE_URL}/api/projects`;
      console.log('🔧 [DEBUG] Fetching from:', endpoint);
      console.log('🔧 [DEBUG] Token exists:', !!token);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 [DEBUG] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [DEBUG] Error response:', errorText.substring(0, 200));
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ [DEBUG] Data received:', data);
      console.log('✅ [DEBUG] Data type:', typeof data);
      console.log('✅ [DEBUG] Is array?:', Array.isArray(data));
      console.log('✅ [DEBUG] Data length:', Array.isArray(data) ? data.length : 'Not an array');
      
      if (Array.isArray(data) && data.length === 0) {
        console.warn('⚠️ [DEBUG] Empty array received from API');
      }
      
      // Process the data
      let projectsData = data;
      
      // Handle if data is not an array
      if (!Array.isArray(data)) {
        console.log('⚠️ [DEBUG] Data is not an array, checking structure...');
        console.log('⚠️ [DEBUG] Data keys:', Object.keys(data));
        
        if (data.projects && Array.isArray(data.projects)) {
          projectsData = data.projects;
          console.log('✅ [DEBUG] Found projects array in data.projects');
        } else if (data.data && Array.isArray(data.data)) {
          projectsData = data.data;
          console.log('✅ [DEBUG] Found projects array in data.data');
        } else if (data.results && Array.isArray(data.results)) {
          projectsData = data.results;
          console.log('✅ [DEBUG] Found projects array in data.results');
        } else {
          // Try to extract any array from the object
          const arrays = Object.values(data).filter(item => Array.isArray(item));
          if (arrays.length > 0) {
            projectsData = arrays[0];
            console.log('✅ [DEBUG] Found array in data values');
          } else {
            console.error('❌ [DEBUG] Could not find any array in response');
            projectsData = [];
          }
        }
      }
      
      console.log('✅ [DEBUG] Final projectsData:', projectsData);
      console.log('✅ [DEBUG] Final projectsData length:', projectsData.length);
      
      if (projectsData.length === 0) {
        console.warn('⚠️ [DEBUG] No projects found in the response');
        // Still set empty arrays to show UI properly
        setAllData([]);
        setPipelineRows([]);
        setKpiRow1([]);
        setKpiRow2([]);
        setIsoData([]);
        setTechData([]);
        setRedevelopmentTypes([]);
        setCounterparties([]);
        setLoading(false);
        return;
      }
      
      // Transform data
      const transformedData = projectsData.map((project, index) => {
        const displayId = index + 1;
        
        return {
          ...project,
          id: project.id || project.project_id || displayId,
          displayId: displayId,
          "Project Name": project.project_name || "",
          "Project Codename": project.project_codename || "",
          "Plant Owner": project.plant_owner || "",
          "Location": project.location || "",
          "Legacy Nameplate Capacity (MW)": project.legacy_nameplate_capacity_mw || "",
          "Tech": project.tech || "",
          "Heat Rate (Btu/kWh)": project.heat_rate_btu_kwh || "",
          "2024 Capacity Factor": project.capacity_factor_2024 || "",
          "Legacy COD": project.legacy_cod || "",
          "Fuel": project.fuel || "",
          "Site Acreage": project.site_acreage || "",
          "ISO": project.iso || "",
          "Zone/Submarket": project.zone_submarket || "",
          "Markets": project.markets || "",
          "Process (P) or Bilateral (B)": project.process_type || "",
          "Gas Reference": project.gas_reference || "",
          "Redevelopment Base Case": project.redevelopment_base_case || "",
          "Redev COD": project.redev_cod || "",
          "Thermal Optimization": project.thermal_optimization || "",
          "Co-Locate/Repower": project.co_locate_repower || "",
          "Contact": project.contact || "",
          "Overall Project Score": project.overall_project_score || "",
          "Thermal Operating Score": project.thermal_operating_score || "",
          "Redevelopment Score": project.redevelopment_score || "",
          "Redevelopment (Load) Score": project.redevelopment_load_score || "",
          "I&C Score": project.ic_score || "",
          "Environmental Score": project.environmental_score || "",
          "Market Score": project.market_score || "",
          "Number of Sites": project.number_of_sites || "",
          "Infra": project.infra || "",
          "IX": project.ix || "",
          "Transactibility": project.transactability || "",
          "Plant COD": project.plant_cod || "",
          "Capacity Factor": project.capacity_factor || "",
          "Redev Tier": project.redev_tier || "",
          "Redev Capacity (MW)": project.redev_capacity_mw || "",
          "Redev Tech": project.redev_tech || "",
          "Redev Fuel": project.redev_fuel || "",
          "Redev Heatrate (Btu/kWh)": project.redev_heatrate_btu_kwh || "",
          "Redev Land Control": project.redev_land_control || "",
          "Redev Stage Gate": project.redev_stage_gate || "",
          "Redev Lead": project.redev_lead || "",
          "Redev Support": project.redev_support || "",
          "M&A Tier": project.ma_tier || "",
          "Project Type": project.project_type || "",
          "Status": project.status || "",
          "Transactability Scores": project.transactability_scores || "",
          "Transactability": project.transactability || "",
          "Transmission Data": project.transmission_data || ""
        };
      });
      
      console.log('✅ [DEBUG] Transformed data first item:', transformedData[0]);
      
      setAllData(transformedData);
      
      // Extract owners
      const ownersSet = new Set();
      transformedData.forEach(row => {
        const owner = row["Plant Owner"];
        if (owner && owner.toString().trim() !== "") {
          ownersSet.add(owner.toString().trim());
        }
      });
      const uniqueOwners = ["All", ...Array.from(ownersSet).sort()];
      setAllOwners(uniqueOwners);
      console.log('✅ [DEBUG] Unique owners:', uniqueOwners);
      
      // Fetch dropdown options
      await fetchDropdownOptions();
      
      // Calculate all data
      if (transformedData.length > 0) {
        const headers = Object.keys(transformedData[0] || {});
        console.log('✅ [DEBUG] Headers for calculation:', headers);
        
        calculateAllData(transformedData, headers, {
          setKpiRow1, setKpiRow2, setIsoData, setTechData, 
          setRedevelopmentTypes, setCounterparties, setPipelineRows
        });
        
        console.log('✅ [DEBUG] Data calculation completed');
      } else {
        console.warn('⚠️ [DEBUG] No data to calculate');
      }
      
      setLoading(false);
      
    } catch (error) {
      console.error("❌ [DEBUG] Error fetching data:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('🚀 App mounted - checking edit/delete handlers:', {
      handleEditProject: typeof handleEditProject,
      handleDeleteProject: typeof handleDeleteProject
    });
    
    // NEW: Test API endpoints on mount
    console.log('[Frontend] DashboardContent mounted, testing API endpoints...');
    // Uncomment to test endpoints automatically
    // testEndpoints();
  }, []);

  // Initial data loading
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh when expert analysis is updated
  useEffect(() => {
    // Define global refresh function for ExpertAnalysisModal to call
    window.refreshDashboardData = fetchData;

    // Listen for expertAnalysisUpdated event
    const handleExpertAnalysisUpdate = (event) => {
      console.log('[DashboardContent] Expert analysis updated, refreshing data...', event.detail);
      fetchData();
    };

    window.addEventListener('expertAnalysisUpdated', handleExpertAnalysisUpdate);

    // Cleanup on unmount
    return () => {
      delete window.refreshDashboardData;
      window.removeEventListener('expertAnalysisUpdated', handleExpertAnalysisUpdate);
    };
  }, []);

  // UPDATED Filter function to include ALL chart-based filters
  const filterDataWithTransmission = (data, selectedIso, selectedProcess, selectedOwner, 
                                      selectedVoltage, selectedHasExcess, selectedProjectType, 
                                      activeTechFilter, activeIsoFilter, activeRedevFilter, activeCounterpartyFilter, findColumnName) => {
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
    
    if (selectedVoltage !== "All") {
      filtered = filtered.filter(row => {
        const projectName = row["Project Name"] || row["Project Codename"];
        
        let transmissionData = [];
        if (projectName && projectTransmissionData[projectName]) {
          transmissionData = projectTransmissionData[projectName];
        } else if (row["Transmission Data"]) {
          transmissionData = parseTransmissionData(row["Transmission Data"]);
        }
        
        return transmissionData.some(point => 
          point.voltage === selectedVoltage
        );
      });
    }
    
    if (selectedHasExcess !== "All") {
      filtered = filtered.filter(row => {
        const projectName = row["Project Name"] || row["Project Codename"];
        
        let transmissionData = [];
        if (projectName && projectTransmissionData[projectName]) {
          transmissionData = projectTransmissionData[projectName];
        } else if (row["Transmission Data"]) {
          transmissionData = parseTransmissionData(row["Transmission Data"]);
        }
        
        if (selectedHasExcess === "Yes") {
          return transmissionData.length > 0 && 
                 transmissionData.some(point => point.hasExcessCapacity);
        } else {
          return transmissionData.length === 0 || 
                 transmissionData.every(point => !point.hasExcessCapacity);
        }
      });
    }
    
    // ADDED: Project Type filtering
    if (selectedProjectType !== "All") {
      filtered = filtered.filter(row => {
        const projectType = row["Project Type"];
        if (!projectType || projectType.toString().trim() === "") {
          return false; // Skip projects without project type classification
        }
        
        // Split by commas and trim each value
        const types = projectType.toString().split(',').map(t => t.trim());
        
        // Check if the selected type is in the list
        return types.includes(selectedProjectType);
      });
    }
    
    // NEW: Tech filtering
    if (activeTechFilter) {
      filtered = filtered.filter(row => {
        const tech = row["Tech"] || "";
        const redevTech = row["Redev Tech"] || "";
        const fuel = row["Fuel"] || "";
        const redevFuel = row["Redev Fuel"] || "";
        
        // Special handling for Gas/Thermal filter
        if (activeTechFilter === 'Gas/Thermal') {
          return tech.toLowerCase().includes('gas') || 
                 tech.toLowerCase().includes('thermal') ||
                 fuel.toLowerCase().includes('gas') ||
                 redevFuel.toLowerCase().includes('gas') ||
                 redevTech.toLowerCase().includes('gas');
        }
        
        // Handle other tech filters
        return tech.toLowerCase().includes(activeTechFilter.toLowerCase()) ||
               redevTech.toLowerCase().includes(activeTechFilter.toLowerCase());
      });
    }
    
    // NEW: ISO/RTO filtering
    if (activeIsoFilter) {
      filtered = filtered.filter(row => {
        const iso = row["ISO"] || "";
        return iso && iso.toString().trim().toUpperCase() === activeIsoFilter.toUpperCase();
      });
    }
    
    // NEW: Redevelopment Type filtering
    if (activeRedevFilter) {
      filtered = filtered.filter(row => {
        // Check various fields that might indicate redevelopment type
        const redevBaseCase = row["Redevelopment Base Case"] || "";
        const redevTech = row["Redev Tech"] || "";
        const projectType = row["Project Type"] || "";
        
        // Check based on the filter type
        switch(activeRedevFilter) {
          case 'BESS':
            return redevTech.toLowerCase().includes('bess') || 
                   redevBaseCase.toLowerCase().includes('bess') ||
                   projectType.toLowerCase().includes('bess');
          case 'Gas/Thermal':
            return redevTech.toLowerCase().includes('gas') || 
                   redevTech.toLowerCase().includes('thermal') ||
                   redevBaseCase.toLowerCase().includes('gas') ||
                   redevBaseCase.toLowerCase().includes('thermal');
          case 'Solar':
            return redevTech.toLowerCase().includes('solar') || 
                   redevBaseCase.toLowerCase().includes('solar');
          case 'Powered Land':
            return redevBaseCase.toLowerCase().includes('powered land') ||
                   projectType.toLowerCase().includes('land');
          case 'Plant Optimization':
            return redevBaseCase.toLowerCase().includes('optimization') ||
                   projectType.toLowerCase().includes('optimization');
          default:
            return redevBaseCase.toLowerCase().includes(activeRedevFilter.toLowerCase()) ||
                   redevTech.toLowerCase().includes(activeRedevFilter.toLowerCase()) ||
                   projectType.toLowerCase().includes(activeRedevFilter.toLowerCase());
        }
      });
    }
    
    // NEW: Counterparty filtering
    if (activeCounterpartyFilter) {
      filtered = filtered.filter(row => {
        const counterparty = row["Plant Owner"] || "";
        return counterparty && counterparty.toString().trim() === activeCounterpartyFilter;
      });
    }
    
    return filtered;
  };

  // FIXED: Use useMemo to prevent unnecessary re-renders - THIS IS THE KEY FIX
  const filteredData = useMemo(() => {
    if (allData.length === 0) return [];
    
    return filterDataWithTransmission(
      allData, selectedIso, selectedProcess, selectedOwner,
      selectedTransmissionVoltage, selectedHasExcessCapacity, 
      selectedProjectType, activeTechFilter, activeIsoFilter, activeRedevFilter, activeCounterpartyFilter, findColumnName
    );
  }, [allData, selectedIso, selectedProcess, selectedOwner, selectedTransmissionVoltage, 
      selectedHasExcessCapacity, selectedProjectType, activeTechFilter, 
      activeIsoFilter, activeRedevFilter, activeCounterpartyFilter, projectTransmissionData]);

  // FIXED: Calculate data only when filteredData changes
  useEffect(() => {
    if (filteredData.length > 0) {
      const headers = Object.keys(allData[0] || {});
      calculateAllData(filteredData, headers, {
        setKpiRow1, setKpiRow2, setIsoData, setTechData, 
        setRedevelopmentTypes, setCounterparties, setPipelineRows
      });
    }
  }, [filteredData]);

  useEffect(() => {
    if (allData.length > 0) {
      const ownersSet = new Set();
      allData.forEach(row => {
        const ownerCol = findColumnName(row, ["Plant Owner", "Owner", "owner"]);
        const owner = ownerCol ? row[ownerCol] : "";
        if (owner && owner.toString().trim() !== "") {
          ownersSet.add(owner.toString().trim());
        }
      });
      const uniqueOwners = ["All", ...Array.from(ownersSet).sort()];
      setAllOwners(uniqueOwners);
    }
  }, [allData]);

  // Update the getAllExpertAnalyses function to include ALL redevelopment fields and M&A Tier
  const getAllExpertAnalyses = () => {
    const dataToUse = allData;
    
    if (!dataToUse || dataToUse.length === 0) {
      return [];
    }
    
    const analyses = dataToUse.map((dbRow, index) => {
      const projectData = {
        ...dbRow,
        "Plant COD": dbRow["Plant COD"] || dbRow["Plant COD"] || "",
        "Legacy COD": dbRow["Legacy COD"] || "",
        "2024 Capacity Factor": dbRow["2024 Capacity Factor"] || "0",
        "ISO": dbRow["ISO"] || "",
        "Transactability": dbRow["Transactability"] || "", // Column AI
        "Transactability Scores": dbRow["Transactability Scores"] || "", // Column AH
        "Thermal Optimization": dbRow["Thermal Optimization"] || "",
        "Environmental Score": dbRow["Envionmental Score"] || dbRow["Environmental Score"] || "2",
        "Market Score": dbRow["Market Score"] || "",
        "Co-Locate/Repower": dbRow["Co-Locate/Repower"] || "",
        detailData: dbRow,
        id: dbRow.id || dbRow.displayId || index + 1, // Use displayId if available
        asset: dbRow["Project Name"] || dbRow["Project Codename"] || `Project ${index + 1}`,
        location: dbRow["Location"] || 'Unknown',
        overall: parseFloat(dbRow["Overall Project Score"] || "0"),
        thermal: parseFloat(dbRow["Thermal Operating Score"] || "0"),
        redev: parseFloat(dbRow["Redevelopment Score"] || "0"),
        // CRITICAL: Add Transactability fields
        transactabilityScore: dbRow["Transactability Scores"] || "",
        transactability: dbRow["Transactability"] || "",
        mkt: dbRow["ISO"] || "",
        zone: dbRow["Zone/Submarket"] || "",
        mw: parseFloat(dbRow["Legacy Nameplate Capacity (MW)"] || "0"),
        tech: dbRow["Tech"] || "",
        hr: parseFloat(dbRow["Heat Rate (Btu/kWh)"] || "0"),
        cf: parseFloat(dbRow["2024 Capacity Factor"] || "0"),
        cod: dbRow["Legacy COD"] || "",
        // ADDED: Redevelopment fields for pipeline table
        redevBaseCase: dbRow["Redevelopment Base Case"] || "",
        redevCapacity: dbRow["Redev Capacity (MW)"] || "",
        redevTier: dbRow["Redev Tier"] || "",
        redevTech: dbRow["Redev Tech"] || "",
        redevFuel: dbRow["Redev Fuel"] || "",
        redevHeatrate: dbRow["Redev Heatrate (Btu/kWh)"] || "",
        redevCOD: dbRow["Redev COD"] || "",
        redevLandControl: dbRow["Redev Land Control"] || "",
        redevStageGate: dbRow["Redev Stage Gate"] || "",
        redevLead: dbRow["Redev Lead"] || "",
        redevSupport: dbRow["Redev Support"] || "",
        projectType: dbRow["Project Type"] || "",
        // UPDATED: Use the comprehensive status calculation function
        status: calculateStatusFromCODs(dbRow["Legacy COD"] || "", dbRow["Redev COD"] || "")
      };
      
      const analysis = generateExpertAnalysis(projectData);
      
      return {
        ...projectData,
        expertAnalysis: analysis
      };
    }).filter(project => project.expertAnalysis);
    
    return analyses;
  };

  // Loading state
  if (loading) {
    return (
      <ActivityLogProvider>
        <div className="dashboard-root">
          <Header 
            selectedIso={selectedIso}
            selectedProcess={selectedProcess}
            selectedOwner={selectedOwner}
            selectedTransmissionVoltage={selectedTransmissionVoltage}
            selectedHasExcessCapacity={selectedHasExcessCapacity}
            selectedProjectType={selectedProjectType}
            allOwners={allOwners}
            allVoltages={allVoltages}
            excessCapacityOptions={excessCapacityOptions}
            handleIsoFilter={handleIsoFilter}
            handleProcessFilter={handleProcessFilter}
            handleOwnerFilter={handleOwnerFilter}
            handleTransmissionVoltageFilter={handleTransmissionVoltageFilter}
            handleHasExcessCapacityFilter={handleHasExcessCapacityFilter}
            handleProjectTypeFilter={handleProjectTypeFilter}
            resetFilters={clearAllFilters} // UPDATED: Use clearAllFilters
            setShowScoringPanel={setShowScoringPanel}
            openAddSiteModal={openAddSiteModal}
            setShowExpertScores={setShowExpertScores}
            setShowExportModal={setShowExportModal}
            setShowUploadModal={setShowUploadModal}
            setShowActivityLog={setShowActivityLog}
          />
          <div className="loading-overlay">
            <p>Loading data from database...</p>
          </div>
        </div>
      </ActivityLogProvider>
    );
  }

  // Error state
  if (error) {
    return (
      <ActivityLogProvider>
        <div className="dashboard-root">
          <Header 
            selectedIso={selectedIso}
            selectedProcess={selectedProcess}
            selectedOwner={selectedOwner}
            selectedTransmissionVoltage={selectedTransmissionVoltage}
            selectedHasExcessCapacity={selectedHasExcessCapacity}
            selectedProjectType={selectedProjectType}
            allOwners={allOwners}
            allVoltages={allVoltages}
            excessCapacityOptions={excessCapacityOptions}
            handleIsoFilter={handleIsoFilter}
            handleProcessFilter={handleProcessFilter}
            handleOwnerFilter={handleOwnerFilter}
            handleTransmissionVoltageFilter={handleTransmissionVoltageFilter}
            handleHasExcessCapacityFilter={handleHasExcessCapacityFilter}
            handleProjectTypeFilter={handleProjectTypeFilter}
            resetFilters={clearAllFilters} // UPDATED: Use clearAllFilters
            setShowScoringPanel={setShowScoringPanel}
            openAddSiteModal={openAddSiteModal}
            setShowExpertScores={setShowExpertScores}
            setShowExportModal={setShowExportModal}
            setShowUploadModal={setShowUploadModal}
            setShowActivityLog={setShowActivityLog}
          />
          <div className="error-overlay">
            <p>Error loading data: {error}</p>
            <button onClick={fetchData}>Retry</button>
          </div>
        </div>
      </ActivityLogProvider>
    );
  }

  return (
    <ActivityLogProvider>
      <div className="dashboard-root">
        <Header 
          selectedIso={selectedIso}
          selectedProcess={selectedProcess}
          selectedOwner={selectedOwner}
          selectedTransmissionVoltage={selectedTransmissionVoltage}
          selectedHasExcessCapacity={selectedHasExcessCapacity}
          selectedProjectType={selectedProjectType}
          allOwners={allOwners}
          allVoltages={allVoltages}
          excessCapacityOptions={excessCapacityOptions}
          handleIsoFilter={handleIsoFilter}
          handleProcessFilter={handleProcessFilter}
          handleOwnerFilter={handleOwnerFilter}
          handleTransmissionVoltageFilter={handleTransmissionVoltageFilter}
          handleHasExcessCapacityFilter={handleHasExcessCapacityFilter}
          handleProjectTypeFilter={handleProjectTypeFilter}
          resetFilters={clearAllFilters} // UPDATED: Use clearAllFilters
          setShowScoringPanel={setShowScoringPanel}
          openAddSiteModal={openAddSiteModal}
          setShowExpertScores={setShowExpertScores}
          setShowExportModal={setShowExportModal}
          setShowUploadModal={setShowUploadModal}
          setShowActivityLog={setShowActivityLog}
        />

        {/* Add Activity Log Panel */}
        {showActivityLog && (
          <div className="activity-log-overlay">
            <ActivityLogPanel />
            <button 
              className="close-activity-log"
              onClick={() => setShowActivityLog(false)}
            >
              ×
            </button>
          </div>
        )}

        {/* UPDATED: Add ALL chart-based filters to filter status */}
        {(selectedIso !== "All" || selectedProcess !== "All" || selectedOwner !== "All" || 
          selectedTransmissionVoltage !== "All" || selectedHasExcessCapacity !== "All" ||
          selectedProjectType !== "All" || activeTechFilter || activeIsoFilter || 
          activeRedevFilter || activeCounterpartyFilter) && (
          <div className="filter-status">
            <div className="filter-tags">
              {selectedIso !== "All" && (
                <span className="filter-tag">
                  ISO: {selectedIso}
                  <button onClick={() => handleIsoFilter("All")}>×</button>
                </span>
              )}
              {selectedProcess !== "All" && (
                <span className="filter-tag">
                  Process: {selectedProcess}
                  <button onClick={() => handleProcessFilter("All")}>×</button>
                </span>
              )}
              {selectedOwner !== "All" && (
                <span className="filter-tag">
                  Owner: {selectedOwner}
                  <button onClick={() => handleOwnerFilter("All")}>×</button>
                </span>
              )}
              {selectedTransmissionVoltage !== "All" && (
                <span className="filter-tag">
                  Voltage: {selectedTransmissionVoltage}
                  <button onClick={() => handleTransmissionVoltageFilter("All")}>×</button>
                </span>
              )}
              {selectedHasExcessCapacity !== "All" && (
                <span className="filter-tag">
                  Excess Capacity: {selectedHasExcessCapacity}
                  <button onClick={() => handleHasExcessCapacityFilter("All")}>×</button>
                </span>
              )}
              {/* ADDED: Project Type filter tag */}
              {selectedProjectType !== "All" && (
                <span className="filter-tag">
                  Project Type: {selectedProjectType}
                  <button onClick={() => handleProjectTypeFilter("All")}>×</button>
                </span>
              )}
              {/* Chart-based filter tags */}
              {activeTechFilter && (
                <span className="filter-tag tech-filter-tag">
                  Tech: {activeTechFilter}
                  <button onClick={() => setActiveTechFilter(null)}>×</button>
                </span>
              )}
              {activeIsoFilter && (
                <span className="filter-tag iso-filter-tag">
                  ISO/RTO: {activeIsoFilter}
                  <button onClick={() => setActiveIsoFilter(null)}>×</button>
                </span>
              )}
              {activeRedevFilter && (
                <span className="filter-tag redev-filter-tag">
                  Redev Type: {activeRedevFilter}
                  <button onClick={() => setActiveRedevFilter(null)}>×</button>
                </span>
              )}
              {activeCounterpartyFilter && (
                <span className="filter-tag counterparty-filter-tag">
                  Counterparty: {activeCounterpartyFilter}
                  <button onClick={() => setActiveCounterpartyFilter(null)}>×</button>
                </span>
              )}
            </div>
            <div className="filtered-count">
              Showing {pipelineRows.length} project{pipelineRows.length !== 1 ? 's' : ''}
              <button
                onClick={clearAllFilters}
                className="clear-all-filters-btn"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        <KPISection kpiRow1={kpiRow1} kpiRow2={kpiRow2} />
        
        {/* UPDATED: Pass new filter handlers to MiddleGridSection */}
        <MiddleGridSection 
          isoData={isoData}
          techData={techData}
          redevelopmentTypes={redevelopmentTypes}
          ISO_COLORS={ISO_COLORS}
          TECH_COLORS={TECH_COLORS}
          handleFilterByTech={handleFilterByTech}
          handleFilterByIso={handleFilterByIso}
          handleFilterByRedev={handleFilterByRedev}
        />
        
        {/* UPDATED: Pass new filter handlers to BottomGridSection */}
      <BottomGridSection 
        counterparties={counterparties}
        pipelineRows={autoSortedPipelineRows.length > 0 ? autoSortedPipelineRows : pipelineRows} // Pass auto-sorted rows
        sortConfig={sortConfig}
        handleSort={handleSort}
        getSortDirectionClass={getSortDirectionClass}
        resetSort={resetSort}
        getSortedPipelineRows={getSortedPipelineRows}
        handleProjectClick={handleProjectClick}
        kpiRow1={kpiRow1}
        handleEditProject={handleEditProject}
        handleDeleteProject={handleDeleteProject}
        activeTechFilter={activeTechFilter}
        clearTechFilter={() => setActiveTechFilter(null)}
        handleFilterByCounterparty={handleFilterByCounterparty}
        activeCounterpartyFilter={activeCounterpartyFilter}
        clearCounterpartyFilter={() => setActiveCounterpartyFilter(null)}
        activeIsoFilter={activeIsoFilter}
        activeRedevFilter={activeRedevFilter}
        clearIsoFilter={() => setActiveIsoFilter(null)}
        clearRedevFilter={() => setActiveRedevFilter(null)}
        selectedProjectType={selectedProjectType}
      />
        {/* Modals */}
        {showAddSiteModal && (
          <AddSiteModal
            showAddSiteModal={showAddSiteModal}
            closeAddSiteModal={closeAddSiteModal}
            handleAddSiteSubmit={handleAddSiteSubmit}
            newSiteData={newSiteData}
            handleInputChange={handleInputChange}
            allData={allData}
            dropdownOptions={dropdownOptions}
            US_CITIES={US_CITIES}
            allVoltages={Array.isArray(allVoltages) ? allVoltages.filter(v => v !== "All") : []}
            calculateStatusFromCODs={calculateStatusFromCODs}
          />
        )}
        
        {/* Edit Modal */}
        {showEditModal && editingProject && (
          <EditSiteModal
            showEditModal={showEditModal}
            closeEditModal={closeEditModal}
            handleUpdateProject={handleUpdateProject}
            projectData={editingProject}
            allData={allData}
            dropdownOptions={dropdownOptions}
            US_CITIES={US_CITIES}
            calculateStatusFromCODs={calculateStatusFromCODs}
          />
        )}
        
        {showProjectDetail && (
          <ProjectDetailModal
            selectedProject={selectedProject}
            closeProjectDetail={closeProjectDetail}
          />
        )}
        
        {showScoringPanel && (
          <ScoringPanel
            showScoringPanel={showScoringPanel}
            setShowScoringPanel={setShowScoringPanel}
            scoringWeights={scoringWeights}
          />
        )}
        
        {showExpertScores && (
          <ExpertScoresPanel
            showExpertScores={showExpertScores}
            setShowExpertScores={setShowExpertScores}
            getAllExpertAnalyses={getAllExpertAnalyses}
            expertAnalysisFilter={expertAnalysisFilter}
            setExpertAnalysisFilter={setExpertAnalysisFilter}
            setSelectedExpertProject={setSelectedExpertProject}
            setShowScoringModal={setShowScoringModal}
            refreshExpertData={refreshExpertData}
          />
        )}
        
        {/* ADDED: Export Modal */}
        {showExportModal && (
          <ExportModal
            showExportModal={showExportModal}
            setShowExportModal={setShowExportModal}
            allData={allData}
            pipelineRows={pipelineRows}
            currentFilters={currentFilters}
          />
        )}

        {/* ADDED: Upload Modal */}
        {showUploadModal && (
          <UploadModal
            showUploadModal={showUploadModal}
            setShowUploadModal={setShowUploadModal}
            allData={allData}
            setAllData={setAllData}
            calculateAllData={calculateAllData}
            setKpiRow1={setKpiRow1}
            setKpiRow2={setKpiRow2}
            setIsoData={setIsoData}
            setTechData={setTechData}
            setRedevelopmentTypes={setRedevelopmentTypes}
            setCounterparties={setCounterparties}
            setPipelineRows={setPipelineRows}
          />
        )}
        
        {selectedExpertProject && (
  <ExpertAnalysisModal
    selectedExpertProject={selectedExpertProject}
    setSelectedExpertProject={setSelectedExpertProject}
    setSelectedProject={setSelectedProject}
    setShowProjectDetail={setShowProjectDetail}
    fetchExpertAnalysis={fetchExpertAnalysis}
    saveExpertAnalysis={saveExpertAnalysis}
    fetchTransmissionInterconnection={fetchTransmissionInterconnection}
    saveTransmissionInterconnection={saveTransmissionInterconnection}
    onSaveSuccess={() => {
      console.log('✅ Expert analysis saved!');
      setSelectedExpertProject(null);
      window.dispatchEvent(new Event('expertAnalysisSaved'));
      setTimeout(() => refreshExpertData(), 500);
    }}
  />
)}
      </div>
    </ActivityLogProvider>
  );
}

export default DashboardContent;
