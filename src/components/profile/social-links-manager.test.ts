import { describe, expect, it } from "vitest";
import { validateSocialUrl } from "./social-links-manager";

describe("social link validation", () => {
  it("accepts the selected platform and its subdomains", () => {
    expect(validateSocialUrl("LinkedIn", "https://www.linkedin.com/in/developer")).toBeNull();
    expect(validateSocialUrl("Substack / Dev.to", "https://writer.substack.com")).toBeNull();
  });

  it("rejects unsafe schemes and lookalike domains", () => {
    expect(validateSocialUrl("Custom Website", "javascript:alert(1)")).not.toBeNull();
    expect(validateSocialUrl("LinkedIn", "https://linkedin.com.evil.example/in/developer")).not.toBeNull();
    expect(validateSocialUrl("YouTube", "http://youtube.com/@developer")).not.toBeNull();
  });

  it("accepts a secure custom domain", () => {
    expect(validateSocialUrl("Custom Website", "https://my-dev-blog.example/posts")).toBeNull();
  });
});
