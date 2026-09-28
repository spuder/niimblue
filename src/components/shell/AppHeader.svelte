<script lang="ts">
  import type { Snippet } from "svelte";
  import IconButton from "$/components/basic/IconButton.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import AppMenu from "$/components/shell/AppMenu.svelte";
  import PrinterPill from "$/components/shell/PrinterPill.svelte";
  import { setTheme, theme } from "$/stores";
  import { tr } from "$/utils/i18n";
  import { Utils } from "@mmote/niimbluelib";

  interface Props {
    title: string;
    undoDisabled: boolean;
    redoDisabled: boolean;
    printCount: number;
    compact: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onPrinterClick: () => void;
    onPrint: () => void;
    /** Save button (dropdown) */
    save: Snippet;
  }

  let {
    title = $bindable(),
    undoDisabled,
    redoDisabled,
    printCount,
    compact,
    onUndo,
    onRedo,
    onPrinterClick,
    onPrint,
    save,
  }: Props = $props();

  const isStandalone = Utils.getAvailableTransports().capacitorBle || "__TAURI__" in window;
</script>

<header class="app-header">
  <div class="brand">
    <div class="logo"><div></div></div>
    <span>NiimBlue{isStandalone ? "s" : ""}</span>
  </div>

  {#if !compact}
    <div class="divider"></div>
    <input
      class="doc-name"
      type="text"
      bind:value={title}
      placeholder={$tr("studio.untitled")}
      aria-label={$tr("params.saved_labels.label_title")} />
  {/if}

  <div class="d-flex gap-0">
    <IconButton icon="undo" disabled={undoDisabled} onclick={onUndo} title={$tr("editor.undo")} />
    <IconButton icon="redo" disabled={redoDisabled} onclick={onRedo} title={$tr("editor.redo")} />
  </div>

  <div class="flex-grow-1"></div>

  <IconButton
    icon={$theme === "dark" ? "light_mode" : "dark_mode"}
    onclick={() => setTheme($theme === "dark" ? "light" : "dark")}
    title={$tr("studio.theme")} />

  {#if !compact}
    <AppMenu />
  {/if}

  <PrinterPill {compact} onclick={onPrinterClick} />

  {#if !compact}
    {@render save()}
  {/if}

  <button class="btn btn-primary print-btn" onclick={onPrint}>
    <MdIcon icon="print" />
    <span>{$tr("editor.print")}{printCount > 1 ? ` ${printCount}` : ""}</span>
  </button>

  {#if compact}
    <AppMenu />
  {/if}
</header>

<style>
  .app-header {
    height: 56px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px 0 16px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    position: relative;
    z-index: 5;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  .logo {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: var(--accent);
    display: grid;
    place-items: center;
  }
  .logo div {
    width: 11px;
    height: 6px;
    background: #fff;
    border-radius: 1.5px;
  }
  .divider {
    width: 1px;
    height: 22px;
    background: var(--border);
  }
  .doc-name {
    width: 220px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
    outline: none;
  }
  .doc-name:hover {
    border-color: var(--border);
  }
  .doc-name:focus {
    border-color: var(--accent);
  }
  .print-btn {
    height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .print-btn :global(.mdi) {
    font-size: 18px;
    vertical-align: 0;
  }
  :global(.header-save-btn) {
    height: 34px;
    display: inline-flex !important;
    align-items: center;
    gap: 6px;
    padding: 0 12px !important;
    font-size: 13px !important;
    font-weight: 500;
    border-radius: var(--radius-sm) !important;
  }
  :global(.header-save-btn .mdi) {
    font-size: 18px;
    vertical-align: 0;
  }
</style>
