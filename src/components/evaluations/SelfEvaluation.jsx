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

// Import and register Chart.js annotation plugin
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin,
  ChartDataLabels
);

export default function SelfEvaluation({ companyId, userId, bankId }) {
  const [viewType, setViewType] = useState('table');
  const [tableData, setTableData] = useState([]);
  const [cumulativeScore, setCumulativeScore] = useState(0);
  const [chartData, setChartData] = useState(null);
  const [idealScore, setIdealScore] = useState(0);

  const tableRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (companyId && userId && bankId) {
      // First fetch ideal score, then fetch evaluation data
      const fetchIdealScoreAndData = async () => {
        const idealScoreValue = await fetchIdealScore(bankId);
        fetchSelfEvaluationData(idealScoreValue);
      };
      fetchIdealScoreAndData();
    } else if (companyId && userId) {
      // If no bankId, just fetch evaluation data without ideal score
      fetchSelfEvaluationData(0);
    }
  }, [companyId, userId, bankId]);
  
  // Fetch ideal score from attribute_banks
  const fetchIdealScore = async (bankIdParam) => {
    try {
      const { data, error } = await supabase
        .from('attribute_banks')
        .select('ideal_score')
        .eq('id', bankIdParam)
        .single();
      if (!error && data) {
        const score = data.ideal_score == null ? 0 : data.ideal_score;
        setIdealScore(score);
        return score;
      } else {
        console.error('Error fetching ideal score:', error, 'for bankId:', bankIdParam);
        setIdealScore(0);
        return 0;
      }
    } catch (error) {
      console.error('Error fetching ideal score:', error);
      toast.error('Error fetching ideal score');
      setIdealScore(0);
      return 0;
    }
  };

  const fetchSelfEvaluationData = async (idealScoreValue = 0) => {
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
      // calculate cumulative (average of self percentage scores across attributes)
      if (processedData.length > 0) {
        const totalPercentage = processedData.reduce((sum, item) => sum + item.percentageScore, 0);
        cumulative = Number((totalPercentage / processedData.length).toFixed(1));
        setCumulativeScore(cumulative);
      }

      if (processedData.length > 0) {
        const generateChartData = (data, ideal) => {
          try {
            // Create labels with attribute names and add 'Cumulative' at the end
            const labels = [...data.map(item => item.attributeName), 'Cumulative'];
            
            // Create data array with attribute scores and add cumulative score at the end
            const scoreData = [...data.map(item => item.percentageScore), cumulative];
            
            // Calculate max value for y-axis scale, including ideal score
            const allVals = [...scoreData, ideal];
            const rawMax = Math.max(...allVals);
            const yMax = Math.max(Math.ceil(rawMax * 1.1 / 10) * 10, ideal + 10); // Ensure ideal score is visible
            
            const chartData = {
              labels: labels,
              datasets: [
                {
                  label: 'Score (%)',
                  data: scoreData,
                  backgroundColor: '#733e93', // Use same purple color for all bars including cumulative
                  borderWidth: 0
                },
                {
                  label: 'Ideal Score',
                  data: Array(labels.length).fill(null), // Use null to make line invisible
                  borderColor: '#1e90ff',
                  backgroundColor: '#ffffff',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  type: 'line',
                  fill: false,
                  pointRadius: 0,
                  pointHoverRadius: 0
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
                  text: 'Self Evaluation Scores',
                  font: {
                    size: 16,
                    weight: 'bold'
                  }
                },
                // Add annotation for ideal score line
                annotation: {
                  annotations: {
                    idealScoreLine: {
                      type: 'line',
                      yMin: ideal,
                      yMax: ideal,
                      xMin: -0.5,
                      xMax: labels.length - 0.5,
                      borderColor: '#1e90ff',
                      borderWidth: 2,
                      borderDash: [5, 5],
                      label: {
                        display: false
                      }
                    }
                  }
                }
              },
              // Only allow toggling Self, not Ideal Score
              onClick: function(e, legendItem, legend) {
                if (legendItem.text !== 'Ideal Score') {
                  const index = legendItem.datasetIndex;
                  const ci = legend.chart;
                  const meta = ci.getDatasetMeta(index);
                  meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                  ci.update();
                }
              }
            };

            return { chartData, chartOptions };
          } catch (error) {
            console.error("Error generating chart data:", error);
          }
        };

        const chartData = generateChartData(processedData, idealScoreValue);
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
        <div className="w-full overflow-x-auto">
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
        </div>
      )}

      {/* Chart View */}
      {viewType === 'chart' && chartData && (
        <div className="w-full overflow-x-auto">
          <div style={{ minWidth: `${tableData.length * 120}px` }}>
            <div ref={chartRef} className="h-[400px] border rounded-lg p-4 bg-white">
              {chartData ? (
                <Bar data={chartData.chartData} options={chartData.chartOptions} />
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No data available for chart
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
