import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Edit, Trash2, Plus, X } from "lucide-react";

const inputCls =
  "w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-amber-500 focus:border-amber-500 dark:focus:border-amber-500 transition-colors";

const ManageEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
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
    address: "",
  });

  const navigate = useNavigate();

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/employees", {
        withCredentials: true,
      });
      setEmployees(response.data);
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
        ? `http://localhost:5000/api/employees/${editingEmployee.employee_id}`
        : "http://localhost:5000/api/employees";
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
      address: employee.address || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (employeeId) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/employees/${employeeId}`, {
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
      address: "",
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Employees</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add New Employee
            </>
          )}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 shadow rounded-lg border border-gray-200 dark:border-slate-800 p-6 transition-colors duration-300">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingEmployee ? "Edit Employee" : "Add New Employee"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "First Name *", name: "first_name", type: "text", required: true },
                { label: "Last Name *", name: "last_name", type: "text", required: true },
                { label: "Email *", name: "email", type: "email", required: true },
                { label: "Date of Birth", name: "date_of_birth", type: "date" },
                { label: "Phone Number", name: "phone_number", type: "tel" },
              ].map(({ label, name, type, required }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    name={name}
                    value={formData[name]}
                    onChange={handleInputChange}
                    required={required}
                    className={inputCls}
                  />
                </div>
              ))}

              {!editingEmployee && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Gender
                </label>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows="3"
                className={inputCls}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none transition-colors"
              >
                {editingEmployee ? "Update Employee" : "Add Employee"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md shadow-sm focus:outline-none transition-colors"
              >
                Cancel
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
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800">
              <tr>
                {["ID", "Name", "Email", "Phone", "Gender", "Date of Birth", "Actions"].map(
                  (col) => (
                    <th
                      key={col}
                      className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider ${col === "Actions" ? "text-right" : "text-left"}`}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
              {employees.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-sm text-gray-500 dark:text-slate-400"
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-300">
                      {employee.employee_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {employee.first_name} {employee.last_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {employee.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {employee.phone_number || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {employee.gender || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                      {employee.date_of_birth
                        ? new Date(employee.date_of_birth).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(employee)}
                        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(employee.employee_id)}
                        className="inline-flex items-center text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
