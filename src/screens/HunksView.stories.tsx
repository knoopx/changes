import { HunksView } from "./HunksView";
import type { View } from "../types";
import { defineMeta, defineStory } from "storybook";
import { demo, installDemoData } from "../stories/demoJj";

installDemoData();

const noNavigate = (_view: View) => {};

const meta = defineMeta({
  title: "HunksView",
  component: HunksView,
  parameters: { width: 1280, height: 800, settleMs: 4000 },
});
export default meta;

export const Default = defineStory({
  args: { changeId: demo.hunkTarget, navigate: noNavigate },
});
