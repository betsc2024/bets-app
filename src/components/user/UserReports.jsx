import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, RadialLinearScale,
  PointElement,
  LineElement,
  Filler
} from "chart.js";
import { supabase } from '@/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';


import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Label } from "@radix-ui/react-label";

import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from '@/components/ui/select';



ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler);

export default function UserReports() {

  const { user } = useAuth();
  const [selfscore, setSelfScore] = useState(null);
  const [notselfscore, setNotSelfScore] = useState(null);

  //x and y axes values
  const [label, setLabel] = useState(null);
  const [selfresults, setSelfResults] = useState(null);
  const [notselfresults, setnotselfresults] = useState(null);
  const [selectedChart, setSelectedChart] = useState("table");
  const [bardata, setBarData] = useState(null);
  const [score_type,setScore_Type] = useState("self");
  const [radial_label,setRadial_Label] = useState(null);
  const [radial_score,setRadial_Score] = useState(null);
  const [radial_data,setRadial_data] = useState(null);
  const [radial_result,set_Radial_Result] = useState(null);
  const [self_table_data,setSelfTableData] =useState([]);
  const [notself_table_data,setNotSelfTableData] =useState([]);
  const [table_data,setTable_Data] = useState([]);
  const [company,set_copmany_selected] = useState(null);

  const [selectedAttribute,setSelectedAttribute] = useState(null);




  const fetch_Data = async (relationship_type) => {
    try {
      setBarData(null);  // 🔥 Reset chart state before fetching
      setSelfScore(null);
      setNotSelfScore(null);
      setSelectedChart("table");
      let query1 = supabase
        .from('evaluations')
        .select(`
        id,
        evaluator_id,
        relationship_type,
        evaluation_responses (
          id,
          selected_option_id,
          attribute_statement_options (
            weight,
            attribute_statements (
              id,
              statement,
              attributes (
                id,
                name      
              )
            )
          )
        )
      `)
        .eq('status', 'completed')
        .eq("evaluator_id",user?.id)
        .is('relationship_type', null);



      const { data: self_Data, error: self_Error } = await query1;

      if (relationship_type != null) {

        let query2 = supabase
        .from('evaluations')
        .select(`
          id,
          evaluator_id,
          relationship_type,
          evaluation_responses (
            id,
            selected_option_id,
            attribute_statement_options (
              weight,
              attribute_statements (
                id,
                statement,
                attributes (
                  id,
                  name  
                )
              )
            )
          )
        `)
        .eq('status', 'completed')
        .eq('evaluator_id',user?.id);
      
      if (relationship_type !== "total") {
        query2 = query2.eq("relationship_type", relationship_type);
      }

        const { data: not_self_Data, error: not_self_Error } = await query2;


        if (self_Error && not_self_Error) {
          console.error(self_Error);
          console.error(not_self_Error);
        } else {
          // console.log(self_Data);
          // console.log(not_self_Data);
      
          const calculateAverageWeight = (data) => {
            const attributeMap = {};
            
            data.forEach(evaluation => {
                evaluation.evaluation_responses.forEach(response => {
                    const { weight, attribute_statements } = response.attribute_statement_options;
                    const { id, name } = attribute_statements.attributes;
                    
                    if (!attributeMap[id]) {
                        attributeMap[id] = { name, totalWeight: 0, count: 0 };
                    }
                    
                    attributeMap[id].totalWeight += weight;
                    attributeMap[id].count += 1;
                });
            });
            
            return Object.keys(attributeMap).map(id => ({
                attribute_id: id,
                name: attributeMap[id].name,
                avg_weight: attributeMap[id].totalWeight / attributeMap[id].count
            }));
        };
          const result = calculateAverageWeight(self_Data);
          const result2 = calculateAverageWeight(not_self_Data);


          // console.log(result);
          // console.log(result2);
          setSelfScore(result);
          setNotSelfScore(result2);
        }

      } else {
        // console.log(self_Data);
        if (self_Error) {
          console.error(self_Error);
        } else {
          const calculateAverageWeight = (data) => {
            const attributeMap = {};
            
            data.forEach(evaluation => {
                evaluation.evaluation_responses.forEach(response => {
                    const { weight, attribute_statements } = response.attribute_statement_options;
                    const { id, name } = attribute_statements.attributes;
                    
                    if (!attributeMap[id]) {
                        attributeMap[id] = { name, totalWeight: 0, count: 0 };
                    }
                    
                    attributeMap[id].totalWeight += weight;
                    attributeMap[id].count += 1;
                });
            });
            
            return Object.keys(attributeMap).map(id => ({
                attribute_id: id,
                name: attributeMap[id].name,
                avg_weight: attributeMap[id].totalWeight / attributeMap[id].count
            }));
        };
        const result = calculateAverageWeight(self_Data);
          setSelfScore(result);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err);
    }
  };

  useEffect(() => {
    if (selfscore) {
      fetch_attributes("selfscore", selfscore);
      
    }
    if (notselfscore) {
      fetch_attributes("notselfscore", notselfscore);
    }
  }, [selfscore, notselfscore]); 



  const fetch_attributes = async (score_type, score) => {
    try {
      const { data: attribute_Data, error: attribute_Error } = await supabase
        .from('attributes')
        .select('*');
  
      if (attribute_Error) {
        console.log(attribute_Error);
        toast.error(attribute_Error);
        return;
      }
  
      let label_temp = [];
      let res_temp = [];
      let table_data = [];
  
      attribute_Data.forEach((item, index) => {
        if (item.id) {
          const foundScore = score.find(s => s.attribute_id === item.id);
          if (foundScore) {
            label_temp.push(item.name);
            res_temp.push(Math.round(foundScore.avg_weight));
            if(score_type == "selfscore"){
              table_data.push({
                id: index,
                name: item.name,
                avg_weight: foundScore.avg_weight
              });
            }else{
              table_data.push({
                id: index,
                name: item.name,
                avg_reln_weight: foundScore.avg_weight
              });
            }
          } 
        }
      });
  
      setLabel(label_temp);

      if (score_type === "selfscore") {
        setSelfResults(res_temp);
        setScore_Type("self");
        setSelfTableData(table_data);
      } else {
        
        setnotselfresults(res_temp);
        setScore_Type("notself");
        setNotSelfTableData(table_data);
      }
   

    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch attributes");
    }
  };
  const fetch_radar = async (relationship_type) => {
    if(!selectedAttribute) {

      return;
    }
    try {
      let query = supabase
        .from('evaluations')
        .select(`
          relationship_type,
          evaluation_responses (
            attribute_statement_options (
              weight,
              attribute_statements (
                statement,
                attributes(
                name
                )       
              )
            )
          )
        `)
        .eq('status', 'completed') // Only filtering by completed status

      const { data:query_Data, error } = await query;

      const filterByAttributeName = (data, attributeName) => {
        return data
          .map(item => ({
            ...item,
            evaluation_responses: item.evaluation_responses.filter(response => 
              response.attribute_statement_options.attribute_statements.attributes.name === attributeName
            )
          }))
          .filter(item => item.evaluation_responses.length > 0);
      };

      const data = filterByAttributeName(query_Data,selectedAttribute);

      console.log(data);
  
      if (error) {
        throw new Error('Error fetching data: ' + error.message);
      }

  
      const processedData = {};
  
      data.forEach((evaluation) => {
        evaluation.evaluation_responses.forEach((response) => {
          console.log(response);

          const option = response.attribute_statement_options;

          
          if (option && option.attribute_statements) {
            const statement = option.attribute_statements.statement;
            if (!processedData[statement]) {
              processedData[statement] = { totalWeight: 0, count: 0 };
            }
            processedData[statement].totalWeight += option.weight;
            processedData[statement].count += 1;
          }
        });
      });
  
      const result = Object.entries(processedData).map(([statement, { totalWeight, count }]) => ({
        relationship_type,
        statement,
        average_weight: totalWeight / count,
      }));
      
    
      set_Radial_Result(result);
  
  
    } catch (err) {
      console.error(err);
      throw new Error("Failed to fetch radar data: " + err.message);
    }
  };

  useEffect(()=>{

    if(radial_result ){
      console.log("calc");
      console.log(selectedAttribute);
      console.log(radial_result);
    
      setRadial_Label(radial_result.map(item => item.statement)); // Set the statement labels
      setRadial_Score(radial_result);
      console.log(radial_result )
    }
  },[selectedAttribute,radial_result])

  useEffect(()=>{
    fetch_radar("total");
  },[selectedAttribute]);

  useEffect(()=>{

          // Fetch self data and max data

    if(radial_score && radial_label ){

      const result = radial_score;


      
      const maxData = new Array(result.length).fill(100); 
      const selfData = result.map(item => item.average_weight); 
      
      let relationshipData = [];
      relationshipData = result.map(item => item.average_weight); 
      
  
      // Combine self, relationship, and max data
      

const radarData = {
  labels: radial_label,
   datasets: [
    {
      label: 'Self',
      data: selfData,
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      pointBackgroundColor: 'rgba(255, 99, 132, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(255, 99, 132, 1)',
    },
    {
      label: 'Relationship',
      data: relationshipData,
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      pointBackgroundColor: 'rgba(54, 162, 235, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(54, 162, 235, 1)',
    },
    {
      label: 'Max Score (100)',
      data: maxData,
      backgroundColor: 'rgba(255, 206, 86, 0.2)',
      borderColor: 'rgba(255, 206, 86, 1)',
      pointBackgroundColor: 'rgba(255, 206, 86, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(255, 206, 86, 1)',
    },
  ],
};

console.log(radarData);

setRadial_data(radarData); // Set the radar chart data
    }
  },[selectedAttribute,radial_label,radial_score])

  const handleAccordionClick = (relationship_type) => {
    fetch_Data(relationship_type);
    specific_type_bar(relationship_type);
  };

  
  const options = {
    indexAxis: "x", // Ensures vertical bars (horizontal if 'y')
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Report",
      },
    },
  };
  const specific_type_bar = (relationship_type)=>{
    if (label && selfresults) {
      if (score_type === "self") {
        setBarData({
          labels: label,
          datasets: [
            {
              label: "Self Score",
              data: selfresults,
              backgroundColor: "#733e93",
              borderColor: "#733e93",
              borderWidth: 1,
            }
          ],
        });
      } else {
        setBarData({
          labels: label,
          datasets: [
            {
              label: "Self Score",
              data: selfresults,
              backgroundColor: "#733e93",
              borderColor: "#733e93",
              borderWidth: 1,
            },
            ...(notselfresults && notselfresults.length > 0 ? [{
              label: relationship_type,
              data: notselfresults,
              backgroundColor: "#e74c3c",
              borderColor: "#e74c3c",
              borderWidth: 1,
            }] : []),
          ],
        });
      }
    }
  }



  useEffect(() => {
  
    if (self_table_data.length > 0) {
      // Merge self and not-self scores properly
      const mergedScores = self_table_data.map((selfScore) => {
        const relationshipScore = notself_table_data.find(
          (reln) => reln.id === selfScore.id
        );
  
        return {
          ...selfScore,
          avg_reln_weight: relationshipScore ? relationshipScore.avg_reln_weight : 0,
        };
      });
  
      setTable_Data(mergedScores);
    }
  }, [self_table_data, notself_table_data]);
  

  
  const radaroptions = {
    responsive: true, // Make the chart responsive to the container's size
    plugins: {
      legend: {
        position: 'bottom', // Position the legend at the bottom
      },
      title: {
        display: true,
        text: 'Self', // Set the chart title
        position: 'bottom'
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
  const items = [
    {
      title: "Self",
      key: null,
    },
    {
      title: "Top Boss",
      key: "top_boss",
    },
    {
      title: "Peer",
      key: "peer",
    },
    {
        title: "Hr",
        key: "hr",
    },{
      title: "Sub Ordinate",
      key: "subordinate",
     },
     {
      title: "Reporting Boss",
      key: "reporting_boss",
     },
    {
      title: "Total",
      key: "total",
    },
  ];
  const chartOptions = [
    { id: "table", label: "Table" },
    { id: "bar", label: "Bar Chart" },
    { id: "radial", label: "Radial Chart" },
  ];
  // console.log(self_table_data);
  // console.log(notself_table_data);
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-primary mb-4">Reports</h1>
      

      <div style={{ width: "1000px", margin: "0 auto" }}>
        
        <Accordion.Root type="single" collapsible className="w-full  space-y-2">
          {items.map((item, index) => (
            <Accordion.Item key={index} value={`item-${index}`} className="border rounded-md">
              <Accordion.Header className="w-full">
                <Accordion.Trigger
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-3 text-left font-medium",
                    "hover:bg-gray-100 transition-all"
                  )}
                  onClick={() => {handleAccordionClick(item.key) }}

                >
                  {item.title}

                  <ChevronDown className="w-5 h-5 transition-transform data-[state=open]:rotate-180" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                <div className="px-4 py-2 text-gray-700">
                  <RadioGroup.Root
                    value={selectedChart}
                    onValueChange={setSelectedChart}
                    className=""
                  >
                    {chartOptions.map((option) => (
                     
                      option.id === "radial" && item.key!="total" ? <></> :<div
                      key={option.id}
                      className="flex items-center space-x-3 bg-white p-4 rounded-md shadow-sm hover:bg-gray-50 transition"
                      onClick={()=>{
                        console.log("clicking");
                        if(option.id === "bar"){
                          specific_type_bar(item.key);
                        }
                        if(option.id === "radial"){
                          fetch_radar(item.key);
                        }
                      }}
                    >
                      <RadioGroup.Item
                        value={option.id}
                        id={`chart-option-${option.id}`}
                        className="w-0.5 h-10 border border-gray-300 rounded-full flex items-center justify-center data-[state=checked]:bg-primary"
                
                      >
                        <div className="w-1 h-1 bg-white rounded-full" />
                      </RadioGroup.Item>
                      <Label
                        htmlFor={`chart-option-${option.id}`}
                        className="flex-1 text-gray-700 cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div> 
                      
                    ))}
                  </RadioGroup.Root>


                  {selectedChart === "bar" && bardata ? (
                    <Bar data={bardata} options={options} />
                  ) : selectedChart === "radial" && item.key ==="total" ? (
                    <div>
                     <Select
                    value={selectedAttribute}
                    placeholder="Select an attribute"
                    onValueChange={(value) => {setSelectedAttribute(value); console.log(value)} }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an attribute" />
                    </SelectTrigger>
                    <SelectContent>
                      {label.map((attribute, index) => (
                        <SelectItem key={index} value={attribute}>
                          {attribute}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select> 
                 {  radial_data ? <Radar data={radial_data} options={radaroptions} className="mt-16" /> : <></>  }
                    </div>
                  ) : selectedChart === "table" ? (
                    <Table className="border border-gray-300 rounded-lg overflow-hidden shadow-md">
                    {/* Table Header */}
                    <TableHeader className="text-white">
                      <TableRow>
                        <TableHead className="w-12 text-center">Sr. No.</TableHead>
                        <TableHead className="text-left">Attributes</TableHead>
                        <TableHead className="text-center">Avg - Self Score</TableHead>
                        <TableHead className="text-center">% Self Score</TableHead>
                        {item.key !== null && (
                          <>
                            <TableHead className="text-center">Avg - {item.title} Score</TableHead>
                            <TableHead className="text-center">% {item.title} Score</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                  
                    {/* Table Body */}
                    <TableBody>
                      {table_data.length > 0 ? (
                        table_data.map((row, index) => (
                          <TableRow key={row.id} className="border-b hover:bg-gray-100">
                            <TableCell className="text-center">{index + 1}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-center">{row.avg_weight.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              {((row.avg_weight / 100) * 100).toFixed(2)}%
                            </TableCell>
                  
                            {item.key !== null && (
                              <>
                                <TableCell className="text-center">
                                  {row.avg_reln_weight?.toFixed(2) || "0.00"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {((row.avg_reln_weight / 100) * 100).toFixed(2)}%
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                            No data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  ) : null
                  }

                </div>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>

      </div>
    </div>
  );
}
