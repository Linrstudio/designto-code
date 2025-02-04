import { BlockStatement, ImportDeclaration } from "coli";
import { stringfy } from "@coli.codes/export-string";
import { ReactModuleFile } from "../react-module-file";
import { react as react_config } from "@designto/config";

export abstract class ReactWidgetModuleExportable {
  readonly name: string;
  readonly dependencies: string[];
  readonly body: BlockStatement;
  readonly imports: ImportDeclaration[];

  constructor({
    name,
    body,
    imports,
    dependencies,
  }: {
    name;
    body;
    imports;
    dependencies?: string[];
  }) {
    this.name = name;
    this.body = body;
    this.imports = imports;
    this.dependencies = dependencies;
  }

  abstract asFile({
    exporting,
  }: {
    exporting: react_config.ReactComponentExportingCofnig;
  }): ReactModuleFile;

  finalize(config: react_config.ReactComponentExportingCofnig) {
    const file = this.asFile({ exporting: config });
    const final = stringfy(file.blocks, {
      language: "tsx",
    });
    return {
      code: final,
      name: this.name,
      dependencies: this.dependencies,
    };
  }
}
