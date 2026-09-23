import React from "react";
import useDeveloperPanel from "./hooks/useDeveloperPanel";

// Shell components
import DeveloperPinGuard from "./components/DeveloperPinGuard";
import DeveloperSidebar from "./components/DeveloperSidebar";
import DeveloperHeader from "./components/DeveloperHeader";

// Sub-components: Tabs
import SystemTab from "./tabs/SystemTab";
import EndpointsTab from "./tabs/EndpointsTab";
import EnvHealthTab from "./tabs/EnvHealthTab";
import DatabaseTab from "./tabs/DatabaseTab";
import MapDiagnosticsTab from "./tabs/MapDiagnosticsTab";
import AccountsTab from "./tabs/AccountsTab";

// Sub-components: Modals
import AdminDetailModal from "./modals/AdminDetailModal";
import EmployeeDetailModal from "./modals/EmployeeDetailModal";
import TableDataExplorerModal from "./modals/TableDataExplorerModal";
import PurgeDataModal from "./modals/PurgeDataModal";
import DemoDataModal from "./modals/DemoDataModal";
import KillSwitchModal from "./modals/KillSwitchModal";
import CategoryLogModal from "./modals/CategoryLogModal";

const DeveloperPanel = () => {
  const dev = useDeveloperPanel();

  // ──────── PIN GUARD / AUTH CHECK SCREEN ────────
  if (dev.isCheckingAuth || !dev.isAuthorized) {
    return <DeveloperPinGuard {...dev} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* ── Fixed Sidebar Navigation ── */}
      <DeveloperSidebar {...dev} />

      {/* ── Main Content Area ── */}
      <main className="flex-1 lg:pl-72 flex flex-col min-w-0 min-h-screen bg-slate-950">
        {/* ── Top Header Bar ── */}
        <DeveloperHeader {...dev} />

        {/* ── Dynamic View Body Container ── */}
        <div className="p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto space-y-8">
          {dev.activeSidebarTab === "SYSTEM" && <SystemTab {...dev} />}
          {dev.activeSidebarTab === "ENDPOINTS" && <EndpointsTab {...dev} />}
          {dev.activeSidebarTab === "ENV" && <EnvHealthTab {...dev} />}
          {dev.activeSidebarTab === "DATABASE" && <DatabaseTab {...dev} />}
          {dev.activeSidebarTab === "MAP" && <MapDiagnosticsTab {...dev} />}
          {dev.activeSidebarTab === "ACCOUNTS" && <AccountsTab {...dev} />}
        </div>
      </main>

      {/* ── Interactive Modals ── */}
      <AdminDetailModal {...dev} />
      <EmployeeDetailModal {...dev} />
      <TableDataExplorerModal {...dev} />
      <PurgeDataModal {...dev} />
      <DemoDataModal {...dev} />
      <KillSwitchModal {...dev} />
      <CategoryLogModal {...dev} />
    </div>
  );
};

export default DeveloperPanel;
