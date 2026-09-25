import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

export function useRecentTransactions(role) {
  return useQuery({
    queryKey: ["recent-transactions", role],
    queryFn: async () => {
      const token = localStorage.getItem("authToken");
      const config = {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      const [txnRes, empRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/transactions`, config),
        axios.get(`${API_BASE_URL}/api/employees`, config).catch((error) => {
          if (role === "employee") return { data: [] };
          throw error;
        }),
      ]);
      const empNameMap = {};
      (empRes.data || []).forEach((employee) => {
        empNameMap[employee.employee_id] = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
      });
      return { transactions: txnRes.data || [], empNameMap };
    },
    staleTime: 60 * 1000,
  });
}
