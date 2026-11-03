// src/features/workspace/components/editor/ImageExtension.ts
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewProps,
} from "@tiptap/react";
import React from "react";
import { Trash2 } from "lucide-react";
import { notify } from "@/lib/toast";

const ImageComponent: React.FC<NodeViewProps> = ({ deleteNode, node }) => {
  const handleDelete = () => {
    deleteNode();
    notify.success("Image Removed", "Image was deleted from notes.");
  };

  return React.createElement(
    NodeViewWrapper as unknown as React.ComponentType<{
      className?: string;
      children?: React.ReactNode;
    }>,
    { className: "relative inline-block my-2 group max-w-full" },
    React.createElement("img", {
      src: node.attrs.src,
      alt: node.attrs.alt || "",
      className:
        "rounded-xl border border-slate-200 max-h-96 object-contain shadow-sm",
    }),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: handleDelete,
        className:
          "absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-lg shadow-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer backdrop-blur-sm",
        title: "Remove Image",
      },
      React.createElement(Trash2, { className: "w-3.5 h-3.5" }),
    ),
  );
};

export const CustomImageNode = Node.create({
  name: "image",
  group: "block",
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent);
  },
});
