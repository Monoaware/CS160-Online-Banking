import { z } from "zod";

// Amount validation - accepts string input and converts to cents (integers)
const AmountSchema = z
  .string()
  .transform((val, ctx) => {
    const num = parseFloat(val);
    if (isNaN(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be a valid number",
      });
      return z.NEVER;
    }
    return Math.round(num * 100); // Convert to cents
  })
  .pipe(
    z
      .number()
      .int("Amount must be a whole number")
      .min(1, "Amount must be at least $0.01")
      .max(999999999, "Amount cannot exceed $9,999,999.99"),
  );

// Account number validation (up to 17 characters as per ACH standards)
const AccountNumberSchema = z
  .string()
  .min(1, "Account number is required")
  .max(17, "Account number cannot exceed 17 characters")
  .regex(/^\d+$/, "Account number must contain only digits");

// Routing number validation (exactly 9 digits)
const RoutingNumberSchema = z
  .string()
  .length(9, "Routing number must be exactly 9 digits")
  .regex(/^\d{9}$/, "Routing number must contain only digits");

// US State/Territory enum (matching schema.prisma)
const USStateTerritorySchema = z.enum([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "PR",
  "GU",
  "VI",
  "AS",
  "MP",
]);

// Cron expression validation (5-part format: minute hour day month weekday)
// Format: * * * * * (minute hour day-of-month month day-of-week)
const CronExpressionSchema = z.string().refine(
  (val) => {
    const parts = val.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    // Basic validation: each part should contain valid cron characters
    // Allowed: numbers, *, -, /, ,
    const cronPartRegex = /^[\d\*\-\,\/]+$/;
    return parts.every((part) => cronPartRegex.test(part));
  },
  {
    message:
      "Frequency must be a valid cron expression (5 parts: minute hour day month weekday)",
  },
);

// BillPayPayee schema (for creating payees)
export const BillPayPayeeSchema = z.object({
  business_name: z.string().min(1, "Business name is required").max(255),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  street_address: z.string().min(1, "Street address is required"),
  address_line_2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state_or_territory: USStateTerritorySchema,
  postal_code: z.string().min(1, "Postal code is required").max(10),
  country: z.string().default("United States"),
  account_number: AccountNumberSchema,
  routing_number: RoutingNumberSchema,
});

export type BillPayPayeeData = z.infer<typeof BillPayPayeeSchema>;

// BillPayRule creation schema
export const BillPayRuleCreateSchema = z
  .object({
    source_account_id: z
      .number()
      .int()
      .positive("Source account ID is required"),
    payee_id: z.number().int().positive().optional(), // Optional if creating new payee
    payee: BillPayPayeeSchema.optional(), // Payee data if creating new payee
    amount: AmountSchema,
    frequency: CronExpressionSchema,
    start_time: z.string().datetime("Invalid start time format"),
    end_time: z.string().datetime("Invalid end time format").optional(),
  })
  .refine((data) => data.payee_id || data.payee, {
    message: "Must provide either payee_id or payee information",
    path: ["payee_id"],
  });

export type BillPayRuleCreateData = z.infer<typeof BillPayRuleCreateSchema>;

// BillPayPayee response schema
export const BillPayPayeeResponseSchema = z.object({
  id: z.number(),
  business_name: z.string(),
  email: z.string(),
  phone: z.string(),
  street_address: z.string(),
  address_line_2: z.string().nullable(),
  city: z.string(),
  state_or_territory: z.string(),
  postal_code: z.string(),
  country: z.string(),
  account_number: z.string(),
  routing_number: z.string(),
  is_active: z.boolean(),
});

export type BillPayPayeeResponse = z.infer<typeof BillPayPayeeResponseSchema>;

// BillPayRule response schema
export const BillPayRuleResponseSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  source_internal_id: z.number(),
  payee_id: z.number(),
  amount: z.number(), // in dollars (Decimal converted to number)
  frequency: z.string(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().nullable(),
  created_at: z.string().datetime().optional(),
});

export type BillPayRuleResponse = z.infer<typeof BillPayRuleResponseSchema>;
