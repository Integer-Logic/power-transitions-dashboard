import React from 'react';
import PipelineTable from '../Pipeline/PipelineTable';

const BottomGridSection = ({ 
  counterparties, 
  pipelineRows, 
  sortConfig, 
  handleSort, 
  getSortDirectionClass, 
  resetSort,
  getSortedPipelineRows,
  handleProjectClick,
  kpiRow1,
  handleEditProject,
  handleDeleteProject,
  activeTechFilter,
  clearTechFilter,
  handleFilterByCounterparty,
  activeCounterpartyFilter,
  clearCounterpartyFilter,
  activeIsoFilter,
  activeRedevFilter,
  clearIsoFilter,
  clearRedevFilter,
  selectedProjectType
}) => {

    console.log('🔍 BottomGridSection - Props received:', {
    hasHandleEditProject: !!handleEditProject,
    typeOfHandleEditProject: typeof handleEditProject,
    hasHandleDeleteProject: !!handleDeleteProject,
    typeOfHandleDeleteProject: typeof handleDeleteProject,
    hasActiveTechFilter: !!activeTechFilter,
    hasClearTechFilter: !!clearTechFilter,
    hasHandleFilterByCounterparty: !!handleFilterByCounterparty,
    hasActiveCounterpartyFilter: !!activeCounterpartyFilter,
    selectedProjectType: selectedProjectType 
  });

  return (
    <section className="bottom-grid">
      <div className="card counterpart-card">
        <div className="card-header">
          <div className="counterparty-header">
            <span>BY COUNTERPARTY</span>
            <span className="counterparty-total">
              TOTAL: {counterparties.reduce((sum, cp) => sum + parseFloat(cp.gw || 0), 0).toFixed(1)} GW
            </span>
          </div>
        </div>
        <div className="card-body counterparty-chart-body">
          <div className="counterparty-chart-container">
            {counterparties.map((cp, index) => {
              const totalGW = counterparties.reduce((sum, cp) => sum + parseFloat(cp.gw || 0), 0);
              const barWidth = totalGW > 0 ? (parseFloat(cp.gw || 0) / totalGW * 100).toFixed(1) : 0;
              
              const barColors = [
                '#60a5fa', '#34d399', '#fbbf24', '#a78bfa',
                '#f87171', '#22d3ee', '#fb923c', '#c084fc',
                '#4ade80', '#38bdf8', '#f472b6', '#e879f9',
              ];
              
              const barColor = barColors[index % barColors.length];
              
              return (
                <div 
                  key={cp.name} 
                  className="counterparty-chart-row clickable"
                  onClick={() => handleFilterByCounterparty && handleFilterByCounterparty(cp.name)}
                  style={{ cursor: handleFilterByCounterparty ? 'pointer' : 'default' }}
                  title={handleFilterByCounterparty ? `Click to filter by ${cp.name}` : ''}
                >
                  <div className="counterparty-name-bar">
                    <div className="counterparty-name-truncated">
                      {cp.name && cp.name.length > 25 ? cp.name.substring(0, 22) + '...' : cp.name || 'Unknown'}
                    </div>
                    <div className="counterparty-chart-bar">
                      <div 
                        className="counterparty-bar-fill"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: barColor,
                          opacity: activeCounterpartyFilter === cp.name ? 1 : 0.8
                        }}
                        data-tooltip={`${cp.gw || '0'} GW (${barWidth}% of total)`}
                      ></div>
                    </div>
                  </div>
                  <div className="counterparty-metrics">
                    <div className="counterparty-metric primary">
                      <span className="metric-value">{cp.gw || '0'}</span>
                      <span className="metric-label">GW</span>
                    </div>
                    <div className="counterparty-metric">
                      <span className="metric-value">
                        {cp.projectCount || (cp.projects && !isNaN(parseInt(cp.projects)) ? parseInt(cp.projects) : '0')}
                      </span>
                      <span className="metric-label">PRODS</span>
                    </div>
                    <div className="counterparty-metric">
                      <span className="metric-value">{cp.avg || '0.00'}</span>
                      <span className="metric-label">AVG</span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {counterparties.length === 0 && (
              <div className="counterparty-chart-row">
                <div className="counterparty-name-bar">
                  <div className="counterparty-name-truncated">No counterparty data available</div>
                </div>
              </div>
            )}
          </div>
          
          {counterparties.length > 0 && (
            <div className="counterparty-legend">
              <div className="legend-title">Counterparty Legend</div>
              <div className="legend-items">
                {counterparties.slice(0, 8).map((cp, index) => {
                  const barColors = [
                    '#60a5fa', '#34d399', '#fbbf24', '#a78bfa',
                    '#f87171', '#22d3ee', '#fb923c', '#c084fc'
                  ];
                  const barColor = barColors[index % barColors.length];
                  
                  return (
                    <div 
                      key={cp.name} 
                      className="legend-item clickable"
                      onClick={() => handleFilterByCounterparty && handleFilterByCounterparty(cp.name)}
                      style={{ cursor: handleFilterByCounterparty ? 'pointer' : 'default' }}
                      title={handleFilterByCounterparty ? `Click to filter by ${cp.name}` : ''}
                    >
                      <div className="legend-color" style={{ backgroundColor: barColor }}></div>
                      <div className="legend-label">
                        {cp.name && cp.name.length > 15 ? cp.name.substring(0, 13) + '...' : cp.name || 'Unknown'}
                      </div>
                    </div>
                  );
                })}
                {counterparties.length > 8 && (
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#475569' }}></div>
                    <div className="legend-label">+{counterparties.length - 8} more</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="card pipeline-card">
        <div className="card-header pipeline-header">
          <div>
            <div className="pipeline-title">Pipeline Details</div>
            <div className="pipeline-sub">{kpiRow1[0]?.value || 0} projects · {kpiRow1[1]?.value || "0 GW"}</div>
          </div>
        </div>
        
        {/* UPDATED: Show sort controls when any filter is active */}
        {(sortConfig.column && sortConfig.direction !== 'none' || activeTechFilter || activeIsoFilter || activeRedevFilter || activeCounterpartyFilter) && (
          <div className="sort-controls" style={{ 
            padding: '8px 18px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div className="sort-status">
              {sortConfig.column && sortConfig.direction !== 'none' && (
                <>
                  <span>Sorted by:</span>
                  <strong>
                    {sortConfig.column}
                  </strong>
                  <span>({sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'})</span>
                </>
              )}
              {/* Display active filters */}
              {(activeTechFilter || activeIsoFilter || activeRedevFilter || activeCounterpartyFilter) && (
                <div style={{ marginTop: sortConfig.column ? '4px' : '0' }}>
                  <span>Filtered by:</span>
                  {activeTechFilter && (
                    <strong style={{ marginLeft: '4px', color: '#f59e0b' }}>
                      Tech: {activeTechFilter}
                    </strong>
                  )}
                  {activeIsoFilter && (
                    <strong style={{ marginLeft: '4px', color: '#3b82f6' }}>
                      ISO: {activeIsoFilter}
                    </strong>
                  )}
                  {activeRedevFilter && (
                    <strong style={{ marginLeft: '4px', color: '#10b981' }}>
                      Redev: {activeRedevFilter}
                    </strong>
                  )}
                  {activeCounterpartyFilter && (
                    <strong style={{ marginLeft: '4px', color: '#8b5cf6' }}>
                      Counterparty: {activeCounterpartyFilter}
                    </strong>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Clear tech filter button */}
              {activeTechFilter && clearTechFilter && (
                <button 
                  className="reset-tech-filter-btn"
                  onClick={clearTechFilter}
                  style={{
                    padding: '6px 12px',
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#d97706'}
                  onMouseLeave={(e) => e.target.style.background = '#f59e0b'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Tech Filter
                </button>
              )}
              {/* Clear ISO filter button */}
              {activeIsoFilter && clearIsoFilter && (
                <button 
                  className="reset-iso-filter-btn"
                  onClick={clearIsoFilter}
                  style={{
                    padding: '6px 12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                  onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear ISO Filter
                </button>
              )}
              {/* Clear Redev filter button */}
              {activeRedevFilter && clearRedevFilter && (
                <button 
                  className="reset-redev-filter-btn"
                  onClick={clearRedevFilter}
                  style={{
                    padding: '6px 12px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#059669'}
                  onMouseLeave={(e) => e.target.style.background = '#10b981'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Redev Filter
                </button>
              )}
              {/* Clear counterparty filter button */}
              {activeCounterpartyFilter && clearCounterpartyFilter && (
                <button 
                  className="reset-counterparty-filter-btn"
                  onClick={clearCounterpartyFilter}
                  style={{
                    padding: '6px 12px',
                    background: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#7c3aed'}
                  onMouseLeave={(e) => e.target.style.background = '#8b5cf6'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Counterparty Filter
                </button>
              )}
              {/* Reset sort button */}
              {sortConfig.column && sortConfig.direction !== 'none' && (
                <button 
                  className="reset-sort-btn"
                  onClick={resetSort}
                  style={{
                    padding: '6px 12px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                  onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reset Sort
                </button>
              )}
            </div>

          </div>
        )}
        
        <PipelineTable 
          pipelineRows={pipelineRows}
          sortConfig={sortConfig}
          handleSort={handleSort}
          getSortDirectionClass={getSortDirectionClass}
          resetSort={resetSort}
          getSortedPipelineRows={getSortedPipelineRows}
          handleProjectClick={handleProjectClick}
          handleEditProject={handleEditProject}
          handleDeleteProject={handleDeleteProject}
          activeTechFilter={activeTechFilter}
          clearTechFilter={clearTechFilter}
          activeCounterpartyFilter={activeCounterpartyFilter}
          clearCounterpartyFilter={clearCounterpartyFilter}
          clearIsoFilter={clearIsoFilter}
          clearRedevFilter={clearRedevFilter}
          activeIsoFilter={activeIsoFilter}
          activeRedevFilter={activeRedevFilter}
          selectedProjectType={selectedProjectType}
        />
      </div>
    </section>
  );
};

BottomGridSection.defaultProps = {
  handleEditProject: () => console.warn('BottomGridSection: handleEditProject not provided'),
  handleDeleteProject: () => console.warn('BottomGridSection: handleDeleteProject not provided'),
  clearTechFilter: () => console.warn('BottomGridSection: clearTechFilter not provided'),
  handleFilterByCounterparty: () => console.warn('BottomGridSection: handleFilterByCounterparty not provided'),
  clearCounterpartyFilter: () => console.warn('BottomGridSection: clearCounterpartyFilter not provided'),
  clearIsoFilter: () => console.warn('BottomGridSection: clearIsoFilter not provided'),
  clearRedevFilter: () => console.warn('BottomGridSection: clearRedevFilter not provided'),
  selectedProjectType: 'All' 
};

export default BottomGridSection;