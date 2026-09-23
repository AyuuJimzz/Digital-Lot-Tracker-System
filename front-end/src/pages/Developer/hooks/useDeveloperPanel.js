import { useEffect } from "react";
import useDevSystem from "./useDevSystem";
import useDevDatabase from "./useDevDatabase";
import useDevAccounts from "./useDevAccounts";

/**
 * useDeveloperPanel - Aggregator hook for the Developer Control Panel
 * 
 * Composed of 3 modular domain hooks:
 * - useDevSystem: PIN auth, maintenance mode, system logs, kill switch, API & env health, map diagnostics
 * - useDevDatabase: DB backup, live DB inspector, table explorer, test data purge, demo seed generator
 * - useDevAccounts: Admin provisioning, password override, and Employee directory management
 */
const useDeveloperPanel = () => {
  const system = useDevSystem();
  const accounts = useDevAccounts(system.getDevHeaders, system.fetchSystemState);
  const database = useDevDatabase(system.getDevHeaders, system.fetchSystemState, accounts.fetchEmployees);

  const { isAuthorized, fetchMapDiagnostics } = system;
  const { fetchAdmins, fetchEmployees } = accounts;
  const { fetchDbStats } = database;

  // On successful developer authorization, trigger data loading across domain hooks
  useEffect(() => {
    if (isAuthorized) {
      fetchAdmins();
      fetchEmployees();
      fetchDbStats();
      fetchMapDiagnostics();
    }
  }, [isAuthorized, fetchAdmins, fetchEmployees, fetchDbStats, fetchMapDiagnostics]);

  return {
    ...system,
    ...database,
    ...accounts,
  };
};

export default useDeveloperPanel;
