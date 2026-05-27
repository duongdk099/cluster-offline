<script setup lang="ts">
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/vue-3';

const props = defineProps<NodeViewProps>();

const imgRef = ref<HTMLImageElement | null>(null);
const isResizing = ref(false);
const aspectRatio = ref(1);

function updateAspectRatio() {
  if (!imgRef.value) return;

  const { naturalWidth, naturalHeight } = imgRef.value;
  if (naturalWidth && naturalHeight) {
    aspectRatio.value = naturalWidth / naturalHeight;
  }
}

function handleResize(event: MouseEvent) {
  if (!isResizing.value || !imgRef.value) return;

  const rect = imgRef.value.getBoundingClientRect();
  const newWidth = event.clientX - rect.left;
  if (newWidth < 50) return;

  props.updateAttributes({
    width: newWidth,
    height: newWidth / aspectRatio.value,
  });
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
}

function startResize(event: MouseEvent) {
  event.preventDefault();
  isResizing.value = true;
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
}

onBeforeUnmount(stopResize);
watch(() => props.node.attrs.src, () => nextTick(updateAspectRatio));
</script>

<template>
  <NodeViewWrapper class="relative inline-block">
    <div class="relative inline-block rounded-md" :class="selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''">
      <img
        ref="imgRef"
        :src="node.attrs.src"
        :style="{
          width: node.attrs.width ? `${node.attrs.width}px` : 'auto',
          height: node.attrs.height ? `${node.attrs.height}px` : 'auto',
          maxWidth: '100%',
        }"
        class="block rounded-md border"
        @load="updateAspectRatio"
      >

      <div
        v-if="selected"
        class="absolute bottom-[-6px] right-[-6px] z-30 size-4 cursor-nwse-resize rounded-full border-2 border-background bg-primary shadow-sm transition-transform hover:scale-110"
        @mousedown="startResize"
      />
    </div>
  </NodeViewWrapper>
</template>
