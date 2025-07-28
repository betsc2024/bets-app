import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from '@/supabase';
import { toast } from 'sonner';
import { processEvaluationData, formatScoreWithPadding, calculateCumulativeScore, calculateTotalScore, formatScore as formatScoreUtil, processEvaluationDataDemographyMethod } from '@/utils/evaluationUtils';
import QuadrantChart from './charts/QuadrantChart';

// Predefined attribute categories
const ATTRIBUTE_CATEGORIES = {
  // Task-based attributes
  'Accountability & Ownership - (LeaderShip)': 'task',
  'Committed': 'task',
  'Visionary': 'task',
  'Decision Making - (LeaderShip)': 'task',
  'Goals & Objectives': 'task',

  
  // People-based attributes
  'Communication': 'people',
  'Inspiring': 'people',
  'Team building': 'people',
  'Leadership Style': 'people',
  'Emotional Intelligence': 'people',
};

// Code-level flag to control rendering of the raw quotient table
const SHOW_RAW_QUOTIENT_TABLE = false;

export default function QuotientTable({ companyId, userId, beforeBankId, afterBankId }) {
  const [loading, setLoading] = useState(true);
  const [tableData, setTableData] = useState([]);
  const [beforeBankName, setBeforeBankName] = useState('');
  const [afterBankName, setAfterBankName] = useState('');

  const [showCategoryScores, setShowCategoryScores] = useState(true); // Always show category scores
  const [showChart, setShowChart] = useState(false);
  const [categoryScores, setCategoryScores] = useState({
    task: { before: "NA", after: "NA" },
    people: { before: "NA", after: "NA" }
  });
  const [idealScore, setIdealScore] = useState(null);
  const [afterIdealScore, setAfterIdealScore] = useState(null);

  // Fetch ideal score for beforeBankId and afterBankId
  const fetchIdealScore = async (bankId, setter) => {
    if (!bankId) {
      setter(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('attribute_banks')
        .select('ideal_score')
        .eq('id', bankId)
        .single();
      if (!error && data && typeof data.ideal_score === 'number') {
        setter(data.ideal_score);
      } else {
        setter(null);
      }
    } catch (error) {
      setter(null);
    }
  };

  useEffect(() => {
    if (companyId && userId && beforeBankId) {
      fetchData();
    } else {
      setLoading(false);
      setTableData([]);
    }
  }, [companyId, userId, beforeBankId, afterBankId]);
  
  useEffect(() => {
    if (companyId && beforeBankId) {
      fetchIdealScore(beforeBankId, setIdealScore);
    }
    if (companyId && afterBankId && afterBankId !== 'none') {
      fetchIdealScore(afterBankId, setAfterIdealScore);
    } else {
      setAfterIdealScore(null);
    }
  }, [companyId, beforeBankId, afterBankId]);

  // Calculate category scores whenever table data changes
  useEffect(() => {
    if (tableData.length > 0) {
      const scores = calculateCategoryScores();
      setCategoryScores(scores);
    }
  }, [tableData]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch bank names
      await fetchBankNames();
      
      // Fetch data for before bank (required)
      const beforeBankData = await fetchBankData(beforeBankId);
      
      // Fetch data for after bank (if selected and not "none")
      let afterBankData = [];
      if (afterBankId && afterBankId !== 'none') {
        afterBankData = await fetchBankData(afterBankId);
      }
      
      // Process and merge data
      const processedData = processQuotientData(beforeBankData, afterBankData);
      setTableData(processedData);
    } catch (error) {
      console.error("Error fetching quotient data:", error);
      toast.error("Error loading quotient data");
    } finally {
      setLoading(false);
    }
  };

  const fetchBankNames = async () => {
    try {
      // Fetch before bank name
      if (beforeBankId) {
        const { data: beforeBank, error: beforeError } = await supabase
          .from('attribute_banks')
          .select('name')
          .eq('id', beforeBankId)
          .single();
        
        if (!beforeError && beforeBank) {
          setBeforeBankName(beforeBank.name);
        }
      }
      
      // Fetch after bank name if selected and not "none"
      if (afterBankId && afterBankId !== 'none') {
        const { data: afterBank, error: afterError } = await supabase
          .from('attribute_banks')
          .select('name')
          .eq('id', afterBankId)
          .single();
        
        if (!afterError && afterBank) {
          setAfterBankName(afterBank.name);
        }
      } else {
        setAfterBankName('');
      }
    } catch (error) {
      console.error("Error fetching bank names:", error);
    }
  };

  const fetchBankData = async (bankId) => {
    try {
      // Fetch data using the same method as TotalEvaluation.jsx
      const { data: totalData, error: totalError } = await supabase
        .from('evaluation_assignments')
        .select(`
          id,
          attribute_banks (
            id,
            name
          ),
          evaluations!inner (
            id,
            relationship_type,
            evaluation_responses (
              attribute_statement_options ( 
                weight, 
                attribute_statements ( 
                  statement,
                  attributes ( name )
                ) 
              ) 
            )
          )
        `)
        .eq('user_to_evaluate_id', userId)
        .neq('evaluations.relationship_type', 'self')
        .eq('company_id', companyId);

      if (totalError) {
        console.error("Error fetching evaluations:", totalError);
        return [];
      }

      // Filter by bank ID
      const filteredData = totalData?.filter(item => 
        item.attribute_banks?.id === bankId
      );

      return filteredData || [];
    } catch (error) {
      console.error("Error fetching bank data:", error);
      return [];
    }
  };

  const processQuotientData = (beforeBankData, afterBankData) => {
    // Process data using the same method as TotalEvaluation.jsx
    const processData = (data) => {
      const attributeResponses = {};

      // Process all evaluations (same as TotalEvaluation.jsx)
      data.forEach(assignment => {
        assignment.evaluations.forEach(evaluation => {
          evaluation.evaluation_responses.forEach(response => {
            const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
            if (!attributeResponses[attributeName]) {
              attributeResponses[attributeName] = {
                totalScores: []
              };
            }
            attributeResponses[attributeName].totalScores.push({
              weight: response.attribute_statement_options.weight,
              statement: response.attribute_statement_options.attribute_statements.statement
            });
          });
        });
      });

      // Calculate scores using TotalEvaluation.jsx method
      const results = {};
      Object.entries(attributeResponses).forEach(([attribute, data]) => {
        // Calculate per-statement scores for total
        const statementScores = {};
        data.totalScores.forEach((score) => {
          const statementId = score.statement;
          if (!statementScores[statementId]) {
            statementScores[statementId] = {
              total: 0,
              evaluators: 0
            };
          }
          statementScores[statementId].total += score.weight;
          statementScores[statementId].evaluators += 1;
        });

        // Calculate total scores
        const numStatements = Object.keys(statementScores).length;
        const rawScore = Object.values(statementScores).reduce((sum, { total }) => sum + total, 0);
        const evaluatorsPerStatement = Object.values(statementScores)[0]?.evaluators || 0;
        const totalAverageScore = numStatements > 0 ? rawScore / numStatements : 0;
        const maxPossible = evaluatorsPerStatement * 100;
        const totalPercentageScore = maxPossible > 0 ? (totalAverageScore / maxPossible) * 100 : 0;

        results[attribute] = Number(totalPercentageScore.toFixed(1));
      });

      return results;
    };

    // Process before bank data
    const beforeBankScores = processData(beforeBankData);
    
    // Process after bank data if available
    const afterBankScores = afterBankData?.length > 0 ? processData(afterBankData) : {};

    // Get all unique attributes
    const allAttributes = new Set([
      ...Object.keys(beforeBankScores),
      ...Object.keys(afterBankScores)
    ]);

    // Create table data
    return Array.from(allAttributes).map(attribute => {
      const rowData = {
        attributeName: attribute
      };
      
      // Add before bank total score
      rowData[`before_total`] = beforeBankScores[attribute] !== undefined ? beforeBankScores[attribute] : "NA";
      
      // Add after bank total score if applicable
      if (Object.keys(afterBankScores).length > 0) {
        rowData[`after_total`] = afterBankScores[attribute] !== undefined ? afterBankScores[attribute] : "NA";
      }
      
      return rowData;
    });
  };

  // Use formatScoreWithPadding from evaluationUtils for the raw table
  const formatScore = formatScoreUtil;

  // Use processEvaluationData from evaluationUtils
  // Helper function to calculate total score for a specific attribute across all relation types
  // This exactly matches the calculation in TotalEvaluation.jsx and DemographyEvaluation.jsx
  const calculateAttributeTotalScore = (attribute, bankScores) => {
    // If no relation types, return NA
    if (Object.keys(bankScores).length === 0) return "NA";
    
    // Get all scores for this attribute across all relation types
    const scores = [];
    
    for (const relationType in bankScores) {
      if (bankScores[relationType][attribute] !== undefined && bankScores[relationType][attribute] !== "NA") {
        scores.push(Number(bankScores[relationType][attribute]));
      }
    }
    
    if (scores.length === 0) return "NA";
    
    // Calculate total percentage score using the exact same formula as in TotalEvaluation.jsx
    // In TotalEvaluation.jsx, the totalPercentageScore is calculated as:
    // const totalPercentageScore = maxPossible > 0 ? (totalAverageScore / maxPossible) * 100 : 0;
    // Where totalAverageScore is the sum of all scores divided by the number of statements
    
    // For our case, we already have percentage scores, so we just need to average them
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const totalPercentageScore = totalScore / scores.length;
    
    return Number(totalPercentageScore.toFixed(1));
  };

  // Only show After Bank columns if afterBankId is set and not 'none'
  const showAfterBank = afterBankId && afterBankId !== 'none';

  // Calculate data for the Total Quotient section
  const calculateTotalQuotientData = () => {
    // Create an object to store attribute-level total scores
    const totalQuotientData = [];
    
    // Process each attribute row from tableData
    tableData.forEach(row => {
      const attributeName = row.attributeName;
      
      // Get the total scores directly from the processed data
      const beforeTotalScore = row.before_total;
      const afterTotalScore = showAfterBank ? row.after_total : "NA";
      
      // Add to totalQuotientData array
      totalQuotientData.push({
        attributeName,
        beforeTotalScore: beforeTotalScore !== "NA" ? Number(beforeTotalScore.toFixed(1)) : "NA",
        afterTotalScore: afterTotalScore !== "NA" ? Number(afterTotalScore.toFixed(1)) : "NA"
      });
    });
    
    return totalQuotientData;
  };
  

  const totalQuotientData = calculateTotalQuotientData();
  
  // Calculate cumulative scores for Total Quotient
  const calculateTotalQuotientCumulativeScores = () => {
    let beforeScores = [];
    let afterScores = [];
    
    totalQuotientData.forEach(row => {
      if (row.beforeTotalScore !== "NA") {
        beforeScores.push(row.beforeTotalScore);
      }
      
      if (row.afterTotalScore !== "NA") {
        afterScores.push(row.afterTotalScore);
      }
    });
    
    const beforeCumulative = beforeScores.length > 0
      ? beforeScores.reduce((sum, score) => sum + score, 0) / beforeScores.length
      : "NA";
      
    const afterCumulative = afterScores.length > 0
      ? afterScores.reduce((sum, score) => sum + score, 0) / afterScores.length
      : "NA";
    
    return {
      beforeCumulative: beforeCumulative !== "NA" ? Number(beforeCumulative.toFixed(1)) : "NA",
      afterCumulative: afterCumulative !== "NA" ? Number(afterCumulative.toFixed(1)) : "NA"
    };
  };
  
  // Calculate scores by category (task-based or people-based)
  const calculateCategoryScores = () => {
    // Filter totalQuotientData to only include categorized attributes
    const taskRows = totalQuotientData.filter(row => getAttributeCategory(row.attributeName) === 'task');
    const peopleRows = totalQuotientData.filter(row => getAttributeCategory(row.attributeName) === 'people');
    
    // Calculate average scores for task attributes - only consider task-categorized attributes
    const taskBeforeScores = taskRows
      .map(row => row.beforeTotalScore)
      .filter(score => score !== "NA" && score !== undefined);
      
    const taskAfterScores = taskRows
      .map(row => row.afterTotalScore)
      .filter(score => score !== "NA" && score !== undefined);
    
    // Calculate average scores for people attributes - only consider people-categorized attributes
    const peopleBeforeScores = peopleRows
      .map(row => row.beforeTotalScore)
      .filter(score => score !== "NA" && score !== undefined);
      
    const peopleAfterScores = peopleRows
      .map(row => row.afterTotalScore)
      .filter(score => score !== "NA" && score !== undefined);
    
    // Calculate averages
    const taskBeforeAvg = taskBeforeScores.length > 0 ? taskBeforeScores.reduce((sum, score) => sum + score, 0) / taskBeforeScores.length : "NA";
    const taskAfterAvg = taskAfterScores.length > 0 ? taskAfterScores.reduce((sum, score) => sum + score, 0) / taskAfterScores.length : "NA";
    const peopleBeforeAvg = peopleBeforeScores.length > 0 ? peopleBeforeScores.reduce((sum, score) => sum + score, 0) / peopleBeforeScores.length : "NA";
    const peopleAfterAvg = peopleAfterScores.length > 0 ? peopleAfterScores.reduce((sum, score) => sum + score, 0) / peopleAfterScores.length : "NA";
    
    // Return the scores
    return {
      task: { before: taskBeforeAvg, after: taskAfterAvg },
      people: { before: peopleBeforeAvg, after: peopleAfterAvg }
    };
  };
  

  
  const handleShowChartClick = () => {
    // Only show chart if we have valid scores
    if (categoryScores.task.before !== "NA" && categoryScores.people.before !== "NA") {
      setShowChart(true);
    } else {
      toast.error("Unable to show chart - missing task or people scores");
    }
  };

  // Replace the old getAttributeCategory function with a robust version
  const getAttributeCategory = (attributeName) => {
    if (!attributeName) return 'other';
    const normalized = attributeName.trim().toLowerCase();
    for (const key in ATTRIBUTE_CATEGORIES) {
      if (key.trim().toLowerCase() === normalized) {
        return ATTRIBUTE_CATEGORIES[key];
      }
    }
    return 'other';
  };

  const totalQuotientCumulativeScores = calculateTotalQuotientCumulativeScores();

  if (loading) {
    return <div className="flex justify-center items-center p-8">Loading quotient data...</div>;
  }

  if (tableData.length === 0) {
    return <div className="p-4 text-center">No evaluation data available for the selected bank(s).</div>;
  }

  // Function to capitalize first letter for display
  const capitalizeFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Format score for display in Total Quotient table with percentage
  const formatScoreWithPercentage = (score) => {
    if (score === "NA") return "NA";
    return `${score.toFixed(1)}%`;
  };

  return (
    <>
      {/* Raw Quotient Section */}
      {SHOW_RAW_QUOTIENT_TABLE && (
        <>
          <h2 className="text-xl font-semibold text-primary mb-4">Raw Quotient</h2>
          <div className="w-full overflow-x-auto">
            <Table className="border-collapse">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px] border border-gray-300">Attribute</TableHead>
                
                {/* Interleaved Before/After Bank Column Headers */}
                {relationTypes.map(relationType => (
                  <React.Fragment key={`relation_${relationType}`}>
                    {/* Before Bank Column */}
                    {beforeBankRelations.includes(relationType) && (
                      <TableHead className="border border-gray-300">
                        Before Bank - {capitalizeFirst(relationType)}
                      </TableHead>
                    )}
                    
                    {/* After Bank Column (if applicable) */}
                    {showAfterBank && afterBankRelations.includes(relationType) && (
                      <TableHead className="border border-gray-300">
                        After Bank - {capitalizeFirst(relationType)}
                      </TableHead>
                    )}
                  </React.Fragment>
                ))}
                
                {/* Total Column Headers removed */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium border border-gray-300">{row.attributeName}</TableCell>
                  
                  {/* Interleaved Before/After Bank Cells */}
                  {relationTypes.map(relationType => (
                    <React.Fragment key={`relation_${relationType}_${index}`}>
                      {/* Before Bank Cell */}
                      {beforeBankRelations.includes(relationType) && (
                        <TableCell className="border border-gray-300">
                          {row[`before_${relationType}`] === "NA" ? "NA" : formatScore(row[`before_${relationType}`])}
                        </TableCell>
                      )}
                      
                      {/* After Bank Cell (if applicable) */}
                      {showAfterBank && afterBankRelations.includes(relationType) && (
                        <TableCell className="border border-gray-300">
                          {row[`after_${relationType}`] === "NA" ? "NA" : formatScore(row[`after_${relationType}`])}
                        </TableCell>
                      )}
                    </React.Fragment>
                  ))}
                  
                  {/* Total Cells removed */}
                </TableRow>
              ))}
              
              {/* Cumulative Row */}
              <TableRow className="font-bold">
                <TableCell className="border border-gray-300">Cumulative</TableCell>
                
                {/* Interleaved Before/After Bank Cumulative Cells */}
                {relationTypes.map(relationType => (
                  <React.Fragment key={`cumulative_relation_${relationType}`}>
                    {/* Before Bank Cumulative Cell */}
                    {beforeBankRelations.includes(relationType) && (
                      <TableCell className="border border-gray-300">
                        {cumulativeScores[`before_${relationType}`] === "NA" ? "NA" : formatScore(cumulativeScores[`before_${relationType}`])}
                      </TableCell>
                    )}
                    
                    {/* After Bank Cumulative Cell (if applicable) */}
                    {showAfterBank && afterBankRelations.includes(relationType) && (
                      <TableCell className="border border-gray-300">
                        {cumulativeScores[`after_${relationType}`] === "NA" ? "NA" : formatScore(cumulativeScores[`after_${relationType}`])}
                      </TableCell>
                    )}
                  </React.Fragment>
                ))}
                
                {/* Total Cumulative Cells removed */}
              </TableRow>
            </TableBody>
          </Table>
          </div>
        </>
      )}
      
      {/* Total Quotient Section */}
      <h2 className="text-xl font-semibold text-primary mb-4 mt-8">Total Quotient</h2>
      <div className="w-full overflow-x-auto">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow>
              <TableHead className="border border-gray-300 w-[100px]">Category</TableHead>
              <TableHead className="w-[300px] border border-gray-300">Attribute</TableHead>
              <TableHead className="border border-gray-300">Before Total % Score</TableHead>
              {showAfterBank && (
                <TableHead className="border border-gray-300">After Total % Score</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {totalQuotientData.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="border border-gray-300 w-24">
                  <div className="text-center">
                    {getAttributeCategory(row.attributeName) === 'task' ? (
                      <span className="text-sm font-medium text-blue-600 px-2 py-1 rounded bg-blue-100">Task</span>
                    ) : getAttributeCategory(row.attributeName) === 'people' ? (
                      <span className="text-sm font-medium text-green-600 px-2 py-1 rounded bg-green-100">People</span>
                    ) : (
                      <span className="text-sm font-medium text-gray-600 px-2 py-1 rounded bg-gray-100">Other</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium border border-gray-300">{row.attributeName}</TableCell>
                <TableCell className="border border-gray-300">
                  {row.beforeTotalScore === "NA" ? "NA" : formatScoreWithPercentage(row.beforeTotalScore)}
                </TableCell>
                {showAfterBank && (
                  <TableCell className="border border-gray-300">
                    {row.afterTotalScore === "NA" ? "NA" : formatScoreWithPercentage(row.afterTotalScore)}
                  </TableCell>
                )}
              </TableRow>
            ))}
            
            {/* Cumulative row removed as requested */}
            
            {/* Category Score Rows */}
            <TableRow>
              <TableCell className="border border-gray-300 w-[100px] font-bold bg-blue-50">Task</TableCell>
              <TableCell className="border border-gray-300 w-[300px] font-bold bg-blue-50">Task-based attributes</TableCell>
              <TableCell className="border border-gray-300 font-bold bg-blue-50">
                {categoryScores.task.before !== "NA" ? formatScoreWithPercentage(categoryScores.task.before) : "NA"}
              </TableCell>
              {showAfterBank && (
                <TableCell className="border border-gray-300 font-bold bg-blue-50">
                  {categoryScores.task.after !== "NA" ? formatScoreWithPercentage(categoryScores.task.after) : "NA"}
                </TableCell>
              )}
            </TableRow>
            <TableRow>
              <TableCell className="border border-gray-300 w-[100px] font-bold bg-green-50">People</TableCell>
              <TableCell className="border border-gray-300 w-[300px] font-bold bg-green-50">People-based attributes</TableCell>
              <TableCell className="border border-gray-300 font-bold bg-green-50">
                {categoryScores.people.before !== "NA" ? formatScoreWithPercentage(categoryScores.people.before) : "NA"}
              </TableCell>
              {showAfterBank && (
                <TableCell className="border border-gray-300 font-bold bg-green-50">
                  {categoryScores.people.after !== "NA" ? formatScoreWithPercentage(categoryScores.people.after) : "NA"}
                </TableCell>
              )}
            </TableRow>
            
            {/* Show Chart Button */}
            <TableRow>
              <TableCell colSpan={showAfterBank ? 4 : 3} className="border border-gray-300 text-center py-4">
                <Button 
                  onClick={handleShowChartClick}
                  className="bg-primary text-white hover:bg-primary/90 py-3 px-6 text-lg"
                >
                  <span className="flex items-center gap-2 justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                    </svg>
                    Show Leadership Style Chart
                  </span>
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      
      {/* Quadrant Chart Modal */}
      {showChart && (
        <QuadrantChart 
          taskScore={categoryScores.task.before} 
          peopleScore={categoryScores.people.before} 
          taskScoreAfter={showAfterBank ? categoryScores.task.after : null} 
          peopleScoreAfter={showAfterBank ? categoryScores.people.after : null} 
          showAfterBank={showAfterBank}
          onClose={() => setShowChart(false)} 
          showQuadrantLabels={true}
          idealScorePoint={showAfterBank && afterIdealScore ? { x: afterIdealScore, y: afterIdealScore } : idealScore ? { x: idealScore, y: idealScore } : undefined}
        />
      )}
    </>
  );
}
