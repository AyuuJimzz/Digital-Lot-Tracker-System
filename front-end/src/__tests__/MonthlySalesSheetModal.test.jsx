import { TextEncoder, TextDecoder } from "util";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import axios from "axios";
import MonthlySalesSheetModal from "../components/admin/MonthlySalesSheetModal";

const mockPdfSave = jest.fn();

jest.mock("axios");
jest.mock("jspdf", () => {
  class MockJsPdf {
    constructor() {
      this.internal = {
        pageSize: { getWidth: () => 297, getHeight: () => 210 },
        getNumberOfPages: () => 1,
      };
      this.setFont = jest.fn();
      this.setFontSize = jest.fn();
      this.setTextColor = jest.fn();
      this.setDrawColor = jest.fn();
      this.setFillColor = jest.fn();
      this.setLineWidth = jest.fn();
      this.line = jest.fn();
      this.text = jest.fn();
      this.roundedRect = jest.fn();
      this.addPage = jest.fn();
      this.setPage = jest.fn();
      this.splitTextToSize = jest.fn((str) => [str]);
      this.save = mockPdfSave;
    }
  }

  return {
    __esModule: true,
    jsPDF: MockJsPdf,
    default: MockJsPdf,
  };
});
jest.mock("jspdf-autotable", () =>
  jest.fn((doc) => {
    if (doc) doc.lastAutoTable = { finalY: 70 };
  })
);

describe("MonthlySalesSheetModal", () => {
  const mockReportData = {
    year: 2026,
    month: 3,
    projects: [
      {
        property_id: 49,
        property_name: "Abilay",
        subtotal: {
          lots_sold: 2,
          total_amount: 46666.66,
          total_tcp: 2240000,
        },
        records: [
          {
            transaction_id: 101,
            item_number: 1,
            buyer: "Juan Dela Cruz",
            block: "2",
            lot: "14",
            date_of_purchase: "March 6, 2026",
            mode_of_payment: "DP & 1st Monthly",
            amount: 26666.66,
            tcp: 1120000,
            agent: "Maria Santos",
          },
          {
            transaction_id: 102,
            item_number: 2,
            buyer: "Ana Santos",
            block: "2",
            lot: "1",
            date_of_purchase: "March 6, 2026",
            mode_of_payment: "DOWNPAYMENT",
            amount: 20000,
            tcp: 1120000,
            agent: "Maria Santos",
          },
        ],
      },
    ],
    summary: {
      total_lots_sold: 2,
      overall_amount: 46666.66,
      overall_tcp: 2240000,
      project_summaries: [
        {
          property_id: 49,
          property_name: "Abilay",
          lots_sold: 2,
          sales_of_the_month: 46666.66,
          tcp: 2240000,
        },
      ],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders document modal with report data and allows month change", async () => {
    axios.get.mockResolvedValueOnce({ data: mockReportData });

    render(
      <MonthlySalesSheetModal
        isOpen={true}
        onClose={jest.fn()}
        initialYear={2026}
        initialMonth={3}
        availableYears={[2026, 2025]}
      />
    );

    expect(screen.getAllByText(/Monthly Sales/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText(/Abilay New Account/i)).toBeInTheDocument();
      expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
      expect(screen.getByText("Ana Santos")).toBeInTheDocument();
    });

    expect(screen.getByText("MONTHLY SUMMARY")).toBeInTheDocument();
    expect(screen.getByText("BUYER")).toBeInTheDocument();
    expect(screen.getByText("BLK")).toBeInTheDocument();
    expect(screen.getByText("DATE OF PURCHASE")).toBeInTheDocument();
    expect(screen.getByText("MODE OF PAYMENT")).toBeInTheDocument();
    expect(screen.getByText("AMOUNT")).toBeInTheDocument();
    expect(screen.getAllByText("TCP")).toHaveLength(2);
    expect(screen.getByText("AGENT")).toBeInTheDocument();
    expect(screen.getByText("SALES OF THE MONTH")).toBeInTheDocument();
    expect(screen.queryByText("Full Screen")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Full Screen|Restore Window/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Prepared by / Management Sign-off")).not.toBeInTheDocument();
    expect(screen.queryByText("Include old records")).not.toBeInTheDocument();
    expect(axios.get.mock.calls[0][1].params).toEqual({ year: 2026, month: 3 });

    const subtotalLabel = screen.getAllByText("TOTAL LOTS SOLD")[1];
    const subtotalRow = subtotalLabel.closest("tr");
    expect(within(subtotalRow).getByText("2")).toBeInTheDocument();
    expect(within(subtotalRow).getByText("TOTAL")).toBeInTheDocument();
    expect(screen.queryByText(/Executive Monthly Sales Summary/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Monthly Collections")).not.toBeInTheDocument();
  });

  test("locks page scrolling while the report modal is open", () => {
    const { unmount } = render(
      <MonthlySalesSheetModal
        isOpen={true}
        onClose={jest.fn()}
        initialYear={2026}
        initialMonth={3}
        availableYears={[2026]}
      />
    );

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  test("triggers jsPDF export when Download PDF button is clicked", async () => {
    axios.get.mockResolvedValueOnce({ data: mockReportData });

    render(
      <MonthlySalesSheetModal
        isOpen={true}
        onClose={jest.fn()}
        initialYear={2026}
        initialMonth={3}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    });

    const pdfButton = screen.getByRole("button", { name: /Export as PDF/i });
    expect(pdfButton).toBeInTheDocument();
    fireEvent.click(pdfButton);
    expect(mockPdfSave).toHaveBeenCalledTimes(1);
    expect(mockPdfSave.mock.calls[0][0]).toMatch(
      /Golden_Dragon_Monthly_Sales_March_2026_All_projects\.pdf/
    );
  });

  test("closes the modal when Escape key is pressed", () => {
    const onClose = jest.fn();
    render(
      <MonthlySalesSheetModal
        isOpen={true}
        onClose={onClose}
        initialYear={2026}
        initialMonth={3}
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("downloads the formatted workbook as an .xlsx file", async () => {
    axios.get.mockResolvedValueOnce({ data: mockReportData });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = jest.fn(() => "blob:monthly-sales-report");
    const revokeObjectURL = jest.fn();
    let clickedAnchor = null;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function mockClick() {
        clickedAnchor = this;
      });

    try {
      render(
        <MonthlySalesSheetModal
          isOpen={true}
          onClose={jest.fn()}
          initialYear={2026}
          initialMonth={3}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Download Excel" }));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(createObjectURL.mock.calls[0][0].type).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(anchorClick).toHaveBeenCalledTimes(1);
      expect(clickedAnchor.download).toMatch(/\.xlsx$/);
    } finally {
      anchorClick.mockRestore();
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectURL,
      });
    }
  });
});
