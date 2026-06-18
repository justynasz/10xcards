import { describe, expect, it, vi } from "vitest";
import { deleteAccount } from "../index";
import type { AdminClient } from "../types";

const makeAdminClient = (result: { error: { message: string } | null }): AdminClient => ({
  auth: {
    admin: {
      deleteUser: vi.fn().mockResolvedValue(result),
    },
  },
});

describe("deleteAccount", () => {
  it("resolves and calls deleteUser with the given userId", async () => {
    const adminClient = makeAdminClient({ error: null });

    await expect(deleteAccount(adminClient, "user-1")).resolves.toBeUndefined();
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("throws with the underlying message on error", async () => {
    const adminClient = makeAdminClient({ error: { message: "user not found" } });

    await expect(deleteAccount(adminClient, "user-1")).rejects.toThrow("user not found");
  });
});
