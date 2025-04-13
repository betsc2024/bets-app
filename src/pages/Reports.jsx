import React, { useEffect, useState, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  PointElement,
  LineElement,
  Filler
} from "chart.js";
import { supabase } from '@/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import RadarChartTotal from '@/components/RadarChartTotal';
import SelfEvaluation from '@/components/evaluations/SelfEvaluation';

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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler, ChartDataLabels);

export default function Reports() {
  // Chart data states
  const [data, setData] = useState([]);
  const [labels, setLabels] = useState(null);
  const [selfResults, setSelfResults] = useState(null);
  const [notSelfResults, setNotSelfResults] = useState(null);
  const [selectedChart, setSelectedChart] = useState("table");
  const [barData, setBarData] = useState(null);
  const [scoreType, setScoreType] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState(null);

  // Table data states
  const [selfTableData, setSelfTableData] = useState([]);
  const [notSelfTableData, setNotSelfTableData] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [relationCountMap, setRelationCountMap] = useState([]);
  const [total, setTotal] = useState([]);

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

  // Analysis and bank states
  const [analysis, setAnalysis] = useState("");
  const [analysisTypeList, setAnalysisTypeList] = useState([]);
  const [bank, setBank] = useState("");
  const [bankList, setBankList] = useState([]);

  const barChartRef = useRef(null);

  const copyToClipboard = async () => {
    try {
      if (!barChartRef.current) {
        toast.error("Chart not found");
        return;
      }

      const canvas = await html2canvas(barChartRef.current);
      
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

      console.log("Fetching data for:", { company: id, user: user_id, analysis: selectedAnalysis, bank: selectedBank });

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
        }
    

      if (error) throw error;

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
        return Object.entries(attributeMap).map(([attribute_name, { totalWeight, count ,analysis_type}]) => ({
          relationship_type: e.relationship_type,
          company_name: e.evaluation_assignments?.companies?.name || "N/A",
          attribute_name,
          average_weight: count > 0 ? totalWeight / count : 0,
          average_score_percentage: (totalWeight / count) / relation_count_map_temp[e.relationship_type],
          analysis_type : analysis_type
        }));
      }).flat();

      setData(formattedData);

    } catch (err) {
      console.log("Error fetching data:", err);
    } finally {
      // setLoading(false);
    }
  };


  const fetchSpecificData = async (type) => {
    try {
      if (!selectedCompany || !selectedUser || !data) return;

      const labels = [...new Set(data.map(item => item.attribute_name))];
      setLabels(labels);

      // Process self evaluations
      const selfEvals = data.filter(e => e.relationship_type === "self" || e.relationship_type === null);
      
      // Group by attribute and statements
      const attributeMap = {};
      selfEvals.forEach(evaluation => {
        const attributeName = evaluation.attribute_name;
        if (!attributeMap[attributeName]) {
          attributeMap[attributeName] = {
            statements: []
          };
        }
        // For self evaluations, each statement has one weight
        attributeMap[attributeName].statements.push({
          weight: evaluation.average_weight || 0
        });
      });

      // Calculate scores using our verified formula
      const selfData = Object.entries(attributeMap).map(([attributeName, attribute]) => {
        // 1. Statement Level Calculations
        const statementScores = attribute.statements.map(stmt => {
          const rawScore = stmt.weight;
          const maxPossible = 100;  // For self, always 1 evaluator × 100
          const percentage = (rawScore / maxPossible) * 100;
          return { rawScore, percentage };
        });

        // 2. Attribute Level Calculations
        const averageWeight = statementScores
          .reduce((sum, stmt) => sum + stmt.rawScore, 0) / statementScores.length;
          
        const scorePercentage = statementScores
          .reduce((sum, stmt) => sum + stmt.percentage, 0) / statementScores.length;

        return {
          attributeName,
          averageWeight,
          scorePercentage
        };
      });

      // For self accordion, we only need self data
      if (type === 'self') {
        const selfTableRows = selfData.map((row, index) => ({
          SrNo: index + 1,
          attributeName: row.attributeName,
          averageWeight: row.averageWeight || 0,
          scorePercentage: row.scorePercentage || 0
        }));
        setTableData(selfTableRows);
        return;
      }

      // For total, combine all non-self evaluations
      if (type === 'total') {
        const nonSelfEvals = data.filter(e => e.relationship_type !== 'self' && e.relationship_type !== null);
        const totalData = labels.map(label => {
          const items = nonSelfEvals.filter(e => e.attribute_name === label);
          const avgWeight = items.length > 0 
            ? items.reduce((sum, item) => sum + (item.average_weight || 0), 0) / items.length 
            : 0;
          const avgPercentage = items.length > 0
            ? items.reduce((sum, item) => sum + (item.average_score_percentage || 0), 0) / items.length
            : 0;
          
          const selfItem = selfData.find(d => d.attributeName === label) || {
            averageWeight: 0,
            scorePercentage: 0
          };
          
          return {
            SrNo: labels.indexOf(label) + 1,
            attributeName: label,
            selfAverageWeight: selfItem.averageWeight || 0,
            selfScorePercentage: selfItem.scorePercentage || 0,
            relationshipAverageWeight: avgWeight,
            relationshipScorePercentage: avgPercentage
          };
        });
        setTableData(totalData);
        
        // Update chart data for total
        const totalResults = totalData.map(item => item.relationshipScorePercentage || 0);
        setNotSelfResults(totalResults);
        return;
      }

      const relationshipEvals = data.filter(e => e.relationship_type === type);
      const relationshipData = relationshipEvals.map(e => ({
        attributeName: e.attribute_name,
        averageWeight: e.average_weight || 0,
        scorePercentage: e.average_score_percentage || 0
      }));
      
      // For all relationship types, show both self and relationship data
      const mergedData = labels.map((label, index) => {
        const selfItem = selfData.find(d => d.attributeName === label) || {
          averageWeight: 0,
          scorePercentage: 0
        };
        const relationshipItem = relationshipData.find(d => d.attributeName === label) || {
          averageWeight: 0,
          scorePercentage: 0
        };
        
        return {
          SrNo: index + 1,
          attributeName: label,
          selfAverageWeight: selfItem.averageWeight || 0,
          selfScorePercentage: selfItem.scorePercentage || 0,
          relationshipAverageWeight: relationshipItem.averageWeight || 0,
          relationshipScorePercentage: relationshipItem.scorePercentage || 0
        };
      });
      setTableData(mergedData);

      // Update chart data
      const selfResults = labels.map(label => {
        const item = selfData.find(d => d.attributeName === label);
        return item ? (item.scorePercentage || 0) : 0;
      });
      setSelfResults(selfResults);

      if (type !== 'self') {
        const notSelfResults = labels.map(label => {
          const item = relationshipData.find(d => d.attributeName === label);
          return item ? (item.scorePercentage || 0) : 0;
        });
        setNotSelfResults(notSelfResults);
      }
    } catch (error) {
      console.error("Error in fetchSpecificData:", error);
      toast.error("Error processing evaluation data");
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

  const handleCopyChart = async (ref) => {
    try {
      if (!ref.current) {
        toast.error('Chart not available');
        return;
      }

      // For Bar chart, we need to get the canvas from the chart instance
      const canvas = ref.current.firstChild;
      if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        toast.error('Chart canvas not found');
        return;
      }

      const imageData = canvas.toDataURL('image/png');
      
      // Create a temporary canvas to add white background
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      
      // Fill white background
      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw the chart on top
      const image = new Image();
      image.src = imageData;
      await new Promise(resolve => {
        image.onload = () => {
          tempCtx.drawImage(image, 0, 0);
          resolve();
        };
      });

      // Convert to blob and copy
      const blob = await new Promise(resolve => 
        tempCanvas.toBlob(resolve, 'image/png')
      );
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);
      
      toast.success('Chart copied to clipboard');
    } catch (err) {
      console.error('Error copying chart:', err);
      toast.error('Failed to copy chart');
    }
  };

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
    if (data && data.length > 0 && selectedCompany && selectedUser && analysis && bank) {
      fetchSpecificData('self');  // Process self data when filters change
    }
  }, [data, selectedCompany, selectedUser, analysis, bank]);

  const updateChartData = (type) => {
    if (labels) {  
      const chartData = {
        labels: labels,
        datasets: [
          {
            label: "Self",
            data: selfResults,
            backgroundColor: "#3498db"
          }
        ]
      };

      if (type !== 'self') {
        chartData.datasets.push({
          label: type === 'total' ? "Total" : type,
          data: notSelfResults,
          backgroundColor: "#e74c3c"
        });
      }

      setBarData(chartData);
    }
  };

  const handleAnalysisChange = (value) => {
    setAnalysis(value);
    if (selectedCompany && selectedUser) {
      fetchData(selectedCompany, selectedUser, value, bank);
    }
  };

  const handleRelationshipTypeSelect = (type) => {
    fetchSpecificData(type);
    updateChartData(type);
    setScoreType(type);
    setSelectedChart("bar");
    
    if (type === 'demography') {
      fetchSpecificData('self');
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
      averageWeight: e.average_weight || 0,
      scorePercentage: e.average_score_percentage || 0
    }));
    
    if (type === 'total') {
      setTotal(processedData);
    } else {
      setDemographicData(processedData);
    }

    updateChartData(type);
  };

  useEffect(() => {
    // If we have relationship data but no self data, create table from relationship data
    if (notSelfTableData.length > 0) {
      if (selfTableData.length === 0) {
        // Create table data directly from relationship data
        const tableRows = notSelfTableData.map(relationshipScore => ({
          attributeName: relationshipScore.attributeName,
          averageWeight: 0, // No self weight
          scorePercentage: 0, // No self percentage
          avgRelnWeight: relationshipScore.averageWeight || 0,
          avgRelnPerc: relationshipScore.scorePercentage || 0
        }));
        setTableData(tableRows);
      } else {
        // Original merging logic when both self and relationship data exist
        const mergedScores = selfTableData.map((selfScore) => {
          const relationshipScore = notSelfTableData.find(
            (reln) => reln.attributeName === selfScore.attributeName
          );

          return {
            attributeName: selfScore.attributeName,
            averageWeight: selfScore.averageWeight || 0,
            scorePercentage: selfScore.scorePercentage || 0,
            avgRelnWeight: relationshipScore ? relationshipScore.averageWeight || 0 : 0,
            avgRelnPerc: relationshipScore ? relationshipScore.scorePercentage || 0 : 0
          };
        });
        setTableData(mergedScores);
      }
    } else if (selfTableData.length > 0) {
      // Only self data exists
      const tableRows = selfTableData.map(selfScore => ({
        attributeName: selfScore.attributeName,
        averageWeight: selfScore.averageWeight || 0,
        scorePercentage: selfScore.scorePercentage || 0,
        avgRelnWeight: 0,
        avgRelnPerc: 0
      }));
      setTableData(tableRows);
    }
  }, [selfTableData, notSelfTableData]);

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
    { id: "radar", label: "Radar Chart" }
  ];

  useEffect(() => {
    if (selectedCompany && selectedUser && analysis) {
      fetchData(selectedCompany, selectedUser, analysis, bank);
    }
  }, [selectedCompany, selectedUser, analysis, bank]);

  useEffect(() => {
    if (data && data.length > 0 && selectedCompany && selectedUser && analysis && bank) {
      processRelationshipData('self');  // Process self data when filters change
    }
  }, [data, selectedCompany, selectedUser, analysis, bank]);

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

  const processDemographicData = () => {
    if (!data || data.length === 0) {
      return;
    }

    try {
      let attributeMap = {};
      let relationshipTypes = new Set();

      data.forEach((item) => {
        const relationshipType = item.relationship_type || "self"; // Treat null as "Self"
        relationshipTypes.add(relationshipType);

        // Process each item based on the new data structure
        const attributeName = item.attribute_name;
        const weight = item.average_weight || 0;

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
      const processedData = Object.keys(attributeMap).map((attribute, index) => {
        let row = { SrNo: index + 1, Attribute: attribute };

        relationshipTypesArray.forEach((type) => {
          row[type] = attributeMap[attribute][type]
            ? (attributeMap[attribute][type].total / attributeMap[attribute][type].count)
            : 0;
        });
        if (total.length > 0 && total) {
          row["Total"] = (total[index].average_score_percentage || 0);
        }

        return row;
      });

      setDemographicTypes(relationshipTypesArray);
      setDemographicAttributes(Object.keys(attributeMap));
      setDemographicData(processedData);

    } catch (error) {
      console.error("Error processing demographic data:", error);
      toast.error("Failed to process demographic data");
    }
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
        <div className="space-y-6" ref={barChartRef}>
          {data && data.length > 0 && (
            <>
              {console.log('Reports data before SelfEvaluation:', data)}
              {console.log('Reports data relationship types:', data?.map(d => d.relationship_type))}
              <SelfEvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
            </>
          )}
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
                            className="grid grid-cols-3 gap-4"
                          >
                            {chartOptionsList.map((option) => {
                              // Only show radar option for total accordion
                              if (option.id === "radar" && item.key !== "total") {
                                return null;
                              }
                              return (
                                <div
                                  key={option.id}
                                  onClick={() => {
                                    setSelectedChart(option.id);
                                    if (option.id === "bar") {
                                      updateChartData(item.key);
                                    }
                                    if (option.id === "radar") {
                                      setBarData(null);
                                    }
                                  }}
                                >
                                  <RadioGroup.Item
                                    value={option.id}
                                    id={`${item.key}-${option.id}`}
                                    className="peer sr-only"
                                  />
                                  <Label
                                    htmlFor={`${item.key}-${option.id}`}
                                    className={cn(
                                      "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4",
                                      "hover:bg-accent hover:text-accent-foreground",
                                      "peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary",
                                      "cursor-pointer transition-all"
                                    )}
                                  >
                                    <span className="text-sm font-medium">
                                      {option.label}
                                    </span>
                                  </Label>
                                </div>
                              );
                            })}
                          </RadioGroup.Root>
                        )}
                        {selectedChart === "radar" && item.key === "total" ? (
                          <div className="mt-4 p-4 border rounded-lg bg-white shadow-sm">
                            <div className="mb-4">
                              <Select
                                value={selectedAttribute}
                                onValueChange={(value) => {
                                  setSelectedAttribute(value);
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select Attribute" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel>Attributes</SelectLabel>
                                    {demographicAttributes.map((attribute) => (
                                      <SelectItem 
                                        key={attribute} 
                                        value={attribute}
                                      >
                                        {attribute}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            {selectedAttribute ? (
                              <div className="space-y-4">
                                <RadarChartTotal 
                                  companyId={selectedCompany?.id} 
                                  userId={selectedUser?.id}
                                  attribute={selectedAttribute}
                                  onDataLoad={(data) => {
                                    console.log('Radar chart data loaded:', data);
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="text-center text-gray-500 py-4">
                                Please select an attribute to view the radar chart
                              </div>
                            )}
                          </div>
                        ) : selectedChart === "bar" && barData ? (
                          <div className="space-y-4">
                            <div ref={barChartRef}>
                              <Bar data={barData} options={chartOptions} plugins={[ChartDataLabels]} />
                            </div>
                            <div className="flex justify-center">
                              <Button
                                variant="secondary"
                                onClick={() => handleCopyChart(barChartRef)}
                                className="bg-purple-600 text-white hover:bg-purple-700"
                              >
                                Copy Chart to Clipboard
                              </Button>
                            </div>
                          </div>
                        ) : selectedChart === "table" ? (
                          <Table className="border border-gray-300 rounded-lg overflow-hidden shadow-md mt-5 mb-5">
                            <TableHeader className="text-white">
                              <TableRow>
                                <TableHead className="w-12 text-center">Sr. No.</TableHead>
                                <TableHead className="text-left">Attribute Name</TableHead>
                                {item.key === 'self' ? (
                                  <>
                                    <TableHead className="text-center">Self - Average Score</TableHead>
                                    <TableHead className="text-center">Self - Score Percentage</TableHead>
                                  </>
                                ) : (
                                  <>
                                    <TableHead className="text-center">Self - Average Score</TableHead>
                                    <TableHead className="text-center">Self - Score Percentage</TableHead>
                                    <TableHead className="text-center">
                                      {(item.key || 'relationship').split('_').map(word => 
                                        word.charAt(0).toUpperCase() + word.slice(1)
                                      ).join(' ')} - Average Score
                                    </TableHead>
                                    <TableHead className="text-center">
                                      {(item.key || 'relationship').split('_').map(word => 
                                        word.charAt(0).toUpperCase() + word.slice(1)
                                      ).join(' ')} - Score Percentage
                                    </TableHead>
                                  </>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tableData && tableData.length > 0 ? (
                                tableData.map((row, index) => (
                                  <TableRow key={`item-${index}`} className="border-b hover:bg-gray-100">
                                    <TableCell className="text-center">{row.SrNo}</TableCell>
                                    <TableCell className="text-left">{row.attributeName}</TableCell>
                                    {item.key === 'self' ? (
                                      <>
                                        <TableCell className="text-center">{(row.averageWeight || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-center">{(row.scorePercentage || 0).toFixed(2)}</TableCell>
                                      </>
                                    ) : (
                                      <>
                                        <TableCell className="text-center">{(row.selfAverageWeight || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-center">{(row.selfScorePercentage || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-center">{(row.relationshipAverageWeight || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-center">{(row.relationshipScorePercentage || 0).toFixed(2)}</TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={item.key === 'self' ? 4 : 5} className="text-center py-2">
                                    No data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        ) : (
                          <></>
                        )}
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
