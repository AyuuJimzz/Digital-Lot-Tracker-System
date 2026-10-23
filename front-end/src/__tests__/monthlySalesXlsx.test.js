import { strFromU8, unzipSync } from "fflate";
import { createMonthlySalesXlsx } from "../utils/monthlySalesXlsx";

describe("monthly sales Excel export", () => {
  const project = {
    property_id: 49,
    property_name: "Abilay",
    subtotal: { lots_sold: 2, total_amount: 56666.66, total_tcp: 2240000 },
    records: [
      {
        item_number: 1,
        buyer: 'John & "Ana"',
        block: "2",
        lot: "14",
        date_of_purchase: "March 6, 2026",
        mode_of_payment: "DP & 1st Monthly",
        amount: 26666.66,
        tcp: 1120000,
        agent: "Maria Santos",
      },
      {
        item_number: 2,
        buyer: "Ana Santos",
        block: "01",
        lot: "B-2",
        date_of_purchase: "March 7, 2026",
        mode_of_payment: "DOWNPAYMENT",
        amount: 30000,
        tcp: 1120000,
        agent: "Sarah Lee",
      },
    ],
  };

  const exportWorkbook = () => {
    const bytes = createMonthlySalesXlsx({
      monthName: "March",
      selectedYear: 2026,
      scopeLabel: "All projects",
      projects: [project],
      summary: {
        total_lots_sold: 2,
        overall_amount: 56666.66,
        overall_tcp: 2240000,
        project_summaries: [
          { property_name: "Abilay", sales_of_the_month: 56666.66, tcp: 2240000 },
        ],
      },
    });
    return Object.fromEntries(
      Object.entries(unzipSync(bytes)).map(([path, content]) => [path, strFromU8(content)])
    );
  };

  test("exports readable labels, escaped text, numeric totals and display formatting", () => {
    const workbookFiles = exportWorkbook();
    const sheet = workbookFiles["xl/worksheets/sheet1.xml"];
    const styles = workbookFiles["xl/styles.xml"];

    expect(sheet).toContain("BUYER");
    expect(sheet).toContain("DATE OF PURCHASE");
    expect(sheet).toContain("MODE OF PAYMENT");
    expect(sheet).toContain("LOTS SOLD");
    expect(sheet).toContain("TOTAL LOTS SOLD");
    expect(sheet).toContain('<c r="G12" s="20" t="inlineStr"><is><t xml:space="preserve">TOTAL LOTS SOLD</t></is></c>');
    expect(sheet).toContain('<c r="I12" s="21"><v>2</v></c>');
    expect(sheet).toContain('<c r="M12" s="0"/>');
    expect(sheet).toContain('<mergeCell ref="G12:H12"/>');
    expect(sheet).not.toContain('<mergeCell ref="G12:L12"/>');
    expect(sheet).not.toContain('<mergeCell ref="M12:O12"/>');
    expect(sheet).toContain("SALES OF THE MONTH");
    expect(sheet).toContain('<c r="L14" s="17"><v>56666.66</v></c>');
    expect(sheet).toContain('<c r="N14" s="17"><v>2240000</v></c>');
    expect(sheet).toContain('<c r="L15" s="19"><v>56666.66</v></c>');
    expect(sheet).toContain('<c r="N15" s="19"><v>2240000</v></c>');
    expect(sheet).toContain("OVERALL TOTAL");
    expect(sheet).toContain("John &amp; &quot;Ana&quot;");
    expect(sheet).toContain('<c r="I7" s="25"><v>2</v></c>');
    expect(sheet).toContain('<c r="J7" s="25"><v>14</v></c>');
    expect(sheet).toContain('<c r="H7" s="6" t="inlineStr">');
    expect(sheet).toContain('<c r="H8" s="7" t="inlineStr">');
    expect(sheet).toContain('<c r="G8" s="28"><v>2</v></c>');
    expect(sheet).toContain('<c r="M7" s="8"><v>26666.66</v></c>');
    expect(sheet).toContain('<c r="N7" s="29"><v>1120000</v></c>');
    expect(sheet).toContain('<c r="M8" s="24"><v>30000</v></c>');
    expect(sheet).toContain('<c r="N8" s="30"><v>1120000</v></c>');
    expect(sheet).toContain('<c r="I8" s="23" t="inlineStr"><is><t xml:space="preserve">01</t></is></c>');
    expect(sheet).toContain('<c r="J8" s="23" t="inlineStr"><is><t xml:space="preserve">B-2</t></is></c>');
    expect(sheet).toContain('<col min="8" max="8" width="31" customWidth="1"/>');
    expect(sheet).toContain('<col min="14" max="14" width="22" customWidth="1"/>');
    expect(sheet).toContain('<col min="1" max="6" width="8.43" customWidth="1"/>');
    expect(sheet).toContain('<dimension ref="A1:O15"/>');
    expect(workbookFiles["xl/workbook.xml"]).toContain("'Monthly Sales'!$G$1:$O$15");
    expect(styles).toContain('<alignment horizontal="left" vertical="center" wrapText="1"/>');
    expect(styles).toContain('<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>');
    expect(styles).toContain('<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>');
    expect(styles).toContain('<xf numFmtId="164" fontId="7" fillId="3" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>');
    expect(styles).toContain('<alignment horizontal="right" vertical="center" indent="1"/>');
    expect(sheet).toContain('<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
    expect(styles).toContain('formatCode="&quot;PHP &quot;#,##0.00;[Red](&quot;PHP &quot;#,##0.00);-"');
    expect(workbookFiles["[Content_Types].xml"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
    );
  });

  test("keeps an empty monthly report valid and readable", () => {
    const bytes = createMonthlySalesXlsx({
      monthName: "March",
      selectedYear: 2026,
      scopeLabel: "All projects",
      projects: [],
      summary: null,
    });
    const sheet = strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]);

    expect(sheet).toContain("No recorded new accounts for this month.");
  });
});
