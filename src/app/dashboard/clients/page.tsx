import type { ClientSegment } from "./actions";
import { getClients } from "./actions";
import { ClientsManager } from "./clients-manager";

type ClientsPageProps = {
  searchParams: Promise<{ segment?: string }>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const validSegments: ClientSegment[] = ["all", "vip", "new", "inactive", "no_future"];
  const segment: ClientSegment =
    params.segment && validSegments.includes(params.segment as ClientSegment)
      ? (params.segment as ClientSegment)
      : "all";

  const clients = await getClients({ segment });

  return <ClientsManager initialClients={clients} initialSegment={segment} />;
}
