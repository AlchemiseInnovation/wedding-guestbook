export const handler = async (event, context) => {
  const blob = await context.blob.get("entries");

  const entries = blob ? JSON.parse(blob) : [];

  return {
    statusCode: 200,
    body: JSON.stringify(entries)
  };
};
