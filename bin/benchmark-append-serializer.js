#!/usr/bin/env node

const rimraf = require('rimraf');

const AppendSerializer = require('../lib/hard-source-append-2-serializer');
const pify = require('../lib/util/promisify');

const lorem = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
  tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
  quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
  consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse
  cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
  proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;
const superIpsum = Array.from(new Array(100), () => lorem).join('\n\n');

const diskFile = `${__dirname}/../tmp/append`;

const clean = () => {
  return pify(rimraf)(diskFile);
};

const serializer = () => {
  return new AppendSerializer({
    cacheDirPath: diskFile,
  });
};

const read = () => {
  const s = serializer();
  return s.read();
};

const write = (size, lorem) => {
  const s = serializer();
  const ops = Array.from(new Array(size), (_, i) => ({
    key: `lorem${i}`,
    value: lorem,
  }));
  return s.write(ops);
};

const sizes = [128, 256, 512, 1024, 2048, 4096];
const main = async () => {
  for (const size of sizes) {
    await clean();
    let start = Date.now();
    await write(size, superIpsum);
    console.log('write', size, Date.now() - start);
    start = Date.now();
    const map = await read();
    console.log('read', size, Date.now() - start);

    // validate
    if (Object.values(map).length !== size) {
      throw new Error(
        `missing entries: ${Object.values(map).length} !== ${size}`,
      );
    }
    for (const value of Object.values(map)) {
      if (value !== superIpsum) {
        throw new Error('bad write or read');
      }
    }
  }
};

main();
