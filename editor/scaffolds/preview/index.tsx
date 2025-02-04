import React, { useEffect, useState } from "react";
import { preview_presets } from "@grida/builder-config-preset";
import { designToCode, Result } from "@designto/code";
import { config } from "@designto/config";
import { MainImageRepository } from "@design-sdk/core/assets-repository";
import type { ReflectSceneNode } from "@design-sdk/figma-node";
import { VanillaRunner } from "components/app-runner/vanilla-app-runner";
import { colorFromFills } from "@design-sdk/core/utils/colors";
import type { FrameOptimizationFactors } from "@code-editor/canvas/frame";
import { remote } from "@design-sdk/figma";

const DEV_ONLY_FIGMA_PAT =
  process.env.NEXT_PUBLIC_DEVELOPER_FIGMA_PERSONAL_ACCESS_TOKEN;

const placeholderimg =
  "https://bridged-service-static.s3.us-west-1.amazonaws.com/placeholder-images/image-placeholder-bw-tile-100.png";

const build_config: config.BuildConfiguration = {
  ...config.default_build_configuration,
  disable_components: true,
  disable_detection: true,
  disable_flags_support: true,
};

const framework_config: config.VanillaPreviewFrameworkConfig = {
  ...preview_presets.default,
  additional_css_declaration: {
    declarations: [
      {
        key: {
          name: "body",
          selector: "tag",
        },
        style: {
          contain: "layout style paint",
        },
      },
    ],
  },
};

type TResultCache = Result & { __image: boolean };
const cache = {
  set: (key: string, value: TResultCache) => {
    sessionStorage.setItem(key, JSON.stringify(value));
  },
  get: (key: string): TResultCache => {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
};

export function Preview({
  target,
  isZooming,
  isPanning,
}: {
  target: ReflectSceneNode & {
    filekey: string;
  };
} & FrameOptimizationFactors) {
  const [preview, setPreview] = useState<Result>();
  const key = target
    ? `${target.filekey}-${target.id}-${new Date().getMinutes()}`
    : null;

  const on_preview_result = (result: Result, __image: boolean) => {
    if (preview) {
      if (preview.code === result.code) {
        return;
      }
    }
    setPreview(result);
    cache.set(target.filekey, { ...result, __image });
  };

  const hide_preview = isZooming || isPanning;

  useEffect(() => {
    if (hide_preview) {
      // don't make preview if zooming.
      return;
    }

    if (preview) {
      return;
    }

    const d2c_firstload = () => {
      return designToCode({
        input: _input,
        build_config: build_config,
        framework: framework_config,
        asset_config: {
          skip_asset_replacement: false,
          asset_repository: MainImageRepository.instance,
          custom_asset_replacement: {
            type: "static",
            resource: placeholderimg,
          },
        },
      });
    };

    const d2c_imageload = () => {
      if (!MainImageRepository.instance.empty) {
        designToCode({
          input: _input,
          build_config: build_config,
          framework: framework_config,
          asset_config: { asset_repository: MainImageRepository.instance },
        })
          .then((r) => {
            on_preview_result(r, true);
          })
          .catch((e) => {
            console.error(
              "error while making preview with image repo provided.",
              e
            );
          });
      }
    };

    const _input = target
      ? {
          id: target.id,
          name: target.name,
          entry: target,
        }
      : null;

    const cached = cache.get(key);
    if (cached) {
      setPreview(cached);
      if (cached.__image) {
        return;
      }
      if (_input) {
        d2c_imageload();
      }
    } else {
      if (_input) {
        d2c_firstload()
          .then((r) => {
            on_preview_result(r, false);
            // if the result contains a image and needs to be fetched,
            if (r.code.raw.includes(placeholderimg)) {
              // TODO: we don't yet have other way to know if image is used, other than checking if placeholder image is used. - this needs to be updated in d2c module to include used images meta in the result.
              d2c_imageload();
            }
          })
          .catch(console.error);
      }
    }
  }, [target?.id, isZooming, isPanning]);

  const __bg = colorFromFills(target.fills);
  const bg_color_str = __bg ? "#" + __bg.hex : "transparent";

  return (
    <div
      style={{
        width: target.width,
        height: target.height,
        borderRadius: 1,
        backgroundColor: !preview && bg_color_str, // clear bg after preview is rendered.
        contain: "layout style paint",
      }}
    >
      {preview && (
        <VanillaRunner
          key={preview.scaffold.raw}
          style={{
            borderRadius: 1,
            contain: "layout style paint",
          }}
          source={preview.scaffold.raw}
          width="100%"
          height="100%"
          componentName={preview.name}
        />
      )}
    </div>
  );
}

function FigmaFrameImageView({
  filekey,
  nodeid,
  zoom,
}: {
  filekey: string;
  nodeid: string;
  zoom: number;
}) {
  // fetch image
  const [image_1, setImage_1] = useState<string>();
  const [image_s, setImage_s] = useState<string>();

  useEffect(() => {
    // fetch image from figma
    // fetch smaller one first, then fatch the full scaled.
    remote
      .fetchNodeAsImage(
        filekey,
        { personalAccessToken: DEV_ONLY_FIGMA_PAT },
        nodeid
        // scale = 1
      )
      .then((r) => {
        console.log("fetched image from figma", r);
        setImage_1(r.__default);
        setImage_s(r.__default);
      });
  }, [filekey, nodeid]);

  let imgscale: 1 | 0.2 = 1;
  if (zoom > 1) {
    return null;
  } else if (zoom <= 1 && zoom > 0.3) {
    imgscale = 1;
    // display 1 scaled image
  } else {
    // display 0.2 scaled image
    imgscale = 0.2;
  }

  return (
    <div
      style={{
        top: 0,
        left: 0,
        position: "fixed",
        width: "100%",
        height: "100%",
      }}
    >
      <img
        style={{
          width: "100%",
          height: "100%",
          objectFit: "fill",
          border: 0,
        }}
        src={imgscale === 1 ? image_1 : image_s}
        alt=""
      />
    </div>
  );
}
