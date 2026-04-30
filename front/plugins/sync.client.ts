export default defineNuxtPlugin({
  name: 'sync',
  dependsOn: ['auth', 'vue-query'],
  setup() {
    const { start } = useSync();
    start();
  },
});
