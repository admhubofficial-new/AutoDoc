import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../master-utils.js";

type MasterUtils = {
  parseCsv: (input: unknown) => string[][];
  parseCsvBoolean: (value: unknown, fallback?: boolean) => boolean;
};
const utils = (globalThis as typeof globalThis & { AutoDocMasterUtils?: MasterUtils }).AutoDocMasterUtils;
if (!utils) throw new Error("Master CSV utilities were not initialized.");

test("CSV parser handles commas, escaped quotes, and quoted newlines", () => {
  const rows = utils.parseCsv('name,notes\r\n"School, East","He said ""hello""\nNext line"\r\n');
  assert.deepEqual(rows, [
    ["name", "notes"],
    ["School, East", 'He said "hello"\nNext line'],
  ]);
});

test("CSV parser auto-detects semicolon, tab, CRLF, and a UTF-8 BOM", () => {
  assert.deepEqual(utils.parseCsv('\uFEFFkelompok;nama;jenjang\r\nSekolah/Lembaga;SD A;SD\r\n'), [
    ["kelompok", "nama", "jenjang"],
    ["Sekolah/Lembaga", "SD A", "SD"],
  ]);
  assert.deepEqual(utils.parseCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
});

test("CSV parser rejects an unclosed quoted field", () => {
  assert.throws(() => utils.parseCsv('nama,alamat\n"Nama Sekolah,Jalan'), /tanda kutip tidak berpasangan/);
});

test("CSV booleans normalize Indonesian/English labels and use explicit defaults", () => {
  assert.equal(utils.parseCsvBoolean("Aktif", false), true);
  assert.equal(utils.parseCsvBoolean("Ya", false), true);
  assert.equal(utils.parseCsvBoolean("Nonaktif", true), false);
  assert.equal(utils.parseCsvBoolean("Tidak", true), false);
  assert.equal(utils.parseCsvBoolean("", true), true);
  assert.equal(utils.parseCsvBoolean("", false), false);
  assert.throws(() => utils.parseCsvBoolean("mungkin", true), /Nilai status CSV/);
});

test("Data Master maps CSV status fields using normalized defaults", () => {
  const source = readFileSync(new URL("../master.js", import.meta.url), "utf8");
  assert.match(source, /Impor CSV/);
  assert.match(source, /parseCsvBoolean\(g\("aktif"\),true\)/);
  assert.match(source, /parseCsvBoolean\(g\("perlu_verifikasi"\),false\)/);
});
