import { requireSuperAdmin } from "@/lib/auth-context";

import { getTenantOptions, getUsers } from "./actions";
import { UsersManager } from "./users-manager";

export default async function AdminUsersPage() {
  const { user } = await requireSuperAdmin();
  const [users, tenantOptions] = await Promise.all([getUsers(), getTenantOptions()]);

  return <UsersManager initialUsers={users} tenantOptions={tenantOptions} currentUserId={user.id} />;
}
