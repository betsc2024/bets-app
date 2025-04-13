import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/supabase';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

export const RadarChartTotal = ({ companyId, userId, attribute, bankId, onDataLoad }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First get the evaluation assignment
        const { data: assignments, error: assignError } = await supabase
          .from('evaluation_assignments')
          .select(`
            id,
            attribute_banks!inner (
              id
            )
          `)
          .eq('company_id', companyId)
          .eq('user_to_evaluate_id', userId)
          .eq('attribute_banks.id', bankId)
          .single();

        if (assignError) {
          console.error('Error fetching assignments:', assignError);
          return;
        }

        // Then get all evaluations (both self and others)
        const { data: evaluations, error: evalError } = await supabase
          .from('evaluations')
          .select(`
            id,
            relationship_type,
            is_self_evaluator,
            evaluation_responses (
              id,
              selected_option_id
            )
          `)
          .eq('evaluation_assignment_id', assignments.id)
          .eq('status', 'completed');

        if (evalError) {
          console.error('Error fetching evaluations:', evalError);
          return;
        }

        // Separate self and other evaluations
        const selfEval = evaluations.find(e => e.is_self_evaluator);
        const otherEvals = evaluations.filter(e => !e.is_self_evaluator);

        // Get all response IDs
        const selfResponseIds = selfEval?.evaluation_responses.map(r => r.selected_option_id).filter(Boolean) || [];
        const otherResponseIds = otherEvals.flatMap(e => 
          e.evaluation_responses.map(r => r.selected_option_id)
        ).filter(Boolean);

        const allResponseIds = [...selfResponseIds, ...otherResponseIds];

        if (allResponseIds.length === 0) {
          setChartData(null);
          return;
        }

        // Get the options with their statements
        const { data: options, error: optError } = await supabase
          .from('attribute_statement_options')
          .select(`
            id,
            weight,
            statement:attribute_statements!inner(
              id,
              statement,
              attribute:attributes!inner(
                id,
                name
              )
            )
          `)
          .in('id', allResponseIds);

        if (optError) throw optError;

        // Filter by attribute and process data
        const filteredOptions = options.filter(opt => 
          opt.statement?.attribute?.name === attribute
        );

        if (filteredOptions.length === 0) {
          setChartData(null);
          return;
        }

        // Calculate averages for self and others
        const processData = (responseIds) => {
          const statementAverages = {};
          
          filteredOptions
            .filter(opt => responseIds.includes(opt.id))
            .forEach(opt => {
              if (!opt.statement?.statement) return;
              
              const statement = opt.statement.statement;
              if (!statementAverages[statement]) {
                statementAverages[statement] = {
                  total: 0,
                  count: 0
                };
              }
              statementAverages[statement].total += opt.weight;
              statementAverages[statement].count += 1;
            });

          // Convert to percentage scores
          return Object.entries(statementAverages).reduce((acc, [statement, data]) => {
            const averageScore = data.total / data.count;
            const percentageScore = (averageScore / 100) * 100;
            acc[statement] = Number(percentageScore.toFixed(1)); // Round to 1 decimal place
            return acc;
          }, {});
        };

        const selfAverages = processData(selfResponseIds);
        const otherAverages = processData(otherResponseIds);

        // Get unique statements
        const allStatements = [...new Set([
          ...Object.keys(selfAverages),
          ...Object.keys(otherAverages)
        ])];

        // Prepare data for radar chart
        const chartData = {
          labels: allStatements.map(statement => {
            // Split statement into lines of max 30 characters
            const words = statement.split(' ');
            let lines = [''];
            let currentLine = 0;
            
            words.forEach(word => {
              if ((lines[currentLine] + ' ' + word).length > 30) {
                currentLine++;
                lines[currentLine] = '';
              }
              lines[currentLine] = (lines[currentLine] + ' ' + word).trim();
            });
            
            return lines;
          }),
          datasets: [
            {
              label: 'Self',
              data: allStatements.map(statement => 
                selfAverages[statement] || 0
              ),
              backgroundColor: 'rgba(115, 62, 147, 0.1)',  // More transparent
              borderColor: '#733e93',
              borderWidth: 2,  // Thicker border
              pointBackgroundColor: '#733e93',
              pointBorderColor: '#ffffff',
              pointHoverBackgroundColor: '#ffffff',
              pointHoverBorderColor: '#733e93',
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Total',
              data: allStatements.map(statement => 
                otherAverages[statement] || 0
              ),
              backgroundColor: 'rgba(74, 222, 128, 0.1)',  // More transparent
              borderColor: '#4ade80',
              borderWidth: 2,  // Thicker border
              pointBackgroundColor: '#4ade80',
              pointBorderColor: '#ffffff',
              pointHoverBackgroundColor: '#ffffff',
              pointHoverBorderColor: '#4ade80',
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Max Score',
              data: allStatements.map(() => 100),
              backgroundColor: 'rgba(255, 206, 86, 0.1)',  // More transparent
              borderColor: 'rgb(255, 206, 86)',
              borderWidth: 1,
              borderDash: [],  // Solid line for max
              pointRadius: 0,  // Hide points for max line
              fill: true
            }
          ]
        };

        const chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              angleLines: {
                display: true,
                color: 'rgba(0, 0, 0, 0.1)',
                lineWidth: 1
              },
              grid: {
                display: false  // Hide circular grid lines
              },
              beginAtZero: true,
              max: 100,
              min: 0,
              ticks: {
                display: false  // Hide numbers
              },
              pointLabels: {
                font: {
                  size: 14,
                  weight: '600'
                },
                padding: 25
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              align: 'center',
              labels: {
                usePointStyle: true,
                padding: 25,
                font: {
                  size: 14,
                  weight: '600'
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const value = Number(context.raw).toFixed(1);  // Format tooltip values
                  return `${context.dataset.label}: ${value}%`;
                }
              },
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              titleColor: '#000',
              bodyColor: '#000',
              borderColor: '#ddd',
              borderWidth: 1,
              padding: 12,
              boxPadding: 6,
              usePointStyle: true
            }
          }
        };

        setChartData({ data: chartData, options: chartOptions });
        if (onDataLoad) onDataLoad({ data: chartData, options: chartOptions });
      } catch (err) {
        console.error('Error fetching radar chart data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (companyId && userId && attribute && bankId) {
      fetchData();
    }
  }, [companyId, userId, attribute, bankId]);

  return (
    <div className="relative w-full">
      {loading && <div className="text-center py-4">Loading...</div>}
      {error && <div className="text-center text-red-500 py-4">{error}</div>}
      {chartData && !loading && !error && (
        <>
          <div className="h-[700px] w-full">
            <Radar
              ref={chartRef}
              data={chartData.data}
              options={chartData.options}
            />
          </div>
        </>
      )}
      {!chartData && !loading && !error && (
        <div className="text-center py-4 text-gray-500">No data available for the selected attribute</div>
      )}
    </div>
  );
};
