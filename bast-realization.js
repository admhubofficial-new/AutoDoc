(() => {
  "use strict";

  function create({ getModal, $, node, esc, api, status, loadHistory }) {
    function showRealization(card, doc) {
      const modal = getModal();
      modal.querySelectorAll(".docs-realization").forEach(item => item.remove());

      const snapshot = doc.snapshot_json || {};
      const recipient = snapshot.penerima || {};
      const previous = doc.realisasi || {};
      const deliveredSmall = Number(recipient.porsi_kecil || 0);
      const deliveredLarge = Number(recipient.porsi_besar || 0);
      const oldSmall = previous.items?.find(item => item.jenis_porsi === "Porsi Kecil")?.jumlah_diterima ?? deliveredSmall;
      const oldLarge = previous.items?.find(item => item.jenis_porsi === "Porsi Besar")?.jumlah_diterima ?? deliveredLarge;

      const panel = node("section", "docs-realization");
      panel.dataset.state = "editing";
      panel.setAttribute("aria-labelledby", "docsRealizationTitle");
      const heading = node("h5", null, "Realisasi BAST · " + String(doc.nomor_lengkap || ""));
      heading.id = "docsRealizationTitle";
      panel.append(heading);
      panel.append(node("p", "docs-note", "Jumlah diterima tidak boleh melebihi jumlah yang diserahkan. Periksa suhu, kondisi makanan, dan jumlah kemasan sebelum menyimpan."));

      const live = node("p", "docs-realization-status");
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      panel.append(live);

      const form = node("form", "docs-grid docs-realization-form");
      form.id = "docsRealizationForm";

      function addField(labelText, name, type, options = {}) {
        const wrap = node("div", "docs-field" + (options.wide ? " wide" : ""));
        const inputId = "docsRealization_" + name;
        const label = node("label", null, labelText);
        label.htmlFor = inputId;
        let input;

        if (type === "select") {
          input = node("select");
          const placeholder = node("option", null, "Pilih kondisi");
          placeholder.value = "";
          input.append(placeholder);
          (options.values || []).forEach(value => {
            const option = node("option", null, value);
            option.value = value;
            input.append(option);
          });
        } else if (type === "textarea") {
          input = node("textarea");
          input.maxLength = options.maxLength || 1000;
        } else {
          input = node("input");
          input.type = type;
        }

        input.id = inputId;
        input.name = name;
        if (options.required) input.required = true;
        if (options.minLength !== undefined) input.minLength = options.minLength;
        if (options.maxLength !== undefined && type !== "textarea") input.maxLength = options.maxLength;
        if (options.min !== undefined) input.min = String(options.min);
        if (options.max !== undefined) input.max = String(options.max);
        if (options.step !== undefined) input.step = String(options.step);
        if (options.value !== undefined && options.value !== null) input.value = String(options.value);
        if (options.autocomplete) input.autocomplete = options.autocomplete;
        wrap.append(label, input);
        if (options.hint) wrap.append(node("small", "docs-field-hint", options.hint));
        (options.parent || form).append(wrap);
        return input;
      }

      const comparison = node("section", "docs-portion-comparison");
      comparison.setAttribute("aria-label", "Perbandingan porsi diserahkan dan diterima");
      form.append(comparison);

      function addPortionComparison(labelText, name, delivered, currentValue) {
        const card = node("section", "docs-portion-card");
        const title = node("h6", null, labelText);
        const deliveredBlock = node("div", "docs-portion-metric");
        deliveredBlock.append(node("span", null, "Diserahkan"), node("strong", null, delivered.toLocaleString("id-ID") + " porsi"));
        const receivedBlock = node("div", "docs-field docs-portion-received");
        const label = node("label", null, labelText + " diterima *");
        const input = node("input");
        input.id = "docsRealization_" + name;
        input.name = name;
        input.type = "number";
        input.min = "0";
        input.max = String(delivered);
        input.step = "1";
        input.required = true;
        input.inputMode = "numeric";
        input.value = String(currentValue ?? "");
        label.htmlFor = input.id;
        receivedBlock.append(label, input);
        card.append(title, deliveredBlock, receivedBlock);
        comparison.append(card);
        return input;
      }

      addField("Kondisi makanan *", "kondisi", "select", {
        required: true,
        values: ["baik", "kurang baik", "tidak layak"],
        value: previous.kondisi || ""
      });
      addField("Jam diterima *", "jam_diterima", "time", {
        required: true,
        value: previous.jam_diterima || ""
      });
      addField("Suhu makanan (°C)", "suhu_c", "number", {
        min: -50, max: 100, step: 0.01,
        value: previous.suhu_c ?? "",
        hint: "Rentang yang diterima: −50 hingga 100 °C"
      });
      addField("Ompreng kembali", "ompreng_kembali", "number", {
        min: 0, step: 1,
        value: previous.ompreng_kembali ?? "",
        hint: "Masukkan jumlah utuh, tanpa tanda pemisah"
      });
      addPortionComparison("Porsi kecil", "diterima_kecil", deliveredSmall, oldSmall);
      addPortionComparison("Porsi besar", "diterima_besar", deliveredLarge, oldLarge);
      addField("Nama penerima *", "nama_penerima", "text", {
        required: true, maxLength: 180, value: previous.nama_penerima || "", autocomplete: "name"
      });
      addField("Jabatan penerima", "jabatan_penerima", "text", {
        maxLength: 120, value: previous.jabatan_penerima || ""
      });
      addField("Catatan", "catatan", "textarea", {
        maxLength: 1000, value: previous.catatan || "", wide: true,
        hint: "Catatan tambahan bila ada perbedaan jumlah atau kondisi makanan"
      });
      const confirmation = node("section", "docs-realization-confirmation");
      confirmation.setAttribute("aria-labelledby", "docsRealizationConfirmationTitle");
      const confirmationTitle = node("h6", null, "Verifikasi & konfirmasi");
      confirmationTitle.id = "docsRealizationConfirmationTitle";
      confirmation.append(confirmationTitle, node("p", "docs-note", "Langkah ini memastikan realisasi disimpan setelah operator memasukkan PIN akses."));
      addField("PIN akses untuk konfirmasi *", "token", "password", {
        required: true, minLength: 6, maxLength: 128, autocomplete: "current-password",
        hint: "PIN diperlukan untuk mengonfirmasi penyimpanan realisasi", parent: confirmation
      });
      form.append(confirmation);

      const actions = node("div", "docs-form-actions docs-realization-actions");
      const cancel = node("button", "docs-btn cancel-realization", "Tutup");
      cancel.type = "button";
      cancel.addEventListener("click", () => panel.remove());
      const save = node("button", "docs-btn primary save-realization", "Simpan realisasi");
      save.type = "submit";
      actions.append(cancel, save);
      form.append(actions);

      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const submittedDate = $("#docsHistoryDate", modal)?.value;
        const data = Object.fromEntries(new FormData(form).entries());
        data.document_id = doc.id;

        save.disabled = true;
        cancel.disabled = true;
        save.textContent = "Menyimpan…";
        panel.dataset.state = "loading";
        live.dataset.state = "loading";
        live.textContent = "Menyimpan realisasi dan menunggu konfirmasi server…";

        try {
          await api("docs/realization", data);
          panel.dataset.state = "success";
          live.dataset.state = "success";
          live.textContent = "Realisasi berhasil disimpan.";
          status("Realisasi BAST berhasil disimpan.", false, "success");
          window.dispatchEvent(new Event("autodoc:data-changed"));
          save.textContent = "Tersimpan";

          try {
            if(panel.isConnected&&!modal.hidden)await loadHistory(submittedDate);
          } catch (refreshError) {
            live.dataset.state = "warning";
            live.textContent = "Realisasi berhasil disimpan, tetapi daftar dokumen belum dapat diperbarui. Muat ulang riwayat untuk melihat status terbaru.";
            status("Realisasi tersimpan. Riwayat gagal diperbarui: " + (refreshError.message || "coba muat ulang."), true, "error");
            cancel.disabled = false;
          }
        } catch (error) {
          panel.dataset.state = "error";
          live.dataset.state = "error";
          live.setAttribute("role", "alert");
          live.setAttribute("aria-live", "assertive");
          live.textContent = error.message || "Realisasi gagal disimpan. Periksa data dan coba lagi.";
          status(live.textContent, true, "error");
          save.disabled = false;
          cancel.disabled = false;
          save.textContent = "Simpan realisasi";
          const pin = form.elements.namedItem("token");
          if (pin) {
            pin.value = "";
            pin.focus();
          }
        }
      });

      panel.append(form);
      card.append(panel);
      panel.scrollIntoView({ behavior: "auto", block: "nearest" });
    }

    return Object.freeze({ showRealization });
  }

  window.AutoDocBastRealization = Object.freeze({ create });
})();