<script lang="ts">
  import AppModal from "$/components/basic/AppModal.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { csvEnabled, csvFileName, csvInclude } from "$/stores";
  import { currentTable, downloadCsv, hasSavedData, loadTable } from "$/utils/data_actions";
  import { tr as i18n } from "$/utils/i18n";
  import { get } from "svelte/store";

  interface Props {
    show: boolean;
    /** Called for every renamed column so label tokens can be rewritten */
    onRenameColumns: (renames: [string, string][]) => void;
  }

  let { show = $bindable(), onRenameColumns }: Props = $props();

  // Start from enabled or previously saved data, so "Done" never silently replaces it
  const useExisting = get(csvEnabled) || hasSavedData();
  const initial = useExisting ? currentTable() : { columns: ["field1", "field2"], rows: [["", ""]] };
  const originalColumns = [...initial.columns];

  let columns = $state<string[]>([...initial.columns]);
  let rows = $state<string[][]>(initial.rows.map((r) => [...r]));
  let include = $state<boolean[]>(
    useExisting ? initial.rows.map((_, i) => get(csvInclude)[i] ?? true) : initial.rows.map(() => true),
  );
  let modalRef: AppModal;

  const addRow = () => {
    rows.push(columns.map(() => ""));
    include.push(true);
  };

  const addField = () => {
    let n = columns.length + 1;
    while (columns.includes(`field${n}`)) n++;
    columns.push(`field${n}`);
    rows.forEach((r) => r.push(""));
  };

  const deleteRow = (i: number) => {
    rows.splice(i, 1);
    include.splice(i, 1);
  };

  const cleanColumns = (): string[] => {
    const used: string[] = [];
    return columns.map((c, i) => {
      let name = c.trim().replace(/[{}|\s]+/g, "_") || `col${i + 1}`;
      while (used.includes(name)) name += "_";
      used.push(name);
      return name;
    });
  };

  const done = () => {
    const cols = cleanColumns();
    const renames: [string, string][] = [];
    originalColumns.forEach((old, i) => {
      if (i < cols.length && cols[i] !== old) renames.push([old, cols[i]]);
    });

    loadTable({ columns: cols, rows: rows.map((r) => [...r]) }, get(csvFileName) || "table.csv", [...include]);

    if (renames.length > 0) {
      onRenameColumns(renames);
    }
    modalRef.hide();
  };
</script>

<AppModal title={$i18n("studio.data.edit")} bind:show bind:this={modalRef} size="xl">
  <div class="grid-wrap">
    <table class="data-grid">
      <thead>
        <tr>
          <th class="chk"></th>
          <th class="num">#</th>
          {#each columns, ci (ci)}
            <th><input class="mono head-input" bind:value={columns[ci]} /></th>
          {/each}
          <th class="del"></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row, ri (ri)}
          <tr class:excluded={!include[ri]}>
            <td class="chk"><input type="checkbox" class="form-check-input" bind:checked={include[ri]} /></td>
            <td class="num mono">{ri + 1}</td>
            {#each columns, ci (ci)}
              <td><input class="cell-input" bind:value={row[ci]} /></td>
            {/each}
            <td class="del">
              <button onclick={() => deleteRow(ri)} title={$i18n("editor.delete")}><MdIcon icon="close" /></button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#snippet footer()}
    <button class="btn btn-sm btn-secondary" onclick={addRow}><MdIcon icon="add" /> {$i18n("studio.data.row")}</button>
    <button class="btn btn-sm btn-secondary" onclick={addField}><MdIcon icon="add" /> {$i18n("studio.data.field")}</button>
    <button
      class="btn btn-sm btn-secondary"
      onclick={() => downloadCsv({ columns: cleanColumns(), rows }, $csvFileName)}>
      <MdIcon icon="download" />
      CSV
    </button>
    <div class="flex-grow-1"></div>
    <button class="btn btn-sm btn-primary px-3" onclick={done}>{$i18n("studio.done")}</button>
  {/snippet}
</AppModal>

<style>
  .grid-wrap {
    max-height: 62vh;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .data-grid {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    font-size: 12.5px;
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--seg-track);
    z-index: 1;
    border-bottom: 1px solid var(--border);
    padding: 0;
  }
  td {
    border-bottom: 1px solid var(--border);
    padding: 0;
  }
  td + td,
  th + th {
    border-left: 1px solid var(--border);
  }
  .chk,
  .num,
  .del {
    width: 32px;
    text-align: center;
    color: var(--muted);
  }
  .head-input,
  .cell-input {
    width: 100%;
    min-width: 90px;
    height: 32px;
    padding: 0 8px;
    border: 0;
    background: transparent;
    color: var(--ink);
    outline: none;
  }
  .head-input {
    font-weight: 600;
    color: var(--field);
  }
  .head-input:focus,
  .cell-input:focus {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  tr.excluded td:not(.chk) {
    opacity: 0.45;
  }
  .del button {
    border: 0;
    background: transparent;
    color: var(--muted);
    padding: 0;
  }
  .del button:hover {
    color: var(--danger);
  }
  .del :global(.mdi) {
    font-size: 16px;
  }
</style>
