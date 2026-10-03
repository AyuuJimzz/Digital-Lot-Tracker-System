/**
 * Shared Authoritative Agent Attribution Logic
 * Resolves whether an agent should be classified as 'admin', 'legacy', 'active', or 'inactive'.
 *
 * Rules:
 * 1. Legacy: employeeId is missing/null AND agentName is 'Old Record' or 'Legacy Record'.
 * 2. Admin: employeeId is missing/null AND agentName is either empty or 'Admin'.
 * 3. Active: employeeStatus is 'active'.
 * 4. Inactive: employeeStatus is 'inactive', OR employee was deleted (status is null/missing) while agent was a credited individual.
 */
function classifyAgentStatus({ employeeId, agentName, employeeStatus }) {
  const trimmed = String(agentName || "").trim().toLowerCase();
  if (trimmed === "old record" || trimmed === "legacy record") {
    return "legacy";
  }

  const isNoEmployee = !employeeId || employeeId === null;

  const isExplicitAdmin = isNoEmployee && (!agentName || trimmed === "admin");

  if (isExplicitAdmin) {
    return "admin";
  }
  if (employeeStatus && String(employeeStatus).trim().toLowerCase() === "active") {
    return "active";
  }
  return "inactive";
}

module.exports = {
  classifyAgentStatus,
};
