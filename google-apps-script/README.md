# Google Sheets ↔ AutoDoc

Bridge for the **Penerima Manfaat** master data. The original spreadsheet tab is read-only during initial import. AutoDoc writes a separate, managed tab named `AutoDoc_Penerima`; after that tab exists, it becomes the canonical two-way sync source.

## Install the Apps Script

1. Open the target spreadsheet: https://docs.google.com/spreadsheets/d/1Jx5FQHpxAWsedooQRhb9in9XRQA9WTdF5rzD7N0mX8Y/edit?gid=585084563#gid=585084563
2. In Google Sheets, open **Extensions → Apps Script**.
3. Replace the editor contents with [Code.gs](./Code.gs), then save.
4. In Apps Script, open **Project Settings → Script Properties → Add script property**:
   - Property: `AUTODOC_WEBHOOK_SECRET`
   - Value: generate a unique random secret of at least 32 characters. Do not reuse your PIN or OpenAI key.
5. Click **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Deploy and copy the web app URL ending in `/exec`.

The URL is public so the Supabase server can reach the Apps Script web app. Every request is still checked against the private random secret; the secret itself is not sent to the browser.

## Configure Supabase

In **Supabase → Project → Edge Functions → Secrets**, add:

| Secret name | Value |
|---|---|
| `GOOGLE_SHEETS_WEB_APP_URL` | Apps Script web app URL ending in `/exec` |
| `GOOGLE_SHEETS_WEBHOOK_SECRET` | The same value used for Script Property `AUTODOC_WEBHOOK_SECRET` |

Do not add these values to GitHub or AutoDoc frontend files. Secrets are read only by the Edge Function. Supabase secrets become available to Edge Functions without a code redeploy.

## How synchronization works

- **Google Sheets → AutoDoc:** AutoDoc reads the configured source tab (gid `585084563`) and shows a row-by-row comparison. Only checked rows are applied, after a second confirmation.
- **AutoDoc → Google Sheets:** AutoDoc writes the recipient master list into the dedicated `AutoDoc_Penerima` tab. The existing source/monthly tabs are not overwritten.
- **After first export:** the managed `AutoDoc_Penerima` tab becomes the next read source. You can edit it in Google Sheets and bring approved changes back into AutoDoc.
- Imports match on normalized `kelompok + nama`. Ambiguous or incomplete new rows are marked for review. Blank cells do not erase existing values.
- No deletion or deactivation is inferred from rows missing in the spreadsheet.
- Writes to the managed tab are explicit user actions from AutoDoc. The script refuses to overwrite a same-named tab unless it carries the AutoDoc marker.

## Expected columns for import

Header aliases are accepted for `kelompok`, `nama`, `jenjang`, `alamat`, `siswa_kecil`, `siswa_besar`, `tendik`, `ibu_hamil`, `ibu_menyusui`, `balita`, `putus_sekolah`, `kader`, `urutan`, `aktif`, and notes. Required fields are Kelompok, Nama, and Jenjang. For a new recipient, all eight beneficiary-count columns must be explicitly provided; otherwise the row is held for review instead of silently defaulting counts to zero.

The source tab ID is configured as `SOURCE_SHEET_GID` at the top of `Code.gs` and can be changed if the spreadsheet's data tab is different.
