import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { LotImportReviewModal, resolveDuplicateCandidates } from "../LotImportReviewModal";
import { getCandidateIssues, getImportLotNumber, hasValidBoundary } from "./reviewValidation";

const square = [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]];
const candidate = (changes = {}) => ({
  id: "a", points: square, lotNumber: "1", block: "A", areaSqm: 120, selected: true, warnings: [], ...changes,
});
const approvalLabel = /I checked the map alignment/;

function ReviewHarness({ initialCandidates = [candidate()], onImport = jest.fn(), ...props }) {
  const [candidates, setCandidates] = useState(initialCandidates);
  return <LotImportReviewModal candidates={candidates} onCandidatesChange={setCandidates}
    onClose={jest.fn()} onImport={() => onImport(candidates)} {...props} />;
}

beforeAll(() => { Element.prototype.scrollIntoView = jest.fn(); });

test("requires explicit review and resets approval after lot details change", async () => {
  const onImport = jest.fn().mockResolvedValue(undefined);
  render(<ReviewHarness onImport={onImport} />);
  const create = screen.getByRole("button", { name: "Create 1 approved lot" });
  expect(create).toBeDisabled();
  fireEvent.click(screen.getByLabelText(approvalLabel));
  expect(create).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Area for candidate 1"), { target: { value: "145" } });
  expect(create).toBeDisabled();
  expect(screen.getByLabelText(approvalLabel)).not.toBeChecked();
  fireEvent.click(screen.getByLabelText(approvalLabel));
  fireEvent.click(create);
  await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
  expect(onImport.mock.calls[0][0][0].areaSqm).toBe(145);
});
test("only included lots block saving and selection changes require renewed approval", () => {
  render(<ReviewHarness initialCandidates={[candidate(), candidate({ id: "b", lotNumber: "", areaSqm: null, selected: false })]} />);
  fireEvent.click(screen.getByLabelText(approvalLabel));
  expect(screen.getByRole("button", { name: "Create 1 approved lot" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  expect(screen.getByRole("button", { name: "Create 2 approved lots" })).toBeDisabled();
  expect(screen.getByLabelText(approvalLabel)).not.toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent("1 included lot needs corrections");
  fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
  fireEvent.click(screen.getByLabelText(approvalLabel));
  expect(screen.getByRole("button", { name: "Create 0 approved lots" })).toBeDisabled();
});

test("duplicate block and lot identifiers must be corrected before bulk creation", () => {
  render(<ReviewHarness initialCandidates={[candidate(), candidate({ id: "b", block: "a", lotNumber: " 1 " })]} />);
  fireEvent.click(screen.getByLabelText(approvalLabel));
  expect(screen.getByRole("button", { name: "Create 2 approved lots" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Block for candidate 2"), { target: { value: "B" } });
  fireEvent.click(screen.getByLabelText(approvalLabel));
  expect(screen.getByRole("button", { name: "Create 2 approved lots" })).toBeEnabled();
});

test("boundary corners can be corrected with the keyboard and reset to detection", () => {
  const onImport = jest.fn().mockResolvedValue(undefined);
  render(<ReviewHarness onImport={onImport} />);
  fireEvent.click(screen.getAllByRole("button", { name: /Edit shape/i })[0]);
  fireEvent.click(screen.getByLabelText(approvalLabel));
  const corner = screen.getByRole("button", { name: "Move corner 1 of active boundary with arrow keys" });
  fireEvent.keyDown(corner, { key: "ArrowRight" });
  expect(Number(corner.getAttribute("cx"))).toBeCloseTo(102);
  expect(screen.getByLabelText(approvalLabel)).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Reset active boundary" }));
  expect(corner).toHaveAttribute("cx", "100");
  fireEvent.keyDown(corner, { key: "ArrowLeft" });
  fireEvent.click(screen.getByLabelText(approvalLabel));
  fireEvent.click(screen.getByRole("button", { name: "Create 1 approved lot" }));
  expect(onImport.mock.calls[0][0][0].points[0][0]).toBeCloseTo(0.098);
});

test("saving guards closure and edits while Escape closes a ready review", () => {
  const onClose = jest.fn();
  const { rerender } = render(<ReviewHarness onClose={onClose} isImporting />);
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Back to alignment" })).toBeDisabled();
  expect(screen.getByLabelText("Lot number for candidate 1")).toBeDisabled();
  expect(screen.getByLabelText("Saleability for candidate 1")).toBeDisabled();
  rerender(<ReviewHarness onClose={onClose} />);
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("changing a violet facility to green updates its boundary, badge and reviewed draft", () => {
  const onImport = jest.fn();
  render(<ReviewHarness onImport={onImport} initialCandidates={[candidate({ nonSaleable: true, category: "facility",
    categoryLabel: "Community Facility", warnings: ["Non-saleable area (Community Facility). It is unselected by default."] })]} />);
  fireEvent.click(screen.getByLabelText(approvalLabel));
  fireEvent.change(screen.getByLabelText("Saleability for candidate 1"), { target: { value: "saleable" } });
  expect(screen.getByRole("button", { name: "Show candidate 1" })).toHaveAttribute("fill", "#059669");
  expect(screen.queryByText("Non-saleable (Facility)")).not.toBeInTheDocument();
  expect(screen.queryByText(/It is unselected by default/)).not.toBeInTheDocument();
  expect(screen.getByLabelText(approvalLabel)).not.toBeChecked();
  fireEvent.click(screen.getByLabelText(approvalLabel));
  fireEvent.click(screen.getByRole("button", { name: "Create 1 approved lot" }));
  expect(onImport.mock.calls[0][0][0]).toMatchObject({ nonSaleable: false, category: "residential", areaSqm: 120,
    lotNumber: "1", points: square, detectedClassification: { category: "facility", nonSaleable: true } });
});

test("changing green to violet clears selection and preserves the original facility when switched back", () => {
  render(<ReviewHarness initialCandidates={[candidate({ nonSaleable: true, category: "facility", categoryLabel: "Community Facility" })]} />);
  const select = screen.getByLabelText("Saleability for candidate 1");
  fireEvent.change(select, { target: { value: "saleable" } });
  fireEvent.click(screen.getByLabelText(approvalLabel));
  fireEvent.change(select, { target: { value: "non-saleable" } });
  expect(screen.getByLabelText("Include candidate 1")).not.toBeChecked();
  expect(screen.getByLabelText(approvalLabel)).not.toBeChecked();
  expect(screen.getByText("Non-saleable (Facility)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show candidate 1" })).not.toHaveAttribute("fill", "#059669");
  expect(screen.getByRole("button", { name: "Create 0 approved lots" })).toBeDisabled();
});

test("changing the last filtered violet candidate to green keeps it visible and eligible for selection", () => {
  render(<ReviewHarness initialCandidates={[candidate({ nonSaleable: true, category: "excluded", selected: false })]} />);
  fireEvent.click(screen.getByRole("button", { name: "Non-saleable (1)" }));
  fireEvent.change(screen.getByLabelText("Saleability for candidate 1"), { target: { value: "saleable" } });
  expect(screen.getByLabelText("Saleability for candidate 1")).toHaveValue("saleable");
  expect(screen.getByLabelText("Include candidate 1")).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  expect(screen.getByLabelText("Include candidate 1")).toBeChecked();
});

test("candidate validation catches missing area, stored identifiers and oversized names", () => {
  const lots = [candidate({ areaSqm: null }), candidate({ id: "b", block: "A".repeat(45), lotNumber: "999" })];
  const issues = getCandidateIssues(lots, ["  block   a lot 1 "]);
  expect(issues.get("a")).toEqual(expect.arrayContaining([
    "Enter a positive area in square meters.", "This lot identifier already exists in this property.",
  ]));
  expect(issues.get("b")).toContain("Block and lot identifier must be 50 characters or fewer.");
  expect(getImportLotNumber(candidate({ block: "  B ", lotNumber: " 24 " }))).toBe("Block B Lot 24");
});

test("boundary validation rejects crossings, repeated corners and coordinates outside the plan", () => {
  expect(hasValidBoundary(square)).toBe(true);
  expect(hasValidBoundary([[0, 0], [1, 1], [0, 1], [1, 0]])).toBe(false);
  expect(hasValidBoundary([[0, 0], [1, 0], [1, 0], [0, 1]])).toBe(false);
  expect(hasValidBoundary([[0, 0], [1.1, 0], [0, 1]])).toBe(false);
  expect(hasValidBoundary([[0, 0], [0.5, 0.5], [1, 1]])).toBe(false);
});

test("displays detailed problem lots breakdown and allows individual or bulk exclusion", () => {
  render(<ReviewHarness initialCandidates={[
    candidate({ id: "1", lotNumber: "1", block: "A", selected: true }),
    candidate({ id: "2", lotNumber: "", areaSqm: null, selected: true }),
    candidate({ id: "3", lotNumber: "3", block: "A", points: [[0, 0], [1, 1], [0, 1], [1, 0]], selected: true }),
  ]} />);

  // Status should announce 2 invalid lots
  expect(screen.getByRole("status")).toHaveTextContent("2 included lots need corrections");

  // Breakdown should list Candidate 2 and Candidate 3
  expect(screen.getByText("Candidate 2:")).toBeInTheDocument();
  expect(screen.getAllByText("Enter the lot number from the plan.").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("Candidate 3:")).toBeInTheDocument();
  expect(screen.getAllByText(/Boundary is invalid/).length).toBeGreaterThanOrEqual(1);

  // Test Needs Correction tab in list
  expect(screen.getByRole("button", { name: "Needs Correction (2)" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Needs Correction (2)" }));

  // Exclude all invalid button
  const excludeAllBtn = screen.getByRole("button", { name: "Exclude all invalid (2)" });
  expect(excludeAllBtn).toBeInTheDocument();
  fireEvent.click(excludeAllBtn);

  // After excluding, invalid count is 0 and status warning disappears
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByText("1 / 3 included")).toBeInTheDocument();
});

test("Needs Correction stays filtered even when the active lot is valid", () => {
  render(<ReviewHarness initialCandidates={[
    candidate({ id: "a", lotNumber: "1" }),
    candidate({ id: "b", lotNumber: "2", areaSqm: null }),
    candidate({ id: "c", lotNumber: "3", areaSqm: null, selected: false }),
  ]} />);
  fireEvent.click(screen.getByRole("button", { name: "Needs Correction (1)" }));
  expect(screen.queryByRole("article", { name: "Candidate 1" })).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Candidate 2" })).toBeInTheDocument();
  expect(screen.queryByRole("article", { name: "Candidate 3" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Area for candidate 2"), { target: { value: "120" } });
  expect(screen.getByText("No included lots need corrections.")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("View / Fix reveals and focuses a problem lot hidden by the saleable filter", () => {
  render(<ReviewHarness initialCandidates={[
    candidate({ id: "a", lotNumber: "1" }),
    candidate({ id: "b", lotNumber: "2", nonSaleable: true, category: "park", areaSqm: null }),
  ]} />);
  fireEvent.click(screen.getByRole("button", { name: "Saleable (1)" }));
  expect(screen.queryByRole("article", { name: "Candidate 2" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Review candidate 2: Block A Lot 2" }));
  const row = screen.getByRole("article", { name: "Candidate 2" });
  expect(row).toHaveFocus();
  expect(Element.prototype.scrollIntoView.mock.instances).toContain(row);
  expect(screen.getByRole("button", { name: "Show candidate 2" })).toHaveAttribute("aria-pressed", "true");
});

test("duplicate links retain actual candidate numbers with unselected rows between them", () => {
  const lots = [candidate({ id: "a", selected: false }), candidate({ id: "b" }),
    candidate({ id: "c", selected: false }), candidate({ id: "d" })];
  const issues = getCandidateIssues(lots);
  expect(issues.get("b").join(" ")).toContain("conflicts with Candidate 4");
  expect(issues.get("d").join(" ")).toContain("conflicts with Candidate 2");
  render(<ReviewHarness initialCandidates={lots} />);
  fireEvent.click(screen.getByRole("button", { name: /View Candidate 4/ }));
  expect(screen.getByRole("article", { name: "Candidate 4" })).toHaveFocus();
});

test("autoFixDuplicates automatically disambiguates duplicate lot identifiers on mount", () => {
  render(<ReviewHarness initialCandidates={[candidate(), candidate({ id: "b", block: "A", lotNumber: "1" })]} autoFixDuplicates />);
  expect(screen.queryByText("Duplicate lot identifiers detected in selection")).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(approvalLabel));
  expect(screen.getByRole("button", { name: "Create 2 approved lots" })).toBeEnabled();
});

test("resolveDuplicateCandidates disambiguates duplicates with sequential suffixes and category labels", () => {
  const result = resolveDuplicateCandidates([
    { id: "1", block: "3", lotNumber: "1" },
    { id: "2", block: "3", lotNumber: "1" },
    { id: "3", block: "3", lotNumber: "1", nonSaleable: true, category: "park" },
  ]);
  expect(result[0].lotNumber).toBe("1");
  expect(result[1].lotNumber).toBe("1 (2)");
  expect(result[2].lotNumber).toBe("1 (Park 2)");
});

test("allows adding a new manual lot and increments lot number intelligently", () => {
  render(<ReviewHarness initialCandidates={[candidate({ id: "a", block: "5", lotNumber: "12", areaSqm: 150 })]} />);
  expect(screen.getByText("1 / 1 included")).toBeInTheDocument();

  // Click Add lot button
  const addLotBtn = screen.getByRole("button", { name: "Add lot" });
  fireEvent.click(addLotBtn);

  // Should have 2 candidates now
  expect(screen.getByText("2 / 2 included")).toBeInTheDocument();
  expect(screen.getByDisplayValue("13")).toBeInTheDocument();
  expect(screen.getAllByDisplayValue("5").length).toBeGreaterThanOrEqual(2);
});

test("allows deleting a candidate lot from review", () => {
  render(<ReviewHarness initialCandidates={[
    candidate({ id: "a", lotNumber: "1" }),
    candidate({ id: "b", lotNumber: "2" }),
  ]} />);
  expect(screen.getByText("2 / 2 included")).toBeInTheDocument();

  // Delete candidate 2
  const deleteBtn = screen.getByRole("button", { name: "Delete candidate 2" });
  fireEvent.click(deleteBtn);

  expect(screen.getByText("1 / 1 included")).toBeInTheDocument();
  expect(screen.queryByRole("article", { name: "Candidate 2" })).not.toBeInTheDocument();
});

test("shows empty state with Add First Lot button when 0 candidates exist", () => {
  render(<ReviewHarness initialCandidates={[]} />);
  expect(screen.getByText("No candidate boundaries were detected in this plan.")).toBeInTheDocument();
  const addFirstBtn = screen.getByRole("button", { name: "Add First Lot" });
  fireEvent.click(addFirstBtn);
  expect(screen.getByText("1 / 1 included")).toBeInTheDocument();
});

test("allows adding a corner via midpoint '+' handle and removing a corner via double click", () => {
  const onImport = jest.fn().mockResolvedValue(undefined);
  render(<ReviewHarness onImport={onImport} initialCandidates={[candidate({ id: "a", points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]] })]} />);

  // Enter edit mode
  fireEvent.click(screen.getAllByRole("button", { name: /Edit shape/i })[0]);

  // Should initially have 4 corner buttons
  expect(screen.getAllByRole("button", { name: /Move corner \d of active boundary/ }).length).toBe(4);

  // Click midpoint handle between corner 1 and corner 2
  const midpointBtn = screen.getByRole("button", { name: /Add corner point between corner 1 and 2/ });
  fireEvent.pointerDown(midpointBtn);

  // Should now have 5 corner buttons
  expect(screen.getAllByRole("button", { name: /Move corner \d of active boundary/ }).length).toBe(5);

  // Double click corner 2 to remove it
  const corner2 = screen.getByRole("button", { name: "Move corner 2 of active boundary with arrow keys" });
  fireEvent.doubleClick(corner2);

  // Should now be back to 4 corners
  expect(screen.getAllByRole("button", { name: /Move corner \d of active boundary/ }).length).toBe(4);
});

test("toggles Edit Mode on and off, hiding draggable handles when locked", () => {
  render(<ReviewHarness initialCandidates={[candidate({ id: "a" })]} />);

  // By default, not in edit mode (safe navigation)
  expect(screen.queryByRole("button", { name: /Move corner 1 of active boundary/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Drag to move entire lot" })).not.toBeInTheDocument();

  // Click Edit shape in toolbar or card
  const editShapeBtn = screen.getAllByRole("button", { name: /Edit shape/i })[0];
  fireEvent.click(editShapeBtn);

  // Handles should now be visible
  expect(screen.getByRole("button", { name: /Move corner 1 of active boundary/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Drag to move entire lot" })).toBeInTheDocument();

  // Click Done editing to lock
  const doneBtn = screen.getAllByRole("button", { name: /Done/i })[0];
  fireEvent.click(doneBtn);

  // Handles are locked and hidden again
  expect(screen.queryByRole("button", { name: /Move corner 1 of active boundary/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Drag to move entire lot" })).not.toBeInTheDocument();
});

test("Draw lot button adds a new editable candidate on the plan", () => {
  render(<ReviewHarness initialCandidates={[candidate({ id: "a" })]} />);

  // Should have 1 candidate card initially
  expect(screen.getByText("Block A Lot 1")).toBeInTheDocument();

  // Click Draw lot button
  const drawLotBtns = screen.getAllByRole("button", { name: /Draw lot|Add lot/i });
  fireEvent.click(drawLotBtns[0]);

  // Should now have 2 candidate entries and be in edit mode
  expect(screen.getAllByRole("button", { name: /Done/i }).length).toBeGreaterThan(0);
});

test("renders Deep Rescan button when onRescan is provided", () => {
  const onRescan = jest.fn();
  render(<ReviewHarness initialCandidates={[candidate({ id: "a" })]} onRescan={onRescan} />);

  const rescanBtns = screen.getAllByRole("button", { name: /Deep Rescan/i });
  expect(rescanBtns.length).toBeGreaterThan(0);
  fireEvent.click(rescanBtns[0]);
  expect(onRescan).toHaveBeenCalledTimes(1);
});
