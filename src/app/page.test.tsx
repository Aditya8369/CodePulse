import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  mockAllIsIntersecting,
  resetIntersectionMocking,
  setupIntersectionMocking,
} from "react-intersection-observer/test-utils";
import LandingPage from "./page";

const motionTestState = vi.hoisted(() => ({
  reducedMotion: false,
  animate: vi.fn(),
}));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    animate: motionTestState.animate,
    useReducedMotion: () => motionTestState.reducedMotion,
  };
});

beforeAll(() => {
  setupIntersectionMocking(vi.fn);
});

beforeEach(() => {
  motionTestState.reducedMotion = false;
  motionTestState.animate.mockReset();
  motionTestState.animate.mockImplementation((count, target) => {
    count.set(target);
    return { stop: vi.fn() };
  });
});

afterEach(() => {
  resetIntersectionMocking();
});

describe("LandingPage Accessibility (#72)", () => {
  it("renders standard semantic landmarks (header, nav, main, footer)", () => {
    render(<LandingPage />);

    const header = screen.getByRole("banner");
    expect(header).toBeDefined();

    const mainNav = screen.getByRole("navigation", { name: "Main Navigation" });
    expect(mainNav).toBeDefined();

    const main = screen.getByRole("main");
    expect(main).toBeDefined();
    expect(main.id).toBe("main-content");

    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeDefined();

    const footerNav = screen.getByRole("navigation", { name: "Footer Navigation" });
    expect(footerNav).toBeDefined();
  });

  it("includes an accessible keyboard skip-to-content link", () => {
    render(<LandingPage />);

    const skipLink = screen.getByText("Skip to main content");
    expect(skipLink).toBeDefined();
    expect(skipLink.getAttribute("href")).toBe("#main-content");
    expect(skipLink.className).toContain("sr-only");
    expect(skipLink.className).toContain("focus:not-sr-only");
  });

  it("provides meaningful aria-labels for icon-only and interactive links", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: "CodePulse Homepage" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Sign in to your CodePulse account" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Get started with CodePulse" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Start with GitHub - Track and gamify your coding journey" })
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "View interactive demo of developer analytics" })
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Get started with CodePulse for free" })
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "CodePulse on GitHub" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Abhijeet on GitHub" })).toBeDefined();
  });

  it("ensures interactive controls have visible focus rings", () => {
    render(<LandingPage />);

    const homeLink = screen.getByRole("link", { name: "CodePulse Homepage" });
    expect(homeLink.className).toContain("focus-visible:ring-2");
    expect(homeLink.className).toContain("focus-visible:ring-sky-400");

    const githubCta = screen.getByRole("link", {
      name: "Start with GitHub - Track and gamify your coding journey",
    });
    expect(githubCta.className).toContain("focus-visible:ring-2");
    expect(githubCta.className).toContain("focus-visible:ring-sky-400");

    const footerGithub = screen.getByRole("link", { name: "CodePulse on GitHub" });
    expect(footerGithub.className).toContain("focus-visible:ring-2");
  });

  it("hides decorative 3D background canvases, grid overlays, and particles with aria-hidden", () => {
    const { container } = render(<LandingPage />);

    const ariaHiddenNodes = container.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenNodes.length).toBeGreaterThanOrEqual(5);

    // Decorative 3D mockup dashboard
    const heroDashboard = container.querySelector(".hero-dashboard");
    expect(heroDashboard?.parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("counts up to the exact targets once the statistics section enters the viewport", async () => {
    render(<LandingPage />);

    expect(screen.getByText("Active Developers").previousElementSibling).toHaveTextContent("0K+");
    expect(screen.getByText("Commits Analyzed").previousElementSibling).toHaveTextContent("0M+");
    expect(screen.getByText("Battles Fought").previousElementSibling).toHaveTextContent("0K+");
    expect(screen.getByText("Uptime").previousElementSibling).toHaveTextContent("0%");
    expect(motionTestState.animate).not.toHaveBeenCalled();

    act(() => mockAllIsIntersecting(true));

    await waitFor(() => {
      expect(screen.getByText("Active Developers").previousElementSibling).toHaveTextContent("250K+");
      expect(screen.getByText("Commits Analyzed").previousElementSibling).toHaveTextContent("12M+");
      expect(screen.getByText("Battles Fought").previousElementSibling).toHaveTextContent("500K+");
      expect(screen.getByText("Uptime").previousElementSibling).toHaveTextContent("99.9%");
    });

    expect(motionTestState.animate).toHaveBeenCalledTimes(4);
    for (const [count, target, options] of motionTestState.animate.mock.calls) {
      expect(count.get()).toBe(target);
      expect(options).toMatchObject({ duration: 2.5, ease: "easeOut" });
    }

    act(() => {
      mockAllIsIntersecting(false);
      mockAllIsIntersecting(true);
    });
    expect(motionTestState.animate).toHaveBeenCalledTimes(4);
  });

  it("shows final values immediately without animating when reduced motion is preferred", async () => {
    motionTestState.reducedMotion = true;
    render(<LandingPage />);

    act(() => mockAllIsIntersecting(true));

    await waitFor(() => {
      expect(screen.getByText("Active Developers").previousElementSibling).toHaveTextContent("250K+");
      expect(screen.getByText("Commits Analyzed").previousElementSibling).toHaveTextContent("12M+");
      expect(screen.getByText("Battles Fought").previousElementSibling).toHaveTextContent("500K+");
      expect(screen.getByText("Uptime").previousElementSibling).toHaveTextContent("99.9%");
    });
    expect(motionTestState.animate).not.toHaveBeenCalled();
  });
});
