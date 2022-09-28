export enum RunMode {
  Scraper = "scraper",
  Normal = "normal",
  Test = "test",
}

export interface ModuleOptions {
  runMode: RunMode;
}

export const MODULE_OPTIONS_TOKEN = "MODULE_OPTIONS_TOKEN";
