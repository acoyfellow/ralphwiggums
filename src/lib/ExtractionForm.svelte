<script lang="ts">
  let url = $state('https://amazon.com/dp/B09V3KXJPB');
  let taskType = $state('extract');
  let instructions = $state('name, price, description, key features, star rating, in stock status');
  let loading = $state(false);
  let output = $state(null);
  let error = $state(null);

  async function extract() {
    loading = true;
    output = null;
    error = null;

    try {
      const response = await fetch('/api/product-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, instructions })
      });

      const result = await response.json();

      if (result.success) {
        // @ts-ignore - Svelte 5 rune type inference limitation
        output = JSON.stringify(result.data, null, 2);
      } else {
        // @ts-ignore - Svelte 5 rune type inference limitation
        error = result.message || 'Extraction failed';
      }
    } catch (e) {
      // @ts-ignore - Svelte 5 rune type inference limitation
      error = e instanceof Error ? e.message : 'Network error';
    } finally {
      loading = false;
    }
  }
</script>

<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
  <div class="space-y-4">
    <div>
      <label for="url-input" class="block text-xs text-slate-400 mb-1 font-medium">URL to extract from</label>
      <input
        id="url-input"
        type="url"
        bind:value={url}
        placeholder="https://..."
        class="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
      />
    </div>

    <div>
      <label for="instructions-input" class="block text-xs text-slate-400 mb-1 font-medium">What to extract</label>
      <input
        id="instructions-input"
        type="text"
        bind:value={instructions}
        placeholder="name, price, description..."
        class="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
      />
    </div>

    <button
      onclick={extract}
      disabled={loading}
      class="w-full py-3 bg-cyan-400 text-slate-900 font-semibold rounded-md transition-all hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {#if loading}
        <span class="flex items-center justify-center gap-2">
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Extracting...
        </span>
      {:else}
        Extract Data
      {/if}
    </button>
  </div>

  {#if output}
    <div class="mt-6 p-4 bg-slate-900 border border-slate-600 rounded-md">
      <pre class="text-xs text-slate-300 whitespace-pre-wrap break-words font-mono">{output}</pre>
    </div>
  {/if}

  {#if error}
    <div class="mt-6 p-4 bg-red-500/15 border border-red-500/30 rounded-md">
      <p class="text-sm text-red-400">{error}</p>
    </div>
  {/if}
</div>
