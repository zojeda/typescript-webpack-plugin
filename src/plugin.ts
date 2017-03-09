import * as ts from 'typescript';
import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';

import { Compiler, DependencyGraph, SourcesCheckSum, CachedResults } from './interfaces';
import { compile } from './compiler';
import { ITSPluginOptions } from './plugin.options'
import { calculateSourcesCheckSums, getChangedSourcesAndDepenencies } from './utils';


class TSPlugin {
  tsOutputDir: string;
  cachePath: string;
  constructor(private options: ITSPluginOptions) {
    this.options.cacheDir = options.cacheDir || '.typescript-webpack-plugin';
    this.options.tsconfig.compilerOptions.outDir = path.join(this.options.cacheDir, 'build');
    this.tsOutputDir = path.resolve(options.tsconfig.compilerOptions.outDir);
    this.cachePath = path.join(this.options.cacheDir, 'cache.json');
  }
  public apply(compiler: Compiler): void {
    let oldProgram: ts.Program;
    // will be passed to loader in order to add dependencies
    let tsDependencyGraph: DependencyGraph;


    let allSources = this.options.tsconfig.filesGlob
      .map(entry => glob.sync(entry))
      .reduce((a1: string[], a2: string[]) => a1.concat(a2))

    compiler.plugin("compile", () => {

      let allSourceHashes = calculateSourcesCheckSums(allSources);
      let cachedResults = this.readCachedResults();

      let sourcesToCompile = getChangedSourcesAndDepenencies(allSources, allSourceHashes, cachedResults);

      console.log("starting to compile [%s] files, [%s] cached, reusing program: ", sourcesToCompile.length, allSources.length - sourcesToCompile.length, !!oldProgram);
      let startTime = Date.now();
      let { program, dependencyGraph } = compile(sourcesToCompile, this.compilerOptions, oldProgram);
      oldProgram = program;
      cachedResults = this.updateCachedResults(sourcesToCompile, dependencyGraph, allSourceHashes, cachedResults);

      tsDependencyGraph = cachedResults.dependencyGraph;
      console.log("compilation finished: [%s] s.", (Date.now() - startTime) / 1000);


    });

    compiler.plugin("compilation", (compilation: any) => {
      compilation.plugin('normal-module-loader', (loaderContext: any) => {
        loaderContext.tsPluginOptions = this.options;
        loaderContext.tsOutputDir = this.tsOutputDir;
        loaderContext.tsDependencyGraph = tsDependencyGraph;
      });

    });

  };

  private get compilerOptions(): ts.CompilerOptions {
    let { options, errors } = ts.convertCompilerOptionsFromJson(this.options.tsconfig.compilerOptions, '.');
    if (errors && errors.length > 0) throw errors;
    return options;
  }

  private readCachedResults(): CachedResults {
    let cachedResults: CachedResults = { checkSums: {}, dependencyGraph: {} };
    try {
      cachedResults = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
      cachedResults.dependencyGraph = cachedResults.dependencyGraph || {};
    } catch (error) {
      console.log('cache is empty');
    }
    return cachedResults;
  }

  private updateCachedResults(sourcesToCompile: string[], dependencyGraph: DependencyGraph, allSourceHashes: SourcesCheckSum, cachedResults: CachedResults) {
    sourcesToCompile.forEach(srcPath => cachedResults.checkSums[srcPath] = allSourceHashes[srcPath]);
    Object.assign(cachedResults.dependencyGraph, dependencyGraph);

    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(cachedResults), 'utf-8');
    } catch (error) {
      throw error
    }
    return cachedResults;
  }

}

export = TSPlugin;