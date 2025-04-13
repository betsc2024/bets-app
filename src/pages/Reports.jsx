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

  const barChartRef = useRef(null);

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

  return (
    <div className="p-6 max-w-full">
      <h1 className="text-3xl font-bold text-primary mb-4">Reports</h1>
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <Select value={selectedCompany?.id} onValueChange={(value) => {
            const company = companies.find(c => c.id === value);
            setSelectedCompany(company);
          }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a company" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
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
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a Employee" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={analysis} onValueChange={handleAnalysisChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an Analysis Type" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
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
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a Bank" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto [&_*]:scrollbar [&_*]:scrollbar-w-1.5 [&_*]:scrollbar-thumb-gray-400 [&_*]:scrollbar-track-gray-200">
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
          {/* Always show Status component if selections are valid */}
          <Status 
            companyId={selectedCompany?.id}
            userId={selectedUser?.id}
            bankId={bank}
          />
          
          {/* Show other evaluation components only if data exists */}
          {data && data.length > 0 ? (
            <div className="space-y-8 w-full">
              <SelfEvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
              <TopBossEvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
              <PeerEvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
              <HREvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
              <SubordinateEvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
              <ReportingBossEvaluation 
                companyId={selectedCompany?.id}
                userId={selectedUser?.id}
                bankId={bank}
              />
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
    </div>
  );
}
