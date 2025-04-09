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
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Register ChartJS components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const RadarChartTotal = ({ companyId, userId, attribute, onDataLoad }) => {
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
          .select('id')
          .eq('company_id', companyId)
          .eq('user_to_evaluate_id', userId)
          .single();

        if (assignError) throw assignError;

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

        if (evalError) throw evalError;

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

          return statementAverages;
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
          labels: allStatements,
          datasets: [
            {
              label: 'Self',
              data: allStatements.map(statement => 
                selfAverages[statement] 
                  ? selfAverages[statement].total / selfAverages[statement].count 
                  : 0
              ),
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgb(255, 99, 132)',
              borderWidth: 1
            },
            {
              label: 'Total',
              data: allStatements.map(statement => 
                otherAverages[statement] 
                  ? otherAverages[statement].total / otherAverages[statement].count 
                  : 0
              ),
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgb(54, 162, 235)',
              borderWidth: 1
            },
            {
              label: 'Max Score (100)',
              data: allStatements.map(() => 100),
              backgroundColor: 'rgba(255, 206, 86, 0.2)',
              borderColor: 'rgb(255, 206, 86)',
              borderWidth: 1,
              fill: true
            }
          ]
        };

        setChartData(chartData);
        if (onDataLoad) onDataLoad(chartData);
      } catch (err) {
        console.error('Error fetching radar chart data:', err);
        setError(err.message);
        toast.error('Failed to load radar chart data');
      } finally {
        setLoading(false);
      }
    };

    if (companyId && userId && attribute) {
      fetchData();
    }
  }, [companyId, userId, attribute]);

  // Copy chart to clipboard
  const handleCopyChart = async () => {
    try {
      const chart = chartRef.current;
      if (!chart) {
        toast.error('Chart not available');
        return;
      }

      const canvas = chart.canvas;
      const imageData = canvas.toDataURL('image/png');
      
      // Create a temporary canvas to add white background
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      
      // Fill white background
      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw the chart on top
      const image = new Image();
      image.src = imageData;
      await new Promise(resolve => {
        image.onload = () => {
          tempCtx.drawImage(image, 0, 0);
          resolve();
        };
      });

      // Convert to blob and copy
      const blob = await new Promise(resolve => 
        tempCanvas.toBlob(resolve, 'image/png')
      );
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);
      
      toast.success('Chart copied to clipboard');
    } catch (err) {
      console.error('Error copying chart:', err);
      toast.error('Failed to copy chart');
    }
  };

  const chartOptions = {
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.formattedValue}%`;
          }
        }
      }
    }
  };

  return (
    <div className="relative">
      {loading && <div className="text-center py-4">Loading...</div>}
      {error && <div className="text-red-500 text-center py-4">{error}</div>}
      {chartData && (
        <>
          <Radar
            ref={chartRef}
            data={chartData}
            options={{
              scales: {
                r: {
                  min: 0,
                  max: 100,
                  ticks: {
                    stepSize: 20
                  }
                }
              },
              plugins: {
                legend: {
                  position: 'top'
                }
              }
            }}
          />
          <div className="flex justify-center mt-4">
            <Button 
              variant="secondary" 
              onClick={handleCopyChart}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              Copy Chart to Clipboard
            </Button>
          </div>
        </>
      )}
      {!chartData && !loading && !error && (
        <div className="text-center py-4">No data available for the selected attribute</div>
      )}
    </div>
  );
};

export default RadarChartTotal;
