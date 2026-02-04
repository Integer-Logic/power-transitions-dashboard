import { scoringWeights } from '../constants/scoringWeights';
import { calculateAllScores } from './scoreCalculations';

// REVERTED: Back to original 50-50 weights (no transmission in ranking)
const OVERALL_WEIGHTS = {
  thermal: 0.50,           // 50% (was 40%)
  redevelopment: 0.50      // 50% (was 40%)
  // Transmission removed from ranking (0%)
};

// Calculate thermal operating score breakdown (for analysis only, not for scoring)
function calculateThermalBreakdown(project) {
  let breakdown = {};
  
  // 1. Plant COD analysis
  const plantCOD = parseInt(project["Legacy COD"] || project["Plant COD"] || "0");
  let codAnalysis;
  
  if (plantCOD < 2000) {
    codAnalysis = "Vintage plant (<2000) - higher retirement potential";
  } else if (plantCOD <= 2005) {
    codAnalysis = "Mid-age plant (2000-2005)";
  } else {
    codAnalysis = "Newer plant (>2005) - lower retirement likelihood";
  }
  
  breakdown.unit_cod = {
    analysis: codAnalysis,
    value: plantCOD
  };
  
  // 2. Markets analysis
  const iso = project["ISO"] || "";
  let marketAnalysis;
  
  if (["PJM", "NYISO", "ISONE"].includes(iso)) {
    marketAnalysis = "Premium market with strong pricing";
  } else if (["MISO North", "SERC"].includes(iso)) {
    marketAnalysis = "Established market";
  } else if (["SPP", "MISO South"].includes(iso)) {
    marketAnalysis = "Developing market";
  } else {
    marketAnalysis = "Challenging market (ERCOT, WECC, CAISO)";
  }
  
  breakdown.markets = {
    analysis: marketAnalysis,
    value: iso
  };
  
  // 3. Transactability analysis
  const transactability = project["Transactibility"] || "";
  let transactAnalysis;
  
  if (transactability.includes("Bilateral") && transactability.includes("developed")) {
    transactAnalysis = "Bilateral with developed relationship";
  } else if (transactability.includes("Bilateral")) {
    transactAnalysis = "Bilateral with new relationship";
  } else if (transactability.includes("Competitive") || transactability.includes(">10")) {
    transactAnalysis = "Competitive process (>10 bidders)";
  } else {
    transactAnalysis = "Unknown transactability";
  }
  
  breakdown.transactability = {
    analysis: transactAnalysis,
    value: transactability
  };
  
  // 4. Environmental analysis
  const envScore = parseFloat(project["Environmental Score"] || "2");
  let envAnalysis;
  
  if (envScore >= 3) {
    envAnalysis = "Known & mitigable with advantage";
  } else if (envScore >= 2) {
    envAnalysis = "Known & mitigable";
  } else if (envScore >= 1) {
    envAnalysis = "Unknown environmental issues";
  } else {
    envAnalysis = "Not mitigable";
  }
  
  breakdown.environmental = {
    analysis: envAnalysis,
    value: envScore
  };
  
  // 5. Thermal Optimization analysis
  const thermalOpt = project["Thermal Optimization"] || "";
  let thermalAnalysis;
  
  if (thermalOpt.includes("Readily") || thermalOpt.includes("value add")) {
    thermalAnalysis = "Readily apparent value add";
  } else {
    thermalAnalysis = "No identifiable value add";
  }
  
  breakdown.thermal_optimization = {
    analysis: thermalAnalysis,
    value: thermalOpt
  };
  
  return breakdown;
}

// Calculate redevelopment score breakdown (for analysis only, not for scoring)
function calculateRedevelopmentBreakdown(project) {
  let breakdown = {};
  
  // 1. Market analysis
  const marketScore = parseFloat(project["Market Score"] || "2");
  let marketAnalysis;
  
  if (marketScore >= 3) {
    marketAnalysis = "Primary market position";
  } else if (marketScore >= 2) {
    marketAnalysis = "Secondary market position";
  } else if (marketScore >= 1) {
    marketAnalysis = "Uncertain market position";
  } else {
    marketAnalysis = "Challenging market position";
  }
  
  breakdown.market = {
    analysis: marketAnalysis,
    value: marketScore
  };
  
  // 2. Infrastructure analysis
  const infraScore = parseFloat(project["Infra"] || "2");
  let infraAnalysis;
  
  if (infraScore >= 3) {
    infraAnalysis = "Sufficient utilities onsite";
  } else if (infraScore >= 2) {
    infraAnalysis = "Low cost to connect utilities";
  } else if (infraScore >= 1) {
    infraAnalysis = "High cost/uncertain connection";
  } else {
    infraAnalysis = "No clear path for utilities";
  }
  
  breakdown.infra = {
    analysis: infraAnalysis,
    value: infraScore
  };
  
  // 3. Interconnection (IX) analysis
  const ixScore = parseFloat(project["IX"] || "2");
  let ixAnalysis;
  
  if (ixScore >= 3) {
    ixAnalysis = "Secured interconnection rights";
  } else if (ixScore >= 2) {
    ixAnalysis = "No upgrades needed for interconnection";
  } else if (ixScore >= 1) {
    ixAnalysis = "Minimal upgrades required";
  } else {
    ixAnalysis = "Major upgrades required";
  }
  
  breakdown.ix = {
    analysis: ixAnalysis,
    value: ixScore
  };
  
  return breakdown;
}

// MAIN FUNCTION: Generate expert analysis USING CALCULATED VALUES
export function generateExpertAnalysis(projectData) {
  // Use canonical score calculation function
  const scores = calculateAllScores(projectData);

  // Handle null scores (N/A values) - use 0 as fallback for display
  const overallScore = scores.overall_score !== null ? scores.overall_score.toFixed(1) : "0.0";
  const thermalScore = scores.thermal_score !== null ? scores.thermal_score.toFixed(1) : "0.0";
  const redevelopmentScore = scores.redevelopment_score !== null ? scores.redevelopment_score.toFixed(1) : "0.0";

  // Calculate breakdowns for analysis text only (not for scoring)
  const thermalBreakdown = calculateThermalBreakdown(projectData);
  const redevBreakdown = calculateRedevelopmentBreakdown(projectData);

  // Determine rating based on EXCEL scores (use numeric value for comparison)
  const overallNumeric = parseFloat(overallScore);
  const overallRating = overallNumeric >= 4.5 ? "Strong" :
                       overallNumeric >= 3.0 ? "Moderate" : "Weak";
  const ratingClass = overallNumeric >= 4.5 ? "strong" :
                     overallNumeric >= 3.0 ? "moderate" : "weak";
  
  // Generate strengths and risks based on breakdowns
  const strengths = generateStrengths(thermalBreakdown, redevBreakdown, projectData);
  const risks = generateRisks(thermalBreakdown, redevBreakdown, projectData);
  
  // Calculate confidence
  const confidence = calculateConfidence(projectData);
  
  return {
    // Core scores - USING EXCEL VALUES
    overallScore: overallScore,
    overallRating: overallRating,
    ratingClass: ratingClass,
    
    // Thermal score - USING EXCEL VALUE
    thermalScore: thermalScore,
    thermalBreakdown: thermalBreakdown,
    
    // Redevelopment score - USING EXCEL VALUE
    redevelopmentScore: redevelopmentScore,
    redevelopmentBreakdown: redevBreakdown,
    
    // Project metadata
    projectName: projectData["Project Name"] || projectData["Project Codename"] || `Project ${projectData.id || ""}`,
    projectId: projectData.id || "N/A",
    assessmentDate: new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }),
    analyst: "AI Analysis Engine",
    confidence: confidence,
    recommendation: getRecommendation(parseFloat(overallScore)),
    
    // Analysis content
    strengths: strengths,
    risks: risks,
    
    // Summary for quick reference
    summary: {
      thermal: thermalScore,
      redevelopment: redevelopmentScore
    }
  };
}

// Helper function to calculate confidence level
function calculateConfidence(projectData) {
  let confidence = 70; // Base confidence
  
  // Increase if we have complete data
  if (projectData["Overall Project Score"] && projectData["Overall Project Score"] !== "") {
    confidence += 10;
  }
  if (projectData["Thermal Operating Score"] && projectData["Thermal Operating Score"] !== "") {
    confidence += 5;
  }
  if (projectData["Redevelopment Score"] && projectData["Redevelopment Score"] !== "") {
    confidence += 5;
  }
  if (projectData["ISO"] && projectData["ISO"] !== "") {
    confidence += 5;
  }
  
  return Math.min(confidence, 95);
}

// Helper function to generate strengths
function generateStrengths(thermal, redev, projectData) {
  const strengths = [];
  
  // Thermal strengths based on breakdown analysis
  if (thermal.environmental && thermal.environmental.value >= 2) {
    strengths.push("Environmental conditions known and mitigable");
  }
  
  if (thermal.markets && ["PJM", "NYISO", "ISONE"].includes(thermal.markets.value)) {
    strengths.push(`Favorable market position in ${thermal.markets.value}`);
  }
  
  if (thermal.transactability && thermal.transactability.analysis.includes("Bilateral")) {
    strengths.push("Bilateral transaction structure provides relationship advantage");
  }
  
  // Redevelopment strengths
  if (redev.market && redev.market.value >= 2) {
    strengths.push("Good market position for redevelopment");
  }
  
  if (redev.infra && redev.infra.value >= 2) {
    strengths.push("Adequate infrastructure for future development");
  }
  
  // Fallback strengths
  if (strengths.length === 0) {
    strengths.push("Site has existing energy infrastructure that can be leveraged");
    strengths.push("Potential for modernization and efficiency improvements");
  }
  
  return strengths.slice(0, 4);
}

// Helper function to generate risks
function generateRisks(thermal, redev, projectData) {
  const risks = [];
  
  // Thermal risks
  if (thermal.unit_cod && thermal.unit_cod.value < 2000) {
    risks.push("Vintage plant may have higher maintenance and retirement risks");
  }
  
  if (thermal.markets && !["PJM", "NYISO", "ISONE"].includes(thermal.markets.value)) {
    risks.push(`Market ${thermal.markets.value} may have limited pricing opportunities`);
  }
  
  // Redevelopment risks
  if (redev.ix && redev.ix.value < 2) {
    risks.push("Interconnection upgrades may be required for redevelopment");
  }
  
  // Fallback risks
  if (risks.length === 0) {
    risks.push("Standard market and operational risks associated with energy projects");
    risks.push("Regulatory changes could impact project viability");
  }
  
  return risks.slice(0, 3);
}

// Helper function to get recommendation
function getRecommendation(overallScore) {
  if (overallScore >= 4.5) {
    return "Highly Recommended - Strong investment opportunity";
  } else if (overallScore >= 3.5) {
    return "Recommended - Good potential with manageable risks";
  } else if (overallScore >= 2.5) {
    return "Consider with Caution - Requires detailed due diligence";
  } else {
    return "Not Recommended - Significant challenges identified";
  }
}

// Export for compatibility with existing code - Now uses canonical calculation
export function calculateProjectScores(projectData) {
  // Use canonical score calculation function
  const scores = calculateAllScores(projectData);

  return {
    overall: scores.overall_score.toFixed(1),
    thermal: scores.thermal_score.toFixed(1),
    redevelopment: scores.redevelopment_score.toFixed(1)
  };
}

// Export for ExpertScoresPanel.jsx compatibility
export function getAllExpertAnalyses() {
  console.warn("⚠️ getAllExpertAnalyses called from scoring.js - This should come from App.jsx");
  console.warn("Check ExpertScoresPanel.jsx - it should receive this as a prop, not import it");
  return [];
}

// Test function - Updated to verify calculated values
export function testScoring() {
  // Test case: Roseton Project (from Excel verification)
  const testProject = {
    id: 1,
    "Project Name": "Roseton",
    "Project Codename": "RST-001",
    // Component values from Excel
    "Plant  COD": 3,       // Plant COD score
    "Markets": 3,          // Markets score
    "Transactability Scores": 2,  // Transactability score
    "Thermal Optimization": 1,    // Thermal Opt (min 1)
    "Envionmental Score": 2,      // Environmental score
    "Market Score": 3,     // Market Score for redev
    "Infra": 3,            // Infrastructure
    "IX": 2,               // Interconnection
    "Co-Locate/Repower": "Codevelopment",  // Not "Repower" so multiplier = 1
    // Legacy values for reference
    "Legacy COD": "1998",
    "ISO": "NYISO"
  };

  // Calculate scores using canonical function
  const scores = calculateAllScores(testProject);
  const analysis = generateExpertAnalysis(testProject);

  console.log("=== SCORE CALCULATION TEST (Roseton) ===");
  console.log("Input Component Values:");
  console.log(`  Plant COD: ${testProject["Plant  COD"]}`);
  console.log(`  Markets: ${testProject["Markets"]}`);
  console.log(`  Transactability: ${testProject["Transactability Scores"]}`);
  console.log(`  Thermal Opt: ${testProject["Thermal Optimization"]}`);
  console.log(`  Environmental: ${testProject["Envionmental Score"]}`);
  console.log(`  Market Score: ${testProject["Market Score"]}`);
  console.log(`  Infra: ${testProject["Infra"]}`);
  console.log(`  IX: ${testProject["IX"]}`);
  console.log(`  Co-Locate/Repower: ${testProject["Co-Locate/Repower"]}`);

  console.log("\nCalculated Scores:");
  console.log(`  Thermal: ${scores.thermal_score}/3.0`);
  console.log(`    = (3×0.2) + (3×0.3) + (2×0.3) + (1×0.05) + (2×0.15)`);
  console.log(`    = 0.6 + 0.9 + 0.6 + 0.05 + 0.3 = ${scores.thermal_score}`);
  console.log(`  Redevelopment: ${scores.redevelopment_score}/3.0`);
  console.log(`    = (3×0.4) + (3×0.3) + (2×0.3) × 1`);
  console.log(`    = 1.2 + 0.9 + 0.6 = ${scores.redevelopment_score}`);
  console.log(`  Overall: ${scores.overall_score}/6.0 (${scores.overall_rating})`);

  // Expected values from Excel
  const expectedThermal = 2.45;  // Adjusted for thermal_opt minimum of 1
  const expectedRedev = 2.7;
  const expectedOverall = 5.15;  // Adjusted

  console.log("\nVerification:");
  console.log(`  Thermal: ${Math.abs(scores.thermal_score - expectedThermal) < 0.1 ? "✅ PASS" : "❌ FAIL"} (expected ~${expectedThermal})`);
  console.log(`  Redev: ${Math.abs(scores.redevelopment_score - expectedRedev) < 0.1 ? "✅ PASS" : "❌ FAIL"} (expected ~${expectedRedev})`);
  console.log(`  Overall: ${Math.abs(scores.overall_score - expectedOverall) < 0.2 ? "✅ PASS" : "❌ FAIL"} (expected ~${expectedOverall})`);

  return { scores, analysis };
}

// Export all necessary functions
export { scoringWeights };