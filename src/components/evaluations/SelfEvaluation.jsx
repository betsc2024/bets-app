import React, { useEffect, useState } from 'react';
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

export default function SelfEvaluation({ companyId, userId, bankId }) {
  const [viewType, setViewType] = useState('table');
  const [tableData, setTableData] = useState([]);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    if (companyId && userId) {
      fetchSelfEvaluationData();
    }
  }, [companyId, userId, bankId]);

  const fetchSelfEvaluationData = async () => {
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
      const processedData = Object.entries(attributeMap).map(([attributeName, data], index) => {
        // Calculate statement level scores
        const statementScores = data.statements.map(statement => {
          // Statement % = (Raw Score / Max Possible) × 100
          return (statement.weight / statement.maxPossible) * 100;
        });

        // Calculate attribute level scores
        // Average Score = Sum of Raw Scores / Number of Statements
        const averageScore = data.rawScores.reduce((sum, score) => sum + score, 0) / data.rawScores.length;

        // Percentage Score = Sum of Statement Percentages / Number of Statements
        const percentageScore = statementScores.reduce((sum, score) => sum + score, 0) / statementScores.length;

        return {
          srNo: index + 1,
          attributeName,
          averageScore: Number(averageScore.toFixed(1)),
          percentageScore: Number(percentageScore.toFixed(1))
        };
      });

      console.log("Processed data:", processedData);
      setTableData(processedData);

      if (processedData.length > 0) {
        const chartData = {
          labels: processedData.map(item => item.attributeName),
          datasets: [{
            label: 'Self Evaluation Score (%)',
            data: processedData.map(item => item.percentageScore),
            backgroundColor: '#3498db'
          }]
        };
        setChartData(chartData);
      }
    } catch (error) {
      console.error("Error processing self evaluation data:", error);
    }
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
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Self Evaluation Scores'
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Self Evaluation</h2>
        <div className="space-x-2">
          <button
            className={`px-4 py-2 rounded ${viewType === 'table' ? 'bg-primary text-white' : 'bg-gray-200'}`}
            onClick={() => setViewType('table')}
          >
            Table
          </button>
          <button
            className={`px-4 py-2 rounded ${viewType === 'chart' ? 'bg-primary text-white' : 'bg-gray-200'}`}
            onClick={() => setViewType('chart')}
          >
            Chart
          </button>
        </div>
      </div>

      {tableData.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No self evaluation data available
        </div>
      ) : viewType === 'table' ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Sr. No.</TableHead>
              <TableHead>Attribute Name</TableHead>
              <TableHead className="text-right">Average Score</TableHead>
              <TableHead className="text-right">Score Percentage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row) => (
              <TableRow key={row.srNo}>
                <TableCell>{row.srNo}</TableCell>
                <TableCell>{row.attributeName}</TableCell>
                <TableCell className="text-right">{row.averageScore.toFixed(1)}</TableCell>
                <TableCell className="text-right">{row.percentageScore.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="w-full h-[400px]">
          {chartData ? (
            <Bar data={chartData} options={chartOptions} />
          ) : (
            <div className="text-center py-4 text-gray-500">
              No data available for chart
            </div>
          )}
        </div>
      )}
    </div>
  );
}
