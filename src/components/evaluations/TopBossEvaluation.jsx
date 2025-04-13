import { useState, useRef, useEffect } from 'react';
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
import { Bar } from 'react-chartjs-2';

const TopBossEvaluation = ({ userId, companyId, bankId }) => {
  const [viewType, setViewType] = useState('table');
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const tableRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (userId && companyId && bankId) {
      fetchTopBossData();
    }
  }, [userId, companyId, bankId]);

  const fetchTopBossData = async () => {
    try {
      // First get the top boss evaluations
      const { data: topBossEvals, error: topBossError } = await supabase
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
        .eq('evaluations.relationship_type', 'top_boss')
        .eq('company_id', companyId);

      if (topBossError) throw topBossError;

      // Filter by bankId after fetching
      let filteredTopBossEvals = topBossEvals;
      if (bankId) {
        filteredTopBossEvals = topBossEvals?.filter(item => 
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

      if (selfError) throw selfError;

      // Filter by bankId after fetching
      let filteredSelfEvals = selfEvals;
      if (bankId) {
        filteredSelfEvals = selfEvals?.filter(item => 
          item.evaluation_assignments?.attribute_banks?.id === bankId
        );
      }

      if ((filteredTopBossEvals && filteredTopBossEvals.length > 0) || (filteredSelfEvals && filteredSelfEvals.length > 0)) {
        const processedData = processTopBossData(filteredTopBossEvals, filteredSelfEvals);
        setTableData(processedData);
        generateChartData(processedData);
      } else {
        setTableData([]);
        setChartData(null);
      }
    } catch (error) {
      console.error('Error fetching evaluation data:', error);
      toast.error('Failed to fetch evaluation data');
    }
  };

  const processTopBossData = (topBossEvals, selfEvals) => {
    const attributeResponses = {};

    // Process top boss evaluations
    topBossEvals?.forEach(assignment => {
      const evaluationsList = Array.isArray(assignment.evaluations) ? 
        assignment.evaluations : [assignment.evaluations];

      evaluationsList.forEach(evaluation => {
        if (!evaluation?.evaluation_responses) return;

        evaluation.evaluation_responses.forEach(response => {
          if (!response?.attribute_statement_options?.weight || !response?.attribute_statement_options?.attribute_statements?.attributes?.name) return;

          const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
          const weight = response.attribute_statement_options.weight;

          if (!attributeResponses[attributeName]) {
            attributeResponses[attributeName] = {
              topBossScores: [],
              selfScores: [],
            };
          }

          attributeResponses[attributeName].topBossScores.push(weight);
        });
      });
    });

    // Process self evaluations
    selfEvals?.forEach(evaluation => {
      if (!evaluation?.evaluation_responses) return;

      evaluation.evaluation_responses.forEach(response => {
        if (!response?.attribute_statement_options?.weight || !response?.attribute_statement_options?.attribute_statements?.attributes?.name) return;

        const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
        const weight = response.attribute_statement_options.weight;

        if (!attributeResponses[attributeName]) {
          attributeResponses[attributeName] = {
            topBossScores: [],
            selfScores: [],
          };
        }

        attributeResponses[attributeName].selfScores.push(weight);
      });
    });

    // Calculate scores
    return Object.entries(attributeResponses).map(([attribute, data], index) => {
      const topBossRawScore = data.topBossScores.reduce((sum, weight) => sum + weight, 0);
      const selfRawScore = data.selfScores.reduce((sum, weight) => sum + weight, 0);

      const topBossMaxPossible = data.topBossScores.length * 100;
      const selfMaxPossible = data.selfScores.length * 100;

      return {
        srNo: index + 1,
        attributeName: attribute,
        selfAverageScore: data.selfScores.length ? selfRawScore / data.selfScores.length : 0,
        selfPercentageScore: selfMaxPossible ? (selfRawScore / selfMaxPossible) * 100 : 0,
        topBossAverageScore: data.topBossScores.length ? topBossRawScore / data.topBossScores.length : 0,
        topBossPercentageScore: topBossMaxPossible ? (topBossRawScore / topBossMaxPossible) * 100 : 0,
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
              label: 'Top Boss Score (%)',
              data: data.map(item => item.topBossPercentageScore),
              backgroundColor: '#733e93',  // primary purple
              borderWidth: 0
            },
            {
              label: 'Self Score (%)',
              data: data.map(item => item.selfPercentageScore),
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
              text: 'Self vs Top Boss Evaluation Scores',
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
        <h2 className="text-xl font-semibold text-primary">Top Boss Evaluation</h2>
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
                  <TableHead className="border-r text-right font-semibold">Top Boss - Average Score</TableHead>
                  <TableHead className="text-right font-semibold">Top Boss - % Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row) => (
                  <TableRow key={row.srNo} className="border-b">
                    <TableCell className="border-r">{row.srNo}</TableCell>
                    <TableCell className="border-r">{row.attributeName}</TableCell>
                    <TableCell className="border-r text-right">{row.selfAverageScore.toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{row.selfPercentageScore.toFixed(1)}%</TableCell>
                    <TableCell className="border-r text-right">{row.topBossAverageScore.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{row.topBossPercentageScore.toFixed(1)}%</TableCell>
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

export default TopBossEvaluation;
