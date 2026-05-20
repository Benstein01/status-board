window.AppState = (function () {
  const storageKeys = window.DASHBOARD_CONFIG.storageKeys;
  let currentPayload = null;

  function saveToken(token, view) {
    sessionStorage.setItem(storageKeys.token, token);
    sessionStorage.setItem(storageKeys.view, view);
  }

  function getToken() {
    return sessionStorage.getItem(storageKeys.token) || "";
  }

  function clearToken() {
    sessionStorage.removeItem(storageKeys.token);
    sessionStorage.removeItem(storageKeys.view);
  }

  function setPayload(payload) {
    currentPayload = payload;
  }

  function getPayload() {
    return currentPayload;
  }

  return { saveToken, getToken, clearToken, setPayload, getPayload };
})();

(function () {
  const { showMessage } = window.Utils;

  const unlockScreen = document.getElementById("unlockScreen");
  const dashboardScreen = document.getElementById("dashboardScreen");
  const unlockMessage = document.getElementById("unlockMessage");
  const rawSection = document.getElementById("rawSection");
  const rawButton = document.getElementById("rawButton");
  const refreshButton = document.getElementById("refreshButton");
  const snapshotMessage = document.getElementById("snapshotMessage");

  function showUnlock() {
    dashboardScreen.classList.add("hidden");
    unlockScreen.classList.remove("hidden");
  }

  function showDashboard() {
    unlockScreen.classList.add("hidden");
    dashboardScreen.classList.remove("hidden");
  }

  function snapshotStamp(payload) {
    return payload && payload.data ? String(payload.data.generated_at || payload.data.updated_at || "") : "";
  }

  async function loadDashboard(options = {}) {
    const token = window.AppState.getToken();
    const manual = Boolean(options.manual);

    if (!token) {
      showUnlock();
      return;
    }

    if (manual && snapshotMessage) {
      snapshotMessage.textContent = "Reloading latest snapshot...";
      snapshotMessage.className = "snapshot-message";
      refreshButton.disabled = true;
    }

    try {
      const previousStamp = snapshotStamp(window.AppState.getPayload());

      const payload = await window.Api.jsonp({
        action: "load",
        token: token,
        _: String(Date.now())
      });

      if (!payload || !payload.ok) {
        window.AppState.clearToken();
        showUnlock();
        showMessage(unlockMessage, "error", "Session expired. Draw pattern again.");
        return;
      }

      window.AppState.setPayload(payload);
      window.DashboardComponents.render(payload);

      if (window.AdminEditor) {
        window.AdminEditor.render(payload);
      }

      if (manual && snapshotMessage) {
        const newStamp = snapshotStamp(payload);
        if (previousStamp && newStamp && previousStamp === newStamp) {
          snapshotMessage.textContent = "Snapshot reloaded. No newer data is available yet.";
        } else {
          snapshotMessage.textContent = "Latest snapshot loaded.";
        }
        snapshotMessage.className = "snapshot-message success-text";
      }

      showDashboard();

    } catch (error) {
      if (manual && snapshotMessage) {
        snapshotMessage.textContent = "Could not reload snapshot. Please try again.";
        snapshotMessage.className = "snapshot-message error-text";
      } else {
        showMessage(unlockMessage, "error", error.message);
      }
    } finally {
      if (manual) refreshButton.disabled = false;
    }
  }

  function downloadCurrentJson() {
    const currentPayload = window.AppState.getPayload();
    if (!currentPayload) return;

    const blob = new Blob([JSON.stringify(currentPayload, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dashboard-snapshot.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  refreshButton.addEventListener("click", () => loadDashboard({ manual: true }));

  document.getElementById("lockButton").addEventListener("click", () => {
    window.AppState.clearToken();
    window.AppState.setPayload(null);
    rawSection.classList.add("hidden");
    rawButton.textContent = "Show raw data";
    if (snapshotMessage) snapshotMessage.textContent = "";
    showUnlock();
  });

  document.getElementById("downloadButton").addEventListener("click", downloadCurrentJson);

  rawButton.addEventListener("click", () => {
    const hidden = rawSection.classList.toggle("hidden");
    rawButton.textContent = hidden ? "Show raw data" : "Hide raw data";
  });

  window.LockPage.setup(loadDashboard);
  window.AdminActions.setup();

  if (window.DASHBOARD_CONFIG.apiUrl.includes("PASTE_YOUR_APPS_SCRIPT")) {
    showMessage(unlockMessage, "error", "Apps Script URL was not configured.");
  } else if (window.AppState.getToken()) {
    loadDashboard();
  } else {
    showUnlock();
  }
})();
