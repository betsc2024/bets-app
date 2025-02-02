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




ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler);

export default function Reports() {


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
  const [radial_data, setRadial_data] = useState(null);
  const [radial_result, set_Radial_Result] = useState(null);

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

      // console.log(data);

      // Filter evaluations for the selected company in JS
      const filteredData = data.filter(evaluation =>
        evaluation.evaluation_assignments?.company_id === id
      );

      // console.log(filteredData);
      // Transform data to match expected structure
      const formattedData = filteredData.map(e => {
        const attributeMap = {};

        e.evaluation_responses.forEach(res => {
          const attributeName = res.attribute_statement_options.attribute_statements.attributes.name;
          const weight = res.attribute_statement_options.weight || 0;

          if (!attributeMap[attributeName]) {
            attributeMap[attributeName] = { totalWeight: 0, count: 0 };
          }

          attributeMap[attributeName].totalWeight += weight;
          attributeMap[attributeName].count += 1;
        });

        return Object.entries(attributeMap).map(([attribute_name, { totalWeight, count }]) => ({
          relationship_type: e.relationship_type,
          company_name: e.evaluation_assignments?.companies?.name || "N/A",
          attribute_name,
          average_weight: count > 0 ? totalWeight / count : 0,
          num_evaluations: count,
        }));
      }).flat();


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

  useEffect(() => {
    fetch_companies();
  }, []);

  useEffect(() => {
    fetchData(selectedCompany);
    fetch_spefifc_data(score_type);
  }, [selectedCompany])




  const fetch_spefifc_data = (relationship_type) => {
    if (!data) return;

    // console.log(data);

    const selfData = data.filter((item) => item.relationship_type === null);

    const notSelfData = relationship_type === "total"
      ? data.filter((item) => item.relationship_type !== null)
      : data.filter((item) => item.relationship_type === relationship_type);

    // console.log(selfData);
    // console.log(notSelfData);


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

    // console.log(selfData);
    // console.log(notSelfData);

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
                statement,
                attributes(
                name
                )
              )
            )
          )
        `)
        .eq('status', 'completed'); // Only filtering by completed status


      const { data: query_Data, error } = await query;


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
  }, [selectedAttribute, radial_result])

  useEffect(() => {
    fetch_radar("total");
  }, [selectedAttribute]);

  useEffect(() => {

    // Fetch self data and max data

    if (radial_score && radial_label) {

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

      // console.log(radarData);

      setRadial_data(radarData); // Set the radar chart data
    }
  }, [selectedAttribute, radial_label, radial_score])



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
      id:1,
      title: "Self",
      key: null,
    },
    {
      id:2,
      title: "Top Boss",
      key: "top_boss",
    },
    {
      id:3,
      title: "Peer",
      key: "peer",
    },
    {
      id:4,
      title: "Hr",
      key: "hr",
    }, {
      id:5,
      title: "Sub Ordinate",
      key: "subordinate",
    },
    {
      id:6,
      title: "Reporting Boss",
      key: "reporting_boss",
    },
    {
      id:7,
      title: "Total",
      key: "total",
    },
    {
      id:8,
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


      setTable_Data(mergedScores);
    }
  }, [self_table_data, notself_table_data]);

  const deleteEvaluationResponses = async (companyId) => {
    try {
      const { data: assignments, error: assignmentError } = await supabase
        .from('evaluation_assignments')
        .select('id')
        .eq('company_id', companyId);

      if (assignmentError) throw assignmentError;
      if (!assignments.length) return console.log('No matching evaluations found.');

      const assignmentIds = assignments.map(a => a.id);

      const { data: evaluations, error: evaluationError } = await supabase
        .from('evaluations')
        .select('id')
        .in('evaluation_assignment_id', assignmentIds);

      if (evaluationError) throw evaluationError;
      if (!evaluations.length) return console.log('No evaluations found.');

      const evaluationIds = evaluations.map(e => e.id);

      const { error: deleteError } = await supabase
        .from('evaluation_responses')
        .delete()
        .in('evaluation_id', evaluationIds);

      if (deleteError) throw deleteError;

      console.log('Evaluation responses deleted successfully.');
      toast.message('Data deleted successfully');
      setTable_Data(null);
      setBarData(null);
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
      <div className=' mb-4 flex flex-row '>
        <div  >
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
        {selectedCompany ? <Button
          className="w-48 ml-3 bg-primary hover:bg-red-600 text-primary-foreground font-semibold  }" onClick={() => { deleteEvaluationResponses(selectedCompany?.id) }}             >

          Delete Report
        </Button> : <></>}

      </div>
      {selectedCompany != null ?
        <div style={{ width: "1000px", margin: "0 auto" }}>
          <Accordion.Root type="single" collapsible className="w-full  space-y-2">
            {items.map((item,index) => (
              <Accordion.Item key={item.id}  value={`item-${item.id}`} className="border rounded-md">
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
                              {list_Demographic_atr.map((attribute) => (
                                <SelectItem key={attribute} value={attribute}>
                                  {attribute}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {selectedAttribute ? <Bar data={demographicbardata} options={options} /> : <></>}
                        </>

                        : <Bar data={bardata} options={options} />
                    ) : selectedChart === "radial" && radial_score && item.key === "total" ? (
                      <div>
                        <Select
                          value={selectedAttribute}
                          placeholder="Select an attribute"
                          onValueChange={(value) => { setSelectedAttribute(value);  }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an attribute" />
                          </SelectTrigger>
                          <SelectContent>
                            {label.map((attribute) => (
                              <SelectItem key={attribute} value={attribute}>
                                {attribute}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {radial_data ? <Radar data={radial_data} options={radaroptions} className="mt-16" /> : <></>}
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
                                <TableRow key={`item-${index}`}className="border-b hover:bg-gray-100">
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
                              table_data.map((row,index) => (

                                <TableRow key={index} className="border-b hover:bg-gray-100">
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
