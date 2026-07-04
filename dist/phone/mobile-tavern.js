(function () {
  "use strict";

  var root = document.querySelector("[data-mobile-tavern]");
  if (!root) return;

  function setViewportHeight() {
    var height = window.innerHeight;
    if (window.visualViewport && window.visualViewport.height) {
      height = window.visualViewport.height;
    }
    root.style.setProperty("--mt-vh", Math.max(320, Math.round(height)) + "px");
  }

  function activatePanel(name) {
    var buttons = root.querySelectorAll("[data-panel]");
    var panels = root.querySelectorAll("[data-panel-view]");
    var index;
    for (index = 0; index < buttons.length; index += 1) {
      buttons[index].classList.toggle("is-active", buttons[index].getAttribute("data-panel") === name);
    }
    for (index = 0; index < panels.length; index += 1) {
      panels[index].classList.toggle("is-active", panels[index].getAttribute("data-panel-view") === name);
    }
  }

  function updateCount() {
    var input = root.querySelector("textarea");
    var count = root.querySelector("[data-count]");
    if (!input || !count) return;
    count.textContent = String(input.value.length) + " / " + String(input.getAttribute("maxlength") || 240);
  }

  function appendTemplate(text) {
    var input = root.querySelector("textarea");
    if (!input) return;
    var current = input.value.trim();
    input.value = current ? current + "\n" + text + "：" : text + "：";
    input.focus();
    updateCount();
  }

  function bind() {
    root.addEventListener("click", function (event) {
      var target = event.target;
      var panelButton = target && target.closest ? target.closest("[data-panel]") : null;
      if (panelButton) {
        event.preventDefault();
        activatePanel(panelButton.getAttribute("data-panel"));
        return;
      }

      var templateButton = target && target.closest ? target.closest("[data-template]") : null;
      if (templateButton) {
        event.preventDefault();
        appendTemplate(templateButton.getAttribute("data-template"));
        return;
      }

      var primary = target && target.closest ? target.closest(".mt-primary") : null;
      if (primary) {
        event.preventDefault();
        primary.textContent = "已暂存";
        window.setTimeout(function () {
          primary.textContent = "写入输入框";
        }, 1000);
      }
    });

    var input = root.querySelector("textarea");
    if (input) input.addEventListener("input", updateCount);

    window.addEventListener("resize", setViewportHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setViewportHeight);
      window.visualViewport.addEventListener("scroll", setViewportHeight);
    }
  }

  window.MobileTavernFrontend = {
    activatePanel: activatePanel,
    updateCount: updateCount,
    setViewportHeight: setViewportHeight
  };

  setViewportHeight();
  bind();
  updateCount();
}());
