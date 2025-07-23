import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import CopyToClipboard from '@/components/CopyToClipboard';

// Create a function to generate a quadrant label plugin for a specific chart instance
const createQuadrantLabelPlugin = () => ({
  id: 'quadrantLabels',
  afterDraw: (chart) => {
    // Only apply to charts that have the quadrantLabelsEnabled flag
    if (!chart.options.plugins.quadrantLabelsEnabled) return;
    
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    
    const { left, top, right, bottom } = chartArea;
    const midX = left + (right - left) / 2;
    const midY = top + (bottom - top) / 2;
    
    // Draw labels
    ctx.save();
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Top-left (Socialite)
    ctx.fillText('Socialite', left + (midX - left) / 2, top + (midY - top) / 2);
    
    // Top-right (Team Leadership)
    ctx.fillText('Team Leadership', midX + (right - midX) / 2, top + (midY - top) / 2);
    
    // Bottom-right (Authoritarian)
    ctx.fillText('Authoritarian', midX + (right - midX) / 2, midY + (bottom - midY) / 2);
    
    // Bottom-left (Impoverished)
    ctx.fillText('Impoverished', left + (midX - left) / 2, midY + (bottom - midY) / 2);
    
    ctx.restore();
  }
});

// Create an instance of the plugin
const quadrantLabelPlugin = createQuadrantLabelPlugin();

// Register ChartJS components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  annotationPlugin
  // quadrantLabelPlugin will be conditionally registered
);

const QuadrantChart = ({ taskScore, peopleScore, taskScoreAfter, peopleScoreAfter, showAfterBank, onClose, showQuadrantLabels = false, idealScorePoint }) => {
  const chartRef = useRef(null);
  useEffect(() => {
    if (showQuadrantLabels) {
      ChartJS.register(quadrantLabelPlugin);
    } else {
      // Unregister if needed (Chart.js does not have unregister, so this is a no-op)
    }
    // No cleanup needed
  }, [showQuadrantLabels]);
  
  // Convert percentage scores to 0-100 scale if they're in decimal form
  const normalizedTaskScore = taskScore > 1 ? taskScore : taskScore * 100;
  const normalizedPeopleScore = peopleScore > 1 ? peopleScore : peopleScore * 100;
  
  // Convert after scores if available
  const hasAfterScores = showAfterBank && taskScoreAfter !== null && taskScoreAfter !== "NA" && 
                         peopleScoreAfter !== null && peopleScoreAfter !== "NA";
  
  const normalizedTaskScoreAfter = hasAfterScores ? 
    (taskScoreAfter > 1 ? taskScoreAfter : taskScoreAfter * 100) : null;
  const normalizedPeopleScoreAfter = hasAfterScores ? 
    (peopleScoreAfter > 1 ? peopleScoreAfter : peopleScoreAfter * 100) : null;

  // Determine which quadrant the before score falls into
  const quadrant = {
    name: normalizedPeopleScore >= 50 && normalizedTaskScore >= 50 ? 'Team Leadership' :
          normalizedPeopleScore >= 50 && normalizedTaskScore < 50 ? 'Socialite' :
          normalizedPeopleScore < 50 && normalizedTaskScore >= 50 ? 'Authoritarian' :
          'Impoverished',
    color: normalizedPeopleScore >= 50 && normalizedTaskScore >= 50 ? 'rgba(75, 192, 192, 0.2)' : // green
           normalizedPeopleScore >= 50 && normalizedTaskScore < 50 ? 'rgba(54, 162, 235, 0.2)' : // blue
           normalizedPeopleScore < 50 && normalizedTaskScore >= 50 ? 'rgba(255, 99, 132, 0.2)' : // red
           'rgba(255, 206, 86, 0.2)' // yellow
  };
  
  // Determine which quadrant the after score falls into (if available)
  const afterQuadrant = hasAfterScores ? {
    name: normalizedPeopleScoreAfter >= 50 && normalizedTaskScoreAfter >= 50 ? 'Team Leadership' :
          normalizedPeopleScoreAfter >= 50 && normalizedTaskScoreAfter < 50 ? 'Socialite' :
          normalizedPeopleScoreAfter < 50 && normalizedTaskScoreAfter >= 50 ? 'Authoritarian' :
          'Impoverished'
  } : null;

  // Chart data
  const data = {
    datasets: [
      {
        label: hasAfterScores ? 'Before Score' : 'Score',
        data: [{ x: normalizedTaskScore, y: normalizedPeopleScore }],
        backgroundColor: 'rgba(255, 99, 132, 1)',
        borderColor: 'rgba(255, 99, 132, 1)',
        pointRadius: 8,
        pointHoverRadius: 10,
        datalabels: {
          display: false // Disable data labels on points
        }
      },
      // Add after score dataset if available
      ...(hasAfterScores ? [{
        label: 'After Score',
        data: [{ x: normalizedTaskScoreAfter, y: normalizedPeopleScoreAfter }],
        backgroundColor: 'rgba(54, 162, 235, 1)',
        borderColor: 'rgba(54, 162, 235, 1)',
        pointRadius: 8,
        pointHoverRadius: 10,
        datalabels: {
          display: false // Disable data labels on points
        }
      }] : []),
      // Add ideal score point if provided
      ...(idealScorePoint ? [{
        label: 'Ideal Score',
        data: [{ x: idealScorePoint.x, y: idealScorePoint.y }],
        backgroundColor: '#1e90ff',
        borderColor: '#1e90ff',
        pointRadius: 10,
        pointHoverRadius: 12,
        datalabels: {
          display: true,
          align: 'top',
          anchor: 'end',
          color: '#1e90ff',
          font: { weight: 'bold' },
          formatter: () => 'Ideal'
        }
      }] : [])
    ],
  };

  // Chart options
  const options = {
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        min: 0,
        max: 100,
        title: {
          display: true,
          text: 'Task',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        grid: {
          color: (context) => {
            if (context.tick.value === 50) {
              return 'rgba(0, 0, 0, 0.5)';
            }
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (context) => {
            if (context.tick.value === 50) {
              return 2;
            }
            return 1;
          },
        },
      },
      y: {
        type: 'linear',
        min: 0,
        max: 100,
        title: {
          display: true,
          text: 'People',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
        grid: {
          color: (context) => {
            if (context.tick.value === 50) {
              return 'rgba(0, 0, 0, 0.5)';
            }
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (context) => {
            if (context.tick.value === 50) {
              return 2;
            }
            return 1;
          },
        },
      },
    },
    plugins: {
      // Enable quadrant labels only for this chart
      quadrantLabelsEnabled: showQuadrantLabels,
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `Task: ${context.parsed.x.toFixed(1)}%, People: ${context.parsed.y.toFixed(1)}%`;
          },
        },
      },
      // Disable all datalabels globally
      datalabels: {
        display: false
      },
      annotation: {
        annotations: {
          quadrantLines: {
            type: 'line',
            xMin: 50,
            xMax: 50,
            yMin: 0,
            yMax: 100,
            borderColor: 'rgba(0, 0, 0, 0.5)',
            borderWidth: 2,
            borderDash: [5, 5],
          },
          quadrantLinesHorizontal: {
            type: 'line',
            xMin: 0,
            xMax: 100,
            yMin: 50,
            yMax: 50,
            borderColor: 'rgba(0, 0, 0, 0.5)',
            borderWidth: 2,
            borderDash: [5, 5],
          },
          topLeftQuadrant: {
            type: 'box',
            xMin: 0,
            xMax: 50,
            yMin: 50,
            yMax: 100,
            backgroundColor: 'rgba(54, 162, 235, 0.2)', // Socialite (blue)
            borderWidth: 0,
          },
          topRightQuadrant: {
            type: 'box',
            xMin: 50,
            xMax: 100,
            yMin: 50,
            yMax: 100,
            backgroundColor: 'rgba(75, 192, 192, 0.2)', // Team Leadership (green)
            borderWidth: 0,
          },
          bottomRightQuadrant: {
            type: 'box',
            xMin: 50,
            xMax: 100,
            yMin: 0,
            yMax: 50,
            backgroundColor: 'rgba(255, 99, 132, 0.2)', // Authoritarian (red)
            borderWidth: 0,
          },
          bottomLeftQuadrant: {
            type: 'box',
            xMin: 0,
            xMax: 50,
            yMin: 0,
            yMax: 50,
            backgroundColor: 'rgba(255, 206, 86, 0.2)', // Impoverished (yellow)
            borderWidth: 0,
          },
          // We'll add text labels directly to the chart using afterDraw plugin
        },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border w-full max-w-3xl mx-auto my-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Task vs People Leadership Style</h2>
        <div className="flex items-center gap-2">
          <CopyToClipboard targetRef={chartRef} buttonText="Copy Chart" />
        </div>
      </div>
      <div ref={chartRef}>
        <div className="mt-1 text-center">
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {hasAfterScores ? (
                <>
                  <span className="font-semibold text-red-500">Before:</span> Leadership Quotient: 
                  <span className="font-bold">(task = {normalizedTaskScore.toFixed(1)}%, people = {normalizedPeopleScore.toFixed(1)}%)</span>
                </>
              ) : (
                <>
                  Leadership Quotient: 
                  <span className="font-bold">(task = {normalizedTaskScore.toFixed(1)}%, people = {normalizedPeopleScore.toFixed(1)}%)</span>
                </>
              )}
            </p>
            {hasAfterScores && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-semibold text-blue-500">After:</span> Leadership Quotient: 
                <span className="font-bold">(task = {normalizedTaskScoreAfter.toFixed(1)}%, people = {normalizedPeopleScoreAfter.toFixed(1)}%)</span>
              </p>
            )}
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <div className="w-[220px] h-[180px] sm:w-[300px] sm:h-[220px] md:w-[350px] md:h-[300px] lg:w-[400px] lg:h-[350px] xl:w-[500px] xl:h-[400px] mx-auto">
            <Scatter data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuadrantChart;
