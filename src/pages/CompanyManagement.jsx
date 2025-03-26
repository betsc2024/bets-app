import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Trash2, Pencil, Search, Users } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui/pagination";

const SelectWithSearch = ({ value, onValueChange, options, placeholder }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Select
      open={isOpen}
      onOpenChange={setIsOpen}
      value={value}
      onValueChange={(newValue) => {
        onValueChange(newValue);
        setIsOpen(false);
        setSearchQuery('');
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {options.find(opt => opt.id === value)?.name || placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="flex items-center px-2 pb-2 sticky top-0 bg-popover border-b">
          <Search className="h-4 w-4 opacity-50 absolute left-3" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <SelectGroup className="max-h-[200px] overflow-y-auto">
          {filteredOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
          {filteredOptions.length === 0 && (
            <div className="text-sm text-muted-foreground py-2 px-2">
              No results found
            </div>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCompany, setNewCompany] = useState({ name: '', industry_id: '', settings: {} });
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [selectedCompanyUsers, setSelectedCompanyUsers] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 12; // 3 rows × 4 columns for xl screens

  useEffect(() => {
    fetchCompanies();
    fetchIndustries();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          industry:industries(name)
        `)
        .order('name');
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      toast.error('Error fetching companies');
      console.error('Error:', error);
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
      toast.error('Error fetching industries');
      console.error('Error:', error);
    }
  };

  const addCompany = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Validate industry selection
      if (!newCompany.industry_id) {
        toast.error('Please select an industry for the company');
        setLoading(false);
        return;
      }

      // Check if company already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('name')
        .ilike('name', newCompany.name)
        .single();

      if (existingCompany) {
        toast.error(`A company named "${newCompany.name}" already exists`);
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('companies')
        .insert([newCompany]);

      if (error) throw error;
      
      toast.success('Company added successfully');
      setNewCompany({ name: '', industry_id: '', settings: {} });
      fetchCompanies();
    } catch (error) {
      toast.error('Error adding company');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCompany = async () => {
    if (!editingCompany) return;
    
    try {
      console.log(editingCompany);
      const { error } = await supabase
        .from('companies')
        .update({
          name: editingCompany.name,
          industry_id: editingCompany.industry_id,
          ideal_score : editingCompany.ideal_score,
          settings: editingCompany.settings
        })
        .eq('id', editingCompany.id);

      if (error) throw error;
      
      toast.success('Company updated successfully');
      setEditingCompany(null);
      fetchCompanies();
    } catch (error) {
      toast.error('Error updating company');
      console.error('Error:', error);
    }
  };

  const deleteCompany = async () => {
    if (!companyToDelete) return;
    
    try {
      // First check if the company has any users
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', companyToDelete.id)
        .limit(1);

      if (userError) throw userError;

      if (users && users.length > 0) {
        toast.error('Cannot delete this company as it has associated users');
        setCompanyToDelete(null);
        return;
      }

      // If no users are associated, proceed with deletion
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyToDelete.id);

      if (error) throw error;
      
      toast.success('Company deleted successfully');
      fetchCompanies();
    } catch (error) {
      toast.error('Error deleting company');
      console.error('Error:', error);
    } finally {
      setCompanyToDelete(null);
    }
  };

  const fetchCompanyUsers = async (companyId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          created_at
        `)
        .eq('company_id', companyId)
        .order('full_name');

      if (error) throw error;
      setCompanyUsers(data || []);
    } catch (error) {
      toast.error('Error fetching company users');
      console.error('Error:', error);
    }
  };

  const handleViewUsers = async (company) => {
    setSelectedCompanyUsers(company);
    await fetchCompanyUsers(company.id);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRole = (role) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.industry?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIndustries = industries.filter(industry =>
    industry.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination calculation
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
  const pageStart = (page - 1) * itemsPerPage;
  const pageEnd = pageStart + itemsPerPage;
  const currentItems = filteredCompanies.slice(pageStart, pageEnd);

  return (
    <div className="flex-1 w-full space-y-8 p-8">
      <h1 className="text-3xl font-bold text-primary">Company Management</h1>
      
      {/* Top section with Add and Search */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Company Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Company</h2>
          <form onSubmit={addCompany} className="space-y-4">
            <div>
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                placeholder="Enter company name"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <div className="mt-1">
                <SelectWithSearch
                id="industry"
                  value={newCompany.industry_id}
                  onValueChange={(value) => setNewCompany({ ...newCompany, industry_id: value })}
                  options={industries}
                  placeholder="Select an industry"
                  required

                />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Adding...' : 'Add Company'}
            </Button>
          </form>
        </Card>

        {/* Search Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Search Companies</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="search">Search by name or industry</Label>
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
                Found {filteredCompanies.length} {filteredCompanies.length === 1 ? 'company' : 'companies'}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Companies List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Companies</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {currentItems.map((company) => (
            <Card key={company.id} className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="font-semibold truncate">{company.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {company.industry?.name || 'No industry specified'}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewUsers(company)}
                      className="h-8 w-8 hover:bg-secondary"
                      title="View Users"
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingCompany(company)}
                      className="h-8 w-8 hover:bg-secondary"
                      title="Edit Company"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCompanyToDelete(company)}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete Company"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {filteredCompanies.length === 0 && (
            <Card className="col-span-full p-4">
              <p className="text-center text-gray-500">No companies found</p>
            </Card>
          )}
        </div>

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

      {/* Edit Company Dialog */}
      {editingCompany && (
        <AlertDialog open={!!editingCompany} onOpenChange={() => setEditingCompany(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Company</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-name">Company Name</Label>
                <Input
                  id="edit-name"
                  value={editingCompany.name}
                  onChange={(e) => 
                  {
                    console.log("Edit")
                    setEditingCompany({ ...editingCompany, name: e.target.value })}

                  }
                  placeholder="Enter company name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-industry">Industry</Label>
                <div className="mt-1">
                  <SelectWithSearch
                  id= "edit-industry"
                    value={editingCompany.industry_id}
                    onValueChange={(value) => setEditingCompany({ ...editingCompany, industry_id: value})}
                    options={industries}
                    placeholder="Select an industry"
                  />
                </div>
              </div>
              <div>
              <Label htmlFor="edit-ideal_score">Ideal score</Label>
              <div className="mt-1">
              <Input
              id = "edit-ideal_score"
              value = {editingCompany.ideal_score}
              onChange={(e) => {
                console.log(editingCompany);
                setEditingCompany({ ...editingCompany, ideal_score: Number(e.target.value) }) 
              }}
            placeholder="Enter a Ideal Score"
            />
              </div>
            </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={updateCompany}>Save Changes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Confirmation Dialog */}
      {companyToDelete && (
        <AlertDialog open={!!companyToDelete} onOpenChange={() => setCompanyToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Company</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {companyToDelete.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteCompany}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Company Users Dialog */}
      {selectedCompanyUsers && (
        <Dialog open={!!selectedCompanyUsers} onOpenChange={() => setSelectedCompanyUsers(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Users - {selectedCompanyUsers.name}</DialogTitle>
              <DialogDescription>
                Manage users associated with this company
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No users found for this company
                      </TableCell>
                    </TableRow>
                  ) : (
                    companyUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.full_name || 'N/A'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{formatRole(user.role)}</TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
