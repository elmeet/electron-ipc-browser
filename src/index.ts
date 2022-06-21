const isString = (v: unknown): v is string => typeof v === "string";
const isFunction = (v: unknown): v is (...args: unknown[]) => unknown =>
  typeof v === "function";

export type RendererToMainData = {
  id: string;
  data: unknown;
  name: string;
};

export type MainToRendererData = {
  data: unknown;
  name: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Parameter<T extends (args: any) => any> = T extends (args: infer P) => any
  ? P
  : never;

type FunctionPromiseMayBe<T extends (...args: any) => any> = T extends (
  args: any
) => Promise<any>
  ? T
  : T extends (args: infer P) => infer R
  ? ((args: P) => Promise<R>) | T
  : T;

type PromiseResolveType<T> = T extends Promise<infer R> ? R : T;
type ReturnResolveType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? PromiseResolveType<R>
  : any;

let singleMainHub: unknown | null = null;

export function useMainHub<
  RendererToMain extends Record<string, (args: any) => any>
>() {
  if (singleMainHub) {
    return singleMainHub as typeof hub;
  }

  const _all: Map<string, Function> = new Map();

  type MainKey = keyof RendererToMain;
  type MainHandler<K extends MainKey> = FunctionPromiseMayBe<RendererToMain[K]>;

  // type RendererKey = keyof MainToRenderer;
  // type RendererHandler<K extends RendererKey> = MainToRenderer[K];

  const hub = {
    on<P extends MainKey>(name: P, handler: MainHandler<P>) {
      if (!isString(name)) {
        throw new TypeError("[electron-ipc-browser main] param name is not string");
      }
      if (!isFunction(handler)) {
        throw new TypeError(
          "[electron-ipc-browser main] param handler is not function"
        );
      }
      _all.set(name, handler);
    },
    off<P extends MainKey>(name: P) {
      if (!isString(name)) {
        throw new TypeError("param name is not function");
      }
      if (_all.has(name)) {
        _all.delete(name);
      }
    },
    async emit<P extends MainKey>(
      name: P,
      data: Parameter<MainHandler<P>>
    ): Promise<ReturnResolveType<MainHandler<P>>> {
      const handler = _all.get(name as string);
      if (handler) {
        return Promise.resolve(handler(data));
      } else {
        return Promise.reject(
          new Error(
            `[electron-ipc-browser main] main process not listen ${name as string}`
          )
        );
      }
    },
  };

  singleMainHub = hub;
  return hub;
}

let singleRendererHub: unknown | null = null;

export function useRendererHub<
  MainToRenderer extends Record<string, unknown>
>() {
  if (singleRendererHub) {
    return singleRendererHub as typeof hub;
  }
  const _all: Map<string, Function[]> = new Map();
  const replys: Map<string, Function> = new Map();


  type RendererKey = keyof MainToRenderer;
  type FunctionByParam<K extends RendererKey> = (arg: MainToRenderer[K]) => any;
  type RendererHandler<K extends RendererKey> = MainToRenderer[K];

  const hub = {
    on<P extends RendererKey>(name: P, handler: FunctionByParam<P>) {
      if (!isString(name)) {
        throw new TypeError(
          "[electron-ipc-browser renderer] param name is not string"
        );
      }
      if (!isFunction(handler)) {
        throw new TypeError(
          "[electron-ipc-browser renderer] param handler is not function"
        );
      }
      const handlers = _all.get(name);
      const added = handlers && handlers.push(handler);
      if (!added) {
        _all.set(name, [handler]);
      }
    },
    off<P extends RendererKey>(name: P, handler: FunctionByParam<P>) {
      if (!isString(name)) {
        throw new TypeError(
          "[electron-ipc-browser renderer] param name is not string"
        );
      }
      if (handler && !isFunction(handler)) {
        throw new TypeError(
          "[electron-ipc-browser renderer] param handler is not function"
        );
      }
      if (!handler) {
        _all.delete(name);
        return;
      }
      const handlers = _all.get(name);
      if (handlers) {
        handlers.splice(
          handlers.indexOf(handler as unknown as Function) >>> 0,
          1
        );
      }
    },
    emit<P extends RendererKey>(name: P, data: RendererHandler<P>) {
      if (!isString(name)) {
        throw new TypeError("[electron-ipc-browser renderer] param name is not string");
      }
      const handlers = _all.get(name as string);
      if (handlers) {
        handlers.forEach((fn) => {
          fn(data);
        });
      }
    },
  };
  singleRendererHub = hub;
  return hub;
}
