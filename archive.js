(() => {
  "use strict";

  function create({ getModal, $, node, status, api, loadHistory }) {
    const modal = getModal();

    async function loadDistributions(initialOffset = 0) {
      const target = $(".docs-view-history", modal);
      if (!target) return;

      target.replaceChildren();
      const workspace = node("section", "docs-archive-workspace");
      const toolbar = node("div", "docs-days-toolbar");
      const heading = node("div", "docs-archive-heading");
      heading.append(
        node("h3", "docs-section-title", "Daftar Distribusi"),
        node("p", "docs-note", "Pilih tanggal distribusi untuk membuka dokumen, mencetak ulang, atau memeriksa realisasi.")
      );
      const searchGroup = node("div", "docs-archive-search");
      const input = node("input", "docs-archive-search-input");
      input.id = "docsDaysSearch";
      input.type = "search";
      input.placeholder = "Cari tanggal, menu, petugas, pengemudi, atau kendaraan…";
      input.setAttribute("aria-label", "Cari seluruh arsip");
      input.autocomplete = "off";
      const clearSearch = node("button", "docs-btn", "Bersihkan");
      clearSearch.type = "button";
      clearSearch.id = "docsDaysClearSearch";
      clearSearch.hidden = true;
      searchGroup.append(input, clearSearch);
      toolbar.append(heading, searchGroup);

      const dangerZone = node("section", "docs-danger-zone");
      dangerZone.setAttribute("aria-labelledby", "docsDangerZoneTitle");
      const dangerTitle = node("h4", "docs-danger-zone-title", "Area berbahaya · Penghapusan riwayat");
      dangerTitle.id = "docsDangerZoneTitle";
      const dangerDescription = node("p", "docs-danger-zone-description", "Penghapusan bersifat permanen dan memerlukan PIN MASUK. Tindakan ini dipisahkan dari alur membuka distribusi dan mencetak dokumen.");
      const selection = node("div", "docs-days-selection");
      const selectAllLabel = node("label", "docs-days-select-all");
      const selectAll = node("input");
      selectAll.id = "docsDaysSelectAll";
      selectAll.type = "checkbox";
      selectAll.disabled = true;
      selectAllLabel.append(selectAll, node("span", null, "Pilih semua pada halaman ini"));
      const selectionCount = node("strong", "docs-days-selection-count", "0 riwayat dipilih");
      const deleteButton = node("button", "docs-btn danger", "Hapus dipilih");
      deleteButton.type = "button";
      deleteButton.id = "docsDaysDelete";
      deleteButton.disabled = true;
      selection.append(selectAllLabel, selectionCount, deleteButton);

      const confirmSlot = node("div", "docs-delete-confirm-slot");
      confirmSlot.id = "docsDeleteConfirmSlot";
      const live = node("p", "docs-archive-live");
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      const list = node("div", "docs-days-list");
      list.id = "docsDaysList";
      list.setAttribute("aria-live", "polite");
      list.setAttribute("aria-busy", "true");

      const pagination = node("div", "docs-days-pagination");
      const previous = node("button", "docs-btn", "Lebih baru");
      previous.type = "button";
      previous.id = "docsDaysPrevious";
      const pageLabel = node("span", "docs-note", "Memuat halaman…");
      pageLabel.id = "docsDaysPage";
      const next = node("button", "docs-btn primary", "Lebih lama");
      next.type = "button";
      next.id = "docsDaysNext";
      pagination.append(previous, pageLabel, next);

      dangerZone.append(dangerTitle, dangerDescription, selection, confirmSlot);
      workspace.append(toolbar, live, list, pagination, dangerZone);
      target.append(workspace);

      let offset = 0;
      let hasMore = false;
      let rows = [];
      let searchTimer = null;
      let requestSequence = 0;
      let deleting = false;
      const active = () => workspace.isConnected && !modal.hidden && !target.hidden;
      const selectedIds = new Set();
      const selectedDetails = new Map();

      function announce(message, bad = false, state) {
        live.textContent = message || "";
        live.dataset.state = state || (bad ? "error" : message ? "success" : "");
        live.setAttribute("role", bad ? "alert" : "status");
        live.setAttribute("aria-live", bad ? "assertive" : "polite");
        if (active() && typeof status === "function") status(message, bad, state);
      }

      function formatDate(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return String(value || "Tanggal tidak tersedia");
        const [year, month, day] = value.split("-").map(Number);
        const calendarDate = new Date(Date.UTC(year, month - 1, day));
        if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return "Tanggal tidak valid";
        const date = new Date(value + "T00:00:00+07:00");
        return new Intl.DateTimeFormat("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta"
        }).format(date);
      }

      function renderLoading() {
        list.replaceChildren();
        list.dataset.state = "loading";
        list.setAttribute("aria-busy", "true");
        for (let index = 0; index < 3; index += 1) {
          const card = node("div", "docs-archive-skeleton");
          card.append(
            node("span", "ui-skeleton docs-archive-skeleton-line"),
            node("span", "ui-skeleton docs-archive-skeleton-line wide"),
            node("span", "ui-skeleton docs-archive-skeleton-action")
          );
          list.append(card);
        }
        pageLabel.textContent = "Memuat halaman…";
      }

      function renderEmpty() {
        list.replaceChildren();
        list.dataset.state = "empty";
        list.setAttribute("aria-busy", "false");
        const empty = node("div", "ui-empty-state docs-archive-empty");
        empty.append(
          node("span", "ui-empty-state__icon", "⌕"),
          node("h4", "ui-empty-state__title", input.value.trim() ? "Arsip tidak ditemukan" : "Belum ada riwayat distribusi"),
          node("p", "ui-empty-state__description", input.value.trim()
            ? "Tidak ada distribusi yang cocok. Periksa kata kunci atau bersihkan pencarian untuk melihat seluruh arsip."
            : "Distribusi yang telah diterbitkan akan muncul di sini.")
        );
        if (input.value.trim()) {
          const actions = node("div", "ui-empty-state__actions");
          const reset = node("button", "docs-btn", "Bersihkan pencarian");
          reset.type = "button";
          reset.addEventListener("click", () => {
            input.value = "";
            selectedIds.clear();
            selectedDetails.clear();
            confirmSlot.replaceChildren();
            syncSearchControls();
            loadPage(0);
          });
          actions.append(reset);
          empty.append(actions);
        }
        list.append(empty);
      }

      function renderError(error) {
        list.replaceChildren();
        list.dataset.state = "error";
        list.setAttribute("aria-busy", "false");
        const panel = node("div", "ui-error-banner docs-archive-error");
        const content = node("div", "ui-error-banner__content");
        content.append(
          node("strong", "ui-error-banner__title", "Arsip gagal dimuat"),
          node("span", null, error?.message || "Periksa koneksi atau sesi masuk, lalu coba lagi.")
        );
        const retry = node("button", "docs-btn", "Coba lagi");
        retry.type = "button";
        retry.addEventListener("click", () => loadPage(offset));
        panel.append(content, retry);
        list.append(panel);
      }

      function syncSearchControls() {
        clearSearch.hidden = !input.value.trim();
      }

      function updateSelection() {
        const count = selectedIds.size;
        selectionCount.textContent = count + " riwayat dipilih";
        deleteButton.textContent = count ? "Hapus dipilih (" + count + ")" : "Hapus dipilih";
        deleteButton.disabled = count === 0;
        const selectedOnPage = rows.filter(row => selectedIds.has(String(row.id))).length;
        selectAll.checked = rows.length > 0 && selectedOnPage === rows.length;
        selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < rows.length;
        selectAll.disabled = rows.length === 0;
        list.querySelectorAll("[data-distribution-id]").forEach(card => {
          const checkbox = card.querySelector("input[type=checkbox]");
          if (checkbox) checkbox.checked = selectedIds.has(card.dataset.distributionId);
        });
      }

      function renderDays() {
        pagination.hidden = !offset && !hasMore;
        dangerZone.hidden = !rows.length && !selectedIds.size;
        if (!rows.length) {
          renderEmpty();
        } else {
          list.replaceChildren();
          list.dataset.state = "success";
          list.setAttribute("aria-busy", "false");
          rows.forEach(row => {
            const id = String(row.id);
            const card = node("article", "docs-day-card");
            card.dataset.distributionId = id;
            const pick = node("label", "docs-day-pick");
            const checkbox = node("input");
            checkbox.type = "checkbox";
            checkbox.checked = selectedIds.has(id);
            checkbox.setAttribute("aria-label", "Pilih riwayat " + formatDate(row.tanggal));
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) {
                if (!selectedIds.has(id) && selectedIds.size >= 60) {
                  checkbox.checked = false;
                  announce("Maksimal 60 riwayat dapat dipilih untuk satu kali penghapusan.", true);
                  return;
                }
                selectedIds.add(id);
                selectedDetails.set(id, row);
              } else {
                selectedIds.delete(id);
                selectedDetails.delete(id);
              }
              confirmSlot.replaceChildren();
              updateSelection();
            });
            pick.append(checkbox);

            const detail = node("div", "docs-day-detail");
            detail.append(
              node("strong", null, formatDate(row.tanggal)),
              node("small", null, String(row.menu || "Menu belum diisi")),
              node("small", "docs-day-meta", [
                row.nama_petugas ? "Petugas: " + row.nama_petugas : "Petugas belum diisi",
                row.nama_pengemudi ? "Pengemudi: " + row.nama_pengemudi : "Pengemudi belum diisi",
                row.no_kendaraan ? "Kendaraan: " + row.no_kendaraan : "Kendaraan belum diisi"
              ].join(" · "))
            );
            const actions = node("div", "docs-day-actions");
            const open = node("button", "docs-btn primary", "Buka");
            open.type = "button";
            open.setAttribute("aria-label", "Buka dokumen distribusi " + formatDate(row.tanggal));
            open.addEventListener("click", () => loadHistory(row.tanggal));
            actions.append(open);
            card.append(pick, detail, actions);
            list.append(card);
          });
        }

        const first = rows.length ? offset + 1 : 0;
        const last = offset + rows.length;
        const query = input.value.trim();
        pageLabel.textContent = rows.length
          ? "Arsip " + first + "–" + last + (query ? " · hasil pencarian" : "") + (hasMore ? " · masih ada hasil" : "")
          : "Tidak ada hasil";
        previous.disabled = offset === 0;
        next.disabled = !hasMore;
        updateSelection();
      }

      async function loadPage(nextOffset) {
        if (!active() || deleting) return;
        const requestId = ++requestSequence;
        announce("Memuat arsip…", false, "loading");
        previous.disabled = true;
        next.disabled = true;
        selectAll.disabled = true;
        renderLoading();
        try {
          const query = "?offset=" + encodeURIComponent(nextOffset) + "&q=" + encodeURIComponent(input.value.trim());
          const result = await api("docs/days" + query);
          if (requestId !== requestSequence) return;
          if (!active()) return;
          rows = Array.isArray(result.distributions) ? result.distributions : [];
          offset = Number(result.offset || 0);
          hasMore = Boolean(result.has_more);
          rows.forEach(row => {
            const id = String(row.id);
            if (selectedIds.has(id)) selectedDetails.set(id, row);
          });
          renderDays();
          announce(rows.length + " riwayat dimuat pada halaman ini.", false, rows.length ? "success" : "empty");
        } catch (error) {
          if (requestId !== requestSequence) return;
          if (!active()) return;
          announce(error.message || "Arsip gagal dimuat.", true, "error");
          renderError(error);
          previous.disabled = offset === 0;
          next.disabled = true;
        }
        syncSearchControls();
      }

      selectAll.addEventListener("change", () => {
        confirmSlot.replaceChildren();
        const selecting = selectAll.checked;
        let capped = false;
        rows.forEach(row => {
          const id = String(row.id);
          if (selecting) {
            if (!selectedIds.has(id)) {
              if (selectedIds.size < 60) {
                selectedIds.add(id);
                selectedDetails.set(id, row);
              } else capped = true;
            }
          } else {
            selectedIds.delete(id);
            selectedDetails.delete(id);
          }
        });
        updateSelection();
        if (capped) announce("Batas pilihan 60 riwayat tercapai. Hapus pilihan lain untuk menambah data.", true);
      });

      clearSearch.addEventListener("click", () => {
        input.value = "";
        selectedIds.clear();
        selectedDetails.clear();
        confirmSlot.replaceChildren();
        syncSearchControls();
        loadPage(0);
        input.focus();
      });

      previous.addEventListener("click", () => loadPage(Math.max(0, offset - 60)));
      next.addEventListener("click", () => loadPage(offset + 60));
      input.addEventListener("input", () => {
        confirmSlot.replaceChildren();
        syncSearchControls();
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          if(!active() || deleting)return;
          selectedIds.clear();
          selectedDetails.clear();
          confirmSlot.replaceChildren();
          updateSelection();
          loadPage(0);
        }, 300);
      });

      deleteButton.addEventListener("click", () => {
        if (!selectedIds.size || deleting || !active()) return;
        confirmSlot.replaceChildren();
        const ids = Array.from(selectedIds);
        const panel = node("section", "docs-delete-panel");
        panel.setAttribute("aria-labelledby", "docsDeleteTitle");
        const heading = node("h3", null, "Konfirmasi penghapusan riwayat");
        heading.id = "docsDeleteTitle";
        panel.append(heading);
        panel.append(node("p", "docs-delete-warning", "Tindakan ini permanen. " + ids.length + " riwayat distribusi beserta seluruh Surat Jalan, BAST, data realisasi, dan rincian menu terkait akan dihapus. Nomor dokumen yang sudah pernah terpakai tetap tidak akan digunakan ulang."));
        const summary = node("div", "docs-delete-summary");
        ids.slice(0, 6).forEach(id => {
          const item = selectedDetails.get(id);
          summary.append(node("div", null, (item?.tanggal || "Riwayat terpilih") + " · " + (item?.menu || "Menu tidak tersedia")));
        });
        if (ids.length > 6) summary.append(node("div", "docs-note", "Dan " + (ids.length - 6) + " riwayat lainnya."));
        panel.append(summary);

        const form = node("form", "docs-delete-form");
        const pinLabel = node("label", null, "PIN MASUK untuk konfirmasi");
        pinLabel.htmlFor = "docsDeletePin";
        const pin = node("input");
        pin.id = "docsDeletePin";
        pin.type = "password";
        pin.name = "token";
        pin.required = true;
        pin.minLength = 6;
        pin.maxLength = 128;
        pin.autocomplete = "current-password";
        pin.placeholder = "Masukkan PIN MASUK";

        const acknowledgement = node("label", "docs-delete-ack");
        const check = node("input");
        check.type = "checkbox";
        check.required = true;
        acknowledgement.append(check, node("span", null, "Saya memahami bahwa penghapusan ini permanen."));

        const actions = node("div", "docs-delete-actions");
        const cancel = node("button", "docs-btn", "Batal");
        cancel.type = "button";
        cancel.addEventListener("click", () => confirmSlot.replaceChildren());
        const submit = node("button", "docs-btn danger", "Hapus permanen");
        submit.type = "submit";
        actions.append(cancel, submit);
        form.append(pinLabel, pin, acknowledgement, actions);

        form.addEventListener("submit", async event => {
          event.preventDefault();
          if (deleting || !active() || !form.reportValidity()) return;
          if (ids.length !== selectedIds.size || ids.some(id => !selectedIds.has(id))) {confirmSlot.replaceChildren();announce("Pilihan berubah. Konfirmasi ulang penghapusan.",true);return;}
          const token = pin.value;
          pin.value = "";
          deleting = true;
          panel.dataset.state = "loading";
          workspace.inert = true;
          if (searchTimer) clearTimeout(searchTimer);
          submit.disabled = true;
          cancel.disabled = true;
          submit.textContent = "Memverifikasi PIN dan menghapus…";
          try {
            const result = await api("docs/delete-history", { token, distribution_ids: ids });
            selectedIds.clear();
            selectedDetails.clear();
            confirmSlot.replaceChildren();
            announce(result.message || "Riwayat berhasil dihapus.", false, "success");
            deleting = false;workspace.inert = false;
            await loadPage(0);
            window.dispatchEvent(new Event("autodoc:data-changed"));
          } catch (error) {
            deleting = false;workspace.inert = false;panel.dataset.state = "error";
            announce(error.message || "Penghapusan gagal.", true, "error");
            submit.disabled = false;
            cancel.disabled = false;
            submit.textContent = "Hapus permanen";
            pin.value = "";
            pin.focus();
          }
        });

        panel.append(form);
        confirmSlot.append(panel);
        pin.focus();
      });

      syncSearchControls();
      await loadPage(Math.max(0, Number(initialOffset) || 0));
    }

    return Object.freeze({ loadDistributions });
  }

  window.AutoDocArchive = Object.freeze({ create });
})();