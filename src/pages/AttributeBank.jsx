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
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Plus, Loader2, ChevronDown } from "lucide-react";
import { toast } from 'sonner';
import { CreateAttributeBank } from "@/components/banks/CreateAttributeBank";
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

export default function AttributeBank() {
  const { user } = useAuth();
  
  // All state declarations
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
  const [selectedBank, setSelectedBank] = useState(null);
  const [industries, setIndustries] = useState([]);
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
      const { data, error } = await supabase.from('analysis_type').select("*");
      
      if (error) throw error;
      
      // Filter out any items with empty or null analysis_type
      const validAnalysisTypes = data?.filter(item => 
        item && 
        item.analysis_type && 
        typeof item.analysis_type === 'string' && 
        item.analysis_type.trim() !== ''
      ) || [];
      
      setAnalysisTypeList(validAnalysisTypes);
    } catch (e) {
      console.error('Error fetching analysis types:', e);
      toast.error('Failed to fetch analysis types');
    }
  };

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

  // Memoized functions
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

  const fetchAttributes = useMemo(() => async (type) => {
    try {
      setLoading(true);
      let query = supabase
        .from('attributes')
        .select(`
          *,
          attribute_statements!inner (
            id,
            statement,
            attribute_bank_id,
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
        .eq('analysis_type', type)
        .is('attribute_statements.attribute_bank_id', null)
        .order('name', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      setAttributes(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to fetch attributes');
    } finally {
      setLoading(false);
    }
  }, []);

  // Event handlers
  const handleBankSelect = (bank) => {
    setSelectedBank(bank);
    setView('details');
  };

  const handleStatementSelect = (statementId, attributeId) => {
    setSelectedStatements(prev => {
      if (prev.some(s => s.statementId === statementId)) {
        return prev.filter(s => s.statementId !== statementId);
      }
      return [...prev, { statementId, attributeId }];
    });
  };

  const handleAnalysisTypeChange = (value) => {
    setAnalysisType(value);
    setNewBank(prev => ({ ...prev, analysis_type: value }));
  };

  const handleCreateBank = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to create a bank');
      }

      // Generate unique name first
      const bankName = await generateUniqueBankName();

      // Only check for existing bank if user provided a custom name
      if (newBank.name) {
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
      }

      const { data: bank, error: createError } = await supabase
        .from('attribute_banks')
        .insert({
          name: newBank.name || bankName, // Use custom name if provided, otherwise use generated name
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

      for (const { statementId, attributeId } of selectedStatements) {
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

  // Effects
  useEffect(() => {
    fetchCompanies();
    fetchIndustries();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchAttributes(analysisType);
  }, [analysisType, fetchAttributes]);

  useEffect(() => {
    fetchBanks();
    fetchanalysis();
  }, []);

  const generateUniqueBankName = async () => {
    // Get all existing bank names that match our pattern
    const { data: banks, error } = await supabase
      .from('attribute_banks')
      .select('name')
      .like('name', 'NewBank - %');

    if (error) {
      console.error('Error fetching bank names:', error);
      throw new Error('Failed to generate unique bank name');
    }

    // Find the highest number used
    let maxNum = 0;
    banks?.forEach(bank => {
      const match = bank.name.match(/NewBank - (\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        maxNum = Math.max(maxNum, num);
      }
    });

    // Generate the next number (padded with leading zero if needed)
    const nextNum = maxNum + 1;
    const paddedNum = nextNum.toString().padStart(2, '0');
    return `NewBank - ${paddedNum}`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
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
                          item?.id && item?.analysis_type ? (
                            <SelectItem 
                              key={item.id} 
                              value={item.analysis_type}
                            >
                              {item.analysis_type}
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
                    selectedStatements={selectedStatements}
                    onStatementSelect={handleStatementSelect}
                    industries={industries}
                    selectedIndustry={selectedIndustryFilter}
                    onIndustryChange={(value) => setSelectedIndustryFilter(value)}
                    includeCustomStatements={true}
                    onCustomStatementsChange={() => {}}
                    loading={loading}
                    analysisType={analysisType}
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
                  disabled={loading || selectedStatements.length === 0}
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
        <BankDetails bank={selectedBank} onRefresh={fetchBanks} />
      )}
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

      const { data: statements, error: stmtFetchError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_bank_id', bank.id);

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
        .eq('attribute_bank_id', bank.id);

      if (statementsError) throw statementsError;

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
                              <span className="text-muted-foreground ml-2">{option.weight}</span>
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
