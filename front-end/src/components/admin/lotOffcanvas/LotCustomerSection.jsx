import React from "react";
import { FileText, LockKeyhole, UserRound } from "lucide-react";
import { exportSingleLotWordDoc } from "../../../utils/exportUtils";
import { getCurrentUser } from "../../../utils/authStorage";

export const LotCustomerSection = ({
  isNonSaleable,
  status,
  selectedLot,
  isAdmin,
  fullName,
  setFullName,
  contactNumber,
  setContactNumber,
  paymentMethod,
  setPaymentMethod,
  email,
  setEmail,
  address,
  setAddress,
  validationErrors,
  setValidationErrors,
  isLockedForUser,
  hasSavedClient,
  agentName,
  agentStatus = "admin",
  isOldRecord = false,
  externalAgentName = "",
  handleExternalAgentNameChange,
  externalAgentSuggestions = [],
  propertyName,
  propertyLocation,
  isSaving = false,
}) => {
  const currentUser = getCurrentUser();
  const currentEmployeeName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim()
    : (currentUser?.name || "");

  const displayAgentName = React.useMemo(() => {
    if (externalAgentName?.trim()) return externalAgentName.trim();
    if (isOldRecord) return "Old Record";
    if (agentName && agentName.toLowerCase() !== "old record" && agentName.toLowerCase() !== "agent") {
      return agentName;
    }
    if (agentName === "Agent" && currentEmployeeName) {
      return currentEmployeeName;
    }
    if (agentName && agentName.toLowerCase() !== "old record") {
      return agentName;
    }
    return isAdmin ? "Admin" : (currentEmployeeName || "Agent");
  }, [externalAgentName, isOldRecord, agentName, currentEmployeeName, isAdmin]);

  const [isExternalAgentChecked, setIsExternalAgentChecked] = React.useState(
    Boolean(externalAgentName?.trim())
  );

  const prevExternalAgentRef = React.useRef(externalAgentName);
  React.useEffect(() => {
    if (externalAgentName?.trim()) {
      setIsExternalAgentChecked(true);
    } else if (prevExternalAgentRef.current?.trim() && !externalAgentName?.trim()) {
      setIsExternalAgentChecked(false);
    }
    prevExternalAgentRef.current = externalAgentName;
  }, [externalAgentName]);

  React.useEffect(() => {
    setIsExternalAgentChecked(Boolean(externalAgentName?.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLot?.lot_id, status]);

  if (isNonSaleable || (status !== "Pending" && status !== "Sold")) {
    return null;
  }

  const isFieldDisabled = isLockedForUser || isSaving;

  const getFieldTitle = () => {
    if (isSaving) return "Saving...";
    if (!isLockedForUser) return "";
    if (status === "Sold") return "Only Admins can edit sold lot details";
    return `Only ${agentName || "the assigned agent"} or Admin can edit this reservation`;
  };

  const isLegacyRecord = Boolean(isOldRecord);

  const isPlaceholder = (val) => String(val || "").trim().toLowerCase() === "to be updated";

  const handleInputFocus = (setter) => (e) => {
    if (isPlaceholder(e.target.value)) {
      setter("");
    }
  };

  const handleInputBlur = (setter) => (e) => {
    if (!e.target.value.trim() && isLegacyRecord) {
      setter("To be updated");
    }
  };

  const getInputClasses = (fieldVal, hasError) => {
    const isPh = isPlaceholder(fieldVal);
    return `min-h-11 w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 dark:bg-slate-700 ${
      isPh
        ? "italic text-gray-400 dark:text-slate-400"
        : "text-gray-900 dark:text-white"
    } ${
      hasError
        ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
        : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
    } ${isFieldDisabled ? "cursor-not-allowed opacity-75" : ""}`;
  };

  return (
    <section aria-label="Buyer details" className="space-y-4 border-t border-gray-200 pt-5 dark:border-slate-700">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Buyer details
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          {status === "Sold" ? "Customer on record for this sale" : "Contact on record for this reservation"}
        </p>
      </div>

      {(agentName || hasSavedClient || isLegacyRecord) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600">
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {status === "Sold" ? "Sold by" : "Reserved by"}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100" title={displayAgentName}>
                  {displayAgentName}
                </p>
                {(externalAgentName?.trim() || agentStatus === "external") && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Referral
                  </span>
                )}
                {!isOldRecord && agentStatus === "inactive" && agentName && !["admin", "old record"].includes(agentName.toLowerCase()) && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Inactive Agent
                  </span>
                )}
              </div>
            </div>
            {isLockedForUser && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                View only
              </span>
            )}
          </div>
          {isLockedForUser && (
            <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
              {status === "Sold"
                ? "Only Admin can update a completed sale."
                : "Only the assigned agent or Admin can update this reservation. Contact them for client changes."}
            </p>
          )}
        </div>
      )}


      {/* Full Name */}
      <div>
        <label
          htmlFor="lot-offcanvas-fullname"
          className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          Full Name
        </label>
        <input
          id="lot-offcanvas-fullname"
          name="customer_name"
          type="text"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            if (validationErrors.fullName) {
              setValidationErrors((prev) => ({ ...prev, fullName: false }));
            }
          }}
          onFocus={handleInputFocus(setFullName)}
          onBlur={handleInputBlur(setFullName)}
          disabled={isFieldDisabled}
          title={getFieldTitle()}
          className={getInputClasses(fullName, validationErrors.fullName)}
          placeholder="Enter customer's full name"
        />
        {validationErrors.fullName && (
          <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Customer full name is required</p>
        )}
      </div>

      {/* Contact & Payment Method */}
      {status === "Sold" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="lot-offcanvas-contact-sold"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Contact Number
            </label>
            <input
              id="lot-offcanvas-contact-sold"
              name="customer_contact"
              type="tel"
              value={contactNumber}
              onChange={(e) => {
                setContactNumber(e.target.value);
                if (validationErrors.contactNumber) {
                  setValidationErrors((prev) => ({ ...prev, contactNumber: false }));
                }
              }}
              onFocus={handleInputFocus(setContactNumber)}
              onBlur={handleInputBlur(setContactNumber)}
              disabled={isFieldDisabled}
              title={isFieldDisabled ? (isSaving ? "Saving..." : "Only Admins can edit sold lot details") : ""}
              className={getInputClasses(contactNumber, validationErrors.contactNumber)}
              placeholder="Enter contact number"
            />
            {validationErrors.contactNumber && (
              <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Contact number is required</p>
            )}
          </div>

          <div>
            <label
              htmlFor="lot-offcanvas-payment-method"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Payment Method
            </label>
            <select
              id="lot-offcanvas-payment-method"
              name="payment_method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={isFieldDisabled}
              title={isFieldDisabled ? (isSaving ? "Saving..." : "Only Admins can edit sold lot payment method") : ""}
              className={`min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-600 dark:bg-slate-700 dark:text-white ${
                isFieldDisabled ? "cursor-not-allowed opacity-75" : ""
              }`}
            >
              <option value="Cash">Cash</option>
              <option value="Installment">Installment</option>
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label
            htmlFor="lot-offcanvas-contact"
            className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Contact Number
          </label>
          <input
            id="lot-offcanvas-contact"
            name="customer_contact"
            type="tel"
            value={contactNumber}
            onChange={(e) => {
              setContactNumber(e.target.value);
              if (validationErrors.contactNumber) {
                setValidationErrors((prev) => ({ ...prev, contactNumber: false }));
              }
            }}
            onFocus={handleInputFocus(setContactNumber)}
            onBlur={handleInputBlur(setContactNumber)}
            disabled={isFieldDisabled}
            title={isFieldDisabled ? (isSaving ? "Saving..." : "Only Admins can edit sold lot details") : ""}
            className={getInputClasses(contactNumber, validationErrors.contactNumber)}
            placeholder="Enter contact number"
          />
          {validationErrors.contactNumber && (
            <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Contact number is required</p>
          )}
        </div>
      )}

      {/* Email */}
      <div>
        <label
          htmlFor="lot-offcanvas-email"
          className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Email
        </label>
        <input
          id="lot-offcanvas-email"
          name="customer_email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (validationErrors.email) {
              setValidationErrors((prev) => ({ ...prev, email: false }));
            }
          }}
          onFocus={handleInputFocus(setEmail)}
          onBlur={handleInputBlur(setEmail)}
          disabled={isFieldDisabled}
          title={isFieldDisabled ? (isSaving ? "Saving..." : "Only Admins can edit sold lot details") : ""}
          className={getInputClasses(email, validationErrors.email)}
          placeholder="Enter email address"
        />
        {validationErrors.email && (
          <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Email address is required</p>
        )}
      </div>

      {/* Address */}
      <div>
        <label
          htmlFor="lot-offcanvas-address"
          className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Address
        </label>
        <input
          id="lot-offcanvas-address"
          name="customer_address"
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            if (validationErrors.address) {
              setValidationErrors((prev) => ({ ...prev, address: false }));
            }
          }}
          onFocus={handleInputFocus(setAddress)}
          onBlur={handleInputBlur(setAddress)}
          disabled={isFieldDisabled}
          title={isFieldDisabled ? (isSaving ? "Saving..." : "Only Admins can edit sold lot details") : ""}
          className={getInputClasses(address, validationErrors.address)}
          placeholder="Enter customer's address"
        />
        {validationErrors.address && (
          <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Customer address is required</p>
        )}
      </div>

      {/* Outside Sales Agent Commission Credit Toggle */}
      {isFieldDisabled ? (
        externalAgentName?.trim() ? (
          <div className="flex items-center justify-between rounded-xl border border-blue-200/70 bg-blue-50/70 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Referred by:</span>
            <span className="font-semibold text-blue-700 dark:text-blue-300">{externalAgentName.trim()}</span>
          </div>
        ) : null
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-900/40 space-y-2">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="lot-offcanvas-external-agent-checkbox"
                checked={isExternalAgentChecked}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsExternalAgentChecked(checked);
                  if (!checked && handleExternalAgentNameChange) {
                    handleExternalAgentNameChange("");
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Referred by outside sales agent
              </span>
            </div>
            {isExternalAgentChecked && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Referral Credit
              </span>
            )}
          </label>

          {isExternalAgentChecked && (
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
              <input
                id="lot-offcanvas-external-agent"
                name="external_agent_name"
                type="text"
                list="external-agents-datalist"
                value={externalAgentName || ""}
                onChange={(e) => handleExternalAgentNameChange && handleExternalAgentNameChange(e.target.value)}
                placeholder="Outside agent full name (e.g. Juan dela Cruz)"
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
              <datalist id="external-agents-datalist">
                {(externalAgentSuggestions || []).map((agent) => (
                  <option key={agent} value={agent} />
                ))}
              </datalist>
              {externalAgentName?.trim() && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  ✓ Sale & commission assigned to &ldquo;{externalAgentName.trim()}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {hasSavedClient && (
        <button
          type="button"
          onClick={() =>
            exportSingleLotWordDoc(
              {
                ...selectedLot,
                status: status || selectedLot?.status,
                agent_name: displayAgentName,
                agent_status: externalAgentName?.trim()
                  ? "external"
                  : isOldRecord
                  ? "legacy"
                  : agentStatus,
                payment_method: paymentMethod || selectedLot?.payment_method,
                customer: {
                  ...selectedLot?.customer,
                  full_name: fullName || selectedLot?.customer?.full_name,
                  contact_number: contactNumber || selectedLot?.customer?.contact_number,
                  email: email || selectedLot?.customer?.email,
                  address: address || selectedLot?.customer?.address,
                },
              },
              propertyName || selectedLot?.property_name,
              propertyLocation || selectedLot?.location
            )
          }
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
          title="Download official quotation document (.doc)"
        >
          <FileText className="h-4 w-4 text-blue-500" aria-hidden="true" />
          Download Word quotation <span className="font-normal opacity-70">(.doc)</span>
        </button>
      )}
    </section>
  );
};

export default LotCustomerSection;
