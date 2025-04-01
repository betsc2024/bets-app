import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Dialog as DialogComponent } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Edit2, Trash2, Check, X, Pencil } from 'lucide-react';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";
import { Checkbox } from '../components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "../lib/utils";
import { useAuth } from '../contexts/AuthContext';
import { Badge } from '../components/ui/badge';

export default function AttributeManagement() {
  const { user } = useAuth();
  const [attributes, setAttributes] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [statements, setStatements] = useState([]);
  const [newStatement, setNewStatement] = useState({ text: '' });
  const [statementOptions, setStatementOptions] = useState([]);
  const [newOption, setNewOption] = useState({ text: '', weight: 0 });

  const [newAttribute, setNewAttribute] = useState({
    name: '',
    description: '',
    selectedAnalysisTypes: [],
    is_industry_standard: true,
    selectedIndustries: []
  });
  const [analysisTypeList, setAnalysisTypeList] = useState([]);
  const [industrySearchQuery, setIndustrySearchQuery] = useState('');
  const [attributeSearchQuery, setAttributeSearchQuery] = useState('');
  const [statementSearchQuery, setStatementSearchQuery] = useState('');
  const [attributeToDelete, setAttributeToDelete] = useState(null);
  const [statementToDelete, setStatementToDelete] = useState(null);
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState('all');
  const [selectedAttributeFilter, setSelectedAttributeFilter] = useState('all');
  const [selectedStatementFilter, setSelectedStatementFilter] = useState('all');
  const [selectedAttributeId, setSelectedAttributeId] = useState(null);
  const [currentStatement, setCurrentStatement] = useState({
    text: '',
    attribute_bank_id: null,
    options: [
      { text: 'Excellent', weight: 100 },
      { text: 'Very Good', weight: 80 },
      { text: 'Good', weight: 60 },
      { text: 'Fair & Satisfactory', weight: 40 },
      { text: 'Needs Improvement', weight: 20 }
    ]
  });
  const [editingRows, setEditingRows] = useState({});
  const [editedData, setEditedData] = useState({});
  const [deletedOptions, setDeletedOptions] = useState({});
  const [analysisTypeSearchQuery, setAnalysisTypeSearchQuery] = useState('');

  // Filter dialog states
  const [industryDialogOpen, setIndustryDialogOpen] = useState(false);
  const [attributeDialogOpen, setAttributeDialogOpen] = useState(false);
  const [statementDialogOpen, setStatementDialogOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchAttributes();
    fetchIndustries();
    fetchanalysis();
  }, []);

  useEffect(() => {
    // Function to add passive scroll listeners to all scrollable elements
    const addPassiveScrollListeners = () => {
      const scrollableElements = document.querySelectorAll('.overflow-y-auto, .overflow-auto');
      scrollableElements.forEach(element => {
        element.addEventListener('scroll', () => { }, { passive: true });
        element.addEventListener('touchstart', () => { }, { passive: true });
      });
    };

    addPassiveScrollListeners();

    // Cleanup
    return () => {
      const scrollableElements = document.querySelectorAll('.overflow-y-auto, .overflow-auto');
      scrollableElements.forEach(element => {
        element.removeEventListener('scroll', () => { });
        element.removeEventListener('touchstart', () => { });
      });
    };
  }, []);
  const fetchanalysis = async () => {
    try {
      const { data, error } = await supabase
        .from('analysis_types')  // Changed from analysis_type to analysis_types
        .select("id, name");
      
      if (error) throw error;
      
      // Transform to match existing UI expectations
      const transformedData = data?.map(item => ({
        id: item.id,
        analysis_type: item.name  // Map name to analysis_type for UI
      })) || [];
      
      setAnalysisTypeList(transformedData);
    } catch (e) {
      console.error('Error fetching analysis types:', e);
      toast.error('Failed to fetch analysis types');
    }
  };

  const fetchAttributes = async () => {
    try {
      setLoading(true);

      // First fetch all industries to have a lookup table
      const { data: industriesData, error: industriesError } = await supabase
        .from('industries')
        .select('*')
        .order('name');

      if (industriesError) throw industriesError;

      const industriesMap = Object.fromEntries(
        industriesData.map(industry => [industry.id, industry])
      );

      const { data: attributesData, error: attributesError } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          is_industry_standard,
          attribute_industry_mapping (
            industry_id
          ),
          attribute_analysis_types (
            analysis_type_id
          ),
          attribute_statements (
            id,
            statement,
            analysis_types,
            industries,
            attribute_bank_id,
            attribute_statement_options (
              id,
              option_text,
              weight
            )
          )
        `)
        .order('name', { ascending: true });

      if (attributesError) throw attributesError;

      console.log('Raw attributes data from DB:', attributesData);

      // Transform the data for the UI and filter out bank-linked statements
      const transformedData = attributesData.map(attr => {
        console.log('Processing attribute:', {
          id: attr.id,
          name: attr.name,
          industryMappings: attr.attribute_industry_mapping,
          analysisTypes: attr.attribute_analysis_types
        });

        return {
          ...attr,
          analysis_types: attr.attribute_analysis_types?.map(at => at.analysis_type_id) || [],
          selectedIndustries: attr.attribute_industry_mapping?.map(im => im.industry_id) || [],
          industryNames: attr.attribute_industry_mapping?.map(im => industriesMap[im.industry_id]?.name || im.industry_id) || [],
          attribute_statements: (attr.attribute_statements || [])
            ?.filter(stmt => stmt.attribute_bank_id === null)
            ?.map(stmt => ({
              ...stmt,
              analysis_types: stmt.analysis_types || [],
              industries: stmt.industries || [],
              industryNames: (stmt.industries || []).map(id => industriesMap[id]?.name || id),
            }))
            .sort((a, b) => a.statement.localeCompare(b.statement))
        };
      });

      console.log('Transformed data:', transformedData);

      setAttributes(transformedData);
    } catch (error) {
      console.error('Error fetching attributes:', error);
      toast.error('Failed to fetch attributes');
    } finally {
      setLoading(false);
    }
  };

  const fetchIndustries = async () => {
    try {
      const { data, error } = await supabase
        .from('industries')
        .select('*')
        .order('name');

      if (error) throw error;
      setIndustries(data || []);
    } catch (error) {
      toast.error('Failed to fetch industries');
    }
  };

  const handleSaveAttribute = async () => {
    try {
      console.log('Starting attribute save with data:', newAttribute);
      
      if (!newAttribute.name.trim()) {
        toast.error('Attribute name is required');
        return;
      }

      setLoading(true);

      // 1. Check for existing attribute
      console.log('Checking for existing attribute...');
      const { data: existingAttributes, error: checkError } = await supabase
        .from('attributes')
        .select('*')
        .filter('name', 'eq', newAttribute.name.trim());

      if (checkError) {
        console.error('Error checking existing attributes:', checkError);
        throw checkError;
      }

      if (existingAttributes && existingAttributes.length > 0) {
        console.log('Found existing attribute with same name');
        toast.error(`An attribute named "${newAttribute.name}" already exists`);
        return;
      }

      // First create the attribute
      console.log('About to create attribute with data:', {
        name: newAttribute.name.trim(),
        description: newAttribute.description?.trim() || '',
        is_industry_standard: true
      });

      const { data: attributeData, error: attributeError } = await supabase
        .from('attributes')
        .insert([{
          name: newAttribute.name.trim(),
          description: newAttribute.description?.trim() || '',
          is_industry_standard: true
        }])
        .select()
        .single();

      if (attributeError) {
        console.error('Error creating attribute:', attributeError);
        throw attributeError;
      }

      console.log('Successfully created attribute:', attributeData);

      // Then create the industry mappings
      if (newAttribute.selectedIndustries.length > 0) {
        console.log('Creating industry mappings:', {
          selectedIndustries: newAttribute.selectedIndustries,
          attributeId: attributeData.id
        });

        const industryMappings = newAttribute.selectedIndustries.map(industryId => ({
          attribute_id: attributeData.id,
          industry_id: industryId
        }));

        console.log('Prepared industry mappings:', industryMappings);

        const { data: mappingData, error: mappingError } = await supabase
          .from('attribute_industry_mapping')
          .insert(industryMappings)
          .select();

        if (mappingError) {
          console.error('Error creating industry mappings:', mappingError);
          throw mappingError;
        }

        console.log('Successfully created industry mappings:', mappingData);
      } else {
        console.log('No industries selected, skipping industry mappings');
      }

      // 4. Insert analysis type mappings if any
      if (newAttribute.selectedAnalysisTypes.length > 0) {
        console.log('Creating analysis type mappings for:', newAttribute.selectedAnalysisTypes);
        const analysisTypeMappings = newAttribute.selectedAnalysisTypes.map(typeId => ({
          attribute_id: attributeData.id,
          analysis_type_id: typeId
        }));

        console.log('Creating analysis type mappings for:', {
          selectedTypes: newAttribute.selectedAnalysisTypes,
          mappings: analysisTypeMappings
        });

        const { error: analysisTypeError } = await supabase
          .from('attribute_analysis_types')  // Changed back to the correct table name
          .insert(analysisTypeMappings);

        if (analysisTypeError) {
          console.error('Error creating analysis type mappings:', analysisTypeError);
          throw analysisTypeError;
        }
        console.log('Successfully created analysis type mappings');
      }

      toast.success('Attribute added successfully');  // Changed message from 'saved' to 'added'

      // Reset form
      console.log('Resetting form...');
      setNewAttribute({
        name: '',
        description: '',
        selectedAnalysisTypes: [],
        selectedIndustries: []
      });

      // Refresh attributes list
      console.log('Fetching updated attributes...');
      await fetchAttributes();
      console.log('Attribute creation process completed successfully');
    } catch (error) {
      console.error('Error in attribute creation process:', error);
      toast.error('Failed to add attribute');  // Changed message from 'save' to 'add'
    } finally {
      setLoading(false);
    }
  };

  const addAttribute = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('Starting attribute creation with data:', newAttribute);

      const { data: existingAttributes, error: checkError } = await supabase
        .from('attributes')
        .select('*')
        .filter('name', 'eq', newAttribute.name);

      if (checkError) {
        console.error('Error checking existing attributes:', checkError);
        throw checkError;
      }

      console.log('Existing attributes check result:', existingAttributes);

      if (existingAttributes && existingAttributes.length > 0) {
        console.log('Found existing attribute with same name');
        toast.error(`An attribute named "${newAttribute.name}" already exists`);
        return;
      }

      console.log('Attempting to insert new attribute...');
      const { data: attributeData, error: attributeError } = await supabase
        .from('attributes')
        .insert([{
          name: newAttribute.name,
          description: newAttribute.description,
          analysis_type: newAttribute.selectedAnalysisTypes,
          is_industry_standard: newAttribute.is_industry_standard
        }])
        .select()
        .single();

      if (attributeError) {
        console.error('Error creating attribute:', attributeError);
        throw attributeError;
      }

      console.log('Successfully created attribute:', attributeData);

      if (newAttribute.selectedIndustries.length > 0) {
        console.log('Creating industry mappings for:', newAttribute.selectedIndustries);
        const industryMappings = newAttribute.selectedIndustries.map(industryId => ({
          attribute_id: attributeData.id,
          industry_id: industryId
        }));

        console.log('Creating industry mappings for:', {
          selectedIndustries: newAttribute.selectedIndustries,
          mappings: industryMappings
        });

        const { error: mappingError } = await supabase
          .from('attribute_industry_mapping')
          .insert(industryMappings);

        if (mappingError) {
          console.error('Error creating industry mappings:', mappingError);
          throw mappingError;
        }
        console.log('Successfully created industry mappings');
      }

      toast.success('Attribute added successfully');
      console.log('Resetting form...');
      setNewAttribute({
        name: '',
        description: '',
        selectedAnalysisTypes: [],
        selectedIndustries: []
      });
      console.log('Fetching updated attributes...');
      await fetchAttributes();
      console.log('Attribute creation process completed successfully');
    } catch (error) {
      console.error('Error in attribute creation process:', error);
      toast.error('Failed to add attribute');
    } finally {
      setLoading(false);
    }
  };

  const deleteAttribute = async () => {
    if (!attributeToDelete) return;

    try {
      // 1. Delete industry mappings
      console.log('Deleting industry mappings...');
      const { error: industryMappingError } = await supabase
        .from('attribute_industry_mapping')
        .delete()
        .eq('attribute_id', attributeToDelete.id);

      if (industryMappingError) {
        console.error('Error deleting industry mappings:', industryMappingError);
        throw industryMappingError;
      }

      // 2. Delete analysis type mappings
      console.log('Deleting analysis type mappings...');
      const { error: analysisTypeMappingError } = await supabase
        .from('attribute_analysis_types')
        .delete()
        .eq('attribute_id', attributeToDelete.id);

      if (analysisTypeMappingError) {
        console.error('Error deleting analysis type mappings:', analysisTypeMappingError);
        throw analysisTypeMappingError;
      }

      // 3. Delete statement options
      console.log('Deleting statement options...');
      const { data: statements } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_id', attributeToDelete.id);

      if (statements && statements.length > 0) {
        const statementIds = statements.map(s => s.id);
        const { error: optionsError } = await supabase
          .from('attribute_statement_options')
          .delete()
          .in('statement_id', statementIds);

        if (optionsError) {
          console.error('Error deleting statement options:', optionsError);
          throw optionsError;
        }
      }

      // 4. Delete statements
      console.log('Deleting statements...');
      const { error: statementsError } = await supabase
        .from('attribute_statements')
        .delete()
        .eq('attribute_id', attributeToDelete.id);

      if (statementsError) {
        console.error('Error deleting statements:', statementsError);
        throw statementsError;
      }

      // 5. Finally delete the attribute
      console.log('Deleting attribute...');
      const { error: attributeError } = await supabase
        .from('attributes')
        .delete()
        .eq('id', attributeToDelete.id);

      if (attributeError) {
        console.error('Error deleting attribute:', attributeError);
        throw attributeError;
      }

      toast.success('Attribute deleted successfully');
      fetchAttributes();
    } catch (error) {
      console.error('Error in deletion process:', error);
      toast.error('Failed to delete attribute');
    } finally {
      setAttributeToDelete(null);
    }
  };

  const handleEdit = (attribute, statement) => {
    const editKey = `${attribute.id}-${statement.id}`;

    // Initialize edit data with current values
    setEditedData(prev => ({
      ...prev,
      [editKey]: {
        attribute: {
          id: attribute.id,
          name: attribute.name,
          description: attribute.description,
          is_industry_standard: attribute.is_industry_standard
        },
        statement: {
          id: statement.id,
          statement: statement.statement,
          selectedAnalysisTypes: statement.analysis_types || [],
          selectedIndustries: statement.industries || [], // These are the original IDs
          options: statement.attribute_statement_options?.map(opt => ({
            id: opt.id,
            text: opt.option_text,
            weight: opt.weight
          })) || []
        }
      }
    }));

    setEditingRows(prev => ({
      ...prev,
      [editKey]: true
    }));
  };

  const isEditing = (attributeId, statementId) => {
    const editKey = `${attributeId}-${statementId}`;
    return editingRows[editKey] || false;
  };

  const handleCancelEdit = (attributeId, statementId) => {
    const editKey = `${attributeId}-${statementId}`;
    setEditingRows({});
    setEditedData({});
    setDeletedOptions(prev => {
      const newState = { ...prev };
      delete newState[statementId];
      return newState;
    });
    // Clear search queries when canceling edit
    setIndustrySearchQuery('');
    setAttributeSearchQuery('');
    setStatementSearchQuery('');
  };

  const addStatement = async () => {
    try {
      if (!user) {
        toast.error('You must be logged in to add statements');
        return;
      }

      // Check if user is super_admin
      const isSuperAdmin = () => {
        return (
          user?.app_metadata?.role === 'super_admin' ||
          user?.role === 'super_admin' ||
          user?.email?.endsWith('@bets.com')  // Assuming @bets.com emails are super admins
        );
      };

      if (!isSuperAdmin()) {
        toast.error('Only super admins can add statements');
        return;
      }

      if (!selectedAttributeId) {
        toast.error('Please select an attribute');
        return;
      }

      if (!currentStatement.text.trim()) {
        toast.error('Statement text is required');
        return;
      }
      console.log(currentStatement);

      setLoading(true);

      // Get the user's role claim from JWT
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // 1. Insert the statement
      const { data: statementData, error: statementError } = await supabase
        .from('attribute_statements')
        .insert([{
          attribute_id: selectedAttributeId,
          statement: currentStatement.text.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('*')
        .single();

      if (statementError) {
        console.error('Statement Error:', statementError);
        throw new Error('Failed to create statement/Check it can be duplicate statement');
      }

      // 2. Insert the options with proper weights
      const optionsToInsert = currentStatement.options.map(option => ({
        statement_id: statementData.id,
        option_text: option.text,
        weight: option.weight,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: optionsError } = await supabase
        .from('attribute_statement_options')
        .insert(optionsToInsert)
        .select('*');

      if (optionsError) {
        console.error('Options Error:', optionsError);
        // Cleanup the statement if options insertion fails
        await supabase
          .from('attribute_statements')
          .delete()
          .eq('id', statementData.id);
        throw new Error('Failed to create options');
      }

      toast.success('Statement and options added successfully');

      // Reset form
      setCurrentStatement({
        text: '',
        attribute_bank_id: null,
        options: [
          { text: 'Excellent', weight: 100 },
          { text: 'Very Good', weight: 80 },
          { text: 'Good', weight: 60 },
          { text: 'Fair & Satisfactory', weight: 40 },
          { text: 'Needs Improvement', weight: 20 }
        ]
      });
      setSelectedAttributeId(null);

      // Refresh the data
      await fetchAttributes();
    } catch (error) {
      console.error('Error saving statement:', error);
      toast.error(error.message || 'Failed to save statement');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (editKey) => {
    try {
      const editedDataItem = editedData[editKey];
      if (!editedDataItem) {
        toast.error("No changes to save");
        return;
      }

      // Extract IDs from editKey
      const match = editKey.match(/^([^-]+-[^-]+-[^-]+-[^-]+-[^-]+)-(.+)$/);
      if (!match) {
        toast.error("Invalid edit key format");
        return;
      }
      const [_, attributeId, statementId] = match;
      
      setLoading(true);

      // Update attribute details
      const { error: attributeError } = await supabase
        .from('attributes')
        .update({
          name: editedDataItem.attribute.name,
          description: editedDataItem.attribute.description,
          is_industry_standard: editedDataItem.attribute.is_industry_standard
        })
        .eq('id', attributeId);

      if (attributeError) throw attributeError;

      // Update statement with new analysis types and industries
      const { error: statementError } = await supabase
        .from('attribute_statements')
        .update({
          statement: editedDataItem.statement.statement,
          analysis_types: editedDataItem.statement.selectedAnalysisTypes,
          industries: editedDataItem.statement.selectedIndustries
        })
        .eq('id', statementId);

      if (statementError) throw statementError;

      // Update options
      if (editedDataItem.statement.options?.length > 0) {
        for (const option of editedDataItem.statement.options) {
          if (option.id) {
            const { error: optionError } = await supabase
              .from('attribute_statement_options')
              .update({
                option_text: option.text || option.option_text,
                weight: option.weight
              })
              .eq('id', option.id);

            if (optionError) throw optionError;
          }
        }
      }

      // Reset edit states for just this row
      setEditingRows(prev => {
        const newState = { ...prev };
        delete newState[editKey];
        return newState;
      });
      setEditedData(prev => {
        const newState = { ...prev };
        delete newState[editKey];
        return newState;
      });

      toast.success('Changes saved successfully');
      await fetchAttributes();
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalysisTypeChange = (editKey, typeId) => {
    setEditedData(prev => {
      const currentEdit = prev[editKey];
      if (!currentEdit) return prev;

      const currentTypes = [...(currentEdit.statement.selectedAnalysisTypes || [])];
      const newTypes = currentTypes.includes(typeId)
        ? currentTypes.filter(id => id !== typeId)
        : [...currentTypes, typeId];

      return {
        ...prev,
        [editKey]: {
          ...currentEdit,
          statement: {
            ...currentEdit.statement,
            selectedAnalysisTypes: newTypes
          }
        }
      };
    });
  };

  const handleIndustryChange = (editKey, industryId) => {
    setEditedData(prev => {
      const currentEdit = prev[editKey];
      if (!currentEdit) return prev;

      const currentIndustries = [...(currentEdit.statement.selectedIndustries || [])];
      const newIndustries = currentIndustries.includes(industryId)
        ? currentIndustries.filter(id => id !== industryId)
        : [...currentIndustries, industryId];

      return {
        ...prev,
        [editKey]: {
          ...currentEdit,
          statement: {
            ...currentEdit.statement,
            selectedIndustries: newIndustries
          }
        }
      };
    });
  };

  const DeleteStatementDialog = () => (
    <AlertDialog open={!!statementToDelete} onOpenChange={() => setStatementToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this statement?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the statement and all its options. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setStatementToDelete(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (statementToDelete) {
                handleDeleteStatement(statementToDelete);
              }
            }}
            className="bg-red-500 hover:bg-red-600"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const handleDeleteOption = (attributeId, statementId, optionId) => {
    setDeletedOptions(prev => ({
      ...prev,
      [statementId]: [...(prev[statementId] || []), optionId]
    }));

    setEditedData(prev => {
      const newData = { ...prev };
      const statement = newData[`${attributeId}-${statementId}`].statement;
      statement.options = statement.options.filter(opt => opt.id !== optionId);
      return newData;
    });
  };

  const processAttributesForDisplay = (attributes) => {
    return attributes.flatMap(attr => {
      // If attribute has statements, create an item for each statement
      if (attr.attribute_statements && attr.attribute_statements.length > 0) {
        return attr.attribute_statements.map(stmt => ({
          attribute: attr,
          statement: {
            ...stmt,
            // Use statement's analysis types if present, otherwise use attribute's
            analysis_types: stmt.analysis_types?.length > 0 
              ? stmt.analysis_types 
              : attr.attribute_analysis_types?.map(at => at.analysis_type_id) || [],
            // Use statement's industries if present, otherwise use attribute's
            industries: stmt.industries?.length > 0
              ? stmt.industries
              : attr.attribute_industry_mapping?.map(im => im.industry_id) || []
          }
        }));
      }
      // If attribute has no statements, create a single item with empty statement
      return [{
        attribute: attr,
        statement: {
          id: `no-statement-${attr.id}`,
          statement: '',
          analysis_types: attr.attribute_analysis_types?.map(at => at.analysis_type_id) || [],
          industries: attr.attribute_industry_mapping?.map(im => im.industry_id) || [],
          attribute_statement_options: []
        }
      }];
    });
  };

  // Utility function to truncate text
  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  // Filter and paginate the data
  const filteredAttributes = attributes.filter(attr => {
    const matchesIndustry = selectedIndustryFilter === 'all' ||
      attr.attribute_statements?.some(stmt =>
        stmt.industries?.some(industry => industry === selectedIndustryFilter)
      );

    const matchesAttribute = selectedAttributeFilter === 'all' ||
      attr.id === selectedAttributeFilter;

    const matchesStatement = selectedStatementFilter === 'all' ||
      attr.attribute_statements?.some(stmt =>
        stmt.id === selectedStatementFilter
      );

    return matchesIndustry && matchesAttribute && matchesStatement;
  });

  const processedItems = processAttributesForDisplay(filteredAttributes);
  const totalPages = Math.ceil(processedItems.length / itemsPerPage);
  const paginatedItems = processedItems.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const isSuperAdmin = () => {
    return (
      user?.app_metadata?.role === 'super_admin' ||
      user?.role === 'super_admin' ||
      user?.email?.endsWith('@bets.com')  // Assuming @bets.com emails are super admins
    );
  };

  const syncAttributeChanges = (editKey, newAttributeData) => {
    setEditedData(prev => {
      const currentEdit = prev[editKey];
      if (!currentEdit) return prev;

      const attributeId = currentEdit.attribute.id;
      const updates = {};

      // Update all statements that share the same attribute
      Object.entries(prev).forEach(([key, data]) => {
        if (data.attribute.id === attributeId) {
          updates[key] = {
            ...data,
            attribute: {
              ...data.attribute,
              ...newAttributeData
            }
          };
        }
      });

      return {
        ...prev,
        ...updates
      };
    });
  };

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto relative">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-primary">Attribute Management</h1>
        {isSuperAdmin() && (
          <Button onClick={() => setAttributeDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Attribute
          </Button>
        )}
      </div>

      {/* Top Section - Split into two cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 mb-6">
        {/* Left Card - Add Attribute */}
        {isSuperAdmin() && (
          <Card className="w-full">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Add Attribute</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="attributeName">Attribute Name</Label>
                  <Input
                    id="attributeName"
                    value={newAttribute.name}
                    onChange={(e) => setNewAttribute({ ...newAttribute, name: e.target.value })}
                    placeholder="Enter attribute name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attributeDescription">Description</Label>
                  <Textarea
                    id="attributeDescription"
                    value={newAttribute.description}
                    onChange={(e) => setNewAttribute({ ...newAttribute, description: e.target.value })}
                    placeholder="Enter attribute description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Analysis Types</Label>
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Search analysis types..."
                      value={analysisTypeSearchQuery}
                      onChange={(e) => setAnalysisTypeSearchQuery(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2">
                      {analysisTypeList
                        .filter(type =>
                          type.analysis_type.toLowerCase().includes(analysisTypeSearchQuery.toLowerCase())
                        )
                        .map((type) => (
                          <div key={type.id} className="flex items-center space-x-2 py-1">
                            <Checkbox
                              id={`analysis-type-${type.id}`}
                              checked={newAttribute.selectedAnalysisTypes.includes(type.id)}
                              onCheckedChange={(checked) => {
                                console.log('Analysis Type selection changed:', {
                                  typeId: type.id,
                                  checked,
                                  currentSelection: newAttribute.selectedAnalysisTypes
                                });
                                const updatedTypes = checked
                                  ? [...newAttribute.selectedAnalysisTypes, type.id]
                                  : newAttribute.selectedAnalysisTypes.filter(id => id !== type.id);
                                console.log('Updated analysis types:', updatedTypes);
                                setNewAttribute({ ...newAttribute, selectedAnalysisTypes: updatedTypes });
                              }}
                            />
                            <Label
                              htmlFor={`analysis-type-${type.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {type.analysis_type}
                            </Label>
                          </div>
                        ))}
                    </div>
                    {newAttribute.selectedAnalysisTypes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newAttribute.selectedAnalysisTypes.map(typeId => {
                          const type = analysisTypeList.find(t => t.id === typeId);
                          return type ? (
                            <Badge
                              key={type.id}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {type.analysis_type}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => {
                                  setNewAttribute({
                                    ...newAttribute,
                                    selectedAnalysisTypes: newAttribute.selectedAnalysisTypes.filter(id => id !== type.id)
                                  });
                                }}
                              />
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Industries</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Search industries..."
                      value={industrySearchQuery}
                      onChange={(e) => setIndustrySearchQuery(e.target.value)}
                      className="w-full"
                    />
                    <div className="border rounded-lg p-4 space-y-2 h-48 overflow-y-auto">
                      {industries
                        .filter(industry =>
                          industry.name.toLowerCase().includes(industrySearchQuery.toLowerCase())
                        )
                        .map((industry) => (
                          <div key={industry.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`industry-${industry.id}`}
                              checked={newAttribute.selectedIndustries.includes(industry.id)}
                              onCheckedChange={(checked) => {
                                console.log('Industry selection changed:', {
                                  industryId: industry.id,
                                  checked,
                                  currentSelection: newAttribute.selectedIndustries
                                });
                                const updatedIndustries = checked
                                  ? [...newAttribute.selectedIndustries, industry.id]
                                  : newAttribute.selectedIndustries.filter(id => id !== industry.id);
                                console.log('Updated industries:', updatedIndustries);
                                setNewAttribute(prev => ({
                                  ...prev,
                                  selectedIndustries: updatedIndustries
                                }));
                              }}
                            />
                            <Label
                              htmlFor={`industry-${industry.id}`}
                              className="text-sm font-normal"
                            >
                              {industry.name}
                            </Label>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleSaveAttribute}
                  className="w-full"
                  disabled={!newAttribute.name.trim()}
                >
                  Save Attribute
                </Button>
              </div>
            </div>
          </Card>
        )}
        {/* Right Card - Sub-attributes and Options */}
        <Card className="w-full">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Add Statement and Options</h2>

            {/* Attribute Selection */}
            <div className="mb-6">
              <Label>Select Attribute</Label>
              <Select
                value={selectedAttributeId}
                onValueChange={setSelectedAttributeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Search or select an attribute..." />
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
                    {attributes
                      .filter(attr =>
                        attr.name.toLowerCase().includes(attributeSearchQuery.toLowerCase())
                      )
                      .map((attr) => (
                        <SelectItem key={attr.id} value={attr.id}>
                          {attr.name}
                        </SelectItem>
                      ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Left Box - Statement */}
              <div className="border rounded-lg p-4">
                <h3 className="text-md font-medium mb-3">Statement</h3>
                <div className="space-y-3">
                  <Input
                    value={currentStatement.text}
                    onChange={(e) => setCurrentStatement({ ...currentStatement, text: e.target.value })}
                    placeholder="Enter statement text"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Right Box - Options */}
              <div className="border rounded-lg p-4">
                <h3 className="text-md font-medium mb-3">Options (Default)</h3>
                <div className="space-y-3">
                  {currentStatement.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <Input
                        value={option.text}
                        onChange={(e) => {
                          const newOptions = [...currentStatement.options];
                          newOptions[optIndex].text = e.target.value;
                          setCurrentStatement({ ...currentStatement, options: newOptions });
                        }}
                        placeholder="Option text"
                        className="flex-1"
                      />
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={option.weight}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            const newOptions = [...currentStatement.options];
                            newOptions[optIndex].weight = value === '' ? 0 : parseFloat(value);
                            setCurrentStatement({ ...currentStatement, options: newOptions });
                          }
                        }}
                        className="w-24"
                        placeholder="Weight (0-100)"
                      />
                      {currentStatement.options.length > 5 && (
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            const newOptions = currentStatement.options.filter((_, i) => i !== optIndex);
                            setCurrentStatement({ ...currentStatement, options: newOptions });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newOptions = [...currentStatement.options, { text: '', weight: 0 }];
                      setCurrentStatement({ ...currentStatement, options: newOptions });
                    }}
                    className="w-full"
                  >
                    Add Additional Option
                  </Button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6">
              <Button
                onClick={addStatement}
                className="w-full"
                disabled={
                  !selectedAttributeId ||
                  !currentStatement.text.trim() ||
                  currentStatement.options.length === 0 ||
                  currentStatement.options.some(opt => !opt.text.trim() || opt.weight === undefined || opt.weight === null)
                }
              >
                Save Statement
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Section - Tabular View */}
      <div className="mb-6">
        <Card>
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
                <DialogComponent open={industryDialogOpen} onOpenChange={setIndustryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-between mt-1">
                      {selectedIndustryFilter === 'all'
                        ? "All Industries"
                        : industries.find(i => i.id === selectedIndustryFilter)?.name || "Select Industry"}
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
                        {industries
                          .filter(industry =>
                            industry.name.toLowerCase().includes(industrySearchQuery.toLowerCase())
                          )
                          .map((industry) => (
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
                        {industries.filter(industry =>
                          industry.name.toLowerCase().includes(industrySearchQuery.toLowerCase())
                        ).length === 0 && industrySearchQuery && (
                            <div className="text-sm text-muted-foreground text-center py-6">
                              No industries found
                            </div>
                          )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </DialogComponent>
              </div>

              <div>
                <Label>Filter by Attribute</Label>
                <DialogComponent open={attributeDialogOpen} onOpenChange={setAttributeDialogOpen}>
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
                                  {truncateText(attr.name, 40)}
                                </span>
                                <span className="text-xs text-muted-foreground truncate" title={attr.description}>
                                  {truncateText(attr.description, 60)}
                                </span>
                              </div>
                            </div>
                          ))}
                        {attributes.filter(attr =>
                          attr.name.toLowerCase().includes(attributeSearchQuery.toLowerCase())
                        ).length === 0 && attributeSearchQuery && (
                            <div className="text-sm text-muted-foreground text-center py-6">
                              No attributes found
                            </div>
                          )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </DialogComponent>
              </div>

              <div>
                <Label>Filter by Statement</Label>
                <DialogComponent open={statementDialogOpen} onOpenChange={setStatementDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-between mt-1">
                      {selectedStatementFilter === 'all'
                        ? "All Statements"
                        : truncateText(
                          attributes
                            .flatMap(attr => attr.attribute_statements || [])
                            .find(stmt => stmt.id === selectedStatementFilter)?.statement || "Select Statement",
                          40
                        )}
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
                                  {truncateText(stmt.statement, 60)}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {truncateText(stmt.attributeName, 30)}
                                </span>
                              </div>
                            </div>
                          ))}
                        {attributes
                          .flatMap(attr => attr.attribute_statements || [])
                          .filter(stmt =>
                            stmt.statement &&
                            stmt.statement.toLowerCase().includes(statementSearchQuery.toLowerCase())
                          ).length === 0 && statementSearchQuery && (
                            <div className="text-sm text-muted-foreground text-center py-6">
                              No statements found
                            </div>
                          )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </DialogComponent>
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
                  {processedItems.length} results found
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border rounded-lg">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <Table className="border-2 border-gray-300">
              <TableHeader>
                <TableRow className="border-b-2 border-gray-300">
                  <TableHead className="w-[100px] border-r-2 border-gray-300 font-semibold">Type</TableHead>
                  <TableHead className="w-[250px] border-r-2 border-gray-300 font-semibold">Attribute</TableHead>
                  <TableHead className="w-[250px] border-r-2 border-gray-300 font-semibold">Statement</TableHead>
                  <TableHead className="w-[200px] border-r-2 border-gray-300 font-semibold">Options</TableHead>
                  <TableHead className="w-[80px] border-r-2 border-gray-300 font-semibold text-center">Weight</TableHead>
                  <TableHead className="w-[150px] border-r-2 border-gray-300 font-semibold">Industry</TableHead>
                  <TableHead className="w-[100px] font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Loading attributes...
                    </TableCell>
                  </TableRow>
                ) : paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No attributes found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item, index) => {
                    const { attribute, statement } = item;
                    const editKey = `${attribute.id}-${statement.id}`;
                    const isEditing = editingRows[editKey];
                    const editData = editedData[editKey];

                    return (
                      <TableRow key={editKey} className="border-b border-gray-300">
                        <TableCell className="align-top border-r border-gray-300">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div>
                                <Label>Analysis Types</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {analysisTypeList.map((type) => (
                                    <div key={type.id} className="flex items-center gap-2">
                                      <Checkbox
                                        id={`analysis-type-${type.id}-${editKey}`}
                                        checked={editedData[editKey]?.statement?.selectedAnalysisTypes !== undefined 
                                          ? editedData[editKey]?.statement?.selectedAnalysisTypes?.includes(type.id)
                                          : statement.analysis_types?.includes(type.id)}
                                        onCheckedChange={() => handleAnalysisTypeChange(editKey, type.id)}
                                      />
                                      <Label
                                        htmlFor={`analysis-type-${type.id}-${editKey}`}
                                        className="text-sm font-normal"
                                      >
                                        {type.analysis_type}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm">
                              {statement.analysis_types?.map((typeId) => {
                                const type = analysisTypeList.find(t => t.id === typeId);
                                return type ? (
                                  <span key={typeId}>
                                    {type.analysis_type}
                                    {', '}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top border-r border-gray-300">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={editedData[editKey]?.attribute?.name || attribute.name}
                                onChange={(e) => {
                                  setEditedData(prev => ({
                                    ...prev,
                                    [editKey]: {
                                      ...prev[editKey],
                                      attribute: {
                                        ...(prev[editKey]?.attribute || attribute),
                                        name: e.target.value
                                      }
                                    }
                                  }));
                                }}
                                className="w-full"
                              />
                              <Textarea
                                value={editedData[editKey]?.attribute?.description || attribute.description}
                                onChange={(e) => {
                                  setEditedData(prev => ({
                                    ...prev,
                                    [editKey]: {
                                      ...prev[editKey],
                                      attribute: {
                                        ...(prev[editKey]?.attribute || attribute),
                                        description: e.target.value
                                      }
                                    }
                                  }));
                                }}
                                className="mt-1"
                              />
                            </div>
                          ) : (
                            <div>
                              <div className="font-medium">{attribute.name}</div>
                              {attribute.description && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {truncateText(attribute.description, 100)}
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top border-r border-gray-300">
                          {isEditing ? (
                            <Textarea
                              value={editedData[editKey]?.statement?.statement || statement.statement}
                              onChange={(e) => {
                                setEditedData(prev => ({
                                  ...prev,
                                  [editKey]: {
                                    ...prev[editKey],
                                    statement: {
                                      ...(prev[editKey]?.statement || statement),
                                      statement: e.target.value
                                    }
                                  }
                                }));
                              }}
                              className="w-full"
                            />
                          ) : (
                            statement.statement
                          )}
                        </TableCell>
                        <TableCell className="align-top border-r border-gray-300 p-0">
                          {isEditing ? (
                            <div className="divide-y divide-gray-300">
                              {(editedData[editKey]?.statement?.options || statement.attribute_statement_options)
                                .sort((a, b) => b.weight - a.weight)
                                .map((option, index) => (
                                  <div key={option.id || index} className="flex items-center p-2">
                                    <Input
                                      value={option.text || option.option_text}
                                      onChange={(e) => {
                                        const options = editedData[editKey]?.statement?.options ||
                                          statement.attribute_statement_options.map(opt => ({
                                            id: opt.id,
                                            text: opt.option_text,
                                            weight: opt.weight
                                          }));

                                        setEditedData(prev => ({
                                          ...prev,
                                          [editKey]: {
                                            ...prev[editKey],
                                            statement: {
                                              ...(prev[editKey]?.statement || statement),
                                              options: options.map((opt, i) =>
                                                i === index ? { ...opt, text: e.target.value } : opt
                                              )
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-full"
                                    />
                                  </div>
                                ))}
                            </div>
                          ) : (
                            statement.attribute_statement_options?.length > 0 ? (
                              <div className="divide-y divide-gray-300">
                                {statement.attribute_statement_options
                                  .sort((a, b) => b.weight - a.weight)
                                  .map((option) => (
                                    <div key={option.id} className="text-sm p-2">
                                      {option.option_text}
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <div className="p-2">
                                <span className="text-muted-foreground">No options</span>
                              </div>
                            )
                          )}
                        </TableCell>
                        <TableCell className="align-top border-r border-gray-300 p-0">
                          {isEditing ? (
                            <div className="divide-y divide-gray-300">
                              {(editedData[editKey]?.statement?.options || statement.attribute_statement_options)
                                .sort((a, b) => b.weight - a.weight)
                                .map((option, index) => (
                                  <div key={option.id || index} className="flex items-center p-2">
                                    <Input
                                      type="number"
                                      value={option.weight}
                                      onChange={(e) => {
                                        const options = editedData[editKey]?.statement?.options ||
                                          statement.attribute_statement_options.map(opt => ({
                                            id: opt.id,
                                            text: opt.option_text,
                                            weight: opt.weight
                                          }));

                                        setEditedData(prev => ({
                                          ...prev,
                                          [editKey]: {
                                            ...prev[editKey],
                                            statement: {
                                              ...(prev[editKey]?.statement || statement),
                                              options: options.map((opt, i) =>
                                                i === index ? { ...opt, weight: parseInt(e.target.value) } : opt
                                              )
                                            }
                                          }
                                        }));
                                      }}
                                      className="w-full text-center"
                                    />
                                  </div>
                                ))}
                            </div>
                          ) : (
                            statement.attribute_statement_options?.length > 0 ? (
                              <div className="divide-y divide-gray-300">
                                {statement.attribute_statement_options
                                  .sort((a, b) => b.weight - a.weight)
                                  .map((option) => (
                                    <div key={option.id} className="text-sm p-2 text-center">
                                      {option.weight}
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <div className="p-2 text-center">
                                <span>-</span>
                              </div>
                            )
                          )}
                        </TableCell>
                        <TableCell className="align-top border-r border-gray-300">
                          {isEditing ? (
                            <div className="space-y-2 p-2 max-h-48 overflow-y-auto">
                              {industries.map((industry) => (
                                <div key={industry.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`industry-${attribute.id}-${industry.id}`}
                                    checked={editedData[editKey]?.statement?.selectedIndustries !== undefined
                                      ? editedData[editKey]?.statement?.selectedIndustries?.includes(industry.id)
                                      : statement.industries?.includes(industry.id)}
                                    onCheckedChange={() => handleIndustryChange(editKey, industry.id)}
                                  />
                                  <Label
                                    htmlFor={`industry-${attribute.id}-${industry.id}`}
                                    className="text-sm"
                                  >
                                    {industry.name}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm">
                              {(statement.industries || []).map((industryId) => {
                                const industry = industries.find(i => i.id === industryId);
                                return industry ? (
                                  <div key={industryId} className="mb-1">
                                    {industry.name}
                                  </div>
                                ) : null;
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex justify-center space-x-2">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingRows({});
                                    setEditedData({});
                                  }}
                                  disabled={loading}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleEditSubmit(editKey)}
                                  disabled={loading}
                                >
                                  {loading ? 'Saving...' : 'Save'}
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (loading) return;
                                    // Don't allow edit if another row is being edited
                                    if (Object.values(editingRows).some(Boolean)) {
                                      toast.error('Please save or cancel the current edit first');
                                      return;
                                    }
                                    setEditingRows({ [editKey]: true });
                                    setEditedData({
                                      [editKey]: {
                                        attribute: {
                                          ...attribute,
                                          selectedIndustries: attribute.attribute_industry_mapping?.map(m => m.industry_id) || [],
                                          selectedAnalysisTypes: attribute.attribute_analysis_types?.map(at => at.analysis_type_id) || []
                                        },
                                        statement: {
                                          ...statement,
                                          options: statement.attribute_statement_options?.map(opt => ({
                                            id: opt.id,
                                            text: opt.option_text,
                                            weight: opt.weight
                                          }))
                                        }
                                      }
                                    });
                                  }}
                                  disabled={loading || Object.values(editingRows).some(Boolean)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (loading || Object.values(editingRows).some(Boolean)) return;
                                    setAttributeToDelete(attribute);
                                  }}
                                  disabled={loading || Object.values(editingRows).some(Boolean)}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="py-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => setPage(pageNumber)}
                        isActive={page === pageNumber}
                      >
                        {pageNumber}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!attributeToDelete} onOpenChange={() => setAttributeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the attribute "{attributeToDelete?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAttribute}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteStatementDialog />
    </div>
  );
}
