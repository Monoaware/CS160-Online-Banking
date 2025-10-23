import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  exportUsersToCSV,
  exportUsersToPDF,
  exportTransactionsToCSV,
  exportTransactionsToPDF,
} from "./export-utils";
import { ManagerUser, ManagerTransaction } from "./actions";

// Mock jsPDF
vi.mock("jspdf", () => {
  const mockDoc = {
    setFontSize: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    autoTable: vi.fn().mockReturnThis(),
    save: vi.fn(),
  };
  return {
    jsPDF: vi.fn(() => mockDoc),
  };
});

// Mock jspdf-autotable
vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockReturnThis(),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();

Object.defineProperty(global, "URL", {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

// Mock document.createElement and related methods
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

const mockLink = {
  href: "",
  download: "",
  click: mockClick,
};

Object.defineProperty(global.document, "createElement", {
  value: vi.fn(() => mockLink),
  writable: true,
});

Object.defineProperty(global.document.body, "appendChild", {
  value: mockAppendChild,
  writable: true,
});

Object.defineProperty(global.document.body, "removeChild", {
  value: mockRemoveChild,
  writable: true,
});

describe("export-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("mock-url");
  });

  describe("exportUsersToCSV", () => {
    it("should generate and download CSV for users", () => {
      const mockUsers: ManagerUser[] = [
        {
          id: 1,
          username: "john_doe",
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
          role: "customer",
          created_at: new Date("2024-01-01"),
          state_or_territory: "CA",
          _count: { internal_accounts: 2 },
        },
        {
          id: 2,
          username: "jane_smith",
          first_name: "Jane",
          last_name: "Smith",
          email: "jane@example.com",
          role: "bank_manager",
          created_at: new Date("2024-01-02"),
          state_or_territory: "NY",
          _count: { internal_accounts: 1 },
        },
      ];

      exportUsersToCSV(mockUsers);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("mock-url");
      expect(mockLink.download).toBe("users-report.csv");
    });

    it("should handle empty users array", () => {
      exportUsersToCSV([]);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe("exportUsersToPDF", () => {
    it("should generate and download PDF for users", async () => {
      const mockUsers: ManagerUser[] = [
        {
          id: 1,
          username: "john_doe",
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
          role: "customer",
          created_at: new Date("2024-01-01"),
          state_or_territory: "CA",
          _count: { internal_accounts: 2 },
        },
      ];

      exportUsersToPDF(mockUsers);

      // Verify that jsPDF was called
      const { jsPDF } = await import("jspdf");
      expect(jsPDF).toHaveBeenCalled();
    });
  });

  describe("exportTransactionsToCSV", () => {
    it("should generate and download CSV for transactions", () => {
      const mockTransactions: ManagerTransaction[] = [
        {
          id: 1,
          created_at: new Date("2024-01-01"),
          amount: 100.5,
          status: "approved",
          transaction_type: "deposit",
          direction: "inbound",
          internal_account: {
            account_number: "1234567890",
            user: {
              id: 1,
              username: "john_doe",
              first_name: "John",
              last_name: "Doe",
            },
          },
        },
        {
          id: 2,
          created_at: new Date("2024-01-02"),
          amount: 50.25,
          status: "denied",
          transaction_type: "withdrawal",
          direction: "outbound",
          internal_account: {
            account_number: "0987654321",
            user: {
              id: 2,
              username: "jane_smith",
              first_name: "Jane",
              last_name: "Smith",
            },
          },
        },
      ];

      exportTransactionsToCSV(mockTransactions);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("mock-url");
      expect(mockLink.download).toBe("transactions-report.csv");
    });

    it("should handle empty transactions array", () => {
      exportTransactionsToCSV([]);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe("exportTransactionsToPDF", () => {
    it("should generate and download PDF for transactions", async () => {
      const mockTransactions: ManagerTransaction[] = [
        {
          id: 1,
          created_at: new Date("2024-01-01"),
          amount: 100.5,
          status: "approved",
          transaction_type: "deposit",
          direction: "inbound",
          internal_account: {
            account_number: "1234567890",
            user: {
              id: 1,
              username: "john_doe",
              first_name: "John",
              last_name: "Doe",
            },
          },
        },
      ];

      exportTransactionsToPDF(mockTransactions);

      // Verify that jsPDF was called
      const { jsPDF } = await import("jspdf");
      expect(jsPDF).toHaveBeenCalled();
    });
  });
});
