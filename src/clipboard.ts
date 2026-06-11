import { execSync, spawn } from "node:child_process";

export async function copyToClipboard(text: string): Promise<boolean> {
  const candidates: Array<[string, string[]]> = [
    ["pbcopy", []],
    ["xclip", ["-selection", "clipboard"]],
    ["wl-copy", []],
  ];
  for (const [cmd, args] of candidates) {
    let available = false;
    try {
      execSync(`command -v ${cmd}`, { stdio: "ignore" });
      available = true;
    } catch {
      available = false;
    }
    if (!available) continue;
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`${cmd} exited with code ${code}`));
        });
        child.on("error", (err) => reject(err));
        child.stdin?.write(text);
        child.stdin?.end();
      });
      return true;
    } catch {}
  }
  return false;
}
