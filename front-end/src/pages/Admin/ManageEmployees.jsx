import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Edit,
  Trash2,
  Plus,
  X,
  History,
  Clock,
  CheckCircle2,
  Calendar,
  KeyRound,
} from "lucide-react";

const inputCls =
  "w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-800/90 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all";

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

  const navigate = useNavigate();

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/employees`, {
        withCredentials: true,
      });
      setEmployees(response.data);
      try { sessionStorage.setItem("employeesCache", JSON.stringify(response.data)); } catch (e) {}
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
      const res = await axios.get(
        `${API_BASE_URL}/api/employees/${employee.employee_id}/activities`,
        { withCredentials: true }
      );
      setActivities(res.data.activities || []);
    } catch (err) {
      console.error("Failed to fetch employee activity history:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return "Recently";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Recently";
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1)
      return "Yesterday at " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const getActivityIcon = (act) => {
    if (act.type === "SALE") {
      return <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />;
    }
    return <Clock className="w-3.5 h-3.5 text-amber-400" />;
  };

  const getEmployeeActivityStatus = (employee) => {
    if (employee.status === "inactive") {
      return {
        label: "Disabled",
        badgeCls: "bg-slate-800/60 text-slate-400 border-slate-700/50",
        dotCls: "bg-slate-500",
        pulse: false,
        title: "Account is disabled",
      };
    }

    const lastActiveTimestamp = employee.last_login || employee.updated_at || employee.created_at;
    if (!lastActiveTimestamp) {
      return {
        label: "Online Now",
        badgeCls: "bg-emerald-500/10 text-emerald-400 dark:text-emerald-300 border-emerald-500/20",
        dotCls: "bg-emerald-400",
        pulse: true,
        title: "Recently active",
      };
    }

    const lastActiveDate = new Date(lastActiveTimestamp);
    if (isNaN(lastActiveDate.getTime())) {
      return {
        label: "Online Now",
        badgeCls: "bg-emerald-500/10 text-emerald-400 dark:text-emerald-300 border-emerald-500/20",
        dotCls: "bg-emerald-400",
        pulse: true,
        title: "Active now",
      };
    }

    const diffMinutes = Math.floor((Date.now() - lastActiveDate.getTime()) / (1000 * 60));

    // 1. Online now (within 15 minutes)
    if (diffMinutes <= 15) {
      return {
        label: "Online Now",
        badgeCls: "bg-emerald-500/10 text-emerald-400 dark:text-emerald-300 border-emerald-500/20",
        dotCls: "bg-emerald-400",
        pulse: true,
        title: "Active on the platform now",
      };
    }

    // 2. Active X mins ago (< 60 mins)
    if (diffMinutes < 60) {
      return {
        label: `Active ${diffMinutes}m ago`,
        badgeCls: "bg-slate-800/70 text-slate-300 border-slate-700/60",
        dotCls: "bg-blue-400/80",
        pulse: false,
        title: `Last active ${diffMinutes} minutes ago`,
      };
    }

    const diffHours = Math.floor(diffMinutes / 60);
    // 3. Active X hours ago (< 24 hrs)
    if (diffHours < 24) {
      return {
        label: `Active ${diffHours}h ago`,
        badgeCls: "bg-slate-800/70 text-slate-300 border-slate-700/60",
        dotCls: "bg-blue-400/80",
        pulse: false,
        title: `Last active ${diffHours} hours ago`,
      };
    }

    const diffDays = Math.floor(diffHours / 24);
    // 4. Active Yesterday
    if (diffDays === 1) {
      return {
        label: "Active Yesterday",
        badgeCls: "bg-slate-800/70 text-slate-300 border-slate-700/60",
        dotCls: "bg-slate-400",
        pulse: false,
        title: "Last active yesterday",
      };
    }

    // 5. Active X days ago (<= 30 days)
    if (diffDays <= 30) {
      return {
        label: `Active ${diffDays}d ago`,
        badgeCls: "bg-slate-800/70 text-slate-300 border-slate-700/60",
        dotCls: "bg-slate-400",
        pulse: false,
        title: `Last active ${diffDays} days ago`,
      };
    }

    // 6. Inactive (30+ days)
    return {
      label: "Inactive (30+ days)",
      badgeCls: "bg-slate-900/40 text-slate-500 border-slate-800",
      dotCls: "bg-slate-600",
      pulse: false,
      title: "No activity for over 30 days",
    };
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingEmployee
        ? `${API_BASE_URL}/api/employees/${editingEmployee.employee_id}`
        : `${API_BASE_URL}/api/employees`;
      if (editingEmployee) {
        await axios.put(url, formData, { withCredentials: true });
        alert("Employee updated successfully");
      } else {
        const res = await axios.post(url, formData, { withCredentials: true });
        alert(
          res.data?.message ||
            "Employee added successfully. An email with login credentials has been sent."
        );
      }
      await fetchEmployees();
      resetForm();
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to save employee");
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

  const handleDelete = async (employeeId) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/employees/${employeeId}`, {
        withCredentials: true,
      });
      await fetchEmployees();
      alert("Employee deleted successfully");
    } catch (err) {
      alert(err.message || "Failed to delete employee");
    }
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

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-slate-400">
        Loading employees...
      </div>
    );
  if (error) return <div className="text-red-600 dark:text-red-400 p-4">Error: {error}</div>;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Employees</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Register, manage and assign estate agents & team staff</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 rounded-lg shadow-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-blue-500/20 transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Employee
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-gray-200 dark:border-slate-800 p-6 max-w-4xl mx-auto transition-all">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingEmployee ? "Edit Employee Details" : "Add New Employee"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Fill in the employee credentials and profile information
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Juan"
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="e.g. Dela Cruz"
                  required
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="e.g. juan@goldendragon.com"
                  required
                  autoComplete="new-email"
                  className={inputCls}
                />
              </div>

              {!editingEmployee && (
                <div className="md:col-span-2 p-3.5 bg-gray-50/80 dark:bg-slate-800/40 border border-gray-200/80 dark:border-slate-700/60 rounded-xl flex items-start gap-3 text-xs">
                  <div className="p-1.5 rounded-lg bg-gray-200/60 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400 shrink-0 mt-0.5">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-slate-200">
                      Auto-Generated Password & Email Dispatch
                    </p>
                    <p className="text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed font-normal">
                      A secure temporary password will be automatically generated and emailed to this staff member. They will be prompted to set their own private password upon their first login.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md shadow-blue-500/25 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              >
                {editingEmployee ? "Update Employee" : "Create & Send Credentials"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 shadow rounded-lg border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Employee List ({employees.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-slate-800">
            <thead className="bg-gray-50 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-14 hidden sm:table-cell">#</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Employee Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Email Address</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Lots Handled</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell whitespace-nowrap">Date Joined</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400"
                  >
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((employee, idx) => (
                  <tr
                    key={employee.employee_id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-500 dark:text-slate-400 hidden sm:table-cell">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3.5 text-left text-sm font-bold text-gray-900 dark:text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-blue-500/20 uppercase shrink-0">
                          {(employee.first_name?.[0] || "") + (employee.last_name?.[0] || "")}
                        </div>
                        <div className="font-bold text-gray-900 dark:text-white capitalize leading-snug">
                          {employee.first_name} {employee.last_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-slate-300">
                      {employee.email}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md border ${
                            (employee.lots_sold || 0) > 0
                              ? "bg-rose-500/10 text-rose-300 border-rose-500/25"
                              : "bg-slate-800/50 text-slate-400 border-slate-700/50"
                          }`}
                          title="Total Lots Sold by Employee"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              (employee.lots_sold || 0) > 0 ? "bg-rose-400" : "bg-slate-500"
                            }`}
                          ></span>
                          {employee.lots_sold || 0} Sold
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md border ${
                            (employee.lots_pending || 0) > 0
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
                              : "bg-slate-800/50 text-slate-400 border-slate-700/50"
                          }`}
                          title="Total Lots Reserved / Pending"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              (employee.lots_pending || 0) > 0 ? "bg-amber-400" : "bg-slate-500"
                            }`}
                          ></span>
                          {employee.lots_pending || 0} Pending
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {(() => {
                        const statusInfo = getEmployeeActivityStatus(employee);
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${statusInfo.badgeCls}`}
                            title={statusInfo.title}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotCls} ${
                                statusInfo.pulse ? "animate-pulse" : ""
                              }`}
                            ></span>
                            {statusInfo.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm text-gray-500 dark:text-slate-400 hidden lg:table-cell whitespace-nowrap">
                      {employee.created_at
                        ? new Date(employee.created_at).toLocaleDateString()
                        : "8/31/2026"}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewActivity(employee)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          title="View Activity History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          title="Edit Employee"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee.employee_id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Delete Employee"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity History Modal (Audit Log) */}
      {activityEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-sm font-bold shadow-md uppercase shrink-0">
                  {(activityEmployee.first_name?.[0] || "") + (activityEmployee.last_name?.[0] || "")}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white capitalize flex items-center gap-2">
                    {activityEmployee.first_name} {activityEmployee.last_name}
                    <span className="text-xs font-normal text-gray-400 dark:text-slate-500">
                      (ID #{activityEmployee.employee_id})
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {activityEmployee.email} • Sales & Reservation History
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivityEmployee(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content / Timeline */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {loadingActivities ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs">Loading sales & reservation history...</span>
                </div>
              ) : activities.length === 0 ? (
                <div className="py-12 text-center text-gray-400 dark:text-slate-500">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-400" />
                  <p className="text-sm font-medium">No sales or reservations recorded yet</p>
                  <p className="text-xs mt-1">Lot sales and reservations handled by this agent will appear here.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-slate-800">
                  {activities.map((act) => (
                    <div key={act.id} className="relative group">
                      {/* Timeline Dot Icon */}
                      <div className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                        {getActivityIcon(act)}
                      </div>
                      {/* Card Content */}
                      <div className="bg-gray-50/70 dark:bg-slate-800/50 hover:bg-gray-100/80 dark:hover:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700/60 rounded-xl p-3.5 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                            {act.title}
                          </h4>
                          <span className="text-[11px] font-medium text-gray-400 dark:text-slate-400 whitespace-nowrap">
                            {formatRelativeTime(act.timestamp)}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 leading-relaxed">
                            {act.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 mt-2 font-mono">
                          <Calendar className="w-3 h-3 opacity-60" />
                          {new Date(act.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex justify-end">
              <button
                onClick={() => setActivityEmployee(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageEmployees;
