import React from 'react';

const KPISection = ({ kpiRow1, kpiRow2 }) => {
  return (
    <section className="kpi-section">
      <div className="kpi-grid">
        {kpiRow1.map((kpi) => (
          <div key={kpi.label} className="card kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className={`kpi-value ${kpi.colorClass || ''}`}>{kpi.value}</div>
            <div className="kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>
      <div className="kpi-grid second-row">
        {kpiRow2.map((kpi) => (
          <div key={kpi.label} className="card kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className={`kpi-value ${kpi.colorClass || ''}`}>{kpi.value}</div>
            <div className="kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default KPISection;