export interface Module extends File {
  _type: "module";
  language: "ts" | "tsx" | "js" | "jsx" | "vue" | "dart" | "svelte";

  /**
   * list of exporting member identifiers
   */
  exports: string[];
}
