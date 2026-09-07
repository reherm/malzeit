import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({
  // GitHub Pages mounts the static export below /malzeit/. Keep the app's
  // single route at / for prerendering and prefix only the built asset URLs.
  base: process.env.MALZEIT_BASE_PATH
    ? `${process.env.MALZEIT_BASE_PATH}/`
    : '/',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext(), sites()],
});
