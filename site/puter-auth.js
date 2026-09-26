(() => {
  const AI_PERMISSION = "driver:puter-chat-completion:complete";

  const params = new URLSearchParams(location.search);
  const state = String(params.get("state") || "");
  const requestAuth = params.get("request_auth") !== "0";

  const status = document.getElementById("status");
  const button = document.getElementById("connectBtn");

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = "status" + (type ? " " + type : "");
  }

  function fail(message) {
    setStatus(message, "error");
    button.disabled = false;
  }

  if (!state || state.length < 16) {
    fail("Invalid JobPilot bridge request. Close this page and try again from JobPilot.");
    return;
  }

  if (!window.opener) {
    fail("JobPilot did not open this bridge window. Close it and use Connect Puter inside JobPilot.");
    return;
  }

  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      if (!globalThis.puter?.auth?.signIn) {
        throw new Error("Puter.js did not load. Check your connection and try again.");
      }

      setStatus("Opening Puter sign-in…");

      const result = await puter.auth.signIn({
        request_auth: requestAuth
      });

      const token = String(result?.token || "");

      if (!token) {
        throw new Error("Puter signed in but did not return an auth token.");
      }

      setStatus("Requesting AI permission…");

      const granted = await puter.ui.requestPermission({
        permission: AI_PERMISSION
      });

      if (granted !== true) {
        throw new Error("Puter AI permission was not granted.");
      }

      setStatus("Connected. Returning to JobPilot…", "success");

      window.opener.postMessage(
        {
          type: "jobpilot.puter.bridge.complete",
          state,
          token,
          aiAuthorized: true
        },
        "*"
      );

      setTimeout(() => window.close(), 500);
    } catch (error) {
      fail(
        error?.message ||
        error?.msg ||
        error?.error ||
        String(error)
      );
    }
  });
})();
