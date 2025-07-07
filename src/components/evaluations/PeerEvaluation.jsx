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
import CopyToClipboard from '../CopyToClipboard';

const PeerEvaluation = ({ userId, companyId, bankId }) => {
  const [viewType, setViewType] = useState('table');
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [cumulativeSelf, setCumulativeSelf] = useState(0);
  const [cumulativePeer, setCumulativePeer] = useState(0);
  const tableRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (userId && companyId && bankId) {
      fetchPeerData();
    }
  }, [userId, companyId, bankId]);

  const fetchPeerData = async () => {
    try {
      // First get the peer evaluations
      const { data: peerEvals, error: peerError } = await supabase
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
        .eq('evaluations.relationship_type', 'peer')
        .eq('company_id', companyId);

      if (peerError) throw peerError;

      // Filter by bankId after fetching
      let filteredPeerEvals = peerEvals;
      if (bankId) {
        filteredPeerEvals = peerEvals?.filter(item => 
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

      if ((filteredPeerEvals && filteredPeerEvals.length > 0) || (filteredSelfEvals && filteredSelfEvals.length > 0)) {
        const processedData = processPeerData(filteredPeerEvals, filteredSelfEvals);
        setTableData(processedData);
        // Calculate cumulative averages
        if (processedData.length > 0) {
          const totalSelf = processedData.reduce((sum, item) => sum + item.selfAverageScore, 0);
          const totalPeer = processedData.reduce((sum, item) => sum + item.peerAverageScore, 0);
          const cumSelf = Number((totalSelf / processedData.length).toFixed(1));
          const cumPeer = Number((totalPeer / processedData.length).toFixed(1));
          setCumulativeSelf(cumSelf);
          setCumulativePeer(cumPeer);
        }
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

  const processPeerData = (peerEvaluations, selfEvaluations) => {
    const attributeResponses = {};

    // Helper function for consistent decimal formatting
    const formatScore = (score) => {
      return Number(Number(score).toFixed(1));
    };

    // First collect peer evaluations
    peerEvaluations.forEach(assignment => {
      const evaluations = assignment.evaluations || [];
      evaluations.forEach(evaluation => {
        if (!evaluation?.evaluation_responses) return;

        evaluation.evaluation_responses.forEach(response => {
          if (!response?.attribute_statement_options?.weight || !response?.attribute_statement_options?.attribute_statements?.attributes?.name) return;

          const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
          const weight = response.attribute_statement_options.weight;

          if (!attributeResponses[attributeName]) {
            attributeResponses[attributeName] = {
              peerScores: [],
              selfScores: [],
            };
          }

          attributeResponses[attributeName].peerScores.push({
            weight,
            attribute_statement_options: response.attribute_statement_options
          });
        });
      });
    });

    // Then collect self evaluations
    selfEvaluations.forEach(evaluation => {
      if (!evaluation?.evaluation_responses) return;

      evaluation.evaluation_responses.forEach(response => {
        if (!response?.attribute_statement_options?.weight || !response?.attribute_statement_options?.attribute_statements?.attributes?.name) return;

        const attributeName = response.attribute_statement_options.attribute_statements.attributes.name;
        const weight = response.attribute_statement_options.weight;

        if (!attributeResponses[attributeName]) {
          attributeResponses[attributeName] = {
            peerScores: [],
            selfScores: [],
          };
        }

        attributeResponses[attributeName].selfScores.push({
          weight,
          attribute_statement_options: response.attribute_statement_options
        });
      });
    });

    // Calculate scores
    return Object.entries(attributeResponses).map(([attribute, data], index) => {
      // Calculate per-statement scores for peer
      const statementScores = {};
      data.peerScores.forEach((score) => {
        const statementId = score.attribute_statement_options.attribute_statements.statement;
        if (!statementScores[statementId]) {
          statementScores[statementId] = {
            total: 0,
            evaluators: 0
          };
        }
        statementScores[statementId].total += score.weight;
        statementScores[statementId].evaluators += 1;
      });

      // Calculate peer scores
      const numStatements = Object.keys(statementScores).length;
      const rawScore = Object.values(statementScores).reduce((sum, { total }) => sum + total, 0);
      const evaluatorsPerStatement = Object.values(statementScores)[0]?.evaluators || 0;
      const peerAverageScore = numStatements > 0 ? rawScore / numStatements : 0;
      const maxPossible = evaluatorsPerStatement * 100;
      const peerPercentageScore = maxPossible > 0 ? (peerAverageScore / maxPossible) * 100 : 0;

      // Calculate self evaluation scores
      const selfStatementScores = {};
      data.selfScores.forEach((score) => {
        const statementId = score.attribute_statement_options.attribute_statements.statement;
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
        peerAverageScore: formatScore(peerAverageScore),
        peerPercentageScore: formatScore(peerPercentageScore),
      };
    });
  };

  const generateChartData = (data) => {
    try {
      if (data && data.length > 0) {
        const cumSelf = data.reduce((s, i) => s + i.selfAverageScore, 0) / data.length;
        const cumPeer = data.reduce((s, i) => s + i.peerAverageScore, 0) / data.length;
        const chartData = {
          labels: data.map(item => item.attributeName),
          datasets: [
            {
              label: 'Self Score (%)',
              data: data.map(item => item.selfPercentageScore),
              backgroundColor: '#733e93',  // purple
              borderWidth: 0
            },
            {
              label: 'Peer Score (%)',
              data: data.map(item => item.peerPercentageScore),
              backgroundColor: '#4ade80',  // green
              borderWidth: 0
            },
            {
              label: 'Cumulative Self (%)',
              data: Array(data.length).fill(cumSelf),
              backgroundColor: '#FFCF55', // yellow
              borderWidth: 0
            },
            {
              label: 'Cumulative Peer (%)',
              data: Array(data.length).fill(cumPeer),
              backgroundColor: '#1E90FF', // blue
              borderWidth: 0
            }
          ]
        };

        const allVals = [
            ...data.map(i=>i.selfPercentageScore),
            ...data.map(i=>i.peerPercentageScore),
            cumSelf,
            cumPeer
          ];
          const rawMax = Math.max(...allVals);
          const yMax = Math.ceil(rawMax * 1.1 / 10) * 10;
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
              text: 'Self vs Peer Evaluation Scores',
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
        <h2 className="text-xl font-semibold text-primary">Peer Evaluation</h2>
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
                  <TableHead className="border-r text-right font-semibold">Peer - Average Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Peer - % Score</TableHead>
                  <TableHead className="border-r text-right font-semibold">Cumulative Self</TableHead>
                  <TableHead className="text-right font-semibold">Cumulative Peer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((row, index) => (
                  <TableRow key={row.srNo} className="border-b">
                    <TableCell className="border-r">{row.srNo}</TableCell>
                    <TableCell className="border-r">{row.attributeName}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.selfAverageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.selfPercentageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.peerAverageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{Number(row.peerPercentageScore).toFixed(1)}</TableCell>
                    <TableCell className="border-r text-right">{cumulativeSelf.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{cumulativePeer.toFixed(1)}</TableCell>
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

export default PeerEvaluation;
