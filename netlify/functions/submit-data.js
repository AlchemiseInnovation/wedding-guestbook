import fs from "fs";
import path from "path";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const dataPath = path.join(process.cwd(), "data", "entries.json");
  const body = JSON.parse(event.body);

  const newEntry = {
    ...body,
    id: "entry-" + Date.now(),
    createdAt: new Date().toISOString()
  };

  // Load existing entries
  const existing = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  // Append
  existing.push(newEntry);

  // Save
  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, entry: newEntry })
  };
};
