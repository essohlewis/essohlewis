/* =============================================================================
   Amoura — client API interne (fetch + CSRF + JSON)
   ========================================================================== */
(function (global) {
  "use strict";

  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute("content") : "";
  }

  async function request(method, url, body, opts = {}) {
    const headers = { Accept: "application/json" };
    const config = { method, headers, credentials: "same-origin" };

    if (method !== "GET" && method !== "HEAD") {
      headers["X-CSRF-Token"] = csrfToken();
    }
    if (body instanceof FormData) {
      config.body = body; // le navigateur fixe le Content-Type multipart
    } else if (body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json";
      config.body = JSON.stringify(body);
    }
    Object.assign(config, opts);

    const res = await fetch(url, config);
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
      const message = (data && data.error) || "Une erreur est survenue.";
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  global.Api = {
    get: (url) => request("GET", url),
    post: (url, body) => request("POST", url, body),
    put: (url, body) => request("PUT", url, body),
    del: (url, body) => request("DELETE", url, body),
    upload: (url, formData) => request("POST", url, formData),
    csrfToken,
  };
})(window);
