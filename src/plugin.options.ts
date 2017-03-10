import * as ts from 'typescript';

export interface ITSPluginOptions {
  tsconfig: { filesGlob: string[], compilerOptions: ts.CompilerOptions },
  transpileOnly: boolean;
  cacheDir?: string;
  include?: string[];
  exclude?: string[];
}