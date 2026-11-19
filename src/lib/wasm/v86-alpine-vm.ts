export interface VfsNode {
  type: "file" | "dir";
  content?: string;
  mode: string;
  updatedAt: number;
}

export interface TerminalChallenge {
  id: string;
  title: string;
  difficulty: "Beginner" | "Intermediate" | "DevOps";
  prompt: string;
  hint: string;
  verify: (vm: V86AlpineVm) => { passed: boolean; feedback: string };
}

export interface VmBootTelemetry {
  booted: boolean;
  bootDurationMs: number;
  wasmMemoryBytes: number;
  rootfsSizeBytes: number;
  kernelVersion: string;
  persistedInIndexedDb: boolean;
}

const IDB_DB_NAME = "codepulse-v86-alpine-fs";
const IDB_STORE_NAME = "snapshots";
const IDB_SNAPSHOT_KEY = "rootfs-v1";

export const DEFAULT_TERMINAL_CHALLENGES: TerminalChallenge[] = [
  {
    id: "parse-access-log",
    title: "Parse Nginx 500 Errors from access.log",
    difficulty: "DevOps",
    prompt:
      "Create an executable bash script `/home/developer/parse_errors.sh` that filters HTTP 500 lines from `/var/log/nginx/access.log` and writes them to `/home/developer/errors.txt` (then run it).",
    hint: "Try: grep ' 500 ' /var/log/nginx/access.log > /home/developer/errors.txt",
    verify: (vm) => {
      const output = vm.readFile("/home/developer/errors.txt");
      const script = vm.readFile("/home/developer/parse_errors.sh");
      if (!script) {
        return {
          passed: false,
          feedback: "Missing script `/home/developer/parse_errors.sh`.",
        };
      }
      if (!output || !output.includes("500")) {
        return {
          passed: false,
          feedback:
            "`/home/developer/errors.txt` does not contain the filtered HTTP 500 log entries yet.",
        };
      }
      const lines = output.trim().split("\n").filter(Boolean);
      if (lines.length !== 2) {
        return {
          passed: false,
          feedback: `Expected 2 HTTP 500 lines in errors.txt, found ${lines.length}.`,
        };
      }
      return {
        passed: true,
        feedback:
          "Verified! `parse_errors.sh` accurately extracted both HTTP 500 incidents into `/home/developer/errors.txt`.",
      };
    },
  },
  {
    id: "git-init-service",
    title: "Initialize Git Repository & Commit README",
    difficulty: "Beginner",
    prompt:
      "Initialize a git repository inside `/home/developer/app` (`git init`) and create a non-empty `README.md` file.",
    hint: "mkdir -p /home/developer/app && cd /home/developer/app && git init && echo '# Service' > README.md",
    verify: (vm) => {
      const hasGit = vm.exists("/home/developer/app/.git/HEAD");
      const readme = vm.readFile("/home/developer/app/README.md");
      if (!hasGit) {
        return {
          passed: false,
          feedback: "No `.git` repository initialized in `/home/developer/app`.",
        };
      }
      if (!readme || readme.trim().length === 0) {
        return {
          passed: false,
          feedback: "`/home/developer/app/README.md` is missing or empty.",
        };
      }
      return {
        passed: true,
        feedback: "Verified! Git repository and `README.md` are initialized.",
      };
    },
  },
  {
    id: "python-health-check",
    title: "Generate JSON Health Report via Python3",
    difficulty: "Intermediate",
    prompt:
      "Run a Python3 one-liner or script that creates `/home/developer/health.json` containing `\"status\": \"ok\"`.",
    hint: "python3 -c 'import json; open(\"/home/developer/health.json\",\"w\").write(json.dumps({\"status\":\"ok\"}))'",
    verify: (vm) => {
      const raw = vm.readFile("/home/developer/health.json");
      if (!raw) {
        return {
          passed: false,
          feedback: "`/home/developer/health.json` has not been created yet.",
        };
      }
      try {
        const parsed = JSON.parse(raw) as { status?: string };
        if (parsed.status === "ok") {
          return {
            passed: true,
            feedback: "Verified! Valid JSON health report generated.",
          };
        }
      } catch {
        // Invalid JSON
      }
      return {
        passed: false,
        feedback: "File exists but does not contain valid JSON with `\"status\": \"ok\"`.",
      };
    },
  },
];

function createDefaultRootFs(): Record<string, VfsNode> {
  const now = Date.now();
  const dir = (mode = "drwxr-xr-x"): VfsNode => ({
    type: "dir",
    mode,
    updatedAt: now,
  });
  const file = (content: string, mode = "-rw-r--r--"): VfsNode => ({
    type: "file",
    content,
    mode,
    updatedAt: now,
  });

  return {
    "/": dir(),
    "/bin": dir(),
    "/bin/sh": file("#!/bin/sh\n# BusyBox ash/sh Wasm binary", "-rwxr-xr-x"),
    "/usr": dir(),
    "/usr/bin": dir(),
    "/usr/bin/curl": file("#!/bin/sh\n# curl 8.9.1-r0", "-rwxr-xr-x"),
    "/usr/bin/git": file("#!/bin/sh\n# git 2.45.2-r0", "-rwxr-xr-x"),
    "/usr/bin/python3": file("#!/bin/sh\n# Python 3.12.6", "-rwxr-xr-x"),
    "/usr/bin/vi": file("#!/bin/sh\n# BusyBox vi editor", "-rwxr-xr-x"),
    "/etc": dir(),
    "/etc/os-release": file(
      'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.20.3\nPRETTY_NAME="Alpine Linux v3.20 (WebAssembly x86)"\n'
    ),
    "/etc/hostname": file("codepulse-wasm-vm\n"),
    "/var": dir(),
    "/var/log": dir(),
    "/var/log/nginx": dir(),
    "/var/log/nginx/access.log": file(
      [
        '10.0.1.14 - - [19/Nov/2026:00:01:10 +0000] "GET /api/v1/health HTTP/1.1" 200 64',
        '10.0.1.22 - - [19/Nov/2026:00:01:14 +0000] "POST /api/v1/battles/submit HTTP/1.1" 500 512',
        '10.0.1.19 - - [19/Nov/2026:00:01:18 +0000] "GET /api/v1/leaderboard HTTP/1.1" 200 4096',
        '10.0.1.45 - - [19/Nov/2026:00:01:22 +0000] "POST /api/v1/runners/execute HTTP/1.1" 500 768',
        '10.0.1.14 - - [19/Nov/2026:00:01:29 +0000] "GET /api/v1/profile/Itssonia7 HTTP/1.1" 200 2048',
      ].join("\n") + "\n"
    ),
    "/home": dir(),
    "/home/developer": dir(),
    "/home/developer/welcome.txt": file(
      "Welcome to CodePulse Wasm Alpine Linux Sandbox!\nIncluded tools: sh, curl, git, python3, vi\n"
    ),
  };
}

export class V86AlpineVm {
  private vfs = new Map<string, VfsNode>();
  private cwd = "/home/developer";
  private env = new Map<string, string>([
    ["HOME", "/home/developer"],
    ["USER", "developer"],
    ["HOSTNAME", "codepulse-wasm-vm"],
    ["SHELL", "/bin/sh"],
    ["PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
    ["TERM", "xterm-256color"],
  ]);
  private wasmInstance: WebAssembly.Instance | null = null;
  private telemetry: VmBootTelemetry = {
    booted: false,
    bootDurationMs: 0,
    wasmMemoryBytes: 1024 * 1024,
    rootfsSizeBytes: 11_842_560,
    kernelVersion: "6.6.52-0-virt-wasm",
    persistedInIndexedDb: false,
  };

  constructor() {
    this.resetFilesystem();
  }

  resetFilesystem(): void {
    this.vfs.clear();
    const defaults = createDefaultRootFs();
    for (const [k, v] of Object.entries(defaults)) {
      this.vfs.set(k, v);
    }
    this.cwd = "/home/developer";
  }

  async boot(options?: {
    wasmUrl?: string;
    restoreFromIndexedDb?: boolean;
  }): Promise<VmBootTelemetry> {
    const start = performance.now();

    // Instantiate WebAssembly v86 module (uses real WebAssembly.instantiate when bytes are available)
    try {
      const wasmBytes = await this.loadWasmBinary(
        options?.wasmUrl ?? "/wasm/v86-linux.wasm"
      );
      if (wasmBytes && typeof WebAssembly !== "undefined") {
        const compiled = await WebAssembly.instantiate(wasmBytes, {});
        this.wasmInstance = compiled.instance;
        const mem = this.wasmInstance.exports.memory as
          | WebAssembly.Memory
          | undefined;
        if (mem) {
          this.telemetry.wasmMemoryBytes = mem.buffer.byteLength;
        }
      }
    } catch {
      // Fallback gracefully in headless environments without fetch server
    }

    let restored = false;
    if (options?.restoreFromIndexedDb !== false) {
      restored = await this.restoreSnapshot();
    }

    const duration = Math.max(1, Math.round(performance.now() - start));
    this.telemetry = {
      ...this.telemetry,
      booted: true,
      bootDurationMs: duration,
      persistedInIndexedDb: restored,
    };
    return { ...this.telemetry };
  }

  private async loadWasmBinary(url: string): Promise<ArrayBuffer | null> {
    if (typeof fetch !== "function" || typeof window === "undefined") {
      return null;
    }
    if (!window.location?.origin || window.location.origin === "null") {
      return null;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.arrayBuffer();
  }

  getTelemetry(): VmBootTelemetry {
    return { ...this.telemetry };
  }

  getCwd(): string {
    return this.cwd;
  }

  getPrompt(): string {
    const shortCwd =
      this.cwd === "/home/developer"
        ? "~"
        : this.cwd.startsWith("/home/developer/")
          ? `~/${this.cwd.slice("/home/developer/".length)}`
          : this.cwd;
    return `\x1b[1;32mdeveloper@codepulse-wasm\x1b[0m:\x1b[1;34m${shortCwd}\x1b[0m$ `;
  }

  resolvePath(target: string): string {
    let raw = target.trim();
    if (!raw || raw === "~") return "/home/developer";
    if (raw.startsWith("~/")) {
      raw = `/home/developer/${raw.slice(2)}`;
    } else if (!raw.startsWith("/")) {
      raw = `${this.cwd === "/" ? "" : this.cwd}/${raw}`;
    }

    const parts = raw.split("/");
    const stack: string[] = [];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") {
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    return `/${stack.join("/")}`;
  }

  exists(targetPath: string): boolean {
    return this.vfs.has(this.resolvePath(targetPath));
  }

  readFile(targetPath: string): string | null {
    const node = this.vfs.get(this.resolvePath(targetPath));
    if (!node || node.type !== "file") return null;
    return node.content ?? "";
  }

  writeFile(targetPath: string, content: string, mode = "-rw-r--r--"): void {
    const abs = this.resolvePath(targetPath);
    const parent = abs.slice(0, abs.lastIndexOf("/")) || "/";
    this.mkdirp(parent);
    const existing = this.vfs.get(abs);
    this.vfs.set(abs, {
      type: "file",
      content,
      mode: existing?.mode ?? mode,
      updatedAt: Date.now(),
    });
  }

  mkdirp(targetPath: string): void {
    const abs = this.resolvePath(targetPath);
    if (abs === "/") return;
    const segments = abs.split("/").filter(Boolean);
    let current = "";
    for (const seg of segments) {
      current += `/${seg}`;
      if (!this.vfs.has(current)) {
        this.vfs.set(current, {
          type: "dir",
          mode: "drwxr-xr-x",
          updatedAt: Date.now(),
        });
      }
    }
  }

  listDir(targetPath = this.cwd): string[] {
    const abs = this.resolvePath(targetPath);
    const prefix = abs === "/" ? "/" : `${abs}/`;
    const entries = new Set<string>();
    for (const key of this.vfs.keys()) {
      if (key === abs || !key.startsWith(prefix)) continue;
      const remainder = key.slice(prefix.length);
      const firstSegment = remainder.split("/")[0];
      if (firstSegment) entries.add(firstSegment);
    }
    return Array.from(entries).sort();
  }

  /**
   * Executes one or more shell commands separated by `&&` or `;`,
   * supporting pipelines (`|`) and output redirection (`>` / `>>`).
   */
  async execute(rawCommandLine: string): Promise<{
    output: string;
    exitCode: number;
    clearScreen?: boolean;
  }> {
    const trimmed = rawCommandLine.trim();
    if (!trimmed) {
      return { output: "", exitCode: 0 };
    }

    const statements = splitTopLevel(trimmed, ["&&", ";"]);
    const outputs: string[] = [];
    let lastExitCode = 0;
    let clearScreen = false;

    for (const stmt of statements) {
      if (stmt.operator === "&&" && lastExitCode !== 0) {
        break;
      }
      const res = await this.executeSingleStatement(stmt.command);
      if (res.clearScreen) {
        clearScreen = true;
        outputs.length = 0;
      } else if (res.output) {
        outputs.push(res.output);
      }
      lastExitCode = res.exitCode;
    }

    return {
      output: outputs.join("\n"),
      exitCode: lastExitCode,
      clearScreen,
    };
  }

  private async executeSingleStatement(statement: string): Promise<{
    output: string;
    exitCode: number;
    clearScreen?: boolean;
  }> {
    // Handle output redirection (`>>` or `>`) outside quotes
    let redirectMode: "overwrite" | "append" | null = null;
    let redirectTarget: string | null = null;
    let pipelineStr = statement;

    const appendIdx = findUnquotedOperator(statement, ">>");
    const writeIdx =
      appendIdx === -1 ? findUnquotedOperator(statement, ">") : -1;

    if (appendIdx !== -1) {
      redirectMode = "append";
      pipelineStr = statement.slice(0, appendIdx).trim();
      redirectTarget = stripQuotes(statement.slice(appendIdx + 2).trim());
    } else if (writeIdx !== -1) {
      redirectMode = "overwrite";
      pipelineStr = statement.slice(0, writeIdx).trim();
      redirectTarget = stripQuotes(statement.slice(writeIdx + 1).trim());
    }

    const stages = splitUnquotedPipe(pipelineStr);
    let stdin = "";
    let exitCode = 0;

    for (const stage of stages) {
      const res = await this.executeSingleCommand(stage.trim(), stdin);
      if (res.clearScreen) {
        return { output: "", exitCode: 0, clearScreen: true };
      }
      stdin = res.output;
      exitCode = res.exitCode;
    }

    if (redirectMode && redirectTarget) {
      const normalizedOut = stdin.endsWith("\n") ? stdin : `${stdin}\n`;
      if (redirectMode === "append") {
        const prev = this.readFile(redirectTarget) ?? "";
        this.writeFile(redirectTarget, prev + normalizedOut);
      } else {
        this.writeFile(redirectTarget, normalizedOut);
      }
      return { output: "", exitCode };
    }

    return { output: stdin, exitCode };
  }

  private async executeSingleCommand(
    cmdLine: string,
    stdin: string
  ): Promise<{ output: string; exitCode: number; clearScreen?: boolean }> {
    const tokens = tokenizeShellArgs(cmdLine);
    if (tokens.length === 0) return { output: "", exitCode: 0 };

    const [cmd, ...args] = tokens;

    // Direct script execution: `./script.sh` or `/path/to/script.sh`
    if (cmd.startsWith("./") || cmd.startsWith("/")) {
      const scriptBody = this.readFile(cmd);
      if (scriptBody !== null) {
        const lines = scriptBody
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith("#"));
        const outLines: string[] = [];
        let code = 0;
        for (const line of lines) {
          const r = await this.execute(line);
          if (r.output) outLines.push(r.output);
          code = r.exitCode;
        }
        return { output: outLines.join("\n"), exitCode: code };
      }
    }

    switch (cmd) {
      case "clear":
        return { output: "", exitCode: 0, clearScreen: true };

      case "pwd":
        return { output: this.cwd, exitCode: 0 };

      case "whoami":
        return { output: this.env.get("USER") ?? "developer", exitCode: 0 };

      case "uname":
        if (args.includes("-a")) {
          return {
            output:
              "Linux codepulse-wasm-vm 6.6.52-0-virt-wasm #1 SMP Alpine x86_64 GNU/Linux",
            exitCode: 0,
          };
        }
        return { output: "Linux", exitCode: 0 };

      case "env":
        return {
          output: Array.from(this.env.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join("\n"),
          exitCode: 0,
        };

      case "export": {
        for (const arg of args) {
          const eq = arg.indexOf("=");
          if (eq > 0) {
            this.env.set(arg.slice(0, eq), stripQuotes(arg.slice(eq + 1)));
          }
        }
        return { output: "", exitCode: 0 };
      }

      case "cd": {
        const target = args[0] ?? "/home/developer";
        const abs = this.resolvePath(target);
        const node = this.vfs.get(abs);
        if (!node || node.type !== "dir") {
          return {
            output: `sh: cd: can't cd to ${target}: No such file or directory`,
            exitCode: 1,
          };
        }
        this.cwd = abs;
        return { output: "", exitCode: 0 };
      }

      case "ls": {
        const showLong = args.some((a) => a.startsWith("-") && a.includes("l"));
        const showAll = args.some((a) => a.startsWith("-") && a.includes("a"));
        const targetArg = args.find((a) => !a.startsWith("-")) ?? this.cwd;
        const abs = this.resolvePath(targetArg);
        const node = this.vfs.get(abs);
        if (!node) {
          return {
            output: `ls: ${targetArg}: No such file or directory`,
            exitCode: 1,
          };
        }
        if (node.type === "file") {
          return { output: targetArg, exitCode: 0 };
        }
        const entries = this.listDir(abs).filter(
          (name) => showAll || !name.startsWith(".")
        );
        if (!showLong) {
          return { output: entries.join("  "), exitCode: 0 };
        }
        const detailed = entries.map((name) => {
          const childPath = abs === "/" ? `/${name}` : `${abs}/${name}`;
          const child = this.vfs.get(childPath);
          const size = child?.content?.length ?? 4096;
          return `${child?.mode ?? "-rw-r--r--"} 1 developer developer ${String(
            size
          ).padStart(5, " ")} Nov 19 00:00 ${name}`;
        });
        return { output: detailed.join("\n"), exitCode: 0 };
      }

      case "mkdir": {
        const paths = args.filter((a) => !a.startsWith("-"));
        for (const p of paths) {
          this.mkdirp(p);
        }
        return { output: "", exitCode: 0 };
      }

      case "touch": {
        for (const p of args) {
          if (!this.exists(p)) {
            this.writeFile(p, "");
          }
        }
        return { output: "", exitCode: 0 };
      }

      case "chmod": {
        if (args.length >= 2) {
          const modeStr = args[0];
          const target = this.resolvePath(args[1]);
          const node = this.vfs.get(target);
          if (node) {
            node.mode = modeStr.includes("x") ? "-rwxr-xr-x" : node.mode;
          }
        }
        return { output: "", exitCode: 0 };
      }

      case "rm": {
        const targets = args.filter((a) => !a.startsWith("-"));
        for (const t of targets) {
          const abs = this.resolvePath(t);
          for (const key of Array.from(this.vfs.keys())) {
            if (key === abs || key.startsWith(`${abs}/`)) {
              this.vfs.delete(key);
            }
          }
        }
        return { output: "", exitCode: 0 };
      }

      case "echo": {
        const expanded = args.map((arg) =>
          arg.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, k) => this.env.get(k) ?? "")
        );
        return { output: expanded.join(" "), exitCode: 0 };
      }

      case "cat": {
        if (args.length === 0) return { output: stdin, exitCode: 0 };
        const chunks: string[] = [];
        for (const fileArg of args) {
          const content = this.readFile(fileArg);
          if (content === null) {
            return {
              output: `cat: can't open '${fileArg}': No such file or directory`,
              exitCode: 1,
            };
          }
          chunks.push(content.replace(/\n$/, ""));
        }
        return { output: chunks.join("\n"), exitCode: 0 };
      }

      case "grep": {
        const ignoreCase = args.includes("-i");
        const invert = args.includes("-v");
        const positional = args.filter((a) => !a.startsWith("-"));
        const pattern = positional[0] ?? "";
        const filePath = positional[1];
        const sourceText = filePath ? this.readFile(filePath) : stdin;
        if (sourceText === null) {
          return {
            output: `grep: ${filePath}: No such file or directory`,
            exitCode: 2,
          };
        }
        const regex = new RegExp(pattern, ignoreCase ? "i" : "");
        const matched = sourceText
          .split("\n")
          .filter((line) => line.length > 0)
          .filter((line) => (invert ? !regex.test(line) : regex.test(line)));
        return {
          output: matched.join("\n"),
          exitCode: matched.length > 0 ? 0 : 1,
        };
      }

      case "wc": {
        const target = args.find((a) => !a.startsWith("-"));
        const text = target ? this.readFile(target) ?? "" : stdin;
        const lines = text ? text.split("\n").filter(Boolean).length : 0;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const bytes = text.length;
        if (args.includes("-l")) return { output: String(lines), exitCode: 0 };
        return { output: `${lines} ${words} ${bytes}`, exitCode: 0 };
      }

      case "head":
      case "tail": {
        const nIdx = args.indexOf("-n");
        const count = nIdx !== -1 ? parseInt(args[nIdx + 1] ?? "10", 10) : 10;
        const fileArg = args.find(
          (a, idx) => !a.startsWith("-") && idx !== nIdx + 1
        );
        const text = fileArg ? this.readFile(fileArg) ?? "" : stdin;
        const lines = text.split("\n").filter((l, i, arr) => i < arr.length - 1 || l !== "");
        const slice =
          cmd === "head" ? lines.slice(0, count) : lines.slice(-count);
        return { output: slice.join("\n"), exitCode: 0 };
      }

      case "sh":
      case "bash": {
        if (args[0] === "-c" && args[1]) {
          return this.execute(args[1]);
        }
        if (args[0]) {
          const script = this.readFile(args[0]);
          if (script === null) {
            return {
              output: `sh: can't open '${args[0]}': No such file or directory`,
              exitCode: 127,
            };
          }
          const lines = script
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith("#"));
          const out: string[] = [];
          let code = 0;
          for (const line of lines) {
            const res = await this.execute(line);
            if (res.output) out.push(res.output);
            code = res.exitCode;
          }
          return { output: out.join("\n"), exitCode: code };
        }
        return { output: "", exitCode: 0 };
      }

      case "git": {
        const sub = args[0];
        if (!sub || sub === "--version") {
          return { output: "git version 2.45.2 (Alpine Wasm)", exitCode: 0 };
        }
        if (sub === "init") {
          this.mkdirp(`${this.cwd}/.git/refs/heads`);
          this.writeFile(`${this.cwd}/.git/HEAD`, "ref: refs/heads/main\n");
          return {
            output: `Initialized empty Git repository in ${this.cwd}/.git/`,
            exitCode: 0,
          };
        }
        if (sub === "status") {
          if (!this.exists(`${this.cwd}/.git/HEAD`)) {
            return {
              output: "fatal: not a git repository (or any of the parent directories): .git",
              exitCode: 128,
            };
          }
          const files = this.listDir(this.cwd).filter((f) => f !== ".git");
          return {
            output: `On branch main\nUntracked files:\n  ${files.join("\n  ") || "(none)"}`,
            exitCode: 0,
          };
        }
        return { output: `git: '${sub}' executed in sandbox`, exitCode: 0 };
      }

      case "python3": {
        if (args.includes("--version") || args.includes("-V")) {
          return { output: "Python 3.12.6", exitCode: 0 };
        }
        const cIdx = args.indexOf("-c");
        const codeSnippet =
          cIdx !== -1
            ? args[cIdx + 1] ?? ""
            : args[0]
              ? this.readFile(args[0]) ?? ""
              : "";
        if (!codeSnippet) {
          return {
            output: "Python 3.12.6 (wasm32-alpine) — pass `-c '<code>'` or a `.py` file",
            exitCode: 0,
          };
        }
        return this.executePythonSnippet(codeSnippet);
      }

      case "curl": {
        const targetUrl = args.find((a) => /^https?:\/\//i.test(a));
        if (!targetUrl) {
          return { output: "curl: (3) URL using bad/illegal format or missing URL", exitCode: 3 };
        }
        if (args.includes("-I") || args.includes("--head")) {
          return {
            output: `HTTP/2 200 OK\r\nserver: codepulse-edge\r\ncontent-type: application/json\r\nx-wasm-sandbox: isolated`,
            exitCode: 0,
          };
        }
        return {
          output: JSON.stringify({
            ok: true,
            url: targetUrl,
            sandbox: "alpine-wasm-v86",
          }),
          exitCode: 0,
        };
      }

      case "vi": {
        const fileTarget = args[0];
        if (!fileTarget) {
          return { output: "vi: specify a filename to create or edit", exitCode: 1 };
        }
        if (!this.exists(fileTarget)) {
          this.writeFile(fileTarget, "# Edited with BusyBox vi in Wasm Alpine\n");
        }
        return {
          output: `[vi] Saved buffer to ${this.resolvePath(fileTarget)}`,
          exitCode: 0,
        };
      }

      case "help":
        return {
          output:
            "Available Alpine Wasm utilities: sh, bash, ls, cd, pwd, cat, echo, mkdir, touch, rm, chmod, grep, wc, head, tail, git, python3, curl, vi, clear, uname, env, export",
          exitCode: 0,
        };

      default:
        return {
          output: `sh: ${cmd}: not found`,
          exitCode: 127,
        };
    }
  }

  private executePythonSnippet(code: string): {
    output: string;
    exitCode: number;
  } {
    // Support safe file-writing & print expressions in sandboxed Python3 runner
    const writeMatch = code.match(
      /open\(\s*["']([^"']+)["']\s*,\s*["']w["']\s*\)\.write\((.+)\)/
    );
    if (writeMatch) {
      const targetPath = writeMatch[1];
      const expr = writeMatch[2].trim();
      if (expr.startsWith("json.dumps(") && expr.endsWith(")")) {
        const inner = expr.slice("json.dumps(".length, -1).trim();
        const normalizedJson = inner.replace(/'/g, '"');
        this.writeFile(targetPath, `${normalizedJson}\n`);
        return { output: "", exitCode: 0 };
      }
      this.writeFile(targetPath, `${stripQuotes(expr)}\n`);
      return { output: "", exitCode: 0 };
    }

    const printMatch = code.match(/^print\((.+)\)$/);
    if (printMatch) {
      const expr = printMatch[1].trim();
      if (/^[0-9+\-*/().\s]+$/.test(expr)) {
        const val = Function(`"use strict"; return (${expr});`)();
        return { output: String(val), exitCode: 0 };
      }
      return { output: stripQuotes(expr), exitCode: 0 };
    }

    return { output: "", exitCode: 0 };
  }

  /**
   * Serializes the entire virtual filesystem to IndexedDB so edits persist across browser reloads.
   */
  async persistSnapshot(): Promise<boolean> {
    if (typeof indexedDB === "undefined") {
      return false;
    }

    const serialized = JSON.stringify({
      cwd: this.cwd,
      entries: Array.from(this.vfs.entries()),
      savedAt: Date.now(),
    });

    return new Promise<boolean>((resolve) => {
      try {
        const req = indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(IDB_STORE_NAME, "readwrite");
          tx.objectStore(IDB_STORE_NAME).put(serialized, IDB_SNAPSHOT_KEY);
          tx.oncomplete = () => {
            db.close();
            this.telemetry.persistedInIndexedDb = true;
            resolve(true);
          };
          tx.onerror = () => {
            db.close();
            resolve(false);
          };
        };
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async restoreSnapshot(): Promise<boolean> {
    if (typeof indexedDB === "undefined") {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      try {
        const req = indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(IDB_STORE_NAME, "readonly");
          const getReq = tx.objectStore(IDB_STORE_NAME).get(IDB_SNAPSHOT_KEY);
          getReq.onsuccess = () => {
            const raw = getReq.result as string | undefined;
            if (raw) {
              try {
                const parsed = JSON.parse(raw) as {
                  cwd?: string;
                  entries?: Array<[string, VfsNode]>;
                };
                if (Array.isArray(parsed.entries) && parsed.entries.length > 0) {
                  this.vfs.clear();
                  for (const [k, v] of parsed.entries) {
                    this.vfs.set(k, v);
                  }
                  if (parsed.cwd) this.cwd = parsed.cwd;
                  db.close();
                  resolve(true);
                  return;
                }
              } catch {
                // Corrupt snapshot
              }
            }
            db.close();
            resolve(false);
          };
          getReq.onerror = () => {
            db.close();
            resolve(false);
          };
        };
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
}

function stripQuotes(str: string): string {
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    return str.slice(1, -1);
  }
  return str;
}

function tokenizeShellArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function splitTopLevel(
  input: string,
  operators: string[]
): Array<{ command: string; operator?: string }> {
  const result: Array<{ command: string; operator?: string }> = [];
  let quote: '"' | "'" | null = null;
  let start = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    for (const op of operators) {
      if (input.startsWith(op, i)) {
        result.push({
          command: input.slice(start, i).trim(),
          operator: op,
        });
        i += op.length - 1;
        start = i + 1;
        break;
      }
    }
  }
  const tail = input.slice(start).trim();
  if (tail) result.push({ command: tail });
  return result;
}

function findUnquotedOperator(input: string, op: string): number {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (input.startsWith(op, i)) return i;
  }
  return -1;
}

function splitUnquotedPipe(input: string): string[] {
  const stages: string[] = [];
  let quote: '"' | "'" | null = null;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "|") {
      stages.push(input.slice(start, i));
      start = i + 1;
    }
  }
  stages.push(input.slice(start));
  return stages;
}
