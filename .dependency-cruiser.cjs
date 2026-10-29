module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "core-is-pure",
      severity: "error",
      from: { path: "^packages/game-core/src/" },
      to: { pathNot: "^packages/game-core/src/" },
    },
    {
      name: "runtime-only-core-and-planck",
      severity: "error",
      from: { path: "^packages/game-runtime/src/" },
      to: {
        pathNot:
          "^(packages/game-runtime/src/|packages/game-core/src/|node_modules/)",
      },
    },
    {
      name: "shared-must-not-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "runtime-no-client",
      severity: "error",
      from: { path: "^packages/game-runtime/" },
      to: { path: "^packages/(game-client|host-web)/" },
    },
    {
      name: "runtime-external-dependencies",
      severity: "error",
      from: { path: "^packages/game-runtime/src/" },
      to: { path: "^node_modules/", pathNot: "/planck/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    exclude: "(\\.test\\.ts$|/dist/)",
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "default", "types"],
    },
  },
};
