"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTransactions, type ManagerTransaction } from "./actions";
import {
  exportTransactionsToCSV,
  exportTransactionsToPDF,
} from "./export-utils";

export function TransactionsTable() {
  const [transactions, setTransactions] = useState<ManagerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");

  const limit = 10;

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTransactions({
        search: search || undefined,
        type: typeFilter === "all" ? undefined : typeFilter || undefined,
        status: statusFilter === "all" ? undefined : statusFilter || undefined,
        direction:
          directionFilter === "all" ? undefined : directionFilter || undefined,
        page,
        limit,
      });
      setTransactions(result.transactions);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter, directionFilter, page, limit]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTypeFilter = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleDirectionFilter = (value: string) => {
    setDirectionFilter(value);
    setPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getStatusBadgeVariant = (status: "approved" | "denied") => {
    return status === "approved" ? "default" : "destructive";
  };

  const getTransactionTypeBadgeVariant = (
    type:
      | "internal_transfer"
      | "external_transfer"
      | "billpay"
      | "deposit"
      | "withdrawal",
  ) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      internal_transfer: "default",
      external_transfer: "secondary",
      billpay: "outline",
      deposit: "default",
      withdrawal: "secondary",
    };
    return variants[type] || "outline";
  };

  const getDirectionBadgeVariant = (direction: "inbound" | "outbound") => {
    return direction === "inbound" ? "default" : "secondary";
  };

  const handleExportCSV = () => {
    exportTransactionsToCSV(transactions);
  };

  const handleExportPDF = () => {
    exportTransactionsToPDF(transactions);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Transactions</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Search by user name or username..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={typeFilter} onValueChange={handleTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="internal_transfer">
                Internal Transfer
              </SelectItem>
              <SelectItem value="external_transfer">
                External Transfer
              </SelectItem>
              <SelectItem value="billpay">Bill Pay</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="withdrawal">Withdrawal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
          <Select value={directionFilter} onValueChange={handleDirectionFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      className="hover:bg-muted/30"
                    >
                      <TableCell className="font-medium">
                        {formatDate(transaction.created_at)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold">
                            {transaction.internal_account.user.first_name}{" "}
                            {transaction.internal_account.user.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            @{transaction.internal_account.user.username}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span
                          className={
                            transaction.direction === "inbound"
                              ? "text-success"
                              : "text-warning"
                          }
                        >
                          {transaction.direction === "inbound" ? "+" : "-"}
                          {formatCurrency(Number(transaction.amount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getTransactionTypeBadgeVariant(
                            transaction.transaction_type,
                          )}
                        >
                          {transaction.transaction_type
                            .replace("_", " ")
                            .toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(transaction.status)}
                        >
                          {transaction.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getDirectionBadgeVariant(
                            transaction.direction,
                          )}
                        >
                          {transaction.direction.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        ****
                        {transaction.internal_account.account_number.slice(-4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {transactions.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No transactions found</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * limit + 1} to{" "}
                  {Math.min(page * limit, total)} of {total} transactions
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
