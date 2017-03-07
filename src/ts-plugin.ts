import * as ts from 'typescript';
import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs';

import { Compiler } from './interfaces';
import { compile } from './compiler';
import { ITSPluginOptions } from './plugin.options'

class TSPlugin {
  tsOutputDir : string;
  cachePath : string;
  constructor(private options: ITSPluginOptions) {
    this.options.cacheDir = options.cacheDir || '.typescript-webpack-plugin';
    this.options.tsconfig.compilerOptions.outDir = path.join(this.options.cacheDir, 'build');
    this.tsOutputDir = path.resolve(options.tsconfig.compilerOptions.outDir);
    this.cachePath = path.join(this.options.cacheDir, 'cache.json');
  }
  public apply(compiler: Compiler): void {
    let allSources = this.options.tsconfig.filesGlob
      .map(entry => glob.sync(entry))
      .reduce((a1: string[], a2: string[]) => a1.concat(a2))
    

    let compilerOptionsConversion = ts.convertCompilerOptionsFromJson(this.options.tsconfig.compilerOptions, '.');
    compiler.plugin("compile", () => {
      console.log("hashes calculation", allSources.length);
      let allSourceHashes : {[sourcePath: string]: number} = allSources
            .map((srcFile) =>  fs.readFileSync(srcFile, 'utf-8'))
            .map(value => value.toString())
            .map((content, index) => {
              let entry = {};
              entry[allSources[index]] = stringHash(content);
              return entry
            }).reduce((entry1, entry2) => Object.assign(entry1, entry2));

      let cachedResults: {[sourcePath: string]: number} = {};
      try {
        cachedResults = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
      } catch (error) {
        console.log('cache is empty');
      }
      let sources = allSources.filter((srcPath: string) => allSourceHashes[srcPath] !== cachedResults[srcPath])

      
      console.log("hashes done");

      console.log("The compiler is starting to compile [%s] files, [%s] cached", sources.length, allSources.length - sources.length);
      compile(sources, compilerOptionsConversion.options);
      sources.forEach(srcPath => cachedResults[srcPath] = allSourceHashes[srcPath]);
      try {
        fs.writeFileSync(this.cachePath, JSON.stringify(cachedResults), 'utf-8');
      } catch (error) {
        throw error
      }
      
      console.log("compilation finished");
    });

    compiler.plugin("compilation", (compilation: any) => {
      console.log("The compiler is starting a new compilation...");
      compilation.plugin('normal-module-loader', (loaderContext: any) => {
        loaderContext.tsPluginOptions = this.options;
        loaderContext.tsOutputDir = this.tsOutputDir;
      });

    });

    compiler.plugin("emit", function (compilation: any, callback: any) {
      compilation;
      console.log("The compilation is going to emit files...");
      callback();
    });
  };

}

function stringHash(content: string): number {
	var hash = 0;
	if (content.length == 0) return hash;
	for (let i = 0; i < content.length; i++) {
		let char = content.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;

}
export = TSPlugin;