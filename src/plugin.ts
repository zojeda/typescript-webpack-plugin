import * as ts from 'typescript';

import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';
import { Compiler, DependencyGraph, SourcesCheckSum, CachedResults, WebpackCompilation, CompilationResult } from './interfaces';
import { compile } from './compiler';
import { ITSPluginOptions } from './plugin.options'
import { calculateSourcesCheckSums, getChangedSourcesAndDepenencies, getFilesGlob } from './utils';


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

    let compilationResult: CompilationResult;


    let allSources = this.getAllSources();

    compiler.plugin("compile", () => {
      logger.info(`starting typescript@${ts.version} commpilation`);
      logger.profile('compilation');
      let allSourceHashes = calculateSourcesCheckSums(allSources);
      let cachedResults = this.readCachedResults();

      let sourcesToCompile = getChangedSourcesAndDepenencies(allSources, allSourceHashes, cachedResults);

      logger.info("starting to compile [%s] files, [%s] cached, reusing program: ", sourcesToCompile.length, allSources.length - sourcesToCompile.length, !!oldProgram);
      compilationResult = compile(sourcesToCompile, this.compilerOptions, oldProgram);
      oldProgram = compilationResult.program;
      cachedResults = this.updateCachedResults(sourcesToCompile, compilationResult.dependencyGraph, allSourceHashes, cachedResults);

      tsDependencyGraph = cachedResults.dependencyGraph;
      logger.profile('compilation');


    });

    compiler.plugin("compilation", (compilation: WebpackCompilation) => {
      if(compilationResult && compilationResult.errors && compilationResult.errors.length > 0) {
        compilation.errors.push(...compilationResult.errors);
        logger.error("compilation fail: ",compilationResult.errors.map(error => error.message));
      }
      compilation.plugin('normal-module-loader', (loaderContext: any) => {
        loaderContext.tsPluginOptions = this.options;
        loaderContext.tsOutputDir = this.tsOutputDir;
        loaderContext.tsDependencyGraph = tsDependencyGraph;
      });

    });

  };

  private getAllSources() {
    const allSources = getFilesGlob(this.options.tsconfig.filesGlob);
    allSources.push(...getFilesGlob(this.options.include));
    const excluded = getFilesGlob(this.options.exclude);
    return allSources.filter(file => excluded.indexOf(file)===-1);
  }


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
      logger.debug('cache is empty');
    }
    return cachedResults;
  }

  private updateCachedResults(sourcesToCompile: string[], dependencyGraph: DependencyGraph, allSourceHashes: SourcesCheckSum, cachedResults: CachedResults) {
    sourcesToCompile.forEach(srcPath => cachedResults.checkSums[srcPath] = allSourceHashes[srcPath]);
    Object.assign(cachedResults.dependencyGraph, dependencyGraph);

    try {
      if (!fs.existsSync(path.dirname(this.cachePath))) {
        fs.mkdirSync(path.dirname(this.cachePath))
      }
      fs.writeFileSync(this.cachePath, JSON.stringify(cachedResults), 'utf-8');
    } catch (error) {
      throw error
    }
    return cachedResults;
  }

}

export = TSPlugin;