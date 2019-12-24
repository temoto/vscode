/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * This code is also used by standalone cli's. Avoid adding dependencies to keep the size of the cli small.
 */
import * as paths from 'vs/base/common/path';
import * as fs from 'fs';
import * as os from 'os';
import { resolveTerminalEncoding } from 'vs/base/node/encoding';

export function hasStdinWithoutTty() {
	try {
		return !process.stdin.isTTY; // Via https://twitter.com/MylesBorins/status/782009479382626304
	} catch (error) {
		// Windows workaround for https://github.com/nodejs/node/issues/11656
	}
	return false;
}

export function warnInvalidStdinUsage(applicationName: string): Promise<void> {
	return new Promise(c => {
		const dataListener = () => {
			if (os.platform() === 'win32') {
				console.log(`Run with '${applicationName} -' to read output from another program (e.g. 'echo Hello World | ${applicationName} -').`);
			} else {
				console.log(`Run with '${applicationName} -' to read from stdin (e.g. 'ps aux | grep code | ${applicationName} -').`);
			}

			c(undefined);
		};

		// wait for 1s maximum...
		setTimeout(() => {
			process.stdin.removeListener('data', dataListener);

			c(undefined);
		}, 1000);

		// ...but finish early if we detect data
		process.stdin.once('data', dataListener);
	});
}


export function readFromStdin(verbose: boolean): string | undefined {

	// prepare temp file to read stdin to
	let stdinFilePath = paths.join(os.tmpdir(), `code-stdin-${Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 3)}.txt`);

	// open tmp file for writing
	let stdinFileError: Error | undefined;
	let stdinFileStream: fs.WriteStream;
	try {
		stdinFileStream = fs.createWriteStream(stdinFilePath);
	} catch (error) {
		stdinFileError = error;
	}

	if (!stdinFileError) {

		// Pipe into tmp file using terminals encoding
		resolveTerminalEncoding(verbose).then(async encoding => {
			const iconv = await import('iconv-lite');
			const converterStream = iconv.decodeStream(encoding);
			process.stdin.pipe(converterStream).pipe(stdinFileStream);
		});

		return stdinFilePath;
	}
	return undefined;

}
