import { App } from "./App";
import { defineMeta, defineStory } from "storybook";
import { installDemoData } from "./stories/demoJj";

installDemoData();

const meta = defineMeta({
  title: "App",
  component: App,
  parameters: { width: 1280, height: 800, settleMs: 3000 },
});
export default meta;

export const Full = defineStory({});
