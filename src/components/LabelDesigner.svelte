<script lang="ts">
  import Dropdown from "bootstrap/js/dist/dropdown";
  import * as fabric from "fabric";
  import { onDestroy, onMount, tick } from "svelte";
  import { iconCodepoints, type MaterialIcon } from "$/styles/mdi_icons";
  import {
    activeRow,
    appConfig,
    automation,
    connectionState,
    csvData,
    csvEnabled,
    csvFileName,
    csvInclude,
    csvTable,
    loadedFonts,
  } from "$/stores";
  import { type ExportedLabelTemplate, type FabricJson, type LabelProps, type MoveDirection } from "$/types";
  import { FileUtils } from "$/utils/file_utils";
  import { tr } from "$/utils/i18n";
  import { LabelDesignerObjectHelper } from "$/utils/label_designer_object_helper";
  import { LocalStoragePersistence } from "$/utils/persistence";
  import { Toasts } from "$/utils/toasts";
  import { UndoRedo, type UndoState } from "$/utils/undo_redo";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import BrowserWarning from "$/components/basic/BrowserWarning.svelte";
  import Segmented from "$/components/basic/Segmented.svelte";
  import PrintPreview from "$/components/PrintPreview.svelte";
  import { DEFAULT_LABEL_PROPS, GRID_SIZE, OBJECT_DEFAULTS, OBJECT_DEFAULTS_TEXT } from "$/defaults";
  import { LabelDesignerUtils } from "$/utils/label_designer_utils";
  import SavedLabelsMenu from "$/components/designer-controls/SavedLabelsMenu.svelte";
  import { CustomCanvas } from "$/fabric-object/custom_canvas";
  import { CanvasUtils } from "$/utils/canvas_utils";
  import AppHeader from "$/components/shell/AppHeader.svelte";
  import AddPanel, { ADD_TILE_MIME, type AddTileType } from "$/components/shell/AddPanel.svelte";
  import DataPanel, { FIELD_MIME } from "$/components/shell/DataPanel.svelte";
  import DataGridDialog from "$/components/shell/DataGridDialog.svelte";
  import Inspector from "$/components/shell/Inspector.svelte";
  import LabelStrip from "$/components/shell/LabelStrip.svelte";
  import PrinterDialog from "$/components/shell/PrinterDialog.svelte";
  import { describeObject, getObjectText, setObjectText, supportsTokens } from "$/utils/object_info";
  import { importDataFile } from "$/utils/data_actions";
  import { isDataFile, renameTokens, toCsv } from "$/utils/data_table";
  import { renderLabel } from "$/utils/label_render";

  const MOBILE_BREAKPOINT = 860;
  const ROUND_RADIUS_PX = 10;

  let htmlCanvas: HTMLCanvasElement;
  let stageEl: HTMLDivElement;
  let stageResizeObserver: ResizeObserver | undefined;

  let fabricCanvas = $state<CustomCanvas>();
  let labelProps = $state<LabelProps>(DEFAULT_LABEL_PROPS);
  let previewOpened = $state<boolean>(false);
  let selectedObject = $state<fabric.FabricObject | undefined>(undefined);
  let selectedCount = $state<number>(0);
  let editRevision = $state<number>(0);
  let layersRevision = $state<number>(0);
  let printNow = $state<boolean>(false);
  let windowWidth = $state<number>(window.innerWidth);
  let undoState = $state<UndoState>({ undoDisabled: false, redoDisabled: false });
  let zoomRatio = $state<number>(1);
  let cssScale = $state<number>(1);
  let docTitle = $state<string>("");
  let printerDialogOpen = $state<boolean>(false);
  let dataGridOpen = $state<boolean>(false);
  let pendingPrint = $state<boolean>(false);
  let previewMode = $state<"fields" | "preview">("fields");
  let previewImage = $state<string>("");
  let mobileTab = $state<"add" | "data" | "style" | undefined>(undefined);

  const compact = $derived(windowWidth < MOBILE_BREAKPOINT);
  const dpmm = $derived(labelProps.dpmm ?? 8);
  const includedCount = $derived($csvInclude.filter((v) => v).length);
  const printCount = $derived($csvEnabled ? includedCount : 1);
  const rowCount = $derived($csvEnabled ? $csvTable.rows.length : 0);

  const undo = new UndoRedo();

  const discardSelection = () => {
    fabricCanvas!.discardActiveObject();
    fabricCanvas!.requestRenderAll();
    selectedObject = undefined;
    selectedCount = 0;
    editRevision = 0;
  };

  const loadLabelData = async (data: ExportedLabelTemplate) => {
    undo.paused = true;
    onUpdateLabelProps(data.label);
    if (data.csv) {
      $csvData = data.csv;
      $csvFileName = data.title ?? "";
      $csvEnabled = true;
    }
    await FileUtils.loadCanvasState(fabricCanvas!, data.canvas);
    undo.paused = false;
    layersRevision++;
  };

  undo.onLabelUpdate = loadLabelData;
  undo.onStateUpdate = (state: UndoState) => {
    undoState = state;
  };

  let valueUpdateTimer: ReturnType<typeof setTimeout> | undefined;
  /** An inspector edit is waiting for its debounced undo push */
  let undoPending = $state<boolean>(false);

  const pushUndo = () => {
    clearTimeout(valueUpdateTimer);
    valueUpdateTimer = undefined;
    undoPending = false;
    undo.push(fabricCanvas!, labelProps);
    layersRevision++;
  };

  /** Commit a debounced inspector edit right away, so it is not lost or merged with other steps */
  const flushPendingUndo = () => {
    if (valueUpdateTimer !== undefined) {
      pushUndo();
    }
  };

  const doUndo = () => {
    flushPendingUndo();
    undo.undo();
  };

  const doRedo = () => {
    flushPendingUndo();
    undo.redo();
  };

  const deleteSelected = () => {
    LabelDesignerUtils.deleteSelection(fabricCanvas!);
    discardSelection();
  };

  const cloneSelected = () => {
    LabelDesignerUtils.cloneSelection(fabricCanvas!).then(pushUndo);
  };

  const moveSelected = (direction: MoveDirection, ctrl?: boolean) => {
    LabelDesignerUtils.moveSelection(fabricCanvas!, direction, ctrl);
    pushUndo();
    editRevision++;
  };

  /** Keyboard belongs to a focused form control (select, button, segmented radio) */
  const isControlFocused = (): boolean => {
    const el = document.activeElement;
    return el instanceof HTMLSelectElement || el instanceof HTMLButtonElement || el?.getAttribute("role") === "radio";
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const key: string = e.key.toLowerCase();
    // windows and linux users are used to ctrl, mac users use cmd
    const cmdOrCtrl = e.metaKey || e.ctrlKey;

    // Esc
    if (key === "escape") {
      if (document.querySelector(".modal.show")) {
        return;
      }
      discardSelection();
      return;
    }

    if (LabelDesignerUtils.isAnyInputFocused(fabricCanvas!)) {
      return;
    }

    // Arrows, Enter and Delete belong to a focused inspector control
    const controlKey = key.startsWith("arrow") || key === "enter" || key === "delete" || key === "backspace";
    if (controlKey && isControlFocused()) {
      return;
    }

    // Arrows
    if (key.startsWith("arrow")) {
      if (selectedCount > 0) {
        e.preventDefault();
        moveSelected(key.slice("arrow".length) as MoveDirection, cmdOrCtrl);
      }
      return;
    }

    if (e.repeat) {
      return;
    }

    // Enter starts inline text editing
    if (key === "enter" && selectedObject instanceof fabric.IText) {
      e.preventDefault();
      selectedObject.enterEditing();
      selectedObject.selectAll();
      return;
    }

    // Ctrl + D
    if (cmdOrCtrl && key === "d") {
      e.preventDefault();
      cloneSelected();
      return;
    }

    // Ctrl + Y, Ctrl + Shift + Z
    if ((cmdOrCtrl && key === "y") || (cmdOrCtrl && e.shiftKey && key === "z")) {
      e.preventDefault();
      doRedo();
      return;
    }

    // Ctrl + Z
    if (cmdOrCtrl && key === "z") {
      e.preventDefault();
      doUndo();
      return;
    }

    // Del
    if (key === "delete" || key === "backspace") {
      deleteSelected();
      return;
    }
  };

  const onUpdateLabelProps = (newProps: LabelProps) => {
    labelProps = newProps;
    fabricCanvas!.setDimensions(labelProps.size);
    updateFitScale();
    try {
      LocalStoragePersistence.saveLastLabelProps(labelProps);
      undo.push(fabricCanvas!, labelProps);
    } catch (e) {
      Toasts.zodErrors(e, "Label parameters save error:");
    }
  };

  const exportCurrentLabel = (): ExportedLabelTemplate => {
    return FileUtils.makeExportedLabel(fabricCanvas!, labelProps, $csvEnabled);
  };

  const onLoadRequested = (label: ExportedLabelTemplate) => {
    if (label.title) {
      docTitle = label.title;
    }
    loadLabelData(label).then(pushUndo);
  };

  const zplImageReady = async (img: Blob) => {
    await LabelDesignerObjectHelper.addImageBlob(fabricCanvas!, img);
    pushUndo();
  };

  const pdfImageReady = async (el: HTMLCanvasElement) => {
    const img = new fabric.FabricImage(el, {
      ...OBJECT_DEFAULTS,
      left: 0,
      top: 0,
    });

    fabricCanvas!.add(img);
    fabricCanvas!.setActiveObject(img);
    pushUndo();
  };

  /** Put object center at given point, or at label center */
  const placeObject = (obj: fabric.FabricObject, at?: fabric.Point) => {
    if (at) {
      obj.setPositionByOrigin(at, "center", "center");
    } else {
      fabricCanvas!.centerObjectH(obj);
      fabricCanvas!.centerObjectV(obj);
    }
    obj.setCoords();
  };

  const addTile = async (type: AddTileType, at?: fabric.Point) => {
    const canvas = fabricCanvas!;
    let obj: fabric.FabricObject | undefined;

    if (type === "image") {
      obj = await LabelDesignerObjectHelper.addImageWithFilePicker(canvas);
    } else if (type === "date") {
      obj = LabelDesignerObjectHelper.addText(canvas, "{dt|YYYY-MM-DD}");
    } else {
      obj = LabelDesignerObjectHelper.addObject(canvas, type);
    }

    if (obj !== undefined) {
      placeObject(obj, at);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      pushUndo();
    }

    mobileTab = undefined;
  };

  const onIconPicked = (i: MaterialIcon) => {
    // todo: icon is not vertically centered
    LabelDesignerObjectHelper.addStaticText(fabricCanvas!, String.fromCodePoint(iconCodepoints[i]), {
      fontFamily: "Material Icons",
      fontSize: 100,
    });
    pushUndo();
    mobileTab = undefined;
  };

  const onSvgIconPicked = (i: string) => {
    LabelDesignerObjectHelper.addSvg(fabricCanvas!, i);
    pushUndo();
    mobileTab = undefined;
  };

  const openPreview = () => {
    printNow = false;
    previewOpened = true;
  };

  const openPreviewAndPrint = () => {
    printNow = true;
    previewOpened = true;
  };

  const onPrintClicked = () => {
    if ($csvEnabled && includedCount === 0) {
      Toasts.error(new Error($tr("studio.print.no_rows")));
      return;
    }
    if ($connectionState === "connected") {
      openPreview();
    } else {
      pendingPrint = true;
      printerDialogOpen = true;
    }
  };

  const continueWithoutPrinter = () => {
    pendingPrint = false;
    printerDialogOpen = false;
    openPreview();
  };

  const controlValueUpdated = () => {
    if (selectedObject) {
      selectedObject.setCoords();
      selectedObject.dirty = true;
      // coalesce rapid inspector edits into one undo step
      clearTimeout(valueUpdateTimer);
      valueUpdateTimer = setTimeout(pushUndo, 800);
      undoPending = true;
    }
    fabricCanvas!.requestRenderAll();

    // trigger reactivity for controls
    editRevision++;
  };

  const getCanvasForPreview = (): FabricJson => {
    return fabricCanvas!.toJSON();
  };

  /** CSV of rows selected for printing */
  const printCsvData = $derived.by(() => {
    const cols = $csvTable.columns;
    const rows = $csvTable.rows.filter((_, i) => $csvInclude[i] ?? true).map((r) => cols.map((c) => r[c] ?? ""));
    return toCsv({ columns: cols, rows });
  });

  const insertField = (name: string, target?: fabric.FabricObject, at?: fabric.Point) => {
    const token = `{${name}}`;
    const candidate = target ?? selectedObject;
    const obj = candidate && supportsTokens(candidate) ? candidate : undefined;
    const text = obj ? getObjectText(obj) : undefined;

    if (obj && text !== undefined) {
      setObjectText(obj, text + token);
      obj.setCoords();
      fabricCanvas!.setActiveObject(obj);
      fabricCanvas!.requestRenderAll();
      Toasts.message(`${$tr("studio.linked")} ${name} → ${$tr(describeObject(obj).name)}`);
    } else {
      const newObj = LabelDesignerObjectHelper.addText(fabricCanvas!, token, {
        textAlign: "left",
        originX: "left",
        originY: "top",
      });
      placeObject(newObj, at);
      fabricCanvas!.setActiveObject(newObj);
    }
    editRevision++;
    pushUndo();
  };

  const renameColumns = (renames: [string, string][]) => {
    fabricCanvas!.forEachObject((obj) => {
      const text = getObjectText(obj);
      if (text === undefined) return;
      const newText = renameTokens(text, renames);
      if (newText !== text) setObjectText(obj, newText);
    });
    fabricCanvas!.requestRenderAll();
    editRevision++;
    pushUndo();
  };

  const onPaste = async (event: ClipboardEvent) => {
    if (LabelDesignerUtils.isAnyInputFocused(fabricCanvas!)) {
      return;
    }

    const openedDropdowns = document.querySelectorAll(".dropdown-menu.show");
    if (openedDropdowns.length > 0) {
      return;
    }

    if (event.clipboardData != null) {
      event.preventDefault();
      const obj = await LabelDesignerObjectHelper.addObjectFromClipboard(fabricCanvas!, event.clipboardData);

      if (obj !== undefined) {
        fabricCanvas!.setActiveObject(obj);
        pushUndo();
      }
    }
  };

  const clearCanvas = () => {
    if (!confirm($tr("editor.clear.confirm"))) {
      return;
    }
    undo.push(fabricCanvas!, labelProps);
    fabricCanvas!.clear();
    layersRevision++;
  };

  const toggleGrid = () => {
    const newVal = !$appConfig.gridEnabled;
    appConfig.update((cfg) => ({ ...cfg, gridEnabled: newVal }));
    fabricCanvas?.setGridEnabled(newVal);
  };

  const updateFitScale = () => {
    if (!stageEl || !fabricCanvas) return;
    const padX = compact ? 32 : 96;
    const padY = compact ? 72 : 128;
    const fit = Math.min(
      (stageEl.clientWidth - padX) / labelProps.size.width,
      (stageEl.clientHeight - padY) / labelProps.size.height,
    );
    fabricCanvas.setFitScale(Math.min(Math.max(fit, 0.2), 8));
  };

  const setZoom = (z: number) => {
    fabricCanvas?.virtualZoom(z);
  };

  const loadLabelFromUrl = async () => {
    try {
      const urlTemplate = await FileUtils.readLabelFromUrl();

      if (urlTemplate !== null && confirm($tr("params.saved_labels.load.url.warn"))) {
        onLoadRequested(urlTemplate);
        Toasts.message($tr("params.saved_labels.load.url.loaded"));
        return true;
      }
    } catch (e) {
      Toasts.error(e);
    }
    return false;
  };

  const loadDefaultLabel = async () => {
    const urlLoaded = await loadLabelFromUrl();

    if (urlLoaded) {
      return;
    }

    try {
      const defaultTemplate = LocalStoragePersistence.loadDefaultTemplate();

      if (defaultTemplate !== null) {
        onLoadRequested(defaultTemplate);
        return;
      }
    } catch (e) {
      Toasts.error(e);
    }

    LabelDesignerObjectHelper.addText(fabricCanvas!, $tr("editor.default_text"));
  };

  const renderOnFontsChanged = () => {
    fabricCanvas?.forEachObject((o) => {
      if (o instanceof fabric.Textbox) {
        o.dirty = true;
      }
    });
    fabricCanvas?.requestRenderAll();
  };

  const onCanvasDrop = async (dragEvt: DragEvent) => {
    dragEvt.preventDefault();
    const dt = dragEvt.dataTransfer;
    if (!dt) return;

    const point = fabricCanvas!.getScenePoint(dragEvt);

    const tile = dt.getData(ADD_TILE_MIME);
    if (tile) {
      await addTile(tile as AddTileType, point);
      return;
    }

    const field = dt.getData(FIELD_MIME);
    if (field) {
      const target = fabricCanvas!.findTarget(dragEvt as unknown as fabric.TPointerEvent).target;
      const t = target && supportsTokens(target) ? target : undefined;
      insertField(field, t, point);
      return;
    }

    let dropped = false;
    for (const file of dt.files) {
      if (isDataFile(file)) {
        await importDataFile(file);
        continue;
      }
      try {
        const obj = await LabelDesignerObjectHelper.addImageFile(fabricCanvas!, file);
        placeObject(obj, point);
        dropped = true;
      } catch (e) {
        Toasts.error(e);
      }
    }

    if (dropped) {
      pushUndo();
    }
  };

  let previewToken = 0;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  const refreshPreviewImage = async () => {
    const token = ++previewToken;
    if (previewMode !== "preview" || !fabricCanvas) {
      previewImage = "";
      return;
    }
    const row = $csvEnabled ? $csvTable.rows[$activeRow] : undefined;
    const el = await renderLabel(fabricCanvas.toJSON(), labelProps, row);
    // a newer request was made while rendering
    if (token === previewToken) {
      previewImage = el.toDataURL("image/png");
    }
  };

  onMount(async () => {
    try {
      const savedLabelProps = LocalStoragePersistence.loadLastLabelProps();
      if (savedLabelProps !== null) {
        labelProps = savedLabelProps;
      }
    } catch (e) {
      Toasts.zodErrors(e, "Label parameters load error:");
    }

    fabricCanvas = new CustomCanvas(htmlCanvas, {
      width: labelProps.size.width,
      height: labelProps.size.height,
    });
    fabricCanvas.setLabelProps(labelProps);
    fabricCanvas.onZoomChange = (z) => {
      zoomRatio = z;
      cssScale = fabricCanvas!.getCssScale();
    };
    fabricCanvas.setGridEnabled(!!$appConfig.gridEnabled);

    updateFitScale();
    stageResizeObserver = new ResizeObserver(() => updateFitScale());
    stageResizeObserver.observe(stageEl);

    // UI no longer uses the label font, so make sure it is loaded before canvas text is measured
    await Promise.allSettled([
      document.fonts.load(`16px "${OBJECT_DEFAULTS_TEXT.fontFamily}"`),
      document.fonts.load('16px "Material Icons"'),
    ]);

    await loadDefaultLabel();

    window.addEventListener("hashchange", loadLabelFromUrl);

    pushUndo();

    // force close dropdowns on touch devices
    fabricCanvas.on("mouse:down", (): void => {
      const dropdowns = document.querySelectorAll("[data-bs-toggle='dropdown']");
      dropdowns.forEach((el) => new Dropdown(el).hide());
    });

    fabricCanvas.on("mouse:dblclick", (e): void => {
      if (e.target instanceof fabric.IText && !e.target.isEditing) {
        e.target.enterEditing();
      }
    });

    fabricCanvas.on("object:moving", (e): void => {
      if (e.target && e.target.left !== undefined && e.target.top !== undefined) {
        e.target.set({
          left: Math.round(e.target.left / GRID_SIZE) * GRID_SIZE,
          top: Math.round(e.target.top / GRID_SIZE) * GRID_SIZE,
        });
      }
    });

    fabricCanvas.on("object:modified", (): void => {
      pushUndo();
      editRevision++;
    });

    fabricCanvas.on("text:changed", () => {
      editRevision++;
    });

    fabricCanvas.on("text:editing:exited", () => {
      pushUndo();
    });

    fabricCanvas.on("object:removed", (): void => {
      pushUndo();
    });

    fabricCanvas.on("before:selection:cleared", flushPendingUndo);

    fabricCanvas.on("selection:created", (e): void => {
      selectedCount = e.selected?.length ?? 0;
      selectedObject = e.selected?.length === 1 ? e.selected[0] : undefined;
      editRevision++;
    });

    fabricCanvas.on("selection:updated", (): void => {
      flushPendingUndo();
      const active = fabricCanvas!.getActiveObjects();
      selectedCount = active.length;
      selectedObject = active.length === 1 ? active[0] : undefined;
      editRevision++;
    });

    fabricCanvas.on("selection:cleared", (): void => {
      selectedObject = undefined;
      selectedCount = 0;
      editRevision++;
    });

    fabricCanvas.on("dragover", (e): void => {
      e.e.preventDefault();
    });

    fabricCanvas.on("drop:after", (e): void => {
      onCanvasDrop(e.e as DragEvent);
    });

    fabricCanvas.on("object:scaling", (e): void => {
      if (!e.target) {
        return;
      }

      CanvasUtils.fixFabricObjectScale(e.target);
    });

    if ($automation !== undefined) {
      if ($automation.startPrint !== undefined) {
        if ($automation.startPrint === "immediately") {
          openPreview();
        } else if ($automation.startPrint === "after_connect") {
          const unsubscribe = connectionState.subscribe((st) => {
            if (st === "connected") {
              tick().then(() => unsubscribe());
              openPreviewAndPrint();
            }
          });
        }
      }
    }
  });

  onDestroy(() => {
    stageResizeObserver?.disconnect();
    fabricCanvas!.dispose();
    window.removeEventListener("hashchange", loadLabelFromUrl);
  });

  $effect(() => {
    fabricCanvas?.setLabelProps(labelProps);
  });

  $effect(() => {
    if (!previewOpened) {
      printNow = false;
    }
  });

  $effect(() => {
    if ($loadedFonts) {
      renderOnFontsChanged();
    }
  });

  // Print was requested while disconnected: continue once connected
  $effect(() => {
    if (pendingPrint && $connectionState === "connected") {
      pendingPrint = false;
      printerDialogOpen = false;
      tick().then(openPreview);
    }
  });

  $effect(() => {
    if (!printerDialogOpen) {
      pendingPrint = false;
    }
  });

  $effect(() => {
    void compact;
    updateFitScale();
  });

  $effect(() => {
    void previewMode;
    void $activeRow;
    void $csvTable;
    void editRevision;
    void layersRevision;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreviewImage, 120);
    return () => clearTimeout(previewTimer);
  });

  $effect(() => {
    if (previewMode === "preview" && fabricCanvas) {
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
    }
  });

  const paperRadius = $derived(
    labelProps.shape === "circle"
      ? "50%"
      : labelProps.shape === "rounded_rect"
        ? `${ROUND_RADIUS_PX * cssScale}px`
        : "0",
  );

  const sizeCaption = $derived(
    `${Math.round((labelProps.size.width / dpmm) * 10) / 10} × ${Math.round((labelProps.size.height / dpmm) * 10) / 10} mm · ${dpmm > 10 ? 300 : 203} dpi`,
  );

  /** Clicking empty stage around the label deselects */
  const onStagePointerDown = (e: PointerEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest(".paper") && selectedCount > 0) {
      discardSelection();
    }
  };

  const toggleTab = (tab: "add" | "data" | "style") => {
    mobileTab = mobileTab === tab ? undefined : tab;
  };
</script>

<svelte:window bind:innerWidth={windowWidth} onkeydown={onKeyDown} onpaste={onPaste} />

<div class="studio" class:compact>
  <AppHeader
    bind:title={docTitle}
    undoDisabled={undoState.undoDisabled && !undoPending}
    redoDisabled={undoState.redoDisabled}
    {printCount}
    {compact}
    onUndo={doUndo}
    onRedo={doRedo}
    onPrinterClick={() => (printerDialogOpen = true)}
    onPrint={onPrintClicked}>
    {#snippet save()}
      <SavedLabelsMenu
        canvas={fabricCanvas!}
        onRequestLabelTemplate={exportCurrentLabel}
        {onLoadRequested}
        csvEnabled={$csvEnabled}
        bind:title={docTitle}
        triggerClass="btn btn-secondary header-save-btn">
        {#snippet trigger()}
          <MdIcon icon="save" />
          {$tr("studio.save")}
        {/snippet}
      </SavedLabelsMenu>
    {/snippet}
  </AppHeader>

  <div class="studio-body">
    <aside class="panel left-panel" class:sheet-open={mobileTab === "add" || mobileTab === "data"}>
      <div class="left-add" class:sheet-hidden={compact && mobileTab !== "add"}>
        <AddPanel
          {labelProps}
          onAdd={(t) => addTile(t)}
          {onIconPicked}
          {onSvgIconPicked}
          {zplImageReady}
          {pdfImageReady} />
      </div>
      <div class="left-data" class:sheet-hidden={compact && mobileTab !== "data"}>
        <DataPanel onFieldClick={(name) => insertField(name)} onEditRows={() => (dataGridOpen = true)} />
      </div>
    </aside>

    <main class="center">
      <div class="warnings"><BrowserWarning /></div>

      <div class="stage-area">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="stage canvas-wrapper" bind:this={stageEl} onpointerdown={onStagePointerDown}>
          <div class="stage-inner">
            <div class="caption mono">
              <span>{sizeCaption}</span>
              <span class="feed" title={$tr("params.label.direction")}>
                <MdIcon icon={labelProps.printDirection === "left" ? "arrow_back" : "arrow_upward"} />
              </span>
            </div>
            <div class="paper" class:with-shadow={labelProps.shape !== "circle"} style:border-radius={paperRadius}>
              <canvas bind:this={htmlCanvas}></canvas>
              {#if previewMode === "preview" && previewImage}
                <img class="preview-overlay" src={previewImage} alt={$tr("editor.preview")} />
              {/if}
            </div>
          </div>
        </div>

        <div class="float-toolbar">
          <Segmented
            size="sm"
            bind:value={previewMode}
            options={[
              { value: "fields", label: $tr("studio.fields") },
              { value: "preview", label: $tr("editor.preview") },
            ]} />
          {#if rowCount > 0}
            <div class="stepper mono">
              <button disabled={$activeRow <= 0} onclick={() => activeRow.set($activeRow - 1)} aria-label="previous">
                <MdIcon icon="chevron_left" />
              </button>
              <span>{$activeRow + 1} / {rowCount}</span>
              <button
                disabled={$activeRow >= rowCount - 1}
                onclick={() => activeRow.set($activeRow + 1)}
                aria-label="next">
                <MdIcon icon="chevron_right" />
              </button>
            </div>
          {/if}
        </div>

        <div class="stage-tools">
          <button class:active={$appConfig.gridEnabled} onclick={toggleGrid} title={$tr("editor.grid")}>
            <MdIcon icon="grid_on" />
          </button>
          <button onclick={clearCanvas} title={$tr("editor.clear")}>
            <MdIcon icon="cancel_presentation" />
          </button>
        </div>

        <div class="zoom-pill mono">
          <button onclick={() => setZoom(zoomRatio / 1.25)} aria-label="zoom out"><MdIcon icon="remove" /></button>
          <button class="pct" onclick={() => setZoom(1)} title={$tr("studio.zoom.fit")}>
            {Math.round(zoomRatio * 100)}%
          </button>
          <button onclick={() => setZoom(zoomRatio * 1.25)} aria-label="zoom in"><MdIcon icon="add" /></button>
        </div>
      </div>

      <LabelStrip getCanvasJson={() => fabricCanvas?.toJSON()} {labelProps} revision={layersRevision} {compact} />
    </main>

    <div class="panel right-panel" class:sheet-hidden={compact && mobileTab !== "style"}>
      <Inspector
        canvas={fabricCanvas}
        {labelProps}
        {selectedObject}
        {selectedCount}
        {editRevision}
        {layersRevision}
        valueUpdated={controlValueUpdated}
        onLabelPropsChange={onUpdateLabelProps}
        onDelete={deleteSelected}
        onDuplicate={cloneSelected}
        onSelect={(obj) => {
          fabricCanvas?.setActiveObject(obj);
          fabricCanvas?.requestRenderAll();
        }} />
    </div>
  </div>

  {#if compact}
    <nav class="tabbar">
      <button class:active={mobileTab === "add"} onclick={() => toggleTab("add")}>
        <MdIcon icon="add_box" />
        <span>{$tr("studio.add")}</span>
      </button>
      <button class:active={mobileTab === "data"} onclick={() => toggleTab("data")}>
        <MdIcon icon="table_chart" />
        <span>{$tr("studio.data")}</span>
      </button>
      <button class:active={mobileTab === "style"} onclick={() => toggleTab("style")}>
        <MdIcon icon={selectedCount > 0 ? "tune" : "label"} />
        <span>{selectedCount > 0 ? $tr("studio.style") : $tr("studio.label")}</span>
      </button>
    </nav>
  {/if}

  {#if previewOpened}
    <PrintPreview
      bind:show={previewOpened}
      canvasCallback={getCanvasForPreview}
      {labelProps}
      {printNow}
      csvEnabled={$csvEnabled && includedCount > 0}
      csvData={printCsvData} />
  {/if}

  {#if printerDialogOpen}
    <PrinterDialog
      bind:show={printerDialogOpen}
      onContinueWithout={pendingPrint ? continueWithoutPrinter : undefined} />
  {/if}

  {#if dataGridOpen}
    <DataGridDialog bind:show={dataGridOpen} onRenameColumns={renameColumns} />
  {/if}
</div>

<style>
  .studio {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--app-bg);
    color: var(--ink);
    overflow: hidden;
  }
  .studio-body {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .panel {
    background: var(--panel);
    flex: none;
  }
  .left-panel {
    width: 264px;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .left-data {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .right-panel {
    width: 292px;
    border-left: 1px solid var(--border);
    min-height: 0;
  }
  .center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .stage-area {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .warnings :global(.alert) {
    margin: 8px 12px 0;
  }
  .stage {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background-color: var(--stage-bg);
    background-image: radial-gradient(var(--stage-dot) 1px, transparent 1px);
    background-size: 16px 16px;
  }
  .stage-inner {
    min-width: 100%;
    min-height: 100%;
    width: max-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 48px;
  }
  .caption {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 10px;
  }
  .caption .feed :global(.mdi) {
    font-size: 14px;
    vertical-align: -0.15em;
  }
  .paper {
    position: relative;
    line-height: 0;
  }
  .paper.with-shadow {
    box-shadow: var(--shadow-label);
  }
  .paper :global(canvas) {
    image-rendering: pixelated;
  }
  .preview-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    border-radius: inherit;
    z-index: 3;
  }
  .float-toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-float);
    z-index: 4;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    color: var(--ink);
    padding-right: 2px;
  }
  .stepper button,
  .zoom-pill button,
  .stage-tools button {
    border: 0;
    background: transparent;
    color: var(--ink);
    height: 26px;
    min-width: 26px;
    border-radius: var(--radius-xs);
    display: inline-grid;
    place-items: center;
    padding: 0;
  }
  .stepper button:hover:not(:disabled),
  .zoom-pill button:hover,
  .stage-tools button:hover {
    background: var(--hover);
  }
  .stepper button:disabled {
    color: var(--muted-2);
  }
  .stepper :global(.mdi),
  .zoom-pill :global(.mdi),
  .stage-tools :global(.mdi) {
    font-size: 18px;
    vertical-align: 0;
  }
  .zoom-pill,
  .stage-tools {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-float);
    z-index: 4;
    bottom: 12px;
  }
  .zoom-pill {
    right: 12px;
    font-size: 12px;
  }
  .zoom-pill .pct {
    min-width: 48px;
  }
  .stage-tools {
    left: 12px;
  }
  .stage-tools button.active {
    background: var(--accent-soft);
    color: var(--accent-ink);
  }

  /* Mobile */
  .tabbar {
    height: 64px;
    flex: none;
    display: flex;
    background: var(--panel);
    border-top: 1px solid var(--border);
  }
  .tabbar button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
  }
  .tabbar button.active {
    color: var(--accent-ink);
  }
  .tabbar :global(.mdi) {
    font-size: 22px;
    vertical-align: 0;
  }
  .studio.compact .left-panel,
  .studio.compact .right-panel {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 72px;
    width: auto;
    max-height: 62vh;
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-dialog);
    overflow-y: auto;
    z-index: 20;
  }
  .studio.compact .left-panel:not(.sheet-open) {
    display: none;
  }
  .studio.compact .sheet-hidden {
    display: none;
  }
  .studio.compact .left-data {
    flex: none;
  }
  .studio.compact .left-data :global(.data-panel) {
    border-top: 0;
  }
  .studio.compact .stage-inner {
    padding: 56px 16px 24px;
  }
</style>
