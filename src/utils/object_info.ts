import * as fabric from "fabric";
import { ArUcoMarker } from "$/fabric-object/aruco";
import Barcode from "$/fabric-object/barcode";
import { QRCode } from "$/fabric-object/qrcode";
import type { MaterialIcon } from "$/styles/mdi_icons";
import type { TranslationKey } from "$/utils/i18n";

export interface ObjectInfo {
  icon: MaterialIcon;
  name: TranslationKey;
  /** Text content for text-like objects */
  text?: string;
  /** Object content supports {variables} */
  templatable: boolean;
}

const TOKEN_RX = /{\s*\$?\w+.*?}/;

export const hasTokens = (text?: string): boolean => text !== undefined && TOKEN_RX.test(text);

export const describeObject = (obj: fabric.FabricObject): ObjectInfo => {
  if (obj instanceof QRCode) {
    return { icon: "qr_code_2", name: "studio.add.qr", text: obj.text, templatable: true };
  }
  if (obj instanceof Barcode) {
    return { icon: "view_week", name: "editor.objectpicker.barcode", text: obj.text, templatable: true };
  }
  if (obj instanceof ArUcoMarker) {
    return { icon: "grid_on", name: "editor.objectpicker.aruco", templatable: false };
  }
  if (obj instanceof fabric.IText) {
    return { icon: "title", name: "editor.objectpicker.text", text: obj.text, templatable: true };
  }
  if (obj instanceof fabric.FabricText) {
    // Static text is used for Material icons
    return { icon: "emoji_emotions", name: "studio.add.icon", templatable: false };
  }
  if (obj instanceof fabric.FabricImage) {
    return { icon: "image", name: "editor.objectpicker.image", templatable: false };
  }
  if (obj instanceof fabric.Rect) {
    return { icon: "crop_square", name: "studio.add.box", templatable: false };
  }
  if (obj instanceof fabric.Circle) {
    return { icon: "radio_button_unchecked", name: "editor.objectpicker.circle", templatable: false };
  }
  if (obj instanceof fabric.Polyline || obj instanceof fabric.Line) {
    return { icon: "remove", name: "editor.objectpicker.line", templatable: false };
  }
  return { icon: "category", name: "studio.object", templatable: false };
};

/** Get text content of a templatable object */
export const getObjectText = (obj: fabric.FabricObject): string | undefined => {
  if (obj instanceof fabric.IText || obj instanceof QRCode || obj instanceof Barcode) {
    return obj.text;
  }
  return undefined;
};

/** Set text content of a templatable object. Returns false if object does not support text. */
export const setObjectText = (obj: fabric.FabricObject, text: string): boolean => {
  if (obj instanceof fabric.IText) {
    if (obj.isEditing) obj.exitEditing();
    obj.set({ text });
    return true;
  }
  if (obj instanceof QRCode || obj instanceof Barcode) {
    obj.set({ text });
    return true;
  }
  return false;
};
