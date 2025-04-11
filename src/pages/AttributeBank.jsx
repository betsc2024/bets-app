import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, Plus, Loader2, ChevronDown, ChevronLeft, Check } from "lucide-react";
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
  const [selectedStatements, setSelectedStatements] = useState(new Set()); // Initialize as empty Set
  const [availableStatements, setAvailableStatements] = useState([]);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [industrySearchQuery, setIndustrySearchQuery] = useState('');
  const [attributeSearchQuery, setAttributeSearchQuery] = useState('');
  const [statementSearchQuery, setStatementSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState('all');
  const [selectedAttributeFilter, setSelectedAttributeFilter] = useState('all');
  const [selectedStatementFilter, setSelectedStatementFilter] = useState('all');
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
          value: item.id,
          label: item.name.trim() // Trim to ensure clean sorting
        }))
        .sort((a, b) => a.label.localeCompare(b.label)); // Ensure client-side sorting matches server-side

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
          created_at,
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
            attribute_id,
            statement_analysis_types (
              analysis_type_id,
              analysis_types (
                id,
                name
              )
            ),
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          )
        `)
        .order('name', { ascending: true });  // Sort by name alphabetically

      if (error) throw error;
      console.log('Fetched banks:', data); // Debug log

      setBanks(data.map(bank => ({
        ...bank,
        analysis_type: bank.analysis_types?.name || 'Unknown',
        attribute_statements: (bank.attribute_statements || []).sort((a, b) => 
          a.statement.localeCompare(b.statement)
        )
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
      const { data: attributesData, error: attributesError } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          attribute_industry_mapping (
            industry_id
          ),
          attribute_statements (
            id,
            statement,
            attribute_bank_id,
            statement_analysis_types (
              analysis_type_id,
              analysis_types (
                id,
                name
              )
            ),
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          )
        `)
        .order('name');

      if (attributesError) throw attributesError;

      const transformedAttributes = attributesData?.map(attr => {
        const statements = attr.attribute_statements?.map(stmt => ({
          ...stmt,
          attribute_statement_options: (stmt.attribute_statement_options || [])
            .sort((a, b) => b.weight - a.weight)
        })) || [];

        return {
          ...attr,
          attribute_statements: statements,
          selectedIndustries: attr.attribute_industry_mapping?.map(m => m.industry_id) || []
        };
      }) || [];

      setAttributes(transformedAttributes);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      toast.error('Failed to fetch attributes');
    } finally {
      setLoading(false);
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
          statement_analysis_types (
            analysis_type_id,
            analysis_types (
              id,
              name
            )
          ),
          attributes!inner (
            id,
            name,
            description
          ),
          attribute_statement_options (
            id,
            option_text,
            weight
          )
        `)
        .eq('attribute_bank_id', bank.id)
        .order('statement', { ascending: true });  // Sort statements alphabetically

      if (error) throw error;

      // Transform statements into the format expected by CreateAttributeBank
      const transformedAttributes = {};
      data?.forEach(stmt => {
        const attr = stmt.attributes;
        if (!transformedAttributes[attr.id]) {
          transformedAttributes[attr.id] = {
            ...attr,
            attribute_statements: []
          };
        }
        transformedAttributes[attr.id].attribute_statements.push({
          id: stmt.id,
          statement: stmt.statement,
          statement_analysis_types: stmt.statement_analysis_types,
          attribute_statement_options: (stmt.attribute_statement_options || [])
            .sort((a, b) => b.weight - a.weight)
        });
      });

      // Sort statements within each attribute
      Object.values(transformedAttributes).forEach(attr => {
        attr.attribute_statements.sort((a, b) => 
          a.statement.localeCompare(b.statement)
        );
      });

      // Sort attributes by name
      const sortedAttributes = Object.values(transformedAttributes)
        .sort((a, b) => a.name.localeCompare(b.name));

      setAttributes(sortedAttributes);
      setStatements(data || []); // Keep the original data for reference
      setSelectedStatements(new Set(data?.map(s => s.id) || []));

    } catch (error) {
      console.error('Error fetching statements:', error);
      toast.error('Failed to fetch bank statements');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableAttributes = async () => {
    try {
      const { data, error } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          attribute_industry_mapping (
            industry_id
          ),
          attribute_statements (
            id,
            statement,
            attribute_bank_id,
            statement_analysis_types (
              analysis_type_id,
              analysis_types (
                id,
                name
              )
            ),
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          )
        `)
        .order('name');

      if (error) throw error;

      // Filter out statements that are already linked to other banks
      // except for statements linked to the current bank
      const transformedAttributes = data
        .map(attr => {
          // Group statements by their text content to remove duplicates
          const statementsMap = new Map();
          
          (attr.attribute_statements || []).forEach(stmt => {
            // If statement is already linked to this bank, always include it
            // For template statements, only include if linked to bank's analysis type
            const isLinkedToBank = stmt.attribute_bank_id === selectedBank?.id;
            const isTemplate = !stmt.attribute_bank_id;
            const isLinkedToAnalysisType = stmt.statement_analysis_types?.some(
              sat => sat.analysis_type_id === selectedBank?.analysis_type_id
            );

            if (isLinkedToBank || (isTemplate && isLinkedToAnalysisType)) {
              // Prefer the bank's version over template if both exist
              if (!statementsMap.has(stmt.statement) || stmt.attribute_bank_id === selectedBank?.id) {
                statementsMap.set(stmt.statement, stmt);
              }
            }
          });

          return {
            ...attr,
            attribute_statements: Array.from(statementsMap.values())
              .sort((a, b) => a.statement.localeCompare(b.statement))
          };
        })
        .filter(attr => attr.attribute_statements.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      setAvailableAttributes(transformedAttributes);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      toast.error('Failed to fetch attributes');
    }
  };

  useEffect(() => {
    if (selectedBank?.id) {
      fetchAttributes();
    }
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
    // Don't allow selecting statements that are already in another bank
    if (statement.attribute_bank_id && statement.attribute_bank_id !== selectedBank?.id) {
      toast.error('This statement is already assigned to another bank');
      return;
    }

    setSelectedStatements(prev => {
      const exists = prev.find(s => s.id === statement.id);
      if (exists) {
        return prev.filter(s => s.id !== statement.id);
      } else {
        return [...prev, statement];
      }
    });
  }, [selectedBank]);

  const handleAnalysisTypeChange = async (value) => {
    setAnalysisType(value);
    setNewBank(prev => ({ ...prev, analysis_type_id: value }));
    // Only fetch attributes if we have a valid UUID
    if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      await fetchAttributesForType(value, true);
    }
  };

  const handleCreateBank = async () => {
    try {
      setLoading(true);

      // Validate required fields
      if (!newBank.name) {
        toast.error('Bank name is required');
        return;
      }

      if (!newBank.analysis_type_id) {
        toast.error('Analysis type is required');
        return;
      }

      if (selectedStatements.length === 0) {
        toast.error('Please select at least one statement');
        return;
      }

      // Validate that no selected statements are already in other banks
      const invalidStatements = selectedStatements.filter(
        s => s.attribute_bank_id && s.attribute_bank_id !== selectedBank?.id
      );
      if (invalidStatements.length > 0) {
        toast.error('Some selected statements are already assigned to other banks');
        return;
      }

      // Create bank with analysis type ID
      const { data: bankData, error: bankError } = await supabase
        .from('attribute_banks')
        .insert({
          name: newBank.name,
          description: newBank.description || '',
          analysis_type_id: newBank.analysis_type_id,
          status: 'active',
          company_id: selectedCompany === 'all' ? null : selectedCompany
        })
        .select()
        .single();

      if (bankError) {
        console.error('❌ Error creating bank:', bankError);
        toast.error('Failed to create bank');
        return;
      }

      console.log('✅ Bank created:', bankData);

      // Create copies of selected statements with bank ID
      const statementCopies = selectedStatements.map(stmt => ({
        attribute_id: stmt.attribute_id,
        statement: stmt.statement,
        attribute_bank_id: bankData.id
      }));

      const { data: newStatements, error: stmtError } = await supabase
        .from('attribute_statements')
        .insert(statementCopies)
        .select();

      if (stmtError) {
        console.error('❌ Error creating statement copies:', stmtError);
        // Cleanup: Delete the bank since statement creation failed
        await supabase
          .from('attribute_banks')
          .delete()
          .eq('id', bankData.id);
        toast.error('Failed to create statement copies');
        return;
      }

      // Copy options for each statement
      for (let i = 0; i < selectedStatements.length; i++) {
        const originalStmt = selectedStatements[i];
        const newStmt = newStatements[i];
        
        // Get original options
        const { data: originalOptions } = await supabase
          .from('attribute_statement_options')
          .select('*')
          .eq('statement_id', originalStmt.id);

        if (originalOptions?.length > 0) {
          // Create copies of options for new statement
          const optionCopies = originalOptions.map(opt => ({
            statement_id: newStmt.id,
            option_text: opt.option_text,
            weight: opt.weight
          }));

          const { error: optError } = await supabase
            .from('attribute_statement_options')
            .insert(optionCopies);

          if (optError) {
            console.error('❌ Error copying options:', optError);
            // Continue anyway, not critical
          }
        }
      }

      console.log('✅ Created statement copies with options');
      toast.success('Bank created successfully');
      setView('list');
      fetchBanks();
    } catch (error) {
      console.error('❌ Error in handleCreateBank:', error);
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

      // First check for evaluations
      const { data: evaluations, error: evalCheckError } = await supabase
        .from('evaluation_assignments')
        .select('id')
        .eq('attribute_bank_id', bankId);

      if (evalCheckError) throw evalCheckError;

      if (evaluations && evaluations.length > 0) {
        toast.error(
          `Cannot delete this bank as it is being used in ${evaluations.length} evaluation(s). Please delete the evaluations first.`,
          { duration: 5000 }
        );
        return;
      }

      // If no evaluations exist, proceed with deletion
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

      toast.success('Bank deleted successfully');
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
        company_id: updatedData.company_id === 'null' ? null : updatedData.company_id, // Don't convert to number, keep as UUID string
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
                company_id: updatedData.company_id === 'null' ? null : updatedData.company_id, // Don't convert to number, keep as UUID string
                companies: updatedData.company_id === 'null' ? null : updatedData.companies,
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
    if (selectedBank?.id) {
      fetchAttributes();
    }
  }, [selectedBank?.id]);

  const fetchAttributesForType = async (analysisTypeId) => {
    try {
      setLoading(true);
      console.log('🔍 Fetching attributes for analysis type:', analysisTypeId);

      // STEP 1: Get all attributes that have statements for this analysis type
      const { data: matchingAttributes, error: matchError } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          attribute_industry_mapping (
            industry_id
          ),
          attribute_statements!inner (
            id,
            statement,
            attribute_bank_id,
            statement_analysis_types!inner (
              analysis_type_id,
              analysis_types (
                id,
                name
              )
            ),
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          )
        `)
        .eq('attribute_statements.statement_analysis_types.analysis_type_id', analysisTypeId)
        .is('attribute_statements.attribute_bank_id', null)  // Only get statements not linked to any bank
        .order('name');

      if (matchError) {
        console.error('❌ Error fetching attributes:', matchError);
        throw matchError;
      }

      // Transform and set the data
      const transformedAttributes = (matchingAttributes || [])
        .sort((a, b) => a.name.localeCompare(b.name)) // Sort attributes A-Z
        .map(attr => ({
          ...attr,
          // Only include statements that match this analysis type and are not in any bank
          attribute_statements: attr.attribute_statements
            .filter(stmt => 
              stmt.statement_analysis_types.some(sat => sat.analysis_type_id === analysisTypeId) && 
              !stmt.attribute_bank_id  // Double check to ensure statement is not in any bank
            )
            .sort((a, b) => a.statement.localeCompare(b.statement)) // Sort statements A-Z
            .map(stmt => ({
              ...stmt,
              attribute_statement_options: (stmt.attribute_statement_options || [])
                .sort((a, b) => b.weight - a.weight) // Keep options sorted by weight descending
            }))
        }))
        .filter(attr => attr.attribute_statements.length > 0);

      console.log('✅ Final filtered attributes:', transformedAttributes.length);
      setAttributes(transformedAttributes);
    } catch (error) {
      console.error('❌ Error in fetchAttributesForType:', error);
      toast.error('Failed to fetch attributes');
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      console.log('Saving with editedBank:', editedBank); // Debug log

      // Update bank details
      const { data: updatedBank, error: bankUpdateError } = await supabase
        .from('attribute_banks')
        .update({
          name: editedBank.name,
          status: editedBank.status,
          company_id: editedBank.company_id === 'none' ? null : editedBank.company_id // Don't convert to number, keep as UUID string
        })
        .eq('id', bank.id)
        .select(`
          *,
          companies (
            id,
            name
          ),
          analysis_types (
            id,
            name
          )
        `)
        .single();

      if (bankUpdateError) {
        console.error('Bank update error:', bankUpdateError); // Debug log
        throw bankUpdateError;
      }

      console.log('Updated bank:', updatedBank); // Debug log

      // Get current statements in the bank
      const { data: currentStatements, error: fetchError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_bank_id', bank.id);

      if (fetchError) throw fetchError;

      // Create sets for efficient comparison
      const currentIds = new Set(currentStatements.map(s => s.id));
      const newIds = new Set(statements.map(s => s.id));

      // Find statements to delete (in current but not in new)
      const statementsToDelete = currentStatements
        .filter(s => !newIds.has(s.id))
        .map(s => s.id);

      // Find statements to add (in new but not in current)
      const statementsToAdd = statements.filter(s => !currentIds.has(s.id));

      // Delete removed statements
      if (statementsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('attribute_statements')
          .delete()
          .in('id', statementsToDelete);

        if (deleteError) throw deleteError;
      }

      // Add new statements
      if (statementsToAdd.length > 0) {
        // Insert statements first
        const newStatements = statementsToAdd.map(stmt => ({
          attribute_id: stmt.attribute_id,
          attribute_bank_id: bank.id,
          statement: stmt.statement
        }));

        const { data: insertedStatements, error: insertError } = await supabase
          .from('attribute_statements')
          .insert(newStatements)
          .select('id');

        if (insertError) throw insertError;

        // Now insert options for each statement
        const optionsToInsert = [];
        insertedStatements.forEach((stmt, index) => {
          const originalStatement = statementsToAdd[index];
          if (originalStatement.attribute_statement_options) {
            originalStatement.attribute_statement_options.forEach(opt => {
              optionsToInsert.push({
                statement_id: stmt.id,
                option_text: opt.option_text,
                weight: opt.weight
              });
            });
          }
        });

        if (optionsToInsert.length > 0) {
          const { error: optionsError } = await supabase
            .from('attribute_statement_options')
            .insert(optionsToInsert);

          if (optionsError) throw optionsError;
        }
      }

      toast.success('Bank updated successfully');
      setIsEditMode(false);
      setAvailableAttributes([]);
      setSelectedStatements(new Set());
      
      // Update the bank object with new data
      const updatedBankWithMeta = {
        ...updatedBank,
        analysis_type: updatedBank.analysis_types?.name || 'Unknown'
      };
      console.log('Setting bank to:', updatedBankWithMeta); // Debug log
      setSelectedBank(updatedBankWithMeta);
      onRefresh?.();
      
      // Fetch updated statements
      fetchBankStatements(updatedBankWithMeta);
    } catch (error) {
      console.error('Error updating bank:', error);
      toast.error('Failed to update bank');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setAvailableAttributes([]);
    setSelectedStatements(new Set());
    // Reset to original state
    fetchBankStatements(selectedBank);
  };

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Attribute Banks</h1>
      </div>

      {/* Create Bank Button */}
      <div className="mb-6 max-w-[280px]">
        <Button 
          onClick={() => setView('create')} 
          className="gap-2 bg-[#733E93] hover:bg-[#633383] text-white font-inter text-[18px] h-12 w-full"
        >
          <Plus className="h-5 w-5" />
          Add NEW Bank
        </Button>
      </div>

      {/* Bank List */}
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
        <div className="mt-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              onClick={() => {
                // Reset form state
                setNewBank({
                  name: '',
                  description: '',
                  analysis_type_id: '',
                  status: 'active',
                  company_id: null
                });
                setAnalysisType('');
                setSelectedCompany('all');
                setSelectedStatements(new Set());
                setAttributeSearchQuery('');
                setCompanySearchQuery('');
                
                // Go back to list view
                setView('list');
                fetchBanks();
              }}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Banks
            </Button>
            <div className="flex-1" />
          </div>
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
                              ? "Select a Company"
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
                      industries={industries}
                      selectedStatements={selectedStatements}
                    />
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => {
                    // Reset form state
                    setNewBank({
                      name: '',
                      description: '',
                      analysis_type_id: '',
                      status: 'active',
                      company_id: null
                    });
                    setAnalysisType('');
                    setSelectedCompany('all');
                    setSelectedStatements(new Set());
                    setAttributeSearchQuery('');
                    setCompanySearchQuery('');
                    
                    // Go back to list view
                    setView('list');
                    fetchBanks();
                  }}>
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
        </div>
      )}

      {view === 'details' && selectedBank && (
        <div className="mt-8">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              onClick={() => {
                setSelectedBank(null);
                setView('list');
                fetchBanks();  // Call fetchBanks directly instead of using onRefresh
              }}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Banks
            </Button>
            <div className="flex-1" />
          </div>
          <BankDetails 
            bank={selectedBank} 
            onRefresh={fetchBanks}
            setSelectedBank={setSelectedBank}
            industries={industries}
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
                onUpdate={handleSave}
                selectedStatements={selectedStatements}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
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

      // First check for evaluations
      const { data: evaluations, error: evalCheckError } = await supabase
        .from('evaluation_assignments')
        .select('id')
        .eq('attribute_bank_id', bankId);

      if (evalCheckError) throw evalCheckError;

      if (evaluations && evaluations.length > 0) {
        toast.error(
          `Cannot delete this bank as it is being used in ${evaluations.length} evaluation(s). Please delete the evaluations first.`,
          { duration: 5000 }
        );
        setShowDeleteDialog(false);
        return;
      }

      // If no evaluations exist, proceed with deletion
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

      toast.success('Bank deleted successfully');
      onRefresh?.();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to delete bank');
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {banks.map((bank) => (
        <Card key={bank.id} className="hover:bg-accent/50 transition-colors">
          {editingBank?.id === bank.id ? (
            <CardHeader>
              {/* Edit form content */}
            </CardHeader>
          ) : (
            <div className="p-3">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-base truncate max-w-[70%]">
                    {bank.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onBankSelect(bank);
                      }}
                      className="p-1 hover:bg-accent/50 rounded-md cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setBankToDelete(bank);
                        setShowDeleteDialog(true);
                      }}
                      className="p-1 hover:bg-accent/50 rounded-md cursor-pointer text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    {
                      'bg-green-100 text-green-700': bank.status === 'active',
                      'bg-yellow-100 text-yellow-700': bank.status === 'draft'
                    }
                  )}>
                    {bank.status}
                  </span>
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700'
                  )}>
                    {bank.analysis_types?.name || 'No Type'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {bank.companies?.name || 'No Company'}
                  </span>
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

function BankDetails({ bank, onRefresh, setSelectedBank, industries }) {
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState([]); // Initialize as empty array
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [attributes, setAttributes] = useState([]);
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState('all');
  const [attributeSearchQuery, setAttributeSearchQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availableAttributes, setAvailableAttributes] = useState([]);
  const [selectedStatements, setSelectedStatements] = useState(new Set()); // Initialize as empty Set
  const [companies, setCompanies] = useState([]);
  const [editedBank, setEditedBank] = useState({
    name: '',
    status: '',
    company_id: 'none'
  });

  useEffect(() => {
    if (bank?.id) {
      fetchBankStatements(bank);
      setEditedBank({
        name: bank.name || '',
        status: bank.status || 'draft',
        company_id: bank.company_id || 'none' // Keep UUID string as is
      });
    }
  }, [bank?.id]);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to fetch companies');
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
          statement_analysis_types (
            analysis_type_id,
            analysis_types (
              id,
              name
            )
          ),
          attributes!inner (
            id,
            name,
            description
          ),
          attribute_statement_options (
            id,
            option_text,
            weight
          )
        `)
        .eq('attribute_bank_id', bank.id)
        .order('statement', { ascending: true });  // Sort statements alphabetically

      if (error) throw error;

      // Transform statements into the format expected by CreateAttributeBank
      const transformedAttributes = {};
      data?.forEach(stmt => {
        const attr = stmt.attributes;
        if (!transformedAttributes[attr.id]) {
          transformedAttributes[attr.id] = {
            ...attr,
            attribute_statements: []
          };
        }
        transformedAttributes[attr.id].attribute_statements.push({
          id: stmt.id,
          statement: stmt.statement,
          statement_analysis_types: stmt.statement_analysis_types,
          attribute_statement_options: (stmt.attribute_statement_options || [])
            .sort((a, b) => b.weight - a.weight)
        });
      });

      // Sort statements within each attribute
      Object.values(transformedAttributes).forEach(attr => {
        attr.attribute_statements.sort((a, b) => 
          a.statement.localeCompare(b.statement)
        );
      });

      // Sort attributes by name
      const sortedAttributes = Object.values(transformedAttributes)
        .sort((a, b) => a.name.localeCompare(b.name));

      setAttributes(sortedAttributes);
      setStatements(data || []); // Keep the original data for reference
      setSelectedStatements(new Set(data?.map(s => s.id) || []));

    } catch (error) {
      console.error('Error fetching statements:', error);
      toast.error('Failed to fetch bank statements');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableAttributes = async () => {
    try {
      const { data, error } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          attribute_industry_mapping (
            industry_id
          ),
          attribute_statements (
            id,
            statement,
            attribute_bank_id,
            statement_analysis_types (
              analysis_type_id,
              analysis_types (
                id,
                name
              )
            ),
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          )
        `)
        .order('name');

      if (error) throw error;

      // Filter out statements that are already linked to other banks
      // except for statements linked to the current bank
      const transformedAttributes = data
        .map(attr => {
          // Group statements by their text content to remove duplicates
          const statementsMap = new Map();
          
          (attr.attribute_statements || []).forEach(stmt => {
            // If statement is already linked to this bank, always include it
            // For template statements, only include if linked to bank's analysis type
            const isLinkedToBank = stmt.attribute_bank_id === bank.id;
            const isTemplate = !stmt.attribute_bank_id;
            const isLinkedToAnalysisType = stmt.statement_analysis_types?.some(
              sat => sat.analysis_type_id === bank.analysis_type_id
            );

            if (isLinkedToBank || (isTemplate && isLinkedToAnalysisType)) {
              // Prefer the bank's version over template if both exist
              if (!statementsMap.has(stmt.statement) || stmt.attribute_bank_id === bank.id) {
                statementsMap.set(stmt.statement, stmt);
              }
            }
          });

          return {
            ...attr,
            attribute_statements: Array.from(statementsMap.values())
              .sort((a, b) => a.statement.localeCompare(b.statement))
          };
        })
        .filter(attr => attr.attribute_statements.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      setAvailableAttributes(transformedAttributes);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      toast.error('Failed to fetch attributes');
    }
  };

  const handleEdit = async () => {
    setIsEditMode(true);
    await fetchAvailableAttributes();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      console.log('Saving with editedBank:', editedBank); // Debug log

      // Update bank details
      const { data: updatedBank, error: bankUpdateError } = await supabase
        .from('attribute_banks')
        .update({
          name: editedBank.name,
          status: editedBank.status,
          company_id: editedBank.company_id === 'none' ? null : editedBank.company_id // Don't convert to number, keep as UUID string
        })
        .eq('id', bank.id)
        .select(`
          *,
          companies (
            id,
            name
          ),
          analysis_types (
            id,
            name
          )
        `)
        .single();

      if (bankUpdateError) {
        console.error('Bank update error:', bankUpdateError); // Debug log
        throw bankUpdateError;
      }

      console.log('Updated bank:', updatedBank); // Debug log

      // Get current statements in the bank
      const { data: currentStatements, error: fetchError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_bank_id', bank.id);

      if (fetchError) throw fetchError;

      // Create sets for efficient comparison
      const currentIds = new Set(currentStatements.map(s => s.id));
      const newIds = new Set(statements.map(s => s.id));

      // Find statements to delete (in current but not in new)
      const statementsToDelete = currentStatements
        .filter(s => !newIds.has(s.id))
        .map(s => s.id);

      // Find statements to add (in new but not in current)
      const statementsToAdd = statements.filter(s => !currentIds.has(s.id));

      // Delete removed statements
      if (statementsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('attribute_statements')
          .delete()
          .in('id', statementsToDelete);

        if (deleteError) throw deleteError;
      }

      // Add new statements
      if (statementsToAdd.length > 0) {
        // Insert statements first
        const newStatements = statementsToAdd.map(stmt => ({
          attribute_id: stmt.attribute_id,
          attribute_bank_id: bank.id,
          statement: stmt.statement
        }));

        const { data: insertedStatements, error: insertError } = await supabase
          .from('attribute_statements')
          .insert(newStatements)
          .select('id');

        if (insertError) throw insertError;

        // Now insert options for each statement
        const optionsToInsert = [];
        insertedStatements.forEach((stmt, index) => {
          const originalStatement = statementsToAdd[index];
          if (originalStatement.attribute_statement_options) {
            originalStatement.attribute_statement_options.forEach(opt => {
              optionsToInsert.push({
                statement_id: stmt.id,
                option_text: opt.option_text,
                weight: opt.weight
              });
            });
          }
        });

        if (optionsToInsert.length > 0) {
          const { error: optionsError } = await supabase
            .from('attribute_statement_options')
            .insert(optionsToInsert);

          if (optionsError) throw optionsError;
        }
      }

      toast.success('Bank updated successfully');
      setIsEditMode(false);
      setAvailableAttributes([]);
      setSelectedStatements(new Set());
      
      // Update the bank object with new data
      const updatedBankWithMeta = {
        ...updatedBank,
        analysis_type: updatedBank.analysis_types?.name || 'Unknown'
      };
      console.log('Setting bank to:', updatedBankWithMeta); // Debug log
      setSelectedBank(updatedBankWithMeta);
      onRefresh?.();
      
      // Fetch updated statements
      fetchBankStatements(updatedBankWithMeta);
    } catch (error) {
      console.error('Error updating bank:', error);
      toast.error('Failed to update bank');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setAvailableAttributes([]);
    setSelectedStatements(new Set());
    fetchBankStatements(bank);
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('attribute_banks')
        .delete()
        .eq('id', bank.id);

      if (error) throw error;

      toast.success('Bank deleted successfully');
      onRefresh?.();
      setSelectedBank(null);
    } catch (error) {
      console.error('Error deleting bank:', error);
      toast.error('Failed to delete bank');
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (!bank) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-4 flex-1 mr-4">
          {isEditMode ? (
            <div className="space-y-4">
              <div>
                <Label>Analysis Type</Label>
                <Input
                  value={bank.analysis_types?.name || 'Not Set'}
                  disabled
                />
              </div>
              <div>
                <Label>Bank Name</Label>
                <Input
                  value={editedBank.name}
                  onChange={(e) => setEditedBank(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter bank name"
                />
              </div>
              <div>
                <Label>Company</Label>
                <Select
                  value={editedBank.company_id}
                  onValueChange={(value) => {
                    console.log('Company selected:', value);
                    setEditedBank(prev => {
                      const updated = { ...prev, company_id: value };
                      console.log('Updated editedBank:', updated);
                      return updated;
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">No Company</SelectItem>
                      {companies?.map(company => (
                        <SelectItem key={company.id} value={String(company.id)}>
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
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold">{bank.name}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Analysis Type: {bank.analysis_types?.name || 'Not Set'}</span>
                <span>•</span>
                <span>Company: {bank.companies?.name || 'No Company'}</span>
                <span>•</span>
                <span>Status: {bank.status}</span>
                <span>•</span>
                <span>Created: {bank.created_at ? new Date(bank.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                }) : 'Not Available'}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
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
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Attribute Statements</h3>
        {loading ? (
          <div className="text-center py-4">Loading statements...</div>
        ) : (
          <CreateAttributeBank
            attributes={isEditMode ? availableAttributes : attributes}
            selectedItems={statements || []} // Ensure we pass an array
            onSelectedItemsChange={isEditMode ? (items) => setStatements(items || []) : undefined}
            selectedIndustryFilter={selectedIndustryFilter}
            onIndustryFilterChange={setSelectedIndustryFilter}
            attributeSearchQuery={attributeSearchQuery}
            onAttributeSearchQueryChange={setAttributeSearchQuery}
            isViewMode={!isEditMode}
            industries={industries}
            selectedStatements={selectedStatements}
          />
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bank? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
