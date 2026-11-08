export function GET() {
  return Response.json({ estado: "vivo", ts: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
