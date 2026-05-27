const publicRoutes = ['/login', '/register'];

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;

  const auth = useAuthStore();
  if (!auth.ready) auth.bootstrap();

  if (!auth.token && !publicRoutes.includes(to.path)) {
    return navigateTo('/login');
  }

  if (auth.token && publicRoutes.includes(to.path)) {
    return navigateTo('/');
  }
});
