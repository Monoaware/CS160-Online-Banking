"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getUserById,
  getUserTransactions,
  type DetailedUser,
  type ManagerTransaction,
} from "./actions";

interface UserDetailsModalProps {
  userId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserDetailsModal({
  userId,
  isOpen,
  onClose,
}: UserDetailsModalProps) {
  const [user, setUser] = useState<DetailedUser | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<
    ManagerTransaction[]
  >([]);
  const [loading, setLoading] = useState(false);

  const loadUserDetails = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const [userData, transactions] = await Promise.all([
        getUserById(userId),
        getUserTransactions(userId, 5),
      ]);
      setUser(userData);
      setRecentTransactions(transactions);
    } catch (error) {
      console.error("Failed to load user details:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDetails();
    }
  }, [isOpen, userId, loadUserDetails]);

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

  const getRoleBadgeVariant = (role: "customer" | "bank_manager") => {
    return role === "bank_manager" ? "default" : "secondary";
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

  const totalBalance =
    user?.internal_accounts.reduce(
      (sum, account) => sum + Number(account.balance),
      0,
    ) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* User Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Profile Information</span>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role.replace("_", " ").toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Name
                    </label>
                    <p className="text-lg">
                      {user.first_name} {user.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Username
                    </label>
                    <p className="text-lg">{user.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Email
                    </label>
                    <p className="text-lg">{user.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Phone
                    </label>
                    <p className="text-lg">{user.phone_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Address
                    </label>
                    <p className="text-lg">
                      {user.street_address}
                      {user.address_line_2 && (
                        <>
                          <br />
                          {user.address_line_2}
                        </>
                      )}
                      <br />
                      {user.city}, {user.state_or_territory} {user.postal_code}
                      <br />
                      {user.country}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Member Since
                    </label>
                    <p className="text-lg">{formatDate(user.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Account Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalBalance)}
                    </p>
                    <p className="text-sm text-gray-500">Total Balance</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {user.internal_accounts.length}
                    </p>
                    <p className="text-sm text-gray-500">Active Accounts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {user._count.internal_accounts}
                    </p>
                    <p className="text-sm text-gray-500">Total Transactions</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Accounts</h4>
                  {user.internal_accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          ****{account.account_number.slice(-4)}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">
                          {account.account_type.replace("_", " ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(Number(account.balance))}
                        </p>
                        <Badge
                          variant={account.is_active ? "default" : "secondary"}
                        >
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {recentTransactions.length > 0 ? (
                  <div className="space-y-2">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {formatCurrency(Number(transaction.amount))}
                          </p>
                          <p className="text-sm text-gray-500">
                            {transaction.transaction_type
                              .replace("_", " ")
                              .toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex gap-2 mb-1">
                            <Badge
                              variant={getStatusBadgeVariant(
                                transaction.status,
                              )}
                            >
                              {transaction.status.toUpperCase()}
                            </Badge>
                            <Badge
                              variant={getTransactionTypeBadgeVariant(
                                transaction.transaction_type,
                              )}
                            >
                              {transaction.direction.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No recent transactions
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">User not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
