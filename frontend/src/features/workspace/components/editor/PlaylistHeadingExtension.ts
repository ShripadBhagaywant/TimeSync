import { Extension } from "@tiptap/core";

export const PlaylistHeadingAttributes = Extension.create({
  name: "playlistHeadingAttributes",
  addGlobalAttributes() {
    return [{
      types: ["heading"],
      attributes: {
        playlistVideoId: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-playlist-video-id"),
          renderHTML: (attributes) => attributes.playlistVideoId
            ? { "data-playlist-video-id": attributes.playlistVideoId }
            : {},
        },
      },
    }];
  },
});

