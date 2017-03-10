# Typescript webpack plugin

A webpack plugin used to compile typescript projects.

Here we use typecript compiler instead of language service, in order to speed up the starting process, so all the files speciefied in file glob are compiled in bulk.

A naive file change detection was implemented in order to compile only changed files (and dependencies) on every run, other compiled files are stored in a cache directory.


## Plugin options
```javascript
{
  tsconfig: { filesGlob: string[], compilerOptions: ts.CompilerOptions },
  transpileOnly?: boolean; //not implemented yet
  cacheDir?: string;
  include?: string[];
  exclude?: string[];
}
```

## Sample configuration
```javascript
var TSPlugin = require('typescript-webpack-plugin');
config = {
    module: {
    ...
    loaders: [
        {
            test: /\.ts$/,
            loader: ['typescript-webpack-plugin/dist/loader'],
            exclude: /(node_modules|dist)/
        }
    ...
    },
    plugins = [
    ...
      new TSPlugin({tsconfig: require('./tsconfig.json')})
    ...

    )
    ...
}
```

A lot of code is from [ts-loader](https://github.com/TypeStrong/ts-loader), here I'm trying to learn from it and make the start up of the application faster.

