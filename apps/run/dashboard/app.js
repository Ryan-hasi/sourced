/**
 * Sourced Control Deck — Application Logic.
 *
 * Auth flow (SPA, no page redirects):
 *   1. init() loads Clerk with publishable key from /api/dashboard/session
 *   2. If Clerk has an active session → verify server-side → show dashboard or access-denied
 *   3. If no session → show Clerk sign-in component
 *   4. Clerk listener detects sign-in → verify server-side → show dashboard
 *   5. Sign-out button → Clerk.signOut() → redirect to /
 */

const API_BASE = window.location.origin;

let sessionToken = null;

/* ── Helpers ─────────────────────────────────────────────────────────── */

function esc(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

function showToast(msg, duration = 3000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

function copyToClipboard(text, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => showToast(`${label} to clipboard!`)).catch(() => showToast("Failed to copy"));
}

/* ── Clerk SDK loader ────────────────────────────────────────────────── */

let clerkInstance = null;
let clerkLoading = null;

/**
 * Fetch the Sourced publishable key from the server (never hardcoded).
 * Falls back to null if the server is unreachable — auth will fail gracefully.
 */
async function fetchPublishableKey() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard/session`);
    const data = await res.json();
    return data.publishableKey || null;
  } catch {
    return null;
  }
}

/**
 * Load Clerk JS SDK exactly once. Returns the Clerk instance or null.
 */
async function loadClerk() {
  if (clerkInstance) return clerkInstance;
  if (clerkLoading) return clerkLoading;

  clerkLoading = (async () => {
    const publishableKey = await fetchPublishableKey();
    if (!publishableKey) {
      console.error("No Clerk publishable key available — auth disabled.");
      return null;
    }

    // If Clerk was already injected (e.g. from a previous mount), reuse it.
    if (window.Clerk) {
      if (!window.Clerk.isReady) {
        await window.Clerk.load({ publishableKey });
      }
      clerkInstance = window.Clerk;
      return clerkInstance;
    }

    // Load Clerk JS from CDN.
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.setAttribute("data-clerk-publishable-key", publishableKey);
      script.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
      script.async = true;
      const timer = setTimeout(() => reject(new Error("Clerk script timeout")), 12000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(new Error("Clerk script failed")); };
      document.head.appendChild(script);
    });

    if (!window.Clerk) throw new Error("Clerk global not found after script load");

    if (!window.Clerk.isReady) {
      await window.Clerk.load({ publishableKey });
    }

    clerkInstance = window.Clerk;
    return clerkInstance;
  })();

  try {
    return await clerkLoading;
  } catch (err) {
    console.error("Failed to load Clerk:", err);
    clerkLoading = null;
    return null;
  }
}

/* ── Server-side session verification ────────────────────────────────── */

async function verifySessionToken(token) {
  if (!token) return { status: "unauthenticated" };
  try {
    const res = await fetch(`${API_BASE}/api/dashboard/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.authorized) {
      return { status: "authorized", email: data.email };
    }
    if (data.authenticated && !data.authorized) {
      return { status: "denied", email: data.email, reason: data.error };
    }
  } catch (err) {
    console.error("Server authorization check failed:", err);
  }
  return { status: "unauthenticated" };
}

/**
 * Get a fresh session token from Clerk. Returns null if no active session.
 */
async function getSessionToken() {
  const clerk = clerkInstance || window.Clerk;
  if (!clerk || !clerk.session) return null;
  try {
    return await clerk.session.getToken();
  } catch {
    return null;
  }
}

/* ── UI state transitions ────────────────────────────────────────────── */

function showDashboard(email) {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("access-denied-container").style.display = "none";
  document.getElementById("dashboard-container").style.display = "block";
  const userEl = document.getElementById("user-display");
  if (userEl) {
    userEl.textContent = email || clerkInstance?.user?.primaryEmailAddress?.emailAddress || "Administrator";
  }
  loadKeys();
  loadChains();
  loadStats();
  loadAudit();
}

function showAccessDenied(email, reason) {
  document.getElementById("dashboard-container").style.display = "none";
  document.getElementById("auth-container").style.display = "none";
  const deniedEl = document.getElementById("access-denied-container");
  deniedEl.style.display = "flex";
  document.getElementById("denied-reason").textContent =
    reason || `Account (${email || "your account"}) is not an authorized administrator.`;
}

function showAuth() {
  document.getElementById("dashboard-container").style.display = "none";
  document.getElementById("access-denied-container").style.display = "none";
  document.getElementById("auth-container").style.display = "flex";
  mountClerkSignIn();
}

/* ── Clerk sign-in mount ─────────────────────────────────────────────── */

let signInMounted = false;

async function mountClerkSignIn() {
  const mountEl = document.getElementById("auth-mount");
  if (!mountEl) return;

  const clerk = clerkInstance;
  if (!clerk) {
    mountEl.innerHTML = '<div style="color:#f87171;padding:1rem;text-align:center;">Failed to load authentication service. Please refresh the page.</div>';
    return;
  }

  // Unmount any previous sign-in instance to avoid double-mount errors.
  if (signInMounted) {
    try { clerk.unmountSignIn(mountEl); } catch {}
  }

  mountEl.innerHTML = "";

  try {
    const dashboardUrl = `${window.location.origin}/dashboard/`;
    clerk.mountSignIn(mountEl, {
      forceRedirectUrl: dashboardUrl,
      fallbackRedirectUrl: dashboardUrl,
      appearance: {
        variables: {
          colorPrimary: "#e5484d",
          colorBackground: "#12141d",
          colorText: "#ffffff",
          colorTextSecondary: "#a1a1aa",
          colorTextOnPrimaryBackground: "#ffffff",
          colorInputBackground: "#181b26",
          colorInputText: "#ffffff",
          borderRadius: "8px",
        },
        elements: {
          socialButtonsBlockButton: {
            backgroundColor: "#1c202e !important",
            borderColor: "rgba(255, 255, 255, 0.18) !important",
            color: "#ffffff !important",
          },
          socialButtonsBlockButtonText: {
            color: "#ffffff !important",
            fontWeight: "600 !important",
            opacity: "1 !important",
          },
          socialButtonsBlockButtonArrow: { color: "#ffffff !important" },
          formFieldLabel: { color: "#e4e4e7 !important" },
          footerActionText: { color: "#a1a1aa !important" },
          footerActionLink: { color: "#e5484d !important", fontWeight: "600 !important" },
        },
      },
    });
    signInMounted = true;
  } catch (err) {
    console.error("Clerk mountSignIn failed:", err);
    mountEl.innerHTML = '<div style="color:#f87171;padding:1rem;text-align:center;">Authentication component failed to load. Please refresh.</div>';
  }
}

/* ── Authenticated API proxy ─────────────────────────────────────────── */

async function proxy(endpoint, body = {}) {
  // Always get a fresh token for every API call.
  sessionToken = await getSessionToken();
  if (!sessionToken) {
    showAuth();
    throw new Error("Authentication required");
  }
  const res = await fetch(`${API_BASE}/api/dashboard/proxy`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ _endpoint: endpoint, ...body }),
  });
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    if (res.status === 403) {
      showAccessDenied("", data.error);
    } else {
      showAuth();
    }
    throw new Error(data.error || "Authentication failed");
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Sign out ────────────────────────────────────────────────────────── */

async function signOut() {
  sessionToken = null;
  const clerk = clerkInstance || window.Clerk;
  if (clerk && clerk.signOut) {
    try { await clerk.signOut(); } catch {}
  }
  window.location.href = "/";
}

/* ── Tab navigation ──────────────────────────────────────────────────── */

document.querySelectorAll(".dash-nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".dash-nav button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".dash-section").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

/* ── Keys ─────────────────────────────────────────────────────────────── */

async function loadKeys() {
  try {
    const data = await proxy("keys", { action: "list" });
    const tbody = document.getElementById("keys-table");
    if (!data.keys || data.keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No keys issued yet.</td></tr>';
      return;
    }
    tbody.innerHTML = data.keys.map((k) => `
      <tr>
        <td>${esc(k.key)}</td>
        <td>${esc(k.name)}</td>
        <td><span class="badge ${k.status === "active" ? "badge-active" : "badge-disabled"}">${k.status}</span></td>
        <td>${esc(k.createdAt?.slice(0, 10) || "—")}</td>
        <td><code>${esc(k.chainId)}</code></td>
        <td>
          <button class="btn ${k.status === "active" ? "btn-danger" : "btn-primary"}" onclick="toggleKeyStatus('${esc(k.key)}', '${k.status}')">
            ${k.status === "active" ? "Disable" : "Enable"}
          </button>
          <button class="btn btn-danger" onclick="revokeKey('${esc(k.key)}')">Revoke</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    const tbody = document.getElementById("keys-table");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="badge-disabled">Failed: ${esc(err.message)}</td></tr>`;
  }
}

async function createKey() {
  const nameInput = document.getElementById("new-key-name");
  const name = nameInput.value.trim();
  if (!name) return showToast("Enter a key name first");
  try {
    const data = await proxy("keys", { action: "create", name });
    nameInput.value = "";
    document.getElementById("new-key-result").innerHTML = `
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);padding:1rem;border-radius:8px;margin-top:1rem;">
        <div style="font-weight:600;color:#4ade80;">Key Issued! Copy it now — it won't be shown again:</div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
          <input value="${esc(data.key)}" readonly style="flex:1;" id="issued-key-val" />
          <button class="btn btn-primary" onclick="copyToClipboard(document.getElementById('issued-key-val').value, 'API Key')">Copy</button>
        </div>
      </div>
    `;
    loadKeys();
    loadAudit();
  } catch (err) {
    showToast(`Failed: ${err.message}`);
  }
}

async function toggleKeyStatus(keyMask, currentStatus) {
  const action = currentStatus === "active" ? "disable" : "enable";
  if (!confirm(`Are you sure you want to ${action} key ${keyMask}?`)) return;
  try {
    await proxy("keys", { action, key: keyMask });
    showToast(`Key ${action}d successfully`);
    loadKeys();
    loadAudit();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

async function revokeKey(keyMask) {
  if (!confirm(`REVOKE KEY ${keyMask}? This action is immediate and cannot be undone.`)) return;
  try {
    await proxy("keys", { action: "revoke", key: keyMask });
    showToast("Key revoked");
    loadKeys();
    loadAudit();
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

/* ── Chains ───────────────────────────────────────────────────────────── */

async function loadChains() {
  try {
    const data = await proxy("chains");
    const tbody = document.getElementById("chains-table");
    if (!data.chains || data.chains.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No active hosted chains.</td></tr>';
      return;
    }
    tbody.innerHTML = data.chains.map((c) => `
      <tr>
        <td><code>${esc(c.id)}</code></td>
        <td>${esc(c.name || "Hosted Chain")}</td>
        <td>${esc(c.seq)}</td>
        <td><code>${esc(c.head ? c.head.slice(0, 16) + "…" : "genesis")}</code></td>
        <td>${esc(c.updatedAt ? new Date(c.updatedAt).toISOString().slice(0, 16).replace("T", " ") : "—")}</td>
      </tr>
    `).join("");
  } catch (err) {
    const tbody = document.getElementById("chains-table");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="badge-disabled">Failed: ${esc(err.message)}</td></tr>`;
  }
}

/* ── Stats / Telemetry ────────────────────────────────────────────────── */

async function loadStats() {
  try {
    const data = await proxy("stats");
    const el = document.getElementById("stats-content");
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <div class="value">${esc(data.totalKeys ?? 0)}</div>
          <div class="label">Total Keys</div>
        </div>
        <div class="stat-card">
          <div class="value">${esc(data.activeKeys ?? 0)}</div>
          <div class="label">Active Keys</div>
        </div>
        <div class="stat-card">
          <div class="value">${esc(data.totalChains ?? 0)}</div>
          <div class="label">Hosted Chains</div>
        </div>
        <div class="stat-card">
          <div class="value">${esc(data.totalRecords ?? 0)}</div>
          <div class="label">Total Chain Records</div>
        </div>
      </div>
      <div class="card">
        <h3>KV Storage Telemetry</h3>
        <table>
          <thead><tr><th>Metric</th><th>Value</th></tr></thead>
          <tbody>
            <tr><td>Archive Keys Saved</td><td>${esc(data.archiveKeysCount ?? 0)}</td></tr>
            <tr><td>Total Audit Log Entries</td><td>${esc(data.auditEntriesCount ?? 0)}</td></tr>
            <tr><td>Server Timestamp</td><td>${esc(data.timestamp || new Date().toISOString())}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    const el = document.getElementById("stats-content");
    if (el) el.innerHTML = `<div class="card"><p class="badge-disabled">Telemetry load failed: ${esc(err.message)}</p></div>`;
  }
}

/* ── Audit Log ────────────────────────────────────────────────────────── */

let cachedAuditEntries = [];

async function loadAudit() {
  try {
    const data = await proxy("keys", { action: "audit", limit: 100 });
    const tbody = document.getElementById("audit-table");
    cachedAuditEntries = data.entries || [];
    if (cachedAuditEntries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No audit log entries recorded.</td></tr>';
      return;
    }
    tbody.innerHTML = [...cachedAuditEntries].reverse().map((e) => `
      <tr>
        <td>${esc(e.ts ? new Date(e.ts).toISOString().slice(0, 19).replace("T", " ") : "—")}</td>
        <td><span class="badge ${e.action === "revoke" || e.action === "disable" ? "badge-disabled" : "badge-ok"}">${esc(e.action)}</span></td>
        <td><code>${esc(e.key || "—")}</code></td>
        <td>${esc(e.detail || "—")}</td>
        <td><code>${esc(e.ip || "—")}</code></td>
      </tr>
    `).join("");
  } catch (err) {
    const tbody = document.getElementById("audit-table");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="badge-disabled">Audit load failed: ${esc(err.message)}</td></tr>`;
  }
}

function exportAuditLog(format) {
  try {
    if (!cachedAuditEntries || cachedAuditEntries.length === 0) {
      showToast("No audit records available to export");
      return;
    }
    const entries = cachedAuditEntries;
    let content = "";
    let mimeType = "application/json";
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `sourced-telemetry-errors-${timestamp}.${format}`;

    if (format === "csv") {
      mimeType = "text/csv";
      const headers = ["Timestamp", "Action", "Key", "Detail", "IP"];
      const rows = entries.map((e) => [
        `"${e.ts || ""}"`,
        `"${e.action || ""}"`,
        `"${e.key || ""}"`,
        `"${String(e.detail || "").replace(/"/g, '""')}"`,
        `"${e.ip || ""}"`,
      ]);
      content = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    } else {
      content = JSON.stringify(entries, null, 2);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${entries.length} log entries as ${format.toUpperCase()}`);
  } catch (err) {
    showToast(`Export error: ${err.message}`);
  }
}

/* ── Init ─────────────────────────────────────────────────────────────── */

/**
 * Detect if this page load is a return from an OAuth redirect.
 * Clerk appends __clerk_status or __clerk_db_jwt to the URL after OAuth.
 * We also check for a fresh sign-in flag we set ourselves.
 */
function isOAuthReturn() {
  const params = new URLSearchParams(window.location.search);
  return params.has("__clerk_status") || params.has("__clerk_db_jwt") ||
         params.has("__clerk_ticket") || params.has("__clerk_created_session");
}

/**
 * Clean Clerk query params from the URL bar without triggering a page reload.
 */
function cleanUrl() {
  const url = new URL(window.location.href);
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("__clerk")) url.searchParams.delete(key);
  }
  if (url.toString() !== window.location.href) {
    window.history.replaceState({}, "", url.toString());
  }
}

(async function init() {
  sessionToken = null;

  const clerk = await loadClerk();
  if (!clerk) {
    const mountEl = document.getElementById("auth-mount");
    if (mountEl) {
      mountEl.innerHTML = '<div style="color:#f87171;padding:1rem;text-align:center;">Authentication service unavailable. Check that CLERK_PUBLISHABLE_KEY is set.</div>';
    }
    document.getElementById("auth-container").style.display = "flex";
    return;
  }

  // Attach the session listener ONCE — drives all auth state transitions
  // (fires when user completes sign-in via mounted component).
  clerk.addListener(async ({ session }) => {
    if (session) {
      try {
        const token = await session.getToken();
        if (token) {
          sessionToken = token;
          const result = await verifySessionToken(token);
          if (result.status === "authorized") {
            showDashboard(result.email);
          } else if (result.status === "denied") {
            showAccessDenied(result.email, result.reason);
          }
        }
      } catch (err) {
        console.error("Session listener error:", err);
      }
    }
  });

  const oauthReturn = isOAuthReturn();
  cleanUrl();

  if (clerk.session) {
    if (oauthReturn) {
      // OAuth just completed — verify the fresh session.
      try {
        const token = await clerk.session.getToken();
        if (token) {
          sessionToken = token;
          const result = await verifySessionToken(token);
          if (result.status === "authorized") {
            showDashboard(result.email);
            return;
          }
          if (result.status === "denied") {
            showAccessDenied(result.email, result.reason);
            return;
          }
        }
      } catch (err) {
        console.warn("OAuth session check failed:", err);
      }
    }

    // NOT an OAuth return — this is a page refresh or direct visit.
    // Enforce ephemeral session: sign out the stale session first.
    try {
      await clerk.signOut();
    } catch {}
    sessionToken = null;
  }

  // No valid session — show sign-in.
  showAuth();
})();
