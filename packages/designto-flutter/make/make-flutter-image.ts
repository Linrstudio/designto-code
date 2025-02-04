import { nodes } from "@design-sdk/core";
import * as flutter from "@flutter-builder/flutter";
import { interpretIllust } from "../interpreter/illust.interpret";
import { rd } from "../_utils";

const PLACEHOLDER =
  "https://bridged-service-static.s3-us-west-1.amazonaws.com/branding/bridged-logo-512.png";
export function makePlaceHolderImage(
  node: nodes.ReflectSceneNode
): flutter.Image {
  return flutter.Image.network(PLACEHOLDER, {
    width: rd(node.width),
    height: rd(node.height),
    fit: flutter.BoxFit.cover as flutter.Snippet,
  });
}

export function makeIllustImage(node: nodes.ReflectSceneNode): flutter.Image {
  const asset = interpretIllust(node);
  return flutter.Image.network(asset.url, {
    width: rd(node.width),
    height: rd(node.height),
    fit: flutter.BoxFit.cover as flutter.Snippet,
  }).addComment(`image content of ${node.toString()}`);
}
