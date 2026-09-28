import { NiimbotCapacitorBleClient, Utils, type AvailableTransports } from "@mmote/niimbluelib";
import { get, writable } from "svelte/store";
import { automation, connectionState, initClient, printerClient } from "$/stores";
import type { ConnectionType } from "$/types";
import { LocalStoragePersistence } from "$/utils/persistence";
import { Toasts } from "$/utils/toasts";

/** Selected transport for the next connection attempt */
export const connectionType = writable<ConnectionType>("bluetooth");

export const featureSupport = writable<AvailableTransports>({
  webBluetooth: false,
  webSerial: false,
  capacitorBle: false,
});

let initialized = false;

/** Detect available transports, restore last connection type and run auto-connect. Safe to call multiple times. */
export const initPrinterConnection = () => {
  if (initialized) {
    return;
  }
  initialized = true;

  const support = Utils.getAvailableTransports();
  featureSupport.set(support);

  let type: ConnectionType = LocalStoragePersistence.loadLastConnectionType() ?? "bluetooth";

  if (!support.capacitorBle && type === "capacitor-ble") {
    type = "bluetooth";
  }
  if (!support.webSerial && type === "serial") {
    type = "bluetooth";
  }
  if (!support.webBluetooth && type === "bluetooth" && support.capacitorBle) {
    type = "capacitor-ble";
  }

  connectionType.set(type);

  const auto = get(automation);
  if (auto !== undefined && auto.autoConnect && type === "capacitor-ble") {
    connectPrinter();
  }
};

export const switchConnectionType = (c: ConnectionType) => {
  LocalStoragePersistence.saveLastConnectionType(c);
  connectionType.set(c);
};

export const canConnect = (support: AvailableTransports): boolean =>
  support.capacitorBle || support.webBluetooth || support.webSerial;

export const connectPrinter = async () => {
  initClient(get(connectionType));
  connectionState.set("connecting");

  const client = get(printerClient);
  const auto = get(automation);

  try {
    if (client instanceof NiimbotCapacitorBleClient && auto?.autoConnectDeviceId !== undefined) {
      await client.connect({ deviceId: auto.autoConnectDeviceId });
    } else {
      await client.connect();
    }
  } catch (e) {
    connectionState.set("disconnected");
    Toasts.error(e);
  }
};

export const disconnectPrinter = () => {
  get(printerClient)?.disconnect();
};
