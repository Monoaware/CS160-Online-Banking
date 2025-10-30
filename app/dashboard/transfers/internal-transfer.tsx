"use client";

import { useState, useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, ArrowRight, ArrowLeft } from "lucide-react";
import {
  InternalTransferSchema,
  InternalAccountResponse,
} from "@/lib/schemas/transfer";
import { formatCurrency } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";
import { CurrencyInputField } from "./currency-input";

type FormState =
  | "idle"
  | "filling"
  | "reviewing"
  | "submitting"
  | "success"
  | "error";

interface InternalTransferFormData {
  source_account_id: number;
  destination_account_id: number;
  amount: string;
}

export function InternalTransfer() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>("idle");
  const [accounts, setAccounts] = useState<InternalAccountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    transaction_id: number;
    amount: number;
    source_account: string;
    destination_account: string;
  } | null>(null);

  const form = useForm({
    defaultValues: {
      source_account_id: 0,
      destination_account_id: 0,
      amount: "",
    } as InternalTransferFormData,
    onSubmit: async ({ value }) => {
      setFormState("submitting");
      setError(null);

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Not authenticated");
        }

        const response = await fetch("/api/transfers/internal", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ...value,
            amount: value.amount, // Send as string - schema will transform to cents
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error: string };
          throw new Error(data.error || "Transfer failed");
        }

        const result = (await response.json()) as {
          success: boolean;
          message: string;
          transaction_id: number;
          amount: number;
        };

        const sourceAccount = accounts.find(
          (acc) => acc.id === value.source_account_id,
        );
        const destinationAccount = accounts.find(
          (acc) => acc.id === value.destination_account_id,
        );

        setSuccessData({
          transaction_id: result.transaction_id,
          amount: result.amount,
          source_account: sourceAccount?.account_number || "",
          destination_account: destinationAccount?.account_number || "",
        });

        setFormState("success");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transfer failed");
        setFormState("error");
      }
    },
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
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

      const response = await fetch("/api/accounts/internal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: { message: string } };
        throw new Error(data.error?.message || "Failed to fetch accounts");
      }

      const data = (await response.json()) as {
        accounts: InternalAccountResponse[];
      };
      setAccounts(data.accounts.filter((acc) => acc.is_active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    const result = InternalTransferSchema.safeParse(
      form.getFieldValue("source_account_id") &&
        form.getFieldValue("destination_account_id") &&
        form.getFieldValue("amount")
        ? {
            source_account_id: form.getFieldValue("source_account_id"),
            destination_account_id: form.getFieldValue(
              "destination_account_id",
            ),
            amount: form.getFieldValue("amount"),
          }
        : {},
    );

    if (result.success) {
      setFormState("reviewing");
    }
  };

  const handleBack = () => {
    setFormState("filling");
  };

  const handleReset = () => {
    form.reset();
    setFormState("idle");
    setError(null);
    setSuccessData(null);
  };

  const getAccountDisplay = (accountId: number) => {
    const account = accounts.find((acc) => acc.id === accountId);
    if (!account) return "Unknown Account";
    return `****${account.account_number.slice(-4)} (${account.account_type})`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Internal Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p>Loading accounts...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && formState === "idle") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Internal Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-md bg-destructive/20 border border-destructive/50 p-4 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
          <Button onClick={fetchAccounts} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Internal Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-md bg-warning/20 border border-warning/50 p-4 text-sm text-warning"
            role="alert"
          >
            You need at least 2 active accounts to make internal transfers.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (formState === "success" && successData) {
    return (
      <div className="space-y-6">
        <Breadcrumbs currentPage="Internal Transfer" />
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-success">
              Transfer Successful!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <CheckCircle className="mx-auto h-16 w-16 text-success" />
            <div className="space-y-2">
              <p className="text-lg font-semibold">
                {formatCurrency(successData.amount / 100)}
              </p>
              <p className="text-sm text-muted-foreground">
                From: ****{successData.source_account.slice(-4)}
              </p>
              <p className="text-sm text-muted-foreground">
                To: ****{successData.destination_account.slice(-4)}
              </p>
              <p className="text-xs text-muted-foreground">
                Transaction ID: {successData.transaction_id}
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push("/dashboard/transfers/history")}
                className="flex-1"
              >
                View Transfer History
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1"
              >
                Make Another Transfer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (formState === "reviewing") {
    const sourceAccount = accounts.find(
      (acc) => acc.id === form.getFieldValue("source_account_id"),
    );
    // const destinationAccount = accounts.find(
    //   (acc) => acc.id === form.getFieldValue("destination_account_id"),
    // );
    const amount = parseFloat(form.getFieldValue("amount")) || 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="font-medium">From Account:</span>
              <span>
                {getAccountDisplay(form.getFieldValue("source_account_id"))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">To Account:</span>
              <span>
                {getAccountDisplay(
                  form.getFieldValue("destination_account_id"),
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Amount:</span>
              <span className="text-lg font-semibold">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(amount)}
              </span>
            </div>
            {sourceAccount && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Available Balance:</span>
                <span>{formatCurrency(sourceAccount.balance)}</span>
              </div>
            )}
          </div>

          {error && (
            <div
              className="rounded-md bg-destructive/20 border border-destructive/50 p-4 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => form.handleSubmit()}
              disabled={false}
              className="flex-1"
            >
              Confirm Transfer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs currentPage="Internal Transfer" />
      <Card>
        <CardHeader>
          <CardTitle>Internal Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <form.Field
              name="source_account_id"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Source account is required";
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label
                    htmlFor="source_account_id"
                    className="text-sm font-medium"
                  >
                    From Account
                  </label>
                  <Select
                    value={
                      field.state.value && field.state.value > 0
                        ? field.state.value.toString()
                        : ""
                    }
                    onValueChange={(value) =>
                      field.handleChange(parseInt(value))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select source account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.id.toString()}
                        >
                          {`${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} ****${account.account_number.slice(-4)} - ${formatCurrency(account.balance)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-warning">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="destination_account_id"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Destination account is required";
                  if (value === form.getFieldValue("source_account_id")) {
                    return "Destination account must be different from source account";
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label
                    htmlFor="destination_account_id"
                    className="text-sm font-medium"
                  >
                    To Account
                  </label>
                  <Select
                    value={
                      field.state.value && field.state.value > 0
                        ? field.state.value.toString()
                        : ""
                    }
                    onValueChange={(value) =>
                      field.handleChange(parseInt(value))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select destination account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter(
                          (account) =>
                            account.id !==
                            form.getFieldValue("source_account_id"),
                        )
                        .map((account) => (
                          <SelectItem
                            key={account.id}
                            value={account.id.toString()}
                          >
                            {`${account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)} ****${account.account_number.slice(-4)} - ${formatCurrency(account.balance)}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-warning">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="amount"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.trim() === "")
                    return "Amount is required";

                  const numValue = parseFloat(value);
                  if (isNaN(numValue) || numValue <= 0)
                    return "Amount must be greater than $0.00";
                  if (numValue < 0.01) return "Amount must be at least $0.01";
                  if (numValue > 9999999.99)
                    return "Amount cannot exceed $9,999,999.99";

                  const sourceAccount = accounts.find(
                    (acc) => acc.id === form.getFieldValue("source_account_id"),
                  );
                  if (sourceAccount && numValue > sourceAccount.balance) {
                    return "Insufficient funds";
                  }

                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor="amount" className="text-sm font-medium">
                    Amount
                  </label>
                  <CurrencyInputField
                    id="amount"
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-warning">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Enter amount in dollars (e.g., 100.50 for $100.50)
                  </p>
                </div>
              )}
            </form.Field>

            {error && (
              <div
                className="rounded-md bg-destructive/20 border border-destructive/50 p-4 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}

            <form.Field name="source_account_id">
              {({ state: sourceState }) => (
                <form.Field name="destination_account_id">
                  {({ state: destState }) => (
                    <form.Field name="amount">
                      {({ state: amountState }) => {
                        const isDisabled =
                          !sourceState.value ||
                          !destState.value ||
                          !amountState.value ||
                          amountState.value.trim() === "" ||
                          parseFloat(amountState.value) <= 0 ||
                          sourceState.value === destState.value ||
                          amountState.meta.errors.length > 0;
                        return (
                          <Button
                            type="button"
                            onClick={handleContinue}
                            disabled={isDisabled}
                            className="w-full"
                          >
                            Continue
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        );
                      }}
                    </form.Field>
                  )}
                </form.Field>
              )}
            </form.Field>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
