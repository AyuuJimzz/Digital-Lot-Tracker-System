import React from "react";

const RecentTransactions = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Recent Transactions
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transaction ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lot Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                #001
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                Example1
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                A-1
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                2000
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  Completed
                </span>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                #002
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                Example2
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                B-08
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                2000
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  Pending
                </span>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                #003
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                Example3
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                C-15
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                2000
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  Completed
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentTransactions;
