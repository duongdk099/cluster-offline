export default defineNuxtPlugin({
  name: 'auth',
  setup() {
    const auth = useAuthStore();
    auth.bootstrap();
  },
});
