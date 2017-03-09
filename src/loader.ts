import * as fs from 'fs';
import * as path from 'path';
import {SourceMap} from './interfaces';
import loaderUtils = require('loader-utils');

function tsloader(contents: string): any {
    var callback = this.async();
    var tsOutputDir = this.tsOutputDir;
    var resourcePath = this.resourcePath;
    var outputRelative = path.relative(process.cwd(), resourcePath);
    let jsFilePath = path.join(tsOutputDir, outputRelative).replace('.ts', '.js');
    let sourceMapFilePath = path.join(tsOutputDir, outputRelative).replace('.ts', '.js.map');
    let loader = this;
    this.clearDependencies();
    this.addDependency(resourcePath);

    const dependencies = this.tsDependencyGraph[resourcePath];
    if (dependencies) {
        const addDependency = this.addDependency.bind(this);
        dependencies.forEach(addDependency);
    } 



    if (!callback) return readFilesSync();


    try {
        const { sourceMap, output } = readFilesSync()
        callback(null, output, sourceMap);
    } catch(error) {
        callback(error);
    }

    function readFilesSync() {
        let outputText = fs.readFileSync(jsFilePath, 'utf-8');
        let sourceMapText = fs.existsSync(sourceMapFilePath) ? fs.readFileSync(sourceMapFilePath, 'utf-8') : undefined;

        const filePath = path.normalize(resourcePath);
        let result = makeSourceMap(sourceMapText, outputText, filePath, contents);
        return result;
    }

    function makeSourceMap(
        sourceMapText: string,
        outputText: string,
        filePath: string,
        contents: string
    ) {
        if (!sourceMapText) {
            return { output: outputText, sourceMap: undefined as SourceMap };
        }

        return {
            output: outputText.replace(/^\/\/# sourceMappingURL=[^\r\n]*/gm, ''),
            sourceMap: Object.assign(JSON.parse(sourceMapText), {
                sources: [loaderUtils.getRemainingRequest(loader)],
                file: filePath,
                sourcesContent: [contents]
            })
        };
    }
}



export = tsloader;