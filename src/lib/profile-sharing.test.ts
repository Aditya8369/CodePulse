import { describe, expect, it } from "vitest";
import { profileShareLinks, profileUrl } from "./profile-sharing";

describe("profile sharing URLs", () => {
  it("builds the public profile path from the current origin", () => {
    expect(profileUrl("https://codepulse.example", "dev-user")).toBe("https://codepulse.example/profile/dev-user");
  });

  it("encodes the direct link into X, LinkedIn and WhatsApp share targets", () => {
    const url = "https://codepulse.example/profile/dev-user";
    const links = profileShareLinks(url);
    expect(new URL(links.x).searchParams.get("text")).toContain(url);
    expect(new URL(links.linkedin).searchParams.get("url")).toBe(url);
    expect(new URL(links.whatsapp).searchParams.get("text")).toContain(url);
  });
});
