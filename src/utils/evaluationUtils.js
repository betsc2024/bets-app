/**
 * Utility functions for evaluation calculations
 * Extracted from evaluation components to ensure consistent calculation logic
 */

/**
 * Format score to a consistent decimal format
 * @param {number} score - The score to format
 * @returns {number} - Formatted score with one decimal place
 */
export const formatScore = (score) => {
  return Number(Number(score).toFixed(1));
};

/**
 * Format score to 00.0 format (two digits before decimal, one after)
 * @param {number} score - The score to format
 * @returns {string} - Formatted score as string
 */
export const formatScoreWithPadding = (score) => {
  if (score === "NA") return "NA";
  return score.toFixed(1).padStart(4, '0');
};

/**
 * Process evaluation data to calculate scores by attribute
 * This logic is extracted from SelfEvaluation.jsx and other evaluation components
 * @param {Array} evaluations - Array of evaluation objects
 * @returns {Object} - Object with attribute names as keys and scores as values
 */
export const processEvaluationData = (evaluations) => {
  if (!evaluations || evaluations.length === 0) return {};

  // Group responses by attribute
  const attributeMap = {};
  
  evaluations.forEach(evaluation => {
    if (!evaluation.evaluation_responses) return;

    evaluation.evaluation_responses.forEach(response => {
      const attributeName = response.attribute_statement_options?.attribute_statements?.attributes?.name;
      if (!attributeName) return;

      const weight = response.attribute_statement_options?.weight || 0;

      if (!attributeMap[attributeName]) {
        attributeMap[attributeName] = {
          rawScores: [],
          statements: []
        };
      }

      // Store raw score for this statement
      attributeMap[attributeName].rawScores.push(weight);
      attributeMap[attributeName].statements.push({
        weight,
        maxPossible: 100 // For self evaluation, always 1 evaluator × 100
      });
    });
  });

  // Calculate scores using the documented formula
  const attributeScores = {};
  
  Object.entries(attributeMap).forEach(([attribute, data]) => {
    // Calculate statement level scores
    const statementScores = data.statements.map(statement => {
      // Statement % = (Raw Score / Max Possible) × 100
      return (statement.weight / statement.maxPossible) * 100;
    });

    const numStatements = statementScores.length;
    const rawScore = statementScores.reduce((sum, score) => sum + score, 0);
    const averageScore = numStatements > 0 ? rawScore / numStatements : 0;
    const percentageScore = averageScore > 0 ? (averageScore / 100) * 100 : 0;

    attributeScores[attribute] = formatScore(percentageScore);
  });

  return attributeScores;
};

/**
 * Calculate cumulative score from an array of scores
 * @param {Array} scores - Array of scores
 * @returns {number|string} - Cumulative score or "NA" if no valid scores
 */
export const calculateCumulativeScore = (scores) => {
  // Filter out NA values
  const validScores = scores.filter(score => score !== "NA");
  
  // If no valid scores, return NA
  if (validScores.length === 0) {
    return "NA";
  }
  
  const totalScore = validScores.reduce((sum, score) => sum + score, 0);
  return Number((totalScore / validScores.length).toFixed(1));
};

/**
 * Calculate total score for all attributes
 * This logic is extracted from TotalEvaluation.jsx
 * @param {Object} attributeScores - Object with attribute scores
 * @returns {number|string} - Total score or "NA" if no valid scores
 */
export const calculateTotalScore = (attributeScores) => {
  if (!attributeScores || Object.keys(attributeScores).length === 0) {
    return "NA";
  }
  
  // Filter out NA values
  const validScores = Object.values(attributeScores).filter(score => score !== "NA");
  
  // If no valid scores, return NA
  if (validScores.length === 0) {
    return "NA";
  }
  
  const totalScore = validScores.reduce((sum, score) => sum + Number(score), 0);
  return Number((totalScore / validScores.length).toFixed(1));
};
