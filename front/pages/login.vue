<script setup lang="ts">
import { toast } from 'vue-sonner';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';

const email = ref('');
const password = ref('');
const error = ref('');
const isSubmitting = ref(false);
const auth = useAuth();
const router = useRouter();
const config = useRuntimeConfig();

async function handleLogin() {
  error.value = '';
  isSubmitting.value = true;

  try {
    const res = await fetch(`${String(config.public.apiUrl).replace(/\/$/, '')}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to login');

    auth.login(data.token);
    toast.success('Signed in');
    void router.push('/');
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to login';
    toast.error('Failed to sign in', { description: error.value });
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <div class="mb-2 flex size-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          N
        </div>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your NotesAides workspace.</CardDescription>
      </CardHeader>

      <CardContent>
        <form class="space-y-4" @submit.prevent="handleLogin">
          <div v-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {{ error }}
          </div>

          <div class="space-y-2">
            <label for="email" class="text-sm font-medium">Email</label>
            <input
              id="email"
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              class="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
          </div>

          <div class="space-y-2">
            <label for="password" class="text-sm font-medium">Password</label>
            <input
              id="password"
              v-model="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
          </div>

          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
          </Button>
        </form>
      </CardContent>

      <CardFooter class="justify-center text-sm text-muted-foreground">
        New here?
        <NuxtLink to="/register" class="ml-1 font-medium text-foreground underline underline-offset-4">
          Create account
        </NuxtLink>
      </CardFooter>
    </Card>
  </main>
</template>
