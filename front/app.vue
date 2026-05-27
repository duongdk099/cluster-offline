<template>
  <NuxtLoadingIndicator color="hsl(var(--primary))" :height="2" />
  <NuxtLayout>
    <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
  </NuxtLayout>
</template>
