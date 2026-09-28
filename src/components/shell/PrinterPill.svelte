<script lang="ts">
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { connectedPrinterName, connectionState, heartbeatData, heartbeatFails, printerInfo, printerMeta } from "$/stores";
  import { tr } from "$/utils/i18n";
  import { connectionType, initPrinterConnection } from "$/utils/printer_connection";
  import { onMount } from "svelte";

  interface Props {
    compact?: boolean;
    onclick: () => void;
  }

  let { compact = false, onclick }: Props = $props();

  const battery = $derived($heartbeatData?.batteryPercents ?? $printerInfo?.batteryPercents);

  const label = $derived.by(() => {
    if ($connectionState === "connecting") return $tr("studio.printer.connecting");
    if ($connectionState === "connected") {
      const name = $printerMeta?.model ?? $connectedPrinterName;
      return battery !== undefined ? `${name} · ${battery}%` : name;
    }
    return $tr("studio.printer.connect_printer");
  });

  const status = $derived(
    $connectionState === "connected" ? ($heartbeatFails > 0 ? "warn" : "ok") : $connectionState === "connecting" ? "warn" : "off",
  );

  onMount(initPrinterConnection);
</script>

<button class="pill" class:compact={compact && $connectionState !== "connected"} {onclick} title={label}>
  <span class="dot dot-{status}"></span>
  <MdIcon icon={$connectionType === "serial" ? "usb" : "bluetooth"} />
  <span class="text">{label}</span>
</button>

<style>
  .pill {
    height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px 0 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    background: var(--panel);
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }
  .pill:hover {
    background: var(--hover);
  }
  .pill :global(.mdi) {
    font-size: 16px;
    vertical-align: 0;
    color: var(--muted);
  }
  .pill.compact {
    padding: 0 10px;
  }
  .pill.compact .text {
    display: none;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
  }
  .dot-off {
    background: var(--muted-2);
  }
  .dot-warn {
    background: var(--warning);
  }
  .dot-ok {
    background: var(--success);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--success) 25%, transparent);
  }
</style>
