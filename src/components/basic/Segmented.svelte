<script lang="ts" generics="T extends string | number">
  import type { MaterialIcon } from "$/styles/mdi_icons";
  import MdIcon from "$/components/basic/MdIcon.svelte";

  interface Option {
    value: T;
    label?: string;
    icon?: MaterialIcon;
    title?: string;
  }

  interface Props {
    options: Option[];
    value: T;
    onChange?: (value: T) => void;
    size?: "sm" | "md";
    fill?: boolean;
  }

  let { options, value = $bindable(), onChange, size = "md", fill = false }: Props = $props();

  const select = (v: T) => {
    value = v;
    onChange?.(v);
  };
</script>

<div class="seg seg-{size}" class:fill role="radiogroup">
  {#each options as opt (opt.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === opt.value}
      class:active={value === opt.value}
      title={opt.title ?? opt.label}
      onclick={() => select(opt.value)}>
      {#if opt.icon}<MdIcon icon={opt.icon} />{/if}
      {#if opt.label}<span>{opt.label}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    padding: 2px;
    gap: 2px;
    border-radius: var(--radius-sm);
    background: var(--seg-track);
  }
  .seg.fill {
    display: flex;
    width: 100%;
  }
  .seg.fill button {
    flex: 1;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 0;
    border-radius: var(--radius-xs);
    background: transparent;
    color: var(--muted);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }
  .seg-md button {
    height: 28px;
    padding: 0 10px;
    font-size: 12.5px;
  }
  .seg-sm button {
    height: 24px;
    padding: 0 8px;
    font-size: 12px;
  }
  button :global(.mdi) {
    font-size: 18px;
    vertical-align: 0;
  }
  button:hover {
    color: var(--ink);
  }
  button.active {
    background: var(--panel);
    color: var(--ink);
    box-shadow: var(--shadow-seg);
  }
</style>
