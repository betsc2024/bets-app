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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from '@/supabase';
import { toast } from 'sonner';
import { processEvaluationData, formatScoreWithPadding, calculateCumulativeScore, calculateTotalScore, formatScore as formatScoreUtil } from '@/utils/evaluationUtils';
import QuadrantChart from './charts/QuadrantChart';

export default function QuotientTable({ companyId, userId, beforeBankId, afterBankId }) {
  const [loading, setLoading] = useState(true);
  const [tableData, setTableData] = useState([]);
  const [beforeBankName, setBeforeBankName] = useState('');
  const [afterBankName, setAfterBankName] = useState('');
  const [relationTypes, setRelationTypes] = useState([]);
  const [beforeBankRelations, setBeforeBankRelations] = useState([]);
  const [afterBankRelations, setAfterBankRelations] = useState([]);
  const [attributeCategories, setAttributeCategories] = useState({});
  const [showCategoryScores, setShowCategoryScores] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [categoryScores, setCategoryScores] = useState({
    task: { before: "NA", after: "NA" },
    people: { before: "NA", after: "NA" }
  });

  useEffect(() => {
    if (companyId && userId && beforeBankId) {
      fetchData();
    } else {
      setLoading(false);
      setTableData([]);
    }
  }, [companyId, userId, beforeBankId, afterBankId]);

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
      // Query structure similar to SelfEvaluation.jsx
      let query = supabase
        .from("evaluations")
        .select(`
          is_self_evaluator,
          relationship_type,
          evaluation_assignments ( 
            id,
            user_to_evaluate_id,
            company_id,
            attribute_banks (
              id,
              name
            )
          ),
          evaluation_responses (
            attribute_statement_options ( 
              weight, 
              attribute_statements ( 
                statement,
                attributes ( name ),
                statement_analysis_types (
                  analysis_types ( name )
                )
              ) 
            ) 
          )
        `)
        .eq("status", "completed");

      // Add filters
      if (companyId) {
        query = query.eq("evaluation_assignments.company_id", companyId);
      }
      if (userId) {
        query = query.eq("evaluation_assignments.user_to_evaluate_id", userId);
      }
      
      let { data: evaluations, error } = await query;

      if (error) {
        console.error("Error fetching evaluations:", error);
        return [];
      }

      // Filter by bank ID
      evaluations = evaluations?.filter(item => 
        item.evaluation_assignments?.attribute_banks?.id === bankId
      );

      return evaluations || [];
    } catch (error) {
      console.error("Error fetching bank data:", error);
      return [];
    }
  };

  const processQuotientData = (beforeBankData, afterBankData) => {
    // Extract all unique relationship types from both banks
    const allRelationTypes = new Set();
    
    // Process before bank data and extract relationship types
    const beforeBankRelationMap = {};
    beforeBankData.forEach(evaluation => {
      // Handle self evaluator specially
      const relationType = evaluation.is_self_evaluator ? 'self' : evaluation.relationship_type;
      if (relationType) {
        allRelationTypes.add(relationType);
        if (!beforeBankRelationMap[relationType]) {
          beforeBankRelationMap[relationType] = [];
        }
        beforeBankRelationMap[relationType].push(evaluation);
      }
    });
    
    // Process after bank data if available and extract relationship types
    const afterBankRelationMap = {};
    if (afterBankData?.length > 0) {
      afterBankData.forEach(evaluation => {
        // Handle self evaluator specially
        const relationType = evaluation.is_self_evaluator ? 'self' : evaluation.relationship_type;
        if (relationType) {
          allRelationTypes.add(relationType);
          if (!afterBankRelationMap[relationType]) {
            afterBankRelationMap[relationType] = [];
          }
          afterBankRelationMap[relationType].push(evaluation);
        }
      });
    }
    
    // Define the fixed order for relationship types
    const relationOrder = ['self', 'top_boss', 'peer', 'hr', 'subordinate', 'reporting_boss'];
    
    // Sort relationship types according to the fixed order
    const sortedRelationTypes = Array.from(allRelationTypes).sort((a, b) => {
      const indexA = relationOrder.indexOf(a);
      const indexB = relationOrder.indexOf(b);
      
      // If both types are in the order array, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only a is in the order array, it comes first
      if (indexA !== -1) {
        return -1;
      }
      // If only b is in the order array, it comes first
      if (indexB !== -1) {
        return 1;
      }
      // If neither is in the order array, sort alphabetically
      return a.localeCompare(b);
    });
    
    setRelationTypes(sortedRelationTypes);
    setBeforeBankRelations(Object.keys(beforeBankRelationMap));
    setAfterBankRelations(Object.keys(afterBankRelationMap));
    
    // Process data for each relationship type
    const beforeBankScores = {};
    const afterBankScores = {};
    
    // Process before bank scores by relationship type
    for (const relationType of sortedRelationTypes) {
      if (beforeBankRelationMap[relationType]) {
        beforeBankScores[relationType] = processEvaluationData(beforeBankRelationMap[relationType]);
      }
    }
    
    // Process after bank scores by relationship type
    for (const relationType of sortedRelationTypes) {
      if (afterBankRelationMap[relationType]) {
        afterBankScores[relationType] = processEvaluationData(afterBankRelationMap[relationType]);
      }
    }
    
    // Calculate total scores for before bank
    const beforeTotalScores = {};
    for (const relationType in beforeBankScores) {
      beforeTotalScores[relationType] = calculateTotalScore(beforeBankScores[relationType]);
    }
    
    // Calculate total scores for after bank
    const afterTotalScores = {};
    for (const relationType in afterBankScores) {
      afterTotalScores[relationType] = calculateTotalScore(afterBankScores[relationType]);
    }
    
    // Merge attributes from all evaluations
    const allAttributes = new Set();
    
    // Collect all attributes from before bank
    for (const relationType in beforeBankScores) {
      Object.keys(beforeBankScores[relationType]).forEach(attr => allAttributes.add(attr));
    }
    
    // Collect all attributes from after bank
    for (const relationType in afterBankScores) {
      Object.keys(afterBankScores[relationType]).forEach(attr => allAttributes.add(attr));
    }
    
    // Create table data with scores from both banks for all relationship types
    return Array.from(allAttributes).map(attribute => {
      const rowData = {
        attributeName: attribute
      };
      
      // Add scores for each relationship type in before bank
      for (const relationType of sortedRelationTypes) {
        if (beforeBankScores[relationType]) {
          rowData[`before_${relationType}`] = beforeBankScores[relationType][attribute] !== undefined 
            ? beforeBankScores[relationType][attribute] 
            : "NA";
        }
      }
      
      // Add scores for each relationship type in after bank
      for (const relationType of sortedRelationTypes) {
        if (afterBankScores[relationType]) {
          rowData[`after_${relationType}`] = afterBankScores[relationType][attribute] !== undefined 
            ? afterBankScores[relationType][attribute] 
            : "NA";
        }
      }
      
      // Add total scores for before bank
      rowData[`before_total`] = calculateAttributeTotalScore(attribute, beforeBankScores);
      
      // Add total scores for after bank if applicable
      if (Object.keys(afterBankScores).length > 0) {
        rowData[`after_total`] = calculateAttributeTotalScore(attribute, afterBankScores);
      }
      
      return rowData;
    });
  };

  // Use formatScoreWithPadding from evaluationUtils for the raw table
  const formatScore = formatScoreUtil;

  // Use processEvaluationData from evaluationUtils
  const processEvaluationData = (evaluations) => {
    // Group responses by attribute
    const attributeMap = {};
    
    evaluations?.forEach(evaluation => {
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

    // Calculate scores using the same formula as SelfEvaluation.jsx
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

      // Store raw number for calculations, formatting will be done at display time
      attributeScores[attribute] = Number(percentageScore.toFixed(1));
    });

    return attributeScores;
  };

  // Calculate cumulative scores if there's data
  // Use calculateCumulativeScore from evaluationUtils

  // Helper function to calculate total score for a specific attribute across all relation types
  // This exactly matches the calculation in TotalEvaluation.jsx
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
    
    console.log('===== TOTAL QUOTIENT CALCULATION DETAILS =====');
    
    // Process each attribute row from tableData
    tableData.forEach(row => {
      const attributeName = row.attributeName;
      let beforeTotalScores = [];
      let afterTotalScores = [];
      
      console.log(`\n--- Attribute: ${attributeName} ---`);
      console.log('Raw row data:', row);
      
      // Collect before bank scores for each relation type (excluding 'self')
      console.log('Before bank relation scores:');
      for (const relationType of relationTypes) {
        // Skip 'self' relation type for Total Quotient calculation
        if (relationType === 'self') {
          console.log(`  ${relationType}: ${row[`before_${relationType}`]} (excluded from calculation)`);
          continue;
        }
        
        if (beforeBankRelations.includes(relationType)) {
          const key = `before_${relationType}`;
          if (row[key] !== undefined && row[key] !== "NA") {
            beforeTotalScores.push(Number(row[key]));
            console.log(`  ${relationType}: ${row[key]}`);
          }
        }
      }
      console.log(`  Total collected scores: [${beforeTotalScores.join(', ')}]`);
      
      // Collect after bank scores for each relation type (if applicable)
      if (showAfterBank) {
        console.log('After bank relation scores:');
        for (const relationType of relationTypes) {
          // Skip 'self' relation type for Total Quotient calculation
          if (relationType === 'self') {
            console.log(`  ${relationType}: ${row[`after_${relationType}`]} (excluded from calculation)`);
            continue;
          }
          
          if (afterBankRelations.includes(relationType)) {
            const key = `after_${relationType}`;
            if (row[key] !== undefined && row[key] !== "NA") {
              afterTotalScores.push(Number(row[key]));
              console.log(`  ${relationType}: ${row[key]}`);
            }
          }
        }
        console.log(`  Total collected scores: [${afterTotalScores.join(', ')}]`);
      }
      
      // Calculate average scores
      const beforeTotalScore = beforeTotalScores.length > 0 
        ? beforeTotalScores.reduce((sum, score) => sum + score, 0) / beforeTotalScores.length 
        : "NA";
      
      const afterTotalScore = afterTotalScores.length > 0 
        ? afterTotalScores.reduce((sum, score) => sum + score, 0) / afterTotalScores.length 
        : "NA";
      
      console.log('Calculation results:');
      if (beforeTotalScore !== "NA") {
        console.log(`  Before Total % Score: Sum(${beforeTotalScores.join(' + ')}) / ${beforeTotalScores.length} = ${beforeTotalScore}`);
      } else {
        console.log('  Before Total % Score: NA (no scores available)');
      }
      
      if (afterTotalScore !== "NA") {
        console.log(`  After Total % Score: Sum(${afterTotalScores.join(' + ')}) / ${afterTotalScores.length} = ${afterTotalScore}`);
      } else if (showAfterBank) {
        console.log('  After Total % Score: NA (no scores available)');
      }
      
      // Add to totalQuotientData array
      totalQuotientData.push({
        attributeName,
        beforeTotalScore: beforeTotalScore !== "NA" ? Number(beforeTotalScore.toFixed(1)) : "NA",
        afterTotalScore: afterTotalScore !== "NA" ? Number(afterTotalScore.toFixed(1)) : "NA"
      });
    });
    
    return totalQuotientData;
  };
  
  // Calculate cumulative scores for each relationship type
  const calculateCumulativeScores = () => {
    const cumulativeScores = {};
    
    // Calculate for before bank relations
    for (const relationType of relationTypes) {
      if (beforeBankRelations.includes(relationType)) {
        const key = `before_${relationType}`;
        const scores = tableData.map(item => item[key]);
        cumulativeScores[key] = calculateCumulativeScore(scores);
      }
    }
    
    // Calculate for after bank relations
    for (const relationType of relationTypes) {
      if (afterBankRelations.includes(relationType)) {
        const key = `after_${relationType}`;
        const scores = tableData.map(item => item[key]);
        cumulativeScores[key] = calculateCumulativeScore(scores);
      }
    }
    
    // Calculate cumulative total scores
    const beforeTotalScores = tableData.map(item => item.before_total).filter(score => score !== "NA");
    cumulativeScores.before_total = calculateCumulativeScore(beforeTotalScores);
    
    if (showAfterBank) {
      const afterTotalScores = tableData.map(item => item.after_total).filter(score => score !== "NA");
      cumulativeScores.after_total = calculateCumulativeScore(afterTotalScores);
    }
    
    return cumulativeScores;
  };
  
  const cumulativeScores = calculateCumulativeScores();
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
    // Group attributes by category
    const taskAttributes = Object.keys(attributeCategories).filter(attr => attributeCategories[attr] === 'task');
    const peopleAttributes = Object.keys(attributeCategories).filter(attr => attributeCategories[attr] === 'people');
    
    // Calculate average scores for task attributes
    const taskBeforeScores = taskAttributes
      .map(attr => {
        const row = totalQuotientData.find(r => r.attributeName === attr);
        return row ? row.beforeTotalScore : "NA";
      })
      .filter(score => score !== "NA");
      
    const taskAfterScores = taskAttributes
      .map(attr => {
        const row = totalQuotientData.find(r => r.attributeName === attr);
        return row && row.afterTotalScore ? row.afterTotalScore : "NA";
      })
      .filter(score => score !== "NA");
    
    // Calculate average scores for people attributes
    const peopleBeforeScores = peopleAttributes
      .map(attr => {
        const row = totalQuotientData.find(r => r.attributeName === attr);
        return row ? row.beforeTotalScore : "NA";
      })
      .filter(score => score !== "NA");
      
    const peopleAfterScores = peopleAttributes
      .map(attr => {
        const row = totalQuotientData.find(r => r.attributeName === attr);
        return row && row.afterTotalScore ? row.afterTotalScore : "NA";
      })
      .filter(score => score !== "NA");
    
    // Calculate averages
    const taskBeforeAvg = taskBeforeScores.length > 0 ? taskBeforeScores.reduce((sum, score) => sum + score, 0) / taskBeforeScores.length : "NA";
    const taskAfterAvg = taskAfterScores.length > 0 ? taskAfterScores.reduce((sum, score) => sum + score, 0) / taskAfterScores.length : "NA";
    const peopleBeforeAvg = peopleBeforeScores.length > 0 ? peopleBeforeScores.reduce((sum, score) => sum + score, 0) / peopleBeforeScores.length : "NA";
    const peopleAfterAvg = peopleAfterScores.length > 0 ? peopleAfterScores.reduce((sum, score) => sum + score, 0) / peopleAfterScores.length : "NA";
    
    // Update state
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
      toast.error("Please calculate category scores first");
    }
  };

  // Handle attribute category toggle
  const toggleAttributeCategory = (attributeName, category) => {
    setAttributeCategories(prev => {
      const newCategories = { ...prev };
      
      // If already set to this category, remove it
      if (prev[attributeName] === category) {
        delete newCategories[attributeName];
      } else {
        // Otherwise set to this category
        newCategories[attributeName] = category;
      }
      
      return newCategories;
    });
  };
  
  // Handle calculate button click
  const handleCalculateClick = () => {
    const scores = calculateCategoryScores();
    setCategoryScores(scores);
    setShowCategoryScores(true);
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
            
            {/* Total Column Headers */}
            <TableHead className="border border-gray-300 font-bold">
              Before Bank - Total
            </TableHead>
            
            {showAfterBank && (
              <TableHead className="border border-gray-300 font-bold">
                After Bank - Total
              </TableHead>
            )}
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
              
              {/* Total Cells */}
              <TableCell className="border border-gray-300 font-bold">
                {row.before_total === "NA" ? "NA" : formatScore(row.before_total)}
              </TableCell>
              
              {showAfterBank && (
                <TableCell className="border border-gray-300 font-bold">
                  {row.after_total === "NA" ? "NA" : formatScore(row.after_total)}
                </TableCell>
              )}
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
            
            {/* Total Cumulative Cells */}
            <TableCell className="border border-gray-300 font-bold">
              {cumulativeScores.before_total === "NA" ? "NA" : formatScore(cumulativeScores.before_total)}
            </TableCell>
            
            {showAfterBank && (
              <TableCell className="border border-gray-300 font-bold">
                {cumulativeScores.after_total === "NA" ? "NA" : formatScore(cumulativeScores.after_total)}
              </TableCell>
            )}
          </TableRow>
        </TableBody>
      </Table>
      </div>
      
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
                <TableCell className="border border-gray-300">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`task-${index}`}
                        checked={attributeCategories[row.attributeName] === 'task'}
                        onCheckedChange={() => toggleAttributeCategory(row.attributeName, 'task')}
                        className="border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
                      />
                      <label htmlFor={`task-${index}`} className="text-sm font-medium text-blue-600">Task</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`people-${index}`}
                        checked={attributeCategories[row.attributeName] === 'people'}
                        onCheckedChange={() => toggleAttributeCategory(row.attributeName, 'people')}
                        className="border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:text-white"
                      />
                      <label htmlFor={`people-${index}`} className="text-sm font-medium text-green-600">People</label>
                    </div>
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
            
            {/* Calculate Button Row */}
            <TableRow>
              <TableCell colSpan={showAfterBank ? 4 : 3} className="border border-gray-300 text-center">
                <Button 
                  onClick={handleCalculateClick}
                  className="bg-primary text-white hover:bg-primary/90 my-2"
                >
                  Calculate Category Scores
                </Button>
              </TableCell>
            </TableRow>
            
            {/* Category Score Rows */}
            {showCategoryScores && (
              <>
                <TableRow>
                  <TableCell className="border border-gray-300 w-[100px] font-bold">Task</TableCell>
                  <TableCell className="border border-gray-300 w-[300px] font-bold">Task-based attributes</TableCell>
                  <TableCell className="border border-gray-300 font-bold">
                    {categoryScores.task.before !== "NA" ? formatScoreWithPercentage(categoryScores.task.before) : "NA"}
                  </TableCell>
                  {showAfterBank && (
                    <TableCell className="border border-gray-300 font-bold">
                      {categoryScores.task.after !== "NA" ? formatScoreWithPercentage(categoryScores.task.after) : "NA"}
                    </TableCell>
                  )}
                </TableRow>
                <TableRow>
                  <TableCell className="border border-gray-300 w-[100px] font-bold">People</TableCell>
                  <TableCell className="border border-gray-300 w-[300px] font-bold">People-based attributes</TableCell>
                  <TableCell className="border border-gray-300 font-bold">
                    {categoryScores.people.before !== "NA" ? formatScoreWithPercentage(categoryScores.people.before) : "NA"}
                  </TableCell>
                  {showAfterBank && (
                    <TableCell className="border border-gray-300 font-bold">
                      {categoryScores.people.after !== "NA" ? formatScoreWithPercentage(categoryScores.people.after) : "NA"}
                    </TableCell>
                  )}
                </TableRow>
                <TableRow>
                  <TableCell colSpan={showAfterBank ? 4 : 3} className="border border-gray-300 text-center">
                    <Button 
                      onClick={handleShowChartClick}
                      className="bg-blue-500 hover:bg-blue-600 text-white mt-2"
                    >
                      Show Chart
                    </Button>
                  </TableCell>
                </TableRow>
              </>
            )}
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
        />
      )}
    </>
  );
}
