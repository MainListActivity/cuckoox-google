import {
    SurrealWasmEngine as Swe,
} from "@cuckoox/surrealdb-wasm";

import {
    ConnectionStatus,
    ConnectionUnavailable,
    UnexpectedConnectionError,
    type EngineEvents,
    type RpcRequest,
    type RpcResponse,
    SurrealEngine,
    ExportOptions,
    ConnectionState,
    type DriverContext,
} from "surrealdb";

/**
 * Create engines for SurrealDB WASM implementation
 * @returns Record of engine implementations
 */
export function surrealdbWasmEngines(): Record<string, new (context: DriverContext) => SurrealEngine> {
    return {
        mem: WasmEmbeddedEngine,
        indxdb: WasmEmbeddedEngine,
    };
}

let incrementalId = 0;

function getIncrementalID(): number {
    return ++incrementalId;
}

/**
 * Construct the engines for the SurrealDB WASM implementation. This
 * includes support for `mem` and `indxdb` protocols.
 */
export class WasmEmbeddedEngine implements SurrealEngine {
    #context: DriverContext;
    #ready: Promise<void> | undefined = undefined;
    #reader?: Promise<void>;
    #status: ConnectionStatus = "disconnected";
    #queue: (() => Promise<unknown>)[] = [];
    #processing = false;
    #db?: Swe;
    #connection: {
        url?: URL;
        namespace?: string;
        database?: string;
        accessToken?: string;
        refreshToken?: string;
    } = {};
    #listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

    constructor(context: DriverContext) {
        this.#context = context;
    }

    async version(): Promise<string> {
        return Swe.version();
    }

    subscribe<K extends keyof EngineEvents>(event: K, listener: (...payload: EngineEvents[K]) => void): () => void {
        const eventStr = event as string;
        if (!this.#listeners.has(eventStr)) {
            this.#listeners.set(eventStr, new Set());
        }
        this.#listeners.get(eventStr)!.add(listener);
        
        return () => {
            const listeners = this.#listeners.get(eventStr);
            if (listeners) {
                listeners.delete(listener);
                if (listeners.size === 0) {
                    this.#listeners.delete(eventStr);
                }
            }
        };
    }

    private emit<K extends keyof EngineEvents>(event: K, ...args: EngineEvents[K]): void {
        const listeners = this.#listeners.get(event as string);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(...args);
                } catch (error) {
                    console.error('Event listener error:', error);
                }
            }
        }
    }

    private setStatus<T extends ConnectionStatus>(
        status: T,
        ...args: EngineEvents[T]
    ) {
        this.#status = status;
        this.emit(status, ...args);
    }

    open(state: ConnectionState): void {
        this.#connection.url = state.url;
        this.#connection.namespace = state.namespace;
        this.#connection.database = state.database;
        this.#connection.accessToken = state.accessToken;
        this.#connection.refreshToken = state.refreshToken;
        
        this.setStatus("connecting");

        const ready = (async () => {
            try {
                const db = await Swe.connect(state.url.toString()).catch(
                    (e) => {
                        console.log(e);
                        const error = new UnexpectedConnectionError(
                            typeof e === "string"
                                ? e
                                : "error" in e
                                    ? (e as any).error
                                    : "An unexpected error occurred",
                        );
                        this.setStatus("disconnected");
                        throw e;
                    },
                );

                this.#db = db;
                this.setStatus("connected");

                this.#reader = (async () => {
                    try {
                        const reader = db.notifications().getReader();
                        while (this.connected) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const raw = value as Uint8Array;
                            const decoded = this.#context.decode(new Uint8Array(raw.buffer)) as any;
                            const { id, action, result } = decoded;
                            if (id) {
                                this.emit(
                                    `live-${id.toString()}` as any,
                                    action, result
                                );
                            }
                        }
                    } catch (error) {
                        console.error('Notification reader error:', error);
                    }
                })();
            } catch (error) {
                console.error('Connection failed:', error);
                throw error;
            }
        })();

        this.#ready = ready;
    }

    async close(): Promise<void> {
        this.#connection = {
            url: undefined,
            namespace: undefined,
            database: undefined,
            accessToken: undefined,
            refreshToken: undefined,
        };

        await this.#ready;
        this.#ready = undefined;
        this.#db?.free();
        this.#db = undefined;
        await this.#reader;
        this.#reader = undefined;

        if (this.#status !== "disconnected") {
            this.setStatus("disconnected");
        }
    }

    async send<
        Method extends string,
        Params extends unknown[] | undefined,
        Result,
    >(request: RpcRequest<Method, Params>): Promise<RpcResponse<Result>> {
        await this.#ready;
        if (!this.#db) throw new ConnectionUnavailable();

        return new Promise((resolve, reject) => {
            this.#queue.push(async () => {
                try {
                    const result = await this.execute(request);
                    resolve(result as RpcResponse<Result>);
                } catch (error) {
                    reject(error);
                }
            });

            this.processQueue();
        });
    }

    get connected() {
        return !!this.#db;
    }

    private async processQueue() {
        if (this.#processing) {
            return;
        }

        this.#processing = true;

        while (this.#queue.length > 0) {
            const task = this.#queue.shift();

            if (task) {
                try {
                    await task();
                } catch (error) {
                    console.error('Query execution failed', error);
                }
            }
        }

        this.#processing = false;
    }

    private async execute<
        Method extends string,
        Params extends unknown[] | undefined,
        Result,
    >(request: RpcRequest<Method, Params>): Promise<RpcResponse<Result>> {
        const id = getIncrementalID();
        const encoded = this.#context.encode({ id, ...request });
        
        const res: RpcResponse = await this.#db!
            .execute(new Uint8Array(encoded))
            .then((raw: any) => ({ result: this.#context.decode(new Uint8Array(raw.buffer)) }))
            .catch((message: any) => ({ error: { code: -1, message } }));

        if ("result" in res) {
            switch (request.method) {
                case "use": {
                    this.#connection.namespace = request
                        .params?.[0] as string;
                    this.#connection.database = request
                        .params?.[1] as string;
                    break;
                }

                case "signin":
                case "signup": {
                    this.#connection.accessToken = res.result as string;
                    break;
                }

                case "authenticate": {
                    this.#connection.accessToken = request.params?.[0] as string;
                    break;
                }

                case "invalidate": {
                    this.#connection.accessToken = undefined;
                    this.#connection.refreshToken = undefined;
                    break;
                }
            }
        }

        return res as RpcResponse<Result>;
    }

    export(options?: Partial<ExportOptions>): Promise<string> {
        if (!this.#db) throw new ConnectionUnavailable();
        return this.#db.export(options ? new Uint8Array(this.#context.encode(options)) : undefined);
    }

    import(data: string): Promise<void> {
        if (!this.#db) throw new ConnectionUnavailable();
        return this.#db.import(data);
    }

}