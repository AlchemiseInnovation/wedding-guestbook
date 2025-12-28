// ---------------------------------------------------------
// 0. STATE
// ---------------------------------------------------------
let glyphNodes = [];        // now loaded from Supabase
let themedGlyphs = [];      // glyphs after theme applied
let themes = {};            // all themes from DB
let themeConfig = {};       // active theme config
let entries = [];


// ---------------------------------------------------------
// 1. SUPABASE CLIENT SETUP
// ---------------------------------------------------------
const SUPABASE_URL = "https://hagiyjmimmdaubrgndik.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ2l5am1pbW1kYXVicmduZGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTQ4ODAsImV4cCI6MjA4MjQ5MDg4MH0.bTCzaL35Qk7UDduqmsyfyXKkLQBulrEZ0IbZ3ZA6S_s";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ---------------------------------------------------------
// 2. LOAD GLYPHS (FROM SUPABASE, replacing glyphs.json)
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
// 3. LOAD THEMES
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
// 4. LOAD THEME CONFIG
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
// 5. APPLY THEME TO A GLYPH
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
// 6. INITIALIZE KIOSK
// ---------------------------------------------------------
async function initKiosk() {
  themes = await loadThemes();
  themeConfig = await loadThemeConfig();
  glyphNodes = await loadGlyphs();

  themedGlyphs = glyphNodes.map(g =>
    applyThemeToGlyph(g, themes, themeConfig)
  );

  populateGlyphSelect();
  refreshEntries();

  // Realtime theme updates
  db.channel("settings-realtime-kiosk")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "settings" },
      async payload => {
        if (payload.new.key === "themeConfig") {
          themeConfig = payload.new.value;
          themedGlyphs = glyphNodes.map(g =>
            applyThemeToGlyph(g, themes, themeConfig)
          );
          populateGlyphSelect();
          renderGlyphList();
          renderGlyphMap();
        }
      }
    )
    .subscribe();
}

initKiosk();


// ---------------------------------------------------------
// 7. LOAD ENTRIES FROM SUPABASE
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
// 8. SUBMIT ENTRY TO SUPABASE (unchanged)
// ---------------------------------------------------------
async function submitEntry(entry) {
  const { data, error } = await db
    .from("entries")
    .insert([entry])
    .select();

  if (error) {
    console.error("Error submitting entry:", error);
    return null;
  }

  return data ? data[0] : null;
}


// ---------------------------------------------------------
// 9. POPULATE GLYPH DROPDOWN (now uses themedGlyphs)
// ---------------------------------------------------------
function populateGlyphSelect() {
  const select = document.getElementById("glyphSelect");
  select.innerHTML = "";

  themedGlyphs.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.label;
    select.appendChild(opt);
  });
}


// ---------------------------------------------------------
// 10. HANDLE FORM SUBMISSION (unchanged)
// ---------------------------------------------------------
document.getElementById("entryForm").addEventListener("submit", async e => {
  e.preventDefault();

  const guestName = document.getElementById("guestName").value.trim();
  const relationship = document.getElementById("relationship").value.trim();
  const message = document.getElementById("message").value.trim();
  const glyphId = document.getElementById("glyphSelect").value;

  if (!guestName) return alert("Please enter your name.");
  if (!glyphId) return alert("Please select a glyph.");
  if (!message) return alert("Please enter a message.");

  const selectedGlyph = themedGlyphs.find(g => g.id === glyphId);

  const entry = {
    guestname: guestName,
    relationship: relationship,
    message: message,
    glyphnodeid: selectedGlyph.id,
    glyph: selectedGlyph.label,
    devicetype: "kiosk-or-phone",
    modules: {},
    media: [],
    doginteractions: []
  };

  await submitEntry(entry);

  document.getElementById("message").value = "";

  refreshEntries();
});


// ---------------------------------------------------------
// 11. REFRESH UI (unchanged)
// ---------------------------------------------------------
async function refreshEntries() {
  entries = await loadEntries();
  renderGlyphList();
  renderGlyphMap();
}


// ---------------------------------------------------------
// 12. REAL-TIME UPDATES (unchanged)
// ---------------------------------------------------------
db.channel("entries-realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "entries" },
    () => refreshEntries()
  )
  .subscribe();


// ---------------------------------------------------------
// 13. RENDER GLYPH LIST (now uses themedGlyphs)
// ---------------------------------------------------------
function renderGlyphList() {
  const ul = document.getElementById("glyphListItems");
  ul.innerHTML = "";

  themedGlyphs.forEach(node => {
    const count = entries.filter(e => e.glyphNodeId === node.id).length;

    const li = document.createElement("li");
    li.className = "glyph-item";

    li.innerHTML = `
      <span class="color-dot" style="background:${node.color}"></span>
      <div>
        <strong>${node.label}</strong><br>
        <span style="opacity:0.7">${count} entr${count === 1 ? "y" : "ies"}</span>
      </div>
    `;

    ul.appendChild(li);
  });
}


// ---------------------------------------------------------
// 14. RENDER SVG GLYPH MAP (now uses themedGlyphs)
// ---------------------------------------------------------
function renderGlyphMap() {
  const svg = document.getElementById("glyphMap");
  svg.innerHTML = "";

  const size = 400;
  const radius = 140;
  const center = size / 2;

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

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", center);
    line.setAttribute("y1", center);
    line.setAttribute("x2", x);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "#D1D5DB");
    svg.appendChild(line);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", 20);
    circle.setAttribute("fill", node.color);
    circle.setAttribute("stroke", "#111827");
    svg.appendChild(circle);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y - 28);
    label.setAttribute("text-anchor", "middle");
    label.textContent = node.label;
    svg.appendChild(label);

    const countText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    countText.setAttribute("x", x);
    countText.setAttribute("y", y + 4);
    countText.setAttribute("text-anchor", "middle");
    countText.setAttribute("font-weight", "700");
    countText.textContent = count;
    svg.appendChild(countText);
  });
}
