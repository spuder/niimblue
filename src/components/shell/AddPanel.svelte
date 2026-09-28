<script lang="ts" module>
  /** Tiles that can be added from the Add panel */
  export type AddTileType = "text" | "qrcode" | "barcode" | "date" | "rectangle" | "line" | "image" | "circle" | "aruco";

  /** DataTransfer mime type used for dragging tiles onto the canvas */
  export const ADD_TILE_MIME = "application/x-niimblue-add";
</script>

<script lang="ts">
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import IconPicker from "$/components/designer-controls/IconPicker.svelte";
  import PdfImportButton from "$/components/designer-controls/PdfImportButton.svelte";
  import ZplImportButton from "$/components/designer-controls/ZplImportButton.svelte";
  import type { MaterialIcon } from "$/styles/mdi_icons";
  import type { LabelProps } from "$/types";
  import { tr, type TranslationKey } from "$/utils/i18n";

  interface Props {
    labelProps: LabelProps;
    onAdd: (type: AddTileType) => void;
    onIconPicked: (i: MaterialIcon) => void;
    onSvgIconPicked: (i: string) => void;
    zplImageReady: (img: Blob) => void;
    pdfImageReady: (img: HTMLCanvasElement) => void;
  }

  let { labelProps, onAdd, onIconPicked, onSvgIconPicked, zplImageReady, pdfImageReady }: Props = $props();

  const tiles: { type: AddTileType; icon: MaterialIcon; label: TranslationKey }[] = [
    { type: "text", icon: "title", label: "editor.objectpicker.text" },
    { type: "qrcode", icon: "qr_code_2", label: "studio.add.qr" },
    { type: "barcode", icon: "view_week", label: "editor.objectpicker.barcode" },
    { type: "date", icon: "calendar_today", label: "params.variables.insert.date" },
    { type: "rectangle", icon: "crop_square", label: "studio.add.box" },
    { type: "line", icon: "remove", label: "editor.objectpicker.line" },
    { type: "image", icon: "image", label: "editor.objectpicker.image" },
  ];

  const moreTiles: { type: AddTileType; icon: MaterialIcon; label: TranslationKey }[] = [
    { type: "circle", icon: "radio_button_unchecked", label: "editor.objectpicker.circle" },
    { type: "aruco", icon: "grid_on", label: "editor.objectpicker.aruco" },
  ];

  let moreOpen = $state<boolean>(false);

  const onDragStart = (e: DragEvent, type: AddTileType) => {
    e.dataTransfer?.setData(ADD_TILE_MIME, type);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  };
</script>

<section class="add-panel">
  <div class="section-title">{$tr("studio.add")}</div>
  <div class="tiles">
    {#each tiles as t (t.type)}
      <button
        class="tile"
        draggable="true"
        ondragstart={(e) => onDragStart(e, t.type)}
        onclick={() => onAdd(t.type)}
        title={$tr(t.label)}>
        <MdIcon icon={t.icon} />
        <span>{$tr(t.label)}</span>
      </button>
    {/each}

    <IconPicker onSubmit={onIconPicked} onSubmitSvg={onSvgIconPicked} triggerClass="tile w-100">
      {#snippet trigger()}
        <MdIcon icon="emoji_emotions" />
        <span>{$tr("studio.add.icon")}</span>
      {/snippet}
    </IconPicker>
  </div>

  <button class="more-toggle" onclick={() => (moreOpen = !moreOpen)}>
    <MdIcon icon={moreOpen ? "expand_less" : "expand_more"} />
    {$tr("studio.add.more")}
  </button>

  {#if moreOpen}
    <div class="tiles">
      {#each moreTiles as t (t.type)}
        <button
          class="tile"
          draggable="true"
          ondragstart={(e) => onDragStart(e, t.type)}
          onclick={() => onAdd(t.type)}
          title={$tr(t.label)}>
          <MdIcon icon={t.icon} />
          <span>{$tr(t.label)}</span>
        </button>
      {/each}
    </div>
    <div class="imports">
      <ZplImportButton {labelProps} onImageReady={zplImageReady} />
      <PdfImportButton {labelProps} onImageReady={pdfImageReady} />
    </div>
  {/if}
</section>

<style>
  .add-panel {
    padding: 14px 14px 10px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .tiles :global(.dropdown) {
    display: contents;
  }
  .tiles :global(.tile) {
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--panel);
    color: var(--ink);
    cursor: grab;
    font-size: 11px;
    font-weight: 500;
    min-width: 0;
  }
  .tiles :global(.tile span) {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tiles :global(.tile .mdi) {
    font-size: 22px;
    vertical-align: 0;
  }
  .tiles :global(.tile:hover) {
    border-color: var(--accent);
    color: var(--accent-ink);
    background: var(--accent-soft);
  }
  .more-toggle {
    margin-top: 8px;
    border: 0;
    background: transparent;
    padding: 0;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }
  .more-toggle :global(.mdi) {
    font-size: 18px;
    vertical-align: -0.3em;
  }
  .more-toggle + .tiles {
    margin-top: 8px;
  }
  .imports {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }
  .imports :global(.btn) {
    border: 1px solid var(--border);
    font-size: 12px;
  }
</style>
