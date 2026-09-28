<script lang="ts">
  import type { MaterialIcon } from "$/styles/mdi_icons";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  interface Props extends HTMLButtonAttributes {
    icon: MaterialIcon;
    active?: boolean;
    danger?: boolean;
    size?: number;
  }

  let { icon, active = false, danger = false, size = 34, class: className = "", ...rest }: Props = $props();
</script>

<button
  type="button"
  class="icon-btn {className}"
  class:active
  class:danger
  style="--size: {size}px"
  {...rest}>
  <MdIcon {icon} />
</button>

<style>
  .icon-btn {
    width: var(--size);
    height: var(--size);
    flex: none;
    display: inline-grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink);
    cursor: pointer;
  }
  .icon-btn :global(.mdi) {
    font-size: 20px;
    vertical-align: 0;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--hover);
  }
  .icon-btn.active {
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .icon-btn.danger {
    color: var(--danger);
  }
  .icon-btn:disabled {
    color: var(--muted-2);
    opacity: 0.6;
    cursor: default;
  }
</style>
