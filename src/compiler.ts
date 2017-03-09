import * as ts from "typescript";
import * as path from "path";
import 'colors';

import makeResolver = require('./resolver');
import { CompilationResult, DependencyGraph, WebpackError, ResolveSync } from './interfaces';
import { appendTsSuffixIfMatch } from './utils';


export function compile(fileNames: string[], options: ts.CompilerOptions, oldProgram: ts.Program): CompilationResult {
    const dependencyGraph : DependencyGraph = {};
    const errors: WebpackError[] = [];
    const reverseDependencyGraph = {};
    const host = createCompilerHost();


    // make a (sync) resolver that follows webpack's rules
    const resolveSync = makeResolver({resolve: {}});


    let program = ts.createProgram(fileNames, options, host, oldProgram);
    let emitResult = program.emit();    

    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
        let errorLocation : {line: number, character: number} =  {line: null, character: null};
        let rawMessage = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        let errorMessage = rawMessage;
        if (diagnostic.file) {
            errorLocation = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            errorMessage =  `${'('.white}${(errorLocation.line + 1).toString().cyan},${(errorLocation.character + 1).toString().cyan}): ${rawMessage.red}`
            errorMessage = path.normalize(diagnostic.file.fileName).red + errorMessage;

        }
        let fileName = diagnostic.file ? diagnostic.file.fileName : '--------';
        errors.push({
            file: fileName,
            location: errorLocation,
            rawMessage: rawMessage,
            message: errorMessage,
            loaderSource: 'ts-loader'
        })
    });

    return {program, dependencyGraph, errors};



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
            resolveSync: ResolveSync,
            appendTsSuffixTo: RegExp[],
            scriptRegex: RegExp,

            moduleName: string,
            containingFile: string
        ) {

            let resolutionResult: ts.ResolvedModule;

            try {
                let resolvedFileName = resolveSync(undefined, path.normalize(path.dirname(containingFile)), moduleName);
                resolvedFileName = appendTsSuffixIfMatch(appendTsSuffixTo, resolvedFileName);

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


