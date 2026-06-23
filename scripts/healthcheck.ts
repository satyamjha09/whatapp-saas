const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000";

async function main() {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    console.error("Healthcheck failed:", data);
    process.exit(1);
  }

  console.log("Healthcheck OK:", data);
}

main().catch((error) => {
  console.error("Healthcheck error:", error);
  process.exit(1);
});
