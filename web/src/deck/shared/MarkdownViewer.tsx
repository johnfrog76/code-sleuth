import { useState } from "react";
import type { CSSProperties } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { ZoomControl } from "./ZoomControl";

// Trimmed from Connected Deck's MarkdownViewer (see ../deck-engine/NOTICE.md). The engine calls it for one
// thing: presenter notes written as a plain string, in the presenter's notes window. The original renders
// that string as Markdown through react-markdown and remark-gfm; this copy keeps the same props and the zoom
// control, and shows the text as it is written, one paragraph per blank-line-separated block, so the page
// needs neither package. Notes composed from PresenterNoteKit (Say, Context, Beat) never come through here.

const useStyles = makeStyles({
  outer: {
    width: "100%",
  },
  toolbar: {
    display: "flex",
    justifyContent: "flex-end",
    paddingBottom: tokens.spacingVerticalXS,
  },
  content: {
    maxWidth: "80ch",
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    lineHeight: "1.75",
    color: tokens.colorNeutralForeground1,
    "& > *:first-child": { marginTop: 0 },
    "& > *:last-child": { marginBottom: 0 },
  },
  p: {
    whiteSpace: "pre-wrap",
    marginTop: 0,
    marginBottom: tokens.spacingVerticalM,
  },
});

interface Props {
  content: string;
  maxHeight?: string | number;
  style?: CSSProperties;
}

export function MarkdownViewer({ content, maxHeight, style }: Props) {
  const styles = useStyles();
  const [zoom, setZoom] = useState(1.25);
  const blocks = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return (
    <div className={styles.outer} style={style}>
      <div className={styles.toolbar}>
        <ZoomControl zoom={zoom} setZoom={setZoom} min={0.5} max={2} step={0.25} />
      </div>
      <div
        className={styles.content}
        style={{
          zoom,
          ...(maxHeight !== undefined ? { maxHeight, overflowY: "auto" } : {}),
        }}
      >
        {blocks.map((block, index) => (
          <p key={index} className={styles.p}>
            {block}
          </p>
        ))}
      </div>
    </div>
  );
}
