const { fork: cpFork } = require('child_process');
const { cpus } = require('os');
const { resolve } = require('path');

const logMessages = require('./util/log-messages');
const pluginCompat = require('./util/plugin-compat');

const webpackBin = () => {
  try {
    return require.resolve('webpack-cli');
  } catch (e) {}
  try {
    return require.resolve('webpack-command');
  } catch (e) {}
  throw new Error('webpack cli tool not installed or discoverable');
};

const configPath = compiler => {
  try {
    return require.resolve(
      resolve(compiler.options.context || process.cwd(), 'webpack.config'),
    );
  } catch (e) {}
  try {
    return require.resolve(resolve(process.cwd(), 'webpack.config'));
  } catch (e) {}
  throw new Error('config not in obvious location');
};

class ParallelModulePlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    try {
      require('webpack/lib/JavascriptGenerator');
    } catch (e) {
      logMessages.parallelRequireWebpack4(compiler);
      return;
    }

    const options = this.options || {};
    const fork =
      options.fork ||
      ((fork, compiler, webpackBin) =>
        fork(webpackBin(compiler), ['--config', configPath(compiler)], {
          silent: true,
        }));
    const numWorkers = options.numWorkers
      ? typeof options.numWorkers === 'function'
        ? options.numWorkers
        : () => options.numWorkers
      : () => cpus().length;
    const minModules =
      typeof options.minModules === 'number' ? options.minModules : 10;

    const compilerHooks = pluginCompat.hooks(compiler);

    let freeze, thaw;

    compilerHooks._hardSourceMethods.tap('ParallelModulePlugin', methods => {
      freeze = methods.freeze;
      thaw = methods.thaw;
    });

    compilerHooks.thisCompilation.tap(
      'ParallelModulePlugin',
      (compilation, params) => {
        const compilationHooks = pluginCompat.hooks(compilation);
        const nmfHooks = pluginCompat.hooks(params.normalModuleFactory);

        const doMaster = () => {
          const jobs = {};
          const readyJobs = {};
          const workers = [];

          let nextWorkerIndex = 0;

          let start = 0;
          let started = false;
          let configMismatch = false;

          let modules = 0;

          const startWorkers = () => {
            const _numWorkers = numWorkers();
            logMessages.parallelStartWorkers(compiler, {
              numWorkers: _numWorkers,
            });

            for (let i = 0; i < _numWorkers; i++) {
              const worker = fork(cpFork, compiler, webpackBin);
              workers.push(worker);
              worker.on('message', _result => {
                if (configMismatch) {
                  return;
                }

                if (_result.startsWith('ready:')) {
                  const configHash = _result.split(':')[1];
                  if (configHash !== compiler.__hardSource_configHash) {
                    logMessages.parallelConfigMismatch(compiler, {
                      outHash: compiler.__hardSource_configHash,
                      theirHash: configHash,
                    });

                    configMismatch = true;
                    killWorkers();
                    for (const id in jobs) {
                      jobs[id].cb({ error: true });
                      delete readyJobs[id];
                      delete jobs[id];
                    }
                    return;
                  }
                }

                if (Object.values(readyJobs).length) {
                  const id = Object.keys(readyJobs)[0];
                  worker.send(
                    JSON.stringify({
                      id,
                      data: readyJobs[id].data,
                    }),
                  );
                  delete readyJobs[id];
                } else {
                  worker.ready = true;
                }

                if (_result.startsWith('ready:')) {
                  start = Date.now();
                  return;
                }

                const result = JSON.parse(_result);
                jobs[result.id].cb(result);
                delete [result.id];
              });
            }
          };

          const killWorkers = () => {
            Object.values(workers).forEach(worker => worker.kill());
          };

          const doJob = (module, cb) => {
            if (configMismatch) {
              cb({ error: new Error('config mismatch') });
              return;
            }

            const id = 'xxxxxxxx-xxxxxxxx'.replace(/x/g, () =>
              Math.random()
                .toString(16)
                .substring(2, 3),
            );
            jobs[id] = {
              id,
              data: freeze('Module', null, module, {
                id: module.identifier(),
                compilation,
              }),
              cb,
            };

            const worker = Object.values(workers).find(worker => worker.ready);
            if (worker) {
              worker.ready = false;
              worker.send(
                JSON.stringify({
                  id,
                  data: jobs[id].data,
                }),
              );
            } else {
              readyJobs[id] = jobs[id];
            }

            if (!started) {
              started = true;
              startWorkers();
            }
          };

          const _create = params.normalModuleFactory.create;
          params.normalModuleFactory.create = (data, cb) => {
            _create.call(params.normalModuleFactory, data, (err, module) => {
              if (err) {
                return cb(err);
              }
              if (module.constructor.name === 'NormalModule') {
                const build = module.build;
                module.build = (
                  options,
                  compilation,
                  resolver,
                  fs,
                  callback,
                ) => {
                  if (modules < minModules) {
                    build.call(
                      module,
                      options,
                      compilation,
                      resolver,
                      fs,
                      callback,
                    );
                    modules += 1;
                    return;
                  }

                  try {
                    doJob(module, result => {
                      if (result.error) {
                        build.call(
                          module,
                          options,
                          compilation,
                          resolver,
                          fs,
                          callback,
                        );
                      } else {
                        thaw('Module', module, result.module, {
                          compilation,
                          normalModuleFactory: params.normalModuleFactory,
                          contextModuleFactory: params.contextModuleFactory,
                        });
                        callback();
                      }
                    });
                  } catch (e) {
                    logMessages.parallelErrorSendingJob(compiler, e);
                    build.call(
                      module,
                      options,
                      compilation,
                      resolver,
                      fs,
                      callback,
                    );
                  }
                };
                cb(null, module);
              } else {
                cb(err, module);
              }
            });
          };

          compilationHooks.seal.tap('ParallelModulePlugin', () => {
            killWorkers();
          });
        };

        const doChild = () => {
          const _create = params.normalModuleFactory.create;
          params.normalModuleFactory.create = (data, cb) => {};

          process.send('ready:' + compiler.__hardSource_configHash);

          process.on('message', _job => {
            const job = JSON.parse(_job);
            const module = thaw('Module', null, job.data, {
              compilation,
              normalModuleFactory: params.normalModuleFactory,
              contextModuleFactory: params.contextModuleFactory,
            });

            module.build(
              compilation.options,
              compilation,
              compilation.resolverFactory.get('normal', module.resolveOptions),
              compilation.inputFileSystem,
              error => {
                process.send(
                  JSON.stringify({
                    id: job.id,
                    error: error,
                    module:
                      module &&
                      freeze('Module', null, module, {
                        id: module.identifier(),
                        compilation,
                      }),
                  }),
                );
              },
            );
          });
        };

        if (!process.send) {
          doMaster();
        } else {
          doChild();
        }
      },
    );
  }
}

module.exports = ParallelModulePlugin;
