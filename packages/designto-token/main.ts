import { nodes } from "@design-sdk/core";
import { Expanded, Widget } from "@reflect-ui/core";
import type { Blurred, Opacity, Rotation } from "@reflect-ui/core";
import type { Stretched } from "./tokens";
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
  hasFlexible,
} from "./detection";
import { MaskingItemContainingNode, tokenizeMasking } from "./token-masking";
import { wrap_with_opacity } from "./token-opacity";
import { wrap_with_stretched } from "./token-stretch";
import { wrap_with_layer_blur } from "./token-effect/layer-blur";
import { wrap_with_background_blur } from "./token-effect/background-blur";
import { wrap_with_rotation } from "./token-rotation";
import { wrap_with_expanded } from "./token-expanded";
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

  let tokenizedTarget: Widget = null;

  // flags handler
  if (!tokenizedTarget) {
    if (
      !config.disable_flags_support &&
      config.should_ignore_flag?.(node) !== true
    ) {
      try {
        tokenizedTarget = flags_handling_gate(node);
      } catch (e) {
        console.error("error while interpreting flags.. skipping", e);
      }
    }
  }

  // -------------------------------------------------------------------------
  // --------------------------- Detected tokens -----------------------------
  // -------------------------------------------------------------------------

  // - image - // image detection is always enabled exceptionally.
  // TODO: separate image detection with static logic based and the smart one.
  if (!tokenizedTarget) {
    const _detect_if_image = detectIf.image(node);
    if (_detect_if_image.result) {
      return tokenizeGraphics.fromImage(node, _detect_if_image.data);
    }
  }

  if (!tokenizedTarget) {
    if (config.disable_detection) {
      // skip detection
    } else {
      // TODO: only execute detection if all the nested children is not flagged as other component.

      // - icon -
      const _detect_if_icon = detectIf.icon(node);
      if (_detect_if_icon.result) {
        return tokenizeGraphics.fromIcon(node, _detect_if_icon.data);
      }

      // - button -
      // TODO: this causes confliction with flags
      // const _detect_if_button = detectIf.button(node);
      // if (_detect_if_button.result) {
      //   return tokenizeButton.fromManifest(node, _detect_if_button.data);
      // }
    }
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

  // masking handler
  if (containsMasking(node)) {
    tokenizedTarget = tokenizeMasking.fromMultichild(
      node as MaskingItemContainingNode,
      config
    );
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

export function post_wrap(
  node: nodes.ReflectSceneNode,
  tokenizedTarget: Widget
): Widget | Stretched | Opacity | Blurred | Rotation | Expanded {
  let wrapped = tokenizedTarget;

  if (hasStretching(node)) {
    wrapped = wrap_with_stretched(node, wrapped);
  }

  if (hasFlexible(node)) {
    wrapped = wrap_with_expanded(node, wrapped);
  }

  if (hasDimmedOpacity(node)) {
    wrapped = wrap_with_opacity(node, wrapped);
  }

  node.effects.map((d) => {
    const blurEffect = hasBlurType(d);
    if (blurEffect) {
      if (hasLayerBlurType(blurEffect)) {
        wrapped = wrap_with_layer_blur(node, wrapped);
      } else if (hasBackgroundBlurType(blurEffect)) {
        wrapped = wrap_with_background_blur(node, wrapped);
      }
    }
  });

  if (hasRotation(node)) {
    wrapped = wrap_with_rotation(node, wrapped);
  }

  return wrapped;
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
      // FIXME: aberation handling (remove me if required) --------------------------------
      // FIXME: this is for giving extra space for text so it won't break line accidently.
      // FIXME: consider applying this only to a preview build
      // TODO: change logic to word count.
      const wordcount = node.data.split(" ").length;
      const txtlen = node.data.length;
      if (wordcount <= 1) {
        /* skip, since there is no word break */
      } else if (txtlen <= 6 && wordcount <= 2) {
        node.width = node.width + 1;
      } else if (txtlen < 30) {
        node.width = node.width + 2;
      }
      // FIXME: ---------------------------------------------------------------------------------

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
      if (node.arcData.startingAngle === 0 && node.arcData.innerRadius === 0) {
        // a standard ellipse
        tokenizedTarget = tokenizeContainer.fromEllipse(node);
      } else {
        // a customized ellipse, most likely to be part of a graphical element.
        tokenizedTarget = tokenizeGraphics.fromIrregularEllipse(node);
      }
      break;

    case nodes.ReflectSceneNodeType.boolean_operation:
      tokenizedTarget = tokenizeGraphics.fromBooleanOperation(node);
      break;

    case nodes.ReflectSceneNodeType.line:
      tokenizedTarget = tokenizeContainer.fromLine(node as any);
      // tokenizedTarget = tokenizeDivider.fromLine(_line);
      break;

    default:
      console.error(`${node["type"]} is not yet handled by "@designto/token"`);
      tokenizedTarget = tokenizeGraphics.fromAnyNode(node); // this is expensive
      tokenizedTarget.key.originName = `Fallbacked to image from - "${tokenizedTarget.key.originName}". this is a bug.`;
      break;
  }
  return tokenizedTarget;
}
