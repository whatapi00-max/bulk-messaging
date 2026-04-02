import { Response } from "express";
import ExcelJS from "exceljs";

export interface FailedMessageRow {
  id: string;
  phone_number: string;
  message_content: string | null;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  campaign_id: string | null;
  created_at: Date | null;
}

/**
 * Stream a CSV of failed messages to the response.
 */
export async function streamFailedMessagesCsv(
  res: Response,
  rows: FailedMessageRow[]
): Promise<void> {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="failed_messages.csv"');

  const headers = [
    "ID",
    "Phone Number",
    "Message",
    "Error Code",
    "Error Message",
    "Retry Count",
    "Campaign ID",
    "Created At",
  ];

  const escapeCsv = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const body = rows
    .map((row) => [
      row.id,
      row.phone_number,
      row.message_content,
      row.error_code,
      row.error_message,
      row.retry_count,
      row.campaign_id,
      row.created_at?.toISOString() ?? "",
    ].map(escapeCsv).join(","))
    .join("\n");

  res.write(`${headers.join(",")}\n${body}`);
  res.end();
}

/**
 * Stream an XLSX of failed messages to the response.
 */
export async function streamFailedMessagesXlsx(
  res: Response,
  rows: FailedMessageRow[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WA CRM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Failed Messages");
  sheet.columns = [
    { header: "ID", key: "id", width: 36 },
    { header: "Phone Number", key: "phone_number", width: 20 },
    { header: "Message", key: "message_content", width: 50 },
    { header: "Error Code", key: "error_code", width: 15 },
    { header: "Error Message", key: "error_message", width: 40 },
    { header: "Retry Count", key: "retry_count", width: 12 },
    { header: "Campaign ID", key: "campaign_id", width: 36 },
    { header: "Created At", key: "created_at", width: 25 },
  ];

  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="failed_messages.xlsx"');

  await workbook.xlsx.write(res);
  res.end();
}
