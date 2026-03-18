import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

const EmployeeDashboard = () => {
	const [showPasswordChange, setShowPasswordChange] = useState(false);

  // Fetch employees
  const fetchEmployees = useCallback(() => {
    setLoading(true);
    axios
      .get("http://localhost:5000/api/employees", {
        withCredentials: true,
      })
      .then((response) => {
        setEmployees(
          Array.isArray(response.data)
            ? response.data
            : response.data.employees || [],
        );
        setLoading(false);
      })
      .catch((err) => {
        if (err.response?.status === 403) window.location.href = "/forbidden";
        else if (err.response?.status === 401)
          window.location.href = "/access-denied";
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, []);

  // Check session
  useEffect(() => {
    axios
      .get("http://localhost:5000/api/auth/check-session", {
        withCredentials: true,
      })
      .then((response) => {
        if (
          response.data.role !== "employee" &&
          response.data.role !== "admin"
        ) {
          window.location.href = "/forbidden";
        } else {
          setIsAuthorized(true);
          fetchEmployees();
        }
      })
      .catch(() => {
        window.location.href = "/access-denied";
      });
  }, [fetchEmployees]);

  const handleLogout = async () => {
    try {
      await axios.post(
        "http://localhost:5000/api/auth/logout",
        {},
        {
          withCredentials: true,
        },
      );
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/";
    }
  };

  const handleAddEmployee = async () => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/employees",
        {
          first_name: "New",
          last_name: "Employee",
          email: `new${Date.now()}@example.com`,
          password: "123456",
        },
        {
          withCredentials: true,
        },
      );

      if (response.status === 200) fetchEmployees();
    } catch (err) {
      if (err.response?.status === 403) window.location.href = "/forbidden";
      else console.error("Failed to add employee:", err);
    }
  };

			{/* Recent Sales Table */}
			<div className="pt-2">
				<EmployeeTransactions />
			</div>
		</div>
	);
};

export default EmployeeDashboard;
