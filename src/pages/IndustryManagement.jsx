import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function IndustryManagement() {
  const [industries, setIndustries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newIndustry, setNewIndustry] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [industryToDelete, setIndustryToDelete] = useState(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 18; // 3 rows × 6 columns in 2xl screens

  useEffect(() => {
    fetchIndustries();
  }, []);

  const fetchIndustries = async () => {
    try {
      const { data, error } = await supabase
        .from('industries')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setIndustries(data || []);
    } catch (error) {
      toast.error('Error fetching industries');
      console.error('Error:', error);
    }
  };

  const addIndustry = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Check if industry already exists
      const { data: existingIndustry } = await supabase
        .from('industries')
        .select('name')
        .ilike('name', newIndustry.name)
        .single();

      if (existingIndustry) {
        toast.error(`An industry named "${newIndustry.name}" already exists. Please use a different name.`);
        return;
      }

      const { error } = await supabase
        .from('industries')
        .insert([newIndustry]);

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error(`An industry named "${newIndustry.name}" already exists. Please use a different name.`);
        } else {
          toast.error('Failed to add industry type. Please try again.');
          console.error('Error:', error);
        }
        return;
      }
      
      toast.success('Industry type added successfully');
      setNewIndustry({ name: '', description: '' });
      fetchIndustries();
    } catch (error) {
      toast.error('Failed to add industry type. Please try again.');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteIndustry = async () => {
    if (!industryToDelete) return;
    
    try {
      // First check if the industry is used in any attributes
      const { data: attributeMappings, error: mappingError } = await supabase
        .from('attribute_industry_mapping')
        .select('attribute_id')
        .eq('industry_id', industryToDelete.id)
        .limit(1);

      if (mappingError) throw mappingError;

      if (attributeMappings && attributeMappings.length > 0) {
        toast.error('Cannot delete this industry as it is being used in one or more attributes');
        setIndustryToDelete(null);
        return;
      }

      // Check if any companies are using this industry
      const { data: companiesUsingIndustry, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .eq('industry_id', industryToDelete.id)
        .limit(1);

      if (companiesError) throw companiesError;

      if (companiesUsingIndustry && companiesUsingIndustry.length > 0) {
        toast.error('Cannot delete this industry as it is being used by one or more companies');
        setIndustryToDelete(null);
        return;
      }

      // If no attributes or companies are using this industry, proceed with deletion
      const { error } = await supabase
        .from('industries')
        .delete()
        .eq('id', industryToDelete.id);

      if (error) throw error;
      
      toast.success('Industry type deleted successfully');
      fetchIndustries();
    } catch (error) {
      toast.error('Error deleting industry type');
      console.error('Error:', error);
    } finally {
      setIndustryToDelete(null);
    }
  };

  const filteredIndustries = industries.filter(industry =>
    industry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    industry.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination calculation
  const totalPages = Math.ceil(filteredIndustries.length / itemsPerPage);
  const pageStart = (page - 1) * itemsPerPage;
  const pageEnd = pageStart + itemsPerPage;
  const currentItems = filteredIndustries.slice(pageStart, pageEnd);

  return (
    <div className="flex-1 w-full">
      <div className="space-y-8">
        <h1 className="text-3xl font-bold text-primary">Industry Type Management</h1>
        
        {/* Top section with Add and Search */}
        <div className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {/* Add Industry Form */}
            <Card className="p-4 lg:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Add New Industry Type</h2>
              <form onSubmit={addIndustry} className="space-y-4">
                <div>
                  <Label htmlFor="name">Industry Type Name</Label>
                  <Input
                    id="name"
                    value={newIndustry.name}
                    onChange={(e) => setNewIndustry({ ...newIndustry, name: e.target.value })}
                    placeholder="Enter industry type name"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newIndustry.description}
                    onChange={(e) => setNewIndustry({ ...newIndustry, description: e.target.value })}
                    placeholder="Enter industry type description"
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Adding...' : 'Add Industry Type'}
                </Button>
              </form>
            </Card>

            {/* Search Card */}
            <Card className="p-4 lg:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Search Industries</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="search">Search by name or description</Label>
                  <Input
                    id="search"
                    type="search"
                    placeholder="Start typing to search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mt-1"
                  />
                </div>
                {searchQuery && (
                  <p className="text-sm text-gray-500">
                    Found {filteredIndustries.length} {filteredIndustries.length === 1 ? 'industry' : 'industries'}
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Industries List Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Available Industry Types</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {currentItems.map((industry) => (
              <Card key={industry.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="font-semibold truncate">{industry.name}</h3>
                    {industry.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{industry.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIndustryToDelete(industry)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          
          {filteredIndustries.length === 0 && (
            <Card className="col-span-full p-4">
              <p className="text-center text-gray-500">No industries found</p>
            </Card>
          )}
          
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
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
        </div>
      </div>

      <AlertDialog open={!!industryToDelete} onOpenChange={() => setIndustryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the industry "{industryToDelete?.name}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteIndustry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
