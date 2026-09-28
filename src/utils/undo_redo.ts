import * as fabric from "fabric";
import type { ExportedLabelTemplate, LabelProps } from "$/types";

export type UndoState = { undoDisabled: boolean; redoDisabled: boolean };

export class UndoRedo {
  private readonly UNDO_MAX: number = 20;

  private buf: ExportedLabelTemplate[] = [];
  private index: number = 0;

  public paused: boolean = false;

  public onLabelUpdate?: (data: ExportedLabelTemplate) => Promise<void>;
  public onStateUpdate?: (state: UndoState) => void;

  private updateState() {
    this.onStateUpdate?.({
      undoDisabled: this.index === 0,
      redoDisabled: this.index >= this.buf.length - 1,
    });
  }
  async undo() {
    if (this.index > 0 && this.index < this.buf.length) {
      await this.onLabelUpdate?.(this.buf[this.index - 1]);
      this.index--;
    }
    this.updateState();
  }

  async redo() {
    if (this.index < this.buf.length - 1) {
      await this.onLabelUpdate?.(this.buf[this.index + 1]);
      this.index++;
    }
    this.updateState();
  }

  push(fabricCanvas: fabric.Canvas, labelProps: LabelProps) {
    if (this.paused) {
      return;
    }

    const state: ExportedLabelTemplate = {
      label: labelProps,
      canvas: fabricCanvas.toJSON(),
    };

    // skip no-op pushes (e.g. several events fired for one user action)
    const current = this.buf[this.index];
    if (current !== undefined && JSON.stringify(current) === JSON.stringify(state)) {
      return;
    }

    // drop redo history
    if (this.index < this.buf.length - 1) {
      this.buf = this.buf.slice(0, this.index + 1);
    }

    this.buf.push(state);

    if (this.buf.length > this.UNDO_MAX) {
      this.buf.shift();
    }

    this.index = this.buf.length - 1;
    this.updateState();
  }
}
