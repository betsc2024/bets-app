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

// Accept assignmentId as an optional prop for robust filtering
export const RadarChartTotal = ({ companyId, userId, attribute, bankId, assignmentId, onDataLoad }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [idealScore, setIdealScore] = useState(null);
  const chartRef = useRef(null);

  const fetchIdealScore = async (bankIdParam) => {
    if (!bankIdParam) return 0;
    const { data, error } = await supabase
      .from('attribute_banks')
      .select('ideal_score')
      .eq('id', bankIdParam)
      .single();
    if (!error && data) {
      return data.ideal_score == null ? 0 : data.ideal_score;
    } else {
      return 0;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      // Fetch ideal score FIRST, then fetchData
      const score = await fetchIdealScore(bankId);
      if (isMounted) setIdealScore(score);
      await fetchData(score);
    };
    fetchAll();
    return () => { isMounted = false; };
  }, [companyId, userId, attribute, bankId]);

  const fetchData = async (idealScoreValue) => {
    try {
      setLoading(true);
      setError(null);

      // First get all evaluations except self
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
        .eq('company_id', companyId)
        .eq('attribute_banks.id', bankId);

      console.log('Total evaluations query result:', {
        totalData: totalData?.length || 0,
        totalError,
        sampleData: totalData?.[0]
      });

      if (totalError) {
        console.error('Error fetching total evaluations:', totalError);
        setError('Error fetching total evaluations');
        setLoading(false);
        return;
      }

      // Get self evaluation for this assignment (if assignmentId is provided, use it)
      let selfEvals, selfError;
      if (assignmentId) {
        ({ data: selfEvals, error: selfError } = await supabase
          .from("evaluations")
          .select(`
            is_self_evaluator,
            relationship_type,
            evaluation_assignment: evaluation_assignments!inner (
              id,
              company_id,
              user_to_evaluate_id,
              attribute_bank_id
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
          .eq("evaluation_assignments.id", assignmentId)
        );
      } else {
        ({ data: selfEvals, error: selfError } = await supabase
          .from("evaluations")
          .select(`
            is_self_evaluator,
            relationship_type,
            evaluation_assignment: evaluation_assignments!inner (
              id,
              company_id,
              user_to_evaluate_id,
              attribute_bank_id
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
          .eq("evaluation_assignments.user_to_evaluate_id", userId)
          .eq("evaluation_assignments.attribute_bank_id", bankId)
        );
      }

      console.log('Self evaluations query result:', {
        selfEvals: selfEvals?.length || 0,
        selfError,
        sampleEval: selfEvals?.[0]
      });

      if (selfError) {
        console.error('Error fetching self evaluations:', selfError);
        setError('Error fetching self evaluations');
        setLoading(false);
        return;
      }

      // Only use the self-evaluation for this assignment (if any)
      let filteredSelfEvals = selfEvals;
      console.log('[RadarChartTotal] assignmentId:', assignmentId);
      console.log('[RadarChartTotal] selfEvals:', JSON.stringify(selfEvals, null, 2));
      if (assignmentId) {
        filteredSelfEvals = selfEvals?.filter(item => item.evaluation_assignment?.id === assignmentId);
        console.log('[RadarChartTotal] filteredSelfEvals by assignmentId:', JSON.stringify(filteredSelfEvals, null, 2));
      }
      // If none or not completed, treat as empty
      if (!filteredSelfEvals || filteredSelfEvals.length === 0) {
        console.log('[RadarChartTotal] No completed self-evaluation found for assignment. Will show zero for self.');
        filteredSelfEvals = [];
      } else {
        console.log('[RadarChartTotal] Using self-evaluation:', JSON.stringify(filteredSelfEvals[0], null, 2));
        if (filteredSelfEvals[0]?.evaluation_responses) {
          console.log('[RadarChartTotal] Self evaluation_responses:', JSON.stringify(filteredSelfEvals[0].evaluation_responses, null, 2));
        }
      }
      const processedData = {
        self: filteredSelfEvals,
        others: totalData || []
      };


      // Process the evaluations to get scores per statement (self: only one, others: aggregate)
      const processEvaluations = (evaluations, isSelf = false) => {
        const statementScores = {};
        if (isSelf) {
          // Only one completed self-evaluation per assignment (if any)
          if (evaluations.length === 0) {
            return {}; // pending: show zero
          }
          const responses = evaluations[0].evaluation_responses || [];
          responses.forEach(response => {
            const attrStatement = response.attribute_statement_options?.attribute_statements;
            if (!attrStatement) return;
            if (attrStatement.attributes?.name !== attribute) return;
            const statement = attrStatement.statement;
            if (!statement) return;
            // Formula: (raw score for that statement / 100) * 100
            statementScores[statement] = Number(response.attribute_statement_options.weight.toFixed(1));
          });
          // Convert to percent (out of 100)
          return Object.fromEntries(
            Object.entries(statementScores).map(([statement, raw]) => [statement, Number(((raw / 100) * 100).toFixed(1))])
          );
        } else {
          // Aggregate for others (unchanged)
          evaluations.forEach(evaluation => {
            const responses = evaluation.evaluations.flatMap(e => e.evaluation_responses);
            responses.forEach(response => {
              const attrStatement = response.attribute_statement_options?.attribute_statements;
              if (!attrStatement) return;
              if (attrStatement.attributes?.name !== attribute) return;
              const statement = attrStatement.statement;
              if (!statement) return;
              if (!statementScores[statement]) {
                statementScores[statement] = {
                  total: 0,
                  count: 0
                };
              }
              statementScores[statement].total += response.attribute_statement_options.weight;
              statementScores[statement].count += 1;
            });
          });
          // Convert raw scores to percentages
          return Object.entries(statementScores).reduce((acc, [statement, data]) => {
            const averageScore = data.total / data.count;
            const percentageScore = (averageScore / 100) * 100;
            acc[statement] = Number(percentageScore.toFixed(1));
            return acc;
          }, {});
        }
      };


      // Get scores for self and others
      const selfScores = processEvaluations(processedData.self, true);
      const otherScores = processEvaluations(processedData.others);

      // Get all unique statements
      const statements = [...new Set([
        ...Object.keys(selfScores),
        ...Object.keys(otherScores)
      ])].sort();

      console.log('Processed scores:', {
        attribute,
        statements,
        selfScores,
        otherScores
      });

      if (statements.length === 0) {
        setError('No statements found for this attribute');
        setLoading(false);
        return;
      }

      // Prepare chart data
      const chartData = {
        labels: statements.map(statement => {
          // Split statement into lines of max 25 characters
          const words = statement.split(' ');
          let lines = [''];
          let currentLine = 0;
          
          words.forEach(word => {
            if ((lines[currentLine] + ' ' + word).length > 25) {
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
            data: statements.map(statement => selfScores[statement] || 0),
            backgroundColor: 'rgba(115, 62, 147, 0.1)',
            borderColor: '#733e93',
            borderWidth: 2,
            pointBackgroundColor: '#733e93',
            pointBorderColor: '#ffffff',
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#733e93',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Total',
            data: statements.map(statement => otherScores[statement] || 0),
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            borderColor: '#4ade80',
            borderWidth: 2,
            pointBackgroundColor: '#4ade80',
            pointBorderColor: '#ffffff',
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#4ade80',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Max Score',
            data: statements.map(() => 100),
            backgroundColor: 'rgba(255, 206, 86, 0.1)',
            borderColor: 'rgb(255, 206, 86)',
            borderWidth: 1,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: true
          },
          {
            label: 'Ideal Score',
            data: statements.map(() => idealScoreValue),
            backgroundColor: 'rgba(30, 144, 255, 0.08)',
            borderColor: '#1e90ff',
            borderWidth: 2,
            borderDash: [2, 2],
            pointBackgroundColor: '#1e90ff',
            pointBorderColor: '#ffffff',
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#1e90ff',
            pointRadius: 3,
            pointHoverRadius: 5
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
              display: true,
              color: 'rgba(0, 0, 0, 0.1)',
              lineWidth: 1,
              circular: false
            },
            beginAtZero: true,
            max: 100,
            min: 0,
            ticks: {
              stepSize: 20,
              display: false
            },
            pointLabels: {
              font: {
                size: 12,
                weight: '500'
              },
              padding: 20,
              color: '#374151'
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'center',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 13,
                weight: '500'
              },
              color: '#374151'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = Number(context.raw).toFixed(1);
                return `${context.dataset.label}: ${value}%`;
              }
            },
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#374151',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 10,
            boxPadding: 4,
            usePointStyle: true,
            bodyFont: {
              size: 12
            },
            titleFont: {
              size: 12,
              weight: '600'
            }
          }
        }
      };

      setChartData({ data: chartData, options: chartOptions });
      if (onDataLoad) onDataLoad({ data: chartData, options: chartOptions });
    } catch (err) {
      console.error('Error fetching radar chart data:', err);
      setError('Error fetching radar chart data');
    } finally {
      setLoading(false);
    }
  };

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
