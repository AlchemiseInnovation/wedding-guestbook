// config.js
const SUPABASE_URL = "https://hagiyjmimmdaubrgndik.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ2l5am1pbW1kYXVicmduZGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTQ4ODAsImV4cCI6MjA4MjQ5MDg4MH0.bTCzaL35Qk7UDduqmsyfyXKkLQBulrEZ0IbZ3ZA6S_s";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Load all glyphs (active only, ordered)
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

// Load all themes as a map { name: theme }
async function loadThemes() {
  const { data, error } = await db.from("themes").select("*");
  if (error) {
    console.error("Error loading themes:", error);
    return {};
  }
  const map = {};
  data.forEach(t => {
    map[t.name] = t;
  });
  return map;
}

// Load themeConfig from settings
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

// Resolve effective label/color/icon for a glyph id
function applyThemeToGlyph(glyph, themes, themeConfig) {
  const { labelTheme, colorTheme, iconTheme } = themeConfig;

  const labelThemeObj = themes[labelTheme] || {};
  const colorThemeObj = themes[colorTheme] || {};
  const iconThemeObj = themes[iconTheme] || {};

  const themedLabel =
    labelThemeObj.labels?.[glyph.id] || glyph.label;

  const themedColor =
    colorThemeObj.colors?.[glyph.id] || glyph.color;

  // icon precedence: custom glyph.icon > theme icon > pack path > placeholder
  let icon = glyph.icon || iconThemeObj.icons?.[glyph.id] || null;
  if (!icon && iconTheme) {
    icon = `/icons/${iconTheme}/${glyph.id}.svg`;
  }
  const finalIcon = icon || "/icons/placeholder.svg";

  return {
    ...glyph,
    label: themedLabel,
    color: themedColor,
    resolvedIcon: finalIcon
  };
}
