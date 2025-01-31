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

import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';




ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler);

export default function Reports() {

  const { user } = useAuth();
  const [selfscore, setSelfScore] = useState(null);
  const [notselfscore, setNotSelfScore] = useState(null);

  //x and y axes values
  const [data, setData] = useState([]);
  const [label, setLabel] = useState(null);
  const [selfresults, setSelfResults] = useState(null);
  const [notselfresults, setnotselfresults] = useState(null);
  const [selectedChart, setSelectedChart] = useState("table");
  const [bardata, setBarData] = useState(null);
  const [score_type, setScore_Type] = useState(null);
  const [radial_label, setRadial_Label] = useState(null);
  const [radial_score, setRadial_Score] = useState(null);
  const [self_table_data, setSelfTableData] = useState([]);
  const [notself_table_data, setNotSelfTableData] = useState([]);
  const [table_data, setTable_Data] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [list_Demographic_atr, setlist_Demographic_atr] = useState([]);
  const [demographicData, setDemographic_data] = useState([]);
  const [demographicTypes, setDemographic_types] = useState([]);

  const [selectedAttribute, setSelectedAttribute] = useState('');

  const [demographicbardata, setdemographicbardata] = useState([]);





  const fetchData = async (selectedCompany) => {
    try {
      setBarData(null);
      setTable_Data([]);



      const id = selectedCompany?.id;

      // Fetch data without deep filtering
      const { data, error } = await supabase
        .from("evaluations")
        .select(`
          relationship_type,
          evaluation_assignments ( 
            id,
            company_id,
            companies ( id, name ) 
          ),
          evaluation_responses (
            attribute_statement_options ( 
              weight, 
              attribute_statements ( 
                attributes ( name ) 
              ) 
            ) 
          )
        `)
        .eq("status", "completed");

      if (error) throw error;

      console.log(data);

      // Filter evaluations for the selected company in JS
      const filteredData = data.filter(evaluation =>
        evaluation.evaluation_assignments?.company_id === id
      );

      // Transform data to match expected structure
      const formattedData = filteredData
        .filter(e => e.evaluation_responses?.[0]?.attribute_statement_options?.attribute_statements?.attributes?.name)
        .map(e => ({
          relationship_type: e.relationship_type,
          company_name: e.evaluation_assignments?.companies?.name || "N/A",
          attribute_name: e.evaluation_responses[0].attribute_statement_options.attribute_statements.attributes.name,
          average_weight: e.evaluation_responses.length > 0
            ? e.evaluation_responses.reduce((sum, res) => sum + (res.attribute_statement_options.weight || 0), 0) / e.evaluation_responses.length
            : 0,
          num_evaluations: e.evaluation_responses.length || 1,
        }));

      setData(formattedData);

      console.log(data);


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
        console.log("Processing item", item); // Log each item being processed
        const relationshipType = item.relationship_type || "Self"; // Treat null as "Self"
        console.log("Relationship Type:", relationshipType); // Log the relationship type
        relationshipTypes.add(relationshipType);

        // Process each item based on the new data structure
        const attributeName = item.attribute_name;
        const weight = item.average_weight || 0; // Use average_weight if available

        console.log("Attribute Name:", attributeName); // Log attribute name

        if (!attributeMap[attributeName]) {
          attributeMap[attributeName] = {};
        }

        if (!attributeMap[attributeName][relationshipType]) {
          attributeMap[attributeName][relationshipType] = { total: 0, count: 0 };
        }

        attributeMap[attributeName][relationshipType].total += weight;
        attributeMap[attributeName][relationshipType].count += 1;
      });

      console.log("Attribute Map:", attributeMap); // Log attribute map after processing

      const relationshipTypesArray = Array.from(relationshipTypes);
      console.log("Relationship Types Array:", relationshipTypesArray); // Log relationship types

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

      console.log("Processed Data:", processedData); // Log processed data
      console.log(Object.keys(attributeMap)); // Log processed data


      setDemographic_types(relationshipTypesArray);
      setlist_Demographic_atr(Object.keys(attributeMap));
      setDemographic_data(processedData);

      console.log(list_Demographic_atr);

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

  useEffect(() => {
    fetch_companies();
  }, []);

  useEffect(() => {
    fetchData(selectedCompany);
  }, [selectedCompany])




  const fetch_spefifc_data = (relationship_type) => {
    if (!data) return;

    const selfData = data.filter((item) => item.relationship_type === null);

    const notSelfData = relationship_type === "total"
      ? data.filter((item) => item.relationship_type !== null)
      : data.filter((item) => item.relationship_type === relationship_type);

    const labels = [...new Set(data.map((item) => item.attribute_name))];

    const selfResultsMap = {};
    const notSelfResultsMap = {};

    labels.forEach((label) => {
      const selfItems = selfData.filter((item) => item.attribute_name === label);
      const notSelfItems = notSelfData.filter((item) => item.attribute_name === label);

      selfResultsMap[label] = selfItems.length
        ? selfItems.reduce((sum, i) => sum + i.average_weight, 0) / selfItems.length
        : 0;

      notSelfResultsMap[label] = notSelfItems.length
        ? notSelfItems.reduce((sum, i) => sum + i.average_weight, 0) / notSelfItems.length
        : 0;
    });

    setLabel(labels);
    setSelfResults(Object.values(selfResultsMap));
    setnotselfresults(Object.values(notSelfResultsMap));

    setSelfTableData(selfData);
    setNotSelfTableData(notSelfData);
    // setTable_Data(data);
  };





  const fetch_radar = async (relationship_type) => {
    try {
      let query = supabase
        .from('evaluations')
        .select(`
          relationship_type,
          evaluation_responses (
            attribute_statement_options (
              weight,
              attribute_statements (
                statement
              )
            )
          )
        `)
        .eq('status', 'completed'); // Only filtering by completed status

      if (relationship_type && relationship_type !== 'total') {
        query = query.eq('relationship_type', relationship_type);
      } else if (relationship_type === 'total') {
        query = query;
      }

      const { data, error } = await query;

      if (error) {
        throw new Error('Error fetching data: ' + error.message);
      }

      const processedData = {};

      data.forEach((evaluation) => {
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

      // Fetch self data and max data
      const maxData = new Array(result.length).fill(100);
      const selfData = result.map(item => item.average_weight);

      let relationshipData = [];
      if (relationship_type && relationship_type !== 'total') {
        relationshipData = result.map(item => item.average_weight);
      }

      // Combine self, relationship, and max data
      const radarData = {
        labels: result.map(item => item.statement),
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

      setRadial_Label(result.map(item => item.statement)); // Set the statement labels
      setRadial_Score(radarData); // Set the radar chart data

    } catch (err) {
      console.error(err);
      throw new Error("Failed to fetch radar data: " + err.message);
    }
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
    }, {
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
    {
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
    if (self_table_data.length > 0 || notself_table_data.length > 0) {
      const selfScoresMap = self_table_data.reduce((acc, selfItem) => {
        acc[selfItem.attribute_name] = {
          ...selfItem,
          avg_reln_weight: 0,
        };
        return acc;
      }, {});

      notself_table_data.forEach((notSelfItem) => {
        const attribute = notSelfItem.attribute_name;

        if (selfScoresMap[attribute]) {
          selfScoresMap[attribute].avg_reln_weight =
            (selfScoresMap[attribute].avg_reln_weight || 0) + notSelfItem.average_weight;
        } else {
          selfScoresMap[attribute] = {
            ...notSelfItem,
            avg_reln_weight: notSelfItem.average_weight, // Initialize from not-self data
          };
        }
      });

      const mergedScores = Object.values(selfScoresMap);

      console.log(mergedScores);
      setTable_Data(mergedScores);
    }
  }, [self_table_data, notself_table_data]);

  const Demography_bar_data = (attribute) => {
    console.log(attribute);

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
    console.log(selfresult);

    setdemographicbardata({
      labels: demographicTypes,
      datasets: [
        {
          label: "Score",
          data: selfresult,
          backgroundColor: "#733e93",
          borderColor: "#733e93",
          borderWidth: 1,
        }
      ],
    })
  }
  useEffect(() => {
    Demography_bar_data(selectedAttribute);
  }, [selectedAttribute])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-primary mb-4">Reports</h1>
      <div className='mb-4'>
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
      </div>
      {selectedCompany != null ?
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

                            console.log("clicking");
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

                          {selectedAttribute ? <Bar data={demographicbardata} options={options} /> : <></>}
                        </>

                        : <Bar data={bardata} options={options} />
                    ) : selectedChart === "radial" && radial_score && item.key === "total" ? (
                      <Radar data={radial_score} options={radaroptions} className="mt-16" />
                    ) : selectedChart === "table" ? (
                      item.key === "demography" ? (<>
                        <Table className="border border-gray-300 rounded-lg overflow-hidden shadow-md">
                          <TableHeader className="text-white">
                            <TableRow>
                              <TableHead className="w-12 text-center">Sr. No.</TableHead>
                              <TableHead className="text-left">Attributes</TableHead>

                              {demographicTypes.map((type, idx) => (
                                <TableHead key={idx} className="text-center">
                                  {type}
                                </TableHead>
                              ))}

                              <TableHead className="text-center">Total</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {demographicData.length > 0 ? (
                              demographicData.map((row, index) => (
                                <TableRow key={index} className="border-b hover:bg-gray-100">
                                  <TableCell className="text-center">{row.SrNo}</TableCell>
                                  <TableCell>{row.Attribute}</TableCell>

                                  {demographicTypes.map((type, idx) => (
                                    <TableCell key={idx} className="text-center">
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

                                <TableRow key={row.id} className="border-b hover:bg-gray-100">
                                  <TableCell className="text-center">{index + 1}</TableCell>
                                  <TableCell>{row.attribute_name}</TableCell>
                                  <TableCell className="text-center">{row.average_weight.toFixed(2)}</TableCell>
                                  <TableCell className="text-center">
                                    {((row.average_weight / 100) * 100).toFixed(2)}%
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
        : <p>Please Select a Company</p>}

    </div>
  );
}
