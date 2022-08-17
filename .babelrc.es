{
  "ignore": ["node_modules/**/*"],
  "presets": [
    [
      "@babel/preset-env",
      {
        "modules": false,
        "useBuiltIns": "usage",
        "corejs": {"version": 3}
      }
    ],
    "@babel/preset-typescript",
    "@babel/preset-react"
  ],
  "plugins": [
    "babel-plugin-add-import-extension",
    [
      "@babel/plugin-proposal-decorators",
      {
        "legacy": true
      }
    ],
    "@babel/proposal-class-properties",
    "@babel/proposal-object-rest-spread"
  ],
  "sourceMaps": "inline"
}
