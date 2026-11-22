import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Avatar, AvatarFallback, AvatarGroup } from "./avatar";

describe("Avatar hover zoom and tooltip", () => {
  it("renders avatar with zoomOnHover class and title tooltip", () => {
    const { container } = render(
      <Avatar zoomOnHover tooltip="Linus Torvalds">
        <AvatarFallback>LT</AvatarFallback>
      </Avatar>
    );

    const avatar = container.querySelector("[data-slot='avatar']");
    expect(avatar).toBeInTheDocument();
    expect(avatar?.className).toContain("hover:scale-115");
    expect(avatar?.getAttribute("title")).toBe("Linus Torvalds");
  });

  it("renders AvatarGroup with smooth hover zoom transition classes", () => {
    const { container } = render(
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
      </AvatarGroup>
    );

    const group = container.querySelector("[data-slot='avatar-group']");
    expect(group).toBeInTheDocument();
    expect(group?.className).toContain("*:data-[slot=avatar]:hover:scale-120");
  });
});
