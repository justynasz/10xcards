import type { AdminClient } from "./types";

export async function deleteAccount(adminClient: AdminClient, userId: string): Promise<void> {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
