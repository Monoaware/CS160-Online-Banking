import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ManagerUser, ManagerTransaction } from "./actions";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: {
      head: string[][];
      body: string[][];
      startY?: number;
      styles?: Record<string, unknown>;
      headStyles?: Record<string, unknown>;
      alternateRowStyles?: Record<string, unknown>;
      columnStyles?: Record<string, unknown>;
    }) => jsPDF;
  }
}

/**
 * Export users data to CSV format
 */
export function exportUsersToCSV(users: ManagerUser[]): void {
  const headers = [
    "Name",
    "Username",
    "Email",
    "Role",
    "State",
    "Account Count",
    "Joined Date",
  ];

  const csvData = users.map((user) => [
    `${user.first_name} ${user.last_name}`,
    user.username,
    user.email,
    user.role.replace("_", " ").toUpperCase(),
    user.state_or_territory,
    user._count.internal_accounts.toString(),
    formatDateForCSV(user.created_at),
  ]);

  const csvContent = [headers, ...csvData]
    .map((row) => row.map((field) => `"${field}"`).join(","))
    .join("\n");

  downloadFile(csvContent, "users-report.csv", "text/csv");
}

/**
 * Export users data to PDF format
 */
export function exportUsersToPDF(users: ManagerUser[]): void {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(20);
  doc.text("Users Report", 14, 22);

  // Add generation date
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

  // Prepare table data
  const tableData = users.map((user) => [
    `${user.first_name} ${user.last_name}`,
    user.username,
    user.email,
    user.role.replace("_", " ").toUpperCase(),
    user.state_or_territory,
    user._count.internal_accounts.toString(),
    formatDateForPDF(user.created_at),
  ]);

  // Add table
  autoTable(doc, {
    head: [
      ["Name", "Username", "Email", "Role", "State", "Accounts", "Joined"],
    ],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 20 },
      2: { cellWidth: 35 },
      3: { cellWidth: 20 },
      4: { cellWidth: 15 },
      5: { cellWidth: 15 },
      6: { cellWidth: 25 },
    },
  });

  doc.save("users-report.pdf");
}

/**
 * Export transactions data to CSV format
 */
export function exportTransactionsToCSV(
  transactions: ManagerTransaction[],
): void {
  const headers = [
    "Date",
    "User",
    "Amount",
    "Type",
    "Status",
    "Direction",
    "Account Number",
  ];

  const csvData = transactions.map((transaction) => [
    formatDateForCSV(transaction.created_at),
    `${transaction.internal_account.user.first_name} ${transaction.internal_account.user.last_name}`,
    formatCurrencyForCSV(transaction.amount, transaction.direction),
    transaction.transaction_type.replace("_", " ").toUpperCase(),
    transaction.status.toUpperCase(),
    transaction.direction.toUpperCase(),
    `****${transaction.internal_account.account_number.slice(-4)}`,
  ]);

  const csvContent = [headers, ...csvData]
    .map((row) => row.map((field) => `"${field}"`).join(","))
    .join("\n");

  downloadFile(csvContent, "transactions-report.csv", "text/csv");
}

/**
 * Export transactions data to PDF format
 */
export function exportTransactionsToPDF(
  transactions: ManagerTransaction[],
): void {
  const doc = new jsPDF();

  // Add title
  doc.setFontSize(20);
  doc.text("Transactions Report", 14, 22);

  // Add generation date
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

  // Prepare table data
  const tableData = transactions.map((transaction) => [
    formatDateForPDF(transaction.created_at),
    `${transaction.internal_account.user.first_name} ${transaction.internal_account.user.last_name}`,
    formatCurrencyForPDF(transaction.amount, transaction.direction),
    transaction.transaction_type.replace("_", " ").toUpperCase(),
    transaction.status.toUpperCase(),
    transaction.direction.toUpperCase(),
    `****${transaction.internal_account.account_number.slice(-4)}`,
  ]);

  // Add table
  autoTable(doc, {
    head: [
      ["Date", "User", "Amount", "Type", "Status", "Direction", "Account"],
    ],
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 25 },
      4: { cellWidth: 15 },
      5: { cellWidth: 15 },
      6: { cellWidth: 20 },
    },
  });

  doc.save("transactions-report.pdf");
}

/**
 * Helper function to download a file
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for CSV export
 */
function formatDateForCSV(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format date for PDF export
 */
function formatDateForPDF(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format currency for CSV export
 */
function formatCurrencyForCSV(
  amount: number,
  direction: "inbound" | "outbound",
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

  return direction === "inbound" ? `+${formatted}` : `-${formatted}`;
}

/**
 * Format currency for PDF export
 */
function formatCurrencyForPDF(
  amount: number,
  direction: "inbound" | "outbound",
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

  return direction === "inbound" ? `+${formatted}` : `-${formatted}`;
}
