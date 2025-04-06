import React, { useState, useMemo, useCallback } from 'react';
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function CreateAttributeBank({
  attributes = [],
  selectedItems = [], 
  onSelectedItemsChange,
  isViewMode = false,
  selectedStatements = new Set()
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter attributes based on search query and selected industry
  const filteredAttributes = useMemo(() => {
    return [...attributes];
  }, [attributes]);

  // Get counts
  const counts = useMemo(() => {
    const totalAttributes = filteredAttributes.length;
    const totalStatements = filteredAttributes.reduce((acc, attr) => 
      acc + (attr.attribute_statements?.length || 0), 0
    );
    return { totalAttributes, totalStatements };
  }, [filteredAttributes]);

  // Flatten all statements from filtered attributes
  const allStatements = useMemo(() => {
    return filteredAttributes.flatMap(attr => 
      (attr.attribute_statements || []).map(stmt => ({
        ...stmt,
        attribute: attr
      }))
    );
  }, [filteredAttributes]);

  // Paginate statements
  const paginatedStatements = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return allStatements.slice(start, end);
  }, [allStatements, currentPage]);

  const totalPages = Math.ceil(allStatements.length / ITEMS_PER_PAGE);

  // Check if a statement is selected
  const isStatementSelected = useCallback((statementId) => {
    return Array.isArray(selectedItems) && selectedItems.some(item => item.id === statementId) || 
           (selectedStatements instanceof Set && selectedStatements.has(statementId));
  }, [selectedItems, selectedStatements]);

  // Handle statement selection/deselection
  const handleStatementToggle = (statement, attribute) => {
    if (isViewMode) return;

    const isSelected = isStatementSelected(statement.id);
    let newSelectedItems = Array.isArray(selectedItems) ? selectedItems : [];

    if (isSelected) {
      newSelectedItems = newSelectedItems.filter(s => s.id !== statement.id);
      if (selectedStatements instanceof Set) {
        selectedStatements.delete(statement.id);
      }
    } else {
      const newStatement = {
        id: statement.id,
        statement: statement.statement,
        attribute_id: attribute.id,
        attribute: attribute.name,
        attribute_statement_options: statement.attribute_statement_options || []
      };
      newSelectedItems = [...newSelectedItems, newStatement];
      if (selectedStatements instanceof Set) {
        selectedStatements.add(statement.id);
      }
    }

    onSelectedItemsChange?.(newSelectedItems);
  };

  return (
    <div className="space-y-4">
      {!isViewMode && (
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{counts.totalAttributes}</span> attributes, 
            <span className="font-medium ml-1">{counts.totalStatements}</span> statements available
          </div>
        </div>
      )}

      <Table className="border">
        <TableHeader>
          <TableRow className="border-b">
            {!isViewMode && <TableHead className="w-[50px]"></TableHead>}
            <TableHead>Attribute</TableHead>
            <TableHead>Statement</TableHead>
            <TableHead>Options & Weights</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedStatements.length > 0 ? (
            paginatedStatements.map((stmt) => (
              <TableRow key={stmt.id} className="border-b">
                {!isViewMode && (
                  <TableCell className="border-r">
                    <Checkbox
                      checked={isStatementSelected(stmt.id)}
                      onCheckedChange={() => handleStatementToggle(stmt, stmt.attribute)}
                    />
                  </TableCell>
                )}
                <TableCell className="border-r">
                  <div>
                    <div className="font-medium">{stmt.attribute.name}</div>
                    {stmt.attribute.description && (
                      <div className="text-sm text-muted-foreground">{stmt.attribute.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="border-r">{stmt.statement}</TableCell>
                <TableCell>
                  <div className="space-y-2">
                    {stmt.attribute_statement_options?.length > 0 ? (
                      stmt.attribute_statement_options
                        .sort((a, b) => b.weight - a.weight)
                        .map((option) => (
                          <div key={option.id} className="flex justify-between items-center text-sm">
                            <span className="font-medium">{option.option_text}</span>
                            <span className="text-muted-foreground ml-2">{option.weight}</span>
                          </div>
                        ))
                    ) : (
                      <span className="text-muted-foreground">No options defined</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={isViewMode ? 3 : 4} className="text-center py-4">
                No statements found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {allStatements.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    onClick={() => setCurrentPage(i + 1)}
                    isActive={currentPage === i + 1}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
