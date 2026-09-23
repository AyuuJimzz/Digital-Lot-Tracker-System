import { useEffect } from "react";
import useDevSystem from "./useDevSystem";
import useDevDatabase from "./useDevDatabase";
import useDevAccounts from "./useDevAccounts";
import useDevMessenger from "./useDevMessenger";

/**
 * useDeveloperPanel - Aggregator hook for the Developer Control Panel
 * 
 * Composed of 4 modular domain hooks:
 * - useDevSystem: PIN auth, maintenance mode, system logs, kill switch, API & env health, map diagnostics
 * - useDevDatabase: DB backup, live DB inspector, table explorer, test data purge, demo seed generator
 * - useDevAccounts: Admin provisioning, password override, and Employee directory management
 * - useDevMessenger: Messenger alerts dispatch, recipient scanning/toggle/dismiss/restore, alert filters
 */
const useDeveloperPanel = () => {
  const system = useDevSystem();
  const accounts = useDevAccounts(system.getDevHeaders, system.fetchSystemState);
  const database = useDevDatabase(system.getDevHeaders, system.fetchSystemState, accounts.fetchEmployees);
  const messenger = useDevMessenger(system.getDevHeaders, system.fetchSystemState, system.fetchEnvHealth);

  const { isAuthorized, fetchMapDiagnostics } = system;
  const { fetchAdmins, fetchEmployees } = accounts;
  const { fetchDbStats } = database;
  const { fetchAlertFilters } = messenger;

  // On successful developer authorization, trigger data loading across domain hooks
  useEffect(() => {
    if (isAuthorized) {
      fetchAdmins();
      fetchEmployees();
      fetchDbStats();
      fetchMapDiagnostics();
      fetchAlertFilters();
    }
  }, [isAuthorized, fetchAdmins, fetchEmployees, fetchDbStats, fetchMapDiagnostics, fetchAlertFilters]);

  return {
    ...system,
    ...database,
    ...accounts,
    ...messenger,
  };
};

export default useDeveloperPanel;
