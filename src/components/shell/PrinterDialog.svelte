<script lang="ts">
  import { LabelType, SoundSettingsItemType } from "@mmote/niimbluelib";
  import {
    printerClient,
    connectedPrinterName,
    connectionState,
    heartbeatData,
    printerInfo,
    printerMeta,
    heartbeatFails,
    rfidInfo,
  } from "$/stores";
  import { tr, type TranslationKey } from "$/utils/i18n";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import AppModal from "$/components/basic/AppModal.svelte";
  import Segmented from "$/components/basic/Segmented.svelte";
  import FirmwareUpdater from "$/components/basic/FirmwareUpdater.svelte";
  import PrinterVerboseInfo from "$/components/PrinterVerboseInfo.svelte";
  import {
    canConnect,
    connectionType,
    connectPrinter,
    disconnectPrinter,
    featureSupport,
    switchConnectionType,
  } from "$/utils/printer_connection";
  import type { ConnectionType } from "$/types";

  interface Props {
    show: boolean;
    /** Shown when printing was requested without a printer (e.g. to use system print) */
    onContinueWithout?: () => void;
  }

  let { show = $bindable(), onContinueWithout }: Props = $props();

  let verboseInfoShow = $state<boolean>(false);
  let detailsOpen = $state<boolean>(false);

  const percentage = (cur?: number, total?: number) => {
    if (cur === undefined || total === undefined) {
      return 0;
    }
    const usage = Math.floor((cur / total) * 100);
    return Math.min(Math.max(usage, 0), 100);
  };

  const transportOptions = $derived.by(() => {
    const opts: { value: ConnectionType; label: string; icon: "bluetooth" | "usb" }[] = [];
    if ($featureSupport.webBluetooth) opts.push({ value: "bluetooth", label: $tr("connector.bluetooth"), icon: "bluetooth" });
    if ($featureSupport.webSerial) opts.push({ value: "serial", label: $tr("connector.serial"), icon: "usb" });
    if ($featureSupport.capacitorBle) opts.push({ value: "capacitor-ble", label: "Capacitor BLE", icon: "bluetooth" });
    return opts;
  });

  const battery = $derived($heartbeatData?.batteryPercents ?? $printerInfo?.batteryPercents);
</script>

<AppModal title={$tr("studio.printer.title")} bind:show>
  {#if $connectionState === "connected"}
    <div class="status-card">
      <div class="status-icon"><MdIcon icon={$connectionType === "serial" ? "usb" : "bluetooth"} /></div>
      <div class="flex-grow-1">
        <div class="fw-semibold" class:text-warning={$heartbeatFails > 0}>
          {$printerMeta?.model ?? $connectedPrinterName}
        </div>
        <div class="small text-secondary">
          {$tr("studio.printer.connected")}{#if battery !== undefined}&nbsp;· {$tr("studio.printer.battery")}
            {battery}%{/if}
        </div>
      </div>
      <button class="btn btn-sm btn-secondary" onclick={disconnectPrinter}>
        <MdIcon icon="power_off" />
        {$tr("studio.printer.disconnect")}
      </button>
    </div>

    <button class="details-toggle" onclick={() => (detailsOpen = !detailsOpen)}>
      <MdIcon icon={detailsOpen ? "expand_less" : "expand_more"} />
      {$tr("studio.printer.details")}
    </button>

    {#if detailsOpen}
      <div class="details">
        {#if $printerInfo}
          <div class="text-secondary">{$tr("connector.device_version")}</div>
          <div class="d-flex border rounded">
            <div class="px-1 border-end">HW</div>
            <div class="px-1 flex-grow-1 border-end text-center mono">{$printerInfo.hardwareVersion}</div>
            <div class="px-1 flex-grow-1 border-end text-center mono">{$printerInfo.softwareVersion}</div>
            <div class="px-1">FW</div>
          </div>
        {/if}

        <div class="text-secondary mt-2">
          {$tr("connector.rfid.paper")}
          <button class="btn btn-sm p-0" onclick={() => $printerClient.fetchRfidInfo()}><MdIcon icon="loop" /></button>
        </div>

        {#if $rfidInfo.labelRfidInfo?.tagPresent}
          <div class="d-flex border rounded mt-1">
            <div class="px-1 border-end">{$tr("connector.rfid.usage")}</div>
            <div class="px-1 flex-grow-1 d-flex align-items-center gap-1">
              <div class="progress flex-grow-1" role="progressbar" style:height="0.6rem">
                <div
                  class="progress-bar"
                  style:width={`${percentage($rfidInfo.labelRfidInfo.usedPaper, $rfidInfo.labelRfidInfo.allPaper)}%`}>
                </div>
              </div>
              <div class="fs-08 mono">
                {$rfidInfo.labelRfidInfo?.usedPaper} / {$rfidInfo.labelRfidInfo?.allPaper}
              </div>
            </div>
          </div>

          <div class="d-flex border rounded mt-1">
            <div class="px-1 border-end">{$tr("connector.rfid.type")}</div>
            <div class="px-1 flex-grow-1 text-center">
              {$tr(`preview.label_type.${LabelType[$rfidInfo.labelRfidInfo?.consumablesType]}` as TranslationKey)} ({$rfidInfo
                .labelRfidInfo?.consumablesType})
            </div>
          </div>

          {#if $rfidInfo.paperInfo?.paperWidth !== undefined && $rfidInfo.paperInfo?.paperHeight !== undefined}
            <div class="d-flex border rounded mt-1">
              <div class="px-1 border-end">{$tr("connector.rfid.dimensions")}</div>
              <div class="px-1 flex-grow-1 text-center mono">
                {$rfidInfo.paperInfo.paperWidth}×{$rfidInfo.paperInfo.paperHeight} mm
              </div>
            </div>
          {/if}
        {:else}
          <div class="small">{$tr("connector.rfid.no_tag")}</div>
        {/if}

        {#if $rfidInfo.ribbonRfidInfo?.tagPresent}
          <div class="text-secondary mt-2">{$tr("connector.rfid.ribbon")}</div>
          <div class="d-flex border rounded mt-1">
            <div class="px-1 border-end">{$tr("connector.rfid.usage")}</div>
            <div class="px-1 flex-grow-1 d-flex align-items-center gap-1">
              <div class="progress flex-grow-1" role="progressbar" style:height="0.6rem">
                <div
                  class="progress-bar"
                  style:width={`${percentage($rfidInfo.ribbonRfidInfo.usedPaper, $rfidInfo.ribbonRfidInfo.allPaper)}%`}>
                </div>
              </div>
              <div class="fs-08 mono">
                {$rfidInfo.ribbonRfidInfo?.usedPaper} / {$rfidInfo.ribbonRfidInfo?.allPaper}
              </div>
            </div>
          </div>
        {/if}

        <div class="text-secondary mt-2">{$tr("connector.settings")}</div>

        <div class="form-check form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="power-sound-switch"
            checked={$printerInfo.settings.powerSound}
            onchange={() =>
              $printerClient.setSoundEnabled(SoundSettingsItemType.PowerSound, !$printerInfo.settings.powerSound)} />
          <label class="form-check-label" for="power-sound-switch">{$tr("connector.settings.power_sound")}</label>
        </div>

        <div class="form-check form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="connection-sound-switch"
            checked={$printerInfo.settings.connectionSound}
            onchange={() =>
              $printerClient.setSoundEnabled(
                SoundSettingsItemType.BluetoothConnectionSound,
                !$printerInfo.settings.connectionSound,
              )} />
          <label class="form-check-label" for="connection-sound-switch"
            >{$tr("connector.settings.connection_sound")}</label>
        </div>

        <button class="btn btn-sm btn-secondary w-100 mt-3" onclick={() => (verboseInfoShow = true)}>
          {$tr("connector.open_verbose")}
        </button>

        <button
          class="btn btn-sm btn-secondary d-block w-100 mt-1"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#firmware_flashing">
          {$tr("connector.firmware_flashing")}
          <MdIcon icon="expand_more" />
        </button>
        <div class="collapse" id="firmware_flashing">
          <FirmwareUpdater />
        </div>

        <button
          class="btn btn-sm btn-secondary d-block w-100 mt-1"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#tests">
          {$tr("debug.title")} <MdIcon icon="expand_more" />
        </button>
        <div class="collapse" id="tests">
          <div class="d-flex flex-wrap gap-1 mt-1">
            <button class="btn btn-sm btn-secondary" onclick={() => $printerClient.startHeartbeat()}>Heartbeat on</button>
            <button class="btn btn-sm btn-secondary" onclick={() => $printerClient.stopHeartbeat()}>Heartbeat off</button>
            <button class="btn btn-sm btn-secondary" onclick={() => $printerClient.protocol.printerReset()}>Reset</button>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    {#if transportOptions.length > 0}
      <div class="field-label">{$tr("studio.printer.connect_via")}</div>
      <Segmented
        fill
        options={transportOptions}
        value={$connectionType}
        onChange={(v) => switchConnectionType(v)} />

      <button
        class="btn btn-primary w-100 mt-3 connect-btn"
        disabled={$connectionState === "connecting" || !canConnect($featureSupport)}
        onclick={connectPrinter}>
        {#if $connectionState === "connecting"}
          <span class="spinner-border spinner-border-sm"></span>
          {$tr("studio.printer.connecting")}
        {:else}
          <MdIcon icon="power" />
          {$tr("studio.printer.connect")}
        {/if}
      </button>
      <div class="small text-secondary mt-2 text-center">{$tr("studio.printer.note")}</div>
    {:else}
      <div class="alert alert-warning mb-0">{$tr("browser_warning.lines.first")}</div>
    {/if}
    {#if onContinueWithout}
      <button class="btn btn-sm btn-link w-100 mt-2" onclick={onContinueWithout}>
        {$tr("studio.printer.skip")}
      </button>
    {/if}
  {/if}
</AppModal>

{#if verboseInfoShow}
  <PrinterVerboseInfo bind:show={verboseInfoShow} />
{/if}

<style>
  .status-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: var(--radius-lg);
    background: var(--success-bg);
    border: 1px solid color-mix(in oklch, var(--success) 35%, transparent);
  }
  .status-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    display: grid;
    place-items: center;
    background: var(--success);
    color: #fff;
  }
  .status-icon :global(.mdi) {
    font-size: 20px;
    vertical-align: 0;
  }
  .details-toggle {
    margin-top: 12px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 12.5px;
    font-weight: 500;
    padding: 0;
  }
  .details {
    margin-top: 8px;
    font-size: 13px;
  }
  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .connect-btn {
    height: 38px;
    font-weight: 600;
  }
</style>
