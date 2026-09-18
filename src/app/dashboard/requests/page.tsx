import { getBookingRequests } from "./actions";
import { RequestsManager } from "./requests-manager";

export default async function RequestsPage() {
  const requests = await getBookingRequests("PENDING");
  return <RequestsManager initialRequests={requests} />;
}
