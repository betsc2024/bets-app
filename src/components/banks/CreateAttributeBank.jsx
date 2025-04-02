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

const ITEMS_PER_PAGE = 10;

export default function CreateAttributeBank({
  attributes = [],
  selectedItems = [],
  onSelectedItemsChange,
  selectedIndustryFilter = 'all',
  onIndustryFilterChange,
  attributeSearchQuery = '',
  onAttributeSearchQueryChange,
}) {
  const [currentPage, setCurrentPage] = useState(1);

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
        attr.selectedIndustries?.includes(selectedIndustryFilter)
      );
    }

    return filtered;
  }, [attributes, attributeSearchQuery, selectedIndustryFilter]);

  // All statements from filtered attributes
  const allStatements = useMemo(() => {
    return filteredAttributes.reduce((acc, attr) => {
      return acc.concat(attr.attribute_statements || []);
    }, []);
  }, [filteredAttributes]);

  // Check if a statement is selected
  const isStatementSelected = useCallback((statementId) => {
    return selectedItems.some(item => item.id === statementId);
  }, [selectedItems]);

  // Handle statement selection/deselection
  const handleStatementToggle = (statement, attribute) => {
    const isSelected = selectedItems.some(s => s.id === statement.id);
    let newSelectedItems;

    if (isSelected) {
      newSelectedItems = selectedItems.filter(s => s.id !== statement.id);
    } else {
      const newStatement = {
        id: statement.id,
        statement: statement.statement,
        attribute: attribute.name,
        options: statement.attribute_statement_options || []
      };
      newSelectedItems = [...selectedItems, newStatement];
    }

    onSelectedItemsChange?.(newSelectedItems);
  };

  return (
    <div className="space-y-4">
      {/* Selected Statements Section */}
      <Card className="border-purple-200">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-purple-800">Selected Statements</CardTitle>
          <CardDescription>
            {selectedItems.length} statements selected
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedItems.length > 0 ? (
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-purple-50 rounded-md"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{item.statement}</span>
                    <span className="text-xs text-muted-foreground">{item.attribute}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStatementToggle({ id: item.id })}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No statements selected. Select statements from the list below.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Statements Section */}
      <div className="space-y-4">
        <div className="border-b border-purple-200 pb-4">
          <h3 className="text-lg font-medium text-purple-800">Available Attributes</h3>
          <p className="text-sm text-muted-foreground">Select attributes to include in your bank</p>
        </div>

        {/* Search and Filters */}
        <Card className="border-purple-200">
          <CardContent className="pt-6">
            <div className="border-b border-purple-200 pb-4 mb-4">
              <h4 className="text-sm font-medium text-purple-800">Search and Filters</h4>
              <p className="text-xs text-muted-foreground">
                {filteredAttributes.length} attributes • {allStatements.length} statements
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Industry Filter */}
              <div>
                <Label className="text-xs mb-1 text-purple-800">Filter by Industry</Label>
                <Select value={selectedIndustryFilter} onValueChange={onIndustryFilterChange}>
                  <SelectTrigger className="border-purple-200">
                    <SelectValue placeholder="All Industries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Input */}
              <div>
                <Label className="text-xs mb-1 text-purple-800">Search Statements</Label>
                <Input
                  placeholder="Search statements..."
                  value={attributeSearchQuery}
                  onChange={(e) => onAttributeSearchQueryChange?.(e.target.value)}
                  className="border-purple-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attributes Table */}
        <div className="border border-purple-200 rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-purple-50">
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="text-purple-800 font-bold">Attribute</TableHead>
                <TableHead className="text-purple-800 font-bold">Statement</TableHead>
                <TableHead className="text-purple-800 font-bold">Options & Weights</TableHead>
                <TableHead className="text-purple-800 font-bold">Industry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttributes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(attribute => (
                attribute.attribute_statements?.map(statement => (
                  <TableRow key={statement.id}>
                    <TableCell className="w-[40px]">
                      <Checkbox
                        checked={isStatementSelected(statement.id)}
                        onCheckedChange={() => handleStatementToggle(statement, attribute)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-purple-800">{attribute.name}</div>
                      {attribute.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {attribute.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{statement.statement}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {statement.attribute_statement_options?.map(option => (
                          <div key={option.id} className="flex justify-between text-sm">
                            <span>{option.option_text}</span>
                            <span className="text-muted-foreground">{option.weight}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {attribute.attribute_industry_mapping?.map(mapping => (
                        <Badge key={mapping.industry_id} variant="outline" className="mr-1">
                          {mapping.industries?.name}
                        </Badge>
                      ))}
                    </TableCell>
                  </TableRow>
                ))
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {Math.ceil(filteredAttributes.length / ITEMS_PER_PAGE) > 1 && (
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
    </div>
  );
}
