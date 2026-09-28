import { derived, get, readable, writable } from "svelte/store";
import { csvParse } from "d3-dsv";
import {
  AppConfigSchema,
  CsvParamsSchema,
  UserFontSchema,
  UserIconSchema,
  type CsvParams,
  type UserFont,
  type UserIcon,
  type AppConfig,
  type AutomationProps,
  type ConnectionState,
  type ConnectionType,
} from "$/types";
import {
  CombinedRfidInfo,
  RequestCommandId,
  ResponseCommandId,
  Utils,
  instantiateClient,
  type HeartbeatData,
  type NiimbotAbstractClient,
  type PrinterInfo,
  type PrinterModelMeta,
} from "@mmote/niimbluelib";
import { LocalStoragePersistence, writablePersisted } from "$/utils/persistence";
import { APP_CONFIG_DEFAULTS, CSV_DEFAULT, OBJECT_DEFAULTS_TEXT } from "$/defaults";
import z from "zod";
import { FileUtils } from "$/utils/file_utils";
import { createPrinterInfo } from "@mmote/niimbluelib/dist/cjs/client/abstract_client";

export const fontCache = writable<string[]>([OBJECT_DEFAULTS_TEXT.fontFamily]);
export const appConfig = writablePersisted<AppConfig>("config", AppConfigSchema, APP_CONFIG_DEFAULTS);
export const userIcons = writablePersisted<UserIcon[]>("user_icons", z.array(UserIconSchema), []);
export const userFonts = writablePersisted<UserFont[]>("user_fonts", z.array(UserFontSchema), []);
export const loadedFonts = writable<FontFace[]>([]);

export const connectionState = writable<ConnectionState>("disconnected");
export const connectedPrinterName = writable<string>("");
export const printerClient = writable<NiimbotAbstractClient>();
export const heartbeatData = writable<HeartbeatData>();
export const printerInfo = writable<PrinterInfo>();
export const rfidInfo = writable<CombinedRfidInfo>({});
export const printerMeta = writable<PrinterModelMeta | undefined>();
export const heartbeatFails = writable<number>(0);
export const csvData = writablePersisted<CsvParams>("csv_params", CsvParamsSchema, { data: CSV_DEFAULT });
/** Data rows are used for printing and preview */
export const csvEnabled = writable<boolean>(false);
/** Row shown in canvas preview and inspector */
export const activeRow = writable<number>(0);
/** Source file name of loaded data (display only) */
export const csvFileName = writable<string>("");
/** Per-row include-in-print flags */
export const csvInclude = writable<boolean[]>([]);

export interface CsvTable {
  columns: string[];
  rows: Record<string, string>[];
}

export const csvTable = derived(csvData, ($csvData): CsvTable => {
  try {
    const result = csvParse($csvData.data);
    return { columns: result.columns.filter((c) => c !== ""), rows: [...result] as Record<string, string>[] };
  } catch (e) {
    console.warn(e);
    return { columns: [], rows: [] };
  }
});

userFonts.subscribe(FileUtils.loadFonts);

// New data invalidates per-row flags. Callers that keep flags (loadTable) set them after the data.
csvTable.subscribe((t) => {
  csvInclude.set(t.rows.map(() => true));
  if (get(activeRow) >= t.rows.length) {
    activeRow.set(Math.max(0, t.rows.length - 1));
  }
});

export const automation = readable<AutomationProps | undefined>(
  (() => {
    try {
      return LocalStoragePersistence.loadAutomation() ?? undefined;
    } catch (e) {
      console.error(e);
    }
    return undefined;
  })(),
);

export const initClient = (connectionType: ConnectionType) => {
  printerClient.update((prevClient: NiimbotAbstractClient) => {
    let newClient: NiimbotAbstractClient = prevClient;

    if (connectionType !== prevClient?.getType()) {
      if (prevClient !== undefined) {
        prevClient.disconnect();
      }

      newClient = instantiateClient(connectionType);

      const conf = get(appConfig);

      if (conf.packetIntervalMs !== undefined) {
        newClient.setPacketInterval(conf.packetIntervalMs);
      }

      newClient.on("packetsent", (e) => {
        console.log(`>> ${Utils.bufToHex(e.packet.toBytes())} (${RequestCommandId[e.packet.command]})`);
      });

      newClient.on("packetreceived", (e) => {
        console.log(`<< ${Utils.bufToHex(e.packet.toBytes())} (${ResponseCommandId[e.packet.command]})`);
      });

      newClient.on("connect", (e) => {
        heartbeatFails.set(0);
        connectionState.set("connected");
        connectedPrinterName.set(e.info.deviceName ?? "unknown");
      });

      newClient.on("printerinfofetched", (e) => {
        printerInfo.set(e.info);
        printerMeta.set(newClient.getModelMetadata());
      });

      newClient.on("disconnect", () => {
        connectionState.set("disconnected");
        connectedPrinterName.set("");
        printerInfo.set(createPrinterInfo());
        printerMeta.set(undefined);
      });

      newClient.on("heartbeat", (e) => {
        heartbeatFails.set(0);
        heartbeatData.set(e.data);
      });

      newClient.on("rfidinfofetched", (e) => {
        rfidInfo.set(e.info);
      });

      newClient.on("heartbeatfailed", (e) => {
        heartbeatFails.set(e.failedAttempts);
        console.warn(`Heartbeat failed ${e.failedAttempts}/${newClient.getHeartbeatMaxFails()}`);
      });
    }

    return newClient;
  });
};

export type AppTheme = "light" | "dark";

const THEME_KEY = "niimblue-theme";

const loadTheme = (): AppTheme => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch (e) {
    console.warn(e);
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/** UI color theme. Label paper always stays white. */
export const theme = writable<AppTheme>(loadTheme());

theme.subscribe((t) => {
  document.documentElement.setAttribute("data-bs-theme", t);
});

export const setTheme = (t: AppTheme) => {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch (e) {
    console.warn(e);
  }
  theme.set(t);
};
