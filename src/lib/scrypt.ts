type ScryptModule = {
  scrypt: (options: {
    password: Uint8Array;
    salt: Uint8Array;
    costFactor: number;
    blockSize: number;
    parallelism: number;
    hashLength: number;
    outputType: "binary";
  }) => Promise<Uint8Array | number[]>;
};

let browserModulePromise: Promise<ScryptModule> | null = null;
let nodeModulePromise: Promise<ScryptModule> | null = null;

async function loadScryptModule(): Promise<ScryptModule> {
  if (typeof window === "undefined") {
    if (!nodeModulePromise) {
      nodeModulePromise = import("hash-wasm") as Promise<ScryptModule>;
    }

    return nodeModulePromise;
  }

  if (!browserModulePromise) {
    const browserModulePath = new URL("../vendor/hash-wasm/index.esm.js", import.meta.url).href;
    browserModulePromise = import(browserModulePath) as Promise<ScryptModule>;
  }

  return browserModulePromise;
}

export async function deriveScryptBytes(options: {
  password: Uint8Array;
  salt: Uint8Array;
  N: number;
  r: number;
  p: number;
  dkLen: number;
}): Promise<Uint8Array> {
  const { scrypt } = await loadScryptModule();
  const derived = await scrypt({
    password: options.password,
    salt: options.salt,
    costFactor: options.N,
    blockSize: options.r,
    parallelism: options.p,
    hashLength: options.dkLen,
    outputType: "binary",
  });

  return derived instanceof Uint8Array ? derived : new Uint8Array(derived);
}
