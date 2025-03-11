import { supabase } from '../supabase';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Eye, EyeOff, Edit2, Trash2, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function AnalysisType(){
    const [loading,setLoading] = useState(false);
    const [deleted , setDeleting] = useState(false);
    const [analysisdata , setAnalysisData] = useState(null);
    const [newanalysis ,setNewAnalysis] = useState('');
    const [count,setCount] = useState(0);
    
    const handlechange = (e) => {
      setNewAnalysis(e.target.value);
    };
  
    const fetchAnalysis = async ()=>{
      try{
        const {data , error} = await supabase
          .from('analysis_type')
          .select('*');
          // console.log(data);
          setAnalysisData(data);
          setCount(data.length);

      }catch(err){
        console.error(err);
      }
    }
    const createanalysis = async ()=>{
      try{
          const respose = await supabase.from('analysis_type').insert(
            { 
              analysis_type : newanalysis
            }
          )
          toast.message("New Analysis Created:" + newanalysis);
          setLoading(false);
          setDeleting(false);
      }catch(err){
        console.log(err);
      }
    }
    const deleteanalysis = async (analysis) => {
      try{
          const response = await supabase.from('analysis_type').delete().eq('analysis_type', analysis);
          toast.message('analysis deleted');
          setDeleting(true);
      }catch(err){
          console.log(err);
      }
    }
    const updateanalysis = async () => {
      try{
        const response = await supabase.from('analysis_type').update();
      }catch(err){
        console.log(err);
      }
    }
    useEffect(()=>{
      fetchAnalysis();
    },[loading,deleted]);

    return <div >
        <h2 className="text-2xl font-bold mb-4">Analysis Type</h2>
        <Card className="p-4 lg:p-6 mb-4 ">
                      <h2 className="text-lg sm:text-xl font-semibold mb-4">Add New Analysis Type</h2>
                      <form  className="space-y-4">
                        <div>
                          <Label htmlFor="name">Analysis Name</Label>
                          <Input
                            id="name"
                            value={newanalysis}
                            onChange = {handlechange}
                            placeholder="Enter Analysis name"
                            required
                            className="mt-1"
                          />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full"  onClick = {()=>{
                            createanalysis();
                            setLoading(true);
                        }}>
                          {loading ? 'Adding...' : 'Add Analysis'}
                        </Button>
                      </form>
                    </Card>
                          <Card >
                            <CardHeader>
                              <CardTitle>Analysis</CardTitle>
                              <CardDescription className="flex gap-4 text-sm text-muted-foreground mt-1">
                                <span>Analysis count : {count}</span>
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
                                  {   
                                    analysisdata && analysisdata.map((user) => (
                                      <TableRow key={user.id}>
                                        <TableCell>{user.analysis_type}</TableCell>
                                         <TableCell className="text-right">
                                                              <div className="flex justify-end gap-2">
                                                                {
                                                                // (
                                                                //   <Button 
                                                                //     variant="ghost" 
                                                                //     size="icon" 
                                                                //     title="Edit user"
                                                                //     // onClick={() => openEditDialog(user)}
                                                                //   >
                                                                //     <Edit2 className="h-4 w-4" />
                                                                //   </Button>
                                                                // )
                                                                }
                                                                <Button 
                                                                  variant="ghost" 
                                                                  size="icon" 
                                                                  title="Delete user"
                                                                  onClick={()=>{ deleteanalysis(user.analysis_type)}   }
                                                                >
                                                                  <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                              </div>
                                                            </TableCell>
                                      </TableRow>
                                    )) 
                                  }
                                </TableBody>
                              </Table>
                    

                            </CardContent>
                          </Card>
    </div>
}