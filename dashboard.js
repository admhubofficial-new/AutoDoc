(() => {
  "use strict";

  const host = document.getElementById("opsDashboard");
  const home = document.getElementById("homePage");
  const config = window.AutoDocConfig;
  if (!host || !home || !config) return;

  const style = document.createElement("style");
  style.textContent = [
    "#opsDashboard{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr);gap:16px;align-items:start}",
    ".home-summary,.home-panel{min-width:0;padding:22px;border:1px solid #E1E6E2;border-radius:16px;background:#fff}",
    ".home-summary{grid-column:1/-1}",
    ".home-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}",
    ".home-summary h2,.home-panel h2{margin:0;color:#24392d;font-size:15px;font-weight:700}",
    ".home-summary-date{margin-top:6px;color:#77847b;font-size:12px}",
    ".home-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:20px 0}",
    ".home-summary-item{padding:13px;border:1px solid #edf0ec;border-radius:11px;background:#fafcf9;min-width:0}",
    ".home-summary-item small{display:block;color:#758178;font-size:10px;line-height:1.45}",
    ".home-summary-item strong{display:block;margin-top:6px;color:#1E5A43;font-size:17px;line-height:1.35;overflow-wrap:anywhere}",
    ".home-summary-menu{display:flex;align-items:center;gap:8px;padding:11px 13px;border-radius:10px;background:#F6F8F6;color:#53645A;font-size:12px}",
    ".home-summary-menu strong{color:#1E5A43}",
    ".home-summary-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}",
    ".home-action{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border:1px solid #DCE5DE;border-radius:9px;background:#fff;color:#1E5A43;text-decoration:none;font-size:12px;font-weight:650;cursor:pointer}",
    ".home-action.primary{min-height:48px;padding:0 20px;border-color:#1E5A43;background:#1E5A43;color:#fff;font-size:13px;font-weight:700}",
    ".home-action:hover{background:#F3F7F3}.home-action.primary:hover{background:#194D3A}",
    ".home-panel h2{margin-bottom:14px}",
    ".home-warning-list,.home-recent-list{display:grid;gap:0}",
    ".home-warning-row,.home-recent-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #eef1ed}",
    ".home-warning-row:first-child,.home-recent-row:first-child{border-top:0;padding-top:0}",
    ".home-warning-row span,.home-recent-row span{color:#526258;font-size:12px;line-height:1.5}",
    ".home-inline-link{flex:0 0 auto;padding:0;border:0;background:transparent;color:#1E5A43;font:inherit;font-size:11px;font-weight:700;text-decoration:none;cursor:pointer}",
    ".home-inline-link:hover{text-decoration:underline}",
    ".home-recent-row small{display:block;margin-top:3px;color:#839087;font-size:10px}",
    ".home-empty{margin:0;color:#718077;font-size:12px;line-height:1.6}",
    ".home-load-message{grid-column:1/-1;padding:18px;border:1px solid #E1E6E2;border-radius:16px;background:#fff;color:#718077;font-size:12px}",
    ".home-load-message.error{color:#B42318}",
    "@media(max-width:760px){#opsDashboard{grid-template-columns:1fr}.home-summary{grid-column:auto}.home-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    "@media(max-width:420px){.home-summary,.home-panel{padding:17px}.home-summary-grid{gap:8px}.home-summary-item{padding:11px}.home-summary-item strong{font-size:15px}.home-summary-actions{display:grid;grid-template-columns:1fr}.home-action{width:100%}}"
  ].join("");
  document.head.append(style);

  let loading = false;
  let loaded = false;

  function el(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }
  function num(value) { return Number(value || 0).toLocaleString("id-ID"); }
  function dateLabel(value) {
    if (typeof value !== "string" || !value) return "Tanggal tidak tersedia";
    const date = new Date(value + "T00:00:00");
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(date);
  }
  function action(label, primary, handler) {
    const button = el("button", "home-action" + (primary ? " primary" : ""), label);
    button.type = "button";
    button.addEventListener("click", handler);
    return button;
  }
  function render(data) {
    const counts = data.counts || {};
    const rows = Array.isArray(data.recent_distributions) ? data.recent_distributions : [];
    const latest = rows[0] || null;
    host.replaceChildren();

    const summary = el("section", "home-summary");
    const summaryHead = el("div", "home-summary-head");
    const summaryTitle = el("div");
    summaryTitle.append(
      el("h2", null, "Distribusi terakhir"),
      el("p", "home-summary-date", latest ? dateLabel(latest.tanggal) : "Belum ada distribusi tercatat")
    );
    summaryHead.append(summaryTitle);
    summary.append(summaryHead);

    const metrics = el("div", "home-summary-grid");
    const metricRows = [
      ["Jumlah dokumen", latest ? latest.documents_count : 0],
      ["BAST menunggu realisasi", latest ? latest.bast_pending : 0],
      ["Status menu", latest && String(latest.menu || "").trim() ? "Terisi" : "Belum diisi"]
    ];
    metricRows.forEach(([label, value]) => {
      const item = el("div", "home-summary-item");
      item.append(el("small", null, label), el("strong", null, typeof value === "number" ? num(value) : value));
      metrics.append(item);
    });
    summary.append(metrics);
    if (latest) {
      summary.append(el("div", "home-summary-menu",
        "Menu distribusi: " + (String(latest.menu || "").trim() || "Belum diisi")
      ));
    } else {
      summary.append(el("p", "home-empty", "Buat dokumen distribusi pertama untuk mulai menggunakan ringkasan ini."));
    }
    const summaryActions = el("div", "home-summary-actions");
    summaryActions.append(
      action("Lihat arsip", false, () => window.AutoDocOpenArchive && window.AutoDocOpenArchive()),
      action("Buat & cetak dokumen", true, () => window.AutoDocOpenDocs && window.AutoDocOpenDocs("create"))
    );
    summary.append(summaryActions);
    host.append(summary);

    const warnings = [];
    if (Number(counts.recipients_missing_address) > 0) {
      warnings.push({ label: num(counts.recipients_missing_address) + " alamat penerima aktif belum dilengkapi", entity: "recipients" });
    }
    if (Number(counts.sppg_missing_fields) > 0) {
      warnings.push({ label: "Identitas SPPG belum lengkap", entity: "settings" });
    }
    if (Number(counts.drivers_active) === 0) warnings.push({ label: "Data pengemudi belum tersedia", entity: "drivers" });
    if (Number(counts.vehicles_active) === 0) warnings.push({ label: "Data kendaraan belum tersedia", entity: "vehicles" });
    if (Number(counts.staff_active) === 0) warnings.push({ label: "Data petugas belum tersedia", entity: "staff" });
    if (Number(counts.menus_active) === 0) warnings.push({ label: "Data menu makanan belum tersedia", entity: "menus" });
    if (Number(counts.recipients_need_verification) > 0) {
      warnings.push({ label: num(counts.recipients_need_verification) + " penerima perlu verifikasi", entity: "recipients" });
    }

    if (warnings.length) {
      const panel = el("section", "home-panel");
      panel.append(el("h2", null, "Perlu dilengkapi"));
      const list = el("div", "home-warning-list");
      warnings.forEach(warning => {
        const row = el("div", "home-warning-row");
        row.append(el("span", null, warning.label), action("Buka", false, () => {
          window.AutoDocMaster?.open(warning.entity);
        }));
        list.append(row);
      });
      panel.append(list);
      host.append(panel);
    }

    const recentPanel = el("section", "home-panel");
    if (!warnings.length) recentPanel.style.gridColumn = "1 / -1";
    recentPanel.append(el("h2", null, "Distribusi terbaru"));
    const recentList = el("div", "home-recent-list");
    if (!rows.length) {
      recentList.append(el("p", "home-empty", "Belum ada distribusi yang tercatat."));
    } else {
      rows.forEach(row => {
        const item = el("div", "home-recent-row");
        const details = el("div");
        details.append(
          el("span", null, dateLabel(row.tanggal)),
          el("small", null, (String(row.menu || "").trim() || "Menu belum diisi") + " · " + num(row.documents_count) + " dokumen")
        );
        const open = action("Buka", false, () => window.AutoDocOpenArchive && window.AutoDocOpenArchive(row.tanggal));
        open.classList.add("home-inline-link");
        item.append(details, open);
        recentList.append(item);
      });
    }
    recentPanel.append(recentList);
    host.append(recentPanel);
  }

  async function load() {
    if (loading) return;
    loading = true;
    host.replaceChildren(el("div", "home-load-message", "Memuat ringkasan distribusi…"));
    try {
      const response = await fetch(config.apiUrl + "/dashboard/summary", {
        method: "GET",
        headers: { apikey: config.publishableKey, Accept: "application/json" },
        credentials: "include",
        cache: "no-store"
      });
      let payload = {};
      try { payload = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(payload.message || "Ringkasan dashboard gagal dimuat.");
      render(payload);
      loaded = true;
    } catch (error) {
      const message = el("div", "home-load-message error", error.message || "Tidak dapat memuat ringkasan dashboard.");
      const retry = action("Coba lagi", false, load);
      message.append(document.createTextNode(" "), retry);
      host.replaceChildren(message);
    } finally {
      loading = false;
    }
  }

  window.addEventListener("autodoc:data-changed", () => {
    if (!home.hidden) load();
  });
  const observer = new MutationObserver(() => {
    if (!home.hidden && !loaded) load();
  });
  observer.observe(home, { attributes: true, attributeFilter: ["hidden"] });
  if (!home.hidden) load();
})();
