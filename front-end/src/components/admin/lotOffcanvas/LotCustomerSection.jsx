import React from "react";
import { FileText } from "lucide-react";
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

  const isPendingCustomerLocked =
    status === "Pending" &&
    selectedLot?.status === "Pending" &&
    email &&
    !isAdmin;

  return (
    <div className="space-y-4">
      {/* Full Name */}
      <div>
        <label
          htmlFor="lot-offcanvas-fullname"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Full Name
        </label>
        {isPendingCustomerLocked ? (
          <input
            id="lot-offcanvas-fullname"
            name="customer_name"
            type="text"
            value={fullName}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
            title="Full name cannot be changed while lot is pending"
          />
        ) : (
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
            title={isLockedForUser ? "Only Admins can edit sold lot details" : ""}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 dark:text-white dark:bg-slate-700 transition-colors ${
              validationErrors.fullName
                ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
                : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
            } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
            placeholder="Enter customer's full name"
          />
        )}
        {validationErrors.fullName && (
          <p className="text-[11px] text-rose-500 mt-1 font-medium">Customer full name is required</p>
        )}
      </div>

      {/* Contact & Payment Method */}
      {status === "Sold" ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="lot-offcanvas-contact-sold"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 dark:text-white dark:bg-slate-700 transition-colors ${
                validationErrors.contactNumber
                  ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
                  : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
              } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
              placeholder="Enter contact number"
            />
            {validationErrors.contactNumber && (
              <p className="text-[11px] text-rose-500 mt-1 font-medium">Contact number is required</p>
            )}
          </div>

          <div>
            <label
              htmlFor="lot-offcanvas-payment-method"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
              className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white dark:bg-slate-700 ${
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
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Contact Number
          </label>
          {isPendingCustomerLocked ? (
            <input
              id="lot-offcanvas-contact"
              name="customer_contact"
              type="tel"
              value={contactNumber}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
              title="Contact number cannot be changed while lot is pending"
            />
          ) : (
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
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 dark:text-white dark:bg-slate-700 transition-colors ${
                validationErrors.contactNumber
                  ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
                  : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
              } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
              placeholder="Enter contact number"
            />
          )}
          {validationErrors.contactNumber && (
            <p className="text-[11px] text-rose-500 mt-1 font-medium">Contact number is required</p>
          )}
        </div>
      )}

      {/* Email */}
      <div>
        <label
          htmlFor="lot-offcanvas-email"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Email
        </label>
        {isPendingCustomerLocked ? (
          <div className="relative">
            <input
              id="lot-offcanvas-email"
              name="customer_email"
              type="email"
              value={email}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed"
              title="Email cannot be changed while lot is pending"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
        ) : (
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
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-gray-900 dark:text-white dark:bg-slate-700 transition-colors ${
              validationErrors.email
                ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
                : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
            } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
            placeholder="Enter email address"
          />
        )}
        {validationErrors.email && (
          <p className="text-[11px] text-rose-500 mt-1 font-medium">Email address is required</p>
        )}
      </div>

      {/* Address */}
      <div>
        <label
          htmlFor="lot-offcanvas-address"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Address
        </label>
        {isPendingCustomerLocked ? (
          <input
            id="lot-offcanvas-address"
            name="customer_address"
            type="text"
            value={address}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 cursor-not-allowed text-sm"
            title="Address cannot be changed while lot is pending"
          />
        ) : (
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
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm text-gray-900 dark:text-white dark:bg-slate-700 transition-colors ${
              validationErrors.address
                ? "border-rose-500 focus:ring-rose-500/30 ring-1 ring-rose-500/30"
                : "border-gray-300 dark:border-slate-600 focus:ring-blue-500 focus:border-transparent"
            } ${isLockedForUser ? "cursor-not-allowed opacity-75" : ""}`}
            placeholder="Enter customer's address"
          />
        )}
        {validationErrors.address && (
          <p className="text-[11px] text-rose-500 mt-1 font-medium">Customer address is required</p>
        )}
      </div>

      {/* Compact Official Microsoft Word Document Download */}
      {hasSavedClient && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() =>
              exportSingleLotWordDoc(
                { ...selectedLot, agent_name: agentName },
                propertyName || selectedLot?.property_name,
                propertyLocation || selectedLot?.location
              )
            }
            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700/70 dark:text-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Export Word Quotation (.doc)</span>
          </button>
        </div>
      )}

      {status === "Pending" && selectedLot?.status === "Pending" && email && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Customer information is locked while lot is pending. Change status to Available to modify.
        </p>
      )}
    </div>
  );
};

export default LotCustomerSection;
