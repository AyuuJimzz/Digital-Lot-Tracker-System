import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  Download,
  X,
  FileSpreadsheet,
  Building2,
  Calendar,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Wallet,
  TrendingUp,
  FileDown,
} from "lucide-react";
import { API_BASE_URL } from "../../config/api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createMonthlySalesXlsx } from "../../utils/monthlySalesXlsx";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const MonthlySalesSheetModal = ({
  isOpen,
  onClose,
  initialYear = new Date().getFullYear(),
  initialMonth = new Date().getMonth() + 1,
  availableYears = [],
}) => {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportError, setExportError] = useState(null);
  const sheetContentRef = useRef(null);

  const [activeProjectTab, setActiveProjectTab] = useState("all");
  const [collapsedProjects, setCollapsedProjects] = useState({});
  const [showAllRowsMap, setShowAllRowsMap] = useState({});

  const toggleCollapse = (propId) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [propId]: !prev[propId],
    }));
  };

  const toggleShowAllRows = (propId) => {
    setShowAllRowsMap((prev) => ({
      ...prev,
      [propId]: !prev[propId],
    }));
  };

  useEffect(() => {
    setSelectedYear(initialYear);
    setSelectedMonth(initialMonth);
  }, [initialYear, initialMonth]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("authToken");
        const authConfig = {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        };

        const res = await axios.get(`${API_BASE_URL}/api/lots/monthly-sales-sheet`, {
          ...authConfig,
          params: {
            year: selectedYear,
            month: selectedMonth,
          },
        });

        if (!isCancelled) {
          setReportData(res.data);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to load monthly sales sheet:", err);
          setError("Failed to load monthly sales sheet data. Please try again.");
          setLoading(false);
        }
      }
    };

    fetchReport();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, selectedYear, selectedMonth]);

  const yearOptions = useMemo(() => {
    const yearsSet = new Set([selectedYear, new Date().getFullYear(), ...(availableYears || [])]);
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [selectedYear, availableYears]);

  const monthName = MONTH_NAMES[selectedMonth - 1] || `Month ${selectedMonth}`;

  const filteredProjects = useMemo(() => {
    if (!reportData?.projects) return [];
    if (activeProjectTab === "all") return reportData.projects;
    return reportData.projects.filter((p) => String(p.property_id) === String(activeProjectTab));
  }, [reportData, activeProjectTab]);

  const displaySummary = useMemo(() => {
    if (!reportData?.summary || activeProjectTab === "all") return reportData?.summary || null;

    const selectedProject = reportData.projects?.find(
      (project) => String(project.property_id) === String(activeProjectTab)
    );
    if (!selectedProject) return reportData.summary;

    return {
      ...reportData.summary,
      total_lots_sold: selectedProject.subtotal.lots_sold,
      overall_amount: selectedProject.subtotal.total_amount,
      overall_tcp: selectedProject.subtotal.total_tcp,
      project_summaries: reportData.summary.project_summaries?.filter(
        (project) => String(project.property_id) === String(activeProjectTab)
      ) || [],
    };
  }, [reportData, activeProjectTab]);

  const exportScopeLabel = activeProjectTab === "all"
    ? "All projects"
    : (filteredProjects[0]?.property_name || "Selected project");
  const exportScopeFileName = exportScopeLabel.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");

  useEffect(() => {
    if (
      activeProjectTab !== "all" &&
      reportData?.projects &&
      !reportData.projects.some((project) => String(project.property_id) === String(activeProjectTab))
    ) {
      setActiveProjectTab("all");
    }
  }, [reportData, activeProjectTab]);

  const handleExportExcel = () => {
    if (!reportData || isExportingExcel) return;

    setIsExportingExcel(true);
    setExportError(null);
    try {
      const workbookBytes = createMonthlySalesXlsx({
        monthName,
        selectedYear,
        scopeLabel: exportScopeLabel,
        projects: filteredProjects,
        summary: displaySummary,
      });
      const blob = new Blob([workbookBytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Golden_Dragon_Monthly_Sales_${monthName}_${selectedYear}_${exportScopeFileName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportErr) {
      console.error("Excel export error:", exportErr);
      setExportError("Unable to create the Excel report. Please try again.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // 1-Click Direct PDF File Exporter — saves PDF directly to Downloads folder
  const handleExportPDF = () => {
    if (!reportData || isExportingPDF) return;
    setIsExportingPDF(true);
    setExportError(null);

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;

      // 1. Corporate Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59);
      doc.text("GOLDEN DRAGON ESTATE DEVELOPER COMPANY", pageWidth / 2, 13, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("MONTHLY SALES REPORT", pageWidth / 2, 20, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Period: ${monthName} ${selectedYear}  |  Scope: ${exportScopeLabel}`, pageWidth / 2, 26, { align: "center" });

      // Horizontal divider
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(margin, 31, pageWidth - margin, 31);

      // 2. Compact overall totals, without the duplicated project-summary table.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text("MONTHLY SUMMARY", margin, 36);

      const summaryCards = [
        ["TOTAL LOTS SOLD", String(displaySummary?.total_lots_sold || 0)],
        ["SALES OF THE MONTH", `PHP ${formatCurrency(displaySummary?.overall_amount)}`],
        ["TCP", `PHP ${formatCurrency(displaySummary?.overall_tcp)}`],
      ];
      const cardGap = 5;
      const cardWidth = (pageWidth - margin * 2 - cardGap * 2) / summaryCards.length;
      summaryCards.forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + cardGap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, 39, cardWidth, 20, 1.5, 1.5, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x + 4, 46);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(value, x + 4, 53);
      });

      let currentY = 67;

      // 3. Project Detail Tables
      const projectsToExport = filteredProjects;

      projectsToExport.forEach((proj) => {
        const estimatedProjectHeight = 14 + Math.max(1, proj.records.length) * 7;
        if (currentY + estimatedProjectHeight > pageHeight - margin - 4) {
          doc.addPage();
          currentY = margin;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        const projectTitle = doc.splitTextToSize(
          (proj.property_name || "Subdivision").toUpperCase(),
          pageWidth - margin * 2
        );
        doc.text(projectTitle, margin, currentY);
        currentY += projectTitle.length * 5;

        const records = proj.records.map((r) => [
          String(r.item_number),
          r.buyer || "-",
          String(r.block || "-"),
          String(r.lot || "-"),
          r.date_of_purchase || "-",
          String(r.mode_of_payment || "").trim().toLowerCase() === "cash" ? "CASH" : "INSTALLMENT",
          `PHP ${formatCurrency(r.amount)}`,
          `PHP ${formatCurrency(r.tcp)}`,
          r.agent || "Admin",
        ]);

        const foot = [
          [
            "",
            { content: "TOTAL LOTS SOLD", styles: { halign: "left" } },
            { content: String(proj.subtotal.lots_sold), styles: { halign: "center" } },
            "",
            "",
            { content: "TOTAL", styles: { halign: "center" } },
            `PHP ${formatCurrency(proj.subtotal.total_amount)}`,
            `PHP ${formatCurrency(proj.subtotal.total_tcp)}`,
            "",
          ],
        ];

        autoTable(doc, {
          startY: currentY + 2,
          margin: { left: margin, right: margin, bottom: 15 },
          head: [["", "BUYER", "BLK", "LOT", "DATE OF PURCHASE", "MODE OF PAYMENT", "AMOUNT", "TCP", "AGENT"]],
          body: records,
          foot: foot,
          theme: "grid",
          tableLineColor: [226, 232, 240],
          tableLineWidth: 0.1,
          headStyles: {
            fillColor: [31, 41, 55],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 7 },
            1: { halign: "left", cellWidth: 58 },
            2: { halign: "center", cellWidth: 14 },
            3: { halign: "center", cellWidth: 10 },
            4: { halign: "center", cellWidth: 31 },
            5: { halign: "center", cellWidth: 39 },
            6: { halign: "right", cellWidth: 35 },
            7: { halign: "right", cellWidth: 38 },
            8: { halign: "center", cellWidth: 41 },
          },
          footStyles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: "bold",
            fontSize: 8,
            halign: "right",
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 1.5,
            overflow: "linebreak",
          },
          showHead: "everyPage",
        });

        currentY = (doc.lastAutoTable?.finalY || currentY) + 8;
      });

      // Compact preparation and approval details after all project totals.
      const approvalBlockHeight = 22;
      if (currentY + approvalBlockHeight > pageHeight - 15) {
        doc.addPage();
        currentY = margin + 5;
      } else {
        currentY += 5;
      }

      const approvalColumnWidth = (pageWidth - margin * 2) / 3;
      [
        ["Prepared by:", "Denisse P. Gadot"],
        ["Verified by:", "John Rowen E. Cosca"],
        ["Approved by:", "Erika Freud D. Orleans"],
      ].forEach(([label, name], index) => {
        const x = margin + approvalColumnWidth * index;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x, currentY + 4);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(name, x, currentY + 11, { maxWidth: approvalColumnWidth - 10 });
      });

      // 4. Page numbering & footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Golden Dragon Estate Management System - Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          margin,
          pageHeight - 6
        );
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
      }

      // 5. Trigger Direct PDF Download
      doc.save(`Golden_Dragon_Monthly_Sales_${monthName}_${selectedYear}_${exportScopeFileName}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      setExportError(
        "Unable to create the PDF report: " + (err?.message || "Error generating document")
      );
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[1100] flex h-screen w-screen bg-slate-950/80 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Printable / PDF Style Sheet Injection */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 10mm 10mm 12mm 10mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-monthly-sheet, #printable-monthly-sheet * {
            visibility: visible;
          }
          #printable-monthly-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          .print-force-row {
            display: table-row !important;
          }
          .print-black-text {
            color: black !important;
          }
          .page-break-after {
            page-break-after: auto;
          }
        }
      `}</style>

      <div
        className="flex min-h-0 h-full w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-none transition-all duration-200 dark:border-slate-800 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar — Non-printable */}
        <div className="no-print p-3 sm:p-4 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-gray-50/80 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                  Monthly Sales Report
                </h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Official statement of sales, collections, and total contract price
              </p>
            </div>
          </div>

          {/* Controls: Month/Year Dropdowns & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Month Picker */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <select
                aria-label="Select report month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent font-medium text-gray-900 dark:text-white focus:outline-none cursor-pointer pr-1"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Picker */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs shadow-sm">
              <select
                aria-label="Select report year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-medium text-gray-900 dark:text-white focus:outline-none cursor-pointer pr-1"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Export PDF Button */}
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={loading || !reportData || isExportingPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer shadow-sm"
              title="Export as PDF"
              aria-label="Export as PDF"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Export formatted Excel workbook */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading || !reportData || isExportingExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 transition cursor-pointer shadow-sm"
              title="Download a formatted Excel workbook"
              aria-label="Download Excel"
            >
              {isExportingExcel ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing Excel...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Excel</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
            {exportError && (
              <span role="alert" className="basis-full text-right text-[11px] text-red-600 dark:text-red-400">
                {exportError}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Document Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="font-medium">Generating Monthly Sales Report for {monthName} {selectedYear}...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-80" />
              <p>{error}</p>
            </div>
          ) : !reportData?.projects || reportData.projects.length === 0 ? (
            <div className="py-20 text-center text-gray-500 dark:text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                No Sales Recorded for {monthName} {selectedYear}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                There are no new closed accounts or verified transactions in this month. Try selecting another month or year from the dropdown above.
              </p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 lg:flex-row">
              <aside className="no-print w-full shrink-0 self-start rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:w-60">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">Projects</h3>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    {reportData.projects.length} total
                  </span>
                </div>

                <nav aria-label="Filter report by project" className="mt-3 grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain lg:max-h-[calc(100vh-18rem)] lg:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => setActiveProjectTab("all")}
                    aria-pressed={activeProjectTab === "all"}
                    className={`w-full rounded-md px-2.5 py-2 text-left text-xs font-medium transition ${
                      activeProjectTab === "all"
                        ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    All projects
                  </button>
                  {reportData.projects.map((project) => {
                    const isActive = activeProjectTab === String(project.property_id);
                    return (
                      <button
                        key={project.property_id}
                        type="button"
                        onClick={() => setActiveProjectTab(String(project.property_id))}
                        aria-pressed={isActive}
                        className={`w-full truncate rounded-md px-2.5 py-2 text-left text-xs font-medium transition ${
                          isActive
                            ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                        title={project.property_name}
                      >
                        {project.property_name}
                      </button>
                    );
                  })}
                </nav>

                <div className="mt-3 border-t border-gray-200 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const allCollapsed = filteredProjects.every((project) => collapsedProjects[project.property_id]);
                      const next = {};
                      filteredProjects.forEach((project) => {
                        next[project.property_id] = !allCollapsed;
                      });
                      setCollapsedProjects(next);
                    }}
                    className="w-full rounded-md px-2 py-2 text-left text-xs text-gray-600 transition hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    {filteredProjects.every((project) => collapsedProjects[project.property_id])
                      ? "Expand all tables"
                      : "Collapse all tables"}
                  </button>
                </div>
              </aside>

              <main id="printable-monthly-sheet" ref={sheetContentRef} className="min-w-0 flex-1 space-y-6">
              {/* Official Document Banner Header */}
              <div className="text-center pb-5 border-b border-gray-200 dark:border-slate-800">
                <div className="inline-flex items-center gap-2 mb-1">
                  <Building2 className="w-5 h-5 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Golden Dragon Estate Developer Company
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white uppercase">
                  Monthly Sales Report
                </h1>
                <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-gray-100 dark:bg-slate-800 rounded-full text-xs font-semibold text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>Period: {monthName.toUpperCase()} {selectedYear}</span>
                </div>
              </div>

              {/* TOP EXECUTIVE SUMMARY — Modern, clean, professional KPI cards + breakdown */}
              <div className="space-y-4 pb-6 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                    MONTHLY SUMMARY
                  </h3>
                </div>

                {/* Executive summary metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* KPI 1: Total Lots Sold */}
                  <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                        TOTAL LOTS SOLD
                      </p>
                      <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white mt-1">
                        {displaySummary?.total_lots_sold || 0}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                        Lots sold during this month
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>

                  {/* KPI 2: Total Collections */}
                  <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                        SALES OF THE MONTH
                      </p>
                      <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white mt-1">
                        ₱ {formatCurrency(displaySummary?.overall_amount)}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                        Total sales amount for this month
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>

                  {/* KPI 3: Total Contract Price (TCP) */}
                  <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400">
                        TCP
                      </p>
                      <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white mt-1">
                        ₱ {formatCurrency(displaySummary?.overall_tcp)}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                        Total contract price of lots sold
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Project Tables — Clean, executive design */}
              {filteredProjects.map((proj) => {
                const isCollapsed = !!collapsedProjects[proj.property_id];
                const showAll = !!showAllRowsMap[proj.property_id];
                const hasManyRows = proj.records.length > 25;

                return (
                  <div
                    key={proj.property_id}
                    className="overflow-hidden page-break-after rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    {/* Project section header */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(proj.property_id)}
                      aria-expanded={!isCollapsed}
                      aria-controls={`project-table-${proj.property_id}`}
                      className="flex w-full items-center justify-between gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="truncate text-sm font-semibold uppercase text-gray-900 dark:text-white">
                          {proj.property_name}
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-gray-500 dark:text-slate-400">
                          {proj.subtotal.lots_sold} {proj.subtotal.lots_sold === 1 ? "LOT" : "LOTS"} SOLD
                        </span>
                      </span>

                      <span className="no-print inline-flex shrink-0 items-center gap-1 text-xs font-medium text-gray-500 dark:text-slate-400">
                        <span>{isCollapsed ? "Show rows" : "Hide rows"}</span>
                        {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                      </span>
                    </button>

                    {/* Table View */}
                    <div id={`project-table-${proj.property_id}`} className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse font-sans">
                        {/* Column Headers */}
                        <thead>
                          <tr
                            className={`bg-gray-100/70 dark:bg-slate-800/40 text-gray-600 dark:text-slate-400 font-semibold text-[11px] tracking-wide border-b border-gray-200 dark:border-slate-700 ${
                              isCollapsed ? "hidden print-force-row" : ""
                            }`}
                          >
                            <th className="py-2.5 px-2 w-10 text-center" aria-label="Row number"></th>
                            <th className="py-2.5 px-3 text-left">BUYER</th>
                            <th className="py-2.5 px-2 w-14 text-center">BLK</th>
                            <th className="py-2.5 px-2 w-14 text-center">LOT</th>
                            <th className="py-2.5 px-3 w-36 text-center">DATE OF PURCHASE</th>
                            <th className="py-2.5 px-3 w-40 text-center">MODE OF PAYMENT</th>
                            <th className="py-2.5 px-3 w-36 text-right">AMOUNT</th>
                            <th className="py-2.5 px-3 w-36 text-right">TCP</th>
                            <th className="py-2.5 px-3 w-36 text-center">AGENT</th>
                          </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody
                          className={`divide-y divide-gray-100 dark:divide-slate-800/80 text-gray-900 dark:text-slate-100 ${
                            isCollapsed ? "hidden print-force-row" : ""
                          }`}
                        >
                          {proj.records.map((r, i) => {
                            const isHiddenOnScreen = !showAll && hasManyRows && i >= 25;
                            return (
                              <tr
                                key={r.transaction_id || i}
                                className={`hover:bg-gray-50/80 dark:hover:bg-slate-800/30 transition-colors ${
                                  isHiddenOnScreen ? "hidden print-force-row" : ""
                                }`}
                              >
                                <td className="py-2 px-2 text-center font-mono text-xs text-gray-400 dark:text-slate-500">
                                  {r.item_number}
                                </td>
                                <td className="py-2 px-3 font-semibold uppercase text-gray-900 dark:text-white">
                                  {r.buyer}
                                </td>
                                <td className="py-2 px-2 text-center font-mono text-gray-700 dark:text-slate-300">
                                  {r.block}
                                </td>
                                <td className="py-2 px-2 text-center font-mono text-gray-700 dark:text-slate-300">
                                  {r.lot}
                                </td>
                                <td className="py-2 px-3 text-center whitespace-nowrap text-gray-600 dark:text-slate-300">
                                  {r.date_of_purchase}
                                </td>
                            <td className="py-2 px-3 text-center text-gray-600 dark:text-slate-400">
                              <span className="text-[11px] font-medium uppercase">
                                {String(r.mode_of_payment || "").trim().toLowerCase() === "cash" ? "CASH" : "INSTALLMENT"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-medium text-gray-700 dark:text-slate-300">
                                  ₱ {formatCurrency(r.amount)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-medium text-gray-900 dark:text-white">
                                  ₱ {formatCurrency(r.tcp)}
                                </td>
                                <td className="py-2 px-3 text-center text-gray-600 dark:text-slate-400 uppercase text-xs">
                                  {r.agent}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Show More / Show Less Row for Large Data on Screen */}
                          {hasManyRows && !isCollapsed && (
                            <tr className="no-print bg-gray-50/50 dark:bg-slate-800/40 font-medium text-xs">
                              <td colSpan={9} className="py-2.5 px-3 text-center">
                                {showAll ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="text-gray-500 dark:text-slate-400">
                                Showing all {proj.records.length} accounts
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleShowAllRows(proj.property_id)}
                                      className="px-2.5 py-0.5 rounded text-blue-700 dark:text-blue-300 hover:underline cursor-pointer font-medium text-[11px]"
                                    >
                                      Show first 25
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="text-gray-600 dark:text-slate-400">
                                      Showing first 25 of <strong>{proj.records.length}</strong> accounts
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleShowAllRows(proj.property_id)}
                                      className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer font-medium text-xs"
                                    >
                                      View all {proj.records.length}
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>

                        {/* Subtotal Row */}
                        <tfoot>
                          <tr
                            className={`bg-gray-50 dark:bg-slate-800/60 text-gray-900 dark:text-white font-semibold text-xs border-t border-gray-200 dark:border-slate-700 ${
                              isCollapsed ? "hidden print-force-row" : ""
                            }`}
                          >
                            <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider">
                              <span className="font-semibold text-xs">
                                TOTAL LOTS SOLD
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono">
                              {proj.subtotal.lots_sold}
                            </td>
                            <td colSpan={2}></td>
                            <td className="py-2.5 px-3 text-center uppercase tracking-wider font-extrabold text-gray-500 dark:text-slate-400">
                              TOTAL
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-sm text-gray-900 dark:text-white">
                              ₱ {formatCurrency(proj.subtotal.total_amount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-sm text-gray-900 dark:text-white">
                              ₱ {formatCurrency(proj.subtotal.total_tcp)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Report footer */}
              <div className="pt-6 mt-6 border-t border-gray-200 dark:border-slate-800 text-[11px] text-gray-500 dark:text-slate-400">
                <div>
                  <p>Generated via Golden Dragon Estate Management System</p>
                  <p>Date Generated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
              </div>
              </main>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlySalesSheetModal;
