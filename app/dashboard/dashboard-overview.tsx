"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

interface Account {
  id: number;
  account_number: string;
  routing_number: string;
  account_type: "checking" | "savings";
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: number;
  amount: number;
  transaction_type: string;
  direction: "inbound" | "outbound";
  status: "approved" | "denied" | "pending";
  created_at: string;
  internal_account_id: number;
}

interface DashboardData {
  accounts: Account[];
  transactions: Transaction[];
  totalBalance: number;
}

interface DashboardOverviewProps {
  initialData: DashboardData | null;
  onNavigateToAccounts?: () => void;
}

export function DashboardOverview({
  initialData,
  onNavigateToAccounts,
}: DashboardOverviewProps) {
  const data = initialData;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getCensoredAccountId = (accountNumber: string) => {
    return `****${accountNumber.slice(-4)}`;
  };

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border p-6">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="rounded-lg border p-6">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Total Balance
          </h3>
          <p className="text-3xl font-bold text-success">
            {formatCurrency(data.totalBalance)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Active Accounts
          </h3>
          <p className="text-3xl font-bold text-accent">
            {data.accounts.filter((account) => account.is_active).length}
          </p>
        </div>
      </div>

      {/* Accounts Overview */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-card-foreground">
            Your Accounts
          </h2>
          {onNavigateToAccounts && (
            <Button variant="outline" size="sm" onClick={onNavigateToAccounts}>
              Manage Accounts
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
        {data.accounts.length === 0 ? (
          <p className="text-muted-foreground">No accounts found</p>
        ) : (
          <div className="space-y-4">
            {data.accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="whitespace-nowrap font-medium capitalize text-card-foreground">
                      {account.account_type} Account
                    </h3>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${
                        account.is_active
                          ? "bg-success/20 text-success"
                          : "bg-warning/20 text-warning"
                      }`}
                    >
                      {account.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ****{account.account_number.slice(-4)}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 text-right">
                  <p className="whitespace-nowrap text-lg font-semibold text-card-foreground">
                    {formatCurrency(account.balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold text-card-foreground">
          Recent Activity
        </h2>
        {data.transactions.length === 0 ? (
          <p className="text-muted-foreground">No recent transactions</p>
        ) : (
          <div className="space-y-3">
            {data.transactions.slice(0, 5).map((transaction) => {
              // Find the account for this transaction
              const account = data.accounts.find(
                (acc) => acc.id === transaction.internal_account_id,
              );
              const censoredAccountId = account
                ? getCensoredAccountId(account.account_number)
                : "****";

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Account: {censoredAccountId}
                      </span>
                    </div>
                    <div className="mb-1 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="whitespace-nowrap">
                        Transaction Type:{" "}
                        {transaction.transaction_type.replace("_", " ")}
                      </span>
                      <span className="whitespace-nowrap">
                        Status: {transaction.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(transaction.created_at)}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0 text-right">
                    <p
                      className={`whitespace-nowrap text-lg font-semibold ${
                        transaction.direction === "inbound"
                          ? "text-success"
                          : "text-warning"
                      }`}
                    >
                      {transaction.direction === "inbound" ? "+" : "-"}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
