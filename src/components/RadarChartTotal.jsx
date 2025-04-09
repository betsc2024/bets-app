import { useState, useEffect } from 'react';
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

  if (loading) {
    return <div className="flex justify-center items-center py-8">Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500 text-center py-8">
        Error loading chart: {error}
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="text-gray-500 text-center py-8">
        No data available for the selected attribute
      </div>
    );
  }

  return (
    <div className="w-full aspect-square max-w-2xl mx-auto">
      <Radar data={chartData} options={chartOptions} />
    </div>
  );
};

export default RadarChartTotal;
