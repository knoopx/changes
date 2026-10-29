import { BookmarksView } from "./BookmarksView";
import type { View } from "../types";
import { defineMeta, defineStory } from "storybook";
import { installDemoData } from "../stories/demoJj";

installDemoData();

const noNavigate = (_view: View) => {};

const meta = defineMeta({
  title: "BookmarksView",
  component: BookmarksView,
  parameters: { width: 1280, height: 800, settleMs: 3000 },
});
export default meta;

export const Default = defineStory({ args: { navigate: noNavigate } });
