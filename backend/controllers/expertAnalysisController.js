const expertAnalysis = require('../models/expertAnalysis');

// @desc    Get expert analysis by project ID
// @route   GET /api/expert-analysis
// @access  Private
// OPTION B: Now reads directly from PROJECTS table
const getExpertAnalysis = async (req, res) => {
  try {
    const { projectId } = req.query;

    console.log('🔍 API Request: GET /api/expert-analysis', { projectId });

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const analysisData = await expertAnalysis.getExpertAnalysisByProjectId(projectId);

    if (!analysisData) {
      return res.status(200).json({
        success: true,
        message: 'No expert analysis found for this project',
        data: null
      });
    }

    // The model now returns data in the correct format for the frontend
    // Just pass it through with some additional formatting
    const formattedResponse = {
      projectId: analysisData.projectId,
      projectName: analysisData.projectName,
      projectCodename: analysisData.projectCodename,
      overallScore: analysisData.overallScore,
      overallRating: analysisData.overallRating,
      confidence: analysisData.confidence,
      thermalScore: analysisData.thermalScore,
      thermalBreakdown: analysisData.thermalBreakdown,
      redevelopmentScore: analysisData.redevelopmentScore,
      redevelopmentBreakdown: analysisData.redevelopmentBreakdown,
      infrastructureScore: analysisData.infrastructureScore,
      editedBy: analysisData.editedBy || 'PowerTrans Team',
      editedAt: analysisData.editedAt,
      // Include project details for reference
      projectDetails: {
        plantOwner: analysisData.plantOwner,
        location: analysisData.location,
        iso: analysisData.iso,
        legacyNameplateCapacityMW: analysisData.legacyNameplateCapacityMw,
        tech: analysisData.tech
      }
    };

    res.status(200).json({
      success: true,
      data: formattedResponse
    });
  } catch (error) {
    console.error('❌ Error in getExpertAnalysis controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Save or update expert analysis
// @route   POST /api/expert-analysis
// @access  Private
// OPTION B: Now updates PROJECTS table and creates history record
const saveExpertAnalysis = async (req, res) => {
  try {
    const {
      projectId,
      projectName,
      overallScore,
      overallRating,
      confidence,
      thermalScore,
      thermalOperatingScore, // Alternative name used by frontend
      thermalBreakdown,
      redevelopmentScore,
      redevelopmentBreakdown,
      infrastructureScore,
      editedBy
    } = req.body;

    console.log('💾 API Request: POST /api/expert-analysis', {
      projectId,
      projectName: projectName?.substring(0, 50) + '...',
      overallScore,
      overallRating
    });

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const analysisData = {
      projectId: parseInt(projectId), // Ensure integer for projects.id
      projectName,
      overallScore: parseFloat(overallScore) || 0,
      overallRating: overallRating || 'N/A',
      confidence: parseInt(confidence) || 75,
      thermalScore: parseFloat(thermalScore || thermalOperatingScore) || 0,
      thermalBreakdown,
      redevelopmentScore: parseFloat(redevelopmentScore) || 0,
      redevelopmentBreakdown,
      infrastructureScore: parseFloat(infrastructureScore) || 0,
      editedBy: editedBy || 'PowerTrans Team'
    };

    const savedAnalysis = await expertAnalysis.saveExpertAnalysis(analysisData);

    // The model returns data in the correct format
    const formattedResponse = {
      projectId: savedAnalysis.projectId,
      projectName: savedAnalysis.projectName,
      overallScore: savedAnalysis.overallScore,
      overallRating: savedAnalysis.overallRating,
      confidence: savedAnalysis.confidence,
      thermalScore: savedAnalysis.thermalScore,
      thermalBreakdown: savedAnalysis.thermalBreakdown,
      redevelopmentScore: savedAnalysis.redevelopmentScore,
      redevelopmentBreakdown: savedAnalysis.redevelopmentBreakdown,
      infrastructureScore: savedAnalysis.infrastructureScore,
      editedBy: savedAnalysis.editedBy,
      editedAt: savedAnalysis.editedAt,
      historyId: savedAnalysis.historyId // New: ID of the history record
    };

    res.status(200).json({
      success: true,
      message: 'Expert analysis saved successfully',
      data: formattedResponse
    });
  } catch (error) {
    console.error('❌ Error in saveExpertAnalysis controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get edit history for a project
// @route   GET /api/expert-analysis/history
// @access  Private
const getEditHistory = async (req, res) => {
  try {
    const { projectId, limit } = req.query;

    console.log('📜 API Request: GET /api/expert-analysis/history', { projectId, limit });

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const history = await expertAnalysis.getEditHistory(
      parseInt(projectId),
      parseInt(limit) || 10
    );

    // Format the history records
    const formattedHistory = history.map(record => ({
      id: record.id,
      projectId: record.project_id,
      projectName: record.project_name,
      overallScore: parseFloat(record.overall_score) || 0,
      overallRating: record.overall_rating,
      thermalScore: parseFloat(record.thermal_operating_score) || 0,
      redevelopmentScore: parseFloat(record.redevelopment_score) || 0,
      infrastructureScore: parseFloat(record.infrastructure_score) || 0,
      editedBy: record.edited_by,
      editedAt: record.edited_at,
      changesSummary: record.changes_summary
    }));

    res.status(200).json({
      success: true,
      data: formattedHistory,
      count: formattedHistory.length
    });
  } catch (error) {
    console.error('❌ Error in getEditHistory controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get a specific history entry with full details
// @route   GET /api/expert-analysis/history/:historyId
// @access  Private
const getHistoryEntry = async (req, res) => {
  try {
    const { historyId } = req.params;

    console.log('📜 API Request: GET /api/expert-analysis/history/:historyId', { historyId });

    if (!historyId) {
      return res.status(400).json({
        success: false,
        message: 'History ID is required'
      });
    }

    const entry = await expertAnalysis.getHistoryEntry(parseInt(historyId));

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'History entry not found'
      });
    }

    res.status(200).json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('❌ Error in getHistoryEntry controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get transmission interconnection data
// @route   GET /api/transmission-interconnection
// @access  Private
// Supports both ?project=name and ?projectId=123
const getTransmissionInterconnection = async (req, res) => {
  try {
    const { project, projectId } = req.query;

    console.log('🔍 API Request: GET /api/transmission-interconnection', { project, projectId });

    if (!project && !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project name or project ID is required'
      });
    }

    let transmissionData;

    // Prefer projectId if provided (more reliable)
    if (projectId) {
      transmissionData = await expertAnalysis.getTransmissionInterconnectionByProjectId(projectId);
    } else {
      transmissionData = await expertAnalysis.getTransmissionInterconnectionByProject(project);
    }

    // Format response
    const formattedData = transmissionData.map(item => ({
      id: item.id,
      site: item.site,
      poiVoltage: item.poi_voltage,
      excessInjectionCapacity: parseFloat(item.excess_injection_capacity) || 0,
      excessWithdrawalCapacity: parseFloat(item.excess_withdrawal_capacity) || 0,
      constraints: item.constraints,
      excessIXCapacity: item.excess_ix_capacity,
      projectId: item.project_id,
      notes: item.notes,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      projectDetails: {
        actualProjectName: item.actual_project_name,
        projectCodename: item.project_codename,
        iso: item.iso,
        plantOwner: item.plant_owner
      }
    }));

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('❌ Error in getTransmissionInterconnection controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Save transmission interconnection data
// @route   POST /api/transmission-interconnection
// @access  Private
const saveTransmissionInterconnection = async (req, res) => {
  try {
    const { projectId, transmissionData } = req.body;

    console.log('💾 API Request: POST /api/transmission-interconnection', {
      projectId,
      dataCount: transmissionData?.length || 0
    });

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    if (!transmissionData || !Array.isArray(transmissionData)) {
      return res.status(400).json({
        success: false,
        message: 'Transmission data must be an array'
      });
    }

    const savedData = await expertAnalysis.saveTransmissionInterconnection(
      projectId,
      transmissionData
    );

    // Format response
    const formattedData = savedData.map(item => ({
      id: item.id,
      site: item.site,
      poiVoltage: item.poi_voltage,
      excessInjectionCapacity: parseFloat(item.excess_injection_capacity) || 0,
      excessWithdrawalCapacity: parseFloat(item.excess_withdrawal_capacity) || 0,
      constraints: item.constraints,
      excessIXCapacity: item.excess_ix_capacity,
      projectId: item.project_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    res.status(200).json({
      success: true,
      message: 'Transmission data saved successfully',
      data: formattedData,
      count: formattedData.length
    });
  } catch (error) {
    console.error('❌ Error in saveTransmissionInterconnection controller:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  getExpertAnalysis,
  saveExpertAnalysis,
  getEditHistory,
  getHistoryEntry,
  getTransmissionInterconnection,
  saveTransmissionInterconnection
};
