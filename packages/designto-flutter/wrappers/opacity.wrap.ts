import { Opacity, Widget } from "@bridged.xyz/flutter-builder";
import { IReflectBlendMixin } from "@bridged.xyz/design-sdk/lib/nodes/types/mixins";

/**
 * Wrap widget with opacity if possible
 */
export function wrapWithOpacity(
  node: IReflectBlendMixin,
  child: Widget
): Widget {
  if (node.opacity !== undefined && node.opacity !== 1 && child) {
    return new Opacity({
      opacity: node.opacity,
      child: child,
    });
  }
  return child;
}
