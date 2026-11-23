/**
 * AutoDoc ↔ Google Sheets bridge.
 *
 * Install this script from Extensions → Apps Script in the target spreadsheet.
 * Set Script Property AUTODOC_WEBHOOK_SECRET to the same long random value
 * stored in Supabase as GOOGLE_SHEETS_WEBHOOK_SECRET.
 */
const SPREADSHEET_ID = "1Jx5FQHpxAWsedooQRhb9in9XRQA9WTdF5rzD7N0mX8Y";
const SOURCE_SHEET_GID = 585084563; // gid from the spreadsheet link supplied for AutoDoc setup
const MANAGED_SHEET_NAME = "AutoDoc_Penerima";
const MANAGED_MARKER = "AUTODOC_MANAGED_RECIPIENTS_V1";
const MAX_ROWS = 5000;
const HEADERS = [
  "recipient_id", "kelompok", "nama", "jenjang", "alamat",
  "siswa_kecil", "siswa_besar", "tendik", "ibu_hamil", "ibu_menyusui",
  "balita", "putus_sekolah", "kader", "urutan", "aktif",
  "keterangan", "perlu_verifikasi", "catatan_verifikasi", "updated_at"
];

function doPost(event) {
  try {
    const body = JSON.parse(event && event.postData && event.postData.contents || "{}");
    const expected = PropertiesService.getScriptProperties().getProperty("AUTODOC_WEBHOOK_SECRET") || "";
    const supplied = typeof body.secret === "string" ? body.secret : "";
    if (!expected || !constantTimeEquals_(expected, supplied)) {
      return json_({ ok: false, message: "Kredensial integrasi tidak valid." });
    }

    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    switch (body.action) {
      case "health":
        return json_(health_());
      case "readRecipients":
        return json_(readRecipients_());
      case "writeRecipients":
        return json_(writeRecipients_(payload));
      default:
        return json_({ ok: false, message: "Aksi integrasi tidak dikenal." });
    }
  } catch (error) {
    return json_({ ok: false, message: String(error && error.message || "Terjadi kesalahan pada Apps Script.") });
  }
}

function health_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const source = spreadsheet.getSheets().find(sheet => sheet.getSheetId() === SOURCE_SHEET_GID);
  const managed = spreadsheet.getSheetByName(MANAGED_SHEET_NAME);
  return {
    ok: true,
    spreadsheet_title: spreadsheet.getName(),
    spreadsheet_id: spreadsheet.getId(),
    source_sheet_name: source ? source.getName() : null,
    source_sheet_gid: SOURCE_SHEET_GID,
    managed_sheet_exists: Boolean(managed),
    managed_sheet_name: MANAGED_SHEET_NAME,
    message: "Koneksi Google Sheets aktif."
  };
}

function readRecipients_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const managed = spreadsheet.getSheetByName(MANAGED_SHEET_NAME);
  let sheet = managed;
  let sourceKind = "managed";
  if (!sheet) {
    sheet = spreadsheet.getSheets().find(item => item.getSheetId() === SOURCE_SHEET_GID);
    sourceKind = "original";
  }
  if (!sheet) throw new Error("Tab sumber dengan gid " + SOURCE_SHEET_GID + " tidak ditemukan.");

  const data = sheet.getDataRange().getDisplayValues();
  const headers = data.length ? data[0].map(value => String(value || "").trim()) : [];
  const rows = data.slice(1, MAX_ROWS + 1).map((values, index) => ({
    row_number: index + 2,
    values: values.map(value => String(value == null ? "" : value))
  })).filter(row => row.values.some(value => value.trim() !== ""));

  return {
    ok: true,
    spreadsheet_title: spreadsheet.getName(),
    sheet_name: sheet.getName(),
    sheet_gid: sheet.getSheetId(),
    source_kind: sourceKind,
    headers: headers,
    rows: rows,
    row_count: rows.length,
    truncated: data.length > MAX_ROWS + 1
  };
}

function writeRecipients_(payload) {
  const rows = Array.isArray(payload.rows) ? payload.rows : null;
  if (!rows || rows.length > MAX_ROWS) throw new Error("Jumlah penerima tidak valid (maksimal " + MAX_ROWS + ").");

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(MANAGED_SHEET_NAME);
  if (sheet) {
    const marker = sheet.getRange(1, 1).getNote();
    if (marker !== MANAGED_MARKER) {
      throw new Error("Tab " + MANAGED_SHEET_NAME + " sudah ada tetapi bukan tab yang dikelola AutoDoc. Ganti namanya terlebih dahulu agar data tidak tertimpa.");
    }
  } else {
    sheet = spreadsheet.insertSheet(MANAGED_SHEET_NAME);
    sheet.getRange(1, 1).setNote(MANAGED_MARKER);
  }

  const updatedAt = new Date().toISOString();
  const values = [HEADERS].concat(rows.map(row => HEADERS.map(header => {
    if (header === "updated_at") return updatedAt;
    const value = row && Object.prototype.hasOwnProperty.call(row, header) ? row[header] : "";
    return safeCell_(value);
  })));

  if (sheet.getMaxRows() < values.length) {
    sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  }
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, HEADERS.length).setValues(values);
  sheet.getRange(1, 1).setNote(MANAGED_MARKER);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  sheet.autoResizeColumns(1, HEADERS.length);

  return {
    ok: true,
    sheet_name: MANAGED_SHEET_NAME,
    row_count: rows.length,
    updated_at: updatedAt,
    message: rows.length + " penerima berhasil disalin dari AutoDoc."
  };
}

function safeCell_(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function constantTimeEquals_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
