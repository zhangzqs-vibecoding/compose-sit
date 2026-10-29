import { DOMAdapter } from "@compose-sit/pixi-environment";
import type { Adapter } from "pixi.js";
import { adaptCanvas } from "./canvas";

const canvas = wx.createCanvas();
const mainSurface = adaptCanvas(canvas);
const windowInfo = wx.getWindowInfo();
canvas.width = windowInfo.windowWidth * windowInfo.pixelRatio;
canvas.height = windowInfo.windowHeight * windowInfo.pixelRatio;
const adapter: Adapter = {
  createCanvas: (width = 1, height = 1) => {
    const value = wx.createCanvas();
    value.width = width;
    value.height = height;
    return adaptCanvas(value).canvas;
  },
  createImage: () => wx.createImage() as unknown as HTMLImageElement,
  getFontFaceSet: () => null,
  getCanvasRenderingContext2D: () =>
    wx.createCanvas().getContext("2d")
      .constructor as typeof CanvasRenderingContext2D,
  getWebGLRenderingContext: () =>
    canvas.getContext("webgl").constructor as typeof WebGLRenderingContext,
  getNavigator: () => ({ userAgent: "WeChat MiniGame", gpu: null }),
  getBaseUrl: () => "",
  fetch: async () => {
    throw new Error(
      "This game loads bundled textures through wx.createImage; network fetch is not configured",
    );
  },
  parseXML: () => {
    throw new Error("XML is not used; UI glyphs are a PNG atlas");
  },
};
DOMAdapter.set(adapter);

export { canvas, mainSurface, windowInfo };
