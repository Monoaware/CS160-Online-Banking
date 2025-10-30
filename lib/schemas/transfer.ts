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

// Internal transfer schema
export const InternalTransferSchema = z
  .object({
    source_account_id: z
      .number()
      .int()
      .positive("Source account ID is required"),
    destination_account_id: z
      .number()
      .int()
      .positive("Destination account ID is required"),
    amount: AmountSchema,
  })
  .refine((data) => data.source_account_id !== data.destination_account_id, {
    message: "Source and destination accounts must be different",
    path: ["destination_account_id"],
  });

export type InternalTransferData = z.infer<typeof InternalTransferSchema>;

// External account schema for saving external accounts
export const ExternalAccountSchema = z.object({
  nickname: z
    .string()
    .max(30, "Nickname cannot exceed 30 characters")
    .optional(),
  account_number: AccountNumberSchema,
  routing_number: RoutingNumberSchema,
});

export type ExternalAccountData = z.infer<typeof ExternalAccountSchema>;

// External transfer schema (for same-bank transfers via email/phone)
export const ExternalTransferSchema = z
  .object({
    source_account_id: z
      .number()
      .int()
      .positive("Source account ID is required"),
    amount: AmountSchema,
    // Transfer to user in same bank by email/phone lookup
    recipient_email: z.string().email().optional(),
    recipient_phone: z.string().optional(),
    destination_account_id: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      // Must have either email, phone, or destination_account_id
      return (
        data.recipient_email ||
        data.recipient_phone ||
        data.destination_account_id
      );
    },
    {
      message: "Must provide recipient email, phone, or destination account ID",
      path: ["recipient_email"],
    },
  );

export type ExternalTransferData = z.infer<typeof ExternalTransferSchema>;

// Transfer history query schema
export const TransferHistoryQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  type: z.enum(["internal_transfer", "external_transfer"]).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export type TransferHistoryQueryData = z.infer<
  typeof TransferHistoryQuerySchema
>;

// Response schemas for API endpoints
export const InternalAccountResponseSchema = z.object({
  id: z.number(),
  account_number: z.string(),
  routing_number: z.string(),
  account_type: z.enum(["checking", "savings"]),
  balance: z.number(),
  is_active: z.boolean(),
  created_at: z.string().optional(),
});

export type InternalAccountResponse = z.infer<
  typeof InternalAccountResponseSchema
>;

export const ExternalAccountResponseSchema = z.object({
  id: z.number(),
  nickname: z.string().nullable(),
  account_number: z.string(),
  routing_number: z.string(),
});

export type ExternalAccountResponse = z.infer<
  typeof ExternalAccountResponseSchema
>;

export const TransferHistoryItemSchema = z.object({
  id: z.number(),
  created_at: z.string().datetime(),
  amount: z.number(),
  status: z.enum(["approved", "denied"]),
  transaction_type: z.enum(["internal_transfer", "external_transfer"]),
  direction: z.enum(["inbound", "outbound"]),
  source_account_number: z.string().optional(),
  destination_account_number: z.string().optional(),
  external_routing_number: z.string().optional(),
  external_account_number: z.string().optional(),
  external_nickname: z.string().optional(),
});

export type TransferHistoryItem = z.infer<typeof TransferHistoryItemSchema>;

export const TransferResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  transaction_id: z.number().optional(),
  amount: z.number().optional(),
});

export type TransferResponse = z.infer<typeof TransferResponseSchema>;
