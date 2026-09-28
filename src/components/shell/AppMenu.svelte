<script lang="ts">
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import DebugStuff from "$/components/DebugStuff.svelte";
  import { locale, locales, tr } from "$/utils/i18n";

  // eslint-disable-next-line no-undef
  const appCommit = __APP_COMMIT__;
  // eslint-disable-next-line no-undef
  const appVersion = __APP_VERSION__;
  // eslint-disable-next-line no-undef
  const buildDate = __BUILD_DATE__;

  let debugStuffShow = $state<boolean>(false);
</script>

<div class="dropdown">
  <button
    class="menu-btn"
    data-bs-toggle="dropdown"
    data-bs-auto-close="outside"
    title={$tr("studio.menu")}
    aria-label={$tr("studio.menu")}>
    <MdIcon icon="more_vert" />
  </button>
  <div class="dropdown-menu dropdown-menu-end p-2">
    <div class="px-2 pb-1 small text-secondary">{$tr("studio.menu.language")}</div>
    <select class="form-select form-select-sm mb-2" bind:value={$locale}>
      {#each Object.entries(locales) as [key, name] (key)}
        <option value={key}>{name}</option>
      {/each}
    </select>

    <a class="dropdown-item rounded" href="https://github.com/MultiMote/niimblue" target="_blank" rel="noopener">
      <MdIcon icon="code" />
      {$tr("main.code")}
    </a>
    <button class="dropdown-item rounded" onclick={() => (debugStuffShow = true)}>
      <MdIcon icon="bug_report" />
      {$tr("debug.title")}
    </button>

    <div class="px-2 pt-2 small text-secondary mono">
      {#if appVersion}
        <a class="text-secondary" href="https://github.com/MultiMote/niimblue/releases/tag/{appVersion}">
          {appVersion}
        </a>
      {:else if appCommit}
        <a class="text-secondary" href="https://github.com/MultiMote/niimblue/commit/{appCommit}">
          {appCommit.slice(0, 6)}
        </a>
      {/if}
      · {$tr("main.built")}
      {buildDate}
    </div>
  </div>
</div>

{#if debugStuffShow}
  <DebugStuff bind:show={debugStuffShow} />
{/if}

<style>
  .menu-btn {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink);
  }
  .menu-btn:hover {
    background: var(--hover);
  }
  .menu-btn :global(.mdi) {
    font-size: 20px;
    vertical-align: 0;
  }
  .dropdown-menu {
    min-width: 240px;
  }
  .dropdown-item :global(.mdi) {
    font-size: 18px;
    margin-right: 6px;
    color: var(--muted);
  }
</style>
