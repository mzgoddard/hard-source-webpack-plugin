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

      if (cluster.isMaster) {
        const jobs = {};
        const readyJobs = {};

        let nextWorkerIndex = 0;

        const doJob = (data, cb) => {
          const id = Math.random().toString(16).substring(2);
          console.log('job id', id);
          jobs[id] = {
            id,
            data,
            cb,
          };

          const worker = Object.values(cluster.workers).find(worker => worker.ready);
          if (worker) {
            worker.ready = false;
            worker.send(JSON.stringify({
              id,
              data,
            }));
          } else {
            readyJobs[id] = jobs[id];
          }
        };

        const _create = params.normalModuleFactory.create;
        params.normalModuleFactory.create = (data, cb) => {
          console.log('master send');
          doJob(data, result => {
            if (result.error) {
              _create.call(params.normalModuleFactory, data, cb);
            } else {
              console.log('master receive', result.id);
              cb(null, thaw('Module', null, result.module, {
                compilation,
                normalModuleFactory: params.normalModuleFactory,
                contextModuleFactory: params.contextModuleFactory,
              }));
            }
          });
        };

        let start = 0;
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

        compilationHooks.seal.tap('ParallelModulePlugin', () => {
          console.log('duration', Date.now() - start);
          Object.values(cluster.workers).forEach(worker => worker.kill());
        });
      } else {
        const _create = params.normalModuleFactory.create;
        params.normalModuleFactory.create = (data, cb) => {};

        process.send('ready');

        process.on('message', _job => {
          const job = JSON.parse(_job);
          console.log('worker receive');
          _create.call(params.normalModuleFactory, job.data, (error, module) => {
            if (error) {
              process.send(JSON.stringify({
                id: job.id,
                error: error,
              }));
              return;
            }

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
        });
      }
    });
  }
}

module.exports = ParallelModulePlugin;
