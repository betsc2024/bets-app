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
import { toast } from 'sonner';

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

const SubordinateEvaluation = ({ userId, companyId, bankId }) => {
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [cumulativeSelf, setCumulativeSelf] = useState(0);
  const [cumulativeSub, setCumulativeSub] = useState(0);
  const [viewType, setViewType] = useState('table');
  const [idealScore, setIdealScore] = useState(0);
  const tableRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (userId && companyId && bankId) {
      // First fetch ideal score, then fetch evaluation data
      const fetchIdealScoreAndData = async () => {
        const idealScoreValue = await fetchIdealScore(bankId);
        fetchData(idealScoreValue);
      };
      fetchIdealScoreAndData();
    }
  }, [userId, companyId, bankId]);
  
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

  const fetchData = async (idealScoreValue = 0) => {
    try {
      // Fetch subordinate evaluations
      const { data: subordinateData, error: subordinateError } = await supabase
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
        .eq('evaluations.relationship_type', 'subordinate')
        .eq('company_id', companyId);

      if (subordinateError) {
        console.error('Error fetching subordinate evaluations:', subordinateError);
        return;
      }

      // Filter by bankId after fetching
      let filteredSubordinateData = subordinateData;
      if (bankId) {
        filteredSubordinateData = subordinateData?.filter(item => 
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

      // Process the data for chart and table
      const processedData = processEvaluationData(filteredSubordinateData, filteredSelfEvals);
      setTableData(processedData);

      // Calculate cumulative scores
      if (processedData.length > 0) {
        const totalSelf = processedData.reduce((sum, item) => sum + Number(item.selfPercentageScore), 0);
        const totalSub = processedData.reduce((sum, item) => sum + Number(item.subordinatePercentageScore), 0);
        const cumSelf = Number((totalSelf / processedData.length).toFixed(1));
        const cumSub = Number((totalSub / processedData.length).toFixed(1));
        setCumulativeSelf(cumSelf);
        setCumulativeSub(cumSub);

        // Generate chart data with ideal score
        const chartData = generateChartData(processedData, cumSelf, cumSub, idealScoreValue);
        setChartData(chartData);
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
    }
  };

  const processEvaluationData = (subordinateData, selfData) => {
    // Helper function for consistent decimal formatting
    const formatScore = (score) => {
      return Number(Number(score).toFixed(1));
    };

    const attributeResponses = {};

    // Process subordinate evaluations
    subordinateData.forEach(assignment => {
      assignment.evaluations.forEach(evaluation => {
        evaluation.evaluation_responses.forEach(response => {
          const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
          if (!attributeResponses[attributeName]) {
            attributeResponses[attributeName] = {
              subordinateScores: [],
              selfScores: []
            };
          }
          attributeResponses[attributeName].subordinateScores.push({
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
            subordinateScores: [],
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
      // Calculate per-statement scores for subordinate
      const statementScores = {};
      data.subordinateScores.forEach((score) => {
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

      // Calculate subordinate scores
      const numStatements = Object.keys(statementScores).length;
      const rawScore = Object.values(statementScores).reduce((sum, { total }) => sum + total, 0);
      const evaluatorsPerStatement = Object.values(statementScores)[0]?.evaluators || 0;
      const subordinateAverageScore = rawScore / numStatements;
      const maxPossible = evaluatorsPerStatement * 100;
      const subordinatePercentageScore = maxPossible ? (subordinateAverageScore / maxPossible) * 100 : 0;

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
        selfAverageScore: formatScore(selfAverageScore),
        selfPercentageScore: formatScore(selfPercentageScore),
        subordinateAverageScore: formatScore(subordinateAverageScore),
        subordinatePercentageScore: formatScore(subordinatePercentageScore),
      };
    });
  };

  const generateChartData = (data, cumSelf, cumSub, ideal) => {
    try {
      if (data && data.length > 0) {
        // Using passed cumulative values instead of state
        
        // Create labels with attribute names and add 'Cumulative' at the end
        const labels = [...data.map(item => item.attributeName), 'Cumulative'];
        
        // Create data arrays with scores and add cumulative scores at the end
        const selfScoreData = [...data.map(item => Number(item.selfPercentageScore)), cumSelf];
        const subScoreData = [...data.map(item => Number(item.subordinatePercentageScore)), cumSub];
        
        const allVals = [
          ...selfScoreData, 
          ...subScoreData,
          ideal // Include ideal score in max calculation
        ];
        const rawMax = Math.max(...allVals);
        const yMax = Math.max(Math.ceil(rawMax * 1.1 / 10) * 10, ideal + 10); // Ensure ideal score is visible
        
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
              label: 'Subordinate Score (%)',
              data: subScoreData,
              backgroundColor: '#4ade80', // Same green color for all subordinate bars including cumulative
              borderWidth: 0
            }
          ]
        };
        
        // Add ideal score dataset for legend only (not as visible line)
        chartData.datasets.push({
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
        });

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
              text: 'Self vs Subordinate Evaluation Scores',
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
          // Only allow toggling Self and Subordinate, not Ideal Score
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
      }
      return null;
    } catch (error) {
      console.error("Error processing evaluation data:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-primary">Subordinate Evaluation</h2>
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
                  <TableHead className="border-r text-right font-semibold">Subordinate - Average Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Subordinate - % Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Cumulative Self</TableHead>
                  <TableHead className="text-right font-semibold">Cumulative Subordinate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <TableRow key={row.srNo} className="border-b">
                    <TableCell className="border-r">{row.srNo}</TableCell>
                    <TableCell className="border-r">{row.attributeName}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.selfAverageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.selfPercentageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.subordinateAverageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.subordinatePercentageScore).toFixed(1)}</TableCell>
                     <TableCell className="border-r text-right">{cumulativeSelf.toFixed(1)}</TableCell>
                     <TableCell className="text-right">{cumulativeSub.toFixed(1)}</TableCell>
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

export default SubordinateEvaluation;
