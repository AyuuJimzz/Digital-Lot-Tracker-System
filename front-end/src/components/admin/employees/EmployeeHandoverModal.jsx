import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, ArrowRightLeft, AlertCircle, CheckCircle2, Building, User } from "lucide-react";
import { API_BASE_URL } from "../../../config/api";
import { showToast } from "../../GlobalToast";

export const EmployeeHandoverModal = ({
  isOpen,
  employee,
  allEmployees = [],
  onClose,
  onSuccess,
}) => {
  const [pendingLots, setPendingLots] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [bulkAgentId, setBulkAgentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const activeTargetEmployees = (allEmployees || []).filter(
    (emp) => Number(emp.employee_id) !== Number(employee?.employee_id) &&
      String(emp.status || "active").toLowerCase() === "active"
  );
  const employeeId = employee?.employee_id;

  useEffect(() => {
    if (!isOpen || !employeeId) {
      setPendingLots([]);
      setAssignments({});
      setBulkAgentId("");
      setError("");
      setLoadError("");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError("");
    setLoadError("");

    const token = localStorage.getItem("authToken");
    axios
      .get(`${API_BASE_URL}/api/employees/${employeeId}/pending-lots`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        if (!isMounted) return;
        const lots = Array.isArray(res.data) ? res.data : [];
        setPendingLots(lots);

        setAssignments({});
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to fetch employee pending lots:", err);
        setLoadError(err.response?.data?.error || err.message || "Failed to load pending reservations.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, employeeId, retryCount]);

  if (!isOpen || !employee) return null;

  const handleIndividualChange = (lotId, targetEmpId) => {
    setAssignments((prev) => ({
      ...prev,
      [lotId]: targetEmpId === "admin" ? null : targetEmpId ? Number(targetEmpId) : undefined,
    }));
  };

  const handleApplyBulk = () => {
    if (!bulkAgentId) return;
    const targetVal = bulkAgentId === "admin" ? null : Number(bulkAgentId);
    const newAssignments = {};
    pendingLots.forEach((lot) => {
      newAssignments[lot.lot_id] = targetVal;
    });
    setAssignments(newAssignments);
    showToast(
      targetVal
        ? "Assigned to all pending clients!"
        : "Set all pending clients to Admin",
      "info"
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pendingLots.length === 0) {
      onClose();
      return;
    }
    if (pendingLots.some((lot) => assignments[lot.lot_id] === undefined)) {
      setError("Choose a destination for every pending client before confirming.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem("authToken");
      const reassignments = pendingLots.map((lot) => ({
        lot_id: lot.lot_id,
        customer_id: lot.customer_id,
        target_employee_id: assignments[lot.lot_id],
      }));

      const res = await axios.post(
        `${API_BASE_URL}/api/employees/${employee.employee_id}/reassign-pending`,
        { reassignments },
        {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      showToast(res.data?.message || "Clients transferred successfully!", "success");
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error("Error submitting reassignments:", err);
      const msg = err.response?.data?.error || err.message || "Failed to transfer clients.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const employeeFullName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Employee";
  const initials =
    (employee.first_name?.[0] || "") + (employee.last_name?.[0] || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="employee-handover-title" className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] min-h-0 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center text-sm font-bold shadow-sm uppercase shrink-0">
              {initials}
            </div>
            <div>
              <h3 id="employee-handover-title" className="text-base font-bold text-gray-900 dark:text-white capitalize flex items-center gap-2">
                Transfer Pending Clients
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Reassign pending client reservations of <span className="font-semibold text-gray-800 dark:text-slate-200">{employeeFullName}</span> to another agent
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Simple Clean Notice */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
            <span>
              Transfers active reservations so another agent can assist the buyer. Completed (Sold) lots remain permanently credited to this employee.
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Loading pending client reservations...
              </p>
            </div>
          ) : loadError ? (
            <div role="alert" className="py-8 px-4 text-center border border-rose-200 dark:border-rose-900 rounded-xl space-y-3">
              <p className="text-sm text-rose-700 dark:text-rose-300">{loadError}</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
                Retry loading
              </button>
            </div>
          ) : pendingLots.length === 0 ? (
            <div className="py-10 px-4 text-center border border-dashed border-gray-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 dark:text-slate-200">
                No Pending Clients to Transfer
              </h4>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
                {employeeFullName} currently has no active pending reservations. All accounts are settled or already assigned.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bulk Quick Action (Only when 2 or more lots) */}
              {pendingLots.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <div className="text-xs text-gray-600 dark:text-slate-300">
                    <span className="font-semibold text-gray-900 dark:text-white">Quick Assign:</span>
                    <span className="text-gray-500 dark:text-slate-400 ml-1">
                      Transfer all {pendingLots.length} clients to:
                    </span>
                  </div>
                  <div className="flex w-full sm:w-auto items-center gap-2 min-w-0">
                    <select
                      aria-label="Destination for all pending clients"
                      value={bulkAgentId}
                      onChange={(e) => setBulkAgentId(e.target.value)}
                      className="min-w-0 flex-1 sm:flex-initial text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" disabled>Choose destination</option>
                      <option value="admin">Admin</option>
                      {activeTargetEmployees.map((emp) => (
                        <option key={emp.employee_id} value={emp.employee_id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleApplyBulk}
                      disabled={!bulkAgentId}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply to All
                    </button>
                  </div>
                </div>
              )}

              {/* Individual Lots List */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {pendingLots.map((lot) => {
                  const selectedTarget = assignments[lot.lot_id] === null ? "admin" : assignments[lot.lot_id] ?? "";
                  return (
                    <div
                      key={lot.lot_id}
                      className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 hover:bg-gray-100/60 dark:hover:bg-slate-800/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            Lot {lot.lot_number}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-gray-400" />
                            {lot.property_name || "Property"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-800 dark:text-slate-200">
                            {lot.customer_name || "No client registered"}
                          </span>
                          {lot.contact_number && (
                            <span className="text-gray-400 dark:text-slate-500">
                              • {lot.contact_number}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dropdown for this specific lot */}
                      <div className="flex w-full sm:w-auto items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          Assign to:
                        </span>
                        <select
                          aria-label={`Destination for Lot ${lot.lot_number}`}
                          value={selectedTarget}
                          onChange={(e) => handleIndividualChange(lot.lot_id, e.target.value)}
                          className="min-w-0 flex-1 sm:flex-initial text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors"
                        >
                          <option value="" disabled>Choose destination</option>
                          <option value="admin">Admin</option>
                          {activeTargetEmployees.map((emp) => (
                            <option key={emp.employee_id} value={emp.employee_id}>
                              {emp.first_name} {emp.last_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-200/80 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            {pendingLots.length === 0 ? "Close" : "Cancel"}
          </button>
          {pendingLots.length > 0 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || loading || Boolean(loadError)}
              className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer ${
                submitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>
                    Confirm Transfer ({pendingLots.length} {pendingLots.length === 1 ? "Client" : "Clients"})
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeHandoverModal;
