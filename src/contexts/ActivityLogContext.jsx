import React, { createContext, useContext, useState, useCallback } from "react";

const ActivityLogContext = createContext();

export const useActivityLog = () => {
  const context = useContext(ActivityLogContext);
  if (!context) {
    throw new Error("useActivityLog must be used within ActivityLogProvider");
  }
  return context;
};

export const ActivityLogProvider = ({ children }) => {
  const [activities, setActivities] = useState(() => {
    try {
      const saved = localStorage.getItem('activityLog');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const logActivity = useCallback((action, projectName, details = {}) => {
    const newActivity = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user: "User",
      action,
      projectName: projectName || "Unknown",
      details,
    };
    
    setActivities(prev => {
      const updated = [newActivity, ...prev.slice(0, 99)];
      localStorage.setItem('activityLog', JSON.stringify(updated));
      return updated;
    });
    
  }, []);
  
  const clearActivities = useCallback(() => {
    setActivities([]);
    localStorage.removeItem('activityLog');
  }, []);
  
  return (
    <ActivityLogContext.Provider value={{ activities, logActivity, clearActivities }}>
      {children}
    </ActivityLogContext.Provider>
  );
};