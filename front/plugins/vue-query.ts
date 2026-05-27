import {
  QueryClient,
  VueQueryPlugin,
  dehydrate,
  hydrate,
  type DehydratedState,
} from '@tanstack/vue-query';

type VueQueryPayload = {
  vueQueryState?: DehydratedState;
};

export default defineNuxtPlugin({
  name: 'vue-query',
  setup(nuxt) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 30,
        },
      },
    });

    nuxt.vueApp.use(VueQueryPlugin, { queryClient });

    const payload = nuxt.payload as typeof nuxt.payload & VueQueryPayload;

    if (import.meta.server) {
      nuxt.hooks.hook('app:rendered', () => {
        payload.vueQueryState = dehydrate(queryClient);
      });
    }

    if (import.meta.client && payload.vueQueryState) {
      hydrate(queryClient, payload.vueQueryState);
    }
  },
});
