(() => {
  "use strict";

  const host = document.getElementById("opsDashboard");
  const home = document.getElementById("homePage");
  const config = window.AutoDocConfig;
  if (!host || !home || !config) return;



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
      item.append(el("small", null, label), el("strong", null, num(value)));
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