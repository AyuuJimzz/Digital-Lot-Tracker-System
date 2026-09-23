import { useState, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../config/api";

const useDevAccounts = (getDevHeaders, fetchSystemState) => {
  // Admin Provisioning states
  const [admins, setAdmins] = useState([]);
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState("");
  const [adminError, setAdminError] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState({ text: "", isError: false });

  // Admin Edit & Delete states
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMsg, setEditMsg] = useState({ text: "", isError: false });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Accounts Tab Switcher ("ADMINS" | "EMPLOYEES")
  const [accountTab, setAccountTab] = useState("ADMINS");

  // Employee Directory & Override states
  const [employees, setEmployees] = useState([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [empFirstName, setEmpFirstName] = useState("");
  const [empLastName, setEmpLastName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [empFormLoading, setEmpFormLoading] = useState(false);
  const [empFormError, setEmpFormError] = useState("");
  const [empFormSuccess, setEmpFormSuccess] = useState("");

  // Selected Employee Modal states
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editEmpFirstName, setEditEmpFirstName] = useState("");
  const [editEmpLastName, setEditEmpLastName] = useState("");
  const [editEmpEmail, setEditEmpEmail] = useState("");
  const [empNewPassword, setEmpNewPassword] = useState("");
  const [showEmpNewPassword, setShowEmpNewPassword] = useState(false);
  const [empModalLoading, setEmpModalLoading] = useState(false);
  const [empModalMsg, setEmpModalMsg] = useState({ text: "", isError: false });
  const [showDeleteEmpConfirm, setShowDeleteEmpConfirm] = useState(false);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);

  // Fetch admin accounts list
  const fetchAdmins = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/admins`, {
        headers: getDevHeaders ? getDevHeaders() : {},
        withCredentials: true,
      });
      if (res.data.success) {
        setAdmins(res.data.admins || []);
      }
    } catch (err) {
      // Ignored
    }
  }, [getDevHeaders]);

  // Fetch employee accounts list
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/developer/employees`, {
        headers: getDevHeaders ? getDevHeaders() : {},
        withCredentials: true,
      });
      if (res.data.success) {
        setEmployees(res.data.employees || []);
      }
    } catch (err) {
      // Ignored
    }
  }, [getDevHeaders]);

  // Handle Create Admin Submit
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!adminFullName.trim() || !adminEmail.trim() || !adminPassword) {
      setAdminError("Please fill in all admin account fields");
      return;
    }

    if (adminPassword.length < 6) {
      setAdminError("Password must be at least 6 characters");
      return;
    }

    setAdminLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/create-admin`,
        {
          full_name: adminFullName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
        },
        {
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );
      if (res.data.success) {
        setAdminSuccess(`Admin account created for ${adminEmail.trim()}`);
        setAdminFullName("");
        setAdminEmail("");
        setAdminPassword("");
        fetchAdmins();
        // Refresh logs
        if (fetchSystemState) fetchSystemState();
      }
    } catch (err) {
      setAdminError(err.response?.data?.error || "Failed to create admin account");
    } finally {
      setAdminLoading(false);
    }
  };

  // Reset / Override Admin Password
  const handleResetAdminPassword = async (e) => {
    e.preventDefault();
    if (!selectedAdmin || !resetPasswordVal.trim()) return;
    if (resetPasswordVal.length < 6) {
      setResetMsg({ text: "Password must be at least 6 characters", isError: true });
      return;
    }

    setResetLoading(true);
    setResetMsg({ text: "", isError: false });

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/reset-admin-password`,
        {
          admin_id: selectedAdmin.admin_id,
          new_password: resetPasswordVal,
        },
        {
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setResetMsg({ text: "Password successfully updated in database!", isError: false });
        setResetPasswordVal("");
        // Refresh logs
        if (fetchSystemState) fetchSystemState();
      }
    } catch (err) {
      setResetMsg({ text: err.response?.data?.error || "Failed to update password", isError: true });
    } finally {
      setResetLoading(false);
    }
  };

  // Open Edit Mode for selected admin
  const handleStartEdit = (admin) => {
    setIsEditingAdmin(true);
    setEditFullName(admin.full_name || "");
    setEditEmail(admin.email || "");
    setEditMsg({ text: "", isError: false });
  };

  // Save Edit (Update Full Name & Email)
  const handleSaveEditAdmin = async (e) => {
    e.preventDefault();
    if (!selectedAdmin || !editFullName.trim() || !editEmail.trim()) return;

    setEditLoading(true);
    setEditMsg({ text: "", isError: false });

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/developer/update-admin`,
        {
          admin_id: selectedAdmin.admin_id,
          full_name: editFullName.trim(),
          email: editEmail.trim(),
        },
        {
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setEditMsg({ text: "Profile updated successfully!", isError: false });
        setSelectedAdmin((prev) => ({
          ...prev,
          full_name: editFullName.trim(),
          email: editEmail.trim(),
        }));
        await fetchAdmins();

        // Refresh logs
        if (fetchSystemState) fetchSystemState();
        setTimeout(() => setIsEditingAdmin(false), 1000);
      }
    } catch (err) {
      setEditMsg({ text: err.response?.data?.error || "Failed to update admin profile", isError: true });
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Admin Account
  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;
    setDeleteLoading(true);

    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/developer/delete-admin/${selectedAdmin.admin_id}`,
        {
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setShowDeleteConfirm(false);
        setSelectedAdmin(null);
        await fetchAdmins();

        // Refresh logs
        if (fetchSystemState) fetchSystemState();
      }
    } catch (err) {
      setEditMsg({ text: err.response?.data?.error || "Failed to delete admin account", isError: true });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle Create Employee
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setEmpFormError("");
    setEmpFormSuccess("");

    if (!empFirstName.trim() || !empLastName.trim() || !empEmail.trim() || !empPassword.trim()) {
      setEmpFormError("First Name, Last Name, Email, and Password are required");
      return;
    }

    if (empPassword.trim().length < 6) {
      setEmpFormError("Password must be at least 6 characters long");
      return;
    }

    setEmpFormLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/create-employee`,
        {
          first_name: empFirstName.trim(),
          last_name: empLastName.trim(),
          email: empEmail.trim(),
          password: empPassword.trim(),
        },
        {
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setEmpFormSuccess(res.data.message || "Employee account created successfully!");
        setEmpFirstName("");
        setEmpLastName("");
        setEmpEmail("");
        setEmpPassword("");
        fetchEmployees();

        // Refresh system state logs
        if (fetchSystemState) fetchSystemState();
      }
    } catch (err) {
      setEmpFormError(err.response?.data?.error || "Failed to create employee account");
    } finally {
      setEmpFormLoading(false);
    }
  };

  // Open Employee Modal
  const handleOpenEmployeeModal = (emp) => {
    setSelectedEmployee(emp);
    setEditEmpFirstName(emp.first_name || "");
    setEditEmpLastName(emp.last_name || "");
    setEditEmpEmail(emp.email || "");
    setEmpNewPassword("");
    setShowEmpNewPassword(false);
    setEmpModalMsg({ text: "", isError: false });
    setShowDeleteEmpConfirm(false);
    setIsEditingEmployee(false);
  };

  // Close Employee Modal
  const handleCloseEmployeeModal = () => {
    setSelectedEmployee(null);
    setEmpModalMsg({ text: "", isError: false });
    setShowDeleteEmpConfirm(false);
    setIsEditingEmployee(false);
  };

  // Generate random strong password for employee override
  const handleGenerateRandomEmpPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let generated = "";
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEmpNewPassword(generated);
    setShowEmpNewPassword(true);
  };

  // Reset / Override Employee Password
  const handleResetEmployeePassword = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!empNewPassword.trim() || empNewPassword.trim().length < 6) {
      setEmpModalMsg({ text: "New password must be at least 6 characters long", isError: true });
      return;
    }

    setEmpModalLoading(true);
    setEmpModalMsg({ text: "", isError: false });
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/developer/reset-employee-password`,
        {
          employee_id: selectedEmployee.employee_id,
          newPassword: empNewPassword.trim(),
        },
        {
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setEmpModalMsg({ text: "Employee password successfully overridden!", isError: false });
        setEmpNewPassword("");

        // Refresh system state logs
        if (fetchSystemState) fetchSystemState();
      }
    } catch (err) {
      setEmpModalMsg({
        text: err.response?.data?.error || "Failed to override employee password",
        isError: true,
      });
    } finally {
      setEmpModalLoading(false);
    }
  };

  // Update Employee Profile
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    if (!editEmpFirstName.trim() || !editEmpLastName.trim() || !editEmpEmail.trim()) {
      setEmpModalMsg({ text: "First Name, Last Name, and Email are required", isError: true });
      return;
    }

    setEmpModalLoading(true);
    setEmpModalMsg({ text: "", isError: false });
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/developer/update-employee`,
        {
          employee_id: selectedEmployee.employee_id,
          first_name: editEmpFirstName.trim(),
          last_name: editEmpLastName.trim(),
          email: editEmpEmail.trim(),
        },
        {
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );

      if (res.data.success) {
        setEmpModalMsg({ text: "Employee profile updated successfully!", isError: false });
        setSelectedEmployee({
          ...selectedEmployee,
          first_name: editEmpFirstName.trim(),
          last_name: editEmpLastName.trim(),
          email: editEmpEmail.trim(),
        });
        setIsEditingEmployee(false);
        fetchEmployees();

        // Refresh system state logs
        if (fetchSystemState) fetchSystemState();
      }
    } catch (err) {
      setEmpModalMsg({
        text: err.response?.data?.error || "Failed to update employee details",
        isError: true,
      });
    } finally {
      setEmpModalLoading(false);
    }
  };

  // Delete Employee Account
  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;
    setEmpModalLoading(true);
    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/developer/delete-employee/${selectedEmployee.employee_id}`,
        {
          headers: getDevHeaders ? getDevHeaders() : {},
          withCredentials: true,
        }
      );
      if (res.data.success) {
        handleCloseEmployeeModal();
        fetchEmployees();

        // Refresh system state logs
        if (fetchSystemState) fetchSystemState();
      }
    } catch (err) {
      setEmpModalMsg({
        text: err.response?.data?.error || "Failed to delete employee account",
        isError: true,
      });
    } finally {
      setEmpModalLoading(false);
    }
  };

  return {
    admins,
    setAdmins,
    adminFullName,
    setAdminFullName,
    adminEmail,
    setAdminEmail,
    adminPassword,
    setAdminPassword,
    showAdminPassword,
    setShowAdminPassword,
    adminLoading,
    setAdminLoading,
    adminSuccess,
    setAdminSuccess,
    adminError,
    setAdminError,
    selectedAdmin,
    setSelectedAdmin,
    copiedEmail,
    setCopiedEmail,
    resetPasswordVal,
    setResetPasswordVal,
    showResetPassword,
    setShowResetPassword,
    resetLoading,
    setResetLoading,
    resetMsg,
    setResetMsg,
    isEditingAdmin,
    setIsEditingAdmin,
    editFullName,
    setEditFullName,
    editEmail,
    setEditEmail,
    editLoading,
    setEditLoading,
    editMsg,
    setEditMsg,
    deleteLoading,
    setDeleteLoading,
    showDeleteConfirm,
    setShowDeleteConfirm,
    accountTab,
    setAccountTab,
    employees,
    setEmployees,
    employeeSearchQuery,
    setEmployeeSearchQuery,
    empFirstName,
    setEmpFirstName,
    empLastName,
    setEmpLastName,
    empEmail,
    setEmpEmail,
    empPassword,
    setEmpPassword,
    showEmpPassword,
    setShowEmpPassword,
    empFormLoading,
    setEmpFormLoading,
    empFormError,
    setEmpFormError,
    empFormSuccess,
    setEmpFormSuccess,
    selectedEmployee,
    setSelectedEmployee,
    editEmpFirstName,
    setEditEmpFirstName,
    editEmpLastName,
    setEditEmpLastName,
    editEmpEmail,
    setEditEmpEmail,
    empNewPassword,
    setEmpNewPassword,
    showEmpNewPassword,
    setShowEmpNewPassword,
    empModalLoading,
    setEmpModalLoading,
    empModalMsg,
    setEmpModalMsg,
    showDeleteEmpConfirm,
    setShowDeleteEmpConfirm,
    isEditingEmployee,
    setIsEditingEmployee,
    fetchAdmins,
    fetchEmployees,
    handleCreateAdmin,
    handleResetAdminPassword,
    handleStartEdit,
    handleSaveEditAdmin,
    handleDeleteAdmin,
    handleCreateEmployee,
    handleOpenEmployeeModal,
    handleCloseEmployeeModal,
    handleGenerateRandomEmpPassword,
    handleResetEmployeePassword,
    handleUpdateEmployee,
    handleDeleteEmployee,
  };
};

export default useDevAccounts;
