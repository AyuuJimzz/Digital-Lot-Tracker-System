import { API_BASE_URL } from "../../config/api";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Edit, Trash2, Plus, X } from "lucide-react";

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
    date_of_birth: "",
    gender: "",
    phone_number: "",
  });

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
      } else {
        await axios.post(url, formData, { withCredentials: true });
      }
      await fetchEmployees();
      resetForm();
      alert(editingEmployee ? "Employee updated successfully" : "Employee added successfully");
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to save employee");
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      password: "",
      date_of_birth: employee.date_of_birth ? employee.date_of_birth.split("T")[0] : "",
      gender: employee.gender || "",
      phone_number: employee.phone_number || "",
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
      date_of_birth: "",
      gender: "",
      phone_number: "",
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

              <div>
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleInputChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="e.g. 0912 345 6789"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className={inputCls}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {!editingEmployee && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter secure password"
                    required
                    autoComplete="new-password"
                    className={inputCls}
                  />
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
                {editingEmployee ? "Update Employee" : "Add Employee"}
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
          <table className="w-full divide-y divide-gray-200 dark:divide-slate-700 table-auto">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider w-12 hidden sm:table-cell">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Gender</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Date of Birth</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-3 py-4 text-center text-sm text-gray-500 dark:text-slate-400"
                  >
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr
                    key={employee.employee_id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-300 hidden sm:table-cell">
                      {employee.employee_id}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white break-words">
                      {employee.first_name} {employee.last_name}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500 dark:text-slate-400 break-all">
                      {employee.email}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {employee.phone_number || "N/A"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400 hidden lg:table-cell">
                      {employee.gender || "N/A"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400 hidden lg:table-cell">
                      {employee.date_of_birth
                        ? new Date(employee.date_of_birth).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="inline-flex items-center justify-center text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee.employee_id)}
                          className="inline-flex items-center justify-center text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                          title="Delete"
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
    </div>
  );
};

export default ManageEmployees;
