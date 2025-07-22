import React, { useEffect } from 'react';
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

// Create a simple plugin to draw quadrant labels
const quadrantLabelPlugin = {
  id: 'quadrantLabels',
  afterDraw: (chart) => {
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
};

// Register ChartJS components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  annotationPlugin,
  quadrantLabelPlugin
);

const QuadrantChart = ({ taskScore, peopleScore, taskScoreAfter, peopleScoreAfter, showAfterBank, onClose }) => {
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
        label: 'Before Score',
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-[90%] max-w-3xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Task vs People Leadership Style</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-[500px]">
          <Scatter data={data} options={options} />
        </div>
        <div className="mt-4 text-center">
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-red-500">Before:</span> Your leadership style is characterized as: 
              <span className="font-bold"> {quadrant.name}</span>
              <span className="block text-xs">
                (Task: {normalizedTaskScore.toFixed(1)}%, People: {normalizedPeopleScore.toFixed(1)}%)
              </span>
            </p>
            
            {hasAfterScores && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-semibold text-blue-500">After:</span> Your leadership style is characterized as: 
                <span className="font-bold"> {afterQuadrant.name}</span>
                <span className="block text-xs">
                  (Task: {normalizedTaskScoreAfter.toFixed(1)}%, People: {normalizedPeopleScoreAfter.toFixed(1)}%)
                </span>
              </p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuadrantChart;
