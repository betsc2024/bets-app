import { supabase } from '../supabase';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AnalysisType(){
    const [loading, setLoading] = useState(false);
    const [analysisTypes, setAnalysisTypes] = useState(null);
    const [newTypeName, setNewTypeName] = useState('');
    
    const handleChange = (e) => {
      setNewTypeName(e.target.value);
    };
  
    // Fetch analysis types
    const fetchAnalysisTypes = async () => {
      try {
        const { data, error } = await supabase
          .from('analysis_types')
          .select('id, name')
          .order('name');

        if (error) throw error;

        setAnalysisTypes(data);
      } catch (error) {
        console.error('Error fetching analysis types:', error);
        toast.error('Failed to fetch analysis types');
      }
    };

    // Add new analysis type
    const handleAddType = async () => {
      if (!newTypeName.trim()) {
        toast.error('Please enter a type name');
        return;
      }

      try {
        setLoading(true);
        const { error } = await supabase
          .from('analysis_types')
          .insert({
            name: newTypeName.trim()
          });

        if (error) throw error;

        toast.success('Analysis type added successfully');
        setNewTypeName('');
        fetchAnalysisTypes();
      } catch (error) {
        console.error('Error adding analysis type:', error);
        toast.error('Failed to add analysis type');
      } finally {
        setLoading(false);
      }
    };

    // Delete analysis type
    const handleDeleteType = async (typeId) => {
      try {
        const { error } = await supabase
          .from('analysis_types')
          .delete()
          .eq('id', typeId);

        if (error) throw error;

        toast.success('Analysis type deleted successfully');
        fetchAnalysisTypes();
      } catch (error) {
        console.error('Error deleting analysis type:', error);
        toast.error('Failed to delete analysis type');
      }
    };

    useEffect(() => {
      fetchAnalysisTypes();
    }, []);

    return (
      <div>
        <h2 className="text-2xl font-bold mb-4">Analysis Type Management</h2>
        <Card className="p-4 lg:p-6 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">Add New Analysis Type</h2>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            handleAddType();
          }}>
            <div>
              <Label htmlFor="name">Analysis Name</Label>
              <Input
                id="name"
                value={newTypeName}
                onChange={handleChange}
                placeholder="Enter Analysis name"
                required
                className="mt-1"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full"
            >
              {loading ? 'Adding...' : 'Add Analysis'}
            </Button>
          </form>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Analysis Types</CardTitle>
            <CardDescription className="flex gap-4 text-sm text-muted-foreground mt-1">
              <span>Total types: {analysisTypes?.length || 0}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Analysis Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysisTypes?.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell>{type.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Delete analysis type"
                          onClick={() => handleDeleteType(type.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
}