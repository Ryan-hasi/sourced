/**
 * Sourced Dashboard — Clerk-authenticated admin interface.
 * Authenticates via Clerk, proxies admin requests through /api/dashboard/proxy.
 */

const PUBLISHABLE_KEY = "pk_test_ZnJlc2gtcmF0dGxlci05MC5jbGVyay5hY2NvdW50cy5kZXYk";
const API_BASE = window.location.origin;

let sessionToken = null;

function showToast(msg, duration = 3000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

async function proxy(endpoint, body = {}) {
  if (!sessionToken) throw new Error("not authenticated");
  const res = await fetch(`${API_BASE}/api/dashboard/proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ _endpoint: endpoint, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function refreshSession() {
  try {
    const session = window.Clerk.session;
    if (session) {
      sessionToken = await session.getToken();
    }
  } catch {
    sessionToken = null;
  }
}

function showDashboard() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("dashboard-container").style.display = "block";
  loadKeys();
  loadChains();
  loadStats();
  loadAudit();
}

function showAuth() {
  document.getElementById("auth-container").style.display = "flex";
  document.getElementById("dashboard-container").style.display = "none";
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
        <td>${esc(k.chainId || "—")}</td>
        <td>
          ${k.status === "active"
            ? `<button class="btn" onclick="disableKey('${esc(k.key)}')">Disable</button>`
            : `<button class="btn" onclick="enableKey('${esc(k.key)}')">Enable</button>`}
          <button class="btn btn-danger" onclick="revokeKey('${esc(k.key)}')">Revoke</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    document.getElementById("keys-table").innerHTML = `<tr><td colspan="6">Error: ${esc(err.message)}</td></tr>`;
  }
}

async function createKey() {
  const name = document.getElementById("new-key-name").value.trim();
  if (!name) return showToast("Name required");
  try {
    const data = await proxy("keys", { action: "create", name });
    document.getElementById("new-key-result").innerHTML =
      `<div class="card" style="border-color: #4ade80;"><strong>New key (store now — shown once):</strong><br><code>${esc(data.key)}</code></div>`;
    document.getElementById("new-key-name").value = "";
    loadKeys();
    showToast("Key created");
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

async function disableKey(keyMasked) {
  if (!confirm(`Disable ${keyMasked}?`)) return;
  try {
    await proxy("keys", { action: "disable", key: keyMasked });
    loadKeys();
    showToast("Key disabled");
  } catch (err) { showToast(`Error: ${err.message}`); }
}

async function enableKey(keyMasked) {
  try {
    await proxy("keys", { action: "enable", key: keyMasked });
    loadKeys();
    showToast("Key enabled");
  } catch (err) { showToast(`Error: ${err.message}`); }
}

async function revokeKey(keyMasked) {
  if (!confirm(`Permanently revoke ${keyMasked}? This cannot be undone.`)) return;
  try {
    await proxy("keys", { action: "revoke", key: keyMasked });
    loadKeys();
    loadAudit();
    showToast("Key revoked");
  } catch (err) { showToast(`Error: ${err.message}`); }
}

// ── Chains ───────────────────────────────────────────────────────────────
async function loadChains() {
  try {
    const data = await proxy("chains");
    const tbody = document.getElementById("chains-table");
    if (!data.chains || data.chains.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No chains.</td></tr>';
      return;
    }
    tbody.innerHTML = data.chains.map((c) => `
      <tr>
        <td>${esc(c.chainId)}</td>
        <td>${esc(c.name || "—")}</td>
        <td>${c.seq ?? "—"}</td>
        <td title="${esc(c.head || "")}">${esc((c.head || "").slice(0, 16))}…</td>
        <td>${esc(c.ts?.slice(0, 16).replace("T", " ") || "—")}</td>
      </tr>
    `).join("");
  } catch (err) {
    document.getElementById("chains-table").innerHTML = `<tr><td colspan="5">Error: ${esc(err.message)}</td></tr>`;
  }
}

// ── Stats ────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const data = await proxy("stats");
    const el = document.getElementById("stats-content");
    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="value">${data.keys.total}</div><div class="label">Total Keys</div></div>
        <div class="stat-card"><div class="value">${data.keys.active}</div><div class="label">Active</div></div>
        <div class="stat-card"><div class="value">${data.keys.disabled}</div><div class="label">Disabled</div></div>
        <div class="stat-card"><div class="value">${data.chains.total}</div><div class="label">Chains</div></div>
        <div class="stat-card"><div class="value">${data.chains.totalRecords}</div><div class="label">Total Records</div></div>
        <div class="stat-card"><div class="value"><span class="badge ${data.kv.healthy ? "badge-ok" : "badge-err"}">${data.kv.healthy ? "OK" : "DOWN"}</span></div><div class="label">KV Health${data.kv.latencyMs ? ` (${data.kv.latencyMs}ms)` : ""}</div></div>
      </div>
      <p style="color:var(--text-muted);font-size:0.75rem;">Generated: ${esc(data.generatedAt)}</p>
    `;
  } catch (err) {
    document.getElementById("stats-content").innerHTML = `<p>Error: ${esc(err.message)}</p>`;
  }
}

// ── Audit ────────────────────────────────────────────────────────────────
async function loadAudit() {
  try {
    const data = await proxy("keys", { action: "audit" });
    const tbody = document.getElementById("audit-table");
    if (!data.entries || data.entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No audit entries.</td></tr>';
      return;
    }
    tbody.innerHTML = data.entries.slice().reverse().map((e) => `
      <tr>
        <td>${esc(e.ts?.slice(0, 16).replace("T", " ") || "—")}</td>
        <td>${esc(e.action)}</td>
        <td>${esc(e.key || "—")}</td>
        <td>${esc(e.detail || "—")}</td>
        <td>${esc(e.ip || "—")}</td>
      </tr>
    `).join("");
  } catch (err) {
    document.getElementById("audit-table").innerHTML = `<tr><td colspan="5">Error: ${esc(err.message)}</td></tr>`;
  }
}

// ── Utilities ────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

// ── Clerk init ───────────────────────────────────────────────────────────
(async function initClerk() {
  try {
    if (!window.Clerk || typeof window.Clerk.load !== "function") {
      document.getElementById("auth-container").innerHTML =
        '<p style="color:#f87171;">Clerk SDK failed to load. Check your connection or ad-blocker.</p>';
      return;
    }

    await window.Clerk.load({ publishableKey: PUBLISHABLE_KEY });

    window.Clerk.addListener(({ session }) => {
      if (session) {
        refreshSession().then(showDashboard);
      } else {
        showAuth();
      }
    });

    if (window.Clerk.session) {
      await refreshSession();
      showDashboard();
      window.Clerk.mountUserButton(document.getElementById("user-button"));
    } else {
      showAuth();
      window.Clerk.mountSignIn(document.getElementById("auth-container"));
    }
  } catch (err) {
    console.error("Clerk init error:", err);
    document.getElementById("auth-container").innerHTML =
      `<p style="color:#f87171;">Authentication error: ${esc(err.message || err)}</p>`;
  }
})();
