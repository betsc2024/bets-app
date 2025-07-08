import { useState, useRef, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bar } from 'react-chartjs-2';
import { supabase } from '@/supabase';
import CopyToClipboard from '../CopyToClipboard';

const HREvaluation = ({ userId, companyId, bankId }) => {
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [cumulativeSelf, setCumulativeSelf] = useState(0);
  const [cumulativeHR, setCumulativeHR] = useState(0);
  const [viewType, setViewType] = useState('table');
  const tableRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [userId, companyId, bankId]);

  const fetchData = async () => {
    try {
      // Fetch HR evaluations
      const { data: hrData, error: hrError } = await supabase
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
            status,
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
        .eq('evaluations.relationship_type', 'hr')
        .eq('company_id', companyId);

      if (hrError) {
        console.error('Error fetching HR evaluations:', hrError);
        return;
      }

      // Filter by bankId after fetching
      let filteredHrData = hrData;
      if (bankId) {
        filteredHrData = hrData?.filter(item => 
          item.attribute_banks?.id === bankId
        );
      }

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
      const processedData = processEvaluationData(filteredHrData, filteredSelfEvals);
      setTableData(processedData);
      // calculate cumulative self and HR percentage scores
      let cumSelf = 0;
      let cumHR = 0;
      if (processedData.length > 0) {
        const totalSelf = processedData.reduce((sum, item) => sum + item.selfPercentageScore, 0);
        const totalHR = processedData.reduce((sum, item) => sum + item.hrPercentageScore, 0);
        cumSelf = Number((totalSelf / processedData.length).toFixed(1));
        cumHR = Number((totalHR / processedData.length).toFixed(1));
        setCumulativeSelf(cumSelf);
        setCumulativeHR(cumHR);
      }
      // Pass the calculated values directly to generateChartData
      generateChartData(processedData, cumSelf, cumHR);
    } catch (error) {
      console.error('Error in fetchData:', error);
    }
  };

  const processEvaluationData = (hrData, selfData) => {
    // Helper function for consistent decimal formatting
    const formatScore = (score) => {
      return Number(Number(score).toFixed(1));
    };

    const attributeResponses = {};

    // Process HR evaluations
    let hrEvalExists = false;
    hrData.forEach(assignment => {
      assignment.evaluations.forEach(evaluation => {
        if (evaluation.relationship_type === 'hr') {
          hrEvalExists = true;
          if (evaluation.status !== 'completed') return; // Don't aggregate, but mark as existing
        }
        evaluation.evaluation_responses.forEach(response => {
          const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
          if (!attributeResponses[attributeName]) {
            attributeResponses[attributeName] = {
              hrScores: [],
              selfScores: []
            };
          }
          attributeResponses[attributeName].hrScores.push({
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
            hrScores: [],
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
      // Calculate per-statement scores for HR
      const statementScores = {};
      data.hrScores.forEach((score) => {
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

      // Calculate HR scores
      const numStatements = Object.keys(statementScores).length;
      const rawScore = Object.values(statementScores).reduce((sum, { total }) => sum + total, 0);
      const evaluatorsPerStatement = Object.values(statementScores)[0]?.evaluators || 0;
      const hrAverageScore = numStatements > 0 ? rawScore / numStatements : 0;
      const maxPossible = evaluatorsPerStatement * 100;
      const hrPercentageScore = maxPossible > 0 ? (hrAverageScore / maxPossible) * 100 : 0;

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
        hrAverageScore: hrEvalExists && hrAverageScore === 0 ? 0 : formatScore(hrAverageScore),
        hrPercentageScore: hrEvalExists && hrPercentageScore === 0 ? 0 : formatScore(hrPercentageScore),
      };
    });
  };

  const generateChartData = (data, cumSelf, cumHR) => {
    try {
      if (data && data.length > 0) {
        // Using passed cumulative values instead of state
        
        // Create labels with attribute names and add 'Cumulative' at the end
        const labels = [...data.map(item => item.attributeName), 'Cumulative'];
        
        // Create data arrays with scores and add cumulative scores at the end
        const selfScoreData = [...data.map(item => item.selfPercentageScore), cumSelf];
        const hrScoreData = [...data.map(item => item.hrPercentageScore), cumHR];
        
        const allVals = [
            ...selfScoreData,
            ...hrScoreData
          ];
        const rawMax = Math.max(...allVals);
        const yMax = Math.ceil(rawMax * 1.1 / 10) * 10;
        
        const chartData = {
          labels: labels,
          datasets: [
             {
               label: 'Self Score (%)',
               data: selfScoreData,
               backgroundColor: '#733e93', // Same purple color for all self bars including cumulative
               borderWidth: 0
             },
             {
               label: 'HR Score (%)',
               data: hrScoreData,
               backgroundColor: '#4ade80', // Same green color for all HR bars including cumulative
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
                label: context => `${context.dataset.label.replace(' (%)', '')}: ${Number(context.raw).toFixed(1)}`
              }
            },
            title: {
              display: true,
              text: 'Self vs HR Evaluation Scores',
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
        <h2 className="text-xl font-semibold text-primary">HR Evaluation</h2>
        <div className="flex items-center gap-4">
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
          </div>
          <CopyToClipboard 
            targetRef={viewType === 'table' ? tableRef : chartRef} 
            buttonText={`Copy ${viewType === 'table' ? 'Table' : 'Chart'}`} 
          />
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
                  <TableHead className="border-r text-right font-semibold">HR - Average Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">HR - % Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Cumulative Self</TableHead>
                  <TableHead className="text-right font-semibold">Cumulative HR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <TableRow key={row.srNo} className="border-b">
                    <TableCell className="border-r">{row.srNo}</TableCell>
                    <TableCell className="border-r">{row.attributeName}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.selfAverageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.selfPercentageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.hrAverageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.hrPercentageScore).toFixed(1)}</TableCell>
                     <TableCell className="border-r text-right">{cumulativeSelf.toFixed(1)}</TableCell>
                     <TableCell className="text-right">{cumulativeHR.toFixed(1)}</TableCell>
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
    </div>
  );
};

export default HREvaluation;
