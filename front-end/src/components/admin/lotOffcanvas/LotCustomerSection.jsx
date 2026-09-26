import React from "react";
import { FileText, LockKeyhole, UserRound } from "lucide-react";
import { exportSingleLotWordDoc } from "../../../utils/exportUtils";

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
  propertyName,
  propertyLocation,
}) => {
  if (isNonSaleable || (status !== "Pending" && status !== "Sold")) {
    return null;
  }

  const getFieldTitle = () => {
    if (!isLockedForUser) return "";
    if (status === "Sold") return "Only Admins can edit sold lot details";
    return `Only ${agentName || "the assigned agent"} or Admin can edit this reservation`;
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

      {(isAdmin || isLockedForUser) && (agentName || hasSavedClient) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600">
              <UserRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {status === "Sold" ? "Sale credited to" : "Reservation managed by"}
              </p>
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100" title={agentName || "Admin"}>
                {agentName || "Admin"}
              </p>
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
          disabled={isLockedForUser}
          title={getFieldTitle()}
          className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
            validationErrors.fullName
              ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
              : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
          } ${isLockedForUser ? "cursor-not-allowed bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300" : ""}`}
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
              disabled={isLockedForUser}
              title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
              className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
                validationErrors.contactNumber
                  ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
                  : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
              } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
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
              disabled={isLockedForUser}
              title={isLockedForUser ? "Only Admins can edit sold lot payment method" : ""}
              className={`min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-slate-600 dark:bg-slate-700 dark:text-white ${
                isLockedForUser ? "cursor-not-allowed opacity-75" : ""
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
            disabled={isLockedForUser}
            title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
            className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
              validationErrors.contactNumber
                ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
                : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
            } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
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
          disabled={isLockedForUser}
          title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
          className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
            validationErrors.email
              ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
              : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
          } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
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
          disabled={isLockedForUser}
          title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
          className={`min-h-11 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-700 dark:text-white ${
            validationErrors.address
              ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
              : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
          } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
          placeholder="Enter customer's address"
        />
        {validationErrors.address && (
          <p className="text-[11px] text-rose-500 mt-0.5 font-medium">Customer address is required</p>
        )}
      </div>

      {hasSavedClient && (
        <button
          type="button"
          onClick={() =>
            exportSingleLotWordDoc(
              { ...selectedLot, agent_name: agentName },
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
