(() => {
  "use strict";

  const host = document.getElementById("opsDashboard");
  const home = document.getElementById("homePage");
  const config = window.AutoDocConfig;
  if (!host || !home || !config) return;

  const css = document.createElement("style");
  css.textContent = [
    "#opsDashboard{margin:24px 0 30px}",
    ".ops-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:13px}",
    ".ops-head h2{margin:0;color:#244434;font-size:16px}",
    ".ops-head p{margin:4px 0 0;color:#758278;font-size:11px}",
    ".ops-refresh{padding:8px 12px;border:1px solid #dce6dc;border-radius:9px;background:#fff;color:#31513d;font-size:11px;font-weight:750}",
    ".ops-refresh:disabled{opacity:.55;cursor:wait}",
    ".ops-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}",
    ".ops-stat{padding:14px;border:1px solid #e0e8df;border-radius:12px;background:#fff;min-width:0}",
    ".ops-stat small{display:block;color:#77847b;font-size:10px;font-weight:700}",
    ".ops-stat strong{display:block;margin-top:7px;color:#214734;font-size:24px;line-height:1.1;font-variant-numeric:tabular-nums}",
    ".ops-status{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;padding:12px 14px;border:1px solid #e3eae2;border-radius:11px;background:#fbfdf9}",
    ".ops-status span{font-size:10px;color:#66756d}",
    ".ops-quality{display:flex;align-items:flex-start;gap:9px;margin-top:12px;padding:12px 14px;border:1px solid #eee3c6;border-radius:11px;background:#fffdf7;color:#6d592d;font-size:11px;line-height:1.6}",
    ".ops-quality.good{border-color:#dce8dc;background:#f6faf5;color:#31513d}",
    ".ops-recent{margin-top:14px;padding:14px;border:1px solid #e0e8df;border-radius:12px;background:#fff}",
    ".ops-recent h3{margin:0 0 10px;color:#294536;font-size:12px}",
    ".ops-recent-list{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}",
    ".ops-recent-item{padding:10px;border-radius:9px;background:#f7faf6;min-width:0}",
    ".ops-recent-item strong{display:block;color:#31513d;font-size:11px}",
    ".ops-recent-item small{display:block;margin-top:4px;color:#7b887f;font-size:10px;line-height:1.4;overflow-wrap:anywhere}",
    ".ops-message{min-height:15px;margin:8px 0 0;color:#78847b;font-size:10px}",
    ".ops-message.error{color:#a43c32}",
    "@media(max-width:760px){.ops-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ops-recent-list{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    "@media(max-width:420px){.ops-stat{padding:11px}.ops-stat strong{font-size:21px}.ops-recent-list{grid-template-columns:1fr 1fr}}"
  ].join("");
  document.head.append(css);

  host.innerHTML = [
    '<div class="ops-head"><div><h2 id="opsDashboardTitle">Dashboard Operasional</h2><p>Ringkasan data distribusi, dokumen, dan kelengkapan administrasi</p></div><button class="ops-refresh" type="button" id="opsRefresh">Muat ulang</button></div>',
    '<div class="ops-stats" id="opsStats"><div class="ops-stat"><small>Ringkasan</small><strong>—</strong></div><div class="ops-stat"><small>Memuat data</small><strong>…</strong></div></div>',
    '<div class="ops-status" id="opsStatus"></div>',
    '<div class="ops-quality" id="opsQuality">Memeriksa kelengkapan Data Master…</div>',
    '<div class="ops-recent"><h3>Distribusi terbaru</h3><div class="ops-recent-list" id="opsRecent"><div class="ops-message">Memuat riwayat…</div></div></div>',
    '<p class="ops-message" id="opsMessage" role="status" aria-live="polite"></p>'
  ].join("");

  const stats = host.querySelector("#opsStats");
  const statusRow = host.querySelector("#opsStatus");
  const quality = host.querySelector("#opsQuality");
  const recent = host.querySelector("#opsRecent");
  const message = host.querySelector("#opsMessage");
  const refresh = host.querySelector("#opsRefresh");
  let loading = false;
  let loaded = false;

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }

  function number(value) {
    return Number(value || 0).toLocaleString("id-ID");
  }

  function dateLabel(value) {
    if (typeof value !== "string") return "Tanggal tidak tersedia";
    const date = new Date(value + "T00:00:00");
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function render(data) {
    const counts = data.counts || {};
    const cards = [
      ["Total distribusi", counts.distributions],
      ["Total dokumen", counts.documents],
      ["Surat Jalan", counts.surat_jalan],
      ["BAST menunggu realisasi", counts.bast_pending]
    ];
    stats.replaceChildren();
    cards.forEach(([label, value]) => {
      const card = element("div", "ops-stat");
      card.append(element("small", null, label), element("strong", null, number(value)));
      stats.append(card);
    });

    statusRow.replaceChildren();
    [
      ["Dibuat", counts.dibuat],
      ["Dicetak", counts.dicetak],
      ["Ditandatangani", counts.ditandatangani],
      ["Selesai", counts.selesai],
      ["Batal", counts.batal]
    ].forEach(([label, value]) => {
      statusRow.append(element("span", null, label + ": " + number(value)));
    });

    const warnings = [];
    if (Number(counts.recipients_missing_address) > 0) {
      warnings.push(number(counts.recipients_missing_address) + " penerima aktif belum memiliki alamat");
    }
    if (Number(counts.recipients_need_verification) > 0) {
      warnings.push(number(counts.recipients_need_verification) + " penerima perlu diverifikasi");
    }
    if (Number(counts.support_master_missing) > 0) {
      warnings.push(number(counts.support_master_missing) + " jenis Data Master pendukung belum memiliki data aktif");
    }
    if (Number(counts.sppg_missing_fields) > 0) {
      warnings.push("Identitas SPPG belum lengkap");
    }
    quality.classList.toggle("good", warnings.length === 0);
    quality.textContent = warnings.length
      ? "Perlu perhatian: " + warnings.join("; ") + ". Lengkapi melalui menu Data Master."
      : "Kelengkapan Data Master terpantau baik.";

    recent.replaceChildren();
    const rows = Array.isArray(data.recent_distributions) ? data.recent_distributions : [];
    if (!rows.length) {
      recent.append(element("p", "ops-message", "Belum ada distribusi tercatat."));
    } else {
      rows.forEach(row => {
        const item = element("div", "ops-recent-item");
        item.append(
          element("strong", null, dateLabel(row.tanggal)),
          element("small", null, (row.menu || "Menu belum diisi") + " · " + number(row.documents_count) + " dokumen")
        );
        recent.append(item);
      });
    }
    message.textContent = "Data diperbarui " + new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generated_at || Date.now())) + ".";
    message.classList.remove("error");
  }

  async function load() {
    if (loading) return;
    loading = true;
    refresh.disabled = true;
    refresh.textContent = "Memuat…";
    message.textContent = "Mengambil ringkasan terbaru…";
    message.classList.remove("error");
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
      message.textContent = error.message || "Tidak dapat memuat dashboard.";
      message.classList.add("error");
      if (!loaded) {
        stats.replaceChildren(element("div", "ops-stat", "Dashboard belum dapat dimuat."));
        quality.textContent = "Periksa koneksi dan sesi login, kemudian muat ulang dashboard.";
      }
    } finally {
      loading = false;
      refresh.disabled = false;
      refresh.textContent = "Muat ulang";
    }
  }

  refresh.addEventListener("click", load);
  window.addEventListener("autodoc:data-changed", () => {
    if (!home.hidden) load();
  });

  const observer = new MutationObserver(() => {
    if (!home.hidden && !loaded) load();
  });
  observer.observe(home, { attributes: true, attributeFilter: ["hidden"] });
  if (!home.hidden) load();
})();
