<script setup lang="ts">
import { Check, X } from 'lucide-vue-next';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import { Button } from '~/components/ui/button';
import type { PixelCrop } from '~/composables/useNoteEditor';

defineProps<{
  imageUrl: string;
}>();

const emit = defineEmits<{
  crop: [crop: PixelCrop];
  cancel: [];
}>();

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null);

function handleApply() {
  const result = cropperRef.value?.getResult();
  const coordinates = result?.coordinates;
  if (!coordinates) return;

  emit('crop', {
    x: Math.round(coordinates.left),
    y: Math.round(coordinates.top),
    width: Math.round(coordinates.width),
    height: Math.round(coordinates.height),
    unit: 'px',
  });
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" @click.self="emit('cancel')">
      <div class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
        <header class="flex min-h-14 items-center justify-between border-b px-4">
          <div>
            <h2 class="text-base font-semibold">Crop image</h2>
            <p class="text-xs text-muted-foreground">Adjust the crop and apply it to the selected image.</p>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Cancel crop" @click="emit('cancel')">
              <X class="size-4" />
            </Button>
            <Button @click="handleApply">
              <Check class="size-4" />
              Apply
            </Button>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-auto bg-background p-4">
          <Cropper
            ref="cropperRef"
            :src="imageUrl"
            class="max-h-[62vh] w-full"
            :stencil-props="{ aspectRatio: 1 }"
            crossorigin="anonymous"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>
