<script lang="ts">
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { activeRow, csvEnabled, csvInclude, csvTable } from "$/stores";
  import type { FabricJson, LabelProps } from "$/types";
  import { pickDataFile } from "$/utils/data_actions";
  import { tr } from "$/utils/i18n";
  import { renderLabel } from "$/utils/label_render";

  interface Props {
    getCanvasJson: () => FabricJson | undefined;
    labelProps: LabelProps;
    /** Changes whenever the label content changes */
    revision: number;
    compact?: boolean;
  }

  let { getCanvasJson, labelProps, revision, compact = false }: Props = $props();

  const MAX_THUMBS = 200;

  let thumbs = $state<string[]>([]);
  let renderToken = 0;

  const includedCount = $derived($csvInclude.filter((v) => v).length);
  const allSelected = $derived(includedCount === $csvTable.rows.length);

  const renderAll = async () => {
    const token = ++renderToken;
    const json = getCanvasJson();
    if (!json || !$csvEnabled) {
      thumbs = [];
      return;
    }

    const rows = $csvTable.rows.slice(0, MAX_THUMBS);
    const result: string[] = [];

    for (const row of rows) {
      if (token !== renderToken) return;
      try {
        const el = await renderLabel(json, labelProps, row);
        result.push(el.toDataURL("image/png"));
      } catch (e) {
        console.warn(e);
        result.push("");
      }
    }

    if (token === renderToken) {
      thumbs = result;
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    // dependencies
    void revision;
    void labelProps;
    void $csvTable;
    void $csvEnabled;

    clearTimeout(timer);
    timer = setTimeout(renderAll, 350);
    return () => clearTimeout(timer);
  });

  const toggleInclude = (i: number) => {
    csvInclude.update((inc) => inc.map((v, idx) => (idx === i ? !v : v)));
  };

  const toggleAll = () => {
    const value = !allSelected;
    csvInclude.update((inc) => inc.map(() => value));
  };
</script>

<div class="strip" class:compact>
  {#if $csvEnabled && $csvTable.rows.length > 0}
    <div class="strip-head">
      <span class="title">{$tr("studio.strip.labels")}</span>
      <span class="count">{includedCount} / {$csvTable.rows.length} {$tr("studio.data.selected")}</span>
      <div class="flex-grow-1"></div>
      <button class="link-btn" onclick={toggleAll}>
        {allSelected ? $tr("studio.strip.select_none") : $tr("studio.strip.select_all")}
      </button>
    </div>
    <div class="thumbs">
      {#each $csvTable.rows.slice(0, MAX_THUMBS), i (i)}
        <div class="thumb-wrap" class:excluded={!$csvInclude[i]}>
          <button class="thumb" class:active={i === $activeRow} onclick={() => activeRow.set(i)}>
            {#if thumbs[i]}
              <img
                src={thumbs[i]}
                alt="{$tr('studio.row')} {i + 1}"
                style:aspect-ratio="{labelProps.size.width} / {labelProps.size.height}" />
            {:else}
              <div class="ph" style:aspect-ratio="{labelProps.size.width} / {labelProps.size.height}"></div>
            {/if}
          </button>
          <input
            type="checkbox"
            class="inc"
            checked={$csvInclude[i]}
            onchange={() => toggleInclude(i)}
            aria-label="{$tr('studio.row')} {i + 1}" />
          <div class="num mono">{i + 1}</div>
        </div>
      {/each}
      {#if $csvTable.rows.length > MAX_THUMBS}
        <div class="more mono">+{$csvTable.rows.length - MAX_THUMBS}</div>
      {/if}
    </div>
  {:else}
    <div class="empty">
      <MdIcon icon="table_chart" />
      <span>{$tr("studio.strip.empty")}</span>
      <button class="btn btn-sm btn-secondary" onclick={pickDataFile}>{$tr("studio.strip.import")}</button>
    </div>
  {/if}
</div>

<style>
  .strip {
    flex: none;
    background: var(--panel);
    border-top: 1px solid var(--border);
    padding: 8px 12px 10px;
    --thumb-h: 52px;
  }
  .strip.compact {
    --thumb-h: 40px;
  }
  .strip-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
  }
  .title {
    font-weight: 600;
  }
  .count {
    color: var(--muted);
  }
  .link-btn {
    border: 0;
    background: transparent;
    color: var(--accent-ink);
    font-size: 12px;
    font-weight: 500;
    padding: 0;
  }
  .thumbs {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 2px 2px 2px;
  }
  .thumb-wrap {
    position: relative;
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .thumb-wrap.excluded .thumb {
    opacity: 0.45;
  }
  .thumb {
    height: var(--thumb-h);
    padding: 0;
    border: 1.5px solid var(--border);
    border-radius: 5px;
    background: #fff;
    overflow: hidden;
  }
  .thumb.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 30%, transparent);
  }
  .thumb img,
  .ph {
    height: 100%;
    display: block;
  }
  .ph {
    background: #fff;
  }
  .inc {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .num {
    font-size: 10.5px;
    color: var(--muted);
  }
  .more {
    align-self: center;
    font-size: 12px;
    color: var(--muted);
  }
  .empty {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: var(--muted);
  }
  .empty :global(.mdi) {
    font-size: 18px;
    vertical-align: 0;
  }
  .empty span {
    flex: 1;
  }
</style>
