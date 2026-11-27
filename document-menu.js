(() => {
  "use strict";

  function create({ getModal, $, node, status, getPreviewController, onChange = () => {} }) {
    let items = [];

    function notifyChange() {
      if (typeof onChange === "function") onChange();
      getPreviewController()?.updateLivePreview();
    }

    function render() {
      const modal = getModal();
      const list = $("#docsMenuItems", modal);
      if (!list) return;
      list.replaceChildren();

      if (!items.length) {
        list.append(node("div", "docs-menu-empty", "Belum ada komponen menu. Menu boleh dikosongkan untuk penerbitan SJ/BAST."));
      }

      items.forEach((value, index) => {
        const row = node("div", "docs-menu-row");
        row.append(node("span", "docs-menu-order", String(index + 1) + "."));

        const input = node("input", "docs-menu-input");
        input.type = "text";
        input.maxLength = 180;
        input.placeholder = "Contoh: Nasi Putih";
        input.value = value;
        input.setAttribute("list", "docsMenuSuggestions");
        input.setAttribute("aria-label", "Komponen menu " + (index + 1));
        input.addEventListener("input", () => {
          items[index] = input.value;
          notifyChange();
        });

        const actions = node("div", "docs-menu-row-actions");
        const up = node("button", null, "↑");
        up.type = "button";
        up.disabled = index === 0;
        up.setAttribute("aria-label", "Geser " + (index + 1) + " ke atas");
        up.onclick = () => {
          if (index > 0) {
            [items[index - 1], items[index]] = [items[index], items[index - 1]];
            render();
          }
        };

        const down = node("button", null, "↓");
        down.type = "button";
        down.disabled = index === items.length - 1;
        down.setAttribute("aria-label", "Geser " + (index + 1) + " ke bawah");
        down.onclick = () => {
          if (index < items.length - 1) {
            [items[index + 1], items[index]] = [items[index], items[index + 1]];
            render();
          }
        };

        const remove = node("button", null, "×");
        remove.type = "button";
        remove.setAttribute("aria-label", "Hapus komponen " + (index + 1));
        remove.onclick = () => {
          items.splice(index, 1);
          render();
        };

        actions.append(up, down, remove);
        row.append(input, actions);
        list.append(row);
      });

      const count = $("#docsMenuCount", modal);
      if (count) {
        count.textContent = items.length + " dari 8 komponen";
        count.setAttribute("aria-live", "polite");
      }
      const add = $("#docsAddMenuItem", modal);
      if (add) add.disabled = items.length >= 8;
      notifyChange();
    }

    function add(value = "") {
      if (items.length >= 8) {
        status("Menu Hari Ini maksimal 8 komponen.", true);
        return;
      }
      items.push(value);
      render();
      const inputs = getModal().querySelectorAll(".docs-menu-input");
      inputs[inputs.length - 1]?.focus();
    }

    return Object.freeze({
      render,
      read: () => items.map(value => String(value || "").trim()).filter(Boolean),
      count: () => items.length,
      add,
      set(value) {
        items = Array.isArray(value) ? value.slice(0, 8) : [];
        render();
      },
      reset(renderNow = true) {
        items = [];
        if (renderNow) render();
      }
    });
  }

  window.AutoDocMenuEditor = Object.freeze({ create });
})();