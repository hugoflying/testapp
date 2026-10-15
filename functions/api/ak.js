export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url  = new URL(request.url);
  const flow = url.searchParams.get("flow");
  const from = url.searchParams.get("from");
  const to   = url.searchParams.get("to");

  if (!flow || !from || !to) {
    return new Response("Missing flow/from/to", { status: 400 });
  }

  const AK_BASE    = "https://api.app.airport-keeper.com/flights/v1/airport";
  const AK_AIRPORT = "LFOB";

  const upstream =
    `${AK_BASE}?airport=${encodeURIComponent(AK_AIRPORT)}` +
    `&flow=${encodeURIComponent(flow)}` +
    `&from=${encodeURIComponent(from)}` +
    `&to=${encodeURIComponent(to)}`;

  const r = await fetch(upstream, {
    headers: { Authorization: `Bearer ${env.AK_TOKEN}` },
  });

  return new Response(await r.text(), {
    status: r.status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
