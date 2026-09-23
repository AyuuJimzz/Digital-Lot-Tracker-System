import React from "react";
import { Edit, Eye, EyeOff, Trash2 } from "lucide-react";

const PropertyTable = ({
  properties = [],
  onEdit,
  onToggleStatus,
  onDelete,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 shadow rounded-lg border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Property List ({properties.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 dark:divide-slate-800">
          <thead className="bg-gray-50 dark:bg-slate-800/80">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider w-14 hidden sm:table-cell">
                #
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Property Name
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Location
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Total Lots
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Status
              </th>
              <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell whitespace-nowrap">
                Created At
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
            {properties.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-400"
                >
                  No properties found
                </td>
              </tr>
            ) : (
              properties.map((property, index) => (
                <tr
                  key={property.property_id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-slate-400 hidden sm:table-cell">
                    #{index + 1}
                  </td>
                  <td className="px-4 py-3.5 text-left text-sm font-bold text-gray-900 dark:text-white">
                    {property.property_name}
                  </td>
                  <td className="px-4 py-3.5 text-left text-sm text-gray-600 dark:text-slate-300">
                    {property.location}
                  </td>
                  <td className="px-4 py-3.5 text-center text-sm font-semibold text-gray-700 dark:text-slate-200">
                    {property.total_lots}
                  </td>
                  <td className="px-4 py-3.5 text-center whitespace-nowrap">
                    <span
                      className={`text-xs font-semibold ${
                        property.status === "active"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {property.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-sm text-gray-500 dark:text-slate-400 hidden lg:table-cell whitespace-nowrap">
                    {new Date(property.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-medium whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(property)}
                        className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                        title="Edit Property"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onToggleStatus(property.property_id, property.status)
                        }
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          property.status === "active"
                            ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300"
                            : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300"
                        }`}
                        title={
                          property.status === "active"
                            ? "Deactivate Property"
                            : "Activate Property"
                        }
                      >
                        {property.status === "active" ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(property)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                        title="Delete Property"
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
  );
};

export default PropertyTable;
