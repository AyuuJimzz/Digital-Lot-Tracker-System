import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import ProjectDashboardSwitcher from "../components/admin/ProjectDashboardSwitcher";

const mockSubdivisions = [
  {
    property_id: 49,
    property_name: "LOT-3896 Oton Cadastre",
    location: "Brgy. Abilay Norte, Oton, Iloilo",
    totalLots: 217,
    availableLots: 33,
    pendingLots: 1,
    soldLots: 183,
  },
  {
    property_id: 50,
    property_name: "Lot-2018 Oton Cadastre",
    location: "Brgy. Abilay Norte, Oton, Iloilo",
    totalLots: 162,
    availableLots: 8,
    pendingLots: 10,
    soldLots: 144,
  },
];

describe("ProjectDashboardSwitcher Component", () => {
  test("renders the whole-estate scope and project tabs by default", () => {
    render(
      <ProjectDashboardSwitcher
        subdivisions={mockSubdivisions}
        selectedProject="all"
        onSelectProject={jest.fn()}
        totalEstateLots={379}
      />
    );

    expect(screen.getByText("Dashboard Overview")).toBeInTheDocument();
    expect(screen.getByText("Choose a project to view its inventory and sales summary.")).toBeInTheDocument();
    expect(screen.getByText("All Projects")).toBeInTheDocument();
    expect(screen.getByText("379")).toBeInTheDocument();
    expect(screen.getByText("Abilay Norte")).toBeInTheDocument();
    expect(screen.getByText("Pulo Maestra")).toBeInTheDocument();
  });

  test("clicking a project tab triggers onSelectProject with property_id", () => {
    const handleSelect = jest.fn();
    render(
      <ProjectDashboardSwitcher
        subdivisions={mockSubdivisions}
        selectedProject="all"
        onSelectProject={handleSelect}
        totalEstateLots={379}
      />
    );

    const abilayPill = screen.getByText("Abilay Norte");
    fireEvent.click(abilayPill);

    expect(handleSelect).toHaveBeenCalledWith(49);
  });

  test("clicking the active project tab toggles back to 'all'", () => {
    const handleSelect = jest.fn();
    render(
      <ProjectDashboardSwitcher
        subdivisions={mockSubdivisions}
        selectedProject={49}
        onSelectProject={handleSelect}
        totalEstateLots={379}
      />
    );

    const abilayPill = screen.getByText("Abilay Norte");
    fireEvent.click(abilayPill);

    expect(handleSelect).toHaveBeenCalledWith("all");
  });

  test("does not repeat the selected location or reset action below the tabs", () => {
    render(
      <ProjectDashboardSwitcher
        subdivisions={mockSubdivisions}
        selectedProject={49}
        onSelectProject={jest.fn()}
        totalEstateLots={379}
      />
    );

    expect(screen.queryByText("Brgy. Abilay Norte, Oton, Iloilo")).not.toBeInTheDocument();
    expect(screen.queryByText("View all projects")).not.toBeInTheDocument();
  });

  test("marks the active project tab as selected", () => {
    render(
      <ProjectDashboardSwitcher
        subdivisions={mockSubdivisions}
        selectedProject={49}
        onSelectProject={jest.fn()}
        totalEstateLots={379}
      />
    );

    expect(screen.getByRole("button", { name: /Abilay Norte/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Pulo Maestra/ })).toHaveAttribute("aria-pressed", "false");
  });
});
