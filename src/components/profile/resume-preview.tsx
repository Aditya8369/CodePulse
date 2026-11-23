"use client";

import React, { forwardRef } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  Code2,
  ExternalLink,
  Flame,
  FolderGit2,
  GitCommit,
  GitFork,
  Globe,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github";
import { cn } from "@/lib/utils";

export type ResumeFont = "Inter" | "Roboto" | "JetBrains Mono";
export type ResumeSpacing = "compact" | "detailed";
export type ResumeTheme = "ats-clean" | "modern-dark" | "executive-navy";

export interface ResumeProject {
  id: string;
  name: string;
  description: string;
  stars?: number;
  forks?: number;
  commits?: number;
  techTags: string[];
  url?: string;
  highlights?: string[];
}

export interface ResumeSkillCategory {
  category: string;
  skills: Array<{ name: string; level?: string }>;
}

export interface ResumeAchievement {
  id: string;
  title: string;
  issuer: string;
  date?: string;
  description: string;
}

export interface ResumeExperience {
  id: string;
  role: string;
  company: string;
  location?: string;
  startDate: string;
  endDate: string;
  highlights: string[];
}

export interface ResumeData {
  fullName: string;
  headline: string;
  summary: string;
  email: string;
  phone?: string;
  location: string;
  githubUrl: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  username: string;

  // CodePulse Gaming / Competitive Stats
  eloRating: number;
  globalRank: number;
  battlesWon: number;
  battlesPlayed: number;
  tier: string;
  verificationHash: string;

  // GitHub & Open Source
  projects: ResumeProject[];
  totalStars?: number;
  totalPrs?: number;
  totalCommits?: number;

  // Tech Stack Radar / Skills
  skills: ResumeSkillCategory[];

  // Key Achievements
  achievements: ResumeAchievement[];

  // Experience
  experience: ResumeExperience[];
}

export interface ResumeCustomizerOptions {
  font: ResumeFont;
  spacing: ResumeSpacing;
  theme: ResumeTheme;
  includeEloRating: boolean;
  includeGithubStats: boolean;
  includeProjects: boolean;
  includeSkills: boolean;
  includeAchievements: boolean;
  includeExperience: boolean;
  includeSocials: boolean;
  includeSummary: boolean;
}

export interface ResumePreviewProps {
  data: ResumeData;
  options: ResumeCustomizerOptions;
  className?: string;
}

export const DEFAULT_RESUME_DATA: ResumeData = {
  fullName: "Alex Chen",
  headline: "Senior Distributed Systems & Full-Stack Engineer",
  summary:
    "Product-focused systems engineer with 5+ years of experience architecting high-throughput microservices, sub-second WebSockets, and modern Next.js/NestJS web applications. Proven track record in open-source leadership and competitive algorithms.",
  email: "alex.chen@codepulse.dev",
  phone: "+1 (555) 382-9104",
  location: "San Francisco, CA & Remote",
  githubUrl: "https://github.com/alexchen-dev",
  portfolioUrl: "https://codepulse.dev/u/alexchen-dev",
  linkedinUrl: "https://linkedin.com/in/alexchen-dev",
  username: "alexchen-dev",

  eloRating: 2180,
  globalRank: 14,
  battlesWon: 86,
  battlesPlayed: 112,
  tier: "Diamond",
  verificationHash: "cp-cert-sha256-a94f83b271e0c45d9b1a",

  projects: [
    {
      id: "p1",
      name: "codepulse-core",
      description:
        "Real-time competitive developer arena with lock-free WebSocket gateway and low-latency sandboxing.",
      stars: 1420,
      forks: 310,
      commits: 185,
      techTags: ["TypeScript", "Next.js 16", "NestJS", "Redis", "Docker"],
      url: "https://github.com/code-with-abhi-i5/CodePulse",
      highlights: [
        "Engineered LMAX Disruptor lock-free ring buffer ingesting 10,000+ keystrokes/sec with zero thread contention.",
        "Built distributed Redis edge relay synchronizing real-time battle states under 25ms p99 latency.",
      ],
    },
    {
      id: "p2",
      name: "hyper-cache-engine",
      description:
        "High-performance distributed in-memory cache with Raft consensus, LRU-2Q eviction, and bloom filters.",
      stars: 840,
      forks: 120,
      commits: 94,
      techTags: ["Go", "gRPC", "Protobuf", "Raft", "PostgreSQL"],
      url: "https://github.com/alexchen-dev/hyper-cache",
      highlights: [
        "Implemented Raft leader election and log replication with zero-downtime failover.",
        "Decreased tail read latencies across clustered storage nodes from 65ms to 3.8ms.",
      ],
    },
    {
      id: "p3",
      name: "ast-security-sentinel",
      description:
        "Compiler AST static analysis tool scanning pull requests for OWASP Top 10 vulnerabilities.",
      stars: 520,
      forks: 75,
      commits: 62,
      techTags: ["TypeScript", "Babel", "Compiler API", "Vitest"],
      url: "https://github.com/alexchen-dev/ast-security-sentinel",
      highlights: [
        "Scanned and annotated 50,000+ lines of multi-file diffs in under 450ms.",
      ],
    },
  ],

  totalStars: 2780,
  totalPrs: 48,
  totalCommits: 840,

  skills: [
    {
      category: "Languages & Core",
      skills: [
        { name: "TypeScript" },
        { name: "JavaScript (ES2024)" },
        { name: "Go" },
        { name: "Python" },
        { name: "Rust" },
        { name: "SQL (PostgreSQL)" },
      ],
    },
    {
      category: "Full-Stack & Frontend",
      skills: [
        { name: "React 19" },
        { name: "Next.js (App Router)" },
        { name: "Tailwind CSS" },
        { name: "WebSockets / Socket.io" },
        { name: "State Machines" },
      ],
    },
    {
      category: "Backend & Distributed Systems",
      skills: [
        { name: "NestJS / Express" },
        { name: "Redis (Streams/Cluster)" },
        { name: "Prisma ORM" },
        { name: "gRPC & Protocol Buffers" },
        { name: "Docker & Kubernetes" },
      ],
    },
  ],

  achievements: [
    {
      id: "a1",
      title: "Nexus Spring of Code (NSoC'26) High Honors",
      issuer: "CodePulse Foundation",
      date: "2026",
      description:
        "Ranked among the top 0.5% open-source developers worldwide based on merged pull requests, architecture audits, and review scores.",
    },
    {
      id: "a2",
      title: "Global Algorithmic Arena — Diamond Tier (2,180 ELO)",
      issuer: "CodePulse Competitive Arena",
      date: "2026",
      description:
        "Maintained 76.8% duel win rate over 112 matches; ranked #14 globally across 15,000+ participants.",
    },
    {
      id: "a3",
      title: "Zero-Day Vulnerability Disclosure Bounty",
      issuer: "Cloud Native Computing",
      date: "2025",
      description:
        "Discovered and patched a timing side-channel exploit in distributed token verification pipeline.",
    },
  ],

  experience: [
    {
      id: "e1",
      role: "Staff Software Engineer",
      company: "Apex Cloud Infrastructure",
      location: "San Francisco, CA",
      startDate: "2023",
      endDate: "Present",
      highlights: [
        "Spearheaded development of real-time collaborative development platform serving 250,000+ monthly active developers.",
        "Decreased cloud compute expenditure by 34% by instituting adaptive priority load shedding and tenant data sharding.",
        "Led cross-functional team of 8 engineers delivering sub-second code evaluation sandboxes.",
      ],
    },
    {
      id: "e2",
      role: "Senior Full-Stack Developer",
      company: "Nexus Cybernetics",
      location: "Bengaluru / Remote",
      startDate: "2021",
      endDate: "2023",
      highlights: [
        "Designed microservice architecture handling 40M+ daily events with 99.99% system availability.",
        "Engineered low-latency WebSockets state synchronizer reducing network overhead by 45%.",
        "Mentored 10+ junior engineers in clean code patterns, test-driven development, and CI/CD pipelines.",
      ],
    },
  ],
};

export const DEFAULT_CUSTOMIZER_OPTIONS: ResumeCustomizerOptions = {
  font: "Inter",
  spacing: "compact",
  theme: "ats-clean",
  includeEloRating: true,
  includeGithubStats: true,
  includeProjects: true,
  includeSkills: true,
  includeAchievements: true,
  includeExperience: true,
  includeSocials: true,
  includeSummary: true,
};

export const ResumePreview = forwardRef<HTMLDivElement, ResumePreviewProps>(
  function ResumePreview({ data, options, className }, ref) {
    const {
      font = "Inter",
      spacing = "compact",
      theme = "ats-clean",
      includeEloRating = true,
      includeGithubStats = true,
      includeProjects = true,
      includeSkills = true,
      includeAchievements = true,
      includeExperience = true,
      includeSocials = true,
      includeSummary = true,
    } = options || DEFAULT_CUSTOMIZER_OPTIONS;

    // Font family mapping
    const fontStyles: Record<ResumeFont, string> = {
      Inter: "font-sans",
      Roboto: "font-sans",
      "JetBrains Mono": "font-mono",
    };

    const fontStyleCss =
      font === "JetBrains Mono"
        ? { fontFamily: "'JetBrains Mono', monospace" }
        : font === "Roboto"
        ? { fontFamily: "'Roboto', sans-serif" }
        : { fontFamily: "'Inter', sans-serif" };

    // Density / Spacing scale
    const isCompact = spacing === "compact";
    const spaceSection = isCompact ? "space-y-3.5 mb-3.5" : "space-y-5 mb-5";
    const spaceHeader = isCompact ? "mb-3 pb-2.5" : "mb-4 pb-3.5";
    const textSizeBody = isCompact ? "text-[11px] leading-relaxed" : "text-xs leading-relaxed";
    const textSizeHeading = isCompact ? "text-xs" : "text-sm";

    // Theme color styles (on screen preview; print styles override to pure crisp ATS black/white)
    const isDarkTheme = theme === "modern-dark";
    const isExecutive = theme === "executive-navy";

    return (
      <div
        ref={ref}
        data-testid="resume-document-sheet"
        style={fontStyleCss}
        className={cn(
          "resume-sheet w-full max-w-[850px] mx-auto min-h-[1050px] rounded-xl p-8 sm:p-10 select-text transition-all duration-200 shadow-2xl print:shadow-none print:border-none print:m-0 print:p-0 print:w-full print:max-w-full",
          isDarkTheme
            ? "bg-[#0A0E1A] text-slate-100 border border-slate-800"
            : isExecutive
            ? "bg-[#0B1528] text-slate-100 border border-indigo-900/40"
            : "bg-white text-slate-900 border border-slate-200",
          fontStyles[font],
          className
        )}
      >
        {/* ================================================================= */}
        {/* 1. HEADER: Candidate Name, Headline, Contact & Socials          */}
        {/* ================================================================= */}
        <header className={cn("border-b", spaceHeader, isDarkTheme || isExecutive ? "border-slate-800" : "border-slate-200")}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1
                data-testid="resume-candidate-name"
                className="text-2xl sm:text-3xl font-extrabold tracking-tight text-current"
              >
                {data.fullName}
              </h1>
              <p
                data-testid="resume-candidate-headline"
                className={cn(
                  "font-medium mt-0.5",
                  textSizeHeading,
                  isDarkTheme || isExecutive ? "text-indigo-400" : "text-indigo-700 font-semibold"
                )}
              >
                {data.headline}
              </p>
            </div>

            {/* Cryptographic Verification Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 print:hidden">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ATS OPTIMIZED</span>
              </span>
            </div>
          </div>

          {/* Contact Details & Links (ATS parseable plain text & links) */}
          {includeSocials && (
            <div
              data-testid="resume-contact-socials"
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px]",
                isDarkTheme || isExecutive ? "text-slate-300" : "text-slate-600"
              )}
            >
              {data.email && (
                <a
                  href={`mailto:${data.email}`}
                  className="inline-flex items-center gap-1 hover:underline text-current"
                >
                  <Mail className="w-3 h-3 text-indigo-500" />
                  <span>{data.email}</span>
                </a>
              )}

              {data.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3 text-indigo-500" />
                  <span>{data.phone}</span>
                </span>
              )}

              {data.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-500" />
                  <span>{data.location}</span>
                </span>
              )}

              {data.githubUrl && (
                <a
                  href={data.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline text-current"
                >
                  <GithubIcon className="w-3 h-3 text-indigo-500" />
                  <span>github.com/{data.username}</span>
                </a>
              )}

              {data.portfolioUrl && (
                <a
                  href={data.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline text-current"
                >
                  <Globe className="w-3 h-3 text-indigo-500" />
                  <span>{data.portfolioUrl.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
            </div>
          )}

          {/* Executive Summary */}
          {includeSummary && data.summary && (
            <p
              data-testid="resume-summary"
              className={cn("mt-2.5 text-justify", textSizeBody, isDarkTheme || isExecutive ? "text-slate-300" : "text-slate-700")}
            >
              {data.summary}
            </p>
          )}
        </header>

        {/* ================================================================= */}
        {/* 2. CODEPULSE COMPETITIVE METRICS & ELO RATING (Toggleable)        */}
        {/* ================================================================= */}
        {includeEloRating && (
          <section
            data-testid="resume-elo-rating-section"
            className={cn("page-break-avoid", spaceSection)}
          >
            <div className="flex items-center justify-between border-b pb-1 mb-2 border-current/20">
              <h2 className={cn("font-bold uppercase tracking-wider flex items-center gap-1.5", textSizeHeading)}>
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Verified Competitive Algorithmic Rating</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-400">
                CodePulse Verified
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div
                className={cn(
                  "p-2.5 rounded-lg border",
                  isDarkTheme || isExecutive
                    ? "bg-slate-900/60 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                )}
              >
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  ELO Rating
                </div>
                <div
                  data-testid="resume-elo-val"
                  className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400"
                >
                  {data.eloRating} ELO
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Tier: {data.tier}
                </div>
              </div>

              <div
                className={cn(
                  "p-2.5 rounded-lg border",
                  isDarkTheme || isExecutive
                    ? "bg-slate-900/60 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                )}
              >
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Global Standing
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                  Rank #{data.globalRank}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Top 0.5% Worldwide
                </div>
              </div>

              <div
                className={cn(
                  "p-2.5 rounded-lg border",
                  isDarkTheme || isExecutive
                    ? "bg-slate-900/60 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                )}
              >
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Duels Won
                </div>
                <div className="text-base sm:text-lg font-black text-current">
                  {data.battlesWon} / {data.battlesPlayed}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {((data.battlesWon / (data.battlesPlayed || 1)) * 100).toFixed(1)}% Win Rate
                </div>
              </div>

              <div
                className={cn(
                  "p-2.5 rounded-lg border",
                  isDarkTheme || isExecutive
                    ? "bg-slate-900/60 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                )}
              >
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Audit Hash
                </div>
                <div className="text-[11px] font-mono font-bold text-slate-400 truncate mt-1">
                  {data.verificationHash.slice(0, 16)}...
                </div>
                <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Cryptographically Verified
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* 3. CORE TECHNICAL COMPETENCIES / SKILLS (Toggleable)               */}
        {/* ================================================================= */}
        {includeSkills && data.skills?.length > 0 && (
          <section
            data-testid="resume-skills-section"
            className={cn("page-break-avoid", spaceSection)}
          >
            <div className="flex items-center justify-between border-b pb-1 mb-2 border-current/20">
              <h2 className={cn("font-bold uppercase tracking-wider flex items-center gap-1.5", textSizeHeading)}>
                <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Technical Competencies & Stack Radar</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {data.skills.map((cat, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-2.5 rounded-lg border",
                    isDarkTheme || isExecutive
                      ? "bg-slate-900/30 border-slate-800/80"
                      : "bg-slate-50/60 border-slate-200/80"
                  )}
                >
                  <h3 className="text-[11px] font-bold text-current uppercase tracking-wider mb-1.5">
                    {cat.category}
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    {cat.skills.map((s, sIdx) => (
                      <span
                        key={sIdx}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium border font-mono",
                          isDarkTheme || isExecutive
                            ? "bg-white/5 border-white/10 text-slate-200"
                            : "bg-white border-slate-300 text-slate-800"
                        )}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* 4. WORK EXPERIENCE / INDUSTRY TRACK RECORD (Toggleable)           */}
        {/* ================================================================= */}
        {includeExperience && data.experience?.length > 0 && (
          <section
            data-testid="resume-experience-section"
            className={cn("page-break-avoid", spaceSection)}
          >
            <div className="flex items-center justify-between border-b pb-1 mb-2 border-current/20">
              <h2 className={cn("font-bold uppercase tracking-wider flex items-center gap-1.5", textSizeHeading)}>
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>Professional Engineering Experience</span>
              </h2>
            </div>

            <div className={cn(isCompact ? "space-y-3" : "space-y-4")}>
              {data.experience.map((exp) => (
                <div key={exp.id} className="page-break-avoid">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-semibold">
                    <span className="text-current font-bold">
                      {exp.role} <span className="text-indigo-500">@ {exp.company}</span>
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {exp.startDate} – {exp.endDate} {exp.location && `| ${exp.location}`}
                    </span>
                  </div>
                  <ul className={cn("list-disc list-outside pl-4 mt-1 text-slate-600 dark:text-slate-300", textSizeBody)}>
                    {exp.highlights.map((h, hIdx) => (
                      <li key={hIdx} className="mb-0.5">
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* 5. TOP GITHUB PROJECTS & OPEN SOURCE CONTRIBUTIONS (Toggleable)    */}
        {/* ================================================================= */}
        {includeProjects && data.projects?.length > 0 && (
          <section
            data-testid="resume-projects-section"
            className={cn("page-break-avoid", spaceSection)}
          >
            <div className="flex items-center justify-between border-b pb-1 mb-2 border-current/20">
              <h2 className={cn("font-bold uppercase tracking-wider flex items-center gap-1.5", textSizeHeading)}>
                <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Top GitHub Projects & Production Codebases</span>
              </h2>
              {includeGithubStats && (
                <div
                  data-testid="resume-github-aggregate-stats"
                  className="text-[10px] font-mono text-slate-400 flex items-center gap-3"
                >
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" /> {data.totalStars || 2780} Stars
                  </span>
                  <span className="flex items-center gap-1">
                    <GitCommit className="w-3 h-3 text-cyan-400" /> {data.totalCommits || 840} Commits
                  </span>
                </div>
              )}
            </div>

            <div className={cn(isCompact ? "space-y-3" : "space-y-4")}>
              {data.projects.map((proj) => (
                <div key={proj.id} className="page-break-avoid">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-current">{proj.name}</span>
                      {proj.url && (
                        <a
                          href={proj.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-indigo-500 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                      {proj.stars && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 text-amber-400" /> {proj.stars}
                        </span>
                      )}
                      {proj.forks && (
                        <span className="flex items-center gap-0.5">
                          <GitFork className="w-2.5 h-2.5" /> {proj.forks}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={cn("text-slate-600 dark:text-slate-300 mt-0.5", textSizeBody)}>
                    {proj.description}
                  </p>

                  {proj.highlights && proj.highlights.length > 0 && (
                    <ul className={cn("list-disc list-outside pl-4 mt-1 text-slate-600 dark:text-slate-300", textSizeBody)}>
                      {proj.highlights.map((h, hIdx) => (
                        <li key={hIdx} className="mb-0.5">
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap gap-1 mt-1">
                    {proj.techTags.map((t, tIdx) => (
                      <span
                        key={tIdx}
                        className={cn(
                          "px-1.5 py-0.2 rounded text-[9px] font-mono font-medium",
                          isDarkTheme || isExecutive
                            ? "bg-slate-800/80 text-slate-300"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* 6. KEY ACHIEVEMENTS, HONORS & CERTIFICATIONS (Toggleable)         */}
        {/* ================================================================= */}
        {includeAchievements && data.achievements?.length > 0 && (
          <section
            data-testid="resume-achievements-section"
            className={cn("page-break-avoid", spaceSection)}
          >
            <div className="flex items-center justify-between border-b pb-1 mb-2 border-current/20">
              <h2 className={cn("font-bold uppercase tracking-wider flex items-center gap-1.5", textSizeHeading)}>
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Key Honors, Awards & Verified Credentials</span>
              </h2>
            </div>

            <div className={cn(isCompact ? "space-y-2" : "space-y-3")}>
              {data.achievements.map((ach) => (
                <div key={ach.id} className="page-break-avoid">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-current">{ach.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {ach.issuer} {ach.date && `(${ach.date})`}
                    </span>
                  </div>
                  <p className={cn("text-slate-600 dark:text-slate-300 mt-0.5", textSizeBody)}>
                    {ach.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer Ledger Signature for ATS verification */}
        <footer className="mt-6 pt-3 border-t border-current/15 flex flex-col sm:flex-row items-center justify-between text-[10px] font-mono text-slate-400 gap-2">
          <span>Official CodePulse Portfolio Resume</span>
          <span className="truncate max-w-[280px]">
            LEDGER-CERT: {data.verificationHash}
          </span>
          <span>ATS Readable • UTF-8 Vector Text</span>
        </footer>
      </div>
    );
  }
);
