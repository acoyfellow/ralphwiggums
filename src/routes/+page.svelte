<script lang="ts">
  // @ts-expect-error - Vite handles the import
  import { version } from "$lib/version";

  let url = $state("https://amazon.com/dp/B09V3KXJPB");
  let taskType = $state("extract");
  let instructions = $state(
    "name, price, description, key features, star rating, in stock status"
  );
  let loading = $state(false);
  let output = $state(null);
  let error = $state(null);

  async function extract() {
    loading = true;
    output = null;
    error = null;

    try {
      const response = await fetch("/api/product-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, instructions }),
      });

      const result = await response.json();

      if (result.success) {
        output = JSON.stringify(result.data, null, 2);
      } else {
        error = result.message || "Extraction failed";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Network error";
    } finally {
      loading = false;
    }
  }

  function copyCommand() {
    navigator.clipboard.writeText("npm install ralphwiggums");
  }

  function copyCode() {
    const code = `import { doThis } from "ralphwiggums";
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string(),
  price: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  rating: z.number(),
  inStock: z.boolean(),
});

const result = await doThis(
  "Go to this page and extract the product details",
  { schema: ProductSchema }
);

console.log(result.data);`;
    navigator.clipboard.writeText(code);
  }

  let concurrent = $state(5);
  let hoursPerDay = $state(24);
  let tasksPerHour = $state(10);
  let iterationsPerTask = $state(3);

  let workersCost = $derived(
    (
      Math.max(
        0,
        (tasksPerHour * hoursPerDay * 30 * iterationsPerTask - 10_000_000) /
          1_000_000
      ) * 0.5
    ).toFixed(2)
  );
  let containerCost = $derived(
    (
      ((concurrent * hoursPerDay * 3600 * 30) / 1_000_000_000) *
      0.0000015 *
      1000
    ).toFixed(2)
  );
  let doCost = $derived(
    (
      ((tasksPerHour * hoursPerDay * 30 * iterationsPerTask) / 1_000_000) *
        0.15 +
      ((tasksPerHour * hoursPerDay * 30) / 1_000_000) * 12.5
    ).toFixed(2)
  );
  let totalCost = $derived(
    (
      parseFloat(workersCost) +
      parseFloat(containerCost) +
      parseFloat(doCost)
    ).toFixed(2)
  );

  const heroImages = [
    "/hero.jpg",
    "/install.jpg",
    "/build.jpg",
    "/loop.jpg",
    "/orchestration.jpg",
    "/containment.jpg",
    "/overnight.jpg",
    "/garbage.jpg",
    "/new-ralph.jpg",
    "/fresh.jpg",
    "/iterate.jpg",
    "/sell.jpg",
  ];
  let currentImageIndex = $state(0);

  $effect(() => {
    const interval = setInterval(() => {
      currentImageIndex = (currentImageIndex + 1) % heroImages.length;
    }, 3000);
    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>ralphwiggums - Loops That Never Give Up</title>
  <meta
    name="description"
    content="Browser automation loops that just keep trying. Tell it what to do in plain English, deploy to your Cloudflare infrastructure."
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div
  class="flex min-h-screen bg-slate-900 font-mono text-slate-50 leading-[1.6] antialiased"
  style="font-family: 'Google Sans Code', Monaco, Consolas, monospace;"
>
  <!-- Sidebar -->
  <aside
    class="hidden lg:flex fixed top-0 left-0 h-screen w-[280px] bg-slate-800 border-r border-slate-700 overflow-y-auto z-100 flex-col"
  >
    <div class="p-6 border-b border-slate-700 bg-slate-900">
      <div class="flex items-center gap-3 mb-4">
        <div
          class="flex items-center justify-center w-8 h-8 bg-indigo-500 rounded-md text-lg text-white font-bold"
        >
          ⟳
        </div>
        <span class="text-base font-semibold tracking-[-0.02em]"
          >ralphwiggums</span
        >
      </div>
      <div
        class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-400 before:content-[''] before:w-1.5 before:h-1.5 before:bg-green-500 before:rounded-full"
      >
        v{version}
      </div>
    </div>

    <nav class="flex-1 py-4">
      <div class="mb-6">
        <div
          class="px-6 py-2 text-[10px] tracking-[0.1em] text-slate-400 font-semibold"
        >
          Getting Started
        </div>
        <a
          href="#overview"
          class="flex items-center gap-2.5 px-6 py-2.5 text-[13px] text-slate-400 transition-all duration-[0.15s] border-l-2 border-transparent hover:text-slate-50 hover:bg-slate-800"
        >
          <span class="text-[14px] opacity-70">→</span>
          Overview
        </a>
        <a
          href="#install"
          class="flex items-center gap-2.5 px-6 py-2.5 text-[13px] text-cyan-400 transition-all duration-[0.15s] border-l-2 border-cyan-400 bg-cyan-400/15"
        >
          <span class="text-[14px] opacity-70">$</span>
          Installation
        </a>
        <a
          href="#demo"
          class="flex items-center gap-2.5 px-6 py-2.5 text-[13px] text-slate-400 transition-all duration-[0.15s] border-l-2 border-transparent hover:text-slate-50 hover:bg-slate-800"
        >
          <span class="text-[14px] opacity-70">▶</span>
          Try It
        </a>
      </div>

      <div class="mb-6">
        <div
          class="px-6 py-2 text-[10px] tracking-[0.1em] text-slate-400 font-semibold"
        >
          Core Concepts
        </div>
        <a
          href="#how"
          class="flex items-center gap-2.5 px-6 py-2.5 text-[13px] text-slate-400 transition-all duration-[0.15s] border-l-2 border-transparent hover:text-slate-50 hover:bg-slate-800"
        >
          <span class="text-[14px] opacity-70">⟳</span>
          How It Works
        </a>
        <a
          href="#features"
          class="flex items-center gap-2.5 px-6 py-2.5 text-[13px] text-slate-400 transition-all duration-[0.15s] border-l-2 border-transparent hover:text-slate-50 hover:bg-slate-800"
        >
          <span class="text-[14px] opacity-70">◆</span>
          Philosophy
        </a>
        <a
          href="#code"
          class="flex items-center gap-2.5 px-6 py-2.5 text-[13px] text-slate-400 transition-all duration-[0.15s] border-l-2 border-transparent hover:text-slate-50 hover:bg-slate-800"
        >
          <span class="text-[14px] opacity-70">&#123;&#125;</span>
          Code Example
        </a>
      </div>

      <div class="mb-6">
        <div
          class="px-6 py-2 text-[10px] tracking-[0.1em] text-slate-400 font-semibold"
        >
          Resources
        </div>
        <a
          href="https://github.com/acoyfellow/ralphwiggums"
          target="_blank"
          class="flex items-center gap-2.5 px-6 py-2.5 text-[13px] text-slate-400 transition-all duration-[0.15s] border-l-2 border-transparent hover:text-slate-50 hover:bg-slate-800"
        >
          <span class="text-[14px] opacity-70">◎</span>
          GitHub
        </a>
        <a
          href="https://www.humanlayer.dev/blog/brief-history-of-ralph"
          target="_blank"
          class="flex items-center gap-2.5 px-6 py-2.5 text-[13px] text-slate-400 transition-all duration-[0.15s] border-l-2 border-transparent hover:text-slate-50 hover:bg-slate-800"
        >
          <span class="text-[14px] opacity-70">◇</span>
          Origin Story
        </a>
      </div>
    </nav>

    <div class="p-6 border-t border-slate-700">
      <a
        href="https://github.com/acoyfellow/ralphwiggums"
        target="_blank"
        class="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-md text-[12px] text-slate-400 transition-all duration-[0.15s] hover:border-slate-600 hover:text-slate-50"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
          ></path>
        </svg>
        View on GitHub
      </a>
    </div>
  </aside>

  <!-- Main content -->
  <main class="flex-1 lg:ml-[280px]">
    <!-- Mobile header -->
    <header
      class="lg:hidden sticky top-0 z-[100] px-6 py-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex items-center justify-center w-7 h-7 bg-indigo-500 rounded-[5px] text-sm text-white font-bold"
        >
          ⟳
        </div>
        <span class="text-sm font-semibold">ralphwiggums</span>
      </div>
      <a
        href="https://github.com/acoyfellow/ralphwiggums"
        target="_blank"
        class="px-3.5 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-400"
        >GitHub</a
      >
    </header>

    <div class="max-w-[1000px] mx-auto px-6 lg:px-12">
      <!-- Hero -->
      <section id="overview" class="py-20 pb-15 border-b border-slate-700">
        <div
          class="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-400/15 border border-cyan-400/30 rounded text-[11px] text-cyan-400 tracking-[0.08em] font-semibold mb-8 animate-fade-in-up"
        >
          <span>●</span>
          Browser Automation
        </div>

        <div class="mb-8 animate-fade-in-up relative w-[560px]">
          <div
            class="relative rounded-lg border border-slate-700 shadow-lg overflow-hidden"
            style="width: 560px; height: 315px;"
          >
            {#each heroImages as img, index}
              <div
                class="absolute inset-0 transition-opacity duration-1000"
                style="opacity: {index === currentImageIndex ? 1 : 0};"
              >
                <img
                  src={img}
                  alt="Ralph Wiggum slideshow"
                  style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
                />
              </div>
            {/each}
          </div>
        </div>

        <h1
          class="font-sans text-[clamp(32px,5vw,48px)] font-bold leading-[1.1] tracking-[-0.03em] mb-6 animate-fade-in-up"
        >
          The Ralph Wiggum Technique.<br />
          <span class="text-cyan-400">Now it's a library.</span>
        </h1>

        <p
          class="text-[15px] text-slate-400 max-w-[560px] leading-[1.7] mb-5 animate-fade-in-up"
        >
          AI agents in loops, doing browser automation. Simple enough to work.
          Persistent enough to finish. The technique that shipped codebases
          overnight, now packaged for Cloudflare Workers with Effect and
          Stagehand.
        </p>

        <a
          href="https://www.humanlayer.dev/blog/brief-history-of-ralph"
          target="_blank"
          class="inline-block text-[13px] text-slate-400 mb-8 animate-fade-in-up transition-colors duration-[0.15s] hover:text-cyan-400"
        >
          → Read the origin story
        </a>

        <button
          onclick={copyCommand}
          class="inline-flex items-center gap-3 px-6 py-4 bg-slate-800 border border-slate-700 rounded-lg text-base animate-fade-in-up cursor-pointer transition-all duration-[0.2s] hover:border-slate-600 hover:bg-slate-800"
        >
          <span class="text-cyan-400 select-none">$</span>
          <span class="text-slate-50">npm install ralphwiggums</span>
          <span
            class="inline-block w-2.5 h-[1.2em] bg-cyan-400 ml-0.5 align-text-bottom animate-blink"
          ></span>
          <span class="text-slate-400 text-[11px] ml-4">click to copy</span>
        </button>
      </section>

      <!-- Installation -->
      <section id="install" class="py-20 border-b border-slate-700">
        <div class="mb-12">
          <div
            class="text-[11px] tracking-[0.1em] text-cyan-400 mb-4 font-semibold"
          >
            // Installation
          </div>
          <h2 class="font-sans text-[28px] font-bold tracking-[-0.02em] mb-3">
            Get started in seconds
          </h2>
          <p class="text-base text-slate-400 max-w-[480px]">
            Install the package, configure your Cloudflare Workers, and start
            automating.
          </p>
        </div>

        <div
          class="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
        >
          <div
            class="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700"
          >
            <span class="w-3 h-3 rounded-full bg-red-500"></span>
            <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span class="w-3 h-3 rounded-full bg-green-500"></span>
            <span
              class="flex-1 text-center text-[12px] text-slate-400 mr-[52px]"
              >terminal</span
            >
          </div>
          <div
            class="p-5 text-[13px] leading-[1.7] min-h-[200px] overflow-x-auto font-mono"
          >
            <div class="mb-1">
              <span class="text-slate-400"># Install the package</span>
            </div>
            <div class="mb-1">
              <span class="text-cyan-400 select-none">$</span> npm install ralphwiggums
            </div>
            <div class="mb-1 text-slate-400">added 142 packages in 3.2s</div>
            <div class="mb-1"></div>
            <div class="mb-1">
              <span class="text-slate-400"># Deploy to Cloudflare</span>
            </div>
            <div class="mb-1">
              <span class="text-cyan-400 select-none">$</span> npx wrangler deploy
            </div>
            <div class="mb-1 text-slate-400">Uploading worker...</div>
            <div class="mb-1 text-slate-400">
              Published to https://your-worker.workers.dev
            </div>
            <div class="mb-1"></div>
            <div class="mb-1 text-green-500">✓ Ready to automate</div>
          </div>
        </div>
      </section>

      <!-- How It Works -->
      <section id="how" class="py-20 border-b border-slate-700">
        <div class="mb-12">
          <div
            class="text-[11px] tracking-[0.1em] text-cyan-400 mb-4 font-semibold"
          >
            // The Technique
          </div>
          <h2 class="font-sans text-[28px] font-bold tracking-[-0.02em] mb-3">
            How it works
          </h2>
          <p class="text-base text-slate-400 max-w-[480px]">
            Context engineering as a high-leverage activity.
          </p>
        </div>

        <div class="grid gap-6 mt-12">
          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div class="grid grid-cols-[48px_1fr] gap-5 mb-4">
              <div
                class="w-12 h-12 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-md text-[18px] font-bold text-cyan-400"
              >
                01
              </div>
              <div>
                <h3 class="text-[15px] font-semibold mb-2">
                  Declarative specs, not imperative scripts
                </h3>
                <p class="text-[15px] text-slate-400 leading-[1.6]">
                  Describe what you want, not how to get it. The agent figures
                  out the clicks, waits, and navigation. You just define the
                  goal.
                </p>
              </div>
            </div>
          </div>

          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div class="grid grid-cols-[48px_1fr] gap-5 mb-4">
              <div
                class="w-12 h-12 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-md text-[18px] font-bold text-cyan-400"
              >
                02
              </div>
              <div>
                <h3 class="text-[15px] font-semibold mb-2">
                  Carve tasks into independent loops
                </h3>
                <p class="text-[15px] text-slate-400 leading-[1.6]">
                  Each iteration gets fresh context. No accumulated state bugs.
                  No memory bloat. Just clean loops that chip away at the
                  problem until it's solved.
                </p>
              </div>
            </div>
          </div>

          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div class="grid grid-cols-[48px_1fr] gap-5 mb-4">
              <div
                class="w-12 h-12 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-md text-[18px] font-bold text-cyan-400"
              >
                03
              </div>
              <div>
                <h3 class="text-[15px] font-semibold mb-2">
                  Let it run overnight
                </h3>
                <p class="text-[15px] text-slate-400 leading-[1.6]">
                  Ship it before you sleep. Wake up to results. Checkpoints save
                  progress. Effect handles the errors. Zod validates the output.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Endgame Showcase -->
      <section
        class="py-[100px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700 border-b border-slate-700 relative overflow-hidden"
      >
        <div
          class="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(34,211,238,0.03)_2px,rgba(34,211,238,0.03)_4px)] pointer-events-none animate-glitch-scan"
        ></div>
        <div class="relative max-w-[900px] mx-auto">
          <div
            class="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 animate-pulse-glow transition-all duration-[0.3s] hover:scale-[1.02] hover:border-cyan-400 hover:animate-[glitch_0.3s_ease-in-out,pulse-glow_4s_ease-in-out_infinite]"
          >
            <div
              class="absolute top-6 right-6 px-4 py-2 bg-cyan-400/15 border border-cyan-400/30 rounded-md text-[11px] text-cyan-400 tracking-[0.1em] font-semibold z-[4] backdrop-blur-md"
            >
              The Endgame
            </div>
            <img
              src="/endgame.jpg"
              alt="Ralph deprecating gravity - The physics engine had too many dependencies"
              class="w-full h-auto block relative z-[1]"
            />
            <div
              class="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(15,23,42,0.7)] pointer-events-none z-[2]"
            ></div>
            <div
              class="absolute bottom-0 left-0 right-0 p-8 z-[3] bg-gradient-to-t from-transparent to-[rgba(15,23,42,0.95)]"
            >
              <div
                class="text-[15px] text-slate-400 leading-[1.6] max-w-[600px]"
              >
                When the physics engine has too many dependencies, you <span
                  class="text-cyan-400 font-semibold">deprecate gravity</span
                >. The technique that breaks reality to make it work. This is
                what happens when loops run long enough—they optimize the
                universe itself.
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section id="features" class="py-20 border-b border-slate-700">
        <div class="mb-12">
          <div
            class="text-[11px] tracking-[0.1em] text-cyan-400 mb-4 font-semibold"
          >
            // Philosophy
          </div>
          <h2 class="font-sans text-[28px] font-bold tracking-[-0.02em] mb-3">
            Why it works
          </h2>
          <p class="text-base text-slate-400 max-w-[480px]">
            Dumb things can work surprisingly well. This is the smart version.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div
              class="w-9 h-9 flex items-center justify-center bg-cyan-400/15 border border-cyan-400/20 rounded-md text-base mb-4"
            >
              ⟳
            </div>
            <h3 class="text-[14px] font-semibold mb-2">Dumb simple</h3>
            <p class="text-[15px] text-slate-400 leading-[1.6]">
              No complex orchestration. Just loops. The simplest thing that
              could possibly work, and it works surprisingly well.
            </p>
          </div>

          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div
              class="w-9 h-9 flex items-center justify-center bg-cyan-400/15 border border-cyan-400/20 rounded-md text-base mb-4"
            >
              ▸
            </div>
            <h3 class="text-[14px] font-semibold mb-2">Declarative</h3>
            <p class="text-[15px] text-slate-400 leading-[1.6]">
              Specs over scripts. Describe what, not how. The agent handles the
              imperative chaos of the actual browser.
            </p>
          </div>

          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div
              class="w-9 h-9 flex items-center justify-center bg-cyan-400/15 border border-cyan-400/20 rounded-md text-base mb-4"
            >
              ◇
            </div>
            <h3 class="text-[14px] font-semibold mb-2">Fresh context</h3>
            <p class="text-[15px] text-slate-400 leading-[1.6]">
              Each iteration starts clean. No accumulated bugs. No context
              window overflow. Just independent, reliable loops.
            </p>
          </div>

          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div
              class="w-9 h-9 flex items-center justify-center bg-cyan-400/15 border border-cyan-400/20 rounded-md text-base mb-4"
            >
              ⚡
            </div>
            <h3 class="text-[14px] font-semibold mb-2">Effect-first</h3>
            <p class="text-[15px] text-slate-400 leading-[1.6]">
              Typed errors, circuit breakers, semaphores. The boring
              infrastructure that makes overnight runs actually work.
            </p>
          </div>

          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div
              class="w-9 h-9 flex items-center justify-center bg-cyan-400/15 border border-cyan-400/20 rounded-md text-base mb-4"
            >
              ◎
            </div>
            <h3 class="text-[14px] font-semibold mb-2">Cloudflare native</h3>
            <p class="text-[15px] text-slate-400 leading-[1.6]">
              Workers + Durable Objects + Containers. Deploy once, run forever.
              Pay only when it's looping.
            </p>
          </div>

          <div
            class="p-6 bg-slate-800 border border-slate-700 rounded-lg transition-all duration-[0.2s] hover:border-slate-600"
          >
            <div
              class="w-9 h-9 flex items-center justify-center bg-cyan-400/15 border border-cyan-400/20 rounded-md text-base mb-4"
            >
              ▣
            </div>
            <h3 class="text-[14px] font-semibold mb-2">Your infra</h3>
            <p class="text-[15px] text-slate-400 leading-[1.6]">
              Self-hosted on your Cloudflare account. No external APIs. Your
              data never leaves your infrastructure.
            </p>
          </div>
        </div>
      </section>

      <!-- Demo -->
      <section id="demo" class="py-20 border-b border-slate-700">
        <div class="mb-12">
          <div
            class="text-[11px] tracking-[0.1em] text-cyan-400 mb-4 font-semibold"
          >
            // Interactive
          </div>
          <h2 class="font-sans text-[28px] font-bold tracking-[-0.02em] mb-3">
            Try it now
          </h2>
          <p class="text-base text-slate-400 max-w-[480px]">
            See ralphwiggums extract data from any website.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <form
              onsubmit={(e) => {
                e.preventDefault();
                extract();
              }}
            >
              <div class="mb-5">
                <label
                  for="url-input"
                  class="block text-[11px] tracking-[0.08em] text-slate-400 mb-2 font-semibold"
                  >Target URL</label
                >
                <input
                  id="url-input"
                  type="url"
                  bind:value={url}
                  class="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-md font-mono text-sm text-slate-50 transition-all duration-[0.15s] focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.15)]"
                  placeholder="https://example.com/product"
                />
              </div>

              <div class="mb-5">
                <label
                  for="task-select"
                  class="block text-[11px] tracking-[0.08em] text-slate-400 mb-2 font-semibold"
                  >Task Type</label
                >
                <select
                  id="task-select"
                  bind:value={taskType}
                  class="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-md font-mono text-sm text-slate-50 transition-all duration-[0.15s] focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.15)] cursor-pointer"
                >
                  <option value="extract">Extract Product Details</option>
                  <option value="compare">Compare Prices</option>
                  <option value="reviews">Summarize Reviews</option>
                </select>
              </div>

              <div class="mb-6">
                <label
                  for="instructions-input"
                  class="block text-[11px] tracking-[0.08em] text-slate-400 mb-2 font-semibold"
                  >Instructions</label
                >
                <textarea
                  id="instructions-input"
                  bind:value={instructions}
                  class="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-md font-mono text-sm text-slate-50 transition-all duration-[0.15s] focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.15)] min-h-[80px] resize-y"
                  placeholder="What to extract..."
                ></textarea>
              </div>

              <button
                type="button"
                onclick={extract}
                disabled={loading}
                class="w-full px-5 py-3.5 bg-indigo-500 border-0 rounded-md font-mono text-sm font-semibold text-white cursor-pointer transition-all duration-[0.15s] hover:bg-indigo-600 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-500 disabled:hover:translate-y-0"
              >
                {#if loading}
                  <span class="flex items-center justify-center gap-2">
                    <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                        fill="none"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Processing...
                  </span>
                {:else}
                  ▶ Run Extraction
                {/if}
              </button>
            </form>
          </div>

          <div
            class="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
          >
            <div
              class="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700"
            >
              <span class="w-3 h-3 rounded-full bg-red-500"></span>
              <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span class="w-3 h-3 rounded-full bg-green-500"></span>
              <span
                class="flex-1 text-center text-[12px] text-slate-400 mr-[52px]"
                >output</span
              >
            </div>
            <div
              class="p-5 text-sm leading-[1.7] min-h-[200px] overflow-x-auto font-mono"
            >
              {#if output}
                <pre
                  class="text-slate-50 whitespace-pre-wrap break-words">{output}</pre>
              {:else if error}
                <pre
                  class="text-amber-500 whitespace-pre-wrap break-words">Error: {error}</pre>
              {:else}
                <span class="text-slate-400"
                  >// Click "Run Extraction" to start</span
                >
              {/if}
            </div>
          </div>
        </div>
      </section>

      <!-- Code Example -->
      <section id="code" class="py-20 border-b-0 border-slate-700">
        <div class="mb-12">
          <div
            class="text-[11px] tracking-[0.1em] text-cyan-400 mb-4 font-semibold"
          >
            // Example
          </div>
          <h2 class="font-sans text-[28px] font-bold tracking-[-0.02em] mb-3">
            Extract product data
          </h2>
          <p class="text-base text-slate-400 max-w-[480px]">
            Simple code. Persistent loops. Reliable results.
          </p>
        </div>

        <div
          class="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
        >
          <div
            class="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700"
          >
            <span class="text-[12px] text-slate-400">extract.ts</span>
            <button
              onclick={copyCode}
              class="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded font-mono text-[11px] text-slate-400 cursor-pointer transition-all duration-[0.15s] hover:text-slate-50 hover:border-slate-600"
              >Copy</button
            >
          </div>
          <div class="p-5 text-sm leading-[1.7] overflow-x-auto">
            <pre><span class="text-[#c586c0]">import</span
              > &#123; doThis &#125; <span class="text-[#c586c0]">from</span
              > <span class="text-[#ce9178]">"ralphwiggums"</span>;
<span class="text-[#c586c0]">import</span> &#123; z &#125; <span
                class="text-[#c586c0]">from</span
              > <span class="text-[#ce9178]">"zod"</span>;

<span class="text-slate-400">// Define your schema</span>
<span class="text-[#c586c0]">const</span> <span class="text-[#4ec9b0]"
                >ProductSchema</span
              > = z.<span class="text-[#dcdcaa]">object</span>(&#123;
  name: z.<span class="text-[#dcdcaa]">string</span>(),
  price: z.<span class="text-[#dcdcaa]">string</span>(),
  description: z.<span class="text-[#dcdcaa]">string</span>(),
  features: z.<span class="text-[#dcdcaa]">array</span>(z.<span
                class="text-[#dcdcaa]">string</span
              >()),
  rating: z.<span class="text-[#dcdcaa]">number</span>(),
  inStock: z.<span class="text-[#dcdcaa]">boolean</span>(),
&#125;);

<span class="text-slate-400">// Tell it what to do in plain English</span>
<span class="text-[#c586c0]">const</span> result = <span class="text-[#c586c0]"
                >await</span
              > <span class="text-[#dcdcaa]">doThis</span>(
  <span class="text-[#ce9178]"
                >"Go to this page and extract the product details"</span
              >,
  &#123; schema: <span class="text-[#4ec9b0]">ProductSchema</span> &#125;
);

console.<span class="text-[#dcdcaa]">log</span>(result.data);
<span class="text-slate-400"
                >// &#123; name: "MacBook Pro", price: "$1,999", ... &#125;</span
              ></pre>
          </div>
        </div>
      </section>

      <!-- Cost Calculator -->
      <section id="pricing" class="py-20 border-b border-slate-700">
        <div class="mb-12">
          <div
            class="text-[11px] tracking-[0.1em] text-cyan-400 mb-4 font-semibold"
          >
            // Pricing
          </div>
          <h2 class="font-sans text-[28px] font-bold tracking-[-0.02em] mb-3">
            Calculate your costs
          </h2>
          <p class="text-base text-slate-400 max-w-[480px]">
            See how much it costs to run ralphwiggums on Cloudflare
            infrastructure.
          </p>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div class="flex flex-col gap-2">
              <label class="text-[13px] text-slate-400 font-semibold"
                >Concurrent ralphs</label
              >
              <input
                type="number"
                bind:value={concurrent}
                min="1"
                max="100"
                class="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-md font-mono text-sm text-slate-50 transition-all duration-[0.15s] focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-[13px] text-slate-400 font-semibold"
                >Hours per day</label
              >
              <input
                type="number"
                bind:value={hoursPerDay}
                min="1"
                max="24"
                class="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-md font-mono text-sm text-slate-50 transition-all duration-[0.15s] focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-[13px] text-slate-400 font-semibold"
                >Tasks per hour</label
              >
              <input
                type="number"
                bind:value={tasksPerHour}
                min="1"
                max="1000"
                class="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-md font-mono text-sm text-slate-50 transition-all duration-[0.15s] focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-[13px] text-slate-400 font-semibold"
                >Avg iterations per task</label
              >
              <input
                type="number"
                bind:value={iterationsPerTask}
                min="1"
                max="20"
                class="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-md font-mono text-sm text-slate-50 transition-all duration-[0.15s] focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div class="mt-8 pt-8 border-t border-slate-700">
            <div
              class="flex justify-between items-center py-3 border-b border-slate-700"
            >
              <span class="text-sm text-slate-400">Workers requests</span>
              <span class="text-sm text-slate-50 font-semibold"
                >${workersCost}</span
              >
            </div>
            <div
              class="flex justify-between items-center py-3 border-b border-slate-700"
            >
              <span class="text-sm text-slate-400">Container runtime</span>
              <span class="text-sm text-slate-50 font-semibold"
                >${containerCost}</span
              >
            </div>
            <div
              class="flex justify-between items-center py-3 border-b border-slate-700"
            >
              <span class="text-sm text-slate-400">Durable Objects</span>
              <span class="text-sm text-slate-50 font-semibold">${doCost}</span>
            </div>
            <div
              class="flex justify-between items-center py-3 mt-4 pt-4 border-t-2 border-slate-700"
            >
              <span class="text-base text-slate-50 font-semibold"
                >Monthly total</span
              >
              <span class="text-lg text-cyan-400 font-semibold"
                >${totalCost}</span
              >
            </div>
          </div>

          <div
            class="mt-6 pt-6 border-t border-slate-700 text-xs text-slate-400 leading-relaxed"
          >
            <p class="mb-2">
              Pricing based on <a
                href="https://developers.cloudflare.com/workers/platform/pricing/"
                target="_blank"
                class="text-cyan-400 underline hover:opacity-80"
                >Cloudflare Workers pricing</a
              >:
            </p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>
                Workers: $0.50 per million requests (first 10M free/month)
              </li>
              <li>Containers: ~$0.0000015 per GB-second</li>
              <li>
                Durable Objects: $0.15 per million requests, $12.50 per million
                Class A operations
              </li>
            </ul>
            <p class="mt-4 text-[11px] opacity-75">
              Assumptions: Each task = 1 worker request, containers run
              continuously, checkpoint saves = DO operations
            </p>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="py-10 text-center">
        <p class="text-[12px] text-slate-400">
          ralphwiggums · The Ralph Wiggum Technique, as a library
        </p>
        <p class="text-[12px] text-slate-400 mt-2">
          <a
            href="https://github.com/acoyfellow/ralphwiggums"
            target="_blank"
            class="text-cyan-400 transition-opacity duration-[0.15s] hover:opacity-80"
            >GitHub</a
          >
          <span style="margin: 0 8px; opacity: 0.3;">·</span>
          <a
            href="https://www.humanlayer.dev/blog/brief-history-of-ralph"
            target="_blank"
            class="text-cyan-400 transition-opacity duration-[0.15s] hover:opacity-80"
            >Origin Story</a
          >
        </p>
      </footer>
    </div>
  </main>
</div>

<style>
  ::selection {
    background: #22d3ee;
    color: #0f172a;
  }
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: #0f172a;
  }
  ::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #334155;
  }
  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0;
    }
  }
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes glitch {
    0%,
    100% {
      transform: translate(0);
    }
    20% {
      transform: translate(-2px, 2px);
    }
    40% {
      transform: translate(-2px, -2px);
    }
    60% {
      transform: translate(2px, 2px);
    }
    80% {
      transform: translate(2px, -2px);
    }
  }
  @keyframes glitch-scan {
    0% {
      transform: translateX(0);
    }
    10% {
      transform: translateX(-1px);
    }
    20% {
      transform: translateX(1px);
    }
    30%,
    100% {
      transform: translateX(0);
    }
  }
  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
    }
    50% {
      box-shadow:
        0 0 40px rgba(34, 211, 238, 0.6),
        0 0 60px rgba(34, 211, 238, 0.3);
    }
  }
  .animate-blink {
    animation: blink 1s step-end infinite;
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.6s ease;
  }
  .animate-glitch {
    animation: glitch 0.3s ease-in-out;
  }
  .animate-glitch-scan {
    animation: glitch-scan 8s linear infinite;
  }
  .animate-pulse-glow {
    animation: pulse-glow 4s ease-in-out infinite;
  }
</style>
