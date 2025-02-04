import {
  Html5IdentifierNames,
  Identifier,
  PropertyAccessExpression,
  TaggedTemplateExpression,
  TemplateLiteral,
  VariableDeclaration,
} from "coli";
import { StylableJSXElementConfig, WidgetWithStyle } from "@web-builder/core";
import { SyntaxKind } from "@coli.codes/core-syntax-kind";
import {
  nameVariable,
  NameCases,
  ScopedVariableNamer,
} from "@coli.codes/naming";
import { CSSProperties, buildCSSStyleData } from "@coli.codes/css";
import { handle } from "@coli.codes/builder";
import { formatStyledTempplateString } from "./formatter";

export class StyledComponentDeclaration extends VariableDeclaration {
  static styledIdentifier = new Identifier("styled");

  styledAccessorIdentifier: Html5IdentifierNames;
  constructor(
    readonly name: string,
    params: {
      style: CSSProperties;
      identifier: Html5IdentifierNames;
    }
  ) {
    super(name, {
      initializer: StyledComponentDeclaration.makeinitializer(
        params.style,
        params.identifier
      ),
      kind: SyntaxKind.ConstKeyword,
    });

    this.styledAccessorIdentifier = params.identifier;
  }

  static makeinitializer(
    style: CSSProperties,
    html5tag: Html5IdentifierNames
  ): TaggedTemplateExpression {
    const { main, pseudo } = buildCSSStyleData(style);

    const pseudos = Object.keys(pseudo).map((k) => {
      const b = pseudo[k];
      const lines = b.split("\n").filter((l) => l.length > 0);
      return `${k} {${
        lines.length ? ["", ...lines].join("\n\t") + "\n" : ""
      }}\n`;
    });

    const body = [main, ...pseudos].join("\n");

    const _fmted_body = formatStyledTempplateString(body);
    return new TaggedTemplateExpression(
      new PropertyAccessExpression(
        StyledComponentDeclaration.styledIdentifier,
        html5tag
      ),
      {
        template: new TemplateLiteral(`\n${_fmted_body}\n`),
      }
    );
  }
}

/**
 * component variable declration naming preference
 */
export interface NamePreference {
  namer: ScopedVariableNamer;
  overrideKeyName?: string;
  overrideFinalName?: string;
}

export function composeStyledComponentVariableDeclaration(
  widgetConfig: WidgetWithStyle,
  preferences: {
    name?: NamePreference;
  }
): StyledComponentDeclaration {
  const jsxconfg = widgetConfig.jsxConfig() as StylableJSXElementConfig;

  /// region name
  let varname: string;
  const namePref = preferences.name;
  if (namePref.overrideFinalName) {
    varname = namePref.overrideFinalName;
  } else if (namePref.overrideKeyName) {
    varname = nameVariable(namePref.overrideKeyName, {
      case: NameCases.pascal,
    }).name;
  } else {
    varname = namePref.namer.nameit(widgetConfig.key.name, {
      case: NameCases.pascal,
    }).name;
  }
  ///

  const style_data = widgetConfig.finalStyle;
  /**
   * if the style is null, it means don't make element as a styled component at all. if style is a empty object, it means to make a empty styled component.
   */
  const should_be_styled = style_data !== null;
  if (should_be_styled) {
    return new StyledComponentDeclaration(varname, {
      style: style_data,
      identifier: handle(jsxconfg.tag).name as Html5IdentifierNames,
    });
  }
}
