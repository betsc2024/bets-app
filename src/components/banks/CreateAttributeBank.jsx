import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ITEMS_PER_PAGE = 10;

export function CreateAttributeBank({
  attributes = [],
  selectedStatements = [],
  onStatementSelect,
  industries = [],
  selectedIndustry,
  onIndustryChange,
  includeCustomStatements = false,
  onCustomStatementsChange,
  loading = false,
  analysisType,
}) {
  // Local state for filters and pagination
  const [attributeSearchQuery, setAttributeSearchQuery] = useState("");
  const [industrySearchQuery, setIndustrySearchQuery] = useState("");
  const [statementSearchQuery, setStatementSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedAttribute, setExpandedAttribute] = useState(null);
  const [attributeFilter, setAttributeFilter] = useState("all");
  const [statementFilter, setStatementFilter] = useState("all");

  // Memoized filtered attributes based on search and industry
  const filteredAttributes = useMemo(() => {
    let filtered = attributes;

    // Apply search filter
    if (attributeSearchQuery) {
      filtered = filtered.filter(attr =>
        attr.name.toLowerCase().includes(attributeSearchQuery.toLowerCase()) ||
        attr.analysis_type.toLowerCase().includes(attributeSearchQuery.toLowerCase())
      );
    }

    // Apply industry filter
    if (selectedIndustry && selectedIndustry !== 'all') {
      filtered = filtered.filter(attr =>
        attr.attribute_industry_mapping?.some(mapping => 
          mapping.industry_id === selectedIndustry
        )
      );
    }

    // Apply attribute filter
    if (attributeFilter !== "all") {
      filtered = filtered.filter(attr => attr.id === attributeFilter);
    }

    return filtered;
  }, [attributes, attributeSearchQuery, selectedIndustry, attributeFilter]);

  // Memoized filtered industries for search
  const filteredIndustries = useMemo(() => {
    if (!industrySearchQuery) return industries;
    return industries.filter(industry =>
      industry.name.toLowerCase().includes(industrySearchQuery.toLowerCase())
    );
  }, [industries, industrySearchQuery]);

  // Memoized filtered statements for search
  const filteredStatements = useMemo(() => {
    if (!statementSearchQuery) return attributes;
    return attributes.filter(attr =>
      attr.attribute_statements.some(stmt =>
        stmt.statement.toLowerCase().includes(statementSearchQuery.toLowerCase())
      )
    );
  }, [attributes, statementSearchQuery]);

  // Memoized all statements
  const allStatements = useMemo(() => {
    return attributes.flatMap(attr => attr.attribute_statements);
  }, [attributes]);

  // Get all unique statements for the filter dropdown
  const uniqueStatements = useMemo(() => {
    const statements = attributes.flatMap(attr => 
      attr.attribute_statements.map(stmt => ({
        id: stmt.id,
        statement: stmt.statement
      }))
    );
    return [...new Map(statements.map(item => [item.id, item])).values()];
  }, [attributes]);

  // Filter attributes based on selected filters
  const filteredAttributesWithFilters = useMemo(() => {
    return filteredAttributes.filter(attribute => {
      if (selectedIndustry !== "all") {
        const industryMatch = attribute.attribute_industry_mapping?.some(
          mapping => mapping.industries?.id === selectedIndustry
        );
        if (!industryMatch) return false;
      }

      if (attributeFilter !== "all" && attribute.id !== attributeFilter) {
        return false;
      }

      if (statementFilter !== "all") {
        const statementMatch = attribute.attribute_statements.some(
          stmt => stmt.id === statementFilter
        );
        if (!statementMatch) return false;
      }

      return true;
    });
  }, [filteredAttributes, selectedIndustry, attributeFilter, statementFilter]);

  // Calculate pagination
  const totalPages = Math.ceil(
    filteredAttributesWithFilters.reduce(
      (acc, attr) => acc + attr.attribute_statements.length, 
      0
    ) / ITEMS_PER_PAGE
  );

  // Get paginated items
  const paginatedItems = useMemo(() => {
    let items = [];
    let count = 0;
    
    for (const attribute of filteredAttributesWithFilters) {
      for (const statement of attribute.attribute_statements) {
        if (count >= (currentPage - 1) * ITEMS_PER_PAGE && count < currentPage * ITEMS_PER_PAGE) {
          items.push({ attribute, statement });
        }
        count++;
      }
    }
    
    return items;
  }, [filteredAttributesWithFilters, currentPage]);

  // Pagination calculations
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAttributes = filteredAttributes.slice(startIndex, endIndex);

  // Check if a statement is selected
  const isStatementSelected = (statementId) => {
    return selectedStatements.some(s => s.statementId === statementId);
  };

  return (
    <div className="space-y-6">
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
              <p className="text-xs text-muted-foreground">{filteredAttributes.length} attributes • {allStatements.length} statements</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs mb-1 text-purple-800">Filter by Industry</Label>
                <Select value={selectedIndustry} onValueChange={onIndustryChange}>
                  <SelectTrigger className="border-purple-200">
                    <SelectValue placeholder="All Industries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map((industry) => (
                      <SelectItem key={industry.id} value={industry.id}>
                        {industry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1 text-purple-800">Filter by Attribute</Label>
                <Select 
                  value={attributeFilter} 
                  onValueChange={setAttributeFilter}
                >
                  <SelectTrigger className="border-purple-200">
                    <SelectValue placeholder="All Attributes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Attributes</SelectItem>
                    {attributes.map((attr) => (
                      <SelectItem key={attr.id} value={attr.id}>
                        {attr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs mb-1 text-purple-800">Filter by Statement</Label>
                <Select 
                  value={statementFilter} 
                  onValueChange={setStatementFilter}
                >
                  <SelectTrigger className="border-purple-200">
                    <SelectValue placeholder="All Statements" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statements</SelectItem>
                    {uniqueStatements.map((stmt) => (
                      <SelectItem key={stmt.id} value={stmt.id}>
                        {stmt.statement}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attributes Table */}
        <div className="border border-purple-200 rounded-md overflow-hidden">
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow>
                <TableHead className="w-[40px] border-r border-b border-purple-200 font-bold"></TableHead>
                <TableHead className="text-purple-800 border-r border-b border-purple-200 font-bold">Attribute</TableHead>
                <TableHead className="text-purple-800 border-r border-b border-purple-200 font-bold">Statement</TableHead>
                <TableHead className="text-purple-800 border-r border-b border-purple-200 font-bold">Options & Weights</TableHead>
                <TableHead className="text-purple-800 border-r border-b border-purple-200 font-bold">Industry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-800" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredAttributes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No attributes found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map(({ attribute, statement }) => (
                  <TableRow key={statement.id}>
                    <TableCell className="p-4 align-middle [&:has([role=checkbox])]:pr-0 border-r border-b border-purple-200">
                      <div className="flex items-center justify-center pr-4">
                        <Checkbox
                          checked={isStatementSelected(statement.id)}
                          onCheckedChange={() => onStatementSelect(statement.id, attribute.id)}
                          className="border-purple-200"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-b border-purple-200">
                      <div className="p-2">
                        <div className="font-bold text-purple-800">{attribute.name}</div>
                        {attribute.description && (
                          <div className="text-sm text-muted-foreground mt-1.5">
                            {attribute.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm border-r border-b border-purple-200">
                      <div className="p-2">
                        {statement.statement}
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-b border-purple-200">
                      <div className="space-y-0">
                        <div className="grid grid-cols-[1fr,50px] border-b border-purple-100 last:border-b-0">
                          <div className="text-sm text-purple-800 px-2 py-1.5 border-r border-purple-100">Excellent</div>
                          <div className="text-sm text-muted-foreground text-right px-2 py-1.5">100</div>
                        </div>
                        <div className="grid grid-cols-[1fr,50px] border-b border-purple-100 last:border-b-0">
                          <div className="text-sm text-purple-800 px-2 py-1.5 border-r border-purple-100">Very Good</div>
                          <div className="text-sm text-muted-foreground text-right px-2 py-1.5">80</div>
                        </div>
                        <div className="grid grid-cols-[1fr,50px] border-b border-purple-100 last:border-b-0">
                          <div className="text-sm text-purple-800 px-2 py-1.5 border-r border-purple-100">Good</div>
                          <div className="text-sm text-muted-foreground text-right px-2 py-1.5">60</div>
                        </div>
                        <div className="grid grid-cols-[1fr,50px] border-b border-purple-100 last:border-b-0">
                          <div className="text-sm text-purple-800 px-2 py-1.5 border-r border-purple-100">Fair & Satisfactory</div>
                          <div className="text-sm text-muted-foreground text-right px-2 py-1.5">40</div>
                        </div>
                        <div className="grid grid-cols-[1fr,50px] last:border-b-0">
                          <div className="text-sm text-purple-800 px-2 py-1.5 border-r border-purple-100">Needs Improvement</div>
                          <div className="text-sm text-muted-foreground text-right px-2 py-1.5">20</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="border-r border-b border-purple-200">
                      <div className="p-2 text-sm">
                        {attribute.attribute_industry_mapping
                          ?.map(mapping => mapping.industries?.name)
                          .filter(Boolean)
                          .join(", ") || "Component Manufacturer"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                    >
                      {pageNumber}
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
    </div>
  );
}
