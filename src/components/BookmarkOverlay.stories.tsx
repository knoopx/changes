import { defineMeta, defineStory } from "storybook";
import { ChangesView } from "../screens/ChangesView";
import { installDemoData } from "../stories/demoJj";
import { DEMO } from "../stories/demoData";
import { type View } from "../types";
import { BookmarkOverlay } from "./BookmarkOverlay";

installDemoData();

const noNavigate = (_view: View) => {};
const noHints = () => {};
const noOp = () => {};

const meta = defineMeta({
  title: "BookmarkOverlay",
  component: BookmarkOverlay,
  parameters: { width: 1280, height: 800, settleMs: 3000 },
});
export default meta;

export const Default = defineStory({
  render: () => (
    <>
      <ChangesView navigate={noNavigate} onHints={noHints} />
      <BookmarkOverlay targetChangeId={DEMO.workingCopy} onDone={noOp} />
    </>
  ),
});
