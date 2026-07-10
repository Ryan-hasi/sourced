// Sourced shared UI: theme toggle, code copy buttons, code tabs. No deps.
(() => {
  // theme toggle (initial theme is set inline in <head> to avoid a flash)
  const btn = document.getElementById("mode");
  if (btn) {
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch {}
    });
  }

  // copy buttons on every code block
  for (const pre of document.querySelectorAll("pre")) {
    const b = document.createElement("button");
    b.className = "copy";
    b.textContent = "COPY";
    b.addEventListener("click", async () => {
      try {
        const code = pre.querySelector("code");
        await navigator.clipboard.writeText((code ? code.innerText : pre.innerText).trim());
        b.textContent = "COPIED";
        b.classList.add("done");
        setTimeout(() => { b.textContent = "COPY"; b.classList.remove("done"); }, 1400);
      } catch {}
    });
    pre.appendChild(b);
  }

  // code tabs: <div class="tabs" data-for="id"><button data-pane="p1">…</div><div class="tabpanes" id="id"><pre class="on" id="p1">…
  for (const tabs of document.querySelectorAll(".tabs")) {
    const panes = document.getElementById(tabs.dataset.for);
    if (!panes) continue;
    tabs.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      for (const b of tabs.querySelectorAll("button")) b.classList.toggle("on", b === t);
      for (const p of panes.children) p.classList.toggle("on", p.id === t.dataset.pane);
    });
  }
})();
