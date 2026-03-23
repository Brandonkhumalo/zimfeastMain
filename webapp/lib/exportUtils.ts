export interface ExportColumn {
  key: string;
  header: string;
  transform?: (value: any, row: any) => string;
}

/**
 * Export data to CSV and trigger download.
 */
export function exportToCSV(data: any[], columns: ExportColumn[], filename: string) {
  if (data.length === 0) return;

  const header = columns.map((c) => `"${c.header}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const raw = row[col.key];
        const value = col.transform ? col.transform(raw, row) : String(raw ?? "");
        // Escape double quotes
        return `"${value.replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

/**
 * Export data to Excel-compatible XML (no external library needed).
 * Uses SpreadsheetML format that Excel, Google Sheets, and LibreOffice can open.
 */
export function exportToExcel(data: any[], columns: ExportColumn[], filename: string) {
  if (data.length === 0) return;

  const headerRow = columns
    .map((c) => `<Cell><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`)
    .join("");

  const dataRows = data
    .map(
      (row) =>
        "<Row>" +
        columns
          .map((col) => {
            const raw = row[col.key];
            const value = col.transform ? col.transform(raw, row) : String(raw ?? "");
            const isNum = !isNaN(Number(value)) && value.trim() !== "";
            const type = isNum ? "Number" : "String";
            return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
          })
          .join("") +
        "</Row>"
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Export">
    <Table>
      <Row ss:StyleID="header">${headerRow}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  triggerDownload(blob, `${filename}.xls`);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
