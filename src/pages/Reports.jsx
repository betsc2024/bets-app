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
  const [radial_ideal_score,  setRadial_IdealScore] = useState(null);


  const [self_table_data, setSelfTableData] = useState([]);
  const [notself_table_data, setNotSelfTableData] = useState([]);
  const [table_data, setTable_Data] = useState([]);

  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [list_Demographic_atr, setlist_Demographic_atr] = useState([]);
  const [demographicData, setDemographic_data] = useState([]);
  const [demographicTypes, setDemographic_types] = useState([]);
  const [demographicbardata, setdemographicbardata] = useState([]);

  const [total, setTotal] = useState([]);

  const [selectedAttribute, setSelectedAttribute] = useState('');

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [relation_count_map, setRelationCountMap] = useState([]);
  // const [relation_count_map_o,setRelationCountMap_o] = useState({});
  const [analysis , setAnaysis] =  useState("");
  const [analysisTypeList,setAnalysisTypeList]  = useState([]);

  const  [bank , setBank] = useState("");
  const [bankList,setBankList] = useState([]);

  const chartRef = useRef(null);

  const copyToClipboard = async () => {
    try {
      if (!chartRef.current) {
        toast.error("Chart not found");
        return;
      }

      const canvas = await html2canvas(chartRef.current);
      
      // Try using modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.write) {
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const item = new ClipboardItem({ "image/png": blob });
              await navigator.clipboard.write([item]);
              toast.success("Chart copied to clipboard!");
            } catch (err) {
              console.error("Clipboard write failed:", err);
              // Fallback: Offer download if clipboard fails
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'chart.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.info("Chart downloaded as image (clipboard access denied)");
            }
          }
        });
      } else {
        // Fallback for browsers without Clipboard API support
        const url = canvas.toDataURL();
        const img = document.createElement('img');
        img.src = url;
        document.body.appendChild(img);
        const range = document.createRange();
        range.selectNode(img);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        try {
          document.execCommand('copy');
          window.getSelection().removeAllRanges();
          document.body.removeChild(img);
          toast.success("Chart copied to clipboard!");
        } catch (err) {
          console.error("Legacy clipboard copy failed:", err);
          // Offer download as last resort
          const a = document.createElement('a');
          a.href = url;
          a.download = 'chart.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast.info("Chart downloaded as image (clipboard not supported)");
        }
      }
    } catch (error) {
      console.error("Copy to clipboard failed:", error);
      toast.error("Failed to copy chart. Please try again.");
    }
  };


  const fetchData = async (selectedCompany, selectedUser , selectedAnalysis = "",selectedBank = "") => {
    try {
      setBarData(null);
      setTable_Data([]);



      const id = selectedCompany?.id;
      const user_id = selectedUser?.id;

      // Fetch data without deep filtering
      let query  = supabase
        .from("evaluations")
        .select(`
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
        .eq("status", "completed");
        
        let { data, error } = await query;
        if (selectedAnalysis !== "") {
          data = data.filter((item) =>
            item.evaluation_assignments.attribute_banks.analysis_types.name === selectedAnalysis
          );
        }
    
        // **Case 3: Filter by Bank if provided**
          if (selectedBank !== "") {
            data = data.filter((item)=> 
              item.evaluation_assignments.attribute_banks.id === selectedBank
            );
            // console.log(data);
        }
    

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

      setRelationCountMap(relationCountArray);
      setData(filteredData);

      // console.log(filteredData);


      // console.log(filteredData);
      // Transform data to match expected structure
      const formattedData = filteredData.map(e => {
        const attributeMap = {};

        e.evaluation_responses.forEach(res => {
          const attributeName = res.attribute_statement_options.attribute_statements?.attributes?.name;
          const weight = res.attribute_statement_options.weight || 0;
          const analysis_type = res.attribute_statement_options.attribute_statements?.statement_analysis_types?.analysis_types?.name;

          if (!attributeMap[attributeName]) {
            attributeMap[attributeName] = { totalWeight: 0, count: 0, analysis_type: analysis_type };
          }

          attributeMap[attributeName].totalWeight += weight;
          attributeMap[attributeName].count += 1;

        });
        // console.log(attributeMap);



        return Object.entries(attributeMap).map(([attribute_name, { totalWeight, count ,analysis_type}]) => ({
          relationship_type: e.relationship_type,
          company_name: e.evaluation_assignments?.companies?.name || "N/A",
          attribute_name,
          average_weight: count > 0 ? totalWeight / count : 0,
          average_score_percentage: (totalWeight / count) / relation_count_map_temp[e.relationship_type],
          analysis_type : analysis_type
        }));
      }).flat();

      // console.log(formattedData);

      // setData(formattedData);

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
        const relationshipType = item.relationship_type || "self"; // Treat null as "Self"
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
      relationshipTypes.add("Total");

      const relationshipTypesArray = Array.from(relationshipTypes);
      // console.log(attributeMap);
      const processedData = Object.keys(attributeMap).map((attribute, index) => {
        let row = { SrNo: index + 1, Attribute: attribute };

        relationshipTypesArray.forEach((type) => {
          row[type] = attributeMap[attribute][type]
            ? (attributeMap[attribute][type].total / attributeMap[attribute][type].count)
            : 0;
        });
        if (total.length > 0 && total) {
          // console.log(total);
          row["Total"] = (total[index].average_score_percentage);
        }
        // console.log(row);


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

      // console.log(selectedCompany);
      try {
        const { data, error } = await supabase
          .from("users")
          .select('*')
          .eq('company_id', selectedCompany?.id);
        if (data) {
          setUsers(data);


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
  const fetch_analysis = async ()=>{
    try{
      const { data, error } = await supabase.from('analysis_types').select('*');
      
      if (error) throw error;
      
      // Filter out any items with empty or null name
      const validAnalysisTypes = data?.filter(item => 
        item && 
        item.name && 
        typeof item.name === 'string' && 
        item.name.trim() !== ''
      ) || [];
      
      setAnalysisTypeList(validAnalysisTypes);
    } catch(e){
      console.error('Error fetching analysis types:', e);
      toast.error('Failed to fetch analysis types');
    }
  }

  const fetch_bank = async (selectedCompany, selectedAnalysis) => {
    try {
      const { data, error } = await supabase
        .from('attribute_banks')
        .select(`
          *,
          analysis_types (
            name
          )
        `)
        .eq('company_id', selectedCompany?.id);

      if (error) throw error;

      // Filter banks by selected analysis type if one is selected
      const filteredBanks = selectedAnalysis 
        ? data.filter(bank => bank.analysis_types?.name === selectedAnalysis)
        : data;

      setBankList(filteredBanks);
    } catch (err) {
      console.error('Error fetching banks:', err);
      toast.error('Failed to fetch banks');
    }
  }

  useEffect(() => {
    if (selectedCompany) {
      fetch_bank(selectedCompany, analysis);
    }
  }, [selectedCompany, analysis]);

  useEffect(() => {
    if (selectedCompany && selectedUser) {
      fetchData(selectedCompany, selectedUser, analysis, bank);
    }
  }, [selectedCompany, selectedUser, analysis, bank]);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const { data: companiesData, error } = await supabase
          .from('companies')
          .select('*');
        if (error) throw error;
        setCompanies(companiesData);
      } catch (error) {
        console.error('Error fetching companies:', error);
        toast.error('Failed to fetch companies');
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!selectedCompany) return;
      try {
        const { data: usersData, error } = await supabase
          .from('users')
          .select('*')
          .eq('company_id', selectedCompany.id);
        if (error) throw error;
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to fetch users');
      }
    };
    fetchUsers();
  }, [selectedCompany]);

  // Fetch analysis types when component mounts
  useEffect(() => {
    fetch_analysis();
  }, []);

  useEffect(() => {
    // Fetch self data and max data
    if (radial_score && radial_label && radial_self_data) {
      console.log('Radar Chart Data Creation - Input:', {
        radial_score,
        radial_label,
        radial_self_data
      });

      const result = radial_score;
      const maxData = new Array(result.length).fill(100);
      
      console.log('Processing self data...');
      const selfData = radial_self_data.map(item => {
        console.log('Self item:', item);
        return item.average_weight;
      });

      console.log('Processing relationship data...');
      let relationshipData = result.map(item => {
        console.log('Relationship item:', item);
        return item.average_weight;
      });

      console.log('Creating final radar data with:', {
        labels: radial_label,
        selfData,
        relationshipData,
        maxData
      });

      const radarData = {
        labels: radial_label,
        datasets: [
          {
            label: 'Self',
            data: selfData,
            backgroundColor: 'rgba(255, 0, 0, 0.15)',
            borderColor: 'rgba(255, 0, 0, 0.9)',
            borderWidth: 2.5,
            pointBackgroundColor: 'rgba(255, 0, 0, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(255, 0, 0, 1)',
          },
          {
            label: 'Total',
            data: relationshipData,
            backgroundColor: 'rgba(0, 128, 0, 0.15)',
            borderColor: 'rgba(0, 128, 0, 0.9)',
            borderWidth: 2.5,
            pointBackgroundColor: 'rgba(0, 128, 0, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(0, 128, 0, 1)',
          },
          /* Ideal Score - To be implemented later
          {
            label: 'Ideal Score',
            data: radial_label.map(() => radial_ideal_score),
            backgroundColor: 'rgba(0, 0, 255, 0.15)',
            borderColor: 'rgba(0, 0, 255, 0.9)',
            borderWidth: 2.5,
            pointBackgroundColor: 'rgba(0, 0, 255, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(0, 0, 255, 1)',
          },
          */
          {
            label: 'Max Score (100)',
            data: maxData,
            backgroundColor: 'rgba(255, 255, 0, 0.15)',
            borderColor: 'rgba(255, 255, 0, 0.9)',
            borderWidth: 2.5,
            pointBackgroundColor: 'rgba(255, 255, 0, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(255, 255, 0, 1)',
          }
        ],
      };
      
      console.log('Setting final radar data:', radarData);
      setRadial_data(radarData);
    } else {
      console.log('Missing required data for radar chart:', {
        hasRadialScore: !!radial_score,
        hasRadialLabel: !!radial_label,
        hasRadialSelfData: !!radial_self_data,
        radial_score,
        radial_label,
        radial_self_data
      });
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
        align: "end"
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
  const baroptions = {
    indexAxis: "x", // Ensures vertical bars
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    plugins: {
      legend: {
        display:false,
        position: "bottom",
        align: "end"
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
        display: true,
      },
      datalabels: {
        display: true,
        color: "black",
        font: {
          size: 14,
          weight: "bold",
        },
        formatter: (value) => {
          const num = parseFloat(value);
          return !isNaN(num) ? num.toFixed(1) : value;
        },
        anchor: 'center',
        align: 'center',
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function(context) {
            const num = parseFloat(context.raw);
            return `${context.dataset.label}: ${!isNaN(num) ? num.toFixed(1) : context.raw}`;
          }
        }
      }
    },
    scales: {
      r: {
        ticks: {
          display: false,
          stepSize: 20,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        angleLines: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        pointLabels: {
          color: 'black',
          font: {
            size: 12,
            weight: 'bold'
          },
          callback: function (label) {
            let words = label.split(" ");
            let formattedLabel = [];
            
            for (let i = 0; i < words.length; i += 3) {
              formattedLabel.push(words.slice(i, i + 3).join(" "));
            }
            
            return formattedLabel;
          }
        },
        suggestedMin: 0,
        suggestedMax: 100,
        beginAtZero: true
      },
    },
    responsive: true,
    maintainAspectRatio: false
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
    // console.log(self_table_data);
    // console.log(notself_table_data);

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

      // console.log(mergedScores);
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
      // console.log(demographicData);
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
          label:"",
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
  useEffect(()=>{
    processDemographicData();
  },[total]);

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
          <Label className='mt-3 mb-3'> Select an Analysis Type </Label>
          <Select value={analysis} onValueChange={(value) => {
            setAnaysis(value);
            }}>
            <SelectTrigger>
              <SelectValue placeholder="Select an Analysis Type" />
            </SelectTrigger>
            <SelectContent>
              {analysisTypeList?.map((item) => (
                item?.id && item?.name ? (
                  <SelectItem 
                    key={item.id} 
                    value={item.name}
                  >
                    {item.name}
                  </SelectItem>
                ) : null
              ))}
            </SelectContent>
          </Select>
          <Label className='mt-3 mb-3'> Select a Bank </Label>
          <Select value={bank} onValueChange={(value) => {
            setBank(value);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a Bank" />
            </SelectTrigger>
            <SelectContent>
              {bankList?.map((item) => (
                item?.id && item?.name ? (
                  <SelectItem 
                    key={item.id} 
                    value={item.id}
                  >
                    {item.name}
                  </SelectItem>
                ) : null
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
        selectedCompany && selectedUser  ?
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
                      if (item.key === 'demography') {
                        fetch_spefifc_data('total');
                      }
                      processDemographicData();

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
                      {chartOptions.map((option) => {
                        if (option.id === "radial" && item.key !== "total") {
                          return null;
                        }
                        return (
                          <div
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
                        );
                      })}
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
                                <Bar data={demographicbardata} options={baroptions} plugins={[ChartDataLabels]} />
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
                        {console.log('Attempting to render radar section with:', {
                          selectedChart,
                          radial_score,
                          itemKey: item.key
                        })}
                        <Select
                          value={selectedAttribute}
                          placeholder="Select an attribute"
                          onValueChange={(value) => { 
                            console.log('Selected new attribute:', value);
                            setSelectedAttribute(value); 
                          }}
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
                        {console.log('About to check radial_data:', radial_data)}
                        {radial_data ?
                          <div>
                            <div ref={chartRef} style={{ height: '600px', width: '100%', position: 'relative' }}>
                              {console.log('Rendering Radar Chart with data:', {
                                labels: radial_data.labels,
                                datasets: radial_data.datasets.map(d => ({
                                  label: d.label,
                                  data: d.data
                                }))
                              })}
                              <Radar 
                                data={radial_data} 
                                options={radaroptions} 
                                className="mt-16"
                              />
                            </div>
                            <button onClick={copyToClipboard} className="mt-4">
                              Copy Chart to Clipboard
                            </button>
                          </div>
                          : <div>No radar data available</div>}
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
                                      {row[type]}%
                                    </TableCell>
                                  ))}

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
                                        {(row.avg_reln_perc.toFixed(2))}%
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
