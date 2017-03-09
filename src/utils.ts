import * as fs from 'fs';
import * as path from 'path';
import {DependencyGraph, SourcesCheckSum, CachedResults} from './interfaces';

export function appendTsSuffixIfMatch(patterns: RegExp[], path: string): string {
    if (patterns.length > 0) {
        for (let regexp of patterns) {
            if (path.match(regexp)) {
                return path + '.ts';
            }
        }
    }
    return path;
}


/**
 * Recursively collect all possible dependencies of passed file
 */
export function collectAllDependencies(
    dependencyGraph: DependencyGraph,
    filePath: string,
    collected: {[file:string]: boolean} = {}
): string[] {
    filePath = path.resolve(filePath);
    const result = {};
    result[filePath] = true;
    collected[filePath] = true;
    let directDependencies = dependencyGraph[filePath];
    if (directDependencies) {
        directDependencies.forEach(dependencyFilePath => {
            if (!collected[dependencyFilePath]) {
                collectAllDependencies(dependencyGraph, dependencyFilePath, collected)
                    .forEach(filePath => result[filePath] = true);
            }
        });
    }
    return Object.keys(result);
}

function stringHash(content: string): number {
  var hash = 0;
  if (content.length == 0) return hash;
  for (let i = 0; i < content.length; i++) {
    let char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;

}

export function getChangedSourcesAndDepenencies(allSources: string[], allSourceHashes: SourcesCheckSum, cachedResults: CachedResults): string[] {
  let sources = allSources.filter((srcPath: string) => allSourceHashes[srcPath] !== cachedResults.checkSums[srcPath])

  if (sources.length > 0) {
    //adding dependencies
    const additionalDependencies = sources.map(srcFile => collectAllDependencies(cachedResults.dependencyGraph, srcFile))
      .reduce((a1, a2) => a1.concat(a2), [])
    sources.push(...additionalDependencies);
    sources = sources.filter(srcPath => !!srcPath);
    sources.push(...allSources.filter(srcPath => srcPath.endsWith('.d.ts')));
  }
  return sources.filter(srcFile => srcFile.endsWith('ts')).filter((srcFile, index, arr) => arr.indexOf(srcFile) === index);
}

export function calculateSourcesCheckSums(allSources: string[]): SourcesCheckSum {
  return allSources
        .map((srcFile) => fs.readFileSync(srcFile, 'utf-8'))
        .map(value => value.toString())
        .map((content, index) => {
          let entry: {[srcFile: string]: number} = {};
          entry[allSources[index]] = stringHash(content);
          return entry
        }).reduce((entry1, entry2) => Object.assign(entry1, entry2));
}