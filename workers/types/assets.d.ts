/** Font files are bundled as raw binary data via the wrangler "Data" module rule. */
declare module '*.ttf' {
  const data: ArrayBuffer;
  export default data;
}

/** Wasm files are bundled as compiled modules by wrangler's built-in wasm support. */
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
