"use client";

import { useState, useEffect } from "react";
import { useForm } from "@tanstack/react-form";
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
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Search,
  Mail,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ExternalTransferSchema,
  InternalAccountResponse,
} from "@/lib/schemas/transfer";
import { formatCurrency } from "@/lib/utils";
import { CurrencyInputField } from "./currency-input";

type FormState =
  | "idle"
  | "filling"
  | "reviewing"
  | "submitting"
  | "success"
  | "error";

interface ExternalTransferFormData {
  source_account_id: number;
  recipient_email: string;
  recipient_phone: string;
  destination_account_id?: number;
  amount: string;
}

interface LookupResult {
  found: boolean;
  user?: {
    id: number;
    email: string;
    phone_number: string;
    first_name: string;
    last_name: string;
    accounts: Array<{
      id: number;
      account_type: string;
    }>;
  };
}

export function ExternalTransfer() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>("idle");
  const [accounts, setAccounts] = useState<InternalAccountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    transaction_id: number;
    amount: number;
    recipient_name: string;
  } | null>(null);

  const form = useForm({
    defaultValues: {
      source_account_id: 0,
      recipient_email: "",
      recipient_phone: "",
      destination_account_id: undefined as number | undefined,
      amount: "",
    } as ExternalTransferFormData,
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

        const response = await fetch("/api/transfers/external", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            source_account_id: value.source_account_id,
            amount: value.amount, // Send as string - schema will transform to cents
            ...(value.recipient_email
              ? { recipient_email: value.recipient_email.trim() }
              : {}),
            ...(value.recipient_phone
              ? { recipient_phone: value.recipient_phone.trim() }
              : {}),
            ...(value.destination_account_id
              ? { destination_account_id: value.destination_account_id }
              : {}),
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
          recipient_name: string;
        };

        setSuccessData({
          transaction_id: result.transaction_id,
          amount: result.amount,
          recipient_name: result.recipient_name,
        });

        setFormState("success");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transfer failed");
        setFormState("error");
      }
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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

      // Fetch internal accounts
      const accountsResponse = await fetch("/api/accounts/internal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!accountsResponse.ok) {
        const data = (await accountsResponse.json()) as {
          error: { message: string };
        };
        throw new Error(data.error?.message || "Failed to fetch accounts");
      }

      const accountsData = (await accountsResponse.json()) as {
        accounts: InternalAccountResponse[];
      };
      setAccounts(accountsData.accounts.filter((acc) => acc.is_active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async () => {
    const email = form.getFieldValue("recipient_email");
    const phone = form.getFieldValue("recipient_phone");

    if (!email && !phone) {
      setLookupError("Please enter either email or phone number");
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      const params = new URLSearchParams();
      if (email) params.append("email", email.trim());
      if (phone) params.append("phone", phone.trim());

      const response = await fetch(
        `/api/transfers/lookup?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const data = (await response.json()) as { error: string };
        throw new Error(data.error || "Lookup failed");
      }

      const result = (await response.json()) as LookupResult;
      setLookupResult(result);

      if (result.found && result.user) {
        // Auto-select first account if only one
        if (result.user.accounts.length === 1) {
          form.setFieldValue(
            "destination_account_id",
            result.user.accounts[0].id,
          );
        }
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
      setLookupResult({ found: false });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleContinue = () => {
    const recipientEmail = form.getFieldValue("recipient_email");
    const recipientPhone = form.getFieldValue("recipient_phone");
    const destinationAccountId = form.getFieldValue("destination_account_id");

    const formData = {
      source_account_id: form.getFieldValue("source_account_id"),
      amount: form.getFieldValue("amount"),
      ...(recipientEmail ? { recipient_email: recipientEmail } : {}),
      ...(recipientPhone ? { recipient_phone: recipientPhone } : {}),
      ...(destinationAccountId
        ? { destination_account_id: destinationAccountId }
        : {}),
    };

    const result = ExternalTransferSchema.safeParse(formData);

    if (result.success) {
      setFormState("reviewing");
    } else {
      setError(result.error.issues.map((i) => i.message).join(", "));
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
    setLookupResult(null);
    setLookupError(null);
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
          <CardTitle>External Transfer</CardTitle>
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
          <CardTitle>External Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-md bg-destructive/20 border border-destructive/50 p-4 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
          <Button onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (formState === "success" && successData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Successful</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-4">
            <CheckCircle className="h-16 w-16 text-success" />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-lg font-semibold">
              {formatCurrency(successData.amount / 100)} sent to{" "}
              {successData.recipient_name}
            </p>
            <p className="text-sm text-muted-foreground">
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
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Make Another Transfer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (formState === "reviewing") {
    const sourceAccount = accounts.find(
      (acc) => acc.id === form.getFieldValue("source_account_id"),
    );
    const amount = parseFloat(form.getFieldValue("amount") || "0");
    const recipientName = lookupResult?.user
      ? `${lookupResult.user.first_name} ${lookupResult.user.last_name}`
      : "Unknown";

    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex justify-between">
              <span className="font-medium">From Account:</span>
              <span>
                {getAccountDisplay(form.getFieldValue("source_account_id"))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">To:</span>
              <span>{recipientName}</span>
            </div>
            {lookupResult?.user && (
              <div className="flex justify-between">
                <span className="font-medium">Account:</span>
                <span>
                  {(() => {
                    const accountId = form.getFieldValue(
                      "destination_account_id",
                    );
                    const account = lookupResult.user?.accounts.find(
                      (a) => a.id === accountId,
                    );
                    return account
                      ? `${account.account_type} account`
                      : "Unknown account";
                  })()}
                </span>
              </div>
            )}
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
              disabled={formState !== "reviewing"}
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
    <Card>
      <CardHeader>
        <CardTitle>External Transfer</CardTitle>
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
                if (!value || value === 0) return "Source account is required";
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
                  onValueChange={(value) => field.handleChange(parseInt(value))}
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
                        <div className="flex items-center justify-between w-full">
                          <span>****{account.account_number.slice(-4)}</span>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge variant="secondary" className="text-xs">
                              {account.account_type}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(account.balance)}
                            </span>
                          </div>
                        </div>
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

          <div className="space-y-4">
            <div className="text-sm font-medium">Recipient</div>
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <form.Field name="recipient_email">
                {(field) => (
                  <div className="space-y-2">
                    <label
                      htmlFor="recipient_email"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Email Address
                    </label>
                    <Input
                      id="recipient_email"
                      type="email"
                      value={field.state.value || ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="recipient@example.com"
                      disabled={lookupLoading}
                    />
                  </div>
                )}
              </form.Field>

              <div className="text-center text-sm text-muted-foreground">
                or
              </div>

              <form.Field name="recipient_phone">
                {(field) => (
                  <div className="space-y-2">
                    <label
                      htmlFor="recipient_phone"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </label>
                    <Input
                      id="recipient_phone"
                      type="tel"
                      value={field.state.value || ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="+1234567890"
                      disabled={lookupLoading}
                    />
                  </div>
                )}
              </form.Field>

              <Button
                type="button"
                onClick={handleLookup}
                disabled={lookupLoading}
                className="w-full"
                variant="outline"
              >
                <Search className="h-4 w-4 mr-2" />
                {lookupLoading ? "Looking up..." : "Lookup Recipient"}
              </Button>

              {lookupError && (
                <div
                  className="rounded-md bg-destructive/20 border border-destructive/50 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {lookupError}
                </div>
              )}

              {lookupResult?.found && lookupResult.user && (
                <div className="space-y-3 rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {lookupResult.user.first_name}{" "}
                        {lookupResult.user.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {lookupResult.user.email}
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>

                  {lookupResult.user.accounts.length > 0 && (
                    <form.Field
                      name="destination_account_id"
                      validators={{
                        onChange: ({ value }) => {
                          if (!value)
                            return "Please select a destination account";
                          return undefined;
                        },
                      }}
                    >
                      {(field) => (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Select Account
                          </label>
                          <Select
                            value={
                              field.state.value
                                ? field.state.value.toString()
                                : ""
                            }
                            onValueChange={(value) =>
                              field.handleChange(parseInt(value))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {lookupResult.user?.accounts.map((account) => (
                                <SelectItem
                                  key={account.id}
                                  value={account.id.toString()}
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {account.account_type}
                                    </Badge>
                                  </div>
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
                  )}
                </div>
              )}
            </div>
          </div>

          <form.Field
            name="amount"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim() === "") return "Amount is required";

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
                  value={field.state.value || ""}
                  onChange={(value) => field.handleChange(value)}
                  placeholder="0.00"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-warning">
                    {field.state.meta.errors[0]}
                  </p>
                )}
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
                      // For mock users (black hole) or users without accounts, destState.value may be undefined
                      // Allow continue if we have a lookup result (found === true) or recipient info is filled
                      const hasRecipient =
                        lookupResult?.found ||
                        form.getFieldValue("recipient_email") ||
                        form.getFieldValue("recipient_phone");

                      // Only require destination_account_id if recipient has accounts
                      const requiresDestinationAccount =
                        lookupResult?.user &&
                        lookupResult.user.accounts.length > 0 &&
                        lookupResult.user.id !== -1; // Mock users don't need destination account

                      const isDisabled =
                        !sourceState.value ||
                        sourceState.value === 0 ||
                        (requiresDestinationAccount && !destState.value) ||
                        !amountState.value ||
                        amountState.value.trim() === "" ||
                        parseFloat(amountState.value) <= 0 ||
                        amountState.meta.errors.length > 0 ||
                        !hasRecipient;
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
  );
}
