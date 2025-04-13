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

const TotalEvaluation = ({ userId, companyId, bankId }) => {
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [viewType, setViewType] = useState('table');
  const tableRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (userId && companyId && bankId) {
      fetchData();
    }
  }, [userId, companyId, bankId]);

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

      if (totalError) {
        console.error('Error fetching total evaluations:', totalError);
        return;
      }

      // Filter by bankId after fetching
      let filteredTotalData = totalData;
      if (bankId) {
        filteredTotalData = totalData?.filter(item => 
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
      const processedData = processEvaluationData(filteredTotalData, filteredSelfEvals);
      setTableData(processedData);
      generateChartData(processedData);
    } catch (error) {
      console.error('Error in fetchData:', error);
    }
  };

  const processEvaluationData = (totalData, selfData) => {
    const attributeResponses = {};

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
      const totalAverageScore = rawScore / numStatements;
      const maxPossible = evaluatorsPerStatement * 100;
      const totalPercentageScore = maxPossible ? (totalAverageScore / maxPossible) * 100 : 0;

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
      const selfAverageScore = selfRawScore / selfNumStatements;
      const selfPercentageScore = (selfAverageScore / 100) * 100;

      return {
        srNo: index + 1,
        attributeName: attribute,
        selfAverageScore: Number(selfAverageScore.toFixed(1)),
        selfPercentageScore: Number(selfPercentageScore.toFixed(1)),
        totalAverageScore: Number(totalAverageScore.toFixed(1)),
        totalPercentageScore: Number(totalPercentageScore.toFixed(1)),
      };
    });
  };

  const generateChartData = (data) => {
    try {
      if (data && data.length > 0) {
        const chartData = {
          labels: data.map(item => item.attributeName),
          datasets: [
            {
              label: 'Self Score (%)',
              data: data.map(item => item.selfPercentageScore),
              backgroundColor: '#733e93',  // primary purple
              borderWidth: 0
            },
            {
              label: 'Total Score (%)',
              data: data.map(item => item.totalPercentageScore),
              backgroundColor: '#4ade80',  // green
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
              max: 100,
              title: {
                display: true,
                text: 'Score Percentage'
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                callback: function(val) {
                  const label = this.getLabelForValue(val);
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
                maxRotation: 0,
                minRotation: 0
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
              formatter: (value) => `${value}%`
            },
            legend: {
              position: 'top',
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
                  <TableHead className="border-r text-right font-semibold">Total - Average Score</TableHead>
                  <TableHead className="text-right font-semibold">Total - % Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <TableRow key={row.srNo} className="border-b">
                    <TableCell className="border-r">{row.srNo}</TableCell>
                    <TableCell className="border-r">{row.attributeName}</TableCell>
                    <TableCell className="border-r text-right">{row.selfAverageScore}</TableCell>
                    <TableCell className="border-r text-right">{row.selfPercentageScore}%</TableCell>
                    <TableCell className="border-r text-right">{row.totalAverageScore}</TableCell>
                    <TableCell className="text-right">{row.totalPercentageScore}%</TableCell>
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

export default TotalEvaluation;
