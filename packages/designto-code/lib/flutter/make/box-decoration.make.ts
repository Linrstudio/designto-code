import {
  ReflectEllipseNode,
  ReflectFrameNode,
  ReflectRectangleNode,
} from "@bridged.xyz/design-sdk/lib/nodes";
import { retrieveFill } from "@bridged.xyz/design-sdk/lib/utils";
import {
  BoxDecoration,
  BoxFit,
  BoxShape,
  Color,
  DecorationImage,
  Gradient,
  ImageProvider,
  Snippet,
} from "@bridged.xyz/flutter-builder";
import { interpretGradient } from "../interpreter/gradient.interpret";
import { interpretImageFills } from "../interpreter/image.interpret";
import { makeBorderRadius } from "./border-radius.make";
import { makeBorder } from "./border.make";
import { makeBoxShadow } from "./box-shadow.make";
import { makeColorFromRGBO } from "./color.make";
import { Figma } from "@bridged.xyz/design-sdk";

export function makeBoxDecoration(
  node: ReflectRectangleNode | ReflectEllipseNode | ReflectFrameNode
): BoxDecoration | Color {
  const decorationBackground = makeBoxDecorationBg(node.fills);
  const decorationBorder = makeBorder(node);
  const decorationBoxShadow = makeBoxShadow(node);
  const decorationBorderRadius = makeBorderRadius(node);

  // modify the circle's shape when type is ellipse
  const decorationShape: BoxShape =
    node instanceof ReflectEllipseNode
      ? (BoxShape.circle as Snippet)
      : undefined;

  // generate the decoration, or just the backgroundColor when color is SOLID.
  const isNotSolid =
    decorationBorder ||
    decorationShape ||
    decorationBorder ||
    decorationBorderRadius ||
    decorationBackground;

  return isNotSolid
    ? new BoxDecoration({
        borderRadius: decorationBorderRadius,
        shape: decorationShape,
        image:
          decorationBackground instanceof ImageProvider
            ? new DecorationImage({
                image: decorationBackground,
                fit: BoxFit.cover as Snippet,
              })
            : undefined,
        border: decorationBorder,
        boxShadow: decorationBoxShadow,
        color:
          decorationBackground instanceof Color
            ? (decorationBackground as Color)
            : undefined,
        gradient:
          decorationBackground instanceof Gradient
            ? (decorationBackground as Gradient)
            : undefined,
      })
    : decorationBackground instanceof Color
    ? (decorationBackground as Color)
    : undefined;
}

export function makeBoxDecorationBg(
  fills: ReadonlyArray<Figma.Paint>
): Gradient | Color | ImageProvider {
  const fill = retrieveFill(fills);

  if (fill?.type === "SOLID") {
    const opacity = fill.opacity ?? 1.0;
    return makeColorFromRGBO(fill.color, opacity);
  } else if (fill?.type === "GRADIENT_LINEAR") {
    return interpretGradient(fill);
  } else if (fill?.type == "IMAGE") {
    return interpretImageFills(fill);
  }
  return undefined;
}
