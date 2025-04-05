import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
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
  const [newAttribute, setNewAttribute] = useState({
    name: '',
    description: '',
    selectedAnalysisTypes: [],
    is_industry_standard: true,
    selectedIndustries: [],
    statement: {
      text: '',
      options: [
        { text: 'Excellent', weight: 100 },
        { text: 'Very Good', weight: 80 },
        { text: 'Good', weight: 60 },
        { text: 'Fair & Satisfactory', weight: 40 },
        { text: 'Needs Improvement', weight: 20 }
      ]
    }
  });
  const [showStatementForm, setShowStatementForm] = useState(false);
  const [isAttributeValid, setIsAttributeValid] = useState(false);
  const [isStatementValid, setIsStatementValid] = useState(false);
  const [statementOptions, setStatementOptions] = useState([]);
  const [newOption, setNewOption] = useState({ text: '', weight: 0 });

  const [analysisTypeList, setAnalysisTypeList] = useState([]);
  const [industrySearchQuery, setIndustrySearchQuery] = useState('');
  const [attributeSearchQuery, setAttributeSearchQuery] = useState('');
  const [statementSearchQuery, setStatementSearchQuery] = useState('');
  const [attributeToDelete, setAttributeToDelete] = useState(null);
  const [statementToDelete, setStatementToDelete] = useState(null);
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState('all');
  const [selectedAttributeFilter, setSelectedAttributeFilter] = useState('all');
  const [selectedStatementFilter, setSelectedStatementFilter] = useState('all');
  const [selectedAnalysisTypeFilter, setSelectedAnalysisTypeFilter] = useState('all');
  const [selectedAttributeId, setSelectedAttributeId] = useState(null);
  const [currentStatement, setCurrentStatement] = useState({
    text: '',
    attribute_bank_id: null,
    analysisTypes: [],
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
  const [analysisTypeDialogOpen, setAnalysisTypeDialogOpen] = useState(false);

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
        .from('analysis_types')  
        .select("id, name");
      
      if (error) throw error;
      
      // Transform to match existing UI expectations
      const transformedData = data?.map(item => ({
        id: item.id,
        analysis_type: item.name  
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

      // Fetch attributes with their analysis types and statements
      const { data: attributesData, error: attributesError } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          is_industry_standard,
          attribute_industry_mapping (
            industry_id,
            industries (
              id,
              name
            )
          ),
          attribute_statements (
            id,
            statement,
            attribute_bank_id,
            statement_analysis_types (
              id,
              analysis_type:analysis_types (
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
        `);

      if (attributesError) {
        console.error('Error details:', attributesError);
        throw attributesError;
      }

      // Transform the data to make it easier to work with and filter out bank-linked statements
      const transformedData = (attributesData || [])
        .map(attr => ({
          ...attr,
          industries: attr.attribute_industry_mapping?.map(im => ({
            id: im.industry_id,
            name: im.industries?.name
          })) || [],
          attribute_statements: (attr.attribute_statements || [])
            .filter(stmt => !stmt.attribute_bank_id) 
            .map(stmt => ({
              ...stmt,
              analysisTypes: stmt.statement_analysis_types?.map(sat => ({
                id: sat.analysis_type.id,
                name: sat.analysis_type.name
              })) || []
            }))
        }))
        // Removing this filter so we show all attributes, even those without statements
        // .filter(attr => attr.attribute_statements.length > 0)

      // Sort the transformed data alphabetically by name
      const sortedData = transformedData.sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );

      setAttributes(sortedData);
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

  const [currentStep, setCurrentStep] = useState(1);

  const handleNameChange = (value) => {
    setNewAttribute(prev => ({ ...prev, name: value }));
    setIsAttributeValid(!!value.trim());
    if (value.trim()) {
      setShowStatementForm(true);
    } else {
      setShowStatementForm(false);
    }
  };

  const addAttribute = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!newAttribute.name.trim() || !newAttribute.statement.text.trim()) {
        toast.error('Both attribute and statement details are required');
        return;
      }

      // 1. Create attribute
      const { data: attributeData, error: attributeError } = await supabase
        .from('attributes')
        .insert([{
          name: newAttribute.name,
          description: newAttribute.description,
          is_industry_standard: newAttribute.is_industry_standard
        }])
        .select()
        .single();

      if (attributeError) throw attributeError;

      // 2. Create industry mappings
      if (newAttribute.selectedIndustries.length > 0) {
        const industryMappings = newAttribute.selectedIndustries.map(industryId => ({
          attribute_id: attributeData.id,
          industry_id: industryId
        }));

        const { error: mappingError } = await supabase
          .from('attribute_industry_mapping')
          .insert(industryMappings);

        if (mappingError) throw mappingError;
      }

      // 3. Create statement
      const { data: statementData, error: statementError } = await supabase
        .from('attribute_statements')
        .insert([{
          attribute_id: attributeData.id,
          statement: newAttribute.statement.text
        }])
        .select()
        .single();

      if (statementError) throw statementError;

      // 4. Create statement analysis type mappings
      if (newAttribute.selectedAnalysisTypes.length > 0) {
        const analysisTypeMappings = newAttribute.selectedAnalysisTypes.map(typeId => ({
          statement_id: statementData.id,
          analysis_type_id: typeId
        }));

        const { error: analysisTypeError } = await supabase
          .from('statement_analysis_types')
          .insert(analysisTypeMappings);

        if (analysisTypeError) throw analysisTypeError;
      }

      // 5. Create statement options
      const optionsMappings = newAttribute.statement.options.map(option => ({
        statement_id: statementData.id,
        option_text: option.text,
        weight: option.weight
      }));

      const { error: optionsError } = await supabase
        .from('attribute_statement_options')
        .insert(optionsMappings);

      if (optionsError) throw optionsError;

      toast.success('Attribute created successfully');
      
      // Reset forms
      setNewAttribute({
        name: '',
        description: '',
        selectedAnalysisTypes: [],
        is_industry_standard: true,
        selectedIndustries: [],
        statement: {
          text: '',
          options: [
            { text: 'Excellent', weight: 100 },
            { text: 'Very Good', weight: 80 },
            { text: 'Good', weight: 60 },
            { text: 'Fair & Satisfactory', weight: 40 },
            { text: 'Needs Improvement', weight: 20 }
          ]
        }
      });
      setShowStatementForm(false);
      setCurrentStep(1);
      await fetchAttributes();
      const addAttributeDialogRef = document.querySelector('#add-attribute-dialog-ref');
      if (addAttributeDialogRef) {
        addAttributeDialogRef.click();
      }
    } catch (error) {
      console.error('Error in attribute creation process:', error);
      toast.error('Failed to create attribute');
    } finally {
      setLoading(false);
    }
  };

  const deleteAttribute = async (attributeId, statementId) => {
    try {
      setLoading(true);

      // If there's a valid statement ID, delete statement-related data first
      if (statementId && !statementId.startsWith('no-statement')) {
        // 1. Delete this specific statement's analysis type mappings
        const { error: analysisTypeError } = await supabase
          .from('statement_analysis_types')
          .delete()
          .eq('statement_id', statementId);

        if (analysisTypeError) {
          console.error('Error deleting analysis type mappings:', analysisTypeError);
          throw analysisTypeError;
        }

        // 2. Delete this specific statement's options
        const { error: optionsError } = await supabase
          .from('attribute_statement_options')
          .delete()
          .eq('statement_id', statementId);

        if (optionsError) {
          console.error('Error deleting statement options:', optionsError);
          throw optionsError;
        }

        // 3. Delete this specific statement
        const { error: stmtDeleteError } = await supabase
          .from('attribute_statements')
          .delete()
          .eq('id', statementId);

        if (stmtDeleteError) {
          console.error('Error deleting statement:', stmtDeleteError);
          throw stmtDeleteError;
        }
      }

      // Check if this was the last statement for this attribute or if there are no statements
      const { data: remainingStatements, error: checkError } = await supabase
        .from('attribute_statements')
        .select('id')
        .eq('attribute_id', attributeId);

      if (checkError) {
        console.error('Error checking remaining statements:', checkError);
        throw checkError;
      }

      // Delete the attribute if it has no statements or this was its last statement
      if (!remainingStatements || remainingStatements.length === 0) {
        // 1. Delete industry mappings
        const { error: industryError } = await supabase
          .from('attribute_industry_mapping')
          .delete()
          .eq('attribute_id', attributeId);

        if (industryError) {
          console.error('Error deleting industry mappings:', industryError);
          throw industryError;
        }

        // 2. Delete the attribute
        const { error: attributeError } = await supabase
          .from('attributes')
          .delete()
          .eq('id', attributeId);

        if (attributeError) {
          console.error('Error deleting attribute:', attributeError);
          throw attributeError;
        }
      }

      toast.success('Deleted successfully');
      await fetchAttributes();
    } catch (error) {
      console.error('Error in deletion process:', error);
      toast.error('Failed to delete');
    } finally {
      setLoading(false);
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
          analysisTypes: statement.analysisTypes || []
        }
      }
    }));

    setEditingRows(prev => ({
      ...prev,
      [editKey]: true
    }));
  };

  const handleEditAnalysisTypeChange = (attribute, statement, editKey, analysisType, checked) => {
    setEditedData(prev => {
      const currentEdit = prev[editKey] || {};
      const currentTypes = currentEdit.statement?.analysisTypes || statement.analysisTypes || [];
      
      const newTypes = checked
        ? [...currentTypes, { id: analysisType.id, name: analysisType.analysis_type }]
        : currentTypes.filter(t => t.id !== analysisType.id);

      return {
        ...prev,
        [editKey]: {
          ...currentEdit,
          statement: {
            ...(currentEdit.statement || statement),
            analysisTypes: newTypes
          }
        }
      };
    });
  };

  const handleEditIndustryChange = (attribute, editKey, industryId, checked) => {
    setEditedData(prev => {
      const currentEdit = prev[editKey] || {};
      const currentIndustries = currentEdit.attribute?.industries || attribute.industries || [];
      
      const newIndustries = checked
        ? [...currentIndustries, industries.find(i => i.id === industryId)]
        : currentIndustries.filter(i => i.id !== industryId);

      return {
        ...prev,
        [editKey]: {
          ...currentEdit,
          attribute: {
            ...(currentEdit.attribute || attribute),
            industries: newIndustries
          }
        }
      };
    });
  };

  const handleSaveEdit = async (editKey) => {
    try {
      setLoading(true);
      const editedDataItem = editedData[editKey];
      if (!editedDataItem) return;

      const { statement, attribute } = editedDataItem;

      // 1. Update attribute basic info if changed
      if (attribute?.name || attribute?.description || attribute?.is_industry_standard) {
        const { error: attributeError } = await supabase
          .from('attributes')
          .update({
            name: attribute.name,
            description: attribute.description,
            is_industry_standard: attribute.is_industry_standard
          })
          .eq('id', attribute.id);

        if (attributeError) throw attributeError;
      }

      // 2. Update statement text if changed
      if (statement?.statement) {
        const { error: statementError } = await supabase
          .from('attribute_statements')
          .update({ statement: statement.statement })
          .eq('id', statement.id);

        if (statementError) throw statementError;
      }

      // 3. Update options if changed
      if (statement?.attribute_statement_options) {
        const updates = statement.attribute_statement_options.map(option => ({
          id: option.id,
          option_text: option.option_text,
          weight: option.weight
        }));

        for (const update of updates) {
          const { error: optionError } = await supabase
            .from('attribute_statement_options')
            .update({
              option_text: update.option_text,
              weight: update.weight
            })
            .eq('id', update.id);

          if (optionError) throw optionError;
        }
      }

      // 4. Update analysis types if changed
      if (statement?.analysisTypes) {
        // First delete existing mappings
        const { error: deleteAnalysisTypeError } = await supabase
          .from('statement_analysis_types')
          .delete()
          .eq('statement_id', statement.id);

        if (deleteAnalysisTypeError) throw deleteAnalysisTypeError;

        // Then insert new mappings
        if (statement.analysisTypes.length > 0) {
          const analysisTypeMappings = statement.analysisTypes.map(type => ({
            statement_id: statement.id,
            analysis_type_id: type.id
          }));

          const { error: analysisTypeError } = await supabase
            .from('statement_analysis_types')
            .insert(analysisTypeMappings);

          if (analysisTypeError) throw analysisTypeError;
        }
      }

      // 5. Update industry mappings if changed
      if (attribute?.industries) {
        // First delete existing mappings
        const { error: deleteIndustryError } = await supabase
          .from('attribute_industry_mapping')
          .delete()
          .eq('attribute_id', attribute.id);

        if (deleteIndustryError) throw deleteIndustryError;

        // Then insert new mappings
        if (attribute.industries.length > 0) {
          const industryMappings = attribute.industries.map(industry => ({
            attribute_id: attribute.id,
            industry_id: industry.id
          }));

          const { error: industryMappingError } = await supabase
            .from('attribute_industry_mapping')
            .insert(industryMappings);

          if (industryMappingError) throw industryMappingError;
        }
      }

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
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = (attributeId, statementId) => {
    const editKey = `${attributeId}-${statementId}`;
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
  };

  const isEditing = (attributeId, statementId) => {
    const editKey = `${attributeId}-${statementId}`;
    return editingRows[editKey] || false;
  };

  const addStatement = async () => {
    try {
      if (!selectedAttributeId || !currentStatement.text.trim() || currentStatement.analysisTypes.length === 0) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Create statement
      const { data: statementData, error: statementError } = await supabase
        .from('attribute_statements')
        .insert([{
          attribute_id: selectedAttributeId,
          statement: currentStatement.text
        }])
        .select()
        .single();

      if (statementError) throw statementError;

      // Create analysis type mappings
      const analysisTypeMappings = currentStatement.analysisTypes.map(typeId => ({
        statement_id: statementData.id,
        analysis_type_id: typeId
      }));

      const { error: analysisTypeError } = await supabase
        .from('statement_analysis_types')
        .insert(analysisTypeMappings);

      if (analysisTypeError) throw analysisTypeError;

      // Create options
      const optionsMappings = currentStatement.options
        .filter(opt => opt.text.trim())
        .map(option => ({
          statement_id: statementData.id,
          option_text: option.text,
          weight: option.weight
        }));

      const { error: optionsError } = await supabase
        .from('attribute_statement_options')
        .insert(optionsMappings);

      if (optionsError) throw optionsError;

      toast.success('Statement added successfully');
      
      // Reset form
      setCurrentStatement({
        text: '',
        attribute_bank_id: null,
        analysisTypes: [],
        options: [
          { text: 'Excellent', weight: 100 },
          { text: 'Very Good', weight: 80 },
          { text: 'Good', weight: 60 },
          { text: 'Fair & Satisfactory', weight: 40 },
          { text: 'Needs Improvement', weight: 20 }
        ]
      });
      setSelectedAttributeId(null);
      await fetchAttributes();
    } catch (error) {
      console.error('Error adding statement:', error);
      toast.error('Failed to add statement');
    }
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
            analysisTypes: stmt.analysisTypes || []
          }
        }));
      }
      // If attribute has no statements, create a single item with empty statement
      return [{
        attribute: attr,
        statement: {
          id: `no-statement-${attr.id}`,
          statement: '',
          analysisTypes: attr.attribute_analysis_types?.map(at => ({
            id: at.analysis_type_id,
            name: at.analysis_types?.analysis_type
          })) || [],
          industries: attr.attribute_industry_mapping?.map(im => im.industry_id) || []
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
  const filteredAttributes = useMemo(() => {
    return attributes
      .map(attr => {
        // Map each attribute's statements
        const statements = attr.attribute_statements?.map(stmt => ({
          attribute: attr,
          statement: stmt,
          options: stmt.options || []
        })) || [];

        return statements;
      })
      .flat()
      .filter(item => {
        if (selectedIndustryFilter !== 'all') {
          if (!item.attribute.industries.some(ind => ind.id === selectedIndustryFilter)) {
            return false;
          }
        }

        if (selectedAttributeFilter !== 'all') {
          if (item.attribute.id !== selectedAttributeFilter) {
            return false;
          }
        }

        if (selectedStatementFilter !== 'all') {
          if (item.statement.id !== selectedStatementFilter) {
            return false;
          }
        }

        if (selectedAnalysisTypeFilter !== 'all') {
          if (!item.statement.analysisTypes?.some(at => at.id === selectedAnalysisTypeFilter)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // First sort by attribute name
        const attrCompare = a.attribute.name.localeCompare(b.attribute.name);
        if (attrCompare !== 0) return attrCompare;
        
        // Then by statement text if attribute names are same
        return a.statement.statement.localeCompare(b.statement.statement);
      });
  }, [attributes, selectedIndustryFilter, selectedAttributeFilter, selectedStatementFilter, selectedAnalysisTypeFilter]);

  // Sort industries alphabetically
  const sortedIndustries = useMemo(() => {
    return [...industries].sort((a, b) => a.name.localeCompare(b.name));
  }, [industries]);

  // Sort analysis types alphabetically
  const sortedAnalysisTypes = useMemo(() => {
    return [...analysisTypeList].sort((a, b) => a.analysis_type.localeCompare(b.analysis_type));
  }, [analysisTypeList]);

  // Sort attributes alphabetically
  const sortedAttributes = useMemo(() => {
    return [...attributes].sort((a, b) => a.name.localeCompare(b.name));
  }, [attributes]);

  const totalPages = Math.ceil(filteredAttributes.length / itemsPerPage);
  const paginatedItems = filteredAttributes.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const isSuperAdmin = () => {
    return (
      user?.app_metadata?.role === 'super_admin' ||
      user?.role === 'super_admin' ||
      user?.email?.endsWith('@bets.com')  
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

  const handleAnalysisTypeChange = (selectedTypes) => {
    setNewAttribute(prev => ({
      ...prev,
      selectedAnalysisTypes: selectedTypes
    }));
  };

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8 overflow-auto relative">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-4">Attribute Management</h1>
        {isSuperAdmin() && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-[280px] h-12 text-lg font-medium">
                <Plus className="h-5 w-5 mr-2" /> Add NEW Attribute
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-6 pb-4 flex-none">
                <DialogTitle>Add New Attribute</DialogTitle>
                <DialogDescription>
                  Create a new attribute with its evaluation statement
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-6 pb-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Attribute Details */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Analysis Types</Label>
                          <div className="mt-1.5 border rounded-md p-4 max-h-[200px] overflow-y-auto">
                            {sortedAnalysisTypes.map((type) => (
                              <div key={type.id} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={`type-${type.id}`}
                                  checked={newAttribute.selectedAnalysisTypes.includes(type.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setNewAttribute({
                                        ...newAttribute,
                                        selectedAnalysisTypes: [...newAttribute.selectedAnalysisTypes, type.id]
                                      });
                                    } else {
                                      setNewAttribute({
                                        ...newAttribute,
                                        selectedAnalysisTypes: newAttribute.selectedAnalysisTypes.filter(id => id !== type.id)
                                      });
                                    }
                                  }}
                                />
                                <Label htmlFor={`type-${type.id}`} className="text-sm">{type.analysis_type}</Label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="name" className="text-sm font-medium">Attribute Name</Label>
                          <Input
                            id="name"
                            value={newAttribute.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Enter attribute name"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                          <Textarea
                            id="description"
                            value={newAttribute.description}
                            onChange={(e) => setNewAttribute({ ...newAttribute, description: e.target.value })}
                            placeholder="Enter attribute description"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Industries</Label>
                          <div className="mt-1.5 border rounded-md p-4 max-h-[200px] overflow-y-auto">
                            {sortedIndustries.map((industry) => (
                              <div key={industry.id} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={`industry-${industry.id}`}
                                  checked={newAttribute.selectedIndustries.includes(industry.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setNewAttribute({
                                        ...newAttribute,
                                        selectedIndustries: [...newAttribute.selectedIndustries, industry.id]
                                      });
                                    } else {
                                      setNewAttribute({
                                        ...newAttribute,
                                        selectedIndustries: newAttribute.selectedIndustries.filter(id => id !== industry.id)
                                      });
                                    }
                                  }}
                                />
                                <Label htmlFor={`industry-${industry.id}`} className="text-sm">{industry.name}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Statement Details */}
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="statement" className="text-sm font-medium">Evaluation Statement</Label>
                        <Textarea
                          id="statement"
                          value={newAttribute.statement.text}
                          onChange={(e) => {
                            setNewAttribute({
                              ...newAttribute,
                              statement: { ...newAttribute.statement, text: e.target.value }
                            });
                            setIsStatementValid(!!e.target.value.trim());
                          }}
                          placeholder="Enter evaluation statement"
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Statement Options</Label>
                        <div className="mt-1.5 space-y-3">
                          {newAttribute.statement.options.map((option, index) => (
                            <div key={index} className="flex gap-3 items-center">
                              <Input
                                value={option.text}
                                onChange={(e) => {
                                  const newOptions = [...newAttribute.statement.options];
                                  newOptions[index].text = e.target.value;
                                  setNewAttribute({
                                    ...newAttribute,
                                    statement: { ...newAttribute.statement, options: newOptions }
                                  });
                                }}
                                placeholder="Option text"
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                value={option.weight}
                                onChange={(e) => {
                                  const newOptions = [...newAttribute.statement.options];
                                  newOptions[index].weight = parseInt(e.target.value);
                                  setNewAttribute({
                                    ...newAttribute,
                                    statement: { ...newAttribute.statement, options: newOptions }
                                  });
                                }}
                                placeholder="Weight"
                                className="w-24"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 pt-4 border-t">
                <DialogClose id="add-attribute-dialog-ref" asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={addAttribute}
                  disabled={!newAttribute.name.trim() || !newAttribute.statement.text.trim() || loading}
                >
                  {loading ? 'Creating...' : 'Create Attribute'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Top Section - Split into two cards */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Statement Addition Section */}
        <Card className="w-full">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Add Statement and Options</h2>

            {/* Analysis Type Selection */}
            <div className="mb-6">
              <Label>Analysis Types</Label>
              <div className="space-y-2 mt-2 border rounded-md p-4 max-h-[200px] overflow-y-auto">
                {sortedAnalysisTypes.map(type => (
                  <div key={type.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`analysis-type-${type.id}`}
                      checked={currentStatement.analysisTypes.includes(type.id)}
                      onCheckedChange={(checked) => {
                        setCurrentStatement(prev => ({
                          ...prev,
                          analysisTypes: checked
                            ? [...prev.analysisTypes, type.id]
                            : prev.analysisTypes.filter(id => id !== type.id)
                        }));
                      }}
                    />
                    <Label htmlFor={`analysis-type-${type.id}`}>{type.analysis_type}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Attribute Selection */}
            <div className="mb-6">
              <Label>Select Attribute</Label>
              <Select
                value={selectedAttributeId}
                onValueChange={setSelectedAttributeId}
                disabled={!currentStatement.analysisTypes.length > 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={currentStatement.analysisTypes.length > 0 ? "Search or select an attribute..." : "Select an analysis type first"} />
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
                    {sortedAttributes
                      .filter(attr =>
                        attr.name.toLowerCase().includes(attributeSearchQuery.toLowerCase())
                      )
                      .map((attr) => (
                        <SelectItem key={attr.id} value={attr.id}>
                          <div className="truncate" title={attr.name}>{attr.name}</div>
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
                  currentStatement.analysisTypes.length === 0 ||
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
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Search and Filters</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {attributes.length} attributes • {attributes.reduce((total, attr) => total + (attr.attribute_statements?.length || 0), 0)} statements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Filter by Analysis Type</Label>
                <DialogComponent open={analysisTypeDialogOpen} onOpenChange={setAnalysisTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-between mt-1">
                      {selectedAnalysisTypeFilter === 'all'
                        ? "All Analysis Types"
                        : <div className="truncate" title={sortedAnalysisTypes.find(at => at.id === selectedAnalysisTypeFilter)?.analysis_type || "Select Analysis Type"}>{sortedAnalysisTypes.find(at => at.id === selectedAnalysisTypeFilter)?.analysis_type || "Select Analysis Type"}</div>}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px] w-[90vw]">
                    <DialogHeader>
                      <DialogTitle>Select Analysis Type</DialogTitle>
                      <DialogDescription>
                        Search and select an analysis type to filter by
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-2">
                      <Input
                        type="text"
                        placeholder="Search analysis types..."
                        value={analysisTypeSearchQuery}
                        onChange={(e) => setAnalysisTypeSearchQuery(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <ScrollArea className="h-[300px] p-4">
                      <div className="space-y-2">
                        <div
                          className={cn(
                            "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                            selectedAnalysisTypeFilter === 'all' && "bg-accent"
                          )}
                          onClick={() => {
                            setSelectedAnalysisTypeFilter('all');
                            setAnalysisTypeDialogOpen(false);
                          }}
                        >
                          All Analysis Types
                        </div>
                        {sortedAnalysisTypes
                          .filter(at =>
                            at.analysis_type.toLowerCase().includes(analysisTypeSearchQuery.toLowerCase())
                          )
                          .map((analysisType) => (
                            <div
                              key={analysisType.id}
                              className={cn(
                                "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                selectedAnalysisTypeFilter === analysisType.id && "bg-accent"
                              )}
                              onClick={() => {
                                setSelectedAnalysisTypeFilter(analysisType.id);
                                setAnalysisTypeDialogOpen(false);
                              }}
                            >
                              <div className="truncate" title={analysisType.analysis_type}>{analysisType.analysis_type}</div>
                            </div>
                          ))}
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
                        : <div className="truncate" title={sortedAttributes.find(a => a.id === selectedAttributeFilter)?.name || "Select Attribute"}>{sortedAttributes.find(a => a.id === selectedAttributeFilter)?.name || "Select Attribute"}</div>}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px] w-[90vw]">
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
                        {sortedAttributes
                          .filter(attr =>
                            attr.name.toLowerCase().includes(attributeSearchQuery.toLowerCase())
                          )
                          .map((attribute) => (
                            <div
                              key={attribute.id}
                              className={cn(
                                "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                selectedAttributeFilter === attribute.id && "bg-accent"
                              )}
                              onClick={() => {
                                setSelectedAttributeFilter(attribute.id);
                                setAttributeDialogOpen(false);
                              }}
                            >
                              <div className="truncate" title={attribute.name}>{attribute.name}</div>
                            </div>
                          ))}
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
                        : <div className="truncate" title={filteredAttributes.find(item => item.statement.id === selectedStatementFilter)?.statement.statement || "Select Statement"}>{filteredAttributes.find(item => item.statement.id === selectedStatementFilter)?.statement.statement || "Select Statement"}</div>}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px] w-[90vw]">
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
                        {filteredAttributes
                          .filter(item =>
                            item.statement.statement?.toLowerCase().includes(statementSearchQuery.toLowerCase())
                          )
                          .sort((a, b) => a.statement.statement.localeCompare(b.statement.statement))
                          .map((item) => (
                            <div
                              key={item.statement.id}
                              className={cn(
                                "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                selectedStatementFilter === item.statement.id && "bg-accent"
                              )}
                              onClick={() => {
                                setSelectedStatementFilter(item.statement.id);
                                setStatementDialogOpen(false);
                              }}
                            >
                              <div className="flex flex-col gap-1 py-1">
                                <div className="whitespace-pre-wrap break-words" title={item.statement.statement}>
                                  {item.statement.statement}
                                </div>
                                <div className="text-sm text-muted-foreground font-medium">
                                  Attribute: {item.attribute.name}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </DialogComponent>
              </div>

              <div>
                <Label>Filter by Industry</Label>
                <DialogComponent open={industryDialogOpen} onOpenChange={setIndustryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-between mt-1">
                      {selectedIndustryFilter === 'all'
                        ? "All Industries"
                        : <div className="truncate" title={sortedIndustries.find(i => i.id === selectedIndustryFilter)?.name || "Select Industry"}>{sortedIndustries.find(i => i.id === selectedIndustryFilter)?.name || "Select Industry"}</div>}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px] w-[90vw]">
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
                        {sortedIndustries
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
                              <div className="truncate" title={industry.name}>{industry.name}</div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </DialogComponent>
              </div>
            </div>
            {(selectedIndustryFilter !== 'all' || selectedAttributeFilter !== 'all' || 
              selectedStatementFilter !== 'all' || selectedAnalysisTypeFilter !== 'all') && (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedIndustryFilter('all');
                    setSelectedAttributeFilter('all');
                    setSelectedStatementFilter('all');
                    setSelectedAnalysisTypeFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
                <div className="text-sm text-muted-foreground pt-1.5">
                  {filteredAttributes.length} results found
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border rounded-lg w-full">
        <CardContent className="p-0">
          <div className="relative w-full overflow-auto">
            <Table className="border-2 border-gray-300">
              <TableHeader>
                <TableRow className="border-b-2 border-gray-300">
                  <TableHead className="w-[100px] border-r-2 border-gray-300 font-semibold">Type</TableHead>
                  <TableHead className="w-[200px] border-r-2 border-gray-300 font-semibold">Attribute</TableHead>
                  <TableHead className="w-[300px] border-r-2 border-gray-300 font-semibold">Statement</TableHead>
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
                            <div className="space-y-2 p-2">
                              {sortedAnalysisTypes.map((analysisType) => (
                                <div key={analysisType.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`analysis-type-${statement.id}-${analysisType.id}`}
                                    checked={(editedData[editKey]?.statement?.analysisTypes || statement.analysisTypes)?.some(at => at.id === analysisType.id)}
                                    onCheckedChange={(checked) => 
                                      handleEditAnalysisTypeChange(
                                        attribute,
                                        statement,
                                        editKey,
                                        analysisType,
                                        checked
                                      )
                                    }
                                  />
                                  <Label
                                    htmlFor={`analysis-type-${statement.id}-${analysisType.id}`}
                                    className="text-sm"
                                  >
                                    {analysisType.analysis_type}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm">
                              {statement.analysisTypes?.map(at => (
                                <div key={at.id} className="mb-1">
                                  {at.name}
                                </div>
                              ))}
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
                            <div className="p-2">
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
                                className="w-full min-h-[100px]"
                              />
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap break-words max-w-[300px]">
                              {statement.statement}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top border-r border-gray-300 p-0">
                          {isEditing ? (
                            <div className="divide-y divide-gray-300">
                              {(editedData[editKey]?.statement?.attribute_statement_options || statement.attribute_statement_options || [])
                                .map((option) => (
                                  <div key={option.id} className="p-2">
                                    <Input
                                      type="text"
                                      value={option.option_text || ''}
                                      onChange={(e) => {
                                        setEditedData(prev => {
                                          const currentEdit = prev[editKey] || {};
                                          const currentStatement = currentEdit.statement || {};
                                          const currentOptions = currentStatement.attribute_statement_options || [...statement.attribute_statement_options];
                                          const optionIndex = currentOptions.findIndex(o => o.id === option.id);
                                          
                                          if (optionIndex > -1) {
                                            currentOptions[optionIndex] = {
                                              ...currentOptions[optionIndex],
                                              option_text: e.target.value
                                            };
                                          }

                                          return {
                                            ...prev,
                                            [editKey]: {
                                              ...currentEdit,
                                              statement: {
                                                ...currentStatement,
                                                attribute_statement_options: currentOptions
                                              }
                                            }
                                          };
                                        });
                                      }}
                                      className="w-full text-sm"
                                    />
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-300">
                              {(statement.attribute_statement_options || [])
                                .map((option) => (
                                  <div key={option.id} className="text-sm p-2 whitespace-pre-wrap break-words">
                                    {option.option_text}
                                  </div>
                                ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top border-r border-gray-300 p-0">
                          {isEditing ? (
                            <div className="divide-y divide-gray-300">
                              {(editedData[editKey]?.statement?.attribute_statement_options || statement.attribute_statement_options || [])
                                .map((option) => (
                                  <div key={option.id} className="p-2">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={option.weight || 0}
                                      onChange={(e) => {
                                        const weight = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                        setEditedData(prev => {
                                          const currentEdit = prev[editKey] || {};
                                          const currentStatement = currentEdit.statement || {};
                                          const currentOptions = currentStatement.attribute_statement_options || [...statement.attribute_statement_options];
                                          const optionIndex = currentOptions.findIndex(o => o.id === option.id);
                                          
                                          if (optionIndex > -1) {
                                            currentOptions[optionIndex] = {
                                              ...currentOptions[optionIndex],
                                              weight
                                            };
                                          }

                                          return {
                                            ...prev,
                                            [editKey]: {
                                              ...currentEdit,
                                              statement: {
                                                ...currentStatement,
                                                attribute_statement_options: currentOptions
                                              }
                                            }
                                          };
                                        });
                                      }}
                                    />
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-300">
                              {(statement.attribute_statement_options || [])
                                .map((option) => (
                                  <div key={option.id} className="text-sm p-2 text-center">
                                    {option.weight}
                                  </div>
                                ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top border-r border-gray-300">
                          {isEditing ? (
                            <div className="space-y-2 p-2">
                              {sortedIndustries.map((industry) => (
                                <div key={industry.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`industry-${attribute.id}-${industry.id}`}
                                    checked={(editedData[editKey]?.attribute?.industries || attribute.industries)?.some(i => i.id === industry.id)}
                                    onCheckedChange={(checked) => 
                                      handleEditIndustryChange(
                                        attribute,
                                        editKey,
                                        industry.id,
                                        checked
                                      )
                                    }
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
                              {attribute.industries?.map(industry => (
                                <div key={industry.id} className="mb-1">
                                  {industry.name}
                                </div>
                              ))}
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
                                  onClick={() => handleSaveEdit(editKey)}
                                  disabled={loading || !editedData[editKey]}
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
                                    setAttributeToDelete({ attributeId: attribute.id, statementId: statement.id });
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
              This will delete the statement and if this is the last statement, the attribute will also be deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAttribute(attributeToDelete.attributeId, attributeToDelete.statementId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Button - Only enabled when both forms are filled */}
      {/* Removed */}
    </div>
  );
}
