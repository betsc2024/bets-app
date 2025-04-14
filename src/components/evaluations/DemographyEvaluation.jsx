import { useState, useRef, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/supabase';
import { toast } from 'sonner';
import { Bar } from 'react-chartjs-2';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import CopyToClipboard from '../CopyToClipboard';

Chart.register(ChartDataLabels);

const DemographyEvaluation = ({ userId, companyId, bankId }) => {
  const [viewType, setViewType] = useState('table');
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [attributes, setAttributes] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [availableRelationTypes, setAvailableRelationTypes] = useState([]);
  const tableRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (userId && companyId && bankId) {
      fetchDemographyData();
    }
  }, [userId, companyId, bankId, selectedAttribute]);

  const fetchDemographyData = async () => {
    try {
      // Get all evaluations for different relationship types
      const { data: evaluations, error } = await supabase
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
            is_self_evaluator,
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
        .eq('company_id', companyId);

      if (error) throw error;

      // Filter by bankId
      const filteredEvals = bankId 
        ? evaluations.filter(item => item.attribute_banks?.id === bankId)
        : evaluations;

      // Process data by relationship type
      const relationshipData = {};
      const allAttributes = new Set();
      const foundRelationTypes = new Set();

      filteredEvals.forEach(evalItem => {
        evalItem.evaluations?.forEach(evaluation => {
          if (!evaluation) return;
          
          const relationType = evaluation.is_self_evaluator ? 'self' : evaluation.relationship_type;
          if (!relationType) return;
          
          foundRelationTypes.add(relationType);
          
          if (!relationshipData[relationType]) {
            relationshipData[relationType] = {
              responses: [],
              scores: {}
            };
          }

          evaluation.evaluation_responses?.forEach(response => {
            if (!response?.attribute_statement_options?.attribute_statements?.attributes?.name) return;
            
            const option = response.attribute_statement_options;
            const attributeName = option.attribute_statements.attributes.name;
            allAttributes.add(attributeName);

            if (!relationshipData[relationType].scores[attributeName]) {
              relationshipData[relationType].scores[attributeName] = {
                total: 0,
                count: 0
              };
            }

            relationshipData[relationType].scores[attributeName].total += option.weight || 0;
            relationshipData[relationType].scores[attributeName].count++;
          });
        });
      });

      // Calculate percentage scores
      const processedData = {};
      const totalScores = {};
      allAttributes.forEach(attr => {
        processedData[attr] = {};
        let totalScore = 0;
        let totalCount = 0;

        Array.from(foundRelationTypes).forEach(relationType => {
          const scores = relationshipData[relationType].scores[attr];
          if (scores) {
            const averageScore = scores.total / scores.count;
            const maxPossible = relationType === 'self' ? 100 : 100;
            const percentageScore = Number((averageScore / maxPossible * 100).toFixed(1));
            processedData[attr][relationType] = percentageScore;
            
            if (relationType !== 'self') {  // Exclude self from total
              totalScore += scores.total;
              totalCount += scores.count;
            }
          }
        });

        // Calculate total percentage score
        if (totalCount > 0) {
          const totalAverageScore = totalScore / totalCount;
          totalScores[attr] = Number((totalAverageScore / 100 * 100).toFixed(1));
        } else {
          totalScores[attr] = '-';
        }
      });

      // Get actual available relationship types and sort them in a specific order
      const sortOrder = ['self', 'top_boss', 'reporting_boss', 'peers', 'subordinates', 'hr'];
      const relationTypes = Array.from(foundRelationTypes).sort((a, b) => {
        // Always put 'self' first
        if (a === 'self') return -1;
        if (b === 'self') return 1;
        // Then sort the rest according to sortOrder
        return sortOrder.indexOf(a) - sortOrder.indexOf(b);
      });
      setAvailableRelationTypes(relationTypes);

      // Prepare table data with total score
      const tableRows = Array.from(allAttributes).map((attr, index) => ({
        srNo: index + 1,
        attribute: attr,
        ...Object.fromEntries(relationTypes.map(type => [type, processedData[attr]?.[type] || '-'])),
        total: totalScores[attr]
      }));

      setAttributes(Array.from(allAttributes));
      if (!selectedAttribute && allAttributes.size > 0) {
        setSelectedAttribute(Array.from(allAttributes)[0]);
      }

      setTableData(tableRows);

      // Prepare chart data if attribute is selected
      if (selectedAttribute) {
        const attributeScores = processedData[selectedAttribute] || {};
        const chartLabels = relationTypes.map(type =>
          type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        );
        chartLabels.push('Total');

        const chartScores = relationTypes.map(type => (attributeScores[type] ?? 0));
        chartScores.push(totalScores[selectedAttribute] ?? 0);

        const chartData = {
          labels: chartLabels,
          datasets: [{
            label: 'Score (%)',
            data: chartScores,
            backgroundColor: [
              '#a855f7',  // Self (Purple)
              '#ff6384',  // Top Boss
              '#4bc0c0',  // Reporting Boss
              '#ffce56',  // Peers
              '#36a2eb',  // Subordinates
              '#ff9f40',  // HR
              '#4ade80',  // Total (Green)
            ],
            borderColor: [
              '#a855f7',  // Self (Purple)
              '#ff6384',  // Top Boss
              '#4bc0c0',  // Reporting Boss
              '#ffce56',  // Peers
              '#36a2eb',  // Subordinates
              '#ff9f40',  // HR
              '#4ade80',  // Total (Green)
            ],
            borderWidth: 1
          }]
        };

        const chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: value => `${value}%`
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: context => `Score: ${context.formattedValue}%`
              }
            },
            datalabels: {
              anchor: 'end',
              align: 'top',
              offset: 4,
              font: {
                weight: 'bold'
              },
              formatter: value => value
            },
            title: {
              display: true,
              text: selectedAttribute ? `${selectedAttribute} Scores by Relationship Type` : 'Attribute Scores by Relationship Type',
              font: {
                size: 16,
                weight: 'bold'
              },
              padding: {
                top: 10,
                bottom: 20
              }
            }
          }
        };

        setChartData({ data: chartData, options: chartOptions });
      }
    } catch (error) {
      console.error('Error fetching demography data:', error);
      toast.error('Failed to load evaluation data');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-primary">Attribute Demography</h2>
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

      {/* Chart View */}
      {viewType === 'chart' && (
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Attribute
          </label>
          <div className="flex items-center gap-4">
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
            <CopyToClipboard targetRef={chartRef} />
          </div>
        </div>
      )}

      {/* Table View */}
      {viewType === 'table' ? (
        <div ref={tableRef} className="border rounded-lg p-4 bg-white">
          <div className="flex justify-end mb-4">
            <CopyToClipboard targetRef={tableRef} />
          </div>
          <Table className="border">
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="border-r w-16 font-semibold">Sr. No.</TableHead>
                <TableHead className="border-r font-semibold">Attribute Name</TableHead>
                {availableRelationTypes.map((type, index) => (
                  <TableHead 
                    key={type}
                    className={`text-right font-semibold border-r`}
                  >
                    {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} (%)
                  </TableHead>
                ))}
                <TableHead className="text-right font-semibold">Total (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row, index) => (
                <TableRow key={index} className="border-b">
                  <TableCell className="border-r">{row.srNo}</TableCell>
                  <TableCell className="border-r">{row.attribute}</TableCell>
                  {availableRelationTypes.map((type, idx) => (
                    <TableCell 
                      key={type}
                      className="text-right border-r"
                    >
                      {row[type]}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        chartData && (
          <div ref={chartRef} className="h-[400px] border rounded-lg p-4 bg-white relative">
            <Bar data={chartData.data} options={chartData.options} />
          </div>
        )
      )}
    </div>
  );
};

export default DemographyEvaluation;
