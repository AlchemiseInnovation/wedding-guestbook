// admin.js
// Assumes config.js is loaded first

let allThemes = {};
let glyphs = [];
let themeConfig = null;

initAdmin();

async function initAdmin() {
  allThemes = await loadThemes();
  glyphs = await loadGlyphs();
  themeConfig = await loadThemeConfig();

  populateThemeSelectors();
  renderGlyphTable();
  await updateLockoutDisplay();

  setupEventHandlers();
}

// ---------------- THEME CONFIG ----------------

function populateThemeSelectors() {
  const themeNames = Object.keys(allThemes);

  ["themeSelect", "labelThemeSelect", "colorThemeSelect", "iconThemeSelect"]
    .forEach(id => {
      const select = document.getElementById(id);
      select.innerHTML = "";
      themeNames.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
    });

  document.getElementById("themeSelect").value = themeConfig.theme;
  document.getElementById("labelThemeSelect").value = themeConfig.labelTheme;
  document.getElementById("colorThemeSelect").value = themeConfig.colorTheme;
  document.getElementById("iconThemeSelect").value = themeConfig.iconTheme;
}

function setupEventHandlers() {
  document.getElementById("saveThemeConfig").addEventListener("click", saveThemeConfig);
  document.getElementById("addGlyph").addEventListener("click", onAddGlyph);
  document.getElementById("toggleLockout").addEventListener("click", toggleLockout);

  document.getElementById("exportGlyphs").addEventListener("click", exportGlyphs);
  document.getElementById("exportThemes").addEventListener("click", exportThemes);
  document.getElementById("exportEntries").addEventListener("click", exportEntries);
}

async function saveThemeConfig() {
  const newConfig = {
    theme: document.getElementById("themeSelect").value,
    labelTheme: document.getElementById("labelThemeSelect").value,
    colorTheme: document.getElementById("colorThemeSelect").value,
    iconTheme: document.getElementById("iconThemeSelect").value
  };

  const { error } = await db
    .from("settings")
    .upsert({ key: "themeConfig", value: newConfig }, { onConflict: "key" });

  const statusEl = document.getElementById("themeConfigStatus");
  if (error) {
    console.error("Error saving theme config:", error);
    statusEl.textContent = "Error saving theme config.";
  } else {
    themeConfig = newConfig;
    statusEl.textContent = "Theme config saved.";
    renderGlyphTable(); // re-preview with new config
  }
}

// ---------------- GLYPHS TABLE ----------------

function renderGlyphTable() {
  const tbody = document.querySelector("#glyphTable tbody");
  tbody.innerHTML = "";

  const themedGlyphs = glyphs.map(g => applyThemeToGlyph(g, allThemes, themeConfig));

  themedGlyphs.forEach((g, index) => {
    const row = document.createElement("tr");

    // ID
    const idCell = document.createElement("td");
    idCell.textContent = g.id;
    row.appendChild(idCell);

    // Label
    const labelCell = document.createElement("td");
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = g.label;
    labelInput.addEventListener("change", () => onUpdateGlyphLabel(g.id, labelInput.value));
    labelCell.appendChild(labelInput);
    row.appendChild(labelCell);

    // Color
    const colorCell = document.createElement("td");
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = g.color;
    colorInput.addEventListener("change", () => onUpdateGlyphColor(g.id, colorInput.value));
    colorCell.appendChild(colorInput);
    row.appendChild(colorCell);

    // Icon
    const iconCell = document.createElement("td");
    const iconInput = document.createElement("input");
    iconInput.type = "text";
    iconInput.value = glyphs.find(orig => orig.id === g.id).icon || "";
    iconInput.placeholder = "/icons/custom/blessing.svg or https://...";
    iconInput.addEventListener("change", () => onUpdateGlyphIcon(g.id, iconInput.value));
    iconCell.appendChild(iconInput);
    row.appendChild(iconCell);

    // Order controls
    const orderCell = document.createElement("td");
    const upBtn = document.createElement("button");
    upBtn.textContent = "↑";
    upBtn.addEventListener("click", () => changeOrder(g.id, -1));
    const downBtn = document.createElement("button");
    downBtn.textContent = "↓";
    downBtn.addEventListener("click", () => changeOrder(g.id, 1));
    orderCell.appendChild(upBtn);
    orderCell.appendChild(downBtn);
    row.appendChild(orderCell);

    // Active toggle
    const activeCell = document.createElement("td");
    const activeCheckbox = document.createElement("input");
    activeCheckbox.type = "checkbox";
    activeCheckbox.checked = glyphs.find(orig => orig.id === g.id).active;
    activeCheckbox.addEventListener("change", () => onUpdateGlyphActive(g.id, activeCheckbox.checked));
    activeCell.appendChild(activeCheckbox);
    row.appendChild(activeCell);

    // Preview
    const previewCell = document.createElement("td");
    const circle = document.createElement("span");
    circle.className = "preview-circle";
    circle.style.background = g.color;
    const labelSpan = document.createElement("span");
    labelSpan.className = "preview-label";
    labelSpan.textContent = g.label;
    previewCell.appendChild(circle);
    previewCell.appendChild(labelSpan);
    row.appendChild(previewCell);

    // Delete
    const delCell = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "X";
    delBtn.addEventListener("click", () => onDeleteGlyph(g.id));
    delCell.appendChild(delBtn);
    row.appendChild(delCell);

    tbody.appendChild(row);
  });
}

async function onUpdateGlyphLabel(id, newLabel) {
  const { error } = await db.from("glyphs").update({ label: newLabel }).eq("id", id);
  if (error) console.error("Error updating label:", error);
  glyphs = await loadGlyphs();
  renderGlyphTable();
}

async function onUpdateGlyphColor(id, newColor) {
  const { error } = await db.from("glyphs").update({ color: newColor }).eq("id", id);
  if (error) console.error("Error updating color:", error);
  glyphs = await loadGlyphs();
  renderGlyphTable();
}

async function onUpdateGlyphIcon(id, newIcon) {
  const { error } = await db.from("glyphs").update({ icon: newIcon || null }).eq("id", id);
  if (error) console.error("Error updating icon:", error);
  glyphs = await loadGlyphs();
  renderGlyphTable();
}

async function changeOrder(id, delta) {
  const target = glyphs.find(g => g.id === id);
  if (!target) return;
  const newIndex = target.order_index + delta;
  const swap = glyphs.find(g => g.order_index === newIndex);
  const updates = [];

  updates.push(db.from("glyphs").update({ order_index: newIndex }).eq("id", id));
  if (swap) {
    updates.push(db.from("glyphs").update({ order_index: target.order_index }).eq("id", swap.id));
  }

  await Promise.all(updates);
  glyphs = await loadGlyphs();
  renderGlyphTable();
}

async function onUpdateGlyphActive(id, active) {
  const { error } = await db.from("glyphs").update({ active }).eq("id", id);
  if (error) console.error("Error updating active:", error);
  glyphs = await loadGlyphs();
  renderGlyphTable();
}

async function onAddGlyph() {
  const id = prompt("New glyph ID (no spaces, e.g. 'promise'):");
  if (!id) return;
  const { error } = await db.from("glyphs").insert({
    id,
    label: id,
    color: "#9CA3AF",
    order_index: glyphs.length + 1,
    active: true
  });
  if (error) {
    console.error("Error adding glyph:", error);
    return;
  }
  glyphs = await loadGlyphs();
  renderGlyphTable();
}

async function onDeleteGlyph(id) {
  if (!confirm(`Delete glyph ${id}?`)) return;
  const { error } = await db.from("glyphs").delete().eq("id", id);
  if (error) console.error("Error deleting glyph:", error);
  glyphs = await loadGlyphs();
  renderGlyphTable();
}

// ---------------- LOCKOUT & EXPORTS ----------------

async function updateLockoutDisplay() {
  const { data } = await db
    .from("settings")
    .select("value")
    .eq("key", "lockout")
    .maybeSingle();

  const enabled = data?.value?.enabled || false;
  document.getElementById("lockoutState").textContent =
    `Lockout: ${enabled ? "ON" : "OFF"}`;
}

async function toggleLockout() {
  const { data } = await db
    .from("settings")
    .select("value")
    .eq("key", "lockout")
    .maybeSingle();

  const current = data?.value?.enabled || false;
  const { error } = await db
    .from("settings")
    .upsert({ key: "lockout", value: { enabled: !current } }, { onConflict: "key" });

  if (error) console.error("Error toggling lockout:", error);
  await updateLockoutDisplay();
}

// Export helpers
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportGlyphs() {
  const data = await loadGlyphs();
  downloadBlob(JSON.stringify(data, null, 2), "glyphs.json", "application/json");
}

async function exportThemes() {
  const { data } = await db.from("themes").select("*");
  downloadBlob(JSON.stringify(data || [], null, 2), "themes.json", "application/json");
}

async function exportEntries() {
  const { data } = await db
    .from("entries")
    .select("*")
    .order("created_at", { ascending: true });

  const rows = data || [];
  const header = "guestname,relationship,message,glyphid,glyph,created_at\n";
  const lines = rows.map(e =>
    [
      e.guestname || "",
      e.relationship || "",
      (e.message || "").replace(/\n/g, " "),
      e.glyphnodeid || "",
      e.glyph || "",
      e.created_at || ""
    ].join(",")
  );
  downloadBlob(header + lines.join("\n"), "entries.csv", "text/csv");
}
