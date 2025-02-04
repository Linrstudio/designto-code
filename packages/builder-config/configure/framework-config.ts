import type { Language } from "@grida/builder-platform-types";
import type { ReactFrameworkConfig } from "../framework-react";
import type { ReactNativeFrameworkConfig } from "../framework-reactnative";
import type { VanillaFrameworkConfig } from "../framework-vanilla";
import type { VanillaPreviewFrameworkConfig } from "../framework-vanilla-preview";

export type FrameworkConfig =
  | ReactFrameworkConfig
  | ReactNativeFrameworkConfig
  | FlutterFrameworkConfig
  | VanillaFrameworkConfig
  | VanillaPreviewFrameworkConfig;

export type { ReactFrameworkConfig };
export type { ReactNativeFrameworkConfig };
export type { VanillaFrameworkConfig };
export type { VanillaPreviewFrameworkConfig };

export interface FlutterFrameworkConfig {
  framework: "flutter";
  language: Language.dart;
}
