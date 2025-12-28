const SUPABASE_URL = "https://hagiyjmimmdaubrgndik.supabase.co";
const SUPABASE_KEY = "YOUR_KEY";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let glyphNodes = [];
let entries = [];

// Load glyphs
fetch("glyphs.json")
  .then(res => res.json())
  .then(data => {
    glyphNodes = data.glyphNodes;
    refreshDashboard();
  });

// Load entries
async function loadEntries() {
  const { data } = await db
    .from("entries")
    .select("*")
    .order("created_at", { ascending: true });

  return data.map(e => ({
    ...e,
    glyphNodeId: e.glyphnodeid
  }));
}

// Refresh dashboard
async function refreshDashboard() {
  entries = await loadEntries();
  renderStats();
  renderFeed();
  renderGlyphMap();
}

// Render stats
function renderStats() {
  document.getElementById("totalEntries").textContent =
    `Total Entries: ${entries.length}`;

  const counts = {};
  entries.forEach(e => {
    counts[e.glyphNodeId] = (counts[e.glyphNodeId] || 0) + 1;
  });

  const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  document.getElementById("topGlyph").textContent =
    top ? `Top Glyph: ${top[0]} (${top[1]})` : "Top Glyph: None";

  const kiosk = entries.filter(e => e.devicetype === "kiosk-or-phone").length;
  const phone = entries.length - kiosk;

  document.getElementById("deviceBreakdown").textContent =
    `Devices — Kiosk: ${kiosk}, Phone: ${phone}`;
}

// Render feed
function renderFeed() {
  const ul = document.getElementById("feedList");
  ul.innerHTML = "";

  entries.slice().reverse().forEach(e => {
    const li = document.createElement("li");
    li.textContent = `${e.guestname} (${e.relationship}) → ${e.glyph} — "${e.message}"`;
    ul.appendChild(li);
  });
}

// Render glyph map (reuse your existing logic)
function renderGlyphMap() {
  const svg = document.getElementById("glyphMap");
  svg.innerHTML = "";

  const size = 400;
  const radius = 140;
  const center = size / 2;

  glyphNodes.forEach((node, index) => {
    const angle = (index / glyphNodes.length) * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);

    const count = entries.filter(e => e.glyphNodeId === node.id).length;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 20);
    circle.setAttribute("fill", node.color);
    svg.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y - 28);
    label.setAttribute("text-anchor", "middle");
    label.textContent = `${node.label} (${count})`;
    svg.appendChild(label);
  });
}

// Real-time updates
db.channel("entries-realtime")
  .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, () => {
    refreshDashboard();
  })
  .subscribe();

// Lockout toggle
document.getElementById("toggleLockout").addEventListener("click", async () => {
  await db.from("settings").update({ value: true }).eq("key", "lockout");
});

// Export JSON
document.getElementById("exportJSON").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "entries.json";
  a.click();
});

// Export CSV
document.getElementById("exportCSV").addEventListener("click", () => {
  const header = "guestname,relationship,message,glyphnodeid,glyph,created_at\n";
  const rows = entries.map(e =>
    `${e.guestname},${e.relationship},${e.message},${e.glyphnodeid},${e.glyph},${e.created_at}`
  ).join("\n");

  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "entries.csv";
  a.click();
});
