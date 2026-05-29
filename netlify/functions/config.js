exports.handler = async () => {
  const url     = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Supabase env vars not configured." }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, anonKey }),
  };
};
