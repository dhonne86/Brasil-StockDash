(function () {
  var root = document.documentElement;
  var toggle = document.querySelector("[data-theme-toggle]");

  function getStoredTheme() {
    try {
      return localStorage.getItem("novo-projeto-theme") || "system";
    } catch (error) {
      return "system";
    }
  }

  function applyTheme(theme) {
    var prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    var useLight = theme === "light" || (theme === "system" && prefersLight);
    root.classList.toggle("light", useLight);
    root.classList.toggle("dark", !useLight);
  }

  function nextTheme(current) {
    if (current === "system") return "light";
    if (current === "light") return "dark";
    return "system";
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var theme = nextTheme(getStoredTheme());
      try {
        localStorage.setItem("novo-projeto-theme", theme);
      } catch (error) {}
      applyTheme(theme);
      toggle.title = "Tema: " + theme;
    });

    toggle.title = "Tema: " + getStoredTheme();
  }

  applyTheme(getStoredTheme());
})();
