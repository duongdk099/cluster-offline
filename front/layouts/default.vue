<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import { Toaster } from 'vue-sonner';
import 'vue-sonner/style.css';
import { Button } from '~/components/ui/button';

const route = useRoute();
const router = useRouter();
const auth = useAuth();

// Use a Nuxt-aware shared state to avoid SSR/client hydration mismatch.
// We hydrate from localStorage only after mount, then persist on changes.
const sidebarCollapsed = useState<boolean>('notesaides-sidebar-collapsed', () => false);
onMounted(() => {
  try {
    const raw = localStorage.getItem('notesaides-sidebar-collapsed');
    if (raw !== null) sidebarCollapsed.value = raw === 'true';
  } catch { /* ignore */ }
});
watch(sidebarCollapsed, (value) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('notesaides-sidebar-collapsed', String(value));
  }
});

const mobileSidebarOpen = ref(false);
const commandOpen = ref(false);

const isAuthPage = computed(() => route.path === '/login' || route.path === '/register');

function newNote() {
  mobileSidebarOpen.value = false;
  void router.push('/notes/new');
}

function logout() {
  auth.logout();
  mobileSidebarOpen.value = false;
  void router.push('/login');
}
</script>

<template>
  <div v-if="isAuthPage" class="min-h-screen bg-background text-foreground antialiased">
    <slot />
    <Toaster rich-colors position="bottom-right" />
  </div>

  <div v-else class="min-h-screen bg-background text-foreground antialiased">
    <AppTopBar
      @toggle-sidebar="mobileSidebarOpen = true"
      @open-command="commandOpen = true"
      @new-note="newNote"
      @logout="logout"
    />

    <div class="flex h-[calc(100vh-3rem)] min-h-0">
      <AppSidebar
        v-model:collapsed="sidebarCollapsed"
        class="hidden md:flex"
        @new-note="newNote"
        @logout="logout"
      />
      <main class="min-w-0 flex-1 overflow-hidden">
        <slot />
      </main>
    </div>

    <Teleport to="body">
      <div v-if="mobileSidebarOpen" class="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" @click.self="mobileSidebarOpen = false">
        <AppSidebar
          v-model:collapsed="sidebarCollapsed"
          mobile
          class="h-full"
          @new-note="newNote"
          @logout="logout"
          @close="mobileSidebarOpen = false"
        />
      </div>
    </Teleport>

    <Button
      class="fixed bottom-4 right-4 z-30 shadow-lg md:hidden"
      size="icon"
      aria-label="New note"
      @click="newNote"
    >
      <Plus class="size-5" />
    </Button>

    <CommandPalette v-model:open="commandOpen" />
    <Toaster rich-colors position="bottom-right" />
  </div>
</template>
