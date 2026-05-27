<script setup lang="ts">
import type { Editor } from '@tiptap/core';
import { Bold, CheckSquare, Image as ImageIcon, Italic, List, Table as TableIcon } from 'lucide-vue-next';
import type { Component } from 'vue';
import { Button } from '~/components/ui/button';

const props = defineProps<{
  editor: Editor | null;
}>();

const emit = defineEmits<{
  addImage: [];
}>();

type ToolItem = {
  label: string;
  icon: Component;
  active?: () => boolean;
  action: () => void;
};

const insertTools = computed<ToolItem[]>(() => [
  {
    label: 'Checklist',
    icon: CheckSquare,
    active: () => props.editor?.isActive('taskList') ?? false,
    action: () => props.editor?.chain().focus().toggleTaskList().run(),
  },
  {
    label: 'Bullet list',
    icon: List,
    active: () => props.editor?.isActive('bulletList') ?? false,
    action: () => props.editor?.chain().focus().toggleBulletList().run(),
  },
  {
    label: props.editor?.isActive('table') ? 'Add table row' : 'Table',
    icon: TableIcon,
    active: () => props.editor?.isActive('table') ?? false,
    action: handleTableAction,
  },
]);

const formatTools = computed<ToolItem[]>(() => [
  {
    label: 'Bold',
    icon: Bold,
    active: () => props.editor?.isActive('bold') ?? false,
    action: () => props.editor?.chain().focus().toggleBold().run(),
  },
  {
    label: 'Italic',
    icon: Italic,
    active: () => props.editor?.isActive('italic') ?? false,
    action: () => props.editor?.chain().focus().toggleItalic().run(),
  },
]);

function handleTableAction() {
  if (!props.editor) return;

  if (props.editor.isActive('table')) {
    props.editor.chain().focus().addRowAfter().run();
  } else {
    props.editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
  }
}

function toolVariant(tool: ToolItem) {
  return tool.active?.() ? 'secondary' : 'ghost';
}
</script>

<template>
  <div v-if="editor" class="flex max-w-full items-center gap-1 overflow-x-auto rounded-md border bg-background p-1 scrollbar-thin">
    <div class="flex items-center gap-1">
      <Button
        v-for="tool in insertTools"
        :key="tool.label"
        :variant="toolVariant(tool)"
        size="icon"
        :title="tool.label"
        @click="tool.action"
      >
        <component :is="tool.icon" class="size-4" />
      </Button>
    </div>

    <div class="mx-1 h-5 w-px bg-border" />

    <div class="flex items-center gap-1">
      <Button
        v-for="tool in formatTools"
        :key="tool.label"
        :variant="toolVariant(tool)"
        size="icon"
        :title="tool.label"
        @click="tool.action"
      >
        <component :is="tool.icon" class="size-4" />
      </Button>
    </div>

    <div class="mx-1 h-5 w-px bg-border" />

    <Button
      variant="ghost"
      size="icon"
      title="Add image"
      @click="emit('addImage')"
    >
      <ImageIcon class="size-4" />
    </Button>
  </div>
</template>
