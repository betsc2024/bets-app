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
  const tableRef = useRef(null);
  const chartRef = useRef(null);
  const radarRef = useRef(null);

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
      // compute cumulative averages
      if (processedData.length > 0) {
        const totalSelf = processedData.reduce((sum,item)=> sum + Number(item.selfAverageScore), 0);
        const totalTotal = processedData.reduce((sum,item)=> sum + Number(item.totalAverageScore), 0);
        setCumulativeSelf(Number((totalSelf/processedData.length).toFixed(1)));
        setCumulativeTotal(Number((totalTotal/processedData.length).toFixed(1)));
      }
      generateChartData(processedData);

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

  const generateChartData = (data) => {
    try {
      if (data && data.length > 0) {
        const cumSelf = data.reduce((s,i)=> s + Number(i.selfAverageScore),0)/data.length;
        const cumTotal = data.reduce((s,i)=> s + Number(i.totalAverageScore),0)/data.length;
        const allVals=[...data.map(i=>Number(i.selfAverageScore)), ...data.map(i=>Number(i.totalAverageScore)), cumSelf, cumTotal];
        const yMax=Math.ceil(Math.max(...allVals)*1.1/10)*10;
        const chartData = {
          labels: data.map(item => item.attributeName),
          datasets: [
             {
               label: 'Self Score',
               data: data.map(item=>item.selfAverageScore),
               backgroundColor: '#733e93',
               borderWidth:0
             },
             {
               label: 'Total Score',
               data: data.map(item=>item.totalAverageScore),
               backgroundColor: '#4ade80',
               borderWidth:0
             },
             {
               label: 'Cumulative Self',
               data: Array(data.length).fill(cumSelf),
               backgroundColor: '#FFCF55',
               borderWidth:0
             },
             {
               label: 'Cumulative Total',
               data: Array(data.length).fill(cumTotal),
               backgroundColor: '#1E90FF',
               borderWidth:0
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
