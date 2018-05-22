// FIB_PATH='./fib'

import(${FIB_PATH})
.then(function(fib) {
  console.log(fib(3));
});
