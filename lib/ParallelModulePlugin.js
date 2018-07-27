const cluster = require('cluster');
const {cpus} = require('os');

const pluginCompat = require('./util/plugin-compat');

class ParallelModulePlugin {
  apply(compiler) {
    const compilerHooks = pluginCompat.hooks(compiler);

    let freeze, thaw;

    compilerHooks._hardSourceMethods.tap('ParallelModulePlugin', methods => {
      freeze = methods.freeze;
      thaw = methods.thaw;
    });

    compilerHooks.thisCompilation.tap('ParallelModulePlugin', (compilation, params) => {
      const compilationHooks = pluginCompat.hooks(compilation);
      const nmfHooks = pluginCompat.hooks(params.normalModuleFactory);

      const webpackBin = () => {
        try {
          return require.resolve('webpack-cli');
        } catch (e) {}
        try {
          return require.resolve('webpack-command');
        } catch (e) {}
        throw new Error('webpack cli tool not installed');
      };

      const doMaster = () => {
        const jobs = {};
        const readyJobs = {};

        let nextWorkerIndex = 0;

        let start = 0;
        let started = false;

        const startWorkers = () => {
          console.log(`starting ${cpus().length} workers`);
          for (let i = 0; i < cpus().length; i++) {
            const worker = cluster.fork();
            worker.on('message', _result => {
              if (Object.values(readyJobs).length) {
                const id = Object.keys(readyJobs)[0];
                worker.send(JSON.stringify({
                  id,
                  data: readyJobs[id].data,
                }));
                delete readyJobs[id];
              } else {
                worker.ready = true;
              }

              if (_result === 'ready') {
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
          Object.values(cluster.workers).forEach(worker => worker.kill());
        };

        const doJob = (module, cb) => {
          const id = 'xxxxxxxx-xxxxxxxx'.replace(/x/g, () => Math.random().toString(16).substring(2, 3));
          console.log('job id', id);
          jobs[id] = {
            id,
            data: freeze('Module', null, module, {
              id: module.identifier(),
              compilation,
            }),
            cb,
          };

          const worker = Object.values(cluster.workers).find(worker => worker.ready);
          if (worker) {
            worker.ready = false;
            worker.send(JSON.stringify({
              id,
              data: jobs[id].data,
            }));
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
              console.log('built', module.built);
              const build = module.build;
              module.build = (options, compilation, resolver, fs, callback) => {
                console.log('master send', 'built', module.built);
                doJob(module, result => {
                  if (result.error) {
                    build.call(module.build, options, compilation, resolver, fs, callback);
                  } else {
                    console.log('master receive', result.id);
                    thaw('Module', module, result.module, {
                      compilation,
                      normalModuleFactory: params.normalModuleFactory,
                      contextModuleFactory: params.contextModuleFactory,
                    });
                    callback();
                  }
                });
              };
              cb(null, module);
            } else {
              cb(err, module);
            }
          });
        };

        compilationHooks.seal.tap('ParallelModulePlugin', () => {
          console.log('duration', Date.now() - start);
          killWorkers();
        });
      };

      const doChild = () => {
        const _create = params.normalModuleFactory.create;
        params.normalModuleFactory.create = (data, cb) => {};

        process.send('ready');

        process.on('message', _job => {
          const job = JSON.parse(_job);
          const module = thaw('Module', null, job.data, {
            compilation,
            normalModuleFactory: params.normalModuleFactory,
            contextModuleFactory: params.contextModuleFactory,
          });
          console.log('worker receive');
 
          module.build(
            compilation.options,
            compilation,
            compilation.resolverFactory.get("normal", module.resolveOptions),
            compilation.inputFileSystem,
            error => {
              console.log('worker send', job.id);
              process.send(JSON.stringify({
                id: job.id,
                error: error,
                module: module && freeze('Module', null, module, {
                  id: module.identifier(),
                  compilation,
                }),
              }));
            }
          );

        });
      };

      if (cluster.isMaster) {
        doMaster();
      } else {
        doChild();
      }
    });
  }
}

module.exports = ParallelModulePlugin;
