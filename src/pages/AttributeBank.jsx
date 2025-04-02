import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Plus, Loader2, ChevronDown, ChevronLeft } from "lucide-react";
import { toast } from 'sonner';
import CreateAttributeBank from "@/components/banks/CreateAttributeBank";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import cn from 'classnames';
import { useNavigate } from 'react-router-dom';

export default function AttributeBank() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // All state declarations
  const [analysisType, setAnalysisType] = useState('');
  const [analysisTypeList, setAnalysisTypeList] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [companies, setCompanies] = useState([]);
  const [view, setView] = useState('list');
  const [banks, setBanks] = useState([]);
  const [newBank, setNewBank] = useState({
    name: '',
    description: '',
    analysis_type_id: '',
    status: 'active',
    company_id: null
  });
  const [selectedStatements, setSelectedStatements] = useState([]);
  const [availableStatements, setAvailableStatements] = useState([]);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [industryDialogOpen, setIndustryDialogOpen] = useState(false);
  const [attributeDialogOpen, setAttributeDialogOpen] = useState(false);
  const [statementDialogOpen, setStatementDialogOpen] = useState(false);
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState('all');
  const [selectedAttributeFilter, setSelectedAttributeFilter] = useState('all');
  const [selectedStatementFilter, setSelectedStatementFilter] = useState('all');
  const [industrySearchQuery, setIndustrySearchQuery] = useState('');
  const [attributeSearchQuery, setAttributeSearchQuery] = useState('');
  const [statementSearchQuery, setStatementSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const itemsPerPage = 10;

  // API functions
  const fetchIndustries = async () => {
    try {
      const { data, error } = await supabase
        .from('industries')
        .select('*')
        .order('name');

      if (error) throw error;
      setIndustries(data || []);
    } catch (error) {
      console.error('Error fetching industries:', error);
      toast.error('Failed to fetch industries');
    }
  };

  const fetchanalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('analysis_types')
        .select('id, name')
        .order('name');

      if (error) throw error;

      // Transform data for UI
      const transformedData = data
        .filter(item => item.name && typeof item.name === 'string' && item.name.trim() !== '')
        .map(item => ({
          value: item.id,  // Use ID as the value
          label: item.name // Use name as the label
        }));

      setAnalysisTypeList(transformedData);
    } catch (error) {
      console.error('Error fetching analysis types:', error);
      toast.error('Failed to fetch analysis types');
    }
  };

  const fetchBanks = async () => {
    setLoading(true);
    try {
      console.log('Fetching banks...'); // Debug log
      const { data, error } = await supabase
        .from('attribute_banks')
        .select(`
          id,
          name,
          description,
          status,
          company_id,
          analysis_type_id,
          analysis_types (
            name
          ),
          companies (
            id,
            name
          ),
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Fetched banks:', data); // Debug log

      setBanks(data.map(bank => ({
        ...bank,
        analysis_type: bank.analysis_types?.name || 'Unknown'
      })));
    } catch (error) {
      console.error('Error fetching banks:', error);
      toast.error('Failed to fetch banks');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttributes = async () => {
    try {
      // Get analysis type from the first statement's attribute if available
      const analysisTypeId = selectedBank?.attribute_statements?.[0]?.attributes?.analysis_type_id || 'behavior';

      // First fetch attributes that have the selected analysis type
      const { data: attributesData, error: attributesError } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          attribute_industry_mapping (
            industry_id
          ),
          attribute_analysis_types!inner (
            analysis_type_id
          ),
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
        .eq('attribute_analysis_types.analysis_type_id', analysisTypeId) // Filter by analysis type through the junction table
        .order('name');

      if (attributesError) throw attributesError;

      // Then fetch statements that are either:
      // 1. Not associated with any bank (attribute_bank_id is null)
      // 2. Associated with the currently selected bank (if editing)
      const bankId = selectedBank?.id;
      const processedAttributes = await Promise.all(attributesData.map(async (attr) => {
        const query = supabase
          .from('attribute_statements')
          .select(`
            id,
            statement,
            attribute_id,
            attribute_bank_id,
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          `)
          .eq('attribute_id', attr.id)
          .or(`attribute_bank_id.is.null${bankId ? ',attribute_bank_id.eq.' + bankId : ''}`);

        const { data: statements, error: stmtError } = await query;

        if (stmtError) throw stmtError;

        return {
          ...attr,
          analysis_type_id: attr.attribute_analysis_types?.[0]?.analysis_type_id, // Get analysis type from junction table
          attribute_statements: statements?.map(stmt => ({
            ...stmt,
            attribute_statement_options: (stmt.attribute_statement_options || [])
              .sort((a, b) => b.weight - a.weight)
          })) || []
        };
      }));

      setAttributes(processedAttributes);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      toast.error('Failed to fetch attributes');
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, [selectedBank?.id]);

  // Memoized functions
  const fetchCompanies = useMemo(() => async () => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to fetch companies');
    }
  }, []);

  // Event handlers
  const handleBankSelect = (bank) => {
    setSelectedBank(bank);
    setView('details');
  };

  const handleStatementSelect = useCallback((statement) => {
    setSelectedStatements(prev => {
      const exists = prev.find(s => s.id === statement.id);
      if (exists) {
        return prev.filter(s => s.id !== statement.id);
      } else {
        return [...prev, statement];
      }
    });
  }, []);

  const handleAnalysisTypeChange = async (value) => {
    setAnalysisType(value);
    setNewBank(prev => ({ ...prev, analysis_type_id: value }));
    await fetchAttributesForType(value);
  };

  const handleCreateBank = async () => {
    try {
      setLoading(true);

      // Validate required fields
      if (!newBank.name) {
        toast.error('Bank name is required');
        return;
      }

      // Get analysis type ID from name
      const { data: analysisTypeData, error: analysisTypeError } = await supabase
        .from('analysis_types')
        .select('id')
        .eq('name', analysisType)
        .single();

      if (analysisTypeError) {
        console.error('Error getting analysis type:', analysisTypeError);
        toast.error('Failed to get analysis type');
        return;
      }

      // Create bank with analysis type ID
      const { data: bankData, error: bankError } = await supabase
        .from('attribute_banks')
        .insert({
          name: newBank.name,
          description: newBank.description || '',
          analysis_type_id: analysisTypeData.id,
          status: 'active',
          company_id: selectedCompany === 'all' ? null : selectedCompany
        })
        .select()
        .single();

      if (bankError) {
        console.error('Error creating bank:', bankError);
        toast.error('Failed to create bank');
        return;
      }

      // Update selected statements with bank ID
      if (selectedStatements.length > 0) {
        const { error: stmtError } = await supabase
          .from('attribute_statements')
          .update({ attribute_bank_id: bankData.id })
          .in('id', selectedStatements.map(s => s.id));

        if (stmtError) {
          console.error('Error updating statements:', stmtError);
          toast.error('Failed to update statements');
          return;
        }
      }

      toast.success('Bank created successfully');
      setView('list');
      fetchBanks();
    } catch (error) {
      console.error('Error creating bank:', error);
      toast.error('Failed to create bank');
    } finally {
      setLoading(false);
    }
  };

  const paginatedItems = useMemo(() => {
    let flattenedItems = attributes.flatMap(attr => 
      attr.attribute_statements?.map(statement => ({
        ...attr,
        statement
      })) || []
    );

    flattenedItems = flattenedItems.filter(item => {
      const matchesIndustry = selectedIndustryFilter === 'all' ||
        item.attribute_industry_mapping?.some(mapping => 
          mapping.industry_id === selectedIndustryFilter
        );

      const matchesAttribute = selectedAttributeFilter === 'all' ||
        item.id === selectedAttributeFilter;

      const matchesStatement = selectedStatementFilter === 'all' ||
        item.statement.id === selectedStatementFilter;

      return matchesIndustry && matchesAttribute && matchesStatement;
    });
    
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return flattenedItems.slice(startIndex, endIndex);
  }, [attributes, page, itemsPerPage, selectedIndustryFilter, selectedAttributeFilter, selectedStatementFilter]);

  const totalPages = useMemo(() => {
    const totalItems = attributes.reduce((acc, attr) => 
      acc + (attr.attribute_statements?.length || 0), 0
    );
    return Math.ceil(totalItems / itemsPerPage);
  }, [attributes, itemsPerPage]);

  const handleBankDelete = async (bankId) => {
    try {
      const bank = banks.find(b => b.id === bankId);
      if (bank?.status === 'active') {
        toast.error('Active banks cannot be deleted');
        return;
      }

      const { data: statements, error: stmtFetchError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_bank_id', bankId);

      if (stmtFetchError) throw stmtFetchError;

      if (statements?.length > 0) {
        const { error: optionsError } = await supabase
          .from('attribute_statement_options')
          .delete()
          .in('statement_id', statements.map(s => s.id));

        if (optionsError) throw optionsError;
      }

      const { error: statementsError } = await supabase
        .from('attribute_statements')
        .delete()
        .eq('attribute_bank_id', bankId);

      if (statementsError) throw statementsError;

      const { error: bankError } = await supabase
        .from('attribute_banks')
        .delete()
        .eq('id', bankId);

      if (bankError) throw bankError;

      toast.success('Bank and its statements deleted successfully');
      setView('list');
      fetchBanks();
    } catch (error) {
      console.error('Delete bank error:', error);
      toast.error('Failed to delete bank and its statements');
    }
  };

  const handleBankUpdate = async (updatedData) => {
    try {
      console.log('Updating bank with data:', updatedData); // Debug log

      // Update bank details - only send fields that exist in the database
      const updateFields = {
        name: updatedData.name,
        description: updatedData.description,
        company_id: updatedData.company_id === 'null' ? null : updatedData.company_id,
        status: updatedData.status
      };
      console.log('Update fields:', updateFields); // Debug log

      const { error: bankError } = await supabase
        .from('attribute_banks')
        .update(updateFields)
        .eq('id', selectedBank.id);

      if (bankError) throw bankError;

      // Delete existing statements and their options
      const { error: deleteError } = await supabase
        .from('attribute_statements')
        .delete()
        .eq('attribute_bank_id', selectedBank.id);

      if (deleteError) throw deleteError;

      // Insert new statements and their options
      if (updatedData.statements && updatedData.statements.length > 0) {
        for (const statement of updatedData.statements) {
          // Insert statement
          const { data: newStatement, error: insertError } = await supabase
            .from('attribute_statements')
            .insert({
              attribute_bank_id: selectedBank.id,
              statement: statement.statement,
              attribute_id: statement.attributeId
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          // Insert options for this statement
          if (statement.options && statement.options.length > 0) {
            const newOptions = statement.options.map(opt => ({
              statement_id: newStatement.id,
              option_text: opt.option_text,
              weight: opt.weight
            }));

            const { error: optionsError } = await supabase
              .from('attribute_statement_options')
              .insert(newOptions);

            if (optionsError) throw optionsError;
          }
        }
      } else if (updatedData.analysis_type_id) {
        // If no statements but analysis_type_id changed, create a dummy attribute to store the type
        const { data: dummyAttr, error: attrError } = await supabase
          .from('attributes')
          .insert({
            name: `Bank Type - ${updatedData.name}`,
            description: 'Analysis type holder',
            is_industry_standard: false
          })
          .select('id')
          .single();

        if (attrError) throw attrError;

        // Link the analysis type
        const { error: typeError } = await supabase
          .from('attribute_analysis_types')
          .insert({
            attribute_id: dummyAttr.id,
            analysis_type_id: updatedData.analysis_type_id
          });

        if (typeError) throw typeError;

        // Create a dummy statement
        const { error: stmtError } = await supabase
          .from('attribute_statements')
          .insert({
            attribute_bank_id: selectedBank.id,
            statement: 'Bank Type',
            attribute_id: dummyAttr.id
          });

        if (stmtError) throw stmtError;
      }

      // Get the updated company data if a company is selected
      let updatedCompany = null;
      if (updatedData.company_id && updatedData.company_id !== 'null') {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', updatedData.company_id)
          .single();
        
        if (companyError) throw companyError;
        updatedCompany = companyData;
      }

      // Update the banks state with the new data
      setBanks(prevBanks => 
        prevBanks.map(bank => 
          bank.id === selectedBank.id 
            ? {
                ...bank,
                name: updatedData.name,
                description: updatedData.description,
                status: updatedData.status,
                company_id: updatedData.company_id === 'null' ? null : updatedData.company_id,
                companies: updatedCompany,
                attribute_statements: updatedData.statements
              }
            : bank
        )
      );

      toast.success('Bank updated successfully');
      setIsEditDialogOpen(false);
      setSelectedBank(null);
      // Navigate to bank list - this ensures fresh data when viewing details
      navigate('/attribute-bank');
    } catch (error) {
      console.error('Error updating bank:', error);
      toast.error('Failed to update bank');
    }
  };

  const handleEditClick = async (bank) => {
    try {
      // Get the analysis type name from ID
      const { data: analysisTypeData, error: analysisTypeError } = await supabase
        .from('analysis_types')
        .select('name')
        .eq('id', bank.analysis_type_id)
        .single();

      if (analysisTypeError) throw analysisTypeError;

      setSelectedBank({
        ...bank,
        analysis_type: analysisTypeData.name
      });
      setIsEditDialogOpen(true);
    } catch (error) {
      console.error('Error preparing bank edit:', error);
      toast.error('Failed to prepare bank edit');
    }
  };

  // Effects
  useEffect(() => {
    fetchanalysis();
    fetchIndustries();
    fetchBanks();
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchAttributes();
  }, [selectedBank?.id]);

  const fetchAttributesForType = async (type) => {
    try {
      setLoading(true);

      // First get the analysis type ID from the name
      const { data: analysisTypeData, error: analysisTypeError } = await supabase
        .from('analysis_types')
        .select('id')
        .eq('name', type)
        .single();

      if (analysisTypeError) throw analysisTypeError;

      const analysisTypeId = analysisTypeData.id;

      // Fetch attributes with all their relationships
      const { data, error } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          attribute_industry_mapping (
            industry_id
          ),
          attribute_analysis_types!inner (
            analysis_type_id
          ),
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
        .eq('attribute_analysis_types.analysis_type_id', analysisTypeId)
        .order('name');

      if (error) throw error;

      console.log('Fetched attributes:', data);
      setAttributes(data || []);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      toast.error('Failed to fetch attributes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Attribute Banks</h1>
        <Button onClick={() => setView('create')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Bank
        </Button>
      </div>

      {view === 'list' && (
        <BankList
          banks={banks}
          onBankSelect={handleBankSelect}
          onRefresh={fetchBanks}
          setSelectedBank={setSelectedBank}
          setIsEditDialogOpen={setIsEditDialogOpen}
          handleEditClick={handleEditClick}
        />
      )}

      {view === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Attribute Bank</CardTitle>
            <CardDescription>
              Configure your bank and select attributes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Steps Section */}
              <div className="grid grid-cols-3 gap-4">
                {/* Step 1: Analysis Type */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm">
                        1
                      </div>
                      Analysis Type
                      <span className="text-red-500">*</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={analysisType}
                      onValueChange={handleAnalysisTypeChange}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select analysis type" />
                      </SelectTrigger>
                      <SelectContent>
                        {analysisTypeList?.map((item) => (
                          item?.value && item?.label ? (
                            <SelectItem 
                              key={item.value} 
                              value={item.value}
                            >
                              {item.label}
                            </SelectItem>
                          ) : null
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Step 2: Company */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="bg-muted text-muted-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm">
                        2
                      </div>
                      Company
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                          role="combobox"
                          onClick={() => setCompanyDialogOpen(true)}
                        >
                          {selectedCompany === 'all' 
                            ? "No Company"
                            : (companies.find(c => c.id === selectedCompany)?.name || 'Select Company')}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Select Company</DialogTitle>
                          <DialogDescription>
                            Choose a company to associate with this bank or search for a specific one.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="p-2">
                          <Input
                            type="text"
                            placeholder="Search companies..."
                            value={companySearchQuery}
                            onChange={(e) => setCompanySearchQuery(e.target.value)}
                          />
                        </div>
                        <ScrollArea className="h-[300px] p-4">
                          <div className="space-y-2">
                            <div
                              className={cn(
                                "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                selectedCompany === 'all' && "bg-accent"
                              )}
                              onClick={() => {
                                setSelectedCompany('all');
                                setCompanySearchQuery('');
                                setCompanyDialogOpen(false);
                              }}
                            >
                              No Company
                            </div>
                            {companies.map((company) => (
                              <div
                                key={company.id}
                                className={cn(
                                  "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                  selectedCompany === company.id && "bg-accent"
                                )}
                                onClick={() => {
                                  setSelectedCompany(company.id);
                                  setCompanySearchQuery('');
                                  setCompanyDialogOpen(false);
                                }}
                              >
                                {company.name}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                {/* Step 3: Bank Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="bg-muted text-muted-foreground w-6 h-6 rounded-full flex items-center justify-center text-sm">
                        3
                      </div>
                      Bank Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Bank Name</Label>
                      <Input
                        placeholder="Enter bank name"
                        value={newBank.name}
                        onChange={(e) => setNewBank(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        placeholder="Enter description"
                        value={newBank.description}
                        onChange={(e) => setNewBank(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Attributes Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Attributes</CardTitle>
                  <CardDescription>
                    Choose attributes and statements to include in your bank
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CreateAttributeBank
                    attributes={attributes}
                    selectedItems={selectedStatements}
                    onSelectedItemsChange={setSelectedStatements}
                    selectedIndustryFilter={selectedIndustryFilter}
                    onIndustryFilterChange={setSelectedIndustryFilter}
                    attributeSearchQuery={attributeSearchQuery}
                    onAttributeSearchQueryChange={setAttributeSearchQuery}
                  />
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setView('list')}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateBank} 
                  disabled={loading || selectedStatements.length === 0 || !newBank.name}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Bank
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'details' && selectedBank && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                setView('list');
                setSelectedBank(null);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Banks
            </Button>
          </div>
          <BankDetails 
            bank={selectedBank} 
            onRefresh={fetchBanks} 
            setSelectedBank={setSelectedBank}
            setIsEditDialogOpen={setIsEditDialogOpen}
          />
        </div>
      )}
      {isEditDialogOpen && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Attribute Bank</DialogTitle>
              <DialogDescription>
                Modify the bank details and statements
              </DialogDescription>
            </DialogHeader>
            {selectedBank && (
              <CreateAttributeBank
                isEditMode={true}
                initialData={{
                  id: selectedBank.id,
                  name: selectedBank.name,
                  description: selectedBank.description,
                  analysis_type_id: selectedBank.analysis_type_id,
                  status: selectedBank.status,
                  company_id: selectedBank.company_id,
                  statements: selectedBank.attribute_statements?.map(stmt => ({
                    id: stmt.id,
                    statement: stmt.statement,
                    attributeId: stmt.attribute_id,
                    attribute: stmt.attributes?.name || 'Unknown Attribute',
                    options: stmt.attribute_statement_options || []
                  })) || []
                }}
                attributes={attributes}
                industries={industries}
                companies={companies}
                selectedIndustry={selectedIndustryFilter}
                onIndustryChange={setSelectedIndustryFilter}
                onUpdate={handleBankUpdate}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BankDetails({ bank, onRefresh, setSelectedBank, setIsEditDialogOpen }) {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (bank?.id) {
      fetchBankStatements(bank);
    }
  }, [bank?.id]);

  const fetchBankStatements = async (bank) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attribute_statements')
        .select(`
          id,
          statement,
          created_at,
          attribute_id,
          attribute_bank_id,
          attributes!inner (
            id,
            name,
            description,
            analysis_type_id
          ),
          attribute_statement_options (
            id,
            option_text,
            weight
          )
        `)
        .eq('attribute_bank_id', bank.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const transformedStatements = data?.map(stmt => ({
        id: stmt.id,
        attributeName: stmt.attributes?.name,
        attributeDescription: stmt.attributes?.description,
        analysisType: stmt.attributes?.analysis_type_id,
        statement: stmt.statement,
        options: (stmt.attribute_statement_options || [])
          .sort((a, b) => b.weight - a.weight),
      })) || [];

      setStatements(transformedStatements);
    } catch (error) {
      console.error('Error fetching statements:', error);
      toast.error('Failed to fetch bank statements');
    } finally {
      setLoading(false);
    }
  };

  if (!bank) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{bank.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Company: {bank.companies?.name || 'No Company'}</span>
            <span>•</span>
            <span>Status: {bank.status}</span>
            <span>•</span>
            <span>Created: {new Date(bank.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Attribute Statements</h3>
        {loading ? (
          <div className="text-center py-4">Loading statements...</div>
        ) : (
          <Table className="border">
            <TableHeader>
              <TableRow className="border-b">
                <TableHead>Attribute Name</TableHead>
                <TableHead>Analysis Type</TableHead>
                <TableHead>Statement</TableHead>
                <TableHead>Options & Weights</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.length > 0 ? (
                statements.map((statement) => (
                  <TableRow key={statement.id} className="border-b">
                    <TableCell className="border-r">{statement.attributeName}</TableCell>
                    <TableCell className="border-r capitalize">{statement.analysisType}</TableCell>
                    <TableCell className="border-r">{statement.statement}</TableCell>
                    <TableCell className="border-r">
                      <div className="space-y-2">
                        {statement.options?.length > 0 ? (
                          statement.options.map((option) => (
                            <div key={option.id} className="flex justify-between items-center text-sm">
                              <span className="font-medium">{option.option_text}</span>
                              <span className="text-muted-foreground ml-2">{option.weight}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground">No options defined</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    No statements found in this bank
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{bank.name}"? This will permanently delete the bank and all its statements. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleDelete();
                setShowDeleteDialog(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BankList({ banks, onBankSelect, onRefresh, setSelectedBank, setIsEditDialogOpen, handleEditClick }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [bankToDelete, setBankToDelete] = useState(null);
  const [editingBank, setEditingBank] = useState(null);
  const [editedBankData, setEditedBankData] = useState({ 
    name: '', 
    description: '', 
    status: ''
  });

  const handleEdit = async () => {
    try {
      const { error } = await supabase
        .from('attribute_banks')
        .update({
          name: editedBankData.name,
          description: editedBankData.description,
          status: editedBankData.status,
          analysis_type_id: editedBankData.analysis_type_id
        })
        .eq('id', editingBank.id);

      if (error) throw error;

      toast.success('Bank updated successfully');
      setEditingBank(null);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating bank:', error);
      toast.error('Failed to update bank');
    }
  };

  const handleBankDelete = async (bankId) => {
    try {
      const bank = banks.find(b => b.id === bankId);
      if (bank?.status === 'active') {
        toast.error('Active banks cannot be deleted');
        return;
      }

      const { data: statements, error: stmtFetchError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_bank_id', bankId);

      if (stmtFetchError) throw stmtFetchError;

      if (statements?.length > 0) {
        const { error: optionsError } = await supabase
          .from('attribute_statement_options')
          .delete()
          .in('statement_id', statements.map(s => s.id));

        if (optionsError) throw optionsError;
      }

      const { error: statementsError } = await supabase
        .from('attribute_statements')
        .delete()
        .eq('attribute_bank_id', bankId);

      if (statementsError) throw statementsError;

      const { error: bankError } = await supabase
        .from('attribute_banks')
        .delete()
        .eq('id', bankId);

      if (bankError) throw bankError;

      toast.success('Bank and all related data deleted successfully');
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting bank:', error);
      toast.error('Failed to delete bank and its related data');
    }
  };

  return (
    <div className="space-y-4">
      {banks.map((bank) => (
        <Card key={bank.id} className="hover:bg-accent/50 transition-colors">
          {editingBank?.id === bank.id ? (
            <CardHeader>
              <div className="space-y-4">
                <div>
                  <Label>Bank Name</Label>
                  <Input
                    value={editedBankData.name}
                    onChange={(e) => setEditedBankData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter bank name"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={editedBankData.description}
                    onChange={(e) => setEditedBankData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter description"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editedBankData.status}
                    onValueChange={(value) => setEditedBankData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Analysis Type</Label>
                  <Select
                    value={editedBankData.analysis_type_id}
                    onValueChange={(value) => setEditedBankData(prev => ({ ...prev, analysis_type_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select analysis type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="behavior">Behavior</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingBank(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleEdit}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base">
                    {bank.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                      {
                        'bg-green-100 text-green-700': bank.status === 'active',
                        'bg-yellow-100 text-yellow-700': bank.status === 'draft'
                      }
                    )}>
                      {bank.status}
                    </span>
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                      {
                        'bg-blue-100 text-blue-700': bank.analysis_type_id === 'behavior',
                        'bg-purple-100 text-purple-700': bank.analysis_type_id === 'performance'
                      }
                    )}>
                      {bank.analysis_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {bank.companies?.name || 'No Company'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onBankSelect(bank);
                    }}
                    className="p-2 hover:bg-accent/50 rounded-md cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(bank);
                    }}
                    className="p-2 hover:bg-accent/50 rounded-md cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setBankToDelete(bank);
                      setShowDeleteDialog(true);
                    }}
                    className="p-2 hover:bg-accent/50 rounded-md cursor-pointer text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{bankToDelete?.name}"? This will permanently delete the bank and all its statements. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleBankDelete(bankToDelete?.id);
                setShowDeleteDialog(false);
                setBankToDelete(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {banks.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          No banks found
        </div>
      )}
    </div>
  );
}
