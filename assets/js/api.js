window.Api = (function () {
  function jsonp(params) {
    const API_URL = window.DASHBOARD_CONFIG.apiUrl;

    return new Promise((resolve, reject) => {
      const callbackName = "statusBoardCallback_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
      let script = null;

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Request timed out."));
      }, 20000);

      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      const query = new URLSearchParams({
        ...params,
        callback: callbackName,
        _: String(Date.now())
      });

      const separator = API_URL.includes("?") ? "&" : "?";
      script = document.createElement("script");
      script.src = API_URL + separator + query.toString();

      script.onerror = function () {
        cleanup();
        reject(new Error("Could not reach data service."));
      };

      document.body.appendChild(script);
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function queueContains(queue, name, commandId) {
    const list = queue && Array.isArray(queue[name]) ? queue[name] : [];
    return list.some(item => String(item.id || item.name || "") === String(commandId));
  }

  function readCommandStatusFromPayload(payload, commandId) {
    const data = payload && payload.data ? payload.data : {};
    const queue = data.command_queue || {};

    if (queueContains(queue, "processed", commandId)) return "processed";
    if (queueContains(queue, "failed", commandId)) return "failed";
    if (queueContains(queue, "inbox", commandId)) return "inbox";
    return "unknown";
  }

  async function pollCommandStatus(commandId, options = {}) {
    const token = window.AppState && window.AppState.getToken ? window.AppState.getToken() : "";
    const intervalMs = Number(options.intervalMs || 4000);
    const maxAttempts = Number(options.maxAttempts || 45);
    const onStatus = typeof options.onStatus === "function" ? options.onStatus : function () {};

    if (!token || !commandId) return { status: "unknown", payload: null };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let payload = null;
      try {
        payload = await jsonp({ action: "command_status", token: token, command_id: commandId });
      } catch (error) {
        onStatus("waiting", { attempt, message: error.message });
        await sleep(intervalMs);
        continue;
      }

      if (!payload || !payload.ok) {
        onStatus("waiting", { attempt, payload });
        await sleep(intervalMs);
        continue;
      }

      const status = payload.status || readCommandStatusFromPayload(payload, commandId);
      if (status === "processed" || status === "failed") return { status, payload };

      onStatus(status === "inbox" ? "inbox" : "waiting", { attempt, payload });
      await sleep(intervalMs);
    }

    return { status: "timeout", payload: null };
  }

  return { jsonp, pollCommandStatus };
})();
