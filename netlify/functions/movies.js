exports.handler = async (event) => {
  const API_KEY = process.env.TMDB_API_KEY;

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "TMDB_API_KEY not configured in Netlify environment variables." }),
    };
  }

  const { genre, page = 1 } = event.queryStringParameters || {};

  const url = genre
    ? `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genre}&sort_by=popularity.desc&language=pl-PL&vote_count.gte=100&page=${page}`
    : `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&language=pl-PL&page=${page}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: "TMDB API error" }) };
    }
    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
