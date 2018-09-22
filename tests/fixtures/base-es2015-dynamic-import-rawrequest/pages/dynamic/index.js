import(/* webpackChunkName: 'foo' */'../../components/obj')
.then((mod) => {
  console.log(mod.default())
});
