import api from './api';

export const expertAnalysisService = {
  // Fetch expert analysis by project ID
  async getExpertAnalysis(projectId) {
    try {
      const response = await api.get(`/api/expert-analysis?projectId=${projectId}`);
      console.log('✅ API Response structure:', response.data);
      
      // Handle API response format
      if (response.data.success && response.data.data) {
        console.log('📊 Data found in API response');
        return response.data.data;  // Your API returns {success: true, data: {...}}
      } else if (response.data.success && !response.data.data) {
        console.log('📭 API returned success but no data');
        return null;
      } else {
        console.log('📦 Returning raw response data');
        return response.data;
      }
    } catch (error) {
      console.error('❌ Error fetching expert analysis:', error);
      if (error.response?.status === 404) {
        console.log('📭 No expert analysis found (404)');
        return null;
      }
      return null;
    }
  },

  // Save expert analysis
  async saveExpertAnalysis(analysisData) {
    try {
      console.log('💾 Saving expert analysis:', analysisData);
      const response = await api.post('/api/expert-analysis', analysisData);
      console.log('✅ Save response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error saving expert analysis:', error);
      throw error;
    }
  },

  // Fetch transmission data
  async getTransmissionInterconnection(projectName) {
    try {
      const response = await api.get(`/api/transmission-interconnection?project=${encodeURIComponent(projectName)}`);
      console.log('✅ Transmission API response:', response.data);
      
      // Handle response format
      if (Array.isArray(response.data)) {
        console.log(`📊 Found ${response.data.length} transmission records`);
        return response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        console.log(`📊 Found ${response.data.data.length} transmission records`);
        return response.data.data;
      } else {
        console.log('📭 No transmission data returned');
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching transmission data:', error);
      if (error.response?.status === 404) {
        console.log('📭 No transmission data found (404)');
        return [];
      }
      return [];
    }
  },

  // Save transmission data
  async saveTransmissionInterconnection(projectId, transmissionData) {
    try {
      console.log('💾 Saving transmission data for project:', projectId);
      const response = await api.post('/api/transmission-interconnection', {
        projectId,
        transmissionData
      });
      console.log('✅ Transmission save response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error saving transmission data:', error);
      throw error;
    }
  }
};
