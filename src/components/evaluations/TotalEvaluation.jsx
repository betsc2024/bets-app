import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bar } from 'react-chartjs-2';
import { RadarChartTotal } from '@/components/RadarChartTotal';
import CopyToClipboard from '@/components/CopyToClipboard';

const TotalEvaluation = ({ userId, companyId, bankId }) => {
  const [assignmentId, setAssignmentId] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [cumulativeSelf, setCumulativeSelf] = useState(0);
  const [cumulativeTotal, setCumulativeTotal] = useState(0);
  const [viewType, setViewType] = useState('table');
  const [selectedAttribute, setSelectedAttribute] = useState('');
  const [attributes, setAttributes] = useState([]);
  const [evaluateeName, setEvaluateeName] = useState('');
  const [csvStatus, setCsvStatus] = useState(null); // null, 'loading', 'success', 'error'
  const tableRef = useRef(null);
  const chartRef = useRef(null);
  const radarRef = useRef(null);

  useEffect(() => {
    if (userId && companyId && bankId) {
      fetchData();
      fetchEvaluateeName();
    }
  }, [userId, companyId, bankId]);

  const fetchEvaluateeName = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching evaluatee name:', error);
        return;
      }

      if (data) {
        setEvaluateeName(data.full_name);
      }
    } catch (error) {
      console.error('Error in fetchEvaluateeName:', error);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch all evaluations except self
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

      // Set assignmentId for current evaluation assignment (first matching assignment for this user/bank)
      let assignmentIdToUse = null;
      let filteredTotalData = totalData;
      if (bankId) {
        filteredTotalData = totalData?.filter(item => item.attribute_banks?.id === bankId);
      }
      if (filteredTotalData && filteredTotalData.length > 0) {
        assignmentIdToUse = filteredTotalData[0].id;
        setAssignmentId(assignmentIdToUse);
      }

      if (totalError) {
        console.error('Error fetching total evaluations:', totalError);
        return;
      }

      // Filter by bankId after fetching
      // let filteredTotalData = totalData;
      // if (bankId) {
      //   filteredTotalData = totalData?.filter(item => 
      //     item.attribute_banks?.id === bankId
      //   );
      // }

      // Get self evaluations
      const { data: selfEvals, error: selfError } = await supabase
        .from("evaluations")
        .select(`
          is_self_evaluator,
          relationship_type,
          evaluation_assignments (
            id,
            company_id,
            user_to_evaluate_id,
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
                attributes ( name )
              ) 
            ) 
          )
        `)
        .eq("status", "completed")
        .eq("is_self_evaluator", true)
        .eq("evaluation_assignments.company_id", companyId)
        .eq("evaluation_assignments.user_to_evaluate_id", userId);

      if (selfError) {
        console.error('Error fetching self evaluations:', selfError);
        return;
      }

      // Filter by bankId after fetching
      let filteredSelfEvals = selfEvals;
      if (bankId) {
        filteredSelfEvals = selfEvals?.filter(item => 
          item.evaluation_assignments?.attribute_banks?.id === bankId
        );
      }

      // Process the data
      const processedData = processEvaluationData(filteredTotalData, filteredSelfEvals);
      setTableData(processedData);
      // compute cumulative averages using percentage scores
      let cumSelf = 0;
      let cumTotal = 0;
      if (processedData.length > 0) {
        const totalSelf = processedData.reduce((sum,item)=> sum + Number(item.selfPercentageScore), 0);
        const totalTotal = processedData.reduce((sum,item)=> sum + Number(item.totalPercentageScore), 0);
        cumSelf = Number((totalSelf/processedData.length).toFixed(1));
        cumTotal = Number((totalTotal/processedData.length).toFixed(1));
        setCumulativeSelf(cumSelf);
        setCumulativeTotal(cumTotal);
      }
      // Pass the calculated values directly to generateChartData
      generateChartData(processedData, cumSelf, cumTotal);

      // Extract unique attributes for the dropdown
      const uniqueAttributes = [...new Set(processedData.map(item => item.attributeName))];
      setAttributes(uniqueAttributes);
      if (uniqueAttributes.length > 0 && !selectedAttribute) {
        setSelectedAttribute(uniqueAttributes[0]);
      }

    } catch (error) {
      console.error('Error in fetchData:', error);
    }
  };

  const processEvaluationData = (totalData, selfData) => {
    const attributeResponses = {};

    // Create a helper function for consistent number formatting
    const formatScore = (score) => {
      return Number(score).toFixed(1);
    };

    // Process all evaluations except self
    totalData.forEach(assignment => {
      assignment.evaluations.forEach(evaluation => {
        evaluation.evaluation_responses.forEach(response => {
          const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
          if (!attributeResponses[attributeName]) {
            attributeResponses[attributeName] = {
              totalScores: [],
              selfScores: []
            };
          }
          attributeResponses[attributeName].totalScores.push({
            weight: response.attribute_statement_options.weight,
            statement: response.attribute_statement_options.attribute_statements.statement
          });
        });
      });
    });

    // Process self evaluations
    selfData.forEach(evaluation => {
      evaluation.evaluation_responses.forEach(response => {
        const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
        if (!attributeResponses[attributeName]) {
          attributeResponses[attributeName] = {
            totalScores: [],
            selfScores: []
          };
        }
        attributeResponses[attributeName].selfScores.push({
          weight: response.attribute_statement_options.weight,
          statement: response.attribute_statement_options.attribute_statements.statement
        });
      });
    });

    // Calculate scores
    return Object.entries(attributeResponses).map(([attribute, data], index) => {
      // Calculate per-statement scores for total (excluding self)
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

      // Calculate self evaluation scores
      const selfStatementScores = {};
      data.selfScores.forEach((score) => {
        const statementId = score.statement;
        if (!selfStatementScores[statementId]) {
          selfStatementScores[statementId] = {
            total: 0,
            evaluators: 0
          };
        }
        selfStatementScores[statementId].total += score.weight;
        selfStatementScores[statementId].evaluators += 1;
      });

      const selfNumStatements = Object.keys(selfStatementScores).length;
      const selfRawScore = Object.values(selfStatementScores).reduce((sum, { total }) => sum + total, 0);
      const selfAverageScore = selfNumStatements > 0 ? selfRawScore / selfNumStatements : 0;
      const selfPercentageScore = selfAverageScore > 0 ? (selfAverageScore / 100) * 100 : 0;

      return {
        srNo: index + 1,
        attributeName: attribute,
        selfAverageScore: formatScore(selfAverageScore),
        selfPercentageScore: formatScore(selfPercentageScore),
        totalAverageScore: formatScore(totalAverageScore),
        totalPercentageScore: formatScore(totalPercentageScore),
      };
    });
  };

  const handleDownloadCSV = async () => {
    try {
      if (tableData.length === 0) {
        console.error('No data available for CSV download');
        setCsvStatus('error');
        setTimeout(() => setCsvStatus(null), 3000);
        return;
      }
      
      // Set loading status
      setCsvStatus('loading');

      // Fetch all evaluatees for this company and attribute bank
      const { data: evaluatees, error: evaluateesError } = await supabase
        .from('evaluation_assignments')
        .select(`
          id,
          user_to_evaluate_id
        `)
        .eq('company_id', companyId)
        .eq('attribute_bank_id', bankId)
        .order('id', { ascending: true });

      if (evaluateesError) {
        console.error('Error fetching evaluatees:', evaluateesError);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(evaluatees?.map(item => item.user_to_evaluate_id) || [])];
      
      // Fetch user names - use separate queries for each user ID to avoid SQL errors
      const userNameMap = {};
      
      // Process each user ID individually to avoid SQL formatting issues
      for (const id of userIds) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', id)
            .single();
            
          if (error) {
            console.error(`Error fetching name for user ${id}:`, error);
            continue;
          }
          
          if (data) {
            userNameMap[id] = data.full_name;
          }
        } catch (err) {
          console.error(`Error processing user ${id}:`, err);
        }
      }

      // Create a structure to hold all evaluatee data
      const allEvaluateeData = {};
      
      // Initialize with the current evaluatee's data that we already have
      const attributeMap = {};
      tableData.forEach(row => {
        attributeMap[row.attributeName] = {
          srNo: row.srNo,
          scores: {}
        };
        attributeMap[row.attributeName].scores[userId] = row.totalPercentageScore;
      });

      // Fetch data for each evaluatee
      for (const evaluateeId of userIds) {
        if (evaluateeId === userId) continue; // Skip current user as we already have their data
        
        try {
          // Fetch evaluations for this evaluatee
          const { data: evalData, error: evalError } = await supabase
            .from('evaluation_assignments')
            .select(`
              id,
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
            .eq('user_to_evaluate_id', evaluateeId)
            .neq('evaluations.relationship_type', 'self')
            .eq('company_id', companyId)
            .eq('attribute_bank_id', bankId);

          if (evalError) {
            console.error(`Error fetching data for evaluatee ${evaluateeId}:`, evalError);
            continue;
          }

          // Process the data for this evaluatee
          if (evalData && evalData.length > 0) {
            const processedData = processEvaluationData(evalData, []);
            
            // Add to our attribute map
            processedData.forEach(item => {
              if (!attributeMap[item.attributeName]) {
                attributeMap[item.attributeName] = {
                  srNo: item.srNo,
                  scores: {}
                };
              }
              attributeMap[item.attributeName].scores[evaluateeId] = item.totalPercentageScore;
            });
          }
        } catch (error) {
          console.error(`Error processing data for evaluatee ${evaluateeId}:`, error);
        }
      }

      // Create headers with all evaluatee names
      const headers = ['Sr. No.', 'Attribute Name'];
      userIds.forEach(userId => {
        headers.push(`${userNameMap[userId] || 'User ' + userId}`);
      });
      
      // Create data rows
      const rows = Object.entries(attributeMap).map(([attributeName, data]) => {
        const row = [data.srNo, attributeName];
        
        // Add scores for each evaluatee
        userIds.forEach(userId => {
          row.push(data.scores[userId] || '');
        });
        
        return row;
      });

      // Sort rows by Sr. No.
      rows.sort((a, b) => a[0] - b[0]);

      // Add "Total - % Score" text to the header
      const headerWithTotal = headers.map((header, index) => {
        if (index < 2) return header; // Keep Sr. No. and Attribute Name as is
        return `${header} - Total % Score`;
      });

      // Add a final row showing the total number of evaluatees
      // Only include the first cell to avoid extra commas
      // Use HTML bold tags for Excel compatibility
      const totalEvaluateesRow = [
        `Total Number of Evaluatees: ${userIds.length}` // Sr. No. column with bold formatting
      ];
      
      // Combine headers and rows, including the total evaluatees row at the end
      const csvRows = [headerWithTotal, ...rows, totalEvaluateesRow];

      // Function to escape CSV values properly
      function escapeCSV(val) {
        if (val == null) return '';
        const s = String(val).trim();
        if (/[",\n]/.test(s)) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }

      // Convert to CSV format
      const csvContent = csvRows.map(r => r.map(escapeCSV).join(",")).join("\n");
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `individual_evaluation_report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Set success status
      setCsvStatus('success');
      setTimeout(() => setCsvStatus(null), 3000); // Clear status after 3 seconds
    } catch (error) {
      console.error('Error generating CSV:', error);
      
      // Set error status
      setCsvStatus('error');
      setTimeout(() => setCsvStatus(null), 3000); // Clear status after 3 seconds
    }
  };

  const generateChartData = (data, cumSelf, cumTotal) => {
    try {
      if (data && data.length > 0) {
        // Using passed cumulative values instead of state
        
        // Create labels with attribute names and add 'Cumulative' at the end
        const labels = [...data.map(item => item.attributeName), 'Cumulative'];
        
        // Create data arrays with scores and add cumulative scores at the end
        const selfScoreData = [...data.map(item => Number(item.selfPercentageScore)), cumSelf];
        const totalScoreData = [...data.map(item => Number(item.totalPercentageScore)), cumTotal];
        
        const allVals = [...selfScoreData, ...totalScoreData];
        const yMax = Math.ceil(Math.max(...allVals) * 1.1 / 10) * 10;
        
        const chartData = {
          labels: labels,
          datasets: [
             {
               label: 'Self Score',
               data: selfScoreData,
               backgroundColor: '#733e93', // Same purple color for all self bars including cumulative
               borderWidth: 0
             },
             {
               label: 'Total Score',
               data: totalScoreData,
               backgroundColor: '#4ade80', // Same green color for all total bars including cumulative
               borderWidth: 0
             }
          ]
        };

        const chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: yMax,
              title: {
                display: true,
                text: 'Score'
              },
              ticks: {
                callback: value => Number(value).toFixed(1)
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                callback: function(val) {
                  const label = this.getLabelForValue(val);
                  
                  // Make 'Cumulative' label bold using font weight property only
                  if (label === 'Cumulative') {
                    return [label]; // Return without asterisks
                  }
                  
                  // Regular word-wrapping for other labels
                  const words = label.split(' ');
                  const lines = [];
                  let currentLine = words[0];
                  
                  for(let i = 1; i < words.length; i++) {
                    if (currentLine.length + words[i].length < 15) {
                      currentLine += ' ' + words[i];
                    } else {
                      lines.push(currentLine);
                      currentLine = words[i];
                    }
                  }
                  lines.push(currentLine);
                  return lines;
                },
                font: function(context) {
                  const label = context.chart.data.labels[context.index];
                  if (label === 'Cumulative') {
                    return {
                      weight: 'bold'
                    };
                  }
                  return {};
                },
                maxRotation: 0,
                minRotation: 0,
                 autoSkip: false
              }
            }
          },
          plugins: {
            datalabels: {
              anchor: 'end',
              align: 'top',
              offset: 4,
              font: {
                weight: 'bold'
              },
              formatter: value => Number(value).toFixed(1)
            },
            legend: {
              position: 'top',
            },
            tooltip: {
              callbacks: {
                label: context => `Score: ${Number(context.raw).toFixed(1)}`
              }
            },
            title: {
              display: true,
              text: 'Self vs Total Evaluation Scores',
              font: {
                size: 16,
                weight: 'bold'
              }
            }
          }
        };

        setChartData({ chartData, chartOptions });
      }
    } catch (error) {
      console.error("Error processing evaluation data:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-primary">Total Evaluation</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              className={`px-4 py-2 rounded-lg ${csvStatus === 'loading' ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white transition-colors flex items-center gap-2`}
              onClick={() => handleDownloadCSV()}
              disabled={csvStatus === 'loading'}
            >
              {csvStatus === 'loading' ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                'Download CSV'
              )}
            </button>
            
            {csvStatus === 'success' && (
              <span className="text-green-500 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Downloaded!
              </span>
            )}
            
            {csvStatus === 'error' && (
              <span className="text-red-500 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Failed to generate CSV
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-lg ${viewType === 'table' ? 'bg-primary text-white' : 'bg-gray-200'}`}
              onClick={() => setViewType('table')}
            >
              Table
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${viewType === 'chart' ? 'bg-primary text-white' : 'bg-gray-200'}`}
              onClick={() => setViewType('chart')}
            >
              Chart
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${viewType === 'radar' ? 'bg-primary text-white' : 'bg-gray-200'}`}
              onClick={() => setViewType('radar')}
            >
              Radar
            </button>
          </div>
          {viewType !== 'radar' && (
            <CopyToClipboard 
              targetRef={viewType === 'table' ? tableRef : chartRef} 
              buttonText={`Copy ${viewType === 'table' ? 'Table' : 'Chart'}`} 
            />
          )}
        </div>
      </div>

      {/* Table View */}
      {viewType === 'table' && (
        <div ref={tableRef} className="border rounded-lg p-4 bg-white">
          {tableData.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No evaluation data available
            </div>
          ) : (
            <Table className="border">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="border-r w-16 font-semibold">Sr. No.</TableHead>
                  <TableHead className="border-r font-semibold">Attribute Name</TableHead>
                  <TableHead className="border-r text-right font-semibold">Self - Average Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Self - % Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Total - Average Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Total - % Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Cumulative Self</TableHead>
                  <TableHead className="text-right font-semibold">Cumulative Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <TableRow key={row.srNo} className="border-b">
                    <TableCell className="border-r">{row.srNo}</TableCell>
                    <TableCell className="border-r">{row.attributeName}</TableCell>
                    <TableCell className="border-r text-right">{row.selfAverageScore}</TableCell>
                    <TableCell className="border-r text-right">{row.selfPercentageScore}</TableCell>
                    <TableCell className="border-r text-right">{row.totalAverageScore}</TableCell>
                    <TableCell className="border-r text-right">{row.totalPercentageScore}</TableCell>
                     <TableCell className="border-r text-right">{cumulativeSelf.toFixed(1)}</TableCell>
                     <TableCell className="text-right">{cumulativeTotal.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Chart View */}
      {viewType === 'chart' && (
        <div ref={chartRef} className="h-[400px] border rounded-lg p-4 bg-white">
          {chartData ? (
            <Bar data={chartData.chartData} options={chartData.chartOptions} />
          ) : (
            <div className="text-center py-4 text-gray-500">
              No data available for chart
            </div>
          )}
        </div>
      )}

      {/* Radar View */}
      {viewType === 'radar' && (
        <div className="border rounded-lg p-8 bg-white relative">
          <div className="absolute top-4 right-4">
            <CopyToClipboard
              targetRef={radarRef}
              title="Radar Chart"
            />
          </div>
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Attribute
            </label>
            <Select
              value={selectedAttribute}
              onValueChange={setSelectedAttribute}
            >
              <SelectTrigger className="w-[400px] bg-white border-gray-300">
                <SelectValue placeholder="Select an attribute to view detailed scores" />
              </SelectTrigger>
              <SelectContent>
                {attributes.map((attr) => (
                  <SelectItem key={attr} value={attr}>
                    {attr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="h-[700px] w-full bg-white" ref={radarRef}>
            <RadarChartTotal
              companyId={companyId}
              userId={userId}
              attribute={selectedAttribute}
              bankId={bankId}
              assignmentId={assignmentId}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TotalEvaluation;
