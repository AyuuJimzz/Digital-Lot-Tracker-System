import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import RecentTransactions from "../components/admin/AdminRecentTransactions";

jest.mock("../hooks/useRecentTransactions", () => ({
  useRecentTransactions: () => ({
    data: {
      transactions: [
        {
          transaction_id: "TXN-0001",
          lot_id: 1,
          property_id: 49,
          property_name: "LOT-3896 Oton Cadastre",
          lot_number: "Block 1 Lot 1",
          customer_name: "Juan Dela Cruz",
          agent_name: "Sarah Lee",
          agent_status: "active",
          status: "Sold",
          total_contract_price: 1500000,
          payment_type: "Installment",
        },
        {
          transaction_id: "TXN-0002",
          lot_id: 2,
          property_id: 50,
          property_name: "Lot-2018 Oton Cadastre",
          lot_number: "Block 2 Lot 6",
          customer_name: "Bernadette Espinoza",
          agent_name: "Sarah Lee",
          agent_status: "active",
          status: "Sold",
          total_contract_price: 1850000,
          payment_type: "Installment",
        },
      ],
      empNameMap: {},
    },
    isPending: false,
    error: null,
  }),
}));

describe("AdminRecentTransactions Component Project Filtering", () => {
  test("shows all transactions when selectedPropertyId is 'all'", () => {
    render(<RecentTransactions selectedPropertyId="all" onClearPropertyFilter={jest.fn()} />);

    expect(screen.getByText("TXN-0001")).toBeInTheDocument();
    expect(screen.getByText("TXN-0002")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Bernadette Espinoza")).toBeInTheDocument();
    expect(screen.getByText("2 total")).toBeInTheDocument();
  });

  test("filters transactions to only the selected project when selectedPropertyId is provided", () => {
    render(<RecentTransactions selectedPropertyId={50} onClearPropertyFilter={jest.fn()} />);

    expect(screen.queryByText("TXN-0001")).not.toBeInTheDocument();
    expect(screen.getByText("TXN-0002")).toBeInTheDocument();
    expect(screen.getByText("Bernadette Espinoza")).toBeInTheDocument();
    expect(screen.getByText("1 record")).toBeInTheDocument();
    expect(screen.getByText(/Filtered: Lot-2018 Oton Cadastre/)).toBeInTheDocument();
  });

  test("triggers onClearPropertyFilter when the clear badge button is clicked", () => {
    const handleClear = jest.fn();
    render(<RecentTransactions selectedPropertyId={49} onClearPropertyFilter={handleClear} />);

    expect(screen.getByText("TXN-0001")).toBeInTheDocument();
    const clearBtn = screen.getByTitle("Show all projects in transactions");
    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
