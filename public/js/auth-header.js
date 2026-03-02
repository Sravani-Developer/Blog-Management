(function () {
  var menus = document.querySelectorAll(".menu");

  function closeAllMenus() {
    menus.forEach(function (menuWrap) {
      var menu = menuWrap.querySelector(".settings-menu");
      var toggle = menuWrap.querySelector(".settings-toggle");
      if (menu) menu.classList.remove("open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  menus.forEach(function (menuWrap) {
    var toggle = menuWrap.querySelector(".settings-toggle");
    var menu = menuWrap.querySelector(".settings-menu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var willOpen = !menu.classList.contains("open");
      closeAllMenus();
      if (willOpen) {
        menu.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
      }
    });

    menu.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  });

  document.addEventListener("click", closeAllMenus);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllMenus();
  });

  document.querySelectorAll(".logout-action").forEach(function (btn) {
    btn.addEventListener("click", async function (e) {
      e.preventDefault();
      await fetch("/auth/logout", { method: "POST", headers: { Accept: "application/json" } });
      window.location.href = "/";
    });
  });
})();
