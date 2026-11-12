import "dotenv/config";
async function main() {
  const { listTemplates } = await import("@/lib/fusion-wa");
  const r = await listTemplates("cmuuhvxo200000yny27lazoid");
  console.log(r.ok ? r.templates.map((t) => `${t.status.padEnd(9)} ${t.category.padEnd(9)} ${t.name}`).join("\n") : r.error);
}
main();
