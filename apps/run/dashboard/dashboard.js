/**
 * Sourced Dashboard — Clerk-authenticated admin interface.
 * Uses Account Portal (accounts.sourced.run) for auth.
 */

const PUBLISHABLE_KEY = "pk_test_ZnJlc2gtcmF0dGxlci05MC5jbGVyay5hY2NvdW50cy5kZXYk";
const API_BASE = window.location.origin;

let clerk = null;
let sessionToken = null;

function showToast(msg, duration = 3000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

function esc(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
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
    if (clerk && clerk.session) {
      sessionToken = await clerk.session.getToken();
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
  document.getElementById("auth-container").innerHTML =
    '<div style="text-align:center;">' +
    '<p style="margin-bottom:1rem;">Sign in to access the dashboard.</p>' +
    '<button class="btn" onclick="signIn()" style="padding:0.6rem 1.5rem;font-size:1rem;">Sign In</button>' +
    '</div>';
  document.getElementById("dashboard-container").style.display = "none";
}

function signIn() {
  if (clerk) {
    clerk.redirectToSignIn();
  }
}

function signOut() {
  if (clerk) {
    clerk.signOut();
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

// ── Clerk init ───────────────────────────────────────────────────────────
(async function initClerk() {
  const authContainer = document.getElementById("auth-container");
  const debug = document.getElementById("clerk-debug");

  function setDebug(msg) { if (debug) debug.textContent = msg; }

  try {
    setDebug("Waiting for Clerk SDK…");

    let waited = 0;
    while (!window.Clerk && waited < 10_000) {
      await new Promise((r) => setTimeout(r, 200));
      waited += 200;
    }

    if (!window.Clerk) {
      authContainer.innerHTML =
        '<div style="text-align:center;">' +
        '<p style="color:#f87171;">Clerk SDK failed to load.</p>' +
        '<p style="color:var(--text-muted);font-size:0.8rem;">Check your connection, ad-blocker, or try refreshing.</p>' +
        '</div>';
      return;
    }

    setDebug("Initializing Clerk…");
    clerk = new window.Clerk(PUBLISHABLE_KEY);

    setDebug("Loading Clerk (may take a few seconds)…");
    const loadPromise = clerk.load();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Clerk.load() timed out after 15s")), 15_000),
    );

    await Promise.race([loadPromise, timeoutPromise]);

    setDebug("Clerk loaded. Checking session…");

    clerk.addListener(({ session }) => {
      if (session) {
        refreshSession().then(showDashboard);
      } else {
        showAuth();
      }
    });

    if (clerk.session) {
      await refreshSession();
      showDashboard();
    } else {
      showAuth();
    }
  } catch (err) {
    console.error("Clerk init error:", err);
    setDebug("");
    authContainer.innerHTML =
      '<div style="text-align:center;">' +
      `<p style="color:#f87171;">Authentication error: ${esc(err.message || String(err))}</p>` +
      '<p style="color:var(--text-muted);font-size:0.8rem;margin-top:0.5rem;">Try refreshing the page. If the problem persists, check the browser console.</p>' +
      '<button class="btn" style="margin-top:1rem;" onclick="location.reload()">Reload</button>' +
      '</div>';
  }
})();
