const projectModel = require('../models/projectModel');

// ========== CONTROLLER FUNCTIONS ==========

/**
 * GET /api/projects - Get all projects with optional filtering
 */
const getProjects = async (req, res) => {
  try {
    console.log('📥 GET /api/projects - Request query:', req.query);
    
    // Extract query parameters
    const filters = {
      iso: req.query.iso,
      process_type: req.query.process_type,
      plant_owner: req.query.plant_owner,
      status: req.query.status,
      tech: req.query.tech,
      project_type: req.query.project_type,
      limit: req.query.limit || 1000,
      offset: req.query.offset || 0,
      sort_by: req.query.sort_by || 'project_name',
      sort_order: req.query.sort_order || 'ASC'
    };

    // Get projects from database
    const projects = await projectModel.getAllProjects(filters);
    
    // Get total count for pagination
    const totalCount = await projectModel.getProjectsCount(filters);

    // Send response
    res.status(200).json({
      success: true,
      message: 'Projects retrieved successfully',
      count: projects.length,
      total: totalCount,
      data: projects,
      pagination: {
        limit: parseInt(filters.limit),
        offset: parseInt(filters.offset),
        total: totalCount,
        hasMore: (parseInt(filters.offset) + projects.length) < totalCount
      },
      filters: filters
    });
    
    console.log(`✅ GET /api/projects - Returned ${projects.length} of ${totalCount} total projects`);
  } catch (error) {
    console.error('❌ Error in getProjects controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve projects',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * GET /api/projects/:id - Get single project by ID
 */
const getProject = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 GET /api/projects/${id} - Request received`);
    
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID'
      });
    }

    const project = await projectModel.getProjectById(parseInt(id));
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Project retrieved successfully',
      data: project
    });
    
    console.log(`✅ GET /api/projects/${id} - Project found: ${project.project_name}`);
  } catch (error) {
    console.error(`❌ Error in getProject controller for ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve project',
      message: error.message
    });
  }
};

/**
 * POST /api/projects - Create new project
 */
const createProject = async (req, res) => {
  try {
    console.log('📥 POST /api/projects - Request body:', req.body);
    
    const projectData = req.body;
    
    // Validate required fields
    if (!projectData.project_name) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required'
      });
    }
    
    // Create project in database
    const newProject = await projectModel.createProject(projectData);
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: newProject
    });
    
    console.log(`✅ POST /api/projects - Created project: ${newProject.project_name}`);
  } catch (error) {
    console.error('❌ Error in createProject controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project',
      message: error.message
    });
  }
};

/**
 * PUT /api/projects/:id - Update existing project
 */
const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log(`📥 PUT /api/projects/${id} - Updates:`, updates);
    
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID'
      });
    }

    // Check if project exists
    const existingProject = await projectModel.getProjectById(parseInt(id));
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Update project in database
    const updatedProject = await projectModel.updateProject(parseInt(id), updates);
    
    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    });
    
    console.log(`✅ PUT /api/projects/${id} - Updated project: ${updatedProject.project_name}`);
  } catch (error) {
    console.error(`❌ Error in updateProject controller for ID ${req.params.id}:`, error);
    
    if (error.message === 'Project not found or inactive') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update project',
      message: error.message
    });
  }
};

/**
 * DELETE /api/projects/:id - Soft delete project
 */
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📥 DELETE /api/projects/${id} - Request received`);
    
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID'
      });
    }

    // Check if project exists
    const existingProject = await projectModel.getProjectById(parseInt(id));
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Soft delete project
    const deletedProject = await projectModel.deleteProject(parseInt(id));
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: deletedProject
    });
    
    console.log(`✅ DELETE /api/projects/${id} - Deleted project: ${deletedProject.project_name}`);
  } catch (error) {
    console.error(`❌ Error in deleteProject controller for ID ${req.params.id}:`, error);
    
    if (error.message === 'Project not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete project',
      message: error.message
    });
  }
};

/**
 * GET /api/projects/stats - Get dashboard statistics
 */
const getDashboardStats = async (req, res) => {
  try {
    console.log('📥 GET /api/projects/stats - Request received');
    
    const stats = await projectModel.getDashboardStats();
    
    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: stats,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ GET /api/projects/stats - Statistics retrieved');
  } catch (error) {
    console.error('❌ Error in getDashboardStats controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard statistics',
      message: error.message
    });
  }
};

/**
 * GET /api/projects/filters - Get filter options
 */
const getFilterOptions = async (req, res) => {
  try {
    console.log('📥 GET /api/projects/filters - Request received');
    
    const options = await projectModel.getFilterOptions();
    
    res.status(200).json({
      success: true,
      message: 'Filter options retrieved successfully',
      data: options,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ GET /api/projects/filters - Options retrieved');
  } catch (error) {
    console.error('❌ Error in getFilterOptions controller:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve filter options',
      message: error.message
    });
  }
};

/**
 * PATCH /api/projects/:id - Partial update (same as PUT for now)
 */
const patchProject = async (req, res) => {
  // Reuse the updateProject function
  await updateProject(req, res);
};

// Export all controller functions
module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  patchProject,
  getDashboardStats,
  getFilterOptions
};