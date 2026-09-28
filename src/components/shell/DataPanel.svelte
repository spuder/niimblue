<script lang="ts" module>
  /** DataTransfer mime type used for dragging field chips onto the canvas */
  export const FIELD_MIME = "application/x-niimblue-field";
</script>

<script lang="ts">
  import IconButton from "$/components/basic/IconButton.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { activeRow, csvData, csvEnabled, csvFileName, csvInclude, csvTable } from "$/stores";
  import { clearData, hasSavedData, importDataFile, loadTable, pickDataFile } from "$/utils/data_actions";
  import { isDataFile, SAMPLE_DATA } from "$/utils/data_table";
  import { tr } from "$/utils/i18n";

  interface Props {
    onFieldClick: (name: string) => void;
    onEditRows: () => void;
  }

  let { onFieldClick, onEditRows }: Props = $props();

  let dragOver = $state<boolean>(false);

  const includedCount = $derived($csvInclude.filter((v) => v).length);
  const currentRow = $derived($csvTable.rows[$activeRow]);

  const onDrop = async (e: DragEvent) => {
    dragOver = false;
    const file = [...(e.dataTransfer?.files ?? [])].find(isDataFile);
    if (file) {
      e.preventDefault();
      e.stopPropagation();
      await importDataFile(file);
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      dragOver = true;
    }
  };

  const onFieldDragStart = (e: DragEvent, name: string) => {
    e.dataTransfer?.setData(FIELD_MIME, name);
    e.dataTransfer?.setData("text/plain", `{${name}}`);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
  };
</script>

<section
  class="data-panel"
  class:drag-over={dragOver}
  ondragover={onDragOver}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
  aria-label={$tr("studio.data")}>
  <div class="section-title">{$tr("studio.data")}</div>

  {#if !$csvEnabled}
    <button class="drop-zone" onclick={pickDataFile}>
      <MdIcon icon="upload_file" />
      <div class="dz-title">{$tr("studio.data.drop")}</div>
      <div class="dz-sub">{$tr("studio.data.drop.sub")}</div>
    </button>
    {#if $csvData && hasSavedData()}
      <button class="btn btn-sm btn-primary w-100 mt-2" onclick={() => csvEnabled.set(true)}>
        <MdIcon icon="history" />
        {$tr("studio.data.saved")} ({$csvTable.rows.length}
        {$tr("studio.data.rows")})
      </button>
    {/if}
    <div class="d-flex gap-2 mt-2">
      <button class="btn btn-sm btn-secondary flex-fill" onclick={() => loadTable(SAMPLE_DATA, "sample.csv")}>
        {$tr("studio.data.sample")}
      </button>
      <button class="btn btn-sm btn-secondary flex-fill" onclick={onEditRows}>{$tr("studio.data.type")}</button>
    </div>
  {:else}
    <div class="file-card">
      <div class="file-icon"><MdIcon icon="table_chart" /></div>
      <div class="file-info">
        <div class="file-name">{$csvFileName || $tr("studio.data.table")}</div>
        <div class="file-meta mono">
          {$csvTable.rows.length}
          {$tr("studio.data.rows")} · {$csvTable.columns.length}
          {$tr("studio.data.fields")}
        </div>
      </div>
      <IconButton icon="edit_note" size={28} onclick={onEditRows} title={$tr("studio.data.edit")} />
      <IconButton icon="upload_file" size={28} onclick={pickDataFile} title={$tr("studio.data.replace")} />
      <IconButton icon="close" size={28} onclick={clearData} title={$tr("studio.data.remove")} />
    </div>

    <div class="fields">
      {#each $csvTable.columns as col (col)}
        <button
          class="field-chip"
          draggable="true"
          ondragstart={(e) => onFieldDragStart(e, col)}
          onclick={() => onFieldClick(col)}
          title={$tr("studio.data.field.hint")}>
          <MdIcon icon="drag_indicator" />
          <span class="token mono">{`{${col}}`}</span>
          <span class="value">{currentRow?.[col] ?? ""}</span>
        </button>
      {/each}
    </div>

    <div class="help">
      {$tr("studio.data.help")}
      {#if includedCount !== $csvTable.rows.length}
        <br />{includedCount} / {$csvTable.rows.length} {$tr("studio.data.selected")}
      {/if}
    </div>
  {/if}
</section>

<style>
  .data-panel {
    padding: 14px;
    border-top: 1px solid var(--border);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .data-panel.drag-over {
    background: var(--accent-soft);
  }
  .section-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .drop-zone {
    width: 100%;
    padding: 18px 12px;
    border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    background: var(--panel-2);
    color: var(--ink);
    text-align: center;
  }
  .drop-zone:hover {
    border-color: var(--accent);
  }
  .drop-zone :global(.mdi) {
    font-size: 26px;
    color: var(--muted);
  }
  .dz-title {
    margin-top: 6px;
    font-size: 13px;
    font-weight: 600;
  }
  .dz-sub {
    margin-top: 2px;
    font-size: 11.5px;
    color: var(--muted);
  }
  .file-card {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--panel);
  }
  .file-icon {
    width: 32px;
    height: 32px;
    flex: none;
    border-radius: var(--radius-sm);
    background: var(--success-bg);
    color: var(--success-ink);
    display: grid;
    place-items: center;
  }
  .file-icon :global(.mdi) {
    font-size: 18px;
    vertical-align: 0;
  }
  .file-info {
    flex: 1;
    min-width: 0;
  }
  .file-name {
    font-size: 12.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-meta {
    font-size: 11px;
    color: var(--muted);
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 10px;
  }
  .field-chip {
    height: 34px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px 0 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--panel);
    color: var(--ink);
    cursor: grab;
    text-align: left;
  }
  .field-chip:hover {
    border-color: var(--field-border);
  }
  .field-chip :global(.mdi) {
    font-size: 16px;
    color: var(--muted-2);
    vertical-align: 0;
  }
  .token {
    color: var(--field);
    font-size: 12px;
    white-space: nowrap;
  }
  .value {
    flex: 1;
    min-width: 0;
    text-align: right;
    font-size: 12px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .help {
    margin-top: 10px;
    font-size: 11.5px;
    color: var(--muted);
    line-height: 1.45;
  }
</style>
