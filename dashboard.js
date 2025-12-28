// ---------------------------------------------------------
// SUPABASE CLIENT (WITH REAL KEY)
// ---------------------------------------------------------
const SUPABASE_URL = "https://hagiyjmimmdaubrgndik.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ2l5am1pbW1kYXVicmduZGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTQ4ODAsImV4cCI6MjA4MjQ5MDg4MH0.bTCzaL35Qk7UDduqmsyfyXKkLQBulrEZ0IbZ3ZA6S_s";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let glyphNodes = [];
let entries = [];

// ---------------------------------------------------------
// LOAD GLYPHS
// ---------------------------------------------------------
fetch("glyphs.json")
  .then(res => res.json())
  .then(data => {
    glyphNodes = data.glyphNodes;
    refreshDashboard();
  });

// ---------------------------------------------------------
// LOAD ENTRIES
// ---------------------------------------------------------
async function loadEntries() {
  const { data, error } = await db
    .from("entries")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading entries:", error);
    return [];
  }

  return data.map(e => ({
    ...e,
    glyphNodeId: e.glyphnodeid
  }));
}

// ---------------------------------------------------------
// REFRESH DASHBOARD
// ---------------------------------------------------------
async function refreshDashboard() {
  entries = await loadEntries();
  renderStats();
  renderFeed();
  renderGlyphMap();
}

// ---------------------------------------------------------
// RENDER STATS
// ---------------------------------------------------------
function renderStats() {
  document.getElementById("totalEntries").textContent =
    `Total Entries: ${entries.length}`;

  const counts = {};
  entries.forEach(e => {
    counts[e.glyphNodeId] = (counts[e.glyphNodeId] || 0) + 1;
  });

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  document.getElementById("topGlyph").textContent =
    top ? `Top Glyph: ${top[0]} (${top[1]})` : "Top Glyph: None";

  const kiosk = entries.filter(e => e.devicetype === "kiosk-or-phone").length;
  const phone = entries.length - kiosk;

  document.getElementById("deviceBreakdown").textContent =
    `Devices — Kiosk: ${kiosk}, Phone: ${phone}`;
}

// ---------------------------------------------------------
// RENDER FEED
// ---------------------------------------------------------
function renderFeed() {
  const ul = document.getElementById("feedList");
  ul.innerHTML = "";

  entries.slice().reverse().forEach(e => {
    const li = document.createElement("li");
    li.textContent =
      `${e.guestname} (${e.relationship}) → ${e.glyph} — "${e.message}"`;
    ul.appendChild(li);
  });
}

// ---------------------------------------------------------
// RENDER GLYPH MAP (WITH LINES, PULSE, TOOLTIP)
// ---------------------------------------------------------
function renderGlyphMap() {
  const svg = document.getElementById("glyphMap");
  svg.innerHTML = "";

  const size = 400;
  const radius = 140;
  const center = size / 2;

  // Make sure there's only one tooltip
  let tooltip = document.querySelector(".tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    document.body.appendChild(tooltip);
  }

  // Nucleus (optional, looks nice)
  const nucleus = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  nucleus.setAttribute("cx", center);
  nucleus.setAttribute("cy", center);
  nucleus.setAttribute("r", 40);
  nucleus.setAttribute("fill", "#111827");
  svg.appendChild(nucleus);

  const nucleusText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  nucleusText.setAttribute("x", center);
  nucleusText.setAttribute("y", center + 4);
  nucleusText.setAttribute("text-anchor", "middle");
  nucleusText.setAttribute("fill", "#F9FAFB");
  nucleusText.textContent = "The Couple";
  svg.appendChild(nucleusText);

  glyphNodes.forEach((node, index) => {
    const angle = (index / glyphNodes.length) * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    const count = entries.filter(e => e.glyphNodeId === node.id).length;

    // Radial line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", center);
    line.setAttribute("y1", center);
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#D1D5DB");
    svg.appendChild(line);

    // Node circle with pulse if active
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 20);
    circle.setAttribute("fill", node.color);
    circle.setAttribute("stroke", "#111827");
    if (count > 0) {
      circle.classList.add("pulse");
    }
    svg.appendChild(circle);

    // Label (above)
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y - 32);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12");
    label.setAttribute("paint-order", "stroke");
    label.setAttribute("stroke", "#f5f6fa");
    label.setAttribute("stroke-width", "3");
    label.textContent = node.label;
    svg.appendChild(label);

    // Count (below)
    const countText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    countText.setAttribute("x", x);
    countText.setAttribute("y", y + 16);
    countText.setAttribute("text-anchor", "middle");
    countText.setAttribute("font-size", "12");
    countText.textContent = `(${count})`;
    svg.appendChild(countText);

    // Tooltip on hover
    const updateTooltipPosition = (evt) => {
      const rect = svg.getBoundingClientRect();
      tooltip.style.left = `${rect.left + x}px`;
      tooltip.style.top = `${rect.top + y - 40}px`;
    };

    circle.addEventListener("mouseenter", (evt) => {
      tooltip.textContent = `${node.label}: ${count} entr${count === 1 ? "y" : "ies"}`;
      tooltip.style.opacity = 1;
      updateTooltipPosition(evt);
    });

    circle.addEventListener("mousemove", updateTooltipPosition);

    circle.addEventListener("mouseleave", () => {
      tooltip.style.opacity = 0;
    });
  });
}

// ---------------------------------------------------------
// REALTIME UPDATES
// ---------------------------------------------------------
db.channel("entries-realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "entries" },
    () => refreshDashboard()
  )
  .subscribe();

// ---------------------------------------------------------
// CONTROLS
// ---------------------------------------------------------

// Lockout toggle (expects a settings table with key="lockout")
document.getElementById("toggleLockout").addEventListener("click", async () => {
  try {
    const { data, error } = await db
      .from("settings")
      .select("value")
      .eq("key", "lockout")
      .maybeSingle();

    if (error) {
      console.error("Error reading lockout:", error);
      return;
    }

    const current = data ? data.value : false;
    const { error: updateError } = await db
      .from("settings")
      .upsert({ key: "lockout", value: !current }, { onConflict: "key" });

    if (updateError) {
      console.error("Error toggling lockout:", updateError);
    } else {
      console.log("Lockout set to:", !current);
    }
  } catch (err) {
    console.error("Unexpected lockout error:", err);
  }
});

// Export JSON
document.getElementById("exportJSON").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(entries, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "entries.json";
  a.click();
});

// Export CSV
document.getElementById("exportCSV").addEventListener("click", () => {
  const header =
    "guestname,relationship,message,glyphnodeid,glyph,created_at\n";
  const rows = entries
    .map(
      e =>
        `${e.guestname || ""},${e.relationship || ""},${(e.message || "").replace(/\n/g, " ")},${e.glyphnodeid || ""},${e.glyph || ""},${e.created_at || ""}`
    )
    .join("\n");

  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "entries.csv";
  a.click();
});
