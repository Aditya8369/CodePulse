import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  DEFAULT_TERMINAL_CHALLENGES,
  V86AlpineVm,
} from "@/lib/wasm/v86-alpine-vm";
import { WasmTerminal } from "./wasm-terminal";

describe("V86AlpineVm & WasmTerminal Emulator", () => {
  it("boots the WebAssembly Alpine Linux VM in under 2000ms with core utilities available", async () => {
    const vm = new V86AlpineVm();
    const telemetry = await vm.boot({ restoreFromIndexedDb: false });

    expect(telemetry.booted).toBe(true);
    expect(telemetry.bootDurationMs).toBeLessThan(2000);
    expect(telemetry.rootfsSizeBytes).toBeLessThan(15 * 1024 * 1024);

    for (const bin of [
      "/bin/sh",
      "/usr/bin/curl",
      "/usr/bin/git",
      "/usr/bin/python3",
      "/usr/bin/vi",
    ]) {
      expect(vm.exists(bin)).toBe(true);
    }
  });

  it("executes Linux shell pipelines, scripts, git, and python3 commands and verifies challenge state", async () => {
    const vm = new V86AlpineVm();
    await vm.boot({ restoreFromIndexedDb: false });

    const challenge = DEFAULT_TERMINAL_CHALLENGES[0]; // parse-access-log
    expect(challenge.verify(vm).passed).toBe(false);

    await vm.execute(
      `echo "grep ' 500 ' /var/log/nginx/access.log > /home/developer/errors.txt" > /home/developer/parse_errors.sh`
    );
    await vm.execute("chmod +x /home/developer/parse_errors.sh");
    const runRes = await vm.execute("/home/developer/parse_errors.sh");
    expect(runRes.exitCode).toBe(0);

    const outcome = challenge.verify(vm);
    expect(outcome.passed).toBe(true);
    expect(outcome.feedback).toContain("HTTP 500");

    // Verify python3 JSON generation
    await vm.execute(
      `python3 -c 'import json; open("/home/developer/health.json","w").write(json.dumps({"status":"ok"}))'`
    );
    expect(DEFAULT_TERMINAL_CHALLENGES[2].verify(vm).passed).toBe(true);
  });

  it("renders interactive xterm terminal UI, executes typed commands, and runs challenge verifier", async () => {
    const vm = new V86AlpineVm();
    render(<WasmTerminal vmInstance={vm} />);

    await waitFor(() => {
      expect(screen.getByTestId("wasm-boot-badge").textContent).toContain(
        "Booted"
      );
    });

    const input = screen.getByTestId("xterm-command-input");
    fireEvent.change(input, { target: { value: "uname -a" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByTestId("xterm-terminal-viewport").textContent
      ).toContain("6.6.52-0-virt-wasm");
    });

    // Click Verify Solution before solving -> shows failure banner
    fireEvent.click(screen.getByTestId("verify-challenge-btn"));
    expect(
      screen.getByTestId("challenge-verification-banner").textContent
    ).toContain("Missing script");
  });
});
