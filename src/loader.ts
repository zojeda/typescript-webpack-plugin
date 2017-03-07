import * as fs from 'fs';
import * as path from 'path';

// import { ITSPluginOptions } from './plugin.options'

function tsloader(content: string): any {
    var callback = this.async();
    if (!callback) return someSyncOperation(content);
    var tsOutputDir = this.tsOutputDir;
    // var tsPluginOptions : ITSPluginOptions = this.tsPluginOptions;
    var resourcePath = this.resourcePath;
    var outputRelative = path.relative(process.cwd(), resourcePath);
    let generatedFilePath = path.join(tsOutputDir, outputRelative).replace('.ts', '.js');
    
    someAsyncOperation(content, function (err, result) {
        if (err) return callback(err);
        callback(null, result);
    });


    function someAsyncOperation(content: string, callback: (err: Error, data: any) => any) {
        fs.readFile(generatedFilePath, 'utf-8', callback);
        content;
    }

    function someSyncOperation(content: string) {
        content;
        return fs.readFileSync(generatedFilePath, 'utf-8');
    }
}


export = tsloader;