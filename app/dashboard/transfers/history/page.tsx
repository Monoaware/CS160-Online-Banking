"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ArrowRight, Filter, Search } from "lucide-react";
import { TransferHistoryItem } from "@/lib/schemas/transfer";
import { Breadcrumbs } from "../breadcrumbs";

interface TransferHistoryResponse {
  transfers: TransferHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export default function TransferHistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<TransferHistoryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [filters, setFilters] = useState({
    type: "all",
    start_date: "",
    end_date: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.type && filters.type !== "all") {
        params.append("type", filters.type);
      }
      if (filters.start_date) {
        params.append("start_date", filters.start_date);
      }
      if (filters.end_date) {
        params.append("end_date", filters.end_date);
      }

      const response = await fetch(
        `/api/transfers/history?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error: { message: string } };
        throw new Error(
          data.error?.message || "Failed to fetch transfer history",
        );
      }

      const data = (await response.json()) as TransferHistoryResponse;
      setTransfers(data.transfers);
      setPagination(data.pagination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load transfer history",
      );
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    if (!loading) {
      fetchTransfers();
    }
  }, [pagination.page, pagination.limit, filters, loading, fetchTransfers]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransferTypeDisplay = (type: string) => {
    switch (type) {
      case "internal_transfer":
        return "Internal Transfer";
      case "external_transfer":
        return "External Transfer";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge
            variant="default"
            className="bg-success/20 text-success border-success/50"
          >
            Approved
          </Badge>
        );
      case "denied":
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAccountDisplay = (transfer: TransferHistoryItem) => {
    if (transfer.transaction_type === "internal_transfer") {
      return transfer.direction === "outbound"
        ? `To: ****${transfer.destination_account_number?.slice(-4) || ""}`
        : `From: ****${transfer.source_account_number?.slice(-4) || ""}`;
    } else {
      return transfer.direction === "outbound"
        ? `To: ****${transfer.external_account_number?.slice(-4) || ""}`
        : `From: ****${transfer.external_account_number?.slice(-4) || ""}`;
    }
  };

  if (loading && transfers.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-8">
          <p>Loading transfer history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Breadcrumbs currentPage="Transfer History" />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transfer History</h1>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/transfers")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Transfers
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="type" className="mb-2 block text-sm font-medium">
                Transfer Type
              </label>
              <Select
                value={filters.type}
                onValueChange={(value) => handleFilterChange("type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="internal_transfer">
                    Internal Transfer
                  </SelectItem>
                  <SelectItem value="external_transfer">
                    External Transfer
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="start_date"
                className="mb-2 block text-sm font-medium"
              >
                Start Date
              </label>
              <Input
                id="start_date"
                type="date"
                value={filters.start_date}
                onChange={(e) =>
                  handleFilterChange("start_date", e.target.value)
                }
              />
            </div>

            <div>
              <label
                htmlFor="end_date"
                className="mb-2 block text-sm font-medium"
              >
                End Date
              </label>
              <Input
                id="end_date"
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange("end_date", e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={fetchTransfers} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div
          className="mb-6 rounded-md bg-destructive/20 border border-destructive/50 p-4 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
        </CardHeader>
        <CardContent>
          {transfers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No transfers found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell className="font-medium">
                          {formatDate(transfer.created_at)}
                        </TableCell>
                        <TableCell>
                          {getTransferTypeDisplay(transfer.transaction_type)}
                        </TableCell>
                        <TableCell>{getAccountDisplay(transfer)}</TableCell>
                        <TableCell
                          className={
                            transfer.direction === "outbound"
                              ? "text-warning"
                              : "text-success"
                          }
                        >
                          {transfer.direction === "outbound" ? "-" : "+"}
                          {formatCurrency(Math.abs(transfer.amount))}
                        </TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination.total_pages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total,
                    )}{" "}
                    of {pagination.total} results
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {pagination.page} of {pagination.total_pages}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.total_pages}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
