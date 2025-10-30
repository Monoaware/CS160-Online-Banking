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
import { CheckCircle, ArrowRight, Calendar, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BillPayPayeeSchema } from "@/lib/schemas/billpay";
import { InternalAccountResponse } from "@/lib/schemas/transfer";
import { formatCurrency } from "@/lib/utils";
import { CurrencyInputField } from "./currency-input";

type FormState =
  | "idle"
  | "filling"
  | "reviewing"
  | "submitting"
  | "success"
  | "error";

interface BillPayFormData {
  source_account_id: number;
  payee_id?: number;
  payee?: {
    business_name: string;
    email: string;
    phone: string;
    street_address: string;
    address_line_2?: string;
    city: string;
    state_or_territory: string;
    postal_code: string;
    country: string;
    account_number: string;
    routing_number: string;
  };
  amount: string;
  frequency: string;
  start_time: string;
  end_time?: string;
}

interface BillPayPayee {
  id: number;
  business_name: string;
  email: string;
  phone: string;
  account_number: string;
  routing_number: string;
}

interface BillPayRule {
  id: number;
  source_internal_id: number;
  payee_id: number;
  amount: number;
  frequency: string;
  start_time: string;
  end_time: string | null;
}

// Common frequency presets
const FREQUENCY_PRESETS = [
  { label: "Daily", value: "0 9 * * *" }, // Every day at 9 AM
  { label: "Weekly (Monday)", value: "0 9 * * 1" },
  { label: "Bi-weekly (Monday)", value: "0 9 */2 * *" },
  { label: "Monthly (1st)", value: "0 9 1 * *" },
  { label: "Custom", value: "custom" },
];

export function BillPay() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>("idle");
  const [accounts, setAccounts] = useState<InternalAccountResponse[]>([]);
  const [payees, setPayees] = useState<BillPayPayee[]>([]);
  const [rules, setRules] = useState<BillPayRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payeeSearchTerm, setPayeeSearchTerm] = useState("");
  const [showPayeeForm, setShowPayeeForm] = useState(false);
  const [selectedPayeeId, setSelectedPayeeId] = useState<number | null>(null);
  const [frequencyPreset, setFrequencyPreset] = useState<string>("0 9 * * *");
  const [customFrequency, setCustomFrequency] = useState<string>("");
  const [successData, setSuccessData] = useState<{
    rule_id: number;
    amount: number;
    payee_name: string;
  } | null>(null);

  const form = useForm({
    defaultValues: {
      source_account_id: 0,
      payee_id: undefined,
      payee: undefined,
      amount: "",
      frequency: "0 9 * * *",
      start_time: "",
      end_time: "",
    } as BillPayFormData,
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

        // Determine frequency
        const frequency =
          frequencyPreset === "custom" ? customFrequency : frequencyPreset;

        const requestBody: {
          source_account_id: number;
          payee_id?: number;
          payee?: unknown;
          amount: string;
          frequency: string;
          start_time: string;
          end_time?: string;
        } = {
          source_account_id: value.source_account_id,
          amount: value.amount,
          frequency,
          start_time: value.start_time,
        };

        if (value.payee_id) {
          requestBody.payee_id = value.payee_id;
        } else if (value.payee) {
          requestBody.payee = value.payee;
        }

        if (value.end_time) {
          requestBody.end_time = value.end_time;
        }

        const response = await fetch("/api/billpay/rules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const data = (await response.json()) as {
            error: string;
            details?: unknown;
          };
          throw new Error(data.error || "Failed to create billpay rule");
        }

        const result = (await response.json()) as {
          rule: BillPayRule;
        };

        const payee =
          payees.find((p) => p.id === result.rule.payee_id) ||
          (value.payee
            ? { business_name: value.payee.business_name }
            : { business_name: "Unknown" });

        setSuccessData({
          rule_id: result.rule.id,
          amount: result.rule.amount,
          payee_name: payee.business_name,
        });

        setFormState("success");
        fetchRules(); // Refresh rules list
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create billpay rule",
        );
        setFormState("error");
      }
    },
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Fetch accounts
      const accountsResponse = await fetch("/api/accounts/internal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!accountsResponse.ok) {
        throw new Error("Failed to fetch accounts");
      }

      const accountsData = (await accountsResponse.json()) as {
        accounts: InternalAccountResponse[];
      };
      setAccounts(accountsData.accounts.filter((acc) => acc.is_active));

      // Fetch payees
      await fetchPayees();

      // Fetch rules
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchPayees = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(
        `/api/billpay/payees${payeeSearchTerm ? `?business_name=${encodeURIComponent(payeeSearchTerm)}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (response.ok) {
        const data = (await response.json()) as { payees: BillPayPayee[] };
        setPayees(data.payees);
      }
    } catch (err) {
      console.error("Failed to fetch payees:", err);
    }
  };

  const fetchRules = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch("/api/billpay/rules", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as { rules: BillPayRule[] };
        setRules(data.rules);
      }
    } catch (err) {
      console.error("Failed to fetch rules:", err);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(`/api/billpay/rules/${ruleId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        fetchRules(); // Refresh rules list
      }
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  const handleCreatePayee = async (payeeData: unknown) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch("/api/billpay/payees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payeeData),
      });

      if (response.ok) {
        const data = (await response.json()) as { payee: BillPayPayee };
        setPayees([...payees, data.payee]);
        setSelectedPayeeId(data.payee.id);
        form.setFieldValue("payee_id", data.payee.id);
        setShowPayeeForm(false);
      }
    } catch (err) {
      console.error("Failed to create payee:", err);
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    const preset = FREQUENCY_PRESETS.find((p) => p.value === frequency);
    return preset ? preset.label : frequency;
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bill Pay</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p>Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && formState === "idle") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bill Pay</CardTitle>
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
          <CardTitle>Bill Pay Rule Created</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-4">
            <CheckCircle className="h-16 w-16 text-success" />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-lg font-semibold">
              Auto payment set up for {formatCurrency(successData.amount)}
            </p>
            <p className="text-sm text-muted-foreground">
              Payee: {successData.payee_name}
            </p>
            <p className="text-sm text-muted-foreground">
              Rule ID: {successData.rule_id}
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
              onClick={() => {
                form.reset();
                setFormState("idle");
                setError(null);
                setSuccessData(null);
                setSelectedPayeeId(null);
                setShowPayeeForm(false);
              }}
              className="flex-1"
            >
              Create Another Rule
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Set Up Auto Payment</CardTitle>
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
                  if (!value || value === 0)
                    return "Source account is required";
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
              <div className="text-sm font-medium">Payee</div>

              {!showPayeeForm ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search payee by name..."
                      value={payeeSearchTerm}
                      onChange={(e) => {
                        setPayeeSearchTerm(e.target.value);
                        fetchPayees();
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowPayeeForm(true);
                        setPayeeSearchTerm("");
                      }}
                    >
                      New Payee
                    </Button>
                  </div>

                  {payees.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {payees.map((payee) => (
                        <div
                          key={payee.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedPayeeId === payee.id
                              ? "bg-card border-primary"
                              : "bg-muted/30 hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            setSelectedPayeeId(payee.id);
                            form.setFieldValue("payee_id", payee.id);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {payee.business_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {payee.email}
                              </p>
                            </div>
                            {selectedPayeeId === payee.id && (
                              <CheckCircle className="h-5 w-5 text-success" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <BillPayeeForm
                  onSubmit={(payeeData) => {
                    handleCreatePayee(payeeData);
                  }}
                  onCancel={() => {
                    setShowPayeeForm(false);
                  }}
                />
              )}
            </div>

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

            <div className="space-y-4">
              <div className="text-sm font-medium">Schedule</div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Frequency</label>
                <Select
                  value={frequencyPreset}
                  onValueChange={(value) => {
                    setFrequencyPreset(value);
                    if (value !== "custom") {
                      const preset = FREQUENCY_PRESETS.find(
                        (p) => p.value === value,
                      );
                      if (preset && preset.value !== "custom") {
                        form.setFieldValue("frequency", preset.value);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_PRESETS.map((preset) => (
                      <SelectItem
                        key={preset.value}
                        value={
                          preset.value === "custom" ? "custom" : preset.value
                        }
                      >
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {frequencyPreset === "custom" && (
                  <Input
                    placeholder="Cron expression (e.g., 0 9 * * 1)"
                    value={customFrequency}
                    onChange={(e) => {
                      setCustomFrequency(e.target.value);
                      form.setFieldValue("frequency", e.target.value);
                    }}
                    className="mt-2"
                  />
                )}
              </div>

              <form.Field
                name="start_time"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return "Start time is required";
                    const startDate = new Date(value);
                    if (startDate <= new Date()) {
                      return "Start time must be in the future";
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <label
                      htmlFor="start_time"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      Start Time
                    </label>
                    <Input
                      id="start_time"
                      type="datetime-local"
                      value={field.state.value || ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-warning">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name="end_time">
                {(field) => (
                  <div className="space-y-2">
                    <label htmlFor="end_time" className="text-sm font-medium">
                      End Time (Optional)
                    </label>
                    <Input
                      id="end_time"
                      type="datetime-local"
                      value={field.state.value || ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      min={
                        form.getFieldValue("start_time") ||
                        new Date().toISOString().slice(0, 16)
                      }
                    />
                  </div>
                )}
              </form.Field>
            </div>

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
                <form.Field name="amount">
                  {({ state: amountState }) => {
                    const isDisabled =
                      !sourceState.value ||
                      sourceState.value === 0 ||
                      !selectedPayeeId ||
                      !amountState.value ||
                      amountState.value.trim() === "" ||
                      parseFloat(amountState.value) <= 0 ||
                      amountState.meta.errors.length > 0 ||
                      !form.getFieldValue("start_time");
                    return (
                      <Button
                        type="submit"
                        disabled={isDisabled}
                        className="w-full"
                      >
                        Create Auto Payment Rule
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    );
                  }}
                </form.Field>
              )}
            </form.Field>
          </form>
        </CardContent>
      </Card>

      {rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Auto Payment Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rules.map((rule) => {
                const payee = payees.find((p) => p.id === rule.payee_id);
                const sourceAccount = accounts.find(
                  (a) => a.id === rule.source_internal_id,
                );
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">
                          {formatCurrency(rule.amount)}
                        </p>
                        <Badge variant="secondary">
                          {getFrequencyLabel(rule.frequency)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        To: {payee?.business_name || "Unknown Payee"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        From:{" "}
                        {sourceAccount
                          ? `****${sourceAccount.account_number.slice(-4)}`
                          : "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Starts: {formatDate(rule.start_time)}
                        {rule.end_time &&
                          ` • Ends: ${formatDate(rule.end_time)}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Separate component for payee form
function BillPayeeForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: unknown) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    business_name: "",
    email: "",
    phone: "",
    street_address: "",
    address_line_2: "",
    city: "",
    state_or_territory: "CA",
    postal_code: "",
    country: "United States",
    account_number: "",
    routing_number: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = BillPayPayeeSchema.safeParse(formData);
    if (result.success) {
      onSubmit(result.data);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h3 className="font-medium">Create New Payee</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Business Name"
          value={formData.business_name}
          onChange={(e) =>
            setFormData({ ...formData, business_name: e.target.value })
          }
          required
        />
        <Input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
        <Input
          placeholder="Phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          required
        />
        <Input
          placeholder="Street Address"
          value={formData.street_address}
          onChange={(e) =>
            setFormData({ ...formData, street_address: e.target.value })
          }
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            required
          />
          <Input
            placeholder="Postal Code"
            value={formData.postal_code}
            onChange={(e) =>
              setFormData({ ...formData, postal_code: e.target.value })
            }
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Account Number"
            value={formData.account_number}
            onChange={(e) =>
              setFormData({ ...formData, account_number: e.target.value })
            }
            required
          />
          <Input
            placeholder="Routing Number"
            value={formData.routing_number}
            onChange={(e) =>
              setFormData({ ...formData, routing_number: e.target.value })
            }
            required
            maxLength={9}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Create
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
