(() => {
  "use strict";

  const host = document.getElementById("opsDashboard");
  const home = document.getElementById("homePage");
  const config = window.AutoDocConfig;
  if (!host || !home || !config) return;

  const style = document.createElement("style");
  style.textContent = [
    "#opsDashboard{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(285px,.85fr);gap:16px;align-items:start}",
    ".home-summary,.home-panel{min-width:0;padding:22px;border:1px solid #e3e9e3;border-radius:13px;background:#fff}",
    ".home-summary{box-shadow:0 2px 8px rgba(25,55,40,.025)}",
    ".home-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}",
    ".home-summary h2,.home-panel h2{margin:0;color:#263c2e;font-size:14px;font-weight:720;letter-spacing:-.15px}",
    ".home-summary-date{margin:6px 0 0;color:#87938b;font-size:11px}",
    ".home-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:18px 0 13px}",
    ".home-summary-item{min-width:0;padding:13px;border:1px solid #edf0ec;border-radius:9px;background:#fafcf9}",
    ".home-summary-item small{display:block;color:#7d8981;font-size:9px;line-height:1.5}",
    ".home-summary-item strong{display:block;margin-top:5px;color:#234c36;font-size:19px;line-height:1.25;font-weight:750;overflow-wrap:anywhere}",
    ".home-summary-menu{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:8px;background:#f6f8f6;color:#6e7b72;font-size:10px;line-height:1.6}",
    ".home-summary-menu strong{color:#425a49;font-weight:700}",
    ".home-summary-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}",
    ".home-action{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border:1px solid #dfe7df;border-radius:8px;background:#fff;color:#315640;text-decoration:none;font-size:11px;font-weight:680;cursor:pointer}",
    ".home-action.primary{border-color:#1e5a43;background:#1e5a43;color:#fff}",
    ".home-action:hover{background:#f3f7f3}.home-action.primary:hover{background:#194d3a}",
    ".home-action:focus-visible,.home-inline-link:focus-visible{outline:3px solid #a9c9b7;outline-offset:2px}",
    ".home-panel h2{margin-bottom:12px}",
    ".home-warning-list,.home-recent-list{display:grid;gap:0}",
    ".home-warning-row,.home-recent-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid #eff2ef}",
    ".home-warning-row:first-child,.home-recent-row:first-child{border-top:0;padding-top:0}",
    ".home-warning-row span,.home-recent-row span{color:#59685e;font-size:10px;line-height:1.55}",
    ".home-inline-link{flex:0 0 auto;padding:4px 0;border:0;background:transparent;color:#1e5a43;font:inherit;font-size:10px;font-weight:750;text-decoration:none;cursor:pointer}",
    ".home-inline-link:hover{text-decoration:underline}",
    ".home-recent-row small{display:block;margin-top:3px;color:#8a958d;font-size:9px}",
    ".home-empty{margin:0;padding:11px 0 2px;color:#849087;font-size:10px;line-height:1.6}",
    ".home-recent-panel{grid-column:1/-1}",
    ".home-recent-list{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:24px}",
    ".home-recent-row{padding:12px 0}",
    ".home-load-message{grid-column:1/-1;padding:18px;border:1px solid #e3e9e3;border-radius:13px;background:#fff;color:#718077;font-size:11px}",
    ".home-load-message.error{color:#b42318}",
    "@media(max-width:760px){#opsDashboard{grid-template-columns:1fr}.home-recent-panel{grid-column:auto}.home-recent-list{grid-template-columns:1fr 1fr}}",
    "@media(max-width:480px){.home-summary,.home-panel{padding:17px}.home-summary-grid{gap:7px}.home-summary-item{padding:10px}.home-summary-item strong{font-size:16px}.home-summary-actions{display:grid;grid-template-columns:1fr 1fr}.home-action{width:100%;padding-inline:8px}.home-recent-list{grid-template-columns:1fr}}"
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
      el("h2", null, "Distribusi terbaru"),
      el("p", "home-summary-date", latest ? dateLabel(latest.tanggal) : "Belum ada distribusi tercatat")
    );
    summaryHead.append(summaryTitle);
    summary.append(summaryHead);

    const metrics = el("div", "home-summary-grid");
    const metricRows = [
      ["Dokumen terakhir", latest ? latest.documents_count : 0],
      ["BAST perlu realisasi", counts.bast_pending],
      ["Total distribusi", counts.distributions]
    ];
    metricRows.forEach(([label, value]) => {
      const item = el("div", "home-summary-item");
      item.append(el("small", null, label), el("strong", null, typeof value === "number" ? num(value) : num(value)));
      metrics.append(item);
    });
    summary.append(metrics);

    const latestMenu = String(latest?.menu || "").trim();
    if (latest) {
      const menu = el("div", "home-summary-menu");
      menu.append(el("strong", null, "Menu:"), document.createTextNode(latestMenu || "Belum diisi"));
      summary.append(menu);
    } else {
      summary.append(el("p", "home-empty", "Belum ada distribusi. Mulai dengan membuat dokumen distribusi pertama."));
    }

    const summaryActions = el("div", "home-summary-actions");
    summaryActions.append(
      action("＋ Buat dokumen", true, () => window.AutoDocOpenDocs && window.AutoDocOpenDocs("create")),
      action("Lihat arsip", false, () => window.AutoDocOpenArchive && window.AutoDocOpenArchive())
    );
    summary.append(summaryActions);
    host.append(summary);

    const warnings = [];
    if (Number(counts.sppg_missing_fields) > 0) {
      warnings.push({ label: "Identitas SPPG belum lengkap", entity: "settings" });
    }
    if (Number(counts.ahli_gizi_missing) > 0) {
      warnings.push({ label: "Nama Ahli Gizi Dapur belum diisi", entity: "settings" });
    }
    if (Number(counts.recipients_missing_address) > 0) {
      warnings.push({ label: num(counts.recipients_missing_address) + " alamat penerima aktif belum dilengkapi", entity: "recipients", query: "alamat belum dilengkapi" });
    }
    if (Number(counts.recipients_need_verification) > 0) {
      warnings.push({ label: num(counts.recipients_need_verification) + " penerima perlu verifikasi", entity: "recipients", query: "perlu verifikasi" });
    }

    const panel = el("section", "home-panel");
    panel.append(el("h2", null, warnings.length ? "Perlu perhatian" : "Tidak ada tindak lanjut"));
    if (warnings.length) {
      const list = el("div", "home-warning-list");
      warnings.forEach(warning => {
        const row = el("div", "home-warning-row");
        row.append(el("span", null, warning.label), action("Periksa", false, () => {
          window.AutoDocMaster?.open(warning.entity, warning.query);
        }));
        list.append(row);
      });
      panel.append(list);
    } else {
      panel.append(el("p", "home-empty", "Tidak ada data utama yang perlu dilengkapi saat ini."));
    }
    host.append(panel);

    const earlierRows = rows.slice(1);
    if (earlierRows.length) {
      const recentPanel = el("section", "home-panel home-recent-panel");
      recentPanel.append(el("h2", null, "Distribusi sebelumnya"));
      const recentList = el("div", "home-recent-list");
      earlierRows.forEach(row => {
        const item = el("div", "home-recent-row");
        const details = el("div");
        details.append(
          el("span", null, dateLabel(row.tanggal)),
          el("small", null, (String(row.menu || "").trim() || "Menu belum diisi") + " · " + num(row.documents_count) + " dokumen")
        );
        const open = action("Buka arsip", false, () => window.AutoDocOpenArchive && window.AutoDocOpenArchive(row.tanggal));
        open.classList.add("home-inline-link");
        item.append(details, open);
        recentList.append(item);
      });
      recentPanel.append(recentList);
      host.append(recentPanel);
    }
  }

  async function load() {
    if (loading) return;
    loading = true;
    host.replaceChildren(el("div", "home-load-message", "Memuat ringkasan operasional…"));
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
      const message = el("div", "home-load-message error", error.message || "Tidak dapat memuat ringkasan operasional.");
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