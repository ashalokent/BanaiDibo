// netlify/functions/auth.js
// Set ADMIN_PASS in your Netlify environment variables
// Netlify Dashboard → Site → Environment variables → Add variable: ADMIN_PASS = yourpassword

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const { password } = body;

  if (!password) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Password is required" }),
    };
  }

  const correctPassword = process.env.ADMIN_PASS;

  if (!correctPassword) {
    console.error("ADMIN_PASS environment variable is not set!");
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server misconfiguration: ADMIN_PASS not set" }),
    };
  }

 if (password === correctPassword) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, token: correctPassword }),
  };
}

  return {
    statusCode: 401,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: false, error: "Invalid password" }),
  };
};
