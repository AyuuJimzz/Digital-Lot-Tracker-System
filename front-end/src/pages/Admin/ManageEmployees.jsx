import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Plus, CheckCircle2, X } from "lucide-react";
import { API_BASE_URL } from "../../config/api";
import { showToast } from "../../components/GlobalToast";
import {
  EmployeeTable,
  EmployeeAddEditModal,
  EmployeeDeleteModal,
  EmployeeActivityModal,
} from "../../components/admin/employees";

const ManageEmployees = () => {
  const [employees, setEmployees] = useState(() => {
    try {
      const cached = sessionStorage.getItem("employeesCache");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => !sessionStorage.getItem("employeesCache"));
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });

  const [activityEmployee, setActivityEmployee] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [employeePendingDelete, setEmployeePendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState("");

  const navigate = useNavigate();

  // Auto-dismiss delete success notification after 4 seconds
  useEffect(() => {
    if (!deleteSuccessMessage) return;
    const timer = setTimeout(() => setDeleteSuccessMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [deleteSuccessMessage]);

  const fetchEmployees = useCallback(async () => {
    try {
      const token = localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API_BASE_URL}/api/employees`, {
        withCredentials: true,
        headers,
      });
      setEmployees(response.data);
      try {
        sessionStorage.setItem("employeesCache", JSON.stringify(response.data));
      } catch (e) {}
      setLoading(false);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/access-denied?status=401&message=Unauthorized");
        return;
      }
      setError(err.message || "Failed to fetch employees");
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleViewActivity = async (employee) => {
    setActivityEmployee(employee);
    setLoadingActivities(true);
    setActivities([]);
    try {
      const token = localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(
        `${API_BASE_URL}/api/employees/${employee.employee_id}/activities`,
        { withCredentials: true, headers }
      );
      setActivities(res.data.activities || []);
    } catch (err) {
      console.error("Failed to fetch employee activity history:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
    });
    setEditingEmployee(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("authToken");
      const authConfig = {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      const url = editingEmployee
        ? `${API_BASE_URL}/api/employees/${editingEmployee.employee_id}`
        : `${API_BASE_URL}/api/employees`;

      if (editingEmployee) {
        await axios.put(url, formData, authConfig);
        showToast("Employee updated successfully", "success");
      } else {
        const res = await axios.post(url, formData, authConfig);
        showToast(
          res.data?.message ||
            "Employee added successfully. An email with login credentials has been sent.",
          "success"
        );
      }
      await fetchEmployees();
      resetForm();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || "Failed to save employee", "error");
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      email: employee.email || "",
      password: "",
    });
    setShowForm(true);
  };

  const openDeleteModal = (employee) => {
    setDeleteError("");
    setEmployeePendingDelete(employee);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setEmployeePendingDelete(null);
    setDeleteError("");
  };

  const confirmDeleteEmployee = async () => {
    if (!employeePendingDelete || isDeleting) return;
    setIsDeleting(true);
    setDeleteError("");

    const employeeId = employeePendingDelete.employee_id;
    const employeeName =
      `${employeePendingDelete.first_name || ""} ${employeePendingDelete.last_name || ""}`.trim() ||
      "Employee";

    try {
      const token = localStorage.getItem("authToken");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API_BASE_URL}/api/employees/${employeeId}`, {
        withCredentials: true,
        headers,
      });

      try {
        sessionStorage.removeItem("employeesCache");
      } catch (err) {}

      await fetchEmployees();
      setEmployeePendingDelete(null);
      showToast(`Employee "${employeeName}" deleted successfully`, "success");
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to delete employee";
      setDeleteError(errorMsg);
      showToast(errorMsg, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-slate-400">
        Loading employees...
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 dark:text-red-400 p-4">Error: {error}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* ── In-App Delete Confirmation Modal ── */}
      <EmployeeDeleteModal
        employee={employeePendingDelete}
        isDeleting={isDeleting}
        deleteError={deleteError}
        onConfirm={confirmDeleteEmployee}
        onClose={closeDeleteModal}
      />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Employees</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Register, manage and assign estate agents & team staff
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Employee
          </button>
        )}
      </div>

      {/* ── Add / Edit Form Modal ── */}
      <EmployeeAddEditModal
        isOpen={showForm}
        editingEmployee={editingEmployee}
        formData={formData}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        onClose={resetForm}
      />

      {/* ── Floating Success Toast Notification (Zero Layout Shift) ── */}
      {deleteSuccessMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-3.5 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-700/80 dark:border-slate-700 text-white rounded-2xl px-5 py-4 shadow-2xl shadow-black/40 max-w-md animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Success</div>
            <div className="text-sm font-semibold text-slate-100 truncate">
              {deleteSuccessMessage}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccessMessage("")}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Employee Table ── */}
      <EmployeeTable
        employees={employees}
        onViewActivity={handleViewActivity}
        onEdit={handleEdit}
        onDelete={openDeleteModal}
      />

      {/* ── Activity History Modal (Audit Log) ── */}
      <EmployeeActivityModal
        employee={activityEmployee}
        activities={activities}
        loadingActivities={loadingActivities}
        onClose={() => setActivityEmployee(null)}
      />
    </div>
  );
};

export default ManageEmployees;
