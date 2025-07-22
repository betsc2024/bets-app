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
import { RadarChartTotal } from '@/components/RadarChartTotal';
import SelfEvaluation from '@/components/evaluations/SelfEvaluation';
import TopBossEvaluation from '@/components/evaluations/TopBossEvaluation';
import PeerEvaluation from '@/components/evaluations/PeerEvaluation';
import HREvaluation from '@/components/evaluations/HREvaluation';
import SubordinateEvaluation from '@/components/evaluations/SubordinateEvaluation';
import ReportingBossEvaluation from '@/components/evaluations/ReportingBossEvaluation';
import TotalEvaluation from '@/components/evaluations/TotalEvaluation';
import DemographyEvaluation from '@/components/evaluations/DemographyEvaluation';
import Status from '@/components/evaluations/Status';
import CopyToClipboard from '@/components/CopyToClipboard';
import html2canvas from "html2canvas";
import OverallStatus from './OverallStatus';
import QuotientTable from "@/components/QuotientTable";
import QuotientStatus from "@/components/QuotientStatus";

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
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [relationResults, setRelationResults] = useState(null);
  const [barData, setBarData] = useState(null);
  const [scoreType, setScoreType] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  
  // Quotient report states
  const [beforeBank, setBeforeBank] = useState("");
  const [afterBank, setAfterBank] = useState("");

  // Table data states
  const [tableData, setTableData] = useState([]);
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
  const [selectedAttributeBank, setSelectedAttributeBank] = useState("");

  // Evaluation counts state
  const [evaluationCounts, setEvaluationCounts] = useState({});

  const barChartRef = useRef(null);

  // Progressive selection states for hiding/showing dropdowns
  const [companyStepDone, setCompanyStepDone] = useState(false);
  const [bankStepDone, setBankStepDone] = useState(false);
  const [reportType, setReportType] = useState(''); // Only 'individual' for now
  const [employeeStepDone, setEmployeeStepDone] = useState(false);
  const [selectedEvaluationGroup, setSelectedEvaluationGroup] = useState(null); // For status report
  const [evaluationGroups, setEvaluationGroups] = useState([]); // For status report

  // Fetch evaluation groups for status report (matching OverallStatus logic)
  const fetchEvaluationGroups = async () => {
    if (!selectedCompany || !bank) return;
    try {
      const { data: assignments, error } = await supabase
        .from('evaluation_assignments')
        .select(`
          id,
          evaluation_name,
          created_at,
          user_to_evaluate:users!evaluation_assignments_user_to_evaluate_id_fkey (
            id,
            email,
            full_name
          ),
          evaluations:evaluations_evaluation_assignment_id_fkey (
            id,
            status,
            is_self_evaluator,
            relationship_type,
            evaluator:users!evaluations_evaluator_id_fkey (
              id,
              email,
              full_name
            )
          )
        `)
        .eq('company_id', selectedCompany.id)
        .eq('attribute_bank_id', bank)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group assignments by evaluation name
      const groups = assignments.reduce((acc, curr) => {
        if (!acc[curr.evaluation_name]) {
          acc[curr.evaluation_name] = {
            name: curr.evaluation_name,
            assignments: []
          };
        }
        acc[curr.evaluation_name].assignments.push(curr);
        return acc;
      }, {});

      // Convert to array and sort by latest assignment
      const groupArray = Object.values(groups).sort((a, b) => {
        const aDate = new Date(a.assignments[0].created_at);
        const bDate = new Date(b.assignments[0].created_at);
        return bDate - aDate;
      });

      setEvaluationGroups(groupArray);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      toast.error('Failed to load evaluations');
      setEvaluationGroups([]);
    }
  };

  // Fetch evaluation groups when bank changes and reportType is 'status'
  useEffect(() => {
    if (reportType === 'status' && selectedCompany && bank) {
      fetchEvaluationGroups();
    }
  }, [reportType, selectedCompany, bank]);

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
          average_score_percentage: (totalWeight / count) / 1,
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

      const relationshipEvals = data.filter(e => e.relationship_type === type);
      const relationshipData = relationshipEvals.map(e => ({
        attributeName: e.attribute_name,
        averageWeight: e.average_weight || 0,
        scorePercentage: e.average_score_percentage || 0
      }));
      
      // For all relationship types, show relationship data
      const mergedData = labels.map((label, index) => {
        const relationshipItem = relationshipData.find(d => d.attributeName === label) || {
          averageWeight: 0,
          scorePercentage: 0
        };
        
        return {
          SrNo: index + 1,
          attributeName: label,
          relationshipAverageWeight: relationshipItem.averageWeight || 0,
          relationshipScorePercentage: relationshipItem.scorePercentage || 0
        };
      });
      setTableData(mergedData);

      // Update chart data
      const relationResults = labels.map(label => {
        const item = relationshipData.find(d => d.attributeName === label);
        return item ? (item.scorePercentage || 0) : 0;
      });
      setRelationResults(relationResults);
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

  const handleAnalysisChange = (value) => {
    setAnalysis(value);
    if (selectedCompany && selectedUser) {
      fetchData(selectedCompany, selectedUser, value, bank);
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
    if (selectedCompany && reportType) {
      fetch_bank(selectedCompany, analysis);
    }
  }, [selectedCompany, reportType, analysis]);

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
    // Fetch relationship data when filters change
    if (data && data.length > 0 && selectedCompany && selectedUser && analysis && bank) {
      fetchSpecificData('top_boss');
    }
  }, [data, selectedCompany, selectedUser, analysis, bank]);

  const updateChartData = (type) => {
    if (labels) {  
      const chartData = {
        labels: labels,
        datasets: [{
          label: type === 'total' ? "Total" : type,
          data: relationResults,
          backgroundColor: "#e74c3c"
        }]
      };

      setBarData(chartData);
    }
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
        const relationshipType = item.relationship_type || "unknown"; // Treat null as "unknown"

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

  const Demography_bar_data = (attribute) => {

    let relationResult = [];

    if (demographicData) {
      demographicData.map((item, index) => {
        if (item.Attribute === attribute) {
          for (let key in item) {
            if (key !== "Attribute" && key !== "SrNo") {
              relationResult.push(item[key]);
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
          data: relationResult,
          backgroundColor: relationResult.map((_, index) => colors[index % colors.length]),
          borderColor: relationResult.map((_, index) => colors[index % colors.length]),
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

  useEffect(() => {
    const handleStatusUpdate = (event) => {
      setEvaluationCounts(event.detail);
    };

    document.addEventListener('evaluationStatusUpdate', handleStatusUpdate);
    return () => {
      document.removeEventListener('evaluationStatusUpdate', handleStatusUpdate);
    };
  }, []);

  const handleResetFilters = () => {
    setSelectedCompany(null);
    setSelectedUser(null);
    setAnalysis("");
    setBank("");
    setBeforeBank("");
    setAfterBank("");
    setSelectedAttribute(null);
    setScoreType(null);
    setBarData(null);
    setLabels(null);
    setRelationResults(null);
    setTableData([]);
    setTotal([]);
    setDemographicAttributes([]);
    setDemographicData([]);
    setDemographicTypes([]);
    setDemographicBarData([]);
    setEvaluationCounts({});
    setSelectedEvaluationGroup(null);
    setEvaluationGroups([]);
  };

  return (
    <div className="p-6 max-w-full">
      <h1 className="text-3xl font-bold text-primary mb-4">Reports</h1>
      <div className="flex items-center gap-2 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* Company Selection */}
          <Select
            value={selectedCompany?.id || ''}
            onValueChange={(value) => {
              const company = companies.find(c => c.id === value);
              setSelectedCompany(company || null);
              setBank("");
              setBankStepDone(false);
              setEmployeeStepDone(false);
              setSelectedEvaluationGroup(null);
              setReportType('');
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
              <SelectGroup>
                <SelectLabel className="flex items-center justify-between">Companies</SelectLabel>
                {[...companies].sort((a, b) => a.name.localeCompare(b.name)).map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Report Type Selection: show after company is selected */}
          {selectedCompany && (
            <Select value={reportType} onValueChange={(value) => {
              setReportType(value);
              setEmployeeStepDone(false);
              setSelectedUser(null);
              setSelectedEvaluationGroup(null);
              setBank(""); // Reset bank when report type changes
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Report Type</SelectLabel>
                  <SelectItem value="individual">Individual Report</SelectItem>
                  <SelectItem value="status">Status Report</SelectItem>
                  <SelectItem value="evaluation">Evaluation Status Reports</SelectItem>
                  <SelectItem value="quotient">Quotient</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {/* Before Bank Selection: only show if company and report type is 'quotient' */}
          {selectedCompany && reportType === 'quotient' && (
            <Select value={beforeBank} onValueChange={(value) => {
              setBeforeBank(value);
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Before Bank" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
                <SelectGroup>
                  <SelectLabel className="flex items-center justify-between">Before Banks</SelectLabel>
                  {[...bankList].sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
                    item?.id && item?.name ? (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ) : null
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {/* After Bank Selection: only show if company and report type is 'quotient' and before bank is selected */}
          {selectedCompany && reportType === 'quotient' && beforeBank && (
            <Select value={afterBank} onValueChange={(value) => {
              setAfterBank(value);
              setSelectedUser(null); // Reset user selection when after bank changes
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select After Bank (Optional)" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
                <SelectGroup>
                  <SelectLabel className="flex items-center justify-between">After Banks</SelectLabel>
                  <SelectItem value="none">None</SelectItem>
                  {[...bankList].sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
                    item?.id && item?.name ? (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ) : null
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          
          {/* User Selection for Quotient: only show if company, report type, and before bank are selected */}
          {selectedCompany && reportType === 'quotient' && beforeBank && (
            <Select value={selectedUser?.id} onValueChange={(value) => {
              const user = users.find(c => c.id === value);
              setSelectedUser(user);
              setEmployeeStepDone(true);
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a User" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
                <SelectGroup>
                  <SelectLabel className="flex items-center justify-between">Users</SelectLabel>
                  {[...users].sort((a, b) => a.full_name.localeCompare(b.full_name)).map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {/* Bank Selection: only show if company and report type selected (except quotient) */}
          {selectedCompany && reportType && reportType !== 'quotient' && (
            <Select value={bank} onValueChange={(value) => {
              setBank(value);
              setBankStepDone(true);
              setSelectedUser(null); // Reset employee selection
              setEmployeeStepDone(false);
              setSelectedEvaluationGroup(null);
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a Bank" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
                <SelectGroup>
                  <SelectLabel className="flex items-center justify-between">Banks</SelectLabel>
                  {[...bankList].sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
                    item?.id && item?.name ? (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ) : null
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {/* Employee Selection: only show if company, report type, bank, and report type is 'individual' */}
          {selectedCompany && reportType === 'individual' && bank && (
            <Select value={selectedUser?.id} onValueChange={(value) => {
              const user = users.find(c => c.id === value);
              setSelectedUser(user);
              setEmployeeStepDone(true);
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an Employee" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
                <SelectGroup>
                  <SelectLabel className="flex items-center justify-between">Users</SelectLabel>
                  {[...users].sort((a, b) => a.full_name.localeCompare(b.full_name)).map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {/* Evaluation Selection: only show if reportType is 'status' */}
          {selectedCompany && reportType === 'status' && bank && (
            <Select value={selectedEvaluationGroup?.name || ''} onValueChange={(value) => {
              const group = evaluationGroups.find(g => g.name === value);
              setSelectedEvaluationGroup(group);
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Evaluation" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto">
                <SelectGroup>
                  <SelectLabel>Evaluations</SelectLabel>
                  {evaluationGroups.map((group) => (
                    <SelectItem key={group.name} value={group.name}>{group.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
        {(selectedCompany || selectedUser || analysis || bank || selectedAttribute || scoreType) && (
          <Button variant="outline" onClick={handleResetFilters} className="ml-2">
            Clear
          </Button>
        )}
      </div>

      {/* Individual Report UI */}
      {selectedCompany && reportType === 'individual' && bank && selectedUser && (
        <div className="space-y-6" ref={barChartRef}>
          {/* Always show Status component if selections are valid */}
          <Status 
            companyId={selectedCompany?.id}
            userId={selectedUser?.id}
            bankId={bank}
          />
          
          {/* Show other evaluation components only if they have evaluators */}
          {data && data.length > 0 ? (
            <div className="space-y-8 w-full">
              {evaluationCounts.self > 0 && (
                <SelfEvaluation 
                  companyId={selectedCompany?.id}
                  userId={selectedUser?.id}
                  bankId={bank}
                />
              )}
              {evaluationCounts.top_boss > 0 && (
                <TopBossEvaluation 
                  companyId={selectedCompany?.id}
                  userId={selectedUser?.id}
                  bankId={bank}
                />
              )}
              {evaluationCounts.peer > 0 && (
                <PeerEvaluation 
                  companyId={selectedCompany?.id}
                  userId={selectedUser?.id}
                  bankId={bank}
                />
              )}
              {evaluationCounts.hr > 0 && (
                <HREvaluation 
                  companyId={selectedCompany?.id}
                  userId={selectedUser?.id}
                  bankId={bank}
                />
              )}
              {evaluationCounts.subordinate > 0 && (
                <SubordinateEvaluation 
                  companyId={selectedCompany?.id}
                  userId={selectedUser?.id}
                  bankId={bank}
                />
              )}
              {evaluationCounts.reporting_boss > 0 && (
                <ReportingBossEvaluation 
                  companyId={selectedCompany?.id}
                  userId={selectedUser?.id}
                  bankId={bank}
                />
              )}
              <TotalEvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
              <DemographyEvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-8 text-lg">
              No evaluation data available yet
            </div>
          )}
        </div>
      )}

      {/* Status Report UI */}
      {selectedCompany && reportType === 'status' && bank && selectedEvaluationGroup && (
        <div className="space-y-6" ref={barChartRef}>
          {/* Render OverallStatus with proper props */}
          <OverallStatus
            companyId={selectedCompany?.id}
            bankId={bank}
            evaluationGroup={selectedEvaluationGroup}
          />
        </div>
      )}

      {/* Evaluation Status Reports UI */}
      {selectedCompany && reportType === 'evaluation' && bank && (
        <EvaluationReportsTable companyId={selectedCompany?.id} bankId={bank} />
      )}

      {/* Quotient Report UI */}
      {selectedCompany && reportType === 'quotient' && beforeBank && selectedUser && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-primary">Quotient</h2>
          
          {/* Evaluation Status Component */}
          <QuotientStatus
            companyId={selectedCompany?.id}
            userId={selectedUser?.id}
            beforeBankId={beforeBank}
            afterBankId={afterBank}
          />
          
          {/* Quotient Table Component */}
          <div className="border rounded-lg p-4 bg-white">
            <QuotientTable 
              companyId={selectedCompany?.id} 
              userId={selectedUser?.id} 
              beforeBankId={beforeBank} 
              afterBankId={afterBank} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Evaluation Status Reports Table Component ---
function EvaluationReportsTable({ companyId, bankId }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [evaluatorFilter, setEvaluatorFilter] = React.useState('all-evaluators');

  // Build unique evaluators for dropdown
  const uniqueEvaluators = React.useMemo(() => {
    const seen = new Set();
    return rows
      .filter(row => {
        if (!row.name) return false;
        if (seen.has(row.name)) return false;
        seen.add(row.name);
        return true;
      })
      .map(row => ({ name: row.name }));
  }, [rows]);

  // Filtered rows by selected evaluator
  const filteredRows = evaluatorFilter === 'all-evaluators'
    ? rows
    : rows.filter(row => row.name === evaluatorFilter);

  React.useEffect(() => {
    let ignore = false;
    async function fetchEvaluationReportData() {
      setLoading(true);
      // Fetch all evaluations for the selected company and bank
      const { data: evaluations, error } = await supabase
        .from('evaluations')
        .select(`
          id,
          status,
          is_self_evaluator,
          evaluator:users!evaluator_id (
            id,
            full_name
          ),
          evaluation_assignments!inner(
            company_id,
            attribute_bank_id
          )
        `)
        .eq('evaluation_assignments.company_id', companyId)
        .eq('evaluation_assignments.attribute_bank_id', bankId);
      if (error || !evaluations) {
        setRows([]);
        setLoading(false);
        return;
      }
      // Aggregate by evaluator
      const evaluatorMap = {};
      evaluations.forEach(e => {
        const evaluator = e.evaluator;
        if (!evaluator) return;
        if (!evaluatorMap[evaluator.id]) {
          evaluatorMap[evaluator.id] = {
            name: evaluator.full_name || '',
            assigned: 0,
            completed: 0,
            pending: 0,
          };
        }
        evaluatorMap[evaluator.id].assigned += 1;
        if (e.status === 'completed') {
          evaluatorMap[evaluator.id].completed += 1;
        } else {
          evaluatorMap[evaluator.id].pending += 1;
        }
      });
      // Convert to sorted array
      const rowArr = Object.values(evaluatorMap).sort((a, b) => a.name.localeCompare(b.name));
      if (!ignore) setRows(rowArr);
      setLoading(false);
    }
    fetchEvaluationReportData();
    return () => { ignore = true; };
  }, [companyId, bankId]);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-primary">Evaluation Status Reports</h2>
        <button
          type="button"
          className="px-4 py-2 rounded bg-primary text-white hover:bg-primary/90 border border-primary shadow-sm transition"
          onClick={() => {
            // Prepare CSV
            const csvRows = [
              ["Evaluator Name", "Assigned", "Completed", "Pending"],
              ...filteredRows.map(row => [row.name, row.assigned, row.completed, row.pending])
            ];
            // Only quote if value contains comma, quote, or newline
            function escapeCSV(val) {
              if (val == null) return '';
              const s = String(val).trim();
              if (/[",\n]/.test(s)) {
                return '"' + s.replace(/"/g, '""') + '"';
              }
              return s;
            }
            const csvContent = csvRows.map(r => r.map(escapeCSV).join(",")).join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'evaluation_status_reports.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
        >
          Download Report
        </button>
      </div>
      {/* Evaluator filter dropdown */}
      {uniqueEvaluators.length > 0 && (
        <div className="mb-4">
          <Select
            value={evaluatorFilter}
            onValueChange={setEvaluatorFilter}
            className="min-w-[220px]"
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by Evaluator" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Evaluators</SelectLabel>
                <SelectItem value="all-evaluators">All Evaluators</SelectItem>
                {uniqueEvaluators.map(ev => (
                  <SelectItem key={ev.name} value={ev.name}>{ev.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="rounded-md border overflow-x-auto bg-background">
        <Table className="min-w-[500px]">
          <TableHeader>
            <TableRow className="bg-secondary/30 border-b border-border">
              <TableHead className="font-semibold text-primary border-r border-border">Evaluator Name</TableHead>
              <TableHead className="font-semibold text-primary border-r border-border text-center">Assigned</TableHead>
              <TableHead className="font-semibold text-primary border-r border-border text-center">Completed</TableHead>
              <TableHead className="font-semibold text-primary text-center">Pending</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">No data available</TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row, idx) => (
                <TableRow
                  key={row.name + idx}
                  className={
                    (idx % 2 === 0 ? "bg-background" : "bg-secondary/10 hover:bg-accent/30") +
                    " border-b border-border"
                  }
                >
                  <TableCell className="py-2 px-4 font-medium text-foreground border-r border-border">{row.name}</TableCell>
                  <TableCell className="py-2 px-4 text-center border-r border-border">{row.assigned}</TableCell>
                  <TableCell className="py-2 px-4 text-center text-green-700 font-semibold border-r border-border">{row.completed}</TableCell>
                  <TableCell className="py-2 px-4 text-center text-yellow-700 font-semibold">{row.pending}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
