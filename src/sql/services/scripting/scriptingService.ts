/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { ScriptOperation } from 'sql/workbench/common/taskUtilities';
import data = require('data');
import { warn, error } from 'sql/base/common/log';
export const SERVICE_ID = 'scriptingService';

export const IScriptingService = createDecorator<IScriptingService>(SERVICE_ID);

export interface IScriptingService {
	_serviceBrand: any;

	script(connectionUri: string, metadata: data.ObjectMetadata, operation: ScriptOperation, paramDetails: data.ScriptingParamDetails): Thenable<data.ScriptingResult>;

	/**
	 * Register a scripting provider
	 */
	registerProvider(providerId: string, provider: data.ScriptingProvider): void;

	/**
	 * Callback method for when scripting is complete
	 */
	onScriptingComplete(handle: number, scriptingCompleteResult: data.ScriptingCompleteResult): void;

	/**
	 * Returns the result for an operation if the operation failed
	 */
	getOperationFailedResult(operationId: string): data.ScriptingCompleteResult;
}

export class ScriptingService implements IScriptingService {

	public _serviceBrand: any;

	private disposables: IDisposable[] = [];

	private _providers: { [handle: string]: data.ScriptingProvider; } = Object.create(null);

	private failedScriptingOperations: { [operationId: string]: data.ScriptingCompleteResult } = {};
	constructor( @IConnectionManagementService private _connectionService: IConnectionManagementService) { }

	/**
	 * Call the service for scripting based on provider and scripting operation
	 * @param connectionUri
	 * @param metadata
	 * @param operation
	 * @param paramDetails
	 */
	public script(connectionUri: string, metadata: data.ObjectMetadata, operation: ScriptOperation, paramDetails: data.ScriptingParamDetails): Thenable<data.ScriptingResult> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);

		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.scriptAsOperation(connectionUri, operation, metadata, paramDetails)
			}
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Callback method for when scripting is complete
	 * @param handle
	 * @param scriptingCompleteResult
	 */
	public onScriptingComplete(handle: number, scriptingCompleteResult: data.ScriptingCompleteResult): void {
		if (scriptingCompleteResult && scriptingCompleteResult.hasError && scriptingCompleteResult.errorMessage) {
			error(`Scripting failed. error: ${scriptingCompleteResult.errorMessage}`);
			if (scriptingCompleteResult.operationId) {
				this.failedScriptingOperations[scriptingCompleteResult.operationId] = scriptingCompleteResult;
			}
		}
	}

	/**
	 * Returns the result for an operation if the operation failed
	 * @param operationId Operation Id
	 */
	public getOperationFailedResult(operationId: string): data.ScriptingCompleteResult {
		if (operationId && operationId in this.failedScriptingOperations) {
			return this.failedScriptingOperations[operationId];
		} else {
			return undefined;
		}
	}

	/**
	 * Register a scripting provider
	 */
	public registerProvider(providerId: string, provider: data.ScriptingProvider): void {
		this._providers[providerId] = provider;
	}

	public dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}
