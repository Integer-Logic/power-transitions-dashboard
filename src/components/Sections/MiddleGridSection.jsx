import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MiddleGridSection = ({ isoData, techData, redevelopmentTypes, ISO_COLORS, TECH_COLORS, handleFilterByTech, handleFilterByIso, handleFilterByRedev }) => {
  return (
    <section className="middle-grid">
      <div className="card mid-card">
        <div className="card-header">BY ISO/RTO</div>
        <div className="card-body">
          <div className="chart-with-legend">
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={isoData}
                    dataKey="value"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {isoData.map((entry, idx) => (
                      <Cell
                        key={entry.name}
                        fill={ISO_COLORS[idx % ISO_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value} GW · ${props.payload.count || 0} projects`,
                      props.payload.name
                    ]}
                    contentStyle={{ background: "#020617", border: "none" }}
                    labelStyle={{ color: "#E5E7EB" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              <div className="legend-title">ISO/RTO Legend</div>
              {isoData.map((iso, idx) => (
                <div 
                  key={iso.name} 
                  className="legend-item clickable"
                  onClick={() => handleFilterByIso && handleFilterByIso(iso.name)}
                  style={{ cursor: handleFilterByIso ? 'pointer' : 'default' }}
                  title={handleFilterByIso ? `Click to filter by ${iso.name}` : ''}
                >
                  <div className="legend-color" style={{ backgroundColor: ISO_COLORS[idx % ISO_COLORS.length] }}></div>
                  <div className="legend-label">{iso.name}</div>
                  <div className="legend-value">
                    {iso.value} GW · {iso.count || 0} projects
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card mid-card">
        <div className="card-header">TECHNOLOGY MIX</div>
        <div className="card-body">
          <div className="chart-with-legend">
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={techData}
                  layout="vertical"
                  margin={{ top: 5, left: 40, right: 20, bottom: 5 }}
                >
                  <XAxis 
                    type="number" 
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                    label={{ value: 'MW', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="tech"
                    tick={{ fill: "#9CA3AF", fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value} MW · ${props.payload.count || 0} projects`,
                      props.payload.tech
                    ]}
                    contentStyle={{ background: "#020617", border: "none" }}
                    labelStyle={{ color: "#E5E7EB" }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {techData.map((entry, idx) => (
                      <Cell
                        key={entry.tech}
                        fill={TECH_COLORS[idx % TECH_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              <div className="legend-title">Technology Legend</div>
              {techData.map((tech, idx) => (
                <div 
                  key={tech.tech} 
                  className="legend-item clickable"
                  onClick={() => handleFilterByTech && handleFilterByTech(tech.tech)}
                  style={{ cursor: handleFilterByTech ? 'pointer' : 'default' }}
                  title={handleFilterByTech ? `Click to filter by ${tech.tech}` : ''}
                >
                  <div className="legend-color" style={{ backgroundColor: TECH_COLORS[idx % TECH_COLORS.length] }}></div>
                  <div className="legend-label">{tech.tech}</div>
                  <div className="legend-value">
                    {tech.value.toLocaleString()} MW · {tech.count || 0} project{tech.count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card mid-card">
        <div className="card-header">REDEVELOPMENT POSSIBILITIES</div>
        <div className="card-body">
          <div className="redev-grid">
            {redevelopmentTypes.map((item) => {
              // Determine which redev type to filter by based on label
              let redevType = '';
              if (item.label.includes('BESS')) {
                redevType = 'BESS';
              } else if (item.label.includes('Gas') || item.label.includes('Thermal')) {
                redevType = 'Gas/Thermal';
              } else if (item.label.includes('Solar')) {
                redevType = 'Solar';
              } else if (item.label.includes('Powered Land')) {
                redevType = 'Powered Land';
              } else if (item.label.includes('Plant Optimization')) {
                redevType = 'Plant Optimization';
              }
              
              return (
                <div 
                  key={item.label} 
                  className={`${item.className} ${handleFilterByRedev ? 'clickable' : ''}`}
                  onClick={() => {
                    if (redevType && handleFilterByRedev) {
                      handleFilterByRedev(redevType);
                    }
                  }}
                  style={{ 
                    ...(item.style || {}),
                    cursor: handleFilterByRedev ? 'pointer' : 'default'
                  }}
                  title={handleFilterByRedev && redevType ? `Click to filter by ${redevType}` : ''}
                >
                  <div className="kpi-chip-value">{item.value}</div>
                  <div className="kpi-chip-label">{item.label}</div>
                </div>
              );
            })}
          </div>
          <div className="redev-legend">
            <div className="legend-items">
              <div 
                className="legend-item clickable"
                onClick={() => handleFilterByRedev && handleFilterByRedev('BESS')}
                style={{ cursor: handleFilterByRedev ? 'pointer' : 'default' }}
                title={handleFilterByRedev ? "Click to filter by BESS" : ''}
              >
                <div className="legend-color" style={{ background: "linear-gradient(135deg, #16a34a, #064e3b)" }}></div>
                <div className="legend-label">BESS</div>
              </div>
              <div 
                className="legend-item clickable"
                onClick={() => handleFilterByRedev && handleFilterByRedev('Gas/Thermal')}
                style={{ cursor: handleFilterByRedev ? 'pointer' : 'default' }}
                title={handleFilterByRedev ? "Click to filter by Gas/Thermal" : ''}
              >
                <div className="legend-color" style={{ background: "linear-gradient(135deg, #ef4444, #7f1d1d)" }}></div>
                <div className="legend-label">Gas/Thermal</div>
              </div>
              <div 
                className="legend-item clickable"
                onClick={() => handleFilterByRedev && handleFilterByRedev('Solar')}
                style={{ cursor: handleFilterByRedev ? 'pointer' : 'default' }}
                title={handleFilterByRedev ? "Click to filter by Solar" : ''}
              >
                <div className="legend-color" style={{ background: "linear-gradient(135deg, #facc15, #a16207)" }}></div>
                <div className="legend-label">Solar</div>
              </div>
              <div 
                className="legend-item clickable"
                onClick={() => handleFilterByRedev && handleFilterByRedev('Powered Land')}
                style={{ cursor: handleFilterByRedev ? 'pointer' : 'default' }}
                title={handleFilterByRedev ? "Click to filter by Powered Land" : ''}
              >
                <div className="legend-color" style={{ background: "linear-gradient(135deg, #0ea5e9, #0369a1)" }}></div>
                <div className="legend-label">Powered Land</div>
              </div>
              <div 
                className="legend-item clickable"
                onClick={() => handleFilterByRedev && handleFilterByRedev('Plant Optimization')}
                style={{ cursor: handleFilterByRedev ? 'pointer' : 'default' }}
                title={handleFilterByRedev ? "Click to filter by Plant Optimization" : ''}
              >
                <div className="legend-color" style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}></div>
                <div className="legend-label">Plant Optimization</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MiddleGridSection;
