/**
 * Sourced Control Deck Application Logic.
 * Strict Clerk auth & server-verified admin authorization.
 */

const API_BASE = window.location.origin;

let sessionToken = null;
let clerkPublishableKey = null;

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

async function loadClerkSDK(key) {
  if (window.Clerk && window.Clerk.isReady) return window.Clerk;
  if (!key) return null;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.setAttribute("data-clerk-publishable-key", key);
    script.src = "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
    script.async = true;

    // Timeout safeguard so the page NEVER hangs on loading
    const timer = setTimeout(() => {
      resolve(window.Clerk || null);
    }, 6000);

    script.onload = async () => {
      clearTimeout(timer);
      try {
        if (window.Clerk) {
          if (!window.Clerk.isReady) {
            await window.Clerk.load();
          }
          resolve(window.Clerk);
        } else {
          resolve(null);
        }
      } catch (err) {
        console.warn("Clerk load failed:", err);
        resolve(null);
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    document.head.appendChild(script);
  });
}

async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard/session`);
    const data = await res.json();
    if (data.publishableKey) {
      clerkPublishableKey = data.publishableKey;
    }
  } catch (err) {
    console.warn("Session endpoint check failed:", err);
  }

  if (clerkPublishableKey) {
    const clerk = await loadClerkSDK(clerkPublishableKey);
    if (clerk && clerk.session) {
      try {
        sessionToken = await clerk.session.getToken();
      } catch (e) {
        console.warn("Failed to get Clerk session token:", e);
      }
    }
  }

  if (!sessionToken) return { status: "unauthenticated" };

  try {
    const res = await fetch(`${API_BASE}/api/dashboard/session`, {
      headers: { "Authorization": `Bearer ${sessionToken}` },
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

async function mountClerkSignIn() {
  const mountEl = document.getElementById("auth-mount");
  if (!clerkPublishableKey) {
    if (mountEl) {
      mountEl.innerHTML = `
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);padding:1.5rem;border-radius:10px;max-width:460px;margin:0 auto;text-align:center;">
          <div style="font-weight:600;color:#f87171;margin-bottom:0.5rem;font-size:1rem;">Sourced Clerk App Required</div>
          <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 1rem;line-height:1.4;">
            Please set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> in Vercel for the Sourced project to enable authentication.
          </p>
        </div>
      `;
    }
    return;
  }
  const clerk = await loadClerkSDK(clerkPublishableKey);

  if (clerk && mountEl) {
    mountEl.innerHTML = "";
    clerk.addListener(async ({ session }) => {
      if (session) {
        try {
          sessionToken = await session.getToken();
          if (sessionToken) {
            const authResult = await checkSession();
            if (authResult.status === "authorized") showDashboard(authResult.email);
            else if (authResult.status === "denied") showAccessDenied(authResult.email, authResult.reason);
          }
        } catch { /* ignore */ }
      }
    });
    try {
      clerk.mountSignIn(mountEl, {
        appearance: {
          variables: {
            colorPrimary: "#e5484d",
            colorBackground: "#12141d",
            colorText: "#f3f4f6",
            colorInputBackground: "#090a0f",
            colorInputText: "#ffffff",
            borderRadius: "8px"
          }
        }
      });
    } catch (err) {
      mountEl.innerHTML = `<div style="color:#f87171;padding:1rem;">Failed to render Sign-In form: ${esc(err.message)}</div>`;
    }
  } else if (mountEl) {
    mountEl.innerHTML = `
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:1.5rem;border-radius:8px;max-width:440px;margin:0 auto;">
        <div style="font-weight:600;color:#f87171;margin-bottom:0.5rem;">Authentication Configuration Required</div>
        <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 1rem;line-height:1.4;">
          The Clerk authentication SDK could not be initialized. Make sure <code>CLERK_SECRET_KEY</code> and <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> are configured in Vercel.
        </p>
        <button class="btn btn-primary" onclick="window.location.reload()">Retry Loading</button>
      </div>
    `;
  }
}

async function proxy(endpoint, body = {}) {
  if (!sessionToken && window.Clerk && window.Clerk.session) {
    try { sessionToken = await window.Clerk.session.getToken(); } catch { /* ignore */ }
  }
  if (!sessionToken) {
    showAuth();
    throw new Error("Authentication required");
  }
  const res = await fetch(`${API_BASE}/api/dashboard/proxy`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sessionToken}`,
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

function showDashboard(email) {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("access-denied-container").style.display = "none";
  document.getElementById("dashboard-container").style.display = "block";
  const userEl = document.getElementById("user-display");
  if (userEl) {
    userEl.textContent = email || window.Clerk?.user?.primaryEmailAddress?.emailAddress || "Administrator";
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
  document.getElementById("denied-reason").textContent = reason || `Account (${email || "your account"}) is not an authorized administrator.`;
}

function showAuth() {
  document.getElementById("dashboard-container").style.display = "none";
  document.getElementById("access-denied-container").style.display = "none";
  document.getElementById("auth-container").style.display = "flex";
  mountClerkSignIn();
}

async function signOut() {
  if (window.Clerk && window.Clerk.signOut) {
    await window.Clerk.signOut();
    window.location.reload();
  } else {
    window.location.reload();
  }
}

// ── Tab navigation ──────────────────────────────────────────────────────
document.querySelectorAll(".dash-nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".dash-nav button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".dash-section").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ── Keys ─────────────────────────────────────────────────────────────────
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

// ── Chains ───────────────────────────────────────────────────────────────
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

// ── Stats / Telemetry ────────────────────────────────────────────────────
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

// ── Audit Log ────────────────────────────────────────────────────────────
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

// ── Init & Security Cleanup ──────────────────────────────────────────────
window.addEventListener("beforeunload", () => {
  sessionToken = null;
});

(async function init() {
  sessionToken = null;
  const result = await checkSession();
  if (result.status === "authorized") {
    showDashboard(result.email);
  } else if (result.status === "denied") {
    showAccessDenied(result.email, result.reason);
  } else {
    showAuth();
  }
})();
