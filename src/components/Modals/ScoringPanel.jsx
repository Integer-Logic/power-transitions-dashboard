import React from 'react';
import { scoringWeights } from '../../constants/scoringWeights';

const ScoringPanel = ({ showScoringPanel, setShowScoringPanel }) => {
  if (!showScoringPanel) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowScoringPanel(false)}>
      <div className="modal-content scoring-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Scoring Criteria & Weights</h2>
          <button className="modal-close" onClick={() => setShowScoringPanel(false)}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="scoring-grid">
            <div className="score-category-card thermal">
              <h3 className="score-category-title">
                Thermal Operating Score
              </h3>
              <div className="score-weights-grid">
                <div className="weight-item">
                  <span className="weight-label">COD (Year)</span>
                  <div className="weight-details">
                    <span className="weight-value">{scoringWeights.thermal.unit_cod * 100}%</span>
                    <div className="weight-bar">
                      <div className="weight-fill" style={{ width: `${scoringWeights.thermal.unit_cod * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="weight-rules">
                    <div className="rule">• &lt;2000: 3 points</div>
                    <div className="rule">• 2000-2005: 2 points</div>
                    <div className="rule">• &gt;2005: 1 point</div>
                  </div>
                </div>
                
                <div className="weight-item">
                  <span className="weight-label">Markets</span>
                  <div className="weight-details">
                    <span className="weight-value">{scoringWeights.thermal.markets * 100}%</span>
                    <div className="weight-bar">
                      <div className="weight-fill" style={{ width: `${scoringWeights.thermal.markets * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="weight-rules">
                    <div className="rule premium">• PJM, NYISO, ISONE: 3 pts</div>
                    <div className="rule good">• MISO North, SERC: 2 pts</div>
                    <div className="rule neutral">• SPP, MISO South: 1 pt</div>
                    <div className="rule poor">• ERCOT, WECC, CAISO: 0 pts</div>
                  </div>
                </div>
                
                <div className="weight-item">
                  <span className="weight-label">Transactability</span>
                  <div className="weight-details">
                    <span className="weight-value">{scoringWeights.thermal.transactability * 100}%</span>
                    <div className="weight-bar">
                      <div className="weight-fill" style={{ width: `${scoringWeights.thermal.transactability * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="weight-rules">
                    <div className="rule">• Bilateral w/ developed relationship: 3 pts</div>
                    <div className="rule">• Bilateral w/new relationship: 2 pts</div>
                    <div className="rule">• Competitive process (&gt;10 bidders): 1 pt</div>
                  </div>
                </div>
                
                <div className="weight-item">
                  <span className="weight-label">Environmental</span>
                  <div className="weight-details">
                    <span className="weight-value">{scoringWeights.thermal.environmental * 100}%</span>
                    <div className="weight-bar">
                      <div className="weight-fill" style={{ width: `${scoringWeights.thermal.environmental * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="weight-rules">
                    <div className="rule">• Known & mitigable w/ advantage: 3 pts</div>
                    <div className="rule">• Known & mitigable: 2 pts</div>
                    <div className="rule">• Unknown: 1 pt</div>
                    <div className="rule poor">• Not mitigable: 0 pts</div>
                  </div>
                </div>
                
                <div className="weight-item">
                  <span className="weight-label">Thermal Optimization</span>
                  <div className="weight-details">
                    <span className="weight-value">{scoringWeights.thermal.thermal_optimization * 100}%</span>
                    <div className="weight-bar">
                      <div className="weight-fill" style={{ width: `${scoringWeights.thermal.thermal_optimization * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="weight-rules">
                    <div className="rule">• Readily apparent value add: 2 pts</div>
                    <div className="rule">• No identifiable value add: 1 pt</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="score-category-card redev">
              <h3 className="score-category-title">
                Redevelopment Score
              </h3>
              <div className="score-weights-grid">
                <div className="weight-item">
                  <span className="weight-label">Market Score</span>
                  <div className="weight-details">
                    <span className="weight-value">{scoringWeights.redevelopment.market * 100}%</span>
                    <div className="weight-bar">
                      <div className="weight-fill" style={{ width: `${scoringWeights.redevelopment.market * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="weight-rules">
                    <div className="rule">• Primary: 3 pts</div>
                    <div className="rule">• Secondary: 2 pts</div>
                    <div className="rule">• Uncertain: 1 pt</div>
                    <div className="rule poor">• Challenging: 0 pts</div>
                  </div>
                </div>
                
                <div className="weight-item">
                  <span className="weight-label">Infrastructure</span>
                  <div className="weight-details">
                    <span className="weight-value">{scoringWeights.redevelopment.infra * 100}%</span>
                    <div className="weight-bar">
                      <div className="weight-fill" style={{ width: `${scoringWeights.redevelopment.infra * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="weight-rules">
                    <div className="rule">• Sufficient utilities onsite: 3 pts</div>
                    <div className="rule">• Low cost to connect: 2 pts</div>
                    <div className="rule">• High cost/uncertain: 1 pt</div>
                    <div className="rule poor">• No clear path: 0 pts</div>
                  </div>
                </div>
                
                <div className="weight-item">
                  <span className="weight-label">Interconnection (IX)</span>
                  <div className="weight-details">
                    <span className="weight-value">{scoringWeights.redevelopment.ix * 100}%</span>
                    <div className="weight-bar">
                      <div className="weight-fill" style={{ width: `${scoringWeights.redevelopment.ix * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="weight-rules">
                    <div className="rule">• Secured IX rights: 3 pts</div>
                    <div className="rule">• No upgrades needed: 2 pts</div>
                    <div className="rule">• Minimal upgrades: 1 pt</div>
                    <div className="rule poor">• Major upgrades: 0 pts</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowScoringPanel(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScoringPanel;