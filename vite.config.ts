import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html: easy to upload to itch.io or open from disk.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
