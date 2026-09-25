import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolated data dir per test run, set before the server modules read it.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mav-test-"));
process.env.DATA_DIR = tmp;

const crypto = await import("../crypto");
const auth = await import("../auth");
const keys = await import("../keys");
const repo = await import("../repo");
const files = await import("../files");

describe("crypto", () => {
  it("round-trips encryption with the generated secret", () => {
    const blob = crypto.encrypt("sk-live-abc:def");
    expect(blob).not.toContain("sk-live");
    expect(crypto.decrypt(blob)).toBe("sk-live-abc:def");
    expect(fs.existsSync(path.join(tmp, "secret.key"))).toBe(true);
  });
  it("hashes and verifies passwords, rejecting wrong ones", () => {
    const h = crypto.hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(crypto.verifyPassword("correct horse battery", h)).toBe(true);
    expect(crypto.verifyPassword("wrong", h)).toBe(false);
  });
});

describe("accounts + keys + data (SQLite)", () => {
  let userId = "";
  beforeAll(async () => {
    expect(await auth.userCount()).toBe(0);
    const u = await auth.createUser("Me@Example.com", "Me", "password123", true);
    userId = u.id;
  });

  it("normalizes email and checks passwords", async () => {
    expect(await auth.userCount()).toBe(1);
    expect((await auth.checkPassword("me@example.com", "password123"))?.id).toBe(userId);
    expect(await auth.checkPassword("me@example.com", "nope")).toBeNull();
    expect(await auth.checkPassword("nobody@example.com", "password123")).toBeNull();
  });

  it("stores provider keys encrypted and returns them only decrypted", async () => {
    await keys.setProviderKey(userId, "kie", "kie_secret_123");
    expect(await keys.providersWithKeys(userId)).toEqual(["kie"]);
    expect(await keys.getProviderKey(userId, "kie")).toBe("kie_secret_123");
    const db = fs.readFileSync(path.join(tmp, "makeaivideos.db"));
    expect(db.includes(Buffer.from("kie_secret_123"))).toBe(false);
    await keys.deleteProviderKey(userId, "kie");
    expect(await keys.getProviderKey(userId, "kie")).toBeNull();
  });

  it("scopes projects and assets per user and cascades deletes to files", async () => {
    const now = Date.now();
    await repo.insertProject(userId, { id: "p1", name: "Test", createdAt: now, updatedAt: now });
    expect((await repo.listProjects(userId)).map((p) => p.id)).toEqual(["p1"]);
    expect(await repo.listProjects("someone-else")).toEqual([]);

    await files.writeFile("media", "a1.png", Buffer.from("png"));
    await repo.insertAssets(userId, [
      {
        id: "a1", projectId: "p1", runId: "r1", provider: "kie", modelId: "google/nano-banana", kind: "image", prompt: "kite",
        settings: { aspect_ratio: "1:1" }, media: {}, url: "https://cdn/x.png", localFile: "a1.png", favorite: 0, createdAt: now,
      },
    ]);
    const a = (await repo.listAssets(userId))[0]!;
    expect(a.settings).toEqual({ aspect_ratio: "1:1" });
    await repo.updateAssets(userId, ["a1"], { favorite: 1 });
    expect((await repo.listAssets(userId))[0]!.favorite).toBe(1);

    await repo.deleteProject(userId, "p1");
    expect(await repo.listAssets(userId)).toEqual([]);
    expect(fs.existsSync(path.join(tmp, "media", "a1.png"))).toBe(false);
  });

  it("refuses path tricks in file names", () => {
    expect(files.safeRel("../secret.key")).toBeNull();
    expect(files.safeRel("a/../b.png")).toBeNull();
    expect(files.safeRel("a/b/c.png")).toBeNull();
    expect(files.safeRel("/etc/passwd")).toBeNull();
    expect(files.safeRel("First Project/2026-09-20_1902_model_abc.png")).toBe("First Project/2026-09-20_1902_model_abc.png");
    expect(files.folderName("Spring / campaign: v2")).toBe("Spring campaign v2");
  });

  it("moves files when a project is renamed", async () => {
    const now = Date.now();
    await repo.insertProject(userId, { id: "p2", name: "Old name", createdAt: now, updatedAt: now });
    await files.writeFile("media", "Old name/pic.png", Buffer.from("png"));
    await repo.insertAssets(userId, [
      { id: "a2", projectId: "p2", runId: "r2", provider: "kie", modelId: "z-image", kind: "image", prompt: "x", settings: {}, media: {}, url: "https://cdn/y.png", localFile: "Old name/pic.png", favorite: 0, createdAt: now },
    ]);
    await repo.renameProject(userId, "p2", "New name");
    const a = (await repo.listAssets(userId)).find((x) => x.id === "a2")!;
    expect(a.localFile).toBe("New name/pic.png");
    expect(fs.existsSync(path.join(tmp, "media", "New name", "pic.png"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "media", "Old name"))).toBe(false);
  });
});
