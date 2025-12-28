// ---------------------------------------------------------
// 0. STATE
// ---------------------------------------------------------
let glyphNodes = [];
let entries = [];


// ---------------------------------------------------------
// 1. SUPABASE CLIENT SETUP
// ---------------------------------------------------------
const SUPABASE_URL = "https://hagiyjmimmdaubrgndik.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ2l5am1pbW1kYXVicmduZGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTQ4ODAsImV4cCI6MjA4MjQ5MDg4MH0.bTCzaL35Qk7UDduqmsyfyXKkLQBulrEZ0IbZ3ZA6S_s";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ---------------------------------------------------------
// 2. LOAD GLYPHS.JSON
// ---------------------------------------------------------
fetch("glyphs.json")
  .then(res => res.json())
  .then(data => {
    glyphNodes = data.glyphNodes;
    populateGlyphSelect();
    refreshEntries(); // load Supabase entries + render UI
  });


// ---------------------------------------------------------
// 3. LOAD ENTRIES FROM SUPABASE
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

  return data;
}


// ---------------------------------------------------------
// 4. SUBMIT ENTRY TO SUPABASE
// ---------------------------------------------------------
async function submitEntry(entry) {
  const { data, error } = await db
    .from("entries")
    .insert([entry]);

  if (error) {
    console.error("Error submitting entry:", error);
    return null;
  }

  return data[0];
}


// ---------------------------------------------------------
// 5. POPULATE GLYPH DROPDOWN
// ---------------------------------------------------------
function populateGlyphSelect() {
  const select = document.getElementById("glyphSelect");
  glyphNodes.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.label;
    select.appendChild(opt);
  });
}


// ---------------------------------------------------------
// 6. HANDLE FORM SUBMISSION
// ---------------------------------------------------------
document.getElementById("entryForm").addEventListener("submit", async e => {
  e.preventDefault();

const entry = {
  guestname: document.getElementById("guestName").value,
  relationship: document.getElementById("relationship").value,
  message: document.getElementById("message").value,
  glyphnodeid: document.getElementById("glyphSelect").value,
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
// 7. REFRESH UI (LOAD + RENDER)
// ---------------------------------------------------------
async function refreshEntries() {
  entries = await loadEntries();
  renderGlyphList();
  renderGlyphMap();
}


// ---------------------------------------------------------
// 8. RENDER GLYPH LIST
// ---------------------------------------------------------
function renderGlyphList() {
  const ul = document.getElementById("glyphListItems");
  ul.innerHTML = "";

  glyphNodes.forEach(node => {
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
// 9. RENDER SVG GLYPH MAP
// ---------------------------------------------------------
function renderGlyphMap() {
  const svg = document.getElementById("glyphMap");
  svg.innerHTML = "";

  const size = 400;
  const radius = 140;
  const center = size / 2;

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

  // Glyph nodes
  glyphNodes.forEach((node, index) => {
    const angle = (index / glyphNodes.length) * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    const count = entries.filter(e => e.glyphNodeId === node.id).length;

    // Line
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
    svg.appendChild(circle);

    // Label
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", y - 28);
    label.setAttribute("text-anchor", "middle");
    label.textContent = node.label;
    svg.appendChild(label);

    // Count
    const countText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    countText.setAttribute("x", x);
    countText.setAttribute("y", y + 4);
    countText.setAttribute("text-anchor", "middle");
    countText.setAttribute("font-weight", "700");
    countText.textContent = count;
    svg.appendChild(countText);
  });
}
