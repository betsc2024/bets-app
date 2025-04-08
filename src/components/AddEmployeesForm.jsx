import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase";

export function AddEmployeesForm({ evaluation, onSave, onCancel }) {
  const [loading, setLoading] = useState(true);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      console.log('Evaluation data:', evaluation);
      const companyId = evaluation?.company_id || evaluation?.companies?.id;
      console.log('Using company ID:', companyId);
      
      if (evaluation && companyId) {
        setLoading(true);
        try {
          console.log('Fetching users for company:', companyId);
          // Get users from the same company as the evaluation
          const { data: userData, error } = await supabase
            .from('users')
            .select('id, email, full_name')
            .eq('company_id', companyId)
            .order('full_name');

          if (error) throw error;
          
          console.log('Fetched users:', userData);

          // Get all employees that are already in any evaluation with this name
          const existingEmployeeIds = evaluation.allAssignments
            ?.filter(a => a.evaluation_name === evaluation.evaluation_name)
            ?.map(a => a.user_to_evaluate_id) || [];

          console.log('Existing employee IDs:', existingEmployeeIds);

          // Also exclude any newly selected employees
          const excludeIds = [...existingEmployeeIds, ...selectedEmployees.map(e => e.id)];

          // Filter out users who are already in the evaluation or selected
          const availableEmps = userData.filter(user => !excludeIds.includes(user.id));
          
          console.log('Available employees after filtering:', availableEmps);
          setAvailableEmployees(availableEmps);
        } catch (err) {
          console.error('Error fetching users:', err);
          toast.error('Failed to load available users');
        } finally {
          setLoading(false);
        }
      } else {
        console.log('No evaluation or company ID available');
        if (!evaluation) console.log('No evaluation object');
        if (!companyId) console.log('No company ID found in:', { 
          directCompanyId: evaluation?.company_id,
          companiesObject: evaluation?.companies
        });
        setLoading(false);
        setAvailableEmployees([]);
      }
    };

    fetchUsers();
  }, [evaluation, selectedEmployees]);

  const handleAddEmployee = () => {
    if (!selectedEmployeeId) {
      toast.error('Please select an employee to add');
      return;
    }

    const newEmployee = availableEmployees.find(u => u.id === selectedEmployeeId);
    if (newEmployee) {
      setSelectedEmployees(prev => [...prev, newEmployee]);
      setSelectedEmployeeId('');
    }
  };

  const handleRemoveEmployee = (employeeId) => {
    setSelectedEmployees(prev => prev.filter(e => e.id !== employeeId));
  };

  const handleSave = () => {
    if (selectedEmployees.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    onSave({
      newEmployeeIds: selectedEmployees.map(e => e.id),
      currentAssignment: evaluation
    });
  };

  if (loading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h5 className="text-sm text-gray-500 mb-2">Selected Employees</h5>
        {selectedEmployees.length > 0 ? (
          <div className="space-y-2">
            {selectedEmployees.map((employee) => (
              <div key={employee.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                <div>
                  <span className="font-medium">{employee.full_name}</span>
                  <span className="text-sm text-gray-500 ml-2">{employee.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveEmployee(employee.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No new employees selected</p>
        )}
      </div>

      <div className="space-y-4">
        <h5 className="text-sm text-gray-500">Add Employee</h5>
        <div className="flex gap-2">
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto w-[min(calc(100vw-2rem),400px)]">
              <div className="max-h-[300px] overflow-y-auto">
                {availableEmployees.map((user) => (
                  <SelectItem key={user.id} value={user.id} className="py-2">
                    <div>
                      <div className="font-medium">{user.full_name}</div>
                      {user.email && (
                        <div className="text-xs text-gray-500">{user.email}</div>
                      )}
                    </div>
                  </SelectItem>
                ))}
                {availableEmployees.length === 0 && (
                  <div className="px-2 py-2 text-sm text-gray-500">
                    No more employees available
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
          <Button onClick={handleAddEmployee}>Add</Button>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Add Employees</Button>
      </div>
    </div>
  );
}
