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
    analysis_type: '',
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
      const response = await supabase.from('analysis_type').select("*");
      setAnalysisTypeList(response.data);
      console.log(response.data);
    } catch (e) {
      console.error(e);
    }
  }

  const fetchAttributes = async () => {
    try {
      setLoading(true);

      // Fetch attributes one by one to avoid any potential cascade issues
      const { data: attributesData, error: attributesError } = await supabase
        .from('attributes')
        .select(`
          id,
          name,
          description,
          analysis_type,
          is_industry_standard,
          attribute_industry_mapping (
            industry_id,
            industries (
              id,
              name
            )
          )
        `)
        .order('name', { ascending: true });

      if (attributesError) throw attributesError;

      // Then fetch statements for each attribute
      const processedData = await Promise.all(attributesData.map(async (attr) => {
        const { data: statements, error: stmtError } = await supabase
          .from('attribute_statements')
          .select(`
            id,
            statement,
            attribute_bank_id,
            attribute_id,
            attribute_statement_options (
              id,
              option_text,
              weight,
              created_at
            )
          `)
          .eq('attribute_id', attr.id)
          .order('created_at', { ascending: true });

        if (stmtError) throw stmtError;

        return {
          ...attr,
          attribute_statements: statements?.map(stmt => ({
            ...stmt,
            attribute_statement_options: (stmt.attribute_statement_options || [])
              .sort((a, b) => b.weight - a.weight)
          }))
        };
      }));

      setAttributes(processedData);
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
      if (!newAttribute.name.trim()) {
        toast.error('Attribute name is required');
        return;
      }

      setLoading(true);

      // 1. Insert the attribute
      const { data: attributeData, error: attributeError } = await supabase
        .from('attributes')
        .insert([{
          name: newAttribute.name.trim(),
          description: newAttribute.description?.trim() || '',
          analysis_type: newAttribute.analysis_type,
          is_industry_standard: true
        }])
        .select()
        .single();

      if (attributeError) throw attributeError;

      // 2. Insert industry mappings if any are selected
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

      toast.success('Attribute saved successfully');

      // Reset form
      setNewAttribute({
        name: '',
        description: '',
        analysis_type: '',
        selectedIndustries: []
      });

      // Refresh attributes list
      await fetchAttributes();
    } catch (error) {
      console.error('Error saving attribute:', error);
      toast.error('Failed to save attribute');
    } finally {
      setLoading(false);
    }
  };

  const addAttribute = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: existingAttributes, error: checkError } = await supabase
        .from('attributes')
        .select('*')
        .filter('name', 'eq', newAttribute.name);

      if (checkError) throw checkError;

      if (existingAttributes && existingAttributes.length > 0) {
        toast.error(`An attribute named "${newAttribute.name}" already exists`);
        return;
      }

      const { data: attributeData, error: attributeError } = await supabase
        .from('attributes')
        .insert([{
          name: newAttribute.name,
          description: newAttribute.description,
          analysis_type: newAttribute.analysis_type,
          is_industry_standard: newAttribute.is_industry_standard
        }])
        .select()
        .single();

      if (attributeError) throw attributeError;

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

      toast.success('Attribute added successfully');
      setNewAttribute({
        name: '',
        description: '',
        analysis_type: '',
        selectedIndustries: []
      });
      fetchAttributes();
    } catch (error) {
      toast.error('Failed to add attribute');
    } finally {
      setLoading(false);
    }
  };

  const deleteAttribute = async () => {
    if (!attributeToDelete) return;

    try {
      const { error } = await supabase
        .from('attributes')
        .delete()
        .eq('id', attributeToDelete.id);

      if (error) throw error;

      toast.success('Attribute deleted successfully');
      fetchAttributes();
    } catch (error) {
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
      [attribute.id]: {
        attribute: {
          ...attribute,
          name: attribute.name,
          description: attribute.description,
          analysis_type: attribute.analysis_type,
          selectedIndustries: attribute.attribute_industry_mapping?.map(m => m.industry_id) || []
        },
        statements: [{
          id: statement.id,
          statement: statement.statement,
          options: statement.attribute_statement_options?.map(opt => ({
            id: opt.id,
            text: opt.option_text,
            weight: opt.weight
          })) || []
        }]
      }
    }));

    // Set editing state for this row
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
    setEditingRows(prev => {
      const newState = { ...prev };
      delete newState[editKey];
      return newState;
    });
    setEditedData(prev => {
      const newState = { ...prev };
      delete newState[attributeId];
      return newState;
    });
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

  const handleSaveEdit = async (attributeId, statementId) => {
    try {
      const editedAttribute = editedData[attributeId];
      if (!editedAttribute) {
        toast.error("No changes to save");
        return;
      }

      const editKey = `${attributeId}-${statementId}`;
      setLoading(true);

      // Update attribute details
      const { error: attributeError } = await supabase
        .from('attributes')
        .update({
          name: editedAttribute.attribute.name,
          description: editedAttribute.attribute.description,
          analysis_type: editedAttribute.attribute.analysis_type
        })
        .eq('id', attributeId);

      if (attributeError) throw attributeError;

      // Update industry mappings
      await supabase
        .from('attribute_industry_mapping')
        .delete()
        .eq('attribute_id', attributeId);

      if (editedAttribute.attribute.selectedIndustries?.length > 0) {
        const { error: industryError } = await supabase
          .from('attribute_industry_mapping')
          .insert(
            editedAttribute.attribute.selectedIndustries.map(industryId => ({
              attribute_id: attributeId,
              industry_id: industryId
            }))
          );

        if (industryError) throw industryError;
      }

      // Update statement
      const statement = editedAttribute.statements[0];
      const { error: statementError } = await supabase
        .from('attribute_statements')
        .update({ statement: statement.statement })
        .eq('id', statement.id);

      if (statementError) throw statementError;

      // Update options
      for (const option of statement.options) {
        if (option.id) {
          const { error: optionError } = await supabase
            .from('attribute_statement_options')
            .update({
              option_text: option.text,
              weight: option.weight
            })
            .eq('id', option.id);

          if (optionError) throw optionError;
        }
      }

      // Clear edit states
      setEditingRows(prev => {
        const newState = { ...prev };
        delete newState[editKey];
        return newState;
      });

      setEditedData(prev => {
        const newState = { ...prev };
        delete newState[attributeId];
        return newState;
      });

      toast.success('Changes saved successfully');
      await fetchAttributes(); // Refresh the data
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStatement = async (statement) => {
    try {
      if (!statement || !statement.id) {
        toast.error('Invalid statement');
        return;
      }

      setLoading(true);

      // First delete the options
      const { error: optionsError } = await supabase
        .from('attribute_statement_options')
        .delete()
        .eq('statement_id', statement.id);

      if (optionsError) {
        console.error('Error deleting options:', optionsError);
        throw optionsError;
      }

      // Then delete the statement
      const { error: statementError } = await supabase
        .from('attribute_statements')
        .delete()
        .eq('id', statement.id);

      if (statementError) {
        console.error('Error deleting statement:', statementError);
        throw statementError;
      }

      toast.success('Statement deleted successfully');
      await fetchAttributes();
      setStatementToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete statement');
    } finally {
      setLoading(false);
    }
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
      const statement = newData[attributeId].statements[0];
      statement.options = statement.options.filter(opt => opt.id !== optionId);
      return newData;
    });
  };

  const processAttributesForDisplay = (attributes) => {
    // First sort the attributes by name
    const sortedAttributes = [...attributes].sort((a, b) =>
      (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
    );

    return sortedAttributes.map(attr => {
      const statements = attr.attribute_statements || [];
      if (statements.length === 0) {
        // If no statements, create a default row
        return {
          attribute: attr,
          statement: { id: 'no-statement', statement: 'No statement', attribute_statement_options: [] }
        };
      }
      // If has statements, create a row for each statement
      return statements.map(stmt => ({
        attribute: attr,
        statement: {
          ...stmt,
          attribute_statement_options: stmt.attribute_statement_options || []
        }
      }));
    }).flat();
  };

  // Utility function to truncate text
  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  // Filter and paginate the data
  const filteredAttributes = attributes.filter(attr => {
    const matchesIndustry = selectedIndustryFilter === 'all' ||
      attr.attribute_industry_mapping?.some(mapping =>
      (mapping.industry_id === selectedIndustryFilter ||
        (mapping.industries && mapping.industries.id === selectedIndustryFilter))
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
                  <Label>Analysis Type</Label>
                  <Select
                    value={newAttribute.analysis_type}
                    onValueChange={(value) => setNewAttribute({ ...newAttribute, analysis_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select analysis type" />
                    </SelectTrigger>
                    <SelectContent>
                      {
                        analysisTypeList && analysisTypeList.map((item) => (
                          <SelectItem key={item.key} value={ item.analysis_type  }>{item.analysis_type}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
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
                                setNewAttribute(prev => ({
                                  ...prev,
                                  selectedIndustries: checked
                                    ? [...prev.selectedIndustries, industry.id]
                                    : prev.selectedIndustries.filter(id => id !== industry.id)
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
                    const editData = editedData[attribute.id];

                    return (
                      <TableRow key={`${attribute.id}-${statement.id}`} className="border-b border-gray-300">
                        <TableCell className="align-top border-r border-gray-300">{attribute.analysis_type}</TableCell>
                        <TableCell className="align-top border-r border-gray-300">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={editedData[attribute.id]?.attribute?.name || attribute.name}
                                onChange={(e) => {
                                  setEditedData(prev => ({
                                    ...prev,
                                    [attribute.id]: {
                                      ...prev[attribute.id],
                                      attribute: {
                                        ...(prev[attribute.id]?.attribute || attribute),
                                        name: e.target.value
                                      }
                                    }
                                  }));
                                }}
                                className="w-full"
                              />
                              <Textarea
                                value={editedData[attribute.id]?.attribute?.description || attribute.description}
                                onChange={(e) => {
                                  setEditedData(prev => ({
                                    ...prev,
                                    [attribute.id]: {
                                      ...prev[attribute.id],
                                      attribute: {
                                        ...(prev[attribute.id]?.attribute || attribute),
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
                              value={editedData[attribute.id]?.statements?.[0]?.statement || statement.statement}
                              onChange={(e) => {
                                setEditedData(prev => ({
                                  ...prev,
                                  [attribute.id]: {
                                    ...prev[attribute.id],
                                    statements: [{
                                      ...(prev[attribute.id]?.statements?.[0] || statement),
                                      statement: e.target.value
                                    }]
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
                              {(editedData[attribute.id]?.statements?.[0]?.options || statement.attribute_statement_options)
                                .sort((a, b) => b.weight - a.weight)
                                .map((option, index) => (
                                  <div key={option.id || index} className="flex items-center p-2">
                                    <Input
                                      value={option.text || option.option_text}
                                      onChange={(e) => {
                                        const options = editedData[attribute.id]?.statements?.[0]?.options ||
                                          statement.attribute_statement_options.map(opt => ({
                                            id: opt.id,
                                            text: opt.option_text,
                                            weight: opt.weight
                                          }));

                                        setEditedData(prev => ({
                                          ...prev,
                                          [attribute.id]: {
                                            ...prev[attribute.id],
                                            statements: [{
                                              ...(prev[attribute.id]?.statements?.[0] || statement),
                                              options: options.map((opt, i) =>
                                                i === index ? { ...opt, text: e.target.value } : opt
                                              )
                                            }]
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
                              {(editedData[attribute.id]?.statements?.[0]?.options || statement.attribute_statement_options)
                                .sort((a, b) => b.weight - a.weight)
                                .map((option, index) => (
                                  <div key={option.id || index} className="flex items-center p-2">
                                    <Input
                                      type="number"
                                      value={option.weight}
                                      onChange={(e) => {
                                        const options = editedData[attribute.id]?.statements?.[0]?.options ||
                                          statement.attribute_statement_options.map(opt => ({
                                            id: opt.id,
                                            text: opt.option_text,
                                            weight: opt.weight
                                          }));

                                        setEditedData(prev => ({
                                          ...prev,
                                          [attribute.id]: {
                                            ...prev[attribute.id],
                                            statements: [{
                                              ...(prev[attribute.id]?.statements?.[0] || statement),
                                              options: options.map((opt, i) =>
                                                i === index ? { ...opt, weight: parseInt(e.target.value) } : opt
                                              )
                                            }]
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
                                    checked={(editedData[attribute.id]?.attribute?.selectedIndustries ||
                                      attribute.attribute_industry_mapping?.map(m => m.industry_id) || [])
                                      .includes(industry.id)}
                                    onCheckedChange={(checked) => {
                                      const currentSelected = editedData[attribute.id]?.attribute?.selectedIndustries ||
                                        attribute.attribute_industry_mapping?.map(m => m.industry_id) || [];

                                      const newSelected = checked
                                        ? [...currentSelected, industry.id]
                                        : currentSelected.filter(id => id !== industry.id);

                                      setEditedData(prev => ({
                                        ...prev,
                                        [attribute.id]: {
                                          ...prev[attribute.id],
                                          attribute: {
                                            ...(prev[attribute.id]?.attribute || {
                                              ...attribute,
                                              selectedIndustries: attribute.attribute_industry_mapping?.map(m => m.industry_id) || []
                                            }),
                                            selectedIndustries: newSelected
                                          }
                                        }
                                      }));
                                    }}
                                  />
                                  <Label htmlFor={`industry-${attribute.id}-${industry.id}`} className="text-sm">
                                    {industry.name}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          ) : (
                            attribute.attribute_industry_mapping?.map((mapping, idx) => (
                              <div key={mapping.industry_id} className="text-sm">
                                {mapping.industries?.name}
                                {idx < attribute.attribute_industry_mapping.length - 1 ? ', ' : ''}
                              </div>
                            ))
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex justify-center space-x-2">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSaveEdit(attribute.id, statement.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCancelEdit(attribute.id, statement.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(attribute, statement)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setStatementToDelete(statement)}
                                >
                                  <Trash2 className="h-4 w-4" />
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
