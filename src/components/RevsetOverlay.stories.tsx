import { defineMeta, defineStory } from "storybook";
import { ChangesView } from "../screens/ChangesView";
import { installDemoData } from "../stories/demoJj";
import { DEMO_BOOKMARKS, DEMO_CHANGES } from "../stories/demoData";
import { REVISION_FILTERS, type View } from "../types";
import { RevsetOverlay } from "./RevsetOverlay";

installDemoData();

const filters = REVISION_FILTERS.map((f) => [f[0], f[1]] as const);
const bookmarkNames = DEMO_BOOKMARKS.map((b) => b.name);
const changeIds = DEMO_CHANGES.map((c) => c.changeId);
const filePaths = Array.from(
  new Set(
    DEMO_CHANGES.flatMap((c) =>
      [...c.patch.matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1]),
    ),
  ),
);

const noNavigate = (_view: View) => {};
const noHints = () => {};
const noOp = () => {};

const meta = defineMeta({
  title: "RevsetOverlay",
  component: RevsetOverlay,
  parameters: { width: 1280, height: 800, settleMs: 3000 },
});
export default meta;

const Over = (props: { initial: string }) => (
  <>
    <ChangesView navigate={noNavigate} onHints={noHints} />
    <RevsetOverlay
      initial={props.initial}
      filters={filters}
      bookmarkNames={bookmarkNames}
      changeIds={changeIds}
      filePaths={filePaths}
      onApply={noOp}
      onCancel={noOp}
    />
  </>
);

export const Default = defineStory({
  render: () => <Over initial="ancestors(@) ~ root()" />,
});

export const Mine = defineStory({
  render: () => <Over initial="mine()" />,
});

export const Empty = defineStory({
  render: () => <Over initial="" />,
});
