import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Pencil, Trash2, Plus, Loader2, ChevronDown } from "lucide-react";
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import cn from 'classnames';

export default function AttributeBank() {
  const { user } = useAuth();
  const [analysisType, setAnalysisType] = useState('behavior');
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
    analysis_type: 'behavior',
    company_id: null,
    is_industry_standard: false
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
  const itemsPerPage = 10;

  // Fetch companies data
  const fetchCompanies = useMemo(() => async () => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*');

      if (companiesError) throw companiesError;
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to fetch companies');
    }
  }, []);

  // Fetch attributes based on analysis type
  const fetchAttributes = useMemo(() => async (type) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attributes')
        .select(`
          *,
          attribute_statements (
            id,
            statement,
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          ),
          attribute_industry_mapping:attribute_industry_mapping (
            industry_id,
            industries (
              id,
              name
            )
          )
        `)
        .eq('analysis_type', type)
        .order('name', { ascending: true });

      if (error) throw error;
      setAttributes(data);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      toast.error('Failed to fetch attributes');
    } finally {
      setLoading(false);
    }
  }, []);

    const fetchanalysis =  async ()=>{
      try{
        const response = await supabase.from('analysis_type').select("*");
        setAnalysisTypeList(response.data);
        console.log(response.data);
      }catch(e){
        console.error(e);
      }
    }


  // Fetch companies on mount
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Fetch attributes when analysis type changes
  useEffect(() => {
    fetchAttributes(analysisType);
  }, [analysisType, fetchAttributes]);

  // Fetch banks on mount
  useEffect(() => {
    fetchBanks();
    fetchanalysis();
  }, []);

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('attribute_banks')
        .select(`
          *,
          company:companies (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBanks(data.map(bank => ({
        ...bank,
        company_name: bank.company?.name
      })));
    } catch (error) {
      console.error('Error fetching banks:', error);
      toast.error('Failed to fetch banks');
    } finally {
      setLoading(false);
    }
  };

  // Generate a unique bank name with incrementing 3-digit code
  const generateUniqueBankName = async () => {
    const { data: existingBanks } = await supabase
      .from('attribute_banks')
      .select('name')
      .ilike('name', 'New Bank%')
      .order('name', { ascending: false });

    let maxNumber = 0;
    existingBanks?.forEach(bank => {
      const match = bank.name.match(/New Bank -(\d{3})/);
      if (match) {
        const num = parseInt(match[1]);
        maxNumber = Math.max(maxNumber, num);
      }
    });

    return `New Bank -${String(maxNumber + 1).padStart(3, '0')}`;
  };

  const handleCreateBank = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to create a bank');
      }

      // Check if a bank with the same name exists
      const { data: existingBank, error: checkError } = await supabase
        .from('attribute_banks')
        .select('id')
        .eq('name', newBank.name)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing bank:', checkError);
        throw new Error('Failed to check for existing bank');
      }

      if (existingBank) {
        throw new Error('A bank with this name already exists');
      }

      // Create the bank
      const bankName = newBank.name || await generateUniqueBankName();
      const { data: bank, error: createError } = await supabase
        .from('attribute_banks')
        .insert({
          name: bankName,
          description: newBank.description || '',
          company_id: selectedCompany === 'all' ? null : selectedCompany,
          status: 'active',
          created_by: user?.id
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating bank:', createError);
        throw new Error('Failed to create bank');
      }

      if (!bank) {
        throw new Error('Failed to create bank - no data returned');
      }

      // Create attribute statements with their options
      for (const { statementId, attributeId } of selectedStatements) {
        // First, get the original statement and its options
        const { data: originalStatement, error: stmtError } = await supabase
          .from('attribute_statements')
          .select(`
            id,
            statement,
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          `)
          .eq('id', statementId)
          .single();

        if (stmtError) {
          console.error('Error fetching original statement:', stmtError);
          continue;
        }

        // Create new statement for the bank
        const { data: newStatement, error: newStmtError } = await supabase
          .from('attribute_statements')
          .insert({
            attribute_bank_id: bank.id,
            attribute_id: attributeId,
            statement: originalStatement.statement,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (newStmtError) {
          console.error('Error creating new statement:', newStmtError);
          continue;
        }

        // Copy over the options
        if (originalStatement.attribute_statement_options?.length > 0) {
          const newOptions = originalStatement.attribute_statement_options.map(opt => ({
            statement_id: newStatement.id,
            option_text: opt.option_text,
            weight: opt.weight
          }));

          const { error: optError } = await supabase
            .from('attribute_statement_options')
            .insert(newOptions);

          if (optError) {
            console.error('Error copying options:', optError);
          }
        }
      }

      toast.success('Bank created successfully');
      setNewBank({
        name: '',
        description: '',
        analysis_type: ''
      });
      setSelectedCompany('all');
      setSelectedStatements([]);
      setView('list');
      fetchBanks();
    } catch (error) {
      console.error('Error creating bank:', error);
      toast.error(error.message || 'Failed to create attribute bank');
    } finally {
      setLoading(false);
    }
  };

  const handleStatementSelect = (statementId, attributeId) => {
    setSelectedStatements(prev => {
      if (prev.some(s => s.statementId === statementId)) {
        return prev.filter(s => s.statementId !== statementId);
      }
      return [...prev, { statementId, attributeId }];
    });
  };

  // Get paginated items with flattened statements
  const paginatedItems = useMemo(() => {
    // First, flatten the attributes with their statements
    let flattenedItems = attributes.flatMap(attr => 
      attr.attribute_statements?.map(statement => ({
        ...attr,
        statement
      })) || []
    );

    // Apply filters
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
    
    // Then paginate the filtered array
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return flattenedItems.slice(startIndex, endIndex);
  }, [attributes, page, itemsPerPage, selectedIndustryFilter, selectedAttributeFilter, selectedStatementFilter]);

  // Calculate total pages based on flattened items
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

      // First get all statements for this bank
      const { data: statements, error: stmtFetchError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_bank_id', bankId);

      if (stmtFetchError) throw stmtFetchError;

      // Delete statement options for all statements
      if (statements?.length > 0) {
        const { error: optionsError } = await supabase
          .from('attribute_statement_options')
          .delete()
          .in('statement_id', statements.map(s => s.id));

        if (optionsError) throw optionsError;
      }

      // Then delete all statements
      const { error: statementsError } = await supabase
        .from('attribute_statements')
        .delete()
        .eq('attribute_bank_id', bankId);

      if (statementsError) throw statementsError;

      // Finally delete the bank
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

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Banks List */}
      <div className="w-80 border-r p-6 space-y-4 bg-background">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Attribute Banks</h2>
          <Button
            onClick={() => setView('create')}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            New Bank
          </Button>
        </div>
        <div className="space-y-3">
          {banks.map((bank) => (
            <div
              key={bank.id}
              className="relative group rounded-lg border border-border/50 hover:border-purple-200 hover:shadow-md transition-all duration-200 cursor-pointer bg-white"
            >
              <div className="p-4" onClick={() => setView(`bank-${bank.id}`)}>
                <h3 className="font-medium text-sm text-purple-800">
                  {bank.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {bank.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    bank.status === 'active' ? "bg-green-100 text-green-700" :
                    bank.status === 'archived' ? "bg-gray-100 text-gray-700" :
                    "bg-yellow-100 text-yellow-700"
                  )}>
                    {bank.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {bank.company_name || 'No Company'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {banks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No banks found
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {view === 'create' && (
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
                    onValueChange={(value) => {
                      setAnalysisType(value);
                      setNewBank(prev => ({ ...prev, analysis_type: value }));
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select analysis type" />
                    </SelectTrigger>
                    <SelectContent>
                   {
                    analysisTypeList && analysisTypeList.map((item)=>(     
                          <SelectItem key={item.analysis_type} value={item.analysis_type}>{item.analysis_type}</SelectItem>
                    ))
                    }
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
                        {selectedCompany 
                          ? (companies.find(c => c.id === selectedCompany)?.name || 'Loading...')
                          : 'Select Company'}
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
                        <Label>Search Companies</Label>
                        <Input
                          type="text"
                          placeholder="Type to search..."
                          value={companySearchQuery}
                          onChange={(e) => setCompanySearchQuery(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <ScrollArea className="h-[300px] p-4">
                        <div className="space-y-2">
                          <div
                            className={cn(
                              "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                              !selectedCompany && "bg-accent"
                            )}
                            onClick={() => {
                              setSelectedCompany(null);
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
                          {companies.length === 0 && companySearchQuery && (
                            <div className="text-sm text-muted-foreground text-center py-6">
                              No companies found
                            </div>
                          )}
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
                  <Input
                    placeholder="Bank Name"
                    value={newBank.name}
                    onChange={(e) => setNewBank(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Description"
                    value={newBank.description}
                    onChange={(e) => setNewBank(prev => ({ ...prev, description: e.target.value }))}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Attributes Table */}
            <Card>
              <CardHeader>
                <CardTitle>Available Attributes</CardTitle>
                <CardDescription>
                  Select attributes to include in your bank
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle>Search and Filters</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {attributes.length} attributes • {attributes.reduce((total, attr) => total + (attr.attribute_statements?.length || 0), 0)} statements
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Filter by Industry</Label>
                          <Dialog open={industryDialogOpen} onOpenChange={setIndustryDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full justify-between mt-1">
                                {selectedIndustryFilter === 'all' 
                                  ? "All Industries" 
                                  : attributes.find(a => 
                                      a.attribute_industry_mapping?.some(mapping => 
                                        mapping.industry_id === selectedIndustryFilter
                                      )
                                    )?.attribute_industry_mapping?.find(m => 
                                      m.industry_id === selectedIndustryFilter
                                    )?.industries?.name || "Select Industry"}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Select Industry</DialogTitle>
                                <DialogDescription>
                                  Search and select an industry to filter by
                                </DialogDescription>
                              </DialogHeader>
                              <div className="p-2">
                                <Input
                                  type="text"
                                  placeholder="Search industries..."
                                  value={industrySearchQuery}
                                  onChange={(e) => setIndustrySearchQuery(e.target.value)}
                                  className="mt-2"
                                />
                              </div>
                              <ScrollArea className="h-[300px] p-4">
                                <div className="space-y-2">
                                  <div
                                    className={cn(
                                      "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                      selectedIndustryFilter === 'all' && "bg-accent"
                                    )}
                                    onClick={() => {
                                      setSelectedIndustryFilter('all');
                                      setIndustryDialogOpen(false);
                                    }}
                                  >
                                    All Industries
                                  </div>
                                  {Array.from(new Set(attributes.flatMap(attr => 
                                    attr.attribute_industry_mapping?.map(m => ({
                                      id: m.industry_id,
                                      name: m.industries?.name
                                    })) || []
                                  ))).filter(industry => 
                                    industry.name?.toLowerCase().includes(industrySearchQuery.toLowerCase())
                                  ).map((industry) => (
                                    <div
                                      key={industry.id}
                                      className={cn(
                                        "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                        selectedIndustryFilter === industry.id && "bg-accent"
                                      )}
                                      onClick={() => {
                                        setSelectedIndustryFilter(industry.id);
                                        setIndustryDialogOpen(false);
                                      }}
                                    >
                                      {industry.name}
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </div>

                        <div>
                          <Label>Filter by Attribute</Label>
                          <Dialog open={attributeDialogOpen} onOpenChange={setAttributeDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full justify-between mt-1">
                                {selectedAttributeFilter === 'all'
                                  ? "All Attributes"
                                  : attributes.find(a => a.id === selectedAttributeFilter)?.name || "Select Attribute"}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Select Attribute</DialogTitle>
                                <DialogDescription>
                                  Search and select an attribute to filter by
                                </DialogDescription>
                              </DialogHeader>
                              <div className="p-2">
                                <Input
                                  type="text"
                                  placeholder="Search attributes..."
                                  value={attributeSearchQuery}
                                  onChange={(e) => setAttributeSearchQuery(e.target.value)}
                                  className="mt-2"
                                />
                              </div>
                              <ScrollArea className="h-[300px] p-4">
                                <div className="space-y-2">
                                  <div
                                    className={cn(
                                      "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                      selectedAttributeFilter === 'all' && "bg-accent"
                                    )}
                                    onClick={() => {
                                      setSelectedAttributeFilter('all');
                                      setAttributeDialogOpen(false);
                                    }}
                                  >
                                    All Attributes
                                  </div>
                                  {attributes
                                    .filter(attr => 
                                      attr.name.toLowerCase().includes(attributeSearchQuery.toLowerCase())
                                    )
                                    .map((attr) => (
                                      <div
                                        key={attr.id}
                                        className={cn(
                                          "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                          selectedAttributeFilter === attr.id && "bg-accent"
                                        )}
                                        onClick={() => {
                                          setSelectedAttributeFilter(attr.id);
                                          setAttributeDialogOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="truncate" title={attr.name}>
                                            {attr.name}
                                          </span>
                                          <span className="text-xs text-muted-foreground truncate" title={attr.description}>
                                            {attr.description}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </div>

                        <div>
                          <Label>Filter by Statement</Label>
                          <Dialog open={statementDialogOpen} onOpenChange={setStatementDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full justify-between mt-1">
                                {selectedStatementFilter === 'all'
                                  ? "All Statements"
                                  : attributes
                                      .flatMap(attr => attr.attribute_statements || [])
                                      .find(stmt => stmt.id === selectedStatementFilter)?.statement || "Select Statement"}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Select Statement</DialogTitle>
                                <DialogDescription>
                                  Search and select a statement to filter by
                                </DialogDescription>
                              </DialogHeader>
                              <div className="p-2">
                                <Input
                                  type="text"
                                  placeholder="Search statements..."
                                  value={statementSearchQuery}
                                  onChange={(e) => setStatementSearchQuery(e.target.value)}
                                  className="mt-2"
                                />
                              </div>
                              <ScrollArea className="h-[300px] p-4">
                                <div className="space-y-2">
                                  <div
                                    className={cn(
                                      "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                      selectedStatementFilter === 'all' && "bg-accent"
                                    )}
                                    onClick={() => {
                                      setSelectedStatementFilter('all');
                                      setStatementDialogOpen(false);
                                    }}
                                  >
                                    All Statements
                                  </div>
                                  {attributes
                                    .flatMap(attr => 
                                      (attr.attribute_statements || [])
                                        .filter(stmt => stmt.statement && 
                                          stmt.statement.toLowerCase().includes(statementSearchQuery.toLowerCase())
                                        )
                                        .map(stmt => ({
                                          id: stmt.id,
                                          statement: stmt.statement,
                                          attributeName: attr.name
                                        }))
                                    )
                                    .map((stmt) => (
                                      <div
                                        key={stmt.id}
                                        className={cn(
                                          "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                          selectedStatementFilter === stmt.id && "bg-accent"
                                        )}
                                        onClick={() => {
                                          setSelectedStatementFilter(stmt.id);
                                          setStatementDialogOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col gap-0.5">
                                          <span className="truncate" title={stmt.statement}>
                                            {stmt.statement}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {stmt.attributeName}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      {(selectedIndustryFilter !== 'all' || selectedAttributeFilter !== 'all' || selectedStatementFilter !== 'all') && (
                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedIndustryFilter('all');
                              setSelectedAttributeFilter('all');
                              setSelectedStatementFilter('all');
                            }}
                          >
                            Clear Filters
                          </Button>
                          <div className="text-sm text-muted-foreground pt-1.5">
                            {paginatedItems.length} results found
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Table className="border w-full min-w-[1200px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox />
                        </TableHead>
                        <TableHead className="border-r font-semibold w-[120px]">Attribute</TableHead>
                        <TableHead className="border-r font-semibold w-[180px]">Statement</TableHead>
                        <TableHead className="border-r font-semibold w-[200px]">Options & Weights</TableHead>
                        <TableHead className="border-r font-semibold w-[50px]">Weight</TableHead>
                        <TableHead className="border-r font-semibold w-32">Industry</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            <Loader2 className="h-6 w-6 mx-auto animate-spin" />
                          </TableCell>
                        </TableRow>
                      ) : attributes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No attributes found for {analysisType} analysis type
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedItems.map((item) => (
                          <TableRow key={`${item.id}-${item.statement.id}`}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedStatements.some(s => s.statementId === item.statement.id)}
                                onCheckedChange={() => handleStatementSelect(item.statement.id, item.id)}
                              />
                            </TableCell>
                            <TableCell className="border-r font-medium">
                              <div className="font-semibold">{item.name}</div>
                              <div className="text-sm text-muted-foreground">{item.description}</div>
                            </TableCell>
                            <TableCell className="border-r">
                              {item.statement.statement || 'No statement'}
                            </TableCell>
                            <TableCell className="border-r">
                              {item.statement.attribute_statement_options?.map((option, idx) => (
                                <div 
                                  key={`${item.statement.id}-${option.id || idx}`}
                                  className={`p-2 ${
                                    idx !== item.statement.attribute_statement_options.length - 1 
                                      ? 'border-b border-gray-200' 
                                      : ''
                                  }`}
                                >
                                  {option.option_text}: {option.weight}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="border-r">
                              {item.statement.attribute_statement_options?.map((option, idx) => (
                                <div 
                                  key={`${item.statement.id}-${option.id || idx}-weight`}
                                  className={`p-2 ${
                                    idx !== item.statement.attribute_statement_options.length - 1 
                                      ? 'border-b border-gray-200' 
                                      : ''
                                  }`}
                                >
                                  {option.weight}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="border-r">
                              {item.attribute_industry_mapping?.map((mapping, idx) => (
                                <div key={`${item.id}-${mapping.industry_id}`}>
                                  {mapping.industries?.name}
                                </div>
                              ))}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {attributes.length > 0 && (
                  <div className="flex justify-center mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setPage(pageNum)}
                              isActive={page === pageNum}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setView('list');
                  setNewBank({
                    name: '',
                    description: '',
                    analysis_type: 'behavior'
                  });
                  setSelectedCompany('all');
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!analysisType || loading}
                onClick={handleCreateBank}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Bank'
                )}
              </Button>
            </div>
          </div>
        )}
        {view === 'list' && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a bank to view details or create a new one
          </div>
        )}

        {view.startsWith('bank-') && (
          <BankDetails 
            bank={banks.find(b => `bank-${b.id}` === view)} 
            onRefresh={fetchBanks}
          />
        )}
      </div>
    </div>
  );
}

function BankDetails({ bank, onRefresh }) {
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [editedBank, setEditedBank] = useState({
    name: bank?.name || '',
    description: bank?.description || '',
    status: bank?.status || '',
    company_id: bank?.company_id || 'none'
  });

  useEffect(() => {
    if (bank?.id) {
      fetchBankStatements(bank);
      fetchCompanies();
      setEditedBank({
        name: bank.name || '',
        description: bank.description || '',
        status: bank.status || '',
        company_id: bank.company_id || 'none'
      });
    }
  }, [bank?.id]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to fetch companies');
    }
  };

  const handleEdit = async () => {
    try {
      const { error } = await supabase
        .from('attribute_banks')
        .update({
          name: editedBank.name,
          description: editedBank.description,
          status: editedBank.status,
          company_id: editedBank.company_id === 'none' ? null : editedBank.company_id
        })
        .eq('id', bank.id);

      if (error) throw error;

      toast.success('Bank updated successfully');
      setEditMode(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating bank:', error);
      toast.error('Failed to update bank');
    }
  };

  const handleDelete = async () => {
    try {
      if (bank.status === 'active') {
        toast.error('Active banks cannot be deleted');
        return;
      }

      // First get all statements for this bank
      const { data: statements, error: stmtFetchError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_bank_id', bank.id);

      if (stmtFetchError) throw stmtFetchError;

      // Delete statement options for all statements
      if (statements?.length > 0) {
        const { error: optionsError } = await supabase
          .from('attribute_statement_options')
          .delete()
          .in('statement_id', statements.map(s => s.id));

        if (optionsError) throw optionsError;
      }

      // Then delete all statements
      const { error: statementsError } = await supabase
        .from('attribute_statements')
        .delete()
        .eq('attribute_bank_id', bank.id);

      if (statementsError) throw statementsError;

      // Finally delete the bank
      const { error: bankError } = await supabase
        .from('attribute_banks')
        .delete()
        .eq('id', bank.id);

      if (bankError) throw bankError;

      toast.success('Bank and all related data deleted successfully');
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting bank:', error);
      toast.error('Failed to delete bank and its related data');
    }
  };

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
            analysis_type,
            is_industry_standard
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
        analysisType: stmt.attributes?.analysis_type,
        statement: stmt.statement,
        options: (stmt.attribute_statement_options || [])
          .sort((a, b) => b.weight - a.weight), // Sort by weight in descending order
        isIndustryStandard: stmt.attributes?.is_industry_standard
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
          {editMode ? (
            <div className="space-y-4">
              <div>
                <Label>Bank Name</Label>
                <Input
                  value={editedBank.name}
                  onChange={(e) => setEditedBank(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter bank name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={editedBank.description}
                  onChange={(e) => setEditedBank(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                />
              </div>
              <div>
                <Label>Company</Label>
                <Select
                  value={editedBank.company_id}
                  onValueChange={(value) => setEditedBank(prev => ({ 
                    ...prev, 
                    company_id: value 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">None</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editedBank.status}
                  onValueChange={(value) => setEditedBank(prev => ({ ...prev, status: value }))}
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(false)}
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
          ) : (
            <>
              <h2 className="text-2xl font-bold">{bank.name}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Company: {bank.company_name || 'No Company'}</span>
                <span>•</span>
                <span>Status: {bank.status}</span>
                <span>•</span>
                <span>Created: {new Date(bank.created_at).toLocaleDateString()}</span>
              </div>
            </>
          )}
        </div>
        {!editMode && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
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
                <TableHead>Industry Standard</TableHead>
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
                              <span className="text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                                {option.weight}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground">No options defined</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{statement.isIndustryStandard ? "Yes" : "No"}</TableCell>
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

function BankList({ banks, onBankSelect, onRefresh }) {
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
          status: editedBankData.status
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

      // First get all statements for this bank
      const { data: statements, error: stmtFetchError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_bank_id', bankId);

      if (stmtFetchError) throw stmtFetchError;

      // Delete statement options for all statements
      if (statements?.length > 0) {
        const { error: optionsError } = await supabase
          .from('attribute_statement_options')
          .delete()
          .in('statement_id', statements.map(s => s.id));

        if (optionsError) throw optionsError;
      }

      // Then delete all statements
      const { error: statementsError } = await supabase
        .from('attribute_statements')
        .delete()
        .eq('attribute_bank_id', bankId);

      if (statementsError) throw statementsError;

      // Finally delete the bank
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
                    <span className="text-xs text-muted-foreground">
                      {bank.company_name || 'No Company'}
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
                      setEditingBank(bank);
                      setEditedBankData({
                        name: bank.name,
                        description: bank.description,
                        status: bank.status || ''
                      });
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

function NewBankForm({ onClose, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [bank, setBank] = useState({
    name: '',
    description: '',
    status: '',
    company_id: null
  });

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to fetch companies');
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!companySearchQuery) return companies;
    return companies.filter(company => 
      company.name.toLowerCase().includes(companySearchQuery.toLowerCase())
    );
  }, [companies, companySearchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('attribute_banks')
        .insert({
          name: bank.name,
          description: bank.description,
          status: bank.status,
          company_id: bank.company_id
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Bank created successfully');
      setBank({
        name: '',
        description: '',
        status: '',
        company_id: null
      });
      onClose();
      onRefresh();
    } catch (error) {
      console.error('Error creating bank:', error);
      toast.error('Failed to create bank');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Bank Name</Label>
        <Input
          id="name"
          value={bank.name}
          onChange={(e) => setBank(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter bank name"
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={bank.description}
          onChange={(e) => setBank(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Enter description"
        />
      </div>
      <div className="space-y-2">
        <Label>Company</Label>
        <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              role="combobox"
              onClick={() => setCompanyDialogOpen(true)}
            >
              {bank.company_id 
                ? (companies.find(c => c.id === bank.company_id)?.name || 'Loading...')
                : 'Select Company'}
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
              <Label>Search Companies</Label>
              <Input
                type="text"
                placeholder="Type to search..."
                value={companySearchQuery}
                onChange={(e) => setCompanySearchQuery(e.target.value)}
                className="mt-2"
              />
            </div>
            <ScrollArea className="h-[300px] p-4">
              <div className="space-y-2">
                <div
                  className={cn(
                    "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                    !bank.company_id && "bg-accent"
                  )}
                  onClick={() => {
                    setBank(prev => ({ ...prev, company_id: null }));
                    setCompanySearchQuery('');
                    setCompanyDialogOpen(false);
                  }}
                >
                  No Company
                </div>
                {filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className={cn(
                      "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                      bank.company_id === company.id && "bg-accent"
                    )}
                    onClick={() => {
                      setBank(prev => ({ ...prev, company_id: company.id }));
                      setCompanySearchQuery('');
                      setCompanyDialogOpen(false);
                    }}
                  >
                    {company.name}
                  </div>
                ))}
                {filteredCompanies.length === 0 && companySearchQuery && (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    No companies found
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
      <div>
        <Label>Status</Label>
        <Select
          value={bank.status}
          onValueChange={(value) => setBank(prev => ({ ...prev, status: value }))}
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
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Bank
        </Button>
      </div>
    </div>
  );
}

function CreateBank({ companies, onSuccess }) {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState({ name: '' });
  const [analysisType, setAnalysisType] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankDescription, setBankDescription] = useState('');
  const [availableStatements, setAvailableStatements] = useState([]);
  const [selectedStatements, setSelectedStatements] = useState([]);
  const [customStatements, setCustomStatements] = useState([]);
  const [existingAttributes, setExistingAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [includeCustomStatements, setIncludeCustomStatements] = useState(false);
  const [selectedFilterIndustry, setSelectedFilterIndustry] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [attributeSearchQuery, setAttributeSearchQuery] = useState("");
  const [industrySearchQuery, setIndustrySearchQuery] = useState("");
  const itemsPerPage = 10;

  const filteredCompanies = useMemo(() => {
    if (!companySearchQuery) return companies;
    return companies.filter(company => 
      company.name.toLowerCase().includes(companySearchQuery.toLowerCase())
    );
  }, [companies, companySearchQuery]);

  const filteredAttributes = useMemo(() => {
    return existingAttributes.filter(attr => 
      attr.name.toLowerCase().includes(attributeSearchQuery.toLowerCase()) ||
      attr.analysis_type.toLowerCase().includes(attributeSearchQuery.toLowerCase())
    );
  }, [existingAttributes, attributeSearchQuery]);

  const filteredIndustries = useMemo(() => {
    return industries.filter(industry => 
      industry.name.toLowerCase().includes(industrySearchQuery.toLowerCase())
    );
  }, [industries, industrySearchQuery]);

  const handleCompanyChange = async (companyId) => {
    setSelectedCompany(companyId);
    const selectedComp = companies.find(c => c.id === companyId);
    if (selectedComp) {
      setCompanyIndustry(selectedComp.industry || { name: 'No industry assigned' });
    }
  };

  const handleAnalysisTypeChange = (value) => {
    setAnalysisType(value);
    setSelectedStatements([]);
    setCustomStatements([]);
  };

  const handleStatementSelect = (statementId, attributeId) => {
    setSelectedStatements(prev => {
      if (prev.some(s => s.statementId === statementId)) {
        return prev.filter(s => s.statementId !== statementId);
      }
      return [...prev, { statementId, attributeId }];
    });
  };

  const addCustomStatement = () => {
    const newStatement = {
      id: Date.now(),
      isNewAttribute: false,
      attributeId: '',
      newAttributeName: '',
      newAttributeDescription: '',
      statement: '',
    };
    setCustomStatements([...customStatements, newStatement]);
  };

  const updateCustomStatement = (id, field, value) => {
    setCustomStatements(prev =>
      prev.map(stmt =>
        stmt.id === id ? { ...stmt, [field]: value } : stmt
      )
    );
  };

  const toggleAttributeType = (id) => {
    setCustomStatements(prev => prev.map(stmt => {
      if (stmt.id === id) {
        return {
          ...stmt,
          isNewAttribute: !stmt.isNewAttribute,
          // Reset values when toggling
          attributeId: '',
          newAttributeName: '',
          newAttributeDescription: ''
        };
      }
      return stmt;
    }));
  };

  const removeCustomStatement = (id) => {
    setCustomStatements(prev => prev.filter(stmt => stmt.id !== id));
  };

  const isFormValid = selectedCompany && 
                     analysisType && 
                     bankName.trim() && 
                     bankDescription.trim() && 
                     selectedStatements.length > 0;

  const handleCreateBank = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to create a bank');
      }

      // Check if a bank with the same name exists
      const { data: existingBank, error: checkError } = await supabase
        .from('attribute_banks')
        .select('id')
        .eq('name', bankName)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing bank:', checkError);
        throw new Error('Failed to check for existing bank');
      }

      if (existingBank) {
        throw new Error('A bank with this name already exists');
      }

      // Create the bank
      const { data: bank, error: createError } = await supabase
        .from('attribute_banks')
        .insert({
          type: analysisType,
          name: bankName.trim(),
          description: bankDescription.trim(),
          company_id: selectedCompany || null,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating bank:', createError);
        throw new Error('Failed to create bank');
      }

      if (!bank) {
        throw new Error('Failed to create bank - no data returned');
      }

      // Create attribute statements with their options
      for (const { statementId, attributeId } of selectedStatements) {
        // First, get the original statement and its options
        const { data: originalStatement, error: stmtError } = await supabase
          .from('attribute_statements')
          .select(`
            id,
            statement,
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          `)
          .eq('id', statementId)
          .single();

        if (stmtError) {
          console.error('Error fetching original statement:', stmtError);
          continue;
        }

        // Create new statement for the bank
        const { data: newStatement, error: newStmtError } = await supabase
          .from('attribute_statements')
          .insert({
            attribute_bank_id: bank.id,
            attribute_id: attributeId,
            statement: originalStatement.statement,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (newStmtError) {
          console.error('Error creating new statement:', newStmtError);
          continue;
        }

        // Copy over the options
        if (originalStatement.attribute_statement_options?.length > 0) {
          const newOptions = originalStatement.attribute_statement_options.map(opt => ({
            statement_id: newStatement.id,
            option_text: opt.option_text,
            weight: opt.weight
          }));

          const { error: optError } = await supabase
            .from('attribute_statement_options')
            .insert(newOptions);

          if (optError) {
            console.error('Error copying options:', optError);
          }
        }
      }

      toast.success('Bank created successfully');
      
      // Reset form
      setBankName('');
      setBankDescription('');
      setSelectedCompany('');
      setAnalysisType('');
      setSelectedStatements([]);
      setCustomStatements([]);
      
      // Notify parent of success
      onSuccess();
      
    } catch (error) {
      console.error('Create bank error:', error);
      toast.error(error.message || 'Failed to create attribute bank');
    } finally {
      setLoading(false);
    }
  };

  // Fetch statements based on filters and analysis type
  useEffect(() => {
    if (!analysisType) {
      setAvailableStatements([]);
      return;
    }

    const fetchStatements = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('attributes')
          .select(`
            *,
            attribute_statements (
              id,
              statement,
              attribute_statement_options (
                id,
                option_text,
                weight
              )
            ),
            attribute_industry_mapping (
              industry_id,
              industries (
                id,
                name
              )
            )
          `)
          .eq('analysis_type', analysisType)
          .order('name', { ascending: true });

        // Apply industry filter if selected and not "all"
        if (selectedFilterIndustry && selectedFilterIndustry !== 'all') {
          query = query.eq('attribute_industry_mapping.industry_id', selectedFilterIndustry);
        }

        // Apply custom statements filter
        if (!includeCustomStatements) {
          query = query.eq('is_industry_standard', true);
        } else {
          query = query.or(`company_id.is.null,company_id.eq.${selectedCompany}`);
        }

        const { data: attributes, error: attrError } = await query;

        if (attrError) {
          console.error('Error fetching attributes:', attrError);
          throw attrError;
        }

        // Transform the data to match our table structure
        const transformedData = attributes?.map(attr => ({
          id: attr.id,
          name: attr.name,
          description: attr.description,
          analysis_type: attr.analysis_type,
          attribute_statements: attr.attribute_statements,
          attribute_industry_mapping: attr.attribute_industry_mapping,
          is_industry_standard: attr.is_industry_standard
        })) || [];

        setAvailableStatements(transformedData);
        
      } catch (error) {
        console.error('Error:', error);
        toast.error('Failed to fetch statements');
      } finally {
        setLoading(false);
      }
    };

    fetchStatements();
  }, [analysisType, selectedCompany, includeCustomStatements, selectedFilterIndustry]);

  // Fetch industries for filter
  useEffect(() => {
    const fetchIndustries = async () => {
      const { data, error } = await supabase
        .from('industries')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error fetching industries:', error);
        toast.error('Failed to load industries');
        return;
      }

      setIndustries(data || []);
    };

    fetchIndustries();
  }, []);

  // Fetch existing attributes
  useEffect(() => {
    const fetchExistingAttributes = async () => {
      try {
        const { data, error } = await supabase
          .from('attributes')
          .select('id, name, analysis_type')
          .order('name');

        if (error) throw error;
        setExistingAttributes(data || []);
      } catch (error) {
        console.error('Error fetching attributes:', error);
        toast.error('Failed to load existing attributes');
      }
    };

    fetchExistingAttributes();
  }, []);

  // Pagination
  const totalPages = Math.ceil(availableStatements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStatements = availableStatements.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary">Create Attribute Bank</h1>
      </div>

      {/* Steps Container */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Step 1 */}
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Company</Label>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    role="combobox"
                  >
                    {selectedCompany 
                      ? (companies.find(c => c.id === selectedCompany)?.name || 'Loading...')
                      : 'Select Company'}
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
                    <Label>Search Companies</Label>
                    <Input
                      type="text"
                      placeholder="Type to search..."
                      value={companySearchQuery}
                      onChange={(e) => setCompanySearchQuery(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <ScrollArea className="h-[300px] p-4">
                    <div className="space-y-2">
                      <div
                        className={cn(
                          "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                          !selectedCompany && "bg-accent"
                        )}
                        onClick={() => {
                          setSelectedCompany(null);
                          setCompanySearchQuery('');
                        }}
                      >
                        No Company
                      </div>
                      {filteredCompanies.map((company) => (
                        <div
                          key={company.id}
                          className={cn(
                            "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                            selectedCompany === company.id && "bg-accent"
                          )}
                          onClick={() => {
                            setSelectedCompany(company.id);
                            setCompanySearchQuery('');
                          }}
                        >
                          {company.name}
                        </div>
                      ))}
                      {filteredCompanies.length === 0 && companySearchQuery && (
                        <div className="text-sm text-muted-foreground text-center py-6">
                          No companies found
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              <Label>Industry</Label>
              <Input 
                value={companyIndustry?.name || 'No industry assigned'}
                readOnly
                className="text-foreground"
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Analysis Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Analysis Type</Label>
              <Select
                value={analysisType}
                onValueChange={handleAnalysisTypeChange}
                disabled={!selectedCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select analysis type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="behavior">Behavior Analysis</SelectItem>
                  <SelectItem value="leadership">Leadership Analysis</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Bank Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input 
                placeholder="Enter bank name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                placeholder="Enter bank description"
                value={bankDescription}
                onChange={(e) => setBankDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Industry Filter */}
            <div>
              <Label className="text-sm font-medium mb-1.5">Filter by Industry</Label>
              <Select
                value={selectedFilterIndustry || "all"}
                onValueChange={(value) => setSelectedFilterIndustry(value)}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select Industry" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search industries..."
                      value={industrySearchQuery}
                      onChange={(e) => setIndustrySearchQuery(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">All Industries</SelectItem>
                    {filteredIndustries.map((industry) => (
                      <SelectItem key={industry.id} value={industry.id}>
                        {industry.name}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Statements Filter */}
            <div className="flex items-center gap-2">
              <div className="flex-grow">
                <Label className="text-sm font-medium mb-1.5">Custom Statements</Label>
                <div className="flex items-center mt-2">
                  <Checkbox
                    id="customStatements"
                    checked={includeCustomStatements}
                    onCheckedChange={(checked) => setIncludeCustomStatements(checked)}
                    className="h-5 w-5 border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <Label 
                    htmlFor="customStatements" 
                    className="font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ml-2 text-sm text-primary"
                  >
                    Include Custom Statements
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statements Section */}
      {analysisType && (
        <Card className="border rounded-lg">
          <CardContent className="p-0">
            <div className="relative w-full overflow-x-auto">
              <Table className="border w-full min-w-[1200px]">
                <TableHeader>
                  <TableRow className="border-b bg-muted/50">
                    <TableHead className="border-r font-semibold w-[50px] text-center">
                      <Checkbox 
                        checked={selectedStatements.length === availableStatements.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStatements(availableStatements.map(s => ({ statementId: s.id, attributeId: s.attribute_id })));
                          } else {
                            setSelectedStatements([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="border-r font-semibold w-[120px]">Analysis Type</TableHead>
                    <TableHead className="border-r font-semibold w-[180px]">Attribute Name</TableHead>
                    <TableHead className="border-r font-semibold min-w-[300px]">Statements</TableHead>
                    <TableHead className="border-r font-semibold w-[200px]">Options & Weights</TableHead>
                    <TableHead className="border-r font-semibold w-[150px]">Industry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {console.log('Current statements in render:', availableStatements)}
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        Loading attributes...
                      </TableCell>
                    </TableRow>
                  ) : availableStatements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No attributes found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentStatements.map((item) => (
                      item.attribute_statements?.map((statement, stmtIndex) => (
                        <TableRow key={`${item.id}-${statement.id}`} className="border-b hover:bg-muted/50">
                          <TableCell className="border-r text-center">
                            <Checkbox
                              checked={selectedStatements.some(s => s.statementId === statement.id)}
                              onCheckedChange={() => handleStatementSelect(statement.id, item.id)}
                            />
                          </TableCell>
                          <TableCell className="border-r">
                            <span className="capitalize">{item.analysis_type}</span>
                          </TableCell>
                          <TableCell className="border-r font-medium">
                            <div className="font-semibold">{item.name}</div>
                            <div className="text-sm text-muted-foreground break-words">{item.description}</div>
                          </TableCell>
                          <TableCell className="border-r whitespace-normal">
                            {statement.statement || 'No statement'}
                          </TableCell>
                          <TableCell className="border-r whitespace-normal">
                            <div className="space-y-1">
                              {statement.attribute_statement_options?.sort((a, b) => b.weight - a.weight).map((option) => (
                                <div key={option.id} className="flex justify-between text-sm">
                                  <span>{option.option_text}</span>
                                  <span className="text-muted-foreground ml-2">{option.weight}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="border-r">
                            {item.attribute_industry_mapping?.map((mapping, idx) => (
                              <div key={`${item.id}-${mapping.industry_id}`}>
                                {mapping.industries?.name}
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      ))
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                <PaginationItem key={pageNumber}>
                  <PaginationLink 
                    onClick={() => setCurrentPage(pageNumber)}
                    isActive={currentPage === pageNumber}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      {/* Custom Statements Section */}
      <div className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Custom Statements</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={addCustomStatement}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Statement
          </Button>
        </div>

        <div className="space-y-4">
          {customStatements.map((stmt, index) => (
            <div key={stmt.id} className="grid gap-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Custom Statement {index + 1}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomStatement(stmt.id)}
                >
                  Remove
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label>Attribute</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAttributeType(stmt.id)}
                  >
                    {stmt.isNewAttribute ? 'Use Existing' : 'Create New'}
                  </Button>
                </div>

                {stmt.isNewAttribute ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>New Attribute Name</Label>
                      <Input
                        placeholder="Enter attribute name"
                        value={stmt.newAttributeName}
                        onChange={(e) => updateCustomStatement(stmt.id, 'newAttributeName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>New Attribute Description</Label>
                      <Input
                        placeholder="Enter attribute description"
                        value={stmt.newAttributeDescription}
                        onChange={(e) => updateCustomStatement(stmt.id, 'newAttributeDescription', e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select
                      value={stmt.attributeId}
                      onValueChange={(value) => updateCustomStatement(stmt.id, 'attributeId', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select attribute" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Search attributes..."
                            value={attributeSearchQuery}
                            onChange={(e) => setAttributeSearchQuery(e.target.value)}
                            className="mb-2"
                          />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto">
                          {filteredAttributes.map((attr) => (
                            <SelectItem key={attr.id} value={attr.id}>
                              {attr.name} ({attr.analysis_type})
                            </SelectItem>
                          ))}
                        </div>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Statement</Label>
                  <Input
                    placeholder="Enter statement"
                    value={stmt.statement}
                    onChange={(e) => updateCustomStatement(stmt.id, 'statement', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Create Bank Button */}
      <div className="flex justify-end mt-6">
        <Button 
          className="w-[200px]"
          disabled={!isFormValid || loading}
          onClick={handleCreateBank}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Bank'
          )}
        </Button>
      </div>
    </div>
  );
}
