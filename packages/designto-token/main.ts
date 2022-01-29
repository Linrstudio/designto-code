import { nodes } from "@design-sdk/core";
import { Widget } from "@reflect-ui/core";
import { tokenizeText } from "./token-text";
import { tokenizeLayout } from "./token-layout";
import { tokenizeContainer } from "./token-container";
import { tokenizeVector, tokenizeGraphics } from "./token-graphics";
import { tokenizeButton, tokenizeDivider } from "./token-widgets";
import { SingleOrArray, isNotEmptyArray } from "./utils";
import { array } from "@reflect-ui/uiutils";
import { detectIf } from "@reflect-ui/detection";
import { byY, byYX } from "@designto/sanitized/sort-by-y-z";
import ignore_masking_pipline from "@designto/sanitized/ignore-masking-nodes";
import { default_tokenizer_config, TokenizerConfig } from "./config";
import {
  containsMasking,
  hasBackgroundBlurType,
  hasBlurType,
  hasDimmedOpacity,
  hasLayerBlurType,
  hasRotation,
  hasStretching,
} from "./detection";
import { MaskingItemContainingNode, tokenizeMasking } from "./token-masking";
import { wrap_with_opacity } from "./token-opacity";
import { wrap_with_stretched } from "./token-stretch";
import { wrap_with_layer_blur } from "./token-effect/layer-blur";
import { wrap_with_background_blur } from "./token-effect/background-blur";
import { wrap_with_rotation } from "./token-rotation";
import flags_handling_gate from "./support-flags";

export type { Widget };

export type RuntimeChildrenInput = Array<nodes.ReflectSceneNode | Widget>;

let __dangerous_current_config: TokenizerConfig = null;

/**
 * ENTRY POINT MAIN FUCTION
 * Main function for converting reflect design node tree to reflect widget token tree
 */
export function tokenize(
  node: nodes.ReflectSceneNode,
  config: TokenizerConfig = default_tokenizer_config
): Widget {
  if (!node) {
    throw "A valid design node should be passed in order to tokenize it into a reflect widget.";
  }
  __dangerous_current_config = { ...config }; // unwrapping so every call can have a new config variable changed.
  return independantTokenizer(node, config);
}

/**
 * tokenize a single node, without any reference of component use.
 */
function independantTokenizer(
  node: SingleOrArray<nodes.ReflectSceneNode>,
  config: TokenizerConfig
) {
  return dynamicGenerator(node, config) as Widget;
}

/**
 * one of [root, child, children]
 * @param node
 * @returns
 */
function dynamicGenerator(
  node: SingleOrArray<nodes.ReflectSceneNode>,
  config: TokenizerConfig
): SingleOrArray<Widget> {
  const node_handler = (node, config) => {
    return handle_with_custom_wrapping_provider(
      config.custom_wrapping_provider,
      {
        token: handleNode(node, config),
        node: node,
        depth: undefined, // TODO:
      }
    );
  };

  if (isNotEmptyArray(node)) {
    const widgets: Array<Widget> = [];
    node = node as Array<nodes.ReflectSceneNode>;
    node
      // .sort(byY)
      .filter(ignore_masking_pipline(config.sanitizer_ignore_masking_node))
      .forEach((node, index) => {
        widgets.push(node_handler(node, config));
      });

    // filter empty widgets (safe checker logic)
    const finalWidgets = widgets.filter((w) => array.filters.notEmpty(w));
    return finalWidgets;
  } else {
    return node_handler(node, config);
  }
}

function handle_with_custom_wrapping_provider(
  provider: TokenizerConfig["custom_wrapping_provider"] | undefined,
  input: {
    token: Widget;
    node: nodes.ReflectSceneNode;
    depth: number;
  }
): Widget {
  const wrapped_or_not = provider?.(input.token, input.node, input.depth);
  if (wrapped_or_not) {
    return wrapped_or_not;
  } else {
    return input.token;
  }
}

/**
 * @internal - do not export as sdk usage. this should be exported & used for internal use only.
 * @param nodes
 * @returns
 */
export function handleChildren(
  nodes: RuntimeChildrenInput,
  config: TokenizerConfig | "dangerously_use_current"
): Array<Widget> {
  return nodes.map((n) => {
    if (n instanceof Widget) {
      return n;
    } else {
      config =
        config === "dangerously_use_current"
          ? __dangerous_current_config
          : config;
      return dynamicGenerator(n, config) as Widget;
    }
  });
}

function handleNode(
  node: nodes.ReflectSceneNode,
  config: TokenizerConfig
): Widget {
  if (!node.type) {
    console.error(
      "cannot handle unknown type of node. node.type was undefined or null"
    );
    return;
  }

  // -------------------------------------------------------------------------
  // --------------------------- Detected tokens -----------------------------
  // -------------------------------------------------------------------------

  // - image - // image detection is always enabled exceptionally.
  // TODO: separate image detection with static logic based and the smart one.
  const _detect_if_image = detectIf.image(node);
  if (_detect_if_image.result) {
    return tokenizeGraphics.fromImage(node, _detect_if_image.data);
  }

  if (config.disable_detection) {
    // skip detection
  } else {
    // - icon -
    const _detect_if_icon = detectIf.icon(node);
    if (_detect_if_icon.result) {
      return tokenizeGraphics.fromIcon(node, _detect_if_icon.data);
    }

    // - button -
    // TODO: temporarily disabled - remove comment after button widget is ready
    // const _detect_if_button = detectIf.button(node);
    // if (_detect_if_button.result) {
    //   return tokenizeButton.fromManifest(node, _detect_if_button.data);
    // }
  }
  // -------------------------------------------------------------------------
  // --------------------------- Detected tokens -----------------------------
  // -------------------------------------------------------------------------

  //
  //
  // -------------------------------------------------------------------------
  //
  //

  // -------------------------------------------------------------------------
  // --------------------------- Pre processors ------------------------------
  // -------------------------------------------------------------------------
  let tokenizedTarget: Widget = null;
  // masking handler
  if (containsMasking(node)) {
    tokenizedTarget = tokenizeMasking.fromMultichild(
      node as MaskingItemContainingNode,
      config
    );
  }

  // flags handler
  if (!tokenizedTarget) {
    if (
      !config.disable_flags_support &&
      config.should_ignore_flag?.(node) !== true
    ) {
      tokenizedTarget = flags_handling_gate(node);
    }
  }
  //
  // -------------------------------------------------------------------------
  //

  // -------------------------------------------------------------------------
  // -------------------------- handle by types ------------------------------
  // -------------------------------------------------------------------------
  if (!tokenizedTarget) {
    // if none handled by above gates, handle by type. this is the default tokenizer.
    tokenizedTarget = handle_by_types(node, config);
  }
  //
  // -------------------------------------------------------------------------
  //

  // -------------------------------------------------------------------------
  // -------------------------- post wrap widget -----------------------------
  // -------------------------------------------------------------------------
  tokenizedTarget = post_wrap(node, tokenizedTarget);
  //
  // -------------------------------------------------------------------------
  //

  return tokenizedTarget;
}

function post_wrap(node: nodes.ReflectSceneNode, tokenizedTarget: Widget) {
  if (tokenizedTarget) {
    if (hasStretching(node)) {
      tokenizedTarget = wrap_with_stretched(node, tokenizedTarget);
    }
  }

  if (hasDimmedOpacity(node)) {
    tokenizedTarget = wrap_with_opacity(node, tokenizedTarget);
  }

  node.effects.map((d) => {
    const blurEffect = hasBlurType(d);
    if (blurEffect) {
      if (hasLayerBlurType(blurEffect)) {
        tokenizedTarget = wrap_with_layer_blur(node, tokenizedTarget);
      } else if (hasBackgroundBlurType(blurEffect)) {
        tokenizedTarget = wrap_with_background_blur(node, tokenizedTarget);
      }
    }
  });

  if (hasRotation(node)) {
    tokenizedTarget = wrap_with_rotation(node, tokenizedTarget);
  }

  return tokenizedTarget;
}

function handle_by_types(
  node: nodes.ReflectSceneNode,
  config: TokenizerConfig
): Widget {
  let tokenizedTarget: Widget;
  switch (node.type) {
    case nodes.ReflectSceneNodeType.rectangle:
      tokenizedTarget = tokenizeContainer.fromRectangle(node);
      break;

    case nodes.ReflectSceneNodeType.text:
      tokenizedTarget = tokenizeText.fromText(node as nodes.ReflectTextNode);
      break;

    case nodes.ReflectSceneNodeType.frame:
      tokenizedTarget = tokenizeLayout.fromFrame(
        node,
        node.children,
        {
          is_root: node.isRoot,
        },
        config
      );
      break;

    case nodes.ReflectSceneNodeType.vector:
      tokenizedTarget = tokenizeVector.fromVector(node);
      break;

    // case nodes.ReflectSceneNodeType.star:
    //   tokenizedTarget = tokenizeVector.fromStar();
    //   break;

    // case nodes.ReflectSceneNodeType.poligon:
    //   tokenizedTarget = tokenizeVector.fromPoligon();
    //   break;

    case nodes.ReflectSceneNodeType.group:
      tokenizedTarget = tokenizeLayout.fromGroup(
        node,
        node.children,
        undefined,
        config
      );
      break;

    case nodes.ReflectSceneNodeType.ellipse:
      tokenizedTarget = tokenizeContainer.fromEllipse(node);
      break;

    case nodes.ReflectSceneNodeType.boolean_operation:
      tokenizedTarget = tokenizeGraphics.fromBooleanOperation(node);
      break;

    case nodes.ReflectSceneNodeType.line:
      // FIXME: this is a temporary fallback. line should be handled with unique handler. (using rect's handler instead.)
      tokenizedTarget = tokenizeContainer.fromRectangle(node as any);
      break;
    // const _line = node as nodes.ReflectLineNode;
    // tokenizedTarget = tokenizeDivider.fromLine(_line);

    default:
      console.error(`${node["type"]} is not yet handled by "@designto/token"`);
      tokenizedTarget = tokenizeGraphics.fromAnyNode(node); // this is expensive
      tokenizedTarget.key.originName = `Fallbacked to image from - "${tokenizedTarget.key.originName}". this is a bug.`;
      break;
  }
  return tokenizedTarget;
}
