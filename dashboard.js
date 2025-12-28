// ---------------------------------------------------------
// SUPABASE CLIENT (WITH REAL KEY)
// ---------------------------------------------------------
// const SUPABASE_URL = "https://hagiyjmimmdaubrgndik.supabase.co";
// const SUPABASE_KEY =
//  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ2l5am1pbW1kYXVicmduZGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTQ4ODAsImV4cCI6MjA4MjQ5MDg4MH0.bTCzaL35Qk7UDduqmsyfyXKkLQBulrEZ0IbZ3ZA6S_s";

// const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let glyphNodes = [];        // now loaded from Supabase
let themedGlyphs = [];      // glyphs after theme applied
let themes = {};            // all themes from DB
let themeConfig = {};       // active theme config
let entries = [];

// ---------------------------------------------------------
// LOAD GLYPHS (FROM SUPABASE, replacing glyphs.json)
// ---------------------------------------------------------
async function loadGlyphs() {
  const { data, error } = await db
    .from("glyphs")
    .select("*")
    .eq("active", true)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Error loading glyphs:", error);
    return [];
  }

  return data;
}

// ---------------------------------------------------------
// LOAD THEMES
// ---------------------------------------------------------
async function loadThemes() {
  const { data, error } = await db.from("themes").select("*");
  if (error) {
    console.error("Error loading themes:", error);
    return {};
  }

  const map = {};
  data.forEach(t => (map[t.name] = t));
  return map;
}

// ---------------------------------------------------------
// LOAD THEME CONFIG
// ---------------------------------------------------------
async function loadThemeConfig() {
  const { data, error } = await db
    .from("settings")
    .select("value")
    .eq("key", "themeConfig")
    .maybeSingle();

  if (error) {
    console.error("Error loading themeConfig:", error);
    return {
      theme: "elegant",
      labelTheme: "elegant",
      colorTheme: "elegant",
      iconTheme: "elegant"
    };
  }

  return data?.value || {
    theme: "elegant",
    labelTheme: "elegant",
    colorTheme: "elegant",
    iconTheme: "elegant"
  };
}

// ---------------------------------------------------------
// APPLY THEME TO A GLYPH
// ---------------------------------------------------------
function applyThemeToGlyph(glyph, themes, config) {
  const { labelTheme, colorTheme, iconTheme } = config;

  const labelPack = themes[labelTheme] || {};
  const colorPack = themes[colorTheme] || {};
  const iconPack = themes[iconTheme] || {};

  const themedLabel =
    labelPack.labels?.[glyph.id] || glyph.label;

  const themedColor =
    colorPack.colors?.[glyph.id] || glyph.color;

  // icon priority: custom glyph.icon > theme override > icon pack > placeholder
  let icon =
    glyph.icon ||
    iconPack.icons?.[glyph.id] ||
    `/icons/${iconTheme}/${glyph.id}.svg`;

  if (!icon) icon = "/icons/placeholder.svg";

  return {
    ...glyph,
    label: themedLabel,
    color: themedColor,
    resolvedIcon: icon
  };
}

// ---------------------------------------------------------
// INITIAL LOAD
// ---------------------------------------------------------
async function initDashboard() {
  themes = await loadThemes();
  themeConfig = await loadThemeConfig();
  glyphNodes = await loadGlyphs();

  themedGlyphs = glyphNodes.map(g =>
    applyThemeToGlyph(g, themes, themeConfig)
  );

  refreshDashboard();

  // Realtime entries
  db.channel("entries-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "entries" },
      () => refreshDashboard()
    )
    .subscribe();

  // Realtime theme changes
  db.channel("settings-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "settings" },
      async payload => {
        if (payload.new.key === "themeConfig") {
          themeConfig = payload.new.value;
          themedGlyphs = glyphNodes.map(g =>
            applyThemeToGlyph(g, themes, themeConfig)
          );
          renderGlyphMap();
        }
      }
    )
    .subscribe();
}

initDashboard();

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
// RENDER GLYPH MAP (WITH THEMES + ICONS)
// ---------------------------------------------------------
function renderGlyphMap() {
  const svg = document.getElementById("glyphMap");
  svg.innerHTML = "";

  const size = 400;
  const radius = 140;
  const center = size / 2;

  let tooltip = document.querySelector(".tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    document.body.appendChild(tooltip);
  }

  // Nucleus
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

  themedGlyphs.forEach((node, index) => {
    const angle = (index / themedGlyphs.length) * 2 * Math.PI - Math.PI / 2;
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

    // Node circle
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 20);
    circle.setAttribute("fill", node.color);
    circle.setAttribute("stroke", "#111827");
    if (count > 0) circle.classList.add("pulse");
    svg.appendChild(circle);

    // Label
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

    // Count
    const countText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    countText.setAttribute("x", x);
    countText.setAttribute("y", y + 16);
    countText.setAttribute("text-anchor", "middle");
    countText.setAttribute("font-size", "12");
    countText.textContent = `(${count})`;
    svg.appendChild(countText);

    // Tooltip
    const updateTooltipPosition = () => {
      const rect = svg.getBoundingClientRect();
      tooltip.style.left = `${rect.left + x}px`;
      tooltip.style.top = `${rect.top + y - 40}px`;
    };

    circle.addEventListener("mouseenter", () => {
      tooltip.textContent =
        `${node.label}: ${count} entr${count === 1 ? "y" : "ies"}`;
      tooltip.style.opacity = 1;
      updateTooltipPosition();
    });

    circle.addEventListener("mouseleave", () => {
      tooltip.style.opacity = 0;
    });
  });
}

// ---------------------------------------------------------
// CONTROLS (unchanged)
// ---------------------------------------------------------

document.getElementById("toggleLockout").addEventListener("click", async () => {
  try {
    const { data } = await db
      .from("settings")
      .select("value")
      .eq("key", "lockout")
      .maybeSingle();

    const current = data ? data.value : false;

    await db
      .from("settings")
      .upsert({ key: "lockout", value: !current }, { onConflict: "key" });

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
