import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Eye, EyeOff, Edit2, Trash2, Search, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { ChevronDown } from 'lucide-react';
import { ScrollArea } from '../components/ui/scroll-area';
import { cn } from '../lib/utils';

export default function UserManagement() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    companyId: null,
    department: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [currentUserCompanyId, setCurrentUserCompanyId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const itemsPerPage = 6; // 6 users per page as requested

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
    fetchCompanies();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('role, company_id')
        .eq('id', user.id)
        .single();
      
      if (userData) {
        setCurrentUserRole(userData.role);
        setCurrentUserCompanyId(userData.company_id);
      }
    }
  };

  const canEditUser = (user) => {
    if (!currentUserRole) return false;
    if (currentUserRole === 'super_admin') return true;
    if (currentUserRole === 'company_admin') {
      return user.company_id === currentUserCompanyId && 
             !['super_admin', 'company_admin'].includes(user.role);
    }
    return false;
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          companies (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  };

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
      toast.error('Failed to load companies');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      if (!formData.email || !formData.password || !formData.full_name || !formData.department || !formData.companyId) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters long');
        return;
      }

      // Create user with proper error handling
      const { data, error } = await supabase.rpc('create_user_with_auth', {
        p_email: formData.email.trim(),
        p_password: formData.password,
        p_full_name: formData.full_name.trim(),
        p_role: formData.role,
        p_company_id: formData.companyId,
        p_department: formData.department.trim()
      });

      if (error) {
        console.error('Error creating user:', error);
        if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
          // Extract the specific field from the error message
          const field = error.message.includes('phone') ? 'phone number' : 
                       error.message.includes('email') ? 'email' : 'identifier';
          toast.error(`A user with this ${field} already exists`);
        } else {
          toast.error('Failed to create user: ' + error.message);
        }
        return;
      }

      toast.success('User created successfully!');
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        companyId: null,
        department: ''
      });
      
      // Refresh user list
      await fetchUsers();
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const { data, error } = await supabase
        .rpc('delete_user', {
          user_id: userToDelete.id
        });

      if (error) {
        // Check for foreign key constraint violation
        if (error.message.includes('violates foreign key constraint')) {
          toast.error('Cannot delete this user as they are part of evaluations. Please remove their evaluations first.');
          return;
        }
        throw error;
      }
      
      if (data.success) {
        toast.success(data.message);
        fetchUsers(); // Refresh the list
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Unable to delete user. Please try again later.');
    } finally {
      setUserToDelete(null);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    
    try {
      if (!canEditUser(editingUser)) {
        throw new Error('You do not have permission to edit this user');
      }

      // Update public.users table
      const { error: userError } = await supabase
        .from('users')
        .update({
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          company_id: formData.companyId,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUser.id);

      if (userError) throw userError;

      toast.success('User updated successfully');
      fetchUsers(); // Refresh the list
      setIsEditDialogOpen(false);
      setEditingUser(null);
      // Reset form
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        companyId: null,
        department: ''
      });
    } catch (error) {
      toast.error('Error updating user: ' + error.message);
    }
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      companyId: user.company_id,
      department: user.department,
      password: ''
    });
    setIsEditDialogOpen(true);
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.full_name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    );
  });

  // Calculate user statistics
  const userStats = {
    total: filteredUsers.length,
    superAdmins: filteredUsers.filter(user => user.role === 'super_admin').length,
    companyAdmins: filteredUsers.filter(user => user.role === 'company_admin').length,
    users: filteredUsers.filter(user => user.role === 'user').length
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageUsers = filteredUsers.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Management</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create User Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reordered fields as per user instructions */}
                <div className="space-y-2">
                  <label className="text-right">Company</label>
                  <div className="col-span-3">
                    <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between"
                          type="button"
                        >
                          {formData.companyId 
                            ? companies.find(c => c.id === formData.companyId)?.name || "Select Company"
                            : "Select Company"}
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Select Company</DialogTitle>
                          <DialogDescription>
                            Search and select a company
                          </DialogDescription>
                        </DialogHeader>
                        <div className="p-2">
                          <Input
                            type="text"
                            placeholder="Search companies..."
                            value={companySearchQuery}
                            onChange={(e) => setCompanySearchQuery(e.target.value)}
                            className="mt-2"
                          />
                        </div>
                        <ScrollArea className="h-[300px] p-4">
                          <div className="space-y-2">
                            {companies
                              .filter(company => 
                                company.name.toLowerCase().includes(companySearchQuery.toLowerCase())
                              )
                              .map((company) => (
                                <div
                                  key={company.id}
                                  className={cn(
                                    "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                    formData.companyId === company.id && "bg-accent"
                                  )}
                                  onClick={() => {
                                    setFormData({ ...formData, companyId: company.id });
                                    setCompanyDialogOpen(false);
                                    setCompanySearchQuery('');
                                  }}
                                >
                                  {company.name}
                                </div>
                              ))}
                            {companies.filter(company => 
                              company.name.toLowerCase().includes(companySearchQuery.toLowerCase())
                            ).length === 0 && companySearchQuery && (
                              <div className="text-sm text-muted-foreground text-center py-6">
                                No companies found
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">User Name</label>
                  <Input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Department</label>
                  <Input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute inset-y-0 right-2 flex items-center px-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors hover:bg-primary/5 active:bg-primary/10 group"
                      style={{ background: 'none', border: 'none' }}
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      ) : (
                        <Eye className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select
                    value={formData.role}
                    onValueChange={value => setFormData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Creating User...' : 'Create User'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Search Box */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user{' '}
              <span className="font-medium">{userToDelete?.full_name}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep it unchanged.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="email" className="text-right">
                  Email
                </label>
                <Input
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="full_name" className="text-right">
                  Full Name
                </label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="role" className="text-right">
                  Role
                </label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="company_admin">Company Admin</SelectItem>
                    {currentUserRole === 'super_admin' && (
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="company" className="text-right">
                  Company
                </label>
                <div className="col-span-3">
                  <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-between"
                        type="button"
                      >
                        {formData.companyId 
                          ? companies.find(c => c.id === formData.companyId)?.name || "Select Company"
                          : "Select Company"}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Select Company</DialogTitle>
                        <DialogDescription>
                          Search and select a company
                        </DialogDescription>
                      </DialogHeader>
                      <div className="p-2">
                        <Input
                          type="text"
                          placeholder="Search companies..."
                          value={companySearchQuery}
                          onChange={(e) => setCompanySearchQuery(e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <ScrollArea className="h-[300px] p-4">
                        <div className="space-y-2">
                          {companies
                            .filter(company => 
                              company.name.toLowerCase().includes(companySearchQuery.toLowerCase())
                            )
                            .map((company) => (
                              <div
                                key={company.id}
                                className={cn(
                                  "flex cursor-pointer items-center rounded-sm px-2 py-2 hover:bg-accent",
                                  formData.companyId === company.id && "bg-accent"
                                )}
                                onClick={() => {
                                  setFormData({ ...formData, companyId: company.id });
                                  setCompanyDialogOpen(false);
                                  setCompanySearchQuery('');
                                }}
                              >
                                {company.name}
                              </div>
                            ))}
                          {companies.filter(company => 
                            company.name.toLowerCase().includes(companySearchQuery.toLowerCase())
                          ).length === 0 && companySearchQuery && (
                            <div className="text-sm text-muted-foreground text-center py-6">
                              No companies found
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="department" className="text-right">
                  Department
                </label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Update User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription className="flex gap-4 text-sm text-muted-foreground mt-1">
            <span>Total: {userStats.total}</span>
            <span>•</span>
            <span>Super Admins: {userStats.superAdmins}</span>
            <span>•</span>
            <span>Company Admins: {userStats.companyAdmins}</span>
            <span>•</span>
            <span>Users: {userStats.users}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {/* Table columns reordered to match onboarding form */}
                <TableHead>Company</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingUsers ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : currentPageUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                currentPageUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.companies?.name || 'No Company'}</TableCell>
                    <TableCell>{user.full_name}</TableCell>
                    <TableCell>{user.department || 'No Department'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'super_admin' 
                          ? 'bg-red-100 text-red-800'
                          : user.role === 'company_admin'
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {user.role === 'super_admin' 
                          ? 'Super Admin' 
                          : user.role === 'company_admin' 
                            ? 'Company Admin' 
                            : 'User'}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEditUser(user) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Edit user"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Delete user"
                          onClick={() => setUserToDelete(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                    />
                  </PaginationItem>
                  
                  {[...Array(totalPages)].map((_, index) => (
                    <PaginationItem key={index + 1}>
                      <PaginationLink
                        onClick={() => handlePageChange(index + 1)}
                        isActive={page === index + 1}
                      >
                        {index + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
