import { strToU8, zipSync } from "fflate";

const COLUMN_WIDTHS = [6, 31, 8, 8, 20, 22, 19, 22, 25];
const COLUMN_OFFSET = 6;
const SPACER_COLUMN_WIDTH = 8.43;
const CURRENCY_FORMAT = '"PHP "#,##0.00;[Red]("PHP "#,##0.00);-';
const DATE_FORMAT = "mmmm d, yyyy";
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const xmlSafeText = (value) =>
  Array.from(String(value ?? ""))
    .filter((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint === 0x09 ||
        codePoint === 0x0a ||
        codePoint === 0x0d ||
        (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
        (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
        (codePoint >= 0x10000 && codePoint <= 0x10ffff)
      );
    })
    .join("");

const xmlEscape = (value) =>
  xmlSafeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const columnName = (index) => {
  let name = "";
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
};

const numericValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
};

const numericIdentifier = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text) || (text.length > 1 && text.startsWith("0"))) return null;
  return Number(text);
};

const estimateWrappedLines = (value, width) =>
  String(value ?? "")
    .split(/\r?\n/)
    .reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / width)), 0);

const excelDateValue = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const named = raw.match(/^([A-Za-z]{3,9})[\s-]+(\d{1,2}),?[\s-]+(\d{2,4})$/);
  let year;
  let month;
  let day;

  if (iso) {
    [, year, month, day] = iso;
    year = Number(year);
    month = Number(month);
    day = Number(day);
  } else if (named) {
    const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const monthIndex = monthNames.findIndex((name) => name.startsWith(named[1].toLowerCase()));
    if (monthIndex < 0) return null;
    month = monthIndex + 1;
    day = Number(named[2]);
    year = Number(named[3]);
    if (year < 100) year += 2000;
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return (date.getTime() - EXCEL_EPOCH) / 86400000;
};

const cell = (value, style = 0, type = "text") => ({ value, style, type });
const row = (values, height = 20) => ({ values, height });

const buildRows = ({ monthName, selectedYear, scopeLabel, projects, summary }) => {
  const rows = [];
  const merges = [];
  const merge = (rowNumber, firstColumn, lastColumn) => {
    if (firstColumn < lastColumn) {
      merges.push(
        `${columnName(firstColumn + COLUMN_OFFSET)}${rowNumber}:${columnName(lastColumn + COLUMN_OFFSET)}${rowNumber}`
      );
    }
  };
  const mergedLabel = (text, style, firstColumn, lastColumn) => {
    const values = Array.from({ length: 9 }, () => cell(null, 0, "blank"));
    values[firstColumn - 1] = cell(text, style);
    for (let column = firstColumn + 1; column <= lastColumn; column += 1) {
      values[column - 1] = cell(null, style, "blank");
    }
    merge(rows.length + 1, firstColumn, lastColumn);
    return values;
  };

  rows.push(row(mergedLabel("GOLDEN DRAGON ESTATE DEVELOPER COMPANY", 1, 1, 9), 31));
  rows.push(row(mergedLabel("MONTHLY SALES & NEW ACCOUNTS REPORT", 2, 1, 9), 24));
  rows.push(
    row(
      mergedLabel(`Period: ${monthName} ${selectedYear}     Scope: ${scopeLabel}`, 3, 1, 9),
      21
    )
  );
  rows.push(row(Array.from({ length: 9 }, () => cell(null, 0, "blank")), 9));

  if (!projects.length) {
    rows.push(row(mergedLabel("No recorded new accounts for this month.", 6, 1, 9), 24));
    return { rows, merges };
  }

  projects.forEach((project) => {
    const projectTitle = `${(project.property_name || "SUBDIVISION").toUpperCase()} NEW ACCOUNT`;
    rows.push(row(mergedLabel(projectTitle, 4, 1, 9), 23));
    rows.push(
      row(
        ["", "BUYER", "BLK", "LOT", "DATE OF PURCHASE", "MODE OF PAYMENT", "AMOUNT", "TCP", "AGENT"].map(
          (value) => cell(value, 5)
        ),
        28
      )
    );

    (project.records || []).forEach((record, index) => {
      const dataRow = rows.length + 1;
      const isAlternateRow = index % 2 === 1;
      const textStyle = isAlternateRow ? 7 : 6;
      const centerStyle = isAlternateRow ? 23 : 22;
      const identifierStyle = isAlternateRow ? 26 : 25;
      const currencyStyle = isAlternateRow ? 24 : 8;
      const tcpStyle = isAlternateRow ? 30 : 29;
      const purchaseDate = excelDateValue(record.date_of_purchase);
      const blockNumber = numericIdentifier(record.block);
      const lotNumber = numericIdentifier(record.lot);
      rows.push(
        row(
          [
            cell(numericValue(record.item_number) ?? index + 1, isAlternateRow ? 28 : 10, "number"),
            cell(record.buyer || "-", textStyle),
            cell(blockNumber ?? record.block ?? "-", blockNumber === null ? centerStyle : identifierStyle, blockNumber === null ? "text" : "number"),
            cell(lotNumber ?? record.lot ?? "-", lotNumber === null ? centerStyle : identifierStyle, lotNumber === null ? "text" : "number"),
            cell(purchaseDate ?? record.date_of_purchase ?? "-", purchaseDate === null ? centerStyle : isAlternateRow ? 27 : 9, purchaseDate === null ? "text" : "number"),
            cell(String(record.mode_of_payment || "").trim().toLowerCase() === "cash" ? "CASH" : "INSTALLMENT", centerStyle),
            cell(numericValue(record.amount), currencyStyle, "number"),
            cell(numericValue(record.tcp), tcpStyle, "number"),
            cell(record.agent || "Admin", centerStyle),
          ],
          23
        )
      );
      const wrappedLines = Math.max(
        estimateWrappedLines(record.buyer || "-", COLUMN_WIDTHS[1]),
        estimateWrappedLines(record.mode_of_payment || "-", COLUMN_WIDTHS[5]),
        estimateWrappedLines(record.agent || "Admin", COLUMN_WIDTHS[8])
      );
      rows[dataRow - 1].height = Math.max(
        23,
        Math.min(53, wrappedLines * 15 + 8)
      );
    });

    const subtotal = project.subtotal || {};
    rows.push(
      row(
        [
          cell(null, 11, "blank"),
          cell("TOTAL LOTS SOLD", 11),
          cell(numericValue(subtotal.lots_sold), 12, "number"),
          cell(null, 11, "blank"),
          cell(null, 11, "blank"),
          cell("TOTAL", 11),
          cell(numericValue(subtotal.total_amount), 13, "number"),
          cell(numericValue(subtotal.total_tcp), 13, "number"),
          cell(null, 11, "blank"),
        ],
        24
      )
    );
    rows.push(row(Array.from({ length: 9 }, () => cell(null, 0, "blank")), 10));
  });

  rows.push(row(mergedLabel("MONTHLY SUMMARY", 14, 1, 9), 23));
  const totalLotsRow = rows.length + 1;
  const totalLotsValues = Array.from({ length: 9 }, () => cell(null, 0, "blank"));
  totalLotsValues[0] = cell("TOTAL LOTS SOLD", 20);
  totalLotsValues[1] = cell(null, 20, "blank");
  totalLotsValues[2] = cell(numericValue(summary?.total_lots_sold) ?? 0, 21, "number");
  rows.push(row(totalLotsValues, 25));
  merge(totalLotsRow, 1, 2);

  const summaryHeaders = ["PROJECT", "", "", "", "", "SALES OF THE MONTH", "", "TCP", ""];
  rows.push(row(summaryHeaders.map((value) => cell(value, 15)), 25));
  const summaryHeaderRow = rows.length;
  merge(summaryHeaderRow, 1, 5);
  merge(summaryHeaderRow, 6, 7);
  merge(summaryHeaderRow, 8, 9);

  (summary?.project_summaries || []).forEach((project, index) => {
    const summaryRow = rows.length + 1;
    const values = Array.from({ length: 9 }, () => cell(null, 16, "blank"));
    values[0] = cell(project.property_name || "", 16);
    values[5] = cell(numericValue(project.sales_of_the_month), 17, "number");
    values[7] = cell(numericValue(project.tcp), 17, "number");
    rows.push(row(values, 22));
    merge(summaryRow, 1, 5);
    merge(summaryRow, 6, 7);
    merge(summaryRow, 8, 9);
  });

  const grandTotalRow = rows.length + 1;
  const grandTotal = Array.from({ length: 9 }, () => cell(null, 18, "blank"));
  grandTotal[0] = cell("OVERALL TOTAL", 18);
  grandTotal[5] = cell(numericValue(summary?.overall_amount) ?? 0, 19, "number");
  grandTotal[7] = cell(numericValue(summary?.overall_tcp) ?? 0, 19, "number");
  rows.push(row(grandTotal, 25));
  merge(grandTotalRow, 1, 5);
  merge(grandTotalRow, 6, 7);
  merge(grandTotalRow, 8, 9);

  return { rows, merges };
};

const serializeCell = (value, address) => {
  if (value.type === "blank" || value.value === null || value.value === undefined || value.value === "") {
    return `<c r="${address}" s="${value.style}"/>`;
  }
  if (value.type === "number" && Number.isFinite(Number(value.value))) {
    return `<c r="${address}" s="${value.style}"><v>${Number(value.value)}</v></c>`;
  }
  return `<c r="${address}" s="${value.style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value.value)}</t></is></c>`;
};

const worksheetXml = ({ rows, merges }) => {
  const lastRow = rows.length;
  const lastReportColumn = columnName(COLUMN_OFFSET + COLUMN_WIDTHS.length);
  const spacerColumns = `<col min="1" max="${COLUMN_OFFSET}" width="${SPACER_COLUMN_WIDTH}" customWidth="1"/>`;
  const columns = COLUMN_WIDTHS.map(
    (width, index) =>
      `<col min="${index + COLUMN_OFFSET + 1}" max="${index + COLUMN_OFFSET + 1}" width="${width}" customWidth="1"/>`
  ).join("");
  const sheetRows = rows
    .map(
      (entry, index) =>
        `<row r="${index + 1}" ht="${entry.height}" customHeight="1">${entry.values
          .map((value, columnIndex) => serializeCell(value, `${columnName(columnIndex + COLUMN_OFFSET + 1)}${index + 1}`))
          .join("")}</row>`
    )
    .join("");
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastReportColumn}${lastRow}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${spacerColumns}${columns}</cols><sheetData>${sheetRows}</sheetData>${mergeXml}<printOptions horizontalCentered="1"/><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="${xmlEscape(CURRENCY_FORMAT)}"/><numFmt numFmtId="165" formatCode="${DATE_FORMAT}"/></numFmts>
  <fonts count="9">
    <font><sz val="10"/><name val="Arial"/><family val="2"/><color rgb="FF243247"/></font>
    <font><b/><sz val="16"/><name val="Arial"/><family val="2"/><color rgb="FF172A45"/></font>
    <font><b/><sz val="12"/><name val="Arial"/><family val="2"/><color rgb="FF243247"/></font>
    <font><i/><sz val="10"/><name val="Arial"/><family val="2"/><color rgb="FF64748B"/></font>
    <font><b/><sz val="10"/><name val="Arial"/><family val="2"/><color rgb="FFFFFFFF"/></font>
    <font><b/><sz val="9"/><name val="Arial"/><family val="2"/><color rgb="FFFFFFFF"/></font>
    <font><sz val="9"/><name val="Arial"/><family val="2"/><color rgb="FF64748B"/></font>
    <font><b/><sz val="10"/><name val="Arial"/><family val="2"/><color rgb="FF243247"/></font>
    <font><b/><sz val="11"/><name val="Arial"/><family val="2"/><color rgb="FF172A45"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3552"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF7E6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="5">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
    <border><left/><right/><top/><bottom style="medium"><color rgb="FFC49A45"/></bottom><diagonal/></border>
    <border><left/><right/><top style="thin"><color rgb="FFC49A45"/></top><bottom style="thin"><color rgb="FFD5DEE8"/></bottom><diagonal/></border>
    <border><left/><right style="thin"><color rgb="FFD5DEE8"/></right><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="31">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="3" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="3" fontId="7" fillId="3" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="7" fillId="3" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="3" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="7" fillId="3" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="5" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="3" fontId="8" fillId="5" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="3" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="4" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="4" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const workbookXml = (lastRow) => {
  const firstReportColumn = columnName(COLUMN_OFFSET + 1);
  const lastReportColumn = columnName(COLUMN_OFFSET + COLUMN_WIDTHS.length);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Monthly Sales" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'Monthly Sales'!$${firstReportColumn}$1:$${lastReportColumn}$${lastRow}</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
};

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Golden Dragon Estate Management System</Application></Properties>`;

export const createMonthlySalesXlsx = ({ monthName, selectedYear, scopeLabel, projects = [], summary = null }) => {
  const { rows, merges } = buildRows({ monthName, selectedYear, scopeLabel, projects, summary });
  const sheet = worksheetXml({ rows, merges });
  const now = new Date().toISOString();
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Monthly Sales and New Accounts Report</dc:title><dc:creator>Golden Dragon Estate Management System</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`;
  const files = {
    "[Content_Types].xml": strToU8(contentTypesXml),
    "_rels/.rels": strToU8(packageRelsXml),
    "docProps/app.xml": strToU8(appXml),
    "docProps/core.xml": strToU8(coreXml),
    "xl/workbook.xml": strToU8(workbookXml(rows.length)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml),
    "xl/styles.xml": strToU8(stylesXml),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  };
  return zipSync(files, { level: 6 });
};
