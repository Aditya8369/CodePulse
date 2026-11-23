import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  ResumePreview,
  DEFAULT_RESUME_DATA,
  DEFAULT_CUSTOMIZER_OPTIONS,
} from "./resume-preview";

describe("ResumePreview - ATS-Optimized Technical Resume", () => {
  it("renders candidate contact, verified skills, and project data", () => {
    render(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={DEFAULT_CUSTOMIZER_OPTIONS}
      />
    );

    // Candidate details
    expect(screen.getByTestId("resume-candidate-name")).toHaveTextContent("Alex Chen");
    expect(screen.getByTestId("resume-candidate-headline")).toHaveTextContent(
      "Senior Distributed Systems & Full-Stack Engineer"
    );
    expect(screen.getByTestId("resume-contact-socials")).toBeInTheDocument();
    expect(screen.getByText("alex.chen@codepulse.dev")).toBeInTheDocument();

    // Competitive stats
    expect(screen.getByTestId("resume-elo-rating-section")).toBeInTheDocument();
    expect(screen.getByTestId("resume-elo-val")).toHaveTextContent("2180 ELO");

    // Projects and Tech stack
    expect(screen.getByTestId("resume-projects-section")).toBeInTheDocument();
    expect(screen.getByText("codepulse-core")).toBeInTheDocument();
    expect(screen.getByTestId("resume-skills-section")).toBeInTheDocument();
    expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0);
    expect(screen.getByText("Languages & Core")).toBeInTheDocument();
  });

  it("toggles Elo rating and competitive gaming stats off for pure engineering applications", () => {
    const { rerender } = render(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          includeEloRating: true,
        }}
      />
    );

    expect(screen.getByTestId("resume-elo-rating-section")).toBeInTheDocument();

    // Turn off Elo rating
    rerender(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          includeEloRating: false,
        }}
      />
    );

    expect(screen.queryByTestId("resume-elo-rating-section")).not.toBeInTheDocument();
  });

  it("toggles GitHub project aggregate metrics and individual projects", () => {
    const { rerender } = render(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          includeProjects: true,
          includeGithubStats: true,
        }}
      />
    );

    expect(screen.getByTestId("resume-github-aggregate-stats")).toBeInTheDocument();
    expect(screen.getByText("codepulse-core")).toBeInTheDocument();

    // Hide GitHub aggregate stars/commits
    rerender(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          includeProjects: true,
          includeGithubStats: false,
        }}
      />
    );

    expect(screen.queryByTestId("resume-github-aggregate-stats")).not.toBeInTheDocument();
    expect(screen.getByTestId("resume-projects-section")).toBeInTheDocument();

    // Hide entire projects section
    rerender(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          includeProjects: false,
        }}
      />
    );

    expect(screen.queryByTestId("resume-projects-section")).not.toBeInTheDocument();
  });

  it("supports switching fonts between Inter, Roboto, and JetBrains Mono", () => {
    const { rerender } = render(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          font: "Inter",
        }}
      />
    );

    let sheet = screen.getByTestId("resume-document-sheet");
    expect(sheet).toHaveClass("font-sans");

    rerender(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          font: "JetBrains Mono",
        }}
      />
    );

    sheet = screen.getByTestId("resume-document-sheet");
    expect(sheet).toHaveClass("font-mono");
  });

  it("applies compact density mode for single-page printing", () => {
    const { rerender } = render(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          spacing: "compact",
        }}
      />
    );

    const sheet = screen.getByTestId("resume-document-sheet");
    expect(sheet).toBeInTheDocument();

    rerender(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          spacing: "detailed",
        }}
      />
    );

    expect(sheet).toBeInTheDocument();
  });

  it("applies clean white ATS paper styling for optimal ATS readability", () => {
    render(
      <ResumePreview
        data={DEFAULT_RESUME_DATA}
        options={{
          ...DEFAULT_CUSTOMIZER_OPTIONS,
          theme: "ats-clean",
        }}
      />
    );

    const sheet = screen.getByTestId("resume-document-sheet");
    expect(sheet).toHaveClass("bg-white");
    expect(sheet).toHaveClass("text-slate-900");
  });
});
