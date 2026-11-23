import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Avatar, AvatarFallback, AvatarGroup } from "./avatar";

describe("Avatar hover zoom and tooltip", () => {
  it("renders avatar with zoomOnHover class and title tooltip", () => {
    const { container } = render(
      <Avatar zoomOnHover tooltip="Linus Torvalds">
        <AvatarFallback>LT</AvatarFallback>
      </Avatar>,
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
      </AvatarGroup>,
    );

    const group = container.querySelector("[data-slot='avatar-group']");
    expect(group).toBeInTheDocument();
    expect(group?.className).toContain("*:data-[slot=avatar]:hover:scale-120");
  });

  it("renders avatar with status indicator badge", () => {
    const { container } = render(
      <Avatar status="online">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );

    const statusBadge = container.querySelector("[data-slot='avatar-status']");
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge?.className).toContain("bg-emerald-500");
  });

  it("renders default avatar without zoom class when zoomOnHover is false", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>CP</AvatarFallback>
      </Avatar>,
    );

    const avatar = container.querySelector("[data-slot='avatar']");
    expect(avatar).toBeInTheDocument();
    expect(avatar?.className).not.toContain("hover:scale-115");
  });
});
