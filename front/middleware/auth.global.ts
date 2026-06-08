const publicRoutes = ['/login', '/register'];

function isPublicRoute(path: string) {
  if (publicRoutes.includes(path)) return true;
  if (path === '/share' || path.startsWith('/share/')) return true;
  return false;
}

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return;

  const auth = useAuthStore();
  if (!auth.ready) auth.bootstrap();

  if (!auth.token && !isPublicRoute(to.path)) {
    return navigateTo('/login');
  }

  if (auth.token && publicRoutes.includes(to.path)) {
    return navigateTo('/');
  }
});
