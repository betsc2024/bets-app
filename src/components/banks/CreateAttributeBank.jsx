import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabase';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

const ITEMS_PER_PAGE = 10;

export default function CreateAttributeBank({
  isEditMode = false,
  initialData = null,
  attributes = [],
  propAnalysisType = '',
  onSave,
  onUpdate,
  isOpen,
  onClose,
  onAnalysisTypeChange
}) {
  // Bank details state
  const [bankDetails, setBankDetails] = useState({
    name: '',
    description: '',
    analysis_type: '',
    is_industry_standard: false,
    status: 'active',
    company_id: null
  });

  const [isDirty, setIsDirty] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [analysisTypes, setAnalysisTypes] = useState([]);
  const [attributesState, setAttributes] = useState([]);
  const [attributeSearchQuery, setAttributeSearchQuery] = useState('');
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch analysis types
  useEffect(() => {
    const fetchAnalysisTypes = async () => {
      try {
        // Get unique analysis types from attributes table
        const { data: types, error } = await supabase
          .from('attributes')
          .select('analysis_type')
          .not('analysis_type', 'is', null);

        if (error) throw error;

        // Create unique array of analysis types
        const uniqueTypes = Array.from(new Set(types.map(t => t.analysis_type)))
          .filter(type => type && type.trim()) // Remove empty/null values
          .sort() // Sort alphabetically
          .map(type => ({ id: type, analysis_type: type }));

        console.log('Fetched analysis types:', uniqueTypes);
        setAnalysisTypes(uniqueTypes);
      } catch (error) {
        console.error('Error fetching analysis types:', error);
        toast.error('Failed to fetch analysis types');
      }
    };

    fetchAnalysisTypes();
  }, []);

  // Handle bank details change
  const handleBankDetailsChange = useCallback((field, value) => {
    console.log('Bank details change:', field, value);
    setBankDetails(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  // Effect to set initial data
  useEffect(() => {
    if (initialData) {
      setBankDetails(initialData);
      setSelectedItems(initialData.statements || []);
    }
  }, [initialData]);

  // Effect to set attributes
  useEffect(() => {
    if (attributes) {
      console.log('Setting attributes:', attributes);
      setAttributes(attributes);
    }
  }, [attributes]);

  // Handle statement selection/deselection
  const handleStatementToggle = (statement, attribute) => {
    const isSelected = selectedItems.some(s => s.id === statement.id);
    let newSelectedItems;

    if (isSelected) {
      newSelectedItems = selectedItems.filter(s => s.id !== statement.id);
    } else {
      const newStatement = {
        id: statement.id,
        statement: statement.statement,
        attributeId: attribute.id,
        attribute: attribute.name,
        options: statement.attribute_statement_options || []
      };
      newSelectedItems = [...selectedItems, newStatement];
    }

    setSelectedItems(newSelectedItems);
    setIsDirty(true);
  };

  // Handle analysis type change
  const handleAnalysisTypeChange = async (value) => {
    console.log('handleAnalysisTypeChange called with:', value);
    
    // Update bank details
    setBankDetails(prev => ({ ...prev, analysis_type: value }));
    setIsDirty(true);

    // Clear existing attributes
    setAttributes([]);
    
    if (!value) return;

    try {
      console.log('Fetching attributes for type:', value);
      
      // First try the old column
      const { data: oldData, error: oldError } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          is_industry_standard,
          analysis_type,
          attribute_statements (
            id,
            statement,
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          )
        `)
        .eq('analysis_type', value);

      if (oldError) throw oldError;

      console.log('Fetched attributes from old column:', oldData);
      
      // Combine results from both queries, removing duplicates
      const allAttributes = [...(oldData || [])];
      const uniqueAttributes = Array.from(new Map(allAttributes.map(item => [item.id, item])).values());
      
      console.log('Combined unique attributes:', uniqueAttributes);
      setAttributes(uniqueAttributes);

      // Notify parent if needed
      if (onUpdate) {
        onUpdate({
          ...bankDetails,
          analysis_type: value,
          statements: selectedItems
        });
      }
    } catch (error) {
      console.error('Error fetching attributes:', error);
      toast.error('Failed to fetch attributes');
    }
  };

  // Filter attributes based on search and analysis type
  const filteredAttributes = useMemo(() => {
    const currentAnalysisType = bankDetails.analysis_type || propAnalysisType;
    console.log('Filtering attributes:', { 
      currentAnalysisType,
      totalAttributes: attributesState.length,
      attributes: attributesState
    });

    let filtered = attributesState;

    // Filter by analysis type
    if (currentAnalysisType) {
      filtered = filtered.filter(attr => attr.analysis_type === currentAnalysisType);
    }

    // Filter by search query
    if (attributeSearchQuery) {
      filtered = filtered.filter(attr =>
        attr.name?.toLowerCase().includes(attributeSearchQuery.toLowerCase()) ||
        attr.description?.toLowerCase().includes(attributeSearchQuery.toLowerCase())
      );
    }

    console.log('Filtered attributes:', filtered);
    return filtered;
  }, [attributesState, attributeSearchQuery, bankDetails.analysis_type, propAnalysisType]);

  // All statements from filtered attributes
  const allStatements = useMemo(() => {
    return filteredAttributes.reduce((acc, attr) => {
      return acc.concat(attr.attribute_statements || []);
    }, []);
  }, [filteredAttributes]);

  // Check if a statement is selected
  const isStatementSelected = useCallback((statementId) => {
    return selectedItems.some(item => item.id === statementId);
  }, [selectedItems]);

  // Handle save button click
  const handleSave = () => {
    if (onUpdate) {
      console.log('Saving with status:', bankDetails.status); // Debug log
      // Only send fields that exist in the database
      const updateData = {
        name: bankDetails.name,
        description: bankDetails.description,
        status: bankDetails.status,
        company_id: bankDetails.company_id,
        statements: selectedItems
      };
      onUpdate(updateData);
    }
    setIsDirty(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              value={bankDetails.name}
              onChange={(e) => handleBankDetailsChange('name', e.target.value)}
              placeholder="Enter bank name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="analysis_type">Analysis Type <span className="text-red-500">*</span></Label>
            <Select
              value={bankDetails.analysis_type || propAnalysisType || ''}
              onValueChange={(value) => {
                console.log('Select onValueChange:', value);
                if (isEditMode) {
                  handleBankDetailsChange('analysis_type', value);
                } else if (onAnalysisTypeChange) {
                  console.log('Calling onAnalysisTypeChange with:', value);
                  onAnalysisTypeChange(value);
                }
              }}
            >
              <SelectTrigger className="w-full" id="analysis_type">
                <SelectValue placeholder="Select analysis type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {analysisTypes?.map(type => (
                    <SelectItem key={type.id} value={type.analysis_type}>
                      {type.analysis_type}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground mt-1">
              Selected: {bankDetails.analysis_type || propAnalysisType || 'None'}
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label>Filter by Industry</Label>
            <Select value={selectedIndustryFilter} onValueChange={setSelectedIndustryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {/* {industries.map((industry) => (
                  <SelectItem key={industry.id} value={industry.id}>
                    {industry.name}
                  </SelectItem>
                ))} */}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filter by Analysis Type</Label>
            <Select 
              value={bankDetails.analysis_type} 
              onValueChange={(value) => handleBankDetailsChange('analysis_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select analysis type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {analysisTypes.map((type) => (
                  <SelectItem key={type.id} value={type.analysis_type}>
                    {type.analysis_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected Statements Section */}
        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-purple-800">Selected Statements</CardTitle>
            <CardDescription>
              {selectedItems.length} statements selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedItems.length > 0 ? (
              <div className="space-y-2">
                {selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-purple-50 rounded-md"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.statement}</span>
                      <span className="text-xs text-muted-foreground">{item.attribute}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatementToggle({ id: item.id }, { id: item.attributeId })}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No statements selected. Select statements from the list below.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Statements Section */}
        <div className="space-y-4">
          <div className="border-b border-purple-200 pb-4">
            <h3 className="text-lg font-medium text-purple-800">Available Attributes</h3>
            <p className="text-sm text-muted-foreground">Select attributes to include in your bank</p>
          </div>

          {/* Search and Filters */}
          <Card className="border-purple-200">
            <CardContent className="pt-6">
              <div className="border-b border-purple-200 pb-4 mb-4">
                <h4 className="text-sm font-medium text-purple-800">Search and Filters</h4>
                <p className="text-xs text-muted-foreground">
                  {filteredAttributes.length} attributes • {allStatements.length} statements
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Industry Filter */}
                <div>
                  <Label className="text-xs mb-1 text-purple-800">Filter by Industry</Label>
                  <Select value={selectedIndustryFilter} onValueChange={setSelectedIndustryFilter}>
                    <SelectTrigger className="border-purple-200">
                      <SelectValue placeholder="All Industries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Industries</SelectItem>
                      {/* {industries.map((industry) => (
                        <SelectItem key={industry.id} value={industry.id}>
                          {industry.name}
                        </SelectItem>
                      ))} */}
                    </SelectContent>
                  </Select>
                </div>

                {/* Attribute Filter */}
                <div>
                  <Label className="text-xs mb-1 text-purple-800">Filter by Attribute</Label>
                  <Select value={bankDetails.analysis_type} onValueChange={(value) => handleBankDetailsChange('analysis_type', value)}>
                    <SelectTrigger className="border-purple-200">
                      <SelectValue placeholder="All Attributes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Attributes</SelectItem>
                      {attributesState.map((attr) => (
                        <SelectItem key={attr.id} value={attr.id}>
                          {attr.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search Input */}
                <div>
                  <Label className="text-xs mb-1 text-purple-800">Search Statements</Label>
                  <Input
                    placeholder="Search statements..."
                    value={attributeSearchQuery}
                    onChange={(e) => setAttributeSearchQuery(e.target.value)}
                    className="border-purple-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attributes Table */}
          <div className="border border-purple-200 rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-purple-50">
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="text-purple-800 font-bold">Attribute</TableHead>
                  <TableHead className="text-purple-800 font-bold">Statement</TableHead>
                  <TableHead className="text-purple-800 font-bold">Options & Weights</TableHead>
                  <TableHead className="text-purple-800 font-bold">Industry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttributes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(attribute => (
                  attribute.attribute_statements?.map(statement => (
                    <TableRow key={statement.id}>
                      <TableCell className="w-[40px]">
                        <Checkbox
                          checked={isStatementSelected(statement.id)}
                          onCheckedChange={() => handleStatementToggle(statement, attribute)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-purple-800">{attribute.name}</div>
                        {attribute.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {attribute.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{statement.statement}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {statement.attribute_statement_options?.map(option => (
                            <div key={option.id} className="flex justify-between text-sm">
                              <span>{option.option_text}</span>
                              <span className="text-muted-foreground">{option.weight}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {attribute.attribute_industry_mapping?.map(mapping => (
                          <Badge key={mapping.industry_id} variant="outline" className="mr-1">
                            {mapping.industries?.name}
                          </Badge>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE) > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE) }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        onClick={() => setCurrentPage(i + 1)}
                        isActive={currentPage === i + 1}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE), p + 1))}
                      disabled={currentPage === Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>

        {/* Add Save Button for Edit Mode */}
        {isEditMode && isDirty && (
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSave}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
