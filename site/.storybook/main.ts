// import type { StorybookConfig } from '@storybook/react-vite';

const config: any = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links',
    '@chromatic-com/storybook',
  ],

  core: {
    builder: '@storybook/builder-vite',
  },

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  docs: {
    autodocs: true,
  },

  viteFinal: async (config) => {
    const { mergeConfig } = await import('vite');
    const { default: tailwindcss } = await import('@tailwindcss/vite');
    return mergeConfig(config, { plugins: [tailwindcss()] });
    // config.plugins = config.plugins || [];
    // config.plugins.push((await import('@tailwindcss/vite')).default());
    //
    // return mergeConfig(config, viteConfigFn({} as any));
  },
};
export default config;
