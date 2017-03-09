import * as ts from "typescript";
import * as path from "path";

import makeResolver = require('./resolver');
import interfaces = require('./interfaces');
import * as utils from './utils';


export function compile(fileNames: string[], options: ts.CompilerOptions, oldProgram: ts.Program): {program: ts.Program, dependencyGraph: interfaces.DependencyGraph} {
    const dependencyGraph : interfaces.DependencyGraph = {}
    const reverseDependencyGraph = {};
    const host = createCompilerHost();


    // make a (sync) resolver that follows webpack's rules
    const resolveSync = makeResolver({resolve: {}});


    let program = ts.createProgram(fileNames, options, host, oldProgram);
    let emitResult = program.emit();    

    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
        let { line, character } =  diagnostic.file ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start): {line: null, character: null};
        let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        let fileName = diagnostic.file ? diagnostic.file.fileName : '--------';
        console.error(`${fileName} (${line},${character}): ${message}`);
    });

    return {program: program, dependencyGraph: dependencyGraph};



    function createCompilerHost(): ts.CompilerHost {
        let compilerHost = ts.createCompilerHost(options)
        compilerHost.resolveModuleNames = resolveModuleNames;

        return compilerHost;

        function resolveModuleNames(moduleNames: string[], containingFile: string): ts.ResolvedModule[] {
            const resolvedModules = moduleNames.map(moduleName =>
                resolveModuleName(resolveSync, [], /\.tsx?$/i,
                    moduleName, containingFile)
            );

            populateDependencyGraphs(resolvedModules, containingFile);

            return resolvedModules;
        }

        function resolveModuleName(
            resolveSync: interfaces.ResolveSync,
            appendTsSuffixTo: RegExp[],
            scriptRegex: RegExp,

            moduleName: string,
            containingFile: string
        ) {

            let resolutionResult: ts.ResolvedModule;

            try {
                let resolvedFileName = resolveSync(undefined, path.normalize(path.dirname(containingFile)), moduleName);
                resolvedFileName = utils.appendTsSuffixIfMatch(appendTsSuffixTo, resolvedFileName);

                if (resolvedFileName.match(scriptRegex)) {
                    resolutionResult = { resolvedFileName };
                }
            } catch (e) { }

            const moduleResolutionHost = {
                fileExists: compilerHost.fileExists,
                readFile: compilerHost.readFile
            };


            const tsResolution = ts.resolveModuleName(moduleName, containingFile, options, moduleResolutionHost);

            if (tsResolution.resolvedModule) {
                let tsResolutionResult: ts.ResolvedModule = {
                    resolvedFileName: path.normalize(tsResolution.resolvedModule.resolvedFileName),
                    isExternalLibraryImport: tsResolution.resolvedModule.isExternalLibraryImport
                };
                if (resolutionResult) {
                    if (resolutionResult.resolvedFileName === tsResolutionResult.resolvedFileName) {
                        resolutionResult.isExternalLibraryImport = tsResolutionResult.isExternalLibraryImport;
                    }
                } else {
                    resolutionResult = tsResolutionResult;
                }
            }
            return resolutionResult;
        }

        function populateDependencyGraphs(resolvedModules: ts.ResolvedModule[],
            containingFile: string
        ) {
            const importedFiles = resolvedModules
                .filter(m => m !== null && m !== undefined)
                .map(m => m.resolvedFileName);

            dependencyGraph[path.normalize(containingFile)] = importedFiles;

            importedFiles.forEach(importedFileName => {
                if (!reverseDependencyGraph[importedFileName]) {
                    reverseDependencyGraph[importedFileName] = {};
                }
                reverseDependencyGraph[importedFileName][path.normalize(containingFile)] = true;
            });
        }

    }

}


