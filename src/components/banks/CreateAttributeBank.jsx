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
  selectedIndustryFilter = 'all',
  onIndustryFilterChange,
  attributeSearchQuery = '',
  onAttributeSearchQueryChange,
  isViewMode = false,
  industries = [],
  selectedStatements = new Set()
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter attributes based on search query and selected industry
  const filteredAttributes = useMemo(() => {
    let filtered = [...attributes];

    // Filter by search query
    if (attributeSearchQuery) {
      const query = attributeSearchQuery.toLowerCase();
      filtered = filtered.filter(attr => 
        attr.name.toLowerCase().includes(query) ||
        attr.description?.toLowerCase().includes(query)
      );
    }

    // Filter by industry
    if (selectedIndustryFilter !== 'all') {
      filtered = filtered.filter(attr => 
        attr.attribute_industry_mapping?.some(
          mapping => mapping.industry_id === selectedIndustryFilter
        )
      );
    }

    return filtered;
  }, [attributes, attributeSearchQuery, selectedIndustryFilter]);

  // Paginate attributes
  const paginatedAttributes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredAttributes.slice(start, end);
  }, [filteredAttributes, currentPage]);

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
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Label>Filter by Industry</Label>
            <Select value={selectedIndustryFilter} onValueChange={onIndustryFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map(industry => (
                    <SelectItem key={industry.id} value={industry.id}>
                      {industry.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>Search Attributes</Label>
            <Input
              placeholder="Search by name or description..."
              value={attributeSearchQuery}
              onChange={(e) => onAttributeSearchQueryChange(e.target.value)}
            />
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
          {paginatedAttributes.length > 0 ? (
            paginatedAttributes.map((attr) => (
              attr.attribute_statements?.map((stmt) => (
                <TableRow key={stmt.id} className="border-b">
                  {!isViewMode && (
                    <TableCell className="border-r">
                      <Checkbox
                        checked={isStatementSelected(stmt.id)}
                        onCheckedChange={() => handleStatementToggle(stmt, attr)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="border-r">
                    <div>
                      <div className="font-medium">{attr.name}</div>
                      {attr.description && (
                        <div className="text-sm text-muted-foreground">{attr.description}</div>
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

      {!isViewMode && filteredAttributes.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                />
              </PaginationItem>
              {Array.from({ length: Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE) }).map((_, i) => (
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
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage === Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
