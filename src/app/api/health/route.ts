/** Health check for Docker / Coolify. Public, returns no data. */
export function GET() {
  return Response.json({ status: "ok" });
}
