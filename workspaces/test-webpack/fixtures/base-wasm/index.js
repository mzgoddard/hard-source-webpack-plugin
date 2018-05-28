import { add, getNumber } from './wasm.wasm';

console.log(add(getNumber(), 2));
