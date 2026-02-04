import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import MAPage from './pages/MAPage';
import RedevelopmentPage from './pages/RedevelopmentPage';
import { AuthProvider } from './contexts/AuthContext';
import { ActivityLogProvider } from './contexts/ActivityLogContext';

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AuthProvider>
      <ActivityLogProvider>
        <Router>
          <div className="app-container">
            <Sidebar 
              collapsed={sidebarCollapsed} 
              toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
              <Header />
              <div className="page-content">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/m-and-a" element={<MAPage />} />
                  <Route path="/redevelopment" element={<RedevelopmentPage />} />
                </Routes>
              </div>
            </div>
          </div>
        </Router>
      </ActivityLogProvider>
    </AuthProvider>
  );
}

export default AppLayout;
