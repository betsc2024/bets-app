import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Radar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,RadialLinearScale,
  PointElement,
  LineElement,
  Filler } from "chart.js";
import { supabase } from '@/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler);

export default function Reports() {

  const [score,setScore] = useState(null);

  //x and y axes values
  const [label,setLabel] = useState(null);
  const [results,setResults] = useState(null);


  const {user} = useAuth();

  const fetch_Self_Data = async () => {
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
           id,
           evaluation_responses (
           id,
           selected_option_id,
           attribute_statement_options (
           weight,
           attribute_statements (
            id,
            attributes (
              id
            )
          )
        )
      )
    `)
    .eq('is_self_evaluator', true)
    .eq('status', 'completed');
  
      if (error) {
        console.error(error);
      } else {
        console.log(data);
        const result = data.map((evaluation) => {

          const weightValues = evaluation.evaluation_responses.flatMap(response =>
            response.attribute_statement_options.weight
          );
        
          // Calculate the average weight for each evaluation
          const avg_weight = weightValues.length > 0 
            ? weightValues.reduce((acc, weight) => acc + weight, 0) / weightValues.length 
            : 0;
        
          const attribute_id = evaluation.evaluation_responses[0]?.attribute_statement_options?.attribute_statements?.attributes.id;
        
          return {
            attribute_id, 
            avg_weight
          };
        });
        setScore(result);
      }
    } catch (err) {
      console.error(err);
      toast.error(err);
    }
  };
  useEffect(() => {
    if (score && score.length > 0) {
      fetch_attributes();
    }
  }, [score]);

  const fetch_attributes = async() =>{
    try{
      const {data ,error} = await supabase
      .from('attributes')
      .select('*');

      if(data){
        let label_temp = [];
        let  res_temp = [];
        data.map((item)=>{
          if(item.id){
            label_temp.push(item.name);
            if(score && score.length >0){
              score.map((score)=>{
                if(item.id === score.attribute_id){
                  res_temp.push(Math.round(score.avg_weight));
                }
                })
            }
          }
        })
        setLabel(label_temp);
        setResults(res_temp);
      }else{
        console.log(error);
        toast.error(error);
      }
    }catch(error){
        console.log(error);
    }
  }

  
  
  useEffect(()=>{
    fetch_Self_Data();
  },[user])
  

  const data = {
    labels: label,
    datasets: [
      {
        label: "Score",
        data: results,
        backgroundColor: "#733e93",
        borderColor: "#733e93",
        borderWidth: 1,
      },
    ],
  };


  const options = {
    indexAxis: 'x',
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    plugins: {
      legend: {
        position: 'top' ,
      },
      title: {
        display: true,
        text: 'Self',
      },
    },
  };

  const radardata = {
    labels: ['Accountability & Ownership', 'Effective Communication & Participation', 'Other Variable 1', 'Other Variable 2', 'Other Variable 3'],
    datasets: [
      {
        label: 'Committed-Self',
        data: [60, 70, 50, 80, 65],
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        pointBackgroundColor: 'rgba(255, 99, 132, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(255, 99, 132, 1)',
      },
      {
        label: 'Committed-Max',
        data: [80, 90, 70, 95, 85],
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(54, 162, 235, 1)',
      },
      {
        label: 'Committed-Total',
        data: [40, 50, 30, 60, 45],
        backgroundColor: 'rgba(255, 206, 86, 0.2)',
        borderColor: 'rgba(255, 206, 86, 1)',
        pointBackgroundColor: 'rgba(255, 206, 86, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(255, 206, 86, 1)',
      },
    ],
  }
  const radaroptions = {
    responsive: true, // Make the chart responsive to the container's size
    plugins: {
      legend: {
        position: 'bottom', // Position the legend at the bottom
      },
      title: {
        display: true,
        text: 'Self', // Set the chart title
        position:'bottom'
      },
    },
    scales: {
      r: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)', // Customize grid line color
        },
        pointLabels: {
          color: 'black', // Customize point label color
          font: {
            size: 12, // Customize font size
          },
        },
      },
    },
  };
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-primary mb-4">Reports</h1>
      <div style={{ width: "600px", margin: "0 auto" }}>
      {data ? <Bar data={data} options={options}  /> : <></>}
      {radardata? <Radar data={radardata} options={radaroptions} className='mt-16'/>:<></>}
      
    </div>
    </div>
  );
}
