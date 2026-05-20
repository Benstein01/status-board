window.LockPage = (function () {
  const { showMessage } = window.Utils;

  let pattern = [];
  let drawing = false;
  let unlocking = false;

  function patternStatus() {
    return document.getElementById("patternStatus");
  }

  function unlockMessage() {
    return document.getElementById("unlockMessage");
  }

  function resetPatternVisual() {
    pattern = [];
    document.querySelectorAll(".dot").forEach(dot => {
      dot.classList.remove("active");
    });
  }

  function clearPattern() {
    resetPatternVisual();
    patternStatus().textContent = "Ready";
    showMessage(unlockMessage(), "", "");
  }

  function addDot(dot) {
    const value = dot.getAttribute("data-value");

    if (!value || pattern.includes(value)) return;

    pattern.push(value);
    dot.classList.add("active");
    patternStatus().textContent = "Release to submit";
  }

  function dotFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);

    if (el && el.classList && el.classList.contains("dot")) {
      return el;
    }

    return null;
  }

  async function submitPattern(onUnlocked) {
    if (unlocking) return;

    const patternText = pattern.join("-");

    if (!patternText) {
      patternStatus().textContent = "Ready";
      return;
    }

    unlocking = true;
    patternStatus().textContent = "Checking access…";
    showMessage(unlockMessage(), "", "");

    try {
      const payload = await window.Api.jsonp({
        action: "unlock",
        pattern: patternText
      });

      if (!payload || !payload.ok || !payload.token) {
        showMessage(unlockMessage(), "error", "Pattern not recognized. Try again.");
        setTimeout(() => {
          clearPattern();
          unlocking = false;
        }, 700);
        return;
      }

      window.AppState.saveToken(payload.token, payload.view);

      const successMessage = payload.view === "admin"
        ? "Admin access confirmed. Loading admin tools…"
        : "Team access confirmed. Loading dashboard…";

      patternStatus().textContent = successMessage;
      showMessage(unlockMessage(), "success", successMessage);

      resetPatternVisual();

      await new Promise(resolve => setTimeout(resolve, 350));

      await onUnlocked();

    } catch (error) {
      showMessage(
        unlockMessage(),
        "error",
        "Connection issue. Please refresh and try again."
      );
      setTimeout(clearPattern, 900);
    } finally {
      unlocking = false;
    }
  }

  function setup(onUnlocked) {
    const patternGrid = document.getElementById("patternGrid");
    const resetPatternButton = document.getElementById("resetPatternButton");

    patternGrid.addEventListener("pointerdown", event => {
      if (unlocking) return;

      drawing = true;
      patternGrid.setPointerCapture(event.pointerId);
      clearPattern();

      const dot = dotFromPoint(event.clientX, event.clientY);
      if (dot) addDot(dot);
    });

    patternGrid.addEventListener("pointermove", event => {
      if (!drawing || unlocking) return;

      const dot = dotFromPoint(event.clientX, event.clientY);
      if (dot) addDot(dot);
    });

    patternGrid.addEventListener("pointerup", async () => {
      if (!drawing || unlocking) return;

      drawing = false;
      await submitPattern(onUnlocked);
    });

    patternGrid.addEventListener("pointercancel", () => {
      drawing = false;
      clearPattern();
    });

    resetPatternButton.addEventListener("click", () => {
      if (!unlocking) clearPattern();
    });
  }

  return {
    setup,
    clearPattern
  };
})();
