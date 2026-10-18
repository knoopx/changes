import { execSync } from "node:child_process";
import { HunksView } from "./HunksView";
import { findWorkspaceRoot } from "../repo";
import type { View } from "../types";
import { defineMeta, defineStory } from "storybook";

const noNavigate = (_view: View) => {};

function currentChangeId(): string {
  try {
    return execSync("jj log -r @ --no-graph --color never -T change_id", {
      encoding: "utf8",
      cwd: findWorkspaceRoot(),
    }).trim();
  } catch {
    return "";
  }
}

const meta = defineMeta({
  title: "HunksView",
  component: HunksView,
  parameters: { width: 1280, height: 800, settleMs: 4000 },
});
export default meta;

export const Default = defineStory({
  args: { changeId: currentChangeId(), navigate: noNavigate },
});
