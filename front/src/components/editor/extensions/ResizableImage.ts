
import { Image as TiptapImage } from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageResize from './ImageResize';

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
        return ReactNodeViewRenderer(ImageResize);
    },
});
