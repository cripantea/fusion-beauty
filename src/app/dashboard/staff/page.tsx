import { requireTenantAdmin } from "@/lib/auth-context";

import { getStaff } from "./actions";
import { StaffManager } from "./staff-manager";

export default async function StaffPage() {
  const { user } = await requireTenantAdmin();
  const staff = await getStaff();

  return (
    <div className="p-8">
      <StaffManager initialStaff={staff} currentUserId={user.id} />
    </div>
  );
}
