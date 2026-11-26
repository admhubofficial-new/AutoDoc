(() => {
  "use strict";

  const host = document.getElementById("opsDashboard");
  const home = document.getElementById("homePage");
  const config = window.AutoDocConfig;
  if (!host || !home || !config) return;

  let loading = false;
  let loaded = false;

  function el(tag, className, value) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value !== undefined && value !== null) item.textContent = String(value);
    return item;
  }

  function number(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount.toLocaleString("id-ID") : "0";
  }

  function jakartaDateValue() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return values.year + "-" + values.month + "-" + values.day;
  }

  function dateLabel(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Tanggal tidak tersedia";
    const date = new Date(value + "T00:00:00+07:00");
    if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta"
    }).format(date);
  }

  function action(label, primary, handler, actionName) {
    const button = el("button", "home-action" + (primary ? " primary" : ""), label);
    button.type = "button";
    if (actionName) button.dataset.dashboardAction = actionName;
    button.addEventListener("click", handler);
    return button;
  }

  function setState(state) {
    host.dataset.state = state;
    host.setAttribute("aria-busy", String(state === "loading"));
  }

  function renderLoading() {
    setState("loading");
    host.replaceChildren();
    const state = el("section", "home-loading-state");
    state.setAttribute("role", "status");
    state.setAttribute("aria-live", "polite");
    state.append(el("span", "home-loading-label", "Memuat pusat pekerjaan operator…"));
    const skeletons = el("div", "home-loading-grid");
    for (let index = 0; index < 3; index += 1) {
      const card = el("div", "home-loading-card");
      card.append(
        el("span", "ui-skeleton home-loading-line"),
        el("span", "ui-skeleton home-loading-value"),
        el("span", "ui-skeleton home-loading-line short")
      );
      skeletons.append(card);
    }
    state.append(skeletons);
    host.append(state);
  }

  function renderMasterCheck(counts) {
    const warnings = [];
    if (Number(counts.sppg_missing_fields) > 0) {
      warnings.push({ label: "Identitas SPPG belum lengkap", entity: "settings" });
    }
    if (Number(counts.ahli_gizi_missing) > 0) {
      warnings.push({ label: "Nama Ahli Gizi Dapur belum diisi", entity: "settings" });
    }
    if (Number(counts.recipients_missing_address) > 0) {
      warnings.push({
        label: number(counts.recipients_missing_address) + " alamat penerima aktif belum dilengkapi",
        entity: "recipients",
        query: "alamat belum dilengkapi"
      });
    }
    if (Number(counts.recipients_need_verification) > 0) {
      warnings.push({
        label: number(counts.recipients_need_verification) + " penerima perlu verifikasi",
        entity: "recipients",
        query: "perlu verifikasi"
      });
    }

    const panel = el("section", "home-panel home-master-check");
    panel.setAttribute("aria-labelledby", "homeMasterCheckTitle");
    const heading = el("h2", null, "Kelengkapan Data Master");
    heading.id = "homeMasterCheckTitle";
    panel.append(heading);

    if (warnings.length) {
      panel.append(el("p", "home-panel-description", "Periksa data berikut agar dokumen distribusi tetap lengkap."));
      const list = el("div", "home-warning-list");
      warnings.forEach(warning => {
        const row = el("div", "home-warning-row");
        row.append(
          el("span", null, warning.label),
          action("Periksa", false, () => window.AutoDocMaster?.open(warning.entity, warning.query))
        );
        list.append(row);
      });
      panel.append(list);
      panel.dataset.state = "attention";
    } else {
      const ready = el("div", "home-master-ready");
      ready.append(el("span", "home-master-ready-mark", "✓"));
      ready.append(el("p", null, "Tidak ada kelengkapan inti yang perlu ditindaklanjuti saat ini."));
      panel.append(ready);
      panel.dataset.state = "ready";
    }
    return panel;
  }

  function renderRecentArchive(rows) {
    const panel = el("section", "home-panel home-archive-card");
    panel.setAttribute("aria-labelledby", "homeRecentArchiveTitle");
    const heading = el("h2", null, "Arsip distribusi terakhir");
    heading.id = "homeRecentArchiveTitle";
    panel.append(heading);

    const latest = rows[0] || null;
    if (!latest) {
      const empty = el("div", "home-dashboard-empty");
      empty.append(
        el("strong", null, "Belum ada distribusi tercatat"),
        el("p", null, "Distribusi yang diterbitkan akan muncul di sini agar mudah dibuka kembali."),
        action("＋ Buat dokumen pertama", true, () => window.AutoDocOpenDocs?.("create"), "create")
      );
      panel.append(empty);
      return panel;
    }

    const featured = el("div", "home-latest-distribution");
    const details = el("div", "home-latest-details");
    details.append(
      el("span", "home-latest-date", dateLabel(latest.tanggal)),
      el("strong", "home-latest-menu", String(latest.menu || "").trim() || "Menu belum dicatat"),
      el("small", null, number(latest.documents_count) + " dokumen · " + number(latest.bast_pending) + " BAST menunggu realisasi")
    );
    featured.append(
      details,
      action("Buka arsip terakhir", false, () => window.AutoDocOpenArchive?.(latest.tanggal))
    );
    panel.append(featured);

    if (rows.length > 1) {
      const list = el("div", "home-recent-list");
      rows.slice(1, 5).forEach(row => {
        const item = el("div", "home-recent-row");
        const details = el("div");
        details.append(
          el("span", null, dateLabel(row.tanggal)),
          el("small", null, (String(row.menu || "").trim() || "Menu belum dicatat") + " · " + number(row.documents_count) + " dokumen")
        );
        item.append(
          details,
          action("Buka", false, () => window.AutoDocOpenArchive?.(row.tanggal))
        );
        list.append(item);
      });
      panel.append(list);
    }
    return panel;
  }

  function render(data) {
    const counts = data && data.counts && typeof data.counts === "object" ? data.counts : {};
    const rows = Array.isArray(data?.recent_distributions) ? data.recent_distributions : [];
    const pendingBast = Number(counts.bast_pending) || 0;
    setState("success");
    host.replaceChildren();

    const activeDate = jakartaDateValue();
    const hero = el("section", "home-operator-hero");
    const dateBlock = el("div", "home-operator-date");
    const date = el("time", "home-operational-date", dateLabel(activeDate));
    date.dateTime = activeDate;
    dateBlock.append(
      el("span", "home-dashboard-eyebrow", "TANGGAL OPERASIONAL AKTIF"),
      date,
      el("p", "home-operator-description", "Siapkan distribusi, terbitkan dokumen, lalu selesaikan realisasi penerimaan.")
    );
    const createButton = action("＋ Buat Dokumen", true, () => window.AutoDocOpenDocs?.("create"), "create");
    createButton.classList.add("home-create-cta");
    hero.append(dateBlock, createButton);
    host.append(hero);

    const workGrid = el("div", "home-work-grid");
    const bast = el("section", "home-work-card home-bast-queue");
    bast.setAttribute("aria-labelledby", "homeBastQueueTitle");
    const bastHeading = el("h2", null, "BAST menunggu realisasi");
    bastHeading.id = "homeBastQueueTitle";
    bast.append(
      bastHeading,
      el("strong", "home-bast-count", number(pendingBast)),
      el("p", "home-card-description", pendingBast > 0
        ? "Dokumen BAST yang belum selesai dicatat realisasinya."
        : "Tidak ada BAST yang perlu ditindaklanjuti saat ini."),
      action("Buka antrean realisasi", false, () => window.AutoDocOpenRealization?.(rows.find(row=>Number(row.bast_pending)>0)?.tanggal))
    );
    workGrid.append(bast, renderMasterCheck(counts));
    host.append(workGrid, renderRecentArchive(rows));
  }

  async function load() {
    if (loading) return;
    loading = true;
    renderLoading();
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
      if (!payload || typeof payload !== "object") throw new Error("Respons ringkasan dashboard tidak valid.");
      render(payload);
      loaded = true;
    } catch (error) {
      setState("error");
      const panel = el("div", "ui-error-banner home-dashboard-error");
      panel.setAttribute("role", "alert");
      const content = el("div", "ui-error-banner__content");
      content.append(
        el("strong", "ui-error-banner__title", "Pusat pekerjaan belum dapat dimuat"),
        el("span", null, error.message || "Periksa koneksi lalu coba lagi.")
      );
      panel.append(content, action("Coba lagi", false, load));
      host.replaceChildren(panel);
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