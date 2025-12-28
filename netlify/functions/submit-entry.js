export const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const body = JSON.parse(event.body);

  const blob = await context.blob.get("entries");
  const existing = blob ? JSON.parse(blob) : [];

  const newEntry = {
    ...body,
    id: "entry-" + Date.now(),
    createdAt: new Date().toISOString()
  };

  existing.push(newEntry);

  await context.blob.set("entries", JSON.stringify(existing));

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, entry: newEntry })
  };
};
