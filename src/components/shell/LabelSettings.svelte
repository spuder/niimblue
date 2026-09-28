<script lang="ts">
  import Segmented from "$/components/basic/Segmented.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import LabelPropsEditor from "$/components/designer-controls/LabelPropsEditor.svelte";
  import type { LabelProps, LabelShape } from "$/types";
  import { tr } from "$/utils/i18n";
  import { printerMeta } from "$/stores";

  interface Props {
    labelProps: LabelProps;
    onChange: (newProps: LabelProps) => void;
  }

  let { labelProps, onChange }: Props = $props();

  const PRESETS: [number, number][] = [
    [40, 20],
    [40, 12],
    [50, 30],
    [30, 15],
    [25, 15],
    [60, 40],
  ];

  const dpmm = $derived(labelProps.dpmm ?? 8);
  const widthMm = $derived(Math.round((labelProps.size.width / dpmm) * 10) / 10);
  const heightMm = $derived(Math.round((labelProps.size.height / dpmm) * 10) / 10);

  const apply = (
    opts: Partial<{ w: number; h: number; dpmm: number; dir: LabelProps["printDirection"]; shape: LabelShape }>,
  ) => {
    const newDpmm = opts.dpmm ?? dpmm;
    const dir = opts.dir ?? labelProps.printDirection;
    let w = (opts.w ?? widthMm) * newDpmm;
    let h = (opts.h ?? heightMm) * newDpmm;

    w = Math.max(w, newDpmm);
    h = Math.max(h, newDpmm);

    // printhead dimension must be multiple of 8
    if (dir === "left") {
      h -= h % 8;
    } else {
      w -= w % 8;
    }

    const shape = opts.shape ?? labelProps.shape ?? "rect";

    onChange({
      ...labelProps,
      printDirection: dir,
      size: { width: Math.floor(w), height: Math.floor(h) },
      shape,
      split: shape === "circle" ? "none" : labelProps.split,
      dpmm: newDpmm,
    });
  };

  const isPreset = (w: number, h: number) => Math.abs(widthMm - w) < 1 && Math.abs(heightMm - h) < 1;

  const warning = $derived.by(() => {
    if ($printerMeta === undefined) return "";
    const headSize = labelProps.printDirection == "left" ? labelProps.size.height : labelProps.size.width;
    if (headSize > $printerMeta.printheadPixels) {
      return `${$tr("params.label.warning.width")} (${headSize} > ${$printerMeta.printheadPixels})`;
    }
    if ($printerMeta.printDirection !== labelProps.printDirection) {
      return `${$tr("params.label.warning.direction")} ${$tr(
        $printerMeta.printDirection === "left" ? "params.label.direction.left" : "params.label.direction.top",
      )}`;
    }
    return "";
  });
</script>

<div class="insp-section">
  <div class="insp-title">{$tr("studio.label.size")}</div>
  <div class="presets">
    {#each PRESETS as [w, h] (`${w}x${h}`)}
      <button class="chip mono" class:active={isPreset(w, h)} onclick={() => apply({ w, h })}>{w}×{h}</button>
    {/each}
  </div>

  <div class="row-2">
    <label class="num-field">
      <span>W</span>
      <input
        class="mono"
        type="number"
        min="1"
        step="1"
        value={widthMm}
        onchange={(e) => apply({ w: e.currentTarget.valueAsNumber })} />
      <em>mm</em>
    </label>
    <label class="num-field">
      <span>H</span>
      <input
        class="mono"
        type="number"
        min="1"
        step="1"
        value={heightMm}
        onchange={(e) => apply({ h: e.currentTarget.valueAsNumber })} />
      <em>mm</em>
    </label>
  </div>

  <div class="field-row">
    <span>{$tr("studio.label.corners")}</span>
    <Segmented
      size="sm"
      value={labelProps.shape ?? "rect"}
      options={[
        { value: "rect", label: $tr("studio.label.square") },
        { value: "rounded_rect", label: $tr("studio.label.rounded") },
        { value: "circle", label: $tr("studio.label.circle") },
      ]}
      onChange={(shape) => apply({ shape })} />
  </div>

  <div class="field-row">
    <span>{$tr("studio.label.resolution")}</span>
    <Segmented
      size="sm"
      value={dpmm}
      options={[
        { value: 8, label: "203 dpi" },
        { value: 11.81, label: "300 dpi" },
      ]}
      onChange={(v) => apply({ dpmm: v })} />
  </div>

  <div class="field-row">
    <span>{$tr("params.label.direction")}</span>
    <Segmented
      size="sm"
      value={labelProps.printDirection}
      options={[
        { value: "left", label: $tr("params.label.direction.left") },
        { value: "top", label: $tr("params.label.direction.top") },
      ]}
      onChange={(dir) => apply({ dir })} />
  </div>

  {#if warning}
    <div class="warn"><MdIcon icon="warning" /> {warning}</div>
  {/if}

  <LabelPropsEditor {labelProps} {onChange} triggerClass="advanced-btn">
    {#snippet trigger()}
      <MdIcon icon="tune" />
      {$tr("studio.label.advanced")}
    {/snippet}
  </LabelPropsEditor>
</div>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 10px;
  }
  .chip {
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    background: var(--panel);
    color: var(--ink);
    font-size: 11.5px;
  }
  .chip:hover {
    border-color: var(--accent);
  }
  .chip.active {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 10px;
  }
  .warn {
    font-size: 12px;
    color: var(--danger);
    margin-bottom: 8px;
  }
  .warn :global(.mdi) {
    font-size: 16px;
  }
  :global(.advanced-btn) {
    border: 0;
    background: transparent;
    padding: 0;
    font-size: 12px;
    font-weight: 500;
    color: var(--accent-ink);
  }
  :global(.advanced-btn .mdi) {
    font-size: 16px;
    vertical-align: -0.25em;
  }
</style>
