import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import glyphData from "../../../assets/font/glyphs.json";

interface Glyph {
  x: number;
  y: number;
  w: number;
  h: number;
  advance: number;
}
const glyphs: Record<string, Glyph> = glyphData;
export class BitmapLabel extends Container {
  private value = "";
  private textures = new Map<string, Texture>();
  constructor(
    private atlas: Texture,
    private size: number,
    private color: number = 0x163b50,
    private align: "left" | "center" | "right" = "left",
  ) {
    super();
  }
  set(text: string): this {
    if (this.value === text) return this;
    this.value = text;
    for (const child of this.removeChildren()) child.destroy();
    let x = 0;
    for (const char of text) {
      const glyph = glyphs[char] ?? glyphs["?"];
      if (!glyph) continue;
      let texture = this.textures.get(char);
      if (!texture) {
        texture = new Texture({
          source: this.atlas.source,
          frame: new Rectangle(glyph.x, glyph.y, glyph.w, glyph.h),
        });
        this.textures.set(char, texture);
      }
      const sprite = new Sprite(texture);
      sprite.position.set(x, -this.size * 0.15);
      sprite.scale.set(this.size / 64);
      sprite.tint = this.color;
      this.addChild(sprite);
      x += (glyph.advance * this.size) / 64;
    }
    const offset =
      this.align === "center" ? -x / 2 : this.align === "right" ? -x : 0;
    for (const child of this.children) child.x += offset;
    return this;
  }
  override destroy(): void {
    super.destroy({ children: true });
    for (const texture of this.textures.values()) texture.destroy();
    this.textures.clear();
  }
}
