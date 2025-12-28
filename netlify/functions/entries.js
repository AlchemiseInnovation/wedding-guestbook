export const handler = async (event, context) => {
  try {
    const blob = await context.blob.get("entries");
    const entries = blob ? JSON.parse(blob) : [];
    return {
      statusCode: 200,
      body: JSON.stringify(entries)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

