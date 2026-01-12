import alchemy from 'alchemy/cloudflare/sveltekit';
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
const dev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Use alchemy only for production deployment
		// Local dev uses standard Cloudflare adapter
		adapter: adapter()
   }
};

export default config;
