<script lang="ts">
  import * as fabric from "fabric";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import Segmented from "$/components/basic/Segmented.svelte";
  import { CanvasUtils } from "$/utils/canvas_utils";
  import { tr } from "$/utils/i18n";
  import type { CustomCanvas } from "$/fabric-object/custom_canvas";

  interface Props {
    selectedObject: fabric.FabricObject;
    editRevision: number;
    dpmm: number;
    valueUpdated: () => void;
  }

  let { selectedObject, editRevision, dpmm, valueUpdated }: Props = $props();

  const round = (v: number) => Math.round(v * 100) / 100;

  // editRevision forces re-read of object state
  const geom = $derived.by(() => {
    void editRevision;
    const pos = selectedObject.getPointByOrigin("left", "top");
    return {
      x: round(pos.x / dpmm),
      y: round(pos.y / dpmm),
      w: round(selectedObject.getScaledWidth() / dpmm),
      h: round(selectedObject.getScaledHeight() / dpmm),
      angle: Math.round(selectedObject.angle ?? 0),
    };
  });

  const isLine = $derived(selectedObject instanceof fabric.Polyline || selectedObject instanceof fabric.Line);
  const isTextbox = $derived(selectedObject instanceof fabric.Textbox);

  const setPos = (x: number, y: number) => {
    if (isNaN(x) || isNaN(y)) return;
    selectedObject.setPositionByOrigin(new fabric.Point(x * dpmm, y * dpmm), "left", "top");
    valueUpdated();
  };

  const setSize = (wMm: number, hMm: number) => {
    if (isNaN(wMm) || isNaN(hMm)) return;
    const pos = selectedObject.getPointByOrigin("left", "top");
    const w = Math.max(wMm * dpmm, 1);
    const h = Math.max(hMm * dpmm, 1);

    if (selectedObject instanceof fabric.Textbox) {
      selectedObject.set({ width: w / (selectedObject.scaleX || 1) });
    } else if (isLine) {
      selectedObject.set({ scaleX: w / (selectedObject.width || 1) });
    } else {
      selectedObject.set({
        scaleX: w / (selectedObject.width || 1),
        scaleY: h / (selectedObject.height || 1),
      });
      CanvasUtils.fixFabricObjectScale(selectedObject);
    }
    selectedObject.setPositionByOrigin(pos, "left", "top");
    valueUpdated();
  };

  const setAngle = (angle: number) => {
    selectedObject.rotate(angle);
    valueUpdated();
  };

  const align = (where: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => {
    const canvas = selectedObject.canvas as CustomCanvas | undefined;
    if (!canvas) return;

    const bounds = canvas.getLabelBounds();
    const rect = selectedObject.getBoundingRect();

    if (where === "hcenter") {
      canvas.centerObjectH(selectedObject);
    } else if (where === "vcenter") {
      canvas.centerObjectV(selectedObject);
    } else {
      const dx =
        where === "left" ? bounds.startX - rect.left : where === "right" ? bounds.endX - (rect.left + rect.width) : 0;
      const dy =
        where === "top" ? bounds.startY - rect.top : where === "bottom" ? bounds.endY - (rect.top + rect.height) : 0;
      selectedObject.set({ left: selectedObject.left + dx, top: selectedObject.top + dy });
    }
    valueUpdated();
  };
</script>

<div class="insp-section">
  <div class="insp-title">{$tr("params.generic.position")}</div>
  <div class="grid-2">
    <label class="num-field">
      <span>X</span>
      <input
        class="mono"
        type="number"
        step="0.25"
        value={geom.x}
        onchange={(e) => setPos(e.currentTarget.valueAsNumber, geom.y)} />
    </label>
    <label class="num-field">
      <span>Y</span>
      <input
        class="mono"
        type="number"
        step="0.25"
        value={geom.y}
        onchange={(e) => setPos(geom.x, e.currentTarget.valueAsNumber)} />
    </label>
    <label class="num-field">
      <span>W</span>
      <input
        class="mono"
        type="number"
        min="0.2"
        step="0.25"
        value={geom.w}
        onchange={(e) => setSize(e.currentTarget.valueAsNumber, geom.h)} />
    </label>
    <label class="num-field" class:disabled={isLine || isTextbox}>
      <span>H</span>
      <input
        class="mono"
        type="number"
        min="0.2"
        step="0.25"
        value={geom.h}
        disabled={isLine || isTextbox}
        onchange={(e) => setSize(geom.w, e.currentTarget.valueAsNumber)} />
    </label>
  </div>

  <div class="field-row">
    <span>{$tr("studio.rotation")}</span>
    <Segmented
      size="sm"
      value={[0, 90, 180, 270].includes(geom.angle) ? geom.angle : -1}
      options={[
        { value: 0, label: "0°" },
        { value: 90, label: "90°" },
        { value: 180, label: "180°" },
        { value: 270, label: "270°" },
      ]}
      onChange={setAngle} />
  </div>

  <div class="align-row">
    <button title={$tr("studio.align.left")} onclick={() => align("left")}><MdIcon icon="align_horizontal_left" /></button>
    <button title={$tr("params.generic.center.horizontal")} onclick={() => align("hcenter")}
      ><MdIcon icon="align_horizontal_center" /></button>
    <button title={$tr("studio.align.right")} onclick={() => align("right")}
      ><MdIcon icon="align_horizontal_right" /></button>
    <button title={$tr("studio.align.top")} onclick={() => align("top")}><MdIcon icon="align_vertical_top" /></button>
    <button title={$tr("params.generic.center.vertical")} onclick={() => align("vcenter")}
      ><MdIcon icon="align_vertical_center" /></button>
    <button title={$tr("studio.align.bottom")} onclick={() => align("bottom")}
      ><MdIcon icon="align_vertical_bottom" /></button>
  </div>
</div>

<style>
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 10px;
  }
  .num-field.disabled {
    opacity: 0.5;
  }
  .align-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
  }
  .align-row button {
    height: 30px;
    border: 1px solid var(--border);
    border-radius: var(--radius-xs);
    background: var(--panel);
    color: var(--ink);
    display: grid;
    place-items: center;
    padding: 0;
  }
  .align-row button:hover {
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .align-row :global(.mdi) {
    font-size: 18px;
    vertical-align: 0;
  }
</style>
