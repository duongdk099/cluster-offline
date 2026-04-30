<script setup lang="ts">
import { LogOut, Menu, Plus, Search, UserRound } from 'lucide-vue-next';
import { Button } from '~/components/ui/button';
import { Kbd } from '~/components/ui/kbd';

const emit = defineEmits<{
  openCommand: [];
  newNote: [];
  logout: [];
  toggleSidebar: [];
}>();

const menuOpen = ref(false);
</script>

<template>
  <header class="flex h-12 items-center gap-3 border-b bg-background px-3 md:px-4">
    <Button
      variant="ghost"
      size="icon"
      class="md:hidden"
      aria-label="Open navigation"
      @click="emit('toggleSidebar')"
    >
      <Menu class="size-4" />
    </Button>

    <NuxtLink to="/" class="flex items-center gap-2 rounded-md px-1 text-sm font-semibold tracking-tight">
      <span class="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">N</span>
      <span>NotesAides</span>
    </NuxtLink>

    <button
      type="button"
      class="mx-auto hidden h-8 w-full max-w-md items-center gap-2 rounded-md border bg-muted/35 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
      @click="emit('openCommand')"
    >
      <Search class="size-4" />
      <span class="flex-1">Search notes and actions</span>
      <Kbd>Cmd K</Kbd>
    </button>

    <div class="ml-auto flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon"
        class="md:hidden"
        aria-label="Search"
        @click="emit('openCommand')"
      >
        <Search class="size-4" />
      </Button>

      <ThemeToggle />

      <Button size="sm" class="hidden sm:inline-flex" @click="emit('newNote')">
        <Plus class="size-4" />
        New
      </Button>

      <div class="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Account menu"
          @click="menuOpen = !menuOpen"
        >
          <UserRound class="size-4" />
        </Button>

        <div
          v-if="menuOpen"
          class="absolute right-0 top-10 z-50 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
            @click="menuOpen = false; emit('logout')"
          >
            <LogOut class="size-4" />
            Log out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
