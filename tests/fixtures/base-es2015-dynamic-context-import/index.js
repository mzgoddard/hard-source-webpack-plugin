const l = 'obj';
import(/* webpackChunkName: '[request].locale' */`./fibs/${window.Globals.locale}`)
.then(({fib}) => {
  console.log(fib(3));
});
