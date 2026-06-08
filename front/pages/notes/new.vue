<script setup lang="ts">
// /notes/new is now a thin redirect: create a blank note and replace the URL
// with /notes/{id} so it never lingers in browser history. All real entry
// points (sidebar, top bar, command palette, mobile FAB, "/" page) call the
// composable directly and never navigate to /notes/new in the first place;
// this page exists only as a safety net for bookmarks / typed URLs.
const router = useRouter();
const { openBlankNote } = useCreateAndOpenBlankNote();

onMounted(() => {
  void openBlankNote({ replace: true }).catch(() => {
    void router.replace('/');
  });
});
</script>

<template>
  <div class="flex h-full items-center justify-center text-sm text-muted-foreground">
    Creating note…
  </div>
</template>
