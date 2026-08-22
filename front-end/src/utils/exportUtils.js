// front-end/src/utils/exportUtils.js

let cachedLogoBase64 = null;

/**
 * Loads the company logo as a base64 string so it renders offline inside Microsoft Word.
 */
async function getLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const res = await fetch("/golden-dragon-logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result;
        resolve(reader.result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Logo base64 load error:", err);
    return null;
  }
}

/**
 * Downloads a Microsoft Word document (.doc) with clean header-integrated meta and large logo.
 * Opens natively in Microsoft Word, Google Docs, and WPS Office.
 */
function downloadWordDoc(htmlContent, filename) {
  const fullHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${filename}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: A4 portrait;
            margin: 0.6in 0.7in 0.6in 0.7in;
          }
          body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            color: #0f172a;
            line-height: 1.35;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 10pt;
          }
          /* INTEGRATED TOP HEADER */
          table.header-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 2pt solid #0f172a;
            padding-bottom: 8pt;
            margin-bottom: 14pt;
          }
          .company-title {
            font-size: 14pt;
            font-weight: bold;
            color: #0f172a;
            letter-spacing: 0.4pt;
            text-transform: uppercase;
            margin: 0;
            line-height: 1.2;
          }
          .company-sub {
            font-size: 8.5pt;
            color: #64748b;
            margin-top: 2pt;
          }
          .header-meta {
            text-align: right;
            font-size: 8.5pt;
            color: #334155;
            line-height: 1.4;
          }

          /* SECTION TITLE */
          .section-title {
            font-size: 9.5pt;
            font-weight: bold;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.4pt;
            padding: 3pt 0;
            margin: 14pt 0 4pt 0;
            border-bottom: 1pt solid #cbd5e1;
          }

          /* DETAIL KEY-VALUE TABLE */
          table.detail-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8pt;
          }
          table.detail-table td {
            padding: 5pt 7pt;
            font-size: 9.5pt;
            vertical-align: middle;
            border-bottom: 0.5pt solid #f1f5f9;
          }
          .label-col {
            width: 28%;
            color: #64748b;
            font-weight: 500;
          }
          .value-col {
            width: 72%;
            color: #0f172a;
            font-weight: 600;
          }

          /* FOOTER */
          .footer-note {
            border-top: 1pt solid #e2e8f0;
            padding-top: 8pt;
            margin-top: 24pt;
            text-align: center;
            font-size: 8pt;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;

  const blob = new Blob(["\uFEFF" + fullHtml], { type: "application/msword;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports an official Microsoft Word (.doc) quotation sheet with
 * top-integrated document details and prominent logo.
 *
 * @param {Object} lot - The selected lot object
 * @param {string} propertyName - Property name
 * @param {string} propertyLocation - Property Location
 */
export async function exportSingleLotWordDoc(lot, propertyName = "", propertyLocation = "") {
  if (!lot) return;

  const actualPropertyName =
    propertyName ||
    lot.property_name ||
    lot.property?.property_name ||
    lot.property?.name ||
    "Golden Dragon Estate";

  const actualLocation =
    propertyLocation ||
    lot.location ||
    lot.property_location ||
    lot.property?.location ||
    actualPropertyName;

  const lotNum = lot.lot_number || `Lot #${lot.lot_id}`;
  const cleanLotFilename = lotNum.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Quotation_${cleanLotFilename}_${new Date().toISOString().split("T")[0]}.doc`;

  const logoBase64 = await getLogoBase64();

  const dateNow = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
  });

  const status = (lot.status || "Available").toUpperCase();
  const customer = lot.customer || {};

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" width="58" height="58" style="display:block; margin-right:12pt;" alt="Golden Dragon Logo" />`
    : "";

  const paymentRowHtml =
    lot.status === "Sold" && lot.payment_method
      ? `<tr>
          <td class="label-col">Payment Method:</td>
          <td class="value-col">${lot.payment_method}</td>
        </tr>`
      : "";

  const htmlContent = `
    <!-- HEADER: LARGER LOGO & TITLE (LEFT) + DOCUMENT META (RIGHT) -->
    <table class="header-table">
      <tr>
        ${
          logoBase64
            ? `<td style="width: 65px; vertical-align: middle; border: none; padding: 0 10pt 0 0;">${logoHtml}</td>`
            : ""
        }
        <td style="vertical-align: middle; border: none; padding: 0;">
          <div class="company-title">Golden Dragon Real Estate Corp.</div>
          <div class="company-sub">Digital Lot Tracker System &bull; Official Lot Quotation</div>
        </td>
        <td class="header-meta" style="vertical-align: middle; border: none; padding: 0;">
          <div><strong>Doc Ref:</strong> GDC-QUO-${lot.lot_id || "00"}-${new Date().getFullYear()}</div>
          <div><strong>Date Issued:</strong> ${dateNow}</div>
        </td>
      </tr>
    </table>

    <!-- 1. PROPERTY & LOT SPECIFICATIONS -->
    <div class="section-title">I. Property & Lot Details</div>
    <table class="detail-table">
      <tr>
        <td class="label-col">Property / Estate:</td>
        <td class="value-col">${actualPropertyName}</td>
      </tr>
      <tr>
        <td class="label-col">Property Location:</td>
        <td class="value-col">${actualLocation}</td>
      </tr>
      <tr>
        <td class="label-col">Lot Designation:</td>
        <td class="value-col"><strong>${lot.lot_number || "N/A"}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Total Lot Area:</td>
        <td class="value-col"><strong>${lot.area_sqm ? Number(lot.area_sqm).toFixed(2) + " sq.m." : "N/A"}</strong></td>
      </tr>
      <tr>
        <td class="label-col">System Lot ID:</td>
        <td class="value-col">LOT-${lot.lot_id || "N/A"}</td>
      </tr>
      <tr>
        <td class="label-col">Lot Status:</td>
        <td class="value-col"><strong>${status}</strong></td>
      </tr>
      ${paymentRowHtml}
    </table>

    <!-- 2. CLIENT INFORMATION -->
    <div class="section-title">II. Client Information</div>
    <table class="detail-table">
      <tr>
        <td class="label-col">Client Full Name:</td>
        <td class="value-col"><strong>${customer.full_name || "N/A"}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Contact Number:</td>
        <td class="value-col">${customer.contact_number || "N/A"}</td>
      </tr>
      <tr>
        <td class="label-col">Email Address:</td>
        <td class="value-col">${customer.email || "N/A"}</td>
      </tr>
      <tr>
        <td class="label-col">Registered Address:</td>
        <td class="value-col">${customer.address || "N/A"}</td>
      </tr>
    </table>

    <!-- FOOTER -->
    <div class="footer-note">
      This document is officially generated from the Golden Dragon Digital Lot Tracker System for client inquiry record reference.
    </div>
  `;

  downloadWordDoc(htmlContent, filename);
}
