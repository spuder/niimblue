import { CustomCanvas } from "$/fabric-object/custom_canvas";
import type { FabricJson, LabelProps } from "$/types";
import { canvasPreprocess } from "$/utils/canvas_preprocess";

/** Render label with variables applied into a new canvas element (same pipeline as print preview) */
export const renderLabel = async (
  json: FabricJson,
  labelProps: LabelProps,
  variables?: Record<string, string>,
): Promise<HTMLCanvasElement> => {
  const tmp = new CustomCanvas(undefined, {
    width: labelProps.size.width,
    height: labelProps.size.height,
  });

  try {
    tmp.setCustomBackground(false);
    tmp.setHighlightMirror(false);
    tmp.setLabelProps(labelProps);

    await tmp.loadFromJSON(json);
    canvasPreprocess(tmp, variables);
    await tmp.createMirroredObjects();
    tmp.renderAll();

    return tmp.toCanvasElement();
  } finally {
    tmp.dispose();
  }
};
