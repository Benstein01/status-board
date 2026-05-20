window.AdminActions = (function () {
  const { showMessage } = window.Utils;

  let mediaRecorder = null;
  let audioChunks = [];
  let recordedAudioBlob = null;
  let recordedAudioMime = "audio/webm";

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read audio."));
      reader.readAsDataURL(blob);
    });
  }

  async function sendTextCommand(type, text) {
    const token = window.AppState.getToken();
    const commandMessage = document.getElementById("commandMessage");

    if (!token) {
      showMessage(commandMessage, "error", "Session expired. Lock and unlock again.");
      return;
    }

    try {
      const payload = await window.Api.jsonp({
        action: "command",
        token: token,
        command_type: type,
        text: text || ""
      });

      if (!payload || !payload.ok) {
        showMessage(commandMessage, "error", payload && payload.error ? payload.error : "Command failed.");
        return;
      }

      const commandId = payload.command_id;
      showMessage(
        commandMessage,
        "success",
        "Command queued: " + commandId + ". Waiting for the local watcher to finish..."
      );

      document.getElementById("commandText").value = "";

      const finalStatus = await window.Api.pollCommandStatus(commandId, {
        onStatus(status) {
          if (status === "inbox") {
            showMessage(commandMessage, "success", "Command queued: " + commandId + ". Waiting for the local watcher...");
          } else if (status === "waiting") {
            showMessage(commandMessage, "success", "Checking command status: " + commandId + "...");
          }
        }
      });

      if (finalStatus.status === "processed") {
        showMessage(commandMessage, "success", "Done. The local watcher processed the command. Click Reload latest snapshot.");
      } else if (finalStatus.status === "failed") {
        showMessage(commandMessage, "error", "The command moved to Failed. Check the watcher log or Drive Failed folder: " + commandId);
      } else {
        showMessage(commandMessage, "success", "Command is still queued or status is unclear. Check the watcher, then use Reload latest snapshot.");
      }

    } catch (error) {
      showMessage(commandMessage, "error", error.message);
    }
  }

  async function sendAudioCommand() {
    const audioMessage = document.getElementById("audioMessage");

    if (!recordedAudioBlob) {
      showMessage(audioMessage, "error", "No audio recorded.");
      return;
    }

    const token = window.AppState.getToken();
    if (!token) {
      showMessage(audioMessage, "error", "Session expired. Lock and unlock again.");
      return;
    }

    try {
      const dataUrl = await blobToDataUrl(recordedAudioBlob);
      const form = new FormData();
      form.append("action", "command_upload");
      form.append("token", token);
      form.append("command_type", document.getElementById("commandType").value);
      form.append("text", document.getElementById("commandText").value.trim());
      form.append("audio_data_url", dataUrl);
      form.append("audio_mime_type", recordedAudioMime);

      await fetch(window.DASHBOARD_CONFIG.apiUrl, {
        method: "POST",
        mode: "no-cors",
        body: form
      });

      showMessage(
        audioMessage,
        "success",
        "Audio command queued. The local watcher will process it. Then use Reload latest snapshot."
      );

      clearAudio();
      document.getElementById("commandText").value = "";

    } catch (error) {
      showMessage(audioMessage, "error", error.message);
    }
  }

  async function startRecording() {
    const audioMessage = document.getElementById("audioMessage");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioChunks = [];
      recordedAudioBlob = null;

      const options = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
      mediaRecorder = new MediaRecorder(stream, options);
      recordedAudioMime = mediaRecorder.mimeType || "audio/webm";

      mediaRecorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        recordedAudioBlob = new Blob(audioChunks, { type: recordedAudioMime });
        const audioPreview = document.getElementById("audioPreview");
        audioPreview.src = URL.createObjectURL(recordedAudioBlob);
        audioPreview.classList.remove("hidden");
        document.getElementById("sendAudioCommandButton").disabled = false;
        document.getElementById("clearAudioButton").disabled = false;
        stream.getTracks().forEach(track => track.stop());
        showMessage(audioMessage, "success", "Audio ready.");
      };

      mediaRecorder.start();
      document.getElementById("startRecordingButton").disabled = true;
      document.getElementById("stopRecordingButton").disabled = false;
      document.getElementById("sendAudioCommandButton").disabled = true;
      document.getElementById("clearAudioButton").disabled = true;
      showMessage(audioMessage, "success", "Recording...");

    } catch (error) {
      showMessage(audioMessage, "error", "Microphone unavailable or blocked.");
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    document.getElementById("startRecordingButton").disabled = false;
    document.getElementById("stopRecordingButton").disabled = true;
  }

  function clearAudio() {
    recordedAudioBlob = null;
    audioChunks = [];
    const audioPreview = document.getElementById("audioPreview");
    audioPreview.removeAttribute("src");
    audioPreview.classList.add("hidden");
    document.getElementById("sendAudioCommandButton").disabled = true;
    document.getElementById("clearAudioButton").disabled = true;
    showMessage(document.getElementById("audioMessage"), "", "");
  }

  function setup() {
    document.getElementById("sendTextCommandButton").addEventListener("click", () => {
      sendTextCommand(
        document.getElementById("commandType").value,
        document.getElementById("commandText").value.trim()
      );
    });

    document.querySelectorAll("[data-quick-command]").forEach(button => {
      button.addEventListener("click", () => {
        const type = button.getAttribute("data-quick-command");
        const text = document.getElementById("commandText").value.trim();
        sendTextCommand(type, text);
      });
    });

    document.getElementById("startRecordingButton").addEventListener("click", startRecording);
    document.getElementById("stopRecordingButton").addEventListener("click", stopRecording);
    document.getElementById("sendAudioCommandButton").addEventListener("click", sendAudioCommand);
    document.getElementById("clearAudioButton").addEventListener("click", clearAudio);
  }

  return { setup };
})();
