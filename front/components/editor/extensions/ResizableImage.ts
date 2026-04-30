import { Image as TiptapImage } from '@tiptap/extension-image';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import ImageResize from './ImageResize.vue';

export const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: (attributes) => ({
          width: attributes.width,
        }),
      },
      height: {
        default: null,
        renderHTML: (attributes) => ({
          height: attributes.height,
        }),
      },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageResize);
  },
});
