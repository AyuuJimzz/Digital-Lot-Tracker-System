import React from "react";
import { Layers } from "lucide-react";
import { getThemeForSubdivision } from "../../utils/subdivisionColors";

const ProjectDashboardSwitcher = ({
  subdivisions = [],
  selectedProject = "all",
  onSelectProject,
  customColors,
  totalEstateLots = 0,
}) => {
  const getSubdivisionShortName = (name) => {
    if (!name) return "Project";
    if (name.includes("3896") || name.toLowerCase().includes("abilay")) return "Abilay Norte";
    if (name.includes("2018") || name.toLowerCase().includes("pulo")) return "Pulo Maestra";
    if (name.includes("204") || name.toLowerCase().includes("nanga")) return "Nanga Guimbal";
    if (name.includes("6275") || name.toLowerCase().includes("lambuyao")) return "Lambuyao Oton";
    return name.replace(/Cadastre/i, "").trim();
  };

  return (
    <section className="space-y-4" aria-labelledby="dashboard-overview-title">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 id="dashboard-overview-title" className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Dashboard Overview
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose a project to view its inventory and sales summary.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Project scope
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => onSelectProject("all")}
            aria-pressed={selectedProject === "all"}
            className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:focus-visible:outline-slate-500 ${
              selectedProject === "all"
                ? "bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-white dark:border dark:border-slate-700/80"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
            }`}
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            <span>All Projects</span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                selectedProject === "all"
                  ? "bg-white/20 text-white dark:bg-slate-700/80 dark:text-slate-200"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {totalEstateLots.toLocaleString()}
            </span>
          </button>

          {subdivisions.map((subdiv, idx) => {
            const theme = getThemeForSubdivision(subdiv, idx, customColors);
            const isSelected = String(selectedProject) === String(subdiv.property_id);
            const shortName = getSubdivisionShortName(subdiv.property_name);

            return (
              <button
                key={subdiv.property_id}
                type="button"
                onClick={() => onSelectProject(isSelected ? "all" : subdiv.property_id)}
                aria-pressed={isSelected}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:focus-visible:outline-slate-500 ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-white dark:border dark:border-slate-700/80"
                    : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: theme.color }}
                />
                <span>{shortName}</span>
                <span className={`text-xs tabular-nums ${isSelected ? "text-slate-300 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
                  {Number(subdiv.availableLots || 0).toLocaleString()} available
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProjectDashboardSwitcher;
