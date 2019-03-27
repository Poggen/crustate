import babel    from "rollup-plugin-babel";
import gzip     from "rollup-plugin-gzip";
import resolve  from "rollup-plugin-node-resolve";
import compiler from '@ampproject/rollup-plugin-closure-compiler';

const isProduction = process.env.NODE_ENV === "production";
const compilerPlugin = compiler({
  compilation_level:       "ADVANCED",
  assume_function_wrapper: true,
  formatting:              isProduction ? "PRINT_INPUT_DELIMITER" : "PRETTY_PRINT",
  warning_level:           "VERBOSE",
  language_out:            "ECMASCRIPT_2015",
  externs:                 "src/externs.js",
  debug:                   !isProduction,
});
const babelPlugin = babel({
  babelrc:         false,
  externalHelpers: false,
  runtimeHelpers:  true,
  "presets": [
    ["@babel/preset-env", {
      "loose":            true,
      "shippedProposals": true,
      "targets": {
        "node":    8,
        "firefox": 50,
        "ie":      11,
      },
      "exclude": [ "transform-typeof-symbol" ]
    }],
    ["@babel/preset-flow"],
    ["@babel/preset-react"],
  ]
});

export default [
  { input: "src/index.js", output: "dist/index.js" },
  { input: "react/src/index.js", output: "react/dist/index.js" },
].map(({ input, output }) => ({
  input,
  output: [
    {
      file:      output,
      sourcemap: true,
      format:    "es",
    },
  ],
  plugins: [
    babelPlugin,
    resolve({
      module:      true,
      jsnext:      true,
      modulesOnly: true,
    }),
    compilerPlugin,
    isProduction ? gzip({ level: 9 }) : null,
  ],
  external: ["react", "react-dom"],
}));