import { OpLogView } from "./OpLogView";
import type { View } from "../types";
import { defineMeta, defineStory } from "storybook";

const noNavigate = (_view: View) => {};

const meta = defineMeta({
  title: "OpLogView",
  component: OpLogView,
  parameters: { width: 1280, height: 800, settleMs: 3000 },
});
export default meta;

export const Default = defineStory({ args: { navigate: noNavigate } });
