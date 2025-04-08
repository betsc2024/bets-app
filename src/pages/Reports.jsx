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
  // Chart data states
  const [data, setData] = useState([]);
  const [labels, setLabels] = useState(null);
  const [selfResults, setSelfResults] = useState(null);
  const [notSelfResults, setNotSelfResults] = useState(null);
  const [selectedChart, setSelectedChart] = useState("table");
  const [barData, setBarData] = useState(null);
  const [scoreType, setScoreType] = useState(null);

  // Radar chart states
  const [radialLabels, setRadialLabels] = useState([]);
  const [radialScore, setRadialScore] = useState(null);
  const [radialData, setRadialData] = useState(null);
  const [radialResult, setRadialResult] = useState(null);
  const [radialSelfData, setRadialSelfData] = useState(null);
  const [radialIdealScore, setRadialIdealScore] = useState(null);

  // Table data states
  const [selfTableData, setSelfTableData] = useState([]);
  const [notSelfTableData, setNotSelfTableData] = useState([]);
  const [tableData, setTableData] = useState([]);

  // Company and user states
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Demographic data states
  const [demographicAttributes, setDemographicAttributes] = useState([]);
  const [demographicData, setDemographicData] = useState([]);
  const [demographicTypes, setDemographicTypes] = useState([]);
  const [demographicBarData, setDemographicBarData] = useState([]);
  const [selectedAttribute, setSelectedAttribute] = useState('');

  // Analysis and bank states
  const [analysis, setAnalysis] = useState("");
  const [analysisTypeList, setAnalysisTypeList] = useState([]);
  const [bank, setBank] = useState("");
  const [bankList, setBankList] = useState([]);

  // Relationship data
  const [relationCountMap, setRelationCountMap] = useState([]);
  const [total, setTotal] = useState([]);

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
      setTableData([]);



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
        console.log("All top_boss evaluations:", data.filter(e => e.relationship_type === 'top_boss'));
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
      console.log("Filtered top_boss evaluations:", filteredData.filter(e => e.relationship_type === 'top_boss'));
      console.log("Current company_id:", id);
      console.log("Current user_id:", user_id);
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

      console.log("Final formatted data:", formattedData.filter(d => d.relationship_type === 'top_boss'));

      // console.log(formattedData);
      setData(formattedData);

      // console.log(data);


    } catch (err) {
      console.log("Error fetching data:", err);
    } finally {
      // setLoading(false);
    }
  };


  const fetch_specific_data = async (type) => {
    try {
      if (!selectedCompany || !selectedUser || !data) return;

      console.log("Using existing data:", data);

      // Process self evaluations from existing data
      const selfEvals = data.filter(e => e.relationship_type === "self" || e.relationship_type === null);
      const selfData = selfEvals.map(e => ({
        attributeName: e.attribute_name,
        averageWeight: e.average_weight,
        scorePercentage: e.average_score_percentage
      }));
      setSelfTableData(selfData);

      console.log("Self data:", selfData);

      // Initialize relationshipData outside the if block
      let relationshipData = [];

      // Process relationship evaluations if not self
      if (type !== 'self') {
        const relationshipEvals = data.filter(e => e.relationship_type === type);
        relationshipData = relationshipEvals.map(e => ({
          attributeName: e.attribute_name,
          averageWeight: e.average_weight,
          scorePercentage: e.average_score_percentage
        }));
        console.log("Relationship data:", relationshipData);
        setNotSelfTableData(relationshipData);
      }

      // Update visualization data
      const labels = [...new Set(data.map(item => item.attribute_name))];
      console.log("Labels:", labels);
      
      const selfResults = labels.map(label => {
        const item = selfData.find(d => d.attributeName === label);
        return item ? item.scorePercentage : 0;
      });
      
      setLabels(labels);
      setSelfResults(selfResults);

      if (type !== 'self') {
        const notSelfResults = labels.map(label => {
          const item = relationshipData.find(d => d.attributeName === label);
          return item ? item.scorePercentage : 0;
        });
        console.log("Not self results:", notSelfResults);
        setNotSelfResults(notSelfResults);
      }

    } catch (error) {
      console.error("Error in fetch_specific_data:", error);
      toast.error("Error processing evaluation data");
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



      setDemographicTypes(relationshipTypesArray);
      setDemographicAttributes(Object.keys(attributeMap));
      setDemographicData(processedData);



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
    if (radialScore && radialLabels && radialSelfData) {
      console.log('Radar Chart Data Creation - Input:', {
        radialScore,
        radialLabels,
        radialSelfData
      });

      const result = radialScore;
      const maxData = new Array(result.length).fill(100);
      
      console.log('Processing self data...');
      const selfData = radialSelfData.map(item => {
        console.log('Self item:', item);
        return item.average_weight;
      });

      console.log('Processing relationship data...');
      let relationshipData = result.map(item => {
        console.log('Relationship item:', item);
        return item.average_weight;
      });

      console.log('Creating final radar data with:', {
        labels: radialLabels,
        selfData,
        relationshipData,
        maxData
      });

      const radarData = {
        labels: radialLabels,
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
            data: radialLabels.map(() => radialIdealScore),
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
      setRadialData(radarData);
    } else {
      console.log('Missing required data for radar chart:', {
        hasRadialScore: !!radialScore,
        hasRadialLabel: !!radialLabels,
        hasRadialSelfData: !!radialSelfData,
        radialScore,
        radialLabels,
        radialSelfData
      });
    }
  }, [selectedAttribute, radialLabels, radialScore, radialSelfData])
  const chartOptions = {
    indexAxis: "x",
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    plugins: {
      legend: {
        position: "bottom",
      },
      title: {
        display: true,
        text: "Evaluation Results",
      },
      datalabels: {
        display: true,
        color: "black",
        font: {
          weight: "bold",
          size: 11
        },
        anchor: 'end',
        align: 'top',
        offset: 4,
        formatter: (value) => value.toFixed(2)
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: (context) => {
          const values = context.chart.data.datasets.flatMap(d => d.data);
          const maxValue = Math.max(...values);
          return Math.ceil(maxValue / 5) * 5; // Round up to nearest 5
        },
        ticks: {
          stepSize: 5,
          callback: function(value, index, values) {
            // Include all multiples of 5 and the actual data values
            const dataValues = this.chart.data.datasets.flatMap(d => d.data);
            const uniqueValues = [...new Set(dataValues)].sort((a, b) => a - b);
            return value % 5 === 0 || uniqueValues.includes(value) ? value : '';
          }
        }
      },
    },
  };

  const radarOptions = {
    plugins: {
      legend: {
        position: "bottom",
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        beginAtZero: true,
        ticks: {
          stepSize: 20,
        },
      },
    },
  };

  const fetchSpecificData = async (type) => {
    try {
      if (!selectedCompany || !selectedUser || !data) return;

      console.log("Using existing data:", data);

      // Process self evaluations from existing data
      const selfEvals = data.filter(e => e.relationship_type === "self" || e.relationship_type === null);
      const selfData = selfEvals.map(e => ({
        attributeName: e.attribute_name,
        averageWeight: e.average_weight,
        scorePercentage: e.average_score_percentage
      }));
      setSelfTableData(selfData);

      console.log("Self data:", selfData);

      // Initialize relationshipData outside the if block
      let relationshipData = [];

      // Process relationship evaluations if not self
      if (type !== 'self') {
        const relationshipEvals = data.filter(e => e.relationship_type === type);
        relationshipData = relationshipEvals.map(e => ({
          attributeName: e.attribute_name,
          averageWeight: e.average_weight,
          scorePercentage: e.average_score_percentage
        }));
        console.log("Relationship data:", relationshipData);
        setNotSelfTableData(relationshipData);
      }

      // Update visualization data
      const labels = [...new Set(data.map(item => item.attribute_name))];
      console.log("Labels:", labels);
      
      const selfResults = labels.map(label => {
        const item = selfData.find(d => d.attributeName === label);
        return item ? item.scorePercentage : 0;
      });
      
      setLabels(labels);
      setSelfResults(selfResults);

      if (type !== 'self') {
        const notSelfResults = labels.map(label => {
          const item = relationshipData.find(d => d.attributeName === label);
          return item ? item.scorePercentage : 0;
        });
        console.log("Not self results:", notSelfResults);
        setNotSelfResults(notSelfResults);
      }

    } catch (error) {
      console.error("Error in fetchSpecificData:", error);
      toast.error("Error processing evaluation data");
    }
  };

  const updateChartData = (type) => {
    if (labels && selfResults) {
      console.log("Updating chart with:", { labels, selfResults, notSelfResults, type });
      
      const datasets = [
        {
          label: "Self Score",
          data: selfResults,
          backgroundColor: "#733e93",
          borderColor: "#733e93",
          borderWidth: 1,
        }
      ];

      if (scoreType !== null && notSelfResults?.length > 0) {
        datasets.push({
          label: type,
          data: notSelfResults,
          backgroundColor: "#e74c3c",
          borderColor: "#e74c3c",
          borderWidth: 1,
        });
      }

      setBarData({
        labels,
        datasets
      });
    }
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
  const chartOptionsList = [
    { id: "table", label: "Table" },
    { id: "bar", label: "Bar Chart" },
    { id: "radial", label: "Radial Chart" },
  ];

  useEffect(() => {
    // console.log(selfTableData);
    // console.log(notSelfTableData);

    if (selfTableData.length > 0) {
      // Merge self and not-self scores properly
      const mergedScores = selfTableData.map((selfScore) => {
        // Find matching relationship-based data using attribute_name & company_name
        const relationshipScore = notSelfTableData.find(
          (reln) =>
            reln.attributeName === selfScore.attributeName &&
            reln.companyName === selfScore.companyName
        );

        return {
          companyName: selfScore.companyName,
          attributeName: selfScore.attributeName,
          averageWeight: selfScore.averageWeight, // Self weight
          scorePercentage: selfScore.scorePercentage, // Self percentage
          avgRelnWeight: relationshipScore ? relationshipScore.averageWeight : 0, // Relationship weight
          avgRelnPerc: relationshipScore ? relationshipScore.scorePercentage : 0, // Relationship percentage
        };
      });

      // console.log(mergedScores);
      setTableData(mergedScores);
    }
  }, [selfTableData, notSelfTableData]);

  const handleAnalysisChange = (value) => {
    setAnalysis(value);
    if (selectedCompany && selectedUser) {
      fetchData(selectedCompany, selectedUser, value, bank);
    }
  };

  const handleRelationshipTypeSelect = (type) => {
    console.log("Selected relationship type:", type);
    console.log("Current data state:", data);
    
    fetchSpecificData(type);
    updateChartData(type);
    setScoreType(type);
    setSelectedChart("bar");
    
    if (type === 'demography') {
      fetchSpecificData('total');
      processDemographicData();
    }
  };

  const processRelationshipData = (type) => {
    if (!data || data.length === 0) return;

    const relationshipData = data.filter(item => 
      type === 'total' ? true : item.relationship_type === type
    );

    const processedData = relationshipData.map(e => ({
      attributeName: e.attribute_name,
      averageWeight: e.average_weight,
      scorePercentage: e.average_score_percentage
    }));
    
    if (type === 'total') {
      setTotal(processedData);
    } else {
      setDemographicData(processedData);
    }

    updateChartData(type);
  };

  useEffect(() => {
    if (selectedCompany && selectedUser && analysis) {
      fetchData(selectedCompany, selectedUser, analysis, bank);
    }
  }, [selectedCompany, selectedUser, analysis, bank]);

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

    setDemographicBarData({
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

  const isSelectionsValid = () => {
    return (
      selectedCompany !== null &&
      selectedUser !== null &&
      analysis !== "" &&
      bank !== ""
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-primary mb-4">Reports</h1>
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <Select value={selectedCompany?.id} onValueChange={(value) => {
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
          <Select value={analysis} onValueChange={handleAnalysisChange}>
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
      </div>

      {!isSelectionsValid() ? (
        <div className="text-center text-gray-500 mt-8">
          Please select Company, User, Analysis Type and Bank to view the data.
        </div>
      ) : (
        <div className="space-y-6" ref={chartRef}>
          {selectedCompany && selectedUser  ?
            <Table className="border border-gray-300 rounded-lg overflow-hidden shadow-md mt-5 mb-5">
              <TableHeader className="text-white">
                <TableRow>
                  <TableHead className="w-12 text-center">Sr. No.</TableHead>
                  <TableHead className="text-left">Relationship Type</TableHead>
                  <TableHead className="text-center">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relationCountMap.length > 0 ? (
                  relationCountMap.map((row, index) => (
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
                          handleRelationshipTypeSelect(item.key);
                        }}

                      >
                        {item.title}

                        <ChevronDown className="w-5 h-5 transition-transform data-[state=open]:rotate-180" />
                      </Accordion.Trigger>
                    </Accordion.Header>
                    <Accordion.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                      <div className="px-4 py-2 text-gray-700">
                        {isSelectionsValid() && (
                          <RadioGroup.Root
                            value={selectedChart}
                            onValueChange={setSelectedChart}
                            className=""
                          >
                            {chartOptionsList.map((option) => {
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
                                      updateChartData(item.key);
                                    }
                                    if (option.id === "radial") {
                                      // fetch_radar(item.key);
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
                        )}
                        {selectedChart === "bar" && barData ? (
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
                                  {demographicAttributes.map((attribute, index) => (
                                    <SelectItem key={index} value={attribute}>
                                      {attribute}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {selectedAttribute ?

                                <div>
                                  <div ref={chartRef}>
                                    <Bar data={demographicBarData} options={chartOptions} plugins={[ChartDataLabels]} />
                                  </div>
                                  <button onClick={copyToClipboard} className="mt-4">
                                    Copy Chart to Clipboard
                                  </button>
                                </div>

                                : <></>}
                            </>

                            : <div>
                              <div ref={chartRef}>
                                <Bar data={barData} options={chartOptions} plugins={[ChartDataLabels]} />
                              </div>
                              <button onClick={copyToClipboard} className="mt-4">
                                Copy Chart to Clipboard
                              </button>
                            </div>
                        ) : selectedChart === "radial" && radialScore && item.key === "total" ? (
                          <div>
                            {console.log('Attempting to render radar section with:', {
                              selectedChart,
                              radialScore,
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
                                {labels.map((attribute, index) => (
                                  <SelectItem key={index} value={attribute}>
                                    {attribute}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {console.log('About to check radial_data:', radialData)}
                            {radialData ?
                              <div>
                                <div ref={chartRef} style={{ height: '600px', width: '100%', position: 'relative' }}>
                                  {console.log('Rendering Radar Chart with data:', {
                                    labels: radialData.labels,
                                    datasets: radialData.datasets.map(d => ({
                                      label: d.label,
                                      data: d.data
                                    }))
                                  })}
                                  <Radar 
                                    data={radialData} 
                                    options={radarOptions} 
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
                                {tableData.length > 0 ? (
                                  tableData.map((row, index) => (

                                    <TableRow key={index} className="border-b hover:bg-gray-100">
                                      <TableCell className="text-center">{index + 1}</TableCell>
                                      <TableCell>{row.attributeName}</TableCell>
                                      <TableCell className="text-center">{row.averageWeight.toFixed(2)}</TableCell>
                                      <TableCell className="text-center">
                                        {row.scorePercentage.toFixed(2)}%
                                      </TableCell>

                                      {item.key !== null && (
                                        <>
                                          <TableCell className="text-center">
                                            {row.avgRelnWeight?.toFixed(2) || "0.00"}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            {(row.avgRelnPerc.toFixed(2))}%
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
      )}
    </div>
  );
}
