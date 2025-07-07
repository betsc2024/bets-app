import React, { useEffect, useState, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from '@/supabase';
import { toast } from 'sonner';
import CopyToClipboard from '@/components/CopyToClipboard';

export default function SelfEvaluation({ companyId, userId, bankId }) {
  const [viewType, setViewType] = useState('table');
  const [tableData, setTableData] = useState([]);
  const [cumulativeScore, setCumulativeScore] = useState(0);
  const [chartData, setChartData] = useState(null);

  const tableRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (companyId && userId) {
      fetchSelfEvaluationData();
    }
  }, [companyId, userId, bankId]);

  const fetchSelfEvaluationData = async () => {
    try {
      console.log("Fetching self evaluation data for:", { companyId, userId, bankId });

      // Match Reports.jsx query structure but add is_self_evaluator
      let query = supabase
        .from("evaluations")
        .select(`
          is_self_evaluator,
          relationship_type,
          evaluation_assignments ( 
            id,
            user_to_evaluate_id,
            company_id,
            companies ( 
              id,
              name
            ),
            attribute_banks (
              id,
              name,
              analysis_types (
                name
              )
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
        .eq("status", "completed")
        .eq("is_self_evaluator", true);

      // Add filters matching Reports.jsx
      if (companyId) {
        query = query.eq("evaluation_assignments.company_id", companyId);
      }
      if (userId) {
        query = query.eq("evaluation_assignments.user_to_evaluate_id", userId);
      }

      let { data: evaluations, error } = await query;

      if (error) {
        console.error("Error fetching self evaluations:", error);
        return;
      }

      console.log("All evaluations before filtering:", evaluations?.length);
      console.log("All evaluations:", evaluations);

      // Apply bank filter after fetching (like Reports.jsx does)
      if (bankId) {
        evaluations = evaluations?.filter(item => 
          item.evaluation_assignments?.attribute_banks?.id === bankId
        );
        console.log("Evaluations after bank filter:", evaluations?.length);
      }

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

      console.log("Attribute map:", attributeMap);

      // Calculate scores using the documented formula
      const processEvaluationData = (evaluations) => {
        // Helper function for consistent decimal formatting
        const formatScore = (score) => {
          return Number(Number(score).toFixed(1));
        };

        const attributeResponses = Object.entries(attributeMap).map(([attribute, data], index) => {
          // Calculate statement level scores
          const statementScores = data.statements.map(statement => {
            // Statement % = (Raw Score / Max Possible) × 100
            return (statement.weight / statement.maxPossible) * 100;
          });

          const numStatements = statementScores.length;
          const rawScore = statementScores.reduce((sum, score) => sum + score, 0);
          const selfAverageScore = numStatements > 0 ? rawScore / numStatements : 0;
          const selfPercentageScore = selfAverageScore > 0 ? (selfAverageScore / 100) * 100 : 0;

          return {
            srNo: index + 1,
            attributeName: attribute,
            averageScore: formatScore(selfAverageScore),
            percentageScore: formatScore(selfPercentageScore),
          };
        });

        return attributeResponses;
      };

      const processedData = processEvaluationData(evaluations);
      console.log("Processed data:", processedData);
      setTableData(processedData);
      // declare cumulative variable for later use
      let cumulative = 0;
      // calculate cumulative (average of self average scores across attributes)
      if (processedData.length > 0) {
        const totalAvg = processedData.reduce((sum, item) => sum + item.averageScore, 0);
        cumulative = Number((totalAvg / processedData.length).toFixed(1));
        setCumulativeScore(cumulative);
      }

      if (processedData.length > 0) {
        const generateChartData = (data) => {
          try {
            const chartData = {
              labels: data.map(item => item.attributeName),
              datasets: [
                {
                  label: 'Score (%)',
                  data: data.map(item => item.percentageScore),
                  backgroundColor: '#733e93',  // primary purple
                  borderWidth: 0
                },
                {
                  label: 'Cumulative Score (%)',
                  data: Array(data.length).fill(cumulative),
                  backgroundColor: '#FFCF55',
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
                  text: 'Self Evaluation Scores',
                  font: {
                    size: 16,
                    weight: 'bold'
                  }
                }
              }
            };

            return { chartData, chartOptions };
          } catch (error) {
            console.error("Error generating chart data:", error);
          }
        };

        const chartData = generateChartData(processedData);
        setChartData(chartData);
      }
    } catch (error) {
      console.error("Error processing self evaluation data:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-primary">Self Evaluation</h2>
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
              No self evaluation data available
            </div>
          ) : (
            <Table className="border">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="border-r w-16 font-semibold">Sr. No.</TableHead>
                  <TableHead className="border-r font-semibold">Attribute Name</TableHead>
                  <TableHead className="border-r text-right font-semibold">Self - Average Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Self - % Score</TableHead>
                  <TableHead className="text-right font-semibold">Cumulative Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <TableRow key={row.srNo} className="border-b">
                    <TableCell className="border-r">{row.srNo}</TableCell>
                    <TableCell className="border-r">{row.attributeName}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.averageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.percentageScore).toFixed(1)}</TableCell>
                     <TableCell className="text-right">{cumulativeScore.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Chart View */}
      {viewType === 'chart' && (
        <div ref={chartRef} className="border rounded-lg p-4 bg-white h-[400px]">
          {/* cumulative score column only affects table view; no chart changes needed */}
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
}
