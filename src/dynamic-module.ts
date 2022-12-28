export enum RunMode {
  Scraper = "scraper",
  Normal = "normal",
  Test = "test",
}

export interface ModuleOptions {
  runModes: RunMode[];
}
