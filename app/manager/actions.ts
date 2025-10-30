"use server";

import { getPrisma } from "@/app/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { headers } from "next/headers";
import { User, Transaction, InternalAccount } from "@prisma/client";

// Use Prisma generated types with select fields
export type ManagerUser = Pick<
  User,
  | "id"
  | "username"
  | "first_name"
  | "last_name"
  | "email"
  | "role"
  | "created_at"
  | "state_or_territory"
> & {
  _count: {
    internal_accounts: number;
  };
};

export type ManagerTransaction = Pick<
  Transaction,
  "id" | "created_at" | "status" | "transaction_type" | "direction"
> & {
  amount: number; // Converted from Decimal to number for client components
  internal_account: {
    account_number: string;
    user: Pick<User, "id" | "username" | "first_name" | "last_name">;
  };
};

export type DetailedUser = Pick<
  User,
  | "id"
  | "username"
  | "first_name"
  | "last_name"
  | "email"
  | "phone_number"
  | "street_address"
  | "address_line_2"
  | "city"
  | "state_or_territory"
  | "postal_code"
  | "country"
  | "role"
  | "created_at"
> & {
  internal_accounts: (Pick<
    InternalAccount,
    "id" | "account_number" | "account_type" | "is_active"
  > & {
    balance: number; // Converted from Decimal to number for client components
  })[];
  _count: {
    internal_accounts: number;
  };
};

export type DetailedTransaction = Pick<
  Transaction,
  | "id"
  | "created_at"
  | "status"
  | "transaction_type"
  | "direction"
  | "check_number"
  | "external_routing_number"
  | "external_account_number"
  | "external_nickname"
> & {
  amount: number; // Converted from Decimal to number for client components
  internal_account: {
    account_number: string;
    user: Pick<User, "id" | "username" | "first_name" | "last_name" | "email">;
  };
};

// Helper function to verify manager role
async function verifyManagerRole(): Promise<boolean> {
  try {
    const headersList = await headers();
    const authResult = await getAuthUserFromRequest(
      new Request("http://localhost", {
        headers: headersList,
      }),
    );

    if (!authResult.ok) {
      return false;
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { auth_user_id: authResult.supabaseUser.id },
      select: { role: true },
    });

    return user?.role === "bank_manager";
  } catch {
    return false;
  }
}

// Get all users with optional filters
export async function getUsers(params: {
  search?: string;
  role?: string;
  state?: string;
  page?: number;
  limit?: number;
}): Promise<{ users: ManagerUser[]; total: number }> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const { search, role, state, page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { username: { contains: search, mode: "insensitive" } },
      { first_name: { contains: search, mode: "insensitive" } },
      { last_name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (state) {
    where.state_or_territory = state;
  }

  const prisma = getPrisma();
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        created_at: true,
        state_or_territory: true,
        _count: {
          select: {
            internal_accounts: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

// Get single user with detailed information
export async function getUserById(
  userId: number,
): Promise<DetailedUser | null> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_number: true,
      street_address: true,
      address_line_2: true,
      city: true,
      state_or_territory: true,
      postal_code: true,
      country: true,
      role: true,
      created_at: true,
      internal_accounts: {
        select: {
          id: true,
          account_number: true,
          account_type: true,
          balance: true,
          is_active: true,
        },
        orderBy: { created_at: "desc" },
      },
      _count: {
        select: {
          internal_accounts: true,
        },
      },
    },
  });

  // Convert Decimal balances to numbers for client components
  return user
    ? {
        ...user,
        internal_accounts: user.internal_accounts.map((account) => ({
          ...account,
          balance: Number(account.balance),
        })),
      }
    : null;
}

// Get all transactions with optional filters
export async function getTransactions(params: {
  search?: string;
  type?: string;
  status?: string;
  direction?: string;
  page?: number;
  limit?: number;
}): Promise<{ transactions: ManagerTransaction[]; total: number }> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const { search, type, status, direction, page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      {
        internal_account: {
          user: {
            OR: [
              { username: { contains: search, mode: "insensitive" } },
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  if (type) {
    where.transaction_type = type;
  }

  if (status) {
    where.status = status;
  }

  if (direction) {
    where.direction = direction;
  }

  const prisma = getPrisma();
  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      select: {
        id: true,
        created_at: true,
        amount: true,
        status: true,
        transaction_type: true,
        direction: true,
        internal_account: {
          select: {
            account_number: true,
            user: {
              select: {
                id: true,
                username: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  // Convert Decimal amounts to numbers for client components
  const transactionsWithNumbers = transactions.map((transaction) => ({
    ...transaction,
    amount: Number(transaction.amount),
  }));

  return { transactions: transactionsWithNumbers, total };
}

// Get single transaction with detailed information
export async function getTransactionById(
  transactionId: number,
): Promise<DetailedTransaction | null> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const prisma = getPrisma();
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      created_at: true,
      amount: true,
      status: true,
      transaction_type: true,
      direction: true,
      check_number: true,
      external_routing_number: true,
      external_account_number: true,
      external_nickname: true,
      internal_account: {
        select: {
          account_number: true,
          user: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  // Convert Decimal amount to number for client components
  return transaction
    ? {
        ...transaction,
        amount: Number(transaction.amount),
      }
    : null;
}

// Get user's recent transactions
export async function getUserTransactions(
  userId: number,
  limit = 10,
): Promise<ManagerTransaction[]> {
  const isManager = await verifyManagerRole();
  if (!isManager) {
    throw new Error("Unauthorized: Manager role required");
  }

  const prisma = getPrisma();
  const transactions = await prisma.transaction.findMany({
    where: {
      internal_account: {
        user_id: userId,
      },
    },
    select: {
      id: true,
      created_at: true,
      amount: true,
      status: true,
      transaction_type: true,
      direction: true,
      internal_account: {
        select: {
          account_number: true,
          user: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  // Convert Decimal amounts to numbers for client components
  const transactionsWithNumbers = transactions.map((transaction) => ({
    ...transaction,
    amount: Number(transaction.amount),
  }));

  return transactionsWithNumbers;
}
