(() => {
  "use strict";
  function detectDelimiter(source) {
    const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
    let quoted = false;
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === '"') {
        if (quoted && source[i + 1] === '"') i += 1;
        else quoted = !quoted;
        continue;
      }
      if (!quoted && (char === "\n" || char === "\r")) break;
      if (!quoted && counts.has(char)) counts.set(char, counts.get(char) + 1);
    }
    let best = ",", highest = 0;
    for (const [delimiter, count] of counts) if (count > highest) { best = delimiter; highest = count; }
    return best;
  }
  function parseCsv(input) {
    const source = String(input ?? "").replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(source);
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (quoted) {
        if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"' && cell.length === 0) quoted = true;
      else if (char === delimiter) { row.push(cell); cell = ""; }
      else if (char === "\n" || char === "\r") {
        row.push(cell); rows.push(row); row = []; cell = "";
        if (char === "\r" && source[i + 1] === "\n") i += 1;
      } else cell += char;
    }
    if (quoted) throw new Error("Format CSV tidak valid: tanda kutip tidak berpasangan.");
    if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
    return rows;
  }
  function parseCsvBoolean(value, fallback = false) {
    if (typeof fallback !== "boolean") throw new TypeError("Nilai default status harus boolean.");
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return fallback;
    if (["1", "ya", "yes", "y", "true", "aktif", "on"].includes(normalized)) return true;
    if (["0", "tidak", "no", "n", "false", "nonaktif", "off"].includes(normalized)) return false;
    throw new Error("Nilai status CSV harus Aktif/Nonaktif, Ya/Tidak, atau 1/0.");
  }
  globalThis.AutoDocMasterUtils = Object.freeze({ parseCsv, parseCsvBoolean });
})();
