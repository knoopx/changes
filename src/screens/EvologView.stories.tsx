import { EvologView } from "./EvologView";
import type { View } from "../types";
import { defineMeta, defineStory } from "storybook";
import { demo, installDemoData } from "../stories/demoJj";

installDemoData();

const noNavigate = (_view: View) => {};

const meta = defineMeta({
  title: "EvologView",
  component: EvologView,
  parameters: { width: 1280, height: 800, settleMs: 3000 },
});
export default meta;

export const Default = defineStory({
  args: { changeId: demo.evologTarget, navigate: noNavigate },
});
