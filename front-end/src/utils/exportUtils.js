// front-end/src/utils/exportUtils.js

let cachedLogoBase64Clean = null;

/**
 * Loads the company logo as a clean raw base64 string for embedding inside MHTML Word documents.
 */
async function getLogoBase64Clean() {
  if (cachedLogoBase64Clean) return cachedLogoBase64Clean;
  try {
    const res = await fetch("/golden-dragon-logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string" && reader.result.includes(",")) {
          const rawBase64 = reader.result.split(",")[1];
          cachedLogoBase64Clean = rawBase64;
          resolve(rawBase64);
        } else {
          resolve(null);
        }
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
 * Downloads a Microsoft Word document (.doc) in MHTML MIME-multipart format.
 * Embeds the company logo directly inside the file so Microsoft Word displays
 * the logo 100% reliably in both Local & Live without being blocked by Protected View.
 */
function downloadWordDoc(htmlContent, filename, logoBase64) {
  const boundary = "----=_NextPart_GoldenDragon_Estate_Doc";

  const fullHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
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
        margin: 0.45in 0.65in;
      }
      body {
        font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
        color: #0f172a;
        line-height: 1.25;
        background-color: #ffffff;
        margin: 0;
        padding: 0;
        font-size: 9.5pt;
        mso-pagination: widow-orphan;
      }
      /* INTEGRATED TOP HEADER */
      table.header-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 12pt;
        page-break-inside: avoid;
      }
      .company-title {
        font-size: 13pt;
        font-weight: bold;
        color: #0f172a;
        letter-spacing: 0.25pt;
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
        font-size: 9pt;
        font-weight: bold;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.4pt;
        padding: 3pt 0;
        margin: 12pt 0 4pt 0;
        border-bottom: 1pt solid #d9dee7;
        page-break-after: avoid;
      }

      /* DETAIL KEY-VALUE TABLE */
      table.detail-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 7pt;
        page-break-inside: avoid;
      }
      table.detail-table td {
        padding: 6pt 8pt;
        font-size: 9pt;
        vertical-align: middle;
        border-bottom: 0.5pt solid #f1f5f9;
        word-wrap: break-word;
      }
      .label-col {
        width: 34%;
        color: #64748b;
        font-weight: 500;
      }
      .value-col {
        width: 66%;
        color: #0f172a;
        font-weight: 600;
      }

      /* FOOTER */
      .footer-note {
        padding-top: 6pt;
        margin-top: 16pt;
        text-align: center;
        font-size: 8.5pt;
        line-height: 1.35;
        color: #64748b;
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    ${htmlContent}
  </body>
</html>`;

  let documentContent;
  if (logoBase64) {
    // Pack into official MHTML MIME multipart so Word displays the embedded image directly
    documentContent = [
      `MIME-Version: 1.0`,
      `Content-Type: multipart/related; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      fullHtml,
      ``,
      `--${boundary}`,
      `Content-Type: image/png`,
      `Content-Transfer-Encoding: base64`,
      `Content-Location: golden-dragon-logo.png`,
      ``,
      logoBase64,
      ``,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    documentContent = fullHtml;
  }

  const blob = new Blob(["\uFEFF" + documentContent], {
    type: "application/msword;charset=utf-8;",
  });
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

  const escapeHtml = (value) => String(value ?? "N/A").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

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

  const dateNow = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
  });

  const rawStatus = lot.status || "Available";
  const status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
  const isReservedOrSold = ["pending", "sold"].includes(rawStatus.toLowerCase());
  const customer = lot.customer || {};

  // Agent attribution
  let agentDisplayName = "Admin";
  if (lot.agent_status === "legacy" || (lot.agent_name || "").toLowerCase() === "old record") {
    agentDisplayName = "Old Record";
  } else if (lot.agent_status === "external") {
    agentDisplayName = `${lot.agent_name} (Referral)`;
  } else if (lot.agent_status === "inactive" && lot.agent_name && lot.agent_name.toLowerCase() !== "admin") {
    agentDisplayName = `${lot.agent_name} (Inactive Agent)`;
  } else if (lot.agent_name) {
    agentDisplayName = lot.agent_name;
  }

  const logoBase64 = await getLogoBase64Clean();

  // Reference the embedded MHTML image location directly
  const logoHtml = `<img src="golden-dragon-logo.png" width="56" height="56" style="width:56px; height:56px; display:block; border-radius:50%;" alt="Golden Dragon Logo" />`;
  const propertyNameHtml = escapeHtml(actualPropertyName);
  const locationHtml = escapeHtml(actualLocation);
  const lotNumberHtml = escapeHtml(lot.lot_number || "N/A");
  const lotIdHtml = escapeHtml(lot.lot_id || "N/A");
  const statusHtml = escapeHtml(status);
  const agentHtml = escapeHtml(agentDisplayName);

  const paymentRowHtml =
    lot.payment_method
      ? `<tr>
          <td class="label-col">Payment Method:</td>
          <td class="value-col">${escapeHtml(lot.payment_method)}</td>
        </tr>`
      : "";

  const formatPeso = (val) => {
    if (val == null || val === "" || isNaN(Number(val))) return "N/A";
    return `₱${Number(val).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasPricingData = Boolean(
    lot.total_contract_price || lot.downpayment || lot.terms_months || lot.monthly_amortization
  );

  const tcpDisplay = formatPeso(lot.total_contract_price);
  const dpDisplay = formatPeso(lot.downpayment);
  const termsDisplay = lot.terms_months ? `${lot.terms_months} Month${Number(lot.terms_months) > 1 ? "s" : ""}` : "N/A";
  const monthlyAmortDisplay = lot.monthly_amortization ? `${formatPeso(lot.monthly_amortization)} / month` : "N/A";

  const pricingSectionHtml = hasPricingData
    ? `
    <!-- 3. PAYMENT & QUOTATION BREAKDOWN -->
    <div class="section-title">III. Payment &amp; Quotation Breakdown</div>
    <table class="detail-table">
      <tr>
        <td class="label-col">Total Contract Price:</td>
        <td class="value-col"><strong>${tcpDisplay}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Downpayment:</td>
        <td class="value-col">${dpDisplay}</td>
      </tr>
      <tr>
        <td class="label-col">Payment Term:</td>
        <td class="value-col">${escapeHtml(termsDisplay)}</td>
      </tr>
      <tr>
        <td class="label-col">Monthly Amortization:</td>
        <td class="value-col"><strong>${monthlyAmortDisplay}</strong></td>
      </tr>
    </table>
    `
    : "";

  const htmlContent = `
    <!-- HEADER: LOGO & TITLE (LEFT) + DOCUMENT META (RIGHT) -->
    <table class="header-table" style="width: 100%; border-collapse: collapse; margin-bottom: 12pt;">
      <tr>
        <td style="width: 58px; vertical-align: middle; border: none; padding: 0 9pt 6pt 0;">
          ${logoHtml}
        </td>
        <td style="vertical-align: middle; border: none; padding: 0 6pt 6pt 0;">
          <div class="company-title">GOLDEN DRAGON ESTATE DEVELOPER COMPANY</div>
          <div class="company-sub">LOT QUOTATION</div>
        </td>
        <td class="header-meta" style="width: 165px; vertical-align: middle; border: none; padding: 0 0 6pt 0;">
          <div><strong>Reference:</strong> GDC-QUO-${lotIdHtml}-${new Date().getFullYear()}</div>
          <div><strong>Date Issued:</strong> ${dateNow}</div>
        </td>
      </tr>
    </table>

    <!-- 1. PROPERTY & LOT SPECIFICATIONS -->
    <div class="section-title">I. Property &amp; Lot Details</div>
    <table class="detail-table">
      <tr>
        <td class="label-col">Property / Estate:</td>
        <td class="value-col">${propertyNameHtml}</td>
      </tr>
      <tr>
        <td class="label-col">Property Location:</td>
        <td class="value-col">${locationHtml}</td>
      </tr>
      <tr>
        <td class="label-col">Lot Designation:</td>
        <td class="value-col"><strong>${lotNumberHtml}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Total Lot Area:</td>
        <td class="value-col"><strong>${lot.area_sqm ? Number(lot.area_sqm).toFixed(2) + " sq.m." : "N/A"}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Lot Status:</td>
        <td class="value-col"><strong>${statusHtml}</strong></td>
      </tr>
      ${paymentRowHtml}
      ${isReservedOrSold ? `
      <tr>
        <td class="label-col">Sales Representative:</td>
        <td class="value-col"><strong>${agentHtml}</strong></td>
      </tr>
      ` : ""}
    </table>

    <!-- 2. CLIENT INFORMATION -->
    <div class="section-title">II. Client Information</div>
    <table class="detail-table">
      <tr>
        <td class="label-col">Client Full Name:</td>
        <td class="value-col"><strong>${escapeHtml(customer.full_name || "N/A")}</strong></td>
      </tr>
      <tr>
        <td class="label-col">Contact Number:</td>
        <td class="value-col">${escapeHtml(customer.contact_number || "N/A")}</td>
      </tr>
      <tr>
        <td class="label-col">Email Address:</td>
        <td class="value-col">${escapeHtml(customer.email || "N/A")}</td>
      </tr>
      <tr>
        <td class="label-col">Registered Address:</td>
        <td class="value-col">${escapeHtml(customer.address || "N/A")}</td>
      </tr>
    </table>

    ${pricingSectionHtml}

    <!-- FOOTER -->
    <div class="footer-note">
      This document is officially generated from the Golden Dragon Digital Lot Tracker System for client inquiry record reference.
    </div>
  `;

  downloadWordDoc(htmlContent, filename, logoBase64);
}
