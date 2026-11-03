// src/features/workspace/components/editor/TimestampExtension.ts
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewProps,
} from "@tiptap/react";
import React from "react";
import { Play } from "lucide-react";
import { useWorkspaceStore } from "../../store/workspaceStore";

interface TimestampAttributes {
  timestamp: string;
  seconds: number;
}

const TimestampComponent: React.FC<NodeViewProps> = ({ node }) => {
  const requestSeekTo = useWorkspaceStore((state) => state.requestSeekTo);
  const attributes = node.attrs as TimestampAttributes;

  return React.createElement(
    NodeViewWrapper as unknown as React.ComponentType<{
      className?: string;
      children?: React.ReactNode;
    }>,
    { className: "inline-block mx-1 my-0.5 select-none" },
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => requestSeekTo(attributes.seconds),
        className:
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 font-mono text-xs font-semibold border border-blue-200/80 transition-all cursor-pointer",
      },
      React.createElement("span", null, attributes.timestamp),
      React.createElement(Play, { className: "w-2.5 h-2.5 fill-current" }),
    ),
  );
};

export const TimestampNode = Node.create({
  name: "timestamp",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      timestamp: { default: "00:00" },
      seconds: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="timestamp"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "timestamp" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TimestampComponent);
  },
});
