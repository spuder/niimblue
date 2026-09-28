<script lang="ts">
  import * as fabric from "fabric";
  import IconButton from "$/components/basic/IconButton.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import ArUcoParamsPanel from "$/components/designer-controls/ArUcoParamsControls.svelte";
  import BarcodeParamsPanel from "$/components/designer-controls/BarcodeParamsControls.svelte";
  import QrCodeParamsPanel from "$/components/designer-controls/QRCodeParamsControls.svelte";
  import TextParamsControls from "$/components/designer-controls/TextParamsControls.svelte";
  import VectorParamsControls from "$/components/designer-controls/VectorParamsControls.svelte";
  import LabelSettings from "$/components/shell/LabelSettings.svelte";
  import PositionControls from "$/components/shell/PositionControls.svelte";
  import { ArUcoMarker } from "$/fabric-object/aruco";
  import { Barcode } from "$/fabric-object/barcode";
  import { QRCode } from "$/fabric-object/qrcode";
  import { activeRow, appConfig, csvEnabled, csvTable } from "$/stores";
  import type { LabelProps } from "$/types";
  import { preprocessString } from "$/utils/canvas_preprocess";
  import { tr } from "$/utils/i18n";
  import { describeObject, getObjectText, hasTokens, setObjectText } from "$/utils/object_info";

  interface Props {
    canvas: fabric.Canvas | undefined;
    labelProps: LabelProps;
    selectedObject: fabric.FabricObject | undefined;
    selectedCount: number;
    editRevision: number;
    layersRevision: number;
    valueUpdated: () => void;
    onLabelPropsChange: (p: LabelProps) => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onSelect: (obj: fabric.FabricObject) => void;
  }

  let {
    canvas,
    labelProps,
    selectedObject,
    selectedCount,
    editRevision,
    layersRevision,
    valueUpdated,
    onLabelPropsChange,
    onDelete,
    onDuplicate,
    onSelect,
  }: Props = $props();

  const dpmm = $derived(labelProps.dpmm ?? 8);

  const info = $derived.by(() => {
    void editRevision;
    return selectedObject ? describeObject(selectedObject) : undefined;
  });

  const text = $derived.by(() => {
    void editRevision;
    return selectedObject ? getObjectText(selectedObject) : undefined;
  });

  const barcodeTemplatable = $derived(!(selectedObject instanceof Barcode) || selectedObject.encoding === "CODE128B");

  const layers = $derived.by(() => {
    void layersRevision;
    void editRevision;
    return canvas ? [...canvas.getObjects()].reverse() : [];
  });

  const currentRow = $derived($csvEnabled ? $csvTable.rows[$activeRow] : undefined);

  const previewText = $derived(text !== undefined && hasTokens(text) ? preprocessString(text, currentRow) : undefined);

  const tokens = $derived([
    ...($csvEnabled ? $csvTable.columns.map((c) => ({ label: c, token: `{${c}}` })) : []),
    { label: "date", token: "{dt|YYYY-MM-DD}" },
    { label: "time", token: "{dt|HH:mm}" },
  ]);

  const onTextInput = (value: string) => {
    if (selectedObject && setObjectText(selectedObject, value)) {
      valueUpdated();
    }
  };

  const appendToken = (token: string) => {
    if (selectedObject && text !== undefined) {
      setObjectText(selectedObject, text + token);
      valueUpdated();
    }
  };

  const bringForward = () => {
    if (selectedObject) {
      canvas?.bringObjectForward(selectedObject);
      valueUpdated();
    }
  };

  const sendBackward = () => {
    if (selectedObject) {
      canvas?.sendObjectBackwards(selectedObject);
      valueUpdated();
    }
  };

  const fitImage = () => {
    const obj = selectedObject;
    if (!obj?.canvas) return;
    const imageRatio = obj.width / obj.height;
    const canvasRatio = obj.canvas.width / obj.canvas.height;

    if ($appConfig.fitMode === "ratio_min" || $appConfig.fitMode === "ratio_max") {
      const byWidth = $appConfig.fitMode === "ratio_min" ? imageRatio > canvasRatio : imageRatio <= canvasRatio;
      if (byWidth) obj.scaleToWidth(obj.canvas.width);
      else obj.scaleToHeight(obj.canvas.height);
      obj.canvas.centerObject(obj);
    } else {
      obj.set({ left: 0, top: 0, scaleX: obj.canvas.width / obj.width, scaleY: obj.canvas.height / obj.height });
    }
    valueUpdated();
  };
</script>

<aside class="inspector">
  {#if selectedObject && info}
    <div class="insp-head">
      <div class="type-icon"><MdIcon icon={info.icon} /></div>
      <div class="name">{$tr(info.name)}</div>
      <IconButton icon="flip_to_front" size={30} onclick={bringForward} title={$tr("studio.forward")} />
      <IconButton icon="flip_to_back" size={30} onclick={sendBackward} title={$tr("studio.backward")} />
      <IconButton icon="content_copy" size={30} onclick={onDuplicate} title={$tr("editor.clone")} />
      <IconButton icon="delete" size={30} danger onclick={onDelete} title={$tr("editor.delete")} />
    </div>

    {#if text !== undefined}
      <div class="insp-section">
        <div class="insp-title">{$tr("studio.content")}</div>
        <textarea
          class="content-input mono"
          rows="3"
          value={text}
          oninput={(e) => onTextInput(e.currentTarget.value)}></textarea>

        {#if barcodeTemplatable}
          <div class="tokens">
            {#each tokens as t (t.token)}
              <button class="token mono" title={t.token} onclick={() => appendToken(t.token)}>{`{${t.label}}`}</button>
            {/each}
          </div>
        {/if}

        {#if previewText !== undefined}
          <div class="preview-line">
            {#if currentRow}
              <span>{$tr("studio.row")} {$activeRow + 1}:</span>
            {/if}
            <span class="mono">{previewText}</span>
          </div>
        {/if}
      </div>
    {/if}

    <div class="insp-section">
      <div class="insp-title">{$tr("studio.style")}</div>
      <div class="legacy-controls">
        {#if selectedObject instanceof fabric.IText}
          <TextParamsControls selectedText={selectedObject} {editRevision} {valueUpdated} />
        {/if}
        {#if selectedObject instanceof QRCode}
          <QrCodeParamsPanel selectedQRCode={selectedObject} {editRevision} {valueUpdated} />
        {/if}
        {#if selectedObject instanceof ArUcoMarker}
          <ArUcoParamsPanel selectedArUco={selectedObject} {editRevision} {valueUpdated} />
        {/if}
        {#if selectedObject instanceof Barcode}
          <BarcodeParamsPanel selectedBarcode={selectedObject} {editRevision} {valueUpdated} />
        {/if}
        <VectorParamsControls {selectedObject} {editRevision} {valueUpdated} />
        {#if selectedObject instanceof fabric.FabricImage}
          <button class="btn btn-sm btn-secondary" onclick={fitImage} title={$tr("params.generic.fit")}>
            <MdIcon icon="fit_screen" />
            {$tr("params.generic.fit")}
          </button>
          <select
            class="form-select form-select-sm w-auto"
            value={$appConfig.fitMode ?? "stretch"}
            onchange={(e) =>
              appConfig.update((v) => ({
                ...v,
                fitMode: e.currentTarget.value as "stretch" | "ratio_min" | "ratio_max",
              }))}>
            <option value="stretch">{$tr("params.generic.fit.mode.stretch")}</option>
            <option value="ratio_min">{$tr("params.generic.fit.mode.ratio_min")}</option>
            <option value="ratio_max">{$tr("params.generic.fit.mode.ratio_max")}</option>
          </select>
        {/if}
      </div>
      {#if selectedObject instanceof fabric.FabricImage}
        <div class="hint">{$tr("studio.image.note")}</div>
      {/if}
    </div>

    <PositionControls {selectedObject} {editRevision} {dpmm} {valueUpdated} />
  {:else if selectedCount > 1}
    <div class="insp-head">
      <div class="type-icon"><MdIcon icon="select_all" /></div>
      <div class="name">{selectedCount} {$tr("studio.selected")}</div>
      <IconButton icon="content_copy" size={30} onclick={onDuplicate} title={$tr("editor.clone")} />
      <IconButton icon="delete" size={30} danger onclick={onDelete} title={$tr("editor.delete")} />
    </div>
  {:else}
    <div class="insp-head">
      <div class="type-icon"><MdIcon icon="label" /></div>
      <div class="name">{$tr("studio.label")}</div>
    </div>

    <LabelSettings {labelProps} onChange={onLabelPropsChange} />

    <div class="insp-section">
      <div class="insp-title">{$tr("studio.layers")}</div>
      {#if layers.length === 0}
        <div class="hint">{$tr("studio.layers.empty")}</div>
      {/if}
      <div class="layers">
        {#each layers as obj, i (i)}
          {@const li = describeObject(obj)}
          <button class="layer" onclick={() => onSelect(obj)}>
            <MdIcon icon={li.icon} />
            {#if li.text !== undefined}
              <span class="layer-text" class:token-text={hasTokens(li.text)}>{li.text || $tr(li.name)}</span>
            {:else}
              <span class="layer-text">{$tr(li.name)}</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <div class="insp-section">
      <div class="hint">{$tr("studio.shortcuts")}</div>
    </div>
  {/if}
</aside>

<style>
  .inspector {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 16px;
  }
  .insp-head {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 10px 10px 14px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--panel);
    z-index: 2;
  }
  .type-icon {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-xs);
    background: var(--accent-soft);
    color: var(--accent-ink);
    display: grid;
    place-items: center;
    flex: none;
  }
  .type-icon :global(.mdi) {
    font-size: 18px;
    vertical-align: 0;
  }
  .name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    margin-left: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .content-input {
    width: 100%;
    resize: vertical;
    min-height: 64px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--input-bg);
    color: var(--ink);
    font-size: 12.5px;
    outline: none;
  }
  .content-input:focus {
    border-color: var(--accent);
  }
  .tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }
  .token {
    height: 24px;
    padding: 0 7px;
    border: 1px solid transparent;
    border-radius: var(--radius-xs);
    background: var(--field-bg);
    color: var(--field);
    font-size: 11.5px;
  }
  .token:hover {
    border-color: var(--field-border);
  }
  .preview-line {
    margin-top: 8px;
    font-size: 12px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .preview-line .mono {
    color: var(--ink);
  }
  .legacy-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    min-width: 0;
  }
  .legacy-controls :global(.input-group) {
    max-width: 100%;
  }
  .legacy-controls :global(.dropdown-menu) {
    max-width: calc(100vw - 16px);
  }
  .hint {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.45;
    margin-top: 6px;
  }
  .layers {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .layer {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--radius-xs);
    background: transparent;
    color: var(--ink);
    font-size: 12.5px;
    text-align: left;
  }
  .layer:hover {
    background: var(--hover);
  }
  .layer :global(.mdi) {
    font-size: 18px;
    vertical-align: 0;
    color: var(--muted);
  }
  .layer-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .token-text {
    font-family: var(--font-mono);
    color: var(--field);
  }
</style>
