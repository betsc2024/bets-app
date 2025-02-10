import React, { useEffect, useState, useRef } from 'react';
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
import ChartDataLabels from 'chartjs-plugin-datalabels';



import html2canvas from "html2canvas";

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
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Label } from "@radix-ui/react-label";
import { Button } from '@/components/ui/button';

import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import classNames from 'classnames';




ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler, ChartDataLabels);

export default function Reports() {


  //x and y axes values
  const [data, setData] = useState([]);
  const [label, setLabel] = useState(null);
  const [selfresults, setSelfResults] = useState(null);
  const [notselfresults, setnotselfresults] = useState(null);
  const [selectedChart, setSelectedChart] = useState("table");
  const [bardata, setBarData] = useState(null);
  const [score_type, setScore_Type] = useState(null);

  const [radial_label, setRadial_Label] = useState([]);
  const [radial_score, setRadial_Score] = useState(null);
  const [radial_data, setRadial_data] = useState(null);
  const [radial_result, set_Radial_Result] = useState(null);
  const [radial_self_data, setRadialSelfData] = useState(null);


  const [self_table_data, setSelfTableData] = useState([]);
  const [notself_table_data, setNotSelfTableData] = useState([]);
  const [table_data, setTable_Data] = useState([]);

  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [list_Demographic_atr, setlist_Demographic_atr] = useState([]);
  const [demographicData, setDemographic_data] = useState([]);
  const [demographicTypes, setDemographic_types] = useState([]);
  const [demographicbardata, setdemographicbardata] = useState([]);

  const [selectedAttribute, setSelectedAttribute] = useState('');

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [relation_count_map, setRelationCountMap] = useState([]);
  // const [relation_count_map_o,setRelationCountMap_o] = useState({});


  const chartRef = useRef(null);

  const copyToClipboard = async () => {
    console.log('copyToClipboard');
    if (chartRef.current) {
      console.log("Click");
      const canvas = await html2canvas(chartRef.current);
      canvas.toBlob((blob) => {
        if (blob) {
          const item = new ClipboardItem({ "image/png": blob });
          navigator.clipboard.write([item]).then(() => {
            alert("Chart copied to clipboard!");
          });
        }
      });
    }
  };





  const fetchData = async (selectedCompany, selectedUser) => {
    try {
      setBarData(null);
      setTable_Data([]);



      const id = selectedCompany?.id;
      const user_id = selectedUser?.id;

      // Fetch data without deep filtering
      const { data, error } = await supabase
        .from("evaluations")
        .select(`
          relationship_type,
          evaluation_assignments ( 
            id,
            user_to_evaluate_id,
            company_id,
            companies ( id, name ) 
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
        .eq("status", "completed");

      if (error) throw error;

      // console.log(data);

      // Filter evaluations for the selected company in JS
      const filteredData = data.filter(evaluation =>
        evaluation.evaluation_assignments?.company_id === id &&
        evaluation.evaluation_assignments?.user_to_evaluate_id === user_id
      )
      const relation_count_map_temp = {};

      filteredData.map((item) => {
        const id = item.relationship_type;
        if (!relation_count_map_temp[id]) {
          relation_count_map_temp[id] = 1;
        } else {
          relation_count_map_temp[id] += 1;
        }
      })

      const relationCountArray = Object.entries(relation_count_map_temp).map(([relationship_type, count], index) => ({
        SrNo: index + 1,
        RelationshipType: relationship_type === "null" ? "self" : relationship_type, // Handling null case
        Count: count
      }));


      console.log(relation_count_map_temp);
      setRelationCountMap(relationCountArray);
      console.log(filteredData);


      // console.log(filteredData);
      // Transform data to match expected structure
      const formattedData = filteredData.map(e => {
        const attributeMap = {};

        e.evaluation_responses.forEach(res => {
          const attributeName = res.attribute_statement_options.attribute_statements.attributes.name;
          const weight = res.attribute_statement_options.weight || 0;


          if (!attributeMap[attributeName]) {
            attributeMap[attributeName] = { totalWeight: 0, count: 0 };
          }else{

            attributeMap[attributeName].totalWeight += weight;
            attributeMap[attributeName].count += 1;
  
  
          }



        });



        return Object.entries(attributeMap).map(([attribute_name, { totalWeight, count }]) => ({
          relationship_type: e.relationship_type,
          company_name: e.evaluation_assignments?.companies?.name || "N/A",
          attribute_name,
          average_weight: count > 0 ? totalWeight / count : 0,
          average_score_percentage: (totalWeight / count) / relation_count_map_temp[e.relationship_type],
        }));
      }).flat();

      console.log(formattedData);

      setData(formattedData);

      // console.log(data);


    } catch (err) {
      console.log("Error fetching data:", err);
    } finally {
      // setLoading(false);
    }
  };


  const processDemographicData = () => {
    if (!data || data.length === 0) {
      console.log("No data available");
      return;
    }

    try {
      let attributeMap = {};
      let relationshipTypes = new Set();

      data.forEach((item, index) => {
        const relationshipType = item.relationship_type || "Self"; // Treat null as "Self"
        relationshipTypes.add(relationshipType);

        // Process each item based on the new data structure
        const attributeName = item.attribute_name;
        const weight = item.average_weight || 0; // Use average_weight if available


        if (!attributeMap[attributeName]) {
          attributeMap[attributeName] = {};
        }

        if (!attributeMap[attributeName][relationshipType]) {
          attributeMap[attributeName][relationshipType] = { total: 0, count: 0 };
        }

        attributeMap[attributeName][relationshipType].total += weight;
        attributeMap[attributeName][relationshipType].count += 1;
      });


      const relationshipTypesArray = Array.from(relationshipTypes);

      const processedData = Object.keys(attributeMap).map((attribute, index) => {
        let row = { SrNo: index + 1, Attribute: attribute };

        relationshipTypesArray.forEach((type) => {
          row[type] = attributeMap[attribute][type]
            ? (attributeMap[attribute][type].total / attributeMap[attribute][type].count).toFixed(1)
            : 0;
        });

        row["Total"] = (
          relationshipTypesArray.reduce((sum, type) => sum + parseFloat(row[type] || 0), 0) /
          relationshipTypesArray.length
        ).toFixed(1);

        return row;
      });



      setDemographic_types(relationshipTypesArray);
      setlist_Demographic_atr(Object.keys(attributeMap));
      setDemographic_data(processedData);



    } catch (error) {
      console.log("Error processing demographic data:", error);
    }
  };



  const fetch_companies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select('*');
      if (data) {
        setCompanies(data);
      } else {
        console.log(error);
      }
    } catch (error) {
      console.log(error);
      toast.error(error);
    }
  }
  const fetch_user = async () => {
    if (selectedCompany) {

      console.log(selectedCompany);
      try {
        const { data, error } = await supabase
          .from("users")
          .select('*')
          .eq('company_id', selectedCompany?.id);
        if (data) {
          setUsers(data);

          console.log(data);

        } else {
          console.log(error);
        }
      } catch (error) {
        console.log(error);
        toast.error(error);
      }
    } else {
      console.log("Error in Fetching Company");
    }
  }

  useEffect(() => {
    fetch_companies();
  }, []);

  useEffect(() => {
    fetch_user();
    fetchData(selectedCompany, selectedUser);
    fetch_spefifc_data(score_type);
  }, [selectedCompany, selectedUser])









  const fetch_spefifc_data = (relationship_type) => {
    if (!data) return;
  
    // Separate self and not-self data
    const selfData = data.filter((item) => item.relationship_type === null);
  
    const notSelfData =
      relationship_type === "total"
        ? data.filter((item) => item.relationship_type !== null)
        : data.filter((item) => item.relationship_type === relationship_type);
  
    console.log("Original Self Data:", selfData);
    console.log("Original Not Self Data:", notSelfData);
  
    // Get unique labels
    const labels = [...new Set(data.map((item) => item.attribute_name))];
  
    // Compute averages for self and not-self
    const selfResultsMap = {};
    const notSelfResultsMap = {};
  
    const aggregatedSelfData = labels.map((label) => {
      const selfItems = selfData.filter((item) => item.attribute_name === label);
      const avgSelfWeight = selfItems.length
        ? selfItems.reduce((sum, i) => sum + i.average_weight, 0) / selfItems.length
        : 0;
      const avgSelfScore = selfItems.length
        ? selfItems.reduce((sum, i) => sum + i.average_score_percentage, 0) / selfItems.length
        : 0;
  
      selfResultsMap[label] = avgSelfWeight;
  
      return {
        company_name: selfItems[0]?.company_name || "Unknown",
        attribute_name: label,
        average_weight: avgSelfWeight,
        average_score_percentage: avgSelfScore,
      };
    });
  
    const aggregatedNotSelfData = labels.map((label) => {
      const notSelfItems = notSelfData.filter((item) => item.attribute_name === label);
      const avgNotSelfWeight = notSelfItems.length
        ? notSelfItems.reduce((sum, i) => sum + i.average_weight, 0) / notSelfItems.length
        : 0;
      const avgNotSelfScore = notSelfItems.length
        ? notSelfItems.reduce((sum, i) => sum + i.average_score_percentage, 0) / notSelfItems.length
        : 0;
  
      notSelfResultsMap[label] = avgNotSelfWeight;
  
      return {
        company_name: notSelfItems[0]?.company_name || "Unknown",
        attribute_name: label,
        average_weight: avgNotSelfWeight,
        average_score_percentage: avgNotSelfScore,
      };
    });
  
    // Merge self and not-self aggregated data

  
    // Set data for charts and tables
    setLabel(labels);
    setSelfResults(Object.values(selfResultsMap));
    setnotselfresults(Object.values(notSelfResultsMap));
  
    setSelfTableData(aggregatedSelfData);
    setNotSelfTableData(aggregatedNotSelfData);
  
    console.log("Final Self Data:", aggregatedSelfData);
    console.log("Final Not Self Data:", aggregatedNotSelfData);
    
  };
  





  const fetch_radar = async (relationship_type) => {

    try {

      const id = selectedCompany?.id;
      const user_id = selectedUser?.id;

      let query = supabase
        .from('evaluations')
        .select(`
          relationship_type,
              evaluation_assignments ( 
            id,
            user_to_evaluate_id,
            company_id
            ),
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
        .eq('status', 'completed'); // Only filtering by completed status



      const { data: query_info, error } = await query;

      console.log(query_info);
      console.log(id);
      console.log(user_id);

      const query_Data = query_info.filter(evaluation =>
        evaluation.evaluation_assignments?.company_id === id &&
        evaluation.evaluation_assignments?.user_to_evaluate_id === user_id
      )

      console.log(query_Data);

      if (error) {
        throw new Error('Error fetching data: ' + error.message);
      }

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

      const data = filterByAttributeName(query_Data, selectedAttribute);
      console.log(data);

      const fetch_self_Data = (query_Data) => {
        const filteredData = query_Data.filter(item => item.relationship_type === null);

        const processedData = {};

        filteredData.forEach((evaluation) => {
          evaluation.evaluation_responses.forEach((response) => {
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
          statement,
          average_weight: totalWeight / count,
        }));


        return result;
      }
      const temp_self_Data = fetch_self_Data(data);
      setRadialSelfData(temp_self_Data);

      const processedData = {};

      const filterData = data.filter(item => item.relationship_type !== null);


      filterData.forEach((evaluation) => {
        evaluation.evaluation_responses.forEach((response) => {
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


  useEffect(() => {

    if (radial_result) {
      // console.log("calc");
      // console.log(selectedAttribute);
      // console.log(radial_result);

      setRadial_Label(radial_result.map(item => item.statement)); // Set the statement labels
      setRadial_Score(radial_result);
      // console.log(radial_result)
    }
    if(radial_self_data){
      setRadial_Label(radial_self_data.map(item => item.statement)); // Set the statement labels
    }
  }, [selectedAttribute, radial_result,radial_self_data])

  useEffect(() => {
    fetch_radar("total");
  }, [selectedAttribute]);

  useEffect(() => {

    // Fetch self data and max data

    if (radial_score && radial_label && radial_self_data) {

      const result = radial_score;

      console.log(result);
      console.log(selfresults);

      const maxData = new Array(result.length).fill(100);
      const selfData = radial_self_data.map(item => item.average_weight);

      let relationshipData = [];
      relationshipData = result.map(item => item.average_weight);


      // Combine self, relationship, and max data
      // console.log(selfData);
      // console.log(relationshipData);
      // console.log(maxData);
      // console.log(radial_label);


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
            label: 'Total',
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

      // console.log(radarData);

      setRadial_data(radarData); // Set the radar chart data
    }
  }, [selectedAttribute, radial_label, radial_score, radial_self_data])



  const options = {
    indexAxis: "x", // Ensures vertical bars
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    plugins: {
      legend: {
         position: "bottom",
        align:"end"
      },
      title: {
        display: true,
        text: "Report",
      },
      datalabels: {
        anchor: "end", // Positions label on top of bars
        align: "top",
        offset: 5, // Adds margin above the bar
        font: {
          weight: "bold",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100

        },
      },

      
    },
  };

  const specific_type_bar = (relationship_type) => {
    if (label && selfresults) {
      if (score_type === null) {
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



  const radaroptions = {
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: true,
        text: 'Self',
        position: 'bottom',
      },
    },
    scales: {
      r: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        pointLabels: {
          color: 'black',
          font: {
            size: 12,
          },
          callback: function(label) {
            let words = label.split(" ");
            let formattedLabel = [];
            
            for (let i = 0; i < words.length; i += 3) {
              formattedLabel.push(words.slice(i, i + 3).join(" "));
            }
  
            return formattedLabel; // Returns array for multi-line label
          }
  
        },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
  };
  
  const items = [
    {
      id: 1,
      title: "Self",
      key: null,
    },
    {
      id: 2,
      title: "Top Boss",
      key: "top_boss",
    },
    {
      id: 3,
      title: "Peer",
      key: "peer",
    },
    {
      id: 4,
      title: "Hr",
      key: "hr",
    }, {
      id: 5,
      title: "Sub Ordinate",
      key: "subordinate",
    },
    {
      id: 6,
      title: "Reporting Boss",
      key: "reporting_boss",
    },
    {
      id: 7,
      title: "Total",
      key: "total",
    },
    {
      id: 8,
      title: "Demography",
      key: "demography",
    },
  ];
  const chartOptions = [
    { id: "table", label: "Table" },
    { id: "bar", label: "Bar Chart" },
    { id: "radial", label: "Radial Chart" },
  ];
 
  useEffect(() => {
    console.log(self_table_data);
    console.log(notself_table_data);
  
    if (self_table_data.length > 0) {
      // Merge self and not-self scores properly
      const mergedScores = self_table_data.map((selfScore) => {
        // Find matching relationship-based data using attribute_name & company_name
        const relationshipScore = notself_table_data.find(
          (reln) =>
            reln.attribute_name === selfScore.attribute_name &&
            reln.company_name === selfScore.company_name
        );
  
        return {
          company_name: selfScore.company_name,
          attribute_name: selfScore.attribute_name,
          average_weight: selfScore.average_weight, // Self weight
          average_score_percentage: selfScore.average_score_percentage, // Self percentage
          avg_reln_weight: relationshipScore ? relationshipScore.average_weight : 0, // Relationship weight
          avg_reln_perc: relationshipScore ? relationshipScore.average_score_percentage : 0, // Relationship percentage
        };
      });
  
      console.log(mergedScores);
      setTable_Data(mergedScores);
    }
  }, [self_table_data, notself_table_data]);
  const deleteEvaluationResponses = async (companyId) => {
    try {
      let ans = prompt("Are you sure you want to delete?(Yes/No)");

      if (ans === "yes" || ans === "Yes") {
        const { data: assignments, error: assignmentError } = await supabase
          .from('evaluation_assignments')
          .select(`
            id,
            user_to_evaluate_id
            `)
          .eq('user_to_evaluate_id', selectedUser?.id);

        if (assignmentError) throw assignmentError;
        if (!assignments.length) return console.log('No matching evaluations found.');

        const assignmentIds = assignments.map(a => a.id);

        const { data: evaluations, error: evaluationError } = await supabase
          .from('evaluations')
          .select('id')
          .in('evaluation_assignment_id', assignmentIds);

        if (evaluationError) throw evaluationError;
        if (!evaluations.length) return console.log('No evaluations found.');

        const evaluationIds = Array.isArray(evaluations) ? evaluations.map(e => e.id) : [];

        const { error: deleteError } = await supabase
          .from('evaluation_responses')
          .delete()
          .in('evaluation_id', evaluationIds);

        if (deleteError) throw deleteError;

        const { data: assignmentsToUpdate, error: assignmentUpdateError } = await supabase
          .from('evaluation_assignments')
          .select('id')
          .eq('user_to_evaluate_id', selectedUser?.id);

        if (assignmentUpdateError) throw assignmentUpdateError;

        const assignmentIdsToUpdate = Array.isArray(assignmentsToUpdate) ? assignmentsToUpdate.map(a => a.id) : [];

        if (assignmentIdsToUpdate.length > 0) {
          const { error: updateEvalError } = await supabase
            .from('evaluations')
            .update({ status: 'pending' })
            .in('evaluation_assignment_id', assignmentIdsToUpdate);

          if (updateEvalError) throw updateEvalError;
        } else {
          console.log('No evaluations to update.');
        }
        setRelationCountMap([]);


        console.log('Evaluation responses deleted successfully.');
        toast.message('Data deleted successfully');
        setTable_Data([]);
        setBarData(null);
      }
    } catch (error) {
      toast.error(error);
      console.error('Error deleting evaluation responses:', error.message);
    }
  };
  const Demography_bar_data = (attribute) => {

    let selfresult = [];

    if (demographicData) {
      demographicData.map((item, index) => {
        if (item.Attribute === attribute) {
          for (let key in item) {
            if (key !== "Attribute" && key !== "SrNo") {
              selfresult.push(
                item[key]
              );
            }
          }
        }
      })
    }
    // console.log(selfresult);
    const colors = ["#733e93", "#FF5733", "#33FF57", "#3357FF", "#FF33A1", "#F4A261", "#2A9D8F"];

    setdemographicbardata({
      labels: demographicTypes,
      datasets: [
        {
          label: "Score",
          data: selfresult,
          backgroundColor: selfresult.map((_, index) => colors[index % colors.length]),
          borderColor: selfresult.map((_, index) => colors[index % colors.length]),
          borderWidth: 1,
        },
      ],
    });
  }
  useEffect(() => {
    Demography_bar_data(selectedAttribute);
  }, [selectedAttribute])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-primary mb-4">Reports</h1>
      <div className=' mb-4 flex flex-row justify-items-end items-end '>
        <div className='flex flex-col' >
          <Label className='mb-3'> Select a Company: </Label>
          <Select className='mb-3' value={selectedCompany?.id} onValueChange={(value) => {
            const company = companies.find(c => c.id === value);
            setSelectedCompany(company);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className='mt-3 mb-3'> Select an Employee </Label>
          <Select value={selectedUser?.id} onValueChange={(value) => {
            const user = users.find(c => c.id === value);
            setSelectedUser(user);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a Employee" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedCompany && selectedUser ? <Button
          className="w-48 ml-3 bg-primary hover:bg-red-600 text-primary-foreground font-semibold  }" onClick={() => { deleteEvaluationResponses(selectedCompany?.id) }}             >

          Delete Report
        </Button> : <></>}
      </div>
      {
        selectedCompany && selectedUser ?
          <Table className="border border-gray-300 rounded-lg overflow-hidden shadow-md mt-5 mb-5">
            <TableHeader className="text-white">
              <TableRow>
                <TableHead className="w-12 text-center">Sr. No.</TableHead>
                <TableHead className="text-left">Relationship Type</TableHead>
                <TableHead className="text-center">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relation_count_map.length > 0 ? (
                relation_count_map.map((row, index) => (
                  <TableRow key={`item-${index}`} className="border-b hover:bg-gray-100">
                    <TableCell className="text-center">{row.SrNo}</TableCell>
                    <TableCell className="text-left">{row.RelationshipType}</TableCell>
                    <TableCell className="text-center">{row.Count}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-2">
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table> : <></>
      }

      {(selectedCompany != null && selectedUser != null) ?
        <div style={{ width: "1000px", margin: "0 auto" }}>
          <Accordion.Root type="single" collapsible className="w-full  space-y-2">
            {items.map((item, index) => (
              <Accordion.Item key={item.id} value={item.id} className="border rounded-md">
                <Accordion.Header className="w-full">
                  <Accordion.Trigger
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-3 text-left font-medium",
                      "hover:bg-gray-100 transition-all"
                    )}
                    onClick={() => {

                      fetch_spefifc_data(item.key);
                      specific_type_bar(item.key);
                      setScore_Type(item.key);
                      setSelectedChart(item.key);

                      processDemographicData(data);

                    }}

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

                        option.id === "radial" && item.key != "total" ? <></> : <div
                          key={option.id}
                          className="flex items-center space-x-3 bg-white p-4 rounded-md shadow-sm hover:bg-gray-50 transition"
                          onClick={() => {

                            // console.log("clicking");
                            if (option.id === "bar") {
                              specific_type_bar(item.key);
                            }
                            if (option.id === "radial") {
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
                      item.key === "demography" ?

                        <>
                          <Select
                            value={selectedAttribute}
                            placeholder="Select an attribute"
                            onValueChange={(value) => setSelectedAttribute(value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an attribute" />
                            </SelectTrigger>
                            <SelectContent>
                              {list_Demographic_atr.map((attribute, index) => (
                                <SelectItem key={index} value={attribute}>
                                  {attribute}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {selectedAttribute ?

                            <div>
                              <div ref={chartRef}>
                                <Bar data={demographicbardata} options={options} plugins={[ChartDataLabels]} />
                              </div>
                              <button onClick={copyToClipboard} className="mt-4">
                                Copy Chart to Clipboard
                              </button>
                            </div>

                            : <></>}
                        </>

                        : <div>
                          <div ref={chartRef}>
                            <Bar data={bardata} options={options} plugins={[ChartDataLabels]} />
                          </div>
                          <button onClick={copyToClipboard} className="mt-4">
                            Copy Chart to Clipboard
                          </button>
                        </div>
                    ) : selectedChart === "radial" && radial_score && item.key === "total" ? (
                      <div>
                        <Select
                          value={selectedAttribute}
                          placeholder="Select an attribute"
                          onValueChange={(value) => { setSelectedAttribute(value); }}
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
                        {radial_data ?
                          <div>
                            <div ref={chartRef}>
                              <Radar data={radial_data} options={radaroptions} className="mt-16" />
                            </div>
                            <button onClick={copyToClipboard} className="mt-4">
                              Copy Chart to Clipboard
                            </button>
                          </div>
                          : <></>}
                      </div>
                    ) : selectedChart === "table" ? (
                      item.key === "demography" ? (<>
                        <Table className="border border-gray-300 rounded-lg overflow-hidden shadow-md">
                          <TableHeader className="text-white">
                            <TableRow>
                              <TableHead className="w-12 text-center">Sr. No.</TableHead>
                              <TableHead className="text-left">Attributes</TableHead>

                              {demographicTypes.map((type) => (
                                <TableHead key={type} className="text-center">
                                  {type}
                                </TableHead>
                              ))}

                              <TableHead className="text-center">Total</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {demographicData.length > 0 ? (
                              demographicData.map((row, index) => (
                                <TableRow key={`item-${index}`} className="border-b hover:bg-gray-100">
                                  <TableCell className="text-center">{row.SrNo}</TableCell>
                                  <TableCell>{row.Attribute}</TableCell>

                                  {demographicTypes.map((type) => (
                                    <TableCell key={type} className="text-center">
                                      {Math.round(row[type])}
                                    </TableCell>
                                  ))}

                                  <TableCell className="text-center">{row["Total"]}</TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={demographicTypes.length + 3} className="text-center text-gray-500 py-4">
                                  No data available
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>

                      </>) :
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

                                <TableRow key={index} className="border-b hover:bg-gray-100">
                                  <TableCell className="text-center">{index + 1}</TableCell>
                                  <TableCell>{row.attribute_name}</TableCell>
                                  <TableCell className="text-center">{row.average_weight.toFixed(2)}</TableCell>
                                  <TableCell className="text-center">
                                    {row.average_score_percentage.toFixed(2)}%
                                  </TableCell>

                                  {item.key !== null && (
                                    <>
                                      <TableCell className="text-center">
                                        {row.avg_reln_weight?.toFixed(2) || "0.00"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {(row.avg_reln_perc )}%
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
        : <> Please Select a Company and User</>}

    </div>
  );
}
