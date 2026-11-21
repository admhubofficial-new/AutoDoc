export type DocumentKind = "SJ" | "BAST";

export class WorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowValidationError";
  }
}

export function normalizeDocumentKinds(value: unknown): DocumentKind[] {
  const source = value === undefined ? ["SJ", "BAST"] : value;
  if (!Array.isArray(source) || source.length < 1 || source.length > 2) {
    throw new WorkflowValidationError("Pilih minimal satu jenis dokumen: Surat Jalan atau BAST.");
  }
  const result: DocumentKind[] = [];
  for (const item of source) {
    if (item !== "SJ" && item !== "BAST") {
      throw new WorkflowValidationError("Jenis dokumen yang dipilih tidak valid.");
    }
    if (!result.includes(item)) result.push(item);
  }
  if (!result.length) throw new WorkflowValidationError("Pilih minimal satu jenis dokumen bernomor.");
  return result;
}

export function normalizeMenuComponents(value: unknown, legacyMenu?: unknown): string[] {
  const source: unknown = value === undefined
    ? (typeof legacyMenu === "string" && legacyMenu.trim() ? [legacyMenu] : [])
    : value;
  if (!Array.isArray(source) || source.length > 8) {
    throw new WorkflowValidationError("Menu Hari Ini maksimal 8 komponen.");
  }
  return source.map((item, index) => {
    if (typeof item !== "string") {
      throw new WorkflowValidationError(`Komponen menu ke-${index + 1} tidak valid.`);
    }
    const name = item.trim();
    const maxLength = value === undefined ? 500 : 180;
    if (!name || name.length > maxLength) {
      throw new WorkflowValidationError(`Nama komponen menu ke-${index + 1} wajib diisi dan maksimal ${maxLength} karakter.`);
    }
    return name;
  });
}

export function joinMenuComponents(items: string[]): string | null {
  return items.join(", ") || null;
}

export function normalizeMealTime(value: unknown): "pagi" | "siang" | "sore" {
  const meal = value === undefined || value === null || value === "" ? "siang" : value;
  if (meal !== "pagi" && meal !== "siang" && meal !== "sore") {
    throw new WorkflowValidationError("Waktu makan harus pagi, siang, atau sore.");
  }
  return meal;
}

export function settingsForDistributionSnapshot(
  settings: Record<string, unknown>,
  distribution: Record<string, unknown>,
): Record<string, unknown> {
  return { ...settings, nama_ahli_gizi: distribution.nama_ahli_gizi ?? null };
}
